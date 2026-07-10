// Shared calendar date-range filter — extracted from the Leads Enquiry page so
// other pages (Analytics, etc.) can reuse the exact same control.
//
// Props:
//   appliedFrom / appliedTo {string}  — currently applied ISO dates (yyyy-MM-dd)
//   onApply (from, to)                 — called with two ISO date strings on Apply
//   onClear ()                         — called when the range is cleared
//   defaultOpen {boolean}              — open the calendar immediately on mount
import React, { useState, useRef, useEffect } from 'react';
import '../components_css/DateRangeFilter.css';

const _LD_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _LD_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function DateRangeFilter({ appliedFrom, appliedTo, onApply, onClear, defaultOpen = false }) {
  const [show,   setShow]   = useState(defaultOpen);
  const [from,   setFrom]   = useState(appliedFrom || null);
  const [to,     setTo]     = useState(appliedTo || null);
  const [hover,  setHover]  = useState(null);
  const [calMo,  setCalMo]  = useState(appliedFrom ? parseInt(appliedFrom.slice(5,7)) - 1 : new Date().getMonth());
  const [calYr,  setCalYr]  = useState(appliedFrom ? parseInt(appliedFrom.slice(0,4)) : new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const DIM = new Date(calYr, calMo+1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0,10);

  const inR = d => {
    const hi = to || (from && hover ? hover : null);
    if (!from || !hi) return false;
    const [a,b] = from<=hi ? [from,hi] : [hi,from];
    return d > a && d < b;
  };
  const clickDay = d => {
    if (!from || (from && to)) { setFrom(d); setTo(null); }
    else if (d < from) { setFrom(d); setTo(null); }
    else if (d === from) { setFrom(null); setTo(null); }
    else setTo(d);
  };
  const fmt = d => { if (!d) return ''; const [y,m,dy]=d.split('-'); return `${dy}-${m}-${y}`; };

  const handleApply = () => {
    if (!from) return;
    onApply(from, to || from);
    setShow(false);
  };
  const handleClear = () => {
    setFrom(null); setTo(null); setHover(null);
    onClear();
    setShow(false);
  };

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex' }}>
      <button
        type="button"
        className={`ld-cal-trigger${show?' ld-cal--open':''}${appliedFrom?' ld-cal--applied':''}`}
        onClick={() => setShow(p => !p)}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span className={appliedFrom ? 'ld-cal-val' : 'ld-cal-ph'}>{appliedFrom ? fmt(appliedFrom) : 'dd-mm-yyyy'}</span>
        <span className="ld-cal-sep">—</span>
        <span className={appliedTo && appliedTo !== appliedFrom ? 'ld-cal-val' : 'ld-cal-ph'}>
          {appliedTo && appliedTo !== appliedFrom ? fmt(appliedTo) : 'dd-mm-yyyy'}
        </span>
        {appliedFrom && (
          <span className="ld-cal-x" onClick={e => { e.stopPropagation(); handleClear(); }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </span>
        )}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ marginLeft:'auto', color:'#94a3b8', flexShrink:0,
            transform: show?'rotate(180deg)':'none', transition:'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {show && (
        <div className="ld-cal-dropdown" style={{ position:'absolute', top:'calc(100% + 4px)', right:0, zIndex:9999, width:264 }}>
          <div className="ld-cal-head">
            <button type="button" className="ld-cal-nav"
              onClick={() => { if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <button type="button" className="ld-cal-month-btn" onClick={() => setShowYr(p => !p)}>
              {_LD_MONTHS[calMo]} <span className="ld-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="ld-cal-nav"
              onClick={() => { if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {showYr ? (
            <div className="ld-yr-grid">
              {Array.from({length:16},(_,i) => {
                const yr = new Date().getFullYear()-4+i;
                return (
                  <div key={yr} className={`ld-yr-cell${yr===calYr?' ld-yr-sel':''}`}
                    onClick={() => { setCalYr(yr); setShowYr(false); }}>
                    {yr}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ld-cal-grid">
              {_LD_DAYS.map(d => <div key={d} className="ld-cal-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i) => <div key={`e${i}`} className="ld-cal-cell ld-cal-empty"/>)}
              {Array.from({length:DIM}).map((_,i) => {
                const dy  = i+1;
                const ds  = `${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                const dow = (FD+i)%7;
                let cls   = 'ld-cal-cell';
                if (ds===from)      cls += ' ld-cal-from';
                else if (ds===to)   cls += ' ld-cal-to';
                else if (inR(ds)) {
                  cls += ' ld-cal-in-range';
                  if (dow===0) cls += ' ld-cal-rr-s';
                  if (dow===6) cls += ' ld-cal-rr-e';
                }
                if (ds===tod && ds!==from && ds!==to) cls += ' ld-cal-today';
                return (
                  <div key={ds} className={cls}
                    onClick={() => clickDay(ds)}
                    onMouseEnter={() => from && !to && setHover(ds)}
                    onMouseLeave={() => setHover(null)}>
                    {dy}
                  </div>
                );
              })}
            </div>
          )}

          <div className="ld-cal-footer">
            <div className="ld-cal-chips">
              <span className={`ld-cal-chip${from?' ld-cal-chip--set':''}`}>{from ? fmt(from) : 'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/>
              </svg>
              <span className={`ld-cal-chip${to?' ld-cal-chip--set':''}`}>{to ? fmt(to) : 'To —'}</span>
            </div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%' }}>
              {(from || appliedFrom) && (
                <button type="button" className="ld-cal-clear" onClick={handleClear}>Clear</button>
              )}
              <button type="button" className="ld-cal-clear" onClick={() => setShow(false)}>Cancel</button>
              <button type="button" className="ld-cal-apply" onClick={handleApply} disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
