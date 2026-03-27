// src/App.jsx
// CDN 版からのコピー (docs/index.html 行 1362-1371, 3095-3236)
// ⚠️ CDN版変更点:
//   - React.useReducer → useReducer（名前付きimportへ統一）
//   - useNotify フックをここに同居（InnerNav と同様、currentEvent への閉包依存のため）
//   - InnerNav 関数はここに同居（currentEvent への閉包依存のため分離不可）

import { useState, useEffect, useMemo, useCallback, useReducer, useRef } from 'react';
import { reducer, DEFAULT_STATE } from './reducer.js';
import { loadState, saveState, clearState, sanitizeEvent } from './lib/storage.js';
import { exportEventJSON, parseImportedEvent, buildShareURL, loadSharedEvent } from './lib/share.js';
import { onAuthChange, getSession, signOut, signIn, signUp, resetPasswordForEmail, updatePassword } from './lib/auth.js';
import { syncLocalEvents, listEvents } from './lib/eventRepository.js';
import AuthModal from './components/AuthModal.jsx';
import EventsPage from './components/EventsPage.jsx';
import LayoutPage from './components/LayoutPage.jsx';
import AttendeesPage from './components/AttendeesPage.jsx';
import ViewPage from './components/ViewPage.jsx';
import AssignPage from './components/AssignPage.jsx';

function useNotify() {
  const [note, setNote] = useState(null);
  const timer = useRef(null);
  const notify = useCallback((msg, type='success') => {
    clearTimeout(timer.current);
    setNote({ msg, type });
    timer.current = setTimeout(() => setNote(null), 3200);
  }, []);
  return [note, notify];
}

export default function App() {
  // 共有URLチェック
  const sharedEvent = useMemo(() => loadSharedEvent(), []);
  if (sharedEvent) {
    return (
      <>
        <div className="topbar">
          <div className="topbar-logo">The<span>SEKI</span></div>
          <nav className="topbar-nav"><span className="nav-btn active">座席表 閲覧</span></nav>
        </div>
        <ViewPage event={sharedEvent}/>
      </>
    );
  }

  const [state, dispatch_] = useReducer(reducer, DEFAULT_STATE);
  const [page, setPage] = useState('events');
  const [assignInitTab, setAssignInitTab] = useState('seat');
  const [assignKey, setAssignKey] = useState(0);
  const [note, notify] = useNotify();
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimer = useRef(null);

  // auth 状態（2段構え: 初回 getSession → 以降 onAuthChange で追跡）
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle'|'syncing'|'done'|'error'
  const [syncResult, setSyncResult] = useState(null);   // { succeeded, failed } | null

  const dispatch = useCallback((action) => dispatch_(action), []);

  useEffect(() => {
    // 起動時は常に localStorage から復元（ログイン不問）
    // キャッシュが残っていれば未ログインでも作業継続できる
    const saved = loadState();
    if (saved) dispatch({ type: 'LOAD_STATE', payload: saved });

    getSession().then(({ session }) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const unsub = onAuthChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // パスワードリセットリンクからの戻り → パスワード更新UIを表示
        setIsPasswordRecovery(true);
        setShowAuthModal(true);
        return;
      }
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ---- auth ハンドラ ----

  async function handleLogin(email, password) {
    const { error } = await signIn(email, password);
    if (!error) {
      setShowAuthModal(false);
      // state は起動時に localStorage から復元済みなので、ここで events が揃っている
      if (state.events.length > 0) {
        handleAutoSync();
      }
    }
    return { error };
  }

  async function handleSignUp(email, password) {
    const { session, error } = await signUp(email, password);
    if (!error && session) {
      // Email Confirmation OFF: 即ログイン
      setShowAuthModal(false);
      if (state.events.length > 0) {
        handleAutoSync();
      }
    }
    return { session, error };
  }

  async function handleResetPassword(email) {
    const { error } = await resetPasswordForEmail(email);
    return { error };
  }

  async function handleUpdatePassword(newPassword) {
    const { error } = await updatePassword(newPassword);
    if (!error) {
      setIsPasswordRecovery(false);
      // onAuthStateChange が USER_UPDATED / SIGNED_IN で authUser を更新する
    }
    return { error };
  }

  async function handleSignOut() {
    await signOut();
    clearState();                      // localStorage 削除（次回起動時に空スタート）
    dispatch({ type: 'RESET_STATE' }); // 画面クリア
    setPage('events');
    setShowAuthModal(false);
  }

  // ローカルイベントを DB に一括同期（ログイン時の自動同期 + 手動同期ボタン）
  async function handleSync() {
    setSyncStatus('syncing');
    setSyncResult(null);
    const result = await syncLocalEvents(state.events);
    setSyncResult({ succeeded: result.succeeded, failed: result.failed, errorMessage: result.firstErrorMessage });
    setSyncStatus(result.failed > 0 && result.succeeded === 0 ? 'error' : 'done');
  }

  // ログイン時の自動同期（通知バナーで結果表示）
  async function handleAutoSync() {
    const result = await syncLocalEvents(state.events);
    if (result.failed === 0 && result.succeeded > 0) {
      notify(`${result.succeeded} 件をDBに同期しました`);
    } else if (result.failed > 0) {
      notify(`同期: ${result.succeeded} 件成功 / ${result.failed} 件失敗`, 'error');
    }
  }

  // DB からイベントを復元（再ログイン後などに使用）
  async function handleRestoreFromDB() {
    const { data, error } = await listEvents();
    if (error) {
      notify('DBからの復元に失敗しました', 'error');
      return;
    }
    if (!data.length) {
      notify('復元できるイベントがDBに見つかりませんでした', 'error');
      return;
    }
    const events = data
      .map(row => {
        if (!row.payload_json) return null;
        return sanitizeEvent({
          tables: [], attendees: [], ngPairs: [], assignments: {},
          ...row.payload_json,
        });
      })
      .filter(Boolean);
    const restored = { events, currentEventId: null };
    dispatch({ type: 'LOAD_STATE', payload: restored });
    saveState(restored);
    notify(`${events.length} 件のイベントをDBから復元しました`);
  }

  // 自動保存（デバウンス100ms）— ログイン不問で保存（未ログイン時のイベントも保持）
  useEffect(() => {
    setSaveStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState(state);
      setSaveStatus('saved');
    }, 100);
  }, [state]);

  // localStorage容量超過エラー
  useEffect(() => {
    const handler = () => {
      setSaveStatus('error');
      notify('保存に失敗しました。ストレージ容量が不足している可能性があります。', 'error');
    };
    window.addEventListener('theseki:saveerror', handler);
    return () => window.removeEventListener('theseki:saveerror', handler);
  }, [notify]);

  const currentEvent = state.events.find(e=>e.id===state.currentEventId);

  // JSONバックアップ
  const handleExportJSON = () => {
    if (!currentEvent) return;
    exportEventJSON(currentEvent);
    notify('JSONバックアップをダウンロードしました');
  };

  // JSONインポート
  const handleImportJSON = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = parseImportedEvent(ev.target.result);
        dispatch({type:'IMPORT_EVENT', payload:imported});
        setAssignInitTab('table');setAssignKey(k=>k+1);setPage('assign');
        notify(`「${imported.name}」をインポートしました`, 'success');
      } catch(err) {
        notify(`インポート失敗: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file,'UTF-8');
    e.target.value='';
  };

  // 閲覧用URL共有
  const handleShare = () => {
    if (!currentEvent) return;
    const url = buildShareURL(currentEvent);
    if (!url) { notify('URL生成に失敗しました', 'error'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(()=>notify('共有URLをクリップボードにコピーしました'));
    } else {
      prompt('この URLを共有してください:', url);
    }
  };

  const statusColor = saveStatus==='error'?'var(--accent)': saveStatus==='saving'?'var(--accent-gold)':'#4caf82';
  const statusLabel = saveStatus==='error'?'保存エラー ⚠️': saveStatus==='saving'?'保存中…':'保存済 ✓';

  // イベント内サブページ用のブレッドクラム＋タブバー
  // InnerNav は currentEvent への閉包依存のため App.jsx に同居
  const InnerNav = ({ subPage, setSubPage }) => (
    <div className={`inner-nav-wrap ${(subPage==='assign'||subPage==='attendees')?'subpage-fixed':''}`}>
      <button className="btn btn-ghost btn-sm inner-nav-back" onClick={()=>setPage('events')}
        style={{color:'var(--ink-light)',padding:'0.3rem 0.5rem',whiteSpace:'nowrap'}}>
        ← 一覧
      </button>
      <span style={{color:'var(--border)'}}>|</span>
      <span className="inner-nav-title" style={{fontSize:'0.82rem',fontWeight:600,color:'var(--ink)',fontFamily:"'Noto Serif JP',serif"}}>
        {currentEvent?.name}
      </span>
      {/* 席割ページの統計・アクションをここに描画（AssignPage からポータルで注入） */}
      <span id="assign-header-portal" style={{flex:1,display:'flex',alignItems:'center',gap:'0.4rem',minWidth:0,overflow:'hidden'}}/>
      <div className="inner-nav-tabs" style={{display:'flex',gap:'0.4rem',flexShrink:0}}>
        {[{id:'assign',label:'席割'},{id:'attendees',label:'参加者'}].map(t=>(
          <button key={t.id}
            className={`btn btn-sm ${subPage===t.id?'btn-primary':'btn-outline'}`}
            onClick={()=>setSubPage(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className={`topbar ${(page==='layout'||page==='assign'||page==='attendees')?'topbar-subpage':''}`}>
        <div className="topbar-logo">The<span>SEKI</span></div>
        {!authLoading && (
          <button
            className="btn btn-ghost btn-sm topbar-login-mobile"
            onClick={() => setShowAuthModal(true)}
            style={{marginLeft:'auto',color:'rgba(255,255,255,0.7)',fontSize:'0.8rem',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
          >
            {authUser ? authUser.email : 'ログイン'}
          </button>
        )}
        <div className="topbar-actions-desktop" style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'0.75rem'}}>
          {!authLoading && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAuthModal(true)}
              style={{color:'rgba(255,255,255,0.7)',fontSize:'0.75rem',maxWidth:'140px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
            >
              {authUser ? authUser.email : 'ログイン'}
            </button>
          )}
          <span className="topbar-status" style={{color:statusColor}}>{statusLabel}</span>
          <label className="btn btn-ghost btn-sm" style={{cursor:'pointer',color:'rgba(255,255,255,0.55)',fontSize:'0.75rem'}}>
            📂 復元<input type="file" accept=".json" onChange={handleImportJSON} style={{display:'none'}}/>
          </label>
          {currentEvent && <button className="btn btn-ghost btn-sm" onClick={handleExportJSON} style={{color:'rgba(255,255,255,0.55)',fontSize:'0.75rem'}}>💾 バックアップ</button>}
          {currentEvent && <button className="btn btn-ghost btn-sm" onClick={handleShare} style={{color:'rgba(255,255,255,0.55)',fontSize:'0.75rem'}}>🔗 共有URL</button>}
        </div>
      </div>

      {page==='events' && <EventsPage state={state} dispatch={dispatch} onLayout={(id)=>{dispatch({type:'SET_CURRENT',payload:id});setAssignInitTab('table');setAssignKey(k=>k+1);setPage('assign');}} onAssign={(id)=>{dispatch({type:'SET_CURRENT',payload:id});setPage('attendees');}}/>}
      {(page==='layout'||page==='assign'||page==='attendees') && currentEvent && (
        <div className="event-subpage-shell" style={{display:'flex',flexDirection:'column',height:'calc(100dvh - 52px)'}}>
          <InnerNav subPage={page} setSubPage={(p)=>{if(p==='assign'){setAssignInitTab('seat');setAssignKey(k=>k+1);}setPage(p);}}/>
          <div className="event-subpage-content" style={{minHeight:0, WebkitOverflowScrolling:'touch'}}>
            {page==='layout' && <LayoutPage event={currentEvent} dispatch={dispatch} notify={notify}/>}
            {page==='assign' && <AssignPage key={assignKey} event={currentEvent} dispatch={dispatch} notify={notify} initialSideTab={assignInitTab}/>}
            {page==='attendees' && <AttendeesPage event={currentEvent} dispatch={dispatch} notify={notify}/>}
          </div>
        </div>
      )}

      {note && <div className={`notification ${note.type}`}>{note.msg}</div>}
      {showAuthModal && (
        <AuthModal
          user={authUser}
          onSignOut={handleSignOut}
          onClose={() => setShowAuthModal(false)}
          eventCount={state.events.length}
          syncStatus={syncStatus}
          syncResult={syncResult}
          onSync={handleSync}
          isPasswordRecovery={isPasswordRecovery}
          onLogin={handleLogin}
          onSignUp={handleSignUp}
          onResetPassword={handleResetPassword}
          onUpdatePassword={handleUpdatePassword}
          onRestoreFromDB={handleRestoreFromDB}
        />
      )}
    </>
  );
}
