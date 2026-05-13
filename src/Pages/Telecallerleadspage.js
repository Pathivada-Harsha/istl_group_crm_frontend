import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "./../services/leadsapi.js";
import "../pages-css/TelecallerLeadsPage.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const STATUS_CONFIG = {
  NEW:            { label: "New",            color: "#6366f1", bg: "#eef2ff" },
  PENDING:        { label: "New",            color: "#6366f1", bg: "#eef2ff" },
  INTERESTED:     { label: "Interested",     color: "#059669", bg: "#ecfdf5" },
  NOT_INTERESTED: { label: "Not Interested", color: "#dc2626", bg: "#fef2f2" },
  NOT_RESPONDED:  { label: "Not Responded",  color: "#d97706", bg: "#fffbeb" },
  ALL:            { label: "All",            color: "#64748b", bg: "#f1f5f9" },
};

const BOARD_COLUMNS = [
  { key: "ALL",            label: "All Leads",      color: "#64748b", bg: "#f1f5f9", icon: "📋" },
  { key: "NEW",            label: "New",            color: "#6366f1", bg: "#eef2ff", icon: "🆕" },
  { key: "INTERESTED",     label: "Interested",     color: "#059669", bg: "#ecfdf5", icon: "✅" },
  { key: "NOT_RESPONDED",  label: "Not Responded",  color: "#d97706", bg: "#fffbeb", icon: "⏳" },
  { key: "NOT_INTERESTED", label: "Not Interested", color: "#dc2626", bg: "#fef2f2", icon: "❌" },
];

// A NOT_RESPONDED lead is "resurfaced" if its status was set > 24h ago
const isResurfaced = (lead) =>
  lead.telecallerStatus === "NOT_RESPONDED" &&
  lead.telecallerStatusUpdatedAt &&
  new Date() - new Date(lead.telecallerStatusUpdatedAt.replace(" ", "T")) > 24 * 60 * 60 * 1000;

const PRIORITY_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };
const SOURCES   = ["Website","Referral","Walk-in","Phone","Email","Social Media","Digital Marketing","Campaign","Others"];
const PRIORITIES = ["High","Medium","Low"];

// Parse backend date strings which come as "dd-MM-yyyy HH:mm" or "dd-MM-yyyy"
// JS Date() can't parse these directly — we must re-order to ISO first.
function parseBackendDate(str) {
  if (!str) return null;
  // Match "dd-MM-yyyy HH:mm" or "dd-MM-yyyy"
  const m = str.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}:\d{2}))?/);
  if (m) {
    // Reorder to ISO: "yyyy-MM-ddTHH:mm" or "yyyy-MM-dd"
    const iso = m[4] ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}` : `${m[3]}-${m[2]}-${m[1]}`;
    return new Date(iso);
  }
  // Fallback: try native parse (handles ISO strings too)
  return new Date(str);
}

function formatDate(str) {
  if (!str) return "—";
  const d = parseBackendDate(str);
  if (!d || isNaN(d.getTime())) return str; // return raw if unparseable
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function formatDateTime(str) {
  if (!str) return "—";
  const d = parseBackendDate(str);
  if (!d || isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12: true });
}

export default function TelecallerLeadsPage() {
  // ── View mode ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("tc_view_mode") || "list");

  // ── List-view state ────────────────────────────────────────────────────────
  const [leads,      setLeads]      = useState([]);
  const [stats,      setStats]      = useState(null);
  const [filter,     setFilter]     = useState("ALL");
  const [page,       setPage]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [pageSize,   setPageSize]   = useState(10);
  const pageSizeRef = useRef(10);
  const filterRef   = useRef("ALL");
  const pageRef     = useRef(0);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState("");
  const searchRef    = useRef("");
  const searchTimer  = useRef(null);

  // ── Date filter ────────────────────────────────────────────────────────────
  const [dateMode,   setDateMode]   = useState("all"); // "all" | "single" | "range"
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const dateModeRef = useRef("all");
  const dateFromRef = useRef("");
  const dateToRef   = useRef("");

  // ── Board search ──────────────────────────────────────────────────────────
  const [boardSearch,    setBoardSearch]    = useState("");
  const boardSearchRef   = useRef("");
  const boardSearchTimer = useRef(null);

  // ── Board-view state (one state per column) ────────────────────────────────
  const [boardData,  setBoardData]  = useState({ NEW:[], INTERESTED: [], NOT_RESPONDED: [], NOT_INTERESTED: [], ALL:[] });
  const [boardPages, setBoardPages] = useState({ NEW:0,  INTERESTED: 0,  NOT_RESPONDED: 0,  NOT_INTERESTED: 0,  ALL:0  });
  const [boardTotals,setBoardTotals]= useState({ NEW:0,  INTERESTED: 0,  NOT_RESPONDED: 0,  NOT_INTERESTED: 0,  ALL:0  });
  const [boardHasMore,setBoardHasMore]=useState({ NEW:true,INTERESTED:true,NOT_RESPONDED:true,NOT_INTERESTED:true,ALL:true});
  const [boardLoading,setBoardLoading]=useState({ NEW:false,INTERESTED:false,NOT_RESPONDED:false,NOT_INTERESTED:false,ALL:false});
  const BOARD_PAGE_SIZE = 15;
  const boardObservers = useRef({});
  const boardSentinels  = useRef({});

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(null); // { lead, fromCol }
  const [dragOver, setDragOver] = useState(null);
  const [dragFromCol, setDragFromCol] = useState(null); // track source col for modal-triggered moves

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [selected,    setSelected]    = useState(null);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [reason,      setReason]      = useState("");
  const [discussion,  setDiscussion]  = useState("");
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState(null);

  const [followupModal,  setFollowupModal]  = useState(false);
  const [followupDate,   setFollowupDate]   = useState("");
  const [followupTime,   setFollowupTime]   = useState("09:00");
  const [followupNote,   setFollowupNote]   = useState("");
  const [followupSaving, setFollowupSaving] = useState(false);
  const [pendingFULead,  setPendingFULead]  = useState(null);

  const [editForm, setEditForm] = useState({
    name:"",email:"",phone:"",source:"",priority:"",enquiry:"",
    state:"",district:"",city:"",pincode:"",subsidyRequired:"",
    referralName:"",referralPhone:"",capacity:"",capacityUnit:"kW",
  });
  const [editSaving, setEditSaving] = useState(false);

  // INTERESTED extra fields
  const [intLocation, setIntLocation] = useState("");
  const [intSiteDate, setIntSiteDate] = useState("");
  const [intPropertyType, setIntPropertyType] = useState("");
  const [intQuotedPrice, setIntQuotedPrice] = useState("");
  const [intAddons, setIntAddons] = useState("");
  const [intOtherComment, setIntOtherComment] = useState("");
  const [intCapacity, setIntCapacity] = useState("");
  const [intCapacityUnit, setIntCapacityUnit] = useState("kW");
  // New INTERESTED fields
  const [intMonthlyBill, setIntMonthlyBill] = useState("");
  const [intExistingContractLoad, setIntExistingContractLoad] = useState("");
  const [intRequiredContractLoad, setIntRequiredContractLoad] = useState("");
  const [intBillFile, setIntBillFile] = useState(null);
  const [intBillUploading, setIntBillUploading] = useState(false);
  const [billPreview, setBillPreview] = useState(null); // { url, name, type }

  // ── Date params builder ────────────────────────────────────────────────────
  const buildDateParams = () => {
    const mode = dateModeRef.current;
    const from = dateFromRef.current;
    const to   = dateToRef.current;
    if (mode === "single" && from) return { assignedFrom: from, assignedTo: from };
    if (mode === "range"  && from) return { assignedFrom: from, assignedTo: to || from };
    return {};
  };

  // ── List-view fetch ────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async (p, statusFilter, size, searchOverride) => {
    const resolvedPage   = p            !== undefined ? p            : pageRef.current;
    const resolvedFilter = statusFilter !== undefined ? statusFilter : filterRef.current;
    const resolvedSize   = size         !== undefined ? size         : pageSizeRef.current;
    const resolvedSearch = searchOverride !== undefined ? searchOverride : searchRef.current;
    setLoading(true);
    try {
      const params = { page: resolvedPage, size: resolvedSize, telecallerStatus: resolvedFilter, ...buildDateParams(),
        ...(resolvedSearch ? { searchTerm: resolvedSearch } : {}) };
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
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get("/telecaller/dashboard-stats");
      if (data.success) setStats(data.data);
    } catch {}
  }, []);

  // ── Board-view fetch (per column, appends for infinite scroll) ─────────────
  const fetchBoardColumn = useCallback(async (col, pg, append = false) => {
    setBoardLoading(prev => ({ ...prev, [col]: true }));
    try {
      const params = { page: pg, size: BOARD_PAGE_SIZE, telecallerStatus: col, ...buildDateParams(),
        ...(boardSearchRef.current ? { searchTerm: boardSearchRef.current } : {}) };
      const data = await api.get("/telecaller/my-leads", { params });
      if (data.success) {
        setBoardData(prev => ({
          ...prev,
          [col]: append ? [...prev[col], ...data.data] : data.data,
        }));
        setBoardTotals(prev => ({ ...prev, [col]: data.count }));
        setBoardHasMore(prev => ({ ...prev, [col]: pg + 1 < data.totalPages }));
        setBoardPages(prev => ({ ...prev, [col]: pg }));
      }
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showToast("Failed to load board", "error");
    } finally {
      setBoardLoading(prev => ({ ...prev, [col]: false }));
    }
  }, []);

  const resetBoard = useCallback(() => {
    BOARD_COLUMNS.forEach(c => fetchBoardColumn(c.key, 0, false));
  }, [fetchBoardColumn]);

  // ── Infinite scroll observers ──────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "board") return;
    BOARD_COLUMNS.forEach(({ key }) => {
      const sentinel = boardSentinels.current[key];
      if (!sentinel) return;
      if (boardObservers.current[key]) boardObservers.current[key].disconnect();
      boardObservers.current[key] = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && boardHasMore[key] && !boardLoading[key]) {
          fetchBoardColumn(key, boardPages[key] + 1, true);
        }
      }, { threshold: 0.1 });
      boardObservers.current[key].observe(sentinel);
    });
    return () => Object.values(boardObservers.current).forEach(o => o.disconnect());
  }, [viewMode, boardHasMore, boardLoading, boardPages, fetchBoardColumn]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLeads(0, "ALL", 10);
    fetchStats();
  }, []);

  useEffect(() => {
    if (viewMode === "board") resetBoard();
  }, [viewMode]);

  // ── Drag & Drop handlers ───────────────────────────────────────────────────
  const onDragStart = (lead, fromCol) => setDragging({ lead, fromCol });
  const onDragOver  = (e, col) => { e.preventDefault(); setDragOver(col); };
  const onDragLeave = () => setDragOver(null);

  // Smart board drop: modals for statuses that need input, direct API for simple moves
  const doBoardMove = async (lead, fromCol, toCol) => {
    setBoardData(prev => ({
      ...prev,
      [fromCol]: prev[fromCol].filter(l => l.id !== lead.id),
      [toCol]:   [{ ...lead, telecallerStatus: toCol }, ...prev[toCol]],
    }));
    setBoardTotals(prev => ({ ...prev, [fromCol]: Math.max(0,(prev[fromCol]||1)-1), [toCol]: (prev[toCol]||0)+1 }));
    try {
      await api.put(`/telecaller/lead/${lead.id}/status`, { telecallerStatus: toCol });
      showToast("Moved to " + (STATUS_CONFIG[toCol]?.label || toCol) + "!", "success");
      fetchStats();
    } catch (err) {
      showToast(err.message || "Update failed", "error");
      setBoardData(prev => ({
        ...prev,
        [fromCol]: [lead, ...prev[fromCol]],
        [toCol]:   prev[toCol].filter(l => l.id !== lead.id),
      }));
    }
  };

  const onDrop = (e, toCol) => {
    e.preventDefault();
    setDragOver(null);
    if (!dragging || dragging.fromCol === toCol) { setDragging(null); return; }
    const { lead, fromCol } = dragging;
    setDragging(null);

    // Only hard-block Closed Won — all other statuses can be changed by telecaller
    if (lead.leadStatus === "Closed Won") {
      showToast("Cannot move a Closed Won lead.", "info"); return;
    }

    // NOT_INTERESTED: open modal for reason (then follow-up modal)
    if (toCol === "NOT_INTERESTED") {
      setSelected(lead);
      setNewStatus("NOT_INTERESTED");
      setReason(""); setDiscussion("");
      setDragFromCol(fromCol);
      setStatusModal(true);
      return;
    }

    // INTERESTED: open interested modal (needs discussion + property type)
    if (toCol === "INTERESTED") {
      setSelected(lead);
      setNewStatus("INTERESTED");
      setReason(""); 
      setDiscussion(lead.tcDiscussionNote||"");
      setIntLocation([lead.state||"", lead.district||"", lead.city||"", lead.pincode||""].join("||"));
      setIntSiteDate(lead.tcSiteVisitDate ? lead.tcSiteVisitDate.split("T")[0] : "");
      setIntPropertyType(lead.tcPropertyType||"");
      setIntQuotedPrice(lead.tcQuotedPrice||"");
      setIntAddons(lead.tcAddons||"");
      setIntOtherComment(lead.tcOtherComments||"");
      setIntCapacity(lead.capacity||""); setIntCapacityUnit(lead.capacityUnit||"kW");
      setIntMonthlyBill(lead.tcMonthlyBill||"");
      setIntExistingContractLoad(lead.tcExistingContractLoad||"");
      setIntRequiredContractLoad(lead.tcRequiredContractLoad||"");
      setIntBillFile(null);
      setDragFromCol(fromCol);
      setStatusModal(true);
      return;
    }

    // NEW / NOT_RESPONDED — direct move, no modal needed
    doBoardMove(lead, fromCol, toCol);
  };

  // ── Apply filter / date filter ─────────────────────────────────────────────
  const applyFilter = (f) => {
    setFilter(f); filterRef.current = f;
    setPage(0);   pageRef.current = 0;
    if (viewMode === "board") {
      // In board view, KPI clicks don't change the board columns but keep the stat highlight
      // Board shows all statuses simultaneously — just highlight which stat is active
    } else {
      fetchLeads(0, f, pageSizeRef.current, searchRef.current);
    }
  };

  const applyDateFilter = (mode, from, to) => {
    setDateMode(mode); dateModeRef.current = mode;
    setDateFrom(from); dateFromRef.current = from;
    setDateTo(to);     dateToRef.current   = to;
    // Re-fetch whatever is active
    if (viewMode === "board") {
      setTimeout(() => resetBoard(), 0);
    } else {
      setPage(0); pageRef.current = 0;
      setTimeout(() => fetchLeads(0, filterRef.current, pageSizeRef.current, searchRef.current), 0);
    }
  };

  const clearDateFilter = () => applyDateFilter("all","","");

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize); pageSizeRef.current = newSize;
    setPage(0);           pageRef.current = 0;
    fetchLeads(0, filterRef.current, newSize, searchRef.current);
  };

  const switchView = (v) => {
    setViewMode(v);
    localStorage.setItem("tc_view_mode", v);
  };

  // List search is backend-driven (searchTerm sent in API call).
  // No frontend filtering needed — we use `leads` directly.
  const visible = leads;

  // Handle list search with debounce — sends to backend
  const handleListSearch = (val) => {
    setSearch(val);
    searchRef.current = val;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setPage(0); pageRef.current = 0;
    searchTimer.current = setTimeout(() => {
      fetchLeads(0, filterRef.current, pageSizeRef.current, val);
    }, 350);
  };

  // Handle board search with debounce — resets all columns
  const handleBoardSearch = (val) => {
    setBoardSearch(val);
    boardSearchRef.current = val;
    if (boardSearchTimer.current) clearTimeout(boardSearchTimer.current);
    boardSearchTimer.current = setTimeout(() => {
      // Reset each column from page 0 with new search
      BOARD_COLUMNS.forEach(c => fetchBoardColumn(c.key, 0, false));
    }, 350);
  };

  // ── Status modal ───────────────────────────────────────────────────────────
  const openStatusModal = (lead) => {
    if (lead.leadStatus === "Closed Won") {
      showToast("This lead is Closed Won — status cannot be changed.", "info"); return;
    }
    setSelected(lead); setNewStatus(""); setReason(""); setDiscussion("");
    // Init location as "state||district||city||pincode" from existing lead address
    setIntLocation([lead.state||"", lead.district||"", lead.city||"", lead.pincode||""].join("||"));
    // Pre-fill existing INTERESTED values so telecaller can update them
    setIntSiteDate(lead.tcSiteVisitDate ? lead.tcSiteVisitDate.split("T")[0] : "");
    setIntPropertyType(lead.tcPropertyType||"");
    setIntQuotedPrice(lead.tcQuotedPrice||"");
    setIntAddons(lead.tcAddons||"");
    setIntOtherComment(lead.tcOtherComments||"");
    setIntCapacity(lead.capacity||""); setIntCapacityUnit(lead.capacityUnit||"kW");
    setIntMonthlyBill(lead.tcMonthlyBill||"");
    setIntExistingContractLoad(lead.tcExistingContractLoad||"");
    setIntRequiredContractLoad(lead.tcRequiredContractLoad||"");
    setIntBillFile(null);
    // Pre-fill discussion if re-opening an INTERESTED lead
    setDiscussion(lead.tcDiscussionNote||"");
    setStatusModal(true);
  };

  const submitStatus = async () => {
    if (!newStatus) return;
    if (newStatus==="NOT_INTERESTED" && !reason.trim()) { showToast("Reason required","error"); return; }
    if (newStatus==="INTERESTED" && !discussion.trim()) { showToast("Discussion required","error"); return; }
    if (newStatus==="INTERESTED" && !intPropertyType)   { showToast("Property type required","error"); return; }
    setSaving(true);
    try {
      if (newStatus==="NOT_INTERESTED"||newStatus==="NOT_RESPONDED") {
        setSaving(false); setStatusModal(false);
        setPendingFULead({...selected,_pendingStatus:newStatus,_pendingReason:reason.trim()});
        setFollowupDate(""); setFollowupTime("09:00"); setFollowupModal(true);
        return;
      }
      // Parse location parts from "state||district||city||pincode" format
      const locParts = intLocation.split("||");
      const tcState    = locParts[0]||"";
      const tcDistrict = locParts[1]||"";
      const tcCity     = locParts[2]||"";
      const tcPincode  = locParts[3]||"";
      const tcLocStr   = [tcCity, tcDistrict, tcState].filter(Boolean).join(", ");

      await api.put(`/telecaller/lead/${selected.id}/status`, {
        telecallerStatus: newStatus, reason: reason.trim(), discussionNote: discussion.trim(),
        ...(newStatus==="INTERESTED" && {
          tcLocation: tcLocStr||null,
          tcState: tcState||null,
          tcDistrict: tcDistrict||null,
          tcCity: tcCity||null,
          tcPincode: tcPincode||null,
          tcSiteVisitDate: intSiteDate||null,
          tcPropertyType: intPropertyType||null, tcQuotedPrice: intQuotedPrice.trim()||null,
          tcAddons: intAddons.trim()||null, tcOtherComments: intOtherComment.trim()||null,
          capacity: intCapacity.trim()||null, capacityUnit: intCapacityUnit||"kW",
          tcMonthlyBill: intMonthlyBill.trim()||null,
          tcExistingContractLoad: intExistingContractLoad.trim()||null,
          tcRequiredContractLoad: intRequiredContractLoad.trim()||null,
        }),
      });
      // Upload bill file if selected (works for any status update, not just first INTERESTED)
      if (intBillFile) {
        try {
          setIntBillUploading(true);
          const form = new FormData();
          form.append("file", intBillFile);
          // Use same localStorage pattern as leadsapi.js: key="bd_portal_user", user under .user
          const stored = JSON.parse(localStorage.getItem("bd_portal_user")||"{}");
          const authUser = stored?.user || stored || {};
          const uploadResp = await fetch(`${API_BASE_URL}/telecaller/lead/${selected.id}/upload-bill`, {
            method: "POST",
            headers: {
              "User-Id":   String(authUser.id   || ""),
              "User-Role": String(authUser.role  || "TELECALLER"),
            },
            body: form,
          });
          if (!uploadResp.ok) {
            const errData = await uploadResp.json().catch(()=>({}));
            showToast("Bill upload failed: " + (errData.message||uploadResp.status), "error");
          }
        } catch(uploadErr) {
          showToast("Bill upload failed: " + uploadErr.message, "error");
        } finally {
          setIntBillUploading(false);
          setIntBillFile(null);
        }
      }
      showToast("Status updated!","success");
      setStatusModal(false);
      setDragFromCol(null);
      if (modalOpen) {
        try { const f=await api.get(`/telecaller/lead/${selected.id}`); if(f.success) setSelected(f.data); } catch(_){}
      }
      if (viewMode==="board") resetBoard(); else fetchLeads(pageRef.current,filterRef.current,pageSizeRef.current);
      fetchStats();
    } catch(e) { if(e.message!=="SESSION_EXPIRED") showToast(e.message||"Update failed","error"); }
    finally { setSaving(false); }
  };

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const openEditModal = (lead) => {
    // Always allow editing basic lead details regardless of status.
    // The only hard block is if the lead record itself is deleted.
    setSelected(lead);
    setEditForm({
      name:lead.name||"", email:lead.email||"", phone:lead.phone||"",
      source:lead.source||"", priority:lead.priority||"Medium",
      enquiry:lead.enquiry||"", state:lead.state||"", district:lead.district||"",
      city:lead.city||"", pincode:lead.pincode||"", subsidyRequired:lead.subsidyRequired||"",
      referralName:lead.referralName||"", referralPhone:lead.referralPhone||"",
      capacity:lead.capacity||"", capacityUnit:lead.capacityUnit||"kW"
    });
    setEditModal(true);
  };

  const submitEdit = async () => {
    if (!editForm.phone.trim()) { showToast("Phone required","error"); return; }
    setEditSaving(true);
    try {
      const resp = await api.put(`/telecaller/lead/${selected.id}/details`, editForm);
      if (resp.success) {
        showToast("Lead updated!","success"); setEditModal(false);
        if (modalOpen) setSelected(resp.data);
        if (viewMode==="board") resetBoard(); else fetchLeads(pageRef.current,filterRef.current,pageSizeRef.current);
      }
    } catch(e) { if(e.message!=="SESSION_EXPIRED") showToast(e.message||"Update failed","error"); }
    finally { setEditSaving(false); }
  };

  // ── Detail modal ───────────────────────────────────────────────────────────
  const openDetail = async (lead) => {
    try {
      const data = await api.get(`/telecaller/lead/${lead.id}`);
      if (data.success) { setSelected(data.data); setModalOpen(true); }
    } catch(e) { if(e.message!=="SESSION_EXPIRED") showToast("Could not load details","error"); }
  };

  const showToast = (msg, type="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500);
  };

  const activeDateLabel = () => {
    if (dateMode==="single" && dateFrom) return `On ${formatDate(dateFrom)}`;
    if (dateMode==="range"  && dateFrom) return `${formatDate(dateFrom)} – ${dateTo ? formatDate(dateTo) : "now"}`;
    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="tc-page">
      {toast && <div className={`tc-toast tc-toast--${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="tc-header">
        <div>
          <h1 className="tc-title">My Leads</h1>
          <p className="tc-subtitle">
            {viewMode==="board"
              ? `${Object.values(boardTotals).reduce((a,b)=>a+b,0) > 0
                  ? BOARD_COLUMNS.reduce((s,c)=>s+boardTotals[c.key],0)
                  : total} total leads`
              : `${total} lead${total!==1?"s":""} in this view`}
          </p>
        </div>
        {/* View toggle */}
        <div className="tc-view-toggle">
          <button className={`tc-view-btn ${viewMode==="list"?"active":""}`} onClick={()=>switchView("list")}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
            List
          </button>
          <button className={`tc-view-btn ${viewMode==="board"?"active":""}`} onClick={()=>switchView("board")}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="18" rx="1" strokeWidth={2}/><rect x="14" y="3" width="7" height="18" rx="1" strokeWidth={2}/></svg>
            Board
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="tc-stats-bar">
          <StatCard label="All"            value={stats.total}          color="#64748b" active={filter==="ALL"}            onClick={()=>applyFilter("ALL")} />
          <StatCard label="New"            value={stats.pending}        color="#6366f1" active={filter==="NEW"}            onClick={()=>applyFilter("NEW")} />
          <StatCard label="Interested"     value={stats.interested}     color="#059669" active={filter==="INTERESTED"}     onClick={()=>applyFilter("INTERESTED")} />
          <StatCard label="Not Interested" value={stats.notInterested}  color="#dc2626" active={filter==="NOT_INTERESTED"} onClick={()=>applyFilter("NOT_INTERESTED")} />
          <StatCard label="Not Responded"  value={stats.notResponded}   color="#d97706" active={filter==="NOT_RESPONDED"}  onClick={()=>applyFilter("NOT_RESPONDED")} />
          {stats.resurfacedToday>0 && (
            <StatCard label="⚡ Re-surfaced" value={stats.resurfacedToday} color="#7c3aed" onClick={()=>applyFilter("NOT_RESPONDED")} urgent />
          )}
        </div>
      )}

      {/* Date filter */}
      <div className="tc-date-filter-bar">
        <span className="tc-date-filter-label">Assigned On:</span>
        <div className="tc-date-filter-pills">
          <button className={`tc-date-pill ${dateMode==="all"?"active":""}`} onClick={clearDateFilter}>All Time</button>
          <button className={`tc-date-pill ${dateMode==="single"?"active":""}`} onClick={()=>setDateMode("single")}>Single Day</button>
          <button className={`tc-date-pill ${dateMode==="range"?"active":""}`}  onClick={()=>setDateMode("range")}>Date Range</button>
        </div>
        {dateMode==="single" && (
          <div className="tc-date-inputs">
            <input type="date" value={dateFrom} onChange={e=>applyDateFilter("single",e.target.value,"")} className="tc-date-input" />
          </div>
        )}
        {dateMode==="range" && (
          <div className="tc-date-inputs">
            <input type="date" value={dateFrom} onChange={e=>{ const v=e.target.value; setDateFrom(v); dateFromRef.current=v; if(v && dateTo) applyDateFilter("range",v,dateTo); else if(v) { setDateFrom(v); dateFromRef.current=v; } }} className="tc-date-input" />
            <span className="tc-date-sep">to</span>
            <input type="date" value={dateTo} onChange={e=>applyDateFilter("range",dateFrom,e.target.value)} className="tc-date-input" min={dateFrom} />
          </div>
        )}
        {activeDateLabel() && (
          <span className="tc-date-active-label">{activeDateLabel()} <button className="tc-date-clear" onClick={clearDateFilter}>✕</button></span>
        )}
      </div>

      {/* Toolbar — list view only */}
      {viewMode==="list" && (
        <div className="tc-toolbar">
          <input className="tc-search" placeholder="Search name, email, phone, code…" value={search} onChange={e=>handleListSearch(e.target.value)} />
          <select
            className="tc-filter-select"
            value={filter}
            onChange={e => applyFilter(e.target.value)}
            style={{
              padding:'6px 12px', borderRadius:8, border:'1.5px solid #e2e8f0',
              fontSize:13, fontFamily:"'Poppins',sans-serif", background:'white',
              color: STATUS_CONFIG[filter]?.color || '#374151',
              fontWeight:600, cursor:'pointer'
            }}
          >
            <option value="ALL">📋 All Leads</option>
            <option value="NEW">🆕 New</option>
            <option value="INTERESTED">✅ Interested</option>
            <option value="NOT_INTERESTED">❌ Not Interested</option>
            <option value="NOT_RESPONDED">⏳ Not Responded</option>
          </select>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode==="list" && (
        <>
          {loading ? (
            <div className="tc-loading"><div className="tc-spinner"/>Loading…</div>
          ) : visible.length===0 ? (
            <div className="tc-empty"><div className="tc-empty-icon">📋</div><p>No leads found.</p></div>
          ) : (
            <div className="tc-cards">
              {visible.map(lead=>(
                <LeadCard key={lead.id} lead={lead}
                  onDetail={()=>openDetail(lead)}
                  onUpdateStatus={()=>openStatusModal(lead)}
                  onEdit={()=>openEditModal(lead)} />
              ))}
            </div>
          )}
          {/* Pagination */}
          <div className="tc-pagination-bar">
            <div className="tc-pagination-size">
              <span>Rows per page:</span>
              <select value={pageSize} onChange={e=>handlePageSizeChange(Number(e.target.value))}>
                {[10,20,50,100,200].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="tc-pagination-info">
              {total===0?"No leads":<>Showing <strong>{page*pageSize+1}–{Math.min((page+1)*pageSize,total)}</strong> of <strong>{total}</strong> leads</>}
            </div>
            <div className="tc-pagination-controls">
              <button className="tc-page-btn" onClick={()=>fetchLeads(0,filterRef.current,pageSizeRef.current,searchRef.current)} disabled={page===0} title="First">«</button>
              <button className="tc-page-btn" onClick={()=>fetchLeads(page-1,filterRef.current,pageSizeRef.current,searchRef.current)} disabled={page===0} title="Previous">‹</button>
              {Array.from({length:totalPages},(_,i)=>i).filter(i=>i===0||i===totalPages-1||Math.abs(i-page)<=2)
                .reduce((acc,i,idx,arr)=>{if(idx>0&&i-arr[idx-1]>1)acc.push("...");acc.push(i);return acc;},[])
                .map((item,idx)=>item==="..."?<span key={"e"+idx} className="tc-page-ellipsis">…</span>:(
                  <button key={item} className={`tc-page-btn tc-page-num ${item===page?"tc-page-num--active":""}`} onClick={()=>fetchLeads(item,filterRef.current,pageSizeRef.current,searchRef.current)}>{item+1}</button>
                ))}
              <button className="tc-page-btn" onClick={()=>fetchLeads(page+1,filterRef.current,pageSizeRef.current,searchRef.current)} disabled={page>=totalPages-1} title="Next">›</button>
              <button className="tc-page-btn" onClick={()=>fetchLeads(totalPages-1,filterRef.current,pageSizeRef.current,searchRef.current)} disabled={page>=totalPages-1} title="Last">»</button>
            </div>
          </div>
        </>
      )}

      {/* ── BOARD VIEW ── */}
      {viewMode==="board" && (
        <>
          {/* Board search bar */}
          <div className="tc-board-search-bar">
            <svg className="tc-board-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              className="tc-board-search-input"
              placeholder="Search across all columns by name, phone, email or code…"
              value={boardSearch}
              onChange={e => handleBoardSearch(e.target.value)}
            />
            {boardSearch && (
              <button className="tc-board-search-clear" onClick={() => handleBoardSearch("")}>✕</button>
            )}
          </div>
          <div className="tc-board">
          {BOARD_COLUMNS.map(col=>(
            <div key={col.key}
              className={`tc-board-col ${dragOver===col.key?"tc-board-col--drag-over":""}`}
              onDragOver={e=>onDragOver(e,col.key)}
              onDragLeave={onDragLeave}
              onDrop={e=>onDrop(e,col.key)}>
              {/* Column header */}
              <div className="tc-board-col-header" style={{borderTopColor:col.color}}>
                <span className="tc-board-col-icon">{col.icon}</span>
                <span className="tc-board-col-title" style={{color:col.color}}>{col.label}</span>
                <span className="tc-board-col-count" style={{background:col.bg,color:col.color}}>{boardTotals[col.key]}</span>
              </div>
              {/* Cards */}
              <div className="tc-board-col-body">
                {(() => {
                  const colLeads = col.key === "NOT_RESPONDED"
                    ? [...boardData[col.key]].sort((a,b) => {
                        const ar = isResurfaced(a), br = isResurfaced(b);
                        if (ar === br) return 0;
                        return ar ? 1 : -1; // resurfaced go to bottom
                      })
                    : boardData[col.key];
                  const normalLeads    = col.key === "NOT_RESPONDED" ? colLeads.filter(l => !isResurfaced(l)) : colLeads;
                  const resurfaceLeads = col.key === "NOT_RESPONDED" ? colLeads.filter(l =>  isResurfaced(l)) : [];
                  return (
                    <>
                      {normalLeads.map(lead => (
                        <BoardCard key={lead.id} lead={lead}
                          onDragStart={onDragStart} onDragEnd={()=>setDragging(null)}
                          onDetail={()=>openDetail(lead)}
                          onStatus={()=>openStatusModal(lead)}
                          onEdit={()=>openEditModal(lead)}
                          colKey={col.key}
                          resurfaced={false}
                        />
                      ))}
                      {resurfaceLeads.length > 0 && (
                        <>
                          <div className="tc-board-resurfaced-divider">
                            <span>⚡ Resurfaced ({resurfaceLeads.length})</span>
                          </div>
                          {resurfaceLeads.map(lead => (
                            <BoardCard key={lead.id} lead={lead}
                              onDragStart={onDragStart} onDragEnd={()=>setDragging(null)}
                              onDetail={()=>openDetail(lead)}
                              onStatus={()=>openStatusModal(lead)}
                              onEdit={()=>openEditModal(lead)}
                              colKey={col.key}
                              resurfaced={true}
                            />
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                {/* Infinite scroll sentinel */}
                <div ref={el=>{ boardSentinels.current[col.key]=el; }} className="tc-board-sentinel"/>
                {boardLoading[col.key] && <div className="tc-board-col-loading"><div className="tc-spinner"/>Loading…</div>}
                {!boardLoading[col.key] && !boardHasMore[col.key] && boardData[col.key].length>0 && (
                  <div className="tc-board-col-end">All {boardTotals[col.key]} leads loaded</div>
                )}
                {!boardLoading[col.key] && boardData[col.key].length===0 && (
                  <div className="tc-board-col-empty">No leads here</div>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* ── Detail Modal ── */}
      {modalOpen && selected && (
        <div className="tc-modal-overlay">
          <div className="tc-modal tc-modal--wide tc-modal--fixed-layout" onClick={e=>e.stopPropagation()}>
            <div className="tc-modal-header tc-modal-header--fixed">
              <div><h2>{selected.name}</h2><span className="tc-lead-code">{selected.leadCode}</span></div>
              <button className="tc-modal-close" onClick={()=>setModalOpen(false)}>✕</button>
            </div>
            {selected.handedOffToBD && (
              <div className="tc-handed-off-banner">🤝 Handed off to BD Team{selected.bdAssignedToName&&<span> → <strong>{selected.bdAssignedToName}</strong></span>}{selected.bdAssignedAt&&<span className="tc-handoff-date"> on {selected.bdAssignedAt}</span>}</div>
            )}
            <div className="tc-modal-body tc-modal-body--scrollable tc-modal-body--grid">
              <div>
                <div className="tc-section-title">Contact</div>
                <DetailRow label="Email"    value={selected.email}/>
                <DetailRow label="Phone"    value={selected.phone}/>
                <DetailRow label="Source"   value={selected.source}/>
                <DetailRow label="Priority" value={selected.priority} style={{color:PRIORITY_COLOR[selected.priority]||"#374151",fontWeight:600}}/>
                {/* Always show address section with all available fields */}
                <div className="tc-section-title">Address</div>
                <DetailRow label="State"    value={selected.state||"—"}/>
                <DetailRow label="District" value={selected.district||"—"}/>
                <DetailRow label="City"     value={selected.city||"—"}/>
                <DetailRow label="Pincode"  value={selected.pincode||"—"}/>
              </div>
              <div>
                <div className="tc-section-title">Lead Info</div>
                <DetailRow label="Group"       value={selected.groupName}/>
                <DetailRow label="Category"    value={selected.subGroupName}/>
                <DetailRow label="TC Status"   value={<StatusBadge status={selected.telecallerStatus} leadStatus={selected.leadStatus}/>}/>
                {selected.capacity && <DetailRow label="Capacity" value={`${selected.capacity} ${selected.capacityUnit||"kW"}`}/>}
                {selected.telecallerReason && <DetailRow label="Reason" value={selected.telecallerReason}/>}
                <DetailRow label="Assigned On"  value={formatDateTime(selected.createdAt)}/>
                <DetailRow label="Last Updated" value={selected.telecallerStatusUpdatedAt||"—"}/>
                {/* TC Interested Details */}
                {(selected.tcMonthlyBill||selected.tcExistingContractLoad||selected.tcRequiredContractLoad||selected.tcBillFileName||selected.tcQuotedPrice||selected.tcPropertyType||selected.tcSiteVisitDate||selected.tcLocation) && <>
                  <div className="tc-section-title">Interested Details</div>
                  {selected.tcPropertyType && <DetailRow label="Property Type" value={selected.tcPropertyType}/>}
                  {selected.tcLocation && <DetailRow label="Location" value={selected.tcLocation}/>}
                  {selected.tcSiteVisitDate && <DetailRow label="Site Visit" value={selected.tcSiteVisitDate}/>}
                  {selected.tcQuotedPrice && <DetailRow label="Quoted Price" value={`₹${selected.tcQuotedPrice}`}/>}
                  {selected.tcMonthlyBill && <DetailRow label="Monthly Bill" value={`₹${selected.tcMonthlyBill}`}/>}
                  {selected.tcExistingContractLoad && <DetailRow label="Existing Load" value={selected.tcExistingContractLoad}/>}
                  {selected.tcRequiredContractLoad && <DetailRow label="Required Load" value={selected.tcRequiredContractLoad}/>}
                  {selected.tcAddons && <DetailRow label="Add-ons" value={selected.tcAddons}/>}
                  {/* Bill file — always show if filename exists regardless of other fields */}
                  {selected.tcBillFileName && (
                    <div className="tc-detail-row">
                      <span className="tc-detail-label">Electricity Bill</span>
                      <span className="tc-detail-value">
                        {selected.tcHasBillFile ? (
                          <button
                            className="tc-bill-view-btn"
                            onClick={() => setBillPreview({
                              url: `${API_BASE_URL}/telecaller/lead/${selected.id}/bill`,
                              name: selected.tcBillFileName,
                              type: selected.tcBillFileType || 'application/octet-stream',
                            })}
                          >
                            📄 {selected.tcBillFileName}
                          </button>
                        ) : (
                          <span style={{color:"#9ca3af",fontSize:12}}>{selected.tcBillFileName} (not available)</span>
                        )}
                      </span>
                    </div>
                  )}
                </>}
                <div className="tc-section-title">Team</div>
                <div className="tc-team-panel">
                  <TeamMember role="Telecaller" name={selected.telecallerName||"You"} icon="📞"/>
                  {selected.bdAssignedToName&&<TeamMember role="BD Executive" name={selected.bdAssignedToName} icon="💼" since={selected.bdAssignedAt}/>}
                </div>
              </div>
            </div>
            {selected.enquiry && <div className="tc-detail-enquiry" style={{margin:"0 20px 8px"}}><span className="tc-detail-label">Enquiry</span><p>{selected.enquiry}</p></div>}
            {selected.tcDiscussionNote && <div className="tc-detail-enquiry tc-discussion-note" style={{margin:"0 20px 8px"}}><span className="tc-detail-label">Discussion Note</span><p>{selected.tcDiscussionNote}</p></div>}
            <div className="tc-modal-footer tc-modal-footer--fixed">
              {selected.leadStatus==="Closed Won"
                ? <>
                    <span style={{fontSize:13,color:"#059669",fontWeight:600}}>🔒 Closed Won</span>
                    <button className="tc-btn-edit" onClick={()=>{setModalOpen(false);openEditModal(selected);}}>✏️ Edit Details</button>
                  </>
                : <>
                    <button className="tc-btn-primary" onClick={()=>{setModalOpen(false);openStatusModal(selected);}}>Update Status</button>
                    <button className="tc-btn-edit"    onClick={()=>{setModalOpen(false);openEditModal(selected);}}>✏️ Edit Details</button>
                  </>
              }
              <button className="tc-btn-secondary" onClick={()=>setModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editModal && selected && (
        <div className="tc-modal-overlay">
          <div className="tc-modal tc-modal--wide tc-modal--edit tc-modal--fixed-layout" onClick={e=>e.stopPropagation()}>
            <div className="tc-modal-header tc-modal-header--fixed"><h2>✏️ Edit Lead Details</h2><button className="tc-modal-close" onClick={()=>setEditModal(false)}>✕</button></div>
            <div className="tc-modal-body tc-modal-body--scrollable">
              <p className="tc-lead-name-hint">{selected.leadCode} · {selected.name}</p>
              <div className="tc-edit-grid">
                {[["Client Name","name","text"],["Phone *","phone","text"],["Email","email","email"]].map(([lbl,k,t])=>(
                  <div className="tc-edit-field" key={k}><label>{lbl}</label>
                    <input type={t} value={editForm[k]} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}/>
                  </div>
                ))}
                <div className="tc-edit-field"><label>Source</label>
                  <select value={editForm.source} onChange={e=>setEditForm(f=>({...f,source:e.target.value}))}>
                    <option value="">Select…</option>{SOURCES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                {editForm.source==="Referral"&&<>
                  <div className="tc-edit-field"><label>Referrer Name</label><input value={editForm.referralName} onChange={e=>setEditForm(f=>({...f,referralName:e.target.value}))}/></div>
                  <div className="tc-edit-field"><label>Referrer Phone</label><input value={editForm.referralPhone} onChange={e=>setEditForm(f=>({...f,referralPhone:e.target.value.replace(/\D/g,"").slice(0,10)}))}/></div>
                </>}
                <div className="tc-edit-field"><label>Priority</label>
                  <select value={editForm.priority} onChange={e=>setEditForm(f=>({...f,priority:e.target.value}))}>
                    {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                {[["State","state"],["District","district"],["City","city"],["Pincode","pincode"]].map(([lbl,k])=>(
                  <div className="tc-edit-field" key={k}><label>{lbl}</label><input value={editForm[k]} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}/></div>
                ))}
                <div className="tc-edit-field"><label>Capacity</label>
                  <div style={{display:"flex",gap:6}}>
                    <input type="number" min="0" step="any" value={editForm.capacity} onChange={e=>setEditForm(f=>({...f,capacity:e.target.value}))} style={{flex:1}}/>
                    <select value={editForm.capacityUnit} onChange={e=>setEditForm(f=>({...f,capacityUnit:e.target.value}))} style={{width:72}}>
                      {["kW","MW","kVA","HP"].map(u=><option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="tc-edit-field tc-edit-field--full"><label>Enquiry</label>
                <textarea rows={4} value={editForm.enquiry} onChange={e=>setEditForm(f=>({...f,enquiry:e.target.value}))}/>
              </div>
              <div className="tc-edit-note">ℹ️ Group, Category, and Solar Scheme are managed by the admin.</div>
            </div>
            <div className="tc-modal-footer tc-modal-footer--fixed">
              <button className="tc-btn-primary" disabled={editSaving} onClick={submitEdit}>{editSaving?"Saving…":"Save Changes"}</button>
              <button className="tc-btn-secondary" onClick={()=>setEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Modal ── */}
      {statusModal && selected && (
        <div className="tc-modal-overlay">
          <div className="tc-modal tc-modal--interested tc-modal--fixed-layout" onClick={e=>e.stopPropagation()}>
            <div className="tc-modal-header tc-modal-header--fixed">
              <div>
                <h2>Update Status</h2>
                <span className="tc-lead-code" style={{fontSize:12,color:"#6b7280"}}>{selected.name} · {selected.leadCode}</span>
              </div>
              <button className="tc-modal-close" onClick={()=>setStatusModal(false)}>✕</button>
            </div>
            <div className="tc-modal-body tc-modal-body--scrollable">
              <div className="tc-status-options">
                {[
                  {value:"INTERESTED",    emoji:"✅",label:"Interested",    desc:"Client interested. Goes to BD via round-robin."},
                  {value:"NOT_INTERESTED",emoji:"❌",label:"Not Interested",desc:"Not interested. Reason required."},
                  {value:"NOT_RESPONDED", emoji:"⏳",label:"Not Responded", desc:"No response. Resurfaces tomorrow."}
                ].map(opt=>(
                  <label key={opt.value} className={`tc-status-option ${newStatus===opt.value?"selected":""}`}
                    style={newStatus===opt.value?{borderColor:STATUS_CONFIG[opt.value].color,background:STATUS_CONFIG[opt.value].bg}:{}}>
                    <input type="radio" name="status" value={opt.value} checked={newStatus===opt.value} onChange={()=>setNewStatus(opt.value)}/>
                    <span className="tc-status-emoji">{opt.emoji}</span>
                    <div><strong>{opt.label}</strong><p>{opt.desc}</p></div>
                  </label>
                ))}
              </div>

              {newStatus==="NOT_INTERESTED"&&(
                <div className="tc-reason-field"><label>Reason <span className="tc-req">*</span></label>
                  <textarea rows={3} placeholder="Why not interested?" value={reason} onChange={e=>setReason(e.target.value)}/></div>
              )}

              {newStatus==="INTERESTED"&&(
                <div className="tc-interested-fields">
                  {/* Discussion Summary */}
                  <div className="tc-reason-field tc-field--full"><label>Discussion Summary <span className="tc-req">*</span></label>
                    <textarea rows={3} value={discussion} onChange={e=>setDiscussion(e.target.value)} placeholder="Summarise the discussion with the customer…"/></div>

                  {/* Location — State/District/City/Pincode fields */}
                  <div className="tc-reason-field tc-field--full">
                    <label>Location / Address</label>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginTop:6}}>
                      <div>
                        <label style={{fontSize:11,color:"#6b7280",fontWeight:600,display:"block",marginBottom:3}}>State</label>
                        <select className="tc-styled-input"
                          value={intLocation.split("||")[0]||""}
                          onChange={e=>{
                            const parts=intLocation.split("||");
                            parts[0]=e.target.value;
                            setIntLocation(parts.join("||"));
                          }}>
                          <option value="">Select State</option>
                          {["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"].map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontSize:11,color:"#6b7280",fontWeight:600,display:"block",marginBottom:3}}>District</label>
                        <input className="tc-styled-input"
                          value={intLocation.split("||")[1]||""}
                          onChange={e=>{
                            const parts=intLocation.split("||");
                            while(parts.length<4) parts.push("");
                            parts[1]=e.target.value;
                            setIntLocation(parts.join("||"));
                          }}
                          placeholder="e.g. Hyderabad"/>
                      </div>
                      <div>
                        <label style={{fontSize:11,color:"#6b7280",fontWeight:600,display:"block",marginBottom:3}}>City / Village</label>
                        <input className="tc-styled-input"
                          value={intLocation.split("||")[2]||""}
                          onChange={e=>{
                            const parts=intLocation.split("||");
                            while(parts.length<4) parts.push("");
                            parts[2]=e.target.value;
                            setIntLocation(parts.join("||"));
                          }}
                          placeholder="e.g. Uppal"/>
                      </div>
                      <div>
                        <label style={{fontSize:11,color:"#6b7280",fontWeight:600,display:"block",marginBottom:3}}>Pincode</label>
                        <input className="tc-styled-input"
                          value={intLocation.split("||")[3]||""}
                          onChange={e=>{
                            const parts=intLocation.split("||");
                            while(parts.length<4) parts.push("");
                            parts[3]=e.target.value.replace(/\D/g,"").slice(0,6);
                            setIntLocation(parts.join("||"));
                          }}
                          placeholder="6-digit PIN" maxLength={6}/>
                      </div>
                    </div>
                    {(!selected.state && !selected.district && !selected.city) && (
                      <small style={{color:"#f59e0b",fontSize:11,display:"block",marginTop:4}}>⚠️ Address not updated for this lead — please enter manually.</small>
                    )}
                    {(selected.state || selected.district || selected.city) && (
                      <small style={{color:"#6b7280",fontSize:11,display:"block",marginTop:4}}>
                        Existing: {[selected.city,selected.district,selected.state,selected.pincode].filter(Boolean).join(", ")}
                      </small>
                    )}
                  </div>

                  {/* 2-column grid for fields */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 16px"}}>
                    <div className="tc-reason-field">
                      <label>Site Visit Date</label>
                      <input type="date" value={intSiteDate} onChange={e=>setIntSiteDate(e.target.value)} min={new Date().toISOString().split("T")[0]}/>
                    </div>
                    <div className="tc-reason-field">
                      <label>Quoted Price (₹)</label>
                      <input className="tc-styled-input" value={intQuotedPrice} onChange={e=>setIntQuotedPrice(e.target.value)} placeholder="e.g. 1,20,000"/>
                    </div>
                    <div className="tc-reason-field">
                      <label>Monthly Bill Amount (₹)</label>
                      <input className="tc-styled-input" value={intMonthlyBill} onChange={e=>setIntMonthlyBill(e.target.value)} placeholder="e.g. 2500"/>
                    </div>
                    <div className="tc-reason-field">
                      <label>Existing Contracted Load</label>
                      <input className="tc-styled-input" value={intExistingContractLoad} onChange={e=>setIntExistingContractLoad(e.target.value)} placeholder="e.g. 5 kW"/>
                    </div>
                    <div className="tc-reason-field">
                      <label>Required Contracted Load</label>
                      <input className="tc-styled-input" value={intRequiredContractLoad} onChange={e=>setIntRequiredContractLoad(e.target.value)} placeholder="e.g. 10 kW"/>
                    </div>
                    <div className="tc-reason-field">
                      <label>Capacity</label>
                      <div style={{display:"flex",gap:6}}>
                        <input type="number" className="tc-styled-input" value={intCapacity} onChange={e=>setIntCapacity(e.target.value)} style={{flex:1}} placeholder="0"/>
                        <select className="tc-styled-input" value={intCapacityUnit} onChange={e=>setIntCapacityUnit(e.target.value)} style={{width:80}}>
                          {["kWp","kVA","Units","kW","MW","HP"].map(u=><option key={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Property Type */}
                  <div className="tc-reason-field tc-field--full">
                    <label>Property Type <span className="tc-req">*</span></label>
                    <div className="tc-property-toggle">
                      {["Residential","Commercial","Industrial"].map(pt=>(
                        <button key={pt} type="button" className={`tc-prop-btn ${intPropertyType===pt?"active":""}`} onClick={()=>setIntPropertyType(pt)}>
                          {pt==="Residential"?"🏠":pt==="Commercial"?"🏢":"🏭"} {pt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add-ons */}
                  <div className="tc-reason-field tc-field--full">
                    <label>Add-ons</label>
                    <input className="tc-styled-input" value={intAddons} onChange={e=>setIntAddons(e.target.value)} placeholder="e.g. Battery backup, Net metering"/>
                  </div>

                  {/* Other Comments */}
                  <div className="tc-reason-field tc-field--full">
                    <label>Other Comments</label>
                    <textarea rows={2} value={intOtherComment} onChange={e=>setIntOtherComment(e.target.value)} placeholder="Additional notes for BD team…"/>
                  </div>

                  {/* Bill Upload — shows existing bill if present, with option to replace */}
                  <div className="tc-reason-field tc-field--full">
                    <label>
                      Electricity Bill
                      <span style={{color:"#9ca3af",fontWeight:400,fontSize:11}}> (optional, max 10 MB)</span>
                    </label>

                    {/* Show existing bill if one is stored and no new file selected */}
                    {selected.tcHasBillFile && selected.tcBillFileName && !intBillFile && (
                      <div style={{
                        display:"flex",alignItems:"center",justifyContent:"space-between",
                        gap:8,padding:"8px 12px",marginBottom:8,
                        background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:8,
                      }}>
                        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#059669",minWidth:0}}>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                          </svg>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {selected.tcBillFileName}
                          </span>
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button type="button"
                            className="tc-bill-btn tc-bill-btn--newtab"
                            style={{padding:"3px 10px",fontSize:12}}
                            onClick={()=>setBillPreview({
                              url:`${API_BASE_URL}/telecaller/lead/${selected.id}/bill`,
                              name:selected.tcBillFileName,
                              type:selected.tcBillFileType||"application/octet-stream",
                            })}>
                            👁 View
                          </button>
                          <label style={{
                            padding:"3px 10px",fontSize:12,cursor:"pointer",
                            background:"#eff6ff",color:"#2563eb",
                            border:"1.5px solid #bfdbfe",borderRadius:7,
                            display:"inline-flex",alignItems:"center",gap:4,
                          }}>
                            🔄 Replace
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                              style={{display:"none"}} onChange={e=>setIntBillFile(e.target.files[0]||null)}/>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Upload area — show when no existing bill OR a new file is being selected */}
                    {(!selected.tcHasBillFile || intBillFile) && (
                      <label className="tc-bill-upload" style={{
                        display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                        border:"1.5px dashed "+(intBillFile?"#059669":"#d1d5db"),
                        borderRadius:8,padding:"10px 14px",
                        background:intBillFile?"#f0fdf4":"#fafafa",
                        fontSize:13,color:intBillFile?"#059669":"#6b7280",
                      }}>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                        </svg>
                        <span>{intBillFile ? intBillFile.name : "Choose PDF, JPG, or PNG…"}</span>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                          style={{display:"none"}} onChange={e=>setIntBillFile(e.target.files[0]||null)}/>
                      </label>
                    )}

                    {intBillFile && (
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                        <span style={{fontSize:11,color:"#059669"}}>✓ {intBillFile.name} — will replace existing</span>
                        <button type="button"
                          style={{fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer"}}
                          onClick={()=>setIntBillFile(null)}>✕ Cancel</button>
                      </div>
                    )}
                  </div>

                  <div className="tc-handoff-note">ℹ️ Lead will be assigned to BD Executive via round-robin.</div>
                </div>
              )}
            </div>
            <div className="tc-modal-footer tc-modal-footer--fixed">
              <button className="tc-btn-primary" disabled={!newStatus||saving||intBillUploading} onClick={submitStatus}>
                {saving||intBillUploading ? "Saving…" : "Confirm"}
              </button>
              <button className="tc-btn-secondary" onClick={()=>{setStatusModal(false);setDragFromCol(null);}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Follow-up Modal ── */}
      {followupModal && pendingFULead && (
        <div className="tc-modal-overlay">
          <div className="tc-modal tc-modal--sm tc-modal--fixed-layout" onClick={e=>e.stopPropagation()}>
            <div className="tc-modal-header tc-modal-header--fixed"><h2>📅 Schedule Follow-up?</h2><button className="tc-modal-close" onClick={()=>setFollowupModal(false)}>✕</button></div>
            <div className="tc-modal-body tc-modal-body--scrollable">
              <p style={{margin:"0 0 8px",fontWeight:500}}>{pendingFULead.name} · {pendingFULead.leadCode}</p>
              <p style={{fontSize:13,color:"#6b7280",margin:"0 0 16px"}}>
                Optional. {pendingFULead._pendingStatus==="NOT_INTERESTED"?" If skipped, marked Closed Lost.":" If skipped, resurfaces tomorrow."}
              </p>
              <div className="tc-reason-field">
                <label>Date &amp; Time <span className="tc-req">*</span></label>
                <div className="tc-datetime-row">
                  <div className="tc-datetime-field"><span className="tc-datetime-icon">📅</span>
                    <input type="date" className="tc-date-input" value={followupDate} onChange={e=>setFollowupDate(e.target.value)} min={new Date().toISOString().split("T")[0]}/></div>
                  <div className="tc-datetime-field"><span className="tc-datetime-icon">🕐</span>
                    <input type="time" className="tc-time-input" value={followupTime} onChange={e=>setFollowupTime(e.target.value)}/></div>
                </div>
                <div className="tc-time-presets">
                  {["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00"].map(t=>(
                    <button key={t} type="button" className={`tc-time-preset ${followupTime===t?"active":""}`} onClick={()=>setFollowupTime(t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="tc-reason-field"><label>Notes</label>
                <textarea rows={2} value={followupNote} onChange={e=>setFollowupNote(e.target.value)}/></div>
            </div>
            <div className="tc-modal-footer tc-modal-footer--fixed">
              <button className="tc-btn-primary" disabled={!followupDate||!followupTime||followupSaving}
                onClick={async()=>{
                  setFollowupSaving(true);
                  try {
                    await api.put(`/telecaller/lead/${pendingFULead.id}/status`,{telecallerStatus:pendingFULead._pendingStatus,reason:pendingFULead._pendingReason||"",needsFollowUp:true});
                    await api.post(`/telecaller/lead/${pendingFULead.id}/followup`,{scheduledAt:`${followupDate} ${followupTime}:00`,followupType:"Call",notes:followupNote.trim()||null,priority:"Medium"});
                    showToast("Status updated & follow-up scheduled!","success");
                  } catch(err){showToast(err.message||"Could not save.","error");}
                  finally{setFollowupSaving(false);setFollowupModal(false);if(viewMode==="board")resetBoard();else fetchLeads(pageRef.current,filterRef.current,pageSizeRef.current);fetchStats();}
                }}>{followupSaving?"Saving…":"✅ Schedule Follow-up"}</button>
              <button className="tc-btn-secondary" disabled={followupSaving}
                onClick={async()=>{
                  setFollowupSaving(true);
                  try {
                    await api.put(`/telecaller/lead/${pendingFULead.id}/status`,{telecallerStatus:pendingFULead._pendingStatus,reason:pendingFULead._pendingReason||"",needsFollowUp:false});
                    showToast(pendingFULead._pendingStatus==="NOT_INTERESTED"?"No follow-up — Closed Lost.":"No follow-up — resurfaces tomorrow.","info");
                  } catch(err){showToast(err.message||"Failed.","error");}
                  finally{setFollowupSaving(false);setFollowupModal(false);if(viewMode==="board")resetBoard();else fetchLeads(pageRef.current,filterRef.current,pageSizeRef.current);fetchStats();}
                }}>{followupSaving?"Saving…":"Skip"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bill File Preview Modal ── */}
      {billPreview && (
        <TcBillPreviewModal
          url={billPreview.url}
          name={billPreview.name}
          type={billPreview.type}
          onClose={() => setBillPreview(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function BoardCard({ lead, onDragStart, onDragEnd, onDetail, onStatus, onEdit, colKey, resurfaced }) {
  return (
    <div
      className={`tc-board-card ${resurfaced ? "tc-board-card--resurfaced" : ""}`}
      draggable
      onDragStart={() => onDragStart(lead, colKey)}
      onDragEnd={onDragEnd}
      onClick={onDetail}
    >
      <div className="tc-board-card-top">
        <span className="tc-board-card-name">{lead.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {resurfaced && <span className="tc-board-resurfaced-dot" title="Resurfaced lead">⚡</span>}
          <span className="tc-board-priority-dot"
            style={{ background: PRIORITY_COLOR[lead.priority] || "#9ca3af" }}
            title={lead.priority} />
        </div>
      </div>
      <span className="tc-board-card-code">{lead.leadCode}</span>
      {resurfaced && (
        <div className="tc-board-resurfaced-tag">⚡ Resurfaced</div>
      )}
      <div className="tc-board-card-contact">
        <span>📞 {lead.phone}</span>
      </div>
      {lead.city && (
        <div className="tc-board-card-loc">📍 {[lead.city, lead.state].filter(Boolean).join(", ")}</div>
      )}
      <div className="tc-board-card-meta">
        <span className="tc-board-card-date">{formatDate(lead.createdAt)}</span>
        {resurfaced && lead.telecallerStatusUpdatedAt && (
          <span className="tc-board-resurfaced-since">
            set {formatDateTime(lead.telecallerStatusUpdatedAt)}
          </span>
        )}
      </div>
      <div className="tc-board-card-actions" onClick={e => e.stopPropagation()}>
        <button className="tc-board-card-btn tc-board-card-btn--status" onClick={onStatus}>Status</button>
        <button className="tc-board-card-btn tc-board-card-btn--edit" onClick={onEdit}>Edit</button>
      </div>
      <div className="tc-board-drag-hint">⠿ drag to move</div>
    </div>
  );
}

function LeadCard({ lead, onDetail, onUpdateStatus, onEdit }) {
  const sc = STATUS_CONFIG[lead.telecallerStatus] || STATUS_CONFIG.NEW;
  return (
    <div className={`tc-card ${lead.handedOffToBD?"tc-card--handed-off":""} ${!lead.telecallerStatus||lead.telecallerStatus==="NEW"?"tc-card--new":""}`}
      onClick={onDetail} style={{cursor:"pointer"}}>
      <div className="tc-card-top">
        <div className="tc-card-name-row">
          <span className="tc-card-name">{lead.name}</span>
          <span className="tc-priority-dot" style={{background:PRIORITY_COLOR[lead.priority]||"#9ca3af"}} title={`${lead.priority} priority`}/>
        </div>
        <span className="tc-card-code">{lead.leadCode}</span>
        <span className="tc-card-date">📅 {formatDate(lead.createdAt)}</span>
      </div>
      <div className="tc-card-contact">
        <span>📧 {lead.email||"—"}</span>
        <span>📞 {lead.phone}</span>
      </div>
      {(lead.state||lead.city)&&<div className="tc-card-address">📍 {[lead.city,lead.district,lead.state].filter(Boolean).join(", ")}{lead.pincode&&` – ${lead.pincode}`}</div>}
      {lead.groupName&&<div className="tc-card-group">🏷 {lead.groupName}{lead.subGroupName?` › ${lead.subGroupName}`:""}{lead.solarScheme&&<span className="tc-scheme-badge">{lead.solarScheme.replace(/_/g," ")}</span>}</div>}
      <p className="tc-card-enquiry">{lead.enquiry?.slice(0,100)}{lead.enquiry?.length>100?"…":""}</p>
      <div className="tc-card-footer" onClick={e=>e.stopPropagation()}>
        {lead.leadStatus==="Closed Won"
          ? <div className="tc-card-actions">
              <span className="tc-handed-off-label" style={{color:"#059669"}}>🔒 Closed Won</span>
              <button className="tc-btn-edit-sm" onClick={e=>{e.stopPropagation();onEdit();}}>✏️ Edit</button>
            </div>
          : <div className="tc-card-actions">
              <button className="tc-btn-status" onClick={e=>{e.stopPropagation();onUpdateStatus();}}>Update Status</button>
              <button className="tc-btn-view-sm" onClick={e=>{e.stopPropagation();onDetail();}}>👁 View</button>
              <button className="tc-btn-edit-sm" onClick={e=>{e.stopPropagation();onEdit();}}>✏️ Edit</button>
            </div>
        }
      </div>
    </div>
  );
}

// ── Bill Preview Modal ────────────────────────────────────────────────────────
function TcBillPreviewModal({ url, name, type, onClose }) {
  const [blobUrl, setBlobUrl] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error,   setError]   = React.useState(null);

  React.useEffect(() => {
    let objectUrl = null;
    const fetchBlob = async () => {
      try {
        setLoading(true); setError(null);
        const stored  = JSON.parse(localStorage.getItem('bd_portal_user') || '{}');
        const u       = stored?.user || stored || {};
        const resp    = await fetch(url, {
          headers: { 'User-Id': String(u.id || ''), 'User-Role': String(u.role || 'TELECALLER') },
        });
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const blob = await resp.blob();
        objectUrl  = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBlob();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  const isPdf   = type?.includes('pdf') || name?.toLowerCase().endsWith('.pdf');
  const isImage = type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name || '');

  return (
    <div className="tc-bill-overlay" onClick={onClose}>
      <div className="tc-bill-modal" onClick={e => e.stopPropagation()}>
        <div className="tc-bill-header">
          <span className="tc-bill-title">📄 {name}</span>
          <div className="tc-bill-actions">
            {blobUrl && (
              <>
                <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="tc-bill-btn tc-bill-btn--newtab">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </a>
                <a href={blobUrl} download={name} className="tc-bill-btn tc-bill-btn--download">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
              </>
            )}
            <button className="tc-bill-btn tc-bill-btn--close" onClick={onClose}>✕ Close</button>
          </div>
        </div>
        <div className="tc-bill-body">
          {loading && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",gap:12,color:"#6b7280"}}>
              <div className="tc-bill-spinner"/>
              <span style={{fontSize:14}}>Loading file…</span>
            </div>
          )}
          {error && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12,color:"#dc2626"}}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="40" height="40"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              <p style={{fontSize:14,margin:0}}>Failed to load: {error}</p>
            </div>
          )}
          {!loading && !error && blobUrl && isPdf && (
            <iframe src={blobUrl} title={name} width="100%" height="100%" style={{border:"none"}} />
          )}
          {!loading && !error && blobUrl && isImage && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",padding:16}}>
              <img src={blobUrl} alt={name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8}} />
            </div>
          )}
          {!loading && !error && blobUrl && !isPdf && !isImage && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16,color:"#6b7280"}}>
              <p style={{fontSize:14}}>Preview not available for this file type.</p>
              <a href={blobUrl} download={name} className="tc-bill-btn tc-bill-btn--download">⬇ Download File</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, leadStatus }) {
  const s = status||"NEW";
  const c = STATUS_CONFIG[s]||STATUS_CONFIG.NEW;
  if (s==="NOT_INTERESTED"&&leadStatus==="Closed Lost")
    return <span className="tc-status-badge" style={{color:"#dc2626",background:"#fef2f2"}}>Closed Lost</span>;
  return <span className="tc-status-badge" style={{color:c.color,background:c.bg}}>{c.label}</span>;
}

function StatCard({ label, value, color, onClick, urgent, active }) {
  return (
    <div className={`tc-stat-card ${urgent?"tc-stat-card--urgent":""} ${active?"tc-stat-card--active":""}`}
      onClick={onClick} style={{borderTopColor:color,cursor:"pointer",...(active?{boxShadow:`0 0 0 2px ${color}`}:{})}}>
      <span className="tc-stat-value" style={{color}}>{value}</span>
      <span className="tc-stat-label">{label}</span>
    </div>
  );
}

function DetailRow({ label, value, style }) {
  return (
    <div className="tc-detail-row">
      <span className="tc-detail-label">{label}</span>
      <span className="tc-detail-value" style={style}>{value||"—"}</span>
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
        {since&&<div className="tc-team-since">Since {since}</div>}
      </div>
    </div>
  );
}