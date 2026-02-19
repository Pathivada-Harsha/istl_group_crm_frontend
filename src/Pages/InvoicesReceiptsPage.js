import React, { useState } from 'react';
import { FileText, Receipt } from 'lucide-react';
import InvoicesManagementPage from './InvoicesManagementPage';
import ReceiptsManagementPage from './ReceiptsManagementPage';
import '../pages-css/InvoicesReceiptsPage.css';

const InvoicesReceiptsPage = () => {
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' or 'receipts'

  return (
    <div className="invoices-receipts-container">
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          <FileText size={20} />
          <span>Invoices</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'receipts' ? 'active' : ''}`}
          onClick={() => setActiveTab('receipts')}
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