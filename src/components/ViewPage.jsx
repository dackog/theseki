// src/components/ViewPage.jsx
// CDN 版からのコピー (docs/index.html 行 3050-3090)

import { useMemo } from 'react';
import { generateSeats } from '../lib/seats.js';

export default function ViewPage({ event }) {
  const tables = event.tables || [];
  const attendees = event.attendees || [];
  const assignments = event.assignments || {};
  const seats = useMemo(()=>generateSeats(tables.map(t=>({...t,eventId:event.id}))), [tables, event.id]);

  return (
    <div className="main">
      <div className="view-banner">
        👁 閲覧専用モード — <b style={{color:'var(--ink)'}}>{event.name}</b>
        {event.datetime && <span style={{marginLeft:'1rem'}}>📅 {event.datetime}</span>}
      </div>
      {tables.map(table => {
        const tableSeats = seats.filter(s=>s.tableId===table.id);
        return (
          <div key={table.id} className="table-assign-card" style={{marginBottom:'1rem'}}>
            <div className="table-assign-head">
              <div className="table-assign-head-name">{table.name}</div>
              <span className="stat-pill">{tableSeats.filter(s=>assignments[s.id]).length}/{table.seatCount}席</span>
            </div>
            <div className="seats-grid">
              {tableSeats.map(s => {
                const att = assignments[s.id] ? attendees.find(a=>a.id===assignments[s.id]) : null;
                return (
                  <div key={s.id} className={`seat-slot ${att?'filled':''}`} style={{cursor:'default'}}>
                    {att ? (
                      <>
                        <div className="seat-attendee-name">{att.name}</div>
                        {att.flags.length>0&&<div style={{fontSize:'0.62rem',color:'var(--green)'}}>{att.flags.join(' ')}</div>}
                      </>
                    ) : <div className="seat-id-label">{s.id}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
