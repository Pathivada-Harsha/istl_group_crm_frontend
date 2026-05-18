import React, { useState } from 'react';
import { FileText, Receipt } from 'lucide-react';
import InvoicesManagementPage from './InvoicesManagementPage';
import ReceiptsManagementPage from './ReceiptsManagementPage';
import '../pages-css/InvoicesReceiptsPage.css';
import { useAuth } from '../hooks/useAuth';

const InvoicesReceiptsPage = () => {
  const { menuPermissions } = useAuth();

  // RECEIPTS tab is only visible when the user has the RECEIPTS menu permission
  const hasReceiptsPermission = menuPermissions.includes('RECEIPTS');

  // ✅ Persist active tab across browser refreshes
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('invoicesReceiptsActiveTab') || 'invoices'
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('invoicesReceiptsActiveTab', tab);
  };

  // If the stored tab is 'receipts' but user lost the permission, fall back to invoices
  const resolvedTab = activeTab === 'receipts' && !hasReceiptsPermission ? 'invoices' : activeTab;

  return (
    <div className="invoices-receipts-container">
      {/* Tab Navigation */}
      <div className="tab-navigation">
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
            <Receipt size={20} />
            <span>Receipts</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {resolvedTab === 'invoices' ? (
          <InvoicesManagementPage />
        ) : (
          <ReceiptsManagementPage />
        )}
      </div>
    </div>
  );
};

export default InvoicesReceiptsPage;