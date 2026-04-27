// TaskManagement.js — Complete Task Management System v3
// Fixes: board drag→backend, SA own-tasks default, start/end datetime,
//        projects from DB, team view search+table+export, all edge cases
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer';
import CrmPreloader from '../components/preLoader';
import '../pages-css/TaskManagement.css';

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
    if (!form.workDone.trim()) return;
    setSaving(true);
    // Combine summary + detail into workDone for backend; store detail in notes if present
    const combined = form.description.trim()
      ? `${form.workDone.trim()}\n\n${form.description.trim()}`
      : form.workDone.trim();
    await onSave({ taskId: task.id, ...form, workDone: combined, hoursSpent: parseFloat(form.hoursSpent) || 0 });
    setSaving(false);
  };

  const isComplete = form.newStatus === 'Completed';

  return (
    <div className="tm-overlay">
      <div className="tm-modal tm-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="tm-mhdr">
          <div>
            <h2>📝 Add Work Entry</h2>
            <p className="tm-msub">Describe what you did on this task — be as detailed as possible</p>
          </div>
          <button className="tm-xbtn" onClick={onClose}>✕</button>
        </div>

        {/* Task context strip */}
        <div className="tm-mtask-strip">
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span className="tm-tcode">{task.taskCode}</span>
            <strong style={{fontSize:14,color:'#0f172a'}}>{task.title}</strong>
          </div>
          <div className="tm-strip-row" style={{marginTop:6}}>
            <PBadge p={task.priority} />
            <span className="tm-chip">📁 {task.category}</span>
            {task.projectName && <span className="tm-chip tm-chip-blue">🏗️ {task.projectName}</span>}
            {task.relatedTo && <span className="tm-chip" style={{color:'#7c3aed',background:'#f5f3ff'}}>↳ {task.relatedTo}</span>}
          </div>
        </div>

        <div className="tm-mbody">
          {/* ── Log Date ── */}
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14,padding:'10px 14px',background:'#f0f7ff',borderRadius:8,border:'1px solid #bfdbfe'}}>
            <label style={{fontSize:12,fontWeight:700,color:'#1e40af',whiteSpace:'nowrap'}}>📅 Log Date</label>
            <input type="date" className="tm-inp" style={{maxWidth:180,fontSize:13}}
              value={form.logDate}
              max={todayStr()}
              onChange={e => set('logDate', e.target.value)}
            />
            <span style={{fontSize:11,color:'#64748b'}}>
              {form.logDate === todayStr() ? 'Today' : form.logDate < todayStr() ? 'Past entry' : ''}
            </span>
          </div>

          {/* ── Section 1: What you did ── */}
          <div style={{background:'#f8fafc',borderRadius:10,padding:'14px 16px',marginBottom:16,border:'1px solid #f1f5f9'}}>
            <div className="tm-fg" style={{margin:'0 0 12px'}}>
              <label style={{fontWeight:700,color:'#0f172a',fontSize:13}}>
                Work Summary <span className="tm-req">*</span>
                <span style={{fontWeight:400,color:'#94a3b8',fontSize:11,marginLeft:6}}>One line — what did you work on?</span>
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
              <label style={{fontWeight:700,color:'#0f172a',fontSize:13}}>
                Detailed Description
                <span style={{fontWeight:400,color:'#94a3b8',fontSize:11,marginLeft:6}}>What exactly happened? Include outcomes, discussions, decisions</span>
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
                <div style={{fontSize:10,color:'#94a3b8',textAlign:'right',marginTop:2}}>{form.description.length} chars</div>
              )}
            </div>
          </div>

          {/* ── Section 2: Status & Progress ── */}
          <div className="tm-frow" style={{marginBottom:12}}>
            <div className="tm-fg">
              <label>Entry Type</label>
              <select className="tm-sel" value={form.updateType} onChange={e => set('updateType', e.target.value)}>
                {UPDATE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="tm-fg">
              <label>Update Status To</label>
              <select className="tm-sel" value={form.newStatus}
                style={{borderColor: isComplete ? '#059669' : undefined, background: isComplete ? '#f0fdf4' : undefined}}
                onChange={e => { const v = e.target.value; set('newStatus', v); if (v === 'Completed') set('completionPercent', 100); }}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ── Section 3: Time ── */}
          <div className="tm-frow tm-frow3" style={{marginBottom:12}}>
            <div className="tm-fg">
              <label>Start Time</label>
              <input type="time" className="tm-inp" value={form.startTime} onChange={e => set('startTime', e.target.value)} />
            </div>
            <div className="tm-fg">
              <label>End Time</label>
              <input type="time" className="tm-inp" value={form.endTime} onChange={e => set('endTime', e.target.value)} />
            </div>
            <div className="tm-fg">
              <label>Hours Spent <span className="tm-hint">(auto-calc)</span></label>
              <input type="number" className="tm-inp" min="0" max="24" step="0.5" placeholder="e.g. 2.5" value={form.hoursSpent} onChange={e => set('hoursSpent', e.target.value)} />
            </div>
          </div>

          {/* Blocked reason — only if blocked */}
          {form.updateType === 'Blocked' && (
            <div className="tm-fg" style={{background:'#fef2f2',padding:'12px',borderRadius:8,border:'1px solid #fca5a5'}}>
              <label style={{color:'#dc2626'}}>🔴 What is blocking this task? <span className="tm-req">*</span></label>
              <textarea className="tm-ta" rows={2} placeholder="Describe the blocker clearly..." value={form.blockedReason} onChange={e => set('blockedReason', e.target.value)} />
            </div>
          )}

          {/* ── Section 4: Progress ── */}
          <div className="tm-fg">
            <label>
              Completion Progress
              <span className="tm-pval" style={{marginLeft:8,fontSize:14,fontWeight:800,color: form.completionPercent>=100?'#059669':'#3b82f6'}}>
                {form.completionPercent}%
              </span>
              {form.completionPercent >= 100 && <span style={{marginLeft:6,fontSize:11,color:'#059669',fontWeight:600}}>✓ Complete!</span>}
            </label>
            <input type="range" min={0} max={100} step={5} className="tm-range" value={form.completionPercent}
              onChange={e => { const v = Number(e.target.value); set('completionPercent', v); if(v===100) set('newStatus','Completed'); }} />
            <div className="tm-range-ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
          </div>

          {/* ── Section 5: Extra notes ── */}
          <div className="tm-fg">
            <label>
              Follow-up Notes
              <span style={{fontWeight:400,color:'#94a3b8',fontSize:11,marginLeft:6}}>Next steps, reminders, client feedback...</span>
            </label>
            <textarea className="tm-ta" rows={2} placeholder="e.g. Client to revert by Friday. Need approval from manager before proceeding..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="tm-mftr">
          <button className="tm-btn tm-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="tm-btn tm-primary" onClick={submit} disabled={saving || !form.workDone.trim()}>
            {saving ? 'Saving…' : isComplete ? '✅ Save & Mark Complete' : '💾 Save Work Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   BULK DAY LOG MODAL — log updates for multiple tasks at end of day
══════════════════════════════════════════════════════════════════════════ */
const BulkDayLogModal = ({ tasks, onClose, onSaveAll }) => {
  const activeTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');
  const [entries, setEntries] = useState(() =>
    activeTasks.map(t => ({
      taskId: t.id, taskCode: t.taskCode, title: t.title, category: t.category,
      priority: t.priority, projectName: t.projectName, status: t.status,
      completionPercent: t.completionPercent || 0,
      checked: false,
      workDone: '', description: '', updateType: 'Progress Update', hoursSpent: '',
      startTime: '', endTime: '', newStatus: t.status, notes: '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [logDate] = useState(todayStr());

  const toggle = (i) => setEntries(p => p.map((e, idx) => idx === i ? { ...e, checked: !e.checked } : e));
  const setField = (i, k, v) => setEntries(p => p.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const checkedCount = entries.filter(e => e.checked).length;
  const totalHrs = entries.filter(e => e.checked).reduce((s, e) => s + (parseFloat(e.hoursSpent) || 0), 0);

  const handleSubmit = async () => {
    const toSave = entries.filter(e => e.checked && e.workDone.trim());
    if (!toSave.length) return;
    setSaving(true);
    await onSaveAll(toSave);
    setSaving(false);
  };

  const selectAll = () => setEntries(p => p.map(e => ({ ...e, checked: true })));
  const clearAll  = () => setEntries(p => p.map(e => ({ ...e, checked: false })));

  return (
    <div className="tm-overlay">
      <div className="tm-modal" style={{width:'min(820px,96vw)',maxHeight:'90vh',display:'flex',flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <div className="tm-mhdr">
          <div>
            <h2>📓 Log My Day</h2>
            <p className="tm-msub">Update all your tasks at once — check the ones you worked on today</p>
          </div>
          <button className="tm-xbtn" onClick={onClose}>✕</button>
        </div>

        {/* Summary bar */}
        <div style={{padding:'10px 20px',background:'#f8fafc',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#64748b'}}>{activeTasks.length} active tasks</span>
          <span style={{fontSize:12,fontWeight:700,color:'#3b82f6'}}>{checkedCount} selected</span>
          {totalHrs > 0 && <span style={{fontSize:12,fontWeight:700,color:'#059669'}}>⏱ {totalHrs.toFixed(1)}h total today</span>}
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <button className="tm-btn tm-ghost tm-sm" onClick={selectAll}>Select All</button>
            <button className="tm-btn tm-ghost tm-sm" onClick={clearAll}>Clear</button>
          </div>
        </div>

        {activeTasks.length === 0 ? (
          <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}>
            <div style={{fontSize:36,marginBottom:8}}>🎉</div>
            <p style={{fontSize:14,margin:0}}>All tasks are completed or cancelled — nothing to log!</p>
          </div>
        ) : (
          <div className="tm-mbody" style={{flex:1,overflowY:'auto',padding:'0'}}>
            {entries.map((e, i) => (
              <div key={e.taskId} style={{
                borderBottom:'1px solid #f1f5f9',
                background: e.checked ? '#f0f7ff' : '#fff',
                transition:'background .15s',
              }}>
                {/* Task header row — click anywhere to toggle */}
                <div
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',cursor:'pointer'}}
                  onClick={() => toggle(i)}
                >
                  <div style={{
                    width:20, height:20, borderRadius:5, flexShrink:0,
                    border: e.checked ? 'none' : '2px solid #cbd5e1',
                    background: e.checked ? '#3b82f6' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all .15s',
                  }}>
                    {e.checked && <span style={{color:'#fff',fontSize:13,lineHeight:1}}>✓</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:10,fontFamily:'monospace',fontWeight:700,color:'#94a3b8'}}>{e.taskCode}</span>
                      <PBadge p={e.priority} />
                      <span className="tm-chip">📁 {e.category}</span>
                      {e.projectName && <span className="tm-chip tm-chip-blue">🏗️ {e.projectName}</span>}
                    </div>
                    <p style={{margin:'3px 0 0',fontSize:13,fontWeight:600,color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.title}</p>
                  </div>
                  <SBadge s={e.status} />
                </div>

                {/* Expanded log form — only when checked */}
                {e.checked && (
                  <div style={{padding:'0 20px 16px 52px',display:'flex',flexDirection:'column',gap:10}} onClick={ev => ev.stopPropagation()}>
                    <div className="tm-fg" style={{margin:0}}>
                      <label>Summary <span className="tm-req">*</span>
                        <span style={{fontWeight:400,color:'#94a3b8',fontSize:11,marginLeft:6}}>One line — what did you do?</span>
                      </label>
                      <input className="tm-inp"
                        placeholder="e.g. Completed proposal draft, sent to client..."
                        value={e.workDone}
                        onChange={ev => setField(i,'workDone',ev.target.value)}
                      />
                    </div>
                    <div className="tm-fg" style={{margin:0}}>
                      <label>Details
                        <span style={{fontWeight:400,color:'#94a3b8',fontSize:11,marginLeft:6}}>Outcomes, discussions, decisions, next steps...</span>
                      </label>
                      <textarea className="tm-ta" rows={3}
                        placeholder="Describe in detail what happened, what was achieved, any blockers or decisions..."
                        value={e.description}
                        onChange={ev => setField(i,'description',ev.target.value)}
                        style={{fontSize:12,lineHeight:1.6}}
                      />
                    </div>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                      <div className="tm-fg" style={{flex:1,minWidth:130,margin:0}}>
                        <label>Update Type</label>
                        <select className="tm-sel" value={e.updateType} onChange={ev => setField(i,'updateType',ev.target.value)}>
                          {UPDATE_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="tm-fg" style={{flex:1,minWidth:130,margin:0}}>
                        <label>Status</label>
                        <select className="tm-sel" value={e.newStatus}
                          onChange={ev => { setField(i,'newStatus',ev.target.value); if(ev.target.value==='Completed') setField(i,'completionPercent',100); }}>
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="tm-fg" style={{width:90,margin:0}}>
                        <label>Start</label>
                        <input type="time" className="tm-inp" value={e.startTime} onChange={ev => setField(i,'startTime',ev.target.value)} />
                      </div>
                      <div className="tm-fg" style={{width:90,margin:0}}>
                        <label>End</label>
                        <input type="time" className="tm-inp" value={e.endTime} onChange={ev => setField(i,'endTime',ev.target.value)} />
                      </div>
                      <div className="tm-fg" style={{width:90,margin:0}}>
                        <label>Hours</label>
                        <input type="number" className="tm-inp" min="0" max="24" step="0.5" placeholder="hrs"
                          value={e.hoursSpent} onChange={ev => setField(i,'hoursSpent',ev.target.value)} />
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <label style={{fontSize:11,fontWeight:600,color:'#64748b',whiteSpace:'nowrap'}}>Progress: {e.completionPercent}%</label>
                      <input type="range" min={0} max={100} step={5} className="tm-range" style={{flex:1}}
                        value={e.completionPercent} onChange={ev => setField(i,'completionPercent',Number(ev.target.value))} />
                    </div>
                    <div className="tm-fg" style={{margin:0}}>
                      <label>Notes <span style={{fontSize:10,color:'#94a3b8'}}>(optional)</span></label>
                      <input className="tm-inp" placeholder="Any decisions, blockers, follow-ups..."
                        value={e.notes} onChange={ev => setField(i,'notes',ev.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="tm-mftr" style={{borderTop:'2px solid #f1f5f9'}}>
          <div style={{fontSize:12,color:'#64748b'}}>
            {checkedCount > 0
              ? `Saving ${checkedCount} update${checkedCount>1?'s':''}${totalHrs>0?` · ⏱ ${totalHrs.toFixed(1)}h`:''}`
              : 'Select tasks you worked on today'}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="tm-btn tm-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="tm-btn tm-primary" onClick={handleSubmit}
              disabled={saving || checkedCount === 0 || entries.filter(e=>e.checked&&e.workDone.trim()).length === 0}>
              {saving ? 'Saving…' : `💾 Save ${checkedCount > 0 ? checkedCount : ''} Update${checkedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   QUICK SELF-TASK MODAL — simple "what did I work on today"
══════════════════════════════════════════════════════════════════════════ */
const QuickSelfTaskModal = ({ user, projects, onClose, onSave }) => {
  const [entries, setEntries] = useState([
    { id: Date.now(), title: '', description: '', category: 'Internal Work', hours: '', projectId: '', otherProject: '', logDate: todayStr(), startTime: '', endTime: '' }
  ]);
  const [saving, setSaving] = useState(false);

  const addRow = () => setEntries(p => [...p, { id: Date.now()+p.length, title: '', description: '', category: 'Internal Work', hours: '', projectId: '', otherProject: '', logDate: todayStr(), startTime: '', endTime: '' }]);
  const removeRow = (id) => setEntries(p => p.filter(e => e.id !== id));
  const setField = (id, k, v) => setEntries(p => p.map(e => e.id === id ? { ...e, [k]: v } : e));

  const totalHrs = entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);

  const submit = async () => {
    const valid = entries.filter(e => e.title.trim());
    if (!valid.length) return;
    setSaving(true);
    // Each entry becomes a task assigned to self, already in "Completed" for today
    for (const e of valid) {
      const isOther = e.projectId === 'OTHER';
      const proj = !isOther ? projects.find(p => (p.projectUniqueId || p.id) === e.projectId) : null;
      const hrs = parseFloat(e.hours) || 0;
      const entryDate = e.logDate || todayStr();
      // Build precise start/end datetime from logDate + times
      const startDT = entryDate + 'T' + (e.startTime || '00:00') + ':00';
      const endDT   = entryDate + 'T' + (e.endTime   || e.startTime || '23:59') + ':00';
      await onSave({
        title: e.title.trim(),
        description: e.description.trim(),
        category: e.category,
        priority: 'Medium',
        status: 'Completed',
        dueDate: todayStr(),          // due date = today (task deadline)
        startDate: startDT,           // actual work start = logDate + startTime
        endDate: endDT,               // actual work end   = logDate + endTime
        assignedTo: user?.id,
        assignedToName: user?.name,
        projectId: isOther ? null : (e.projectId || null),
        projectName: isOther ? null : (proj?.projectName || null),
        otherContext: isOther ? (e.otherProject || 'Other work') : null,
        estimatedHours: hrs || null,
        relatedTo: '',
        completionPercent: 100,
        isSelfLog: true,
        workLog: {
          workDone: e.title.trim(),
          description: e.description.trim(),
          hoursSpent: hrs,
          startTime: e.startTime || null,
          endTime: e.endTime || null,
          logDate: entryDate,           // so TaskUpdateEntity.updatedAt = logDate
          updateType: 'Task Completed',
          newStatus: 'Completed',
          completionPercent: 100,
        },
      });
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="tm-overlay">
      <div className="tm-modal tm-modal-lg" onClick={e => e.stopPropagation()} style={{width:'min(780px,97vw)',maxHeight:'92vh'}}>
        <div className="tm-mhdr">
          <div>
            <h2>⚡ Quick Work Log</h2>
            <p className="tm-msub">Record what you worked on today — these are logged as completed tasks assigned to you</p>
          </div>
          <button className="tm-xbtn" onClick={onClose}>✕</button>
        </div>
        <div className="tm-mbody" style={{padding:'20px 24px',overflowY:'auto'}}>
          <div style={{background:'#f0f7ff',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#2563eb',display:'flex',alignItems:'center',gap:8}}>
            <span>💡</span>
            <span>Use this to quickly record all work done today without setting up full tasks. Each row = one activity.</span>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {entries.map((e, i) => (
              <div key={e.id} style={{background:'#f8fafc',borderRadius:10,padding:'14px',border:'1px solid #f1f5f9'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:8}}>
                  <div style={{flex:1}}>
                    <input className="tm-inp" style={{marginBottom:6,fontWeight:600}}
                      placeholder={`Activity ${i+1} — e.g. Client call with Raju Solar, drafted proposal...`}
                      value={e.title} onChange={ev => setField(e.id,'title',ev.target.value)}
                    />
                    <textarea className="tm-ta" rows={3} style={{fontSize:12,lineHeight:1.6,minHeight:65}}
                      placeholder="Describe what you did, what was the outcome, any decisions made..."
                      value={e.description} onChange={ev => setField(e.id,'description',ev.target.value)}
                    />
                  </div>
                  <button onClick={() => removeRow(e.id)}
                    style={{border:'none',background:'transparent',cursor:'pointer',color:'#94a3b8',fontSize:16,padding:'8px 4px',lineHeight:1,flexShrink:0}}
                    disabled={entries.length === 1}>✕</button>
                </div>
                {/* FIX #2: Date + time fields */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 80px',gap:8,marginBottom:8}}>
                  <div><label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:3}}>📅 Date</label><input type="date" className="tm-inp" value={e.logDate||todayStr()} onChange={ev => setField(e.id,'logDate',ev.target.value)} /></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:3}}>🕐 Start</label><input type="time" className="tm-inp" value={e.startTime||''} onChange={ev => setField(e.id,'startTime',ev.target.value)} /></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:3}}>🕐 End</label><input type="time" className="tm-inp" value={e.endTime||''} onChange={ev => setField(e.id,'endTime',ev.target.value)} /></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:3}}>⏱ Hrs</label><input type="number" className="tm-inp" min="0" step="0.5" placeholder="hrs" value={e.hours} onChange={ev => setField(e.id,'hours',ev.target.value)} /></div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,alignItems:'start'}}>
                  <select className="tm-sel" value={e.category} onChange={ev => setField(e.id,'category',ev.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select className="tm-sel" style={{width:'100%',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis'}} value={e.projectId} onChange={ev => setField(e.id,'projectId',ev.target.value)}>
                    <option value="">— No project —</option>
                    {projects.map(p => <option key={p.projectUniqueId||p.id} value={p.projectUniqueId||p.id}>{p.projectName}</option>)}
                    <option value="OTHER">📌 Other / Ad-hoc</option>
                  </select>
                  {e.projectId === 'OTHER' && (
                    <input className="tm-inp" style={{marginTop:6}} placeholder="Describe context — e.g. Admin, Training, Internal..."
                      value={e.otherProject||''} onChange={ev => setField(e.id,'otherProject',ev.target.value)} />
                  )}
                  <input type="number" className="tm-inp" min="0" step="0.5" placeholder="hrs"
                    value={e.hours} onChange={ev => setField(e.id,'hours',ev.target.value)} />
                </div>
              </div>
            ))}
          </div>

          <button className="tm-btn tm-ghost" style={{marginTop:12}} onClick={addRow}>
            ＋ Add another activity
          </button>

          {totalHrs > 0 && (
            <div style={{marginTop:14,padding:'10px 14px',background:'#ecfdf5',borderRadius:8,fontSize:13,color:'#059669',fontWeight:600}}>
              ⏱ Total today: {totalHrs.toFixed(1)} hours across {entries.filter(e=>e.title.trim()).length} activit{entries.filter(e=>e.title.trim()).length===1?'y':'ies'}
            </div>
          )}
        </div>
        <div className="tm-mftr">
          <button className="tm-btn tm-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="tm-btn tm-primary" onClick={submit}
            disabled={saving || !entries.some(e => e.title.trim())}>
            {saving ? 'Saving…' : `⚡ Log ${entries.filter(e=>e.title.trim()).length} Activit${entries.filter(e=>e.title.trim()).length===1?'y':'ies'}`}
          </button>
        </div>
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
          <div><h2>{isEdit ? '✏️ Edit Task' : '➕ Add New Task'}</h2><p className="tm-msub">{isEdit ? 'Update task details' : 'Create a task for yourself or a team member'}</p></div>
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
              <select className="tm-sel" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="tm-fg">
              <label>Priority</label>
              <select className="tm-sel" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="tm-fg">
              <label>Due Date <span className="tm-req">*</span></label>
              <input type="date" className="tm-inp" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>
          <div className="tm-frow">
            <div className="tm-fg">
              <label>Start Date & Time</label>
              <input type="datetime-local" className="tm-inp" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="tm-fg">
              <label>End Date & Time <span className="tm-hint">(auto-calc hours)</span></label>
              <input type="datetime-local" className="tm-inp" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>
          <div className="tm-fg">
            <label>Project <span className="tm-hint">({projects.length} available)</span></label>
            <select className="tm-sel" value={form.projectId} onChange={e => set('projectId', e.target.value)}>
              <option value="">— No specific project —</option>
              {projects.map(p => <option key={p.projectUniqueId || p.id} value={p.projectUniqueId || p.id}>{p.projectName}</option>)}
              <option value="OTHER">📌 Other / Ad-hoc work</option>
            </select>
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
                <select className="tm-sel" value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}>
                  <option value={user?.id}>Myself ({user?.name})</option>
                  {users.filter(u => String(u.id) !== String(user?.id)).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            )}
            <div className="tm-fg">
              <label>Est. Hours {form.startDate && form.endDate ? <span className="tm-hint tm-green">✓ auto-filled</span> : ''}</label>
              <input type="number" className="tm-inp" min="0" step="0.5" placeholder="e.g. 3" value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} />
            </div>
            {isEdit && (
              <div className="tm-fg">
                <label>Status</label>
                <select className="tm-sel" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
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
          <button className="tm-btn tm-primary" onClick={submit} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : isEdit ? '✏️ Update Task' : '➕ Add Task'}</button>
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
            {task.relatedTo && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>↳ {task.relatedTo}</p>}
          </div>
          <button className="tm-xbtn" onClick={onClose}>✕</button>
        </div>
        <div className="tm-mbody" style={{ maxHeight: '65vh' }}>
          {/* Meta grid */}
          <div className="tm-detail-grid">
            <div className="tm-dg-item"><span className="tm-dg-lbl">Category</span><span className="tm-chip">📁 {task.category}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Project</span><span>{task.projectName ? <span className="tm-chip tm-chip-blue">🏗️ {task.projectName}</span> : task.otherContext ? <span className="tm-chip tm-chip-orange">📌 {task.otherContext}</span> : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Assigned To</span><span className="tm-dg-val">{task.assignedToName || '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Created By</span><span className="tm-dg-val">{task.createdByName || '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Due Date</span><span className={`tm-dg-val ${isOD ? 'tm-red' : ''}`}>{fmtDate(task.dueDate)}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Start Date</span><span className="tm-dg-val">{task.startDate ? fmtDT(task.startDate) : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">End Date</span><span className="tm-dg-val">{task.endDate ? fmtDT(task.endDate) : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Est. Hours</span><span className="tm-dg-val">{task.estimatedHours ? `${task.estimatedHours}h` : '—'}</span></div>
            <div className="tm-dg-item"><span className="tm-dg-lbl">Hours Logged</span><span className="tm-dg-val tm-blue-val">⏱ {totalH > 0 ? `${totalH.toFixed(1)}h` : '—'}</span></div>
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
            <div className="tm-prog-track"><div className="tm-prog-fill" style={{ width: `${task.completionPercent || 0}%`, background: (task.completionPercent || 0) >= 100 ? '#059669' : '#3b82f6' }} /></div>
            {task.estimatedHours && totalH > 0 && (
              <div className="tm-time-ratio">
                <span>Logged {totalH.toFixed(1)}h of {task.estimatedHours}h estimated</span>
                <span className={totalH > task.estimatedHours ? 'tm-red' : 'tm-green-txt'}>{totalH > task.estimatedHours ? '⚠️ Over estimate' : '✓ On track'}</span>
              </div>
            )}
          </div>

          {/* Update history */}
          <div className="tm-dr-sec">
            <h4>Work Entries ({(task.updates || []).length} entries · {totalH.toFixed(1)}h total)</h4>
            {!(task.updates?.length) ? (
              <div style={{textAlign:'center',padding:'24px 0',color:'#94a3b8'}}>
                <div style={{fontSize:28,marginBottom:6}}>📋</div>
                <p style={{fontSize:13,margin:0}}>No work entries yet.</p>
                <p style={{fontSize:11,margin:'4px 0 0',color:'#cbd5e1'}}>Click "Add Work Entry" to log what you've done on this task.</p>
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
                          {u.hoursSpent > 0 && <span className="tm-hours-pill">⏱ {u.hoursSpent}h</span>}
                          {u.statusChanged && <span className="tm-hist-sc">→ <strong>{u.newStatus}</strong></span>}
                        </div>
                        {/* Summary line */}
                        <p className="tm-hist-text" style={{fontWeight:600,marginBottom: detail ? 6 : 0}}>{summary}</p>
                        {/* Full detail — shown in a readable block */}
                        {detail && (
                          <div style={{
                            background:'#f8fafc', border:'1px solid #f1f5f9', borderRadius:8,
                            padding:'10px 14px', fontSize:12, color:'#374151', lineHeight:1.7,
                            whiteSpace:'pre-wrap', marginBottom:4,
                          }}>
                            {detail}
                          </div>
                        )}
                        {u.blockedReason && <p className="tm-hist-blk">🔴 Blocked: {u.blockedReason}</p>}
                        {u.notes && <p className="tm-hist-notes">📋 {u.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {task.status !== 'Completed' && task.status !== 'Cancelled' && (
          <div className="tm-mftr">
            <button className="tm-btn tm-ghost" onClick={onClose}>Close</button>
            <button className="tm-btn tm-primary" onClick={() => { onLog(task); onClose(); }}>📝 Add Work Entry</button>
          </div>
        )}
        {(task.status === 'Completed' || task.status === 'Cancelled') && (
          <div className="tm-mftr"><button className="tm-btn tm-ghost" onClick={onClose}>Close</button></div>
        )}
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
                      <span className="tm-tcode" style={{fontSize:10,color:'#94a3b8',fontWeight:700}}>{task.taskCode}</span>
                      <PBadge p={task.priority} />
                    </div>
                    <p className="tm-ci-title">{task.title}</p>
                    {task.projectName && <p className="tm-ci-proj" title={task.projectName}>🏗️ {task.projectName}</p>}
                    {task.otherContext && <p className="tm-ci-proj" style={{ color: '#c2410c' }} title={task.otherContext}>📌 {task.otherContext}</p>}
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
                      {totalH > 0 && <span className="tm-ci-hours">⏱ {totalH.toFixed(1)}h</span>}
                    </div>
                    <div className="tm-ci-actions">
                      {status !== 'Completed' && status !== 'Cancelled' && (
                        <button className="tm-ci-log-btn" onClick={e => { e.stopPropagation(); onLog(task); }}>📝 Work Entry</button>
                      )}
                      <button className="tm-ci-log-btn" style={{background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe'}} onClick={e => { e.stopPropagation(); onEdit(task); }}>✏️ Edit</button>
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
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #f1f5f9',boxShadow:'0 1px 3px rgba(0,0,0,.07)',overflow:'hidden'}}>

        {/* ── TOOLBAR ──────────────────────────────────────────────────── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #f1f5f9',background:'#f8fafc',flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flex:1,flexWrap:'wrap',minWidth:0}}>

            {/* Employee autocomplete */}
            <div ref={sugRef} style={{position:'relative',minWidth:220,maxWidth:280}}>
              <div style={{display:'flex',alignItems:'center',border:'1px solid #e2e8f0',borderRadius:9,background:'#fff',overflow:'hidden'}}>
                <span style={{padding:'0 10px',fontSize:14,color:'#94a3b8',flexShrink:0}}>🔍</span>
                <input style={{flex:1,border:'none',outline:'none',fontSize:13,padding:'8px 0',background:'transparent',color:'#0f172a'}}
                  placeholder="Search employee…" value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); setSelectedEmp(null); setShowSug(true); }}
                  onFocus={() => setShowSug(true)} />
                {(empSearch||selectedEmp) && (
                  <button onClick={doClear} style={{border:'none',background:'transparent',cursor:'pointer',color:'#94a3b8',padding:'0 10px',fontSize:13}}>✕</button>
                )}
              </div>
              {/* FIX #5: warn user to click suggestion */}
              {empSearch && !selectedEmp && (
                <div style={{fontSize:10,color:'#f59e0b',marginTop:2}}>⚠ Click a name below to filter</div>
              )}
              {showSug && suggestions.length > 0 && (
                <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,.12)',zIndex:300,overflow:'hidden',maxHeight:280,overflowY:'auto'}}>
                  {suggestions.map(u => (
                    <div key={u.id} onMouseDown={() => doSelect(u)}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #f8fafc'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f0f7ff'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',color:'#fff',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {(u.name||'?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{u.name}</div>
                        <div style={{fontSize:11,color:'#64748b'}}>{u.role||'—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date range */}
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:12,fontWeight:600,color:'#64748b'}}>From</span>
              <input type="date" className="tm-filter-sel" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span style={{fontSize:12,fontWeight:600,color:'#64748b'}}>To</span>
              <input type="date" className="tm-filter-sel" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            {/* Task search */}
            <div style={{position:'relative',display:'flex',alignItems:'center',flex:1,minWidth:160}}>
              <span style={{position:'absolute',left:10,fontSize:13,color:'#94a3b8',pointerEvents:'none'}}>🔍</span>
              <input style={{width:'100%',padding:'8px 30px 8px 32px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,outline:'none',background:'#fff',color:'#0f172a',boxSizing:'border-box'}}
                placeholder="Search tasks, work done…" onChange={e => handleTeamSearchChange(e.target.value)} />
              {taskSearch && <button onClick={() => { setTaskSearchInput(''); setTaskSearch(''); }} style={{position:'absolute',right:8,border:'none',background:'transparent',cursor:'pointer',color:'#94a3b8',fontSize:12}}>✕</button>}
            </div>
          </div>

          {/* Right: stats + export */}
          <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#0f172a'}}>{teamTotal} task{teamTotal!==1?'s':''} · {totalEntries} entr{totalEntries!==1?'ies':'y'}</div>
              {totalHours > 0 && <div style={{fontSize:11,color:'#0e7490',fontWeight:600}}>⏱ {totalHours.toFixed(1)}h logged</div>}
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
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderBottom:'1px solid #f1f5f9',flexWrap:'wrap',gap:10}}>
          <div>
            <h3 style={{fontSize:15,fontWeight:700,color:'#0f172a',margin:'0 0 2px',display:'flex',alignItems:'center',gap:8}}>
              {selectedEmp ? (
                <>
                  <span style={{width:26,height:26,borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',color:'#fff',fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                    {selectedEmp.name.charAt(0).toUpperCase()}
                  </span>
                  {selectedEmp.name}
                </>
              ) : '👥 Team Overview'}
            </h3>
            <p style={{fontSize:11,color:'#64748b',margin:0}}>
              {dateFrom && dateTo ? `${fmtDate(dateFrom)} → ${fmtDate(dateTo)}` : dateFrom ? `From ${fmtDate(dateFrom)}` : 'All time'}
              {selectedEmp?.role ? ` · ${selectedEmp.role}` : ''}
            </p>
          </div>
          {/* 3-way view toggle */}
          <div style={{display:'flex',border:'1px solid #e2e8f0',borderRadius:9,overflow:'hidden',background:'#f8fafc'}}>
            {[['table','☰ Tasks'],['logs','📋 Work Logs'],['grid','⊞ Grid']].map(([v,l]) => (
              <button key={v} onClick={() => setLogView(v)} style={{
                padding:'7px 14px',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                background:logView===v?'#0f172a':'transparent',
                color:logView===v?'#fff':'#64748b',transition:'all .15s',whiteSpace:'nowrap',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────────────── */}
        {teamLoading ? (
          <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}>
            <div style={{fontSize:24,marginBottom:8}}>⏳</div>
            <p style={{fontSize:13,margin:0}}>Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}>
            <div style={{fontSize:36,marginBottom:10}}>📋</div>
            <p style={{fontSize:13,margin:0}}>
              {selectedEmp ? `No tasks found for ${selectedEmp.name}.` : `No tasks found. Try widening the date range or selecting an employee.`}
            </p>
            {selectedEmp && <button className="tm-btn tm-ghost tm-sm" style={{marginTop:12}} onClick={doClear}>← Show all</button>}
          </div>

        ) : logView === 'table' ? (

          /* ─────────────────────────── TABLE VIEW ─────────────────────── */
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:1000}}>
              <thead>
                <tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
                  {['Employee','Task','Project','Category','Priority','Status','Progress','Hours','Due','Entries','Last Work Done','Last Date',''].map(h => (
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',whiteSpace:'nowrap'}}>{h}</th>
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
                          background: expanded ? '#f0f7ff' : 'transparent', transition:'background .12s'}}
                        onClick={() => onDetail(r._task)}
                        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background='#f8fafc'; }}
                        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background='transparent'; }}>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              {(r.employee||'?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:'#0f172a',lineHeight:1.2}}>{r.employee}</div>
                              <div style={{fontSize:10,color:'#64748b'}}>{r.role}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',maxWidth:200}}>
                          <span style={{fontSize:10,fontWeight:700,color:'#94a3b8',fontFamily:'monospace',display:'block'}}>{r.taskCode}</span>
                          <span style={{fontSize:13,fontWeight:600,color:'#0f172a',lineHeight:1.3}}>{r.taskTitle}</span>
                          {r.relatedTo !== '—' && <span style={{fontSize:11,color:'#64748b',display:'block'}}>↳ {r.relatedTo}</span>}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}>
                          {r.project !== '—' ? <span className="tm-chip tm-chip-blue">🏗️ {r.project}</span> : <span style={{color:'#94a3b8'}}>—</span>}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}><span className="tm-chip">📁 {r.category}</span></td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}><PBadge p={r.priority} /></td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}><SBadge s={r.status} /></td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',minWidth:90}}>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <div style={{flex:1,height:5,background:'#e2e8f0',borderRadius:3,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${r.pct}%`,background:r.pct>=100?'#059669':'#3b82f6',borderRadius:3}}/>
                            </div>
                            <span style={{fontSize:10,color:'#64748b',whiteSpace:'nowrap'}}>{r.pct}%</span>
                          </div>
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}>
                          {r.totalHours > 0 ? <span className="tm-hours-pill">⏱ {r.totalHours.toFixed(1)}h</span> : <span style={{color:'#94a3b8'}}>—</span>}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',fontSize:12,color:'#475569',whiteSpace:'nowrap'}}>
                          {r.dueDate !== '—' ? fmtDate(r.dueDate) : '—'}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',textAlign:'center'}}>
                          {r.updateCount > 0
                            ? <button onClick={e => toggleExpand(r._id, e)} style={{
                                padding:'3px 10px',border:'none',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:700,
                                background: expanded ? '#0f172a' : '#eff6ff', color: expanded ? '#fff' : '#2563eb',
                                transition:'all .15s',
                              }}>
                                {expanded ? '▲ Hide' : `${r.updateCount} entr${r.updateCount>1?'ies':'y'}`}
                              </button>
                            : <span style={{fontSize:11,color:'#94a3b8'}}>No entries</span>
                          }
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',maxWidth:220}}>
                          {summaryLine && summaryLine !== '—'
                            ? <p style={{fontSize:12,color:'#374151',margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:1.4}}>{summaryLine}</p>
                            : <span style={{color:'#94a3b8'}}>—</span>}
                        </td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle',fontSize:11,color:'#64748b',whiteSpace:'nowrap'}}>{r.lastDate||'—'}</td>
                        <td style={{padding:'10px 12px',verticalAlign:'middle'}}>
                          <span style={{fontSize:16,color:'#94a3b8'}}>›</span>
                        </td>
                      </tr>

                      {/* ── INLINE EXPANDED WORK ENTRIES ── */}
                      {expanded && (
                        <tr style={{background:'#f8fafc'}}>
                          <td colSpan={13} style={{padding:'0 0 4px 60px',borderBottom:'2px solid #e2e8f0'}}>
                            <div style={{paddingRight:20,paddingBottom:12}}>
                              {r.updates.length === 0
                                ? <p style={{fontSize:12,color:'#94a3b8',padding:'12px 0',margin:0}}>No work entries yet.</p>
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
                                          <div style={{width:10,height:10,borderRadius:'50%',background:entryDot(u.updateType),border:'2px solid #fff',boxShadow:`0 0 0 2px ${entryDot(u.updateType)}`}}/>
                                          {ui < r.updates.length-1 && <div style={{width:2,flex:1,background:'#f1f5f9',marginTop:4}}/>}
                                        </div>

                                        {/* Entry content */}
                                        <div style={{flex:1,minWidth:0}}>
                                          {/* Meta row */}
                                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:5}}>
                                            <span style={{fontSize:11,fontWeight:700,color:'#0f172a'}}>{u.updatedByName}</span>
                                            <span className="tm-type-pill">{u.updateType||'Update'}</span>
                                            <span style={{fontSize:11,color:'#64748b'}}>{fmtDate(u.updatedAt)}</span>
                                            {(u.startTime||u.endTime) && (
                                              <span style={{fontSize:11,color:'#64748b',background:'#f1f5f9',padding:'1px 7px',borderRadius:5}}>
                                                🕐 {fmtTime(u.startTime)}{u.endTime?` → ${fmtTime(u.endTime)}`:''}
                                              </span>
                                            )}
                                            {parseFloat(u.hoursSpent)>0 && <span className="tm-hours-pill">⏱ {parseFloat(u.hoursSpent).toFixed(1)}h</span>}
                                            {u.statusChanged && (
                                              <span style={{fontSize:11,color:'#059669',background:'#ecfdf5',padding:'1px 8px',borderRadius:5,fontWeight:600}}>
                                                → {u.newStatus}
                                              </span>
                                            )}
                                          </div>

                                          {/* Summary */}
                                          <p style={{fontSize:13,fontWeight:600,color:'#0f172a',margin:'0 0 4px',lineHeight:1.4}}>{summary}</p>

                                          {/* Full detail block */}
                                          {detail && (
                                            <div style={{
                                              background:'#fff',border:'1px solid #e2e8f0',borderLeft:`3px solid ${entryDot(u.updateType)}`,
                                              borderRadius:'0 8px 8px 0',padding:'8px 12px',
                                              fontSize:12,color:'#374151',lineHeight:1.7,whiteSpace:'pre-wrap',
                                              marginBottom:4,
                                            }}>{detail}</div>
                                          )}

                                          {u.blockedReason && (
                                            <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:6,padding:'6px 10px',fontSize:12,color:'#dc2626',marginTop:4}}>
                                              🔴 <strong>Blocked:</strong> {u.blockedReason}
                                            </div>
                                          )}
                                          {u.notes && (
                                            <div style={{background:'#f5f3ff',borderRadius:6,padding:'6px 10px',fontSize:12,color:'#7c3aed',marginTop:4}}>
                                              📋 {u.notes}
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
              <div style={{padding:'48px 24px',textAlign:'center',color:'#94a3b8'}}>
                <div style={{fontSize:36,marginBottom:8}}>📝</div>
                <p style={{fontSize:13,margin:0}}>No work entries found for this period.</p>
              </div>
            ) : Object.entries(logsByEmployee).map(([empName, empData]) => (
              <div key={empName} style={{borderBottom:'2px solid #f1f5f9'}}>
                {/* Employee header */}
                <div style={{
                  display:'flex',alignItems:'center',gap:12,
                  padding:'12px 20px',background:'#f8fafc',
                  borderBottom:'1px solid #f1f5f9',
                }}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',color:'#fff',fontSize:14,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {empName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:'#0f172a'}}>{empName}</div>
                    <div style={{fontSize:11,color:'#64748b'}}>{empData.role} · {empData.entries.length} entr{empData.entries.length!==1?'ies':'y'} · ⏱ {empData.entries.reduce((s,e)=>s+(parseFloat(e.hoursSpent)||0),0).toFixed(1)}h</div>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:'#3b82f6',background:'#eff6ff',padding:'3px 12px',borderRadius:20}}>
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
                          <div style={{width:11,height:11,borderRadius:'50%',background:entryDot(u.updateType),border:'2px solid #fff',boxShadow:`0 0 0 2px ${entryDot(u.updateType)}`,flexShrink:0}}/>
                          {ui < empData.entries.length-1 && <div style={{width:2,flex:1,minHeight:20,background:'#e2e8f0',marginTop:4}}/>}
                        </div>

                        {/* Content */}
                        <div style={{flex:1,minWidth:0}}>
                          {/* Task context pill */}
                          <div style={{
                            display:'inline-flex',alignItems:'center',gap:6,
                            background:'#f1f5f9',borderRadius:6,padding:'3px 10px',
                            marginBottom:6,cursor:'pointer',
                          }}
                            onClick={() => { const t = teamTasks.find(x=>x.id===u.taskId); if(t) onDetail(t); }}>
                            <span style={{fontSize:10,fontFamily:'monospace',fontWeight:700,color:'#94a3b8'}}>{u.taskCode}</span>
                            <span style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{u.taskTitle}</span>
                            {u.projectName && <span className="tm-chip tm-chip-blue" style={{padding:'1px 6px'}}>🏗️ {u.projectName}</span>}
                            <SBadge s={u.taskStatus} />
                          </div>

                          {/* Meta row */}
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
                            <span className="tm-type-pill">{u.updateType||'Update'}</span>
                            <span style={{fontSize:11,color:'#64748b',fontWeight:600}}>{fmtDate(u.updatedAt)}</span>
                            {(u.startTime||u.endTime) && (
                              <span style={{fontSize:11,color:'#64748b',background:'#f8fafc',padding:'2px 8px',borderRadius:5,fontFamily:'monospace'}}>
                                {fmtTime(u.startTime)}{u.endTime?` – ${fmtTime(u.endTime)}`:''}
                              </span>
                            )}
                            {parseFloat(u.hoursSpent)>0 && <span className="tm-hours-pill">⏱ {parseFloat(u.hoursSpent).toFixed(1)}h</span>} {/* FIX #4 */}
                            {u.statusChanged && (
                              <span style={{fontSize:11,color:'#059669',background:'#ecfdf5',padding:'2px 8px',borderRadius:5,fontWeight:700,border:'1px solid #6ee7b7'}}>
                                ✓ → {u.newStatus}
                              </span>
                            )}
                          </div>

                          {/* Summary */}
                          <p style={{fontSize:13,fontWeight:700,color:'#0f172a',margin:'0 0 6px',lineHeight:1.4}}>{summary}</p>

                          {/* Full detail */}
                          {detail && (
                            <div style={{
                              background:'#fff',border:'1px solid #e2e8f0',
                              borderLeft:`3px solid ${entryDot(u.updateType)}`,
                              borderRadius:'0 8px 8px 0',padding:'10px 14px',
                              fontSize:12,color:'#374151',lineHeight:1.75,
                              whiteSpace:'pre-wrap',marginBottom:4,
                            }}>{detail}</div>
                          )}

                          {u.blockedReason && (
                            <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:6,padding:'7px 12px',fontSize:12,color:'#dc2626',marginTop:4}}>
                              🔴 <strong>Blocker:</strong> {u.blockedReason}
                            </div>
                          )}
                          {u.notes && (
                            <div style={{background:'#f5f3ff',border:'1px solid #e9d5ff',borderRadius:6,padding:'7px 12px',fontSize:12,color:'#7c3aed',marginTop:4}}>
                              📋 {u.notes}
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
                style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:16,transition:'box-shadow .15s,transform .15s',cursor:'pointer'}}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',color:'#fff',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {(r.employee||'?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'#0f172a'}}>{r.employee}</div>
                      <div style={{fontSize:10,color:'#64748b'}}>{r.role}</div>
                    </div>
                  </div>
                  <SBadge s={r.status} />
                </div>
                <div style={{marginBottom:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:'#94a3b8',fontFamily:'monospace'}}>{r.taskCode}</span>
                  <p style={{fontSize:13,fontWeight:600,color:'#0f172a',margin:'2px 0 0',lineHeight:1.3}}>{r.taskTitle}</p>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                  {r.project !== '—' && <span className="tm-chip tm-chip-blue">🏗️ {r.project}</span>}
                  <span className="tm-chip">📁 {r.category}</span>
                  <PBadge p={r.priority} />
                  {r.totalHours > 0 && <span className="tm-hours-pill">⏱ {r.totalHours}h</span>}
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#64748b',marginBottom:3}}>
                    <span>Progress</span><span>{r.pct}%</span>
                  </div>
                  <div style={{height:5,background:'#e2e8f0',borderRadius:3}}>
                    <div style={{height:'100%',width:`${r.pct}%`,background:r.pct>=100?'#059669':'#3b82f6',borderRadius:3}}/>
                  </div>
                </div>
                {/* Show all entries count + preview of last one */}
                {r.updateCount > 0 ? (
                  <div style={{background:'#f8fafc',borderRadius:8,padding:'8px 10px',marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:4}}>
                      Latest entry · {r.lastDate}
                    </div>
                    <p style={{fontSize:12,color:'#374151',margin:0,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                      {(r.lastWorkDone||'').split('\n\n')[0]}
                    </p>
                  </div>
                ) : (
                  <p style={{fontSize:11,color:'#94a3b8',margin:'0 0 6px'}}>No work entries yet</p>
                )}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                  <span style={{fontSize:11,color:'#64748b'}}>{r.updateCount} entr{r.updateCount!==1?'ies':'y'}</span>
                  <span style={{fontSize:11,color:'#3b82f6',fontWeight:600}}>View full details ›</span>
                </div>
              </div>
            ))}
          </div>
        )}

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
          <p>{todayUpds.length} update{todayUpds.length !== 1 ? 's' : ''} logged · ⏱ {totalH.toFixed(1)}h tracked today</p>
        </div>
      </div>
      {todayUpds.length > 0 && (
        <div className="tm-today-tl">
          {todayUpds.map((u, i) => (
            <div key={i} className="tm-tl-item" onClick={() => onDetail(u.task)} style={{ cursor: 'pointer' }}>
              <div className="tm-tl-time">{u.startTime ? fmtTime(u.startTime) : '—'}{u.endTime ? <><br /><span style={{ color: '#94a3b8', fontSize: 10 }}>{fmtTime(u.endTime)}</span></> : null}</div>
              <div className="tm-tl-dot" style={{ background: u.updateType === 'Blocked' ? '#dc2626' : u.updateType === 'Discussion' ? '#7c3aed' : '#3b82f6' }} />
              <div className="tm-tl-body">
                <div className="tm-tl-meta">
                  <span className="tm-tcode">{u.task.taskCode}</span>
                  <span className="tm-type-pill">{u.updateType}</span>
                  {u.hoursSpent > 0 && <span className="tm-hours-pill">⏱ {u.hoursSpent}h</span>}
                  {u.task.projectName && <span className="tm-chip tm-chip-blue">🏗️ {u.task.projectName}</span>}
                </div>
                <p className="tm-tl-title">{u.task.title}</p>
                <p className="tm-tl-text">{u.workDone}</p>
                {u.notes && <p className="tm-tl-notes">📋 {u.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {todayTasks.length > 0 && (
        <div className="tm-today-due">
          <p className="tm-today-due-lbl">⚡ Due today and still open:</p>
          {todayTasks.map(t => (
            <div key={t.id} className="tm-today-task" onClick={() => onDetail(t)}>
              <SBadge s={t.status} />
              <span className="tm-tcode">{t.taskCode}</span>
              <span style={{ flex: 1, fontSize: 13, color: '#0f172a' }}>{t.title}</span>
              <button className="tm-btn tm-ghost tm-sm" onClick={e => { e.stopPropagation(); onLog(t); }}>📝 Work Entry</button>
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
          <span style={{fontSize:12,color:'#64748b',whiteSpace:'nowrap'}}>Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => onSizeChange && onSizeChange(Number(e.target.value))}
            style={{fontSize:12,padding:'3px 6px',border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',color:'#0f172a',cursor:'pointer'}}
          >
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <span className="tm-pgn-info" style={{whiteSpace:'nowrap'}}>
          {total === 0 ? '0 results' : `${from}–${to} of ${total} result${total !== 1 ? 's' : ''}`}
        </span>
        {/* Always show current page indicator */}
        <span style={{fontSize:12,color:'#94a3b8',whiteSpace:'nowrap'}}>
          Page <strong style={{color:'#0f172a'}}>{page}</strong> of <strong style={{color:'#0f172a'}}>{tp}</strong>
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
const KpiCard = ({ label, value, icon, accent, iconBg, sub, onClick, active }) => (
  <div className={`tm-kpi ${active ? 'tm-kpi-on' : ''}`} style={{ '--ka': accent, '--kib': iconBg }} onClick={onClick}>
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
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess } = useToast();
  const isSA = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  // roleLevel fetched from role_hierarchy table — works for any custom role name
  const [roleLevel, setRoleLevel] = useState(null);
  const isManager = !isSA && roleLevel === 3;    // level 3 = manager in hierarchy
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
  const [showBulkLog, setShowBulkLog]   = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);

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
  const filtered = tasks; // tasks already filtered by backend

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

  // Bulk end-of-day log — save multiple task updates at once
  const saveBulkLog = async (entries) => {
    let successCount = 0;
    for (const e of entries) {
      try {
        const combined = e.description?.trim()
          ? `${e.workDone.trim()}\n\n${e.description.trim()}`
          : e.workDone.trim();
        const r = await fetch(`${API}/tasks/${e.taskId}/update`, {
          method: 'POST', credentials: 'include', headers: hdrs(user),
          body: JSON.stringify({
            workDone: combined, updateType: e.updateType,
            hoursSpent: parseFloat(e.hoursSpent) || 0,
            startTime: e.startTime, endTime: e.endTime,
            newStatus: e.newStatus, completionPercent: e.completionPercent,
            notes: e.notes, updatedByName: user?.name,
          }),
        });
        if (r.ok) successCount++;
      } catch {}
    }
    showSuccess(`Day logged! ${successCount} task${successCount !== 1 ? 's' : ''} updated ✅`);
    loadTasks();
    setShowBulkLog(false);
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
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setTasks(p => p.filter(t => t.id !== id));
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
  const paged = tasks; // already paginated by backend

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
          <button className="tm-btn" style={{background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',fontWeight:700}}
            onClick={() => setShowQuickLog(true)} title="Quickly log all work done today as completed activities">
            ⚡ Quick Log
          </button>
          <button className="tm-btn" style={{background:'#fffbeb',color:'#d97706',border:'1px solid #fde68a',fontWeight:700}}
            onClick={() => setShowBulkLog(true)} title="Update all your in-progress tasks at end of day">
            📓 Log My Day
          </button>
          <button className="tm-btn tm-primary" onClick={() => setShowAdd(true)}>➕ Add Task</button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>From</span>
              <input type="date" className="tm-filter-sel" value={taskDateFrom} onChange={e => setTaskDateFrom(e.target.value)} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>To</span>
              <input type="date" className="tm-filter-sel" value={taskDateTo} onChange={e => setTaskDateTo(e.target.value)} />
              {(taskDateFrom || taskDateTo) && (
                <button className="tm-btn tm-ghost tm-sm" onClick={() => { setTaskDateFrom(''); setTaskDateTo(''); }}>✕ Clear</button>
              )}
            </div>
            {isSA && <select className="tm-filter-sel" value={empFilter} onChange={e => setEmpFilter(e.target.value)}><option value="All">All Members</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>From</span>
              <input type="date" className="tm-filter-sel" value={taskDateFrom} onChange={e => setTaskDateFrom(e.target.value)} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>To</span>
              <input type="date" className="tm-filter-sel" value={taskDateTo} onChange={e => setTaskDateTo(e.target.value)} />
              {(taskDateFrom || taskDateTo) && (
                <button className="tm-btn tm-ghost tm-sm" onClick={() => { setTaskDateFrom(''); setTaskDateTo(''); }}>✕ Clear</button>
              )}
            </div>
            <div className="tm-fg-row">
              <select className="tm-filter-sel" value={stFilter} onChange={e => setStFilter(e.target.value)}><option value="All">All Status</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              <select className="tm-filter-sel" value={priFilter} onChange={e => setPriFilter(e.target.value)}><option value="All">All Priority</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
              <select className="tm-filter-sel" value={catFilter} onChange={e => setCatFilter(e.target.value)}><option value="All">All Categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              {isSA && <select className="tm-filter-sel" value={empFilter} onChange={e => setEmpFilter(e.target.value)}><option value="All">All Assignees</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
            </div>
            <span className="tm-fcount">{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
          </div>

          <div className="tm-card">
            {loading ? (
              <div style={{padding:'40px 24px',textAlign:'center',color:'#94a3b8'}}>
                <div style={{fontSize:22,marginBottom:8}}>⏳</div>
                <p style={{fontSize:13,margin:0}}>Loading…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="tm-empty"><div style={{ fontSize: 36 }}>📋</div><p>No tasks match your filters.</p></div>
            ) : (
              <>
                <div className="tm-tbl-wrap">
                  <table className="tm-tbl">
                    <thead>
                      <tr>
                        <th>Task</th><th>Project</th><th>Category</th><th>Priority</th><th>Status</th>
                        <th>Progress</th><th>Start / End</th><th>Hours</th>
                        {isSA && <th>Assignee</th>}<th>Due</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map(task => {
                        const isOD = task.status !== 'Completed' && task.status !== 'Cancelled' && task.dueDate && task.dueDate < todayStr();
                        // Use updates-based sum; fall back to DB field for legacy tasks
                        const totalH = computeHours(task) || parseFloat(task.totalHoursSpent) || 0;
                        return (
                          <tr key={task.id} className={`tm-tr ${isOD ? 'tm-tr-od' : ''} ${task.status === 'Completed' ? 'tm-tr-done' : ''}`} onClick={() => setDetail(task)}>
                            <td>
                              <div className="tm-task-cell">
                                <span className="tm-tcode">{task.taskCode}</span>
                                <span className="tm-ttitle">{task.title}</span>
                                {task.relatedTo && <span className="tm-trel">↳ {task.relatedTo}</span>}
                              </div>
                            </td>
                            <td>{task.projectName ? <span className="tm-chip tm-chip-blue">🏗️ {task.projectName}</span> : task.otherContext ? <span className="tm-chip tm-chip-orange">📌 {task.otherContext}</span> : <span className="tm-nodash">—</span>}</td>
                            <td><span className="tm-chip">📁 {task.category}</span></td>
                            <td><PBadge p={task.priority} /></td>
                            <td><SBadge s={task.status} /></td>
                            <td>
                              <div className="tm-mini-prog">
                                <div className="tm-mini-bar"><div className="tm-mini-fill" style={{ width: `${task.completionPercent || 0}%`, background: (task.completionPercent || 0) >= 100 ? '#059669' : '#3b82f6' }} /></div>
                                <span>{task.completionPercent || 0}%</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                                {task.startDate ? <div>▶ {fmtDT(task.startDate)}</div> : <span className="tm-nodash">No start</span>}
                                {task.endDate ? <div style={{ color: '#059669' }}>■ {fmtDT(task.endDate)}</div> : null}
                              </div>
                            </td>
                            <td>{totalH > 0 ? <span className="tm-hours-pill">⏱ {totalH.toFixed(1)}h</span> : <span className="tm-nodash">—</span>}</td>
                            {isSA && <td><span className="tm-assignee">{task.assignedToName || '—'}</span></td>}
                            <td><span className={`tm-due ${isOD ? 'tm-due-od' : ''}`}>{isOD ? '🚨 ' : ''}{fmtDate(task.dueDate)}</span></td>
                            <td onClick={e => e.stopPropagation()}>
                              <div className="tm-acts">
                                {task.status !== 'Completed' && task.status !== 'Cancelled' && <button className="tm-act" title="Add Work Entry" onClick={() => setLogTask(task)}>📝</button>}
                                {task.status !== 'Completed' && task.status !== 'Cancelled' && <button className="tm-act" title="Mark Complete" onClick={() => quickComplete(task)}>✅</button>}
                                <button className="tm-act" title="Edit" onClick={() => setEditTask(task)}>✏️</button>
                                {isSA && <button className="tm-act" title="Delete" onClick={() => deleteTask(task.id)}>🗑️</button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
      {showBulkLog  && <BulkDayLogModal tasks={tasks} onClose={() => setShowBulkLog(false)} onSaveAll={saveBulkLog} />}
      {showQuickLog && <QuickSelfTaskModal user={user} projects={projects} onClose={() => setShowQuickLog(false)} onSave={saveTask} />}
    </div>
  );
}