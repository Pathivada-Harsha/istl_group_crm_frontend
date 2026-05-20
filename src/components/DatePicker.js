import React, { useState, useRef, useEffect } from "react";

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function DatePicker({ value, onChange, placeholder = "Select date" }) {
  const [show, setShow] = useState(false);
  const [month, setMonth] = useState(value ? parseInt(value.slice(5,7)) - 1 : new Date().getMonth());
  const [year, setYear] = useState(value ? parseInt(value.slice(0,4)) : new Date().getFullYear());

  const ref = useRef(null);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setShow(false);
      }
    };
    if (show) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date().toISOString().slice(0,10);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="tm-dtp-trigger"
        onClick={() => setShow(p => !p)}
      >
        {value || placeholder}
      </button>

      {show && (
        <div className="tm-dtp-dropdown">
          <div className="tm-dtp-cal-head">
            <button onClick={() => {
              if (month === 0) { setMonth(11); setYear(y => y - 1); }
              else setMonth(m => m - 1);
            }}>‹</button>

            <span>{MONTHS[month]} {year}</span>

            <button onClick={() => {
              if (month === 11) { setMonth(0); setYear(y => y + 1); }
              else setMonth(m => m + 1);
            }}>›</button>
          </div>

          <div className="tm-dtp-grid">
            {DAYS.map(d => <div key={d}>{d}</div>)}

            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={i}></div>
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

              return (
                <div
                  key={dateStr}
                  className={`tm-cal-cell ${dateStr === value ? 'tm-dtp-sel' : ''} ${dateStr === today ? 'tm-cal-today' : ''}`}
                  onClick={() => {
                    onChange(dateStr);
                    setShow(false);
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}