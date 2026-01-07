// App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar.js';
import Sidebar from './components/sidebar.js';
import Dashboard from './Pages/Dashboard.js';
import Dashboardtabs from "./Pages/Dashboard-Sales-procurement.js"
import Leads from "./Pages/Leads-Enquire.js";
import Proposals from "./Pages/Proposals.js";
import Quatations from "./Pages/Quatations.js";
import ProcurementQuatations from "./Pages/Procurement-Quatation-Recieved.js"
import Invoices from "./Pages/Invoices.js";
import Client_dashboard from "./Pages/Client-dashboard.js";
import Customer_dashboard from "./Pages/Sales-Customer.js";

import Follow_up from "./Pages/Follow-ups.js";
import Analytics from "./Pages/Analytics.js";
import Procurement from "./Pages/Procurement-Vendor-Management.js";
import Documents from "./Pages/Documents.js";
import Login from "./Pages/Login.js";
import Profile from "./Pages/Profile.js";
import SalesOrder from "./Pages/Sales-Order.js";
import PurchaseOrders from './Pages/PurchaseOrders.js';
import BillsRecieved from "./Pages/Bills-Recieved.js";
import Reports from "./Pages/Reports.js";
import SolarProfile from "./Pages/Solarproposaleditor.js";
import Users from "./Pages/UsersPage.js";
import Addropdownitems from "./Pages/AddNewDropdownItems.js";
import './App.css';
import SessionManager from './components/SessionManager.js';
import NewRolePermissions from './Pages/NewRolePermissions.js'
function AppWrapper() {
  const location = useLocation();

  // Hide navbar & sidebar on login page
  const hideShell = location.pathname === "/login" || location.pathname === "/";

  return <AppShell hideShell={hideShell} />;
}

function AppShell({ hideShell }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const [collapsed, setCollapsed] = useState(true); 

  // restore collapsed state from localStorage (optional)
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) setCollapsed(JSON.parse(saved));
  }, []);

  // collapse/expand
  const toggleCollapse = () => {
    setCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem("sidebarCollapsed", JSON.stringify(newVal));
      return newVal;
    });
  };

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>
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
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Login />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboardtabs />
            </ProtectedRoute>
          } />
          
          <Route path="/sales/leads" element={
            <ProtectedRoute>
              <Leads />
            </ProtectedRoute>
          } />
          
          <Route path="/sales/proposals" element={
            <ProtectedRoute>
              <Proposals />
            </ProtectedRoute>
          } />
          
          <Route path="/procurement/quotations" element={
            <ProtectedRoute>
              <Quatations />
            </ProtectedRoute>
          } />
          
          <Route path="/procurement/procurementquatations" element={
            <ProtectedRoute>
              <ProcurementQuatations />
            </ProtectedRoute>
          } />

          <Route path="/sales/invoices" element={
            <ProtectedRoute>
              <Invoices />
            </ProtectedRoute>
          } />
          
          <Route path="/sales/clients" element={
            <ProtectedRoute>
              <Customer_dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/sales/SalesOrder" element={
            <ProtectedRoute>
              <SalesOrder />
            </ProtectedRoute>
          } />
          
          <Route path="/sales/followups" element={
            <ProtectedRoute>
              <Follow_up />
            </ProtectedRoute>
          } />
          
          <Route path="/procurement/vendors" element={
            <ProtectedRoute>
              <Procurement />
            </ProtectedRoute>
          } />
          
          <Route path="/procurement/purchaseorders" element={
            <ProtectedRoute>
              <PurchaseOrders />
            </ProtectedRoute>
          } />
          
          <Route path="/procurement/billsrecieved" element={
            <ProtectedRoute>
              <BillsRecieved />
            </ProtectedRoute>
          } />

          <Route path="/documents" element={
            <ProtectedRoute>
              <Documents />
            </ProtectedRoute>
          } />
          
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <div className="page-container"><h2>Admin Settings Page</h2></div>
            </ProtectedRoute>
          } />
          
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          
          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          
          <Route path="/solarprofile" element={
            <ProtectedRoute>
              <SolarProfile />
            </ProtectedRoute>
          } />
          
          <Route path="/users" element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="/officeuse/addgroupproject" element={
            <ProtectedRoute>
              <Addropdownitems />
            </ProtectedRoute>
          } />
          <Route path="/officeuse/roles-permissions" element={
            <ProtectedRoute>
              <NewRolePermissions />
            </ProtectedRoute>
          } />
         
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppWrapper />
      </Router>
    </AuthProvider>
  );
}
