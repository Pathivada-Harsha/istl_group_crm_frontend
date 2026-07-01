import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../pages-css/Analytics.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const SCOPE_LABEL = { all: 'All members', team: 'Your team', self: 'You' };

const TeamLeadPerformance = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('created');

  const user = useMemo(() => {
    try {
      const s = JSON.parse(localStorage.getItem('bd_portal_user') || '{}');
      return s?.user || s || {};
    } catch { return {}; }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/team-performance`, {
        credentials: 'include',
        headers: { 'User-Id': String(user.id || 1), 'User-Role': user.role || '' },
      });
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message || 'Failed to load team performance');
    } catch { setError('Could not reach the service.'); }
    finally { setLoading(false); }
  }, [user.id, user.role]);

  useEffect(() => { load(); }, [load]);

  const members = useMemo(() => {
    const rows = (data && data.members) ? [...data.members] : [];
    rows.sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
    return rows;
  }, [data, sortKey]);

  const totals = useMemo(() => {
    return members.reduce((t, m) => ({
      created: t.created + (m.created || 0),
      owned: t.owned + (m.owned || 0),
      assigned: t.assigned + (m.assigned || 0),
      won: t.won + (m.won || 0),
    }), { created: 0, owned: 0, assigned: 0, won: 0 });
  }, [members]);

  const cols = [
    { k: 'created',  l: 'Created',  hint: 'Entered into system' },
    { k: 'owned',    l: 'Owned',    hint: 'Lead owner' },
    { k: 'assigned', l: 'Handling', hint: 'Currently assigned' },
    { k: 'won',      l: 'Won',      hint: 'Closed Won' },
  ];

  return (
    <div className="anl-root">
      <div className="anl-bg" aria-hidden="true" />
      <header className="anl-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="anl-expand" onClick={() => navigate(-1)} title="Back"><ArrowLeft size={16} /></button>
          <div>
            <h1 className="anl-title">Team Lead Performance</h1>
            <p className="anl-sub">
              {data ? `Showing: ${SCOPE_LABEL[data.scope] || data.scope}` : 'Who creates, owns, handles and wins leads'}
            </p>
          </div>
        </div>
      </header>

      {loading && <div className="anl-state">Loading...</div>}
      {error && !loading && <div className="anl-state anl-state--err">{error}</div>}

      {!loading && !error && data && (
        <div className="anl-panel">
          <div className="anl-panel-head">
            <div><h3>Per-person breakdown</h3><span>Created vs owned vs handling vs won</span></div>
          </div>
          {members.length === 0 ? (
            <div className="anl-empty">No team members in scope.</div>
          ) : (
            <div className="tlp-table-wrap">
              <table className="tlp-table">
                <thead>
                  <tr>
                    <th className="tlp-th-name">Member</th>
                    <th>Role</th>
                    {cols.map(c => (
                      <th key={c.k} className={`tlp-th-num ${sortKey === c.k ? 'is-sorted' : ''}`}
                          onClick={() => setSortKey(c.k)} title={`${c.hint} (click to sort)`}>
                        {c.l}{sortKey === c.k ? ' \u25be' : ''}
                      </th>
                    ))}
                    <th className="tlp-th-num">Conv %</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={m.userId || i}>
                      <td className="tlp-name">{m.name}</td>
                      <td><span className="tlp-role">{(m.role || '').replace(/_/g, ' ')}</span></td>
                      <td className="tlp-num">{m.created}</td>
                      <td className="tlp-num">{m.owned}</td>
                      <td className="tlp-num">{m.assigned}</td>
                      <td className="tlp-num tlp-won">{m.won}</td>
                      <td className="tlp-num">{m.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="tlp-name">Total</td>
                    <td />
                    <td className="tlp-num">{totals.created}</td>
                    <td className="tlp-num">{totals.owned}</td>
                    <td className="tlp-num">{totals.assigned}</td>
                    <td className="tlp-num tlp-won">{totals.won}</td>
                    <td className="tlp-num">{totals.assigned === 0 ? 0 : Math.round((totals.won / totals.assigned) * 1000) / 10}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="tlp-note">
            Created = who entered the lead. Owned = lead owner field. Handling = assigned to OR closed by this user. Won = closed by this user (or assigned to them if no closer recorded). Conv% = Won ÷ Handling.
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamLeadPerformance;