import React from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import '../../components_css/procurement/BomViolationDialog.css';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Values arrive as strings to preserve DECIMAL scale — trim trailing zeros for display. */
const qty = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = num(v);
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
};

const CODE_LABEL = {
  NOT_IN_BOM:      'Not on the project BOM',
  BOM_LINE_GONE:   'BOM line no longer exists',
  EXCEEDS_BOM:     'Over the BOM quantity',
  LEGACY_INCREASE: 'Cannot increase a pre-BOM line',
};

/**
 * BomViolationDialog — renders the project-BOM violations returned by the backend.
 *
 * Used in two modes:
 *  • blocking  (purchase orders) — the save was refused; the PO form stays open
 *    behind this dialog so nothing the user typed is lost. "Open project BOM"
 *    deliberately opens a NEW TAB, so returning and pressing Save again just works.
 *  • warning   (quotations)      — the save succeeded; this is informational.
 *
 * @param {boolean}  open
 * @param {Array}    violations       [{code, lineNos, itemName, bomQty, alreadyOrdered, requested, excess, message}]
 * @param {boolean}  blocking         true = the save was refused
 * @param {string}   projectUniqueId  used to build the BOM deep link
 * @param {function} onClose
 */
const BomViolationDialog = ({
  open,
  violations = [],
  blocking = true,
  projectUniqueId,
  onClose,
}) => {
  if (!open || !violations.length) return null;

  const openBom = () => {
    if (!projectUniqueId) return;
    window.open(`/projects/${encodeURIComponent(projectUniqueId)}?tab=bom`, '_blank', 'noopener');
  };

  return (
    <div className="bvd-overlay" onClick={onClose}>
      <div className={`bvd-modal${blocking ? ' bvd-blocking' : ' bvd-warning'}`} onClick={e => e.stopPropagation()}>
        <div className="bvd-header">
          <div className="bvd-title">
            <AlertTriangle size={18} />
            <span>
              {blocking
                ? `Cannot save — ${violations.length} line${violations.length === 1 ? '' : 's'} breach the project BOM`
                : `${violations.length} line${violations.length === 1 ? '' : 's'} outside the project BOM`}
            </span>
          </div>
          <button type="button" className="bvd-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="bvd-body">
          <p className="bvd-lede">
            {blocking
              ? 'The project BOM is the limit of what may be purchased. Add the item to the BOM, or raise its quantity there, then come back and save again — nothing you have entered will be lost.'
              : 'These lines were saved. A quotation only records what the vendor sent, so this is a warning — but a purchase order for them will be blocked until the BOM covers them.'}
          </p>

          <ul className="bvd-list">
            {violations.map((v, i) => (
              <li key={i} className="bvd-item">
                <div className="bvd-item-head">
                  <span className="bvd-item-name">{v.itemName || '(unnamed item)'}</span>
                  <span className="bvd-code">{CODE_LABEL[v.code] || v.code}</span>
                </div>

                {v.code === 'EXCEEDS_BOM' ? (
                  <div className="bvd-figures">
                    <span><label>BOM</label>{qty(v.bomQty)}</span>
                    <span><label>Already ordered</label>{qty(v.alreadyOrdered)}</span>
                    <span><label>This order</label>{qty(v.requested)}</span>
                    <span className="bvd-excess"><label>Over by</label>{qty(v.excess)}</span>
                  </div>
                ) : (
                  <div className="bvd-figures">
                    <span><label>Requested</label>{qty(v.requested)}</span>
                  </div>
                )}

                {Array.isArray(v.lineNos) && v.lineNos.length > 0 && (
                  <div className="bvd-lines">
                    {v.lineNos.length === 1 ? 'Line ' : 'Lines '}{v.lineNos.join(', ')}
                  </div>
                )}

                {v.message && <div className="bvd-message">{v.message}</div>}
              </li>
            ))}
          </ul>
        </div>

        <div className="bvd-footer">
          {projectUniqueId && (
            <button type="button" className="bvd-btn bvd-btn-link" onClick={openBom}>
              <ExternalLink size={15} />
              Open project BOM in a new tab
            </button>
          )}
          <button type="button" className="bvd-btn bvd-btn-primary" onClick={onClose}>
            {blocking ? 'Back to the order' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BomViolationDialog;
