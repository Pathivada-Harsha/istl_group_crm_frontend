import React, { useState, useEffect } from 'react';
import '../pages-css/OrderBook.css';
import GroupCategoryFilter from '../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import UnitTypeDropdown from '../components/Dropdowns/Unittypedropdown.js';
import { FaEye, FaEdit, FaTrash, FaUpload, FaFileDownload, FaCloudUploadAlt, FaColumns } from 'react-icons/fa';
import { RiDeleteBin6Line } from "react-icons/ri";
import * as XLSX from 'xlsx';
const API_BASE_URL = process.env.REACT_APP_API_URL;

function OrderBook() {
  const { user } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  // State
  const [orderBooks, setOrderBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Column order for drag-and-drop
  const [columnOrder, setColumnOrder] = useState([
    'orderNo','customer','group','subGroup','orderTitle','orderDate',
    'expectedDelivery','poNumber','poDate','totalAmount','advanceAmount',
    'balanceAmount','status','createdBy','actions'
  ]);
  const dragCol = React.useRef(null);
  const dragOverCol = React.useRef(null);

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState({
    orderNo: true,
    customer: true,
    group: true,
    subGroup: false,
    orderTitle: true,
    orderDate: true,
    expectedDelivery: false,
    poNumber: true,
    poDate: false,
    totalAmount: true,
    advanceAmount: false,
    balanceAmount: false,
    status: true,
    createdBy: false,
    actions: true
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPOUploadModal, setShowPOUploadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedOrderBook, setSelectedOrderBook] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    proposalId: '',
    groupName: '',
    subGroupName: '',
    orderTitle: '',
    orderDescription: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    poNumber: '',
    poDate: '',
    advanceAmount: '',
    status: 'Draft',
    remarks: '',
    items: []
  });

  // PO Upload State
  const [poUploadData, setPoUploadData] = useState({
    file: null,
    poNumber: '',
    poDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchOrderBooks();
    fetchGroups();
  }, [currentPage, rowsPerPage, groupName, subGroupName]);

  useEffect(() => {
    if (searchTerm || statusFilter !== 'All' || fromDate || toDate) {
      const debounce = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      fetchOrderBooks();
    }
  }, [searchTerm, statusFilter, fromDate, toDate]);

  useEffect(() => {
    if (formData.groupName) {
      fetchSubGroupsForForm(formData.groupName);
      fetchCustomersByGroup(formData.groupName, formData.subGroupName);
    } else {
      setSubGroups([]);
      setCustomers([]);
    }
  }, [formData.groupName, formData.subGroupName]);

  const fetchOrderBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage - 1,
        size: rowsPerPage
      });

      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);

      const response = await fetch(`${API_BASE_URL}/order-book/getAll?${params}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch order books');

      const data = await response.json();
      if (data.success) {
        setOrderBooks(data.data || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      showError(err.message || 'Error fetching order books');
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e) => {
    e.preventDefault();

    if (!excelFile) {
      showWarning('Please select an Excel file');
      return;
    }

    setLoading(true);
    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        showWarning('The Excel file is empty');
        setLoading(false);
        return;
      }

      // Map Excel data to items structure
      const mappedItems = jsonData.map((row, index) => ({
        lineNo: index + 1,
        itemName: row['Item Name'] || row['itemName'] || '',
        specification: row['Specification'] || row['specification'] || '',
        description: row['Description'] || row['description'] || '',
        quantity: row['Quantity'] || row['quantity'] || '',
        unit: row['Unit'] || row['unit'] || 'Nos',
        unitPrice: row['Unit Price'] || row['unitPrice'] || '',
        taxPercent: row['Tax %'] || row['taxPercent'] || '',
        discountPercent: row['Discount %'] || row['discountPercent'] || '',
        itemRemarks: row['Remarks'] || row['itemRemarks'] || '',
        proposalItemId: null,
        isCustomUnit: false,
        customUnit: ''
      }));

      // Filter out empty rows (where itemName is missing)
      const validItems = mappedItems.filter(item => item.itemName && item.itemName.trim() !== '');

      if (validItems.length === 0) {
        showWarning('No valid items found in the Excel file');
        setLoading(false);
        return;
      }

      // Update formData with imported items
      setFormData(prev => ({
        ...prev,
        items: validItems
      }));

      showSuccess(`Successfully imported ${validItems.length} items from Excel`);
      setShowExcelUploadModal(false);
      setExcelFile(null);

    } catch (error) {
      console.error('Error reading Excel file:', error);
      showError('Failed to read Excel file. Please ensure it follows the correct format.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ✅ ONLY THIS FUNCTION IS CHANGED — fetches template from backend
  // ============================================================
  const downloadExcelTemplate = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/order-book/download-template`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      // Get the file as a blob
      const blob = await response.blob();

      // Create a temporary download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate a filename with today's date
      const date = new Date().toISOString().split('T')[0];
      link.download = `OrderBook_Template_${date}.xlsx`;

      // Trigger download and clean up
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess('Template downloaded successfully! Check your Downloads folder.');
    } catch (error) {
      console.error('Error downloading template:', error);
      showError('Failed to download template. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  // ============================================================

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage - 1,
        size: rowsPerPage
      });

      if (searchTerm) params.append('searchTerm', searchTerm);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const response = await fetch(`${API_BASE_URL}/order-book/search?${params}`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to search order books');

      const data = await response.json();
      if (data.success) {
        setOrderBooks(data.data || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      showError(err.message || 'Error searching order books');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/leads-groups`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch groups');

      const data = await response.json();
      if (Array.isArray(data)) {
        setGroups(data);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setGroups([]);
    }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) {
      setSubGroups([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch subgroups');

      const data = await response.json();
      if (Array.isArray(data)) {
        setSubGroups(data);
      }
    } catch (err) {
      console.error('Error fetching subgroups:', err);
      setSubGroups([]);
    }
  };

  const fetchCustomersByGroup = async (group, subGroup) => {
    if (!group) {
      setCustomers([]);
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('groupName', group);
      if (subGroup) params.append('subGroupName', subGroup);

      const response = await fetch(`${API_BASE_URL}/customers/by-group?${params}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch customers');

      const data = await response.json();
      if (data.success) {
        const customerList = Array.isArray(data.data) ? data.data : data.data.content || [];
        setCustomers(customerList);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setCustomers([]);
    }
  };

  const fetchProposalsByCustomer = async (customerId) => {
    if (!customerId) {
      setProposals([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/proposals/by-customer/${customerId}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch proposals');

      const data = await response.json();
      if (data.success) {
        const proposalList = Array.isArray(data.data) ? data.data : [];
        setProposals(proposalList);
      }
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setProposals([]);
    }
  };

  const loadProposalItems = async (proposalId) => {
    if (!proposalId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/proposal-items/${proposalId}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to load proposal items');

      const data = await response.json();
      if (data.success) {
        const items = (data.data || []).map((item, index) => ({
          lineNo: index + 1,
          itemName: item.itemName,
          specification: item.specification,
          description: item.description,
          proposalItemId: item.id,
          quantity: item.quantity || '',
          unit: item.unit || 'Nos',
          unitPrice: item.unitPrice || '',
          taxPercent: item.taxPercent || '',
          discountPercent: '',
          itemRemarks: '',
          isCustomUnit: false,
          customUnit: ''
        }));

        setFormData(prev => ({ ...prev, items }));
        showSuccess('Proposal items loaded successfully');
      }
    } catch (err) {
      showError(err.message || 'Error loading proposal items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleEdit = async (orderBook) => {
    setSelectedOrderBook(orderBook);

    setFormData(prev => ({
      ...prev,
      groupName: orderBook.groupName || '',
      subGroupName: orderBook.subGroupName || ''
    }));

    if (orderBook.groupName) {
      await fetchSubGroupsForForm(orderBook.groupName);
      await fetchCustomersByGroup(orderBook.groupName, orderBook.subGroupName);
    }

    if (orderBook.customerId) {
      await fetchProposalsByCustomer(orderBook.customerId);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/order-book/${orderBook.id}/items`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch items');

      const data = await response.json();
      if (data.success) {
        setTimeout(() => {
          setFormData({
            customerId: orderBook.customerId || '',
            proposalId: orderBook.proposalId || '',
            groupName: orderBook.groupName || '',
            subGroupName: orderBook.subGroupName || '',
            orderTitle: orderBook.orderTitle || '',
            orderDescription: orderBook.orderDescription || '',
            orderDate: orderBook.orderDate || '',
            expectedDeliveryDate: orderBook.expectedDeliveryDate || '',
            poNumber: orderBook.poNumber || '',
            poDate: orderBook.poDate || '',
            advanceAmount: orderBook.advanceAmount || '',
            status: orderBook.status || 'Draft',
            remarks: orderBook.remarks || '',
            items: (data.data || []).map(item => ({
              ...item,
              quantity: item.quantity || '',
              unitPrice: item.unitPrice || '',
              taxPercent: item.taxPercent || '',
              discountPercent: item.discountPercent || '',
              isCustomUnit: false,
              customUnit: ''
            }))
          });
        }, 300);

        setIsEditMode(true);
        setShowCreateModal(true);
      }
    } catch (err) {
      showError(err.message || 'Error loading order book details');
    }
  };

  const handleView = async (orderBook) => {
    setSelectedOrderBook(orderBook);

    try {
      const response = await fetch(`${API_BASE_URL}/order-book/${orderBook.id}/items`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch items');

      const data = await response.json();
      if (data.success) {
        setSelectedOrderBook({ ...orderBook, items: data.data || [] });
        setShowViewModal(true);
      }
    } catch (err) {
      showError(err.message || 'Error loading order book details');
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteOrderId(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteOrderId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/delete/${deleteOrderId}`, {
        method: 'DELETE',
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to delete order book');

      const data = await response.json();
      if (data.success) {
        showSuccess('Order book deleted successfully');
        setShowDeleteConfirm(false);
        setDeleteOrderId(null);
        fetchOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error deleting order book');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerId || !formData.orderTitle || formData.items.length === 0) {
      showWarning('Please fill in all required fields and add at least one item');
      return;
    }

    const preparedItems = formData.items.map(item => ({
      ...item,
      unit: item.isCustomUnit ? item.customUnit : item.unit,
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      taxPercent: item.taxPercent || 0,
      discountPercent: item.discountPercent || 0
    }));

    const submitData = {
      ...formData,
      advanceAmount: formData.advanceAmount || 0,
      items: preparedItems
    };

    setLoading(true);
    try {
      const url = isEditMode
        ? `${API_BASE_URL}/order-book/update/${selectedOrderBook.id}`
        : `${API_BASE_URL}/order-book/create`;

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save order book');
      }

      const data = await response.json();
      if (data.success) {
        showSuccess(isEditMode ? 'Order book updated successfully' : 'Order book created successfully');
        setShowCreateModal(false);
        resetForm();
        fetchOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error saving order book');
    } finally {
      setLoading(false);
    }
  };

  const handlePOUploadClick = (orderBook) => {
    setSelectedOrderBook(orderBook);
    setPoUploadData({
      file: null,
      poNumber: orderBook.poNumber || '',
      poDate: new Date().toISOString().split('T')[0]
    });
    setShowPOUploadModal(true);
  };

  const handlePOUpload = async (e) => {
    e.preventDefault();

    if (!poUploadData.file || !poUploadData.poNumber) {
      showWarning('Please select a file and enter PO number');
      return;
    }

    setLoading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', poUploadData.file);
      formDataUpload.append('poNumber', poUploadData.poNumber);
      if (poUploadData.poDate) {
        formDataUpload.append('poDate', poUploadData.poDate);
      }

      const response = await fetch(`${API_BASE_URL}/order-book/${selectedOrderBook.id}/upload-po`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: formDataUpload
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload PO');
      }

      const data = await response.json();
      if (data.success) {
        showSuccess('PO uploaded successfully');
        setShowPOUploadModal(false);
        setPoUploadData({ file: null, poNumber: '', poDate: new Date().toISOString().split('T')[0] });
        fetchOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error uploading PO');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      proposalId: '',
      groupName: groupName || '',
      subGroupName: subGroupName || '',
      orderTitle: '',
      orderDescription: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      poNumber: '',
      poDate: '',
      advanceAmount: '',
      status: 'Draft',
      remarks: '',
      items: []
    });
    setIsEditMode(false);
    setSelectedOrderBook(null);
    setCustomers([]);
    setProposals([]);
    setSubGroups([]);
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          lineNo: prev.items.length + 1,
          itemName: '',
          specification: '',
          description: '',
          proposalItemId: null,
          quantity: '',
          unit: 'Nos',
          unitPrice: '',
          taxPercent: '',
          discountPercent: '',
          itemRemarks: '',
          isCustomUnit: false,
          customUnit: ''
        }
      ]
    }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];

      if (field === 'unit') {
        if (value === 'Custom') {
          items[index].isCustomUnit = true;
          items[index].unit = 'Custom';
          items[index].customUnit = '';
        } else {
          items[index].isCustomUnit = false;
          items[index].unit = value;
          items[index].customUnit = '';
        }
      } else {
        items[index][field] = value;
      }

      return { ...prev, items };
    });
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index).map((item, idx) => ({
        ...item,
        lineNo: idx + 1
      }))
    }));
  };

  const calculateItemTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const discountPercent = parseFloat(item.discountPercent) || 0;
    const taxPercent = parseFloat(item.taxPercent) || 0;

    const subtotal = quantity * unitPrice;
    const discount = subtotal * (discountPercent / 100);
    const taxable = subtotal - discount;
    const tax = taxable * (taxPercent / 100);
    return taxable + tax;
  };

  const calculateGrandTotal = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'Draft': 'status-draft',
      'Confirmed': 'status-confirmed',
      'In Production': 'status-production',
      'Ready for Dispatch': 'status-ready',
      'Dispatched': 'status-dispatched',
      'Completed': 'status-completed',
      'Cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-draft';
  };

  const closeModal = (modalSetter) => {
    modalSetter(false);
    if (modalSetter === setShowCreateModal) {
      resetForm();
    }
    if (modalSetter === setShowDeleteConfirm) {
      setDeleteOrderId(null);
    }
  };

  const formatDisplayValue = (value) => {
    if (value === null || value === undefined || value === '' || value === 0) {
      return '-';
    }
    return value;
  };

  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const columnDefinitions = [
    { key: 'orderNo', label: 'Order No' },
    { key: 'customer', label: 'Customer' },
    { key: 'group', label: 'Group' },
    { key: 'subGroup', label: 'Sub Group' },
    { key: 'orderTitle', label: 'Order Title' },
    { key: 'orderDate', label: 'Order Date' },
    { key: 'expectedDelivery', label: 'Expected Delivery' },
    { key: 'poNumber', label: 'PO Number' },
    { key: 'poDate', label: 'PO Date' },
    { key: 'totalAmount', label: 'Total Amount (₹)' },
    { key: 'advanceAmount', label: 'Advance Amount (₹)' },
    { key: 'balanceAmount', label: 'Balance Amount (₹)' },
    { key: 'status', label: 'Status' },
    { key: 'createdBy', label: 'Created By' },
    { key: 'actions', label: 'Actions' }
  ];

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedOrderBooks = [...orderBooks].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const getVal = (obj, key) => {
      const map = {
        orderNo:          obj.orderBookNo || '',
        customer:         obj.customerName || '',
        group:            obj.groupName || '',
        subGroup:         obj.subGroupName || '',
        orderTitle:       obj.orderTitle || '',
        orderDate:        obj.orderDate || '',
        expectedDelivery: obj.expectedDeliveryDate || '',
        poNumber:         obj.poNumber || '',
        poDate:           obj.poDate || '',
        totalAmount:      parseFloat(obj.totalAmount) || 0,
        advanceAmount:    parseFloat(obj.advanceAmount) || 0,
        balanceAmount:    parseFloat(obj.balanceAmount) || 0,
        status:           obj.status || '',
        createdBy:        obj.createdByName || '',
      };
      return map[key] ?? '';
    };
    const aVal = getVal(a, sortConfig.key);
    const bVal = getVal(b, sortConfig.key);
    if (typeof aVal === 'number') return (aVal - bVal) * dir;
    if (sortConfig.key.toLowerCase().includes('date')) return aVal.localeCompare(bVal) * dir;
    return String(aVal).localeCompare(String(bVal)) * dir;
  });

  // ── Drag-and-drop column reorder ──────────────────────────────
  const handleDragStart = (key) => { dragCol.current = key; };
  const handleDragEnter = (key) => { dragOverCol.current = key; };
  const handleDragEnd   = () => {
    const from = dragCol.current;
    const to   = dragOverCol.current;
    if (!from || !to || from === to) return;
    setColumnOrder(prev => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(to);
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
    dragCol.current     = null;
    dragOverCol.current = null;
  };

  // Column metadata — label, cell renderer, sort key
  const columnMeta = {
    orderNo:          {
      label: 'Order No',
      sortKey: 'orderNo',
      render: (o) => <td key="orderNo" className="orderbook-id">{o.orderBookNo}</td>
    },
    customer:         {
      label: 'Customer',
      sortKey: 'customer',
      render: (o) => (
        <td key="customer">
          <div className="orderbook-customer-info">
            <strong>{o.customerName}</strong>
            <span className="orderbook-customer-code">{o.customerCode}</span>
          </div>
        </td>
      )
    },
    group:            {
      label: 'Group',
      sortKey: 'group',
      render: (o) => <td key="group">{o.groupName || '-'}</td>
    },
    subGroup:         {
      label: 'Sub Group',
      sortKey: 'subGroup',
      render: (o) => <td key="subGroup">{o.subGroupName || '-'}</td>
    },
    orderTitle:       {
      label: 'Order Title',
      sortKey: 'orderTitle',
      render: (o) => <td key="orderTitle">{o.orderTitle}</td>
    },
    orderDate:        {
      label: 'Order Date',
      sortKey: 'orderDate',
      render: (o) => <td key="orderDate">{o.orderDate ? new Date(o.orderDate).toLocaleDateString('en-IN') : '-'}</td>
    },
    expectedDelivery: {
      label: 'Expected Delivery',
      sortKey: 'expectedDelivery',
      render: (o) => <td key="expectedDelivery">{o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString('en-IN') : '-'}</td>
    },
    poNumber:         {
      label: 'PO Number',
      sortKey: 'poNumber',
      render: (o) => <td key="poNumber">{o.poNumber || '-'}</td>
    },
    poDate:           {
      label: 'PO Date',
      sortKey: 'poDate',
      render: (o) => <td key="poDate">{o.poDate ? new Date(o.poDate).toLocaleDateString('en-IN') : '-'}</td>
    },
    totalAmount:      {
      label: 'Total Amount (₹)',
      sortKey: 'totalAmount',
      render: (o) => <td key="totalAmount" className="orderbook-amount">₹{o.totalAmount ? parseFloat(o.totalAmount).toLocaleString('en-IN',{minimumFractionDigits:2}) : '0.00'}</td>
    },
    advanceAmount:    {
      label: 'Advance Amount (₹)',
      sortKey: 'advanceAmount',
      render: (o) => <td key="advanceAmount" className="orderbook-amount">₹{o.advanceAmount ? parseFloat(o.advanceAmount).toLocaleString('en-IN',{minimumFractionDigits:2}) : '0.00'}</td>
    },
    balanceAmount:    {
      label: 'Balance Amount (₹)',
      sortKey: 'balanceAmount',
      render: (o) => <td key="balanceAmount" className="orderbook-amount orderbook-balance">₹{o.balanceAmount ? parseFloat(o.balanceAmount).toLocaleString('en-IN',{minimumFractionDigits:2}) : '0.00'}</td>
    },
    status:           {
      label: 'Status',
      sortKey: 'status',
      render: (o) => (
        <td key="status">
          <span className={`orderbook-status ${getStatusClass(o.status)}`}>{o.status}</span>
        </td>
      )
    },
    createdBy:        {
      label: 'Created By',
      sortKey: 'createdBy',
      render: (o) => <td key="createdBy">{o.createdByName || '-'}</td>
    },
    actions:          {
      label: 'Actions',
      sortKey: null,
      render: (o) => (
        <td key="actions">
          <div className="orderbook-actions-inline">
            <button className="orderbook-icon-btn ob-view"   onClick={() => handleView(o)}          title="View">   <FaEye /></button>
            <button className="orderbook-icon-btn ob-edit"   onClick={() => handleEdit(o)}          title="Edit">   <FaEdit /></button>
            <button className="orderbook-icon-btn ob-upload" onClick={() => handlePOUploadClick(o)} title="Upload PO"><FaCloudUploadAlt /></button>
            <button className="orderbook-icon-btn ob-delete" onClick={() => handleDeleteClick(o.id)} title="Delete"><RiDeleteBin6Line /></button>
          </div>
        </td>
      )
    },
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <span className="ob-sort-icon ob-sort-none">⇅</span>;
    return sortConfig.direction === 'asc'
      ? <span className="ob-sort-icon ob-sort-active">↑</span>
      : <span className="ob-sort-icon ob-sort-active">↓</span>;
  };

  return (
    <div className="orderbook-page">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Breadcrumb */}
      <div className="orderbook-breadcrumb">
        <span>Dashboard</span>
        <span className="orderbook-breadcrumb-separator">&gt;</span>
        <span className="orderbook-breadcrumb-active">Order Book</span>
      </div>

      {/* Header */}
      <div className="orderbook-header page-header-with-filter">
        <h1>Order Book</h1>
        <GroupCategoryFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          onChange={updateFilters}
        />
      </div>

      {/* Action Bar */}
      <div className="orderbook-action-bar">
        <div className="orderbook-search-filters">
          <input
            type="text"
            className="orderbook-search"
            placeholder="Search by Order No, Title, PO Number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="orderbook-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="In Production">In Production</option>
            <option value="Ready for Dispatch">Ready for Dispatch</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <div className="orderbook-date-range">
            <div className="orderbook-date-field">
              <label>From</label>
              <input
                type="date"
                className="orderbook-filter"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <span className="orderbook-date-separator">→</span>
            <div className="orderbook-date-field">
              <label>To</label>
              <input
                type="date"
                className="orderbook-filter"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            {(fromDate || toDate) && (
              <button
                className="orderbook-date-clear"
                onClick={() => { setFromDate(''); setToDate(''); }}
                title="Clear dates"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="orderbook-action-buttons">
          <div className="orderbook-column-picker-container">
            <button
              className="orderbook-btn orderbook-btn-secondary orderbook-btn-icon"
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              title="Manage Columns"
            >
              <FaColumns /> Columns
            </button>

            {showColumnPicker && (
              <div className="orderbook-column-picker-dropdown">
                <div className="orderbook-column-picker-header">
                  <span>Show/Hide Columns</span>
                  <button
                    className="orderbook-column-picker-close"
                    onClick={() => setShowColumnPicker(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="orderbook-column-picker-list">
                  {columnDefinitions.map(col => (
                    <label key={col.key} className="orderbook-column-picker-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={() => toggleColumnVisibility(col.key)}
                        disabled={col.key === 'actions'}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="orderbook-btn orderbook-btn-primary" onClick={handleCreateNew}>
            + Create Order Book
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="orderbook-table-card">
        <div className="orderbook-table-wrapper">
          <table className="orderbook-table">
            <thead>
              <tr>
                {columnOrder
                  .filter(key => visibleColumns[key])
                  .map(key => {
                    const col = columnMeta[key];
                    const isActive = sortConfig.key === col.sortKey;
                    return (
                      <th
                        key={key}
                        draggable
                        onDragStart={() => handleDragStart(key)}
                        onDragEnter={() => handleDragEnter(key)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className={`ob-draggable-th ${col.sortKey ? 'ob-sortable' : ''} ${isActive ? 'ob-th-sorted' : ''}`}
                        onClick={() => col.sortKey && handleSort(col.sortKey)}
                        title={col.sortKey ? 'Drag to reorder · Click to sort' : 'Drag to reorder'}
                      >
                        <span className="ob-th-grip">⠿</span>
                        {col.label}
                        {col.sortKey && <SortIcon colKey={col.sortKey} />}
                      </th>
                    );
                  })}
              </tr>
            </thead>
            <tbody>
              {orderBooks.length === 0 ? (
                <tr>
                  <td colSpan={columnOrder.filter(k => visibleColumns[k]).length} className="orderbook-empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No order books found</p>
                  </td>
                </tr>
              ) : (
                sortedOrderBooks.map((order) => (
                  <tr key={order.id}>
                    {columnOrder
                      .filter(key => visibleColumns[key])
                      .map(key => columnMeta[key].render(order))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="orderbook-pagination">
          <div className="orderbook-pagination-info">
            {totalItems > 0 ? (
              <>Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems} entries</>
            ) : (
              <>No entries to display</>
            )}

            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="orderbook-rows-select"
            >
              <option value={10}>10 Rows</option>
              <option value={20}>20 Rows</option>
              <option value={50}>50 Rows</option>
              <option value={100}>100 Rows</option>
            </select>
          </div>
          <div className="orderbook-pagination-controls">
            
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="orderbook-pagination-btn"
            >
              Previous
            </button>
            <span className="orderbook-pagination-current">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="orderbook-pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-delete-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Delete Order Book</h3>
            <p>Are you sure you want to delete this order book?</p>
            <p className="orderbook-delete-warning">This action cannot be undone.</p>
            <div className="orderbook-delete-actions">
              <button
                className="orderbook-btn orderbook-btn-secondary"
                onClick={() => closeModal(setShowDeleteConfirm)}
              >
                Cancel
              </button>
              <button
                className="orderbook-btn orderbook-btn-danger"
                onClick={handleDeleteConfirm}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedOrderBook && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-modal orderbook-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Order Book Details</h2>
              <button className="orderbook-modal-close" onClick={() => closeModal(setShowViewModal)}>×</button>
            </div>

            <div className="orderbook-modal-content">
              {/* Order Info */}
              <div className="orderbook-card">
                <div className="orderbook-card-header">
                  <div>
                    <h3>{selectedOrderBook.orderTitle}</h3>
                    <p className="orderbook-id">{selectedOrderBook.orderBookNo}</p>
                  </div>
                  <span className={`orderbook-status ${getStatusClass(selectedOrderBook.status)}`}>
                    {selectedOrderBook.status}
                  </span>
                </div>
                <div className="orderbook-info-grid">
                  <div><strong>Customer:</strong> {selectedOrderBook.customerName} ({selectedOrderBook.customerCode})</div>
                  <div><strong>Group:</strong> {selectedOrderBook.groupName || '-'}</div>
                  <div><strong>Sub Group:</strong> {selectedOrderBook.subGroupName || '-'}</div>
                  <div><strong>Order Date:</strong> {selectedOrderBook.orderDate ? new Date(selectedOrderBook.orderDate).toLocaleDateString('en-IN') : '-'}</div>
                  <div><strong>Expected Delivery:</strong> {selectedOrderBook.expectedDeliveryDate ? new Date(selectedOrderBook.expectedDeliveryDate).toLocaleDateString('en-IN') : '-'}</div>
                  <div><strong>PO Number:</strong> {selectedOrderBook.poNumber || '-'}</div>
                  <div><strong>PO Date:</strong> {selectedOrderBook.poDate ? new Date(selectedOrderBook.poDate).toLocaleDateString('en-IN') : '-'}</div>
                  <div><strong>Created By:</strong> {selectedOrderBook.createdByName || '-'}</div>
                </div>

                {selectedOrderBook.orderDescription && (
                  <div className="orderbook-description">
                    <strong>Description:</strong>
                    <p>{selectedOrderBook.orderDescription}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              {selectedOrderBook.items && selectedOrderBook.items.length > 0 && (
                <div className="orderbook-card">
                  <h3>Order Items</h3>
                  <div className="orderbook-table-wrapper">
                    <table className="orderbook-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item Name</th>
                          <th>Specification</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Unit Price</th>
                          <th>Discount %</th>
                          <th>Tax %</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrderBook.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.lineNo}</td>
                            <td>{item.itemName}</td>
                            <td>{item.specification || '-'}</td>
                            <td>{formatDisplayValue(item.quantity)}</td>
                            <td>{item.unit}</td>
                            <td>₹{item.unitPrice ? parseFloat(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                            <td>{formatDisplayValue(item.discountPercent)}%</td>
                            <td>{formatDisplayValue(item.taxPercent)}%</td>
                            <td>₹{parseFloat(item.unitPrice * item.taxPercent).toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="orderbook-total-row">
                          <td colSpan="8" style={{ textAlign: 'right' }}><strong>Total Amount:</strong></td>
                          <td><strong>₹{parseFloat(selectedOrderBook.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div className="orderbook-card">
                <h3>Financial Summary</h3>
                <div className="orderbook-financial-grid">
                  <div className="orderbook-financial-item">
                    <span>Subtotal:</span>
                    <strong>₹{parseFloat(selectedOrderBook.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Tax Amount:</span>
                    <strong>₹{parseFloat(selectedOrderBook.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Total Amount:</span>
                    <strong className="orderbook-total">₹{parseFloat(selectedOrderBook.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Advance Paid:</span>
                    <strong>₹{parseFloat(selectedOrderBook.advanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Balance Due:</span>
                    <strong className="orderbook-balance">₹{parseFloat(selectedOrderBook.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {selectedOrderBook.remarks && (
                <div className="orderbook-card">
                  <h3>Remarks</h3>
                  <p>{selectedOrderBook.remarks}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-modal orderbook-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>{isEditMode ? 'Edit Order Book' : 'Create Order Book'}</h2>
              <button className="orderbook-modal-close" onClick={() => closeModal(setShowCreateModal)}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="orderbook-modal-content">
              {/* Basic Info */}
              <div className="orderbook-card">
                <h3>Basic Information</h3>
                <div className="orderbook-form-grid">
                  <div className="orderbook-form-group">
                    <label>Group *</label>
                    <select
                      value={formData.groupName}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          groupName: e.target.value,
                          subGroupName: '',
                          customerId: '',
                          proposalId: ''
                        });
                      }}
                      required
                    >
                      <option value="">Select Group</option>
                      {groups.map((group, index) => (
                        <option key={group.value || group.label || index} value={group.value || group.label}>
                          {group.label || group.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="orderbook-form-group">
                    <label>Sub Group</label>
                    <select
                      value={formData.subGroupName}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          subGroupName: e.target.value,
                          customerId: '',
                          proposalId: ''
                        });
                      }}
                      disabled={!formData.groupName}
                    >
                      <option value="">Select Sub Group</option>
                      {subGroups.map((sub, index) => (
                        <option key={sub.value || sub.label || index} value={sub.value || sub.label}>
                          {sub.label || sub.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="orderbook-form-group">
                    <label>Customer *</label>
                    <select
                      value={formData.customerId}
                      onChange={(e) => {
                        setFormData({ ...formData, customerId: e.target.value, proposalId: '' });
                        fetchProposalsByCustomer(e.target.value);
                      }}
                      disabled={!formData.groupName}
                      required
                    >
                      <option value="">Select Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.customerCode}
                        </option>
                      ))}
                    </select>
                    {!formData.groupName && (
                      <small className="orderbook-help-text">
                        Please select a group first
                      </small>
                    )}
                  </div>

                  <div className="orderbook-form-group">
                    <label>Proposal (Optional)</label>
                    <select
                      value={formData.proposalId}
                      onChange={(e) => {
                        setFormData({ ...formData, proposalId: e.target.value });
                        if (e.target.value) {
                          loadProposalItems(e.target.value);
                        }
                      }}
                      disabled={!formData.customerId}
                    >
                      <option value="">Select Proposal</option>
                      {proposals.map(proposal => (
                        <option key={proposal.id} value={proposal.id}>
                          {proposal.proposalNo} - {proposal.title}
                        </option>
                      ))}
                    </select>
                    {formData.proposalId && (
                      <small className="orderbook-help-text">
                        Items will be loaded automatically from proposal
                      </small>
                    )}
                  </div>

                  <div className="orderbook-form-group">
                    <label>Order Title *</label>
                    <input
                      type="text"
                      value={formData.orderTitle}
                      onChange={(e) => setFormData({ ...formData, orderTitle: e.target.value })}
                      placeholder="Enter order title"
                      required
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Order Date *</label>
                    <input
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Expected Delivery Date</label>
                    <input
                      type="date"
                      value={formData.expectedDeliveryDate}
                      onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="In Production">In Production</option>
                      <option value="Ready for Dispatch">Ready for Dispatch</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="orderbook-form-group">
                    <label>PO Number</label>
                    <input
                      type="text"
                      value={formData.poNumber}
                      onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                      placeholder="Enter PO number"
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>PO Date</label>
                    <input
                      type="date"
                      value={formData.poDate}
                      onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Advance Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.advanceAmount}
                      onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="orderbook-form-group orderbook-form-full">
                    <label>Description</label>
                    <textarea
                      value={formData.orderDescription}
                      onChange={(e) => setFormData({ ...formData, orderDescription: e.target.value })}
                      placeholder="Enter order description"
                      rows={3}
                    />
                  </div>

                  <div className="orderbook-form-group orderbook-form-full">
                    <label>Remarks</label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="Enter any remarks"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="orderbook-card">
                <div className="orderbook-items-header">
                  <h3>Order Items</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="orderbook-btn orderbook-btn-secondary orderbook-btn-icon"
                      onClick={downloadExcelTemplate}
                      title="Download Excel Template"
                    >
                      <FaFileDownload /> Download Template
                    </button>
                    <button
                      type="button"
                      className="orderbook-btn orderbook-btn-secondary orderbook-btn-icon"
                      onClick={() => setShowExcelUploadModal(true)}
                      title="Import from Excel"
                    >
                      <FaUpload /> Import Excel
                    </button>
                    <button
                      type="button"
                      className="orderbook-btn orderbook-btn-secondary"
                      onClick={addItem}
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {formData.items.length === 0 ? (
                  <div className="orderbook-empty-items">
                    <p>No items added. Click "Add Item" to start or import from Excel.</p>
                  </div>
                ) : (
                  <>
                    <div className="orderbook-table-wrapper">
                      <table className="orderbook-table orderbook-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ width: '200px' }}>Item Name *</th>
                            <th style={{ width: '150px' }}>Specification</th>
                            <th style={{ width: '100px' }}>Quantity *</th>
                            <th style={{ width: '120px' }}>Unit *</th>
                            <th style={{ width: '120px' }}>Unit Price (₹)</th>
                            <th style={{ width: '100px' }}>Discount %</th>
                            <th style={{ width: '80px' }}>Tax %</th>
                            <th style={{ width: '120px' }}>Line Total</th>
                            <th style={{ width: '60px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.map((item, index) => (
                            <tr key={index}>
                              <td className="orderbook-table-cell-centered">
                                {item.lineNo}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="orderbook-table-input"
                                  value={item.itemName}
                                  onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                                  placeholder="Item name"
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="orderbook-table-input"
                                  value={item.specification}
                                  onChange={(e) => updateItem(index, 'specification', e.target.value)}
                                  placeholder="Specification"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.0001"
                                  className="orderbook-table-input orderbook-table-input-number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                  placeholder="0"
                                  required
                                />
                              </td>
                              <td>
                                {item.isCustomUnit ? (
                                  <input
                                    type="text"
                                    className="orderbook-table-input"
                                    value={item.customUnit}
                                    onChange={(e) => updateItem(index, 'customUnit', e.target.value)}
                                    placeholder="Enter custom unit"
                                    required
                                  />
                                ) : (
                                  <UnitTypeDropdown
                                    value={item.unit}
                                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                    className="orderbook-table-input"
                                    placeholder="Select Unit"
                                  />
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="orderbook-table-input orderbook-table-input-number"
                                  value={item.unitPrice}
                                  onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                                  placeholder="0.00"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="orderbook-table-input orderbook-table-input-number"
                                  value={item.discountPercent}
                                  onChange={(e) => updateItem(index, 'discountPercent', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="orderbook-table-input orderbook-table-input-number"
                                  value={item.taxPercent}
                                  onChange={(e) => updateItem(index, 'taxPercent', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="orderbook-table-cell-total">
                                ₹{calculateItemTotal(item).toFixed(2)}
                              </td>
                              <td className="orderbook-table-cell-centered">
                                <button
                                  type="button"
                                  className="orderbook-table-delete-btn"
                                  onClick={() => removeItem(index)}
                                  title="Remove item"
                                >
                                  <FaTrash />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="orderbook-grand-total">
                      <span>Grand Total:</span>
                      <strong>₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="orderbook-modal-actions">
                <button
                  type="button"
                  className="orderbook-btn orderbook-btn-secondary"
                  onClick={() => closeModal(setShowCreateModal)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="orderbook-btn orderbook-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (isEditMode ? 'Update Order Book' : 'Create Order Book')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Upload Modal */}
      {showPOUploadModal && selectedOrderBook && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Upload PO for {selectedOrderBook.orderBookNo}</h2>
              <button className="orderbook-modal-close" onClick={() => closeModal(setShowPOUploadModal)}>×</button>
            </div>

            <form onSubmit={handlePOUpload} className="orderbook-modal-content">
              <div className="orderbook-form-group">
                <label>PO Number *</label>
                <input
                  type="text"
                  value={poUploadData.poNumber}
                  onChange={(e) => setPoUploadData({ ...poUploadData, poNumber: e.target.value })}
                  placeholder="Enter PO number"
                  required
                />
              </div>

              <div className="orderbook-form-group">
                <label>PO Date</label>
                <input
                  type="date"
                  value={poUploadData.poDate}
                  onChange={(e) => setPoUploadData({ ...poUploadData, poDate: e.target.value })}
                />
              </div>

              <div className="orderbook-form-group">
                <label>PO File *</label>
                <input
                  type="file"
                  onChange={(e) => setPoUploadData({ ...poUploadData, file: e.target.files[0] })}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  required
                />
                <small className="orderbook-help-text">
                  Accepted formats: PDF, DOC, DOCX, JPG, PNG
                </small>
              </div>

              <div className="orderbook-modal-actions">
                <button
                  type="button"
                  className="orderbook-btn orderbook-btn-secondary"
                  onClick={() => closeModal(setShowPOUploadModal)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="orderbook-btn orderbook-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Uploading...' : 'Upload PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {showExcelUploadModal && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Import Items from Excel</h2>
              <button className="orderbook-modal-close" onClick={() => {
                setShowExcelUploadModal(false);
                setExcelFile(null);
              }}>×</button>
            </div>

            <form onSubmit={handleExcelUpload} className="orderbook-modal-content">
              <div className="orderbook-info-box" style={{
                background: '#e3f2fd',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #90caf9'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>📋 Excel Format Instructions:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#555' }}>
                  <li>Use the downloaded template for correct format</li>
                  <li>Required columns: Item Name, Quantity, Unit</li>
                  <li>Optional columns: Specification, Description, Unit Price, Discount %, Tax %, Remarks</li>
                  <li>First row must contain column headers</li>
                  <li>Data should start from row 2</li>
                </ul>
              </div>

              <div className="orderbook-form-group">
                <label>
                  Excel File *
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    style={{
                      marginLeft: '10px',
                      padding: '4px 12px',
                      fontSize: '12px',
                      background: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <FaFileDownload /> Download Template
                  </button>
                </label>
                <input
                  type="file"
                  onChange={(e) => setExcelFile(e.target.files[0])}
                  accept=".xlsx,.xls"
                  required
                />
                <small className="orderbook-help-text">
                  Accepted formats: .xlsx, .xls
                </small>
                {excelFile && (
                  <small style={{ display: 'block', marginTop: '8px', color: '#4CAF50' }}>
                    ✓ Selected: {excelFile.name}
                  </small>
                )}
              </div>

              <div className="orderbook-modal-actions">
                <button
                  type="button"
                  className="orderbook-btn orderbook-btn-secondary"
                  onClick={() => {
                    setShowExcelUploadModal(false);
                    setExcelFile(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="orderbook-btn orderbook-btn-primary"
                  disabled={loading || !excelFile}
                >
                  {loading ? 'Importing...' : 'Import Items'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderBook;