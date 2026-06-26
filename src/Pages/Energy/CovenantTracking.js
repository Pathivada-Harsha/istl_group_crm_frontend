// CovenantTracking.js — Enterprise v2.0
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer, Cell, PieChart, Pie, RadialBarChart, RadialBar
} from 'recharts';
import {
  FiShield, FiAlertTriangle, FiCheckCircle, FiPlus, FiEdit2,
  FiSearch, FiFilter, FiTrendingUp, FiTrendingDown, FiInfo
} from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import useToast from '../../hooks/useToast';
import ToastContainer from '../../components/Notification_Toast/ToastContainer';
import '../../pages-css/Energy/Energy.css';

const TYPE_COLOR = { Financial:'#3b82f6', Operational:'#10b981', Insurance:'#8b5cf6', Legal:'#f59e0b' };
const STATUS_CONFIG = {
  Compliant: { cls:'green', icon:<FiCheckCircle/>, label:'✓ Compliant' },
  Breached:  { cls:'red',   icon:<FiAlertTriangle/>, label:'✗ Breached' },
  Warning:   { cls:'amber', icon:<FiAlertTriangle/>, label:'⚠ Warning' },
};

function Tooltip({ text }) {
  const [show, setShow] = React.useState(false);
  return (
    <span className="en-tooltip-wrap" onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <span className="en-tooltip-icon">i</span>
      {show && <span className="en-tooltip-box">{text}</span>}
    </span>
  );
}

const BLANK_COV = {
  loanId:'LN-001', assetName:'Rajasthan Solar Farm – Unit A',
  type:'Financial', metric:'', condition:'≥', threshold:'', unit:'x',
  frequency:'Quarterly', nextReview:''
};

export default function CovenantTracking() {
  const { covenants, addCovenant, updateCovenantValue, loans } = useEnergy();
  const { toasts, showSuccess, showError, showInfo, removeToast } = useToast();
  const showToast = (msg, type='info') => { if(type==='success') showSuccess(msg); else if(type==='error') showError(msg); else showInfo(msg); };
  const [statusF, setStatusF] = useState('All');
  const [typeF, setTypeF]     = useState('All Types');
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(null); // 'add' | 'update' | null
  const [selected, setSelected] = useState(null);
  const [newVal, setNewVal]   = useState('');
  const [form, setForm]       = useState(BLANK_COV);
  const [page, setPage]       = useState(1);
  const PAGE_SIZE = 8;

  const stats = useMemo(()=>({
    total:       covenants.length,
    compliant:   covenants.filter(c=>c.status==='Compliant').length,
    breached:    covenants.filter(c=>c.status==='Breached').length,
    warning:     covenants.filter(c=>c.status==='Warning').length,
    complianceRate: Math.round(covenants.filter(c=>c.status==='Compliant').length/covenants.length*100),
  }),[covenants]);

  // Chart: compliance by type
  const typeBreakdown = useMemo(()=>{
    const map = {};
    covenants.forEach(c=>{
      if(!map[c.type]) map[c.type]={type:c.type, compliant:0, breached:0, total:0};
      map[c.type].total++;
      if(c.status==='Compliant') map[c.type].compliant++;
      else map[c.type].breached++;
    });
    return Object.values(map);
  },[covenants]);

  // Chart: status pie
  const statusPie = useMemo(()=>[
    {name:'Compliant', value:stats.compliant, color:'#10b981'},
    {name:'Breached',  value:stats.breached,  color:'#ef4444'},
    {name:'Warning',   value:stats.warning,   color:'#f59e0b'},
  ].filter(s=>s.value>0),[stats]);

  const breached = useMemo(()=>covenants.filter(c=>c.status==='Breached'),[covenants]);

  const filtered = useMemo(()=>{
    return covenants.filter(c=>{
      const q = search.toLowerCase();
      if(q && !c.assetName.toLowerCase().includes(q) && !c.metric.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) return false;
      if(statusF!=='All' && c.status!==statusF) return false;
      if(typeF!=='All Types' && c.type!==typeF) return false;
      return true;
    });
  },[covenants,statusF,typeF,search]);

  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const handleUpdate = ()=>{
    if(!newVal||isNaN(+newVal)){ showToast('Enter a valid number','error'); return; }
    updateCovenantValue(selected.id, +newVal);
    showToast('Covenant value updated','success');
    setModal(null); setSelected(null); setNewVal('');
  };

  const handleAdd = ()=>{
    if(!form.metric.trim()||!form.threshold||!form.nextReview){
      showToast('Fill all required fields','error'); return;
    }
    const loan = loans.find(l=>l.id===form.loanId)||loans[0];
    addCovenant({
      id:`COV-${String(covenants.length+1).padStart(3,'0')}`,
      loanId:form.loanId, assetName:loan?.assetName||'',
      type:form.type, metric:form.metric, condition:form.condition,
      threshold:+form.threshold, currentValue:+form.threshold,
      unit:form.unit, frequency:form.frequency,
      lastChecked:new Date().toISOString().split('T')[0],
      status:'Compliant', nextReview:form.nextReview,
    });
    showToast('Covenant added successfully','success');
    setModal(null); setForm(BLANK_COV);
  };

  const CustomTip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return (
      <div style={{background:'#1f2937',color:'#f9fafb',padding:'10px 14px',borderRadius:8,fontSize:12}}>
        <div style={{fontWeight:700,marginBottom:4}}>{label}</div>
        {payload.map((p,i)=><div key={i} style={{color:p.fill||'#f9fafb'}}>{p.name}: <b>{p.value}</b></div>)}
      </div>
    );
  };

  return (
    <div className="en-page">
      <ToastContainer toasts={toasts} removeToast={removeToast}/>

      <div className="en-page-header">
        <div className="en-page-header-left">
          <div className="en-page-title-row">
            <div className="en-page-title-icon" style={{background:'linear-gradient(135deg,#7c3aed,#8b5cf6)'}}>🛡️</div>
            <h1 className="en-page-title">Covenant Tracking</h1>
          </div>
          <p className="en-page-subtitle">Monitor and enforce financial and operational loan covenants in real time</p>
        </div>
        <button className="en-btn en-btn-primary" onClick={()=>{setForm(BLANK_COV);setModal('add');}}>
          <FiPlus size={15}/> Add Covenant
        </button>
      </div>

      {/* Stats */}
      <div className="en-stats-grid">
        <div className="en-stat-card blue">
          <div className="en-stat-top"><div className="en-stat-icon-wrap blue"><FiShield/></div></div>
          <div>
            <div className="en-stat-label">Total Covenants</div>
            <div className="en-stat-value">{stats.total}</div>
            <div className="en-stat-sub">Across all loans</div>
          </div>
        </div>
        <div className="en-stat-card green">
          <div className="en-stat-top"><div className="en-stat-icon-wrap green"><FiCheckCircle/></div></div>
          <div>
            <div className="en-stat-label">Compliant</div>
            <div className="en-stat-value green">{stats.compliant}</div>
            <div className="en-stat-sub">Meeting threshold</div>
          </div>
        </div>
        <div className="en-stat-card red">
          <div className="en-stat-top"><div className="en-stat-icon-wrap red"><FiAlertTriangle/></div></div>
          <div>
            <div className="en-stat-label">Breached</div>
            <div className="en-stat-value red">{stats.breached}</div>
            <div className="en-stat-sub">Requires action</div>
          </div>
        </div>
        <div className="en-stat-card amber">
          <div className="en-stat-top"><div className="en-stat-icon-wrap amber"><FiTrendingUp/></div></div>
          <div>
            <div className="en-stat-label">Compliance Rate
              <Tooltip text="Percentage of covenants currently meeting their threshold requirements"/>
            </div>
            <div className="en-stat-value" style={{color:stats.complianceRate>=70?'#16a34a':stats.complianceRate>=50?'#d97706':'#dc2626'}}>
              {stats.complianceRate}%
            </div>
            <div className="en-stat-sub">Overall health</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="en-grid-2" style={{marginBottom:20}}>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#dbeafe',color:'#2563eb'}}><FiShield/></div>
              <div>
                <div className="en-card-title">Compliance by Covenant Type</div>
                <div className="en-card-subtitle">Compliant vs Breached by category</div>
              </div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={typeBreakdown} margin={{top:4,right:8,left:-20,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="type" tick={{fontSize:11,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <RechartsTip content={<CustomTip/>}/>
                <Bar dataKey="compliant" name="Compliant" fill="#10b981" radius={[0,0,0,0]} stackId="a"/>
                <Bar dataKey="breached"  name="Breached"  fill="#ef4444" radius={[4,4,0,0]} stackId="a"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#f3e8ff',color:'#7c3aed'}}><FiCheckCircle/></div>
              <div>
                <div className="en-card-title">Status Distribution</div>
                <div className="en-card-subtitle">Overall covenant compliance health</div>
              </div>
            </div>
          </div>
          <div className="en-card-body" style={{display:'flex',alignItems:'center',gap:24}}>
            <div style={{position:'relative'}}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={statusPie} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                    {statusPie.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                <div style={{fontSize:20,fontWeight:900,color:stats.complianceRate>=70?'#16a34a':'#dc2626'}}>{stats.complianceRate}%</div>
                <div style={{fontSize:9,color:'#6b7280',fontWeight:600}}>COMPLIANT</div>
              </div>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:12}}>
              {statusPie.map((s,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{width:10,height:10,borderRadius:2,background:s.color,flexShrink:0}}/>
                  <span style={{fontSize:12,color:'var(--ct-374151,#374151)',flex:1}}>{s.name}</span>
                  <span style={{fontWeight:800,fontSize:16,color:s.color}}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Breach alerts */}
      {breached.length>0 && (
        <div className="en-alert-banner critical" style={{marginBottom:20}}>
          <div className="en-alert-banner-icon">🚨</div>
          <div className="en-alert-banner-text" style={{flex:1}}>
            <div className="en-alert-banner-title">Active Covenant Breaches ({breached.length})</div>
            <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
              {breached.map(c=>(
                <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(255,255,255,0.7)',borderRadius:8,borderLeft:'3px solid #ef4444',gap:12,flexWrap:'wrap'}}>
                  <div style={{fontSize:13}}>
                    <b>{c.assetName}</b> — {c.metric}: Current{' '}
                    <span style={{color:'#dc2626',fontWeight:700}}>{c.currentValue}{c.unit}</span>
                    {' '}below threshold {c.condition}{c.threshold}{c.unit}
                  </div>
                  <button className="en-btn en-btn-danger en-btn-xs" onClick={()=>{setSelected(c);setNewVal(String(c.currentValue));setModal('update');}}>
                    Update Value
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="en-card">
        <div className="en-filter-bar">
          <div className="en-search-wrap">
            <FiSearch size={14}/>
            <input className="en-search" placeholder="Search covenants…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
          </div>
          <select className="en-select" value={statusF} onChange={e=>{setStatusF(e.target.value);setPage(1);}}>
            <option value="All">All Statuses</option>
            {['Compliant','Breached','Warning'].map(s=><option key={s}>{s}</option>)}
          </select>
          <select className="en-select" value={typeF} onChange={e=>{setTypeF(e.target.value);setPage(1);}}>
            <option value="All Types">All Types</option>
            {['Financial','Operational','Insurance','Legal'].map(t=><option key={t}>{t}</option>)}
          </select>
          <span className="en-filter-count"><b>{filtered.length}</b> covenant{filtered.length!==1?'s':''}</span>
        </div>

        <div className="en-table-wrap">
          <table className="en-table">
            <thead><tr>
              <th>ID</th>
              <th>Asset</th>
              <th>Type</th>
              <th>Metric <Tooltip text="The financial or operational metric being tracked"/></th>
              <th>Threshold</th>
              <th>Current Value</th>
              <th>Status</th>
              <th>Frequency</th>
              <th>Next Review</th>
              <th>Action</th>
            </tr></thead>
            <tbody>
              {paged.length===0 && (
                <tr><td colSpan={10}>
                  <div className="en-empty">
                    <div className="en-empty-icon">🛡️</div>
                    <p className="en-empty-title">No covenants found</p>
                    <p className="en-empty-sub">Adjust filters or add a new covenant</p>
                  </div>
                </td></tr>
              )}
              {paged.map(c=>{
                const sc = STATUS_CONFIG[c.status]||STATUS_CONFIG.Compliant;
                const tc = TYPE_COLOR[c.type]||'#6b7280';
                const isBreached = c.status==='Breached';
                const compliance = c.status==='Compliant'
                  ? ((c.currentValue/c.threshold)*100).toFixed(0)
                  : null;
                return (
                  <tr key={c.id} style={{background:isBreached?'#fef2f2':''}}>
                    <td><span className="en-cell-mono">{c.id}</span></td>
                    <td style={{fontSize:12,maxWidth:160}}>{c.assetName}</td>
                    <td>
                      <span className="en-badge" style={{background:tc+'22',color:tc}}>{c.type}</span>
                    </td>
                    <td className="en-cell-primary">{c.metric}</td>
                    <td>
                      <span style={{fontSize:13,fontWeight:600,color:'var(--ct-374151,#374151)'}}>
                        {c.condition}{c.threshold}{c.unit}
                      </span>
                    </td>
                    <td>
                      <div style={{display:'flex',flexDirection:'column',gap:3}}>
                        <span style={{fontSize:14,fontWeight:800,color:isBreached?'#dc2626':'#16a34a'}}>
                          {c.currentValue}{c.unit}
                        </span>
                        {compliance && (
                          <div className="en-progress-bar" style={{height:4,width:80}}>
                            <div className="en-progress-fill green" style={{width:`${Math.min(+compliance,100)}%`,height:4}}/>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`en-badge ${sc.cls}`} style={{display:'inline-flex',alignItems:'center',gap:4}}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td style={{fontSize:12}}>{c.frequency}</td>
                    <td style={{fontSize:12}}>{c.nextReview}</td>
                    <td>
                      <button className="en-btn en-btn-outline en-btn-xs" onClick={()=>{setSelected(c);setNewVal(String(c.currentValue));setModal('update');}}>
                        <FiEdit2 size={11}/> Update
                      </button>
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

      {/* Update Modal */}
      {modal==='update' && selected && (
        <div className="en-modal-overlay" onClick={()=>setModal(null)}>
          <div className="en-modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <h2 className="en-modal-title">Update Covenant Value</h2>
              <button className="en-modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="en-modal-body">
              <div style={{marginBottom:16,padding:'12px 16px',background:'var(--c-f9fafb,#f9fafb)',borderRadius:10}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{selected.metric}</div>
                <div style={{fontSize:12,color:'#6b7280'}}>{selected.assetName} · Threshold: {selected.condition}{selected.threshold}{selected.unit}</div>
              </div>
              {/* Live breach preview */}
              {newVal && !isNaN(+newVal) && (
                <div style={{marginBottom:12,padding:'10px 14px',borderRadius:8,
                  background:+newVal>=selected.threshold?'#f0fdf4':'#fef2f2',
                  border:`1.5px solid ${+newVal>=selected.threshold?'#10b981':'#ef4444'}`,
                  fontSize:13,fontWeight:600,
                  color:+newVal>=selected.threshold?'#16a34a':'#dc2626'}}>
                  {+newVal>=selected.threshold
                    ? `✓ Compliant — ${newVal}${selected.unit} meets ${selected.condition}${selected.threshold}${selected.unit}`
                    : `✗ Breach — ${newVal}${selected.unit} is below ${selected.condition}${selected.threshold}${selected.unit}`}
                </div>
              )}
              <div className="en-form-group">
                <label className="en-form-label">New Current Value ({selected.unit}) <span>*</span></label>
                <input className="en-form-input" type="number" step="0.01" value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder={`Current: ${selected.currentValue}${selected.unit}`}/>
              </div>
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="en-btn en-btn-primary" onClick={handleUpdate}><FiCheckCircle size={13}/> Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {modal==='add' && (
        <div className="en-modal-overlay" onClick={()=>setModal(null)}>
          <div className="en-modal" onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <h2 className="en-modal-title">Add Covenant</h2>
              <button className="en-modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="en-modal-body">
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Loan <span>*</span></label>
                  <select className="en-form-select" value={form.loanId} onChange={e=>{
                    const loan=loans.find(l=>l.id===e.target.value);
                    setForm(f=>({...f,loanId:e.target.value,assetName:loan?.assetName||''}));
                  }}>
                    {loans.map(l=><option key={l.id} value={l.id}>{l.id} – {l.assetName}</option>)}
                  </select>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">Type</label>
                  <select className="en-form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    {['Financial','Operational','Insurance','Legal'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="en-form-group">
                <label className="en-form-label">Metric Name <span>*</span></label>
                <input className="en-form-input" value={form.metric} onChange={e=>setForm(f=>({...f,metric:e.target.value}))} placeholder="e.g. DSCR, Plant Availability, PLF"/>
              </div>
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Condition</label>
                  <select className="en-form-select" value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))}>
                    {['≥','≤','>','<','='].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">Threshold Value <span>*</span></label>
                  <input className="en-form-input" type="number" step="0.01" value={form.threshold} onChange={e=>setForm(f=>({...f,threshold:e.target.value}))} placeholder="e.g. 1.25"/>
                </div>
              </div>
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Unit</label>
                  <select className="en-form-select" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                    {['x','%','₹','days','months'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">Frequency</label>
                  <select className="en-form-select" value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}>
                    {['Monthly','Quarterly','Semi-Annual','Annual'].map(f=><option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="en-form-group">
                <label className="en-form-label">Next Review Date <span>*</span></label>
                <input className="en-form-input" type="date" value={form.nextReview} onChange={e=>setForm(f=>({...f,nextReview:e.target.value}))}/>
              </div>
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="en-btn en-btn-primary" onClick={handleAdd}><FiPlus size={13}/> Add Covenant</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
