// src/components/AssignPage.jsx
// CDN 版からのコピー (docs/index.html 行 1899-2619)
// ⚠️ 高リスク機能: D&D卓ドラッグ (startTableDrag) + 全画面トグル + 席クリック割当
// ⚠️ CDN版変更点:
//   - import { createPortal } from 'react-dom'  （ReactDOM.createPortal → createPortal）
//   - React.useRef(null) → useRef(null)          （名前付きimportへ統一）

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { uid } from '../lib/uid.js';
import { generateSeats, checkViolations } from '../lib/seats.js';
import { normalizeFlagRules } from '../lib/storage.js';
import Modal from './Modal.jsx';
import AssignFloorTable from './AssignFloorTable.jsx';

export default function AssignPage({ event, dispatch, notify, initialSideTab='seat' }) {
  const tables      = event.tables || [];
  const attendees   = event.attendees || [];
  const ngPairs     = event.ngPairs || [];
  const assignments = event.assignments || {};
  const lockedAttendees = event.lockedAttendees || {};

  const [selected,  setSelected]  = useState(null);
  const [filterTag, setFilterTag] = useState('');
  const [search,    setSearch]    = useState('');
  // サイドバータブ（卓管理 / 席割）
  const [sideTab, setSideTab] = useState(initialSideTab); // 'seat' | 'table'
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableDraft, setNewTableDraft] = useState({ name:'', seatCount:6, shape:'rect' });
  const [newTableSeatInput, setNewTableSeatInput] = useState('6');
  const [expandedTableId, setExpandedTableId] = useState(null);
  const [editingSeatCounts, setEditingSeatCounts] = useState({});
  const [customRuleModalOpen, setCustomRuleModalOpen] = useState(false);
  const [customRuleDraft, setCustomRuleDraft] = useState(event.customRule || 'disperse');
  const [customGatherFlagsDraft, setCustomGatherFlagsDraft] = useState((event.customGatherFlags || []).slice(0,4));
  const [customRulesDraft, setCustomRulesDraft] = useState(normalizeFlagRules(event.customRules, event.customRule, event.customGatherFlags));
  const [customRulesError, setCustomRulesError] = useState('');
  const [ruleConflictFlag, setRuleConflictFlag] = useState('');
  const [ruleConflictBanner, setRuleConflictBanner] = useState('');
  const [activeRuleTooltip, setActiveRuleTooltip] = useState('');

  useEffect(() => {
    setCustomRuleDraft(event.customRule || 'disperse');
    setCustomGatherFlagsDraft((event.customGatherFlags || []).slice(0,4));
    setCustomRulesDraft(normalizeFlagRules(event.customRules, event.customRule, event.customGatherFlags));
    setCustomRulesError('');
    setRuleConflictFlag('');
    setRuleConflictBanner('');
    setActiveRuleTooltip('');
  }, [event.customRule, event.customGatherFlags, event.customRules]);

  useEffect(() => {
    if (!activeRuleTooltip) return;
    const closeTooltip = () => setActiveRuleTooltip('');
    document.addEventListener('click', closeTooltip);
    return () => document.removeEventListener('click', closeTooltip);
  }, [activeRuleTooltip]);

  const seats       = useMemo(() => generateSeats(tables.map(t => ({...t,eventId:event.id}))), [tables,event.id]);
  const totalSeats  = seats.length;
  const assignedCount = Object.values(assignments).filter(Boolean).length;
  const assignedIds = new Set(Object.values(assignments).filter(Boolean));
  const unassigned  = attendees.filter(a => !assignedIds.has(a.id));
  const allTags     = [...new Set(attendees.flatMap(a => a.flags))];

  const violations        = useMemo(() => checkViolations(tables,seats,assignments,ngPairs,attendees), [tables,seats,assignments,ngPairs,attendees]);
  const violationTableIds = new Set(violations.map(v => v.tableId));
  const violationSeatIds  = useMemo(() => {
    const s = new Set();
    violations.forEach(v => seats.forEach(seat => {
      if (seat.tableId===v.tableId && (assignments[seat.id]===v.a || assignments[seat.id]===v.b)) s.add(seat.id);
    }));
    return s;
  }, [violations,seats,assignments]);

  // フラグハイライト
  const flagHighlightIds = useMemo(() => {
    if (!filterTag) return null;
    return new Set(attendees.filter(a => a.flags.includes(filterTag)).map(a => a.id));
  }, [filterTag, attendees]);

  // 選択解除 — single source of truth
  const clearSelection = () => setSelected(null);

  // 卓ドラッグ配置 + 全画面 共用 ref
  const floorViewRef = useRef(null);

  // 卓ドラッグ配置（mousemove/mouseup on window）
  const startTableDrag = useCallback((e, tableId) => {
    if (e.button !== 0) return;
    if (e.target.closest('[draggable="true"]')) return; // 席クリック時は卓ドラッグしない
    e.preventDefault();
    const wrapperRect = e.currentTarget.getBoundingClientRect();
    const startOffsetX = e.clientX - wrapperRect.left;
    const startOffsetY = e.clientY - wrapperRect.top;
    const move = (me) => {
      const canvas = floorViewRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      const newX = me.clientX - canvasRect.left - startOffsetX + canvas.scrollLeft;
      const newY = me.clientY - canvasRect.top  - startOffsetY + canvas.scrollTop;
      dispatch({ type:'MOVE_TABLE_POS', eventId:event.id, tableId,
        posX: Math.max(0, newX), posY: Math.max(0, newY) });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'grabbing';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [event.id, dispatch]);

  // 全画面モード
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);
  const toggleFullscreen = useCallback(() => {
    const el = floorViewRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  }, []);

  // Outside-click clears selection
  const assignLayoutRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (assignLayoutRef.current && !assignLayoutRef.current.contains(e.target)) {
        clearSelection();
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  // 参加者選択時に卓タブ表示中なら席タブへ自動切替
  useEffect(() => {
    if (selected && sideTab === 'table') setSideTab('seat');
  }, [selected]);

  // 卓管理ハンドラ（LayoutPage から移植）
  const addTable = () => {
    const n = parseInt(newTableSeatInput, 10);
    const seatCount = Number.isFinite(n) ? Math.max(1, Math.min(30, n)) : 6;
    const name = newTableDraft.name.trim() || `T${tables.length + 1}`;
    const cols = Math.ceil(Math.sqrt(tables.length + 1));
    const idx = tables.length;
    const t = { id:uid(), eventId:event.id, name, seatCount, shape:newTableDraft.shape||'rect', order:tables.length, posX:80+(idx%cols)*260, posY:80+Math.floor(idx/cols)*260 };
    dispatch({ type:'ADD_TABLE', eventId:event.id, payload:t });
    setShowAddTable(false); setNewTableDraft({name:'',seatCount:6,shape:'rect'}); setNewTableSeatInput('6');
    notify('卓を追加しました');
  };
  const delTable = (tid) => {
    if (confirm('この卓を削除しますか？')) {
      dispatch({ type:'DEL_TABLE', eventId:event.id, tableId:tid });
      if (expandedTableId === tid) setExpandedTableId(null);
      notify('卓を削除しました');
    }
  };
  const duplicateTable = (table) => {
    const copy = { ...table, id:uid(), name:`${table.name} (コピー)`, order:tables.length, posX:(table.posX||80)+40, posY:(table.posY||80)+40 };
    dispatch({ type:'ADD_TABLE', eventId:event.id, payload:copy });
    notify('卓を複製しました');
  };
  const updateTable = (tid, key, val) => dispatch({ type:'UPDATE_TABLE', eventId:event.id, tableId:tid, key, val });
  const commitTableSeatCount = (tableId, fallback) => {
    const raw = editingSeatCounts[tableId];
    if (raw === undefined) return;
    const n = parseInt(raw, 10);
    updateTable(tableId, 'seatCount', Number.isFinite(n) ? Math.max(1, Math.min(30, n)) : Math.max(1, fallback||1));
    setEditingSeatCounts(prev => { const next = {...prev}; delete next[tableId]; return next; });
  };

  const handleDragDrop = (srcSeatId, tgtSeatId) => {
    const srcAtt = assignments[srcSeatId];
    const tgtAtt = assignments[tgtSeatId];
    if (!srcAtt) return;
    if (lockedAttendees[srcAtt]) { notify('🔒 ロック中の参加者は移動できません','warning'); return; }
    if (tgtAtt && lockedAttendees[tgtAtt]) { notify('🔒 ロック中の参加者は移動できません','warning'); return; }
    const updates = { [tgtSeatId]: srcAtt, [srcSeatId]: tgtAtt || null };
    dispatch({ type:'BATCH_ASSIGN', eventId:event.id, updates });
    clearSelection();
  };

  const handleAttendeeAssign = (attendeeId, seatId) => {
    const currentOccupant = assignments[seatId];
    if (currentOccupant && lockedAttendees[currentOccupant]) {
      notify('🔒 ロック中の参加者は移動できません', 'warning');
      return;
    }
    dispatch({ type: 'BATCH_ASSIGN', eventId: event.id, updates: { [seatId]: attendeeId } });
    clearSelection();
  };

  const handleSeatClick = (seatId) => {
    const cur = assignments[seatId];
    if (selected) {
      const prevSeat = Object.keys(assignments).find(s => assignments[s] === selected);
      const targetLocked = cur ? !!lockedAttendees[cur] : false;
      const selectedLocked = !!lockedAttendees[selected];
      if (targetLocked && cur !== selected) {
        notify('🔒 ロック中の参加者は移動できません','warning');
        return;
      }
      if (selectedLocked && prevSeat && prevSeat !== seatId) {
        notify('🔒 ロック中の参加者は別席へ移動できません','warning');
        return;
      }
      const updates = { [seatId]: selected };
      if (prevSeat && prevSeat !== seatId) updates[prevSeat] = cur || null;
      dispatch({type:'BATCH_ASSIGN', eventId:event.id, updates});
      clearSelection();
    } else if (cur) {
      setSelected(cur);
    }
  };

  const unassignSeat = (seatId, e) => {
    e.stopPropagation();
    const cur = assignments[seatId];
    if (cur && lockedAttendees[cur]) {
      notify('🔒 ロック中の参加者は解除できません','warning');
      return;
    }
    dispatch({type:'ASSIGN', eventId:event.id, seatId, attendeeId:null});
    if (selected && assignments[seatId] === selected) setSelected(null);
  };

  const randomAssign = () => {
    const allSeats  = seats.map(s => s.id);
    const lockedIds = new Set(Object.keys(lockedAttendees).filter(id => lockedAttendees[id]));
    const lockedSeatByAttendee = {};
    Object.entries(assignments).forEach(([sid,aid])=>{ if (aid && lockedIds.has(aid)) lockedSeatByAttendee[aid] = sid; });
    if (Object.keys(lockedSeatByAttendee).length !== lockedIds.size) {
      notify('🔒 ロック中の参加者は先に座席へ配置してください','warning');
      return;
    }
    const allPeople = attendees.filter(a => !lockedIds.has(a.id));
    const ngSet = new Set(ngPairs.map(p => `${[p.a,p.b].sort().join('|')}`));
    const isNG  = (a,b) => ngSet.has(`${[a,b].sort().join('|')}`);
    const seatTable  = {}; seats.forEach(s => { seatTable[s.id] = s.tableId; });
    const tableSeats = {}; tables.forEach(t => { tableSeats[t.id] = seats.filter(s => s.tableId===t.id).map(s => s.id); });
    const TRIALS = 150; let best = null, bestScore = -Infinity;
    for (let t = 0; t < TRIALS; t++) {
      const ppl = [...allPeople];
      for (let i = ppl.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [ppl[i],ppl[j]]=[ppl[j],ppl[i]]; }
      const assign = {...Object.fromEntries(Object.entries(lockedSeatByAttendee).map(([aid,sid])=>[sid,aid]))}; let failed = false;
      for (const person of ppl) {
        const eligible = allSeats.filter(sid => {
          if (assign[sid]) return false;
          const mates = (tableSeats[seatTable[sid]]||[]).filter(s=>assign[s]).map(s=>assign[s]);
          return !mates.some(m => isNG(m, person.id));
        });
        if (!eligible.length) { failed = true; break; }
        assign[eligible[Math.floor(Math.random()*eligible.length)]] = person.id;
      }
      if (failed) continue;
      let score = Math.random() * 0.5;
      tables.forEach(tab => {
        const tp = (tableSeats[tab.id]||[]).map(s=>assign[s]).filter(Boolean).map(id=>allPeople.find(p=>p.id===id)).filter(Boolean);
        const fc = {}; tp.forEach(p=>p.flags.forEach(f=>{fc[f]=(fc[f]||0)+1;}));
        Object.values(fc).forEach(c=>{score-=(c-1);});
      });
      if (score > bestScore) { bestScore=score; best=assign; }
    }
    if (!best) {
      const ppl = [...allPeople];
      for (let i=ppl.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ppl[i],ppl[j]]=[ppl[j],ppl[i]];}
      best = {};
      ppl.forEach((p,i)=>{ if(allSeats[i]) best[allSeats[i]]=p.id; });
      notify('NG制約を完全に満たす配置が見つからず、近似配置にしました','warning');
    } else {
      notify('🎲 ランダム配置しました（NG考慮）');
    }
    const updates = {};
    allSeats.forEach(sid => { updates[sid] = best[sid] || null; });
    dispatch({type:'BATCH_ASSIGN', eventId:event.id, updates});
    setSelected(null);
  };

  const customAssign = () => {
    const allSeats = seats.map(s => s.id);
    const lockedIds = new Set(Object.keys(lockedAttendees).filter(id => lockedAttendees[id]));
    const lockedSeatByAttendee = {};
    Object.entries(assignments).forEach(([sid,aid])=>{ if (aid && lockedIds.has(aid)) lockedSeatByAttendee[aid] = sid; });
    if (Object.keys(lockedSeatByAttendee).length !== lockedIds.size) {
      notify('🔒 ロック中の参加者は先に座席へ配置してください','warning');
      return;
    }
    const allPeople = attendees.filter(a => !lockedIds.has(a.id));
    const availableSeatCount = Math.max(allSeats.length - Object.keys(lockedSeatByAttendee).length, 0);
    const currentRule = event.customRule || 'disperse';
    const selectedGatherFlags = (event.customGatherFlags || []).slice(0,4);
    const effectiveRules = normalizeFlagRules(event.customRules, event.customRule, event.customGatherFlags);
    const gatherFlagsByRule = effectiveRules.filter(r => r.mode === 'gather').map(r => r.flag);
    const scoreFlags = gatherFlagsByRule.length > 0
      ? gatherFlagsByRule
      : (selectedGatherFlags.length > 0 ? selectedGatherFlags : [...new Set(allPeople.flatMap(p => p.flags || []))]);
    const scoreFlagSet = new Set(scoreFlags);
    const hasTargetFlag = (person) => (person.flags || []).some(f => scoreFlagSet.has(f));
    const ngSet = new Set(ngPairs.map(p => `${[p.a,p.b].sort().join('|')}`));
    const isNG = (a,b) => ngSet.has(`${[a,b].sort().join('|')}`);
    const seatTable = {}; seats.forEach(s => { seatTable[s.id]=s.tableId; });
    const tableSeats = {}; tables.forEach(t => { tableSeats[t.id]=seats.filter(s=>s.tableId===t.id).map(s=>s.id); });
    const TRIALS = 100; let best = null, bestScore = -Infinity;
    for (let t = 0; t < TRIALS; t++) {
      const ppl = [...allPeople];
      for (let i=ppl.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ppl[i],ppl[j]]=[ppl[j],ppl[i]];}
      const seatTargets = ppl.slice(0, availableSeatCount);
      if (currentRule === 'gather' && scoreFlags.length > 0) {
        seatTargets.sort((a,b) => Number(hasTargetFlag(b)) - Number(hasTargetFlag(a)));
      }
      const assign={...Object.fromEntries(Object.entries(lockedSeatByAttendee).map(([aid,sid])=>[sid,aid]))}; let failed=false;
      for (const person of seatTargets) {
        const eligible = allSeats.filter(sid => {
          if (assign[sid]) return false;
          const mates = (tableSeats[seatTable[sid]]||[]).filter(s=>assign[s]).map(s=>assign[s]);
          return !mates.some(m=>isNG(m,person.id));
        });
        if (!eligible.length){failed=true;break;}
        let chosenSeat = eligible[Math.floor(Math.random()*eligible.length)];
        if (currentRule === 'gather' && scoreFlags.length > 0 && hasTargetFlag(person)) {
          let bestSeatScore = -Infinity;
          let bestSeats = [];
          eligible.forEach(sid => {
            const tid = seatTable[sid];
            const tSeats = tableSeats[tid] || [];
            const targetMates = tSeats.filter(s => assign[s]).map(s => allPeople.find(p=>p.id===assign[s])).filter(Boolean).filter(p=>hasTargetFlag(p)).length;
            const freeSeats = tSeats.filter(s => !assign[s]).length;
            const seatScore = targetMates * 100 + freeSeats;
            if (seatScore > bestSeatScore) {
              bestSeatScore = seatScore;
              bestSeats = [sid];
            } else if (seatScore === bestSeatScore) {
              bestSeats.push(sid);
            }
          });
          chosenSeat = bestSeats[Math.floor(Math.random()*bestSeats.length)];
        }
        assign[chosenSeat]=person.id;
      }
      if (failed) continue;
      let score=0;
      tables.forEach(tab=>{
        const tp=(tableSeats[tab.id]||[]).map(s=>assign[s]).filter(Boolean).map(id=>allPeople.find(p=>p.id===id)).filter(Boolean);
        const fc={}; tp.forEach(p=>(p.flags||[]).forEach(f=>{ if (scoreFlags.includes(f)) fc[f]=(fc[f]||0)+1; }));
        Object.values(fc).forEach(c=>{ score += currentRule === 'gather' ? (c-1) : -(c-1); });
      });
      if (score>bestScore){bestScore=score;best=assign;}
    }
    if (!best){notify('同卓NGを満たす配置が見つかりませんでした','error');return;}
    const updates={}; seats.forEach(s=>{updates[s.id]=best[s.id]||null;});
    dispatch({type:'BATCH_ASSIGN',eventId:event.id,updates});
    notify(`✨ カスタム配置しました（NG回避＋フラグ${currentRule === 'gather' ? '集約' : '分散'}）`,'success');
    setSelected(null);
  };

  const saveCustomRule = () => {
    const finalRules = normalizeFlagRules(customRulesDraft, customRuleDraft, customGatherFlagsDraft);
    const gatherFlags = finalRules.filter(r => r.mode === 'gather').map(r => r.flag).slice(0,4);
    const hasDistribute = finalRules.some(r => r.mode === 'distribute');
    const hasGather = gatherFlags.length > 0;
    const legacyRule = hasGather && !hasDistribute ? 'gather' : 'disperse';
    dispatch({type:'UPDATE_EVENT_FIELD', eventId:event.id, key:'customRule', val:legacyRule});
    dispatch({type:'UPDATE_EVENT_FIELD', eventId:event.id, key:'customGatherFlags', val:gatherFlags});
    dispatch({type:'UPDATE_EVENT_FIELD', eventId:event.id, key:'customRules', val:finalRules});
    setCustomRuleModalOpen(false);
    const gatherSuffix = legacyRule === 'gather' ? ` / 対象フラグ${gatherFlags.length}件` : '';
    notify(`カスタム設定を保存しました（フラグ${legacyRule === 'gather' ? '集約' : '分散'}${gatherSuffix}）`, 'success');
  };

  const upsertRuleDraft = (flag, mode, checked) => {
    setCustomRulesDraft(prev => {
      const list = normalizeFlagRules(prev, customRuleDraft, customGatherFlagsDraft).filter(r => r.flag !== flag || r.mode !== mode);
      if (!checked) {
        if (ruleConflictFlag === flag) setRuleConflictFlag('');
        if (!customRulesError.includes(`「${flag}」`)) setCustomRulesError('');
        return list;
      }
      if (list.some(r => r.flag === flag && r.mode !== mode)) {
        const msg = '同じフラグで「分散」と「同卓」は同時に選べません';
        setRuleConflictFlag(flag);
        setRuleConflictBanner(msg);
        setCustomRulesError(`「${flag}」は分散と集約を同時に選択できません。`);
        setTimeout(() => setRuleConflictBanner(''), 2000);
        return list;
      }
      if (list.length >= 4) {
        notify('対象フラグは最大4つまで選択できます','warning');
        return list;
      }
      setCustomRulesError('');
      if (ruleConflictFlag === flag) setRuleConflictFlag('');
      return [...list, { flag, mode }];
    });
  };

  const clearAll = () => {
    if (confirm('全ての割当を解除しますか？')) {
      dispatch({type:'CLEAR_ASSIGN',eventId:event.id});
      setSelected(null);
      notify('全割当を解除しました');
    }
  };

  const filteredUnassigned = unassigned.filter(a => {
    if (search && !a.name.includes(search)) return false;
    if (filterTag && !a.flags.includes(filterTag)) return false;
    return true;
  });

  const selName = selected ? attendees.find(a=>a.id===selected)?.name : null;

  return (
    <div className="main assign-page-shell">
      {/* 統計・アクションボタンを InnerNav の #assign-header-portal に注入 */}
      {(()=>{ const t=document.getElementById('assign-header-portal'); return t ? createPortal(
        <>
          <span style={{fontSize:'0.72rem',color:'var(--ink-light)',whiteSpace:'nowrap'}}>卓: {tables.length}</span>
          <span style={{fontSize:'0.72rem',color:'var(--ink-light)',whiteSpace:'nowrap'}}>席: {totalSeats}</span>
          <span style={{fontSize:'0.72rem',color:'#4caf82',fontWeight:700,whiteSpace:'nowrap'}}>割当: {assignedCount}/{totalSeats}</span>
          <span style={{color:'var(--border)',padding:'0 2px',flexShrink:0}}>|</span>
          <button className="btn btn-outline btn-sm" onClick={randomAssign} style={{flexShrink:0,whiteSpace:'nowrap'}}>🎲 ランダム配置</button>
          <button className="btn btn-green btn-sm" onClick={customAssign} style={{flexShrink:0,whiteSpace:'nowrap'}}>✨ カスタム配置</button>
          <button className="btn btn-outline btn-sm" onClick={()=>setCustomRuleModalOpen(true)} style={{flexShrink:0,whiteSpace:'nowrap'}}>⚙️ カスタム設定</button>
          <button className="btn btn-danger btn-sm" onClick={clearAll} style={{flexShrink:0,whiteSpace:'nowrap'}}>全解除</button>
        </>,
        t
      ) : null; })()}

      {/* モバイル専用アクションバー（デスクトップでは非表示） */}
      <div className="assign-mobile-toolbar">
        <div style={{display:'flex',justifyContent:'center',gap:'0.5rem',marginBottom:'0.35rem',fontSize:'0.72rem'}}>
          <span style={{color:'var(--ink-light)'}}>卓: {tables.length}</span>
          <span style={{color:'var(--ink-light)'}}>席: {totalSeats}</span>
          <span style={{color:'#4caf82',fontWeight:700}}>割当: {assignedCount}/{totalSeats}</span>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:'0.4rem',flexWrap:'wrap'}}>
          <button className="btn btn-outline btn-sm" onClick={randomAssign}>🎲 ランダム配置</button>
          <button className="btn btn-green btn-sm" onClick={customAssign}>✨ カスタム配置</button>
          <button className="btn btn-outline btn-sm" onClick={()=>setCustomRuleModalOpen(true)}>⚙️ カスタム設定</button>
          <button className="btn btn-danger btn-sm" onClick={clearAll}>全解除</button>
        </div>
      </div>

      {customRuleModalOpen && (
        <Modal title="カスタム設定" modalClassName="custom-rule-modal" onClose={()=>setCustomRuleModalOpen(false)}
          footer={<><button className="btn btn-outline" onClick={()=>setCustomRuleModalOpen(false)}>キャンセル</button><button className="btn btn-accent" onClick={saveCustomRule} disabled={!!ruleConflictFlag} title={ruleConflictFlag ? '競合するルールがあります。解除してから保存してください。' : undefined}>保存</button></>}>
          <div className="custom-rule-table-panel">
          <div className="text-sm" style={{fontWeight:700,marginBottom:'0.25rem'}}>フラグ別 配置ルール設定</div>
          <div className="text-sm text-muted" style={{marginBottom:'0.6rem'}}>フラグごとに「分散」または「同卓」を設定できます。</div>
          <div className="text-sm text-muted" style={{marginBottom:'0.5rem'}}>※ 既存の保存データ（全体ルール + 対象フラグ）との後方互換を維持するため、保存時に旧形式も併記します。</div>
          {ruleConflictBanner && (
            <div className="rule-conflict-banner" role="status" aria-live="polite">{ruleConflictBanner}</div>
          )}
          <div className="custom-rule-table-wrap">
            <table className="custom-rule-table">
              <thead>
                <tr style={{background:'var(--paper-dark)'}}>
                  <th style={{textAlign:'left',padding:'0.55rem 0.6rem',fontSize:'0.8rem'}}>フラグ名</th>
                  <th style={{textAlign:'center',padding:'0.55rem 0.6rem',fontSize:'0.8rem'}}>
                    <span className="rule-header-wrap">
                      <span>分散</span>
                      <button type="button" className="rule-help-btn" aria-label="分散の説明" aria-controls="tooltip-distribute"
                        aria-describedby="tooltip-distribute" aria-expanded={activeRuleTooltip==='distribute'}
                        onMouseEnter={()=>setActiveRuleTooltip('distribute')} onMouseLeave={()=>setActiveRuleTooltip('')}
                        onFocus={()=>setActiveRuleTooltip('distribute')} onBlur={()=>setActiveRuleTooltip('')}
                        onClick={e=>{e.stopPropagation();setActiveRuleTooltip(prev=>prev==='distribute'?'':'distribute');}}>？</button>
                      {activeRuleTooltip==='distribute' && (
                        <span id="tooltip-distribute" role="tooltip" className="rule-tooltip">同じフラグの人が、できるだけ別の卓に分かれるように配置します。</span>
                      )}
                    </span>
                  </th>
                  <th style={{textAlign:'center',padding:'0.55rem 0.6rem',fontSize:'0.8rem'}}>
                    <span className="rule-header-wrap">
                      <span>同卓</span>
                      <button type="button" className="rule-help-btn" aria-label="同卓の説明" aria-controls="tooltip-gather"
                        aria-describedby="tooltip-gather" aria-expanded={activeRuleTooltip==='gather'}
                        onMouseEnter={()=>setActiveRuleTooltip('gather')} onMouseLeave={()=>setActiveRuleTooltip('')}
                        onFocus={()=>setActiveRuleTooltip('gather')} onBlur={()=>setActiveRuleTooltip('')}
                        onClick={e=>{e.stopPropagation();setActiveRuleTooltip(prev=>prev==='gather'?'':'gather');}}>？</button>
                      {activeRuleTooltip==='gather' && (
                        <span id="tooltip-gather" role="tooltip" className="rule-tooltip align-right">同じフラグの人を、できるだけ同じ卓にまとめて配置します。</span>
                      )}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {allTags.length===0 ? (
                  <tr>
                    <td colSpan={3} className="text-sm text-muted" style={{padding:'0.75rem'}}>参加者フラグがまだありません。</td>
                  </tr>
                ) : (
                  allTags.map(flag => {
                    const distributeChecked = customRulesDraft.some(r => r.flag === flag && r.mode === 'distribute');
                    const gatherChecked = customRulesDraft.some(r => r.flag === flag && r.mode === 'gather');
                    const selectedCount = customRulesDraft.length;
                    const distributeDisabled = !distributeChecked && selectedCount >= 4;
                    const gatherDisabled = !gatherChecked && selectedCount >= 4;
                    const rowConflict = ruleConflictFlag === flag;
                    return (
                      <tr key={flag} className={rowConflict ? 'rule-conflict-row' : ''} style={{borderTop:'1px solid var(--border)'}}>
                        <td style={{padding:'0.5rem 0.6rem',fontSize:'0.85rem'}}>{flag}</td>
                        <td style={{padding:'0.5rem 0.6rem',textAlign:'center'}}>
                          <input type="checkbox" checked={distributeChecked} disabled={distributeDisabled}
                            aria-invalid={rowConflict ? 'true' : 'false'}
                            onChange={e=>upsertRuleDraft(flag, 'distribute', e.target.checked)} />
                        </td>
                        <td style={{padding:'0.5rem 0.6rem',textAlign:'center'}}>
                          <input type="checkbox" checked={gatherChecked} disabled={gatherDisabled}
                            aria-invalid={rowConflict ? 'true' : 'false'}
                            onChange={e=>upsertRuleDraft(flag, 'gather', e.target.checked)} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="text-sm text-muted" style={{marginTop:'0.5rem'}}>{customRulesDraft.length}/4 選択中</div>
          {customRulesError && <div className="text-sm" style={{color:'var(--danger)',marginTop:'0.35rem'}}>{customRulesError}</div>}
          </div>
        </Modal>
      )}

      {violations.length > 0 && (
        <div className="violation-banner" style={{marginBottom:'1rem'}}>
          ⚠️ NGペア違反 {violations.length}件：{violations.map(v=>`${v.tableName}（${v.aName}×${v.bName}）`).join('、')}
        </div>
      )}

      <div className="assign-layout" ref={assignLayoutRef}>
        <div className="assign-sidebar">
          {/* ── サイドバータブ（セグメントコントロール） ── */}
          <div style={{display:'flex',background:'var(--paper-dark)',borderRadius:8,padding:3,marginBottom:'0.75rem',gap:2,flexShrink:0}}>
            <button onClick={()=>setSideTab('table')} style={{flex:1,padding:'0.5rem 0.25rem',borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,fontSize:'0.8rem',background:sideTab==='table'?'var(--accent)':'transparent',color:sideTab==='table'?'#fff':'var(--ink-light)',transition:'all 0.15s',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.3rem'}}>
              🪑 卓管理
            </button>
            <button onClick={()=>setSideTab('seat')} style={{flex:1,padding:'0.5rem 0.25rem',borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,fontSize:'0.8rem',background:sideTab==='seat'?'var(--accent)':'transparent',color:sideTab==='seat'?'#fff':'var(--ink-light)',transition:'all 0.15s',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.3rem',position:'relative'}}>
              👥 席割{selected && sideTab!=='seat' && <span style={{position:'absolute',top:4,right:6,width:7,height:7,borderRadius:'50%',background:'#fff',display:'block'}}/>}
            </button>
          </div>

          {/* ── 卓タブ ── */}
          {sideTab==='table' && (
            <div>
              <button className="btn btn-accent btn-sm w-full" style={{marginBottom:'0.75rem'}} onClick={()=>setShowAddTable(true)}>＋ 卓を追加</button>
              {tables.length===0 && <div className="text-sm text-muted" style={{textAlign:'center',padding:'1rem 0'}}>卓がありません</div>}
              {tables.map((t, index) => {
                const tSeats = seats.filter(s=>s.tableId===t.id);
                const occCount = tSeats.filter(s=>assignments[s.id]).length;
                const hasViol = violations.some(v=>v.tableId===t.id);
                const isExp = expandedTableId===t.id;
                return (
                  <div key={t.id} className={`floor-table-item ${isExp?'active':''}`} onClick={()=>setExpandedTableId(isExp?null:t.id)}>
                    <div className="floor-table-item-head">
                      <span className="floor-table-item-name">{hasViol?'⚠️ ':''}{t.name}</span>
                      <span style={{fontSize:'0.72rem',color:'var(--ink-light)'}}>{occCount}/{t.seatCount}席</span>
                      {/* ▲▼ 並び替えボタン（スマホのみ表示） */}
                      <div className="floor-table-move-btns">
                        <button onClick={e=>{e.stopPropagation();dispatch({type:'MOVE_TABLE',eventId:event.id,idx:index,dir:-1});}} disabled={index===0} style={{background:'none',border:'1px solid var(--border)',borderRadius:4,cursor:index===0?'default':'pointer',opacity:index===0?0.3:1,padding:'2px 7px',fontSize:'0.8rem',lineHeight:1,minHeight:32}}>▲</button>
                        <button onClick={e=>{e.stopPropagation();dispatch({type:'MOVE_TABLE',eventId:event.id,idx:index,dir:+1});}} disabled={index===tables.length-1} style={{background:'none',border:'1px solid var(--border)',borderRadius:4,cursor:index===tables.length-1?'default':'pointer',opacity:index===tables.length-1?0.3:1,padding:'2px 7px',fontSize:'0.8rem',lineHeight:1,minHeight:32}}>▼</button>
                      </div>
                    </div>
                    <div className="floor-seat-bar">
                      {tSeats.map(s=>{ const viol=violationSeatIds.has(s.id); const occ=!!assignments[s.id]; return <div key={s.id} className={`floor-seat-dot ${viol?'viol':occ?'occ':''}`}/>; })}
                    </div>
                    {isExp && (
                      <div onClick={e=>e.stopPropagation()}>
                        <div className="floor-edit-row" style={{marginTop:'0.6rem'}}><label>卓名</label><input type="text" value={t.name} onChange={e=>updateTable(t.id,'name',e.target.value)} style={{flex:1}}/></div>
                        <div className="floor-edit-row"><label>座席数</label><input type="number" min="1" max="30" value={editingSeatCounts[t.id]??String(t.seatCount)} onFocus={e=>e.target.select()} onChange={e=>setEditingSeatCounts(prev=>({...prev,[t.id]:e.target.value}))} onBlur={()=>commitTableSeatCount(t.id,t.seatCount)} onKeyDown={e=>{ if(e.key==='Enter'){commitTableSeatCount(t.id,t.seatCount);e.target.blur();} }} style={{width:60}}/></div>
                        <div className="floor-edit-row"><label>形状</label><div style={{display:'flex',gap:'0.4rem',flex:1}}>{[{v:'rect',icon:'⬛',label:'四角'},{v:'round',icon:'🔵',label:'丸'}].map(s=>(<button key={s.v} className={`btn btn-sm ${(t.shape||'rect')===s.v?'btn-primary':'btn-outline'}`} style={{flex:1,gap:'0.25rem'}} onClick={()=>updateTable(t.id,'shape',s.v)}>{s.icon} {s.label}</button>))}</div></div>
                        {hasViol && <div style={{marginTop:'0.5rem',fontSize:'0.73rem',color:'var(--accent)',background:'#fde8e8',borderRadius:5,padding:'0.3rem 0.5rem'}}>{violations.filter(v=>v.tableId===t.id).map((v,i)=><div key={i}>NG: {v.aName} × {v.bName}</div>)}</div>}
                        <button className="btn btn-outline btn-sm w-full" style={{marginTop:'0.6rem'}} onClick={()=>duplicateTable(t)}>この卓を複製</button>
                        <button className="btn btn-danger btn-sm w-full" style={{marginTop:'0.4rem'}} onClick={()=>delTable(t.id)}>この卓を削除</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{marginTop:'0.75rem',padding:'0.45rem 0.75rem',background:'var(--paper-dark)',borderRadius:6,fontSize:'0.78rem',color:'var(--ink-light)'}}>
                卓: {tables.length}　総席: {totalSeats}　割当: {assignedCount}/{totalSeats}
                {violations.length>0 && <span style={{color:'var(--accent)',marginLeft:'0.5rem'}}>NG違反: {violations.length}件</span>}
              </div>
            </div>
          )}

          {/* ── 席タブ ── */}
          {sideTab==='seat' && (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">未割当 <span className="badge">{unassigned.length}</span></div>
                </div>
                <div className="assign-sidebar-inner" style={{padding:'0.75rem'}}>
                  <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前で検索…" style={{marginBottom:'0.5rem'}}/>
                  <div className="filter-row">
                    <button className={`btn btn-sm ${!filterTag?'btn-primary':'btn-outline'}`} onClick={()=>setFilterTag('')}>すべて</button>
                    {allTags.map(t=>(
                      <button key={t}
                        className={`btn btn-sm ${filterTag===t?'btn-primary':'btn-outline'}`}
                        onClick={()=>setFilterTag(p=>p===t?'':t)}
                        style={filterTag===t ? {background:'var(--accent-gold)',borderColor:'var(--accent-gold)',color:'#fff'} : {}}>
                        {t}
                      </button>
                    ))}
                  </div>
                  {filterTag && (
                    <div style={{margin:'0.4rem 0',padding:'0.3rem 0.6rem',background:'rgba(184,134,11,0.1)',border:'1px solid rgba(184,134,11,0.35)',borderRadius:5,fontSize:'0.72rem',color:'var(--accent-gold)'}}>
                      ★ 「{filterTag}」をハイライト中 — 金色の席が対象者
                    </div>
                  )}
                  <div className="assign-attendee-list">
                    {filteredUnassigned.length===0 && <div className="text-sm text-muted" style={{padding:'0.5rem 0'}}>全員割当済</div>}
                    {filteredUnassigned.map(a=>{
                      const isHL = filterTag && a.flags.includes(filterTag);
                      return (
                        <div key={a.id}
                          className={`attendee-item ${selected===a.id?'selected':''}`}
                          draggable={true}
                          onDragStart={e => { e.dataTransfer.setData('attendee-id', a.id); e.dataTransfer.effectAllowed = 'move'; }}
                          onClick={()=>setSelected(s=>s===a.id?null:a.id)}
                          style={isHL ? {borderColor:'var(--accent-gold)',background:'rgba(184,134,11,0.07)'} : {}}>
                          {isHL && <span style={{color:'var(--accent-gold)',marginRight:4,fontSize:'0.8rem'}}>★</span>}
                          <span>{a.name}</span>
                          {a.flags.length>0 && <div className="item-flags">{a.flags.map(f=><span key={f} className="tag" style={{fontSize:'0.65rem',padding:'0.1rem 0.4rem'}}>{f}</span>)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className={`selection-hint ${selName ? 'has-selection' : ''}`}>
                {selName ? (
                  <>
                    <b style={{color:'var(--ink)',display:'block',marginBottom:'0.15rem'}}>👆 {selName} を選択中</b>
                    席をクリックして配置 / 別の席と入れ替え
                    <div style={{display:'flex',gap:'0.35rem',marginTop:'0.3rem',flexWrap:'wrap'}}>
                      <button onClick={clearSelection} style={{background:'none',border:'1px solid var(--border)',borderRadius:4,padding:'0.15rem 0.5rem',cursor:'pointer',fontSize:'0.72rem',color:'var(--ink-light)'}}>選択解除</button>
                      {lockedAttendees[selected] ? (
                        <button onClick={()=>{dispatch({type:'SET_ATTENDEE_LOCK', eventId:event.id, attendeeId:selected, locked:false});clearSelection();}} style={{background:'#fff',border:'2px solid #1f7a45',borderRadius:4,padding:'0.15rem 0.5rem',cursor:'pointer',fontSize:'0.72rem',fontWeight:700,color:'#1f7a45'}}> 🔓 ロック解除</button>
                      ) : (
                        <button onClick={()=>{dispatch({type:'SET_ATTENDEE_LOCK', eventId:event.id, attendeeId:selected, locked:true});clearSelection();}} style={{background:'#fff4f4',border:'2px solid var(--accent)',borderRadius:4,padding:'0.15rem 0.5rem',cursor:'pointer',fontSize:'0.72rem',fontWeight:700,color:'var(--accent)'}}> 🔒 ロック</button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <b style={{display:'block',marginBottom:'0.2rem'}}>操作方法</b>
                    👆 未割当リストで人を選択<br/>
                    🪑 席をクリックして配置・入れ替え<br/>
                    🏷 フラグボタンで座席表をハイライト<br/>
                    × で個別解除
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div ref={floorViewRef} className="assign-floor-view assign-floor-canvas"
          onClick={e=>{ if(e.target===e.currentTarget) setSelected(null); }}
        >
          {/* 全画面トグルボタン（sticky で常時表示、スマホでは非表示） */}
          <div className="assign-fullscreen-btn" style={{position:'sticky',top:'0.5rem',height:0,zIndex:20,display:'flex',justifyContent:'flex-end',paddingRight:'0.75rem',overflow:'visible'}}>
            <button onClick={toggleFullscreen} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:6,color:'#fff',padding:'4px 10px',cursor:'pointer',fontSize:'0.75rem',fontWeight:600,backdropFilter:'blur(4px)',whiteSpace:'nowrap'}}>
              {isFullscreen ? '✕ 全画面終了' : '⛶ 全画面'}
            </button>
          </div>
          {tables.length===0 && (
            <div style={{textAlign:'center',padding:'3rem',color:'rgba(255,255,255,0.2)'}}>
              <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🪑</div>
              <div>会場に卓を追加してください</div>
            </div>
          )}
          <div style={{position:'sticky',top:'0.5rem',height:0,zIndex:10,overflow:'visible',
            display:'flex',flexDirection:'column',gap:'0.4rem',padding:'0 0.75rem',pointerEvents:'none'}}>
            {selName && (
              <div className="assign-status-banner sel" style={{pointerEvents:'auto'}}>
                👆 <b>{selName}</b> を選択中 — 席をクリックして配置・入れ替え
              </div>
            )}
            {filterTag && !selName && (
              <div className="assign-status-banner filter" style={{pointerEvents:'auto'}}>
                ★ 「<b>{filterTag}</b>」ハイライト中
                <span style={{marginLeft:8,opacity:0.85,fontWeight:400}}>{flagHighlightIds ? flagHighlightIds.size : 0}名 — 金色の席が対象者</span>
              </div>
            )}
          </div>
          <div className="assign-floor-canvas-inner">
            {tables.map((table, index) => {
              const cols = 5;
              const posX = table.posX ?? (40 + (index % cols) * 200);
              const posY = table.posY ?? (40 + Math.floor(index / cols) * 220);
              const tSeats = seats.filter(s=>s.tableId===table.id);
              const hasV   = violationTableIds.has(table.id);
              const tViol  = violations.filter(v=>v.tableId===table.id);
              return (
                <div key={table.id}
                  className="assign-table-drag-wrap"
                  style={{position:'absolute', left:posX, top:posY, cursor:'grab', userSelect:'none'}}
                  onMouseDown={e => startTableDrag(e, table.id)}
                >
                  <AssignFloorTable
                    table={table} seats={tSeats}
                    assignments={assignments} attendees={attendees}
                    violationSeatIds={new Set([...violationSeatIds].filter(id=>tSeats.some(s=>s.id===id)))}
                    selectedId={selected}
                    lockedAttendees={lockedAttendees}
                    hasViolation={hasV} tableViolations={tViol}
                    flagHighlightIds={flagHighlightIds}
                    onSeatClick={handleSeatClick}
                    onUnassign={unassignSeat}
                    onDragDrop={handleDragDrop}
                    onAttendeeAssign={handleAttendeeAssign}
                    onDragCancel={clearSelection}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 卓追加モーダル（卓タブから呼び出し） */}
      {showAddTable && (
        <Modal title="卓を追加" onClose={()=>setShowAddTable(false)}
          footer={<><button className="btn btn-outline" onClick={()=>setShowAddTable(false)}>キャンセル</button><button className="btn btn-accent" onClick={addTable}>追加</button></>}>
          <div><label>卓名（省略時: 自動採番）</label><input type="text" value={newTableDraft.name} onChange={e=>setNewTableDraft(f=>({...f,name:e.target.value}))} placeholder={`T${tables.length+1}`} autoFocus/></div>
          <div><label>座席数</label><input type="number" min="1" max="30" value={newTableSeatInput} onFocus={e=>e.target.select()} onChange={e=>setNewTableSeatInput(e.target.value)} onBlur={()=>{ const n=parseInt(newTableSeatInput,10); if(Number.isFinite(n)) setNewTableSeatInput(String(Math.max(1,Math.min(30,n)))); }}/></div>
          <div><label>テーブル形状</label><div style={{display:'flex',gap:'0.75rem',marginTop:'0.25rem'}}>{[{v:'rect',icon:'⬛',label:'四角（デフォルト）'},{v:'round',icon:'🔵',label:'丸'}].map(s=>(<button key={s.v} className={`btn ${newTableDraft.shape===s.v?'btn-primary':'btn-outline'}`} style={{flex:1,flexDirection:'column',gap:'0.3rem',padding:'0.75rem 0.5rem',fontSize:'0.82rem'}} onClick={()=>setNewTableDraft(f=>({...f,shape:s.v}))}><span style={{fontSize:'1.5rem'}}>{s.icon}</span>{s.label}</button>))}</div></div>
        </Modal>
      )}
    </div>
  );
}
