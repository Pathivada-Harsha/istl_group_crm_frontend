// WorkOrders.js — Enterprise v2.0 with Gantt Chart
import React, { useState, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  FiPlus, FiSearch, FiEye, FiArrowRight, FiClock, FiAlertCircle,
  FiCheckCircle, FiTool, FiCalendar, FiUser, FiGrid, FiList
} from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import useToast from '../../hooks/useToast';
import ToastContainer from '../../components/Notification_Toast/ToastContainer';
import '../../pages-css/Energy/Energy.css';

const PRIORITY_COLOR = { Critical:'#ef4444', High:'#f59e0b', Medium:'#3b82f6', Low:'#10b981' };
const STATUS_COLOR   = { Open:'#3b82f6', 'In Progress':'#f59e0b', Closed:'#10b981' };
const STATUS_NEXT    = { Open:'In Progress', 'In Progress':'Closed' };
const BLANK_WO = { assetId:'AST-001', title:'', type:'Corrective', priority:'Medium', assignedTo:'', dueDate:'', description:'' };

function SLABar({ elapsed, total, status }) {
  const pct = Math.min((elapsed/total)*100,100);
  const cls = status==='Closed'?'green':pct>85?'red':pct>60?'amber':'green';
  const remaining = Math.max(total-elapsed,0);
  return (
    <div className="en-sla-wrap" style={{minWidth:130}}>
      <div className="en-sla-bar"><div className={`en-sla-fill ${cls}`} style={{width:`${pct}%`}}/></div>
      <span className={`en-sla-label ${cls}`}>{status==='Closed'?'✓ Completed':`${remaining}h left`}</span>
    </div>
  );
}

// ── Gantt Component ──────────────────────────────────────────────────────────
function GanttChart({ workOrders }) {
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({x:0,y:0});

  const BASE = new Date('2025-06-01');
  const END_DATE = new Date('2025-07-01');
  const totalDays = (END_DATE - BASE) / 86400000;

  const today = new Date();
  const todayPct = Math.min(Math.max(((today - BASE) / 86400000) / totalDays * 100, 0), 100);

  const getPos = (dateStr) => {
    const d = new Date(dateStr);
    return Math.min(Math.max(((d - BASE) / 86400000) / totalDays * 100, 0), 100);
  };

  const dates = ['Jun 1','Jun 8','Jun 15','Jun 22','Jul 1'];

  const ganttStatus = (wo) => {
    if(wo.status==='Closed') return 'closed';
    const due = new Date(wo.dueDate);
    if(due < today && wo.status!=='Closed') return 'overdue';
    return wo.status==='In Progress' ? 'in-progress' : 'open';
  };

  return (
    <div className="en-card" style={{marginBottom:20}}>
      <div className="en-card-header">
        <div className="en-card-header-left">
          <div className="en-card-icon" style={{background:'#fef3c7',color:'#d97706'}}><FiCalendar/></div>
          <div>
            <div className="en-card-title">Work Order Timeline</div>
            <div className="en-card-subtitle">Gantt view — Jun to Jul 2025</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {[['open','#3b82f6','Open'],['in-progress','#f59e0b','In Progress'],['closed','#10b981','Closed'],['overdue','#ef4444','Overdue']].map(([k,c,l])=>(
            <span key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--ct-6b7280,#6b7280)'}}>
              <span style={{width:12,height:12,borderRadius:3,background:c,display:'inline-block'}}/>{l}
            </span>
          ))}
        </div>
      </div>
      <div className="en-card-body no-pad">
        <div className="en-gantt-wrap">
          <div className="en-gantt-table">
            {/* Header */}
            <div className="en-gantt-header">
              <div className="en-gantt-header-label">Work Order</div>
              <div className="en-gantt-header-dates">
                {dates.map(d=><div key={d} className="en-gantt-date-cell">{d}</div>)}
              </div>
            </div>
            {/* Rows */}
            {workOrders.map(wo=>{
              const startPct = getPos(wo.createdAt);
              const endPct   = getPos(wo.dueDate);
              const width    = Math.max(endPct - startPct, 3);
              const gs       = ganttStatus(wo);
              const isHov    = hovered===wo.id;
              return (
                <div key={wo.id} className="en-gantt-row">
                  <div className="en-gantt-label">
                    <div className="en-gantt-label-title">{wo.title}</div>
                    <div className="en-gantt-label-sub">{wo.id} · <span style={{color:PRIORITY_COLOR[wo.priority],fontWeight:600}}>{wo.priority}</span></div>
                  </div>
                  <div className="en-gantt-timeline" style={{position:'relative'}}>
                    {/* Today line */}
                    <div className="en-gantt-today-line" style={{left:`${todayPct}%`}}/>
                    {/* Bar */}
                    <div
                      className={`en-gantt-bar-wrap ${gs}`}
                      style={{left:`${startPct}%`, width:`${width}%`, position:'absolute', top:'50%', transform:'translateY(-50%)'}}
                      onMouseEnter={e=>{ setHovered(wo.id); setTooltipPos({x:e.clientX,y:e.clientY}); }}
                      onMouseLeave={()=>setHovered(null)}
                    >
                      <span className="en-gantt-bar-label">{wo.title}</span>
                      {isHov && (
                        <div style={{
                          position:'fixed', left:tooltipPos.x+12, top:tooltipPos.y-10,
                          background:'#1f2937', color:'#f9fafb', padding:'10px 14px',
                          borderRadius:8, fontSize:12, zIndex:9999, pointerEvents:'none',
                          boxShadow:'0 4px 16px rgba(0,0,0,0.3)', minWidth:200
                        }}>
                          <div style={{fontWeight:700,marginBottom:6}}>{wo.title}</div>
                          <div>Asset: {wo.assetName}</div>
                          <div>Assigned: {wo.assignedTo}</div>
                          <div>Start: {wo.createdAt} → Due: {wo.dueDate}</div>
                          <div>SLA: {wo.elapsedHours}h of {wo.slaHours}h used</div>
                          <div style={{marginTop:4}}>
                            <span style={{padding:'2px 8px',borderRadius:10,background:STATUS_COLOR[wo.status]||'#6b7280',color:'#fff',fontSize:11}}>
                              {wo.status}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkOrders() {
  const { workOrders, addWorkOrder, updateWorkOrderStatus, assets } = useEnergy();
  const { toasts, showSuccess, showError, showInfo, removeToast } = useToast();
  const showToast = (msg, type='info') => { if(type==='success') showSuccess(msg); else if(type==='error') showError(msg); else showInfo(msg); };
  const [search, setSearch]     = useState('');
  const [statusF, setStatusF]   = useState('All');
  const [priorityF, setPriorityF] = useState('All');
  const [view, setView]         = useState('list'); // 'list' | 'gantt'
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(BLANK_WO);
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 5;

  const stats = useMemo(()=>({
    open:       workOrders.filter(w=>w.status==='Open').length,
    inProgress: workOrders.filter(w=>w.status==='In Progress').length,
    closed:     workOrders.filter(w=>w.status==='Closed').length,
    critical:   workOrders.filter(w=>w.priority==='Critical').length,
    overdue:    workOrders.filter(w=>w.status!=='Closed' && new Date(w.dueDate)<new Date()).length,
  }),[workOrders]);

  const priorityChartData = useMemo(()=>[
    {name:'Critical',count:workOrders.filter(w=>w.priority==='Critical').length,fill:'#ef4444'},
    {name:'High',    count:workOrders.filter(w=>w.priority==='High').length,    fill:'#f59e0b'},
    {name:'Medium',  count:workOrders.filter(w=>w.priority==='Medium').length,  fill:'#3b82f6'},
    {name:'Low',     count:workOrders.filter(w=>w.priority==='Low').length,     fill:'#10b981'},
  ],[workOrders]);

  const statusChartData = useMemo(()=>[
    {name:'Open',       value:stats.open,       color:'#3b82f6'},
    {name:'In Progress',value:stats.inProgress, color:'#f59e0b'},
    {name:'Closed',     value:stats.closed,     color:'#10b981'},
  ],[stats]);

  const filtered = useMemo(()=>{
    return workOrders.filter(w=>{
      const q = search.toLowerCase();
      if(q && !w.title.toLowerCase().includes(q) && !w.id.toLowerCase().includes(q) && !w.assetName.toLowerCase().includes(q)) return false;
      if(statusF!=='All' && w.status!==statusF) return false;
      if(priorityF!=='All' && w.priority!==priorityF) return false;
      return true;
    });
  },[workOrders,search,statusF,priorityF]);

  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const handleCreate = ()=>{
    if(!form.title.trim()||!form.assignedTo.trim()||!form.dueDate){
      showToast('Fill all required fields','error'); return;
    }
    const asset = assets.find(a=>a.id===form.assetId)||assets[0];
    addWorkOrder({
      ...form,
      id:`WO-2025-${String(workOrders.length+1).padStart(3,'0')}`,
      assetName: asset?.name||'',
      status:'Open', createdAt:new Date().toISOString().split('T')[0],
      slaHours:72, elapsedHours:0, updates:[]
    });
    showToast('Work order created','success');
    setModal(null); setForm(BLANK_WO);
  };

  const handleAdvance = (wo)=>{
    const next = STATUS_NEXT[wo.status];
    if(!next) return;
    updateWorkOrderStatus(wo.id, next);
    showToast(`Status moved to "${next}"`, 'success');
  };

  const CustomTooltip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return <div style={{background:'#1f2937',color:'#f9fafb',padding:'8px 12px',borderRadius:8,fontSize:12}}><b>{label}</b><br/>{payload[0].value} WOs</div>;
  };

  return (
    <div className="en-page">
      <ToastContainer toasts={toasts} removeToast={removeToast}/>

      {/* Header */}
      <div className="en-page-header">
        <div className="en-page-header-left">
          <div className="en-page-title-row">
            <div className="en-page-title-icon" style={{background:'linear-gradient(135deg,#d97706,#f59e0b)'}}>🔧</div>
            <h1 className="en-page-title">Work Order System</h1>
          </div>
          <p className="en-page-subtitle">Create, assign, and track maintenance work orders with SLA monitoring</p>
        </div>
        <div className="en-page-header-actions">
          <div className="en-tabs">
            <button className={`en-tab ${view==='list'?'active':''}`} onClick={()=>setView('list')}><FiList size={13}/> List</button>
            <button className={`en-tab ${view==='gantt'?'active':''}`} onClick={()=>setView('gantt')}><FiGrid size={13}/> Gantt</button>
          </div>
          <button className="en-btn en-btn-primary" onClick={()=>setModal('create')}><FiPlus size={15}/> Create Work Order</button>
        </div>
      </div>

      {/* Stats */}
      <div className="en-stats-grid">
        {[
          {label:'Open',value:stats.open,sub:'Awaiting assignment',cls:'blue',icon:<FiClock/>},
          {label:'In Progress',value:stats.inProgress,sub:'Being worked on',cls:'amber',icon:<FiTool/>},
          {label:'Closed',value:stats.closed,sub:'Completed',cls:'green',icon:<FiCheckCircle/>},
          {label:'Critical Priority',value:stats.critical,sub:'Urgent attention',cls:'red',icon:<FiAlertCircle/>},
          {label:'Overdue',value:stats.overdue,sub:'Past due date',cls:'red',icon:<FiAlertCircle/>},
        ].map(s=>(
          <div key={s.label} className={`en-stat-card ${s.cls}`}>
            <div className="en-stat-top">
              <div className={`en-stat-icon-wrap ${s.cls}`}>{s.icon}</div>
            </div>
            <div>
              <div className="en-stat-label">{s.label}</div>
              <div className={`en-stat-value ${s.cls}`}>{s.value}</div>
              <div className="en-stat-sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="en-grid-2" style={{marginBottom:20}}>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#fee2e2',color:'#dc2626'}}><FiAlertCircle/></div>
              <div><div className="en-card-title">WOs by Priority</div><div className="en-card-subtitle">Breakdown of work order urgency</div></div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityChartData} layout="vertical" margin={{top:0,right:20,left:20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:12,fill:'#374151'}} tickLine={false} axisLine={false} width={70}/>
                <RechartsTip content={<CustomTooltip/>}/>
                <Bar dataKey="count" name="Work Orders" radius={[0,4,4,0]}>
                  {priorityChartData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#dcfce7',color:'#16a34a'}}><FiCheckCircle/></div>
              <div><div className="en-card-title">WOs by Status</div><div className="en-card-subtitle">Current pipeline distribution</div></div>
            </div>
          </div>
          <div className="en-card-body" style={{display:'flex',alignItems:'center',gap:24}}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {statusChartData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <RechartsTip/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {statusChartData.map((s,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                  <span style={{fontSize:13,color:'var(--ct-374151,#374151)'}}>{s.name}</span>
                  <span style={{marginLeft:'auto',fontWeight:800,fontSize:16,color:'var(--ct-111827,#111827)'}}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gantt or List */}
      {view==='gantt' ? (
        <GanttChart workOrders={workOrders}/>
      ) : (
        <div className="en-card">
          <div className="en-filter-bar">
            <div className="en-search-wrap">
              <FiSearch size={14}/>
              <input className="en-search" placeholder="Search work orders…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
            </div>
            <select className="en-select" value={statusF} onChange={e=>{setStatusF(e.target.value);setPage(1);}}>
              <option value="All">All Statuses</option>
              {['Open','In Progress','Closed'].map(s=><option key={s}>{s}</option>)}
            </select>
            <select className="en-select" value={priorityF} onChange={e=>{setPriorityF(e.target.value);setPage(1);}}>
              <option value="All">All Priorities</option>
              {['Critical','High','Medium','Low'].map(p=><option key={p}>{p}</option>)}
            </select>
            <span className="en-filter-count"><b>{filtered.length}</b> result{filtered.length!==1?'s':''}</span>
          </div>

          <div className="en-table-wrap">
            <table className="en-table">
              <thead><tr>
                <th>WO ID</th><th>Title</th><th>Asset</th><th>Type</th>
                <th>Priority</th><th>Assigned To</th><th>Status</th>
                <th>SLA Progress</th><th>Due Date</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {paged.length===0 && <tr><td colSpan={10}><div className="en-empty"><div className="en-empty-icon">📋</div><p className="en-empty-title">No work orders found</p></div></td></tr>}
                {paged.map(wo=>{
                  const pc = PRIORITY_COLOR[wo.priority]||'#6b7280';
                  const sc = STATUS_COLOR[wo.status]||'#6b7280';
                  const overdue = wo.status!=='Closed' && new Date(wo.dueDate)<new Date();
                  const next = STATUS_NEXT[wo.status];
                  return (
                    <tr key={wo.id} style={{cursor:'pointer'}} onClick={()=>{setSelected(wo);setModal('detail');}}>
                      <td><span className="en-cell-mono">{wo.id}</span></td>
                      <td>
                        <div className="en-cell-primary">{wo.title}</div>
                        {overdue && <span style={{fontSize:10,color:'#dc2626',fontWeight:700}}>⚠ OVERDUE</span>}
                        <div className="en-cell-muted">Created {wo.createdAt}</div>
                      </td>
                      <td style={{fontSize:12,maxWidth:140}}>{wo.assetName}</td>
                      <td><span className="en-badge gray">{wo.type}</span></td>
                      <td><span className="en-badge" style={{background:pc+'22',color:pc}}>{wo.priority}</span></td>
                      <td style={{fontSize:12}}><FiUser size={11} style={{marginRight:4,color:'#9ca3af'}}/>{wo.assignedTo}</td>
                      <td><span className="en-badge" style={{background:sc+'22',color:sc}}>{wo.status}</span></td>
                      <td><SLABar elapsed={wo.elapsedHours} total={wo.slaHours} status={wo.status}/></td>
                      <td style={{fontSize:12}}>{wo.dueDate}</td>
                      <td onClick={e=>e.stopPropagation()}>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          <button className="en-btn en-btn-outline en-btn-xs" onClick={()=>{setSelected(wo);setModal('detail');}}>
                            <FiEye size={11}/> View
                          </button>
                          {next && (
                            <button className="en-btn en-btn-primary en-btn-xs" onClick={()=>handleAdvance(wo)}>
                              → {next==='In Progress'?'Start':'Close'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages>1 && (
            <div className="en-pagination">
              <span className="en-pagination-info">Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
              <div className="en-pagination-btns">
                <button className="en-pagination-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button>
                {Array.from({length:totalPages},(_,i)=><button key={i} className={`en-pagination-btn ${page===i+1?'active':''}`} onClick={()=>setPage(i+1)}>{i+1}</button>)}
                <button className="en-pagination-btn" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {modal==='detail' && selected && (
        <div className="en-modal-overlay" onClick={()=>setModal(null)}>
          <div className="en-modal en-modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <div>
                <h2 className="en-modal-title">{selected.title}</h2>
                <span className="en-cell-mono" style={{fontSize:12,color:'#6b7280'}}>{selected.id}</span>
              </div>
              <button className="en-modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="en-modal-body">
              <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                <span className="en-badge" style={{background:STATUS_COLOR[selected.status]+'22',color:STATUS_COLOR[selected.status]}}>{selected.status}</span>
                <span className="en-badge" style={{background:PRIORITY_COLOR[selected.priority]+'22',color:PRIORITY_COLOR[selected.priority]}}>{selected.priority} Priority</span>
                <span className="en-badge gray">{selected.type}</span>
              </div>
              <div className="en-info-grid" style={{marginBottom:16}}>
                <div className="en-info-item"><span className="en-info-label">Asset</span><span className="en-info-value">{selected.assetName}</span></div>
                <div className="en-info-item"><span className="en-info-label">Assigned To</span><span className="en-info-value">{selected.assignedTo}</span></div>
                <div className="en-info-item"><span className="en-info-label">Created</span><span className="en-info-value">{selected.createdAt}</span></div>
                <div className="en-info-item"><span className="en-info-label">Due Date</span><span className="en-info-value">{selected.dueDate}</span></div>
              </div>
              <div style={{marginBottom:16}}>
                <div className="en-info-label" style={{marginBottom:6}}>SLA Progress ({selected.elapsedHours}h of {selected.slaHours}h)</div>
                <SLABar elapsed={selected.elapsedHours} total={selected.slaHours} status={selected.status}/>
              </div>
              <div style={{marginBottom:16}}>
                <div className="en-info-label" style={{marginBottom:6}}>Description</div>
                <p style={{fontSize:13,color:'var(--ct-374151,#374151)',lineHeight:1.6,margin:0}}>{selected.description}</p>
              </div>
              {selected.updates?.length>0 && (
                <div>
                  <div className="en-info-label" style={{marginBottom:8}}>Updates</div>
                  {selected.updates.map((u,i)=>(
                    <div key={i} style={{padding:'10px 14px',background:'var(--c-f9fafb,#f9fafb)',borderRadius:8,marginBottom:6,fontSize:12,borderLeft:'3px solid #10b981'}}>
                      <div style={{fontWeight:600,marginBottom:2}}>{u.by} · {u.at}</div>
                      <div>{u.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={()=>setModal(null)}>Close</button>
              {STATUS_NEXT[selected.status] && (
                <button className="en-btn en-btn-primary" onClick={()=>{handleAdvance(selected);setModal(null);}}>
                  <FiArrowRight size={13}/> Move to {STATUS_NEXT[selected.status]}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modal==='create' && (
        <div className="en-modal-overlay" onClick={()=>setModal(null)}>
          <div className="en-modal" onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <h2 className="en-modal-title">Create Work Order</h2>
              <button className="en-modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="en-modal-body">
              <div className="en-form-group">
                <label className="en-form-label">Title <span>*</span></label>
                <input className="en-form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Inverter Module Replacement"/>
              </div>
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Asset <span>*</span></label>
                  <select className="en-form-select" value={form.assetId} onChange={e=>setForm(f=>({...f,assetId:e.target.value}))}>
                    {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">Type</label>
                  <select className="en-form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    {['Corrective','Preventive','Emergency'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Priority</label>
                  <select className="en-form-select" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                    {['Critical','High','Medium','Low'].map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">Assigned To <span>*</span></label>
                  <input className="en-form-input" value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))} placeholder="Engineer name"/>
                </div>
              </div>
              <div className="en-form-group">
                <label className="en-form-label">Due Date <span>*</span></label>
                <input className="en-form-input" type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/>
              </div>
              <div className="en-form-group">
                <label className="en-form-label">Description</label>
                <textarea className="en-form-textarea" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the issue and work required…"/>
              </div>
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="en-btn en-btn-primary" onClick={handleCreate}><FiPlus size={13}/> Create Work Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
