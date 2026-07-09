import React, { useState, useEffect } from 'react';
import './AddFollowupModal.css';
import { useAuth } from "../../hooks/useAuth.js";
import useToast from '../../hooks/useToast';
import FilterSelect from '../Dropdowns/FilterSelect.js';

const API_BASE_URL = process.env.REACT_APP_API_URL;

function AddFollowupModal({ lead, onClose, onFollowupCreated }) {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    relatedType: 'LEAD',
    relatedId: lead.id,
    leadId: lead.id,
    customerId: lead.customerId || null,
    projectId: null,
    groupName: lead.groupName || '',
    subGroupName: lead.subGroupName || '',
    followupType: 'Call',
    scheduledDate: '',
    scheduledTime: '',
    assignedTo: user.id,
    status: 'Pending',
    priority: 'Medium',
    notes: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []); // eslint-disable-line

  const fetchUsers = async () => {
    try {
      // Pass User-Id and User-Role so the backend applies hierarchy + team scoping
      const response = await fetch(`${API_BASE_URL}/filters/followup-assignees`, {
        credentials: "include",
        headers: {
          'User-Id':   String(user.id),
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      if (Array.isArray(data)) {
        setUsers(data);
        // If the caller is in the list, default assignedTo to themselves
        const selfInList = data.some(u => Number(u.id) === Number(user.id));
        if (!selfInList && data.length > 0) {
          setFormData(prev => ({ ...prev, assignedTo: data[0].id }));
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.scheduledDate) {
      showError('Please select a date');
      return;
    }

    setLoading(true);

    try {
      const scheduledAt = formData.scheduledTime
        ? `${formData.scheduledDate} ${formData.scheduledTime}:00`
        : `${formData.scheduledDate} 09:00:00`;

      const requestData = {
        relatedType:  formData.relatedType,
        relatedId:    formData.relatedId,
        leadId:       formData.leadId,
        customerId:   formData.customerId,
        projectId:    formData.projectId,
        groupName:    formData.groupName,
        subGroupName: formData.subGroupName,
        followupType: formData.followupType,
        scheduledAt:  scheduledAt,
        assignedTo:   formData.assignedTo,
        status:       formData.status,
        priority:     formData.priority,
        notes:        formData.notes
      };

      const response = await fetch(`${API_BASE_URL}/followups/create`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id':       String(user.id),
          'User-Role':     user.role
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create follow-up');
      }

      const data = await response.json();
      if (data.success) {
        showSuccess('Follow-up created successfully');
        onFollowupCreated();
      } else {
        throw new Error(data.message || 'Failed to create follow-up');
      }
    } catch (err) {
      showError(err.message || 'Error creating follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-followup-modal-overlay">
      <div className="add-followup-modal">
        <div className="add-followup-modal-header">
          <h2>Add Follow-up for {lead.name}</h2>
          <button className="add-followup-modal-close" onClick={onClose}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="add-followup-lead-info">
          <div className="add-followup-info-item">
            <span className="add-followup-info-label">Lead ID:</span>
            <span className="add-followup-info-value">{lead.leadCode}</span>
          </div>
          <div className="add-followup-info-item">
            <span className="add-followup-info-label">Email:</span>
            <span className="add-followup-info-value">{lead.email}</span>
          </div>
          <div className="add-followup-info-item">
            <span className="add-followup-info-label">Phone:</span>
            <span className="add-followup-info-value">{lead.phone}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="add-followup-form">
          <div className="add-followup-form-grid">
            <div className="add-followup-form-group">
              <label>Follow-up Type *</label>
              <FilterSelect
                value={formData.followupType}
                onChange={v => setFormData({ ...formData, followupType: v })}
                options={[
                  { value: 'Call',     label: 'Call' },
                  { value: 'Email',    label: 'Email' },
                  { value: 'Meeting',  label: 'Meeting' },
                  { value: 'Visit',    label: 'Site Visit' },
                  { value: 'Demo',     label: 'Demo' },
                  { value: 'Proposal', label: 'Send Proposal' },
                  { value: 'Other',    label: 'Other' },
                ]}
                placeholder="Select Type"
              />
            </div>

            <div className="add-followup-form-group">
              <label>Scheduled Date *</label>
              <input type="date" required value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="add-followup-form-group">
              <label>Scheduled Time</label>
              <input type="time" value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })} />
            </div>

            <div className="add-followup-form-group">
              <label>Priority *</label>
              <FilterSelect
                value={formData.priority}
                onChange={v => setFormData({ ...formData, priority: v })}
                options={[
                  { value: 'High',   label: 'High' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'Low',    label: 'Low' },
                ]}
                placeholder="Select Priority"
              />
            </div>

            <div className="add-followup-form-group">
              <label>Assign To *</label>
              <FilterSelect
                value={String(formData.assignedTo)}
                onChange={v => setFormData({ ...formData, assignedTo: Number(v) })}
                options={
                  users.length > 0
                    ? users.map(u => ({ value: String(u.id), label: u.name + (Number(u.id) === Number(user.id) ? ' (Me)' : '') }))
                    : [{ value: String(user.id), label: (user.name || 'Me') + ' (Me)' }]
                }
                placeholder="Select User"
              />
              {users.length === 0 && (
                <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'block' }}>
                  Loading assignable users…
                </span>
              )}
            </div>

            <div className="add-followup-form-group">
              <label>Status</label>
              <FilterSelect
                value={formData.status}
                onChange={v => setFormData({ ...formData, status: v })}
                options={[
                  { value: 'Pending',     label: 'Pending' },
                  { value: 'Completed',   label: 'Completed' },
                  { value: 'Cancelled',   label: 'Cancelled' },
                  { value: 'Rescheduled', label: 'Rescheduled' },
                ]}
                placeholder="Select Status"
              />
            </div>
          </div>

          <div className="add-followup-form-group">
            <label>Notes / Description</label>
            <textarea rows={4} value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add notes about this follow-up..." />
          </div>

          <div className="add-followup-form-actions">
            <button type="button" className="add-followup-btn add-followup-btn-secondary"
              onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="add-followup-btn add-followup-btn-primary"
              disabled={loading}>{loading ? 'Creating...' : 'Create Follow-up'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddFollowupModal;