import React, { useState, useRef, useEffect } from 'react';
import { FileText, IndianRupee, AlertCircle } from 'lucide-react';
import InvoicesManagementPage from './InvoicesManagementPage';
import ReceiptsManagementPage from './ReceiptsManagementPage';
import OutstandingsTab from './InvoicesOutstandingsTab';
import '../pages-css/InvoicesReceiptsPage.css';
import { useAuth } from '../hooks/useAuth';

const InvoicesReceiptsPage = () => {
  const { menuPermissions } = useAuth();

  const hasReceiptsPermission = menuPermissions.includes('RECEIPTS');

  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('invoicesReceiptsActiveTab') || 'invoices'
  );

  const tabsRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('invoicesReceiptsActiveTab', tab);
  };

  const resolvedTab = activeTab === 'receipts' && !hasReceiptsPermission ? 'invoices' : activeTab;

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
      {/* Tab Navigation */}
      <div className="tab-navigation" ref={tabsRef}>
        <button
          className={`tab-button ${resolvedTab === 'invoices' ? 'active' : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          <FileText size={20} />
          <span>Invoices</span>
        </button>

        {hasReceiptsPermission && (
          <button
            className={`tab-button ${resolvedTab === 'receipts' ? 'active' : ''}`}
            onClick={() => handleTabChange('receipts')}
          >
            <IndianRupee size={20} />
            <span>Receipts</span>
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

      {/* Tab Content */}
      <div className="tab-content">
        {resolvedTab === 'invoices'     && <InvoicesManagementPage />}
        {resolvedTab === 'receipts'     && <ReceiptsManagementPage />}
        {resolvedTab === 'outstandings' && <OutstandingsTab />}
      </div>
    </div>
  );
};

export default InvoicesReceiptsPage;