// src/components/AttendeesPage.jsx
// CDN 版からのコピー (docs/index.html 行 2801-2972)

import { useState } from 'react';
import { uid } from '../lib/uid.js';
import Modal from './Modal.jsx';
import TagInput from './TagInput.jsx';

export default function AttendeesPage({ event, dispatch, notify }) {
  const attendees = event.attendees || [];
  const ngPairs = event.ngPairs || [];
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'ng'
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name:'', flags:[], note:'' });
  const [ngTarget, setNgTarget] = useState(null);
  const [ngSearch, setNgSearch] = useState('');

  const openAdd = () => { setForm({name:'',flags:[],note:''}); setModal('add'); };
  const openEdit = (a) => { setEditTarget(a); setForm({name:a.name, flags:[...a.flags], note:a.note||''}); setModal('edit'); };
  const openNG = (a) => { setNgTarget(a); setNgSearch(''); setModal('ng'); };

  const save = () => {
    if (!form.name.trim()) return;
    if (modal === 'add') {
      dispatch({type:'ADD_ATTENDEE', eventId:event.id, payload:{id:uid(), eventId:event.id, name:form.name.trim(), flags:form.flags, note:form.note}});
      notify('参加者を追加しました');
    } else {
      dispatch({type:'UPDATE_ATTENDEE', eventId:event.id, id:editTarget.id, payload:{name:form.name.trim(), flags:form.flags, note:form.note}});
      notify('更新しました');
    }
    setModal(null);
  };
  const del = (id) => {
    if (confirm('この参加者を削除しますか？')) {
      dispatch({type:'DEL_ATTENDEE', eventId:event.id, id});
      notify('削除しました');
    }
  };

  const addNG = (bId) => {
    if (ngTarget.id === bId) return;
    const exists = ngPairs.some(p => (p.a===ngTarget.id&&p.b===bId)||(p.a===bId&&p.b===ngTarget.id));
    if (!exists) {
      const [a,b] = [ngTarget.id, bId].sort();
      dispatch({type:'ADD_NG', eventId:event.id, payload:{id:uid(), a, b}});
      notify('NGペアを登録しました');
    }
  };
  const delNG = (id) => dispatch({type:'DEL_NG', eventId:event.id, id});

  const getNGsFor = (aId) => ngPairs
    .filter(p=>p.a===aId||p.b===aId)
    .map(p=>({ id:p.id, otherId: p.a===aId?p.b:p.a }));

  const filtered = attendees.filter(a=>a.name.includes(search));
  const ngTargetNGs = ngTarget ? getNGsFor(ngTarget.id) : [];
  const ngCandidates = ngTarget ? attendees.filter(a=>a.id!==ngTarget.id&&a.name.includes(ngSearch)) : [];

  // CSV export
  const exportCSV = () => {
    const rows = [['name','flags','note'],...attendees.map(a=>[a.name, a.flags.join('|'), a.note||''])];
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`theseki_attendees_${event.id}.csv`; a.click();
    URL.revokeObjectURL(url);
    notify('CSVをエクスポートしました');
  };

  // CSV import
  const importCSV = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result.replace(/^\uFEFF/,'');
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h=>h.replace(/^"|"$/g,'').trim());
      let added = 0;
      lines.slice(1).forEach(line => {
        const cols = line.match(/("(?:[^"]|"")*"|[^,]*),?/g)?.map(c=>c.replace(/,$/, '').replace(/^"|"$/g,'').replace(/""/g,'"').trim()) || [];
        const name = cols[headers.indexOf('name')] || '';
        if (!name) return;
        const flagsRaw = cols[headers.indexOf('flags')] || '';
        const flags = flagsRaw ? flagsRaw.split('|').map(f=>f.trim()).filter(Boolean) : [];
        const note = cols[headers.indexOf('note')] || '';
        dispatch({type:'ADD_ATTENDEE', eventId:event.id, payload:{id:uid(), eventId:event.id, name, flags, note}});
        added++;
      });
      notify(`${added}名をインポートしました`);
    };
    reader.readAsText(file,'UTF-8');
    e.target.value='';
  };

  return (
    <div className="main attendees-page">
      <div className="page-header">
        <div className="page-title">参加者管理</div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          <label className="btn btn-outline btn-sm attendees-csv-btn" style={{cursor:'pointer'}}>
            📥 インポート<input type="file" accept=".csv" onChange={importCSV} style={{display:'none'}}/>
          </label>
          <button className="btn btn-outline btn-sm attendees-csv-btn" onClick={exportCSV}>📤 エクスポート</button>
          <button className="btn btn-accent btn-sm" onClick={openAdd}>＋ 追加</button>
        </div>
      </div>
      <div className="mb-3"><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前で検索…" style={{maxWidth:280}}/></div>
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">👥</div><div>参加者がいません</div></div>
        ) : (
          filtered.map(a => {
            const ngs = getNGsFor(a.id);
            return (
              <div key={a.id} className="attendee-row">
                <div>
                  <div className="attendee-name">{a.name}</div>
                  <div className="attendee-flags">
                    {a.flags.map(f=><span key={f} className="tag">{f}</span>)}
                    {ngs.map(ng=>{
                      const other = attendees.find(x=>x.id===ng.otherId);
                      return <span key={ng.id} className="tag tag-ng">NG: {other?.name||'?'}</span>;
                    })}
                  </div>
                  {a.note && <div className="text-sm text-muted" style={{marginTop:'0.2rem'}}>{a.note}</div>}
                </div>
                <div className="attendee-row-actions">
                  <button className="btn btn-outline btn-sm" onClick={()=>openNG(a)}>NG設定</button>
                  <button className="btn btn-outline btn-sm" onClick={()=>openEdit(a)}>編集</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>del(a.id)}>削除</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {(modal==='add'||modal==='edit') && (
        <Modal title={modal==='add'?'参加者を追加':'参加者を編集'} onClose={()=>setModal(null)}
          footer={<><button className="btn btn-outline" onClick={()=>setModal(null)}>キャンセル</button><button className="btn btn-accent" onClick={save}>保存</button></>}>
          <div><label>名前 *</label><input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus/></div>
          <div><label>フラグ（複数可）</label><TagInput tags={form.flags} onChange={flags=>setForm(f=>({...f,flags}))}/></div>
          <div><label>メモ（任意）</label><input type="text" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></div>
        </Modal>
      )}

      {/* NG Modal */}
      {modal==='ng' && ngTarget && (
        <Modal title={`NGペア設定 — ${ngTarget.name}`} onClose={()=>setModal(null)}>
          <div>
            <div className="text-sm text-muted mb-2">現在のNGペア</div>
            {ngTargetNGs.length===0
              ? <div className="text-sm text-muted">なし</div>
              : ngTargetNGs.map(ng=>{
                  const other = attendees.find(x=>x.id===ng.otherId);
                  return (
                    <div key={ng.id} className="flex items-center justify-between" style={{padding:'0.35rem 0', borderBottom:'1px solid var(--border)'}}>
                      <span className="tag tag-ng">NG: {other?.name||'?'}</span>
                      <button className="btn btn-ghost btn-sm" onClick={()=>delNG(ng.id)}>解除</button>
                    </div>
                  );
                })
            }
          </div>
          <div>
            <div className="text-sm text-muted mb-2">NG追加（クリックで選択）</div>
            <input type="text" value={ngSearch} onChange={e=>setNgSearch(e.target.value)} placeholder="名前で検索…" className="mb-2"/>
            <div style={{maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.3rem'}}>
              {ngCandidates.filter(a=>!ngTargetNGs.some(ng=>ng.otherId===a.id)).map(a=>(
                <button key={a.id} className="btn btn-outline" style={{justifyContent:'flex-start', textAlign:'left'}} onClick={()=>addNG(a.id)}>{a.name}</button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
