// DSCRMonitoring.js — Enterprise v2.0
import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, BarChart, Bar, Cell
} from 'recharts';
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import { DSCR_HISTORY, MOCK_LOANS } from '../../services/energyMockData';
import '../../pages-css/Energy/Energy.css';

const dscrRisk = v => v>=1.25?'safe':v>=1.10?'warning':'risk';
const dscrLabel = v => v>=1.25?'✓ Safe':v>=1.10?'⚠ Warning':'⚠ Risk';
const RISK_COLOR = { safe:'#10b981', warning:'#f59e0b', risk:'#ef4444' };
const RISK_BG = { safe:'#f0fdf4', warning:'#fffbeb', risk:'#fef2f2' };

function Tooltip({ text }) {
  const [show, setShow] = React.useState(false);
  return (
    <span className="en-tooltip-wrap" onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <span className="en-tooltip-icon">i</span>
      {show && <span className="en-tooltip-box">{text}</span>}
    </span>
  );
}

// Semicircle Gauge
function DSCRGauge({ value, size=100 }) {
  const risk = dscrRisk(value);
  const color = RISK_COLOR[risk];
  const max = 2.0; const min = 0;
  const pct = Math.min(Math.max((value-min)/(max-min),0),1);
  const angle = pct * 180;
  const r = size/2 - 8;
  const cx = size/2; const cy = size/2;
  const startX = cx - r; const startY = cy;
  const ex = cx + r*Math.cos(Math.PI - angle*Math.PI/180);
  const ey = cy - r*Math.sin(Math.PI - angle*Math.PI/180);
  const largeArc = angle>180?1:0;
  return (
    <svg width={size} height={size/2+16} viewBox={`0 0 ${size} ${size/2+16}`}>
      <path d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth={8} strokeLinecap="round"/>
      <path d={`M ${startX} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"/>
      <text x={cx} y={cy-6} textAnchor="middle" fontSize={size>80?16:12} fontWeight={900} fill={color}>{value}x</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize={10} fill="#6b7280">{dscrLabel(value)}</text>
    </svg>
  );
}

export default function DSCRMonitoring() {
  const { loans } = useEnergy();
  const [filterRisk, setFilterRisk] = useState('All Risk Levels');
  const [noi, setNoi] = useState(5000000);
  const [debtService, setDebtService] = useState(3500000);

  const calcDscr = debtService>0 ? +(noi/debtService).toFixed(2) : 0;
  const calcRisk = dscrRisk(calcDscr);

  const stats = useMemo(()=>({
    avgDscr: +(loans.reduce((s,l)=>s+l.dscr,0)/loans.length).toFixed(2),
    safe:    loans.filter(l=>l.dscr>=1.25).length,
    warning: loans.filter(l=>l.dscr>=1.10&&l.dscr<1.25).length,
    risk:    loans.filter(l=>l.dscr<1.10).length,
  }),[loans]);

  const filtered = useMemo(()=>loans.filter(l=>{
    if(filterRisk==='All Risk Levels') return true;
    if(filterRisk==='Safe') return l.dscr>=1.25;
    if(filterRisk==='Warning') return l.dscr>=1.10&&l.dscr<1.25;
    if(filterRisk==='Risk') return l.dscr<1.10;
    return true;
  }),[loans,filterRisk]);

  const portfolioTrend = useMemo(()=>{
    const months = ['Jan','Feb','Mar','Apr','May','Jun'];
    return months.map((m,i)=>({
      month:m,
      avg: +(Object.values(DSCR_HISTORY).reduce((s,arr)=>s+(arr[i]?.dscr||0),0)/Object.keys(DSCR_HISTORY).length).toFixed(2),
      threshold: 1.10
    }));
  },[]);

  const CustomTooltip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return (
      <div style={{background:'#1f2937',color:'#f9fafb',padding:'10px 14px',borderRadius:8,fontSize:12}}>
        <div style={{fontWeight:700,marginBottom:4}}>{label}</div>
        {payload.map((p,i)=><div key={i} style={{color:p.stroke||'#f9fafb'}}>{p.name}: <b>{p.value}x</b></div>)}
      </div>
    );
  };

  return (
    <div className="en-page">
      <div className="en-page-header">
        <div className="en-page-header-left">
          <div className="en-page-title-row">
            <div className="en-page-title-icon" style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)'}}>📊</div>
            <h1 className="en-page-title">DSCR Monitoring <Tooltip text="Debt Service Coverage Ratio — measures ability to pay loan obligations. DSCR = Net Operating Income ÷ Debt Service"/></h1>
          </div>
          <p className="en-page-subtitle">Debt Service Coverage Ratio — portfolio-wide risk tracking and trend analysis</p>
        </div>
        <select className="en-select" value={filterRisk} onChange={e=>setFilterRisk(e.target.value)}>
          {['All Risk Levels','Safe','Warning','Risk'].map(r=><option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="en-stats-grid">
        <div className="en-stat-card blue">
          <div className="en-stat-top"><div className="en-stat-icon-wrap blue"><FiTrendingUp/></div></div>
          <div>
            <div className="en-stat-label">Portfolio Avg DSCR <Tooltip text="Weighted average DSCR across all loans"/></div>
            <div className="en-stat-value">{stats.avgDscr}x</div>
            <div className="en-stat-sub">Weighted average</div>
          </div>
        </div>
        <div className="en-stat-card green">
          <div className="en-stat-top"><div className="en-stat-icon-wrap green"><FiCheckCircle/></div></div>
          <div>
            <div className="en-stat-label">Safe <Tooltip text="DSCR ≥ 1.25 — comfortable safety margin"/></div>
            <div className="en-stat-value green">{stats.safe}</div>
            <div className="en-stat-sub">DSCR ≥ 1.25</div>
          </div>
        </div>
        <div className="en-stat-card amber">
          <div className="en-stat-top"><div className="en-stat-icon-wrap amber"><FiAlertTriangle/></div></div>
          <div>
            <div className="en-stat-label">Warning <Tooltip text="DSCR 1.10–1.24 — monitor closely"/></div>
            <div className="en-stat-value amber">{stats.warning}</div>
            <div className="en-stat-sub">DSCR 1.10–1.24</div>
          </div>
        </div>
        <div className="en-stat-card red">
          <div className="en-stat-top"><div className="en-stat-icon-wrap red"><FiAlertTriangle/></div></div>
          <div>
            <div className="en-stat-label">Risk <Tooltip text="DSCR < 1.10 — below minimum threshold, lender action required"/></div>
            <div className="en-stat-value red">{stats.risk}</div>
            <div className="en-stat-sub">DSCR &lt; 1.10</div>
          </div>
        </div>
      </div>

      {/* Portfolio Trend */}
      <div className="en-card" style={{marginBottom:20}}>
        <div className="en-card-header">
          <div className="en-card-header-left">
            <div className="en-card-icon" style={{background:'#dbeafe',color:'#2563eb'}}><FiTrendingUp/></div>
            <div>
              <div className="en-card-title">Portfolio DSCR Trend (6 Months)</div>
              <div className="en-card-subtitle">Average DSCR across all loans. Red dashed = risk threshold (1.10)</div>
            </div>
          </div>
        </div>
        <div className="en-card-body">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={portfolioTrend} margin={{top:4,right:20,left:-10,bottom:0}}>
              <defs>
                <linearGradient id="gradDscr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
              <YAxis domain={[0.8,1.8]} tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
              <RechartsTip content={<CustomTooltip/>}/>
              <ReferenceLine y={1.10} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5}/>
              <ReferenceLine y={1.25} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1}/>
              <Area type="monotone" dataKey="avg" name="Avg DSCR" stroke="#3b82f6" fill="url(#gradDscr)" strokeWidth={2.5} dot={{r:3,fill:'#3b82f6'}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-loan DSCR cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16, marginBottom:20}}>
        {filtered.map(loan=>{
          const risk = dscrRisk(loan.dscr);
          const hist = DSCR_HISTORY[loan.id]||[];
          const color = RISK_COLOR[risk];
          const bg = RISK_BG[risk];
          const label = dscrLabel(loan.dscr);
          const trend = hist.length>1 ? hist[hist.length-1].dscr - hist[0].dscr : 0;
          return (
            <div key={loan.id} className="en-card" style={{borderTop:`3px solid ${color}`,background:risk==='risk'?bg:'var(--c-ffffff,#fff)'}}>
              <div style={{padding:'16px 18px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--ct-111827,#111827)',marginBottom:2}}>{loan.assetName}</div>
                    <div style={{fontSize:11,color:'#6b7280'}}>{loan.lender} · {loan.id}</div>
                  </div>
                  <DSCRGauge value={loan.dscr} size={90}/>
                </div>
                <div style={{display:'flex',gap:16,marginBottom:12,flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase'}}>Outstanding</div>
                    <div style={{fontSize:13,fontWeight:700}}>₹{(loan.outstanding/10000000).toFixed(2)} Cr</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase'}}>Monthly EMI</div>
                    <div style={{fontSize:13,fontWeight:700}}>₹{(loan.emi/100000).toFixed(1)} L</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase'}}>Rate</div>
                    <div style={{fontSize:13,fontWeight:700}}>{loan.interestRate}%</div>
                  </div>
                  <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4}}>
                    {trend>=0
                      ? <span style={{color:'#16a34a',display:'flex',alignItems:'center',gap:3,fontSize:12,fontWeight:700}}><FiTrendingUp size={13}/> +{trend.toFixed(2)}</span>
                      : <span style={{color:'#dc2626',display:'flex',alignItems:'center',gap:3,fontSize:12,fontWeight:700}}><FiTrendingDown size={13}/> {trend.toFixed(2)}</span>
                    }
                  </div>
                </div>
                {/* 6m sparkline */}
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={hist} margin={{top:0,right:0,left:0,bottom:0}}>
                    <defs>
                      <linearGradient id={`g${loan.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <ReferenceLine y={1.1} stroke="#ef4444" strokeDasharray="2 2" strokeWidth={1}/>
                    <Area type="monotone" dataKey="dscr" stroke={color} fill={`url(#g${loan.id})`} strokeWidth={2} dot={false} isAnimationActive={false}/>
                    <XAxis dataKey="month" tick={{fontSize:8,fill:'#9ca3af'}} tickLine={false} axisLine={false}/>
                    <YAxis hide domain={[0.8,1.8]}/>
                  </AreaChart>
                </ResponsiveContainer>
                {risk==='risk' && (
                  <div style={{marginTop:8,padding:'8px 12px',background:'#fef2f2',borderRadius:8,fontSize:12,color:'#b91c1c',display:'flex',alignItems:'center',gap:6}}>
                    <FiAlertTriangle size={13}/> Critical: DSCR below minimum threshold. Lender notification required.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DSCR Calculator */}
      <div className="en-card">
        <div className="en-card-header">
          <div className="en-card-header-left">
            <div className="en-card-icon" style={{background:'#f3e8ff',color:'#7c3aed'}}><FiInfo/></div>
            <div>
              <div className="en-card-title">DSCR Calculator <Tooltip text="Simulate DSCR using custom NOI and debt service values"/></div>
              <div className="en-card-subtitle">Simulate scenarios — DSCR = Net Operating Income ÷ Total Debt Service</div>
            </div>
          </div>
          <span style={{fontSize:12,color:'#6b7280'}}>Simulate scenarios</span>
        </div>
        <div className="en-card-body">
          <div className="en-form-row" style={{marginBottom:20}}>
            <div className="en-form-group">
              <label className="en-form-label">Net Operating Income (₹) <Tooltip text="Revenue from asset minus operating costs, before debt payments"/></label>
              <input className="en-form-input" type="number" value={noi} onChange={e=>setNoi(+e.target.value)} step={100000}/>
              <span className="en-form-hint">₹{(noi/100000).toFixed(1)} L</span>
            </div>
            <div className="en-form-group">
              <label className="en-form-label">Total Debt Service — EMI + Interest (₹) <Tooltip text="Total principal + interest payment obligation per period"/></label>
              <input className="en-form-input" type="number" value={debtService} onChange={e=>setDebtService(+e.target.value)} step={100000}/>
              <span className="en-form-hint">₹{(debtService/100000).toFixed(1)} L</span>
            </div>
          </div>
          <div style={{padding:'20px 24px',borderRadius:12,background:RISK_BG[calcRisk],border:`2px solid ${RISK_COLOR[calcRisk]}`,display:'flex',alignItems:'center',gap:24}}>
            <DSCRGauge value={calcDscr} size={120}/>
            <div>
              <div style={{fontSize:40,fontWeight:900,color:RISK_COLOR[calcRisk],lineHeight:1}}>{calcDscr}x</div>
              <div style={{fontSize:14,fontWeight:700,color:RISK_COLOR[calcRisk],marginBottom:6}}>{dscrLabel(calcDscr)}</div>
              <div style={{fontSize:12,color:'#6b7280'}}>
                {calcRisk==='safe' && 'Comfortable safety margin above threshold'}
                {calcRisk==='warning' && 'Approaching minimum threshold — monitor closely'}
                {calcRisk==='risk' && 'Below minimum threshold — lender action may be required'}
              </div>
            </div>
          </div>
          <div style={{marginTop:12,display:'flex',gap:20}}>
            {[{label:'Safe',color:'#10b981',range:'≥1.25'},{label:'Warning',color:'#f59e0b',range:'1.10–1.24'},{label:'Risk',color:'#ef4444',range:'<1.10'}].map(r=>(
              <span key={r.label} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6b7280'}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:r.color,display:'inline-block'}}/>{r.label}: {r.range}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
