// App.js
import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation
} from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth.js';
import Navbar from './components/Navbar';
import Sidebar from './components/sidebar';
import SessionManager from './components/SessionManager';

// Pages
import Login from './Pages/Login';
import Dashboardtabs from "./Pages/Dashboard.js";
import Leads from "./Pages/Leads-Enquire";
import Proposals from "./Pages/Proposals";
import Quatations from "./Pages/Quatations";
import ProcurementQuatations from "./Pages/Procurement-Quatation-Recieved";
import Invoices from "./Pages/InvoicesReceiptsPage.js";
import TelecallerLeadsPage from "./Pages/Telecallerleadspage.js";
import Customer_dashboard from "./Pages/Sales-Customer";
import Follow_up from "./Pages/Follow-ups";
import Analytics from "./Pages/Analytics";
import Procurement from "./Pages/Procurement-Vendor-Management";
import Documents from "./Pages/Documents";
import Profile from "./Pages/Profile";
import SalesOrder from "./Pages/Sales-Order";
import PurchaseOrders from './Pages/PurchaseOrders';
import BillsRecieved from "./Pages/BillsRecieptsPage.js";
import Reports from "./Pages/ProjectReports.js";
import SolarProfile from "./Pages/Solarproposaleditor";
import Users from "./Pages/UsersPage";
import Addropdownitems from "./Pages/AddNewDropdownItems";
import NewRolePermissions from './Pages/NewRolePermissions';
import Projectdashboard from "./Pages/ProjectDashboard.js";
import OrderBook from "./Pages/OrderBook.js";
import ProjectCostExpenseManagement from './Pages/ProjectCostExpenseManagement.js';
import NotFound from "./Pages/NotFound";
import TaskManagement from './Pages/TaskManagement.js';
import RoleHierarchyPage from './Pages/RoleHierarchyPage.js';
import './App.css';
import { setupFetchInterceptor } from './utils/setupFetchInterceptor';
import ProjectAccessManager from './Pages/ProjectAccessPage.js';
/* ---------------- APP WRAPPER ---------------- */
setupFetchInterceptor();
function AppWrapper() {
  const location = useLocation();

  const hideShell =
    location.pathname === '/login' ||
    location.pathname === '/';

  if (!hideShell) {
    const knownPaths = [
      '/dashboard', '/sales', '/procurement', '/documents',
      '/analytics', '/profile', '/reports', '/solarprofile', '/follow-ups',
      '/users', '/officeuse', '/project-over-view', '/order-book',
      '/project-cost-expense', '/taskmanagement','/projectaccess'
    ];
    const isKnown = knownPaths.some(p => location.pathname.startsWith(p));
    if (!isKnown) return <NotFound />;
  }

  return <AppShell hideShell={hideShell} />;
}

/* ---------------- APP SHELL ---------------- */


function AppShell({ hideShell }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState(true);

  const { user } = useAuth();
  const userRole = user?.role || null;

  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) setCollapsed(JSON.parse(saved));
  }, []);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem("sidebarCollapsed", JSON.stringify(newVal));
      return newVal;
    });
  };

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>

      {!hideShell && <SessionManager />}

      {!hideShell && (
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
      )}

      {!hideShell && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      )}

      <main className={`main-content ${hideShell ? "fullpage" : ""}`}>
        <Routes>

          {/* ---------- PUBLIC ---------- */}
          <Route path="/"      element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* ---------- PROTECTED ---------- */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboardtabs /></ProtectedRoute>
          } />

          <Route path="/project-over-view" element={
            <ProtectedRoute><Projectdashboard /></ProtectedRoute>
          } />

          <Route path="/follow-ups" element={
            <ProtectedRoute><Follow_up /></ProtectedRoute>
          } />

          <Route path="/reports" element={
            <ProtectedRoute><Reports /></ProtectedRoute>
          } />

          <Route path="/project-cost-expense" element={
            <ProtectedRoute><ProjectCostExpenseManagement /></ProtectedRoute>
          } />

          <Route path="/sales/leads"
            element={
              <ProtectedRoute>
                {userRole === "TELECALLER"
                  ? <TelecallerLeadsPage />
                  : <Leads />}
              </ProtectedRoute>
            }
          />

          <Route path="/sales/clients" element={
            <ProtectedRoute><Customer_dashboard /></ProtectedRoute>
          } />

          <Route path="/order-book" element={
            <ProtectedRoute><OrderBook /></ProtectedRoute>
          } />

          <Route path="/sales/invoices" element={
            <ProtectedRoute><Invoices /></ProtectedRoute>
          } />

          <Route path="/sales/proposals" element={
            <ProtectedRoute><Proposals /></ProtectedRoute>
          } />

          <Route path="/procurement/vendors" element={
            <ProtectedRoute><Procurement /></ProtectedRoute>
          } />

          <Route path="/procurement/quotations" element={
            <ProtectedRoute><ProcurementQuatations /></ProtectedRoute>
          } />

          <Route path="/procurement/purchase-orders" element={
            <ProtectedRoute><PurchaseOrders /></ProtectedRoute>
          } />

          <Route path="/procurement/bills-recieved" element={
            <ProtectedRoute><BillsRecieved /></ProtectedRoute>
          } />

          <Route path="/officeuse/add-group-project" element={
            <ProtectedRoute><Addropdownitems /></ProtectedRoute>
          } />

          <Route path="/officeuse/roles-permissions" element={
            <ProtectedRoute><NewRolePermissions /></ProtectedRoute>
          } />

          {/* ── NEW ──────────────────────────────────────────────────────── */}
          <Route path="/officeuse/role-hierarchy" element={
            <ProtectedRoute><RoleHierarchyPage /></ProtectedRoute>
          } />
          {/* ─────────────────────────────────────────────────────────────── */}

          <Route path="/sales/SalesOrder" element={
            <ProtectedRoute><SalesOrder /></ProtectedRoute>
          } />

          <Route path="/documents" element={
            <ProtectedRoute><Documents /></ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute><Analytics /></ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />

          <Route path="/solarprofile" element={
            <ProtectedRoute><SolarProfile /></ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute><Users /></ProtectedRoute>
          } />

          <Route path="/taskmanagement" element={
            <ProtectedRoute><TaskManagement /></ProtectedRoute>
          } />
          <Route path="/officeuse/projectaccess" element={
            <ProtectedRoute><ProjectAccessManager /></ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

/* ---------------- ROOT APP ---------------- */

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppWrapper />
      </Router>
    </AuthProvider>
  );
}