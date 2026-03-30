// src/lib/syncMeta.js
// 差分同期メタデータの管理。
// { [clientId: string]: lastSyncedAtMs: number } を localStorage に保存する。
// clientId = event.id（8文字 hex）、lastSyncedAtMs = 同期成功時の Date.now()。
//
// ログアウト時に clearSyncMeta() を呼ぶこと（storage.js の clearState() と同タイミング）。

const SYNC_META_KEY = 'theseki_syncmeta';

/**
 * syncMeta を localStorage から読み込む。
 * @returns {{ [clientId: string]: number }}
 */
export function loadSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * syncMeta を localStorage へ保存する。
 * @param {{ [clientId: string]: number }} meta
 */
export function saveSyncMeta(meta) {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // 書き込み失敗は無視（次回同期で再試行される）
  }
}

/**
 * localStorage の syncMeta を削除する。
 * ログアウト時に clearState() と同時に呼ぶ。
 */
export function clearSyncMeta() {
  localStorage.removeItem(SYNC_META_KEY);
}

/**
 * 同期済み clientId の lastSyncedAtMs を更新した meta を返す（書き込みは呼び出し側で行う）。
 * @param {{ [clientId: string]: number }} meta  現在の meta
 * @param {string[]} clientIds                   同期成功した clientId 配列
 * @returns {{ [clientId: string]: number }}     更新後の meta
 */
export function markSynced(meta, clientIds) {
  const now = Date.now();
  const updated = { ...meta };
  for (const id of clientIds) {
    updated[id] = now;
  }
  return updated;
}

/**
 * 未同期（dirty）のイベント一覧を返す。
 * event.updatedAt（ISO文字列）を ms に変換して meta[ev.id] と比較する。
 * meta に存在しない = 一度も同期していない → dirty 扱い。
 *
 * @param {object[]} events  state.events
 * @param {{ [clientId: string]: number }} meta
 * @returns {object[]}  dirty events
 */
export function getUnsyncedEvents(events, meta) {
  return events.filter(ev => {
    const lastMs = meta[ev.id] ?? 0;
    const updatedMs = ev.updatedAt ? new Date(ev.updatedAt).getTime() : 0;
    return updatedMs > lastMs;
  });
}
