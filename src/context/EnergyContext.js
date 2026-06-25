// EnergyContext.js — Global state for all Energy SaaS modules v2.0
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  MOCK_ASSETS, MOCK_WORK_ORDERS, MOCK_LOANS, MOCK_COVENANTS,
  INITIAL_ALERTS, generateSCADAReading
} from '../services/energyMockData';

const EnergyContext = createContext(null);
export const ROLES = ['Admin', 'Operator', 'Lender'];

export function EnergyProvider({ children }) {
  // Role
  const [activeRole, setActiveRole] = useState(() => localStorage.getItem('energy_role') || 'Admin');
  const switchRole = (role) => { setActiveRole(role); localStorage.setItem('energy_role', role); };

  // Assets
  const [assets, setAssets] = useState(MOCK_ASSETS);
  const addAsset = useCallback((asset) => {
    setAssets(prev => [{ ...asset }, ...prev]);
  }, []);
  // Accept full object (v2 style) or (id, patch)
  const updateAsset = useCallback((assetOrId, patch) => {
    if (typeof assetOrId === 'string') {
      setAssets(prev => prev.map(a => a.id === assetOrId ? { ...a, ...patch } : a));
    } else {
      setAssets(prev => prev.map(a => a.id === assetOrId.id ? { ...a, ...assetOrId } : a));
    }
  }, []);
  const deleteAsset = useCallback((id) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  // Work Orders
  const [workOrders, setWorkOrders] = useState(MOCK_WORK_ORDERS);
  const addWorkOrder = useCallback((wo) => {
    setWorkOrders(prev => [{ ...wo }, ...prev]);
  }, []);
  const updateWorkOrderStatus = useCallback((id, status) => {
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status } : wo));
  }, []);
  const addWorkOrderUpdate = useCallback((id, note, by) => {
    setWorkOrders(prev => prev.map(wo =>
      wo.id === id ? { ...wo, updates: [...wo.updates, { by, at: new Date().toLocaleString('en-IN'), note }] } : wo
    ));
  }, []);

  // Loans
  const [loans, setLoans] = useState(MOCK_LOANS);
  const addLoan = useCallback((loan) => {
    setLoans(prev => [{ ...loan }, ...prev]);
  }, []);

  // Covenants
  const [covenants, setCovenants] = useState(MOCK_COVENANTS);
  const addCovenant = useCallback((cov) => {
    const ok = parseFloat(cov.currentValue) >= parseFloat(cov.threshold);
    setCovenants(prev => [{ ...cov, status: ok ? 'Compliant' : 'Breached', lastChecked: new Date().toISOString().slice(0,10) }, ...prev]);
  }, []);
  const updateCovenantValue = useCallback((id, currentValue) => {
    setCovenants(prev => prev.map(c => {
      if (c.id !== id) return c;
      const ok = c.condition === '≥' ? parseFloat(currentValue) >= c.threshold : parseFloat(currentValue) <= c.threshold;
      return { ...c, currentValue: parseFloat(currentValue), status: ok ? 'Compliant' : 'Breached', lastChecked: new Date().toISOString().slice(0,10) };
    }));
  }, []);

  // Alerts
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const acknowledgeAlert = useCallback((id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  }, []);
  const addAlert = useCallback((alert) => {
    setAlerts(prev => [{ ...alert, id: alert.id || `ALT-${Date.now()}`, timestamp: alert.timestamp || new Date().toISOString(), acknowledged: false }, ...prev]);
  }, []);
  const unreadCount = alerts.filter(a => !a.acknowledged).length;

  // SCADA — store rolling history per asset per metric
  const HISTORY_LEN = 20;
  const [scadaData, setScadaData] = useState({});
  const [scadaRunning, setScadaRunning] = useState(true);
  const scadaTimer = useRef(null);
  const scadaHistory = useRef({});

  const refreshScada = useCallback(() => {
    const fresh = {};
    MOCK_ASSETS.forEach(a => {
      const reading = generateSCADAReading(a.id);
      const prev = scadaHistory.current[a.id] || {};
      const newHist = {};
      Object.keys(reading).filter(k => typeof reading[k] === 'number').forEach(k => {
        const prevArr = prev[k] || [];
        newHist[k] = [...prevArr, reading[k]].slice(-HISTORY_LEN);
      });
      scadaHistory.current[a.id] = newHist;
      fresh[a.id] = { ...reading, history: newHist };
    });
    setScadaData(fresh);
  }, []);

  useEffect(() => {
    refreshScada();
    if (scadaRunning) {
      scadaTimer.current = setInterval(refreshScada, 5000);
    }
    return () => clearInterval(scadaTimer.current);
  }, [scadaRunning, refreshScada]);

  const toggleScada = useCallback(() => {
    setScadaRunning(prev => {
      if (prev) clearInterval(scadaTimer.current);
      return !prev;
    });
  }, []);

  // Auto-alert on covenant breach
  const alertedCovenants = useRef(new Set());
  useEffect(() => {
    covenants.filter(c => c.status === 'Breached').forEach(c => {
      const key = `cov-${c.id}`;
      if (!alertedCovenants.current.has(key)) {
        alertedCovenants.current.add(key);
        setAlerts(prev => [{
          id: key, assetId: c.loanId, assetName: c.assetName,
          type: 'Warning', category: 'Financial',
          message: `Covenant breached: ${c.metric} = ${c.currentValue}${c.unit} (threshold ${c.condition}${c.threshold}${c.unit})`,
          timestamp: new Date().toISOString(), acknowledged: false
        }, ...prev.filter(a => a.id !== key)]);
      }
    });
  }, [covenants]);

  const value = {
    activeRole, switchRole, ROLES,
    assets, addAsset, updateAsset, deleteAsset,
    workOrders, addWorkOrder, updateWorkOrderStatus, addWorkOrderUpdate,
    loans, addLoan,
    covenants, addCovenant, updateCovenantValue,
    alerts, acknowledgeAlert, addAlert, unreadCount,
    scadaData, scadaRunning, toggleScada,
  };

  return <EnergyContext.Provider value={value}>{children}</EnergyContext.Provider>;
}

export function useEnergy() {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error('useEnergy must be used inside EnergyProvider');
  return ctx;
}
