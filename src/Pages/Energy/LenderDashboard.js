// LenderDashboard.js — Enterprise v2.0
import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { FiDollarSign, FiAlertTriangle, FiTrendingDown, FiTrendingUp, FiShield, FiBell, FiInfo } from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import { DSCR_HISTORY } from '../../services/energyMockData';
import '../../pages-css/Energy/Energy.css';

const fmtCr = v => `₹${(v/10000000).toFixed(2)} Cr`;
const dscrRisk = v => v>=1.25?'safe':v>=1.10?'warning':'risk';
const dscrLabel = v => v>=1.25?'Safe':v>=1.10?'Warning':'Risk';
const RISK_COLOR = { safe:'#10b981', warning:'#f59e0b', risk:'#ef4444' };

function Tooltip({ text }) {
  const [show, setShow] = React.useState(false);
  return (
    <span className="en-tooltip-wrap" onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <span className="en-tooltip-icon">i</span>
      {show && <span className="en-tooltip-box">{text}</span>}
    </span>
  );
}

function SparkLine({ data, risk }) {
  const color = RISK_COLOR[risk]||'#6b7280';
  return (
    <ResponsiveContainer width={120} height={36}>
      <LineChart data={data} margin={{top:4,right:0,left:0,bottom:4}}>
        <ReferenceLine y={1.1} stroke="#ef4444" strokeDasharray="2 2" strokeWidth={1}/>
        <Line type="monotone" dataKey="dscr" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false}/>
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function LenderDashboard() {
  const { loans, alerts, assets } = useEnergy();

  const portfolio = useMemo(()=>{
    const totalDisb = loans.reduce((s,l)=>s+l.disbursed,0);
    const totalOut  = loans.reduce((s,l)=>s+l.outstanding,0);
    const repaid    = totalDisb - totalOut;
    const avgDscr   = (loans.reduce((s,l)=>s+l.dscr,0)/loans.length).toFixed(2);
    const atRisk    = loans.filter(l=>l.dscr<1.1).length;
    const finAlerts = alerts.filter(a=>a.category==='Financial' && !a.acknowledged).length;
    return { totalDisb, totalOut, repaid, avgDscr, atRisk, finAlerts };
  },[loans,alerts]);

  // Area chart: portfolio outstanding over months (simulated)
  const outstandingTrend = useMemo(()=>[
    {month:'Jan',outstanding:110,disbursed:118},
    {month:'Feb',outstanding:108,disbursed:118},
    {month:'Mar',outstanding:106,disbursed:118},
    {month:'Apr',outstanding:103,disbursed:118},
    {month:'May',outstanding:99,disbursed:118},
    {month:'Jun',outstanding:95,disbursed:118},
  ],[]);

  // Risk distribution
  const riskDist = useMemo(()=>[
    {name:'Safe (DSCR ≥1.25)',   value:loans.filter(l=>l.dscr>=1.25).length, color:'#10b981'},
    {name:'Warning (1.10–1.24)', value:loans.filter(l=>l.dscr>=1.10&&l.dscr<1.25).length, color:'#f59e0b'},
    {name:'Risk (<1.10)',         value:loans.filter(l=>l.dscr<1.10).length, color:'#ef4444'},
  ],[loans]);

  // DSCR bar chart across loans
  const dscrBarData = useMemo(()=>loans.map(l=>({
    name: l.assetName.split('–')[0].trim().split(' ').slice(0,2).join(' '),
    dscr: l.dscr,
    fill: RISK_COLOR[dscrRisk(l.dscr)],
  })),[loans]);

  const CustomTooltip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return (
      <div style={{background:'#1f2937',color:'#f9fafb',padding:'10px 14px',borderRadius:8,fontSize:12}}>
        <div style={{fontWeight:700,marginBottom:6}}>{label}</div>
        {payload.map((p,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',gap:16}}>
            <span style={{color:p.color||'#f9fafb'}}>{p.name}</span>
            <b>{typeof p.value==='number'&&p.value>10?`₹${p.value} Cr`:`${p.value}x`}</b>
          </div>
        ))}
      </div>
    );
  };

  const finAlerts = alerts.filter(a=>a.category==='Financial');

  return (
    <div className="en-page">
      <div className="en-page-header">
        <div className="en-page-header-left">
          <div className="en-page-title-row">
            <div className="en-page-title-icon" style={{background:'linear-gradient(135deg,#1d4ed8,#3b82f6)'}}>🏦</div>
            <h1 className="en-page-title">Lender Dashboard</h1>
          </div>
          <p className="en-page-subtitle">Portfolio risk overview, DSCR monitoring, and covenant compliance at a glance</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="en-stats-grid">
        <div className="en-stat-card blue">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap blue"><FiDollarSign/></div>
            <span className="en-stat-trend down">Principal Remaining</span>
          </div>
          <div>
            <div className="en-stat-label">Total Outstanding</div>
            <div className="en-stat-value" style={{fontSize:22}}>{fmtCr(portfolio.totalOut)}</div>
            <div className="en-stat-sub">of {fmtCr(portfolio.totalDisb)} disbursed</div>
          </div>
        </div>
        <div className="en-stat-card green">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap green"><FiTrendingUp/></div>
            <span className="en-stat-trend up">Safe portfolio</span>
          </div>
          <div>
            <div className="en-stat-label">
              Portfolio Avg DSCR
              <Tooltip text="Debt Service Coverage Ratio: higher is safer. Safe ≥1.25, Risk <1.10"/>
            </div>
            <div className="en-stat-value">{portfolio.avgDscr}x</div>
            <div className="en-stat-sub">Weighted average</div>
          </div>
        </div>
        <div className="en-stat-card amber">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap amber"><FiAlertTriangle/></div>
            <span className="en-stat-trend down">In Warning zone</span>
          </div>
          <div>
            <div className="en-stat-label">Loans at Risk</div>
            <div className="en-stat-value amber">{portfolio.atRisk}</div>
            <div className="en-stat-sub">DSCR below threshold</div>
          </div>
        </div>
        <div className="en-stat-card red">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap red"><FiBell/></div>
          </div>
          <div>
            <div className="en-stat-label">Financial Alerts</div>
            <div className="en-stat-value red">{portfolio.finAlerts}</div>
            <div className="en-stat-sub">Requiring attention</div>
          </div>
        </div>
        <div className="en-stat-card green">
          <div className="en-stat-top">
            <div className="en-stat-icon-wrap green"><FiShield/></div>
          </div>
          <div>
            <div className="en-stat-label">Principal Repaid</div>
            <div className="en-stat-value green" style={{fontSize:20}}>{fmtCr(portfolio.repaid)}</div>
            <div className="en-stat-sub">{Math.round(portfolio.repaid/portfolio.totalDisb*100)}% of total</div>
          </div>
        </div>
      </div>

      {/* Row: Portfolio Trend + Risk distribution */}
      <div className="en-grid-2" style={{marginBottom:20}}>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#dbeafe',color:'#2563eb'}}><FiTrendingDown/></div>
              <div>
                <div className="en-card-title">Portfolio Outstanding Trend</div>
                <div className="en-card-subtitle">Principal outstanding over 6 months (₹ Cr)</div>
              </div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={outstandingTrend} margin={{top:4,right:8,left:-10,bottom:0}}>
                <defs>
                  <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <RechartsTip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="outstanding" name="Outstanding (₹Cr)" stroke="#3b82f6" fill="url(#gradOut)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#f0fdf4',color:'#16a34a'}}><FiShield/></div>
              <div>
                <div className="en-card-title">Portfolio Health</div>
                <div className="en-card-subtitle">Risk distribution across {loans.length} loans</div>
              </div>
            </div>
          </div>
          <div className="en-card-body" style={{display:'flex',alignItems:'center',gap:24}}>
            <div style={{position:'relative'}}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={riskDist} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                    {riskDist.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                <div style={{fontSize:22,fontWeight:900,color:'var(--ct-111827,#111827)'}}>{loans.length}</div>
                <div style={{fontSize:10,color:'#6b7280',fontWeight:600}}>LOANS</div>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {riskDist.map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{width:10,height:10,borderRadius:2,background:r.color,flexShrink:0}}/>
                  <span style={{fontSize:12,color:'var(--ct-374151,#374151)',flex:1}}>{r.name}</span>
                  <span style={{fontWeight:800,fontSize:16,color:r.color}}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DSCR bar chart */}
      <div className="en-card" style={{marginBottom:20}}>
        <div className="en-card-header">
          <div className="en-card-header-left">
            <div className="en-card-icon" style={{background:'#fef3c7',color:'#d97706'}}><FiShield/></div>
            <div>
              <div className="en-card-title">DSCR by Loan <Tooltip text="Debt Service Coverage Ratio. Safe ≥1.25 (green), Warning 1.10–1.24 (amber), Risk <1.10 (red)"/></div>
              <div className="en-card-subtitle">Current DSCR across all active loans</div>
            </div>
          </div>
        </div>
        <div className="en-card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dscrBarData} margin={{top:4,right:20,left:-10,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
              <YAxis domain={[0,2]} tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
              <RechartsTip content={({active,payload,label})=>active&&payload?.length?<div style={{background:'#1f2937',color:'#f9fafb',padding:'8px 12px',borderRadius:8,fontSize:12}}><b>{label}</b><br/>DSCR: {payload[0].value}x</div>:null}/>
              <ReferenceLine y={1.1} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} label={{value:'Risk threshold 1.10',fontSize:10,fill:'#ef4444',position:'right'}}/>
              <ReferenceLine y={1.25} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} label={{value:'Safe 1.25',fontSize:10,fill:'#f59e0b',position:'right'}}/>
              <Bar dataKey="dscr" name="DSCR" radius={[4,4,0,0]}>
                {dscrBarData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Loan Risk Table */}
      <div className="en-card">
        <div className="en-card-header">
          <div className="en-card-header-left">
            <div className="en-card-icon" style={{background:'#fee2e2',color:'#dc2626'}}><FiAlertTriangle/></div>
            <div>
              <div className="en-card-title">Loan-wise Risk Summary</div>
              <div className="en-card-subtitle">DSCR, trends, covenant status, and upcoming EMIs</div>
            </div>
          </div>
        </div>
        <div className="en-table-wrap">
          <table className="en-table">
            <thead><tr>
              <th>Loan</th><th>Asset</th><th>Lender</th>
              <th>Outstanding</th><th>DSCR <Tooltip text="Current DSCR — safe ≥1.25"/></th>
              <th>6M Trend</th><th>Risk Level</th><th>Next EMI</th>
            </tr></thead>
            <tbody>
              {loans.map(loan=>{
                const risk = dscrRisk(loan.dscr);
                const hist = DSCR_HISTORY[loan.id]||[];
                const rc = RISK_COLOR[risk];
                return (
                  <tr key={loan.id}>
                    <td><span className="en-cell-mono">{loan.id}</span></td>
                    <td className="en-cell-primary" style={{maxWidth:160,fontSize:12}}>{loan.assetName}</td>
                    <td style={{fontSize:12}}>{loan.lender}</td>
                    <td><b style={{color:risk==='risk'?'#dc2626':'var(--ct-111827,#111827)'}}>{fmtCr(loan.outstanding)}</b></td>
                    <td><span style={{fontSize:16,fontWeight:800,color:rc}}>{loan.dscr}x</span></td>
                    <td><SparkLine data={hist} risk={risk}/></td>
                    <td>
                      <span className={`en-badge ${risk==='safe'?'green':risk==='warning'?'amber':'red'}`}>
                        {risk==='safe'?'✓ ':risk==='warning'?'⚠ ':'⚠ '}{dscrLabel(loan.dscr)}
                      </span>
                    </td>
                    <td style={{fontSize:12}}>{loan.nextEmiDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Alerts */}
      {finAlerts.length>0 && (
        <div style={{marginTop:20}}>
          <div style={{fontSize:14,fontWeight:700,color:'var(--ct-111827,#111827)',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
            <FiBell style={{color:'#ef4444'}}/> Financial Alerts
          </div>
          {finAlerts.slice(0,5).map(a=>(
            <div key={a.id} className={`en-alert-item ${a.acknowledged?'acked':''}`}>
              <div className={`en-alert-dot ${a.type.toLowerCase()}`}/>
              <div className="en-alert-body">
                <div className="en-alert-msg">{a.message}</div>
                <div className="en-alert-meta">
                  <span>📍 {a.assetName}</span>
                  <span className={`en-badge ${a.type==='Critical'?'red':a.type==='Warning'?'amber':'blue'}`}>{a.type}</span>
                  {a.acknowledged && <span className="en-badge gray">✓ Acknowledged</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
