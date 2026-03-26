// src/lib/storage.js
// localStorage 全責務を集約。
// 将来の Supabase 移行時はこのファイルの loadState/saveState を差し替える。
// CDN 版からのコピー (docs/index.html 行 1160-1254)

// --- 定数 ---
export const LS_KEY = 'theseki_v2';
export const SCHEMA_VERSION = 2;

// --- データ整合性 ---

/** データ整合性クリーニング: 孤立assignment・NG等を自動除去 */
export function sanitizeEvent(ev) {
  if (!ev) return ev;
  const attendeeIds = new Set((ev.attendees||[]).map(a=>a.id));
  // 座席IDセット
  const seatIds = new Set();
  (ev.tables||[]).forEach(t=>{ for(let i=1;i<=t.seatCount;i++) seatIds.add(`${t.name}-${i}`); });

  // assignments: 存在しない参加者・座席を除去
  const assignments = {};
  Object.entries(ev.assignments||{}).forEach(([sid,aid])=>{
    if (seatIds.has(sid) && (!aid || attendeeIds.has(aid))) assignments[sid]=aid;
  });
  // ngPairs: 両者が存在する場合のみ残す
  const ngPairs = (ev.ngPairs||[]).filter(p=>attendeeIds.has(p.a)&&attendeeIds.has(p.b));
  const lockedAttendees = {};
  Object.entries(ev.lockedAttendees||{}).forEach(([aid,locked])=>{
    if (locked && attendeeIds.has(aid)) lockedAttendees[aid] = true;
  });
  const customRule = ev.customRule === 'gather' ? 'gather' : 'disperse';
  const customGatherFlags = [...new Set((ev.customGatherFlags||[]).filter(f=>typeof f === 'string' && f.trim()))].slice(0,4);
  const customRules = Array.isArray(ev.customRules)
    ? ev.customRules
      .filter(r => r && typeof r.flag === 'string' && r.flag.trim() && (r.mode === 'distribute' || r.mode === 'gather'))
      .map(r => ({ flag: r.flag.trim(), mode: r.mode }))
      .slice(0,4)
    : customGatherFlags.map(flag => ({ flag, mode: customRule === 'gather' ? 'gather' : 'distribute' }));
  return {...ev, assignments, ngPairs, lockedAttendees, customRule, customGatherFlags, customRules};
}

export function getFlagRulesFromLegacy(customRule, customGatherFlags) {
  const flags = [...new Set((customGatherFlags||[]).filter(f=>typeof f === 'string' && f.trim()))].slice(0,4);
  const mode = customRule === 'gather' ? 'gather' : 'distribute';
  return flags.map(flag => ({ flag, mode }));
}

export function normalizeFlagRules(rules, customRule, customGatherFlags) {
  const base = Array.isArray(rules) ? rules : getFlagRulesFromLegacy(customRule, customGatherFlags);
  return [...new Map(base
    .filter(r => r && typeof r.flag === 'string' && r.flag.trim() && (r.mode === 'distribute' || r.mode === 'gather'))
    .map(r => [`${r.flag.trim()}__${r.mode}`, { flag: r.flag.trim(), mode: r.mode }]))
    .values()].slice(0,4);
}

// --- マイグレーション ---

/** v1 → v2 マイグレーション */
export function migrate(raw) {
  if (!raw) return null;
  // v1はversionフィールドなし
  if (!raw.version || raw.version < 2) {
    return {
      version: SCHEMA_VERSION,
      events: (raw.events||[]).map(e=>sanitizeEvent({
        tables: [], attendees: [], ngPairs: [], assignments: {}, ...e
      })),
      currentEventId: raw.currentEventId || null,
    };
  }
  return raw;
}

// --- 読み書き ---
// 将来の Supabase 移行ポイント: loadState / saveState を非同期 API 呼び出しへ差し替える

export function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    // 旧キーからの移行
    if (!raw) {
      const old = JSON.parse(localStorage.getItem('theseki_v1') || 'null');
      if (old) return migrate(old);
      return null;
    }
    return migrate(raw);
  } catch(e) {
    console.warn('[TheSEKI] ストレージ読み込みエラー。リセットします。', e);
    return null;
  }
}

let _saveErrorShown = false;
export function saveState(s) {
  try {
    const payload = JSON.stringify({...s, version: SCHEMA_VERSION});
    localStorage.setItem(LS_KEY, payload);
    _saveErrorShown = false;
  } catch(e) {
    if (!_saveErrorShown) {
      _saveErrorShown = true;
      console.error('[TheSEKI] 保存失敗（容量超過の可能性）', e);
      // 通知はApp側でハンドル
      window.dispatchEvent(new CustomEvent('theseki:saveerror', {detail: e.message}));
    }
  }
}
