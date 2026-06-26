// ─────────────────────────────────────────────────────────────────────────────
// AssetManagement.js — Enterprise-Grade v2.0
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip as RechartsTip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
  FiZap, FiWind, FiDroplet, FiActivity, FiAlertTriangle,
  FiCheckCircle, FiXCircle, FiEdit2, FiTrash2, FiPlus,
  FiSearch, FiFilter, FiRefreshCw, FiInfo, FiMapPin,
  FiCalendar, FiUser, FiTrendingUp, FiTrendingDown
} from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import { assetStatusColor } from '../../services/energyMockData';
import useToast from '../../hooks/useToast';
import ToastContainer from '../../components/Notification_Toast/ToastContainer';
import '../../pages-css/Energy/Energy.css';

const TYPE_ICON = { 'Solar PV': <FiZap />, Wind: <FiWind />, Hydro: <FiDroplet /> };
const TYPE_COLOR = { 'Solar PV': '#f59e0b', Wind: '#3b82f6', Hydro: '#06b6d4' };
const STATUS_CONFIG = {
  Operational:       { cls: 'green', icon: <FiCheckCircle />, label: 'Operational' },
  'Under Maintenance': { cls: 'amber', icon: <FiRefreshCw />,  label: 'Maintenance' },
  Offline:           { cls: 'red',   icon: <FiXCircle />,     label: 'Offline' },
};
const BLANK = { name:'',type:'Solar PV',capacity:'',capacityUnit:'MW',location:'',operator:'',status:'Operational',cod:'',health:90 };

function healthColor(v){ return v>=80?'green':v>=50?'amber':'red'; }

function Tooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="en-tooltip-wrap" onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <span className="en-tooltip-icon">i</span>
      {show && <span className="en-tooltip-box">{text}</span>}
    </span>
  );
}

export default function AssetManagement() {
  const { assets, addAsset, updateAsset, deleteAsset } = useEnergy();
  const { toasts, showSuccess, showError, showInfo, removeToast } = useToast();
  const showToast = (msg, type='info') => { if(type==='success') showSuccess(msg); else if(type==='error') showError(msg); else showInfo(msg); };
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'delete' | 'detail'
  const [form, setForm] = useState(BLANK);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  // ── Derived stats ──────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: assets.length,
    operational: assets.filter(a=>a.status==='Operational').length,
    maintenance: assets.filter(a=>a.status==='Under Maintenance').length,
    offline: assets.filter(a=>a.status==='Offline').length,
    totalMW: assets.reduce((s,a)=>s+a.capacity,0),
    avgHealth: Math.round(assets.reduce((s,a)=>s+a.health,0)/assets.length),
  }), [assets]);

  // ── Charts data ────────────────────────────────────────────────
  const typeData = useMemo(()=>{
    const map = {};
    assets.forEach(a=>{ map[a.type]=(map[a.type]||0)+1; });
    return Object.entries(map).map(([name,value])=>({ name, value, color: TYPE_COLOR[name]||'#6b7280' }));
  },[assets]);

  const healthData = useMemo(()=>
    assets.map(a=>({ name: a.name.split('–')[0].trim(), health: a.health, fill: a.health>=80?'#10b981':a.health>=50?'#f59e0b':'#ef4444' }))
  ,[assets]);

  // ── Filtered list ──────────────────────────────────────────────
  const filtered = useMemo(()=>{
    let r = assets.filter(a=>{
      const q = search.toLowerCase();
      if(q && !a.name.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q) && !a.location.toLowerCase().includes(q)) return false;
      if(typeFilter!=='All Types' && a.type!==typeFilter) return false;
      if(statusFilter!=='All Statuses' && a.status!==statusFilter) return false;
      return true;
    });
    r = [...r].sort((a,b)=>{
      let va=a[sortBy], vb=b[sortBy];
      if(typeof va==='string'){ va=va.toLowerCase(); vb=vb.toLowerCase(); }
      if(va<vb) return sortDir==='asc'?-1:1;
      if(va>vb) return sortDir==='asc'?1:-1;
      return 0;
    });
    return r;
  },[assets,search,typeFilter,statusFilter,sortBy,sortDir]);

  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const setSort = (col)=>{
    if(sortBy===col) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  // ── Handlers ───────────────────────────────────────────────────
  const openAdd = ()=>{ setForm(BLANK); setModal('add'); };
  const openEdit = (a)=>{ setForm({...a}); setSelected(a); setModal('edit'); };
  const openDelete = (a)=>{ setSelected(a); setModal('delete'); };
  const openDetail = (a)=>{ setSelected(a); setModal('detail'); };
  const closeModal = ()=>{ setModal(null); setSelected(null); };

  const handleSave = useCallback(async()=>{
    if(!form.name.trim()||!form.capacity||!form.location.trim()){
      showToast('Please fill all required fields','error'); return;
    }
    const payload = {...form, capacity:+form.capacity, health:+form.health};
    if(modal==='add'){
      payload.id = `AST-${String(assets.length+1).padStart(3,'0')}`;
      addAsset(payload); showToast('Asset added successfully','success');
    } else {
      updateAsset(payload); showToast('Asset updated successfully','success');
    }
    closeModal();
  },[form,modal,assets,addAsset,updateAsset,showToast]);

  const handleDelete = useCallback(()=>{
    deleteAsset(selected.id); showToast('Asset removed','info'); closeModal();
  },[selected,deleteAsset,showToast]);

  // ── Custom Recharts Tooltip ────────────────────────────────────
  const CustomTooltip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return (
      <div style={{background:'#1f2937',color:'#f9fafb',padding:'8px 12px',borderRadius:8,fontSize:12,boxShadow:'0 4px 16px rgba(0,0,0,0.3)'}}>
        <div style={{fontWeight:700,marginBottom:4}}>{label}</div>
        {payload.map((p,i)=><div key={i}>{p.name}: <b>{p.value}</b></div>)}
      </div>
    );
  };

  return (
    <div className="en-page">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── Header ── */}
      <div className="en-page-header">
        <div className="en-page-header-left">
          <div className="en-page-title-row">
            <div className="en-page-title-icon">⚡</div>
            <h1 className="en-page-title">Asset Management</h1>
          </div>
          <p className="en-page-subtitle">Monitor all renewable energy assets — solar, wind, and hydro plants</p>
        </div>
        <div className="en-page-header-actions">
          <button className="en-btn en-btn-primary" onClick={openAdd}>
            <FiPlus size={15}/> Add Asset
          </button>
        </div>
      </div>

      {/* ── KPI Stats ── */}
      <div className="en-stats-grid">
        <div className="en-stat-card green">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap green"><FiActivity/></div>
            <span className="en-stat-trend up">↑ {stats.totalMW} MW</span>
          </div>
          <div>
            <div className="en-stat-label">Total Assets</div>
            <div className="en-stat-value">{stats.total}</div>
            <div className="en-stat-sub">{stats.totalMW} MW total capacity</div>
          </div>
        </div>
        <div className="en-stat-card green">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap green"><FiCheckCircle/></div>
            <span className="en-stat-trend up">Running normally</span>
          </div>
          <div>
            <div className="en-stat-label">Operational</div>
            <div className="en-stat-value green">{stats.operational}</div>
            <div className="en-stat-sub">{Math.round(stats.operational/stats.total*100)}% of fleet</div>
          </div>
        </div>
        <div className="en-stat-card amber">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap amber"><FiRefreshCw/></div>
            <span className="en-stat-trend flat">In service window</span>
          </div>
          <div>
            <div className="en-stat-label">Under Maintenance</div>
            <div className="en-stat-value amber">{stats.maintenance}</div>
            <div className="en-stat-sub">Scheduled downtime</div>
          </div>
        </div>
        <div className="en-stat-card red">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap red"><FiXCircle/></div>
            <span className="en-stat-trend down">Needs attention</span>
          </div>
          <div>
            <div className="en-stat-label">Offline</div>
            <div className="en-stat-value red">{stats.offline}</div>
            <div className="en-stat-sub">Action required</div>
          </div>
        </div>
        <div className="en-stat-card blue">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap blue"><FiTrendingUp/></div>
            <span className="en-stat-trend up">Overall</span>
          </div>
          <div>
            <div className="en-stat-label">Avg. Health Score
              <Tooltip text="Average asset health across the portfolio (0–100)" />
            </div>
            <div className="en-stat-value">{stats.avgHealth}%</div>
            <div className="en-stat-sub">Fleet-wide average</div>
          </div>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="en-grid-2" style={{marginBottom:24}}>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#dbeafe',color:'#2563eb'}}><FiActivity/></div>
              <div>
                <div className="en-card-title">Asset Health by Plant</div>
                <div className="en-card-subtitle">Health score comparison (0–100)</div>
              </div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={healthData} margin={{top:4,right:8,left:-20,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:10, fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis domain={[0,100]} tick={{fontSize:10, fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <RechartsTip content={<CustomTooltip/>}/>
                <Bar dataKey="health" name="Health %" radius={[4,4,0,0]}>
                  {healthData.map((entry,i)=><Cell key={i} fill={entry.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#dcfce7',color:'#16a34a'}}><FiZap/></div>
              <div>
                <div className="en-card-title">Asset Type Distribution</div>
                <div className="en-card-subtitle">By technology type</div>
              </div>
            </div>
          </div>
          <div className="en-card-body" style={{display:'flex',alignItems:'center',gap:24}}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {typeData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <RechartsTip content={<CustomTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {typeData.map((t,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:t.color,flexShrink:0}}/>
                  <span style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--ct-374151,#374151)'}}>
                    {TYPE_ICON[t.name]} {t.name}
                  </span>
                  <span style={{marginLeft:'auto',fontWeight:700,fontSize:14,color:'var(--ct-111827,#111827)'}}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="en-card" style={{marginBottom:20}}>
        <div className="en-filter-bar">
          <div className="en-search-wrap">
            <FiSearch size={14}/>
            <input className="en-search" placeholder="Search by name, ID or location…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
          </div>
          <select className="en-select" value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setPage(1);}}>
            <option>All Types</option>
            {['Solar PV','Wind','Hydro'].map(t=><option key={t}>{t}</option>)}
          </select>
          <select className="en-select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}}>
            <option>All Statuses</option>
            {['Operational','Under Maintenance','Offline'].map(s=><option key={s}>{s}</option>)}
          </select>
          <span className="en-filter-count"><b>{filtered.length}</b> asset{filtered.length!==1?'s':''}</span>
        </div>

        <div className="en-table-wrap">
          <table className="en-table">
            <thead>
              <tr>
                {[['id','Asset ID'],['name','Name'],['type','Type'],['capacity','Capacity'],['location','Location'],['operator','Operator'],['status','Status'],['health','Health']].map(([key,label])=>(
                  <th key={key} onClick={()=>setSort(key)}>
                    {label}<span className="en-sort-icon">{sortBy===key?(sortDir==='asc'?'▲':'▼'):'⇅'}</span>
                  </th>
                ))}
                <th>COD</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length===0 && (
                <tr><td colSpan={10}>
                  <div className="en-empty">
                    <div className="en-empty-icon">🔍</div>
                    <p className="en-empty-title">No assets found</p>
                    <p className="en-empty-sub">Try adjusting your filters or search query</p>
                  </div>
                </td></tr>
              )}
              {paged.map(a=>{
                const sc = STATUS_CONFIG[a.status]||{cls:'gray',icon:null,label:a.status};
                const hc = healthColor(a.health);
                return (
                  <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>openDetail(a)}>
                    <td><span className="en-cell-mono">{a.id}</span></td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{color:TYPE_COLOR[a.type]}}>{TYPE_ICON[a.type]}</span>
                        <span className="en-cell-primary">{a.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="en-badge" style={{background:TYPE_COLOR[a.type]+'22',color:TYPE_COLOR[a.type]}}>
                        {a.type}
                      </span>
                    </td>
                    <td><b>{a.capacity}</b> <span className="en-cell-muted">{a.capacityUnit}</span></td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <FiMapPin size={11} style={{color:'#9ca3af',flexShrink:0}}/>
                        <span style={{fontSize:12}}>{a.location}</span>
                      </div>
                    </td>
                    <td style={{fontSize:12}}>{a.operator}</td>
                    <td>
                      <span className={`en-badge ${sc.cls}`} style={{display:'inline-flex',alignItems:'center',gap:4}}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td>
                      <div className="en-health-wrap">
                        <div className="en-health-bar"><div className={`en-health-fill ${hc}`} style={{width:`${a.health}%`}}/></div>
                        <span className={`en-health-pct ${hc}`}>{a.health}%</span>
                      </div>
                    </td>
                    <td style={{fontSize:12}}>{a.cod}</td>
                    <td onClick={e=>e.stopPropagation()}>
                      <div style={{display:'flex',gap:6}}>
                        <button className="en-btn en-btn-outline en-btn-xs" onClick={()=>openEdit(a)} title="Edit"><FiEdit2 size={12}/></button>
                        <button className="en-btn en-btn-danger en-btn-xs" onClick={()=>openDelete(a)} title="Delete"><FiTrash2 size={12}/></button>
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
              {Array.from({length:totalPages},(_,i)=>(
                <button key={i} className={`en-pagination-btn ${page===i+1?'active':''}`} onClick={()=>setPage(i+1)}>{i+1}</button>
              ))}
              <button className="en-pagination-btn" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {(modal==='add'||modal==='edit') && (
        <div className="en-modal-overlay" onClick={closeModal}>
          <div className="en-modal" onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <h2 className="en-modal-title">{modal==='add'?'Add New Asset':'Edit Asset'}</h2>
              <button className="en-modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="en-modal-body">
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Asset Name <span>*</span></label>
                  <input className="en-form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rajasthan Solar Farm – Unit A"/>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">Asset Type <span>*</span></label>
                  <select className="en-form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    {['Solar PV','Wind','Hydro'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Capacity <span>*</span></label>
                  <input className="en-form-input" type="number" value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} placeholder="e.g. 50"/>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">Status</label>
                  <select className="en-form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    {['Operational','Under Maintenance','Offline'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="en-form-group">
                <label className="en-form-label">Location <span>*</span></label>
                <input className="en-form-input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Jodhpur, Rajasthan"/>
              </div>
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">O&M Operator</label>
                  <input className="en-form-input" value={form.operator} onChange={e=>setForm(f=>({...f,operator:e.target.value}))} placeholder="e.g. SunPower O&M Ltd"/>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">COD Date</label>
                  <input className="en-form-input" type="date" value={form.cod} onChange={e=>setForm(f=>({...f,cod:e.target.value}))}/>
                </div>
              </div>
              <div className="en-form-group">
                <label className="en-form-label">Health Score (0–100)</label>
                <input className="en-form-input" type="range" min={0} max={100} value={form.health} onChange={e=>setForm(f=>({...f,health:+e.target.value}))} style={{padding:0}}/>
                <span className="en-form-hint">Current: <b style={{color:form.health>=80?'#16a34a':form.health>=50?'#d97706':'#dc2626'}}>{form.health}%</b></span>
              </div>
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={closeModal}>Cancel</button>
              <button className="en-btn en-btn-primary" onClick={handleSave}>{modal==='add'?'Add Asset':'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {modal==='delete' && selected && (
        <div className="en-modal-overlay" onClick={closeModal}>
          <div className="en-modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <h2 className="en-modal-title">Delete Asset</h2>
              <button className="en-modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="en-modal-body">
              <div className="en-alert-banner critical">
                <div className="en-alert-banner-icon"><FiAlertTriangle/></div>
                <div className="en-alert-banner-text">
                  <div className="en-alert-banner-title">This action cannot be undone</div>
                  <div className="en-alert-banner-msg">All data associated with <b>{selected.name}</b> will be permanently removed.</div>
                </div>
              </div>
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={closeModal}>Cancel</button>
              <button className="en-btn en-btn-danger" onClick={handleDelete}>Delete Asset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {modal==='detail' && selected && (
        <div className="en-modal-overlay" onClick={closeModal}>
          <div className="en-modal en-modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:22,color:TYPE_COLOR[selected.type]}}>{TYPE_ICON[selected.type]}</span>
                <div>
                  <h2 className="en-modal-title">{selected.name}</h2>
                  <span className="en-cell-mono" style={{fontSize:12,color:'#6b7280'}}>{selected.id}</span>
                </div>
              </div>
              <button className="en-modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="en-modal-body">
              <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
                <span className={`en-badge ${STATUS_CONFIG[selected.status]?.cls||'gray'}`}>{selected.status}</span>
                <span className="en-badge" style={{background:TYPE_COLOR[selected.type]+'22',color:TYPE_COLOR[selected.type]}}>{selected.type}</span>
              </div>
              <div className="en-info-grid" style={{marginBottom:20}}>
                <div className="en-info-item"><span className="en-info-label">Capacity</span><span className="en-info-value">{selected.capacity} {selected.capacityUnit}</span></div>
                <div className="en-info-item"><span className="en-info-label">Location</span><span className="en-info-value"><FiMapPin size={12}/> {selected.location}</span></div>
                <div className="en-info-item"><span className="en-info-label">O&M Operator</span><span className="en-info-value"><FiUser size={12}/> {selected.operator}</span></div>
                <div className="en-info-item"><span className="en-info-label">COD Date</span><span className="en-info-value"><FiCalendar size={12}/> {selected.cod}</span></div>
                <div className="en-info-item"><span className="en-info-label">Last Inspection</span><span className="en-info-value">{selected.lastInspection||'N/A'}</span></div>
                <div className="en-info-item"><span className="en-info-label">Linked Loan</span><span className="en-info-value">{selected.loanId||'—'}</span></div>
              </div>
              <div className="en-form-group">
                <label className="en-form-label">Health Score</label>
                <div className="en-health-wrap" style={{gap:12}}>
                  <div className="en-health-bar" style={{height:10,flex:1}}>
                    <div className={`en-health-fill ${healthColor(selected.health)}`} style={{width:`${selected.health}%`}}/>
                  </div>
                  <span className={`en-health-pct ${healthColor(selected.health)}`} style={{fontSize:16,fontWeight:800}}>{selected.health}%</span>
                </div>
              </div>
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={closeModal}>Close</button>
              <button className="en-btn en-btn-primary" onClick={()=>{ closeModal(); setTimeout(()=>openEdit(selected),50); }}>
                <FiEdit2 size={13}/> Edit Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
