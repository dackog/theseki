// src/reducer.js
// CDN 版からのコピー (docs/index.html 行 1354-1357, 2977-3044)
// 将来の Supabase 移行時: 各アクションに楽観的更新 + DB sync を追加するポイント

import { uid, now } from './lib/uid.js';
import { sanitizeEvent } from './lib/storage.js';

export const DEFAULT_STATE = {
  events: [],
  currentEventId: null,
};

export function reducer(state, action) {
  const touch = (events, eventId) => events.map(e=>e.id===eventId?{...e, updatedAt:now()}:e);
  const updEvent = (id, fn) => ({
    ...state,
    events: touch(state.events.map(e => e.id===id ? sanitizeEvent(fn(e)) : e), id)
  });

  switch (action.type) {
    case 'SET_STATE': return action.payload;
    case 'ADD_EVENT': return {...state, events:[...state.events, sanitizeEvent({...action.payload, tables:[], attendees:[], ngPairs:[], assignments:{}, lockedAttendees:{}})], currentEventId: action.payload.id };
    case 'UPDATE_EVENT': return {
      ...state,
      events: state.events.map(e => e.id===action.payload.id
        ? sanitizeEvent({...e, name: action.payload.name, datetime: action.payload.datetime, updatedAt: now()})
        : e)
    };
    case 'DELETE_EVENT': return {...state, events:state.events.filter(e=>e.id!==action.payload), currentEventId: state.currentEventId===action.payload?null:state.currentEventId};
    case 'DUPLICATE_EVENT': {
      const src = state.events.find(e=>e.id===action.payload.src.id);
      if (!src) return state;
      const newId = action.payload.newId;
      const clone = sanitizeEvent({...src, id:newId, name:src.name+' (コピー)', createdAt:now(), updatedAt:now(),
        tables:src.tables.map(t=>({...t,id:uid(),eventId:newId})),
        attendees:src.attendees.map(a=>({...a,id:uid(),eventId:newId})),
        ngPairs:[], assignments:{}, lockedAttendees:{}});
      return {...state, events:[...state.events, clone]};
    }
    case 'IMPORT_EVENT': {
      const ev = sanitizeEvent({...action.payload, updatedAt:now()});
      return {...state, events:[...state.events, ev], currentEventId: ev.id};
    }
    case 'SET_CURRENT': return {...state, currentEventId: action.payload};

    case 'UPDATE_EVENT_FIELD': return updEvent(action.eventId, e=>({...e, [action.key]: action.val}));

    case 'ADD_TABLE': return updEvent(action.eventId, e=>({...e, tables:[...( e.tables||[]), action.payload]}));
    case 'DEL_TABLE': return updEvent(action.eventId, e=>({...e, tables:(e.tables||[]).filter(t=>t.id!==action.tableId)}));
    case 'UPDATE_TABLE': return updEvent(action.eventId, e=>({...e, tables:(e.tables||[]).map(t=>t.id===action.tableId?{...t,[action.key]:action.val}:t)}));
    case 'MOVE_TABLE_POS': return updEvent(action.eventId, e=>({...e, tables:(e.tables||[]).map(t=>t.id===action.tableId?{...t,posX:action.posX,posY:action.posY}:t)}));
    case 'MOVE_TABLE': return updEvent(action.eventId, e=>{
      const ts=[...(e.tables||[])];
      const {idx,dir}=action;
      const ni=idx+dir;
      if(ni<0||ni>=ts.length) return e;
      [ts[idx],ts[ni]]=[ts[ni],ts[idx]];
      return {...e,tables:ts};
    });

    case 'ADD_ATTENDEE': return updEvent(action.eventId, e=>({...e, attendees:[...(e.attendees||[]), action.payload]}));
    case 'UPDATE_ATTENDEE': return updEvent(action.eventId, e=>({...e, attendees:(e.attendees||[]).map(a=>a.id===action.id?{...a,...action.payload}:a)}));
    case 'DEL_ATTENDEE': return updEvent(action.eventId, e=>({...e, attendees:(e.attendees||[]).filter(a=>a.id!==action.id), assignments:Object.fromEntries(Object.entries(e.assignments||{}).map(([k,v])=>[k,v===action.id?null:v])), lockedAttendees:Object.fromEntries(Object.entries(e.lockedAttendees||{}).filter(([k])=>k!==action.id))}));

    case 'ADD_NG': return updEvent(action.eventId, e=>({...e, ngPairs:[...(e.ngPairs||[]), action.payload]}));
    case 'DEL_NG': return updEvent(action.eventId, e=>({...e, ngPairs:(e.ngPairs||[]).filter(p=>p.id!==action.id)}));

    case 'ASSIGN': return updEvent(action.eventId, e=>({...e, assignments:{...(e.assignments||{}), [action.seatId]: action.attendeeId}}));
    case 'BATCH_ASSIGN': return updEvent(action.eventId, e=>({...e, assignments:{...(e.assignments||{}), ...action.updates}}));
    case 'CLEAR_ASSIGN': return updEvent(action.eventId, e=>({...e, assignments:{}, lockedAttendees:{}}));
    case 'SET_ATTENDEE_LOCK': return updEvent(action.eventId, e=>({
      ...e,
      lockedAttendees: action.locked
        ? {...(e.lockedAttendees||{}), [action.attendeeId]: true}
        : Object.fromEntries(Object.entries(e.lockedAttendees||{}).filter(([k])=>k!==action.attendeeId))
    }));

    case 'RESET_STATE': return { ...DEFAULT_STATE };
    default: return state;
  }
}
