// src/components/AppFooter.jsx
export default function AppFooter({ className = '' }) {
  return (
    <footer className={`app-footer ${className}`.trim()}>
      <div className="app-footer-links">
        <a href="#terms">利用規約</a>
        <span aria-hidden="true">|</span>
        <a href="#privacy">プライバシーポリシー</a>
      </div>
      <p className="app-footer-copy">©2026 DaC Kogure. All rights reserved.</p>
    </footer>
  );
}
