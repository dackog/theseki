// src/components/AuthModal.jsx
// email/password 認証 UI（ログイン / 新規登録 / パスワードリセット / パスワード更新 / アカウント）
import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';

const inkMuted = 'var(--ink-muted,rgba(0,0,0,0.5))';

function ResultMsg({ result }) {
  if (!result) return null;
  return (
    <div style={{
      padding:'0.625rem 0.75rem', borderRadius:'6px', fontSize:'0.8rem', lineHeight:1.5,
      background: result.type === 'success' ? 'rgba(76,175,130,0.12)' : 'rgba(201,53,53,0.1)',
      color: result.type === 'success' ? '#2e7d5e' : 'var(--danger,#c93535)',
      whiteSpace: 'pre-wrap',
    }}>
      {result.message}
    </div>
  );
}

export default function AuthModal({
  user,
  onSignOut,
  onClose,
  eventCount,
  syncStatus,
  syncResult,
  onSync,
  isPasswordRecovery,
  onLogin,
  onSignUp,
  onResetPassword,
  onUpdatePassword,
  onRestoreFromDB,
}) {
  const initialView = isPasswordRecovery ? 'update_password'
    : user ? 'account'
    : 'login';

  const [view, setView] = useState(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function validatePassword(pw) {
    if (!pw) return 'パスワードを入力してください';
    if (pw.length < 6) return 'パスワードは6文字以上で入力してください';
    if (pw.length > 64) return 'パスワードは64文字以内で入力してください';
    if (!/[a-z]/.test(pw)) return 'パスワードに半角英字（小文字）を1文字以上含めてください';
    if (!/[0-9]/.test(pw)) return 'パスワードに数字を1文字以上含めてください';
    return null;
  }

  useEffect(() => {
    if (isPasswordRecovery) setView('update_password');
  }, [isPasswordRecovery]);

  // ログイン後に user が変化したらアカウントビューへ（パスワードリセット中は除く）
  useEffect(() => {
    if (user && !isPasswordRecovery) setView('account');
  }, [user]);

  function changeView(v) {
    setView(v);
    setResult(null);
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setNewPassword('');
  }

  async function doLogin() {
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setResult(null);
    const { error } = await onLogin(email, password);
    setLoading(false);
    if (error) {
      console.warn('[AuthModal] login error:', error);
      setResult({ type: 'error', message: 'メールアドレスまたはパスワードが正しくありません' });
    }
  }

  async function doSignUp() {
    if (!email.trim() || !password || !passwordConfirm || loading) return;
    const pwError = validatePassword(password);
    if (pwError) { setResult({ type: 'error', message: pwError }); return; }
    if (password !== passwordConfirm) {
      setResult({ type: 'error', message: 'パスワードが一致しません' }); return;
    }
    setLoading(true);
    setResult(null);
    const { session, error } = await onSignUp(email, password);
    setLoading(false);
    if (error) {
      console.warn('[AuthModal] signup error:', error);
      setResult({ type: 'error', message: '登録に失敗しました。入力内容を確認してください' });
    } else if (!session) {
      // Email Confirmation ON: Supabase はメール列挙防止のため登録済みアドレスでも error を返さない
      setResult({ type: 'success', message: 'ご入力のメールアドレスに確認メールをお送りしました。メール内のリンクをクリックして登録を完了してください。\n\nしばらくしてもメールが届かない場合、すでに登録済みのメールアドレスである可能性があります。その場合はログインをお試しください。' });
    }
    // session あり（即ログイン）の場合は App.jsx がモーダルを閉じる
  }

  async function doResetPassword() {
    if (!email.trim() || loading) return;
    setLoading(true);
    setResult(null);
    const { error } = await onResetPassword(email);
    setLoading(false);
    if (error) {
      console.warn('[AuthModal] resetPassword error:', error);
      setResult({ type: 'error', message: 'メールの送信に失敗しました。しばらくしてから再度お試しください' });
    } else {
      // Supabase はメール列挙防止のため存在しないアドレスでも error を返さない
      setResult({ type: 'success', message: 'パスワードリセットのご案内を送信しました。メール内のリンクをクリックしてパスワードを再設定してください。\n\nしばらくしてもメールが届かない場合、登録済みのメールアドレスかどうかをご確認ください。' });
    }
  }

  async function doUpdatePassword() {
    if (!newPassword || !passwordConfirm || loading) return;
    const pwError = validatePassword(newPassword);
    if (pwError) { setResult({ type: 'error', message: pwError }); return; }
    if (newPassword !== passwordConfirm) {
      setResult({ type: 'error', message: 'パスワードが一致しません' }); return;
    }
    setLoading(true);
    setResult(null);
    const { error } = await onUpdatePassword(newPassword);
    setLoading(false);
    if (error) {
      console.warn('[AuthModal] updatePassword error:', error);
      setResult({ type: 'error', message: 'パスワードの更新に失敗しました。もう一度お試しください' });
    } else {
      setResult({ type: 'success', message: 'パスワードを更新しました。' });
    }
  }

  // ---- login ----
  if (view === 'login') {
    return (
      <Modal
        title="ログイン"
        onClose={onClose}
        footer={
          <button
            className="btn btn-primary btn-sm"
            onClick={doLogin}
            disabled={loading || !email.trim() || !password}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        }
      >
        <form onSubmit={e => { e.preventDefault(); doLogin(); }} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" autoFocus disabled={loading} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>パスワード</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="パスワード" disabled={loading} />
          </div>
          <ResultMsg result={result} />
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem',paddingTop:'0.5rem',borderTop:'1px solid var(--border,#e5e5e5)'}}>
            <button type="button" className="btn btn-ghost btn-sm" style={{fontSize:'0.8rem',color:'var(--accent,#7c4fc4)',textDecoration:'underline',textUnderlineOffset:'3px',padding:'0.2rem 0',textAlign:'left',justifyContent:'flex-start'}} onClick={() => changeView('signup')}>
              新規登録はこちら
            </button>
            <button type="button" className="btn btn-ghost btn-sm" style={{fontSize:'0.8rem',color:'var(--accent,#7c4fc4)',textDecoration:'underline',textUnderlineOffset:'3px',padding:'0.2rem 0',textAlign:'left',justifyContent:'flex-start'}} onClick={() => changeView('reset')}>
              パスワードを忘れた方はこちら
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // ---- signup ----
  if (view === 'signup') {
    return (
      <Modal
        title="新規登録"
        onClose={onClose}
        footer={
          <div style={{display:'flex',gap:'0.5rem',width:'100%'}}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => changeView('login')} disabled={loading}>
              ログインに戻る
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{flex:1}}
              onClick={doSignUp}
              disabled={loading || !email.trim() || !password || !passwordConfirm}
            >
              {loading ? '登録中...' : '登録する'}
            </button>
          </div>
        }
      >
        <form onSubmit={e => { e.preventDefault(); doSignUp(); }} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" autoFocus disabled={loading} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>パスワード（6〜64文字、英小文字・数字を含む）</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="例: abc123" disabled={loading} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>パスワード（確認）</label>
            <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} placeholder="もう一度入力" disabled={loading} />
          </div>
          <ResultMsg result={result} />
        </form>
      </Modal>
    );
  }

  // ---- password reset ----
  if (view === 'reset') {
    return (
      <Modal
        title="パスワードのリセット"
        onClose={onClose}
        footer={
          <div style={{display:'flex',gap:'0.5rem',width:'100%'}}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => changeView('login')} disabled={loading}>
              戻る
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{flex:1}}
              onClick={doResetPassword}
              disabled={loading || !email.trim()}
            >
              {loading ? '送信中...' : 'パスワードをリセットする'}
            </button>
          </div>
        }
      >
        <form onSubmit={e => { e.preventDefault(); doResetPassword(); }} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <p style={{fontSize:'0.85rem',color:'var(--ink-muted,rgba(0,0,0,0.6))',lineHeight:1.6,margin:0}}>
            登録済みのメールアドレスにパスワードリセットのご案内を送信します。<br/>
            メールアドレスを入力して「パスワードをリセットする」をクリックしてください。
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" autoFocus disabled={loading} />
          </div>
          <ResultMsg result={result} />
        </form>
      </Modal>
    );
  }

  // ---- update password (PASSWORD_RECOVERY) ----
  if (view === 'update_password') {
    return (
      <Modal
        title="新しいパスワードを設定"
        onClose={onClose}
        footer={
          <button
            className="btn btn-primary btn-sm"
            onClick={doUpdatePassword}
            disabled={loading || !newPassword || !passwordConfirm}
          >
            {loading ? '更新中...' : 'パスワードを更新する'}
          </button>
        }
      >
        <form onSubmit={e => { e.preventDefault(); doUpdatePassword(); }} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <p style={{fontSize:'0.85rem',color:'var(--ink-muted,rgba(0,0,0,0.6))',lineHeight:1.6,margin:0}}>
            新しいパスワードを入力してください。<br/>
            6〜64文字で、半角英字（小文字）と数字を各1文字以上含めてください。
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>新しいパスワード</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="例: abc123" autoFocus disabled={loading} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>パスワード（確認）</label>
            <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} placeholder="もう一度入力" disabled={loading} />
          </div>
          <ResultMsg result={result} />
        </form>
      </Modal>
    );
  }

  // ---- account (logged in) ----
  return (
    <Modal
      title="アカウント"
      onClose={onClose}
      footer={
        <button className="btn btn-ghost btn-sm" onClick={onSignOut} style={{color:'var(--danger,#c93535)'}}>
          ログアウト
        </button>
      }
    >
      <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
          <span style={{fontSize:'0.8rem',color:inkMuted}}>ログイン中</span>
          <span style={{fontSize:'0.95rem',wordBreak:'break-all'}}>{user.email}</span>
        </div>

        {/* DB復元 */}
        <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',paddingTop:'0.5rem',borderTop:'1px solid var(--border,#e5e5e5)'}}>
          <button className="btn btn-outline btn-sm" onClick={onRestoreFromDB}>
            DBからイベントを復元
          </button>
        </div>

        {/* Supabase 同期 */}
        {eventCount > 0 && (
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
            <span style={{fontSize:'0.8rem',color:inkMuted}}>
              ローカルイベント: {eventCount} 件
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={onSync}
              disabled={syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? '同期中...' : 'Supabase に同期'}
            </button>
            {syncResult && (
              <div style={{
                padding:'0.5rem 0.625rem', borderRadius:'6px', fontSize:'0.8rem', lineHeight:1.5,
                background: syncResult.failed === 0 ? 'rgba(76,175,130,0.12)' : syncResult.succeeded === 0 ? 'rgba(201,53,53,0.1)' : 'rgba(230,180,0,0.1)',
                color: syncResult.failed === 0 ? '#2e7d5e' : syncResult.succeeded === 0 ? 'var(--danger,#c93535)' : '#7a5c00',
              }}>
                {syncResult.failed === 0
                  ? `${syncResult.succeeded} 件を同期しました`
                  : syncResult.succeeded === 0
                    ? `同期に失敗しました。ネットワーク接続を確認してください`
                    : `${syncResult.succeeded} 件同期しました（${syncResult.failed} 件失敗）`}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
