import React from 'react';
import {
  formatMoney,
  formatSignedMoney,
  hasPaise,
  validateRoundOff,
} from '../utils/money';
import '../components_css/TotalsSummary.css';

/**
 * Subtotal / Tax / Round Off / Grand Total, for every financial document.
 *
 * Read-only by default, which is what an OUTGOING document wants (invoices,
 * purchase orders, order book, proposals): the server rounds and the screen
 * reports. Pass `editable` for an INCOMING document (vendor bills, inventory
 * bills, vendor quotations, project expenses), where the round-off is pre-filled
 * with the automatic value and the user may nudge it within a rupee to match the
 * figure the vendor actually printed.
 *
 * On a document that predates the round-off feature the round-off is zero and the
 * grand total still carries its original paise. That row is rendered, muted,
 * rather than hidden — so "Round Off ₹0.00" next to a total ending in .49 reads
 * as "this one was never rounded" instead of looking like a bug.
 *
 * @param {number|string} subtotal      taxable value, exclusive of tax
 * @param {number|string} tax           total tax; ignored when `taxRows` is given
 * @param {Array}  taxRows              optional per-rate rows, `[{label, amount}]`
 * @param {number|string} roundOff      the round-off; in `editable` mode this is
 *                                      the raw input value the host holds
 * @param {number|string} grandTotal    the final total; defaults to exact + roundOff
 * @param {number|string} exactTotal    defaults to subtotal + tax
 * @param {Object} labels               override any of the four row labels
 * @param {boolean} showRoundOffWhenZero  default true — see the note above
 * @param {boolean} dense               tighter padding, for a drawer or a modal
 * @param {string}  className           keeps the host page's own outer box styling
 *
 * Editable mode only:
 * @param {boolean} editable
 * @param {number|string} autoRoundOff  powers the "Reset to auto" control
 * @param {function} onRoundOffChange   `(raw, {valid, paise, message}) => void`
 * @param {string}  roundOffError       the host's own message, if it has one
 * @param {boolean} roundOffDisabled
 */
const TotalsSummary = ({
  subtotal = 0,
  tax = 0,
  taxRows = null,
  exactTotal = null,
  roundOff = 0,
  grandTotal = null,
  labels = {},
  showRoundOffWhenZero = true,
  dense = false,
  className = '',

  editable = false,
  autoRoundOff = 0,
  onRoundOffChange,
  roundOffError = null,
  roundOffDisabled = false,
}) => {
  const L = {
    subtotal: 'Subtotal',
    tax: 'Tax',
    roundOff: 'Round Off',
    grandTotal: 'Grand Total',
    ...labels,
  };

  // The round-off and grand total are defaulted from the other props, so a host
  // can pass as little as subtotal + tax and still get a correct grand total.
  // An invalid round-off contributes zero rather than NaN — the host shows the
  // message and the figure on screen stays one the server would accept.
  const check = validateRoundOff(roundOff);
  const exact = exactTotal !== null && exactTotal !== undefined
    ? Number(exactTotal) || 0
    : (Number(subtotal) || 0) + (Number(tax) || 0);
  const roundOffValue = check.valid ? (check.paise || 0) / 100 : 0;
  const total = grandTotal !== null && grandTotal !== undefined
    ? Number(grandTotal) || 0
    : exact + roundOffValue;

  const roundOffIsZero = !check.valid || roundOffValue === 0;
  const showRoundOff = editable || showRoundOffWhenZero || !roundOffIsZero;
  // A zero round-off beside a total that still has paise is a pre-feature
  // document. Muting the row says so without a sentence of explanation.
  const mutedRoundOff = roundOffIsZero && hasPaise(total);

  const handleChange = (e) => {
    const raw = e.target.value;
    if (onRoundOffChange) onRoundOffChange(raw, validateRoundOff(raw));
  };

  const resetToAuto = () => {
    const auto = (Number(autoRoundOff) || 0).toFixed(2);
    if (onRoundOffChange) onRoundOffChange(auto, validateRoundOff(auto));
  };

  const message = roundOffError || (editable ? check.message : null);
  const canReset = editable && !roundOffDisabled
    && (Number(autoRoundOff) || 0).toFixed(2) !== (Number(roundOffValue) || 0).toFixed(2);

  return (
    <div className={`rof-summary${dense ? ' rof-dense' : ''}${className ? ` ${className}` : ''}`}>
      <div className="rof-row">
        <span className="rof-label">{L.subtotal}</span>
        <span className="rof-value">{formatMoney(subtotal)}</span>
      </div>

      {Array.isArray(taxRows) ? (
        taxRows.map((row, i) => (
          <div className="rof-row" key={row.label || i}>
            <span className="rof-label">{row.label}</span>
            <span className="rof-value">{formatMoney(row.amount)}</span>
          </div>
        ))
      ) : (
        <div className="rof-row">
          <span className="rof-label">{L.tax}</span>
          <span className="rof-value">{formatMoney(tax)}</span>
        </div>
      )}

      {showRoundOff && (
        <div className={`rof-row rof-row--roundoff${mutedRoundOff ? ' rof-zero' : ''}`}>
          <span className="rof-label">
            {L.roundOff}
            {canReset && (
              <button
                type="button"
                className="rof-reset-btn"
                onClick={resetToAuto}
                title="Use the automatically calculated round off"
              >
                Reset to auto ({formatSignedMoney(autoRoundOff)})
              </button>
            )}
          </span>
          {editable ? (
            <span className="rof-value">
              <input
                type="number"
                step="0.01"
                min="-1"
                max="1"
                className={`rof-roundoff-input${message ? ' rof-input-error' : ''}`}
                value={roundOff === null || roundOff === undefined ? '' : roundOff}
                onChange={handleChange}
                disabled={roundOffDisabled}
                aria-label={L.roundOff}
              />
            </span>
          ) : (
            <span className="rof-value">{formatSignedMoney(roundOffValue)}</span>
          )}
        </div>
      )}

      {message && <div className="rof-error">{message}</div>}

      <div className="rof-row rof-row--grand">
        <span className="rof-label">{L.grandTotal}</span>
        <span className="rof-value">{formatMoney(total)}</span>
      </div>
    </div>
  );
};

export default TotalsSummary;
