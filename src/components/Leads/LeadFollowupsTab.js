import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/leadsapi.js";
import "./LeadFollowupsTab.css";
import FilterSelect from "../Dropdowns/FilterSelect.js";
import DateTimePicker from "../DateTimePicker.js";

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
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${pad(h)}:${pad(m)} ${ampm}`;
};
const relativeDay = dateStr => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.round((now - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  if (diff < 30) return `${Math.round(diff/7)}w ago`;
  return fmtDate(dateStr);
};
const isOverdue = f =>
  f.status === "Pending" && f.scheduledAt && new Date(f.scheduledAt) < new Date();

// Direct = Completed at create time. Backend sets completedAt = scheduledAt for these.
// We detect: completedAt and scheduledAt within 60 seconds of each other.
const isDirect = f => {
  if (f.status !== "Completed" || !f.outcome || !f.completedAt || !f.scheduledAt) return false;
  const diffMs = Math.abs(new Date(f.completedAt) - new Date(f.scheduledAt));
  return diffMs < 60 * 1000;
};

const TYPE_META = {
  Call:    { icon: "📞", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  Email:   { icon: "✉️",  color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  Meeting: { icon: "🤝", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  Visit:   { icon: "🏠", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  Demo:    { icon: "💻", color: "#DC2626", bg: "#FFF1F2", border: "#FECDD3" },
};
const STATUS_META = {
  Pending:     { bg: "#FEF9C3", color: "#92400E", dot: "#F59E0B" },
  Completed:   { bg: "#D1FAE5", color: "#065F46", dot: "#10B981" },
  Cancelled:   { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  Rescheduled: { bg: "#E0E7FF", color: "#3730A3", dot: "#6366F1" },
};
const PRIORITY_COLOR = { High: "#EF4444", Medium: "#F59E0B", Low: "#10B981" };

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function LeadFollowupsTab({ lead, currentUser, permissions, onRefreshLead, showSuccess, showError }) {
  const [followups,  setFollowups]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [filter,     setFilter]     = useState("All");
  const [showAdd,    setShowAdd]    = useState(false);
  const [showDirect, setShowDirect] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [users,      setUsers]      = useState([]);

  // Delegate to the app-standard notification toast (ToastContainer) instead of a local block.
  const toast$ = (msg, type = "success") => {
    if (type === "error") showError?.(msg); else showSuccess?.(msg);
  };

  const fetch$ = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/followups/lead/${lead.id}`);
      if (data.success) setFollowups(data.data || []);
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") toast$("Failed to load follow-ups", "error");
    } finally { setLoading(false); }
  }, [lead.id]);

  useEffect(() => {
    fetch$();
    api.get("/filters/followup-assignees")
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetch$]);

  const counts = {
    All:       followups.length,
    Upcoming:  followups.filter(f => f.status === "Pending" && !isOverdue(f)).length,
    Overdue:   followups.filter(isOverdue).length,
    Completed: followups.filter(f => f.status === "Completed").length,
    Direct:    followups.filter(isDirect).length,
    Cancelled: followups.filter(f => f.status === "Cancelled").length,
  };

  const filtered = followups.filter(f => {
    if (filter === "Upcoming")  return f.status === "Pending" && !isOverdue(f);
    if (filter === "Overdue")   return isOverdue(f);
    if (filter === "Completed") return f.status === "Completed";
    if (filter === "Direct")    return isDirect(f);
    if (filter === "Cancelled") return f.status === "Cancelled";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ao = isOverdue(a), bo = isOverdue(b);
    if (ao !== bo) return ao ? -1 : 1;
    return new Date(b.scheduledAt || b.createdAt) - new Date(a.scheduledAt || a.createdAt);
  });

  const afterCreate = msg => { fetch$(); onRefreshLead?.(); toast$(msg); };

  return (
    <div className="lfu">

      {/* Header */}
      <div className="lfu-head">
        <div className="lfu-head-left">
          <h4 className="lfu-heading">Follow-up Log</h4>
          <span className="lfu-count-pill">{followups.length}</span>
          {counts.Overdue > 0 && <span className="lfu-overdue-flag">⚠ {counts.Overdue} overdue</span>}
        </div>
        {permissions?.CREATE !== false && (
          <div className="lfu-head-actions">
            <button className="lfu-btn-direct" onClick={() => { setShowDirect(true); setShowAdd(false); }}>
              ⚡ Record Interaction
            </button>
            <button className="lfu-add-btn" onClick={() => { setShowAdd(true); setShowDirect(false); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
              </svg>
              Schedule Follow-up
            </button>
          </div>
        )}
      </div>

      {/* Forms — shown one at a time; hide the list while open */}
      {showDirect && (
        <DirectInteractionForm
          lead={lead} currentUser={currentUser} users={users}
          onCreated={() => { setShowDirect(false); afterCreate("Interaction recorded!"); }}
          onCancel={() => setShowDirect(false)}
        />
      )}

      {showAdd && (
        <AddForm
          lead={lead} currentUser={currentUser} users={users}
          onCreated={() => { setShowAdd(false); afterCreate("Follow-up scheduled!"); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Filters + scrollable log — hidden while a form is open */}
      {!showDirect && !showAdd && (
        <>
          <div className="lfu-filters">
            {["All","Upcoming","Overdue","Completed","Direct","Cancelled"].map(f => (
              <button key={f}
                className={`lfu-filter ${filter===f?"active":""} ${f==="Overdue"&&counts.Overdue>0?"urgent":""} ${f==="Direct"?"direct":""}`}
                onClick={() => setFilter(f)}>
                {f==="Direct" ? "⚡ " : ""}{f}
                {counts[f] > 0 && <span className="lfu-filter-num">{counts[f]}</span>}
              </button>
            ))}
          </div>

          {completing && (
            <CompleteModal
              followup={completing}
              onSaved={() => { setCompleting(null); fetch$(); toast$("Outcome saved!"); }}
              onCancel={() => setCompleting(null)}
            />
          )}

          {loading ? (
            <div className="lfu-loading"><span className="lfu-spinner"/><span>Loading…</span></div>
          ) : sorted.length === 0 ? (
            <EmptyState filter={filter}
              onSchedule={() => { setShowAdd(true); setShowDirect(false); }}
              onDirect={() => { setShowDirect(true); setShowAdd(false); }}
              canCreate={permissions?.CREATE !== false} />
          ) : (
            <div className="lfu-list-scroll">
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Direct Interaction Form ───────────────────────────────────────────────────
function DirectInteractionForm({ lead, currentUser, users, onCreated, onCancel }) {
  const [saving, setSaving] = useState(false);
  const toLocalDT = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const todayStr = toLocalDT(new Date());

  const [form, setForm] = useState({
    followupType: "Visit",
    visitedAt:    todayStr,
    assignedTo:   currentUser?.id || "",
    outcome:      "",
    notes:        "",
    nextAction:   "",
    mood:         "Positive",
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const moodEmoji = { Positive: "😊", Neutral: "😐", Negative: "😟", Excited: "🤩" };

  const submit = async e => {
    e.preventDefault();
    if (!form.outcome.trim()) { alert("Please describe what happened"); return; }
    if (!form.visitedAt) { alert("Please select the date & time"); return; }
    setSaving(true);
    try {
      // Merge outcome + optional next action + mood into one outcome text
      const outcomeText = [
        form.outcome.trim(),
        form.nextAction?.trim() ? `\n\n📌 Next Action: ${form.nextAction.trim()}` : "",
        `\n🎭 Client Mood: ${form.mood}`,
      ].join("");

      const dt = form.visitedAt.replace("T", " ") + ":00";

      await api.post("/followups/create", {
        relatedType:  "LEAD",
        relatedId:    lead.id,
        leadId:       lead.id,
        groupName:    lead.groupName    || null,
        subGroupName: lead.subGroupName || null,
        followupType: form.followupType,
        scheduledAt:  dt,          // actual visit/call time
        priority:     "High",
        notes:        form.notes.trim() || null,
        outcome:      outcomeText, // now stored correctly by fixed service
        status:       "Completed", // service sets completedAt = scheduledAt
        assignedTo:   form.assignedTo ? parseInt(form.assignedTo) : null,
      });
      onCreated();
    } catch (err) {
      if (err.message !== "SESSION_EXPIRED") alert(err.message || "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div className="lfu-direct-card">
      <div className="lfu-direct-header">
        <div>
          <span className="lfu-direct-badge">⚡ Record Direct Interaction</span>
          <p className="lfu-direct-subtitle">Log an unscheduled visit, call or meeting that already happened</p>
        </div>
        <button className="lfu-icon-close" onClick={onCancel}>✕</button>
      </div>

      <form onSubmit={submit} className="lfu-add-body">
        {/* Type */}
        <div className="lfu-form-group">
          <label>Type of Interaction</label>
          <div className="lfu-type-grid">
            {Object.entries(TYPE_META).map(([type, meta]) => (
              <button key={type} type="button"
                className={`lfu-type-opt ${form.followupType===type?"active":""}`}
                style={form.followupType===type ? { background: meta.bg, color: meta.color, borderColor: meta.color } : {}}
                onClick={() => setForm(p => ({ ...p, followupType: type }))}>
                <span className="lfu-type-icon">{meta.icon}</span>
                <span>{type}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lfu-form-row">
          <div className="lfu-form-group">
            <label>When did it happen? *</label>
            <DateTimePicker value={form.visitedAt} max={todayStr.slice(0, 10)}
              onChange={v => setForm(p => ({ ...p, visitedAt: v }))}
              placeholder="Select date & time" />
            <span className="lfu-form-hint">Today or a past date/time</span>
          </div>
          <div className="lfu-form-group">
            <label>Conducted by</label>
            <FilterSelect
              value={String(form.assignedTo)}
              onChange={v => set("assignedTo")({ target: { value: v } })}
              options={users.map(u => ({ value: String(u.id), label: u.name + (u.id === currentUser?.id ? " (Me)" : "") }))}
              placeholder="Select User"
            />
          </div>
        </div>

        {/* Mood */}
        <div className="lfu-form-group">
          <label>Client Sentiment</label>
          <div className="lfu-mood-row">
            {["Positive","Excited","Neutral","Negative"].map(m => (
              <button key={m} type="button"
                className={`lfu-mood-btn ${form.mood===m?"active":""}`}
                onClick={() => setForm(p => ({ ...p, mood: m }))}>
                {moodEmoji[m]} {m}
              </button>
            ))}
          </div>
        </div>

        {/* Outcome — stored in DB outcome column */}
        <div className="lfu-form-group">
          <label>
            {form.followupType==="Visit"   ? "🏠 What happened during the visit? *"
            : form.followupType==="Call"   ? "📞 Call Summary *"
            : form.followupType==="Meeting"? "🤝 Meeting Notes *"
            : "📊 Interaction Summary *"}
            <span className="lfu-form-hint"> — be specific: what was discussed, decided</span>
          </label>
          <textarea rows={5} required value={form.outcome} onChange={set("outcome")}
            placeholder={
              form.followupType==="Visit"
                ? "E.g. Dropped in to check progress. Roof is south-facing, ~180 sq ft. Interested in 5kW system. Discussed PM Surya Ghar subsidy…"
              : form.followupType==="Call"
                ? "E.g. Received unexpected call. Asking about subsidy details. Explained PM Surya Ghar scheme. Client wants proposal by this week…"
              : "E.g. Client dropped into our office. Reviewed samples. Interested in 10kW system. Discussed bulk discount…"
            } />
          <span className="lfu-char-count">{form.outcome.length} chars</span>
        </div>

        {/* Notes — stored in DB notes column */}
        <div className="lfu-form-group">
          <label>
            Context / Background
            <span className="lfu-form-hint"> — optional: what prompted this interaction?</span>
          </label>
          <textarea rows={2} value={form.notes} onChange={set("notes")}
            placeholder="E.g. They happened to be in the area. OR Client called unexpectedly about their pending quote…" />
        </div>

        {/* Next action — appended to outcome text */}
        <div className="lfu-form-group">
          <label>
            📌 Next Action
            <span className="lfu-form-hint"> — optional</span>
          </label>
          <input type="text" value={form.nextAction} onChange={set("nextAction")}
            placeholder="E.g. Send revised quote by Friday. Schedule site survey next week." />
        </div>

        <div className="lfu-add-footer">
          <button type="button" className="lfu-btn-sec" onClick={onCancel}>Cancel</button>
          <button type="submit" className="lfu-direct-submit" disabled={saving}>
            {saving ? "Saving…" : `⚡ Record ${form.followupType}`}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filter, onSchedule, onDirect, canCreate }) {
  const msg = {
    Overdue:   { icon: "✅", text: "No overdue follow-ups — you're on track!" },
    Completed: { icon: "📋", text: "No completed follow-ups yet." },
    Cancelled: { icon: "🚫", text: "No cancelled follow-ups." },
    Upcoming:  { icon: "📅", text: "No upcoming follow-ups scheduled." },
    Direct:    { icon: "⚡", text: "No direct / walk-in interactions recorded yet." },
    All:       { icon: "📞", text: "No follow-ups yet for this lead." },
  }[filter] || { icon: "📞", text: "No follow-ups yet." };

  return (
    <div className="lfu-empty">
      <div className="lfu-empty-icon">{msg.icon}</div>
      <p className="lfu-empty-text">{msg.text}</p>
      {filter === "All" && canCreate && (
        <div className="lfu-empty-actions">
          <button className="lfu-add-btn" onClick={onSchedule}>📅 Schedule Follow-up</button>
          <button className="lfu-btn-direct" onClick={onDirect}>⚡ Record Direct Interaction</button>
        </div>
      )}
    </div>
  );
}

// ── Follow-up card ────────────────────────────────────────────────────────────
function FollowupCard({ followup: f, index, onComplete, onCancelled, showToast, permissions }) {
  const [busy,     setBusy]     = useState(false);
  const [expanded, setExpanded] = useState(false);
  const tm      = TYPE_META[f.followupType] || TYPE_META.Call;
  const sm      = STATUS_META[f.status]     || STATUS_META.Pending;
  const overdue = isOverdue(f);
  const direct  = isDirect(f);
  const isPending = f.status === "Pending";

  const cancelFollowup = async () => {
    if (!window.confirm("Cancel this follow-up?")) return;
    setBusy(true);
    try {
      await api.put(`/followups/update/${f.id}`, { status: "Cancelled", outcome: "Cancelled by user" });
      onCancelled();
    } catch (e) { showToast(e.message || "Failed", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className={`lfu-card ${overdue?"lfu-card--overdue":""} ${f.status==="Completed"?"lfu-card--done":""} ${f.status==="Cancelled"?"lfu-card--cancelled":""} ${direct?"lfu-card--direct":""}`}
      style={{ animationDelay: `${index*0.04}s` }}>

      <div className="lfu-card-accent" style={{ background: overdue ? "#EF4444" : tm.color }}/>

      <div className="lfu-card-inner">
        <div className="lfu-card-row1">
          <span className="lfu-type-chip" style={{ background: tm.bg, color: tm.color, borderColor: tm.border }}>
            {tm.icon} {f.followupType}
          </span>
          {direct && <span className="lfu-direct-chip">⚡ Direct</span>}
          <span className="lfu-status-chip" style={{ background: sm.bg, color: sm.color }}>
            <span className="lfu-status-dot" style={{ background: sm.dot }}/>{f.status}
          </span>
          {overdue && <span className="lfu-overdue-chip">⚠ Overdue</span>}
          <span className="lfu-priority-badge" style={{ color: PRIORITY_COLOR[f.priority] }}>
            ● {f.priority}
          </span>
          <div className="lfu-card-datetime">
            <span className="lfu-date">{fmtDate(f.scheduledAt)}</span>
            <span className="lfu-time">{fmtTime(f.scheduledAt)}</span>
            <span className="lfu-rel-day">{relativeDay(f.scheduledAt || f.createdAt)}</span>
          </div>
        </div>

        <div className="lfu-card-row2">
          {f.assignedToName && (
            <div className="lfu-assignee">
              <span className="lfu-avatar">{f.assignedToName[0].toUpperCase()}</span>
              <span>{f.assignedToName}</span>
            </div>
          )}
          <span className="lfu-created-by">Added by {f.createdByName||"—"} · {fmtDate(f.createdAt)}</span>
          {f.completedAt && (
            <span className="lfu-completed-stamp">✓ Done {fmt(f.completedAt)}</span>
          )}
        </div>

        {f.notes && (
          <div className="lfu-notes">
            <div className="lfu-block-label">📋 {direct ? "Context / Background" : "Pre-call notes"}</div>
            <p className="lfu-block-text">{f.notes}</p>
          </div>
        )}

        {f.outcome && (
          <div className="lfu-outcome">
            <div className="lfu-block-label lfu-block-label--outcome">
              {direct
                ? (f.followupType==="Visit"   ? "🏠 Walk-in Visit Report"
                  : f.followupType==="Call"   ? "📞 Unscheduled Call Notes"
                  : f.followupType==="Meeting"? "🤝 Direct Meeting Notes"
                  : "⚡ Interaction Summary")
                : f.followupType==="Visit"    ? "🏠 Site Visit Report"
                : f.followupType==="Call"     ? "📞 Call Summary"
                : f.followupType==="Meeting"  ? "🤝 Meeting Notes"
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

        {isPending && !f.outcome && !overdue && (
          <div className="lfu-pending-hint">Outcome will be recorded when marked complete</div>
        )}
        {overdue && !f.outcome && (
          <div className="lfu-overdue-hint">This follow-up is past due — please record what happened</div>
        )}

        {isPending && (
          <div className="lfu-card-actions">
            <button className="lfu-btn-complete" onClick={onComplete}>✓ Record Outcome</button>
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
    scheduledAt:  defaultDT,
    priority:     "Medium",
    notes:        "",
    assignedTo:   currentUser?.id || "",
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (!form.scheduledAt) { alert("Please select the date & time"); return; }
    setSaving(true);
    try {
      const dt = form.scheduledAt.replace("T", " ") + ":00";
      await api.post("/followups/create", {
        relatedType:  "LEAD",
        relatedId:    lead.id,
        leadId:       lead.id,
        groupName:    lead.groupName    || null,
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
        <div className="lfu-form-group">
          <label>Type</label>
          <div className="lfu-type-grid">
            {Object.entries(TYPE_META).map(([type, meta]) => (
              <button key={type} type="button"
                className={`lfu-type-opt ${form.followupType===type?"active":""}`}
                style={form.followupType===type ? { background: meta.bg, color: meta.color, borderColor: meta.color } : {}}
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
            <DateTimePicker value={form.scheduledAt}
              onChange={v => setForm(p => ({ ...p, scheduledAt: v }))}
              placeholder="Select date & time" />
          </div>
          <div className="lfu-form-group">
            <label>Priority</label>
            <FilterSelect
              value={form.priority}
              onChange={v => set("priority")({ target: { value: v } })}
              options={["High","Medium","Low"].map(p => ({ value: p, label: p }))}
              placeholder="Select Priority"
            />
          </div>
        </div>

        <div className="lfu-form-group">
          <label>Assign To *</label>
          <FilterSelect
            value={String(form.assignedTo)}
            onChange={v => set("assignedTo")({ target: { value: v } })}
            options={users.map(u => ({ value: String(u.id), label: u.name + (u.id === currentUser?.id ? " (Me)" : "") }))}
            placeholder="Select User"
          />
        </div>

        <div className="lfu-form-group">
          <label>Notes <span className="lfu-form-hint">— what to cover / preparation needed</span></label>
          <textarea rows={3} value={form.notes} onChange={set("notes")}
            placeholder={
              form.followupType==="Visit"   ? "E.g. Check roof area, south-facing, confirm system size…"
            : form.followupType==="Call"    ? "E.g. Ask about budget, timeline, confirm interest…"
            : form.followupType==="Meeting" ? "E.g. Bring proposal draft, discuss payment terms…"
            : "Describe what you plan to cover…"} />
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

  const placeholder = f.followupType==="Visit"
    ? "E.g. Visited the site. Roof is south-facing, ~200 sq ft. Customer confirmed interest in 3kW. Discussed PM Surya Ghar subsidy. Proposed installation in 4 weeks."
    : f.followupType==="Call"
    ? "E.g. 20 min call. Customer interested in 5kW system. Concerns about installation time. Agreed to send quote. Next: follow up Monday."
    : f.followupType==="Meeting"
    ? "E.g. Met at customer office. Reviewed proposal. Budget finalised at ₹2.2L. Payment: 40% advance, 60% on completion. Signed LOI."
    : "Describe what happened during this follow-up…";

  return (
    <div className="lfu-modal-bg">
      <div className="lfu-modal">
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
          {f.notes && (
            <div className="lfu-modal-reminder">
              <span className="lfu-modal-reminder-label">📋 Original notes</span>
              <p>{f.notes}</p>
            </div>
          )}

          <div className="lfu-form-group">
            <label>
              {f.followupType==="Visit"   ? "🏠 Site Visit Report *"
               : f.followupType==="Call"  ? "📞 Call Summary *"
               : f.followupType==="Meeting"?"🤝 Meeting Notes *"
               : "📊 Outcome *"}
              <span className="lfu-form-hint"> — be specific: what was discussed, decided, next steps</span>
            </label>
            <textarea rows={6} required value={outcome} onChange={e => setOutcome(e.target.value)}
              placeholder={placeholder} />
            <span className="lfu-char-count">{outcome.length} chars</span>
          </div>

          <div className="lfu-form-group">
            <label>Mark this follow-up as</label>
            <div className="lfu-status-opts">
              {[
                { v:"Completed",   icon:"✓", label:"Completed",   sub:"All done"               },
                { v:"Rescheduled", icon:"↻", label:"Rescheduled", sub:"Need another follow-up" },
                { v:"Cancelled",   icon:"✕", label:"Cancelled",   sub:"Not proceeding"         },
              ].map(opt => {
                const sm = STATUS_META[opt.v];
                const active = newStatus === opt.v;
                return (
                  <label key={opt.v} className={`lfu-status-opt ${active?"active":""}`}
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