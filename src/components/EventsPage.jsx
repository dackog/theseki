// src/components/EventsPage.jsx
// CDN 版からのコピー (docs/index.html 行 1433-1525)

import { useState } from 'react';
import { uid, now, fmtDate } from '../lib/uid.js';
import Modal from './Modal.jsx';

export default function EventsPage({ state, dispatch, authUser, onLayout, onAssign }) {
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', datetime: '' });
  const [editingEventId, setEditingEventId] = useState(null);

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

  return (
    <div className="main">
      <div className="page-header">
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
            return (
            <div key={ev.id} className="event-card">
              <div className="event-card-inner">
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
                <div className="event-action-btns">
                  <button className="btn-main layout" onClick={()=>onLayout(ev.id)}>
                    <span className="btn-icon">🪑</span>座席・席割
                  </button>
                  <button className="btn-main assign" onClick={()=>onAssign(ev.id)}>
                    <span className="btn-icon">👥</span>参加者
                  </button>
                </div>
                <div className="event-sub-btns">
                  <button className="btn btn-outline btn-sm event-sub-btn" onClick={e=>openEdit(ev,e)}><span>✏️</span><span>編集</span></button>
                  <button className="btn btn-outline btn-sm event-sub-btn" onClick={e=>dup(ev,e)}><span>📄</span><span>複製</span></button>
                  <button className="btn btn-danger btn-sm event-sub-btn" onClick={e=>del(ev.id,e)}><span>🗑️</span><span>削除</span></button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
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
