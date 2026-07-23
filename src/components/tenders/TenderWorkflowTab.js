// ─────────────────────────────────────────────────────────────────────────────
//  Workflow tab.
//
//  • A top, always-visible Go/No-Go bar — a manual Tender-Manager decision. Its
//    "Record Decision" modal PRE-FILLS a suggestion from the live Eligibility
//    roll-up but requires explicit confirmation (nothing auto-saves).
//  • Four self-contained, independently-gated blocks driven by WORKFLOW_STAGES:
//    Document Collection → CFO Pricing Approval → MD Submission Approval →
//    Ready for Submission. Each block is unlocked only when every earlier block
//    is complete (stageUnlocked); drop a config entry to shorten the chain.
//  • A sticky audit sidebar logs every workflow action.
//
//  Ownership: this tab owns tender.docRequests, the approval fields and
//  tender.approvalLog. It writes the SINGLE submissionReference field (shared
//  with the Submission tab) — it never touches tender.documents (the Documents
//  tab's checklist).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  WORKFLOW_STAGES, stageComplete, stageUnlocked, blankDocRequest, DEPARTMENTS,
  SUBMISSION_MODES, computeEligibility, currentUserLabel, genKey, fmtINR,
  boqBidTotal, boqCostTotal, boqEffectiveProfitPct,
} from '../../services/tenderData';

const REQ_STATUSES = ['requested', 'received', 'verified'];
const REQ_LABEL = { requested: 'Requested', received: 'Received', verified: 'Verified' };
const today = () => new Date().toISOString().slice(0, 10);
const fmtWhen = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function TenderWorkflowTab({ tender, setTender, commit }) {
  const [gngOpen, setGngOpen] = useState(false);
  const [gngChoice, setGngChoice] = useState('');
  const [gngReason, setGngReason] = useState('');

  const log = tender.approvalLog || [];
  const eligDecision = computeEligibility(tender.eligibilityCriteria);

  // silent staged edit (no log)
  const updField = (k, v) => setTender((prev) => ({ ...prev, [k]: v }));
  const updReq = (key, changes) => setTender((prev) => ({
    ...prev, docRequests: prev.docRequests.map((d) => (d._key === key ? { ...d, ...changes } : d)),
  }));

  // logged, immediately-committed action
  const act = (changes, entry) => {
    const logEntry = {
      _key: genKey(), stage: entry.stage, action: entry.action,
      by: currentUserLabel(), remarks: entry.remarks || '', at: new Date().toISOString(),
    };
    commit({ ...tender, ...changes, approvalLog: [logEntry, ...(tender.approvalLog || [])] });
  };

  // ── Go/No-Go ──────────────────────────────────────────────────────────
  const suggestion = eligDecision === 'GO'
    ? { choice: 'GO', reason: 'Eligibility check passed — all criteria satisfied.' }
    : eligDecision === 'NO_GO'
      ? { choice: 'NO_GO', reason: 'Eligibility check failed — one or more criteria not met.' }
      : { choice: '', reason: 'Eligibility still pending — review criteria before deciding.' };

  const openGng = () => {
    setGngChoice(tender.goNoGo || suggestion.choice);
    setGngReason(tender.goNoGoReason || suggestion.reason);
    setGngOpen(true);
  };
  const confirmGng = () => {
    act(
      { goNoGo: gngChoice, goNoGoReason: gngReason.trim(), goNoGoDate: today() },
      { stage: 'Go/No-Go', action: `Decision recorded: ${gngChoice === 'GO' ? 'GO' : 'NO-GO'}`, remarks: gngReason.trim() },
    );
    setGngOpen(false);
  };

  const gngClass = tender.goNoGo === 'GO' ? 'decided-go' : tender.goNoGo === 'NO_GO' ? 'decided-nogo' : 'decided-none';
  const gngValueClass = tender.goNoGo === 'GO' ? 'go' : tender.goNoGo === 'NO_GO' ? 'nogo' : 'none';
  const gngText = tender.goNoGo === 'GO' ? 'GO' : tender.goNoGo === 'NO_GO' ? 'NO-GO' : 'Not decided';

  // ── doc-request actions ───────────────────────────────────────────────
  const addReq = () => act(
    { docRequests: [...(tender.docRequests || []), blankDocRequest()] },
    { stage: 'Document Collection', action: 'Document request added' },
  );
  const removeReq = (r) => act(
    { docRequests: tender.docRequests.filter((d) => d._key !== r._key) },
    { stage: 'Document Collection', action: 'Document request removed', remarks: r.label },
  );
  const setReqStatus = (r, status) => act(
    { docRequests: tender.docRequests.map((d) => (d._key === r._key ? { ...d, status } : d)) },
    { stage: 'Document Collection', action: `"${r.label || 'Document'}" → ${REQ_LABEL[status]}` },
  );

  // ── approvals ─────────────────────────────────────────────────────────
  const decideCfo = (status) => act(
    { cfoApprovalStatus: status, cfoApprovalDate: today() },
    { stage: 'CFO Pricing Approval', action: status === 'approved' ? 'Pricing approved' : 'Pricing rejected', remarks: tender.cfoApprovalRemarks },
  );
  const decideMd = (status) => act(
    { mdApprovalStatus: status, mdApprovalDate: today() },
    { stage: 'MD Submission Approval', action: status === 'approved' ? 'Submission approved' : 'Submission rejected', remarks: tender.mdApprovalRemarks },
  );
  const recordSubmission = () => act(
    {
      status: 'Submitted',
      submissionDate: tender.submissionDate || today(),
      submittedBy: tender.submittedBy || currentUserLabel(),
    },
    { stage: 'Ready for Submission', action: `Submitted · ref ${tender.submissionReference}`, remarks: tender.submissionMode },
  );

  // ── badges ────────────────────────────────────────────────────────────
  const apprBadge = (status) => {
    const map = { approved: ['tnd-badge-pass', 'Approved'], rejected: ['tnd-badge-fail', 'Rejected'], pending: ['tnd-badge-pending', 'Pending'] };
    const [cls, label] = map[status] || map.pending;
    return <span className={`tnd-badge ${cls}`}>{label}</span>;
  };

  const stageStatusEl = (key) => {
    if (stageComplete(tender, key)) return <span className="tnd-badge tnd-badge-pass">Complete</span>;
    if (!stageUnlocked(tender, key)) return <span className="tnd-badge tnd-badge-na">Locked</span>;
    if (key === 'cfo') return apprBadge(tender.cfoApprovalStatus);
    if (key === 'md') return apprBadge(tender.mdApprovalStatus);
    if (key === 'documents') {
      const reqs = tender.docRequests || [];
      return <span className="tnd-badge tnd-badge-pending">{reqs.filter((d) => d.status === 'verified').length}/{reqs.length} verified</span>;
    }
    return <span className="tnd-badge tnd-badge-pending">Awaiting</span>;
  };

  // ── per-stage bodies ──────────────────────────────────────────────────
  const renderBody = (key) => {
    switch (key) {
      case 'documents': {
        const reqs = tender.docRequests || [];
        return (
          <>
            <div className="tnd-row-actions" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
              <button className="tnd-btn tnd-btn-primary tnd-btn-sm" onClick={addReq}>＋ Request document</button>
            </div>
            {reqs.length === 0 ? (
              <div className="tnd-empty">No document requests yet. Request a document from a department to begin.</div>
            ) : (
              <div className="tnd-table-wrap">
                <table className="tnd-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>Document</th>
                      <th style={{ width: 140 }}>Department</th>
                      <th style={{ width: 140 }}>Due</th>
                      <th style={{ width: 150 }}>Status</th>
                      <th style={{ minWidth: 140 }}>Notes</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {reqs.map((r) => (
                      <tr key={r._key}>
                        <td><input className="tnd-inp" value={r.label} placeholder="Document" onChange={(e) => updReq(r._key, { label: e.target.value })} /></td>
                        <td>
                          <select className="tnd-inp" value={r.department} onChange={(e) => updReq(r._key, { department: e.target.value })}>
                            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td><input className="tnd-inp" type="date" value={r.dueDate} onChange={(e) => updReq(r._key, { dueDate: e.target.value })} /></td>
                        <td>
                          <select className="tnd-inp" value={r.status} onChange={(e) => setReqStatus(r, e.target.value)}>
                            {REQ_STATUSES.map((s) => <option key={s} value={s}>{REQ_LABEL[s]}</option>)}
                          </select>
                        </td>
                        <td><input className="tnd-inp" value={r.notes} placeholder="Notes" onChange={(e) => updReq(r._key, { notes: e.target.value })} /></td>
                        <td><button className="tnd-icon-x" title="Remove" onClick={() => removeReq(r)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }
      case 'cfo':
        return (
          <>
            <div className="tnd-wf-metric-row">
              <div className="tnd-wf-metric"><div className="tnd-wf-metric-label">Bid Value</div><div className="tnd-wf-metric-val">{fmtINR(boqBidTotal(tender))}</div></div>
              <div className="tnd-wf-metric"><div className="tnd-wf-metric-label">Raw Cost</div><div className="tnd-wf-metric-val">{fmtINR(boqCostTotal(tender))}</div></div>
              <div className="tnd-wf-metric"><div className="tnd-wf-metric-label">Margin</div><div className="tnd-wf-metric-val">{boqEffectiveProfitPct(tender).toFixed(1)}%</div></div>
            </div>
            <div className="tnd-field" style={{ marginBottom: 12 }}>
              <label>CFO remarks</label>
              <textarea rows={2} value={tender.cfoApprovalRemarks} onChange={(e) => updField('cfoApprovalRemarks', e.target.value)} placeholder="Pricing review notes…" />
            </div>
            <div className="tnd-row-actions">
              <button className="tnd-btn tnd-btn-success tnd-btn-sm" onClick={() => decideCfo('approved')}>Approve pricing</button>
              <button className="tnd-btn tnd-btn-danger tnd-btn-sm" onClick={() => decideCfo('rejected')}>Reject</button>
              {tender.cfoApprovalDate && <span className="tnd-hint" style={{ margin: 0 }}>Last action {tender.cfoApprovalDate}</span>}
            </div>
          </>
        );
      case 'md':
        return (
          <>
            <div className="tnd-field" style={{ marginBottom: 12 }}>
              <label>MD remarks</label>
              <textarea rows={2} value={tender.mdApprovalRemarks} onChange={(e) => updField('mdApprovalRemarks', e.target.value)} placeholder="Sign-off notes…" />
            </div>
            <div className="tnd-row-actions">
              <button className="tnd-btn tnd-btn-success tnd-btn-sm" onClick={() => decideMd('approved')}>Approve submission</button>
              <button className="tnd-btn tnd-btn-danger tnd-btn-sm" onClick={() => decideMd('rejected')}>Reject</button>
              {tender.mdApprovalDate && <span className="tnd-hint" style={{ margin: 0 }}>Last action {tender.mdApprovalDate}</span>}
            </div>
          </>
        );
      case 'ready': {
        const ready = !!tender.submissionReference && !!tender.submissionDate;
        return (
          <>
            <p className="tnd-wf-stage-desc">
              Record the portal acknowledgement. <strong>Submission Reference</strong> is the single shared field — it is the
              same value shown on the Submission tab.
            </p>
            <div className="leads-enquiries-form-grid" style={{ marginBottom: 12 }}>
              <div className="tnd-field"><label>Submission Reference *</label><input value={tender.submissionReference} onChange={(e) => updField('submissionReference', e.target.value)} placeholder="Portal ack. no." /></div>
              <div className="tnd-field"><label>Submission Mode</label>
                <select value={tender.submissionMode} onChange={(e) => updField('submissionMode', e.target.value)}>
                  <option value="">—</option>
                  {SUBMISSION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="tnd-field"><label>Submission Date *</label><input type="date" value={tender.submissionDate} onChange={(e) => updField('submissionDate', e.target.value)} /></div>
              <div className="tnd-field"><label>Submitted By</label><input value={tender.submittedBy} onChange={(e) => updField('submittedBy', e.target.value)} placeholder={currentUserLabel()} /></div>
            </div>
            <button className="tnd-btn tnd-btn-primary tnd-btn-sm" disabled={!ready} onClick={recordSubmission}>🚀 Record submission</button>
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Go/No-Go bar */}
      <div className={`tnd-gonogo-bar ${gngClass}`}>
        <div className="tnd-gonogo-main">
          <div className="tnd-gonogo-label">Go / No-Go Decision</div>
          <div className={`tnd-gonogo-value ${gngValueClass}`}>{gngText}</div>
          {tender.goNoGoReason && <div className="tnd-gonogo-reason">{tender.goNoGoReason}{tender.goNoGoDate ? ` · ${tender.goNoGoDate}` : ''}</div>}
        </div>
        <div className="tnd-hint" style={{ margin: 0 }}>Eligibility suggests: <strong>{eligDecision === 'NO_GO' ? 'NO-GO' : eligDecision}</strong></div>
        <button className="tnd-btn tnd-btn-secondary tnd-btn-sm" onClick={openGng}>Record Decision</button>
      </div>

      {/* Stages + audit sidebar */}
      <div className="tnd-wf-layout">
        <div>
          {WORKFLOW_STAGES.map((stage, i) => {
            const unlocked = stageUnlocked(tender, stage.key);
            const done = stageComplete(tender, stage.key);
            return (
              <div key={stage.key} className={`tnd-wf-stage${done ? ' done' : ''}${!unlocked ? ' locked' : ''}`}>
                <div className="tnd-wf-stage-head">
                  <span className="tnd-wf-stage-num">{done ? '✓' : i + 1}</span>
                  <span className="tnd-wf-stage-title">{stage.icon} {stage.title}</span>
                  <span className="tnd-wf-stage-status">{stageStatusEl(stage.key)}</span>
                </div>
                <div className="tnd-wf-stage-body">
                  <p className="tnd-wf-stage-desc">{stage.desc}</p>
                  {unlocked ? renderBody(stage.key) : (
                    <div className="tnd-wf-locked-note">🔒 Complete the previous stage to unlock this one.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Audit sidebar */}
        <div className="tnd-audit">
          <div className="tnd-audit-head">Audit Trail</div>
          {log.length === 0 ? (
            <div className="tnd-audit-empty">No workflow actions recorded yet.</div>
          ) : (
            <div className="tnd-audit-list">
              {log.map((e) => (
                <div key={e._key} className="tnd-audit-item">
                  <div className="tnd-audit-stage">{e.stage}</div>
                  <div className="tnd-audit-action">{e.action}</div>
                  {e.remarks && <div className="tnd-audit-action" style={{ fontStyle: 'italic' }}>“{e.remarks}”</div>}
                  <div className="tnd-audit-meta">{e.by} · {fmtWhen(e.at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Go/No-Go modal */}
      {gngOpen && (
        <div className="tnd-modal-overlay" onClick={() => setGngOpen(false)}>
          <div className="tnd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tnd-modal-head">
              <span className="tnd-modal-title">Record Go / No-Go Decision</span>
              <button className="tnd-icon-x" onClick={() => setGngOpen(false)}>×</button>
            </div>
            <div className="tnd-modal-body">
              <div className="tnd-hint" style={{ margin: 0 }}>
                Suggested from Eligibility: <strong>{eligDecision === 'NO_GO' ? 'NO-GO' : eligDecision}</strong>. You must confirm explicitly.
              </div>
              <div className="tnd-choice-row">
                <button className={`tnd-choice${gngChoice === 'GO' ? ' sel-go' : ''}`} onClick={() => setGngChoice('GO')}>GO</button>
                <button className={`tnd-choice${gngChoice === 'NO_GO' ? ' sel-nogo' : ''}`} onClick={() => setGngChoice('NO_GO')}>NO-GO</button>
              </div>
              <div className="tnd-field">
                <label>Reason</label>
                <textarea rows={3} value={gngReason} onChange={(e) => setGngReason(e.target.value)} placeholder="Rationale for the decision…" />
              </div>
            </div>
            <div className="tnd-modal-foot">
              <button className="tnd-btn tnd-btn-secondary" onClick={() => setGngOpen(false)}>Cancel</button>
              <button className="tnd-btn tnd-btn-primary" disabled={!gngChoice} onClick={confirmGng}>Confirm decision</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
