// src/main.jsx
// Vite エントリポイント
// CDN 版では index.html 末尾の ReactDOM.createRoot(...) が対応箇所
import { createRoot } from 'react-dom/client';
// import './index.css'; // Commit 2 で追加
// App は Commit 7 で実装。それまでは stub。
// import App from './App';

createRoot(document.getElementById('root')).render(
  <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
    <h1>TheSEKI — Vite 移行中</h1>
    <p>scaffold OK: npm run dev が通ることを確認してください。</p>
  </div>
);
