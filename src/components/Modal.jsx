// src/components/Modal.jsx
// CDN 版からのコピー (docs/index.html 行 1404-1428)
import { useEffect } from 'react';

export default function Modal({ title, onClose, children, footer, modalClassName='' }) {
  useEffect(() => {
    const esc = e => { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`modal ${modalClassName}`.trim()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
