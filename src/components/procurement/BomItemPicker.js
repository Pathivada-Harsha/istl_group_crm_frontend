import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, PackageSearch, AlertTriangle } from 'lucide-react';
import '../../components_css/procurement/BomItemPicker.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const getUser = () => {
  try {
    const raw = localStorage.getItem('bd_portal_user');
    return raw ? (JSON.parse(raw)?.user || {}) : {};
  } catch { return {}; }
};

const authHeaders = () => {
  const u = getUser();
  const id = String(u.id || '');
  const role = String(u.role || '');
  return {
    'Content-Type': 'application/json',
    'User-Id': id, 'User-Role': role,
    'X-User-Id': id, 'X-User-Role': role,
  };
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Trim trailing zeros so "20.000" reads as "20". */
const qty = (v) => {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
};

const money = (v) =>
  `₹${num(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * BomItemPicker — pick lines from a project's BOM to load into a quotation or a
 * purchase order.
 *
 * Shared by both procurement pages so the two can never drift on what "remaining"
 * means. Quantities default to what is still un-ordered but stay editable; rates are
 * shown only when the backend says this role may see them, which mirrors the rule on
 * the project BOM tab itself.
 *
 * Selection is ADDITIVE: the picker can be reopened to add more lines without
 * disturbing rows already in the table. Lines already loaded are shown as such and
 * cannot be double-added.
 *
 * @param {boolean}  open
 * @param {string}   projectUniqueId  the project whose BOM to list
 * @param {number}   excludePoId      when editing a PO, its own quantities must not
 *                                    count as "already ordered" against itself
 * @param {Array}    alreadyLoadedIds bomLineIds already present in the caller's table
 * @param {function} onAdd            called with the chosen lines
 * @param {function} onClose
 * @param {function} showError
 */
const BomItemPicker = ({
  open,
  projectUniqueId,
  excludePoId = null,
  alreadyLoadedIds = [],
  onAdd,
  onClose,
  showError,
}) => {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState([]);
  const [canSeeRates, setCanSeeRates] = useState(true);
  const [selected, setSelected] = useState({});   // bomLineId -> qty string
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !projectUniqueId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const params = excludePoId ? `?excludePoId=${encodeURIComponent(excludePoId)}` : '';
        const res = await fetch(
          `${API_BASE_URL}/projects/${encodeURIComponent(projectUniqueId)}/bom/procurement-availability${params}`,
          { credentials: 'include', headers: authHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setLines(body?.data?.lines || []);
        setCanSeeRates(body?.data?.canSeeRates !== false);
        setSelected({});
      } catch (e) {
        if (cancelled) return;
        setError('Could not load this project’s BOM.');
        if (showError) showError('Failed to load project BOM');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, projectUniqueId, excludePoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadedSet = useMemo(
    () => new Set((alreadyLoadedIds || []).filter(Boolean).map(Number)),
    [alreadyLoadedIds]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(l =>
      [l.itemName, l.make, l.specification, l.category]
        .filter(Boolean)
        .some(s => String(s).toLowerCase().includes(q))
    );
  }, [lines, search]);

  if (!open) return null;

  const toggle = (line) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[line.bomLineId] !== undefined) delete next[line.bomLineId];
      else next[line.bomLineId] = qty(line.remaining);
      return next;
    });
  };

  const setQty = (bomLineId, raw) => {
    if (raw !== '' && !/^\d*\.?\d{0,3}$/.test(raw)) return;
    setSelected(prev => ({ ...prev, [bomLineId]: raw }));
  };

  const selectAllVisible = () => {
    const next = { ...selected };
    visible.forEach(l => {
      if (loadedSet.has(Number(l.bomLineId))) return;
      if (next[l.bomLineId] === undefined) next[l.bomLineId] = qty(l.remaining);
    });
    setSelected(next);
  };

  const clearAll = () => setSelected({});

  const chosen = Object.keys(selected);

  const handleAdd = () => {
    const rows = chosen
      .map(id => {
        const line = lines.find(l => String(l.bomLineId) === String(id));
        if (!line) return null;
        return {
          bomLineId: line.bomLineId,
          bomItemId: line.bomItemId,
          variantId: line.variantId,
          itemName: line.itemName,
          make: line.make || '',
          specification: line.specification || '',
          unit: line.unit || 'Nos',
          quantity: selected[id] === '' ? '0' : selected[id],
          bomQty: line.bomQty,
          alreadyOrdered: line.alreadyOrdered,
          remaining: line.remaining,
          unitRate: canSeeRates ? line.unitRate : null,
        };
      })
      .filter(Boolean);

    if (!rows.length) return;
    onAdd(rows);
    onClose();
  };

  return (
    <div className="bip-overlay" onClick={onClose}>
      <div className="bip-modal" onClick={e => e.stopPropagation()}>
        <div className="bip-header">
          <div className="bip-title">
            <PackageSearch size={18} />
            <span>Load items from Project BOM</span>
          </div>
          <button type="button" className="bip-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="bip-toolbar">
          <div className="bip-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search item, make or specification…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="bip-toolbar-actions">
            <button type="button" className="bip-link-btn" onClick={selectAllVisible}>Select all</button>
            <button type="button" className="bip-link-btn" onClick={clearAll}>Clear</button>
          </div>
        </div>

        <div className="bip-body">
          {loading && <div className="bip-state">Loading project BOM…</div>}

          {!loading && error && (
            <div className="bip-state bip-state-error">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {!loading && !error && lines.length === 0 && (
            <div className="bip-state">
              This project has no BOM lines yet. Add them on the project&rsquo;s BOM / BOQ tab first.
            </div>
          )}

          {!loading && !error && lines.length > 0 && visible.length === 0 && (
            <div className="bip-state">No BOM lines match &ldquo;{search}&rdquo;.</div>
          )}

          {!loading && !error && visible.length > 0 && (
            <table className="bip-table">
              <colgroup>
                <col style={{ width: 40 }} />
                <col />
                <col style={{ width: 120 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 120 }} />
                {canSeeRates && <col style={{ width: 110 }} />}
              </colgroup>
              <thead>
                <tr>
                  <th />
                  <th>Item</th>
                  <th>Make</th>
                  <th>Unit</th>
                  <th className="bip-num">BOM qty</th>
                  <th className="bip-num">Already ordered</th>
                  <th className="bip-num">Remaining</th>
                  <th className="bip-num">Quantity to add</th>
                  {canSeeRates && <th className="bip-num">Rate</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map(l => {
                  const isLoaded = loadedSet.has(Number(l.bomLineId));
                  const isChecked = selected[l.bomLineId] !== undefined;
                  const over = isChecked && num(selected[l.bomLineId]) > num(l.remaining);
                  const exhausted = num(l.remaining) <= 0;

                  return (
                    <tr
                      key={l.bomLineId}
                      className={[
                        isChecked ? 'bip-row-selected' : '',
                        isLoaded ? 'bip-row-loaded' : '',
                      ].join(' ').trim()}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLoaded}
                          onChange={() => toggle(l)}
                          title={isLoaded ? 'Already in the item table' : undefined}
                        />
                      </td>
                      <td>
                        <div className="bip-item-name">{l.itemName}</div>
                        {l.specification && <div className="bip-item-spec">{l.specification}</div>}
                        {isLoaded && <span className="bip-tag">already added</span>}
                        {!isLoaded && exhausted && (
                          <span className="bip-tag bip-tag-warn">fully ordered</span>
                        )}
                      </td>
                      <td>{l.make || '—'}</td>
                      <td>{l.unit || '—'}</td>
                      <td className="bip-num">{qty(l.bomQty)}</td>
                      <td className="bip-num">{qty(l.alreadyOrdered)}</td>
                      <td className="bip-num">
                        <strong>{qty(l.remaining)}</strong>
                      </td>
                      <td className="bip-num">
                        <input
                          type="text"
                          className={`bip-qty${over ? ' bip-qty-over' : ''}`}
                          value={isChecked ? selected[l.bomLineId] : ''}
                          disabled={!isChecked}
                          onChange={e => setQty(l.bomLineId, e.target.value)}
                          title={over ? 'More than the remaining quantity' : undefined}
                        />
                      </td>
                      {canSeeRates && <td className="bip-num">{money(l.unitRate)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bip-footer">
          <div className="bip-footer-note">
            {chosen.length > 0
              ? `${chosen.length} line${chosen.length === 1 ? '' : 's'} selected`
              : 'Tick the lines you want to add. Quantities default to what is still un-ordered.'}
          </div>
          <div className="bip-footer-actions">
            <button type="button" className="bip-btn bip-btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="bip-btn bip-btn-primary"
              disabled={chosen.length === 0}
              onClick={handleAdd}
            >
              Add {chosen.length > 0 ? chosen.length : ''} to order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BomItemPicker;
