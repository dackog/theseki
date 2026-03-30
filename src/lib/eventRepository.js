// src/lib/eventRepository.js
// events テーブルの CRUD — Phase 2（実 DB アクセス）
//
// テーブル構造:
//   id             uuid        PK (gen_random_uuid)
//   owner_user_id  uuid        references auth.users ON DELETE CASCADE
//   title          text        イベント名（payload_json.name の非正規化コピー）
//   payload_json   jsonb       イベントオブジェクト全体
//   client_id      text NULL   ローカルの uid() 8-char hex
//   created_at     timestamptz
//   updated_at     timestamptz（トリガーで自動更新）
//
// RLS: 全操作で auth.uid() = owner_user_id を強制。未ログインは全件 0 行。
//
// 命名ルール（変更禁止）:
//   createEvent(event.name, event)  →  title = event.name, payloadJson = event
//   client_id = event.id（ローカルの 8-char hex）

import { supabase } from './supabase.js';

const _log = (...args) => {
  if (import.meta.env.DEV) console.debug('[eventRepository]', ...args);
};

/** auth.uid() を取得。未ログインは null を返す。
 *  getSession()（ローカル読み取り）を使用。
 *  getUser()（サーバー検証）は GitHub Pages 等でセッション未検出になるケースがある。
 */
async function _currentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * 現在のログインユーザーが所有するイベント一覧を取得する。
 * RLS により owner_user_id = auth.uid() の行のみ返される。
 * 未ログイン時は空配列。
 *
 * @returns {Promise<{ data: Array, error: Error | null }>}
 */
export async function listEvents() {
  _log('listEvents');
  const { data, error } = await supabase
    .from('events')
    .select('id, title, payload_json, client_id, created_at, updated_at')
    .order('updated_at', { ascending: false });
  return { data: data ?? [], error: error ?? null };
}

/**
 * イベントを upsert する（新規 or 既存の更新）。
 * client_id（= event.id の 8-char hex）が一致する行があれば UPDATE、なければ INSERT。
 *
 * 呼び出し方:
 *   createEvent(event.name, event)
 *
 * @param {string} title         イベント名（event.name）
 * @param {object} payloadJson   イベントオブジェクト全体。payloadJson.id を client_id に使う。
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function createEvent(title, payloadJson) {
  _log('createEvent', { title, client_id: payloadJson?.id });
  const userId = await _currentUserId();
  if (!userId) {
    _log('createEvent: not authenticated, skipping');
    return { data: null, error: null };
  }

  const clientId = payloadJson?.id ?? null;

  // client_id が既に DB に存在するか確認（onConflict の代替）
  let existingId = null;
  if (clientId) {
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('owner_user_id', userId)
      .eq('client_id', clientId)
      .maybeSingle();
    existingId = existing?.id ?? null;
  }

  if (existingId) {
    // 既存行を UPDATE
    _log('createEvent → update', { existingId });
    const { data, error } = await supabase
      .from('events')
      .update({ title, payload_json: payloadJson })
      .eq('id', existingId)
      .select('id, title, client_id, updated_at')
      .maybeSingle();
    if (error) console.error('[eventRepository] createEvent update error:', error);
    return { data: data ?? null, error: error ?? null };
  } else {
    // 新規 INSERT
    _log('createEvent → insert', { clientId });
    const { data, error } = await supabase
      .from('events')
      .insert({ owner_user_id: userId, title, payload_json: payloadJson, client_id: clientId })
      .select('id, title, client_id, created_at, updated_at')
      .maybeSingle();
    if (error) console.error('[eventRepository] createEvent insert error:', error);
    return { data: data ?? null, error: error ?? null };
  }
}

/**
 * DB UUID でイベント行を更新する。
 * DB UUID が既知の場合（一覧取得後など）に使う。
 * client_id による upsert が不要な場合の直接更新。
 *
 * @param {string} id            events テーブルの UUID
 * @param {string} title         イベント名（event.name）
 * @param {object} payloadJson   イベントオブジェクト全体
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function updateEvent(id, title, payloadJson) {
  _log('updateEvent', { id, title });
  const { data, error } = await supabase
    .from('events')
    .update({ title, payload_json: payloadJson })
    .eq('id', id)
    .select('id, title, client_id, updated_at')
    .single();
  return { data: data ?? null, error: error ?? null };
}

/**
 * DB UUID でイベント行を削除する。
 * RLS により自分の行のみ削除可能。
 *
 * @param {string} id  events テーブルの UUID
 * @returns {Promise<{ error: Error | null }>}
 */
export async function deleteEvent(id) {
  _log('deleteEvent', { id });
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);
  return { error: error ?? null };
}

/**
 * DB UUID でイベント行を 1 件取得する。
 * 存在しない場合は data: null（エラーなし）を返す。
 *
 * @param {string} id  events テーブルの UUID
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
/**
 * ローカルイベント配列を Supabase に一括 upsert する。
 * 冪等: 何度呼んでも安全（ON CONFLICT DO UPDATE）。
 * 未ログイン時は { succeeded:0, failed:0, errors:[] } を返す（throw しない）。
 *
 * @param {object[]} events  state.events の配列（sanitizeEvent 済み）
 * @returns {Promise<{ succeeded: number, failed: number, errors: Array }>}
 */
export async function syncLocalEvents(events) {
  const userId = await _currentUserId();
  if (!userId) {
    _log('syncLocalEvents: not authenticated, skipping');
    return { succeeded: 0, failed: 0, errors: [] };
  }
  _log('syncLocalEvents', { count: events.length });

  const results = await Promise.allSettled(
    events.map(ev => createEvent(ev.name, ev))
  );

  let succeeded = 0;
  const errors = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && !r.value.error) {
      succeeded++;
    } else {
      errors.push(r.reason ?? r.value?.error ?? new Error('unknown'));
    }
  }
  const failed = results.length - succeeded;
  const firstErrorMessage = errors[0]?.message ?? errors[0]?.toString() ?? null;
  if (failed > 0) console.error('[eventRepository] syncLocalEvents errors:', errors);
  _log('syncLocalEvents result', { succeeded, failed });
  return { succeeded, failed, errors, firstErrorMessage };
}

/**
 * 差分同期: dirty なイベント（未同期または更新済み）のみを DB に upsert する。
 * syncMeta との比較は呼び出し側（getUnsyncedEvents）が行う想定だが、
 * 念のため events が空の場合は即リターンする。
 *
 * syncLocalEvents との違い:
 *   - 渡された events を全件 upsert する（差分フィルタは呼び出し側の責任）
 *   - 成功した event の client_id 配列 syncedClientIds を返す（markSynced に渡す）
 *
 * @param {object[]} events  dirty events（getUnsyncedEvents でフィルタ済み）
 * @returns {Promise<{ succeeded: number, failed: number, errors: Array, firstErrorMessage: string|null, syncedClientIds: string[] }>}
 */
export async function syncDirtyEvents(events) {
  const userId = await _currentUserId();
  if (!userId) {
    _log('syncDirtyEvents: not authenticated, skipping');
    return { succeeded: 0, failed: 0, errors: [], firstErrorMessage: null, syncedClientIds: [] };
  }
  if (events.length === 0) {
    return { succeeded: 0, failed: 0, errors: [], firstErrorMessage: null, syncedClientIds: [] };
  }
  _log('syncDirtyEvents', { count: events.length });

  const results = await Promise.allSettled(
    events.map(ev => createEvent(ev.name, ev))
  );

  let succeeded = 0;
  const syncedClientIds = [];
  const errors = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled' && !r.value.error) {
      succeeded++;
      syncedClientIds.push(events[i].id);
    } else {
      errors.push(r.reason ?? r.value?.error ?? new Error('unknown'));
    }
  }

  const failed = results.length - succeeded;
  const firstErrorMessage = errors[0]?.message ?? errors[0]?.toString() ?? null;
  if (failed > 0) console.error('[eventRepository] syncDirtyEvents errors:', errors);
  _log('syncDirtyEvents result', { succeeded, failed, syncedClientIds });
  return { succeeded, failed, errors, firstErrorMessage, syncedClientIds };
}

/**
 * client_id（= event.id 8文字 hex）でイベント行を削除する。
 * 対象行が存在しない場合は何もせず { error: null } を返す。
 *
 * @param {string} clientId  event.id（8文字 hex）
 * @returns {Promise<{ error: Error | null }>}
 */
export async function deleteEventByClientId(clientId) {
  _log('deleteEventByClientId', { clientId });
  const userId = await _currentUserId();
  if (!userId) return { error: null };
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (!data?.id) return { error: null };
  return deleteEvent(data.id);
}

export async function getEvent(id) {
  _log('getEvent', { id });
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return { data: data ?? null, error: error ?? null };
}
