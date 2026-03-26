// src/components/AuthModal.jsx
// Magic Link ログイン UI — 第3段階
// ロジックは App.jsx 側に置き、このコンポーネントは表示のみを担う。
import Modal from './Modal.jsx';

export default function AuthModal({ user, email, setEmail, sending, result, onSend, onSignOut, onClose }) {
  function handleSubmit(e) {
    e.preventDefault();
    if (!sending && email.trim()) onSend();
  }

  return (
    <Modal
      title={user ? 'アカウント' : 'ログイン'}
      onClose={onClose}
      footer={
        user ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onSignOut}
            style={{color:'var(--danger,#c93535)'}}
          >
            ログアウト
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={onSend}
            disabled={sending || !email.trim()}
          >
            {sending ? '送信中...' : 'Magic Link を送信'}
          </button>
        )
      }
    >
      {user ? (
        <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
          <span style={{fontSize:'0.8rem',color:'var(--ink-muted,rgba(0,0,0,0.45))'}}>ログイン中</span>
          <span style={{fontSize:'0.95rem',wordBreak:'break-all'}}>{user.email}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            <label style={{fontSize:'0.8rem',fontWeight:600}}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoFocus
              disabled={sending}
            />
          </div>
          {result && (
            <div style={{
              padding:'0.625rem 0.75rem',
              borderRadius:'6px',
              fontSize:'0.8rem',
              lineHeight:1.5,
              background: result.type === 'success'
                ? 'rgba(76,175,130,0.12)'
                : 'rgba(201,53,53,0.1)',
              color: result.type === 'success'
                ? '#2e7d5e'
                : 'var(--danger,#c93535)',
            }}>
              {result.message}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
