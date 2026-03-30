// src/components/AssignFloorTable.jsx
// CDN 版からのコピー (docs/index.html 行 1698-1894)
// ⚠️ 高リスク機能: ドラッグ&ドロップ席割り (onDragStart/onDragEnd/onDragOver/onDrop) を含む
// ⚠️ CDN版変更点: <React.Fragment key={seat.id}> → <Fragment key={seat.id}>
//    （key prop が必要なため <> への短縮は不可）

import { useState, Fragment } from 'react';

export default function AssignFloorTable({ table, seats, assignments, attendees, violationSeatIds,
  selectedId, hasViolation, tableViolations, flagHighlightIds, lockedAttendees,
  onSeatClick, onUnassign, onDragDrop, onAttendeeAssign, onDragCancel }) {

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const [draggingSeatId, setDraggingSeatId] = useState(null);
  const [dropTargetSeatId, setDropTargetSeatId] = useState(null);

  const N = seats.length;
  const shape = table.shape || 'rect';

  // 丸テーブル
  const tR = Math.max(42, Math.min(80, 28 + N * 4));
  const cR = Math.max(20, Math.min(30, tR * 0.45));
  const oR = tR + cR + 8;
  const roundSz = (oR + cR) * 2 + 20;

  // 四角テーブル
  const cW = 48, cH = 48, cGap = 8, tPad = 16;
  const topN = Math.ceil(N / 2), botN = N - topN;
  const tW = Math.max(120, Math.max(topN, botN) * (cW + cGap) - cGap + tPad * 2);
  const tH = 70;
  const cvW = tW + 20, cvH = tH + (cH + cGap) * 2 + 20;
  const tL = (cvW - tW) / 2, tTop2 = (cvH - tH) / 2;

  const seatColor = (seat) => {
    const aId = assignments[seat.id];
    const isLocked        = !!(aId && lockedAttendees && lockedAttendees[aId]);
    const isHL            = !!(flagHighlightIds && aId && flagHighlightIds.has(aId));
    const isDim           = !!(flagHighlightIds && flagHighlightIds.size > 0 && aId && !flagHighlightIds.has(aId));
    const isSelected      = !!(aId && selectedId && aId === selectedId);
    const isDraggingThis  = draggingSeatId === seat.id;
    const isDropTarget    = dropTargetSeatId === seat.id;
    if (isLocked)
      return { bg:'#d9d9d9', br:'#8a8a8a', co:'#111', op:1, sh:'0 0 0 2px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.35)' };
    if (isDraggingThis)
      // full opacity, bright white ring + strong shadow = clearly being lifted
      return { bg:'radial-gradient(circle at 40% 35%,#7aaa8a,#4a8a5a)', br:'rgba(255,255,255,0.95)', co:'#ffffff', op:1, sh:'0 0 0 3px rgba(255,255,255,0.7),0 6px 20px rgba(0,0,0,0.7)' };
    if (isDropTarget)
      return { bg:'radial-gradient(circle at 40% 35%,#2a5a78,#0d3354)', br:'#60c8ff', co:'#e0f6ff', op:1, sh:'0 0 0 3px rgba(96,200,255,0.65),0 2px 8px rgba(0,0,0,0.5)' };
    if (violationSeatIds.has(seat.id))
      return { bg:'radial-gradient(circle at 40% 35%,#a04040,#6b1515)', br:'rgba(220,100,100,0.6)', co:'#ffd0d0', op:1, sh:'0 2px 8px rgba(0,0,0,0.5)' };
    if (isSelected)
      // bright cyan ring + blue tint — clearly distinct from locked (gray) and normal (green)
      return { bg:'radial-gradient(circle at 40% 35%,#2a7ab0,#0d4a80)', br:'rgba(80,210,255,0.95)', co:'#cceeff', op:1, sh:'0 0 0 3px rgba(80,210,255,0.55),0 2px 10px rgba(0,0,0,0.5)' };
    if (isHL)
      return { bg:'radial-gradient(circle at 40% 35%,#b8860b,#7a5800)', br:'rgba(255,220,60,0.9)', co:'#fff8c0', op:1, sh:'0 0 0 3px rgba(255,220,60,0.45),0 2px 8px rgba(0,0,0,0.5)' };
    if (aId)
      return { bg:'radial-gradient(circle at 40% 35%,#5a8a6a,#2d5a3d)', br:'rgba(120,200,140,0.4)', co:'#d0f0dc', op: isDim ? 0.25 : 1, sh:'0 2px 8px rgba(0,0,0,0.5)' };
    if (selectedId)
      return { bg:'radial-gradient(circle at 40% 35%,#3a5068,#1a3048)', br:'rgba(100,180,255,0.5)', co:'#c0e0ff', op:1, sh:'0 2px 8px rgba(0,0,0,0.5)' };
    return { bg:'radial-gradient(circle at 40% 35%,#4a4550,#2a2730)', br:'rgba(255,255,255,0.1)', co:'rgba(255,255,255,0.2)', op:1, sh:'0 2px 8px rgba(0,0,0,0.5)' };
  };

  const ChairEl = ({ seat, w, h, posStyle, radius }) => {
    const aId = assignments[seat.id];
    const att = aId ? attendees.find(a => a.id === aId) : null;
    const sc  = seatColor(seat);
    const isDragging = draggingSeatId === seat.id;
    const canDrag = !isTouch && !!aId && !(lockedAttendees && lockedAttendees[aId]);

    const handleDragStart = (e) => {
      if (!canDrag) { e.preventDefault(); return; }
      // Store source seat ID in dataTransfer (survives element updates)
      e.dataTransfer.setData('seat-id', seat.id);
      // React 18 batches this; drag image is captured by browser before re-render
      setDraggingSeatId(seat.id);
    };
    const handleDragEnd = () => {
      setDraggingSeatId(null);
      setDropTargetSeatId(null);
      onDragCancel && onDragCancel();
    };
    const handleDragOver = (e) => {
      // Use dataTransfer.types so cross-table drags work.
      // draggingSeatId is per-table local state and is null in other tables.
      const types = e.dataTransfer.types;
      if (!types.includes('seat-id') && !types.includes('attendee-id')) return;
      e.preventDefault();
      setDropTargetSeatId(seat.id);
    };
    const handleDragLeave = () => {
      if (dropTargetSeatId === seat.id) setDropTargetSeatId(null);
    };
    const handleDrop = (e) => {
      e.preventDefault();
      const attendeeId = e.dataTransfer.getData('attendee-id');
      const srcSeatId = e.dataTransfer.getData('seat-id') || draggingSeatId;
      if (attendeeId) {
        onAttendeeAssign && onAttendeeAssign(attendeeId, seat.id);
      } else if (srcSeatId && srcSeatId !== seat.id) {
        onDragDrop(srcSeatId, seat.id);
      }
      setDraggingSeatId(null);
      setDropTargetSeatId(null);
    };

    return (
      <div
        draggable={canDrag}
        onClick={() => onSeatClick(seat.id)}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={att ? att.name : seat.id}
        style={{
          position:'absolute', ...posStyle,
          width: w, height: h,
          borderRadius: radius !== undefined ? radius : '50%',
          background: sc.bg,
          border: `2px solid ${sc.br}`,
          boxShadow: sc.sh,
          color: sc.co,
          opacity: sc.op,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          cursor: canDrag ? 'grab' : 'pointer',
          fontSize: w > 42 ? '0.65rem' : '0.55rem',
          fontWeight: 600, textAlign:'center',
          transition:'transform 0.12s, opacity 0.2s, box-shadow 0.2s',
          userSelect:'none', overflow:'hidden', padding: 2, lineHeight: 1.2,
          animation: violationSeatIds.has(seat.id) ? 'pulseRed 1.5s ease-in-out infinite' : 'none',
        }}
        onMouseEnter={e => { if (!isDragging && canDrag) e.currentTarget.style.transform = 'scale(1.12)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <span style={{pointerEvents:'none'}}>{att ? att.name.slice(0,4) : seat.index}</span>
        {att && lockedAttendees && lockedAttendees[aId] && <span style={{position:'absolute',left:3,top:2,fontSize:'0.52rem',pointerEvents:'none'}}>🔒</span>}
        {att && (
          <button onClick={e => onUnassign(seat.id, e)}
            style={{position:'absolute',top:1,right:2,background:'none',border:'none',
              cursor:'pointer',fontSize:'0.6rem',color:'rgba(255,200,200,0.7)',lineHeight:1,padding:0}}>x</button>
        )}
      </div>
    );
  };

  const rectPos = () => {
    const out = []; let idx = 0;
    const ew = n => n * (cW + cGap) - cGap;
    for (let i = 0; i < topN && idx < seats.length; i++, idx++)
      out.push({ x: tL + (tW - ew(topN)) / 2 + i * (cW + cGap), y: tTop2 - cH - cGap, seat: seats[idx] });
    for (let i = botN-1; i >= 0 && idx < seats.length; i--, idx++)
      out.push({ x: tL + (tW - ew(botN)) / 2 + i * (cW + cGap), y: tTop2 + tH + cGap, seat: seats[idx] });
    return out;
  };

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
      <div style={{
        color: hasViolation ? '#ff8080' : 'rgba(255,255,255,0.75)',
        fontSize:'0.78rem', fontWeight:700, letterSpacing:'0.06em',
        fontFamily:"'Noto Serif JP',serif",
        background:'rgba(0,0,0,0.45)', padding:'3px 14px', borderRadius:10, marginBottom:8,
      }}>
        {hasViolation ? '⚠️ ' : ''}{table.name}
        <span style={{marginLeft:8,fontSize:'0.65rem',opacity:0.7}}>
          {seats.filter(s => assignments[s.id]).length}/{N}席
        </span>
      </div>
      {hasViolation && (
        <div style={{background:'rgba(192,57,43,0.75)',color:'#ffe0e0',fontSize:'0.67rem',
          padding:'3px 10px',borderRadius:8,marginBottom:6,maxWidth:280,textAlign:'center'}}>
          {tableViolations.map((v,i) => <span key={i}>NG: {v.aName}x{v.bName} </span>)}
        </div>
      )}
      {shape === 'round' ? (
        <div style={{position:'relative',width:roundSz,height:roundSz}}>
          <div style={{
            position:'absolute',left:roundSz/2-tR,top:roundSz/2-tR,
            width:tR*2,height:tR*2,borderRadius:'50%',
            background:'radial-gradient(circle at 38% 35%,#a0734a,#6b4226 60%,#3d2210)',
            boxShadow:'0 6px 24px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.15)',
            border:'2px solid rgba(255,255,255,0.1)',pointerEvents:'none',
          }}/>
          {seats.map((seat,i) => {
            const ang = (2*Math.PI*i/N) - Math.PI/2;
            const cx = roundSz/2 + oR*Math.cos(ang), cy = roundSz/2 + oR*Math.sin(ang);
            return <Fragment key={seat.id}>{ChairEl({ seat, w:cR*2, h:cR*2, posStyle:{left:cx-cR,top:cy-cR} })}</Fragment>;
          })}
        </div>
      ) : (
        <div style={{position:'relative',width:cvW,height:cvH}}>
          <div style={{
            position:'absolute',left:tL,top:tTop2,width:tW,height:tH,
            background:'linear-gradient(145deg,#9a6e3a 0%,#6b4226 50%,#3d2210 100%)',
            borderRadius:12,
            boxShadow:'0 6px 24px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.12)',
            border:'2px solid rgba(255,255,255,0.1)',pointerEvents:'none',
          }}>
            <div style={{position:'absolute',inset:10,borderRadius:6,border:'1px solid rgba(255,255,255,0.05)'}}/>
          </div>
          {rectPos().map(({x,y,seat}) =>
            <Fragment key={seat.id}>{ChairEl({ seat, w:cW, h:cH, posStyle:{left:x,top:y}, radius:8 })}</Fragment>
          )}
        </div>
      )}
    </div>
  );
}
