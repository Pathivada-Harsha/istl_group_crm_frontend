// src/components/Projects/ProjectDetailPage.js
//
// Projects module — DETAIL page (route: /projects/:projectUniqueId).
// Ports the OrderBookDetailPage structure (header card + persisted obd-tab bar)
// but project-centric and fully EDITABLE. The three execution tabs reuse the
// ported tab components (Scope/SOW, Financials, Progress & Timeline), which hit
// the /projects/{id}/... endpoints that MIRROR the Order Book detail endpoints.
//
// The ported tab components expect an `orderBook` prop; we hand them a
// project-shaped shim ({ id: projectUniqueId, subGroupName, orderTitle, ... }).

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { FaFileDownload, FaFilePdf, FaFileImage, FaFileAlt, FaExternalLinkAlt } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import useToast from '../../hooks/useToast';
import ToastContainer from '../Notification_Toast/ToastContainer.js';
import CrmPreloader from '../preLoader.js';
import LocationPicker from '../LocationPicker.js';
import projectsApi from '../../services/projectsApi.js';
import { TechnicalTab, CommercialTab, ProgressTab } from './orderBookTabsPorted.js';
import ProjectBomTab from './ProjectBomTab.js';
import '../../pages-css/OrderBookDetail.css';
import '../../pages-css/Projects.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const getStatusColor = (s) => ({
  NOT_STARTED: '#64748b', PLANNING: '#f59e0b', IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444',
}[s] || '#94a3b8');
const statusLabel = (s) => (s ? String(s).replace(/_/g, ' ') : '—');
const progressColor = (s) => (s === 'COMPLETED' ? '#22c55e' : s === 'ON_HOLD' ? '#f59e0b' : '#3b82f6');
const groupPillClass = (g) => {
  const G = String(g || '').toUpperCase();
  if (G.includes('EPC')) return 'pl-group-pill pl-group-pill--epc';
  if (G.includes('IOT')) return 'pl-group-pill pl-group-pill--iot';
  if (G.includes('CBG')) return 'pl-group-pill pl-group-pill--cbg';
  return 'pl-group-pill';
};
const fmtMoney = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

// Scope before BOM: technical scope is decided first, then BOM is allocated under
// each scope line (mirrors the Leads-Enquire flow). Financials/Progress unchanged.
const TABS = [
  { k: 'overview',   l: 'Overview' },
  { k: 'scope',      l: 'Scope / SOW' },
  { k: 'bom',        l: 'BOM / BOQ' },
  { k: 'financials', l: 'Financials' },
  { k: 'progress',   l: 'Progress & Timeline' },
];

const ProjectDetailPage = () => {
  const { projectUniqueId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [linkedOrderBookId, setLinkedOrderBookId] = useState(null);
  const [linkedOrderBook, setLinkedOrderBook] = useState(null);

  const authHeaders = useMemo(
    () => ({ 'User-Id': String(user?.id || ''), 'User-Role': String(user?.role || '') }),
    [user]
  );

  // ── Header fetch ────────────────────────────────────────────────────────────
  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.getProject(projectUniqueId);
      // Endpoint may return the entity directly or wrapped in { data }.
      setProject(data?.data ? data.data : data);
    } catch (err) {
      showError(err.message || 'Failed to load project');
      setProject(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUniqueId]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => { setActiveTab('overview'); }, [projectUniqueId]);

  // ── Resolve the linked order book (for the "View Order Book →" link) ─────────
  // The Order Book list rows carry `projectId`; find the one matching this
  // project and deep-link to /order-book?view=<id> (OrderBook.js opens detail
  // via ?view=). Degrades silently — the link only renders when one is found.
  useEffect(() => {
    if (!projectUniqueId || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/order-book/getAll?page=0&size=1000`, {
          credentials: 'include', headers: authHeaders,
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = data?.data || [];
        const match = list.find(o => String(o.projectId) === String(projectUniqueId));
        if (cancelled || !match) return;
        setLinkedOrderBookId(match.id);
        // Fetch the full order book so the Overview tab can show the commercial
        // details / line items / site location that live on it (the project_*
        // tables are the future home; the linked order book is the source today).
        try {
          const obRes = await fetch(`${API_BASE_URL}/order-book/${match.id}`, {
            credentials: 'include', headers: authHeaders,
          });
          if (obRes.ok) {
            const obData = await obRes.json();
            if (!cancelled) setLinkedOrderBook(obData?.data ? obData.data : obData);
          } else if (!cancelled) {
            setLinkedOrderBook(match); // fall back to the list row
          }
        } catch {
          if (!cancelled) setLinkedOrderBook(match);
        }
      } catch { /* non-fatal: link/overview data just won't render */ }
    })();
    return () => { cancelled = true; };
  }, [projectUniqueId, user?.id, authHeaders]);

  // ── Project-shaped shim for the ported tab components ───────────────────────
  const obShim = useMemo(() => {
    if (!project) return null;
    return {
      ...project,
      id: project.projectUniqueId || projectUniqueId,
      orderTitle: project.projectName,
      subGroupName: project.subGroupName,
    };
  }, [project, projectUniqueId]);

  if (loading) return <div className="obd-page"><CrmPreloader /></div>;

  if (!project) {
    return (
      <div className="obd-page">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <button
          onClick={() => navigate('/projects')}
          style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', padding: '8px 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} /> Back to Projects
        </button>
        <div className="pl-empty">Project not found.</div>
      </div>
    );
  }

  // Progress = TECHNICAL (physical), matching the Project Dashboard. Falls back to the
  // stored progress_percentage (override / financial) only when there's no scope yet.
  const techPct = project.physicalProgressPct != null
    ? Number(project.physicalProgressPct)
    : Number(project.progressPercentage || 0);
  const pct = Math.min(100, Math.max(0, techPct));
  const finPct = Math.min(100, Math.max(0, Number(project.financialProgressPct || 0)));

  return (
    <div className="obd-page">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Back button — plain text, no border */}
      <button
        onClick={() => navigate('/projects')}
        style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', padding: '8px 0', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
      >
        <ArrowLeft size={16} /> Back to Projects
      </button>

      {/* Header card */}
      <div className="obd-header-card">
        <div className="obd-header-main">
          <h1 className="obd-title">{project.projectName || project.projectUniqueId}</h1>
          <div className="obd-subline" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              className="pl-status-badge"
              style={{ background: getStatusColor(project.status) + '22', color: getStatusColor(project.status) }}
            >
              {statusLabel(project.status)}
            </span>
            {project.groupName && <span className={groupPillClass(project.groupName)}>{project.groupName}</span>}
            {project.customerName && <span className="obd-chip">{project.customerName}</span>}
          </div>
        </div>

        {/* "View Order Book →" — subtle secondary link, top-right */}
        {linkedOrderBookId && (
          <button
            className="pd-secondary-link"
            onClick={() => navigate(`/order-book?view=${linkedOrderBookId}`)}
          >
            View Order Book →
          </button>
        )}

        {/* Metric strip */}
        <div className="pd-metric-strip" style={{ flexBasis: '100%' }}>
          <div className="pd-metric"><label>Project ID</label><span>{project.projectUniqueId}</span></div>
          <div className="pd-metric"><label>Budget</label><span>{fmtMoney(project.budget)}</span></div>
          <div className="pd-metric"><label>Timeline</label><span>{fmtDate(project.startDate)} → {fmtDate(project.endDate)}</span></div>
          <div className="pd-metric pd-metric--progress">
            <label>Progress</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', width: 24 }}>Tech</span>
                <div className="pl-progress" style={{ flex: 1, minWidth: 90 }}><div className="pl-progress-fill" style={{ width: `${pct}%`, background: progressColor(project.status) }} /></div>
                <span className="pl-progress-pct">{pct}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', width: 24 }}>Fin</span>
                <div className="pl-progress" style={{ flex: 1, minWidth: 90 }}><div className="pl-progress-fill" style={{ width: `${finPct}%`, background: '#8b5cf6' }} /></div>
                <span className="pl-progress-pct">{finPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="obd-tabbar">
        {TABS.map(t => (
          <button
            key={t.k}
            className={`obd-tab${activeTab === t.k ? ' active' : ''}`}
            onClick={() => setActiveTab(t.k)}
          >{t.l}</button>
        ))}
      </div>

      <div className="obd-tab-body">
        {activeTab === 'overview'   && (
          <ProjectOverviewTab
            project={project}
            projectUniqueId={project.projectUniqueId || projectUniqueId}
            linkedOrderBookId={linkedOrderBookId}
            linkedOrderBook={linkedOrderBook}
            authHeaders={authHeaders}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
        {activeTab === 'scope'      && <ProjectScopeTab      orderBook={obShim} authHeaders={authHeaders} showSuccess={showSuccess} showError={showError} />}
        {activeTab === 'bom'        && <ProjectBomTab        projectUniqueId={project.projectUniqueId || projectUniqueId} project={obShim} currentUser={user} showSuccess={showSuccess} showError={showError} />}
        {activeTab === 'financials' && <ProjectFinancialsTab orderBook={obShim} authHeaders={authHeaders} showSuccess={showSuccess} showError={showError} />}
        {activeTab === 'progress'   && <ProjectProgressTab   orderBook={obShim} authHeaders={authHeaders} showError={showError} />}
      </div>
    </div>
  );
};

// ── OVERVIEW TAB — project-centric (own component; mirrors the OB overview
//    layout: Project Details card + Line Items + Site Location map). Reads from
//    the project endpoints, falling back to the linked order book for data that
//    still lives there today (line items / site location / PO file). ───────────
const ProjectOverviewTab = ({ project, projectUniqueId, linkedOrderBookId, linkedOrderBook, authHeaders, showSuccess, showError }) => {
  const p = project || {};
  const groupName = p.groupName || p.subGroup?.group?.groupName || p.group_id || p.groupId || '';
  const customer  = p.customerName || p.customerCode || p.customerId || p.customer_id || '';
  const pct = Math.min(100, Math.max(0, p.physicalProgressPct != null ? Number(p.physicalProgressPct) : Number(p.progressPercentage || 0)));
  const finPct = Math.min(100, Math.max(0, Number(p.financialProgressPct || 0)));
  const capacity = p.capacityValue != null && p.capacityValue !== ''
    ? `${p.capacityValue}${p.capacityUnit ? ' ' + p.capacityUnit : ''}` : '';

  // ── Line items — project-owned first, fall back to the linked order book ────
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Always returns an ARRAY. Endpoints differ in shape: the order-book items
    // endpoint sends { data: [...] } while the project one sends
    // { data: { items: [...] } } — so dig one level for `.items`/`.data`.
    const pick = (o) => {
      if (Array.isArray(o)) return o;
      if (o && typeof o === 'object') return o.items ?? o.data ?? null;
      return null;
    };
    const tryFetch = async (url) => {
      try {
        const res = await fetch(url, { credentials: 'include', headers: authHeaders });
        if (!res.ok) return [];
        const data = await res.json();
        let raw = pick(data);
        if (!Array.isArray(raw)) raw = pick(raw);
        return Array.isArray(raw) ? raw : [];
      } catch { return []; }
    };
    (async () => {
      setItemsLoading(true);
      let list = projectUniqueId
        ? await tryFetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectUniqueId)}/items`) : [];
      if (list.length === 0 && linkedOrderBookId) {
        list = await tryFetch(`${API_BASE_URL}/order-book/${linkedOrderBookId}/items`);
      }
      if (!cancelled) { setItems(Array.isArray(list) ? list : []); setItemsLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUniqueId, linkedOrderBookId]);

  // ── Site location — load project scope, fall back to linked OB; save to project ─
  const [siteLocation, setSiteLocation] = useState('');
  const [siteLat, setSiteLat] = useState('');
  const [siteLng, setSiteLng] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const readScope = async (url) => {
      try {
        const res = await fetch(url, { credentials: 'include', headers: authHeaders });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data?.scope || data?.scope || null;
      } catch { return null; }
    };
    (async () => {
      let s = projectUniqueId
        ? await readScope(`${API_BASE_URL}/projects/${encodeURIComponent(projectUniqueId)}/scope`) : null;
      if ((!s || (!s.siteLocation && s.siteLat == null)) && linkedOrderBookId) {
        const obS = await readScope(`${API_BASE_URL}/order-book/${linkedOrderBookId}/scope`);
        if (obS && (obS.siteLocation || obS.siteLat != null)) s = obS;
      }
      if (!cancelled && s) {
        setSiteLocation(s.siteLocation || '');
        setSiteLat(s.siteLat == null ? '' : String(s.siteLat));
        setSiteLng(s.siteLng == null ? '' : String(s.siteLng));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUniqueId, linkedOrderBookId]);

  const saveLocation = async () => {
    if (!projectUniqueId) { showError && showError('No project to save location on'); return; }
    setSavingLoc(true);
    try {
      const body = {
        siteLocation: siteLocation || null,
        siteLat: siteLat === '' || siteLat == null ? null : Number(siteLat),
        siteLng: siteLng === '' || siteLng == null ? null : Number(siteLng),
      };
      const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectUniqueId)}/site-location`, {
        method: 'PATCH', credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.success) { showSuccess && showSuccess('Site location saved'); }
      else { showError && showError(data?.message || 'Failed to save site location'); }
    } catch { showError && showError('Failed to save site location'); }
    finally { setSavingLoc(false); }
  };

  // ── PO file (lives on the linked order book) ────────────────────────────────
  const poFileName = linkedOrderBook?.poFileName;
  // ── PO file viewer modal (preview PDF/image in-app; download fallback) ──────
  const [showViewer, setShowViewer] = useState(false);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);
  const viewerBlobRef = useRef(null);
  const poExt = (poFileName || '').split('.').pop().toLowerCase();
  const isPdf = poExt === 'pdf';
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(poExt);
  const poIcon = isPdf ? <FaFilePdf /> : isImg ? <FaFileImage /> : <FaFileAlt />;

  const fetchPoBlob = async (forceDownload) => {
    const url = `${API_BASE_URL}/order-book/${linkedOrderBookId}/download-po${forceDownload ? '?forceDownload=true' : ''}`;
    const res = await fetch(url, { credentials: 'include', headers: authHeaders });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return res.blob();
  };

  const openViewer = async () => {
    if (viewerBlobRef.current) { URL.revokeObjectURL(viewerBlobRef.current); viewerBlobRef.current = null; }
    setViewerUrl('');
    setViewerLoading(true);
    setShowViewer(true);
    try {
      const blob = await fetchPoBlob(false);
      const blobUrl = URL.createObjectURL(blob);
      viewerBlobRef.current = blobUrl;
      setViewerUrl(blobUrl);
    } catch {
      showError && showError('Could not load the file. Try downloading it instead.');
      setShowViewer(false);
    } finally { setViewerLoading(false); }
  };

  const closeViewer = () => {
    setShowViewer(false);
    if (viewerBlobRef.current) { URL.revokeObjectURL(viewerBlobRef.current); viewerBlobRef.current = null; }
    setViewerUrl('');
  };

  const downloadPo = async () => {
    if (!linkedOrderBookId) return;
    try {
      const blob = await fetchPoBlob(true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = poFileName || 'attachment';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { showError && showError('Failed to download the PO file'); }
  };

  useEffect(() => () => { if (viewerBlobRef.current) URL.revokeObjectURL(viewerBlobRef.current); }, []);

  // Latest items first (descending by id, then line number).
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (Number(b.id || b.lineNo || 0)) - (Number(a.id || a.lineNo || 0))),
    [items]
  );

  return (
    <>
    <div className="obd-grid">
      {/* Project Details */}
      <div className="obd-card">
        <h4 className="obd-card-title">Project Details</h4>
        <div className="obd-kv-grid">
          <div><label>Project ID</label><span style={{ fontFamily: 'monospace' }}>{p.projectUniqueId || '-'}</span></div>
          <div><label>Status</label><span>
            <span className="pl-status-badge" style={{ background: getStatusColor(p.status) + '22', color: getStatusColor(p.status) }}>{statusLabel(p.status)}</span>
          </span></div>
          <div><label>Group</label><span>{groupName ? <span className={groupPillClass(groupName)}>{groupName}</span> : '-'}</span></div>
          <div><label>Sub Group</label><span>{p.subGroupName || '-'}</span></div>
          <div><label>Customer</label><span>{customer || '-'}</span></div>
          <div><label>Location</label><span>{p.location || '-'}</span></div>
          <div><label>Budget</label><span>{fmtMoney(p.budget)}</span></div>
          <div><label>Capacity</label><span>{capacity || '-'}</span></div>
          <div><label>Start Date</label><span>{fmtDate(p.startDate)}</span></div>
          <div><label>End Date</label><span>{fmtDate(p.endDate)}</span></div>
          <div><label>Assigned To</label><span>{p.assignedTo || '-'}</span></div>
          <div>
            <label>Progress</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', width: 24 }}>Tech</span>
                <div className="pl-progress" style={{ flex: 1, maxWidth: 120 }}><div className="pl-progress-fill" style={{ width: `${pct}%`, background: progressColor(p.status) }} /></div>
                <span className="pl-progress-pct">{pct}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', width: 24 }}>Fin</span>
                <div className="pl-progress" style={{ flex: 1, maxWidth: 120 }}><div className="pl-progress-fill" style={{ width: `${finPct}%`, background: '#8b5cf6' }} /></div>
                <span className="pl-progress-pct">{finPct}%</span>
              </div>
            </div>
          </div>
        </div>
        {p.description && <p className="obd-desc">{p.description}</p>}
        {poFileName && (
          <div className="obd-card-actions">
            <button className="obd-btn obd-btn--ghost" onClick={openViewer}>{poIcon} View PO File</button>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="obd-card obd-card--wide">
        <h4 className="obd-card-title">Line Items</h4>
        {itemsLoading ? <div className="obd-empty">Loading items…</div> : (
          sortedItems.length === 0 ? <div className="obd-empty">No items on this project.</div> : (
            <div className="obd-table-wrap">
              <table className="obd-table">
                <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Line Total</th></tr></thead>
                <tbody>
                  {sortedItems.map((it, i) => (
                    <tr key={it.id || i}>
                      <td>{it.lineNo || i + 1}</td>
                      <td>{it.itemName}{it.specification ? <span className="obd-spec"> — {it.specification}</span> : null}</td>
                      <td>{Number(it.quantity || 0)}</td>
                      <td>{it.unit || '-'}</td>
                      <td>{fmtMoney(it.unitPrice)}</td>
                      <td>{fmtMoney(it.lineTotal != null ? it.lineTotal : (Number(it.quantity || 0) * Number(it.unitPrice || 0)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Site Location */}
      <div className="obd-card obd-card--wide">
        <div className="obd-card-head">
          <h4 className="obd-card-title">Site Location</h4>
          <button className="obd-btn obd-btn--primary" onClick={saveLocation} disabled={savingLoc}>
            <Save size={14} /> {savingLoc ? 'Saving…' : 'Save Location'}
          </button>
        </div>
        <LocationPicker
          className="obd-field obd-field--full"
          address={siteLocation}
          lat={siteLat}
          lng={siteLng}
          onChange={({ address, lat, lng }) => {
            if (address !== undefined) setSiteLocation(address);
            if (lat !== undefined) setSiteLat(lat == null ? '' : String(lat));
            if (lng !== undefined) setSiteLng(lng == null ? '' : String(lng));
          }}
          showError={showError}
        />
      </div>
    </div>

    {showViewer && (
      <div className="obd-fv-overlay" onClick={closeViewer}>
        <div className="obd-fv-modal" onClick={e => e.stopPropagation()}>
          <div className="obd-fv-header">
            <div className="obd-fv-title" title={poFileName}>
              {poIcon}<span>{poFileName || 'Attached File'}</span>
            </div>
            <div className="obd-fv-controls">
              <button type="button" className="obd-btn obd-btn--ghost" onClick={downloadPo} title="Download">
                <FaFileDownload /> Download
              </button>
              <a className="obd-btn obd-btn--ghost" href={viewerUrl || '#'} target="_blank" rel="noopener noreferrer"
                 title="Open in new tab"
                 style={{ pointerEvents: viewerUrl ? 'auto' : 'none', opacity: viewerUrl ? 1 : 0.5 }}>
                <FaExternalLinkAlt /> Open in new tab
              </a>
              <button className="obd-fv-close" onClick={closeViewer}>×</button>
            </div>
          </div>
          <div className="obd-fv-body">
            {viewerLoading && <div className="obd-fv-loading">Loading file…</div>}
            {!viewerLoading && isPdf && viewerUrl && (
              <iframe src={viewerUrl} title={poFileName} className="obd-fv-iframe" />
            )}
            {!viewerLoading && isImg && viewerUrl && (
              <div className="obd-fv-img-wrap"><img src={viewerUrl} alt={poFileName} className="obd-fv-img" /></div>
            )}
            {!viewerLoading && !isPdf && !isImg && viewerUrl && (
              <div className="obd-fv-unsupported">
                {poIcon}
                <p>This file type can't be previewed in the browser.</p>
                <button type="button" className="obd-btn obd-btn--primary" onClick={downloadPo}>
                  <FaFileDownload /> Download to View
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// ── Distinct project-named wrappers around the ported editable tabs ──────────
// (BOM now uses the dedicated ProjectBomTab component imported above, which groups
//  materials under each scope line — no longer the ported flat BomTab.)
const ProjectScopeTab      = (props) => <TechnicalTab {...props} />;
const ProjectFinancialsTab = (props) => <CommercialTab {...props} />;
const ProjectProgressTab   = (props) => <ProgressTab {...props} />;

export default ProjectDetailPage;
