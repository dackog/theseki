// src/components/FloorTable.jsx
// LayoutPage で使う読み取り専用テーブル表示コンポーネント
// CDN 版からのコピー (docs/index.html 行 1531-1694)
// ⚠️ ドラッグ機能: startDrag (onMouseDown → mousemove/mouseup) を含む高リスク箇所

export default function FloorTable({ table, seats, assignments, attendees, violationSeatIds, selected, onSelect, onDragEnd }) {
  const CHAIR_COUNT = table.seatCount;
  const shape = table.shape || 'rect'; // 'round' | 'rect'

  // --- 丸テーブルのサイズ計算 ---
  const tableR    = Math.max(42, Math.min(80, 28 + CHAIR_COUNT * 4));
  const chairR    = Math.max(18, Math.min(28, tableR * 0.42));
  const orbitR    = tableR + chairR + 6;
  const roundSize = (orbitR + chairR) * 2 + 20;

  // --- 四角テーブルのサイズ・席配置計算 ---
  const rectChairW = 40;
  const rectChairH = 40;
  const rectGap    = 6;  // 椅子間隔
  const rectPad    = 14; // 天板内余白

  // N席を上下2辺のみに分散: 上=ceil(N/2)、下=残り
  const topCount    = Math.ceil(CHAIR_COUNT / 2);
  const bottomCount = CHAIR_COUNT - topCount;
  const dist = { top: topCount, right: 0, bottom: bottomCount, left: 0 };

  // 天板サイズ: 上下の最大席数でWを決定、H は固定
  const longestH   = Math.max(dist.top, dist.bottom);
  const rectTableW = Math.max(100, longestH * (rectChairW + rectGap) - rectGap + rectPad * 2);
  const rectTableH = 60;
  const canvasW    = rectTableW + 20;
  const canvasH    = rectTableH + (rectChairH + rectGap) * 2 + 20;
  const tLeft      = (canvasW - rectTableW) / 2;
  const tTop       = (canvasH - rectTableH) / 2;

  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX - (table.posX || 80);
    const startY = e.clientY - (table.posY || 80);
    const move = (me) => onDragEnd(table.id, Math.max(20, me.clientX - startX), Math.max(20, me.clientY - startY));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // 椅子の色クラス取得
  const chairCls = (seat) => {
    if (violationSeatIds.has(seat.id)) return 'violation';
    if (assignments[seat.id]) return 'occupied';
    return 'empty';
  };
  const chairLabel = (seat) => {
    const aId = assignments[seat.id];
    const att = aId ? attendees.find(a=>a.id===aId) : null;
    return att
      ? <span className="floor-chair-name">{att.name.length > 4 ? att.name.slice(0,4) : att.name}</span>
      : <span className="floor-chair-id">{seat.index}</span>;
  };

  // ── 四角テーブル席配置: 4辺に均等配置、各辺センタリング ──
  const buildRectChairs = () => {
    const placed = [];
    let idx = 0;

    // 1辺ぶんの椅子を座標付きで追加するヘルパー
    const placeEdge = (count, getPos) => {
      for (let i = 0; i < count && idx < seats.length; i++, idx++) {
        placed.push({ ...getPos(i, count), seat: seats[idx] });
      }
    };

    // 辺ごとの総幅を計算してセンタリングするユーティリティ
    const edgeW = (n) => n * (rectChairW + rectGap) - rectGap; // 横方向
    const edgeH = (n) => n * (rectChairH + rectGap) - rectGap; // 縦方向

    // 上辺（左→右）
    placeEdge(dist.top, (i, n) => ({
      x: tLeft + (rectTableW - edgeW(n)) / 2 + i * (rectChairW + rectGap),
      y: tTop - rectChairH - rectGap,
    }));
    // 右辺（上→下）
    placeEdge(dist.right, (i, n) => ({
      x: tLeft + rectTableW + rectGap,
      y: tTop + (rectTableH - edgeH(n)) / 2 + i * (rectChairH + rectGap),
    }));
    // 下辺（右→左、向き合うよう逆順）
    placeEdge(dist.bottom, (i, n) => ({
      x: tLeft + (rectTableW - edgeW(n)) / 2 + (n - 1 - i) * (rectChairW + rectGap),
      y: tTop + rectTableH + rectGap,
    }));
    // 左辺（下→上、向き合うよう逆順）
    placeEdge(dist.left, (i, n) => ({
      x: tLeft - rectChairW - rectGap,
      y: tTop + (rectTableH - edgeH(n)) / 2 + (n - 1 - i) * (rectChairH + rectGap),
    }));

    return placed;
  };

  if (shape === 'round') {
    // ── 丸テーブル ──
    const cx = roundSize / 2, cy = roundSize / 2;
    return (
      <div className={`floor-table-group ${selected?'selected':''}`}
        style={{ left: table.posX||80, top: table.posY||80, position:'absolute' }}
        onMouseDown={e => { if(e.button===0){ onSelect(table.id); startDrag(e); } }}>
        <div className="floor-table-label">{table.name}</div>
        <div style={{ position:'relative', width: roundSize, height: roundSize }}>
          <div className="floor-table-top" style={{
            width:tableR*2, height:tableR*2, borderRadius:'50%',
            position:'absolute', left:cx-tableR, top:cy-tableR, pointerEvents:'none',
          }}/>
          {seats.map((seat, i) => {
            const angle = (2*Math.PI*i/CHAIR_COUNT) - Math.PI/2;
            const cx2 = cx + orbitR * Math.cos(angle);
            const cy2 = cy + orbitR * Math.sin(angle);
            return (
              <div key={seat.id} className={`floor-chair ${chairCls(seat)}`}
                style={{ width:chairR*2, height:chairR*2, left:cx2-chairR, top:cy2-chairR,
                  fontSize: chairR<22?'0.5rem':'0.58rem', borderRadius:'50%' }}
                title={assignments[seat.id] ? attendees.find(a=>a.id===assignments[seat.id])?.name : seat.id}
                onMouseDown={e=>e.stopPropagation()}>
                {chairLabel(seat)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 四角テーブル ──
  const rectChairs = buildRectChairs();
  return (
    <div className={`floor-table-group ${selected?'selected':''}`}
      style={{ left: table.posX||80, top: table.posY||80, position:'absolute' }}
      onMouseDown={e => { if(e.button===0){ onSelect(table.id); startDrag(e); } }}>
      <div className="floor-table-label">{table.name}</div>
      <div style={{ position:'relative', width: canvasW, height: canvasH }}>
        {/* 天板(四角) */}
        <div style={{
          position:'absolute', left:tLeft, top:tTop, width:rectTableW, height:rectTableH,
          background:'linear-gradient(145deg, #9a6e3a 0%, #6b4226 50%, #3d2210 100%)',
          borderRadius: 10,
          boxShadow:'0 6px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12)',
          border:'2px solid rgba(255,255,255,0.1)',
          pointerEvents:'none',
        }}>
          {/* 木目 */}
          <div style={{position:'absolute',inset:8,borderRadius:5,border:'1px solid rgba(255,255,255,0.05)',boxShadow:'0 0 0 4px rgba(255,255,255,0.02)'}}/>
        </div>
        {/* 椅子(四角) */}
        {rectChairs.map(({ x, y, seat }) => (
          <div key={seat.id} className={`floor-chair ${chairCls(seat)}`}
            style={{
              width:rectChairW, height:rectChairH,
              left:x, top:y,
              borderRadius: 6,   // 四角椅子は角丸控えめ
              fontSize:'0.58rem',
            }}
            title={assignments[seat.id] ? attendees.find(a=>a.id===assignments[seat.id])?.name : seat.id}
            onMouseDown={e=>e.stopPropagation()}>
            {chairLabel(seat)}
          </div>
        ))}
      </div>
    </div>
  );
}
