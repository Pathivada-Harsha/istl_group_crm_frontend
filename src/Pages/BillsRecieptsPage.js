import React, { useState, useRef, useEffect } from 'react';
import { FileText, CreditCard, AlertCircle } from 'lucide-react';
import BillsManagementPage from './BillsManagementPage';
import VendorPaymentsPage from './VendorPaymentsPage';
import BillsOutstandingsTab from './BillsOutstandingsTab';
import '../pages-css/InvoicesReceiptsPage.css';
import { useAuth } from '../hooks/useAuth';

const BillsReceiptsPage = () => {
  const { menuPermissions } = useAuth();

  const hasPaymentsPermission = menuPermissions.includes('BILLS_PAYMENTS');

  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('billsPaymentsActiveTab') || 'bills'
  );

  const tabsRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('billsPaymentsActiveTab', tab);
  };

  const resolvedTab = activeTab === 'payments' && !hasPaymentsPermission ? 'bills' : activeTab;

  useEffect(() => {
    const bar = tabsRef.current;
    if (!bar) return;
    const activeBtn = bar.querySelector('.tab-button.active');
    if (!activeBtn) return;
    const barRect = bar.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    setIndicator({ left: btnRect.left - barRect.left + bar.scrollLeft, width: btnRect.width });
  }, [resolvedTab]);

  return (
    <div className="invoices-receipts-container">
      <div className="tab-navigation" ref={tabsRef}>
        <button
          className={`tab-button ${resolvedTab === 'bills' ? 'active' : ''}`}
          onClick={() => handleTabChange('bills')}
        >
          <FileText size={20} />
          <span>Bills</span>
        </button>

        {hasPaymentsPermission && (
          <button
            className={`tab-button ${resolvedTab === 'payments' ? 'active' : ''}`}
            onClick={() => handleTabChange('payments')}
          >
            <CreditCard size={20} />
            <span>Payments</span>
          </button>
        )}

        <button
          className={`tab-button ${resolvedTab === 'outstandings' ? 'active' : ''}`}
          onClick={() => handleTabChange('outstandings')}
        >
          <AlertCircle size={20} />
          <span>Outstandings</span>
        </button>

        {/* Sliding indicator */}
        <span className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
      </div>

      <div className="tab-content">
        {resolvedTab === 'bills'        && <BillsManagementPage />}
        {resolvedTab === 'payments'     && <VendorPaymentsPage />}
        {resolvedTab === 'outstandings' && <BillsOutstandingsTab />}
      </div>
    </div>
  );
};

export default BillsReceiptsPage;