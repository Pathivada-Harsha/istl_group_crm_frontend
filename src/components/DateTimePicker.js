import React, { useState, useRef, useEffect } from "react";
import "../components_css/DateTimePicker.css";

/*
 * Shared DateTimePicker — date + time calendar dropdown.
 *
 * Extracted from the picker originally defined inline in TaskManagement.js so
 * the same control can be reused across the app (lead follow-ups, tasks, etc.)
 * instead of raw <input type="datetime-local"> fields.
 *
 * Value format: "YYYY-MM-DDTHH:mm"  (identical to a native datetime-local
 * value), so it is a drop-in replacement with no conversion at call sites.
 * Emits "" when cleared.
 *
 * Props:
 *   value        string | ""   current "YYYY-MM-DDTHH:mm"
 *   onChange     fn(string)     called with the new value (or "" when cleared)
 *   placeholder  string         shown when no value is set
 *   min          string         optional "YYYY-MM-DD" lower bound (disables earlier days)
 *   max          string         optional "YYYY-MM-DD" upper bound (disables later days)
 */

const _MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const _DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateTimePicker({ value, onChange, placeholder = 'Select date & time', min, max }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 300 });
  const [tmpD, setTmpD] = useState('');
  const [tmpT, setTmpT] = useState('');
  const [calMo, setCalMo] = useState(new Date().getMonth());
  const [calYr, setCalYr] = useState(new Date().getFullYear());
  const [showYrDT, setShowYrDT] = useState(false);
  const wRef = useRef(null);

  const open = () => {
    setTmpD(value ? value.slice(0, 10) : '');
    setTmpT(value ? value.slice(11, 16) : '');
    if (value) { setCalMo(parseInt(value.slice(5, 7)) - 1); setCalYr(parseInt(value.slice(0, 4))); }
    if (wRef.current) {
      const r = wRef.current.getBoundingClientRect();
      const dH = 380;
      const W = 300; // fixed compact popover width
      const up = window.innerHeight - r.bottom < dH && r.top > dH;
      // keep the popover on-screen horizontally
      let left = r.left;
      if (left + W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - W - 8);
      setPos({ top: up ? r.top - dH - 4 : r.bottom + 4, left, width: W });
    }
    setShow(true);
  };

  useEffect(() => {
    const h = e => { if (wRef.current && !wRef.current.contains(e.target)) { setShow(false); } };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const DIM = new Date(calYr, calMo + 1, 0).getDate();
  const FD = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0, 10);

  const fmtDisp = () => {
    if (!value) return null;
    const [d, t] = value.split('T');
    if (!d) return null;
    const [y, mo, dy] = d.split('-');
    const ts = t ? (() => {
      const [h, m] = t.split(':');
      const hr = parseInt(h, 10);
      return `${hr % 12 === 0 ? 12 : hr % 12}:${String(m).padStart(2, '0')} ${hr >= 12 ? 'PM' : 'AM'}`;
    })() : '';
    return { date: `${dy}-${mo}-${y}`, time: ts };
  };
  const disp = fmtDisp();

  const isDisabled = ds => (min && ds < min) || (max && ds > max);

  return (
    <div ref={wRef} style={{ position: 'relative' }}>
      <button type="button"
        className={`tm-dtp-trigger${show ? ' tm-dtp--open' : ''}${value ? ' tm-dtp--set' : ''}`}
        onClick={show ? () => { setShow(false); } : open}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ flexShrink: 0, color: value ? 'var(--ct-4f46e5, #4f46e5)' : 'var(--ct-94a3b8, #94a3b8)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {disp ? (
          <span className="tm-dtp-val">
            <span className="tm-dtp-date">{disp.date}</span>
            {disp.time && <span className="tm-dtp-time">{disp.time}</span>}
          </span>
        ) : (
          <span className="tm-dtp-ph">{placeholder}</span>
        )}
        {value
          ? <span className="tm-dtp-x" onClick={e => { e.stopPropagation(); onChange(''); setShow(false); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ marginLeft: 'auto', color: 'var(--ct-94a3b8, #94a3b8)', flexShrink: 0, transform: show ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>}
      </button>

      {show && (
        <div className="tm-dtp-dropdown" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
          <div className="tm-dtp-cal-head">
            <button type="button" className="tm-cal-nav"
              onClick={() => { if (calMo === 0) { setCalMo(11); setCalYr(y => y - 1); } else setCalMo(m => m - 1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button type="button" className="tm-dtp-month" onClick={() => setShowYrDT(p => !p)}>
              {_MONTHS[calMo]} <span className="tm-yr-num">{calYr}</span>
            </button>
            <button type="button" className="tm-cal-nav"
              onClick={() => { if (calMo === 11) { setCalMo(0); setCalYr(y => y + 1); } else setCalMo(m => m + 1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {showYrDT ? (
            <div className="tm-yr-grid">
              {Array.from({ length: 16 }, (_, i) => {
                const yr = new Date().getFullYear() - 4 + i;
                return <div key={yr} className={`tm-yr-cell${yr === calYr ? ' tm-yr-sel' : ''}`} onClick={() => { setCalYr(yr); setShowYrDT(false); }}>{yr}</div>;
              })}
            </div>
          ) : (
            <div className="tm-dtp-grid">
              {_DAYS.map(d => <div key={d} className="tm-cal-dl">{d}</div>)}
              {Array.from({ length: FD }).map((_, i) => <div key={`e${i}`} className="tm-cal-cell tm-cal-empty" />)}
              {Array.from({ length: DIM }).map((_, i) => {
                const dy = i + 1;
                const ds = `${calYr}-${String(calMo + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
                const disabled = isDisabled(ds);
                let cls = 'tm-cal-cell';
                if (disabled) cls += ' tm-cal-disabled';
                else if (ds === tmpD) cls += ' tm-dtp-sel';
                else if (ds === tod) cls += ' tm-cal-today';
                return <div key={ds} className={cls}
                  style={disabled ? { opacity: .35, pointerEvents: 'none' } : undefined}
                  onClick={() => { if (!disabled) setTmpD(ds); }}>{dy}</div>;
              })}
            </div>
          )}
          <div className="tm-dtp-time-row">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ct-6366f1, #6366f1)', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
            </svg>
            <span className="tm-dtp-time-lbl">Time</span>
            {(() => {
              // tmpT is 24h "HH:mm". Derive 12h parts for the selects.
              const [hh, mm] = tmpT ? tmpT.split(':') : ['', ''];
              const h24 = hh === '' ? null : parseInt(hh, 10);
              const meridiem = h24 == null ? 'AM' : (h24 >= 12 ? 'PM' : 'AM');
              const h12 = h24 == null ? '' : String(h24 % 12 === 0 ? 12 : h24 % 12);
              const minute = mm === '' ? '' : mm;
              const writeBack = (nh12, nmin, nmer) => {
                if (nh12 === '' || nmin === '') { setTmpT(''); return; }
                let H = parseInt(nh12, 10) % 12;
                if (nmer === 'PM') H += 12;
                setTmpT(`${String(H).padStart(2, '0')}:${String(nmin).padStart(2, '0')}`);
              };
              return (
                <div className="tm-dtp-time-selects">
                  <select className="tm-dtp-tsel" value={h12}
                    onChange={e => writeBack(e.target.value, minute === '' ? '00' : minute, meridiem)}>
                    <option value="" disabled>HH</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h =>
                      <option key={h} value={h}>{h.padStart(2, '0')}</option>)}
                  </select>
                  <span className="tm-dtp-tsep">:</span>
                  <select className="tm-dtp-tsel" value={minute}
                    onChange={e => writeBack(h12 === '' ? '12' : h12, e.target.value, meridiem)}>
                    <option value="" disabled>MM</option>
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m =>
                      <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="tm-dtp-tsel tm-dtp-tsel--mer" value={meridiem}
                    onChange={e => writeBack(h12 === '' ? '12' : h12, minute === '' ? '00' : minute, e.target.value)}>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              );
            })()}
          </div>
          <div className="tm-dtp-footer">
            <div className="tm-dtp-chips">
              <span className={`tm-cal-chip${tmpD ? ' tm-cal-chip--set' : ''}`}>
                {tmpD ? (() => { const [y, m, d] = tmpD.split('-'); return `${d}-${m}-${y}`; })() : 'Date —'}
              </span>
              {tmpT && <>
                <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" /></svg>
                <span className="tm-cal-chip tm-cal-chip--set">
                  {(() => { const [h, m] = tmpT.split(':'); const hr = parseInt(h, 10); return `${hr % 12 === 0 ? 12 : hr % 12}:${String(m).padStart(2, '0')} ${hr >= 12 ? 'PM' : 'AM'}`; })()}
                </span>
              </>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', width: '100%' }}>
              <button type="button" className="tm-cal-clear" onClick={() => { setShow(false); }}>Cancel</button>
              <button type="button" className="tm-cal-apply"
                onClick={() => { onChange(tmpD ? tmpD + 'T' + (tmpT || '00:00') : ''); setShow(false); }}
                disabled={!tmpD}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}