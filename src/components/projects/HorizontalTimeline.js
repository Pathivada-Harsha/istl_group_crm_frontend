import React from 'react';
import { Calendar, Package, FileText, Receipt, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import '../../components_css/projects/HorizontalTimeline.css';

const HorizontalTimeline = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="horizontal-timeline-empty">
        <Clock size={48} />
        <p>No timeline events available</p>
      </div>
    );
  }

  const getEventIcon = (type) => {
    const icons = {
      'po_created': <FileText size={20} />,
      'po_delivered': <Package size={20} />,
      'bill_received': <Receipt size={20} />,
      'bill_paid': <CheckCircle size={20} />,
      'invoice_raised': <FileText size={20} />,
      'invoice_paid': <TrendingUp size={20} />,
      'milestone': <Calendar size={20} />
    };
    return icons[type] || <Calendar size={20} />;
  };

  const getEventColor = (type) => {
    const colors = {
      'po_created': '#3b82f6',
      'po_delivered': '#22c55e',
      'bill_received': '#f59e0b',
      'bill_paid': '#8b5cf6',
      'invoice_raised': '#06b6d4',
      'invoice_paid': '#10b981',
      'milestone': '#ec4899'
    };
    return colors[type] || '#94a3b8';
  };

  const formatCurrency = (amount) => {
    if (!amount) return '';
    const value = Number(amount);
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="horizontal-timeline-container">
      <div className="horizontal-timeline-track"></div>
      
      <div className="horizontal-timeline-events">
        {events.map((event, index) => (
          <div 
            key={index} 
            className="horizontal-timeline-event"
            style={{ '--event-color': getEventColor(event.type) }}
          >
            <div 
              className="timeline-event-marker"
              style={{ backgroundColor: getEventColor(event.type) }}
            >
              {getEventIcon(event.type)}
            </div>
            
            <div className="timeline-event-connector"></div>
            
            <div className="timeline-event-card">
              <div className="timeline-event-date">
                {formatDate(event.date)}
              </div>
              <div className="timeline-event-title">
                {event.title}
              </div>
              <div className="timeline-event-description">
                {event.description}
              </div>
              {event.amount && (
                <div className="timeline-event-amount">
                  {formatCurrency(event.amount)}
                </div>
              )}
              {event.reference && (
                <div className="timeline-event-reference">
                  Ref: {event.reference}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HorizontalTimeline;