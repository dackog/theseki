// src/main.jsx
// Vite エントリポイント
// CDN 版では index.html 末尾の ReactDOM.createRoot(...) が対応箇所
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
