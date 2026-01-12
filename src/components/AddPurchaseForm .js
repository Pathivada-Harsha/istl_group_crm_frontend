import React, { useState } from 'react';

/**
 * Add Purchase Form Component
 * Handles purchase entry with file upload
 */
const AddPurchaseForm = ({ vendors, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    vendorId: '',
    itemName: '',
    quantity: '',
    unitPrice: '',
    gstPercent: '18',
    notes: '',
    purchaseOrderFile: null
  });
  
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [fileName, setFileName] = useState('');
  
  // Calculate total when quantity, unit price, or GST changes
  React.useEffect(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.unitPrice) || 0;
    const gst = parseFloat(formData.gstPercent) || 0;
    
    const subtotal = qty * price;
    const gstAmount = (subtotal * gst) / 100;
    const total = subtotal + gstAmount;
    
    setCalculatedTotal(total);
  }, [formData.quantity, formData.unitPrice, formData.gstPercent]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        purchaseOrderFile: file
      }));
      setFileName(file.name);
    }
  };
  
  const handleSubmit = () => {
    // Validation
    if (!formData.vendorId) {
      alert('Please select a vendor');
      return;
    }
    if (!formData.itemName || !formData.itemName.trim()) {
      alert('Please enter item name');
      return;
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      alert('Please enter valid quantity');
      return;
    }
    if (!formData.unitPrice || parseFloat(formData.unitPrice) <= 0) {
      alert('Please enter valid unit price');
      return;
    }
    
    // Prepare purchase data
    const purchaseData = {
      vendorId: formData.vendorId,
      itemName: formData.itemName,
      quantity: parseFloat(formData.quantity),
      unitPrice: parseFloat(formData.unitPrice),
      gstPercent: parseFloat(formData.gstPercent),
      totalAmount: calculatedTotal,
      notes: formData.notes,
      purchaseOrderFile: formData.purchaseOrderFile
    };
    
    // Call save handler
    onSave(purchaseData);
  };
  
  return (
    <div className="form-card">
      <h2>Add Purchase Entry</h2>
      <div className="vendor-form">
        <div className="form-group">
          <label>Select Vendor *</label>
          <select 
            name="vendorId"
            value={formData.vendorId}
            onChange={handleInputChange}
            required
          >
            <option value="">Select vendor</option>
            {vendors.map(vendor => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Material / Item Name *</label>
            <input 
              type="text" 
              name="itemName"
              value={formData.itemName}
              onChange={handleInputChange}
              placeholder="Enter material or item name"
              required
            />
          </div>
          <div className="form-group">
            <label>Quantity *</label>
            <input 
              type="number" 
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              placeholder="Enter quantity"
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Unit Price (₹) *</label>
            <input 
              type="number" 
              name="unitPrice"
              value={formData.unitPrice}
              onChange={handleInputChange}
              placeholder="Enter unit price"
              min="0"
              step="0.01"
              required
            />
          </div>
          <div className="form-group">
            <label>GST % *</label>
            <select
              name="gstPercent"
              value={formData.gstPercent}
              onChange={handleInputChange}
            >
              <option value="18">18%</option>
              <option value="12">12%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Total Amount (Auto Calculated)</label>
          <input 
            type="text" 
            value={`₹${calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            readOnly 
            className="readonly-input" 
          />
        </div>

        <div className="form-group">
          <label>Upload Purchase Order (Optional)</label>
          <div className="file-upload">
            <input 
              type="file" 
              id="purchase-order"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            <label htmlFor="purchase-order" className="file-upload-label">
              📎 {fileName || 'Click to upload PDF or image'}
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Notes</label>
          <textarea 
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows="3" 
            placeholder="Additional notes about this purchase"
          />
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleSubmit}
          >
            Save Purchase Entry
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPurchaseForm;