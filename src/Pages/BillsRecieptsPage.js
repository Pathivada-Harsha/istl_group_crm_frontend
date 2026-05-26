import React, { useState } from 'react';
import { FileText, CreditCard } from 'lucide-react';
import BillsManagementPage from './BillsManagementPage';
import VendorPaymentsPage from './VendorPaymentsPage';
import '../pages-css/InvoicesReceiptsPage.css';
import { useAuth } from '../hooks/useAuth';

const BillsReceiptsPage = () => {
  const { menuPermissions } = useAuth();

  // Payments tab only visible when user has BILLS_PAYMENTS menu permission
  const hasPaymentsPermission = menuPermissions.includes('BILLS_PAYMENTS');

  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('billsPaymentsActiveTab') || 'bills'
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('billsPaymentsActiveTab', tab);
  };

  // If stored tab is 'payments' but user lost permission, fall back to bills
  const resolvedTab = activeTab === 'payments' && !hasPaymentsPermission ? 'bills' : activeTab;

  return (
    <div className="invoices-receipts-container">
      <div className="tab-navigation">
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
      </div>

      <div className="tab-content">
        {resolvedTab === 'bills' ? <BillsManagementPage /> : <VendorPaymentsPage />}
      </div>
    </div>
  );
};

export default BillsReceiptsPage;