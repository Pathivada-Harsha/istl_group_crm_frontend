// TaskManagement.js — Complete Task Management System v3
// Fixes: board drag→backend, SA own-tasks default, start/end datetime,
//        projects from DB, team view search+table+export, all edge cases
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer';
import CrmPreloader from '../components/preLoader';
import '../pages-css/TaskManagement.css';
import FilterSelect from '../components/Dropdowns/FilterSelect';
import { FiClipboard, FiCheckCircle, FiEdit, FiTrash2, FiPlus, FiZap, FiClock, FiBriefcase, FiTag, FiArrowRight, FiFileText, FiList, FiAlertTriangle } from 'react-icons/fi';

/* ── Inline-style theme mappers (added for dark mode) ── */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#f8f9fa':'#0f1420','#fafafa':'#0f1420','#fafcff':'#161b27','#f8fffe':'#161b27',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#e9eef5':'#2b3445',
  '#eff6ff':'#15243d','#f0f7ff':'#15243d','#dbeafe':'#1d3a5f','#bfdbfe':'#244b7a',
  '#ecfdf5':'#102a22','#f0fdf4':'#14301f','#dcfce7':'#14302a','#a7f3d0':'#2a5a40','#6ee7b7':'#2a5a40',
  '#fef2f2':'#2a1719','#fee2e2':'#3a1f22','#fff9f9':'#2b1d20','#fff7ed':'#2c2113','#fffbeb':'#2a2710','#fef3c7':'#3a3016',
  '#fca5a5':'#5a2a2e','#fecaca':'#3a1f22','#fff0f0':'#2b1d20','#fafffe':'#161b27','#f0f9ff':'#15243d',
  '#93c5fd':'#244b7a','#bae6fd':'#16344d','#a5f3fc':'#103038','#bbf7d0':'#2a5a40','#e9d5ff':'#2e2147',
  '#f5f3ff':'#241b3d','#eef2ff':'#1e1f45','#ecfeff':'#103038','#e0f2fe':'#16344d',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#a5b4fc':'#3a3d6a',
};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#7fe0bc','#059669':'#18c08a','#16a34a':'#2bc55e',
  '#b45309':'#f0c07a','#c2410c':'#fb923c','#92400e':'#f0c07a',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#dc2626':'#f05252',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#1e40af':'#5b9bf0','#0e7490':'#22d3ee','#3b82f6':'#5b9bf0',
  '#0369a1':'#38bdf8','#0891b2':'#22d3ee','#065f46':'#6ee7b7',
  '#7c3aed':'#a78bfa','#8b5cf6':'#b39bf7','#4338ca':'#a5b4fc','#4f46e5':'#8589f3','#6366f1':'#8589f3',
};
const bg = (v) => (__isDarkTheme() && __SM[v]) ? __SM[v] : v;
const tc = (v) => (__isDarkTheme() && __TM[v]) ? __TM[v] : v;
const useThemeVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};


const API = process.env.REACT_APP_API_URL;
const hdrs = (u) => ({
  'Content-Type': 'application/json',
  'User-Id': String(u?.id ?? ''),
  'User-Role': String(u?.role ?? ''),
});

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const todayStr   = () => new Date().toISOString().slice(0, 10);
const nowTime    = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const fmtDate    = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
const fmtDT      = d => d ? new Date(d).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const fmtTime    = t => t ? String(t).slice(0, 5) : '—';
const diffHrs    = (s, e) => { if (!s || !e) return null; const diff = (new Date(e) - new Date(s)) / 3600000; return diff > 0 ? diff.toFixed(1) : null; };

/* FIX #4: Always compute hours from updates array — never trust totalHoursSpent field */
const computeHours = (task) => (task?.updates || []).reduce((s, u) => s + (parseFloat(u.hoursSpent) || 0), 0);

const PRIORITIES    = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES      = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
const CATEGORIES    = ['Follow-up', 'Meeting', 'Call', 'Site Visit', 'Documentation', 'Proposal', 'Review', 'Discussion', 'Client Visit', 'Internal Work', 'Other'];
const UPDATE_TYPES  = ['Progress Update', 'Discussion', 'Issue Raised', 'Milestone Reached', 'Client Communication', 'Task Completed', 'Blocked', 'Other'];

const PRI = {
  Low:      { c: '#059669', bg: '#ecfdf5', br: '#6ee7b7' },
  Medium:   { c: '#d97706', bg: '#fffbeb', br: '#fcd34d' },
  High:     { c: '#dc2626', bg: '#fef2f2', br: '#fca5a5' },
  Critical: { c: '#7c3aed', bg: '#f5f3ff', br: '#c4b5fd' },
};
const STA = {
  'Pending':     { c: '#d97706', bg: '#fffbeb', icon: '⏳' },
  'In Progress': { c: '#2563eb', bg: '#eff6ff', icon: '🔄' },
  'Completed':   { c: '#059669', bg: '#ecfdf5', icon: '✅' },
  'Cancelled':   { c: '#6b7280', bg: '#f3f4f6', icon: '❌' },
};

const PBadge = ({ p }) => { const c = PRI[p] || PRI.Medium; return <span className="tm-badge" style={{ color: c.c, background: c.bg, borderColor: c.br }}>{p}</span>; };
const SBadge = ({ s }) => { const c = STA[s] || STA.Pending; return <span className="tm-sbadge" style={{ color: c.c, background: c.bg }}>{c.icon} {s}</span>; };

/* ── Excel/CSV Export ────────────────────────────────────────────────────── */
const exportCSV = (rows, filename) => {
  if (!rows.length) { alert('No data to export'); return; }
  const keys = Object.keys(rows[0]);
  const esc  = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv  = [keys.map(esc).join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ── API calls ───────────────────────────────────────────────────────────── */
/* apiCall helper kept for future use */
// const apiCall removed — use fetch directly

/* ── Mock data ───────────────────────────────────────────────────────────── */
const MOCK_PROJECTS = [
  { projectUniqueId: 'P001', projectName: 'Solar Plant – Hyderabad Phase 1' },
  { projectUniqueId: 'P002', projectName: 'EPC Rooftop – Vijayawada' },
  { projectUniqueId: 'P003', projectName: 'Ground Mount – Nellore 2MW' },
];
const mockTasks = (user) => {
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const tm = new Date(); tm.setDate(tm.getDate() + 3);
  return [
    { id: 1, taskCode: 'TSK-0001', title: 'Follow up with Raju Solar – site visit confirmation', category: 'Follow-up', priority: 'High', status: 'In Progress', startDate: yd.toISOString(), endDate: new Date().toISOString(), dueDate: todayStr(), assignedTo: user?.id, assignedToName: user?.name || 'You', createdBy: user?.id, createdByName: user?.name, relatedTo: 'Lead: Raju Solar Pvt Ltd', projectId: 'P001', projectName: 'Solar Plant – Hyderabad Phase 1', completionPercent: 40, startedAt: yd.toISOString(), closedAt: null, totalHoursSpent: 2.5, estimatedHours: 4, createdAt: yd.toISOString(), updates: [{ id: 1, updatedByName: user?.name, updatedAt: yd.toISOString(), workDone: 'Called customer, confirmed interest in solar rooftop', updateType: 'Progress Update', hoursSpent: 1.5, startTime: '09:00', endTime: '10:30', newStatus: 'In Progress', statusChanged: false, notes: 'Customer asked to call back after 2 days' }] },
    { id: 2, taskCode: 'TSK-0002', title: 'Prepare 50kW solar proposal for ABC Industries', category: 'Proposal', priority: 'Critical', status: 'In Progress', startDate: new Date().toISOString(), endDate: null, dueDate: todayStr(), assignedTo: user?.id, assignedToName: user?.name, createdBy: user?.id, createdByName: user?.name, relatedTo: 'Lead: ABC Industries', projectId: 'P002', projectName: 'EPC Rooftop – Vijayawada', completionPercent: 60, startedAt: new Date().toISOString(), closedAt: null, totalHoursSpent: 3.0, estimatedHours: 5, createdAt: yd.toISOString(), updates: [] },
    { id: 3, taskCode: 'TSK-0003', title: 'Review Q4 procurement quotations', category: 'Review', priority: 'Medium', status: 'Pending', startDate: null, endDate: null, dueDate: tm.toISOString().slice(0, 10), assignedTo: user?.id, assignedToName: user?.name, createdBy: user?.id, createdByName: user?.name, relatedTo: '', projectId: null, projectName: null, completionPercent: 0, startedAt: null, closedAt: null, totalHoursSpent: 0, estimatedHours: 2, createdAt: yd.toISOString(), updates: [] },
    { id: 4, taskCode: 'TSK-0004', title: 'Client handover meeting – Greentech Solutions', category: 'Meeting', priority: 'High', status: 'Completed', startDate: yd.toISOString(), endDate: new Date().toISOString(), dueDate: yd.toISOString().slice(0, 10), assignedTo: user?.id, assignedToName: user?.name, createdBy: user?.id, createdByName: user?.name, relatedTo: 'Client: Greentech Solutions', projectId: 'P003', projectName: 'Ground Mount – Nellore 2MW', completionPercent: 100, startedAt: yd.toISOString(), closedAt: new Date().toISOString(), totalHoursSpent: 2.0, estimatedHours: 2, createdAt: yd.toISOString(), updates: [{ id: 2, updatedByName: user?.name, updatedAt: new Date().toISOString(), workDone: 'Meeting completed. Handed over all project documents and drawings to client team.', updateType: 'Task Completed', hoursSpent: 2.0, startTime: '14:00', endTime: '16:00', newStatus: 'Completed', statusChanged: true, notes: 'Client signed off on all deliverables' }] },
  ];
};

/* ══════════════════════════════════════════════════════════════════════════
   REUSABLE PICKERS
══════════════════════════════════════════════════════════════════════════ */
const _MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/* TimePicker — direct <input type="time"> that fires onChange immediately.
   No popover, no Save button, no extra click needed. */
const TimePicker = ({ value, onChange }) => (
  <input
    type="time"
    className="tm-time-direct"
    value={value || ''}
    onChange={e => onChange(e.target.value)}
  />
);


/* DatePicker — date only */
const DatePicker = ({ value, onChange, placeholder='Select date' }) => {
  const [show, setShow] = useState(false);
  const [calMo, setCalMo] = useState(() => value?parseInt(value.slice(5,7))-1:new Date().getMonth());
  const [calYr, setCalYr] = useState(() => value?parseInt(value.slice(0,4)):new Date().getFullYear());
  const [showYrDP, setShowYrDP] = useState(false);
  const [pos,   setPos]   = useState({top:0,left:0,width:260});
  const trRef = useRef(null), dpRef = useRef(null);
  useEffect(() => {
    const h = e => { if (trRef.current&&!trRef.current.contains(e.target)&&dpRef.current&&!dpRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);
  const open = () => {
    if (value){setCalMo(parseInt(value.slice(5,7))-1);setCalYr(parseInt(value.slice(0,4)));}
    if (trRef.current){const r=trRef.current.getBoundingClientRect();const dH=310;const up=window.innerHeight-r.bottom<dH&&r.top>dH;setPos({top:up?r.top-dH-4:r.bottom+4,left:r.left,width:Math.max(r.width,260)});}
    setShow(true);
  };
  const DIM=new Date(calYr,calMo+1,0).getDate(),FD=new Date(calYr,calMo,1).getDay(),tod=new Date().toISOString().slice(0,10);
  const fmtD=d=>{if(!d)return null;const[y,m,dy]=d.split('-');return`${dy}-${m}-${y}`;};
  return (
    <>
      <button ref={trRef} type="button" className={`tm-dtp-trigger${show?' tm-dtp--open':''}${value?' tm-dtp--set':''}`} onClick={show?()=>setShow(false):open}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0,color:value?tc('#4f46e5'):tc('#94a3b8')}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        {value?<span style={{flex:1,fontSize:13,fontWeight:600,color:tc('#0f172a')}}>{fmtD(value)}</span>:<span className="tm-dtp-ph">{placeholder}</span>}
        {value?<span className="tm-dtp-x" onClick={e=>{e.stopPropagation();onChange('');}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></span>
        :<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginLeft:'auto',color:tc('#94a3b8'),transform:show?'rotate(180deg)':'none',transition:'transform .2s',flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>}
      </button>
      {show&&(
        <div ref={dpRef} className="tm-dtp-dropdown" style={{position:'fixed',top:pos.top,left:pos.left,width:pos.width,zIndex:9999}}>
          <div className="tm-dtp-cal-head">
            <button type="button" className="tm-cal-nav" onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
            <button type="button" className="tm-dtp-month" onClick={()=>setShowYrDP(p=>!p)}>{_MONTHS[calMo]} <span className="tm-yr-num">{calYr}</span></button>
            <button type="button" className="tm-cal-nav" onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button>
          </div>
          {showYrDP?(
            <div className="tm-yr-grid">{Array.from({length:16},(_,i)=>{const yr=new Date().getFullYear()-4+i;return<div key={yr} className={`tm-yr-cell${yr===calYr?' tm-yr-sel':''}`} onClick={()=>{setCalYr(yr);setShowYrDP(false);}}>{yr}</div>;})}</div>
          ):(
          <div className="tm-dtp-grid">
            {_DAYS.map(d=><div key={d} className="tm-cal-dl">{d}</div>)}
            {Array.from({length:FD}).map((_,i)=><div key={`e${i}`} className="tm-cal-cell tm-cal-empty"/>)}
            {Array.from({length:DIM}).map((_,i)=>{const dy=i+1;const ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;let cls='tm-cal-cell';if(ds===value)cls+=' tm-dtp-sel';else if(ds===tod)cls+=' tm-cal-today';return<div key={ds} className={cls} onClick={()=>{onChange(ds);setShow(false);}}>{dy}</div>;})}
          </div>
          )}
        </div>
      )}
    </>
  );
};

/* DateTimePicker — date + time, z-index:9999 above modal */
const DateTimePicker = ({ value, onChange, placeholder='Select date & time' }) => {
  const [show,   setShow]   = useState(false);
  const [pos,    setPos]    = useState({top:0,left:0,width:300});
  const [tmpD,   setTmpD]   = useState('');
  const [tmpT,   setTmpT]   = useState('');
  const [calMo,  setCalMo]  = useState(new Date().getMonth());
  const [calYr,  setCalYr]  = useState(new Date().getFullYear());
  const [showYrDT, setShowYrDT] = useState(false);
  const wRef=useRef(null), tRef=useRef(null);
  const open = () => {
    setTmpD(value?value.slice(0,10):''); setTmpT(value?value.slice(11,16):'');
    if(value){setCalMo(parseInt(value.slice(5,7))-1);setCalYr(parseInt(value.slice(0,4)));}
    if(wRef.current){const r=wRef.current.getBoundingClientRect();const dH=420;const up=window.innerHeight-r.bottom<dH&&r.top>dH;setPos({top:up?r.top-dH-4:r.bottom+4,left:r.left,width:Math.max(r.width,300)});}
    setShow(true);
  };
  useEffect(()=>{
    const h=e=>{if(wRef.current&&!wRef.current.contains(e.target)){setShow(false);}};
    if(show)document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[show]);
  const DIM=new Date(calYr,calMo+1,0).getDate(),FD=new Date(calYr,calMo,1).getDay(),tod=new Date().toISOString().slice(0,10);
  const fmtDisp=()=>{if(!value)return null;const[d,t]=value.split('T');if(!d)return null;const[y,mo,dy]=d.split('-');const ts=t?(()=>{const[h,m]=t.split(':');const hr=parseInt(h,10);return`${hr%12===0?12:hr%12}:${String(m).padStart(2,'0')} ${hr>=12?'PM':'AM'}`})():'';return{date:`${dy}-${mo}-${y}`,time:ts};};
  const disp=fmtDisp();
  return (
    <div ref={wRef}>
      <button type="button" className={`tm-dtp-trigger${show?' tm-dtp--open':''}${value?' tm-dtp--set':''}`} onClick={show?()=>{setShow(false);}:open}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0,color:value?tc('#4f46e5'):tc('#94a3b8')}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        {disp?(<span className="tm-dtp-val"><span className="tm-dtp-date">{disp.date}</span>{disp.time&&<span className="tm-dtp-time">{disp.time}</span>}</span>):(<span className="tm-dtp-ph">{placeholder}</span>)}
        {value?<span className="tm-dtp-x" onClick={e=>{e.stopPropagation();onChange('');setShow(false);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></span>
        :<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginLeft:'auto',color:tc('#94a3b8'),flexShrink:0,transform:show?'rotate(180deg)':'none',transition:'transform .2s'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>}
      </button>
      {show&&(
        <div className="tm-dtp-dropdown" style={{position:'fixed',top:pos.top,left:pos.left,width:pos.width,zIndex:9999}}>
          <div className="tm-dtp-cal-head">
            <button type="button" className="tm-cal-nav" onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
            <button type="button" className="tm-dtp-month" onClick={()=>setShowYrDT(p=>!p)}>{_MONTHS[calMo]} <span className="tm-yr-num">{calYr}</span></button>
            <button type="button" className="tm-cal-nav" onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button>
          </div>
          {showYrDT?(
            <div className="tm-yr-grid">{Array.from({length:16},(_,i)=>{const yr=new Date().getFullYear()-4+i;return<div key={yr} className={`tm-yr-cell${yr===calYr?' tm-yr-sel':''}`} onClick={()=>{setCalYr(yr);setShowYrDT(false);}}>{yr}</div>;})}</div>
          ):(
          <div className="tm-dtp-grid">
            {_DAYS.map(d=><div key={d} className="tm-cal-dl">{d}</div>)}
            {Array.from({length:FD}).map((_,i)=><div key={`e${i}`} className="tm-cal-cell tm-cal-empty"/>)}
            {Array.from({length:DIM}).map((_,i)=>{const dy=i+1;const ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;let cls='tm-cal-cell';if(ds===tmpD)cls+=' tm-dtp-sel';else if(ds===tod)cls+=' tm-cal-today';return<div key={ds} className={cls} onClick={()=>setTmpD(ds)}>{dy}</div>;})}
          </div>
          )}
          <div className="tm-dtp-time-row" style={{cursor:'pointer'}} onClick={()=>{if(tRef.current){try{tRef.current.showPicker();}catch(_){tRef.current.focus();}}}}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:tc('#6366f1'),flexShrink:0}}><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
            <span className="tm-dtp-time-lbl">Time</span>
            <input ref={tRef} type="time" className="tm-dtp-time-inp" value={tmpT} style={{cursor:'pointer'}}
              onClick={e=>{e.stopPropagation();try{e.target.showPicker();}catch(_){}}}
              onChange={e=>{const nv=e.target.value;const prev=tmpT;setTmpT(nv);if(nv&&nv.length===5&&prev&&prev.length===5&&nv.split(':')[0]===prev.split(':')[0]){tRef.current&&tRef.current.blur();}}}/>
          </div>
          <div className="tm-dtp-footer">
            <div className="tm-dtp-chips">
              <span className={`tm-cal-chip${tmpD?' tm-cal-chip--set':''}`}>{tmpD?(()=>{const[y,m,d]=tmpD.split('-');return`${d}-${m}-${y}`;})():'Date —'}</span>
              {tmpT&&<><svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg><span className="tm-cal-chip tm-cal-chip--set">{(()=>{const[h,m]=tmpT.split(':');const hr=parseInt(h,10);return`${hr%12===0?12:hr%12}:${String(m).padStart(2,'0')} ${hr>=12?'PM':'AM'}`})()}</span></>}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'center',width:'100%'}}>
              <button type="button" className="tm-cal-clear" onClick={()=>{setShow(false);}}>Cancel</button>
              <button type="button" className="tm-cal-apply" onClick={()=>{onChange(tmpD?tmpD+'T'+(tmpT||'00:00'):'');setShow(false);}} disabled={!tmpD}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* DateRangeFilter — replaces From/To native date inputs in filter bar */
const DateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  const [show,  setShow]  = useState(false);
  const [from,  setFrom]  = useState(null);
  const [to,    setTo]    = useState(null);
  const [hover, setHover] = useState(null);
  const [calMo, setCalMo] = useState(new Date().getMonth());
  const [calYr, setCalYr] = useState(new Date().getFullYear());
  const [showYrDR, setShowYrDR] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShow(false);};
    if(show)document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[show]);
  const DIM=new Date(calYr,calMo+1,0).getDate(),FD=new Date(calYr,calMo,1).getDay(),tod=new Date().toISOString().slice(0,10);
  const inRange=d=>{const hi=to||(from&&hover?hover:null);if(!from||!hi)return false;const[a,b]=from<=hi?[from,hi]:[hi,from];return d>a&&d<b;};
  const clickDay=d=>{if(!from||(from&&to)){setFrom(d);setTo(null);}else if(d<from){setFrom(d);setTo(null);}else if(d===from){setFrom(null);setTo(null);}else setTo(d);};
  const fmtC=d=>{if(!d)return'';const[y,m,dy]=d.split('-');return`${dy}-${m}-${y}`;};
  return (
    <div ref={ref} style={{position:'relative',display:'inline-flex'}}>
      <button type="button" className={`tm-cal-trigger${show?' tm-cal-trigger--open':''}${appliedFrom?' tm-cal-trigger--applied':''}`} onClick={()=>setShow(p=>!p)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <span className={appliedFrom?'tm-cal-val':'tm-cal-ph'}>{appliedFrom?fmtC(appliedFrom):'dd-mm-yyyy'}</span>
        <span className="tm-cal-sep">—</span>
        <span className={appliedTo&&appliedTo!==appliedFrom?'tm-cal-val':'tm-cal-ph'}>{appliedTo&&appliedTo!==appliedFrom?fmtC(appliedTo):'dd-mm-yyyy'}</span>
        {appliedFrom&&<span className="tm-cal-x" onClick={e=>{e.stopPropagation();setFrom(null);setTo(null);onClear();}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></span>}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginLeft:'auto',color:tc('#94a3b8'),flexShrink:0,transform:show?'rotate(180deg)':'none',transition:'transform .2s'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {show&&(
        <div className="tm-cal-dropdown" style={{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:9999,width:264}}>
          <div className="tm-dtp-cal-head">
            <button type="button" className="tm-cal-nav" onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
            <button type="button" className="tm-dtp-month" onClick={()=>setShowYrDR(p=>!p)}>{_MONTHS[calMo]} <span className="tm-yr-num">{calYr}</span></button>
            <button type="button" className="tm-cal-nav" onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button>
          </div>
          {showYrDR ? (
            <div className="tm-yr-grid">{Array.from({length:16},(_,i)=>{const yr=new Date().getFullYear()-4+i;return<div key={yr} className={`tm-yr-cell${yr===calYr?' tm-yr-sel':''}`} onClick={()=>{setCalYr(yr);setShowYrDR(false);}}>{yr}</div>;})}</div>
          ) : (
          <div className="tm-dtp-grid">
            {_DAYS.map(d=><div key={d} className="tm-cal-dl">{d}</div>)}
            {Array.from({length:FD}).map((_,i)=><div key={`e${i}`} className="tm-cal-cell tm-cal-empty"/>)}
            {Array.from({length:DIM}).map((_,i)=>{const dy=i+1;const ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;const dow=(FD+i)%7;let cls='tm-cal-cell';if(ds===from)cls+=' tm-cal-from';else if(ds===to)cls+=' tm-cal-to';else if(inRange(ds)){cls+=' tm-cal-in-range';if(dow===0)cls+=' tm-cal-rr-s';if(dow===6)cls+=' tm-cal-rr-e';}if(ds===tod&&ds!==from&&ds!==to)cls+=' tm-cal-today';return<div key={ds} className={cls} onClick={()=>clickDay(ds)} onMouseEnter={()=>from&&!to&&setHover(ds)} onMouseLeave={()=>setHover(null)}>{dy}</div>;})}
          </div>
          )}
          <div className="tm-dtp-footer">
            <div className="tm-dtp-chips">
              <span className={`tm-cal-chip${from?' tm-cal-chip--set':''}`}>{from?fmtC(from):'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
              <span className={`tm-cal-chip${to?' tm-cal-chip--set':''}`}>{to?fmtC(to):'To —'}</span>
            </div>
            <div style={{display:'flex',gap:6,justifyContent:'center',width:'100%'}}>
              {(from||appliedFrom)&&<button type="button" className="tm-cal-clear" onClick={()=>{setFrom(null);setTo(null);onClear();setShow(false);}}>Clear</button>}
              <button type="button" className="tm-cal-clear" onClick={()=>setShow(false)}>Cancel</button>
              <button type="button" className="tm-cal-apply" onClick={()=>{if(!from)return;onApply(from,to||from);setShow(false);}} disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   WORK ENTRY MODAL (formerly DailyLogModal)
   — rich description, time tracking, status change
══════════════════════════════════════════════════════════════════════════ */
const DailyLogModal = ({ task, onClose, onSave }) => {
  const [form, setForm] = useState({
    workDone: '', description: '', updateType: 'Progress Update', hoursSpent: '',
    startTime: nowTime(), endTime: '', newStatus: task.status,
    completionPercent: task.completionPercent || 0, blockedReason: '', notes: '',
    logDate: todayStr(),  // user-selectable date for the log entry
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (form.startTime && form.endTime) {
      const [sh, sm] = form.startTime.split(':').map(Number);
      const [eh, em] = form.endTime.split(':').map(Number);
      const h = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      if (h > 0) set('hoursSpent', h.toFixed(1));
    }
  }, [form.startTime, form.endTime]);

  const submit = async () => {
    // Allow saving if work summary is filled OR status/progress changed — no hard block
    setSaving(true);
    const combined = form.description.trim()
      ? `${form.workDone.trim()}${form.workDone.trim() ? '\n\n' : ''}${form.description.trim()}`
      : form.workDone.trim();
    await onSave({ taskId: task.id, ...form, workDone: combined || '(Status/progress updated)', hoursSpent: parseFloat(form.hoursSpent) || 0 });
    setSaving(false);
  };

  // Button is enabled when: work summary filled, OR status changed, OR progress changed
  const hasChanges = form.workDone.trim() !== ''
    || form.newStatus !== task.status
    || form.completionPercent !== (task.completionPercent || 0);

  const isComplete = form.newStatus === 'Completed';

  return (
    <div className="tm-overlay">
      <div className="tm-modal tm-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="tm-mhdr">
          <div>
            <h2><FiClipboard size={18} style={{marginRight:8}} />Add Work Entry</h2>
            <p className="tm-msub">Describe what you did on this task — be as detailed as possible</p>
          </div>
          <button className="tm-xbtn" onClick={onClose}>✕</button>
        </div>

        {/* Task context strip */}
        <div className="tm-mtask-strip">
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span className="tm-tcode">{task.taskCode}</span>
            <strong style={{fontSize:14,color:tc('#0f172a')}}>{task.title}</strong>
          </div>
          <div className="tm-strip-row" style={{marginTop:6}}>
            <PBadge p={task.priority} />
            <span className="tm-chip">📁 {task.category}</span>
            {task.projectName && <span className="tm-chip tm-chip-blue"><FiBriefcase size={11} style={{marginRight:3}} />{task.projectName}</span>}
            {task.relatedTo && <span className="tm-chip" style={{color:tc('#7c3aed'),background:bg('#f5f3ff')}}>↳ {task.relatedTo}</span>}
          </div>
        </div>

        <div className="tm-mbody">
          {/* ── Log Date ── */}
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14,padding:'10px 14px',background:bg('#f0f7ff'),borderRadius:8,border:`1px solid ${bg('#bfdbfe')}`}}>
            <label style={{fontSize:12,fontWeight:700,color:tc('#1e40af'),whiteSpace:'nowrap'}}>📅 Log Date</label>
            <input type="date" className="tm-inp" style={{maxWidth:180,fontSize:13}}
              value={form.logDate}
              max={todayStr()}
              onChange={e => set('logDate', e.target.value)}
            />
            <span style={{fontSize:11,color:tc('#64748b')}}>
              {form.logDate === todayStr() ? 'Today' : form.logDate < todayStr() ? 'Past entry' : ''}
            </span>
          </div>

          {/* ── Section 1: What you did ── */}
          <div style={{background:bg('#f8fafc'),borderRadius:10,padding:'14px 16px',marginBottom:16,border:`1px solid ${bg('#f1f5f9')}`}}>
            <div className="tm-fg" style={{margin:'0 0 12px'}}>
              <label style={{fontWeight:700,color:tc('#0f172a'),fontSize:13}}>
                Work Summary
                <span style={{fontWeight:400,color:tc('#94a3b8'),fontSize:11,marginLeft:6}}>One line — what did you work on? (optional if status/progress changed)</span>
              </label>
              <input
                className="tm-inp"
                placeholder="e.g. Called client, completed proposal draft, attended site meeting..."
                value={form.workDone}
                onChange={e => set('workDone', e.target.value)}
                style={{fontSize:14}}
              />
            </div>
            <div className="tm-fg" style={{margin:0}}>
              <label style={{fontWeight:700,color:tc('#0f172a'),fontSize:13}}>
                Detailed Description
                <span style={{fontWeight:400,color:tc('#94a3b8'),fontSize:11,marginLeft:6}}>What exactly happened? Include outcomes, discussions, decisions</span>
              </label>
              <textarea
                className="tm-ta"
                rows={5}
                placeholder={`Describe in detail what you worked on:\n• What actions did you take?\n• What was the outcome or result?\n• Any discussions or decisions made?\n• What is the next step?`}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                style={{fontSize:13,lineHeight:1.6,fontFamily:'inherit'}}
              />
              {form.description.length > 0 && (
                <div style={{fontSize:10,color:tc('#94a3b8'),textAlign:'right',marginTop:2}}>{form.description.length} chars</div>
              )}
            </div>
          </div>

          {/* ── Section 2: Status & Progress ── */}
          <div className="tm-frow" style={{marginBottom:12}}>
            <div className="tm-fg">
              <label>Entry Type</label>
              <FilterSelect value={form.updateType} onChange={v => set('updateType', v)} options={UPDATE_TYPES.map(t=>({value:t,label:t}))} placeholder="Select Type" />
            </div>
            <div className="tm-fg">
              <label>Update Status To</label>
              <FilterSelect value={form.newStatus} onChange={v => { set('newStatus', v); if(v==='Completed') set('completionPercent',100); }} options={STATUSES.map(s=>({value:s,label:s}))} placeholder="Select Status" />
            </div>
          </div>

          {/* ── Section 3: Time ── */}
          <div className="tm-frow tm-frow3" style={{marginBottom:12}}>
            <div className="tm-fg">
              <label>Start Time</label>
              <TimePicker value={form.startTime} onChange={v => set('startTime', v)} />
            </div>
            <div className="tm-fg">
              <label>End Time</label>
              <TimePicker value={form.endTime} onChange={v => set('endTime', v)} />
            </div>
            <div className="tm-fg">
              <label>Hours Spent <span className="tm-hint">(auto-calc)</span></label>
              <input type="number" className="tm-inp" min="0" max="24" step="0.5" placeholder="e.g. 2.5" value={form.hoursSpent} onChange={e => set('hoursSpent', e.target.value)} />
            </div>
          </div>

          {/* Blocked reason — only if blocked */}
          {form.updateType === 'Blocked' && (
            <div className="tm-fg" style={{background:bg('#fef2f2'),padding:'12px',borderRadius:8,border:`1px solid ${bg('#fca5a5')}`}}>
              <label style={{color:tc('#dc2626')}}>🔴 What is blocking this task? <span className="tm-req">*</span></label>
              <textarea className="tm-ta" rows={2} placeholder="Describe the blocker clearly..." value={form.blockedReason} onChange={e => set('blockedReason', e.target.value)} />
            </div>
          )}

          {/* ── Section 4: Progress ── */}
          <div className="tm-fg">
            <label>
              Completion Progress
              <span className="tm-pval" style={{marginLeft:8,fontSize:14,fontWeight:800,color: form.completionPercent>=100?tc('#059669'):tc('#3b82f6')}}>
                {form.completionPercent}%
              </span>
              {form.completionPercent >= 100 && <span style={{marginLeft:6,fontSize:11,color:tc('#059669'),fontWeight:600}}>✓ Complete!</span>}
            </label>
            <input type="range" min={0} max={100} step={5} className="tm-range" value={form.completionPercent}
              onChange={e => { const v = Number(e.target.value); set('completionPercent', v); if(v===100) set('newStatus','Completed'); }} />
            <div className="tm-range-ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
          </div>

          {/* ── Section 5: Extra notes ── */}
          <div className="tm-fg">
            <label>
              Follow-up Notes
              <span style={{fontWeight:400,color:tc('#94a3b8'),fontSize:11,marginLeft:6}}>Next steps, reminders, client feedback...</span>
            </label>
            <textarea className="tm-ta" rows={2} placeholder="e.g. Client to revert by Friday. Need approval from manager before proceeding..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="tm-mftr">
          <button className="tm-btn tm-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="tm-btn tm-primary" onClick={submit} disabled={saving || !hasChanges}>
            {saving ? 'Saving…' : isComplete ? '✅ Save & Mark Complete' : 'Save Work Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   DAY LOG MODAL — unified: Record Task + Add Activity
══════════════════════════════════════════════════════════════════════════ */
const DayLogModal = ({ user, tasks, projects, onClose, onSaveTaskLog, onSaveActivity }) => {
  const activeTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');

  /* ─────────────────────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────────────────────── */
  // 'idle' | 'activity' | 'task' | 'review'
  const [mode, setMode] = useState('idle');

  // ── Committed items (shown as summary cards) ───────────────────────────
  // Each committed activity: { id, type:'activity', title, category, projectName, hours, logDate, startTime, endTime, description, projectId, otherProject }
  // Each committed task log: { id, type:'task', taskCode, taskTitle, workDone, hoursSpent, newStatus, completionPercent, logDate, ...rest }
  const [committedItems, setCommittedItems] = useState([]);

  // ── Activity draft (single form, committed on "Done") ──────────────────
  const emptyDraft = () => ({
    title: '', description: '', category: 'Internal Work',
    projectId: '', otherProject: '', logDate: todayStr(),
    startTime: '', endTime: '', hours: '',
  });
  const [activityDraft, setActivityDraft] = useState(emptyDraft());
  const setAD = (k, v) => setActivityDraft(p => ({ ...p, [k]: v }));

  // Auto-calc hours from start/end for activity draft
  const handleActivityTime = (key, val) => {
    setActivityDraft(prev => {
      const updated = { ...prev, [key]: val };
      if (updated.startTime && updated.endTime) {
        const [sh, sm] = updated.startTime.split(':').map(Number);
        const [eh, em] = updated.endTime.split(':').map(Number);
        const h = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
        if (h > 0) return { ...updated, hours: h.toFixed(1) };
      }
      return updated;
    });
  };

  const commitActivity = () => {
    if (!activityDraft.title.trim()) return;
    const proj = activityDraft.projectId && activityDraft.projectId !== 'OTHER'
      ? projects.find(p => (p.projectUniqueId || p.id) === activityDraft.projectId)
      : null;
    setCommittedItems(p => [...p, {
      ...activityDraft,
      id: Date.now() + Math.random(),
      type: 'activity',
      projectName: proj?.projectName || (activityDraft.projectId === 'OTHER' ? activityDraft.otherProject || 'Other' : ''),
    }]);
    setActivityDraft(emptyDraft());
    setMode('idle');
  };

  // ── Task log draft ─────────────────────────────────────────────────────
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskList, setShowTaskList] = useState(false);
  const [taskLog, setTaskLog] = useState({
    workDone: '', description: '', updateType: 'Progress Update', hoursSpent: '',
    startTime: nowTime(), endTime: '', newStatus: '', completionPercent: 0,
    blockedReason: '', notes: '', logDate: todayStr(),
  });
  const setTL = (k, v) => setTaskLog(p => ({ ...p, [k]: v }));
  const selectTask = (t) => {
    setSelectedTask(t);
    setShowTaskList(false);
    setTaskLog(p => ({ ...p, newStatus: t.status, completionPercent: t.completionPercent || 0 }));
  };

  // Auto-calc hours from start/end for task log
  useEffect(() => {
    if (taskLog.startTime && taskLog.endTime) {
      const [sh, sm] = taskLog.startTime.split(':').map(Number);
      const [eh, em] = taskLog.endTime.split(':').map(Number);
      const h = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      if (h > 0) setTL('hoursSpent', h.toFixed(1));
    }
  }, [taskLog.startTime, taskLog.endTime]); // eslint-disable-line

  const taskDraftValid = selectedTask && (
    taskLog.workDone.trim() !== '' ||
    taskLog.newStatus !== selectedTask.status ||
    taskLog.completionPercent !== (selectedTask.completionPercent || 0)
  );

  const commitTask = () => {
    if (!taskDraftValid) return;
    const combined = taskLog.description.trim()
      ? `${taskLog.workDone.trim()}${taskLog.workDone.trim() ? '\n\n' : ''}${taskLog.description.trim()}`
      : taskLog.workDone.trim();
    setCommittedItems(p => [...p, {
      id: Date.now() + Math.random(),
      type: 'task',
      taskId: selectedTask.id,
      taskCode: selectedTask.taskCode,
      taskTitle: selectedTask.title,
      projectName: selectedTask.projectName || '',
      workDone: combined || '(Status/progress updated)',
      hoursSpent: parseFloat(taskLog.hoursSpent) || 0,
      newStatus: taskLog.newStatus,
      completionPercent: taskLog.completionPercent,
      updateType: taskLog.updateType,
      startTime: taskLog.startTime,
      endTime: taskLog.endTime,
      logDate: taskLog.logDate,
      blockedReason: taskLog.blockedReason,
      notes: taskLog.notes,
    }]);
    // Reset task draft
    setSelectedTask(null);
    setTaskLog({
      workDone: '', description: '', updateType: 'Progress Update', hoursSpent: '',
      startTime: nowTime(), endTime: '', newStatus: '', completionPercent: 0,
      blockedReason: '', notes: '', logDate: todayStr(),
    });
    setMode('idle');
  };

  const removeItem = (id) => setCommittedItems(p => p.filter(i => i.id !== id));

  /* ─────────────────────────────────────────────────────────────────────────
     SAVE (called after review confirmation)
  ───────────────────────────────────────────────────────────────────────── */
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    for (const item of committedItems) {
      if (item.type === 'task') {
        await onSaveTaskLog({
          taskId: item.taskId,
          workDone: item.workDone,
          updateType: item.updateType,
          hoursSpent: item.hoursSpent,
          startTime: item.startTime,
          endTime: item.endTime,
          newStatus: item.newStatus,
          completionPercent: item.completionPercent,
          blockedReason: item.blockedReason,
          notes: item.notes,
          logDate: item.logDate,
        });
      } else {
        const isOther = item.projectId === 'OTHER';
        const proj = !isOther ? projects.find(p => (p.projectUniqueId || p.id) === item.projectId) : null;
        const hrs = parseFloat(item.hours) || 0;
        const entryDate = item.logDate || todayStr();
        await onSaveActivity({
          title: item.title.trim(),
          description: item.description.trim(),
          category: item.category,
          priority: 'Medium', status: 'Completed', dueDate: todayStr(),
          startDate: entryDate + 'T' + (item.startTime || '00:00') + ':00',
          endDate: entryDate + 'T' + (item.endTime || item.startTime || '23:59') + ':00',
          assignedTo: user?.id, assignedToName: user?.name,
          projectId: isOther ? null : (item.projectId || null),
          projectName: isOther ? null : (proj?.projectName || null),
          otherContext: isOther ? (item.otherProject || 'Other work') : null,
          estimatedHours: hrs || null, relatedTo: '', completionPercent: 100, isSelfLog: true,
          workLog: {
            workDone: item.title.trim(), description: item.description.trim(), hoursSpent: hrs,
            startTime: item.startTime || null, endTime: item.endTime || null,
            logDate: entryDate, updateType: 'Task Completed', newStatus: 'Completed', completionPercent: 100,
          },
        });
      }
    }
    setSaving(false);
    onClose();
  };

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER HELPERS
  ───────────────────────────────────────────────────────────────────────── */
  const totalHours = committedItems.reduce((s, i) => s + (parseFloat(i.hoursSpent || i.hours) || 0), 0);

  // Summary card for a committed item
  const ItemCard = ({ item }) => {
    const isTask = item.type === 'task';
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px', borderRadius: 10,
        background: isTask ? bg('#fafcff') : bg('#f8fffe'),
        border: `1px solid ${isTask ? bg('#bfdbfe') : bg('#a7f3d0')}`,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
          background: isTask ? bg('#eff6ff') : bg('#ecfdf5'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isTask ? <FiCheckCircle size={13} color="#3b82f6" /> : <FiZap size={13} color="#16a34a" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            {isTask && <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: tc('#94a3b8') }}>{item.taskCode}</span>}
            <span style={{ fontSize: 13, fontWeight: 700, color: tc('#0f172a') }}>
              {isTask ? item.taskTitle : item.title}
            </span>
          </div>
          {isTask && item.workDone && item.workDone !== '(Status/progress updated)' && (
            <p style={{ fontSize: 12, color: tc('#374151'), margin: '2px 0 0', lineHeight: 1.4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
              {item.workDone.split('\n\n')[0]}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 5, alignItems: 'center' }}>
            {isTask && item.newStatus && (
              <SBadge s={item.newStatus} />
            )}
            {isTask && item.completionPercent > 0 && (
              <span style={{ fontSize: 11, color: tc('#3b82f6'), fontWeight: 600 }}>{item.completionPercent}%</span>
            )}
            {!isTask && item.category && (
              <span style={{ fontSize: 11, color: tc('#374151'), background: bg('#f1f5f9'), padding: '1px 7px', borderRadius: 20 }}>📁 {item.category}</span>
            )}
            {(item.projectName || (isTask && item.projectName)) && (
              <span style={{ fontSize: 11, color: tc('#3b82f6'), background: bg('#eff6ff'), padding: '1px 7px', borderRadius: 20 }}>
                <FiBriefcase size={10} style={{ marginRight: 3 }} />{item.projectName}
              </span>
            )}
            {(item.hoursSpent > 0 || item.hours > 0) && (
              <span style={{ fontSize: 11, color: tc('#0891b2'), background: bg('#ecfeff'), padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>
                <FiClock size={10} style={{ marginRight: 3 }} />{(item.hoursSpent || item.hours)}h
              </span>
            )}
            {item.logDate && item.logDate !== todayStr() && (
              <span style={{ fontSize: 11, color: tc('#64748b') }}>📅 {item.logDate}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => removeItem(item.id)}
          title="Remove"
          style={{ border: 'none', background: bg('transparent'), cursor: 'pointer', color: tc('#cbd5e1'), fontSize: 15, padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}
        >✕</button>
      </div>
    );
  };

  // Action button bar
  const ActionBar = () => (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        type="button"
        onClick={() => { setMode(m => m === 'activity' ? 'idle' : 'activity'); setActivityDraft(emptyDraft()); }}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '10px 0', borderRadius: 9,
          background: mode === 'activity' ? bg('#f0fdf4') : bg('#fff'),
          border: `1.5px solid ${mode === 'activity' ? bg('#16a34a') : bg('#e2e8f0')}`,
          color: mode === 'activity' ? tc('#15803d') : tc('#374151'),
          fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
        }}>
        <FiZap size={14} color={mode === 'activity' ? '#16a34a' : '#6b7280'} />
        {mode === 'activity' ? 'Cancel Activity' : '+ Add Activity'}
      </button>
      <button
        type="button"
        onClick={() => { setMode(m => m === 'task' ? 'idle' : 'task'); }}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '10px 0', borderRadius: 9,
          background: mode === 'task' ? bg('#eff6ff') : bg('#fff'),
          border: `1.5px solid ${mode === 'task' ? bg('#3b82f6') : bg('#e2e8f0')}`,
          color: mode === 'task' ? tc('#1d4ed8') : tc('#374151'),
          fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
        }}>
        <FiCheckCircle size={14} color={mode === 'task' ? '#3b82f6' : '#6b7280'} />
        {mode === 'task' ? 'Cancel Task' : '+ Record Task'}
      </button>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="tm-overlay">
      <div
        className="tm-modal"
        style={{ width: 'min(860px,97vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="tm-mhdr" style={{ background: `linear-gradient(135deg,${bg('#0f172a')},${bg('#1e293b')})`, borderRadius: '14px 14px 0 0' }}>
          <div>
            <h2 style={{ color: tc('#fff'), display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <FiClipboard size={18} /> Day Log
            </h2>
            <p className="tm-msub" style={{ color: tc('#94a3b8'), margin: '4px 0 0' }}>
              Add activities and task updates — review before saving
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {committedItems.length > 0 && (
              <span style={{ fontSize: 11, color: tc('#94a3b8'), background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
                {committedItems.length} item{committedItems.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h
              </span>
            )}
            <button className="tm-xbtn" style={{ color: tc('#94a3b8') }} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ══════════════════ REVIEW SCREEN ══════════════════ */}
        {mode === 'review' ? (
          <>
            <div className="tm-mbody" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: tc('#0f172a'), margin: '0 0 4px' }}>
                  Review before saving
                </h3>
                <p style={{ fontSize: 12, color: tc('#64748b'), margin: 0 }}>
                  Check everything looks right — you can still remove items
                </p>
              </div>

              {/* Summary strip */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: bg('#f0f9ff'), border: `1px solid ${bg('#bae6fd')}`, borderRadius: 8, padding: '8px 14px' }}>
                  <FiClipboard size={14} color="#0369a1" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: tc('#0369a1') }}>{committedItems.length} item{committedItems.length !== 1 ? 's' : ''}</span>
                </div>
                {totalHours > 0 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: bg('#ecfeff'), border: `1px solid ${bg('#a5f3fc')}`, borderRadius: 8, padding: '8px 14px' }}>
                    <FiClock size={14} color="#0891b2" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc('#0891b2') }}>{totalHours.toFixed(1)}h total</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: bg('#f0fdf4'), border: `1px solid ${bg('#bbf7d0')}`, borderRadius: 8, padding: '8px 14px' }}>
                  <FiZap size={14} color="#16a34a" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: tc('#16a34a') }}>{committedItems.filter(i => i.type === 'activity').length} activit{committedItems.filter(i => i.type === 'activity').length !== 1 ? 'ies' : 'y'}</span>
                </div>
                {committedItems.filter(i => i.type === 'task').length > 0 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: bg('#eff6ff'), border: `1px solid ${bg('#bfdbfe')}`, borderRadius: 8, padding: '8px 14px' }}>
                    <FiCheckCircle size={14} color="#3b82f6" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc('#3b82f6') }}>{committedItems.filter(i => i.type === 'task').length} task update{committedItems.filter(i => i.type === 'task').length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* All items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {committedItems.map((item) => <ItemCard key={item.id} item={item} />)}
              </div>
            </div>
            <div className="tm-mftr" style={{ borderTop: `2px solid ${bg('#f1f5f9')}`, background: bg('#f8fafc') }}>
              <button className="tm-btn tm-ghost" onClick={() => setMode('idle')} disabled={saving}>
                ← Edit
              </button>
              <button
                className="tm-btn tm-primary"
                onClick={handleSave}
                disabled={saving || committedItems.length === 0}
                style={{ minWidth: 140 }}
              >
                {saving ? 'Saving…' : `✅ Confirm & Save (${committedItems.length})`}
              </button>
            </div>
          </>
        ) : (

        /* ══════════════════ MAIN ENTRY SCREEN ══════════════════ */
        <>
          <div className="tm-mbody" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Committed items list ── */}
            {committedItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: tc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 4 }}>
                  Logged so far
                </div>
                {committedItems.map((item) => <ItemCard key={item.id} item={item} />)}
                <div style={{ borderTop: `1px dashed ${bg('#e2e8f0')}`, marginTop: 2 }} />
              </div>
            )}

            {/* ── Action buttons ── */}
            <ActionBar />

            {/* ══ ACTIVITY FORM ══ */}
            {mode === 'activity' && (
              <div style={{ background: bg('#fafffe'), border: `1.5px solid ${bg('#6ee7b7')}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: tc('#065f46'), display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiZap size={13} color="#16a34a" /> New Activity
                </div>

                <div className="tm-fg" style={{ margin: 0 }}>
                  <label className="dl-lbl">What did you work on? <span className="tm-req">*</span></label>
                  <input
                    className="tm-inp"
                    placeholder="e.g. Client call with Raju Solar, drafted proposal, attended site visit…"
                    value={activityDraft.title}
                    onChange={e => setAD('title', e.target.value)}
                    style={{ fontSize: 13, fontWeight: 500 }}
                    autoFocus
                  />
                </div>

                <div className="tm-fg" style={{ margin: 0 }}>
                  <label className="dl-lbl">Details <span style={{ fontWeight: 400, color: tc('#94a3b8') }}>(outcome, decisions, what happened)</span></label>
                  <textarea
                    className="tm-ta"
                    rows={3}
                    placeholder="What was the result? Any decisions or next steps?"
                    value={activityDraft.description}
                    onChange={e => setAD('description', e.target.value)}
                    style={{ fontSize: 12, lineHeight: 1.6 }}
                  />
                </div>

                {/* Date + Start + End + Auto hours */}
                <div className="dl-time-row">
                  <div>
                    <label className="dl-lbl">Date</label>
                    <input type="date" className="tm-inp" value={activityDraft.logDate || todayStr()} onChange={e => setAD('logDate', e.target.value)} style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label className="dl-lbl">Start</label>
                    <TimePicker value={activityDraft.startTime || ''} onChange={v => handleActivityTime('startTime', v)} />
                  </div>
                  <div>
                    <label className="dl-lbl">End</label>
                    <TimePicker value={activityDraft.endTime || ''} onChange={v => handleActivityTime('endTime', v)} />
                  </div>
                  <div>
                    <label className="dl-lbl">
                      Hrs{activityDraft.startTime && activityDraft.endTime && <span style={{ marginLeft:4, color:tc('#059669'), fontWeight:700, fontSize:10 }}>auto</span>}
                    </label>
                    <input
                      type="number" className="tm-inp" min="0" step="0.5" placeholder="0"
                      value={activityDraft.hours}
                      onChange={e => setAD('hours', e.target.value)}
                      style={{ textAlign: 'center', fontSize: 12 }}
                    />
                  </div>
                </div>

                {/* Category + Project */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="dl-lbl">Category</label>
                    <FilterSelect value={activityDraft.category} onChange={v => setAD('category', v)} options={CATEGORIES.map(c => ({ value: c, label: c }))} placeholder="Category" />
                  </div>
                  <div>
                    <label className="dl-lbl">Project</label>
                    <FilterSelect
                      value={activityDraft.projectId}
                      onChange={v => setAD('projectId', v)}
                      options={[{ value: '', label: '— No project —' }, ...projects.map(p => ({ value: p.projectUniqueId || String(p.id), label: p.projectName })), { value: 'OTHER', label: 'Other / Ad-hoc' }]}
                      placeholder="Project"
                    />
                  </div>
                </div>
                {activityDraft.projectId === 'OTHER' && (
                  <input className="tm-inp" style={{ fontSize: 12 }} placeholder="e.g. Admin, Training, Internal meeting…" value={activityDraft.otherProject || ''} onChange={e => setAD('otherProject', e.target.value)} />
                )}

                {/* Done / Cancel */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button className="tm-btn tm-ghost" onClick={() => setMode('idle')}>Cancel</button>
                  <button
                    className="tm-btn"
                    style={{ background: bg('#16a34a'), color: tc('#fff'), border: 'none', fontWeight: 700 }}
                    onClick={commitActivity}
                    disabled={!activityDraft.title.trim()}
                  >
                    ✓ Add to Log
                  </button>
                </div>
              </div>
            )}

            {/* ══ TASK LOG FORM ══ */}
            {mode === 'task' && (
              <div style={{ background: bg('#fafcff'), border: `1.5px solid ${bg('#93c5fd')}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: tc('#1e40af'), display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiCheckCircle size={13} color="#3b82f6" /> Record Task Update
                </div>

                {/* Task picker */}
                <div style={{ position: 'relative' }}>
                  <label className="dl-lbl">Select Task <span style={{ color: tc('#94a3b8'), fontWeight: 400 }}>({activeTasks.length} active)</span></label>
                  <button type="button" className="dl-task-btn" onClick={() => setShowTaskList(v => !v)}>
                    {selectedTask
                      ? <span style={{ fontWeight: 600, fontSize: 13, color: tc('#0f172a') }}>{selectedTask.taskCode} — {selectedTask.title.slice(0, 55)}{selectedTask.title.length > 55 ? '…' : ''}</span>
                      : <span style={{ color: tc('#94a3b8'), fontSize: 13 }}>Pick a task to update…</span>}
                    <span style={{ fontSize: 11, color: tc('#94a3b8'), marginLeft: 'auto' }}>{showTaskList ? '▲' : '▼'}</span>
                  </button>
                  {showTaskList && (
                    <div className="dl-task-list">
                      {activeTasks.length === 0
                        ? <div style={{ padding: 16, fontSize: 12, color: tc('#94a3b8'), textAlign: 'center' }}>🎉 All tasks are done!</div>
                        : activeTasks.map(t => (
                          <div key={t.id} className={`dl-task-item ${selectedTask?.id === t.id ? 'dl-task-sel' : ''}`} onClick={() => selectTask(t)}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                              <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: tc('#94a3b8') }}>{t.taskCode}</span>
                              <PBadge p={t.priority} /><SBadge s={t.status} />
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: tc('#0f172a'), lineHeight: 1.3 }}>{t.title}</div>
                            {t.projectName && <div style={{ fontSize: 11, color: tc('#3b82f6'), marginTop: 1 }}>📁 {t.projectName}</div>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {selectedTask && (
                  <>
                    {/* Log date */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: bg('#f0f7ff'), borderRadius: 7, border: `1px solid ${bg('#bfdbfe')}` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: tc('#1e40af'), whiteSpace: 'nowrap' }}>📅 Log Date</span>
                      <input type="date" className="tm-inp" style={{ maxWidth: 155, fontSize: 12 }} value={taskLog.logDate} max={todayStr()} onChange={e => setTL('logDate', e.target.value)} />
                      <span style={{ fontSize: 11, color: tc('#64748b') }}>{taskLog.logDate === todayStr() ? 'Today' : 'Past entry'}</span>
                    </div>

                    <div className="tm-fg" style={{ margin: 0 }}>
                      <label className="dl-lbl">Work Summary</label>
                      <input className="tm-inp" placeholder="e.g. Called client, completed draft, attended meeting…" value={taskLog.workDone} onChange={e => setTL('workDone', e.target.value)} style={{ fontSize: 13 }} autoFocus />
                    </div>

                    <div className="tm-fg" style={{ margin: 0 }}>
                      <label className="dl-lbl">Details <span style={{ fontWeight: 400, color: tc('#94a3b8'), fontSize: 10 }}>(outcomes, decisions, next steps)</span></label>
                      <textarea className="tm-ta" rows={3} placeholder="What happened? What was the result? Any blockers?" value={taskLog.description} onChange={e => setTL('description', e.target.value)} style={{ fontSize: 12, lineHeight: 1.6 }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="tm-fg" style={{ margin: 0 }}>
                        <label className="dl-lbl">Entry Type</label>
                        <FilterSelect value={taskLog.updateType} onChange={v => setTL('updateType', v)} options={UPDATE_TYPES.map(t => ({ value: t, label: t }))} placeholder="Type" />
                      </div>
                      <div className="tm-fg" style={{ margin: 0 }}>
                        <label className="dl-lbl">Update Status To</label>
                        <FilterSelect value={taskLog.newStatus} onChange={v => { setTL('newStatus', v); if (v === 'Completed') setTL('completionPercent', 100); }} options={STATUSES.map(s => ({ value: s, label: s }))} placeholder="Status" />
                      </div>
                    </div>

                    <div className="dl-time-row-3">
                      <div className="tm-fg" style={{ margin: 0 }}>
                        <label className="dl-lbl">Start Time</label>
                        <TimePicker value={taskLog.startTime} onChange={v => setTL('startTime', v)} />
                      </div>
                      <div className="tm-fg" style={{ margin: 0 }}>
                        <label className="dl-lbl">End Time</label>
                        <TimePicker value={taskLog.endTime} onChange={v => setTL('endTime', v)} />
                      </div>
                      <div className="tm-fg" style={{ margin: 0 }}>
                        <label className="dl-lbl">Hrs{taskLog.startTime && taskLog.endTime && <span style={{ marginLeft:4, color:tc('#059669'), fontWeight:700, fontSize:10 }}>auto</span>}</label>
                        <input type="number" className="tm-inp" min="0" max="24" step="0.5" placeholder="h" value={taskLog.hoursSpent} onChange={e => setTL('hoursSpent', e.target.value)} style={{ textAlign: 'center' }} />
                      </div>
                    </div>

                    {taskLog.updateType === 'Blocked' && (
                      <div className="tm-fg" style={{ margin: 0, background: bg('#fef2f2'), padding: 12, borderRadius: 8, border: `1px solid ${bg('#fca5a5')}` }}>
                        <label style={{ fontSize: 11, color: tc('#dc2626'), fontWeight: 600 }}>🔴 What is blocking this task?</label>
                        <textarea className="tm-ta" rows={2} placeholder="Describe the blocker clearly…" value={taskLog.blockedReason} onChange={e => setTL('blockedReason', e.target.value)} />
                      </div>
                    )}

                    <div className="tm-fg" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: tc('#374151'), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Completion Progress</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: taskLog.completionPercent >= 100 ? tc('#059669') : tc('#3b82f6') }}>
                          {taskLog.completionPercent}%
                          {taskLog.completionPercent >= 100 && <span style={{ fontSize: 11, marginLeft: 6 }}>✓ Complete!</span>}
                        </span>
                      </label>
                      <input type="range" min={0} max={100} step={5} className="tm-range" value={taskLog.completionPercent}
                        onChange={e => { const v = Number(e.target.value); setTL('completionPercent', v); if (v === 100) setTL('newStatus', 'Completed'); }} />
                      <div className="tm-range-ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
                    </div>

                    <div className="tm-fg" style={{ margin: 0 }}>
                      <label className="dl-lbl">Follow-up Notes <span style={{ fontWeight: 400, color: tc('#94a3b8') }}>(optional)</span></label>
                      <input className="tm-inp" placeholder="Next steps, reminders, client feedback…" value={taskLog.notes} onChange={e => setTL('notes', e.target.value)} style={{ fontSize: 12 }} />
                    </div>
                  </>
                )}

                {/* Done / Cancel */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button className="tm-btn tm-ghost" onClick={() => setMode('idle')}>Cancel</button>
                  <button
                    className="tm-btn"
                    style={{ background: bg('#3b82f6'), color: tc('#fff'), border: 'none', fontWeight: 700, opacity: taskDraftValid ? 1 : 0.5 }}
                    onClick={commitTask}
                    disabled={!taskDraftValid}
                  >
                    ✓ Add to Log
                  </button>
                </div>
              </div>
            )}

            {/* Empty state hint */}
            {committedItems.length === 0 && mode === 'idle' && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: tc('#94a3b8') }}>
                <FiClipboard size={30} color="#e2e8f0" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, margin: 0, color: tc('#64748b') }}>Use the buttons above to log your work</p>
                <p style={{ fontSize: 11, margin: '4px 0 0' }}>Add activities or record task updates, then review and save</p>
              </div>
            )}

          </div>

          {/* ── Footer ── */}
          <div className="tm-mftr" style={{ borderTop: `2px solid ${bg('#f1f5f9')}`, background: bg('#f8fafc') }}>
            <div style={{ fontSize: 12, color: tc('#64748b') }}>
              {committedItems.length > 0
                ? <span style={{ fontWeight: 600, color: tc('#0f172a') }}>{committedItems.length} item{committedItems.length !== 1 ? 's' : ''} ready · {totalHours.toFixed(1)}h</span>
                : <span>Add items above to save</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="tm-btn tm-ghost" onClick={onClose}>Cancel</button>
              <button
                className="tm-btn tm-primary"
                onClick={() => setMode('review')}
                disabled={committedItems.length === 0}
              >
                Review & Save →
              </button>
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
};


/* ══════════════════════════════════════════════════════════════════════════
   TASK FORM MODAL — add / edit
══════════════════════════════════════════════════════════════════════════ */
const TaskFormModal = ({ task, users, projects, user, isSuperAdmin, isManager, onClose, onSave }) => {
  const isEdit = !!task?.id;
  const [form, setForm] = useState({
    title: task?.title || '', description: task?.description || '',
    category: task?.category || 'Follow-up', priority: task?.priority || 'Medium',
    startDate: task?.startDate ? task.startDate.slice(0, 16) : '',
    endDate: task?.endDate ? task.endDate.slice(0, 16) : '',
    dueDate: task?.dueDate?.slice(0, 10) || todayStr(),
    assignedTo: task?.assignedTo || user?.id || '',
    status: task?.status || 'Pending', relatedTo: task?.relatedTo || '',
    projectId: task?.projectId || '', otherContext: task?.otherContext || '',
    estimatedHours: task?.estimatedHours || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-calc estimated hours from start/end datetime
  useEffect(() => {
    if (form.startDate && form.endDate) {
      const h = diffHrs(form.startDate, form.endDate);
      if (h) set('estimatedHours', h);
    }
  }, [form.startDate, form.endDate]);

  const submit = async () => {
    if (!form.title.trim() || !form.dueDate) return;
    setSaving(true);
    const proj = projects.find(p => (p.projectUniqueId || p.id) === form.projectId);
    await onSave({ ...form, id: task?.id, projectName: proj?.projectName || null });
    setSaving(false);
  };

  return (
    <div className="tm-overlay">
      <div className="tm-modal tm-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="tm-mhdr">
          <div><h2>{isEdit ? 'Edit Task' : 'Add New Task'}</h2><p className="tm-msub">{isEdit ? 'Update task details' : 'Create a task for yourself or a team member'}</p></div>
          <button className="tm-xbtn" onClick={onClose}>✕</button>
        </div>
        <div className="tm-mbody">
          <div className="tm-fg">
            <label>Task Title <span className="tm-req">*</span></label>
            <input className="tm-inp" placeholder="e.g. Follow up with Raju Solar – site visit confirmation" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="tm-fg">
            <label>Description</label>
            <textarea className="tm-ta" rows={3} placeholder="More context, instructions, or acceptance criteria..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="tm-frow tm-frow3">
            <div className="tm-fg">
              <label>Category</label>
              <FilterSelect value={form.category} onChange={v => set('category', v)} options={CATEGORIES.map(c=>({value:c,label:c}))} placeholder="Select Category" />
            </div>
            <div className="tm-fg">
              <label>Priority</label>
              <FilterSelect value={form.priority} onChange={v => set('priority', v)} options={PRIORITIES.map(p=>({value:p,label:p}))} placeholder="Select Priority" />
            </div>
            <div className="tm-fg">
              <label>Due Date <span className="tm-req">*</span></label>
              <DatePicker value={form.dueDate} onChange={v => set('dueDate', v)} placeholder="Select due date" />
            </div>
          </div>
          <div className="tm-frow">
            <div className="tm-fg">
              <label>Start Date & Time</label>
              <DateTimePicker value={form.startDate} onChange={v => set('startDate', v)} placeholder="Select start date & time" />
            </div>
            <div className="tm-fg">
              <label>End Date & Time <span className="tm-hint">(auto-calc hours)</span></label>
              <DateTimePicker value={form.endDate} onChange={v => set('endDate', v)} placeholder="Select end date & time" />
            </div>
          </div>
          <div className="tm-fg">
            <label>Project <span className="tm-hint">({projects.length} available)</span></label>
            <FilterSelect value={form.projectId} onChange={v => set('projectId', v)} options={[{value:'',label:'— No specific project —'}, ...projects.map(p=>({value:p.projectUniqueId||String(p.id),label:p.projectName})), {value:'OTHER',label:'Other / Ad-hoc work'}]} placeholder="Select Project" />
          </div>
          {form.projectId === 'OTHER' && (
            <div className="tm-fg">
              <label>Describe work context <span className="tm-req">*</span></label>
              <input className="tm-inp" placeholder="e.g. Admin work, Training, Internal support, Ad-hoc call..." value={form.otherContext} onChange={e => set('otherContext', e.target.value)} />
            </div>
          )}
          <div className="tm-frow">
            {(isSuperAdmin || isManager) && (
              <div className="tm-fg">
                <label>Assign To {isManager && !isSuperAdmin ? <span className="tm-hint">— your team only</span> : ''}</label>
                <FilterSelect value={String(form.assignedTo||'')} onChange={v => set('assignedTo', v)} options={[{value:String(user?.id||''),label:`Myself (${user?.name})`}, ...users.filter(u=>String(u.id)!==String(user?.id)).map(u=>({value:String(u.id),label:`${u.name} (${u.role})`}))]} placeholder="Assign To" />
              </div>
            )}
            <div className="tm-fg">
              <label>Est. Hours {form.startDate && form.endDate ? <span className="tm-hint tm-green">✓ auto-filled</span> : ''}</label>
              <input type="number" className="tm-inp" min="0" step="0.5" placeholder="e.g. 3" value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} />
            </div>
            {isEdit && (
              <div className="tm-fg">
                <label>Status</label>
                <FilterSelect value={form.status} onChange={v => set('status', v)} options={STATUSES.map(s=>({value:s,label:s}))} placeholder="Status" />
              </div>
            )}
          </div>
          <div className="tm-fg">
            <label>Related To <span className="tm-hint">(Lead / Client / Order)</span></label>
            <input className="tm-inp" placeholder="e.g. Lead: Raju Solar, Order: OB-2024-001, Client: ABC Corp" value={form.relatedTo} onChange={e => set('relatedTo', e.target.value)} />
          </div>
        </div>
        <div className="tm-mftr">
          <button className="tm-btn tm-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="tm-btn tm-primary" onClick={submit} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : isEdit ? 'Update Task' : '+ Add Task'}</button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   TASK DETAIL MODAL (full detail popup)
══════════════════════════════════════════════════════════════════════════ */
const TaskDetailModal = ({ task, onClose, onLog, isSuperAdmin }) => {
  if (!task) return null;
  const totalH = (task.updates || []).reduce((s, u) => s + (parseFloat(u.hoursSpent) || 0), 0);
  const isOD = task.status !== 'Completed' && task.status !== 'Cancelled' && task.dueDate && task.dueDate < todayStr();
  const elapsed = diffHrs(task.startedAt, task.closedAt || new Date().toISOString());

  return (
    <div className="tm-overlay">
      <div className="tm-modal tm-modal-xl" onClick={e => e.stopPropagation()}>
        <div className="tm-mhdr">
          <div>
            <div className="tm-mhdr-top"><span className="tm-tcode">{task.taskCode}</span> <SBadge s={task.status} /> <PBadge p={task.priority} /> {isOD && <span className="tm-chip tm-chip-danger">🚨 Overdue</span>}</div>
            <h2 style={{ margin: '8px 0 4px', fontSize: 18 }}>{task.title}</h2>
            {task.relatedTo && <p style={{ margin: 0, fontSize: 12, color: tc('#64748b') }}>↳ {task.relatedTo}</p>}
          </div>
          <button className="tm-xbtn" onClick={onClose}>✕</button>
        </div>
        <div className="tm-mbody" style={{ maxHeight: '65vh' }}>
          {/* Meta grid */}
          <div className="tm-detail-grid">
            <div className="tm-dg-item"><span className="tm-dg-lbl">Category</span><span className="tm-chip">📁 {task.category}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Project</span><span>{task.projectName ? <span className="tm-chip tm-chip-blue"><FiBriefcase size={11} style={{marginRight:3}} />{task.projectName}</span> : task.otherContext ? <span className="tm-chip tm-chip-orange"><FiTag size={11} style={{marginRight:3}} />{task.otherContext}</span> : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Assigned To</span><span className="tm-dg-val">{task.assignedToName || '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Created By</span><span className="tm-dg-val">{task.createdByName || '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Due Date</span><span className={`tm-dg-val ${isOD ? 'tm-red' : ''}`}>{fmtDate(task.dueDate)}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Start Date</span><span className="tm-dg-val">{task.startDate ? fmtDT(task.startDate) : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">End Date</span><span className="tm-dg-val">{task.endDate ? fmtDT(task.endDate) : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Est. Hours</span><span className="tm-dg-val">{task.estimatedHours ? `${task.estimatedHours}h` : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Hours Logged</span><span className="tm-dg-val tm-blue-val"><FiClock size={11} style={{marginRight:3}} />{totalH > 0 ? `${totalH.toFixed(1)}h` : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Time Elapsed</span><span className="tm-dg-val">{elapsed ? `${elapsed}h` : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Started At</span><span className="tm-dg-val">{task.startedAt ? fmtDT(task.startedAt) : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Closed At</span><span className="tm-dg-val">{task.closedAt ? fmtDT(task.closedAt) : '—'}</span></div>
          </div>

          {task.description && (
            <div className="tm-dr-sec"><h4>Description</h4><p className="tm-dr-desc">{task.description}</p></div>
          )}

          {/* Progress bar */}
          <div className="tm-dr-sec">
            <div className="tm-prog-hdr"><h4>Progress</h4><span className="tm-prog-pct">{task.completionPercent || 0}%</span></div>
            <div className="tm-prog-track"><div className="tm-prog-fill" style={{ width: `${task.completionPercent || 0}%`, background: (task.completionPercent || 0) >= 100 ? bg('#059669') : bg('#3b82f6') }} /></div>
            {task.estimatedHours && totalH > 0 && (
              <div className="tm-time-ratio">
                <span>Logged {totalH.toFixed(1)}h of {task.estimatedHours}h estimated</span>
                <span className={totalH > task.estimatedHours ? 'tm-red' : 'tm-green-txt'}>{totalH > task.estimatedHours ? '⚠ Over estimate' : '✓ On track'}</span>
              </div>
            )}
          </div>

          {/* Update history */}
          <div className="tm-dr-sec">
            <h4>Work Entries ({(task.updates || []).length} entries · {totalH.toFixed(1)}h total)</h4>
            {!(task.updates?.length) ? (
              <div style={{textAlign:'center',padding:'24px 0',color:tc('#94a3b8')}}>
                <div style={{marginBottom:6}}><FiList size={28} color="#94a3b8" /></div>
                <p style={{fontSize:13,margin:0}}>No work entries yet.</p>
                <p style={{fontSize:11,margin:'4px 0 0',color:tc('#cbd5e1')}}>Click "Add Work Entry" to log what you've done on this task.</p>
              </div>
            ) : (
              <div className="tm-hist">
                {(task.updates || []).map((u, i) => {
                  const dotColor = u.updateType === 'Blocked' ? '#dc2626' : u.updateType === 'Task Completed' ? '#059669' : u.updateType === 'Discussion' ? '#7c3aed' : '#3b82f6';
                  // Split combined workDone back into summary + detail if \n\n present
                  const parts = (u.workDone || '').split('\n\n');
                  const summary = parts[0] || '';
                  const detail = parts.slice(1).join('\n\n') || '';
                  return (
                    <div key={i} className={`tm-hist-item ${u.updateType === 'Blocked' ? 'tm-hist-blocked-row' : ''}`}>
                      <div className="tm-hist-dot" style={{ background: dotColor }} />
                      <div className="tm-hist-body">
                        {/* Meta row */}
                        <div className="tm-hist-meta">
                          <span className="tm-hist-who">{u.updatedByName}</span>
                          <span className="tm-type-pill">{u.updateType || 'Update'}</span>
                          <span className="tm-hist-when">{fmtDate(u.updatedAt)}</span>
                          {(u.startTime || u.endTime) && <span className="tm-hist-time">🕐 {fmtTime(u.startTime)}{u.endTime ? ` → ${fmtTime(u.endTime)}` : ''}</span>}
                          {u.hoursSpent > 0 && <span className="tm-hours-pill"><FiClock size={11} style={{marginRight:3}} />{u.hoursSpent}h</span>}
                          {u.statusChanged && <span className="tm-hist-sc">→ <strong>{u.newStatus}</strong></span>}
                        </div>
                        {/* Summary line */}
                        <p className="tm-hist-text" style={{fontWeight:600,marginBottom: detail ? 6 : 0}}>{summary}</p>
                        {/* Full detail — shown in a readable block */}
                        {detail && (
                          <div style={{
                            background:bg('#f8fafc'), border:`1px solid ${bg('#f1f5f9')}`, borderRadius:8,
                            padding:'10px 14px', fontSize:12, color:tc('#374151'), lineHeight:1.7,
                            whiteSpace:'pre-wrap', marginBottom:4,
                          }}>
                            {detail}
                          </div>
                        )}
                        {u.blockedReason && <p className="tm-hist-blk">🔴 Blocked: {u.blockedReason}</p>}
                        {u.notes && <p className="tm-hist-notes"><FiFileText size={12} style={{marginRight:4}} />{u.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="tm-mftr">
          <button className="tm-btn tm-ghost" onClick={onClose}>Close</button>
          <button className="tm-btn tm-primary" onClick={() => { onLog(task); onClose(); }}>
            <FiClipboard size={14} style={{marginRight:6}} />Add Work Entry
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   BOARD VIEW — drag and drop with backend sync
══════════════════════════════════════════════════════════════════════════ */
const BoardView = ({ tasks, onLog, onDetail, onEdit, onStatusChange, isSuperAdmin }) => {
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);

  const onDragStart = (e, task) => {
    dragRef.current = task;
    setDragging(task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(task.id));
  };
  const onDragEnd = () => { setDragging(null); };
  const onDragOverCol = (e, status) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(status); };
  const onDragLeaveCol = () => setDragOver(null);
  const onDrop = (e, newStatus) => {
    e.preventDefault(); setDragOver(null); setDragging(null);
    const t = dragRef.current;
    dragRef.current = null;
    if (t && t.status !== newStatus) onStatusChange(t, newStatus); // ← calls backend
  };

  return (
    <div className="tm-board">
      {STATUSES.map(status => {
        const col = tasks.filter(t => t.status === status);
        const cfg = STA[status];
        const isOver = dragOver === status;
        return (
          <div key={status} className={`tm-col ${isOver ? 'tm-col-over' : ''}`}
            onDragOver={e => onDragOverCol(e, status)} onDragLeave={onDragLeaveCol} onDrop={e => onDrop(e, status)}>
            <div className="tm-col-hdr" style={{ borderTopColor: cfg.c }}>
              <span>{cfg.icon}</span>
              <span className="tm-col-title">{status}</span>
              <span className="tm-col-count" style={{ background: cfg.bg, color: cfg.c }}>{col.length}</span>
            </div>
            {isOver && <div className="tm-drop-zone">Drop here → {status}</div>}
            <div className="tm-col-cards">
              {col.length === 0 && <div className="tm-col-empty">No tasks — drop here</div>}
              {col.map(task => {
                const isOD = status !== 'Completed' && status !== 'Cancelled' && task.dueDate && task.dueDate < todayStr();
                const totalH = (task.updates || []).reduce((s, u) => s + (parseFloat(u.hoursSpent) || 0), 0);
                const isDragging = dragging === task.id;
                return (
                  <div key={task.id}
                    className={`tm-card-item ${isOD ? 'tm-card-od' : ''} ${isDragging ? 'tm-card-dragging' : ''}`}
                    draggable
                    onDragStart={e => onDragStart(e, task)}
                    onDragEnd={onDragEnd}
                    onClick={() => onDetail(task)}>
                    <div className="tm-ci-top">
                      <span className="tm-tcode" style={{fontSize:10,color:tc('#94a3b8'),fontWeight:700}}>{task.taskCode}</span>
                      <PBadge p={task.priority} />
                    </div>
                    <p className="tm-ci-title">{task.title}</p>
                    {task.projectName && <p className="tm-ci-proj" title={task.projectName}><FiBriefcase size={11} style={{marginRight:3}} />{task.projectName}</p>}
                    {task.otherContext && <p className="tm-ci-proj" style={{ color: tc('#c2410c') }} title={task.otherContext}><FiTag size={11} style={{marginRight:3}} />{task.otherContext}</p>}
                    {task.relatedTo && (
                      <p className="tm-ci-rel" title={task.relatedTo}>
                        ↳ {task.relatedTo.length > 55 ? task.relatedTo.slice(0, 55) + '…' : task.relatedTo}
                      </p>
                    )}
                    <div className="tm-ci-bot">
                      <span className="tm-chip">📁 {task.category}</span>
                      <span className={`tm-due-sm ${isOD ? 'tm-due-od' : ''}`}>{isOD ? '🚨' : '📅'} {fmtDate(task.dueDate)}</span>
                    </div>
                    {isSuperAdmin && task.assignedToName && (
                      <div className="tm-ci-who" title={task.assignedToName}>👤 {task.assignedToName}</div>
                    )}
                    <div className="tm-ci-footer">
                      <div className="tm-mini-prog">
                        <div className="tm-mini-bar"><div className="tm-mini-fill" style={{ width: `${task.completionPercent || 0}%` }} /></div>
                        <span>{task.completionPercent || 0}%</span>
                      </div>
                      {totalH > 0 && <span className="tm-ci-hours"><FiClock size={11} style={{marginRight:3}} />{totalH.toFixed(1)}h</span>}
                    </div>
                    <div className="tm-ci-actions">
                      <button className="tm-ci-log-btn" onClick={e => { e.stopPropagation(); onLog(task); }}>
                        <FiClipboard size={13} style={{marginRight:4}} />Work Entry
                      </button>
                      <button className="tm-ci-log-btn" style={{background:bg('#eff6ff'),color:tc('#2563eb'),border:`1px solid ${bg('#bfdbfe')}`}} onClick={e => { e.stopPropagation(); onEdit(task); }}>
                        <FiEdit size={13} style={{marginRight:4}} />Edit
                      </button>
                    </div>
                    <div className="tm-drag-hint">⠿ drag to move status</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   TEAM VIEW — table / logs / grid views, manager + superadmin
   Logs view: every work entry with full description, grouped by employee
══════════════════════════════════════════════════════════════════════════ */
const TeamView = ({ user, users, onDetail, onExportCSV }) => {
  useThemeVersion();
  const [empSearch,    setEmpSearch]    = useState('');
  const [selectedEmp,  setSelectedEmp]  = useState(null);
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [taskSearchInput, setTaskSearchInput] = useState('');
  const [taskSearch,   setTaskSearch]   = useState('');
  const teamSearchDebounce = useRef(null);
  const handleTeamSearchChange = (val) => {
    // No setTaskSearchInput here — avoids re-render and cursor loss
    if (teamSearchDebounce.current) clearTimeout(teamSearchDebounce.current);
    teamSearchDebounce.current = setTimeout(() => {
      setTaskSearchInput(val);
      setTaskSearch(val);
    }, 500);
  };
  const [logView,      setLogView]      = useState('table');   // 'table' | 'logs' | 'grid'
  const [showSug,      setShowSug]      = useState(false);
  const [teamTasks,    setTeamTasks]    = useState([]);
  const [teamLoading,  setTeamLoading]  = useState(false);
  const [teamPage,     setTeamPage]     = useState(1);
  const [teamTotal,    setTeamTotal]    = useState(0);
  const [teamTotalPg,  setTeamTotalPg]  = useState(1);
  const [teamPageSize, setTeamPageSize] = useState(() => Number(localStorage.getItem('tm_team_page_size')) || 10);
  const [expandedRows, setExpandedRows] = useState(new Set());   // task IDs expanded inline
  const sugRef  = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const fn = e => { if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const doFetch = (empId, from, to, pg = 1, sz = teamPageSize) => {
    if (!user) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const params = new URLSearchParams();
    params.set('teamView', 'true');
    params.set('page', pg);
    params.set('size', sz);
    if (empId)      params.set('userId',   empId);
    if (from)       params.set('dateFrom', from);
    if (to)         params.set('dateTo',   to);
    if (from || to) { params.set('sortBy', 'dueDate'); params.set('sortDir', 'asc'); }
    if (taskSearch) params.set('search',   taskSearch);
    setTeamLoading(true);
    setTeamPage(pg);
    fetch(`${API}/tasks?` + params.toString(), {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'User-Id': String(user.id), 'User-Role': String(user.role) },
      signal: abortRef.current.signal,
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTeamTasks(d.data);
          setTeamTotal(d.total || 0);
          setTeamTotalPg(d.totalPages || 1);
        } else setTeamTasks([]);
      })
      .catch(e => { if (e.name !== 'AbortError') setTeamTasks([]); })
      .finally(() => setTeamLoading(false));
  };

  useEffect(() => { doFetch(undefined, '', '', 1); }, []); // eslint-disable-line

  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    doFetch(selectedEmp?.id, dateFrom, dateTo, 1, teamPageSize);
  }, [selectedEmp, dateFrom, dateTo, taskSearch]); // eslint-disable-line

  const goTeamPage  = (pg) => doFetch(selectedEmp?.id, dateFrom, dateTo, pg, teamPageSize);
  const changeTeamPageSize = (sz) => {
    localStorage.setItem('tm_team_page_size', sz);
    setTeamPageSize(sz);
    doFetch(selectedEmp?.id, dateFrom, dateTo, 1, sz);
  };

  // ── Employee autocomplete ──────────────────────────────────────────────
  const suggestions = users.filter(u => {
    if (!empSearch.trim()) return true;
    const q = empSearch.toLowerCase();
    return (u.name||'').toLowerCase().includes(q) || (u.role||'').toLowerCase().includes(q);
  }).slice(0, 8);

  const doSelect = (u) => { setSelectedEmp({ id: String(u.id), name: u.name||'?', role: u.role||'' }); setEmpSearch(u.name||''); setShowSug(false); };
  const doClear  = () => { setSelectedEmp(null); setEmpSearch(''); };

  // ── Toggle inline row expansion ─────────────────────────────────────
  const toggleExpand = (taskId, e) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const n = new Set(prev);
      n.has(taskId) ? n.delete(taskId) : n.add(taskId);
      return n;
    });
  };

  // ── Derived rows ───────────────────────────────────────────────────────
  const rows = teamTasks.map(task => {
    const updates = task.updates || [];
    const latest  = updates[0] || null;
    return {
      _id:           task.id,
      _task:         task,
      employee:      task.assignedToName || '—',
      role:          users.find(u => String(u.id) === String(task.assignedTo))?.role || '—',
      taskCode:      task.taskCode    || '—',
      taskTitle:     task.title       || '—',
      project:       task.projectName || task.otherContext || '—',
      category:      task.category    || '—',
      priority:      task.priority    || '—',
      relatedTo:     task.relatedTo   || '—',
      status:        task.status      || '—',
      dueDate:       task.dueDate     || '—',
      estHours:      task.estimatedHours ? String(task.estimatedHours) : '—',
      totalHours:    computeHours(task),  // FIX #4: computed from updates
      pct:           task.completionPercent || 0,
      updateCount:   updates.length,
      updates:       updates,
      lastWorkDone:  latest ? (latest.workDone  || '—') : '—',
      lastUpdateType:latest ? (latest.updateType|| '—') : '—',
      lastDate:      latest ? (latest.updatedAt || '').slice(0,10) : (task.createdAt||'').slice(0,10),
      lastHours:     latest ? (parseFloat(latest.hoursSpent)||0) : 0,
    };
  });

  // Sort rows ascending by dueDate when date filter is active (backend handles cross-page sort)
  if (dateFrom || dateTo) {
    rows.sort((a, b) => {
      const da = a.dueDate && a.dueDate !== '—' ? new Date(a.dueDate) : new Date('9999-12-31');
      const db = b.dueDate && b.dueDate !== '—' ? new Date(b.dueDate) : new Date('9999-12-31');
      return da - db;
    });
  }

  const totalHours = rows.reduce((s, r) => s + r.totalHours, 0);
  const totalEntries = rows.reduce((s, r) => s + r.updateCount, 0);

  // ── Flatten all work entries for "Logs" view ────────────────────────
  const allEntries = teamTasks.flatMap(task =>
    (task.updates || []).map(u => ({
      ...u,
      taskId:       task.id,
      taskCode:     task.taskCode,
      taskTitle:    task.title,
      taskStatus:   task.status,
      taskPriority: task.priority,
      taskCategory: task.category,
      projectName:  task.projectName || task.otherContext || null,
      employee:     task.assignedToName || '—',
      role:         users.find(usr => String(usr.id) === String(task.assignedTo))?.role || '—',
    }))
  ).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  // Group by employee for Logs view
  const logsByEmployee = allEntries.reduce((acc, entry) => {
    const key = entry.employee;
    if (!acc[key]) acc[key] = { role: entry.role, entries: [] };
    acc[key].entries.push(entry);
    return acc;
  }, {});

  // ── Export ─────────────────────────────────────────────────────────────
  const exportRows = () => rows.map(r => ({
    'Employee': r.employee, 'Role': r.role, 'Task Code': r.taskCode,
    'Task Title': r.taskTitle, 'Project': r.project, 'Category': r.category,
    'Priority': r.priority, 'Status': r.status, 'Progress %': r.pct,
    'Total Hours': r.totalHours, 'Est. Hours': r.estHours, 'Due Date': r.dueDate,
    'Work Entries': r.updateCount, 'Last Entry Type': r.lastUpdateType,
    'Last Work Done': r.lastWorkDone, 'Last Entry Date': r.lastDate,
  }));

  const exportLogsRows = () => allEntries.map(e => ({
    'Employee': e.employee, 'Role': e.role, 'Task Code': e.taskCode,
    'Task': e.taskTitle, 'Project': e.projectName || '—',
    'Entry Type': e.updateType, 'Work Done': e.workDone,
    'Hours': e.hoursSpent || 0, 'Start Time': e.startTime || '—',
    'End Time': e.endTime || '—', 'Status Updated To': e.newStatus || '—',
    'Date': (e.updatedAt||'').slice(0,10),
  }));

  // ── Dot color for entry type ────────────────────────────────────────
  const entryDot = (type) => {
    if (type === 'Blocked')        return '#dc2626';
    if (type === 'Task Completed') return '#059669';
    if (type === 'Discussion')     return '#7c3aed';
    if (type === 'Milestone Reached') return '#f59e0b';
    return '#3b82f6';
  };

  return (
    <div style={{marginBottom:24}}>
      <div style={{background:bg('#fff'),borderRadius:12,border:`1px solid ${bg('#f1f5f9')}`,boxShadow:'0 1px 3px rgba(0,0,0,.07)',display:'flex',flexDirection:'column',overflow:'hidden',maxHeight:'calc(100vh - 220px)'}}>

        {/* ── TOOLBAR ──────────────────────────────────────────────────── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:`1px solid ${bg('#f1f5f9')}`,background:bg('#f8fafc'),flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flex:1,flexWrap:'wrap',minWidth:0}}>

            {/* Employee autocomplete */}
            <div ref={sugRef} style={{position:'relative',minWidth:220,maxWidth:280}}>
              <div style={{display:'flex',alignItems:'center',border:`1px solid ${bg('#e2e8f0')}`,borderRadius:9,background:bg('#fff'),overflow:'hidden'}}>
                <span style={{padding:'0 10px',fontSize:14,color:tc('#94a3b8'),flexShrink:0}}>🔍</span>
                <input style={{flex:1,border:'none',outline:'none',fontSize:13,padding:'8px 0',background:bg('transparent'),color:tc('#0f172a')}}
                  placeholder="Search employee…" value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); setSelectedEmp(null); setShowSug(true); }}
                  onFocus={() => setShowSug(true)} />
                {(empSearch||selectedEmp) && (
                  <button onClick={doClear} style={{border:'none',background:bg('transparent'),cursor:'pointer',color:tc('#94a3b8'),padding:'0 10px',fontSize:13}}>✕</button>
                )}
              </div>
              {/* FIX #5: warn user to click suggestion */}
              {empSearch && !selectedEmp && (
                <div style={{fontSize:10,color:tc('#f59e0b'),marginTop:2}}>⚠ Click a name below to filter</div>
              )}
              {showSug && suggestions.length > 0 && (
                <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:bg('#fff'),border:`1px solid ${bg('#e2e8f0')}`,borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,.12)',zIndex:300,overflow:'hidden',maxHeight:280,overflowY:'auto'}}>
                  {suggestions.map(u => (
                    <div key={u.id} onMouseDown={() => doSelect(u)}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${bg('#f8fafc')}`}}
                      onMouseEnter={e => e.currentTarget.style.background=bg('#f0f7ff')}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <div style={{width:30,height:30,borderRadius:'50%',background:`linear-gradient(135deg,${bg('#3b82f6')},${bg('#8b5cf6')})`,color:tc('#fff'),fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {(u.name||'?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:tc('#0f172a')}}>{u.name}</div>
                        <div style={{fontSize:11,color:tc('#64748b')}}>{u.role||'—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date range */}
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:12,fontWeight:600,color:tc('#64748b')}}>From</span>
              <input type="date" className="tm-filter-sel" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span style={{fontSize:12,fontWeight:600,color:tc('#64748b')}}>To</span>
              <input type="date" className="tm-filter-sel" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            {/* Task search */}
            <div style={{position:'relative',display:'flex',alignItems:'center',flex:1,minWidth:160}}>
              <span style={{position:'absolute',left:10,fontSize:13,color:tc('#94a3b8'),pointerEvents:'none'}}>🔍</span>
              <input style={{width:'100%',padding:'8px 30px 8px 32px',border:`1px solid ${bg('#e2e8f0')}`,borderRadius:8,fontSize:13,outline:'none',background:bg('#fff'),color:tc('#0f172a'),boxSizing:'border-box'}}
                placeholder="Search tasks, work done…" onChange={e => handleTeamSearchChange(e.target.value)} />
              {taskSearch && <button onClick={() => { setTaskSearchInput(''); setTaskSearch(''); }} style={{position:'absolute',right:8,border:'none',background:bg('transparent'),cursor:'pointer',color:tc('#94a3b8'),fontSize:12}}>✕</button>}
            </div>
          </div>

          {/* Right: stats + export */}
          <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,fontWeight:700,color:tc('#0f172a')}}>{teamTotal} task{teamTotal!==1?'s':''} · {totalEntries} entr{totalEntries!==1?'ies':'y'}</div>
              {totalHours > 0 && <div style={{fontSize:11,color:tc('#0e7490'),fontWeight:600}}><FiClock size={11} style={{marginRight:3}} />{totalHours.toFixed(1)}h logged</div>}
            </div>
            <button className="tm-btn tm-ghost"
              onClick={() => logView==='logs'
                ? onExportCSV(exportLogsRows(), `work_entries_${selectedEmp?selectedEmp.name.replace(/\s+/g,'_'):'team'}_${dateFrom||'all'}.csv`)
                : onExportCSV(exportRows(), `tasks_${selectedEmp?selectedEmp.name.replace(/\s+/g,'_'):'team'}_${dateFrom||'all'}.csv`)
              }>
              📤 Export
            </button>
          </div>
        </div>

        {/* ── SECTION HEADER + VIEW TOGGLE ────────────────────────────── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderBottom:`1px solid ${bg('#f1f5f9')}`,flexWrap:'wrap',gap:10}}>
          <div>
            <h3 style={{fontSize:15,fontWeight:700,color:tc('#0f172a'),margin:'0 0 2px',display:'flex',alignItems:'center',gap:8}}>
              {selectedEmp ? (
                <>
                  <span style={{width:26,height:26,borderRadius:'50%',background:`linear-gradient(135deg,${bg('#3b82f6')},${bg('#8b5cf6')})`,color:tc('#fff'),fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                    {selectedEmp.name.charAt(0).toUpperCase()}
                  </span>
                  {selectedEmp.name}
                </>
              ) : '👥 Team Overview'}
            </h3>
            <p style={{fontSize:11,color:tc('#64748b'),margin:0}}>
              {dateFrom && dateTo ? `${fmtDate(dateFrom)} → ${fmtDate(dateTo)}` : dateFrom ? `From ${fmtDate(dateFrom)}` : 'All time'}
              {selectedEmp?.role ? ` · ${selectedEmp.role}` : ''}
            </p>
          </div>
          {/* 3-way view toggle */}
          <div style={{display:'flex',border:`1px solid ${bg('#e2e8f0')}`,borderRadius:9,overflow:'hidden',background:bg('#f8fafc')}}>
            {[['table','Tasks'],['logs','Work Logs'],['grid','Grid']].map(([v,l]) => (
              <button key={v} onClick={() => setLogView(v)} style={{
                padding:'7px 14px',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                background:logView===v?bg('#0f172a'):bg('transparent'),
                color:logView===v?tc('#fff'):tc('#64748b'),transition:'all .15s',whiteSpace:'nowrap',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────────────── */}
        <div style={{flex:1,overflowY:'auto',overflowX:'hidden',position:'relative'}}>
        {teamLoading ? (
          <div style={{padding:'48px 24px',textAlign:'center',color:tc('#94a3b8')}}>
            <div style={{fontSize:24,marginBottom:8}}>⏳</div>
            <p style={{fontSize:13,margin:0}}>Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div style={{padding:'48px 24px',textAlign:'center',color:tc('#94a3b8')}}>
            <div style={{fontSize:36,marginBottom:10}}><FiList size={36} color="#94a3b8" /></div>
            <p style={{fontSize:13,margin:0}}>
              {selectedEmp ? `No tasks found for ${selectedEmp.name}.` : `No tasks found. Try widening the date range or selecting an employee.`}
            </p>
            {selectedEmp && <button className="tm-btn tm-ghost tm-sm" style={{marginTop:12}} onClick={doClear}>← Show all</button>}
          </div>

        ) : logView === 'table' ? (

          /* ─────────────────────────── TABLE VIEW ─────────────────────── */
          <div style={{overflowX:'auto',minHeight:0}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:1000}}>
              <thead>
                <tr style={{background:bg('#f8fafc'),borderBottom:`2px solid ${bg('#e2e8f0')}`}}>
                  {['S.No','Employee','Task','Project','Category','Priority','Status','Progress','Hours','Due','Entries','Last Work Done','Last Date',''].map(h => (
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:tc('#64748b'),textTransform:'uppercase',letterSpacing:'.06em',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const expanded = expandedRows.has(r._id);
                  const summaryLine = (r.lastWorkDone || '').split('\n\n')[0];
                  return (
                    <React.Fragment key={r._id}>
                      <tr
                        style={{borderBottom: expanded ? 'none' : '1px solid #f8fafc', cursor:'pointer',
                          background: expanded ? bg('#f0f7ff') : bg('transparent'), transition:'background .12s'}}
                        onClick={() => onDetail(r._task)}
                        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background=bg('#f8fafc'); }}
                        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background='transparent'; }}>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',textAlign:'center',fontWeight:600,color:tc('#64748b'),fontSize:12}}>{i + 1}</td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:`linear-gradient(135deg,${bg('#3b82f6')},${bg('#8b5cf6')})`,color:tc('#fff'),fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              {(r.employee||'?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:tc('#0f172a'),lineHeight:1.2}}>{r.employee}</div>
                              <div style={{fontSize:10,color:tc('#64748b')}}>{r.role}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',maxWidth:200}}>
                          <span style={{fontSize:10,fontWeight:700,color:tc('#94a3b8'),fontFamily:'monospace',display:'block'}}>{r.taskCode}</span>
                          <span style={{fontSize:13,fontWeight:600,color:tc('#0f172a'),lineHeight:1.3}}>{r.taskTitle}</span>
                          {r.relatedTo !== '—' && <span style={{fontSize:11,color:tc('#64748b'),display:'block'}}>↳ {r.relatedTo}</span>}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}>
                          {r.project !== '—' ? <span className="tm-chip tm-chip-blue"><FiBriefcase size={11} style={{marginRight:3}} />{r.project}</span> : <span style={{color:tc('#94a3b8')}}>—</span>}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}><span className="tm-chip">📁 {r.category}</span></td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}><PBadge p={r.priority} /></td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}><SBadge s={r.status} /></td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',minWidth:90}}>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <div style={{flex:1,height:5,background:bg('#e2e8f0'),borderRadius:3,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${r.pct}%`,background:r.pct>=100?bg('#059669'):bg('#3b82f6'),borderRadius:3}}/>
                            </div>
                            <span style={{fontSize:10,color:tc('#64748b'),whiteSpace:'nowrap'}}>{r.pct}%</span>
                          </div>
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}>
                          {r.totalHours > 0 ? <span className="tm-hours-pill"><FiClock size={11} style={{marginRight:3}} />{r.totalHours.toFixed(1)}h</span> : <span style={{color:tc('#94a3b8')}}>—</span>}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',fontSize:12,color:tc('#475569'),whiteSpace:'nowrap'}}>
                          {r.dueDate !== '—' ? fmtDate(r.dueDate) : '—'}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',textAlign:'center'}}>
                          {r.updateCount > 0
                            ? <button onClick={e => toggleExpand(r._id, e)} style={{
                                padding:'3px 10px',border:'none',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:700,
                                background: expanded ? bg('#0f172a') : bg('#eff6ff'), color: expanded ? tc('#fff') : tc('#2563eb'),
                                transition:'all .15s',
                              }}>
                                {expanded ? '▲ Hide' : `${r.updateCount} entr${r.updateCount>1?'ies':'y'}`}
                              </button>
                            : <span style={{fontSize:11,color:tc('#94a3b8')}}>No entries</span>
                          }
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',maxWidth:220}}>
                          {summaryLine && summaryLine !== '—'
                            ? <p style={{fontSize:12,color:tc('#374151'),margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:1.4}}>{summaryLine}</p>
                            : <span style={{color:tc('#94a3b8')}}>—</span>}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',fontSize:11,color:tc('#64748b'),whiteSpace:'nowrap'}}>{r.lastDate||'—'}</td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}>
                          <span style={{fontSize:16,color:tc('#94a3b8')}}>›</span>
                        </td>
                      </tr>

                      {/* ── INLINE EXPANDED WORK ENTRIES ── */}
                      {expanded && (
                        <tr style={{background:bg('#f8fafc')}}>
                          <td colSpan={13} style={{padding:'0 0 4px 60px',borderBottom:`2px solid ${bg('#e2e8f0')}`}}>
                            <div style={{paddingRight:20,paddingBottom:12}}>
                              {r.updates.length === 0
                                ? <p style={{fontSize:12,color:tc('#94a3b8'),padding:'12px 0',margin:0}}>No work entries yet.</p>
                                : r.updates.map((u, ui) => {
                                    const parts = (u.workDone||'').split('\n\n');
                                    const summary = parts[0] || '';
                                    const detail  = parts.slice(1).join('\n\n') || '';
                                    return (
                                      <div key={ui} style={{
                                        display:'flex',gap:12,padding:'12px 0',
                                        borderBottom: ui < r.updates.length-1 ? '1px solid #f1f5f9' : 'none',
                                      }}>
                                        {/* Timeline dot */}
                                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0,paddingTop:4}}>
                                          <div style={{width:10,height:10,borderRadius:'50%',background:entryDot(u.updateType),border:`2px solid ${bg('#fff')}`,boxShadow:`0 0 0 2px ${entryDot(u.updateType)}`}}/>
                                          {ui < r.updates.length-1 && <div style={{width:2,flex:1,background:bg('#f1f5f9'),marginTop:4}}/>}
                                        </div>

                                        {/* Entry content */}
                                        <div style={{flex:1,minWidth:0}}>
                                          {/* Meta row */}
                                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:5}}>
                                            <span style={{fontSize:11,fontWeight:700,color:tc('#0f172a')}}>{u.updatedByName}</span>
                                            <span className="tm-type-pill">{u.updateType||'Update'}</span>
                                            <span style={{fontSize:11,color:tc('#64748b')}}>{fmtDate(u.updatedAt)}</span>
                                            {(u.startTime||u.endTime) && (
                                              <span style={{fontSize:11,color:tc('#64748b'),background:bg('#f1f5f9'),padding:'1px 7px',borderRadius:5}}>
                                                🕐 {fmtTime(u.startTime)}{u.endTime?` → ${fmtTime(u.endTime)}`:''}
                                              </span>
                                            )}
                                            {parseFloat(u.hoursSpent)>0 && <span className="tm-hours-pill"><FiClock size={11} style={{marginRight:3}} />{parseFloat(u.hoursSpent).toFixed(1)}h</span>}
                                            {u.statusChanged && (
                                              <span style={{fontSize:11,color:tc('#059669'),background:bg('#ecfdf5'),padding:'1px 8px',borderRadius:5,fontWeight:600}}>
                                                → {u.newStatus}
                                              </span>
                                            )}
                                          </div>

                                          {/* Summary */}
                                          <p style={{fontSize:13,fontWeight:600,color:tc('#0f172a'),margin:'0 0 4px',lineHeight:1.4}}>{summary}</p>

                                          {/* Full detail block */}
                                          {detail && (
                                            <div style={{
                                              background:bg('#fff'),border:`1px solid ${bg('#e2e8f0')}`,borderLeft:`3px solid ${entryDot(u.updateType)}`,
                                              borderRadius:'0 8px 8px 0',padding:'8px 12px',
                                              fontSize:12,color:tc('#374151'),lineHeight:1.7,whiteSpace:'pre-wrap',
                                              marginBottom:4,
                                            }}>{detail}</div>
                                          )}

                                          {u.blockedReason && (
                                            <div style={{background:bg('#fef2f2'),border:`1px solid ${bg('#fca5a5')}`,borderRadius:6,padding:'6px 10px',fontSize:12,color:tc('#dc2626'),marginTop:4}}>
                                              🔴 <strong>Blocked:</strong> {u.blockedReason}
                                            </div>
                                          )}
                                          {u.notes && (
                                            <div style={{background:bg('#f5f3ff'),borderRadius:6,padding:'6px 10px',fontSize:12,color:tc('#7c3aed'),marginTop:4}}>
                                              <FiFileText size={12} style={{marginRight:4,verticalAlign:'middle'}} />{u.notes}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                              }
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

        ) : logView === 'logs' ? (

          /* ─────────────────────── LOGS VIEW (all work entries) ─────────── */
          <div>
            {allEntries.length === 0 ? (
              <div style={{padding:'48px 24px',textAlign:'center',color:tc('#94a3b8')}}>
                <div style={{fontSize:36,marginBottom:8}}><FiClipboard size={36} color="#94a3b8" /></div>
                <p style={{fontSize:13,margin:0}}>No work entries found for this period.</p>
              </div>
            ) : Object.entries(logsByEmployee).map(([empName, empData]) => (
              <div key={empName} style={{borderBottom:`2px solid ${bg('#f1f5f9')}`}}>
                {/* Employee header */}
                <div style={{
                  display:'flex',alignItems:'center',gap:12,
                  padding:'12px 20px',background:bg('#f8fafc'),
                  borderBottom:`1px solid ${bg('#f1f5f9')}`,
                }}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${bg('#3b82f6')},${bg('#8b5cf6')})`,color:tc('#fff'),fontSize:14,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {empName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:tc('#0f172a')}}>{empName}</div>
                    <div style={{fontSize:11,color:tc('#64748b')}}>{empData.role} · {empData.entries.length} entr{empData.entries.length!==1?'ies':'y'} · {empData.entries.reduce((s,e)=>s+(parseFloat(e.hoursSpent)||0),0).toFixed(1)}h</div>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:tc('#3b82f6'),background:bg('#eff6ff'),padding:'3px 12px',borderRadius:20}}>
                    {empData.entries.length} entr{empData.entries.length!==1?'ies':'y'}
                  </span>
                </div>

                {/* All entries for this employee */}
                <div style={{padding:'0 20px 8px 72px'}}>
                  {empData.entries.map((u, ui) => {
                    const parts  = (u.workDone||'').split('\n\n');
                    const summary = parts[0] || '';
                    const detail  = parts.slice(1).join('\n\n') || '';
                    return (
                      <div key={ui} style={{
                        display:'flex',gap:12,padding:'14px 0',
                        borderBottom: ui < empData.entries.length-1 ? '1px solid #f1f5f9' : 'none',
                      }}>
                        {/* Timeline */}
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0,paddingTop:4}}>
                          <div style={{width:11,height:11,borderRadius:'50%',background:entryDot(u.updateType),border:`2px solid ${bg('#fff')}`,boxShadow:`0 0 0 2px ${entryDot(u.updateType)}`,flexShrink:0}}/>
                          {ui < empData.entries.length-1 && <div style={{width:2,flex:1,minHeight:20,background:bg('#e2e8f0'),marginTop:4}}/>}
                        </div>

                        {/* Content */}
                        <div style={{flex:1,minWidth:0}}>
                          {/* Task context pill */}
                          <div style={{
                            display:'inline-flex',alignItems:'center',gap:6,
                            background:bg('#f1f5f9'),borderRadius:6,padding:'3px 10px',
                            marginBottom:6,cursor:'pointer',
                          }}
                            onClick={() => { const t = teamTasks.find(x=>x.id===u.taskId); if(t) onDetail(t); }}>
                            <span style={{fontSize:10,fontFamily:'monospace',fontWeight:700,color:tc('#94a3b8')}}>{u.taskCode}</span>
                            <span style={{fontSize:12,fontWeight:600,color:tc('#0f172a')}}>{u.taskTitle}</span>
                            {u.projectName && <span className="tm-chip tm-chip-blue" style={{padding:'1px 6px'}}><FiBriefcase size={11} style={{marginRight:3}} />{u.projectName}</span>}
                            <SBadge s={u.taskStatus} />
                          </div>

                          {/* Meta row */}
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
                            <span className="tm-type-pill">{u.updateType||'Update'}</span>
                            <span style={{fontSize:11,color:tc('#64748b'),fontWeight:600}}>{fmtDate(u.updatedAt)}</span>
                            {(u.startTime||u.endTime) && (
                              <span style={{fontSize:11,color:tc('#64748b'),background:bg('#f8fafc'),padding:'2px 8px',borderRadius:5,fontFamily:'monospace'}}>
                                {fmtTime(u.startTime)}{u.endTime?` – ${fmtTime(u.endTime)}`:''}
                              </span>
                            )}
                            {parseFloat(u.hoursSpent)>0 && <span className="tm-hours-pill"><FiClock size={11} style={{marginRight:3}} />{parseFloat(u.hoursSpent).toFixed(1)}h</span>} {/* FIX #4 */}
                            {u.statusChanged && (
                              <span style={{fontSize:11,color:tc('#059669'),background:bg('#ecfdf5'),padding:'2px 8px',borderRadius:5,fontWeight:700,border:`1px solid ${bg('#6ee7b7')}`}}>
                                <FiArrowRight size={12} style={{marginRight:3}} />{u.newStatus}
                              </span>
                            )}
                          </div>

                          {/* Summary */}
                          <p style={{fontSize:13,fontWeight:700,color:tc('#0f172a'),margin:'0 0 6px',lineHeight:1.4}}>{summary}</p>

                          {/* Full detail */}
                          {detail && (
                            <div style={{
                              background:bg('#fff'),border:`1px solid ${bg('#e2e8f0')}`,
                              borderLeft:`3px solid ${entryDot(u.updateType)}`,
                              borderRadius:'0 8px 8px 0',padding:'10px 14px',
                              fontSize:12,color:tc('#374151'),lineHeight:1.75,
                              whiteSpace:'pre-wrap',marginBottom:4,
                            }}>{detail}</div>
                          )}

                          {u.blockedReason && (
                            <div style={{background:bg('#fef2f2'),border:`1px solid ${bg('#fca5a5')}`,borderRadius:6,padding:'7px 12px',fontSize:12,color:tc('#dc2626'),marginTop:4}}>
                              🔴 <strong>Blocker:</strong> {u.blockedReason}
                            </div>
                          )}
                          {u.notes && (
                            <div style={{background:bg('#f5f3ff'),border:`1px solid ${bg('#e9d5ff')}`,borderRadius:6,padding:'7px 12px',fontSize:12,color:tc('#7c3aed'),marginTop:4}}>
                              <FiFileText size={12} style={{marginRight:4,verticalAlign:'middle'}} />{u.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

        ) : (

          /* ─────────────────────────── GRID VIEW ─────────────────────── */
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14,padding:'16px 20px 20px'}}>
            {rows.map((r, i) => (
              <div key={i}
                onClick={() => onDetail(r._task)}
                style={{background:bg('#fff'),border:`1px solid ${bg('#e2e8f0')}`,borderRadius:12,padding:16,transition:'box-shadow .15s,transform .15s',cursor:'pointer'}}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:30,height:30,borderRadius:'50%',background:`linear-gradient(135deg,${bg('#3b82f6')},${bg('#8b5cf6')})`,color:tc('#fff'),fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {(r.employee||'?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:tc('#0f172a')}}>{r.employee}</div>
                      <div style={{fontSize:10,color:tc('#64748b')}}>{r.role}</div>
                    </div>
                  </div>
                  <SBadge s={r.status} />
                </div>
                <div style={{marginBottom:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:tc('#94a3b8'),fontFamily:'monospace'}}>{r.taskCode}</span>
                  <p style={{fontSize:13,fontWeight:600,color:tc('#0f172a'),margin:'2px 0 0',lineHeight:1.3}}>{r.taskTitle}</p>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                  {r.project !== '—' && <span className="tm-chip tm-chip-blue"><FiBriefcase size={11} style={{marginRight:3}} />{r.project}</span>}
                  <span className="tm-chip">📁 {r.category}</span>
                  <PBadge p={r.priority} />
                  {r.totalHours > 0 && <span className="tm-hours-pill"><FiClock size={11} style={{marginRight:3}} />{r.totalHours}h</span>}
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:tc('#64748b'),marginBottom:3}}>
                    <span>Progress</span><span>{r.pct}%</span>
                  </div>
                  <div style={{height:5,background:bg('#e2e8f0'),borderRadius:3}}>
                    <div style={{height:'100%',width:`${r.pct}%`,background:r.pct>=100?bg('#059669'):bg('#3b82f6'),borderRadius:3}}/>
                  </div>
                </div>
                {/* Show all entries count + preview of last one */}
                {r.updateCount > 0 ? (
                  <div style={{background:bg('#f8fafc'),borderRadius:8,padding:'8px 10px',marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:tc('#94a3b8'),textTransform:'uppercase',marginBottom:4}}>
                      Latest entry · {r.lastDate}
                    </div>
                    <p style={{fontSize:12,color:tc('#374151'),margin:0,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                      {(r.lastWorkDone||'').split('\n\n')[0]}
                    </p>
                  </div>
                ) : (
                  <p style={{fontSize:11,color:tc('#94a3b8'),margin:'0 0 6px'}}>No work entries yet</p>
                )}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                  <span style={{fontSize:11,color:tc('#64748b')}}>{r.updateCount} entr{r.updateCount!==1?'ies':'y'}</span>
                  <span style={{fontSize:11,color:tc('#3b82f6'),fontWeight:600}}>View full details ›</span>
                </div>
              </div>
            ))}
          </div>
        )}

        </div>{/* end scrollable content */}
        <PaginationBar page={teamPage} totalPages={teamTotalPg} total={teamTotal} pageSize={teamPageSize} onPageChange={goTeamPage} onSizeChange={changeTeamPageSize} />
      </div>
    </div>
  );
};
/* ══════════════════════════════════════════════════════════════════════════
   TODAY SUMMARY
══════════════════════════════════════════════════════════════════════════ */
const TodaySummary = ({ tasks, onLog, onDetail }) => {
  const todayUpds = tasks.flatMap(t =>
    (t.updates || []).filter(u => u.updatedAt?.slice(0, 10) === todayStr()).map(u => ({ ...u, task: t }))
  ).sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
  const totalH = todayUpds.reduce((s, u) => s + (parseFloat(u.hoursSpent) || 0), 0);
  const todayTasks = tasks.filter(t => t.dueDate === todayStr() && t.status !== 'Completed' && t.status !== 'Cancelled');

  return (
    <div className="tm-today-panel">
      <div className="tm-today-hdr">
        <div>
          <h3>📅 {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
          <p>{todayUpds.length} update{todayUpds.length !== 1 ? 's' : ''} logged · {totalH.toFixed(1)}h tracked today</p>
        </div>
      </div>
      {todayUpds.length > 0 && (
        <div className="tm-today-tl">
          {todayUpds.map((u, i) => (
            <div key={i} className="tm-tl-item" onClick={() => onDetail(u.task)} style={{ cursor: 'pointer' }}>
              <div className="tm-tl-time">{u.startTime ? fmtTime(u.startTime) : '—'}{u.endTime ? <><br /><span style={{ color: tc('#94a3b8'), fontSize: 10 }}>{fmtTime(u.endTime)}</span></> : null}</div>
              <div className="tm-tl-dot" style={{ background: u.updateType === 'Blocked' ? bg('#dc2626') : u.updateType === 'Discussion' ? bg('#7c3aed') : bg('#3b82f6') }} />
              <div className="tm-tl-body">
                <div className="tm-tl-meta">
                  <span className="tm-tcode">{u.task.taskCode}</span>
                  <span className="tm-type-pill">{u.updateType}</span>
                  {u.hoursSpent > 0 && <span className="tm-hours-pill"><FiClock size={11} style={{marginRight:3}} />{u.hoursSpent}h</span>}
                  {u.task.projectName && <span className="tm-chip tm-chip-blue"><FiBriefcase size={11} style={{marginRight:3}} />{u.task.projectName}</span>}
                </div>
                <p className="tm-tl-title">{u.task.title}</p>
                <p className="tm-tl-text">{u.workDone}</p>
                {u.notes && <p className="tm-tl-notes"><FiFileText size={12} style={{marginRight:4}} />{u.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {todayTasks.length > 0 && (
        <div className="tm-today-due">
          <p className="tm-today-due-lbl"><FiAlertTriangle size={13} style={{marginRight:5,color:"#f59e0b"}} />Due today and still open:</p>
          {todayTasks.map(t => (
            <div key={t.id} className="tm-today-task" onClick={() => onDetail(t)}>
              <SBadge s={t.status} />
              <span className="tm-tcode">{t.taskCode}</span>
              <span style={{ flex: 1, fontSize: 13, color: tc('#0f172a') }}>{t.title}</span>
              <button className="tm-btn tm-ghost tm-sm" onClick={e => { e.stopPropagation(); onLog(t); }}><FiClipboard size={13} style={{marginRight:4}} />Work Entry</button>
            </div>
          ))}
        </div>
      )}
      {todayUpds.length === 0 && todayTasks.length === 0 && (
        <div className="tm-empty" style={{ padding: '32px 24px' }}><div>☀️</div><p>No tasks or updates for today yet.</p></div>
      )}
    </div>
  );
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const PaginationBar = ({ page, totalPages, total, pageSize, onPageChange, onSizeChange }) => {
  const tp   = totalPages || 1;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const pages = [];
  const start = Math.max(1, page - 2);
  const end   = Math.min(tp, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="tm-pgn">
      {/* Left: rows per page + showing info */}
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:12,color:tc('#64748b'),whiteSpace:'nowrap'}}>Rows per page:</span>
          <FilterSelect value={String(pageSize)} onChange={v => onSizeChange && onSizeChange(Number(v))} options={PAGE_SIZE_OPTIONS.map(s => ({value:String(s),label:String(s)}))} placeholder="Rows" />
        </div>
        <span className="tm-pgn-info" style={{whiteSpace:'nowrap'}}>
          {total === 0 ? '0 results' : `${from}–${to} of ${total} result${total !== 1 ? 's' : ''}`}
        </span>
        {/* Always show current page indicator */}
        <span style={{fontSize:12,color:tc('#94a3b8'),whiteSpace:'nowrap'}}>
          Page <strong style={{color:tc('#0f172a')}}>{page}</strong> of <strong style={{color:tc('#0f172a')}}>{tp}</strong>
        </span>
      </div>
      {/* Right: page buttons — always shown so user knows where they are */}
      <div className="tm-pgn-btns">
        <button className="tm-pb" disabled={page === 1} onClick={() => onPageChange(1)}>«</button>
        <button className="tm-pb" disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</button>
        {pages.map(p => (
          <button key={p} className={`tm-pb ${p === page ? 'active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        ))}
        <button className="tm-pb" disabled={page === tp} onClick={() => onPageChange(page + 1)}>›</button>
        <button className="tm-pb" disabled={page === tp} onClick={() => onPageChange(tp)}>»</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   KPI CARD
══════════════════════════════════════════════════════════════════════════ */
const KpiCard = ({ label, value, icon, accent, iconBg, sub }) => (
  <div className="tm-kpi tm-kpi--static" style={{ '--ka': accent, '--kib': iconBg }}>
    <div className="tm-kpi-ico">{icon}</div>
    <div className="tm-kpi-lbl">{label}</div>
    <div className="tm-kpi-val">{value ?? '—'}</div>
    {sub && <div className="tm-kpi-sub">{sub}</div>}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function TaskManagement() {
  useThemeVersion();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showWarning } = useToast();
  const isSA = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  // roleLevel fetched from role_hierarchy table — works for any custom role name
  const [roleLevel, setRoleLevel] = useState(null);
  // isManager: must be L3 AND role name must contain 'manager' (case-insensitive)
  // Examples that qualify:  ACCOUNT_MANAGER, PROCUREMENT_MANAGER, BD_MANAGER
  // Examples that don't:    BD_EXECUTIVE, SALES_EXEC, TELECALLER (even if L3)
  const isManager = !isSA && roleLevel === 3 && (user?.role || '').toLowerCase().includes('manager');
  const canSeeTeamTab = isSA || isManager;

  const [tasks, setTasks]       = useState([]);
  const [users, setUsers]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // only true on very first load

  // View persists within the browser session (sessionStorage resets when tab closes)
  const [view, setView] = useState(() => sessionStorage.getItem('tm_view') || 'table');
  const setViewAndStore = (v) => { setView(v); sessionStorage.setItem('tm_view', v); };
  const [activeKpi, setActiveKpi] = useState('All');
  const [showAdd, setShowAdd]     = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [logTask, setLogTask]     = useState(null);
  const [detailTask, setDetail]   = useState(null);
  const [showDayLog, setShowDayLog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // taskId to delete

  // FIX #3: debounced search — keeps cursor in place, avoids refetch on every keystroke
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const searchDebounceRef = useRef(null);
  const searchInputRef = useRef(null); // keeps cursor in place
  const handleSearchChange = (val) => {
    // Do NOT call setSearchInput here — that would re-render the input and lose cursor
    // Only update the committed search state after debounce
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchInput(val); // track for clear button
      setSearch(val);
    }, 500);
  };
  const [stFilter, setStFilter]   = useState('All');
  const [priFilter, setPriFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [empFilter, setEmpFilter] = useState('All');
  const [page, setPage]           = useState(1);

  /* ── Column sort ────────────────────────────────────────────────────── */
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  /* ── Column visibility & order ──────────────────────────────────────── */
  const ALL_COLS = [
    { id: 'sno',      label: 'S.No',       required: true },
    { id: 'task',     label: 'Task',        required: true },
    { id: 'project',  label: 'Project',     required: false },
    { id: 'category', label: 'Category',    required: false },
    { id: 'priority', label: 'Priority',    required: false },
    { id: 'status',   label: 'Status',      required: false },
    { id: 'progress', label: 'Progress',    required: false },
    { id: 'dates',    label: 'Start / End', required: false },
    { id: 'hours',    label: 'Hours',       required: false },
    { id: 'assignee', label: 'Assignee',    required: false },
    { id: 'due',      label: 'Due',         required: false },
    { id: 'actions',  label: 'Actions',     required: true },
  ];
  const [colOrder, setColOrder] = useState(() => ALL_COLS.map(c => c.id));
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [showColPanel, setShowColPanel] = useState(false);
  const colPanelRef = useRef(null);
  const colDragRef  = useRef(null);

  // Close col panel on outside click
  React.useEffect(() => {
    if (!showColPanel) return;
    const h = (e) => { if (colPanelRef.current && !colPanelRef.current.contains(e.target)) setShowColPanel(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showColPanel]);

  const toggleCol = (id) => setHiddenCols(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Column drag-reorder handlers
  const onColDragStart = (id) => { colDragRef.current = id; };
  const onColDragOver  = (e, id) => { e.preventDefault(); };
  const onColDrop      = (e, targetId) => {
    e.preventDefault();
    const srcId = colDragRef.current;
    if (!srcId || srcId === targetId) return;
    setColOrder(prev => {
      const arr = [...prev];
      const si = arr.indexOf(srcId);
      const ti = arr.indexOf(targetId);
      arr.splice(si, 1);
      arr.splice(ti, 0, srcId);
      return arr;
    });
    colDragRef.current = null;
  };
  const PER = 15;

  /* ── Fetch ─────────────────────────────────────────────────────────── */
  const [taskDateFrom, setTaskDateFrom] = useState('');
  const [taskDateTo,   setTaskDateTo]   = useState('');
  const [totalTasks,   setTotalTasks]   = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);
  const [pageSize,     setPageSize]     = useState(() => Number(localStorage.getItem('tm_page_size')) || 10);

  const buildTaskUrl = (pg = page, sz = pageSize) => {
    const params = new URLSearchParams();
    params.set('userId', user.id);
    params.set('page',   pg);
    params.set('size',   sz);
    if (search)       params.set('search',   search);
    if (stFilter !== 'All')  params.set('status',   stFilter);
    if (priFilter !== 'All') params.set('priority', priFilter);
    if (catFilter !== 'All') params.set('category', catFilter);
    if (taskDateFrom) params.set('dateFrom', taskDateFrom);
    if (taskDateTo)   params.set('dateTo',   taskDateTo);
    if (taskDateFrom || taskDateTo) { params.set('sortBy', 'dueDate'); params.set('sortDir', 'asc'); }
    return `${API}/tasks?` + params.toString();
  };

  const loadTasks = async (pg = page, sz = pageSize) => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch(buildTaskUrl(pg, sz), { credentials: 'include', headers: hdrs(user) });
      const d = await r.json();
      if (d.success) {
        setTasks(d.data);
        setTotalTasks(d.total);
        setTotalPages(d.totalPages || 1);
      } else { setTasks(mockTasks(user)); }
    } catch { setTasks(mockTasks(user)); }
    finally { setLoading(false); setInitialLoading(false); }
  };

  // Fetch the current user's level from role_hierarchy (runs once on mount)
  const loadRoleLevel = async () => {
    if (!user?.role) return;
    try {
      const r = await fetch(`${API}/role-hierarchy/${user.role}`, { credentials: 'include', headers: hdrs(user) });
      if (r.ok) {
        const d = await r.json();
        if (d?.levelOrder != null) setRoleLevel(d.levelOrder);
      }
    } catch {}
  };

  const loadUsers = async () => {
    if ((!isSA && roleLevel !== 3) || !user) return;
    try {
      const r = await fetch(`${API}/filters/leads-users`, { credentials: 'include', headers: hdrs(user) });
      const d = await r.json();
      if (Array.isArray(d)) setUsers(d);
    } catch {}
  };

  const loadProjects = async () => {
    if (!user) return;
    try {
      const r = await fetch(`${API}/projects`, { credentials: 'include', headers: hdrs(user) });
      const d = await r.json();
      if (Array.isArray(d)) setProjects(d);
      else if (d.success && Array.isArray(d.data)) setProjects(d.data);
      else setProjects(MOCK_PROJECTS);
    } catch { setProjects(MOCK_PROJECTS); }
  };

  // Initial load
  useEffect(() => {
    if (!user) return;
    loadRoleLevel();
    loadTasks(1);
    loadProjects();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load users once role level is known (managers need this for assign dropdown + team view)
  useEffect(() => {
    if (roleLevel === null) return;  // not fetched yet
    loadUsers();
  }, [roleLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when any filter changes — reset to page 1
  useEffect(() => {
    if (!user || view === 'team') return;
    setPage(1);
    loadTasks(1, pageSize);
  }, [search, stFilter, priFilter, catFilter, taskDateFrom, taskDateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── No client-side filter — backend handles search/filter/pagination ── */
  // tasks already filtered by backend; sort ASC by dueDate when date filter active
  const filtered = (taskDateFrom || taskDateTo)
    ? [...tasks].sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate) : new Date('9999-12-31');
        const db = b.dueDate ? new Date(b.dueDate) : new Date('9999-12-31');
        return da - db;
      })
    : tasks;

  /* ── Client-side sort of filtered rows ─────────────────────────────── */
  const sortedFiltered = React.useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'task':     va = a.title?.toLowerCase() || ''; vb = b.title?.toLowerCase() || ''; break;
        case 'project':  va = (a.projectName || a.otherContext || '').toLowerCase(); vb = (b.projectName || b.otherContext || '').toLowerCase(); break;
        case 'category': va = a.category?.toLowerCase() || ''; vb = b.category?.toLowerCase() || ''; break;
        case 'priority': va = ['Low','Medium','High','Critical'].indexOf(a.priority); vb = ['Low','Medium','High','Critical'].indexOf(b.priority); break;
        case 'status':   va = a.status?.toLowerCase() || ''; vb = b.status?.toLowerCase() || ''; break;
        case 'progress': va = parseFloat(a.completionPercent) || 0; vb = parseFloat(b.completionPercent) || 0; break;
        case 'hours':    va = computeHours(a) || 0; vb = computeHours(b) || 0; break;
        case 'assignee': va = a.assignedToName?.toLowerCase() || ''; vb = b.assignedToName?.toLowerCase() || ''; break;
        case 'due':      va = a.dueDate || '9999'; vb = b.dueDate || '9999'; break;
        default: return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = {
    total:     totalTasks,
    today:     tasks.filter(t => t.dueDate === todayStr()).length,
    overdue:   tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled' && t.dueDate && t.dueDate < todayStr()).length,
    completed: tasks.filter(t => t.status === 'Completed').length,
    critical:  tasks.filter(t => t.priority === 'Critical' || t.priority === 'High').length,
    hours:     tasks.reduce((s, t) => s + computeHours(t), 0).toFixed(1),  // FIX #4
  };

  /* ── CRUD ──────────────────────────────────────────────────────────── */
  const saveTask = async (form) => {
    const isNew = !form.id;
    try {
      const url = isNew ? `${API}/tasks` : `${API}/tasks/${form.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const r = await fetch(url, { method, credentials: 'include', headers: hdrs(user), body: JSON.stringify({ ...form, createdByName: user?.name }) });
      if (r.ok) {
        const d = await r.json();
        showSuccess(isNew ? 'Task created!' : 'Task updated!');
        // Use server response directly so completionPercent/hours are accurate
        if (d.success && d.data) {
          if (isNew) setTasks(p => [d.data, ...p]);
          else setTasks(p => p.map(t => t.id === form.id ? d.data : t));
        }
        loadTasks();
      } else throw new Error();
    } catch {
      showSuccess(isNew ? 'Task created (offline)!' : 'Task updated (offline)!');
      loadTasks();
    }
    setShowAdd(false); setEditTask(null);
  };

  const saveLog = async ({ taskId, workDone, updateType, hoursSpent, startTime, endTime, newStatus, completionPercent, blockedReason, notes, logDate }) => {
    const entryDate = logDate ? new Date(logDate + 'T' + (startTime || '00:00') + ':00').toISOString() : new Date().toISOString();
    const now = new Date().toISOString();
    const update = { id: Date.now(), updatedByName: user?.name, updatedAt: entryDate, workDone, updateType, hoursSpent, startTime, endTime, newStatus, completionPercent, blockedReason, notes, statusChanged: tasks.find(t => t.id === taskId)?.status !== newStatus };
    try {
      const r = await fetch(`${API}/tasks/${taskId}/update`, { method: 'POST', credentials: 'include', headers: hdrs(user), body: JSON.stringify({ workDone, updateType, hoursSpent, startTime, endTime, newStatus, completionPercent, blockedReason, notes, updatedByName: user?.name, logDate: logDate || todayStr() }) });
      if (r.ok) { showSuccess('Update logged! ✅'); loadTasks(); setLogTask(null); return; }
    } catch {}
    // Optimistic fallback
    setTasks(p => p.map(t => t.id === taskId ? { ...t, status: newStatus, completionPercent, closedAt: newStatus === 'Completed' ? now : t.closedAt, startedAt: t.startedAt || now, updates: [...(t.updates || []), update], totalHoursSpent: (parseFloat(t.totalHoursSpent) || 0) + (parseFloat(hoursSpent) || 0) } : t));
    showSuccess('Update logged! ✅');
    setLogTask(null);
  };

  // ← FIX: Board drag status change now calls backend
  const statusChange = async (task, newStatus) => {
    const now = new Date().toISOString();
    // Optimistic update immediately so board feels instant
    setTasks(p => p.map(t => t.id === task.id ? { ...t, status: newStatus, closedAt: newStatus === 'Completed' ? now : t.closedAt, startedAt: t.startedAt || (newStatus === 'In Progress' ? now : null) } : t));
    try {
      const r = await fetch(`${API}/tasks/${task.id}`, { method: 'PUT', credentials: 'include', headers: hdrs(user), body: JSON.stringify({ status: newStatus, closedAt: newStatus === 'Completed' ? now : null }) });
      if (!r.ok) throw new Error();
      showSuccess(`Moved to "${newStatus}"`);
    } catch {
      // Already updated optimistically — show gentle error but don't revert
      showSuccess(`Moved to "${newStatus}" (syncing…)`);
    }
  };

  const quickComplete = async (task) => {
    const now = new Date().toISOString();
    setTasks(p => p.map(t => t.id === task.id ? { ...t, status: 'Completed', completionPercent: 100, closedAt: now } : t));
    try {
      await fetch(`${API}/tasks/${task.id}`, { method: 'PUT', credentials: 'include', headers: hdrs(user), body: JSON.stringify({ status: 'Completed', completionPercent: 100, closedAt: now }) });
    } catch {}
    showSuccess('Marked complete! ✅');
  };

  const deleteTask = async (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirm;
    setDeleteConfirm(null);
    setTasks(p => p.filter(t => t.id !== id));
    setTotalTasks(p => Math.max(0, p - 1));   // FIX: keep count in sync
    try { await fetch(`${API}/tasks/${id}`, { method: 'DELETE', credentials: 'include', headers: hdrs(user) }); } catch {}
    showSuccess('Task deleted.');
  };

  const taskExportRows = () => filtered.map(t => ({
    'Task Code': t.taskCode, 'Title': t.title, 'Category': t.category,
    'Priority': t.priority, 'Status': t.status,
    'Project': t.projectName || t.otherContext || '—',
    'Assignee': t.assignedToName || '—', 'Related To': t.relatedTo || '—',
    'Due Date': t.dueDate || '—', 'Start Date': t.startDate ? t.startDate.slice(0, 16) : '—',
    'End Date': t.endDate ? t.endDate.slice(0, 16) : '—',
    'Est. Hours': t.estimatedHours || '—', 'Hours Spent': t.totalHoursSpent || 0,
    'Completion %': t.completionPercent || 0,
    'Started At': t.startedAt ? t.startedAt.slice(0, 16) : '—',
    'Closed At': t.closedAt ? t.closedAt.slice(0, 16) : '—',
    'Updates Count': (t.updates || []).length,
  }));

  /* ── Pagination — driven by backend totalPages ─────────────────────── */
  // already paginated by backend; sort ASC by dueDate when date filter active
  const paged = (taskDateFrom || taskDateTo)
    ? [...tasks].sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate) : new Date('9999-12-31');
        const db = b.dueDate ? new Date(b.dueDate) : new Date('9999-12-31');
        return da - db;
      })
    : tasks;

  const goToPage = (pg) => {
    setPage(pg);
    loadTasks(pg, pageSize);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changePageSize = (sz) => {
    localStorage.setItem('tm_page_size', sz);
    setPageSize(sz);
    setPage(1);
    loadTasks(1, sz);
  };

  // FIX: Never unmount the page for search/filter refreshes — only initial load uses preloader
  // (removed full-page `if (loading) return <CrmPreloader />` — it destroyed uncontrolled inputs)

  // Show full-page preloader ONLY on first load (not on filter/search refreshes)
  if (initialLoading && tasks.length === 0) return <CrmPreloader />;

  return (
    <div className="tm-root">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="tm-hdr">
        <div>
          <div className="tm-bc"><span>Main</span><span className="tm-bcs">›</span><span className="tm-bca">Task Management</span></div>
          <h1>Task Management</h1>
          <p className="tm-hdr-sub">{isSA ? `Your tasks — switch to Team View to see all members` : isManager ? `Your tasks — switch to Team View to see your team's tasks` : `Your tasks — ${tasks.length} assigned to you`}</p>
        </div>
        <div className="tm-hdr-acts">
          <div className="tm-view-tgl">
            {[['table', '☰ Table'], ['board', '⊞ Board'], ['today', '📅 Today'], canSeeTeamTab && ['team', '👥 Team']].filter(Boolean).map(([v, l]) => (
              <button key={v} className={`tm-vbtn ${view === v ? 'active' : ''}`} onClick={() => setViewAndStore(v)}>{l}</button>
            ))}
          </div>
          <button className="tm-btn tm-ghost" onClick={() => exportCSV(taskExportRows(), `tasks_${todayStr()}.csv`)}>📤 Export</button>
          <button className="tm-btn" style={{background:bg('#f0f9ff'),color:tc('#0369a1'),border:`1px solid ${bg('#bae6fd')}`,fontWeight:700}}
            onClick={() => setShowDayLog(true)} title="Record task progress or log today's activities">
            <FiClipboard size={14} style={{marginRight:5}} />Day Log
          </button>
          <button className="tm-btn tm-primary" onClick={() => setShowAdd(true)}><FiPlus size={15} style={{marginRight:6}} />Add Task</button>
        </div>
      </div>

      {/* KPIs — hidden when Super Admin is in Team View */}
      {view !== 'team' && (
        <div className="tm-kpi-row">
          <KpiCard label="Total" value={kpis.total} icon="📋" accent="#3b82f6" iconBg="#eff6ff" sub="My tasks" active={activeKpi === 'All'} onClick={() => { setActiveKpi('All'); setViewAndStore('table'); }} />
          <KpiCard label="Due Today" value={kpis.today} icon="📅" accent="#d97706" iconBg="#fffbeb" sub="Need action today" active={activeKpi === 'Today'} onClick={() => { setActiveKpi('Today'); setViewAndStore('table'); }} />
          <KpiCard label="Overdue" value={kpis.overdue} icon="🚨" accent="#dc2626" iconBg="#fef2f2" sub="Past due date" active={activeKpi === 'Overdue'} onClick={() => { setActiveKpi('Overdue'); setViewAndStore('table'); }} />
          <KpiCard label="Completed" value={kpis.completed} icon="✅" accent="#059669" iconBg="#ecfdf5" sub="Done" active={activeKpi === 'Completed'} onClick={() => { setActiveKpi('Completed'); setViewAndStore('table'); }} />
          <KpiCard label="High / Critical" value={kpis.critical} icon="🔥" accent="#7c3aed" iconBg="#f5f3ff" sub="Urgent tasks" active={activeKpi === 'Critical'} onClick={() => { setActiveKpi('Critical'); setViewAndStore('table'); }} />
          <KpiCard label="Hours Logged" value={`${kpis.hours}h`} icon="⏱" accent="#0891b2" iconBg="#ecfeff" sub="My total" />
        </div>
      )}

      {/* Team View */}
      {view === 'team' && canSeeTeamTab && <TeamView user={user} users={users} onDetail={setDetail} onExportCSV={exportCSV} />}

      {/* Today View */}
      {view === 'today' && <TodaySummary tasks={tasks} onLog={setLogTask} onDetail={setDetail} />}

      {/* Board View */}
      {view === 'board' && (
        <>
          <div className="tm-filters-bar">
            <div className="tm-srch-wrap"><span>🔍</span><input className="tm-srch" placeholder="Search tasks…" ref={searchInputRef} onChange={e => handleSearchChange(e.target.value)} />{search && <button className="tm-clr" onClick={() => { if(searchInputRef.current) searchInputRef.current.value=''; setSearchInput(''); setSearch(''); }}>✕</button>}</div>
            {/* Date range for board view — calls backend */}
            <DateRangeFilter
              appliedFrom={taskDateFrom} appliedTo={taskDateTo}
              onApply={(f,t)=>{setTaskDateFrom(f);setTaskDateTo(t);}}
              onClear={()=>{setTaskDateFrom('');setTaskDateTo('');}}
            />
            {isSA && <FilterSelect value={empFilter} onChange={v => setEmpFilter(v)} options={[{value:'All',label:'All Members'}, ...users.map(u=>({value:String(u.id),label:u.name}))]} placeholder="All Members" />}
            <span className="tm-fcount">{totalTasks} tasks</span>
          </div>
          <BoardView tasks={filtered} onLog={setLogTask} onDetail={setDetail} onEdit={setEditTask} onStatusChange={statusChange} isSuperAdmin={isSA} />
          <PaginationBar page={page} totalPages={totalPages} total={totalTasks} pageSize={pageSize} onPageChange={goToPage} onSizeChange={changePageSize} />
        </>
      )}

      {/* Table View */}
      {view === 'table' && (
        <>
          <div className="tm-filters-bar">
            <div className="tm-srch-wrap"><span>🔍</span><input className="tm-srch" placeholder="Search tasks, projects, code…" ref={searchInputRef} onChange={e => handleSearchChange(e.target.value)} />{search && <button className="tm-clr" onClick={() => { if(searchInputRef.current) searchInputRef.current.value=''; setSearchInput(''); setSearch(''); }}>✕</button>}</div>
            {/* Date range — available to ALL users, triggers backend call */}
            <DateRangeFilter
              appliedFrom={taskDateFrom} appliedTo={taskDateTo}
              onApply={(f,t)=>{setTaskDateFrom(f);setTaskDateTo(t);}}
              onClear={()=>{setTaskDateFrom('');setTaskDateTo('');}}
            />
            <div className="tm-fg-row">
              <FilterSelect value={stFilter} onChange={v => setStFilter(v)} options={[{value:'All',label:'All Status'}, ...STATUSES.map(s=>({value:s,label:s}))]} placeholder="All Status" />
              <FilterSelect value={priFilter} onChange={v => setPriFilter(v)} options={[{value:'All',label:'All Priority'}, ...PRIORITIES.map(p=>({value:p,label:p}))]} placeholder="All Priority" />
              <FilterSelect value={catFilter} onChange={v => setCatFilter(v)} options={[{value:'All',label:'All Categories'}, ...CATEGORIES.map(c=>({value:c,label:c}))]} placeholder="All Categories" />
              {isSA && <FilterSelect value={empFilter} onChange={v => setEmpFilter(v)} options={[{value:'All',label:'All Assignees'}, ...users.map(u=>({value:String(u.id),label:u.name}))]} placeholder="All Assignees" />}
            </div>
            {/* Columns button */}
            <div style={{position:'relative'}} ref={colPanelRef}>
              <button className="tm-btn tm-ghost tm-sm" onClick={() => setShowColPanel(v => !v)} title="Show/hide columns" style={{display:'flex',alignItems:'center',gap:5}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
                Columns
              </button>
              {showColPanel && (
                <div className="tm-col-panel">
                  <div className="tm-col-panel-hdr">
                    <span>Columns</span>
                    <span style={{fontSize:10,color:tc('#94a3b8')}}>drag to reorder</span>
                  </div>
                  {colOrder.map(id => {
                    const col = ALL_COLS.find(c => c.id === id);
                    if (!col) return null;
                    // Hide assignee toggle for non-SA
                    if (col.id === 'assignee' && !isSA) return null;
                    const isHidden = hiddenCols.has(id);
                    return (
                      <div key={id} className="tm-col-item"
                        draggable={!col.required}
                        onDragStart={() => onColDragStart(id)}
                        onDragOver={(e) => onColDragOver(e, id)}
                        onDrop={(e) => onColDrop(e, id)}>
                        <span className="tm-col-drag">⠿</span>
                        <label className="tm-col-label">
                          <input type="checkbox" checked={!isHidden} disabled={col.required}
                            onChange={() => !col.required && toggleCol(id)} />
                          {col.label}
                        </label>
                        {col.required && <span style={{fontSize:9,color:tc('#cbd5e1'),marginLeft:'auto'}}>fixed</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="tm-card">
            {loading ? (
              <div style={{padding:'40px 24px',textAlign:'center',color:tc('#94a3b8')}}>
                <div style={{fontSize:22,marginBottom:8}}>⏳</div>
                <p style={{fontSize:13,margin:0}}>Loading…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="tm-empty"><div style={{ fontSize: 36 }}><FiList size={36} color="#94a3b8" /></div><p>No tasks match your filters.</p></div>
            ) : (
              <>
                {(() => {
                  const visibleCols = colOrder.filter(id => !hiddenCols.has(id) && (id !== 'assignee' || isSA));
                  const SortIcon = ({ col }) => {
                    if (sortCol !== col) return <span className="tm-sort-icon tm-sort-idle">↕</span>;
                    return <span className="tm-sort-icon tm-sort-active">{sortDir === 'asc' ? '↑' : '↓'}</span>;
                  };
                  const colHeaders = {
                    sno:      { label: 'S.No',       sortable: false },
                    task:     { label: 'Task',        sortable: true  },
                    project:  { label: 'Project',     sortable: true  },
                    category: { label: 'Category',    sortable: true  },
                    priority: { label: 'Priority',    sortable: true  },
                    status:   { label: 'Status',      sortable: true  },
                    progress: { label: 'Progress',    sortable: true  },
                    dates:    { label: 'Start / End', sortable: false },
                    hours:    { label: 'Hours',       sortable: true  },
                    assignee: { label: 'Assignee',    sortable: true  },
                    due:      { label: 'Due',         sortable: true  },
                    actions:  { label: 'Actions',     sortable: false },
                  };
                  // client-side page from sortedFiltered
                  const pagedSorted = sortedFiltered.slice((page-1)*pageSize, page*pageSize);
                  return (
                    <div className="tm-tbl-scroll-wrap">
                      <table className="tm-tbl tm-tbl-fixed">
                        <thead>
                          <tr>
                            {visibleCols.map((id, ci) => {
                              const h = colHeaders[id];
                              return (
                                <th key={id}
                                  draggable
                                  onDragStart={() => onColDragStart(id)}
                                  onDragOver={(e) => onColDragOver(e, id)}
                                  onDrop={(e) => onColDrop(e, id)}
                                  onClick={() => h.sortable && toggleSort(id)}
                                  className={`tm-th-drag ${h.sortable ? 'tm-th-sort' : ''} ${sortCol === id ? 'tm-th-active' : ''}`}
                                >
                                  <span className="tm-th-inner">
                                    <span className="tm-th-grip">⠿</span>
                                    {h.label}
                                    {h.sortable && <SortIcon col={id} />}
                                  </span>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedSorted.map((task, taskIndex) => {
                            const isOD = task.status !== 'Completed' && task.status !== 'Cancelled' && task.dueDate && task.dueDate < todayStr();
                            const totalH = computeHours(task) || parseFloat(task.totalHoursSpent) || 0;
                            const cellMap = {
                              sno:      <td key="sno" style={{textAlign:'center',fontWeight:700,color:tc('#374151'),fontSize:12}}>{(page-1)*pageSize + taskIndex + 1}</td>,
                              task:     <td key="task"><div className="tm-task-cell"><span className="tm-tcode">{task.taskCode}</span><span className="tm-ttitle">{task.title}</span>{task.relatedTo && <span className="tm-trel">↳ {task.relatedTo}</span>}</div></td>,
                              project:  <td key="project">{task.projectName ? <span className="tm-chip tm-chip-blue"><FiBriefcase size={11} style={{marginRight:3}} />{task.projectName}</span> : task.otherContext ? <span className="tm-chip tm-chip-orange"><FiTag size={11} style={{marginRight:3}} />{task.otherContext}</span> : <span className="tm-nodash">—</span>}</td>,
                              category: <td key="category"><span className="tm-chip">📁 {task.category}</span></td>,
                              priority: <td key="priority"><PBadge p={task.priority} /></td>,
                              status:   <td key="status"><SBadge s={task.status} /></td>,
                              progress: <td key="progress"><div className="tm-mini-prog"><div className="tm-mini-bar"><div className="tm-mini-fill" style={{ width: `${task.completionPercent || 0}%`, background: (task.completionPercent || 0) >= 100 ? bg('#059669') : bg('#3b82f6') }} /></div><span>{task.completionPercent || 0}%</span></div></td>,
                              dates:    <td key="dates"><div style={{ fontSize: 11, lineHeight: 1.7, color: tc('#1e293b'), fontWeight: 500 }}>{task.startDate ? <div>▶ {fmtDT(task.startDate)}</div> : <span className="tm-nodash">No start</span>}{task.endDate ? <div style={{ color: tc('#059669'), fontWeight: 600 }}>■ {fmtDT(task.endDate)}</div> : null}</div></td>,
                              hours:    <td key="hours">{totalH > 0 ? <span className="tm-hours-pill"><FiClock size={11} style={{marginRight:3}} />{totalH.toFixed(1)}h</span> : <span className="tm-nodash">—</span>}</td>,
                              assignee: <td key="assignee"><span className="tm-assignee">{task.assignedToName || '—'}</span></td>,
                              due:      <td key="due"><span className={`tm-due ${isOD ? 'tm-due-od' : ''}`}>{isOD ? '🚨 ' : ''}{fmtDate(task.dueDate)}</span></td>,
                              actions:  <td key="actions" onClick={e => e.stopPropagation()}><div className="tm-acts"><button className="tm-act tm-act-log" title="Add Work Entry" onClick={() => setLogTask(task)}><FiClipboard size={15} /></button>{task.status !== 'Completed' && task.status !== 'Cancelled' && (<button className="tm-act tm-act-done" title="Mark Complete" onClick={() => quickComplete(task)}><FiCheckCircle size={15} /></button>)}<button className="tm-act tm-act-edit" title="Edit" onClick={() => setEditTask(task)}><FiEdit size={15} /></button>{isSA && <button className="tm-act tm-act-del" title="Delete" onClick={() => deleteTask(task.id)}><FiTrash2 size={15} /></button>}</div></td>,
                            };
                            return (
                              <tr key={task.id} className={`tm-tr ${isOD ? 'tm-tr-od' : ''} ${task.status === 'Completed' ? 'tm-tr-done' : ''}`} onClick={() => setDetail(task)}>
                                {visibleCols.map(id => cellMap[id])}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
                <PaginationBar page={page} totalPages={totalPages} total={totalTasks} pageSize={pageSize} onPageChange={goToPage} onSizeChange={changePageSize} />
              </>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showAdd    && <TaskFormModal task={null}    users={users} projects={projects} user={user} isSuperAdmin={isSA} isManager={isManager} onClose={() => setShowAdd(false)} onSave={saveTask} />}
      {editTask   && <TaskFormModal task={editTask} users={users} projects={projects} user={user} isSuperAdmin={isSA} isManager={isManager} onClose={() => setEditTask(null)} onSave={saveTask} />}
      {logTask    && <DailyLogModal task={logTask} onClose={() => setLogTask(null)} onSave={saveLog} />}
      {detailTask && <TaskDetailModal task={detailTask} onClose={() => setDetail(null)} onLog={setLogTask} isSuperAdmin={isSA} />}
      {showDayLog && <DayLogModal user={user} tasks={tasks} projects={projects} onClose={() => setShowDayLog(false)} onSaveTaskLog={saveLog} onSaveActivity={saveTask} />}


      {/* ── Bootstrap-style Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:9999, padding:16,
        }}>
          <div style={{
            background:bg('#fff'), borderRadius:16, padding:'36px 32px 28px',
            width:'min(420px,94vw)', textAlign:'center',
            boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
            animation:'tm-pop .18s ease',
          }}>
            {/* Trash icon circle */}
            <div style={{
              width:64, height:64, borderRadius:'50%',
              background:bg('#fff0f0'), border:`1px solid ${bg('#fecaca')}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 20px', fontSize:26,
            }}><FiTrash2 size={28} color="#dc2626" /></div>
            <h3 style={{ margin:'0 0 10px', fontSize:20, fontWeight:700, color:tc('#0f172a') }}>
              Delete Task
            </h3>
            <p style={{ margin:'0 0 28px', fontSize:14, color:tc('#64748b'), lineHeight:1.6 }}>
              Are you sure you want to delete this task?<br />
              <strong style={{ color:tc('#dc2626') }}>This action cannot be undone.</strong>
            </p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex:1, padding:'10px 20px', borderRadius:10,
                  border:`1.5px solid ${bg('#e2e8f0')}`, background:bg('#fff'),
                  fontSize:14, fontWeight:600, color:tc('#374151'), cursor:'pointer',
                }}>
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  flex:1, padding:'10px 20px', borderRadius:10,
                  border:'none', background:bg('#dc2626'),
                  fontSize:14, fontWeight:600, color:tc('#fff'), cursor:'pointer',
                }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}