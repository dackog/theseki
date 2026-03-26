// src/lib/share.js
// URL 共有・JSON import/export の責務を集約。
// ⚠️ 高リスク機能: buildShareURL / loadSharedEvent / exportEventJSON / parseImportedEvent
// 変更時は必ず差分と確認ポイントを明示すること（計画 "追記3" 参照）。
// 将来の Supabase 移行時: buildShareURL を shareId（DB UUID）方式へ差し替えポイント。
// CDN 版からのコピー (docs/index.html 行 1256-1311)

import { uid, now } from './uid.js';
import { sanitizeEvent, SCHEMA_VERSION } from './storage.js';

/** イベント単位でJSONエクスポート
 * ⚠️ 高リスク機能: 変更時は差分・確認ポイントを明示
 */
export function exportEventJSON(ev) {
  const blob = new Blob([JSON.stringify({version: SCHEMA_VERSION, event: sanitizeEvent(ev)}, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `theseki_event_${ev.id}.json`; a.click();
  URL.revokeObjectURL(url);
}

/** JSONからイベントをインポート → 新IDで追加
 * ⚠️ 高リスク機能: 変更時は差分・確認ポイントを明示
 */
export function parseImportedEvent(text) {
  const data = JSON.parse(text);
  const ev = data.event || data; // フォールバック
  if (!ev.name) throw new Error('イベント名が見つかりません');
  const newId = uid();
  const idMap = {}; // old attendeeId → new attendeeId
  const newAttendees = (ev.attendees||[]).map(a=>{ const nid=uid(); idMap[a.id]=nid; return {...a,id:nid,eventId:newId}; });
  const newTables = (ev.tables||[]).map(t=>({...t,id:uid(),eventId:newId}));
  const newNg = (ev.ngPairs||[]).map(p=>({...p,id:uid(),a:idMap[p.a]||p.a,b:idMap[p.b]||p.b})).filter(p=>p.a&&p.b);
  // assignments: seatId はテーブル名ベースなので再構築
  const tableNameMap = {};
  (ev.tables||[]).forEach((ot,i)=>{ tableNameMap[ot.name]=newTables[i]?.name||ot.name; });
  const newAssign = {};
  Object.entries(ev.assignments||{}).forEach(([sid,aid])=>{
    // seatId = "T1-1" 形式。テーブル名部分を置換
    const [tname,...rest]=sid.split('-'); const newSid=(tableNameMap[tname]||tname)+'-'+rest.join('-');
    newAssign[newSid] = idMap[aid]||null;
  });
  const newLocked = {};
  Object.entries(ev.lockedAttendees||{}).forEach(([aid,locked])=>{
    if (locked && idMap[aid]) newLocked[idMap[aid]] = true;
  });
  return sanitizeEvent({...ev, id:newId, name:ev.name+' (インポート)', createdAt:now(), updatedAt:now(),
    tables:newTables, attendees:newAttendees, ngPairs:newNg, assignments:newAssign, lockedAttendees:newLocked});
}

/** 閲覧用URLハッシュ生成（イベントデータをBase64圧縮）
 * ⚠️ 高リスク機能: btoa/atob + encodeURIComponent のエンコーディング互換に注意
 * 将来: shareId（DB UUID）方式へ移行するポイント
 */
export function buildShareURL(ev) {
  try {
    const json = JSON.stringify(sanitizeEvent(ev));
    const encoded = btoa(encodeURIComponent(json));
    const url = `${location.href.split('#')[0]}#view=${encoded}`;
    return url;
  } catch { return null; }
}

/** URLハッシュから閲覧イベントを復元
 * ⚠️ 高リスク機能: エンコーディング互換に注意
 */
export function loadSharedEvent() {
  try {
    const hash = location.hash;
    if (!hash.startsWith('#view=')) return null;
    const encoded = hash.slice(6);
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json);
  } catch { return null; }
}
