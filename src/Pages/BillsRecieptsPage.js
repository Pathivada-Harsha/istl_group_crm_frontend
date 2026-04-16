import React, { useState } from 'react';
import { FileText, CreditCard } from 'lucide-react';
import BillsManagementPage from './BillsManagementPage';
import VendorPaymentsPage from './VendorPaymentsPage';
import '../pages-css/InvoicesReceiptsPage.css'; // reuse same tab CSS

const BillsReceiptsPage = () => {
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('billsPaymentsActiveTab') || 'bills'
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('billsPaymentsActiveTab', tab);
  };

  return (
    <div className="invoices-receipts-container">
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'bills' ? 'active' : ''}`}
          onClick={() => handleTabChange('bills')}
        >
          <FileText size={20} />
          <span>Bills</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => handleTabChange('payments')}
        >
          <CreditCard size={20} />
          <span>Payments</span>
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'bills' ? <BillsManagementPage /> : <VendorPaymentsPage />}
      </div>
    </div>
  );
};

export default BillsReceiptsPage;