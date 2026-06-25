import React, { useState, useRef, useEffect } from 'react';
import { useEnergy } from '../context/EnergyContext';
import './EnergyRoleSwitcher.css';

const ROLE_META = {
  Admin:    { icon: 'M12 2a5 5 0 100 10 5 5 0 000-10zM4 20c0-4 3.58-7 8-7s8 3 8 7', label: 'Admin',    color: '#7c3aed' },
  Operator: { icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', label: 'Operator', color: '#0ea5e9' },
  Lender:   { icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3', label: 'Lender',   color: '#f59e0b' },
};

export default function EnergyRoleSwitcher() {
  const { activeRole, switchRole } = useEnergy();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = ROLE_META[activeRole] || ROLE_META['Admin'];

  return (
    <div className="ers-wrapper" ref={ref}>
      <button className="ers-trigger" onClick={() => setOpen(o => !o)} title="Switch Energy Role">
        <span className="ers-dot" style={{ background: current.color }} />
        <svg className="ers-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth={1.8} d={current.icon} />
        </svg>
        <span className="ers-label">{current.label}</span>
        <svg className={`ers-chevron ${open ? 'open' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12">
          <path strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="ers-dropdown">
          <div className="ers-dropdown-label">Energy Role</div>
          {Object.entries(ROLE_META).map(([role, meta]) => (
            <button
              key={role}
              className={`ers-option ${activeRole === role ? 'active' : ''}`}
              onClick={() => { switchRole(role); setOpen(false); }}
            >
              <span className="ers-option-dot" style={{ background: meta.color }} />
              <svg className="ers-option-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth={1.8} d={meta.icon} />
              </svg>
              <span>{meta.label}</span>
              {activeRole === role && (
                <svg className="ers-check" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                  <path strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
