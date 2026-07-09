// ─────────────────────────────────────────────────────────────────────────────
//  LocationPicker — embedded Google map for capturing a site location.
//  • search box (Places autocomplete) to jump to an address
//  • click on the map or drag the pin to set the exact spot
//  • reverse-geocodes the pin to fill the address text
//  • emits { address, lat, lng } up to the parent
//  Degrades gracefully: if the key is missing or the script fails, it falls
//  back to a plain text input so the field still works.
//
//  Shared between the Order Book detail page and the Lead Site-Visit tab.
//  Props: { address, lat, lng, onChange, showError, className, label }
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import { loadGoogleMaps, DEFAULT_CENTER } from '../utils/googleMaps.js';
import './LocationPicker.css';

const LocationPicker = ({ address, lat, lng, onChange, showError, className = '', label = 'Site Location' }) => {
  const mapEl = useRef(null);
  const searchEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const gmRef = useRef(null); // resolved { Map, Marker, Geocoder, LatLng, places }
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable
  const [errMsg, setErrMsg] = useState('');

  const hasPin = lat !== '' && lat != null && lng !== '' && lng != null;

  // Reverse-geocode a LatLng → address string, pushed up via onChange.
  const reverseGeocode = useCallback((position) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode({ location: position }, (results, st) => {
      if (st === 'OK' && results && results[0]) {
        onChange({ address: results[0].formatted_address, lat: position.lat(), lng: position.lng() });
      } else {
        onChange({ lat: position.lat(), lng: position.lng() });
      }
    });
  }, [onChange]);

  const placePin = useCallback((position) => {
    if (!mapRef.current || !gmRef.current) return;
    if (!markerRef.current) {
      markerRef.current = new gmRef.current.Marker({
        position, map: mapRef.current, draggable: true,
      });
      markerRef.current.addListener('dragend', (e) => reverseGeocode(e.latLng));
    } else {
      markerRef.current.setPosition(position);
    }
    mapRef.current.panTo(position);
  }, [reverseGeocode]);

  useEffect(() => {
    let cancelled = false;
    const listeners = [];
    let autocomplete = null;
    loadGoogleMaps()
      .then((gm) => {
        if (cancelled || !mapEl.current) return;
        gmRef.current = gm;
        const start = hasPin ? { lat: Number(lat), lng: Number(lng) } : DEFAULT_CENTER;
        mapRef.current = new gm.Map(mapEl.current, {
          center: start, zoom: hasPin ? 16 : 11, mapTypeControl: true, streetViewControl: false,
        });
        geocoderRef.current = new gm.Geocoder();
        if (hasPin) placePin(new gm.LatLng(start.lat, start.lng));

        // Click to drop / move the pin.
        listeners.push(mapRef.current.addListener('click', (e) => { placePin(e.latLng); reverseGeocode(e.latLng); }));

        // Places search box (only if the Places library loaded).
        if (searchEl.current && gm.places && gm.places.Autocomplete) {
          autocomplete = new gm.places.Autocomplete(searchEl.current, { fields: ['geometry', 'formatted_address'] });
          autocomplete.bindTo('bounds', mapRef.current);
          listeners.push(autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) return;
            const loc = place.geometry.location;
            mapRef.current.setZoom(16);
            placePin(loc);
            onChange({ address: place.formatted_address || searchEl.current.value, lat: loc.lat(), lng: loc.lng() });
          }));
        }
        setStatus('ready');
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('unavailable');
          const msg = err && err.message ? err.message : String(err);
          setErrMsg(msg);
          console.error('Google Maps load failed:', err);
        }
      });

    // Cleanup: detach Google's listeners/marker and remove the Autocomplete
    // dropdown Google appends to <body>. Without this, React's unmount can hit
    // "removeChild ... not a child of this node" because Google mutated the DOM
    // outside React's knowledge.
    return () => {
      cancelled = true;
      try {
        const gm = gmRef.current;
        if (gm && window.google && window.google.maps && window.google.maps.event) {
          listeners.forEach(l => { try { window.google.maps.event.removeListener(l); } catch {} });
          if (autocomplete) { try { window.google.maps.event.clearInstanceListeners(autocomplete); } catch {} }
        }
        if (markerRef.current) { try { markerRef.current.setMap(null); } catch {} markerRef.current = null; }
        // Remove any .pac-container dropdowns Google attached to <body>.
        document.querySelectorAll('.pac-container').forEach(el => { try { el.remove(); } catch {} });
      } catch { /* best-effort cleanup */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback: plain text field when maps can't load — shows WHY.
  if (status === 'unavailable') {
    return (
      <label className={`obd-field obd-field--full ${className}`}><span>{label}</span>
        <input value={address || ''} onChange={e => onChange({ address: e.target.value })}
          placeholder="Type the site address" />
        {errMsg && (
          <div className="obd-loc-error">
            <strong>Map could not load:</strong> {errMsg}
          </div>
        )}
      </label>
    );
  }

  return (
    <div className={`obd-loc ${className}`}>
      <span><MapPin size={13} style={{ verticalAlign: '-2px' }} /> {label}</span>
      <input
        ref={searchEl}
        className="obd-loc-search"
        defaultValue={address || ''}
        placeholder="Search an address, or click / drag the pin on the map"
        onChange={e => onChange({ address: e.target.value })}
      />
      <div className="obd-loc-map-wrap">
        <div ref={mapEl} className="obd-loc-map" />
        {status === 'loading' && <div className="obd-loc-loading">Loading map…</div>}
      </div>
      {hasPin && (
        <div className="obd-loc-coords">
          Pin: {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
          <button type="button" className="obd-loc-clear" onClick={() => {
            if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
            onChange({ address: '', lat: null, lng: null });
          }}>Clear pin</button>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
