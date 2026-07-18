// src/Pages/LoginActivityMonitor.js
// LOGIN ACTIVITY MODULE — Office Use → Login & Activity Monitor.
//
// Dashboard cards, 7-day charts, filter bar, and four tabs:
//   Login History | Active Sessions | Activity Timeline | Archived Data
// The Archived tab appears only for ADMIN / SUPERADMIN and queries the
// archive tables only when it is opened (lazy fetch, as agreed).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import * as XLSXBase from "xlsx";
import { useAuth } from "../hooks/useAuth";
import { loginActivityApi } from "../services/loginActivityApi";
import UserDetailsDrawer from "../components/LoginActivity/UserDetailsDrawer";
import useToast from "../hooks/useToast";
import ToastContainer from "../components/Notification_Toast/ToastContainer";
import useConfirmationModal from "../components/HandleConfirmationModal";
import ConfirmationModal from "../components/ConfirmationModal";
import ActivityDetailModal from "../components/LoginActivity/ActivityDetailModal";
import "../pages-css/LoginActivityMonitor.css";

const DEVICE_ICON = { MOBILE: "📱", TABLET: "📱", LAPTOP: "💻", DESKTOP: "🖥️" };
const DEVICE_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];
const EXPORT_LIMIT = 5000;

const TABS = [
  { key: "logins", label: "Login History" },
  { key: "sessions", label: "Active Sessions" },
  { key: "activities", label: "Activity Timeline" },
  { key: "archive", label: "Archived Data", adminOnly: true },
];

const EMPTY_FILTERS = {
  userId: "", dateFrom: "", dateTo: "", status: "ALL", deviceType: "ALL",
  browser: "", os: "", city: "", module: "ALL", operation: "ALL", search: "",
};

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtDuration(sec) {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function statusBadge(status) {
  if (status === "SUCCESS" || status === "ACTIVE") return "la-badge-success";
  if (status === "EXPIRED" || status === "LOGGED_OUT") return "la-badge-warning";
  if (!status) return "la-badge-muted";
  return "la-badge-danger"; // FAILED_*, EVICTED, ADMIN_TERMINATED, FAILURE
}

export default function LoginActivityMonitor() {
  const { user } = useAuth();
  const role = (user?.role || "").toUpperCase();
  const isAdmin = role === "SUPERADMIN" || role === "ADMIN";

  const [tab, setTab] = useState("logins");
  const [archiveSource, setArchiveSource] = useState("logins"); // inside Archived tab

  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // The search box keeps its own state and is copied into filters only
  // 400ms after typing pauses — one request per search, not per keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [sessions, setSessions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawerUserId, setDrawerUserId] = useState(null);
  const [detailActivity, setDetailActivity] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Project-standard notifications — no browser alert()/confirm() popups
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { confirmModal, showConfirmation } = useConfirmationModal();

  // Debounce: commit search text into filters after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) =>
        f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() }
      );
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isArchiveTab = tab === "archive";
  const dataKind = isArchiveTab ? archiveSource : tab; // "logins" | "activities" | "sessions"

  // ── Data loading ──────────────────────────────────────────────────────
  const loadStats = useCallback(() => {
    loginActivityApi.dashboardStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  const buildParams = useCallback((forExport = false) => ({
    userId: filters.userId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    status: filters.status,
    deviceType: filters.deviceType,
    browser: filters.browser || undefined,
    os: filters.os || undefined,
    city: filters.city || undefined,
    module: filters.module,
    operation: filters.operation,
    search: filters.search || undefined,
    page: forExport ? 1 : page,
    size: forExport ? EXPORT_LIMIT : pageSize,
    sortBy: sortBy || undefined,
    sortDir,
    archive: isArchiveTab,
  }), [filters, page, pageSize, sortBy, sortDir, isArchiveTab]);

  // Every request is stamped; only the most recent one may update the
  // table. Without this, a slower response for an OLD query (e.g. "Ad")
  // could arrive after the "Admin" response and overwrite the filtered
  // rows with unfiltered ones — the bug that made search look broken.
  const requestSeq = useRef(0);

  const loadTable = useCallback(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError("");
    const params = buildParams();
    const call = dataKind === "activities"
      ? loginActivityApi.activities(params)
      : loginActivityApi.loginHistory(params);
    call
      .then((res) => {
        if (seq !== requestSeq.current) return; // superseded by a newer request
        setRows(res.content || []);
        setTotalPages(res.totalPages || 0);
        setTotalElements(res.totalElements || 0);
      })
      .catch((e) => {
        if (seq !== requestSeq.current) return;
        setError(e.message);
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [buildParams, dataKind]);

  const loadSessions = useCallback(() => {
    setLoading(true);
    setError("");
    loginActivityApi.activeSessions()
      .then((list) => {
        const arr = Array.isArray(list) ? [...list] : [];
        // "You" (this browser's session) is always shown on top,
        // like on the Profile page.
        arr.sort((a, b) => (b.currentSession === true) - (a.currentSession === true));
        setSessions(arr);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadStats, [loadStats]);

  useEffect(() => {
    if (dataKind === "sessions") loadSessions();
    else loadTable();
  }, [dataKind, loadTable, loadSessions]);

  // Reset paging when filters, tab, archive source or page size change
  useEffect(() => { setPage(1); }, [filters, tab, archiveSource, pageSize]);

  // ── Actions ───────────────────────────────────────────────────────────
  const setF = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
  };

  const terminateSession = async (id) => {
    const confirmed = await showConfirmation({
      title: "Terminate Session",
      message: "The user on that device will be signed out immediately. Continue?",
      type: "confirm",
      confirmText: "Terminate",
    });
    if (!confirmed) return;
    try {
      await loginActivityApi.terminateSession(id);
      showSuccess("Session terminated");
      loadSessions();
      loadStats();
    } catch (e) {
      showError(e.message);
    }
  };

  // ── Export (CSV / Excel / PDF) — respects the current filters ─────────
  const fetchExportRows = async () => {
    if (dataKind === "sessions") return sessions;
    const params = buildParams(true);
    const res = dataKind === "activities"
      ? await loginActivityApi.activities(params)
      : await loginActivityApi.loginHistory(params);
    return res.content || [];
  };

  const exportColumns = useMemo(() => {
    if (dataKind === "sessions") {
      return [
        ["User", (r) => r.username], ["Employee ID", (r) => r.employeeId],
        ["Login At", (r) => fmtWhen(r.loginAt)], ["Last Seen", (r) => fmtWhen(r.lastSeenAt)],
        ["Device", (r) => r.deviceType], ["Browser", (r) => r.browser],
        ["OS", (r) => r.operatingSystem], ["IP", (r) => r.ipAddress],
        ["City", (r) => r.city], ["Status", (r) => r.status],
      ];
    }
    if (dataKind === "activities") {
      return [
        ["Time", (r) => fmtWhen(r.createdAt)], ["User", (r) => r.username],
        ["Module", (r) => r.module], ["Operation", (r) => r.operation],
        ["Description", (r) => r.description], ["Status", (r) => r.status],
        ["Failure Reason", (r) => r.failureReason], ["Page", (r) => r.page],
        ["IP", (r) => r.ipAddress], ["Device", (r) => r.deviceType],
        ["Browser", (r) => r.browser], ["OS", (r) => r.operatingSystem],
      ];
    }
    return [
      ["User", (r) => r.username || r.usernameEntered], ["Employee ID", (r) => r.employeeId],
      ["Login At", (r) => fmtWhen(r.loginAt)], ["Logout At", (r) => fmtWhen(r.logoutAt)],
      ["Duration", (r) => fmtDuration(r.sessionDurationSec)], ["Status", (r) => r.loginStatus],
      ["Failure Reason", (r) => r.failureReason], ["Device", (r) => r.deviceType],
      ["Device Name", (r) => r.deviceName], ["Browser", (r) => `${r.browser || ""} ${r.browserVersion || ""}`.trim()],
      ["OS", (r) => r.operatingSystem], ["IP", (r) => r.ipAddress],
      ["City", (r) => r.city], ["State", (r) => r.state], ["Country", (r) => r.country],
      ["Time Zone", (r) => r.timeZone], ["Resolution", (r) => r.screenResolution],
    ];
  }, [dataKind]);

  const toMatrix = (data) => {
    const header = exportColumns.map(([label]) => label);
    const body = data.map((r) => exportColumns.map(([, fn]) => fn(r) ?? ""));
    return [header, ...body];
  };

  const exportName = () =>
    `${isArchiveTab ? "archived_" : ""}${dataKind}_${new Date().toISOString().slice(0, 10)}`;

  const doExport = async (kind) => {
    setExporting(true);
    setError("");
    try {
      const data = await fetchExportRows();
      const matrix = toMatrix(data);

      if (kind === "xlsx") {
        // Prefer the styled build already present in package.json
        // (xlsx-js-style — same API as SheetJS). If it is ever removed,
        // fall back to plain xlsx: the export still works, just unstyled,
        // because plain SheetJS silently ignores the cell.s style objects.
        let XLSX = XLSXBase;
        try {
          XLSX = await import("xlsx-js-style");
        } catch { /* styled build not installed — plain export */ }

        const ws = XLSX.utils.aoa_to_sheet(matrix);

        // ── Styling ─────────────────────────────────────────────────
        const headerStyle = {
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
          fill: { fgColor: { rgb: "2563EB" } },           // brand blue
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "1E40AF" } },
            bottom: { style: "thin", color: { rgb: "1E40AF" } },
            left: { style: "thin", color: { rgb: "1E40AF" } },
            right: { style: "thin", color: { rgb: "1E40AF" } },
          },
        };
        const cellBorder = {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        };
        const range = XLSX.utils.decode_range(ws["!ref"]);
        for (let R = range.s.r; R <= range.e.r; R++) {
          for (let C = range.s.c; C <= range.e.c; C++) {
            const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
            if (!cell) continue;
            if (R === 0) {
              cell.s = headerStyle;
            } else {
              cell.s = {
                font: { sz: 10 },
                border: cellBorder,
                // zebra striping for readability
                fill: R % 2 === 0 ? { fgColor: { rgb: "F3F6FF" } } : undefined,
                alignment: { vertical: "center" },
              };
            }
          }
        }
        // Column widths sized to content
        ws["!cols"] = matrix[0].map((_, C) => ({
          wch: Math.min(
            40,
            Math.max(10, ...matrix.map((row) => String(row[C] ?? "").length + 2))
          ),
        }));
        ws["!rows"] = [{ hpt: 22 }]; // taller header row

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, `${exportName()}.xlsx`);
      } else if (kind === "pdf") {
        const { jsPDF } = window.jspdf || (await import("jspdf"));
        // A4 landscape: 841.89 × 595.28 pt
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const PAGE_W = doc.internal.pageSize.getWidth();
        const PAGE_H = doc.internal.pageSize.getHeight();
        const MARGIN = 36;
        const cols = Math.min(matrix[0].length, 10); // fit A4 width
        const colWidth = (PAGE_W - MARGIN * 2) / cols;
        const ROW_H = 18;
        const HEADER_H = 22;

        const BLUE = [37, 99, 235];      // #2563EB brand blue
        const DARK = [17, 24, 39];       // #111827
        const ZEBRA = [243, 246, 255];   // #F3F6FF
        const BORDER = [229, 231, 235];  // #E5E7EB

        const drawTitleBar = () => {
          doc.setFillColor(...DARK);
          doc.rect(0, 0, PAGE_W, 42, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(13);
          doc.setFont(undefined, "bold");
          doc.text(
            `Login & Activity Monitor — ${dataKind}${isArchiveTab ? " (archive)" : ""}`,
            MARGIN, 26
          );
          doc.setFont(undefined, "normal");
          doc.setFontSize(9);
          doc.text(new Date().toLocaleString("en-IN"), PAGE_W - MARGIN, 26, { align: "right" });
        };

        const drawHeaderRow = (y) => {
          doc.setFillColor(...BLUE);
          doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, HEADER_H, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont(undefined, "bold");
          matrix[0].slice(0, cols).forEach((h, c) => {
            doc.text(String(h).slice(0, 24), MARGIN + c * colWidth + 4, y + 14);
          });
          doc.setFont(undefined, "normal");
          return y + HEADER_H;
        };

        drawTitleBar();
        let y = drawHeaderRow(56);
        doc.setFontSize(7.5);

        matrix.slice(1).forEach((row, idx) => {
          if (y + ROW_H > PAGE_H - 30) {
            doc.addPage();
            drawTitleBar();
            y = drawHeaderRow(56);
            doc.setFontSize(7.5);
          }
          if (idx % 2 === 1) {                 // zebra stripe
            doc.setFillColor(...ZEBRA);
            doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H, "F");
          }
          doc.setDrawColor(...BORDER);
          doc.line(MARGIN, y + ROW_H, PAGE_W - MARGIN, y + ROW_H);
          doc.setTextColor(31, 41, 55);
          row.slice(0, cols).forEach((cell, c) => {
            let text = String(cell ?? "").slice(0, 30);
            // Status column gets green / red for quick scanning
            const header = String(matrix[0][c]).toLowerCase();
            if (header === "status") {
              const failed = /fail|evict|terminat|lock/i.test(text);
              doc.setTextColor(...(failed ? [185, 28, 28] : [22, 101, 52]));
              doc.setFont(undefined, "bold");
              doc.text(text, MARGIN + c * colWidth + 4, y + 12);
              doc.setFont(undefined, "normal");
              doc.setTextColor(31, 41, 55);
            } else {
              doc.text(text, MARGIN + c * colWidth + 4, y + 12);
            }
          });
          y += ROW_H;
        });

        // page numbers footer
        const pages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(107, 114, 128);
          doc.text(`Page ${i} of ${pages}`, PAGE_W / 2, PAGE_H - 12, { align: "center" });
        }
        doc.save(`${exportName()}.pdf`);
      }

      // The export itself is an auditable event
      loginActivityApi
        .track([{ page: "/officeuse/login-activity", module: "OFFICE_USE" }])
        .catch(() => {});
    } catch (e) {
      showError(`Export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Windowed page numbers: 1 … 4 5 [6] 7 8 … 20
  const pageNumbers = useMemo(() => {
    const nums = [];
    const win = 1; // pages on each side of the current one
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= win) {
        nums.push(i);
      } else if (nums[nums.length - 1] !== "…") {
        nums.push("…");
      }
    }
    return nums;
  }, [page, totalPages]);

  // ── Render helpers ────────────────────────────────────────────────────
  const SortTh = ({ field, children }) => (
    <th className="la-th-sortable" onClick={() => toggleSort(field)}>
      {children}
      {sortBy === field && <span className="la-sort-arrow">{sortDir === "asc" ? " ▲" : " ▼"}</span>}
    </th>
  );

  const userCell = (name, userId) => (
    <button type="button" className="la-user-cell"
            onClick={() => userId && setDrawerUserId(userId)} disabled={!userId}>
      <span className="la-avatar">{initials(name)}</span>
      <span>{name || "Unknown"}</span>
    </button>
  );

  const trendData = (stats?.loginTrend || []).map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" }),
    logins: d.count,
  }));

  const deviceData = (stats?.deviceSplit || []).map((d) => ({
    name: d.deviceType, value: d.count,
  }));

  // ── Page ──────────────────────────────────────────────────────────────
  return (
    <div className="la-page-root">
      {/* Header */}
      <div className="la-page-header">
        <div>
          <div className="la-breadcrumb">Office Use</div>
          <h1 className="la-page-title">Login &amp; Activity Monitor</h1>
        </div>
        <div className="la-header-actions">
          <input
            className="la-input la-search"
            placeholder="Search user, IP, device, city…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <div className="la-export-group">
            <button type="button" className="la-btn la-btn-secondary" disabled={exporting}
                    onClick={() => doExport("xlsx")}>Excel</button>
            <button type="button" className="la-btn la-btn-secondary" disabled={exporting}
                    onClick={() => doExport("pdf")}>PDF</button>
          </div>
        </div>
      </div>

      {error && <div className="la-error">{error}</div>}

      {/* Dashboard cards */}
      <div className="la-cards">
        <StatCard icon="🔑" label="Logins Today" value={stats?.totalLoginsToday} />
        <StatCard icon="🟢" label="Active Sessions" value={stats?.activeSessions} />
        <StatCard icon="🚫" label="Failed Logins" value={stats?.failedLoginsToday} danger />
        <StatCard icon="💻" label="Unique Devices" value={stats?.uniqueDevicesToday} />
        <StatCard icon="📍" label="Unique Locations" value={stats?.uniqueLocationsToday} />
        <StatCard icon="⚡" label="Activities Today" value={stats?.totalActivitiesToday} />
      </div>

      {/* Charts */}
      <div className="la-charts">
        <div className="la-card la-chart-card">
          <h3 className="la-card-title">Logins — last 7 days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} width={30} />
              <Tooltip />
              <Bar dataKey="logins" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="la-card la-chart-card">
          <h3 className="la-card-title">Devices — last 7 days</h3>
          {deviceData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={deviceData} dataKey="value" nameKey="name"
                     innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {deviceData.map((_, i) => (
                    <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="la-empty">No login data yet</div>
          )}
        </div>
        <div className="la-card la-chart-card">
          <h3 className="la-card-title">Most active users today</h3>
          {(stats?.mostActiveUsers || []).map((u, i) => (
            <button type="button" key={u.userId || i} className="la-top-user"
                    onClick={() => u.userId && setDrawerUserId(u.userId)}>
              <span className="la-avatar">{initials(u.username)}</span>
              <span className="la-top-user-name">{u.username || "Unknown"}</span>
              <span className="la-top-user-count">{u.count}</span>
            </button>
          ))}
          {!stats?.mostActiveUsers?.length && <div className="la-empty">No activity yet today</div>}
        </div>
      </div>

      {/* Filter bar */}
      <div className="la-filters">
        <input type="date" className="la-input" value={filters.dateFrom}
               onChange={(e) => setF("dateFrom", e.target.value)} title="From date" />
        <input type="date" className="la-input" value={filters.dateTo}
               onChange={(e) => setF("dateTo", e.target.value)} title="To date" />
        <select className="la-input" value={filters.deviceType}
                onChange={(e) => setF("deviceType", e.target.value)}>
          <option value="ALL">Device: All</option>
          <option value="MOBILE">Mobile</option>
          <option value="LAPTOP">Laptop</option>
          <option value="DESKTOP">Desktop</option>
          <option value="TABLET">Tablet</option>
        </select>
        {dataKind !== "activities" ? (
          <select className="la-input" value={filters.status}
                  onChange={(e) => setF("status", e.target.value)}>
            <option value="ALL">Status: All</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed (any reason)</option>
            <option value="FAILED_INVALID_PASSWORD">Failed — wrong password</option>
            <option value="FAILED_USER_NOT_FOUND">Failed — unknown user</option>
            <option value="FAILED_ACCOUNT_INACTIVE">Failed — inactive account</option>
            <option value="FAILED_ACCOUNT_LOCKED">Failed — locked</option>
          </select>
        ) : (
          <>
            <select className="la-input" value={filters.module}
                    onChange={(e) => setF("module", e.target.value)}>
              <option value="ALL">Module: All</option>
              {["AUTH", "SECURITY", "NAVIGATION", "DASHBOARD", "LEADS", "CUSTOMERS",
                "PROPOSALS", "QUOTATIONS", "INVOICES", "BILLS", "ORDER_BOOK",
                "PROCUREMENT", "INVENTORY", "PROJECTS", "TASKS", "REPORTS", "USERS",
                "ROLES", "NOTIFICATIONS", "SETTINGS", "AI_ASSISTANT", "OFFICE_USE",
                "PROFILE", "GENERAL"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select className="la-input" value={filters.operation}
                    onChange={(e) => setF("operation", e.target.value)}>
              <option value="ALL">Operation: All</option>
              {["LOGIN", "LOGOUT", "VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE",
                "REJECT", "ASSIGN", "STATUS_CHANGE", "EXPORT", "IMPORT", "DOWNLOAD",
                "UPLOAD", "PASSWORD_CHANGE", "ROLE_CHANGE", "PERMISSION_CHANGE",
                "SECURITY_EVENT", "API_FAILURE", "VALIDATION_ERROR"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </>
        )}
        <input className="la-input" placeholder="City" value={filters.city}
               onChange={(e) => setF("city", e.target.value)} />
        <button type="button" className="la-btn la-btn-secondary" onClick={clearFilters}>
          Clear
        </button>
      </div>

      {/* Tabs */}
      <div className="la-tabs">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
          <button key={t.key} type="button"
                  className={`la-tab ${tab === t.key ? "la-tab-active" : ""}`}
                  onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === "sessions" && stats ? ` (${stats.activeSessions})` : ""}
          </button>
        ))}
      </div>

      {/* Archived tab source switch + notice */}
      {isArchiveTab && (
        <div className="la-archive-bar">
          <span className="la-archive-note">
            📦 Archived records (older than the active retention window). Queries may be slower.
          </span>
          <div className="la-archive-switch">
            <button type="button"
                    className={`la-btn la-btn-sm ${archiveSource === "logins" ? "la-btn-primary" : "la-btn-secondary"}`}
                    onClick={() => setArchiveSource("logins")}>
              Login History
            </button>
            <button type="button"
                    className={`la-btn la-btn-sm ${archiveSource === "activities" ? "la-btn-primary" : "la-btn-secondary"}`}
                    onClick={() => setArchiveSource("activities")}>
              Activity Logs
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="la-card la-table-card">
        {loading && <div className="la-loading">Loading…</div>}

        {/* ── Login history table (hot or archive) ─────────────────────── */}
        {!loading && dataKind === "logins" && (
          <div className="la-table-scroll">
            <table className="la-table">
              <thead>
                <tr>
                  <SortTh field="username">User</SortTh>
                  <SortTh field="loginAt">Login Time</SortTh>
                  <SortTh field="logoutAt">Logout</SortTh>
                  <SortTh field="sessionDurationSec">Duration</SortTh>
                  <SortTh field="deviceType">Device</SortTh>
                  <SortTh field="browser">Browser</SortTh>
                  <th>OS</th>
                  <th>IP</th>
                  <SortTh field="city">Location</SortTh>
                  <SortTh field="loginStatus">Status</SortTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.loginStatus !== "SUCCESS" ? "la-row-failed" : ""}>
                    <td>{userCell(r.username || r.usernameEntered, r.userId)}</td>
                    <td>{fmtWhen(r.loginAt)}</td>
                    <td>{fmtWhen(r.logoutAt)}</td>
                    <td>{fmtDuration(r.sessionDurationSec)}</td>
                    <td>{DEVICE_ICON[r.deviceType] || ""} {r.deviceName || r.deviceType || "—"}</td>
                    <td>{r.browser}{r.browserVersion ? ` ${r.browserVersion.split(".")[0]}` : ""}</td>
                    <td>{r.operatingSystem || "—"}</td>
                    <td>{r.ipAddress || "—"}</td>
                    <td>{r.city ? `📍 ${r.city}${r.state ? `, ${r.state}` : ""}` : "—"}</td>
                    <td>
                      <span className={`la-badge ${statusBadge(r.loginStatus)}`}
                            title={r.failureReason || ""}>
                        {r.loginStatus === "SUCCESS" ? "Success"
                          : (r.loginStatus || "").replace("FAILED_", "").replace(/_/g, " ").toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={10} className="la-empty">No records match the current filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Active sessions table ────────────────────────────────────── */}
        {!loading && dataKind === "sessions" && (
          <div className="la-table-scroll">
            <table className="la-table">
              <thead>
                <tr>
                  <th>User</th><th>Login Time</th><th>Last Activity</th><th>Device</th>
                  <th>Browser / OS</th><th>IP</th><th>Location</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {userCell(s.username, s.userId)}
                      {s.currentSession && <span className="la-badge la-badge-info">You</span>}
                    </td>
                    <td>{fmtWhen(s.loginAt)}</td>
                    <td>{fmtWhen(s.lastSeenAt)}</td>
                    <td>{DEVICE_ICON[s.deviceType] || ""} {s.deviceName || s.deviceType || "—"}</td>
                    <td>{s.browser} · {s.operatingSystem}</td>
                    <td>{s.ipAddress || "—"}</td>
                    <td>{s.city ? `📍 ${s.city}` : "—"}</td>
                    <td><span className="la-badge la-badge-success">Active</span></td>
                    <td>
                      {/* No Terminate button for THIS browser's own session —
                          use the normal Logout instead. Other sessions get an
                          instant WebSocket force-logout when terminated. */}
                      {!s.currentSession && (
                        <button type="button" className="la-btn la-btn-danger la-btn-sm"
                                title="Terminate"
                                onClick={() => terminateSession(s.id)}>
                          Terminate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!sessions.length && (
                  <tr><td colSpan={9} className="la-empty">No active sessions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Activity timeline (hot or archive) ───────────────────────── */}
        {!loading && dataKind === "activities" && (
          <div className="la-timeline">
            {rows.map((a) => (
              <button type="button" key={a.id} className="la-timeline-item"
                      onClick={() => setDetailActivity(a)}>
                <span className={`la-dot ${a.status === "SUCCESS" ? "la-dot-success" : "la-dot-danger"}`}></span>
                <div className="la-timeline-body">
                  <div className="la-timeline-desc">
                    {a.description || `${a.module} · ${a.operation}`}
                  </div>
                  <div className="la-timeline-meta">
                    {a.username || "System"} · {a.module} · {a.operation} · {fmtWhen(a.createdAt)}
                    {a.ipAddress ? ` · ${a.ipAddress}` : ""}
                  </div>
                </div>
                <span className={`la-badge ${statusBadge(a.status)}`}>{a.status}</span>
              </button>
            ))}
            {!rows.length && <div className="la-empty">No activities match the current filters</div>}
          </div>
        )}

        {/* Pagination — server-side: only the selected page size is fetched */}
        {dataKind !== "sessions" && totalElements > 0 && (
          <div className="la-pagination">
            <div className="la-pagination-left">
              <span>Rows per page:</span>
              <select
                className="la-input la-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalElements)} of {totalElements} results
              </span>
              <span className="la-page-num">
                Page <b>{page}</b> of <b>{totalPages}</b>
              </span>
            </div>
            <div className="la-pagination-controls">
              <button type="button" className="la-pager-btn" disabled={page <= 1}
                      onClick={() => setPage(1)} title="First page">«</button>
              <button type="button" className="la-pager-btn" disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)} title="Previous page">‹</button>
              {pageNumbers.map((n, i) =>
                n === "…" ? (
                  <span key={`e${i}`} className="la-pager-ellipsis">…</span>
                ) : (
                  <button type="button" key={n}
                          className={`la-pager-btn ${n === page ? "la-pager-active" : ""}`}
                          onClick={() => setPage(n)}>
                    {n}
                  </button>
                )
              )}
              <button type="button" className="la-pager-btn" disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)} title="Next page">›</button>
              <button type="button" className="la-pager-btn" disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)} title="Last page">»</button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer + detail modal */}
      {drawerUserId && (
        <UserDetailsDrawer
          userId={drawerUserId}
          onClose={() => setDrawerUserId(null)}
          onChanged={() => { loadStats(); if (dataKind === "sessions") loadSessions(); }}
        />
      )}
      {detailActivity && (
        <ActivityDetailModal activity={detailActivity} onClose={() => setDetailActivity(null)} />
      )}

      {/* Project-standard confirmation modal + toasts */}
      <ConfirmationModal {...confirmModal} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

function StatCard({ icon, label, value, danger }) {
  return (
    <div className="la-card la-stat-card">
      <div className="la-stat-label">
        <span className="la-stat-icon">{icon}</span> {label}
      </div>
      <div className={`la-stat-value ${danger && value > 0 ? "la-stat-danger" : ""}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}