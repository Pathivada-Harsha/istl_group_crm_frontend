import React, { useState, useEffect, useCallback, useRef } from "react";
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

const SOURCES = [
  "Website", "Referral", "Walk-in", "Phone", "Email",
  "Social Media", "Digital Marketing", "Campaign", "Others",
];

const PRIORITIES = ["High", "Medium", "Low"];

export default function TelecallerLeadsPage() {
  const [leads,      setLeads]      = useState([]);
  const [stats,      setStats]      = useState(null);
  const [filter,     setFilter]     = useState("NEW");
  const [page,       setPage]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [pageSize,   setPageSize]   = useState(10);
  // Refs so fetchLeads always reads current values — no stale closure bugs
  const pageSizeRef = useRef(10);
  const filterRef   = useRef("NEW");
  const pageRef     = useRef(0);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState("");

  const [selected,    setSelected]    = useState(null);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [reason,      setReason]      = useState("");
  const [discussion,  setDiscussion]  = useState("");
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState(null);

  // Follow-up modal state
  const [followupModal,   setFollowupModal]   = useState(false);
  const [followupDate,    setFollowupDate]    = useState('');
  const [followupTime,    setFollowupTime]    = useState('09:00');
  const [followupNote,    setFollowupNote]    = useState('');
  const [followupSaving,  setFollowupSaving]  = useState(false);
  const [pendingFULead,   setPendingFULead]   = useState(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", source: "",
    priority: "", enquiry: "", state: "", district: "", city: "", pincode: "",
    subsidyRequired: "", referralName: "", referralPhone: "",
    capacity: "", capacityUnit: "kW",
  });
  const [editSaving, setEditSaving] = useState(false);

  // INTERESTED extra fields
  const [intLocation,     setIntLocation]     = useState("");
  const [intSiteDate,     setIntSiteDate]     = useState("");
  const [intPropertyType, setIntPropertyType] = useState("");
  const [intQuotedPrice,  setIntQuotedPrice]  = useState("");
  const [intAddons,       setIntAddons]       = useState("");
  const [intOtherComment, setIntOtherComment] = useState("");
  const [intCapacity,     setIntCapacity]     = useState("");
  const [intCapacityUnit, setIntCapacityUnit] = useState("kW");

  // ── Fetch — always reads from refs so no stale closure ever ────────────
  const fetchLeads = useCallback(async (p, statusFilter, size) => {
    // Resolve arguments — fall back to current refs if not provided
    const resolvedPage   = p            !== undefined ? p            : pageRef.current;
    const resolvedFilter = statusFilter !== undefined ? statusFilter : filterRef.current;
    const resolvedSize   = size         !== undefined ? size         : pageSizeRef.current;

    setLoading(true);
    try {
      const params = { page: resolvedPage, size: resolvedSize, telecallerStatus: resolvedFilter };
      const data = await api.get("/telecaller/my-leads", { params });
      if (data.success) {
        setLeads(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.count);
        setPage(resolvedPage);
        pageRef.current = resolvedPage;
      }
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showToast("Failed to load leads", "error");
    } finally {
      setLoading(false);
    }
  }, []); // no deps — reads from refs

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get("/telecaller/dashboard-stats");
      if (data.success) setStats(data.data);
    } catch {}
  }, []);

  useEffect(() => { fetchLeads(0, "NEW", 10); fetchStats(); }, []);

  const applyFilter = (f) => {
    setFilter(f);
    filterRef.current = f;
    setPage(0);
    pageRef.current = 0;
    fetchLeads(0, f, pageSizeRef.current);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    pageSizeRef.current = newSize;
    setPage(0);
    pageRef.current = 0;
    fetchLeads(0, filterRef.current, newSize);
  };

  const visible = leads.filter(l =>
    !search || [l.name, l.email, l.phone, l.leadCode]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  // ── Status modal ─────────────────────────────────────────────────────────
  const openStatusModal = (lead) => {
    if (lead.leadStatus === "Closed Won" || lead.leadStatus === "Closed Lost") {
      showToast(`This lead is ${lead.leadStatus} — status cannot be changed.`, "info");
      return;
    }
    if (lead.handedOffToBD) {
      showToast("This lead has been handed off to BD — status cannot be changed.", "info");
      return;
    }
    setSelected(lead);
    setNewStatus("");
    setReason("");
    setDiscussion("");
    setIntLocation(lead.city ? `${lead.city}${lead.district ? ", " + lead.district : ""}${lead.state ? ", " + lead.state : ""}` : "");
    setIntSiteDate("");
    setIntPropertyType("");
    setIntQuotedPrice("");
    setIntAddons("");
    setIntOtherComment("");
    setIntCapacity(lead.capacity     || "");
    setIntCapacityUnit(lead.capacityUnit || "kW");
    setStatusModal(true);
  };

  const submitStatus = async () => {
    if (!newStatus) return;
    if (newStatus === "NOT_INTERESTED" && !reason.trim()) {
      showToast("Reason is required for Not Interested", "error");
      return;
    }
    if (newStatus === "INTERESTED" && !discussion.trim()) {
      showToast("Discussion summary is required when marking Interested", "error");
      return;
    }
    if (newStatus === "INTERESTED" && !intPropertyType) {
      showToast("Please select Commercial or Residential", "error");
      return;
    }
    setSaving(true);
    try {
      // For NOT_INTERESTED / NOT_RESPONDED: show follow-up modal FIRST,
      // then call the API with needsFollowUp after user decides.
      if (newStatus === "NOT_INTERESTED" || newStatus === "NOT_RESPONDED") {
        setSaving(false);
        setStatusModal(false);
        setPendingFULead({ ...selected, _pendingStatus: newStatus, _pendingReason: reason.trim() });
        setFollowupDate('');
        setFollowupTime('09:00');
        setFollowupModal(true);
        return;
      }

      await api.put(`/telecaller/lead/${selected.id}/status`, {
        telecallerStatus: newStatus,
        reason:           reason.trim(),
        discussionNote:   discussion.trim(),
        ...(newStatus === "INTERESTED" && {
          tcLocation:      intLocation.trim() || null,
          tcSiteVisitDate: intSiteDate || null,
          tcPropertyType:  intPropertyType || null,
          tcQuotedPrice:   intQuotedPrice.trim() || null,
          tcAddons:        intAddons.trim() || null,
          tcOtherComments: intOtherComment.trim() || null,
          capacity:        intCapacity.trim() || null,
          capacityUnit:    intCapacityUnit || "kW",
        }),
      });
      showToast("Status updated!", "success");
      setStatusModal(false);

      // Refresh selected so the detail modal shows the updated status immediately
      if (modalOpen) {
        try {
          const fresh = await api.get(`/telecaller/lead/${selected.id}`);
          if (fresh.success) setSelected(fresh.data);
        } catch (_) {}
      }
      fetchLeads(pageRef.current, filterRef.current, pageSizeRef.current);
      fetchStats();
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showToast(e.message || "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit modal ────────────────────────────────────────────────────────────
  const openEditModal = (lead) => {
    if (lead.leadStatus === "Closed Won" || lead.leadStatus === "Closed Lost") {
      showToast(`This lead is ${lead.leadStatus} — it cannot be edited.`, "info");
      return;
    }
    if (lead.handedOffToBD) {
      showToast("This lead has been handed off to BD and cannot be edited here.", "info");
      return;
    }
    setSelected(lead);
    setEditForm({
      name:            lead.name            || "",
      email:           lead.email           || "",
      phone:           lead.phone           || "",
      source:          lead.source          || "",
      priority:        lead.priority        || "Medium",
      enquiry:         lead.enquiry         || "",
      state:           lead.state           || "",
      district:        lead.district        || "",
      city:            lead.city            || "",
      pincode:         lead.pincode         || "",
      subsidyRequired: lead.subsidyRequired || "",
      referralName:    lead.referralName    || "",
      referralPhone:   lead.referralPhone   || "",
      capacity:        lead.capacity        || "",
      capacityUnit:    lead.capacityUnit    || "kW",
    });
    setEditModal(true);
  };

  const submitEdit = async () => {
    if (!editForm.phone.trim()) {
      showToast("Phone number is required", "error");
      return;
    }
    setEditSaving(true);
    try {
      const resp = await api.put(`/telecaller/lead/${selected.id}/details`, editForm);
      if (resp.success) {
        showToast("Lead updated successfully!", "success");
        setEditModal(false);
        // Update the selected lead if detail modal is also open
        if (modalOpen) setSelected(resp.data);
        fetchLeads(pageRef.current, filterRef.current, pageSizeRef.current);
      }
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showToast(e.message || "Update failed", "error");
    } finally {
      setEditSaving(false);
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
          <StatCard label="New"            value={stats.pending}       color="#6366f1" active={filter==="NEW"}            onClick={() => applyFilter("NEW")} />
          <StatCard label="Interested"     value={stats.interested}    color="#059669" active={filter==="INTERESTED"}     onClick={() => applyFilter("INTERESTED")} />
          <StatCard label="Not Interested" value={stats.notInterested} color="#dc2626" active={filter==="NOT_INTERESTED"} onClick={() => applyFilter("NOT_INTERESTED")} />
          <StatCard label="Not Responded"  value={stats.notResponded}  color="#d97706" active={filter==="NOT_RESPONDED"}  onClick={() => applyFilter("NOT_RESPONDED")} />
          <StatCard label="All"            value={stats.total}         color="#64748b" active={filter==="ALL"}            onClick={() => applyFilter("ALL")} />
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
              onUpdateStatus={() => openStatusModal(lead)}
              onEdit={() => openEditModal(lead)} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      <div className="tc-pagination-bar">
        {/* Rows per page */}
        <div className="tc-pagination-size">
          <span>Rows per page:</span>
          <select value={pageSize} onChange={e => handlePageSizeChange(Number(e.target.value))}>
            {[10, 20, 50, 100, 200].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Record count */}
        <div className="tc-pagination-info">
          {total === 0 ? "No leads" : (
            <>
              Showing <strong>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)}</strong> of <strong>{total}</strong> leads
            </>
          )}
        </div>

        {/* Page controls */}
        <div className="tc-pagination-controls">
          <button className="tc-page-btn" onClick={() => fetchLeads(0, filterRef.current, pageSizeRef.current)}
            disabled={page === 0} title="First page">«</button>
          <button className="tc-page-btn" onClick={() => fetchLeads(page - 1, filterRef.current, pageSizeRef.current)}
            disabled={page === 0} title="Previous page">‹</button>

          {/* Page number pills */}
          {Array.from({ length: totalPages }, (_, i) => i)
            .filter(i => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2)
            .reduce((acc, i, idx, arr) => {
              if (idx > 0 && i - arr[idx - 1] > 1) acc.push("...");
              acc.push(i);
              return acc;
            }, [])
            .map((item, idx) =>
              item === "..." ? (
                <span key={"ellipsis-" + idx} className="tc-page-ellipsis">…</span>
              ) : (
                <button key={item}
                  className={`tc-page-btn tc-page-num ${item === page ? "tc-page-num--active" : ""}`}
                  onClick={() => fetchLeads(item, filterRef.current, pageSizeRef.current)}>
                  {item + 1}
                </button>
              )
            )
          }

          <button className="tc-page-btn" onClick={() => fetchLeads(page + 1, filterRef.current, pageSizeRef.current)}
            disabled={page >= totalPages - 1} title="Next page">›</button>
          <button className="tc-page-btn" onClick={() => fetchLeads(totalPages - 1, filterRef.current, pageSizeRef.current)}
            disabled={page >= totalPages - 1} title="Last page">»</button>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {modalOpen && selected && (
        <div className="tc-modal-overlay" >
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
              {selected.source === 'Referral' && (selected.referralName || selected.referralPhone) && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', margin: '6px 0', fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: '#065f46', marginBottom: 4 }}>📋 Referral Details</div>
                  {selected.referralName  && <div style={{ color: '#374151' }}>Name: <strong>{selected.referralName}</strong></div>}
                  {selected.referralPhone && <div style={{ color: '#374151' }}>Phone: <strong>{selected.referralPhone}</strong></div>}
                </div>
              )}
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
              <DetailRow label="TC Status"  value={<StatusBadge status={selected.telecallerStatus} leadStatus={selected.leadStatus} />} />
              {selected.leadStatus && selected.leadStatus !== "New" && (
                <DetailRow label="Lead Status" value={
                  <span style={{
                    fontWeight: 600,
                    color: selected.leadStatus === "Closed Won" ? "#059669"
                         : selected.leadStatus === "Closed Lost" ? "#dc2626"
                         : "#374151"
                  }}>{selected.leadStatus}</span>
                } />
              )}
              {selected.capacity && (
                <DetailRow label="Capacity" value={
                  <span className="tc-capacity-chip">
                    ⚡ {selected.capacity} {selected.capacityUnit || 'kW'}
                  </span>
                } />
              )}
              {selected.telecallerReason && (
                <DetailRow label="Reason" value={selected.telecallerReason} />
              )}
              <DetailRow label="Assigned On"  value={selected.createdAt} />
              <DetailRow label="Last Updated" value={selected.telecallerStatusUpdatedAt || "—"} />

              <div className="tc-detail-enquiry">
                <span className="tc-detail-label">Enquiry</span>
                <p>{selected.enquiry}</p>
              </div>

              {selected.tcDiscussionNote && (
                <div className="tc-detail-enquiry tc-discussion-note">
                  <span className="tc-detail-label">Discussion Note</span>
                  <p>{selected.tcDiscussionNote}</p>
                </div>
              )}

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
              {selected.leadStatus === "Closed Won" || selected.leadStatus === "Closed Lost"
                ? <span style={{ fontSize: 13, color: selected.leadStatus === "Closed Won" ? "#059669" : "#dc2626", fontWeight: 600 }}>
                    🔒 This lead is {selected.leadStatus} — no further updates allowed.
                  </span>
                : !selected.handedOffToBD && (
                  <>
                    <button className="tc-btn-primary"
                      onClick={() => { setModalOpen(false); openStatusModal(selected); }}>
                      Update Status
                    </button>
                    <button className="tc-btn-edit"
                      onClick={() => { setModalOpen(false); openEditModal(selected); }}>
                      ✏️ Edit Details
                    </button>
                  </>
                )
              }
              <button className="tc-btn-secondary" onClick={() => setModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Lead Modal ── */}
      {editModal && selected && (
        <div className="tc-modal-overlay" >
          <div className="tc-modal tc-modal--edit" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h2>✏️ Edit Lead Details</h2>
              <button className="tc-modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <div className="tc-modal-body">
              <p className="tc-lead-name-hint">{selected.leadCode}</p>

              <div className="tc-edit-grid">

                {/* Name */}
                <div className="tc-edit-field">
                  <label>Client Name</label>
                  <input type="text" placeholder="Client name"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                {/* Phone */}
                <div className="tc-edit-field">
                  <label>Phone <span className="tc-req">*</span></label>
                  <input type="text" placeholder="10-digit phone number"
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>

                {/* Email */}
                <div className="tc-edit-field">
                  <label>Email</label>
                  <input type="email" placeholder="Email address"
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>

                {/* Source */}
                <div className="tc-edit-field">
                  <label>Source</label>
                  <select value={editForm.source}
                    onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}>
                    <option value="">Select source…</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Referral details — only when source is Referral */}
                {editForm.source === "Referral" && (
                  <>
                    <div className="tc-edit-field">
                      <label>Referred By — Name</label>
                      <input type="text" placeholder="Name of referrer"
                        value={editForm.referralName}
                        onChange={e => setEditForm(f => ({ ...f, referralName: e.target.value }))} />
                    </div>
                    <div className="tc-edit-field">
                      <label>Referred By — Phone</label>
                      <input type="text" placeholder="10-digit phone"
                        value={editForm.referralPhone}
                        onChange={e => setEditForm(f => ({ ...f, referralPhone: e.target.value.replace(/\D/g,'').slice(0,10) }))}
                        maxLength="10" />
                    </div>
                  </>
                )}

                {/* Priority */}
                <div className="tc-edit-field">
                  <label>Priority</label>
                  <select value={editForm.priority}
                    onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* State */}
                <div className="tc-edit-field">
                  <label>State</label>
                  <input type="text" placeholder="State"
                    value={editForm.state}
                    onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} />
                </div>

                {/* District */}
                <div className="tc-edit-field">
                  <label>District</label>
                  <input type="text" placeholder="District"
                    value={editForm.district}
                    onChange={e => setEditForm(f => ({ ...f, district: e.target.value }))} />
                </div>

                {/* City */}
                <div className="tc-edit-field">
                  <label>City / Village</label>
                  <input type="text" placeholder="City or village"
                    value={editForm.city}
                    onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                </div>

                {/* Pincode */}
                <div className="tc-edit-field">
                  <label>Pincode</label>
                  <input type="text" placeholder="6-digit pincode"
                    value={editForm.pincode}
                    onChange={e => setEditForm(f => ({ ...f, pincode: e.target.value }))} />
                </div>

                {/* Project Capacity */}
                <div className="tc-edit-field">
                  <label>Project Capacity</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 10"
                      value={editForm.capacity}
                      onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <select
                      value={editForm.capacityUnit}
                      onChange={e => setEditForm(f => ({ ...f, capacityUnit: e.target.value }))}
                      style={{ width: '72px' }}
                    >
                      <option value="kW">kW</option>
                      <option value="MW">MW</option>
                      <option value="kVA">kVA</option>
                      <option value="HP">HP</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Enquiry — full width */}
              <div className="tc-edit-field tc-edit-field--full">
                <label>Enquiry / Description</label>
                <textarea rows={4} placeholder="Enquiry details…"
                  value={editForm.enquiry}
                  onChange={e => setEditForm(f => ({ ...f, enquiry: e.target.value }))} />
              </div>

              {/* Subsidy toggle — only shown when scheme is PM Surya Ghar */}
              {selected?.solarScheme === "PM_Surya_Ghar" && (
                <div className="tc-edit-field tc-edit-field--full tc-subsidy-field">
                  <label>Subsidy Required?</label>
                  <div className="tc-subsidy-toggle">
                    {["Yes", "No"].map(opt => (
                      <button key={opt} type="button"
                        className={`tc-subsidy-btn ${editForm.subsidyRequired === opt ? "active active--" + opt.toLowerCase() : ""}`}
                        onClick={() => setEditForm(f => ({
                          ...f,
                          subsidyRequired: f.subsidyRequired === opt ? "" : opt
                        }))}>
                        {opt === "Yes" ? "✅ Yes, wants subsidy" : "❌ No subsidy needed"}
                      </button>
                    ))}
                  </div>
                  {editForm.subsidyRequired && (
                    <span className="tc-subsidy-hint">
                      {editForm.subsidyRequired === "Yes"
                        ? "Customer is eligible and wants the PM Surya Ghar subsidy."
                        : "Customer does not require the subsidy."}
                    </span>
                  )}
                </div>
              )}

              <div className="tc-edit-note">
                ℹ️ Group, Category, and Solar Scheme are managed by the admin and cannot be edited here.
              </div>
            </div>

            <div className="tc-modal-footer">
              <button className="tc-btn-primary"
                disabled={editSaving} onClick={submitEdit}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
              <button className="tc-btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Update Modal ── */}
      {statusModal && selected && (
        <div className="tc-modal-overlay" >
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
                    desc: "No response. Lead resurfaces tomorrow for a retry." },
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

              {newStatus === "NOT_INTERESTED" && (
                <div className="tc-reason-field">
                  <label>Reason <span className="tc-req">*</span></label>
                  <textarea rows={3}
                    placeholder="Why is the client not interested?"
                    value={reason} onChange={e => setReason(e.target.value)} />
                </div>
              )}

              {newStatus === "INTERESTED" && (
                <div className="tc-interested-fields">
                  <div className="tc-reason-field">
                    <label>Discussion Summary <span className="tc-req">*</span></label>
                    <textarea rows={3}
                      placeholder="Summarise your conversation — requirements, budget, timeline, key points discussed…"
                      value={discussion} onChange={e => setDiscussion(e.target.value)} />
                  </div>

                  <div className="tc-reason-field">
                    <label>
                      Location / Address
                      {!(selected.city || selected.state) && (
                        <span className="tc-field-hint"> — no location on record, please enter below</span>
                      )}
                    </label>
                    <input type="text"
                      placeholder={
                        selected.city || selected.state
                          ? `Current: ${[selected.city, selected.district, selected.state].filter(Boolean).join(", ")} — update if needed`
                          : "Enter city, district or full address…"
                      }
                      value={intLocation}
                      onChange={e => setIntLocation(e.target.value)} />
                  </div>

                  <div className="tc-reason-field">
                    <label>Site Visit Availability</label>
                    <input type="date"
                      value={intSiteDate}
                      onChange={e => setIntSiteDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]} />
                    <span className="tc-field-hint">When is the customer available for a site visit?</span>
                  </div>

                  <div className="tc-reason-field">
                    <label>Property Type <span className="tc-req">*</span></label>
                    <div className="tc-property-toggle">
                      {["Residential", "Commercial", "Industrial"].map(pt => (
                        <button key={pt} type="button"
                          className={`tc-prop-btn ${intPropertyType === pt ? "active" : ""}`}
                          onClick={() => setIntPropertyType(pt)}>
                          {pt === "Residential" ? "🏠" : pt === "Commercial" ? "🏢" : "🏭"} {pt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="tc-reason-field">
                    <label>Pricing Quoted (₹)</label>
                    <input type="text"
                      placeholder="e.g. 1,20,000 or 1.2L — amount discussed with customer"
                      value={intQuotedPrice}
                      onChange={e => setIntQuotedPrice(e.target.value)} />
                  </div>

                  <div className="tc-reason-field">
                    <label>Project Capacity</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 5"
                        value={intCapacity}
                        onChange={e => setIntCapacity(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <select
                        value={intCapacityUnit}
                        onChange={e => setIntCapacityUnit(e.target.value)}
                        style={{ width: '72px' }}
                      >
                        <option value="kW">kW</option>
                        <option value="MW">MW</option>
                        <option value="kVA">kVA</option>
                        <option value="HP">HP</option>
                      </select>
                    </div>
                  </div>

                  <div className="tc-reason-field">
                    <label>Add-ons / Additional Requirements</label>
                    <input type="text"
                      placeholder="e.g. Battery backup, EV charger, Net metering, Subsidy scheme…"
                      value={intAddons}
                      onChange={e => setIntAddons(e.target.value)} />
                  </div>

                  <div className="tc-reason-field">
                    <label>Any Other Comments</label>
                    <textarea rows={2}
                      placeholder="Anything else the BD team should know before visiting the customer…"
                      value={intOtherComment}
                      onChange={e => setIntOtherComment(e.target.value)} />
                  </div>

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

      {/* ── Follow-up Modal ── */}
      {followupModal && pendingFULead && (
        <div className="tc-modal-overlay" >
          <div className="tc-modal tc-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h2>📅 Schedule Follow-up?</h2>
              <button className="tc-modal-close" onClick={() => setFollowupModal(false)}>✕</button>
            </div>
            <div className="tc-modal-body">
              <p style={{ margin: '0 0 8px', fontWeight: 500 }}>{pendingFULead.name} · {pendingFULead.leadCode}</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
                Would you like to schedule a follow-up call for this lead? This is <strong>optional</strong>.
                {pendingFULead._pendingStatus === "NOT_INTERESTED"
                  ? " If skipped, the lead will be automatically marked as Closed Lost."
                  : " If skipped, the lead will resurface tomorrow in your queue."}
              </p>
              <div className="tc-reason-field">
                <label>Follow-up Date &amp; Time <span className="tc-req">*</span></label>
                <div className="tc-datetime-row">
                  <div className="tc-datetime-field">
                    <span className="tc-datetime-icon">📅</span>
                    <input type="date" className="tc-date-input" value={followupDate}
                      onChange={e => setFollowupDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="tc-datetime-field">
                    <span className="tc-datetime-icon">🕐</span>
                    <input type="time" className="tc-time-input" value={followupTime}
                      onChange={e => setFollowupTime(e.target.value)} />
                  </div>
                </div>
                <div className="tc-time-presets">
                  {['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'].map(t => (
                    <button key={t} type="button"
                      className={`tc-time-preset ${followupTime === t ? 'active' : ''}`}
                      onClick={() => setFollowupTime(t)}>
                      {t}
                    </button>
                  ))}
                </div>
                {followupDate && (
                  <div className="tc-datetime-preview">
                    📌 {new Date(`${followupDate}T${followupTime}`).toLocaleString('en-IN', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
              <div className="tc-reason-field">
                <label>Notes (optional)</label>
                <textarea rows={2} placeholder="What to discuss on the follow-up call…"
                  value={followupNote} onChange={e => setFollowupNote(e.target.value)} />
              </div>
            </div>
            <div className="tc-modal-footer">
              <button className="tc-btn-primary"
                disabled={!followupDate || !followupTime || followupSaving}
                onClick={async () => {
                  setFollowupSaving(true);
                  try {
                    // 1. Submit status with needsFollowUp = true → backend sets "Not Interested"
                    await api.put(`/telecaller/lead/${pendingFULead.id}/status`, {
                      telecallerStatus: pendingFULead._pendingStatus,
                      reason:           pendingFULead._pendingReason || '',
                      needsFollowUp:    true,
                    });
                    // 2. Create the follow-up reminder
                    await api.post(`/telecaller/lead/${pendingFULead.id}/followup`, {
                      scheduledAt:  `${followupDate} ${followupTime}:00`,
                      followupType: "Call",
                      notes:        followupNote.trim() || null,
                      priority:     "Medium",
                    });
                    showToast("Status updated & follow-up scheduled!", "success");
                  } catch (err) {
                    showToast(err.message || "Could not save. Please try again.", "error");
                  } finally {
                    setFollowupSaving(false);
                    setFollowupModal(false);
                    fetchLeads(pageRef.current, filterRef.current, pageSizeRef.current);
                    fetchStats();
                  }
                }}>
                {followupSaving ? "Saving…" : "✅ Schedule Follow-up"}
              </button>
              <button className="tc-btn-secondary" disabled={followupSaving}
                onClick={async () => {
                  setFollowupSaving(true);
                  try {
                    // Submit status with needsFollowUp = false → backend sets "Closed Lost" for NOT_INTERESTED
                    await api.put(`/telecaller/lead/${pendingFULead.id}/status`, {
                      telecallerStatus: pendingFULead._pendingStatus,
                      reason:           pendingFULead._pendingReason || '',
                      needsFollowUp:    false,
                    });
                    showToast(
                      pendingFULead._pendingStatus === "NOT_INTERESTED"
                        ? "No follow-up — lead marked as Closed Lost."
                        : "No follow-up — lead will resurface tomorrow.",
                      "info"
                    );
                  } catch (err) {
                    showToast(err.message || "Update failed.", "error");
                  } finally {
                    setFollowupSaving(false);
                    setFollowupModal(false);
                    fetchLeads(pageRef.current, filterRef.current, pageSizeRef.current);
                    fetchStats();
                  }
                }}>
                {followupSaving ? "Saving…" : "Skip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LeadCard({ lead, onDetail, onUpdateStatus, onEdit }) {
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
        <span>📧 {lead.email || "—"}</span>
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
        <StatusBadge status={lead.telecallerStatus} leadStatus={lead.leadStatus} />
        {lead.leadStatus === "Closed Won" || lead.leadStatus === "Closed Lost"
          ? <span className="tc-handed-off-label" style={{ color: lead.leadStatus === "Closed Won" ? "#059669" : "#dc2626" }}>
              🔒 {lead.leadStatus}
            </span>
          : lead.handedOffToBD
            ? <span className="tc-handed-off-label">
                🤝 BD: {lead.bdAssignedToName || "Assigned"}
              </span>
            : <div className="tc-card-actions">
                <button className="tc-btn-status"
                  onClick={e => { e.stopPropagation(); onUpdateStatus(); }}>
                  Update Status
                </button>
                <button className="tc-btn-edit-sm"
                  onClick={e => { e.stopPropagation(); onEdit(); }}
                  title="Edit lead details">
                  ✏️
                </button>
              </div>
        }
      </div>
      <div className="tc-card-viewlink" onClick={onDetail}>View Details →</div>
    </div>
  );
}

function StatusBadge({ status, leadStatus }) {
  const s = status || "NEW";
  const c = STATUS_CONFIG[s] || STATUS_CONFIG.NEW;
  // If lead became Closed Lost via NOT_INTERESTED (no follow-up), show that
  if (s === "NOT_INTERESTED" && leadStatus === "Closed Lost") {
    return <span className="tc-status-badge" style={{ color: "#dc2626", background: "#fef2f2" }}>Closed Lost</span>;
  }
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