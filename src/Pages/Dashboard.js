import React, { useState, useEffect, useCallback } from 'react';
import '../pages-css/Dashboard.css';
import { useAuth } from '../hooks/useAuth.js';

const API_BASE_URL = process.env.REACT_APP_API_URL;

function getDashboardEndpoint(role) {
  if (!role) return 'generic';
  const r = role.trim().toUpperCase();
  if (r === 'SUPERADMIN' || r === 'ADMIN') return 'admin';
  if (r === 'MANAGER' || r === 'BD_MANAGER' || r === 'SALES_MANAGER') return 'sales-manager';
  if (r === 'TELECALLER') return 'telecaller';
  if (r === 'BD_EXECUTIVE' || r === 'BDEXECUTIVE' || r === 'SALES_EXEC') return 'bd';
  // Any other role (PROCUREMENT_MANAGER, TESTING_ROLE, custom roles, etc.) → generic
  return 'generic';
}

const fmt = n => (n ?? 0).toLocaleString('en-IN');
const fmtCr = v => {
  const n = parseFloat(v || 0);
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
};
const fmtDate = s => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}); }
  catch { return s; }
};

const STATUS_COLORS = {
  'Closed Won':{'bg':'#d1fae5','color':'#065f46'},'Closed Lost':{'bg':'#fee2e2','color':'#991b1b'},
  'New':{'bg':'#eff6ff','color':'#1e40af'},'Contacted':{'bg':'#fef3c7','color':'#92400e'},
  'In Discussion':{'bg':'#fde8d8','color':'#9a3412'},'Proposal Sent':{'bg':'#e0e7ff','color':'#3730a3'},
  'INTERESTED':{'bg':'#d1fae5','color':'#065f46'},'NOT_INTERESTED':{'bg':'#fee2e2','color':'#991b1b'},
  'NOT_RESPONDED':{'bg':'#fef3c7','color':'#92400e'},'Accepted':{'bg':'#d1fae5','color':'#065f46'},
  'Draft':{'bg':'#f3f4f6','color':'#374151'},'Sent':{'bg':'#e0e7ff','color':'#3730a3'},
  'Completed':{'bg':'#d1fae5','color':'#065f46'},'Confirmed':{'bg':'#dbeafe','color':'#1e40af'},
  'Pending':{'bg':'#fef3c7','color':'#92400e'},
};
const StatusBadge = ({s}) => {
  const c = STATUS_COLORS[s] || {bg:'#f3f4f6',color:'#374151'};
  return <span style={{background:c.bg,color:c.color,padding:'2px 8px',borderRadius:9999,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{s||'—'}</span>;
};

const KpiCard = ({icon,label,value,sub,accent='#3b82f6'}) => (
  <div style={{background:'#fff',borderRadius:10,padding:'1rem 1.25rem',boxShadow:'0 1px 4px rgba(0,0,0,0.08)',borderLeft:`4px solid ${accent}`,display:'flex',flexDirection:'column',gap:4}}>
    <div style={{fontSize:22}}>{icon}</div>
    <div style={{fontSize:'1.4rem',fontWeight:700,color:'#111827',lineHeight:1.2}}>{value}</div>
    <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>{label}</div>
    {sub && <div style={{fontSize:11,color:'#6b7280'}}>{sub}</div>}
  </div>
);

const Section = ({title,children,badge}) => (
  <div style={{background:'#fff',borderRadius:10,padding:'1.25rem',boxShadow:'0 1px 4px rgba(0,0,0,0.08)',marginTop:'1.25rem'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:'1rem'}}>
      <h3 style={{margin:0,fontSize:15,fontWeight:700,color:'#111827'}}>{title}</h3>
      {badge!=null && <span style={{background:'#eff6ff',color:'#1e40af',borderRadius:9999,padding:'1px 8px',fontSize:11,fontWeight:600}}>{badge}</span>}
    </div>
    {children}
  </div>
);

const SimpleTable = ({cols,rows,empty='No data'}) => (
  <div style={{overflowX:'auto'}}>
    {rows.length===0
      ? <div style={{textAlign:'center',padding:'2rem',color:'#9ca3af',fontSize:13}}>{empty}</div>
      : <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{borderBottom:'2px solid #f3f4f6'}}>
              {cols.map(c=><th key={c.key} style={{textAlign:c.right?'right':'left',padding:'6px 10px',color:'#6b7280',fontWeight:600,fontSize:11,textTransform:'uppercase',whiteSpace:'nowrap'}}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={i} style={{borderBottom:'1px solid #f9fafb'}}>
                {cols.map(c=>(
                  <td key={c.key} style={{padding:'8px 10px',textAlign:c.right?'right':'left',color:c.bold?'#111827':'#374151',fontWeight:c.bold?600:400,whiteSpace:c.nowrap?'nowrap':'normal'}}>
                    {c.render ? c.render(row) : (row[c.key]??'—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
    }
  </div>
);

const FollowupList = ({items}) => {
  if (!items?.length) return <div style={{textAlign:'center',padding:'1.5rem',color:'#9ca3af',fontSize:13}}>No pending follow-ups</div>;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {items.slice(0,8).map((f,i)=>{
        const pColor = f.priority==='High'?'#ef4444':f.priority==='Medium'?'#f59e0b':'#10b981';
        return (
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'#f8fafc',borderRadius:8,borderLeft:`3px solid ${pColor}`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:13,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.leadName||'—'}</div>
              <div style={{fontSize:11,color:'#6b7280'}}>{f.followupType} · {fmtDate(f.scheduledAt)}{f.assignedToName?` · ${f.assignedToName}`:''}</div>
            </div>
            <StatusBadge s={f.status} />
          </div>
        );
      })}
    </div>
  );
};

const BarChart = ({data}) => {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d=>d.value),1);
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:8,height:90,padding:'0 4px'}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
          <div style={{fontSize:10,color:'#6b7280',fontWeight:600}}>{d.value}</div>
          <div style={{width:'100%',borderRadius:'3px 3px 0 0',background:'linear-gradient(to top,#3b82f6,#60a5fa)',height:`${Math.max((d.value/max)*65,3)}px`,minHeight:3}}/>
          <div style={{fontSize:9,color:'#9ca3af',whiteSpace:'nowrap'}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};

const TeamTable = ({members}) => {
  if (!members?.length) return <div style={{textAlign:'center',padding:'1.5rem',color:'#9ca3af',fontSize:13}}>No team members assigned yet. Contact admin to set up your team.</div>;
  return (
    <SimpleTable
      cols={[
        {key:'name',label:'Member',bold:true},
        {key:'role',label:'Role',render:r=><span style={{fontSize:11,color:'#6b7280'}}>{r.role}</span>},
        {key:'leadsHandled',label:'Leads',right:true,render:r=>fmt(r.leadsHandled)},
        {key:'interested',label:'Interested',right:true,render:r=><span style={{color:'#059669',fontWeight:600}}>{fmt(r.interested)}</span>},
        {key:'leadsWon',label:'Won',right:true,render:r=><span style={{color:'#065f46',fontWeight:600}}>{fmt(r.leadsWon)}</span>},
        {key:'proposalsSent',label:'Proposals',right:true,render:r=>fmt(r.proposalsSent)},
        {key:'followupsDone',label:'FU Done',right:true,render:r=>fmt(r.followupsDone)},
        {key:'followupsPending',label:'FU Pending',right:true,render:r=><span style={{color:r.followupsPending>0?'#d97706':'#374151'}}>{fmt(r.followupsPending)}</span>},
        {key:'conversionRate',label:'Conv%',right:true,render:r=><span style={{color:r.conversionRate>20?'#059669':'#374151',fontWeight:600}}>{r.conversionRate}%</span>},
      ]}
      rows={members}
      empty="No team members"
    />
  );
};

function AdminDashboard({data:d,userName}) {
  return <>
    <div style={{marginBottom:'1.25rem'}}>
      <h2 style={{margin:0,fontSize:22,fontWeight:700,color:'#111827'}}>Welcome back, {userName} 👋</h2>
      <p style={{margin:'4px 0 0',color:'#6b7280',fontSize:14}}>Full company overview</p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:'0.75rem'}}>
      <KpiCard icon="📋" label="Total Leads"    value={fmt(d.totalLeads)}      sub={`+${fmt(d.leadsThisMonth)} this month`} accent="#3b82f6"/>
      <KpiCard icon="✅" label="Closed Won"     value={fmt(d.closedWon)}       accent="#059669"/>
      <KpiCard icon="🔄" label="Active"         value={fmt(d.activeLeads)}     accent="#8b5cf6"/>
      <KpiCard icon="📝" label="Proposals"      value={fmt(d.totalProposals)}  sub={`${fmt(d.proposalSent)} sent`} accent="#f59e0b"/>
      <KpiCard icon="📦" label="Orders"         value={fmt(d.totalOrders)}     sub={fmtCr(d.orderBookValue)} accent="#10b981"/>
      <KpiCard icon="📞" label="Follow-ups"     value={fmt(d.pendingFollowups)}sub={`${fmt(d.overdueFollowups)} overdue`} accent="#ef4444"/>
      <KpiCard icon="💬" label="Contacted"      value={fmt(d.contacted)}       accent="#6366f1"/>
      <KpiCard icon="🤝" label="In Discussion"  value={fmt(d.inDiscussion)}    accent="#ec4899"/>
    </div>
    {d.monthlyLeads?.length>0 && <Section title="Lead Trend — Last 6 Months"><BarChart data={d.monthlyLeads}/></Section>}
    <Section title="Team Performance" badge={d.teamPerformance?.length}><TeamTable members={d.teamPerformance}/></Section>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginTop:'1.25rem'}}>
      <Section title="Recent Orders" badge={d.recentOrders?.length}>
        <SimpleTable cols={[
          {key:'orderBookNo',label:'Order #',bold:true,nowrap:true},
          {key:'customerName',label:'Customer'},
          {key:'totalAmount',label:'Value',right:true,render:r=>fmtCr(r.totalAmount)},
          {key:'status',label:'Status',render:r=><StatusBadge s={r.status}/>},
        ]} rows={d.recentOrders||[]} empty="No recent orders"/>
      </Section>
      <Section title="Pending Follow-ups"><FollowupList items={d.followups}/></Section>
    </div>
  </>;
}

function ManagerDashboard({data:d,userName}) {
  return <>
    <div style={{marginBottom:'1.25rem'}}>
      <h2 style={{margin:0,fontSize:22,fontWeight:700,color:'#111827'}}>Hi, {userName} 👋</h2>
      <p style={{margin:'4px 0 0',color:'#6b7280',fontSize:14}}>Your team's performance overview</p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.75rem'}}>
      <KpiCard icon="📋" label="My Leads"       value={fmt(d.myLeads)}          accent="#3b82f6"/>
      <KpiCard icon="✅" label="Closed Won"      value={fmt(d.closedWon)}        sub={`${d.conversionRate}% conv.`} accent="#059669"/>
      <KpiCard icon="🔄" label="Active"          value={fmt(d.activeLeads)}      accent="#8b5cf6"/>
      <KpiCard icon="📝" label="Proposals"       value={fmt(d.myProposals)}      sub={`${fmt(d.acceptedProposals)} accepted`} accent="#f59e0b"/>
      <KpiCard icon="💰" label="Revenue"         value={fmtCr(d.revenue)}        accent="#10b981"/>
      <KpiCard icon="📞" label="Follow-ups"      value={fmt(d.pendingFollowups)} sub={`${fmt(d.overdueFollowups)} overdue · ${fmt(d.todayFollowups)} today`} accent="#ef4444"/>
      <KpiCard icon="💬" label="Contacted"       value={fmt(d.contacted)}        accent="#6366f1"/>
      <KpiCard icon="🤝" label="In Discussion"   value={fmt(d.inDiscussion)}     accent="#ec4899"/>
    </div>
    <Section title="🏆 Your Team's Performance" badge={d.teamMembers?.length}>
      <TeamTable members={d.teamMembers}/>
    </Section>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginTop:'1.25rem'}}>
      <Section title="Recent Leads" badge={d.leads?.length}>
        <SimpleTable cols={[
          {key:'name',label:'Client',bold:true},
          {key:'groupName',label:'Group',render:r=><span style={{fontSize:11}}>{r.groupName||'—'}</span>},
          {key:'status',label:'Status',render:r=><StatusBadge s={r.status}/>},
        ]} rows={d.leads||[]} empty="No leads yet"/>
      </Section>
      <Section title="Recent Proposals">
        <SimpleTable cols={[
          {key:'proposalNo',label:'#',bold:true,nowrap:true},
          {key:'leadName',label:'Lead'},
          {key:'totalValue',label:'Value',right:true,render:r=>fmtCr(r.totalValue)},
          {key:'status',label:'Status',render:r=><StatusBadge s={r.status}/>},
        ]} rows={d.proposals||[]} empty="No proposals yet"/>
      </Section>
    </div>
    <Section title="Pending Follow-ups"><FollowupList items={d.followups}/></Section>
  </>;
}

function BdDashboard({data:d,userName}) {
  return <>
    <div style={{marginBottom:'1.25rem'}}>
      <h2 style={{margin:0,fontSize:22,fontWeight:700,color:'#111827'}}>Hi, {userName} 👋</h2>
      <p style={{margin:'4px 0 0',color:'#6b7280',fontSize:14}}>Your leads and proposals</p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.75rem'}}>
      <KpiCard icon="📋" label="My Leads"        value={fmt(d.totalLeads)}        accent="#3b82f6"/>
      <KpiCard icon="✅" label="Closed Won"       value={fmt(d.closedWon)}         sub={`${d.conversionRate}% conv.`} accent="#059669"/>
      <KpiCard icon="🔄" label="Active"           value={fmt(d.activeLeads)}       accent="#8b5cf6"/>
      <KpiCard icon="🤝" label="In Discussion"    value={fmt(d.inDiscussion)}      accent="#6366f1"/>
      <KpiCard icon="📝" label="Proposals Sent"   value={fmt(d.proposalsSent)}     sub={`${fmt(d.acceptedProposals)} accepted`} accent="#f59e0b"/>
      <KpiCard icon="💰" label="Revenue"          value={fmtCr(d.revenue)}         accent="#10b981"/>
      <KpiCard icon="📞" label="Follow-ups"       value={fmt(d.pendingFollowups)}  sub={`${fmt(d.overdueFollowups)} overdue`} accent="#ef4444"/>
      <KpiCard icon="📅" label="Today's FUs"      value={fmt(d.todayFollowups)}    accent="#f59e0b"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginTop:'1.25rem'}}>
      <Section title="My Leads" badge={d.leads?.length}>
        <SimpleTable cols={[
          {key:'name',label:'Client',bold:true},
          {key:'groupName',label:'Group',render:r=><span style={{fontSize:11}}>{r.groupName||'—'}</span>},
          {key:'status',label:'Status',render:r=><StatusBadge s={r.status}/>},
          {key:'source',label:'Source',render:r=><span style={{fontSize:11,color:'#6b7280'}}>{r.source||'—'}</span>},
        ]} rows={d.leads||[]} empty="No leads assigned yet"/>
      </Section>
      <Section title="My Proposals">
        <SimpleTable cols={[
          {key:'proposalNo',label:'#',bold:true,nowrap:true},
          {key:'leadName',label:'Lead'},
          {key:'totalValue',label:'Value',right:true,render:r=>fmtCr(r.totalValue)},
          {key:'status',label:'Status',render:r=><StatusBadge s={r.status}/>},
        ]} rows={d.proposals||[]} empty="No proposals yet"/>
      </Section>
    </div>
    <Section title="Pending Follow-ups"><FollowupList items={d.followups}/></Section>
  </>;
}

function TcDashboard({data:d,userName}) {
  const tcColor = s => ({INTERESTED:{bg:'#d1fae5',color:'#065f46'},NOT_INTERESTED:{bg:'#fee2e2',color:'#991b1b'},NOT_RESPONDED:{bg:'#fef3c7',color:'#92400e'}}[s]||{bg:'#f3f4f6',color:'#374151'});
  const pct = d.total>0 ? Math.round((d.interested/d.total)*100) : 0;
  return <>
    <div style={{marginBottom:'1.25rem'}}>
      <h2 style={{margin:0,fontSize:22,fontWeight:700,color:'#111827'}}>Hi, {userName} 👋</h2>
      <p style={{margin:'4px 0 0',color:'#6b7280',fontSize:14}}>Your calling activity</p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'0.75rem'}}>
      <KpiCard icon="📋" label="Total Assigned"  value={fmt(d.total)}          accent="#3b82f6"/>
      <KpiCard icon="📞" label="Called"          value={fmt(d.called)}         accent="#6366f1"/>
      <KpiCard icon="✅" label="Interested"      value={fmt(d.interested)}     accent="#059669"/>
      <KpiCard icon="❌" label="Not Interested"  value={fmt(d.notInterested)}  accent="#ef4444"/>
      <KpiCard icon="⏳" label="Not Responded"   value={fmt(d.notResponded)}   accent="#f59e0b"/>
      <KpiCard icon="🆕" label="Pending"         value={fmt(d.pending)}        accent="#8b5cf6"/>
      <KpiCard icon="🤝" label="Handed to BD"    value={fmt(d.handedOff)}      accent="#10b981"/>
      <KpiCard icon="📅" label="Today's FUs"     value={fmt(d.todayFollowups)} sub={`${fmt(d.overdueFollowups)} overdue`} accent="#ec4899"/>
    </div>
    {d.total>0 && (
      <div style={{background:'#fff',borderRadius:10,padding:'1rem 1.25rem',boxShadow:'0 1px 4px rgba(0,0,0,0.08)',marginTop:'1.25rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:600,color:'#374151'}}>Interest Rate</span>
          <span style={{fontSize:13,fontWeight:700,color:'#059669'}}>{pct}%</span>
        </div>
        <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
          <div style={{height:'100%',borderRadius:4,background:'linear-gradient(to right,#059669,#34d399)',width:`${Math.min(pct,100)}%`}}/>
        </div>
      </div>
    )}
    <Section title="My Recent Leads" badge={d.leads?.length}>
      <SimpleTable cols={[
        {key:'name',label:'Client',bold:true},
        {key:'phone',label:'Phone',nowrap:true},
        {key:'groupName',label:'Group',render:r=><span style={{fontSize:11}}>{r.groupName||'—'}</span>},
        {key:'telecallerStatus',label:'Status',render:r=>{const c=tcColor(r.telecallerStatus);return <span style={{background:c.bg,color:c.color,padding:'2px 8px',borderRadius:9999,fontSize:11,fontWeight:600}}>{r.telecallerStatus||'NEW'}</span>;}},
        {key:'handedOffToBD',label:'BD',render:r=>r.handedOffToBD?<span style={{color:'#059669',fontSize:11}}>✅ {r.bdAssigneeName||'BD'}</span>:<span style={{color:'#9ca3af',fontSize:11}}>—</span>},
      ]} rows={d.leads||[]} empty="No leads assigned yet"/>
    </Section>
    <Section title="Pending Follow-ups"><FollowupList items={d.followups}/></Section>
  </>;
}

const Skeleton = () => (
  <div style={{padding:24}}>
    <div style={{height:32,background:'#f3f4f6',borderRadius:8,marginBottom:8,width:'40%'}}/>
    <div style={{height:16,background:'#f9fafb',borderRadius:6,marginBottom:24,width:'30%'}}/>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
      {[...Array(8)].map((_,i)=><div key={i} style={{height:90,background:'#f3f4f6',borderRadius:10}}/>)}
    </div>
    <div style={{height:200,background:'#f3f4f6',borderRadius:10,marginTop:16}}/>
    <div style={{height:200,background:'#f3f4f6',borderRadius:10,marginTop:16}}/>
  </div>
);

// ── GENERIC DASHBOARD — for any role without a dedicated view ─────────────────
// Shown for: PROCUREMENT_MANAGER, SALES_EXEC, TESTING_ROLE, any custom role
// L3 roles also see their team's performance table
function GenericDashboard({data:d, tasks, userName, role}) {
  const levelLabel = d.levelOrder <= 2 ? 'Company-wide' : d.levelOrder === 3 ? 'Team' : 'Personal';
  const hasLeads = d.myLeads > 0 || d.activeLeads > 0 || d.closedWon > 0;
  const isL3 = d.levelOrder === 3;

  const roleFmt = role => (role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Task status colors
  const taskStatusColor = s => {
    if (!s) return {bg:'#f3f4f6',color:'#374151'};
    const m = {Pending:{bg:'#fef3c7',color:'#92400e'},Completed:{bg:'#d1fae5',color:'#065f46'},
               Overdue:{bg:'#fee2e2',color:'#991b1b'},'In Progress':{bg:'#dbeafe',color:'#1e40af'}};
    return m[s]||{bg:'#f3f4f6',color:'#374151'};
  };

  return (
    <>
      {/* Header */}
      <div style={{marginBottom:'1.25rem'}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700,color:'#111827'}}>Hi, {userName} 👋</h2>
        <p style={{margin:'4px 0 0',color:'#6b7280',fontSize:14}}>
          <span style={{background:'#f3f4f6',color:'#374151',padding:'2px 10px',borderRadius:9999,fontSize:12,fontWeight:600,marginRight:8}}>
            {roleFmt(d.roleName)}
          </span>
          {levelLabel} view · Here's what needs your attention today
        </p>
      </div>

      {/* Follow-up KPIs — always shown */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:'0.75rem'}}>
        <KpiCard icon="📞" label="Pending Follow-ups"  value={fmt(d.pendingFollowups)}  sub={`${fmt(d.overdueFollowups)} overdue`} accent="#ef4444"/>
        <KpiCard icon="📅" label="Today's Follow-ups"  value={fmt(d.todayFollowups)}    accent="#f59e0b"/>
        <KpiCard icon="📋" label="My Tasks"            value={fmt(tasks.total)}          sub={`${fmt(tasks.pending)} pending`} accent="#3b82f6"/>
        <KpiCard icon="⚠️" label="Overdue Tasks"       value={fmt(tasks.overdue)}        accent="#dc2626"/>
        {hasLeads && <KpiCard icon="🎯" label="My Leads"      value={fmt(d.myLeads)}    sub={`${fmt(d.closedWon)} won`} accent="#059669"/>}
        {hasLeads && <KpiCard icon="🔄" label="Active Leads"  value={fmt(d.activeLeads)} accent="#8b5cf6"/>}
        {hasLeads && <KpiCard icon="📝" label="My Proposals"  value={fmt(d.myProposals)} accent="#6366f1"/>}
      </div>

      {/* L3: Team performance — key section */}
      {isL3 && (
        <Section title="🏆 Your Team's Performance" badge={d.teamMembers?.length}>
          {d.teamMembers?.length > 0
            ? <TeamTable members={d.teamMembers}/>
            : <div style={{textAlign:'center',padding:'1.5rem',color:'#9ca3af',fontSize:13}}>
                No team members found. Ask admin to assign team members to you.
              </div>
          }
        </Section>
      )}

      {/* Tasks table */}
      <Section title="My Pending Tasks" badge={tasks.items?.length}>
        {tasks.items?.length > 0
          ? <SimpleTable
              cols={[
                {key:'title',label:'Task',bold:true},
                {key:'category',label:'Category',render:r=><span style={{fontSize:11,color:'#6b7280'}}>{r.category||'—'}</span>},
                {key:'priority',label:'Priority',render:r=>{
                  const c=r.priority==='High'?'#ef4444':r.priority==='Medium'?'#f59e0b':'#10b981';
                  return <span style={{color:c,fontWeight:600,fontSize:12}}>{r.priority||'—'}</span>;
                }},
                {key:'dueDate',label:'Due',nowrap:true,render:r=>fmtDate(r.dueDate)},
                {key:'status',label:'Status',render:r=>{const c=taskStatusColor(r.status);return <span style={{background:c.bg,color:c.color,padding:'2px 8px',borderRadius:9999,fontSize:11,fontWeight:600}}>{r.status||'—'}</span>;}},
                {key:'assignedToName',label:'Assigned By',render:r=><span style={{fontSize:11,color:'#6b7280'}}>{r.createdByName||'—'}</span>},
              ]}
              rows={tasks.items}
              empty="No pending tasks"
            />
          : <div style={{textAlign:'center',padding:'2rem',color:'#9ca3af',fontSize:13}}>
              ✅ No pending tasks right now
            </div>
        }
      </Section>

      {/* Follow-ups list */}
      <div style={{display:'grid',gridTemplateColumns:hasLeads&&d.leads?.length>0?'1fr 1fr':'1fr',gap:'1.25rem',marginTop:'1.25rem'}}>
        <Section title="Pending Follow-ups">
          <FollowupList items={d.followups}/>
        </Section>
        {hasLeads && d.leads?.length > 0 && (
          <Section title="My Recent Leads" badge={d.leads?.length}>
            <SimpleTable
              cols={[
                {key:'name',label:'Client',bold:true},
                {key:'groupName',label:'Group',render:r=><span style={{fontSize:11}}>{r.groupName||'—'}</span>},
                {key:'status',label:'Status',render:r=><StatusBadge s={r.status}/>},
              ]}
              rows={d.leads||[]}
              empty="No leads"
            />
          </Section>
        )}
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  // Tasks fetched separately for the generic view
  const [tasks, setTasks] = useState({ total: 0, pending: 0, overdue: 0, items: [] });

  const role     = user?.role || '';
  const userId   = user?.id   || '';
  const userName = user?.name || user?.username || 'there';
  const endpoint = getDashboardEndpoint(role);

  // Fetch tasks for the generic dashboard view
  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/tasks?userId=${userId}&status=Pending&size=10&page=1`,
        { credentials:'include', headers:{ 'User-Id': String(userId), 'User-Role': role } }
      );
      if (!res.ok) return;
      const json = await res.json();
      const items = json.data || json.tasks || [];
      const total   = json.totalElements || json.total || items.length;
      const pending = items.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
      const overdue = items.filter(t => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < new Date() && t.status !== 'Completed';
      }).length;
      setTasks({ total, pending, overdue, items: items.slice(0, 8) });
    } catch { /* tasks are optional — silently ignore */ }
  }, [userId, role]);

  const fetchDashboard = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/${endpoint}`, {
        credentials: 'include',
        headers: { 'Content-Type':'application/json', 'User-Id': String(userId), 'User-Role': role }
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else throw new Error(json.message || 'Failed to load dashboard');
    } catch(e) {
      setError(e.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [endpoint, userId, role]);

  useEffect(() => {
    fetchDashboard();
    if (endpoint === 'generic') fetchTasks();
  }, [fetchDashboard, fetchTasks, endpoint]);

  if (loading) return <Skeleton/>;

  if (error) return (
    <div className="dashboard-home-container">
      <div style={{background:'#fff',borderRadius:10,padding:'2rem',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
        <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
        <h3 style={{color:'#374151',marginBottom:8}}>Could not load dashboard</h3>
        <p style={{color:'#6b7280',fontSize:14,marginBottom:16}}>{error}</p>
        <button onClick={fetchDashboard} style={{background:'#3b82f6',color:'#fff',border:'none',padding:'8px 20px',borderRadius:8,cursor:'pointer',fontSize:14}}>Retry</button>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="dashboard-home-container" style={{maxWidth:1400}}>
      {endpoint==='admin'         && <AdminDashboard   data={data} userName={userName}/>}
      {endpoint==='sales-manager' && <ManagerDashboard data={data} userName={userName}/>}
      {endpoint==='bd'            && <BdDashboard      data={data} userName={userName}/>}
      {endpoint==='telecaller'    && <TcDashboard      data={data} userName={userName}/>}
      {endpoint==='generic'       && <GenericDashboard data={data} tasks={tasks} userName={userName} role={role}/>}
    </div>
  );
}