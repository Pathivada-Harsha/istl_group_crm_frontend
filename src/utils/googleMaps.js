// ─────────────────────────────────────────────────────────────────────────────
//  Google Maps loader — injects the JS API once, shared across all map pickers.
//  Reads REACT_APP_GOOGLE_MAPS_KEY. Loads the `places` library for search.
//  Returns a promise that resolves when window.google.maps is ready.
//  (Extracted from OrderBookDetailPage so both the order-book and lead site-visit
//   pickers share a single loader instance.)
// ─────────────────────────────────────────────────────────────────────────────
const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
let _gmapsPromise = null;
// Auth failures (bad key / billing off / API not enabled / referrer blocked)
// are reported by Google via this global callback, NOT via promise rejection.
let _gmapsAuthFailed = false;
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => { _gmapsAuthFailed = true; };
}

// Install Google's official inline bootstrap loader. This defines
// google.maps.importLibrary as a queueing stub IMMEDIATELY, so importLibrary()
// calls work regardless of when the script finishes downloading.
const installBootstrap = () => {
  if (window.google && window.google.maps && window.google.maps.importLibrary) return;
  ((g) => {
    let h, a, k, p = 'The Google Maps JavaScript API';
    const c = 'google', l = 'importLibrary', q = '__ib__', m = document;
    let b = window;
    b = b[c] || (b[c] = {});
    const d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams();
    const u = () => h || (h = new Promise(async (f, n) => {
      a = m.createElement('script');
      e.set('libraries', [...r] + '');
      for (k in g) e.set(k.replace(/[A-Z]/g, t => '_' + t[0].toLowerCase()), g[k]);
      e.set('callback', c + '.maps.' + q);
      a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
      d[q] = f;
      a.onerror = () => h = n(Error(p + ' could not load.'));
      a.nonce = m.querySelector('script[nonce]')?.nonce || '';
      m.head.append(a);
    }));
    d[l] ? console.warn(p + ' only loads once. Ignoring:', g)
      : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
  })({ key: GMAPS_KEY, v: 'weekly' });
};

export const loadGoogleMaps = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (_gmapsPromise) return _gmapsPromise;
  if (!GMAPS_KEY) return Promise.reject(new Error('REACT_APP_GOOGLE_MAPS_KEY is not set (check .env — no spaces/quotes — and restart npm start)'));

  _gmapsPromise = (async () => {
    installBootstrap();
    const [{ Map }, markerLib, geo, places] = await Promise.all([
      window.google.maps.importLibrary('maps'),
      window.google.maps.importLibrary('marker'),
      window.google.maps.importLibrary('geocoding'),
      window.google.maps.importLibrary('places'),
    ]);
    if (_gmapsAuthFailed) {
      throw new Error('Google rejected the key (auth failure). Check the Console for the "Google Maps JavaScript API error:" line — common codes: RefererNotAllowed, ApiNotActivated, BillingNotEnabled, InvalidKey.');
    }
    return {
      Map,
      Marker: markerLib.Marker,
      Geocoder: geo.Geocoder,
      LatLng: window.google.maps.LatLng,
      places,
    };
  })();
  return _gmapsPromise;
};

// Default map centre when nothing is picked yet (Hyderabad, India).
export const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 };
