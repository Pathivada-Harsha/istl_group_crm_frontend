// LoanManagement.js — Enterprise v2.0
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { FiDollarSign, FiPlus, FiSearch, FiTrendingUp, FiTrendingDown, FiCalendar, FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { useEnergy } from '../../context/EnergyContext';
import useToast from '../../hooks/useToast';
import ToastContainer from '../../components/Notification_Toast/ToastContainer';
import '../../pages-css/Energy/Energy.css';

const fmtCr = v => `₹${(v/10000000).toFixed(2)} Cr`;
const fmtL  = v => `₹${(v/100000).toFixed(1)} L`;
const STATUS_COLOR = { Active:'#10b981', Warning:'#f59e0b', Risk:'#ef4444', Closed:'#6b7280' };
const dscrRisk = v => v>=1.25?'safe':v>=1.10?'warning':'risk';
const RISK_COLOR = { safe:'#10b981', warning:'#f59e0b', risk:'#ef4444' };

function ProgressBar({ pct, color='#3b82f6', height=8, label }) {
  return (
    <div className="en-progress-wrap">
      {label && <div className="en-progress-header"><span>{label}</span><span>{pct}%</span></div>}
      <div className="en-progress-bar" style={{height}}>
        <div className="en-progress-fill" style={{width:`${pct}%`, background:color, height}}/>
      </div>
    </div>
  );
}

const BLANK = { assetId:'AST-001', lender:'', amount:'', interestRate:'', tenure:'', status:'Active', nextEmiDate:'' };

export default function LoanManagement() {
  const { loans, addLoan, assets } = useEnergy();
  const { toasts, showSuccess, showError, showInfo, removeToast } = useToast();
  const showToast = (msg, type='info') => { if(type==='success') showSuccess(msg); else if(type==='error') showError(msg); else showInfo(msg); };
  const [search, setSearch]     = useState('');
  const [statusF, setStatusF]   = useState('All');
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(BLANK);

  const stats = useMemo(()=>({
    total:       loans.length,
    disbursed:   loans.reduce((s,l)=>s+l.disbursed,0),
    outstanding: loans.reduce((s,l)=>s+l.outstanding,0),
    repaid:      loans.reduce((s,l)=>s+(l.disbursed-l.outstanding),0),
    active:      loans.filter(l=>l.status==='Active').length,
  }),[loans]);

  const emiCalc = useMemo(()=>{
    const p = +form.amount, r = +form.interestRate/100/12, n = +form.tenure;
    if(!p||!r||!n) return 0;
    return Math.round(p*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1));
  },[form.amount,form.interestRate,form.tenure]);

  const filtered = useMemo(()=>loans.filter(l=>{
    const q = search.toLowerCase();
    if(q && !l.assetName.toLowerCase().includes(q) && !l.id.toLowerCase().includes(q) && !l.lender.toLowerCase().includes(q)) return false;
    if(statusF!=='All' && l.status!==statusF) return false;
    return true;
  }),[loans,search,statusF]);

  // Charts data
  const outstandingData = useMemo(()=>loans.map(l=>({
    name: l.assetName.split('–')[0].trim().split(' ').slice(0,2).join(' '),
    outstanding: +(l.outstanding/10000000).toFixed(2),
    fill: l.dscr<1.10?'#ef4444':l.dscr<1.25?'#f59e0b':'#10b981',
  })),[loans]);

  const repaymentPie = useMemo(()=>[
    {name:'Repaid',      value:+(stats.repaid/10000000).toFixed(2),      color:'#10b981'},
    {name:'Outstanding', value:+(stats.outstanding/10000000).toFixed(2), color:'#3b82f6'},
  ],[stats]);

  const handleAdd = ()=>{
    if(!form.lender.trim()||!form.amount||!form.interestRate||!form.tenure){
      showToast('Fill all required fields','error'); return;
    }
    const asset = assets.find(a=>a.id===form.assetId)||assets[0];
    addLoan({
      id:`LN-${String(loans.length+1).padStart(3,'0')}`,
      assetId: form.assetId, assetName: asset?.name||'',
      lender: form.lender, amount:+form.amount, disbursed:+form.amount,
      outstanding:+form.amount, interestRate:+form.interestRate, tenure:+form.tenure,
      emi:emiCalc, nextEmiDate:form.nextEmiDate, status:form.status,
      dscr:1.20, covenants:[]
    });
    showToast('Loan added successfully','success');
    setModal(null); setForm(BLANK);
  };

  const CustomTip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return <div style={{background:'#1f2937',color:'#f9fafb',padding:'8px 12px',borderRadius:8,fontSize:12}}><b>{label}</b><br/>Outstanding: ₹{payload[0].value} Cr</div>;
  };

  return (
    <div className="en-page">
      <ToastContainer toasts={toasts} removeToast={removeToast}/>
      <div className="en-page-header">
        <div className="en-page-header-left">
          <div className="en-page-title-row">
            <div className="en-page-title-icon" style={{background:'linear-gradient(135deg,#059669,#10b981)'}}>🏦</div>
            <h1 className="en-page-title">Loan Management</h1>
          </div>
          <p className="en-page-subtitle">Track loan portfolio, EMI schedules, outstanding balances, and lender relationships</p>
        </div>
        <button className="en-btn en-btn-primary" onClick={()=>{setForm(BLANK);setModal('add');}}>
          <FiPlus size={15}/> Add Loan
        </button>
      </div>

      {/* Stats */}
      <div className="en-stats-grid">
        <div className="en-stat-card blue">
          <div className="en-stat-top"><div className="en-stat-icon-wrap blue"><FiDollarSign/></div></div>
          <div>
            <div className="en-stat-label">Total Loans</div>
            <div className="en-stat-value">{stats.total}</div>
            <div className="en-stat-sub">{stats.active} active</div>
          </div>
        </div>
        <div className="en-stat-card blue">
          <div className="en-stat-top"><div className="en-stat-icon-wrap blue"><FiTrendingUp/></div></div>
          <div>
            <div className="en-stat-label">Total Disbursed</div>
            <div className="en-stat-value" style={{fontSize:20}}>{fmtCr(stats.disbursed)}</div>
            <div className="en-stat-sub">Across all assets</div>
          </div>
        </div>
        <div className="en-stat-card amber">
          <div className="en-stat-top"><div className="en-stat-icon-wrap amber"><FiAlertTriangle/></div></div>
          <div>
            <div className="en-stat-label">Outstanding Debt</div>
            <div className="en-stat-value amber" style={{fontSize:20}}>{fmtCr(stats.outstanding)}</div>
            <div className="en-stat-sub">Principal remaining</div>
          </div>
        </div>
        <div className="en-stat-card green">
          <div className="en-stat-top"><div className="en-stat-icon-wrap green"><FiCheckCircle/></div></div>
          <div>
            <div className="en-stat-label">Repaid</div>
            <div className="en-stat-value green" style={{fontSize:20}}>{fmtCr(stats.repaid)}</div>
            <div className="en-stat-sub">Principal repaid</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="en-grid-2" style={{marginBottom:20}}>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#dbeafe',color:'#2563eb'}}><FiDollarSign/></div>
              <div><div className="en-card-title">Outstanding by Asset</div><div className="en-card-subtitle">Color = DSCR risk level</div></div>
            </div>
          </div>
          <div className="en-card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={outstandingData} margin={{top:4,right:8,left:-10,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:9,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#6b7280'}} tickLine={false} axisLine={false}/>
                <RechartsTip content={<CustomTip/>}/>
                <Bar dataKey="outstanding" name="Outstanding (₹Cr)" radius={[4,4,0,0]}>
                  {outstandingData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="en-card">
          <div className="en-card-header">
            <div className="en-card-header-left">
              <div className="en-card-icon" style={{background:'#dcfce7',color:'#16a34a'}}><FiCheckCircle/></div>
              <div><div className="en-card-title">Repayment Progress</div><div className="en-card-subtitle">Portfolio-level repayment</div></div>
            </div>
          </div>
          <div className="en-card-body" style={{display:'flex',alignItems:'center',gap:24}}>
            <div style={{position:'relative'}}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={repaymentPie} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
                    {repaymentPie.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                <div style={{fontSize:14,fontWeight:900,color:'#16a34a'}}>{Math.round(stats.repaid/stats.disbursed*100)}%</div>
                <div style={{fontSize:9,color:'#6b7280',fontWeight:600}}>REPAID</div>
              </div>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:14}}>
              {repaymentPie.map((r,i)=>(
                <div key={i}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                    <span style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:r.color,display:'inline-block'}}/>
                      {r.name}
                    </span>
                    <b style={{color:r.color}}>₹{r.value} Cr</b>
                  </div>
                  <div className="en-progress-bar">
                    <div className="en-progress-fill" style={{width:`${(r.value/(stats.disbursed/10000000))*100}%`,background:r.color}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div className="en-search-wrap">
          <FiSearch size={14}/>
          <input className="en-search" placeholder="Search loans…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="en-select" value={statusF} onChange={e=>setStatusF(e.target.value)}>
          <option value="All">All Statuses</option>
          {['Active','Warning','Risk','Closed'].map(s=><option key={s}>{s}</option>)}
        </select>
        <span style={{fontSize:12,color:'var(--ct-6b7280,#6b7280)'}}><b>{filtered.length}</b> loans</span>
      </div>

      {/* Loan Cards */}
      {filtered.map(loan=>{
        const sc = STATUS_COLOR[loan.status]||'#6b7280';
        const risk = dscrRisk(loan.dscr);
        const rc = RISK_COLOR[risk];
        const repaidPct = Math.round((loan.disbursed-loan.outstanding)/loan.disbursed*100);
        return (
          <div key={loan.id} className="en-loan-card" style={{borderLeftColor:sc}} onClick={()=>{setSelected(loan);setModal('detail');}}>
            <div className="en-loan-card-top">
              <div>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                  <span className="en-cell-mono" style={{fontSize:12}}>{loan.id}</span>
                  <span className="en-badge" style={{background:sc+'22',color:sc}}>{loan.status}</span>
                </div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--ct-111827,#111827)',marginBottom:2}}>{loan.assetName}</div>
                <div style={{fontSize:12,color:'#6b7280'}}>{loan.lender} · {loan.interestRate}% p.a. · {loan.tenure} months</div>
              </div>
              <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase'}}>Outstanding</div>
                  <div style={{fontSize:16,fontWeight:800,color:loan.status==='Risk'?'#dc2626':loan.status==='Warning'?'#d97706':'var(--ct-111827,#111827)'}}>{fmtCr(loan.outstanding)}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase'}}>Monthly EMI</div>
                  <div style={{fontSize:14,fontWeight:700}}>{fmtL(loan.emi)}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase'}}>Next EMI</div>
                  <div style={{fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><FiCalendar size={11}/>{loan.nextEmiDate}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase'}}>DSCR</div>
                  <div style={{fontSize:18,fontWeight:900,color:rc}}>{loan.dscr}x</div>
                  <div style={{fontSize:10,color:rc,fontWeight:600}}>{risk==='safe'?'✓ Safe':risk==='warning'?'⚠ Warning':'⚠ Risk'}</div>
                </div>
              </div>
            </div>
            <ProgressBar pct={repaidPct} color={sc} label={`Repayment: ${repaidPct}%`}/>
            <div style={{marginTop:6,fontSize:12,color:'#9ca3af'}}>{fmtCr(loan.outstanding)} remaining</div>
          </div>
        );
      })}

      {/* Detail Modal */}
      {modal==='detail' && selected && (
        <div className="en-modal-overlay" onClick={()=>setModal(null)}>
          <div className="en-modal en-modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <div>
                <h2 className="en-modal-title">{selected.assetName}</h2>
                <span className="en-cell-mono" style={{fontSize:12,color:'#6b7280'}}>{selected.id} · {selected.lender}</span>
              </div>
              <button className="en-modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="en-modal-body">
              <div className="en-info-grid" style={{marginBottom:16}}>
                <div className="en-info-item"><span className="en-info-label">Sanctioned Amount</span><span className="en-info-value">{fmtCr(selected.amount)}</span></div>
                <div className="en-info-item"><span className="en-info-label">Outstanding</span><span className="en-info-value" style={{color:'#d97706'}}>{fmtCr(selected.outstanding)}</span></div>
                <div className="en-info-item"><span className="en-info-label">Interest Rate</span><span className="en-info-value">{selected.interestRate}% p.a.</span></div>
                <div className="en-info-item"><span className="en-info-label">Tenure</span><span className="en-info-value">{selected.tenure} months</span></div>
                <div className="en-info-item"><span className="en-info-label">Monthly EMI</span><span className="en-info-value">{fmtL(selected.emi)}</span></div>
                <div className="en-info-item"><span className="en-info-label">Next EMI Date</span><span className="en-info-value">{selected.nextEmiDate}</span></div>
                <div className="en-info-item"><span className="en-info-label">DSCR</span><span className="en-info-value" style={{color:RISK_COLOR[dscrRisk(selected.dscr)]}}>{selected.dscr}x</span></div>
                <div className="en-info-item"><span className="en-info-label">Status</span><span className="en-info-value"><span className="en-badge" style={{background:STATUS_COLOR[selected.status]+'22',color:STATUS_COLOR[selected.status]}}>{selected.status}</span></span></div>
              </div>
              {selected.covenants?.length>0 && (
                <div>
                  <div className="en-info-label" style={{marginBottom:8}}>Loan Covenants</div>
                  {selected.covenants.map((c,i)=>(
                    <div key={i} style={{padding:'8px 12px',borderRadius:8,background:'var(--c-f9fafb,#f9fafb)',marginBottom:6,fontSize:12,display:'flex',alignItems:'center',gap:8}}>
                      <FiCheckCircle size={12} style={{color:'#10b981'}}/> {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Loan Modal */}
      {modal==='add' && (
        <div className="en-modal-overlay" onClick={()=>setModal(null)}>
          <div className="en-modal" onClick={e=>e.stopPropagation()}>
            <div className="en-modal-header">
              <h2 className="en-modal-title">Add Loan</h2>
              <button className="en-modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="en-modal-body">
              <div className="en-form-group">
                <label className="en-form-label">Asset <span>*</span></label>
                <select className="en-form-select" value={form.assetId} onChange={e=>setForm(f=>({...f,assetId:e.target.value}))}>
                  {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="en-form-group">
                <label className="en-form-label">Lender Name <span>*</span></label>
                <input className="en-form-input" value={form.lender} onChange={e=>setForm(f=>({...f,lender:e.target.value}))} placeholder="e.g. State Bank of India"/>
              </div>
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Loan Amount (₹) <span>*</span></label>
                  <input className="en-form-input" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="e.g. 180000000"/>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">Interest Rate (% p.a.) <span>*</span></label>
                  <input className="en-form-input" type="number" step="0.1" value={form.interestRate} onChange={e=>setForm(f=>({...f,interestRate:e.target.value}))} placeholder="e.g. 9.5"/>
                </div>
              </div>
              <div className="en-form-row">
                <div className="en-form-group">
                  <label className="en-form-label">Tenure (months) <span>*</span></label>
                  <input className="en-form-input" type="number" value={form.tenure} onChange={e=>setForm(f=>({...f,tenure:e.target.value}))} placeholder="e.g. 180"/>
                </div>
                <div className="en-form-group">
                  <label className="en-form-label">First EMI Date</label>
                  <input className="en-form-input" type="date" value={form.nextEmiDate} onChange={e=>setForm(f=>({...f,nextEmiDate:e.target.value}))}/>
                </div>
              </div>
              {emiCalc>0 && (
                <div className="en-form-group">
                  <label className="en-form-label">Auto-calculated Monthly EMI</label>
                  <div className="en-form-computed">≈ {fmtL(emiCalc)} / month</div>
                  <span className="en-form-hint">Using compound interest formula</span>
                </div>
              )}
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="en-btn en-btn-primary" onClick={handleAdd}><FiPlus size={13}/> Add Loan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
