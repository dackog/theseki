// src/lib/uid.js
// CDN 版からのコピー (docs/index.html 行 1313-1319)
// ⚠️ 変更点: Math.random().toString(36) → crypto.randomUUID() (hex 8文字)
// 出力形式変更 (base-36 → hex) だが既存 localStorage データへの影響なし（IDは値として保存）

export function uid() { return crypto.randomUUID().replace(/-/g, '').slice(0, 8); }
export function now() { return new Date().toISOString(); }
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}
