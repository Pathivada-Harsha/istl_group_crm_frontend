import React, { useState, useEffect, useCallback } from "react";
import api from "./../services/leadsapi.js";
import "../pages-css/TelecallerLeadsPage.css";


const STATUS_CONFIG = {
  NEW:            { label: "New",            color: "#6366f1", bg: "#eef2ff" },
  PENDING:        { label: "New",            color: "#6366f1", bg: "#eef2ff" },
  INTERESTED:     { label: "Interested ✓",   color: "#059669", bg: "#ecfdf5" },
  NOT_INTERESTED: { label: "Not Interested", color: "#dc2626", bg: "#fef2f2" },
  NOT_RESPONDED:  { label: "Not Responded",  color: "#d97706", bg: "#fffbeb" },
};

const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };

const SOLAR_SCHEMES = [
  "PM_Surya_Ghar", "PM_Kusum", "State_Subsidy",
  "Net_Metering_Only", "No_Scheme", "Others"
];

export default function TelecallerLeadsPage() {
  const [leads,      setLeads]      = useState([]);
  const [stats,      setStats]      = useState(null);
  const [filter,     setFilter]     = useState("NEW");   // default: show NEW only
  const [page,       setPage]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState("");

  const [selected,    setSelected]    = useState(null);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [reason,      setReason]      = useState("");
  const [discussion,  setDiscussion]  = useState("");
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async (p = 0, statusFilter = filter) => {
    setLoading(true);
    try {
      const params = { page: p, size: 20, telecallerStatus: statusFilter };
      const data = await api.get("/telecaller/my-leads", { params });
      if (data.success) {
        setLeads(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.count);
        setPage(p);
      }
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showToast("Failed to load leads", "error");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get("/telecaller/dashboard-stats");
      if (data.success) setStats(data.data);
    } catch {}
  }, []);

  useEffect(() => { fetchLeads(0, "NEW"); fetchStats(); }, []);

  const applyFilter = (f) => { setFilter(f); fetchLeads(0, f); };

  const visible = leads.filter(l =>
    !search || [l.name, l.email, l.phone, l.leadCode]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  // ── Status modal ─────────────────────────────────────────────────────────
  const openStatusModal = (lead) => {
    if (lead.handedOffToBD) {
      showToast("This lead has been handed off to BD — status cannot be changed.", "info");
      return;
    }
    setSelected(lead);
    setNewStatus("");
    setReason("");
    setDiscussion("");
    setStatusModal(true);
  };

  const submitStatus = async () => {
    if (!newStatus) return;
    if (newStatus === "NOT_INTERESTED" && !reason.trim()) {
      showToast("Reason is required for Not Interested", "error");
      return;
    }
    if (newStatus === "INTERESTED" && !discussion.trim()) {
      showToast("Discussion note is required when marking Interested", "error");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/telecaller/lead/${selected.id}/status`, {
        telecallerStatus: newStatus,
        reason:           reason.trim(),
        discussionNote:   discussion.trim(),
      });
      showToast("Status updated!", "success");
      setStatusModal(false);
      fetchLeads(page);
      fetchStats();
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showToast(e.message || "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Detail modal ──────────────────────────────────────────────────────────
  const openDetail = async (lead) => {
    try {
      const data = await api.get(`/telecaller/lead/${lead.id}`);
      if (data.success) { setSelected(data.data); setModalOpen(true); }
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showToast("Could not load lead details", "error");
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="tc-page">
      {toast && <div className={`tc-toast tc-toast--${toast.type}`}>{toast.msg}</div>}

      <div className="tc-header">
        <div>
          <h1 className="tc-title">My Leads</h1>
          <p className="tc-subtitle">{total} lead{total !== 1 ? "s" : ""} in this view</p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="tc-stats-bar">
          <StatCard label="New"           value={stats.pending}       color="#6366f1" active={filter==="NEW"}           onClick={() => applyFilter("NEW")} />
          <StatCard label="Interested"    value={stats.interested}    color="#059669" active={filter==="INTERESTED"}    onClick={() => applyFilter("INTERESTED")} />
          <StatCard label="Not Interested"value={stats.notInterested} color="#dc2626" active={filter==="NOT_INTERESTED"}onClick={() => applyFilter("NOT_INTERESTED")} />
          <StatCard label="Not Responded" value={stats.notResponded}  color="#d97706" active={filter==="NOT_RESPONDED"} onClick={() => applyFilter("NOT_RESPONDED")} />
          <StatCard label="All"           value={stats.total}         color="#64748b" active={filter==="ALL"}           onClick={() => applyFilter("ALL")} />
          {stats.resurfacedToday > 0 && (
            <StatCard label="⚡ Re-surfaced" value={stats.resurfacedToday} color="#7c3aed" onClick={() => applyFilter("NOT_RESPONDED")} urgent />
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="tc-toolbar">
        <input className="tc-search"
          placeholder="Search name, email, phone, code…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="tc-filter-tabs">
          {[
            { key: "NEW",            label: "New"            },
            { key: "INTERESTED",     label: "Interested"     },
            { key: "NOT_INTERESTED", label: "Not Interested" },
            { key: "NOT_RESPONDED",  label: "Not Responded"  },
            { key: "ALL",            label: "All"            },
          ].map(f => (
            <button key={f.key}
              className={`tc-filter-tab ${filter === f.key ? "active" : ""}`}
              style={filter === f.key ? {
                background:  STATUS_CONFIG[f.key]?.bg   || "#f1f5f9",
                color:       STATUS_CONFIG[f.key]?.color || "#374151",
                borderColor: STATUS_CONFIG[f.key]?.color || "#374151",
              } : {}}
              onClick={() => applyFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lead cards */}
      {loading ? (
        <div className="tc-loading"><div className="tc-spinner" />Loading…</div>
      ) : visible.length === 0 ? (
        <div className="tc-empty">
          <div className="tc-empty-icon">📋</div>
          <p>No {filter !== "ALL" ? filter.toLowerCase().replace("_", " ") + " " : ""}leads found.</p>
        </div>
      ) : (
        <div className="tc-cards">
          {visible.map(lead => (
            <LeadCard key={lead.id} lead={lead}
              onDetail={() => openDetail(lead)}
              onUpdateStatus={() => openStatusModal(lead)} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="tc-pagination">
          <button disabled={page === 0}             onClick={() => fetchLeads(page - 1)}>← Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => fetchLeads(page + 1)}>Next →</button>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {modalOpen && selected && (
        <div className="tc-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="tc-modal" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <div>
                <h2>{selected.name}</h2>
                <span className="tc-lead-code">{selected.leadCode}</span>
              </div>
              <button className="tc-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            {selected.handedOffToBD && (
              <div className="tc-handed-off-banner">
                🤝 Handed off to BD Team
                {selected.bdAssignedToName && <span> → <strong>{selected.bdAssignedToName}</strong></span>}
                {selected.bdAssignedAt && <span className="tc-handoff-date"> on {selected.bdAssignedAt}</span>}
              </div>
            )}

            <div className="tc-modal-body">
              {/* Contact */}
              <div className="tc-section-title">Contact</div>
              <DetailRow label="Email"    value={selected.email} />
              <DetailRow label="Phone"    value={selected.phone} />
              <DetailRow label="Source"   value={selected.source} />
              <DetailRow label="Priority" value={selected.priority}
                style={{ color: PRIORITY_COLOR[selected.priority] || "#374151", fontWeight: 600 }} />

              {/* Address */}
              {(selected.state || selected.district || selected.city) && (
                <>
                  <div className="tc-section-title">Address</div>
                  <DetailRow label="State"    value={selected.state} />
                  <DetailRow label="District" value={selected.district} />
                  <DetailRow label="City"     value={selected.city} />
                  <DetailRow label="Pincode"  value={selected.pincode} />
                </>
              )}

              {/* Solar */}
              {selected.solarScheme && (
                <>
                  <div className="tc-section-title">Solar Details</div>
                  <DetailRow label="Scheme" value={selected.solarScheme?.replace(/_/g, " ")} />
                </>
              )}

              {/* Lead info */}
              <div className="tc-section-title">Lead Info</div>
              <DetailRow label="Group"    value={selected.groupName} />
              <DetailRow label="Category" value={selected.subGroupName} />
              <DetailRow label="Status"   value={<StatusBadge status={selected.telecallerStatus} />} />
              {selected.telecallerReason && (
                <DetailRow label="Reason" value={selected.telecallerReason} />
              )}
              <DetailRow label="Assigned On"  value={selected.createdAt} />
              <DetailRow label="Last Updated" value={selected.telecallerStatusUpdatedAt || "—"} />

              <div className="tc-detail-enquiry">
                <span className="tc-detail-label">Enquiry</span>
                <p>{selected.enquiry}</p>
              </div>

              {/* Discussion note */}
              {selected.tcDiscussionNote && (
                <div className="tc-detail-enquiry tc-discussion-note">
                  <span className="tc-detail-label">Discussion Note</span>
                  <p>{selected.tcDiscussionNote}</p>
                </div>
              )}

              {/* Team panel */}
              <div className="tc-section-title">Team</div>
              <div className="tc-team-panel">
                <TeamMember role="Telecaller" name={selected.telecallerName || "You"} icon="📞" />
                {selected.bdAssignedToName && (
                  <TeamMember role="BD Executive" name={selected.bdAssignedToName} icon="💼"
                    since={selected.bdAssignedAt} />
                )}
              </div>
            </div>

            <div className="tc-modal-footer">
              {!selected.handedOffToBD && (
                <button className="tc-btn-primary"
                  onClick={() => { setModalOpen(false); openStatusModal(selected); }}>
                  Update Status
                </button>
              )}
              <button className="tc-btn-secondary" onClick={() => setModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Update Modal ── */}
      {statusModal && selected && (
        <div className="tc-modal-overlay" onClick={() => setStatusModal(false)}>
          <div className="tc-modal tc-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h2>Update Status</h2>
              <button className="tc-modal-close" onClick={() => setStatusModal(false)}>✕</button>
            </div>
            <div className="tc-modal-body">
              <p className="tc-lead-name-hint">{selected.name} · {selected.leadCode}</p>

              <div className="tc-status-options">
                {[
                  { value: "INTERESTED",     emoji: "✅", label: "Interested",
                    desc: "Client is interested. Lead goes to BD Team via round-robin." },
                  { value: "NOT_INTERESTED", emoji: "❌", label: "Not Interested",
                    desc: "Client is not interested. A reason is required." },
                  { value: "NOT_RESPONDED",  emoji: "⏳", label: "Not Responded",
                    desc: "No response. Lead resurfaces in 7 days." },
                ].map(opt => (
                  <label key={opt.value}
                    className={`tc-status-option ${newStatus === opt.value ? "selected" : ""}`}
                    style={newStatus === opt.value ? {
                      borderColor: STATUS_CONFIG[opt.value].color,
                      background:  STATUS_CONFIG[opt.value].bg,
                    } : {}}>
                    <input type="radio" name="status" value={opt.value}
                      checked={newStatus === opt.value}
                      onChange={() => setNewStatus(opt.value)} />
                    <span className="tc-status-emoji">{opt.emoji}</span>
                    <div><strong>{opt.label}</strong><p>{opt.desc}</p></div>
                  </label>
                ))}
              </div>

              {/* Reason — NOT_INTERESTED */}
              {newStatus === "NOT_INTERESTED" && (
                <div className="tc-reason-field">
                  <label>Reason <span className="tc-req">*</span></label>
                  <textarea rows={3}
                    placeholder="Why is the client not interested?"
                    value={reason} onChange={e => setReason(e.target.value)} />
                </div>
              )}

              {/* Discussion note — INTERESTED */}
              {newStatus === "INTERESTED" && (
                <div className="tc-reason-field">
                  <label>Discussion Summary <span className="tc-req">*</span></label>
                  <textarea rows={4}
                    placeholder="Summarise your conversation with the customer — what they discussed, their requirements, budget, timeline, etc. This will be handed to the BD team."
                    value={discussion} onChange={e => setDiscussion(e.target.value)} />
                  <div className="tc-handoff-note">
                    ℹ️ After saving, this lead will be automatically assigned to a BD Executive via round-robin.
                    You will retain read-only access to track progress.
                  </div>
                </div>
              )}
            </div>
            <div className="tc-modal-footer">
              <button className="tc-btn-primary"
                disabled={!newStatus || saving} onClick={submitStatus}>
                {saving ? "Saving…" : "Confirm Status"}
              </button>
              <button className="tc-btn-secondary" onClick={() => setStatusModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LeadCard({ lead, onDetail, onUpdateStatus }) {
  const sc = STATUS_CONFIG[lead.telecallerStatus] || STATUS_CONFIG.NEW;
  return (
    <div className={`tc-card ${lead.handedOffToBD ? "tc-card--handed-off" : ""} ${lead.telecallerStatus == null || lead.telecallerStatus === "NEW" ? "tc-card--new" : ""}`}>
      <div className="tc-card-top">
        <div className="tc-card-name-row">
          <span className="tc-card-name">{lead.name}</span>
          <span className="tc-priority-dot"
            style={{ background: PRIORITY_COLOR[lead.priority] || "#9ca3af" }}
            title={`${lead.priority} priority`} />
        </div>
        <span className="tc-card-code">{lead.leadCode}</span>
      </div>
      <div className="tc-card-contact">
        <span>📧 {lead.email}</span>
        <span>📞 {lead.phone}</span>
      </div>
      {(lead.state || lead.city) && (
        <div className="tc-card-address">
          📍 {[lead.city, lead.district, lead.state].filter(Boolean).join(", ")}
          {lead.pincode && ` – ${lead.pincode}`}
        </div>
      )}
      {lead.groupName && (
        <div className="tc-card-group">
          🏷 {lead.groupName}{lead.subGroupName ? ` › ${lead.subGroupName}` : ""}
          {lead.solarScheme && <span className="tc-scheme-badge">{lead.solarScheme.replace(/_/g, " ")}</span>}
        </div>
      )}
      <p className="tc-card-enquiry">
        {lead.enquiry?.slice(0, 100)}{lead.enquiry?.length > 100 ? "…" : ""}
      </p>
      <div className="tc-card-footer">
        <StatusBadge status={lead.telecallerStatus} />
        {lead.handedOffToBD
          ? <span className="tc-handed-off-label">
              🤝 BD: {lead.bdAssignedToName || "Assigned"}
            </span>
          : <button className="tc-btn-status"
              onClick={e => { e.stopPropagation(); onUpdateStatus(); }}>
              Update Status
            </button>
        }
      </div>
      <div className="tc-card-viewlink" onClick={onDetail}>View Details →</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = status || "NEW";
  const c = STATUS_CONFIG[s] || STATUS_CONFIG.NEW;
  return <span className="tc-status-badge" style={{ color: c.color, background: c.bg }}>{c.label}</span>;
}

function StatCard({ label, value, color, onClick, urgent, active }) {
  return (
    <div className={`tc-stat-card ${urgent ? "tc-stat-card--urgent" : ""} ${active ? "tc-stat-card--active" : ""}`}
      onClick={onClick}
      style={{ borderTopColor: color, cursor: "pointer", ...(active ? { boxShadow: `0 0 0 2px ${color}` } : {}) }}>
      <span className="tc-stat-value" style={{ color }}>{value}</span>
      <span className="tc-stat-label">{label}</span>
    </div>
  );
}

function DetailRow({ label, value, style }) {
  return (
    <div className="tc-detail-row">
      <span className="tc-detail-label">{label}</span>
      <span className="tc-detail-value" style={style}>{value || "—"}</span>
    </div>
  );
}

function TeamMember({ role, name, icon, since }) {
  return (
    <div className="tc-team-member">
      <span className="tc-team-icon">{icon}</span>
      <div>
        <div className="tc-team-role">{role}</div>
        <div className="tc-team-name">{name}</div>
        {since && <div className="tc-team-since">Since {since}</div>}
      </div>
    </div>
  );
}