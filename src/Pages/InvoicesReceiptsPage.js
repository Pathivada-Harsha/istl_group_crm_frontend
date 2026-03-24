import React, { useState } from 'react';
import { FileText, Receipt } from 'lucide-react';
import InvoicesManagementPage from './InvoicesManagementPage';
import ReceiptsManagementPage from './ReceiptsManagementPage';
import '../pages-css/InvoicesReceiptsPage.css';

const InvoicesReceiptsPage = () => {
  // ✅ Persist active tab across browser refreshes
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('invoicesReceiptsActiveTab') || 'invoices'
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('invoicesReceiptsActiveTab', tab);
  };

  return (
    <div className="invoices-receipts-container">
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          <FileText size={20} />
          <span>Invoices</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'receipts' ? 'active' : ''}`}
          onClick={() => handleTabChange('receipts')}
        >
          <Receipt size={20} />
          <span>Receipts</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'invoices' ? (
          <InvoicesManagementPage />
        ) : (
          <ReceiptsManagementPage />
        )}
      </div>
    </div>
  );
};

export default InvoicesReceiptsPage;