// src/components/TagInput.jsx
// CDN 版からのコピー (docs/index.html 行 1376-1399)
import { useState } from 'react';

export default function TagInput({ tags, onChange, placeholder="タグを入力してEnter" }) {
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setVal('');
  };
  return (
    <div className="tag-input-area" onClick={e => e.currentTarget.querySelector('input').focus()}>
      {tags.map(t => (
        <span key={t} className="tag">
          {t}
          <span className="tag-remove" onClick={()=>onChange(tags.filter(x=>x!==t))}>×</span>
        </span>
      ))}
      <input
        value={val} onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();add();} }}
        onBlur={add}
        placeholder={tags.length===0?placeholder:''}
      />
    </div>
  );
}
