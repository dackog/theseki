// src/lib/uid.js
// CDN 版からのコピー (docs/index.html 行 1313-1319)
// uid() は Commit 8 で crypto.randomUUID() へ変更予定

export function uid() { return Math.random().toString(36).slice(2,10); }
export function now() { return new Date().toISOString(); }
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}
