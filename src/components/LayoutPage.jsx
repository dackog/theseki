// src/components/LayoutPage.jsx
// CDN 版からのコピー (docs/index.html 行 2621-2796)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { uid } from '../lib/uid.js';
import { generateSeats, checkViolations } from '../lib/seats.js';
import FloorTable from './FloorTable.jsx';
import Modal from './Modal.jsx';

export default function LayoutPage({ event, dispatch, notify }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTable, setNewTable] = useState({ name:'', seatCount:6, shape:'rect' });
  const [editingSeatCounts, setEditingSeatCounts] = useState({});
  const [newTableSeatCountInput, setNewTableSeatCountInput] = useState('6');
  const [selectedId, setSelectedId] = useState(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // モバイル2タップ並び替え・編集
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSrcIdx, setReorderSrcIdx] = useState(null);
  const [editingTable, setEditingTable] = useState(null);

  const tables = event.tables || [];
  const seats = useMemo(()=>generateSeats(tables.map(t=>({...t,eventId:event.id}))), [tables, event.id]);
  const assignments = event.assignments || {};
  const attendees = event.attendees || [];
  const ngPairs = event.ngPairs || [];

  const violations = useMemo(()=>checkViolations(tables, seats, assignments, ngPairs, attendees), [tables, seats, assignments, ngPairs, attendees]);
  const violationSeatIds = useMemo(()=>{
    const s = new Set();
    violations.forEach(v => {
      seats.forEach(seat => {
        if (seat.tableId===v.tableId && (assignments[seat.id]===v.a||assignments[seat.id]===v.b)) s.add(seat.id);
      });
    });
    return s;
  }, [violations, seats, assignments]);

  const addTable = () => {
    const parsedSeatCount = parseInt(newTableSeatCountInput, 10);
    const seatCount = Number.isFinite(parsedSeatCount) ? Math.max(1, Math.min(30, parsedSeatCount)) : 6;
    const name = newTable.name.trim() || `T${tables.length+1}`;
    const cols = Math.ceil(Math.sqrt(tables.length+1));
    const idx = tables.length;
    const posX = 80 + (idx % cols) * 260;
    const posY = 80 + Math.floor(idx / cols) * 260;
    const t = { id:uid(), eventId:event.id, name, seatCount, shape: newTable.shape||'rect', order:tables.length, posX, posY };
    dispatch({type:'ADD_TABLE', eventId:event.id, payload:t});
    setShowAdd(false); setNewTable({name:'',seatCount:6,shape:'rect'}); setNewTableSeatCountInput('6');
    setSelectedId(t.id);
    notify('卓を追加しました');
  };
  const delTable = (tid) => {
    if (confirm('この卓を削除しますか？')) {
      dispatch({type:'DEL_TABLE', eventId:event.id, tableId:tid});
      if (selectedId===tid) setSelectedId(null);
      notify('卓を削除しました');
    }
  };
  const duplicateTable = (table) => {
    const copy = { ...table, id: uid(), name: `${table.name} (コピー)`, order: tables.length, posX: (table.posX || 80) + 40, posY: (table.posY || 80) + 40 };
    dispatch({type:'ADD_TABLE', eventId:event.id, payload:copy});
    setSelectedId(copy.id);
    notify('卓を複製しました');
  };
  const updateTable = (tid, key, val) => dispatch({type:'UPDATE_TABLE', eventId:event.id, tableId:tid, key, val});
  const commitTableSeatCount = (tableId, fallbackSeatCount) => {
    const raw = editingSeatCounts[tableId];
    if (raw === undefined) return;
    const parsed = parseInt(raw, 10);
    const nextSeatCount = Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : Math.max(1, fallbackSeatCount || 1);
    updateTable(tableId, 'seatCount', nextSeatCount);
    setEditingSeatCounts(prev => {
      const next = { ...prev };
      delete next[tableId];
      return next;
    });
  };
  const commitNewTableSeatCount = () => {
    const parsed = parseInt(newTableSeatCountInput, 10);
    const nextSeatCount = Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 6;
    setNewTable(f => ({ ...f, seatCount: nextSeatCount }));
    setNewTableSeatCountInput(String(nextSeatCount));
  };
  const handleDragPos = useCallback((tid, x, y) => {
    dispatch({type:'MOVE_TABLE_POS', eventId:event.id, tableId:tid, posX:x, posY:y});
  }, [event.id, dispatch]);

  const totalSeats = tables.reduce((s,t)=>s+t.seatCount,0);
  const assignedCount = Object.values(assignments).filter(Boolean).length;
  const floorDesign = event.floorDesign || 'default';
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.innerWidth <= 768);
  const [isCompactPc, setIsCompactPc] = useState(() => window.innerWidth <= 1200 || window.innerHeight <= 820);
  useEffect(() => {
    const onResize = () => {
      setIsMobileLayout(window.innerWidth <= 768);
      setIsCompactPc(window.innerWidth <= 1200 || window.innerHeight <= 820);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const effectiveFloorDesign = isMobileLayout ? 'default' : floorDesign;

  // モバイル2タップ並び替えハンドラ
  const handleReorderTap = (idx) => {
    if (!reorderMode) return;
    if (reorderSrcIdx === null) {
      setReorderSrcIdx(idx);
      return;
    }
    if (reorderSrcIdx === idx) {
      setReorderSrcIdx(null);
      return;
    }
    const dir = idx > reorderSrcIdx ? 1 : -1;
    let cur = reorderSrcIdx;
    while (cur !== idx) {
      dispatch({ type: 'MOVE_TABLE', eventId: event.id, idx: cur, dir });
      cur += dir;
    }
    setReorderSrcIdx(null);
  };

  return (
    <div className="floor-layout-shell" style={isMobileLayout ? {display:'flex',flexDirection:'column',height:'100%'} : {}}>
      <div className="floor-toolbar">
        <div className="floor-toolbar-stats">
          {[
            {label:`卓数: ${tables.length}`, c:'rgba(255,255,255,0.75)'},
            {label:`総席: ${totalSeats}`, c:'rgba(255,255,255,0.75)'},
            {label:`割当: ${assignedCount}/${totalSeats}`, c:'#6dcea0'},
            violations.length>0 && {label:`NG違反: ${violations.length}件`, c:'#f08080'},
          ].filter(Boolean).map((p,i)=>(<span key={i} className="stat-chip" style={{color:p.c}}>{p.label}</span>))}
        </div>
        <div className="floor-toolbar-actions">
          {!isMobileLayout && (
            <>
              {isCompactPc && (
                <button className="floor-panel-toggle" onClick={()=>setPanelCollapsed(v=>!v)}>{panelCollapsed?'卓一覧を表示':'卓一覧を隠す'}</button>
              )}
              <select value={floorDesign} onChange={e=>dispatch({type:'UPDATE_EVENT_FIELD', eventId:event.id, key:'floorDesign', val:e.target.value})} style={{width:'170px'}}>
                <option value="default">デフォルト</option>
                <option value="simple">シンプル</option>
                <option value="cute">かわいい</option>
                <option value="stylish">スタイリッシュ</option>
              </select>
            </>
          )}
          {!isMobileLayout && (
            <button className="btn btn-accent btn-sm" onClick={()=>setShowAdd(true)}>＋ 卓を追加</button>
          )}
        </div>
      </div>

      {/* ── モバイル専用グリッド表示 ── */}
      {isMobileLayout && (
        <div className="mobile-table-grid">
          <button className="btn btn-accent mobile-add-table-btn" onClick={() => setShowAdd(true)}>
            ＋ 卓を追加
          </button>
          {reorderMode && (
            <div className="mobile-reorder-bar">
              {reorderSrcIdx === null
                ? '移動元の卓をタップ → 移動先をタップで入れ替え'
                : `「${tables[reorderSrcIdx]?.name}」を選択中 → 移動先をタップ`}
            </div>
          )}
          <div className="mobile-table-cards">
            {tables.length === 0 && (
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:'2rem',color:'var(--ink-light)',fontSize:'0.85rem'}}>
                「＋ 卓を追加」から卓を追加しましょう
              </div>
            )}
            {tables.map((t, idx) => {
              const tSeats = seats.filter(s => s.tableId === t.id);
              const occ = tSeats.filter(s => assignments[s.id]).length;
              const pct = t.seatCount > 0 ? Math.round(occ / t.seatCount * 100) : 0;
              const isSrc = reorderSrcIdx === idx;
              return (
                <div
                  key={t.id}
                  className={`mobile-table-card${isSrc ? ' reorder-src' : ''}`}
                  onClick={() => reorderMode ? handleReorderTap(idx) : setEditingTable(t)}>
                  <div className="mobile-table-card-name">{t.name}</div>
                  <div className="mobile-table-card-seats">{occ}/{t.seatCount}席</div>
                  <div className="mobile-table-card-prog">
                    <div className="mobile-table-card-prog-fill" style={{ width: `${pct}%` }}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mobile-reorder-actions">
            {!reorderMode ? (
              <button className="btn btn-outline btn-sm" onClick={() => setReorderMode(true)}>
                並び順を変更
              </button>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={() => { setReorderMode(false); setReorderSrcIdx(null); }}>
                ✓ 完了
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`floor-layout theme-${effectiveFloorDesign} ${panelCollapsed && isCompactPc ? 'panel-collapsed' : ''}`}>
        <div className="floor-canvas-region">
          <div className="floor-canvas-wrap" style={{position:'relative'}}>
            <div className="floor-canvas" onClick={()=>setSelectedId(null)}>
              {tables.length===0 && (<div className="floor-empty"><div className="floor-empty-icon">🍺</div><div className="floor-empty-text">「＋ 卓を追加」から<br/>テーブルを配置しましょう</div></div>)}
              {tables.map(t => {
                const tableSeats = seats.filter(s=>s.tableId===t.id);
                return <FloorTable key={t.id} table={t} seats={tableSeats} assignments={assignments} attendees={attendees} violationSeatIds={violationSeatIds} selected={selectedId===t.id} onSelect={setSelectedId} onDragEnd={handleDragPos}/>;
              })}
            </div>
          </div>
        </div>

        <div className={`floor-panel ${panelCollapsed && isCompactPc ? 'hidden' : ''}`}>
          <div className="floor-panel-header">
            <div style={{fontFamily:"'Noto Serif JP',serif",fontWeight:700,fontSize:'0.9rem',color:'var(--ink)',marginBottom:'0.5rem'}}>卓一覧</div>
            <button className="btn btn-accent btn-sm w-full" onClick={()=>setShowAdd(true)}>＋ 卓を追加</button>
          </div>
          <div className="floor-panel-body">
            {tables.length===0 && <div className="text-sm text-muted" style={{textAlign:'center',padding:'1rem 0'}}>卓がありません</div>}
            {tables.map((t) => {
              const tSeats = seats.filter(s=>s.tableId===t.id);
              const occCount = tSeats.filter(s=>assignments[s.id]).length;
              const hasViol = violations.some(v=>v.tableId===t.id);
              const isActive = selectedId===t.id;
              return (
                <div key={t.id} className={`floor-table-item ${isActive?'active':''}`} onClick={()=>setSelectedId(t.id)}>
                  <div className="floor-table-item-head"><span className="floor-table-item-name">{hasViol?'⚠️ ':''}{t.name}</span><span style={{fontSize:'0.72rem',color:'var(--ink-light)'}}>{occCount}/{t.seatCount}席</span></div>
                  <div className="floor-seat-bar">{tSeats.map(s => { const viol = violationSeatIds.has(s.id); const occ = !!assignments[s.id]; return <div key={s.id} className={`floor-seat-dot ${viol?'viol':occ?'occ':''}`}/>; })}</div>
                  {isActive && (
                    <div onClick={e=>e.stopPropagation()}>
                      <div className="floor-edit-row" style={{marginTop:'0.6rem'}}><label>卓名</label><input type="text" value={t.name} onChange={e=>updateTable(t.id,'name',e.target.value)} style={{flex:1}}/></div>
                      <div className="floor-edit-row"><label>座席数</label><input type="number" min="1" max="30" value={editingSeatCounts[t.id] ?? String(t.seatCount)} onFocus={e=>e.target.select()} onChange={e=>setEditingSeatCounts(prev=>({...prev,[t.id]:e.target.value}))} onBlur={()=>commitTableSeatCount(t.id,t.seatCount)} onKeyDown={e=>{ if (e.key==='Enter') { commitTableSeatCount(t.id,t.seatCount); e.target.blur(); } }} style={{width:60}}/></div>
                      <div className="floor-edit-row"><label>形状</label><div style={{display:'flex',gap:'0.4rem',flex:1}}>{[{v:'rect',icon:'⬛',label:'四角'},{v:'round',icon:'🔵',label:'丸'}].map(s=>(<button key={s.v} className={`btn btn-sm ${(t.shape||'rect')===s.v?'btn-primary':'btn-outline'}`} style={{flex:1,gap:'0.25rem'}} onClick={()=>updateTable(t.id,'shape',s.v)}>{s.icon} {s.label}</button>))}</div></div>
                      {hasViol && <div style={{marginTop:'0.5rem',fontSize:'0.73rem',color:'var(--accent)',background:'#fde8e8',borderRadius:5,padding:'0.3rem 0.5rem'}}>{violations.filter(v=>v.tableId===t.id).map((v,i)=><div key={i}>NG: {v.aName} × {v.bName}</div>)}</div>}
                      <button className="btn btn-outline btn-sm w-full" style={{marginTop:'0.6rem'}} onClick={()=>duplicateTable(t)}>この卓を複製</button>
                      <button className="btn btn-danger btn-sm w-full" style={{marginTop:'0.6rem'}} onClick={()=>delTable(t.id)}>この卓を削除</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showAdd && (
        <Modal title="卓を追加" onClose={()=>setShowAdd(false)} footer={<><button className="btn btn-outline" onClick={()=>setShowAdd(false)}>キャンセル</button><button className="btn btn-accent" onClick={addTable}>追加</button></>}>
          <div><label>卓名（省略時: 自動採番）</label><input type="text" value={newTable.name} onChange={e=>setNewTable(f=>({...f,name:e.target.value}))} placeholder={`T${tables.length+1}`} autoFocus/></div>
          <div><label>座席数</label><input type="number" min="1" max="30" value={newTableSeatCountInput} onFocus={e=>e.target.select()} onChange={e=>setNewTableSeatCountInput(e.target.value)} onBlur={commitNewTableSeatCount} onKeyDown={e=>{ if (e.key==='Enter') { commitNewTableSeatCount(); e.target.blur(); } }}/></div>
          <div><label>テーブル形状</label><div style={{display:'flex',gap:'0.75rem',marginTop:'0.25rem'}}>{[{v:'rect',icon:'⬛',label:'四角（デフォルト）'},{v:'round',icon:'🔵',label:'丸'}].map(s=>(<button key={s.v} className={`btn ${newTable.shape===s.v?'btn-primary':'btn-outline'}`} style={{flex:1,flexDirection:'column',gap:'0.3rem',padding:'0.75rem 0.5rem',fontSize:'0.82rem'}} onClick={()=>setNewTable(f=>({...f,shape:s.v}))}><span style={{fontSize:'1.5rem'}}>{s.icon}</span>{s.label}</button>))}</div></div>
        </Modal>
      )}

      {/* ── モバイル卓編集モーダル ── */}
      {editingTable && (
        <Modal title={`${editingTable.name} を編集`}
          onClose={() => setEditingTable(null)}
          footer={<>
            <button className="btn btn-danger btn-sm" onClick={() => { delTable(editingTable.id); setEditingTable(null); }}>削除</button>
            <button className="btn btn-outline" onClick={() => setEditingTable(null)}>閉じる</button>
          </>}>
          <div>
            <label>卓名</label>
            <input type="text" value={editingTable.name}
              onChange={e => { const v = e.target.value; updateTable(editingTable.id, 'name', v); setEditingTable(t => ({...t, name: v})); }}/>
          </div>
          <div>
            <label>座席数</label>
            <input type="number" min="1" max="30"
              value={editingSeatCounts[editingTable.id] ?? String(editingTable.seatCount)}
              onFocus={e => e.target.select()}
              onChange={e => setEditingSeatCounts(prev => ({...prev, [editingTable.id]: e.target.value}))}
              onBlur={() => {
                const raw = editingSeatCounts[editingTable.id];
                if (raw !== undefined) {
                  const n = parseInt(raw, 10);
                  const sc = Number.isFinite(n) ? Math.max(1, Math.min(30, n)) : editingTable.seatCount;
                  updateTable(editingTable.id, 'seatCount', sc);
                  setEditingTable(t => ({...t, seatCount: sc}));
                  setEditingSeatCounts(prev => { const next = {...prev}; delete next[editingTable.id]; return next; });
                }
              }}/>
          </div>
          <div>
            <label>形状</label>
            <div style={{display:'flex',gap:'0.4rem',marginTop:'0.25rem'}}>
              {[{v:'rect',icon:'⬛',label:'四角'},{v:'round',icon:'🔵',label:'丸'}].map(s=>(
                <button key={s.v}
                  className={`btn ${(editingTable.shape||'rect')===s.v?'btn-primary':'btn-outline'}`}
                  style={{flex:1}}
                  onClick={() => { updateTable(editingTable.id,'shape',s.v); setEditingTable(t=>({...t,shape:s.v})); }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
