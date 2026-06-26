// AlertsSystem.js — Enterprise v2.0
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip, ResponsiveContainer, Cell } from 'recharts';
import { FiAlertTriangle, FiAlertCircle, FiInfo, FiCheckCircle, FiBell, FiFilter, FiActivity } from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import useToast from '../../hooks/useToast';
import ToastContainer from '../../components/Notification_Toast/ToastContainer';
import '../../pages-css/Energy/Energy.css';

const TYPE_CONFIG = {
  Critical: { cls:'red',   icon:<FiAlertCircle/>,   dot:'critical', bg:'#fef2f2' },
  Warning:  { cls:'amber', icon:<FiAlertTriangle/>,  dot:'warning',  bg:'#fffbeb' },
  Info:     { cls:'blue',  icon:<FiInfo/>,           dot:'info',     bg:'#eff6ff' },
  Success:  { cls:'green', icon:<FiCheckCircle/>,    dot:'success',  bg:'#f0fdf4' },
};
const CAT_COLORS = { Financial:'#3b82f6', SCADA:'#8b5cf6', 'O&M':'#f59e0b', Compliance:'#10b981', System:'#6b7280' };

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if(m<1) return 'Just now';
  if(m<60) return `${m}m ago`;
  if(h<24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function AlertsSystem() {
  const { alerts, acknowledgeAlert, addAlert, unreadCount } = useEnergy();
  const { toasts, showSuccess, showError, showInfo, removeToast } = useToast();
  const showToast = (msg, type='info') => { if(type==='success') showSuccess(msg); else if(type==='error') showError(msg); else showInfo(msg); };
  const [typeF, setTypeF]     = useState('All Types');
  const [catF, setCatF]       = useState('All');
  const [showAcked, setShowAcked] = useState(true);
  const [simRunning, setSimRunning] = useState(false);
  const simRef = useRef(null);

  // Simulate live alerts
  useEffect(()=>{
    if(simRunning){
      simRef.current = setInterval(()=>{
        const types = ['Critical','Warning','Info'];
        const cats  = ['Financial','SCADA','O&M'];
        const msgs  = [
          'SCADA telemetry fluctuation detected',
          'EMI payment approaching in 3 days',
          'Plant availability dropped below 85%',
          'DSCR approaching threshold boundary',
          'Inverter efficiency reduced to 91%',
        ];
        addAlert({
          id:`ALT-${Date.now()}`,
          assetId:'AST-001',
          assetName:'Rajasthan Solar Farm – Unit A',
          type: types[Math.floor(Math.random()*types.length)],
          category: cats[Math.floor(Math.random()*cats.length)],
          message: msgs[Math.floor(Math.random()*msgs.length)],
          timestamp: new Date().toISOString(),
          acknowledged: false,
        });
      }, 6000);
    } else {
      clearInterval(simRef.current);
    }
    return ()=>clearInterval(simRef.current);
  },[simRunning,addAlert]);

  const filtered = useMemo(()=>alerts.filter(a=>{
    if(typeF!=='All Types' && a.type!==typeF) return false;
    if(catF!=='All' && a.category!==catF) return false;
    if(!showAcked && a.acknowledged) return false;
    return true;
  }),[alerts,typeF,catF,showAcked]);

  const stats = useMemo(()=>({
    unread: alerts.filter(a=>!a.acknowledged).length,
    critical: alerts.filter(a=>a.type==='Critical'&&!a.acknowledged).length,
    warning:  alerts.filter(a=>a.type==='Warning'&&!a.acknowledged).length,
    info:     alerts.filter(a=>a.type==='Info'&&!a.acknowledged).length,
  }),[alerts]);

  // Category distribution chart
  const catData = useMemo(()=>{
    const map = {};
    alerts.forEach(a=>{ map[a.category]=(map[a.category]||0)+1; });
    return Object.entries(map).map(([name,count])=>({ name, count, fill: CAT_COLORS[name]||'#6b7280' }));
  },[alerts]);

  // Type distribution chart
  const typeData = useMemo(()=>[
    {name:'Critical', count:alerts.filter(a=>a.type==='Critical').length, fill:'#ef4444'},
    {name:'Warning',  count:alerts.filter(a=>a.type==='Warning').length,  fill:'#f59e0b'},
    {name:'Info',     count:alerts.filter(a=>a.type==='Info').length,     fill:'#3b82f6'},
  ],[alerts]);

  const handleAckAll = ()=>{
    alerts.filter(a=>!a.acknowledged).forEach(a=>acknowledgeAlert(a.id));
    showToast('All alerts acknowledged','success');
  };

  const CustomTip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return <div style={{background:'#1f2937',color:'#f9fafb',padding:'8px 12px',borderRadius:8,fontSize:12}}><b>{label}</b>: {payload[0].value} alerts</div>;
  };

  return (
    <div className="en-page">
      <ToastContainer toasts={toasts} removeToast={removeToast}/>

      <div className="en-page-header">
        <div className="en-page-header-left">
          <div className="en-page-title-row">
            <div className="en-page-title-icon" style={{background:'linear-gradient(135deg,#dc2626,#ef4444)'}}>🔔</div>
            <h1 className="en-page-title">Alerts & Notifications</h1>
          </div>
          <p className="en-page-subtitle">Real-time alerts from SCADA, financial triggers, and O&M events</p>
        </div>
        <div className="en-page-header-actions">
          <button
            className={`en-btn ${simRunning?'en-btn-danger':'en-btn-outline'}`}
            onClick={()=>setSimRunning(r=>!r)}
          >
            <FiActivity size={14}/> {simRunning?'Stop Simulation':'▶ Simulate Live Alerts'}
          </button>
          {stats.unread>0 && (
            <button className="en-btn en-btn-outline" onClick={handleAckAll}>
              <FiCheckCircle size={14}/> Ack All ({stats.unread})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="en-stats-grid">
        <div className="en-stat-card amber">
          <div className="en-stat-top"><div className="en-stat-icon-wrap amber"><FiBell/></div></div>
          <div>
            <div className="en-stat-label">Unread Alerts</div>
            <div className="en-stat-value amber">{stats.unread}</div>
            <div className="en-stat-sub">Requiring attention</div>
          </div>
        </div>
        <div className="en-stat-card red">
          <div className="en-stat-top"><div className="en-stat-icon-wrap red"><FiAlertCircle/></div></div>
          <div>
            <div className="en-stat-label">Critical</div>
            <div className="en-stat-value red">{stats.critical}</div>
            <div className="en-stat-sub">Immediate action</div>
          </div>
        </div>
        <div className="en-stat-card amber">
          <div className="en-stat-top"><div className="en-stat-icon-wrap amber"><FiAlertTriangle/></div></div>
          <div>
            <div className="en-stat-label">Warnings</div>
            <div className="en-stat-value amber">{stats.warning}</div>
            <div className="en-stat-sub">Monitor closely</div>
          </div>
        </div>
        <div className="en-stat-card blue">
          <div className="en-stat-top"><div className="en-stat-icon-wrap blue"><FiInfo/></div></div>
          <div>
            <div className="en-stat-label">Info</div>
            <div className="en-stat-value">{stats.info}</div>
            <div className="en-stat-sub">Informational</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="en-grid-2" style={{marginBottom:20}}>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#fee2e2',color:'#dc2626'}}><FiAlertCircle/></div>
              <div><div className="en-card-title">By Severity</div><div className="en-card-subtitle">Alert distribution by type</div></div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={typeData} margin={{top:0,right:8,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <RechartsTip content={<CustomTip/>}/>
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {typeData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#f3e8ff',color:'#7c3aed'}}><FiFilter/></div>
              <div><div className="en-card-title">By Category</div><div className="en-card-subtitle">Alert source distribution</div></div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={catData} layout="vertical" margin={{top:0,right:20,left:30,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#374151'}} tickLine={false} axisLine={false} width={80}/>
                <RechartsTip content={<CustomTip/>}/>
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {catData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filter + List */}
      <div className="en-card">
        <div className="en-filter-bar">
          <select className="en-select" value={typeF} onChange={e=>setTypeF(e.target.value)}>
            <option value="All Types">All Types</option>
            {['Critical','Warning','Info','Success'].map(t=><option key={t}>{t}</option>)}
          </select>
          <select className="en-select" value={catF} onChange={e=>setCatF(e.target.value)}>
            <option value="All">All Categories</option>
            {['Financial','SCADA','O&M','Compliance','System'].map(c=><option key={c}>{c}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer',color:'var(--ct-374151,#374151)'}}>
            <input type="checkbox" checked={showAcked} onChange={e=>setShowAcked(e.target.checked)} style={{accentColor:'#10b981'}}/>
            Show acknowledged
          </label>
          <span className="en-filter-count"><b>{filtered.length}</b> alert{filtered.length!==1?'s':''}</span>
        </div>
        <div style={{padding:'16px 22px'}}>
          {filtered.length===0 && (
            <div className="en-empty">
              <div className="en-empty-icon">✅</div>
              <p className="en-empty-title">No alerts</p>
              <p className="en-empty-sub">All clear! No alerts matching current filters.</p>
            </div>
          )}
          {filtered.map(a=>{
            const cfg = TYPE_CONFIG[a.type]||TYPE_CONFIG.Info;
            const catColor = CAT_COLORS[a.category]||'#6b7280';
            return (
              <div key={a.id} className={`en-alert-item ${a.acknowledged?'acked':''}`}
                style={{borderLeft:`3px solid ${a.acknowledged?'#e5e7eb':cfg.cls==='red'?'#ef4444':cfg.cls==='amber'?'#f59e0b':'#3b82f6'}`}}
              >
                <div className={`en-alert-dot ${cfg.dot}`}/>
                <div className="en-alert-body">
                  <div className="en-alert-msg" style={{fontWeight:a.acknowledged?400:600}}>{a.message}</div>
                  <div className="en-alert-meta">
                    <span>📍 {a.assetName}</span>
                    <span>⏰ {relTime(a.timestamp)}</span>
                    <span className={`en-badge ${cfg.cls}`}>{a.type}</span>
                    <span className="en-badge" style={{background:catColor+'22',color:catColor}}>{a.category}</span>
                    {a.acknowledged && <span className="en-badge gray">✓ Acknowledged</span>}
                  </div>
                </div>
                {!a.acknowledged && (
                  <div className="en-alert-actions">
                    <button className="en-btn en-btn-outline en-btn-xs" onClick={()=>{acknowledgeAlert(a.id);showToast('Alert acknowledged','success');}}>
                      <FiCheckCircle size={11}/> Ack
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
