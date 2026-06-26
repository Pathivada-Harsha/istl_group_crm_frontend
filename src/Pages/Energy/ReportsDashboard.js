// ReportsDashboard.js — Enterprise v2.0
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import {
  FiDownload, FiFileText, FiBarChart2, FiShield, FiDollarSign,
  FiTool, FiActivity, FiClock, FiCheckCircle, FiAlertTriangle,
  FiFilter, FiCalendar, FiUser
} from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import useToast from '../../hooks/useToast';
import ToastContainer from '../../components/Notification_Toast/ToastContainer';
import '../../pages-css/Energy/Energy.css';

const REPORT_TEMPLATES = [
  {
    id:'rpt-001', tag:'Operations', tagCls:'operations',
    icon:<FiActivity/>, iconBg:'#dbeafe', iconColor:'#2563eb',
    title:'Monthly Generation Report',
    desc:'Plant-wise generation, PLF, PR, availability metrics for all assets',
    role:['Admin','Operator'],
    metrics:['Total Generation: 267.4 MWh','Avg PLF: 21.3%','Best Plant: Rajasthan Solar'],
    btnColor:'#2563eb',
  },
  {
    id:'rpt-002', tag:'Finance', tagCls:'finance',
    icon:<FiShield/>, iconBg:'#dcfce7', iconColor:'#16a34a',
    title:'DSCR Compliance Report',
    desc:'Covenant status, DSCR trends, risk flags, and lender notifications',
    role:['Admin','Lender'],
    metrics:['Avg DSCR: 1.26x','Risk Loans: 2','Breaches: 4'],
    btnColor:'#16a34a',
  },
  {
    id:'rpt-003', tag:'O&M', tagCls:'om',
    icon:<FiTool/>, iconBg:'#fef3c7', iconColor:'#d97706',
    title:'Work Order Summary',
    desc:'Open/closed WOs, SLA adherence, MTTR analysis, and trend data',
    role:['Admin','Operator'],
    metrics:['Open WOs: 2','SLA Breach Risk: 1','Avg Resolution: 18h'],
    btnColor:'#d97706',
  },
  {
    id:'rpt-004', tag:'Finance', tagCls:'finance',
    icon:<FiDollarSign/>, iconBg:'#dcfce7', iconColor:'#16a34a',
    title:'Loan Portfolio Statement',
    desc:'Outstanding principal, EMI schedule, repayment progress, overdue flags',
    role:['Admin','Lender'],
    metrics:['Outstanding: ₹95.1 Cr','Repaid: ₹23.1 Cr','At Risk: 2'],
    btnColor:'#059669',
  },
  {
    id:'rpt-005', tag:'Compliance', tagCls:'compliance',
    icon:<FiShield/>, iconBg:'#f3e8ff', iconColor:'#7c3aed',
    title:'Covenant Tracker Report',
    desc:'All covenants, breaches, upcoming reviews, and remediation status',
    role:['Admin','Lender'],
    metrics:['Compliant: 5','Breached: 4','Rate: 56%'],
    btnColor:'#7c3aed',
  },
  {
    id:'rpt-006', tag:'Operations', tagCls:'operations',
    icon:<FiActivity/>, iconBg:'#dbeafe', iconColor:'#2563eb',
    title:'Asset Health Dashboard',
    desc:'Asset health scores, alert counts, maintenance history, and status',
    role:['Admin','Operator','Lender'],
    metrics:['Avg Health: 79%','Offline: 1','Maintenance: 1'],
    btnColor:'#3b82f6',
  },
];

// Simulated monthly generation data
const GEN_DATA = [
  {month:'Jan', solar:120, wind:88, hydro:22},
  {month:'Feb', solar:132, wind:92, hydro:19},
  {month:'Mar', solar:145, wind:78, hydro:24},
  {month:'Apr', solar:158, wind:85, hydro:21},
  {month:'May', solar:162, wind:95, hydro:26},
  {month:'Jun', solar:155, wind:99, hydro:18},
];

const WO_TREND = [
  {month:'Jan', open:5, closed:12},
  {month:'Feb', open:3, closed:14},
  {month:'Mar', open:4, closed:11},
  {month:'Apr', open:6, closed:13},
  {month:'May', open:2, closed:15},
  {month:'Jun', open:4, closed:10},
];

export default function ReportsDashboard() {
  const { activeRole, assets, loans, workOrders, covenants, alerts } = useEnergy();
  const { toasts, showSuccess, showError, showInfo, removeToast } = useToast();
  const showToast = (msg, type='info') => { if(type==='success') showSuccess(msg); else if(type==='error') showError(msg); else showInfo(msg); };
  const [generating, setGenerating] = useState(null);
  const [dateRange, setDateRange] = useState('last30');

  const visibleReports = useMemo(()=>
    REPORT_TEMPLATES.filter(r=>r.role.includes(activeRole)||activeRole==='Admin')
  ,[activeRole]);

  const handleGenerate = (rpt)=>{
    setGenerating(rpt.id);
    setTimeout(()=>{
      setGenerating(null);
      showToast(`"${rpt.title}" generated successfully — ready for download`, 'success');
    }, 1800);
  };

  const quickStats = useMemo(()=>({
    totalAssets: assets.length,
    operational: assets.filter(a=>a.status==='Operational').length,
    openWOs:     workOrders.filter(w=>w.status==='Open').length,
    breached:    covenants.filter(c=>c.status==='Breached').length,
    unreadAlerts:alerts.filter(a=>!a.acknowledged).length,
    outstanding: loans.reduce((s,l)=>s+l.outstanding,0),
  }),[assets,workOrders,covenants,alerts,loans]);

  const CustomTip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return (
      <div style={{background:'#1f2937',color:'#f9fafb',padding:'10px 14px',borderRadius:8,fontSize:12}}>
        <div style={{fontWeight:700,marginBottom:4}}>{label}</div>
        {payload.map((p,i)=><div key={i} style={{color:p.color||'#f9fafb'}}>{p.name}: <b>{p.value} MWh</b></div>)}
      </div>
    );
  };

  const WoTip = ({active,payload,label})=>{
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
            <div className="en-page-title-icon" style={{background:'linear-gradient(135deg,#2563eb,#3b82f6)'}}>📊</div>
            <h1 className="en-page-title">Reports Dashboard</h1>
          </div>
          <p className="en-page-subtitle">Generate operational, financial, and compliance reports for all stakeholders</p>
        </div>
        <div className="en-page-header-actions">
          <select className="en-select" value={dateRange} onChange={e=>setDateRange(e.target.value)}>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="ytd">Year to Date</option>
          </select>
          <span className={`en-badge ${activeRole==='Admin'?'purple':activeRole==='Lender'?'amber':'blue'}`}>
            <FiUser size={11}/> {activeRole} View
          </span>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="en-stats-grid" style={{marginBottom:24}}>
        <div className="en-stat-card green">
          <div className="en-stat-top"><div className="en-stat-icon-wrap green"><FiActivity/></div><span className="en-stat-trend up">Fleet health</span></div>
          <div>
            <div className="en-stat-label">Operational Assets</div>
            <div className="en-stat-value green">{quickStats.operational}/{quickStats.totalAssets}</div>
            <div className="en-stat-sub">{Math.round(quickStats.operational/quickStats.totalAssets*100)}% uptime</div>
          </div>
        </div>
        <div className="en-stat-card amber">
          <div className="en-stat-top"><div className="en-stat-icon-wrap amber"><FiTool/></div></div>
          <div>
            <div className="en-stat-label">Open Work Orders</div>
            <div className="en-stat-value amber">{quickStats.openWOs}</div>
            <div className="en-stat-sub">Pending assignment</div>
          </div>
        </div>
        <div className="en-stat-card red">
          <div className="en-stat-top"><div className="en-stat-icon-wrap red"><FiAlertTriangle/></div></div>
          <div>
            <div className="en-stat-label">Covenant Breaches</div>
            <div className="en-stat-value red">{quickStats.breached}</div>
            <div className="en-stat-sub">Requires attention</div>
          </div>
        </div>
        <div className="en-stat-card blue">
          <div className="en-stat-top"><div className="en-stat-icon-wrap blue"><FiDollarSign/></div></div>
          <div>
            <div className="en-stat-label">Portfolio Outstanding</div>
            <div className="en-stat-value" style={{fontSize:20}}>₹{(quickStats.outstanding/10000000).toFixed(0)} Cr</div>
            <div className="en-stat-sub">Active loan portfolio</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="en-grid-2" style={{marginBottom:24}}>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#fef3c7',color:'#d97706'}}><FiBarChart2/></div>
              <div>
                <div className="en-card-title">Generation by Technology (MWh)</div>
                <div className="en-card-subtitle">Monthly energy output — Solar, Wind, Hydro</div>
              </div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={GEN_DATA} margin={{top:4,right:8,left:-10,bottom:0}}>
                <defs>
                  <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02}/>
                  </linearGradient>
                  <linearGradient id="gWind" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                  </linearGradient>
                  <linearGradient id="gHydro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <RechartsTip content={<CustomTip/>}/>
                <Legend wrapperStyle={{fontSize:11,color:'#6b7280'}}/>
                <Area type="monotone" dataKey="solar" name="Solar" stroke="#f59e0b" fill="url(#gSolar)" strokeWidth={2}/>
                <Area type="monotone" dataKey="wind"  name="Wind"  stroke="#3b82f6" fill="url(#gWind)"  strokeWidth={2}/>
                <Area type="monotone" dataKey="hydro" name="Hydro" stroke="#06b6d4" fill="url(#gHydro)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#fef3c7',color:'#d97706'}}><FiTool/></div>
              <div>
                <div className="en-card-title">Work Order Trend</div>
                <div className="en-card-subtitle">Open vs Closed work orders monthly</div>
              </div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={WO_TREND} margin={{top:4,right:8,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <RechartsTip content={<WoTip/>}/>
                <Legend wrapperStyle={{fontSize:11,color:'#6b7280'}}/>
                <Bar dataKey="open"   name="Open"   fill="#ef4444" radius={[0,0,0,0]} stackId="a"/>
                <Bar dataKey="closed" name="Closed" fill="#10b981" radius={[4,4,0,0]} stackId="a"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Report Templates */}
      <div className="en-card">
        <div className="en-card-header">
          <div className="en-card-header-left">
            <div className="en-card-icon" style={{background:'#dbeafe',color:'#2563eb'}}><FiFileText/></div>
            <div>
              <div className="en-card-title">Report Templates</div>
              <div className="en-card-subtitle">
                {visibleReports.length} reports available for {activeRole} role
              </div>
            </div>
          </div>
        </div>
        <div className="en-card-body">
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16}}>
            {visibleReports.map(rpt=>(
              <div key={rpt.id} className="en-report-card">
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                  <div style={{width:38,height:38,borderRadius:10,background:rpt.iconBg,color:rpt.iconColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                    {rpt.icon}
                  </div>
                  <span className={`en-report-tag ${rpt.tagCls}`}>{rpt.tag}</span>
                </div>
                <div>
                  <div className="en-report-title">{rpt.title}</div>
                  <div className="en-report-desc">{rpt.desc}</div>
                </div>
                {/* Quick metrics preview */}
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {rpt.metrics.map((m,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--ct-6b7280,#6b7280)'}}>
                      <span style={{width:4,height:4,borderRadius:'50%',background:rpt.iconColor,flexShrink:0}}/>
                      {m}
                    </div>
                  ))}
                </div>
                <button
                  className="en-btn en-btn-primary"
                  style={{background:`linear-gradient(135deg, ${rpt.btnColor}, ${rpt.btnColor}dd)`, width:'100%', justifyContent:'center', gap:8}}
                  onClick={()=>handleGenerate(rpt)}
                  disabled={generating===rpt.id}
                >
                  {generating===rpt.id ? (
                    <><span style={{display:'inline-block',width:13,height:13,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.8s linear infinite'}}/> Generating…</>
                  ) : (
                    <><FiDownload size={13}/> Generate Report →</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="en-card" style={{marginTop:20}}>
        <div className="en-card-header">
          <div className="en-card-header-left">
            <div className="en-card-icon" style={{background:'#f3f4f6',color:'#374151'}}><FiClock/></div>
            <div><div className="en-card-title">Recent Report Activity</div><div className="en-card-subtitle">Last generated reports</div></div>
          </div>
        </div>
        <div className="en-card-body">
          {[
            {title:'DSCR Compliance Report',date:'2025-06-20',by:'Admin',status:'Ready'},
            {title:'Monthly Generation Report',date:'2025-06-15',by:'Operator',status:'Ready'},
            {title:'Covenant Tracker Report',date:'2025-06-10',by:'Lender',status:'Ready'},
          ].map((r,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderBottom:i<2?'1px solid var(--c-f3f4f6,#f3f4f6)':'none'}}>
              <div style={{width:36,height:36,borderRadius:9,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280',flexShrink:0}}>
                <FiFileText size={16}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--ct-111827,#111827)'}}>{r.title}</div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}><FiCalendar size={10}/> {r.date} · <FiUser size={10}/> {r.by}</div>
              </div>
              <span className="en-badge green"><FiCheckCircle size={11}/> {r.status}</span>
              <button className="en-btn en-btn-outline en-btn-xs"><FiDownload size={11}/> Download</button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
