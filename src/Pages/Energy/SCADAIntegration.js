// SCADAIntegration.js — Enterprise v2.0
import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { FiZap, FiWind, FiDroplet, FiThermometer, FiSun, FiActivity, FiPause, FiPlay, FiWifi, FiWifiOff } from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import '../../pages-css/Energy/Energy.css';

const ASSET_TYPE_ICON = { 'Solar PV': <FiSun/>, Wind: <FiWind/>, Hydro: <FiDroplet/> };
const METRIC_CONFIG = {
  activePower:  { label:'Active Power', icon:<FiZap/>,         unit:'MW',   color:'#f59e0b' },
  irradiance:   { label:'Irradiance',   icon:<FiSun/>,         unit:'W/m²', color:'#f97316' },
  windSpeed:    { label:'Wind Speed',   icon:<FiWind/>,        unit:'m/s',  color:'#3b82f6' },
  waterFlow:    { label:'Water Flow',   icon:<FiDroplet/>,     unit:'m³/s', color:'#06b6d4' },
  temperature:  { label:'Temperature',  icon:<FiThermometer/>, unit:'°C',   color:'#ef4444' },
  availability: { label:'Availability', icon:<FiActivity/>,    unit:'%',    color:'#10b981' },
};

function MetricCard({ metricKey, value, history }) {
  const cfg = METRIC_CONFIG[metricKey];
  if(!cfg||value===undefined) return null;
  const histData = (history||[]).map((v,i)=>({ t:i, v }));
  return (
    <div className="en-scada-metric">
      <div className="en-scada-metric-icon" style={{color:cfg.color}}>{cfg.icon}</div>
      <div className="en-scada-metric-label">{cfg.label}</div>
      <div className="en-scada-metric-value" style={{color:cfg.color}}>{typeof value==='number'?value.toFixed(1):value}</div>
      <div className="en-scada-metric-unit">{cfg.unit}</div>
      {histData.length>2 && (
        <ResponsiveContainer width="100%" height={30}>
          <AreaChart data={histData} margin={{top:2,right:0,left:0,bottom:0}}>
            <defs>
              <linearGradient id={`sg${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cfg.color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={cfg.color} fill={`url(#sg${metricKey})`} strokeWidth={1.5} dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function SCADAIntegration() {
  const { assets, scadaData, scadaRunning, toggleScada } = useEnergy();
  const [filterType, setFilterType] = useState('All Types');
  const [refreshKey, setRefreshKey] = useState(0);

  const totalGen = useMemo(()=>
    Object.values(scadaData).reduce((s,d)=>s+(d?.activePower||0),0).toFixed(1)
  ,[scadaData]);

  const onlineCount = useMemo(()=>
    assets.filter(a=>a.status!=='Offline').length
  ,[assets]);

  const dataPoints = useMemo(()=>
    Object.values(scadaData).reduce((s,d)=>s+(d?.history?Object.values(d.history).reduce((ss,h)=>ss+(h?.length||0),0):0),0)
  ,[scadaData]);

  const filtered = useMemo(()=>assets.filter(a=>filterType==='All Types'||a.type===filterType),[assets,filterType]);

  // Portfolio generation area chart (last 12 ticks simulated)
  const genHistory = useMemo(()=>{
    const maxLen = 12;
    const powerHistory = Object.values(scadaData).map(d=>d?.history?.activePower||[]).filter(h=>h.length>0);
    if(powerHistory.length===0) return [];
    const len = Math.min(...powerHistory.map(h=>h.length), maxLen);
    return Array.from({length:len},(_,i)=>({
      t:`-${len-i-1}`,
      total: +powerHistory.reduce((s,h)=>s+(h[h.length-len+i]||0),0).toFixed(1)
    }));
  },[scadaData]);

  return (
    <div className="en-page">
      <div className="en-page-header">
        <div className="en-page-header-left">
          <div className="en-page-title-row">
            <div className="en-page-title-icon" style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)'}}>📡</div>
            <h1 className="en-page-title">SCADA Integration</h1>
          </div>
          <p className="en-page-subtitle">Real-time telemetry from all connected renewable energy assets</p>
        </div>
        <div className="en-page-header-actions">
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--ct-374151,#374151)'}}>
            {scadaRunning ? <><div className="en-scada-live-dot"/> Live — 5s refresh</> : <><FiWifiOff style={{color:'#ef4444'}}/> Paused</>}
          </div>
          <button className={`en-btn ${scadaRunning?'en-btn-danger':'en-btn-primary'}`} onClick={toggleScada}>
            {scadaRunning?<><FiPause size={14}/> Pause</>:<><FiPlay size={14}/> Resume</>}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="en-stats-grid">
        <div className="en-stat-card amber">
          <div className="en-stat-top"><div className="en-stat-icon-wrap amber"><FiZap/></div></div>
          <div>
            <div className="en-stat-label">Total Live Generation</div>
            <div className="en-stat-value">{totalGen} <span style={{fontSize:14}}>MW</span></div>
            <div className="en-stat-sub">Across all online assets</div>
          </div>
        </div>
        <div className="en-stat-card green">
          <div className="en-stat-top"><div className="en-stat-icon-wrap green"><FiWifi/></div></div>
          <div>
            <div className="en-stat-label">Online Assets</div>
            <div className="en-stat-value green">{onlineCount}</div>
            <div className="en-stat-sub">of {assets.length} total</div>
          </div>
        </div>
        <div className="en-stat-card blue">
          <div className="en-stat-top"><div className="en-stat-icon-wrap blue"><FiActivity/></div></div>
          <div>
            <div className="en-stat-label">SCADA Update Rate</div>
            <div className="en-stat-value">Every 5s</div>
            <div className="en-stat-sub">Simulated refresh rate</div>
          </div>
        </div>
        <div className="en-stat-card teal">
          <div className="en-stat-top"><div className="en-stat-icon-wrap teal"><FiActivity/></div></div>
          <div>
            <div className="en-stat-label">Data Points Active</div>
            <div className="en-stat-value">{assets.length * 4}</div>
            <div className="en-stat-sub">Live metrics active</div>
          </div>
        </div>
      </div>

      {/* Portfolio generation trend */}
      {genHistory.length>2 && (
        <div className="en-card" style={{marginBottom:20}}>
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#fef3c7',color:'#d97706'}}><FiZap/></div>
              <div>
                <div className="en-card-title">Portfolio Generation Trend</div>
                <div className="en-card-subtitle">Total active power across all assets (live, last 12 ticks)</div>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:700}}>
              <div className="en-scada-live-dot"/>
              <span style={{color:'#16a34a'}}>{totalGen} MW</span>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={genHistory} margin={{top:4,right:8,left:-10,bottom:0}}>
                <defs>
                  <linearGradient id="gradGen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="t" tick={{fontSize:9,fill:'#9ca3af'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <RechartsTip formatter={(v)=>[`${v} MW`,'Total Gen']} contentStyle={{background:'#1f2937',border:'none',borderRadius:8,color:'#f9fafb',fontSize:12}}/>
                <Area type="monotone" dataKey="total" stroke="#f59e0b" fill="url(#gradGen)" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:16}}>
        <select className="en-select" value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option>All Types</option>
          {['Solar PV','Wind','Hydro'].map(t=><option key={t}>{t}</option>)}
        </select>
        <span style={{fontSize:12,color:'var(--ct-6b7280,#6b7280)'}}><b>{filtered.length}</b> assets</span>
      </div>

      {/* Asset Cards */}
      {filtered.map(asset=>{
        const data = scadaData[asset.id]||{};
        const isOffline = asset.status==='Offline';
        const isOnline = asset.status==='Operational';
        const hist = data.history||{};

        const borderColor = isOffline?'#ef4444':isOnline?'#10b981':'#f59e0b';

        const metricsToShow = asset.type==='Solar PV'
          ? ['activePower','irradiance','temperature','availability']
          : asset.type==='Wind'
          ? ['activePower','windSpeed','temperature','availability']
          : ['activePower','waterFlow','temperature','availability'];

        return (
          <div key={asset.id} className="en-scada-asset-card" style={{borderLeft:`4px solid ${borderColor}`,marginBottom:16}}>
            <div className="en-scada-asset-header">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="en-scada-live-dot" style={{background:isOffline?'#ef4444':'#22c55e'}}/>
                <div>
                  <div style={{fontWeight:700,color:'var(--ct-111827,#111827)',fontSize:14}}>
                    <span style={{marginRight:6}}>{ASSET_TYPE_ICON[asset.type]}</span>
                    {asset.name}
                  </div>
                  <div style={{fontSize:12,color:'#6b7280'}}>{asset.type} · {asset.capacity} MW · {asset.location}</div>
                </div>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <span className={`en-badge ${isOffline?'red':isOnline?'green':'amber'}`}>{asset.status}</span>
                {data.timestamp && (
                  <span style={{fontSize:11,color:'#9ca3af'}}>{new Date(data.timestamp).toLocaleTimeString()}</span>
                )}
              </div>
            </div>
            {isOffline && (
              <div className="en-scada-offline">
                <FiWifiOff size={14}/> Asset offline — SCADA telemetry not available
              </div>
            )}
            <div className="en-scada-metric-grid">
              {metricsToShow.map(key=>(
                <MetricCard key={key} metricKey={key} value={data[key]} history={hist[key]}/>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
