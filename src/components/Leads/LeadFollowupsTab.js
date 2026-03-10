import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/leadsapi.js";
import "./LeadFollowupsTab.css";

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, "0");
const fmt = s => {
  if (!s) return "—";
  const d = new Date(s);
  return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDate = s => {
  if (!s) return "—";
  const d = new Date(s);
  return `${pad(d.getDate())} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${d.getFullYear()}`;
};
const fmtTime = s => {
  if (!s) return "";
  const d = new Date(s);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const isOverdue = f =>
  f.status === "Pending" && f.scheduledAt && new Date(f.scheduledAt) < new Date();

const TYPE_META = {
  Call:    { icon: "📞", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", verb: "Call with" },
  Email:   { icon: "✉️",  color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", verb: "Email to"  },
  Meeting: { icon: "🤝", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", verb: "Meeting with" },
  Visit:   { icon: "🏠", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", verb: "Site visit at" },
  Demo:    { icon: "💻", color: "#DC2626", bg: "#FFF1F2", border: "#FECDD3", verb: "Demo for" },
};
const STATUS_META = {
  Pending:     { bg: "#FEF9C3", color: "#92400E", dot: "#F59E0B" },
  Completed:   { bg: "#D1FAE5", color: "#065F46", dot: "#10B981" },
  Cancelled:   { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  Rescheduled: { bg: "#E0E7FF", color: "#3730A3", dot: "#6366F1" },
};
const PRIORITY_COLOR = { High: "#EF4444", Medium: "#F59E0B", Low: "#10B981" };

// ═════════════════════════════════════════════════════════════════════════════
export default function LeadFollowupsTab({ lead, currentUser, permissions, onRefreshLead }) {
  const [followups,  setFollowups]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [filter,     setFilter]     = useState("All");
  const [showAdd,    setShowAdd]    = useState(false);
  const [completing, setCompleting] = useState(null);
  const [toast,      setToast]      = useState(null);
  const [users,      setUsers]      = useState([]);

  const toast$ = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetch$ = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/followups/lead/${lead.id}`);
      if (data.success) setFollowups(data.data || []);
    } catch (e) { if (e.message !== "SESSION_EXPIRED") toast$("Failed to load follow-ups", "error"); }
    finally { setLoading(false); }
  }, [lead.id]);

  useEffect(() => {
    fetch$();
    api.get("/api/filters/leads-users")
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetch$]);

  const counts = {
    All:       followups.length,
    Upcoming:  followups.filter(f => f.status === "Pending" && !isOverdue(f)).length,
    Overdue:   followups.filter(isOverdue).length,
    Completed: followups.filter(f => f.status === "Completed").length,
    Cancelled: followups.filter(f => f.status === "Cancelled").length,
  };

  const filtered = followups.filter(f => {
    if (filter === "Upcoming")  return f.status === "Pending" && !isOverdue(f);
    if (filter === "Overdue")   return isOverdue(f);
    if (filter === "Completed") return f.status === "Completed";
    if (filter === "Cancelled") return f.status === "Cancelled";
    return true;
  });

  // Sort: overdue first, then by scheduledAt desc
  const sorted = [...filtered].sort((a, b) => {
    const ao = isOverdue(a), bo = isOverdue(b);
    if (ao !== bo) return ao ? -1 : 1;
    return new Date(b.scheduledAt) - new Date(a.scheduledAt);
  });

  return (
    <div className="lfu">
      {toast && <div className={`lfu-toast lfu-toast--${toast.type}`}>{toast.msg}</div>}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="lfu-head">
        <div className="lfu-head-left">
          <h4 className="lfu-heading">Follow-up Log</h4>
          <span className="lfu-count-pill">{followups.length}</span>
          {counts.Overdue > 0 && (
            <span className="lfu-overdue-flag">⚠ {counts.Overdue} overdue</span>
          )}
        </div>
        {permissions?.CREATE !== false && (
          <button className="lfu-add-btn" onClick={() => setShowAdd(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
            </svg>
            Schedule Follow-up
          </button>
        )}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="lfu-filters">
        {["All","Upcoming","Overdue","Completed","Cancelled"].map(f => (
          <button key={f}
            className={`lfu-filter ${filter === f ? "active" : ""} ${f==="Overdue" && counts.Overdue > 0 ? "urgent" : ""}`}
            onClick={() => setFilter(f)}>
            {f}
            {counts[f] > 0 && <span className="lfu-filter-num">{counts[f]}</span>}
          </button>
        ))}
      </div>

      {/* ── Inline add form ──────────────────────────────────────────────────── */}
      {showAdd && (
        <AddForm
          lead={lead}
          currentUser={currentUser}
          users={users}
          onCreated={() => { setShowAdd(false); fetch$(); onRefreshLead?.(); toast$("Follow-up scheduled!"); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* ── Complete modal ───────────────────────────────────────────────────── */}
      {completing && (
        <CompleteModal
          followup={completing}
          onSaved={() => { setCompleting(null); fetch$(); toast$("Outcome saved!"); }}
          onCancel={() => setCompleting(null)}
        />
      )}

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="lfu-loading"><span className="lfu-spinner"/><span>Loading…</span></div>
      ) : sorted.length === 0 ? (
        <EmptyState filter={filter} onSchedule={() => setShowAdd(true)} canCreate={permissions?.CREATE !== false} />
      ) : (
        <div className="lfu-list">
          {sorted.map((f, i) => (
            <FollowupCard key={f.id} followup={f} index={i}
              onComplete={() => setCompleting(f)}
              onCancelled={() => { fetch$(); toast$("Cancelled"); }}
              onDeleted={() => { fetch$(); toast$("Deleted"); }}
              showToast={toast$}
              permissions={permissions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filter, onSchedule, canCreate }) {
  const msg = {
    Overdue:   { icon: "✅", text: "No overdue follow-ups — you're on track!" },
    Completed: { icon: "📋", text: "No completed follow-ups yet." },
    Cancelled: { icon: "🚫", text: "No cancelled follow-ups." },
    Upcoming:  { icon: "📅", text: "No upcoming follow-ups scheduled." },
    All:       { icon: "📞", text: "No follow-ups yet for this lead." },
  }[filter] || { icon: "📞", text: "No follow-ups yet." };

  return (
    <div className="lfu-empty">
      <div className="lfu-empty-icon">{msg.icon}</div>
      <p className="lfu-empty-text">{msg.text}</p>
      {filter === "All" && canCreate && (
        <button className="lfu-add-btn" onClick={onSchedule}>Schedule First Follow-up</button>
      )}
    </div>
  );
}

// ── Follow-up card ────────────────────────────────────────────────────────────
function FollowupCard({ followup: f, index, onComplete, onCancelled, showToast, permissions }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const tm = TYPE_META[f.followupType]  || TYPE_META.Call;
  const sm = STATUS_META[f.status]      || STATUS_META.Pending;
  const overdue = isOverdue(f);

  const cancelFollowup = async () => {
    if (!window.confirm("Cancel this follow-up?")) return;
    setBusy(true);
    try {
      await api.put(`/followups/update/${f.id}`, { status: "Cancelled", outcome: "Cancelled by user" });
      onCancelled();
    } catch (e) { showToast(e.message || "Failed", "error"); }
    finally { setBusy(false); }
  };

  const isPending = f.status === "Pending";

  return (
    <div className={`lfu-card ${overdue ? "lfu-card--overdue" : ""} ${f.status === "Completed" ? "lfu-card--done" : ""} ${f.status === "Cancelled" ? "lfu-card--cancelled" : ""}`}
      style={{ animationDelay: `${index * 0.04}s` }}>

      {/* Coloured left accent */}
      <div className="lfu-card-accent" style={{ background: overdue ? "#EF4444" : tm.color }}/>

      <div className="lfu-card-inner">
        {/* ── Row 1: type + status + date ────────────────────────────── */}
        <div className="lfu-card-row1">
          <span className="lfu-type-chip" style={{ background: tm.bg, color: tm.color, borderColor: tm.border }}>
            <span>{tm.icon}</span><span>{f.followupType}</span>
          </span>
          <span className="lfu-status-chip" style={{ background: sm.bg, color: sm.color }}>
            <span className="lfu-status-dot" style={{ background: sm.dot }}/>
            {f.status}
          </span>
          {overdue && <span className="lfu-overdue-chip">⚠ Overdue</span>}
          <span className="lfu-priority-badge" style={{ color: PRIORITY_COLOR[f.priority] }}>
            ● {f.priority}
          </span>
          <div className="lfu-card-datetime">
            <span className="lfu-date">{fmtDate(f.scheduledAt)}</span>
            <span className="lfu-time">{fmtTime(f.scheduledAt)}</span>
          </div>
        </div>

        {/* ── Row 2: assignee + created ───────────────────────────────── */}
        <div className="lfu-card-row2">
          {f.assignedToName && (
            <div className="lfu-assignee">
              <span className="lfu-avatar">{f.assignedToName[0].toUpperCase()}</span>
              <span>{f.assignedToName}</span>
            </div>
          )}
          <span className="lfu-created-by">Added by {f.createdByName || "—"} · {fmtDate(f.createdAt)}</span>
          {f.completedAt && (
            <span className="lfu-completed-stamp">✓ Completed {fmt(f.completedAt)}</span>
          )}
        </div>

        {/* ── Notes block (pre-call context) ──────────────────────────── */}
        {f.notes && (
          <div className="lfu-notes">
            <div className="lfu-block-label">📋 Pre-call notes</div>
            <p className="lfu-block-text">{f.notes}</p>
          </div>
        )}

        {/* ── Outcome block (post-call result) — this is the KEY part ─── */}
        {f.outcome && (
          <div className="lfu-outcome">
            <div className="lfu-block-label lfu-block-label--outcome">
              {f.followupType === "Visit" ? "🏠 Site Visit Report"
               : f.followupType === "Call" ? "📞 Call Summary"
               : f.followupType === "Meeting" ? "🤝 Meeting Notes"
               : "📊 Outcome"}
            </div>
            <p className="lfu-block-text lfu-block-text--outcome">
              {expanded || f.outcome.length < 200
                ? f.outcome
                : <>{f.outcome.slice(0, 200)}…</>}
            </p>
            {f.outcome.length > 200 && (
              <button className="lfu-expand-btn" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less ▲" : "Read more ▼"}
              </button>
            )}
          </div>
        )}

        {/* ── No outcome yet — prompt ──────────────────────────────────── */}
        {isPending && !f.outcome && !overdue && (
          <div className="lfu-pending-hint">Outcome will be recorded when marked complete</div>
        )}
        {overdue && !f.outcome && (
          <div className="lfu-overdue-hint">This follow-up is past due — please record what happened</div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        {isPending && (
          <div className="lfu-card-actions">
            <button className="lfu-btn-complete" onClick={onComplete}>
              ✓ Record Outcome
            </button>
            <button className="lfu-btn-cancel" onClick={cancelFollowup} disabled={busy}>
              {busy ? "…" : "✕ Cancel"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Schedule new follow-up form ───────────────────────────────────────────────
function AddForm({ lead, currentUser, users, onCreated, onCancel }) {
  const [saving, setSaving] = useState(false);
  const nowPlus30 = new Date(Date.now() + 30 * 60000);
  const defaultDT = new Date(nowPlus30.getTime() - nowPlus30.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    followupType: "Call",
    scheduledAt: defaultDT,
    priority: "Medium",
    notes: "",
    assignedTo: currentUser?.id || "",
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const dt = form.scheduledAt.replace("T", " ") + ":00";
      await api.post("/followups/create", {
        relatedType:  "LEAD",
        relatedId:    lead.id,
        leadId:       lead.id,
        groupName:    lead.groupName   || null,
        subGroupName: lead.subGroupName || null,
        followupType: form.followupType,
        scheduledAt:  dt,
        priority:     form.priority,
        notes:        form.notes.trim() || null,
        status:       "Pending",
        assignedTo:   form.assignedTo ? parseInt(form.assignedTo) : null,
      });
      onCreated();
    } catch (e) { if (e.message !== "SESSION_EXPIRED") alert(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="lfu-add-card">
      <div className="lfu-add-card-header">
        <h5>Schedule New Follow-up</h5>
        <button className="lfu-icon-close" onClick={onCancel}>✕</button>
      </div>
      <form onSubmit={submit} className="lfu-add-body">

        {/* Type selector */}
        <div className="lfu-form-group">
          <label>Type</label>
          <div className="lfu-type-grid">
            {Object.entries(TYPE_META).map(([type, meta]) => (
              <button key={type} type="button"
                className={`lfu-type-opt ${form.followupType === type ? "active" : ""}`}
                style={form.followupType === type
                  ? { background: meta.bg, color: meta.color, borderColor: meta.color }
                  : {}}
                onClick={() => setForm(p => ({ ...p, followupType: type }))}>
                <span className="lfu-type-icon">{meta.icon}</span>
                <span>{type}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lfu-form-row">
          <div className="lfu-form-group">
            <label>Date & Time *</label>
            <input type="datetime-local" required value={form.scheduledAt} onChange={set("scheduledAt")} />
          </div>
          <div className="lfu-form-group">
            <label>Priority</label>
            <select value={form.priority} onChange={set("priority")}>
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
        </div>

        <div className="lfu-form-group">
          <label>Assign To *</label>
          <select value={form.assignedTo} onChange={set("assignedTo")} required>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}{u.id === currentUser?.id ? " (Me)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="lfu-form-group">
          <label>
            Notes
            <span className="lfu-form-hint"> — what to cover / preparation needed</span>
          </label>
          <textarea rows={3} value={form.notes} onChange={set("notes")}
            placeholder={
              form.followupType === "Visit"   ? "E.g. Check roof area, south-facing, confirm system size, discuss subsidy eligibility…"
            : form.followupType === "Call"    ? "E.g. Ask about budget, timeline, confirm interest in 3kW vs 5kW system…"
            : form.followupType === "Meeting" ? "E.g. Bring proposal draft, discuss payment terms, answer technical queries…"
            : "Describe what you plan to cover in this follow-up…"} />
        </div>

        <div className="lfu-add-footer">
          <button type="button" className="lfu-btn-sec" onClick={onCancel}>Cancel</button>
          <button type="submit" className="lfu-add-btn" disabled={saving}>
            {saving ? "Scheduling…" : "📅 Schedule Follow-up"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Complete / record outcome modal ───────────────────────────────────────────
function CompleteModal({ followup: f, onSaved, onCancel }) {
  const [saving,    setSaving]    = useState(false);
  const [outcome,   setOutcome]   = useState("");
  const [newStatus, setNewStatus] = useState("Completed");
  const tm = TYPE_META[f.followupType] || TYPE_META.Call;

  const submit = async e => {
    e.preventDefault();
    if (!outcome.trim()) { alert("Please describe what happened"); return; }
    setSaving(true);
    try {
      await api.put(`/followups/update/${f.id}`, { status: newStatus, outcome: outcome.trim() });
      onSaved();
    } catch (e) { if (e.message !== "SESSION_EXPIRED") alert(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const placeholder = f.followupType === "Visit"
    ? "E.g. Visited the site. Roof is south-facing, approximately 200 sq ft usable area. Customer confirmed interest in 3kW system. Discussed PM Surya Ghar subsidy — they qualify. Proposed installation in 4 weeks. Customer requested formal proposal by Friday."
    : f.followupType === "Call"
    ? "E.g. 20 min call. Customer interested in 5kW rooftop system. Has concerns about installation time. Clarified it takes 2–3 days. Agreed to send quote. Next: follow up Monday after they consult family."
    : f.followupType === "Meeting"
    ? "E.g. Met at customer office. Reviewed proposal together. They want to reduce system size to 4kW. Budget finalised at ₹2.2L. Payment terms agreed: 40% advance, 60% on completion. Signed LOI."
    : "Describe what happened during this follow-up in detail…";

  return (
    <div className="lfu-modal-bg" onClick={onCancel}>
      <div className="lfu-modal" onClick={e => e.stopPropagation()}>
        <div className="lfu-modal-top">
          <div>
            <div className="lfu-type-chip" style={{ background: tm.bg, color: tm.color, borderColor: tm.border, display:"inline-flex", gap:6, padding:"4px 12px", borderRadius:20, fontSize:12 }}>
              {tm.icon} {f.followupType}
            </div>
            <h4 className="lfu-modal-title">Record Outcome</h4>
            <p className="lfu-modal-sub">Scheduled: {fmt(f.scheduledAt)}</p>
          </div>
          <button className="lfu-icon-close" onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={submit} className="lfu-modal-body">
          {/* Show pre-call notes as reminder */}
          {f.notes && (
            <div className="lfu-modal-reminder">
              <span className="lfu-modal-reminder-label">📋 Original notes</span>
              <p>{f.notes}</p>
            </div>
          )}

          <div className="lfu-form-group">
            <label>
              {f.followupType === "Visit"   ? "🏠 Site Visit Report *"
               : f.followupType === "Call"  ? "📞 Call Summary *"
               : f.followupType === "Meeting" ? "🤝 Meeting Notes *"
               : "📊 Outcome *"}
              <span className="lfu-form-hint"> — be specific: what was discussed, decided, next steps</span>
            </label>
            <textarea rows={6} required value={outcome} onChange={e => setOutcome(e.target.value)}
              placeholder={placeholder} />
            <span className="lfu-char-count">{outcome.length} chars</span>
          </div>

          {/* Status radio */}
          <div className="lfu-form-group">
            <label>Mark this follow-up as</label>
            <div className="lfu-status-opts">
              {[
                { v:"Completed",   icon:"✓", label:"Completed",   sub:"All done"                   },
                { v:"Rescheduled", icon:"↻", label:"Rescheduled", sub:"Need another follow-up"     },
                { v:"Cancelled",   icon:"✕", label:"Cancelled",   sub:"Not proceeding"             },
              ].map(opt => {
                const sm = STATUS_META[opt.v];
                const active = newStatus === opt.v;
                return (
                  <label key={opt.v} className={`lfu-status-opt ${active ? "active" : ""}`}
                    style={active ? { borderColor: sm.color, background: sm.bg } : {}}>
                    <input type="radio" name="ns" value={opt.v}
                      checked={active} onChange={() => setNewStatus(opt.v)} />
                    <span className="lfu-status-opt-icon" style={{ color: sm.color }}>{opt.icon}</span>
                    <div>
                      <strong style={{ color: sm.color }}>{opt.label}</strong>
                      <p>{opt.sub}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="lfu-modal-footer">
            <button type="button" className="lfu-btn-sec" onClick={onCancel}>Cancel</button>
            <button type="submit" className="lfu-add-btn" disabled={saving}>
              {saving ? "Saving…" : "Save Outcome"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}