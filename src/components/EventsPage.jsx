// src/components/EventsPage.jsx
// CDN 版からのコピー (docs/index.html 行 1433-1525)

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { uid, now, fmtDate } from '../lib/uid.js';
import Modal from './Modal.jsx';

export default function EventsPage({ state, dispatch, authUser, onLayout, onAssign }) {
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', datetime: '' });
  const [editingEventId, setEditingEventId] = useState(null);
  const [isMobile] = useState(() => window.innerWidth <= 768);
  const [openMenuId, setOpenMenuId] = useState(null);
  // メニューの fixed 位置（getBoundingClientRect で計算）
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRefs = useRef({});

  // メニュー外タップで閉じる
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openMenuId]);

  const openMenu = (evId, e) => {
    e.stopPropagation();
    if (openMenuId === evId) { setOpenMenuId(null); return; }
    const btn = menuBtnRefs.current[evId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const menuH = 4 * 48 + 30; // 4項目 + 区切り線 + 余裕
      // 下に十分なスペース（bottom nav 56px + safe area を考慮）があれば下、なければ上
      const bottomSpace = window.innerHeight - rect.bottom - 60;
      if (bottomSpace >= menuH) {
        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      } else {
        setMenuPos({ top: rect.top - menuH - 4, right: window.innerWidth - rect.right });
      }
    }
    setOpenMenuId(evId);
  };

  const create = () => {
    if (!form.name.trim()) return;
    const id = uid();
    dispatch({ type:'ADD_EVENT', payload:{ id, name:form.name.trim(), datetime:form.datetime, createdAt:now(), updatedAt:now() }});
    setShowNew(false); setForm({name:'',datetime:''});
  };
  const del = (id, e) => {
    e.stopPropagation();
    if (confirm('このイベントを削除しますか？')) dispatch({type:'DELETE_EVENT', payload:id});
  };
  const openEdit = (ev, e) => {
    e.stopPropagation();
    setEditingEventId(ev.id);
    setForm({ name: ev.name || '', datetime: ev.datetime || '' });
    setShowEdit(true);
  };
  const saveEdit = () => {
    if (!form.name.trim() || !editingEventId) return;
    dispatch({
      type:'UPDATE_EVENT',
      payload:{ id: editingEventId, name: form.name.trim(), datetime: form.datetime }
    });
    setShowEdit(false);
    setEditingEventId(null);
    setForm({name:'',datetime:''});
  };
  const dup = (ev, e) => {
    e.stopPropagation();
    const newId = uid();
    dispatch({type:'DUPLICATE_EVENT', payload:{src:ev, newId}});
  };

  // openMenuId に対応するイベント
  const menuEvent = state.events.find(ev => ev.id === openMenuId);

  return (
    <div className="main" style={isMobile ? {paddingLeft:0, paddingRight:0} : {}}>
      <div className="page-header" style={isMobile ? {paddingLeft:'1.1rem', paddingRight:'1.1rem'} : {}}>
        <div className="page-title">イベント一覧</div>
        <button className="btn btn-accent" onClick={()=>setShowNew(true)}>＋ 新規イベント</button>
      </div>
      {!authUser && (
        <div style={{fontSize:'0.75rem',color:'var(--ink-muted,rgba(0,0,0,0.45))',marginBottom:'0.75rem',padding:'0.4rem 0.625rem',background:'var(--paper-soft,rgba(0,0,0,0.03))',borderRadius:'6px',border:'1px solid var(--border,#e5e5e5)'}}>
          ローカルに保存中（未ログイン）
        </div>
      )}
      {state.events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <div>まだイベントがありません</div>
          <div className="text-sm text-muted" style={{marginTop:'0.5rem'}}>「新規イベント」から作成してください</div>
        </div>
      ) : (
        <div className="events-grid">
          {state.events.map(ev => {
            const totalSeats = (ev.tables||[]).reduce((s,t)=>s+(t.seatCount||0),0);
            const assignedCount = Object.values(ev.assignments||{}).filter(Boolean).length;
            const pct = totalSeats > 0 ? Math.round(assignedCount/totalSeats*100) : 0;

            // ── 統一カード（PC・スマホ共通: カードクリック=席割遷移、⋮メニュー） ──
            return (
              <div key={ev.id} className="event-card entry-card"
                onClick={() => onLayout(ev.id)}>
                <button
                  ref={el => { menuBtnRefs.current[ev.id] = el; }}
                  className="event-card-menu-btn"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => openMenu(ev.id, e)}>
                  ⋮
                </button>
                <div className="event-card-title">{ev.name}</div>
                <div className="event-card-meta">
                  {ev.datetime ? `📅 ${ev.datetime}` : '日時未設定'}
                  &nbsp;·&nbsp;更新: {fmtDate(ev.updatedAt)}
                </div>
                <div className="event-card-progress">
                  <div className="event-card-progress-bar-outer">
                    <div className="event-card-progress-fill" style={{width:`${pct}%`}}/>
                  </div>
                  <div className="event-card-progress-label">
                    <span>割当進捗</span>
                    <strong>{assignedCount}/{totalSeats}席</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ⋮ ドロップダウン: portal で body 直下に fixed 配置 */}
      {openMenuId && menuEvent && createPortal(
        <div
          className="event-card-menu-dropdown"
          style={{ position:'fixed', top: menuPos.top, right: menuPos.right }}
          onPointerDown={e => e.stopPropagation()}>
          <button onClick={e => { openEdit(menuEvent, e); setOpenMenuId(null); }}>✏️ 編集</button>
          <button onClick={e => { dup(menuEvent, e); setOpenMenuId(null); }}>📄 複製</button>
          <button onClick={() => { onAssign(menuEvent.id); setOpenMenuId(null); }}>👥 参加者を見る</button>
          <hr className="menu-divider" />
          <button className="menu-danger" onClick={e => { del(menuEvent.id, e); setOpenMenuId(null); }}>🗑️ 削除</button>
        </div>,
        document.body
      )}

      {showNew && (
        <Modal title="新規イベント" onClose={()=>setShowNew(false)}
          footer={<><button className="btn btn-outline" onClick={()=>setShowNew(false)}>キャンセル</button><button className="btn btn-accent" onClick={create}>作成</button></>}>
          <div><label>イベント名 *</label><input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="例: 2025年度Q2懇親会" autoFocus/></div>
          <div><label>日時（任意）</label><input type="datetime-local" value={form.datetime} onChange={e=>setForm(f=>({...f,datetime:e.target.value}))}/></div>
        </Modal>
      )}
      {showEdit && (
        <Modal title="イベント編集" onClose={()=>setShowEdit(false)}
          footer={<><button className="btn btn-outline" onClick={()=>setShowEdit(false)}>キャンセル</button><button className="btn btn-accent" onClick={saveEdit}>保存</button></>}>
          <div><label>イベント名 *</label><input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus/></div>
          <div><label>日時（任意）</label><input type="datetime-local" value={form.datetime} onChange={e=>setForm(f=>({...f,datetime:e.target.value}))}/></div>
        </Modal>
      )}
    </div>
  );
}
