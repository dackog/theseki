// src/App.jsx
// CDN 版からのコピー (docs/index.html 行 1362-1371, 3095-3236)
// ⚠️ CDN版変更点:
//   - React.useReducer → useReducer（名前付きimportへ統一）
//   - useNotify フックをここに同居（InnerNav と同様、currentEvent への閉包依存のため）
//   - InnerNav 関数はここに同居（currentEvent への閉包依存のため分離不可）

import { useState, useEffect, useMemo, useCallback, useReducer, useRef } from 'react';
import { reducer, DEFAULT_STATE } from './reducer.js';

// InnerNav を App 外で定義することで、App の再レンダー時に
// コンポーネント型の参照が変わらず unmount/remount が起きないようにする。
// （内部で定義すると毎レンダーで新しい関数参照になり、ポータルターゲットが消える）
function InnerNav({ subPage, setSubPage, eventName, onBack }) {
  return (
    <div className={`inner-nav-wrap ${(subPage==='assign'||subPage==='attendees')?'subpage-fixed':''}`}>
      <button className="btn btn-ghost btn-sm inner-nav-back" onClick={onBack}
        style={{color:'var(--ink-light)',padding:'0.3rem 0.5rem',whiteSpace:'nowrap'}}>
        ← 一覧
      </button>
      <span style={{color:'var(--border)'}}>|</span>
      <span className="inner-nav-title" style={{fontSize:'0.82rem',fontWeight:600,color:'var(--ink)',fontFamily:"'Noto Serif JP',serif"}}>
        {eventName}
      </span>
      {/* 席割ページの統計・アクションをここに描画（AssignPage からポータルで注入） */}
      <span id="assign-header-portal" style={{flex:1,display:'flex',alignItems:'center',gap:'0.4rem',minWidth:0,overflow:'visible'}}/>
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
}
import { loadState, saveState, clearState, sanitizeEvent } from './lib/storage.js';
import { loadSharedEvent } from './lib/share.js';
import { onAuthChange, getSession, signOut, signIn, signUp, resetPasswordForEmail, updatePassword } from './lib/auth.js';
import { listEvents, createEvent, syncDirtyEvents, deleteEventByClientId } from './lib/eventRepository.js';
import { createShare, getSharedEvent } from './lib/shareRepository.js';
import { loadSyncMeta, saveSyncMeta, clearSyncMeta, markSynced, getUnsyncedEvents } from './lib/syncMeta.js';
import AuthModal from './components/AuthModal.jsx';
import EventsPage from './components/EventsPage.jsx';
import LayoutPage from './components/LayoutPage.jsx';
import AttendeesPage from './components/AttendeesPage.jsx';
import ViewPage from './components/ViewPage.jsx';
import AssignPage from './components/AssignPage.jsx';
import AppFooter from './components/AppFooter.jsx';
import TermsPage from './components/TermsPage.jsx';
import PrivacyPage from './components/PrivacyPage.jsx';

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ---- ハッシュページ検出（#terms / #privacy）----
  const [hashPage, setHashPage] = useState(() => {
    const h = location.hash.replace('#', '');
    return (h === 'terms' || h === 'privacy') ? h : '';
  });

  useEffect(() => {
    const handler = () => {
      const h = location.hash.replace('#', '');
      setHashPage((h === 'terms' || h === 'privacy') ? h : '');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // ---- 共有URL検出（hooks は全て早期 return より前に置く）----

  // ?share= パラメータ（DB共有、新方式）
  const shareParam = useMemo(() => new URLSearchParams(location.search).get('share'), []);
  // #view= ハッシュ（後方互換、旧方式）— ?share= がある場合はスキップ
  const legacySharedEvent = useMemo(() => !shareParam ? loadSharedEvent() : null, [shareParam]);

  // DB共有リンクの読み込み状態
  const [dbSharedEvent, setDbSharedEvent] = useState(null);
  const [dbShareNotFound, setDbShareNotFound] = useState(false);
  const [dbShareLoading, setDbShareLoading] = useState(!!shareParam);

  // ---- 通常アプリ用 state ----
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
  const [dbSyncStatus, setDbSyncStatus] = useState('idle'); // 'idle'|'syncing'|'done'|'error'
  const autoSyncTimer = useRef(null);
  const dbSyncDoneTimer = useRef(null);
  const authUserRef = useRef(authUser);
  useEffect(() => { authUserRef.current = authUser; }, [authUser]);

  const dispatch = useCallback((action) => {
    dispatch_(action);
    if (action.type === 'DELETE_EVENT' && authUserRef.current) {
      const clientId = action.payload;
      deleteEventByClientId(clientId).catch(err =>
        console.error('[App] deleteEventByClientId error:', err)
      );
      const meta = loadSyncMeta();
      const { [clientId]: _removed, ...rest } = meta;
      saveSyncMeta(rest);
    }
  }, []);

  /**
   * Phase B/C: DB とローカルを newer wins でマージする。
   * ログイン直後・アプリ起動時（既存セッションあり）に呼ぶ。
   * - DB のみ: ローカルに追加
   * - 両方あり: 新しい方を採用
   * - ローカルのみ: そのまま残す（auto-sync が後で DB へ push する）
   * @param {object[]} localEvents  現在のローカルイベント配列
   * @param {string|null} currentEventId  現在の currentEventId
   */
  async function mergeWithDB(localEvents, currentEventId) {
    const { data: dbRows, error } = await listEvents();
    if (error) {
      console.error('[App] mergeWithDB listEvents error:', error);
      return;
    }
    if (!dbRows.length) return; // DB が空なら何もしない

    const localById = new Map(localEvents.map(ev => [ev.id, ev]));
    const merged = [...localEvents];
    const dbWonClientIds = [];

    for (const row of dbRows) {
      if (!row.payload_json) continue;
      const clientId = row.client_id;
      if (!clientId) continue;
      const localEv = localById.get(clientId);
      if (!localEv) {
        // DB にのみ存在 → ローカルに追加
        const ev = sanitizeEvent({
          tables: [], attendees: [], ngPairs: [], assignments: {},
          ...row.payload_json,
        });
        merged.push(ev);
        dbWonClientIds.push(clientId);
      } else {
        // 両方にあり → newer wins
        const dbMs = new Date(row.updated_at).getTime();
        const localMs = localEv.updatedAt ? new Date(localEv.updatedAt).getTime() : 0;
        if (dbMs > localMs) {
          const idx = merged.findIndex(e => e.id === clientId);
          if (idx !== -1) {
            merged[idx] = sanitizeEvent({
              tables: [], attendees: [], ngPairs: [], assignments: {},
              ...row.payload_json,
            });
            dbWonClientIds.push(clientId);
          }
        }
      }
    }

    // DB 勝ちのイベントを syncMeta に記録（再 push 不要なため）
    if (dbWonClientIds.length > 0) {
      const meta = loadSyncMeta();
      const updated = markSynced(meta, dbWonClientIds);
      saveSyncMeta(updated);
    }

    const newState = { events: merged, currentEventId: currentEventId ?? null };
    dispatch_({ type: 'LOAD_STATE', payload: newState });
    saveState(newState);
    return dbWonClientIds.length; // 呼び出し側で通知に使う
  }

  // ?share= の場合は DB からイベントを取得
  useEffect(() => {
    if (!shareParam) return;
    getSharedEvent(shareParam).then(({ event, error }) => {
      if (error) {
        console.error('[App] getSharedEvent error:', error);
        setDbShareNotFound(true);
      } else if (!event) {
        setDbShareNotFound(true);
      } else {
        setDbSharedEvent(event);
      }
      setDbShareLoading(false);
    });
  }, [shareParam]);

  useEffect(() => {
    // 起動時は常に localStorage から復元（ログイン不問）
    // キャッシュが残っていれば未ログインでも作業継続できる
    const saved = loadState();
    const initialLocalEvents = saved?.events ?? [];
    const initialCurrentId = saved?.currentEventId ?? null;
    if (saved) dispatch_({ type: 'LOAD_STATE', payload: saved });

    getSession().then(async ({ session }) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      if (user) {
        // Phase C: 既存セッションあり → DB と newer wins マージ
        const dbWonCount = await mergeWithDB(initialLocalEvents, initialCurrentId);
        if (dbWonCount > 0) notify(`クラウドから ${dbWonCount} 件のイベントを取り込みました`);
      }
      setAuthLoading(false);
    });

    const unsub = onAuthChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // パスワードリセットリンクからの戻り → パスワード更新UIを表示
        setIsPasswordRecovery(true);
        setShowAuthModal(true);
        return;
      }
      if (event === 'SIGNED_OUT') {
        // 別タブや外部からのログアウトも含めて確実にクリア
        clearState();
        dispatch({ type: 'RESET_STATE' });
        setIsPasswordRecovery(false);
        setPage('events');
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
      // Phase B: ログイン直後に DB とマージ（newer wins）
      const dbWonCount = await mergeWithDB(state.events, state.currentEventId);
      if (dbWonCount > 0) notify(`クラウドから ${dbWonCount} 件のイベントを取り込みました`);
    }
    return { error };
  }

  async function handleSignUp(email, password, nickname) {
    const { session, error } = await signUp(email, password, nickname);
    if (!error && session) {
      // Email Confirmation OFF: 即ログイン
      setShowAuthModal(false);
      // Phase B: 即ログイン時は DB に何もないので通常 0 件だが統一する
      const dbWonCount = await mergeWithDB(state.events, state.currentEventId);
      if (dbWonCount > 0) notify(`クラウドから ${dbWonCount} 件のイベントを取り込みました`);
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
    clearTimeout(autoSyncTimer.current); // 遅延中の自動同期をキャンセル
    clearTimeout(dbSyncDoneTimer.current);
    await signOut();
    clearState();                        // localStorage 削除（次回起動時に空スタート）
    clearSyncMeta();                     // 差分同期メタも削除
    dispatch({ type: 'RESET_STATE' });   // 画面クリア
    setDbSyncStatus('idle');
    setIsPasswordRecovery(false);
    setPage('events');
    setShowAuthModal(false);
  }

  // 差分自動同期（編集後 3s debounce / ログイン直後）
  async function handleAutoSyncDirty() {
    if (!authUser) return;
    const meta = loadSyncMeta();
    const dirty = getUnsyncedEvents(state.events, meta);
    if (dirty.length === 0) return;
    setDbSyncStatus('syncing');
    const result = await syncDirtyEvents(dirty);
    if (result.syncedClientIds.length > 0) {
      const updated = markSynced(meta, result.syncedClientIds);
      saveSyncMeta(updated);
    }
    if (result.failed > 0) {
      console.error('[App] handleAutoSyncDirty: partial failure', result.errors);
      setDbSyncStatus('error');
    } else {
      setDbSyncStatus('done');
      clearTimeout(dbSyncDoneTimer.current);
      dbSyncDoneTimer.current = setTimeout(() => setDbSyncStatus('idle'), 4000);
    }
  }

  // 自動保存（デバウンス100ms）+ DB自動同期（デバウンス3000ms）
  // localStorage 保存はログイン不問。DB同期はログイン中のみ。
  useEffect(() => {
    setSaveStatus('saving');
    clearTimeout(saveTimer.current);
    clearTimeout(autoSyncTimer.current);

    saveTimer.current = setTimeout(() => {
      saveState(state);
      setSaveStatus('saved');
    }, 100);

    if (authUser && state.events.length > 0) {
      autoSyncTimer.current = setTimeout(() => {
        handleAutoSyncDirty();
      }, 3000);
    }
  }, [state, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 閲覧用共有リンク作成（DB方式）
  async function handleCreateShare() {
    if (!currentEvent) return;
    if (!authUser) {
      notify('共有リンクの作成にはログインが必要です', 'error');
      return;
    }
    // DB に upsert して DB uuid を取得
    const { data, error: upsertError } = await createEvent(currentEvent.name, currentEvent);
    if (upsertError || !data?.id) {
      console.error('[App] handleCreateShare upsert error:', upsertError);
      notify('リンクの作成に失敗しました。もう一度お試しください', 'error');
      return;
    }
    const { shareId, error: shareError } = await createShare(data.id);
    if (shareError) {
      console.error('[App] handleCreateShare error:', shareError);
      notify('リンクの作成に失敗しました。もう一度お試しください', 'error');
      return;
    }
    const url = `${location.origin}${import.meta.env.BASE_URL}?share=${shareId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => notify('共有リンクをクリップボードにコピーしました'));
    } else {
      prompt('この URL を共有してください:', url);
    }
  }

  const statusColor = saveStatus==='error'?'var(--accent)': saveStatus==='saving'?'var(--accent-gold)':'#4caf82';
  const statusLabel = saveStatus==='error'?'保存エラー ⚠️': saveStatus==='saving'?'保存中…':'保存済 ✓';

  const dbSyncColor = dbSyncStatus==='error'?'var(--accent)': dbSyncStatus==='syncing'?'var(--accent-gold,#c9a227)':'#4caf82';
  const dbSyncLabel = dbSyncStatus==='syncing'?'クラウド同期中…': dbSyncStatus==='done'?'クラウド同期済 ✓':'同期エラー ⚠';

  // ニックネーム優先表示（nickname → email ローカルパート → 'ログイン'）
  const displayName = authUser
    ? (authUser.user_metadata?.nickname || authUser.email.split('@')[0])
    : 'ログイン';

  // ---- 共有URLモード（通常アプリより先に返す）----

  // ?share= DBアクセス中 or ViewPage 表示
  if (shareParam) {
    return (
      <>
        <div className="topbar">
          <div className="topbar-logo">The<span>SEKI</span></div>
          <nav className="topbar-nav"><span className="nav-btn active">座席表 閲覧</span></nav>
        </div>
        {dbShareLoading
          ? <div className="main"><p style={{padding:'2rem',textAlign:'center',color:'var(--ink-muted,rgba(0,0,0,0.5))'}}>読み込み中...</p></div>
          : <ViewPage event={dbSharedEvent} notFound={dbShareNotFound} />
        }
      </>
    );
  }

  // #terms / #privacy ハッシュルーティング
  if (hashPage === 'terms')   return <TermsPage />;
  if (hashPage === 'privacy') return <PrivacyPage />;

  // #view= 後方互換（旧方式）
  if (legacySharedEvent) {
    return (
      <>
        <div className="topbar">
          <div className="topbar-logo">The<span>SEKI</span></div>
          <nav className="topbar-nav"><span className="nav-btn active">座席表 閲覧</span></nav>
        </div>
        <ViewPage event={legacySharedEvent}/>
      </>
    );
  }

  // ---- 通常アプリ ----

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
            {displayName}
          </button>
        )}
        <div className="topbar-actions-desktop" style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'0.75rem'}}>
          {!authLoading && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAuthModal(true)}
              style={{color:'rgba(255,255,255,0.7)',fontSize:'0.75rem',maxWidth:'140px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
            >
              {displayName}
            </button>
          )}
          <span className="topbar-status" style={{color:statusColor}}>{statusLabel}</span>
          {authUser && dbSyncStatus !== 'idle' && (
            <span style={{color:dbSyncColor,fontSize:'0.75rem'}}>{dbSyncLabel}</span>
          )}
          {currentEvent && page !== 'events' && <button className="btn btn-ghost btn-sm" onClick={handleCreateShare} style={{color:'rgba(255,255,255,0.55)',fontSize:'0.75rem'}}>🔗 共有URL</button>}
        </div>
      </div>

      {page==='events' && (
        <div className="page-with-footer">
          <EventsPage state={state} dispatch={dispatch} authUser={authUser} onLayout={(id)=>{dispatch({type:'SET_CURRENT',payload:id});setAssignInitTab('table');setAssignKey(k=>k+1);setPage('assign');}} onAssign={(id)=>{dispatch({type:'SET_CURRENT',payload:id});setPage('attendees');}}/>
          <AppFooter />
        </div>
      )}
      {(page==='layout'||page==='assign'||page==='attendees') && currentEvent && (
        <>
          {/* ── モバイル専用イベントヘッダー（PCではCSS非表示） ── */}
          <div className="mobile-event-header">
            <button className="hamburger-btn" aria-label="メニューを開く" onClick={() => setDrawerOpen(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <line x1="3" y1="6"  x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <button className="mobile-back-btn" aria-label="イベント一覧に戻る" onClick={() => setPage('events')}>
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{width:18,height:18,stroke:'currentColor',fill:'none',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'}}>
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              一覧
            </button>
            <span className="mobile-event-title">{currentEvent.name}</span>
          </div>

          <div className="event-subpage-shell" style={{display:'flex',flexDirection:'column'}}>
            <InnerNav subPage={page} setSubPage={(p)=>{if(p==='assign'){setAssignInitTab('seat');setAssignKey(k=>k+1);}setPage(p);}} eventName={currentEvent?.name} onBack={()=>setPage('events')}/>
            <div className="event-subpage-content" style={{minHeight:0, WebkitOverflowScrolling:'touch'}}>
              {page==='layout' && <LayoutPage event={currentEvent} dispatch={dispatch} notify={notify}/>}
              {page==='assign' && <AssignPage key={assignKey} event={currentEvent} dispatch={dispatch} notify={notify} initialSideTab={assignInitTab}/>}
              {page==='attendees' && <AttendeesPage event={currentEvent} dispatch={dispatch} notify={notify}/>}
            </div>
          </div>
        </>
      )}

      {note && <div className={`notification ${note.type}`}>{note.msg}</div>}

      {/* ── ハンバーガードロワー（モバイルのみ表示） ── */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}/>
          <nav className="drawer" aria-label="メインメニュー">
            <div className="drawer-header">メニュー</div>
            <button className="drawer-item" onClick={() => { setPage('events'); setDrawerOpen(false); }}>
              イベント一覧 / 新規作成
            </button>
            <button className="drawer-item" onClick={() => { setShowAuthModal(true); setDrawerOpen(false); }}>
              アカウント（{displayName}）
            </button>
          </nav>
        </>
      )}

      {/* ── モバイルボトムナビ ── */}
      <nav className="mobile-bottom-nav" aria-label="メインナビゲーション">
        {/* イベント一覧ページ: 一覧ボタンのみ */}
        {page === 'events' && (
          <button className="mobile-nav-item active" onClick={() => setPage('events')} aria-label="イベント一覧">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span>一覧</span>
          </button>
        )}
        {/* イベント詳細ページ: 座席／席割／参加者の3タブ */}
        {(page==='layout'||page==='assign'||page==='attendees') && currentEvent && (
          <>
            <button
              className={`mobile-nav-item ${page==='layout'?'active':''}`}
              onClick={() => setPage('layout')}
              aria-label="座席"
            >
              <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
              <span>座席</span>
            </button>
            <button
              className={`mobile-nav-item ${page==='assign'?'active':''}`}
              onClick={() => { setAssignInitTab('seat'); setAssignKey(k=>k+1); setPage('assign'); }}
              aria-label="席割"
            >
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              <span>席割</span>
            </button>
            <button
              className={`mobile-nav-item ${page==='attendees'?'active':''}`}
              onClick={() => setPage('attendees')}
              aria-label="参加者"
            >
              <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>
              <span>参加者</span>
            </button>
          </>
        )}
      </nav>

      {(showAuthModal || isPasswordRecovery) && (
        <AuthModal
          user={authUser}
          onSignOut={handleSignOut}
          onClose={isPasswordRecovery ? null : () => setShowAuthModal(false)}
          syncStatus={dbSyncStatus}
          isPasswordRecovery={isPasswordRecovery}
          onLogin={handleLogin}
          onSignUp={handleSignUp}
          onResetPassword={handleResetPassword}
          onUpdatePassword={handleUpdatePassword}
          onNicknameUpdate={(newUser) => setAuthUser(newUser)}
        />
      )}
    </>
  );
}
