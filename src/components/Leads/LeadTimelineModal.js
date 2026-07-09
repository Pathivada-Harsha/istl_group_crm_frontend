import React, { useState, useEffect } from 'react';
import './LeadTimelineModal.css';
import { useAuth } from "../../hooks/useAuth";
import CrmPreloader from "../preLoader";

const API_BASE_URL = process.env.REACT_APP_API_URL;

function LeadTimelineModal({ lead, onClose, onAddFollowup }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' or 'followups'

  useEffect(() => {
    fetchHistory();
    fetchFollowups();
  }, [lead.id]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/leads/${lead.id}/history`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch history');
      
      const data = await response.json();
      if (data.success) {
        setHistory(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/followups/lead/${lead.id}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch follow-ups');
      
      const data = await response.json();
      if (data.success) {
        setFollowups(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
      setFollowups([]);
    }
  };

  const getActionIcon = (actionType) => {
    const icons = {
      'CREATED': '🎉',
      'STATUS_CHANGED': '🔄',
      'ASSIGNED': '👤',
      'FOLLOWUP_ADDED': '📅',
      'FOLLOWUP_COMPLETED': '✅',
      'FOLLOWUP_DELETED': '🗑️',
      'NOTE_ADDED': '📝',
      'PROPOSAL_SENT': '📄',
      'CUSTOMER_FEEDBACK': '💬'
    };
    return icons[actionType] || '📌';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': '#f59e0b',
      'Completed': '#10b981',
      'Cancelled': '#ef4444',
      'Rescheduled': '#8b5cf6'
    };
    return colors[status] || '#6b7280';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'High': '#ef4444',
      'Medium': '#f59e0b',
      'Low': '#10b981'
    };
    return colors[priority] || '#6b7280';
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="timeline-modal-overlay" onClick={onClose}>
      <div className="timeline-modal" onClick={(e) => e.stopPropagation()}>
        {loading && <CrmPreloader text="Loading Timeline..." />}
        
        <div className="timeline-modal-header">
          <div>
            <h2>Lead Timeline - {lead.leadCode}</h2>
            <p className="timeline-lead-name">{lead.name}</p>
          </div>
          <button className="timeline-modal-close" onClick={onClose}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="timeline-lead-summary">
          <div className="timeline-summary-item">
            <span className="timeline-summary-label">Status:</span>
            <span className={`timeline-status-badge status-${lead.status?.toLowerCase().replace(' ', '-')}`}>
              {lead.status}
            </span>
          </div>
          <div className="timeline-summary-item">
            <span className="timeline-summary-label">Priority:</span>
            <span className={`timeline-priority-badge priority-${lead.priority?.toLowerCase()}`}>
              {lead.priority}
            </span>
          </div>
          <div className="timeline-summary-item">
            <span className="timeline-summary-label">Assigned To:</span>
            <span className="timeline-summary-value">{lead.assignedToName || 'Unassigned'}</span>
          </div>
          <div className="timeline-summary-item">
            <span className="timeline-summary-label">Created:</span>
            <span className="timeline-summary-value">{formatDate(lead.createdAt)}</span>
          </div>
        </div>

        <div className="timeline-tabs">
          <button
            className={`timeline-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History ({history.length})
          </button>
          <button
            className={`timeline-tab ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => setActiveTab('followups')}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Follow-ups ({followups.length})
          </button>
        </div>

        <div className="timeline-content">
          {activeTab === 'timeline' && (
            <div className="timeline-list">
              {history.length === 0 ? (
                <div className="timeline-empty">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No history available yet</p>
                </div>
              ) : (
                history.map((item, index) => (
                  <div key={item.id} className="timeline-item">
                    <div className="timeline-item-icon">
                      {getActionIcon(item.actionType)}
                    </div>
                    <div className="timeline-item-content">
                      <div className="timeline-item-header">
                        <h4>{item.description || item.actionType.replace('_', ' ')}</h4>
                        <span className="timeline-item-time">{formatDateTime(item.createdAt)}</span>
                      </div>
                      {item.fieldChanged && (
                        <div className="timeline-item-change">
                          <span className="timeline-change-label">{item.fieldChanged}:</span>
                          {item.oldValue && (
                            <>
                              <span className="timeline-change-old">{item.oldValue}</span>
                              <span className="timeline-change-arrow">→</span>
                            </>
                          )}
                          <span className="timeline-change-new">{item.newValue}</span>
                        </div>
                      )}
                      <div className="timeline-item-footer">
                        <span className="timeline-item-user">
                          By {item.createdByName || 'System'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'followups' && (
            <div className="followups-list">
              {followups.length === 0 ? (
                <div className="timeline-empty">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>No follow-ups scheduled yet</p>
                  <button className="timeline-btn-primary" onClick={onAddFollowup}>
                    Add First Follow-up
                  </button>
                </div>
              ) : (
                followups.map((followup) => (
                  <div key={followup.id} className="followup-card">
                    <div className="followup-card-header">
                      <div className="followup-type">
                        <span className="followup-type-icon">
                          {followup.followupType === 'Call' && '📞'}
                          {followup.followupType === 'Email' && '📧'}
                          {followup.followupType === 'Meeting' && '👥'}
                          {followup.followupType === 'Visit' && '🏢'}
                          {followup.followupType === 'Demo' && '💻'}
                          {followup.followupType === 'Proposal' && '📄'}
                          {!['Call', 'Email', 'Meeting', 'Visit', 'Demo', 'Proposal'].includes(followup.followupType) && '📌'}
                        </span>
                        <span className="followup-type-text">{followup.followupType}</span>
                      </div>
                      <div className="followup-badges">
                        <span 
                          className="followup-status-badge"
                          style={{ background: getStatusColor(followup.status) }}
                        >
                          {followup.status}
                        </span>
                        <span 
                          className="followup-priority-badge"
                          style={{ borderColor: getPriorityColor(followup.priority) }}
                        >
                          {followup.priority}
                        </span>
                      </div>
                    </div>

                    <div className="followup-card-body">
                      <div className="followup-detail">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Scheduled: {formatDateTime(followup.scheduledAt)}</span>
                      </div>

                      <div className="followup-detail">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Assigned to: {followup.assignedToName || 'Unassigned'}</span>
                      </div>

                      {followup.notes && (
                        <div className="followup-notes">
                          <strong>Notes:</strong>
                          <p>{followup.notes}</p>
                        </div>
                      )}

                      {followup.outcome && (
                        <div className="followup-outcome">
                          <strong>Outcome:</strong>
                          <p>{followup.outcome}</p>
                        </div>
                      )}
                    </div>

                    <div className="followup-card-footer">
                      <span className="followup-created">
                        Created by {followup.createdByName} on {formatDate(followup.createdAt)}
                      </span>
                      {followup.completedAt && (
                        <span className="followup-completed">
                          Completed: {formatDateTime(followup.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="timeline-modal-footer">
          <button className="timeline-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="timeline-btn-primary" onClick={onAddFollowup}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Follow-up
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeadTimelineModal;