// src/lib/shareRepository.js
// event_shares テーブルの CRUD と RPC アクセス
//
// テーブル構造:
//   id          uuid PK
//   event_id    uuid FK → events.id (CASCADE DELETE)
//   share_id    text UNIQUE  12文字hex（公開URL用）
//   is_active   boolean DEFAULT true
//   is_readonly boolean DEFAULT true（今フェーズは常にtrue）
//   expires_at  timestamptz NULL（NULL=無期限）
//   created_at  timestamptz DEFAULT now()
//   created_by  uuid FK → auth.users
//
// RLS: SELECT は有効リンクを公開。INSERT/UPDATE/DELETE はオーナーのみ。
// RPC: get_shared_event(share_id) → SECURITY DEFINER で events RLS を迂回して返す。

import { supabase } from './supabase.js';

const _log = (...args) => {
  if (import.meta.env.DEV) console.debug('[shareRepository]', ...args);
};

/** 12文字の hex share_id を生成する（uid() の拡張版）*/
function _shareId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/**
 * 共有リンクを作成する。
 * @param {string} eventId  events.id（ローカル 8文字hex = client_id ではなく DB の uuid）
 * @returns {Promise<{ shareId: string | null, error: Error | null }>}
 */
export async function createShare(eventId) {
  _log('createShare', eventId);
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return { shareId: null, error: new Error('ログインが必要です') };
  }

  const shareId = _shareId();
  const { error } = await supabase.from('event_shares').insert({
    event_id:   eventId,
    share_id:   shareId,
    is_active:  true,
    is_readonly: true,
    expires_at: null,
    created_by: userId,
  });

  if (error) {
    console.error('[shareRepository] createShare error:', error);
    return { shareId: null, error };
  }
  return { shareId, error: null };
}

/**
 * share_id からイベント本体（payload_json）を取得する。
 * RPC get_shared_event を呼び出す（未ログインでも動作）。
 * 無効・期限切れ・存在しない場合は event: null を返す。
 *
 * @param {string} shareId
 * @returns {Promise<{ event: object | null, error: Error | null }>}
 */
export async function getSharedEvent(shareId) {
  _log('getSharedEvent', shareId);
  const { data, error } = await supabase.rpc('get_shared_event', { p_share_id: shareId });
  if (error) {
    console.error('[shareRepository] getSharedEvent error:', error);
    return { event: null, error };
  }
  return { event: data ?? null, error: null };
}

/**
 * 共有リンクを無効化する（is_active = false）。
 * @param {string} shareId  event_shares.share_id
 * @returns {Promise<{ error: Error | null }>}
 */
export async function deactivateShare(shareId) {
  _log('deactivateShare', shareId);
  const { error } = await supabase
    .from('event_shares')
    .update({ is_active: false })
    .eq('share_id', shareId);

  if (error) {
    console.error('[shareRepository] deactivateShare error:', error);
  }
  return { error: error ?? null };
}

/**
 * イベントに紐づく共有リンク一覧を取得する（Phase B: 管理UI用）。
 * @param {string} eventId  events.id (DB uuid)
 * @returns {Promise<{ data: Array, error: Error | null }>}
 */
export async function listSharesForEvent(eventId) {
  _log('listSharesForEvent', eventId);
  const { data, error } = await supabase
    .from('event_shares')
    .select('id, share_id, is_active, expires_at, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error: error ?? null };
}
