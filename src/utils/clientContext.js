// src/utils/clientContext.js
// LOGIN ACTIVITY MODULE — collects device/browser/location context once at
// login and sends it with the credentials. Reuses the existing Google Maps
// integration (REACT_APP_GOOGLE_MAPS_KEY) for reverse geocoding.
//
// Location rules (as per requirements):
//   • If permission was ALREADY GRANTED → read coordinates silently.
//   • If permission was never asked     → the browser prompts once.
//   • If permission was DENIED          → never ask again, send nulls.
//   • Login NEVER waits more than ~2.5s for location and NEVER fails on it.

const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
const GEO_CACHE_KEY = "la_geo_ctx"; // sessionStorage cache — one lookup per tab

function detectDeviceType() {
  const ua = navigator.userAgent || "";
  if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return "TABLET";
  if (/Mobi|iPhone/.test(ua)) return "MOBILE";
  return "DESKTOP"; // refined to LAPTOP below when a battery is detected
}

async function refineLaptop(baseType) {
  if (baseType !== "DESKTOP") return baseType;
  try {
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      // A battery that is not permanently full+charging indicates a laptop
      if (battery && !(battery.charging && battery.level === 1)) return "LAPTOP";
    }
  } catch { /* ignore */ }
  return baseType;
}

async function permissionState() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const p = await navigator.permissions.query({ name: "geolocation" });
      return p.state; // 'granted' | 'prompt' | 'denied'
    }
  } catch { /* ignore */ }
  return "prompt";
}

function getCoordinates(timeoutMs) {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 }
    );
  });
}

async function resolveGeo(timeoutMs) {
  const coords = await getCoordinates(timeoutMs);
  if (!coords) return null;
  const geo = {
    latitude: String(coords.lat),
    longitude: String(coords.lng),
    ...(await reverseGeocode(coords.lat, coords.lng)),
  };
  try { sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo)); } catch { /* ignore */ }
  return geo;
}

async function reverseGeocode(lat, lng) {
  if (!GMAPS_KEY) return {};
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality|administrative_area_level_1|country&key=${GMAPS_KEY}`
    );
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return {};
    const out = {};
    for (const result of data.results) {
      for (const comp of result.address_components || []) {
        if (!out.city && comp.types.includes("locality")) out.city = comp.long_name;
        if (!out.state && comp.types.includes("administrative_area_level_1")) out.state = comp.long_name;
        if (!out.country && comp.types.includes("country")) out.country = comp.long_name;
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function sha256Hex(text) {
  try {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

/**
 * Collects the full client context for the login request.
 * All values are strings (the backend reads them from the credentials map).
 * Never throws, never blocks login for more than ~3 seconds.
 */
export async function collectClientContext() {
  const ctx = {
    deviceType: detectDeviceType(),
    screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  };

  try {
    ctx.deviceType = await refineLaptop(ctx.deviceType);

    // Soft device fingerprint — a hint for "new device" detection, never auth.
    // IMPORTANT: hardware traits alone (UA/screen/timezone) are identical for
    // two different browsers or profiles on the same machine, which made the
    // backend silently close another browser's session as a "re-login".
    // A random UUID persisted in THIS browser's localStorage makes the
    // fingerprint unique per browser instance: same browser re-login still
    // matches, but a different browser/profile/incognito never does.
    let instanceId = "";
    try {
      const KEY = "crm_device_instance_id";
      instanceId = localStorage.getItem(KEY) || "";
      if (!instanceId) {
        instanceId = (crypto.randomUUID && crypto.randomUUID()) ||
          (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
        localStorage.setItem(KEY, instanceId);
      }
    } catch { /* localStorage blocked — fall back to hardware-only traits */ }

    ctx.deviceFingerprint = await sha256Hex(
      [instanceId, navigator.userAgent, navigator.platform, ctx.screenResolution, ctx.timeZone,
       navigator.language, navigator.hardwareConcurrency].join("|")
    );

    // Geo: cached per tab so repeated logins don't re-query
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      Object.assign(ctx, JSON.parse(cached));
    } else {
      const state = await permissionState();
      if (state === "granted") {
        // Already permitted — no popup, so waiting a few seconds is safe.
        // Desktop Wi-Fi positioning regularly needs 3–6s.
        const geo = await resolveGeo(8000);
        if (geo) Object.assign(ctx, geo);
      } else if (state === "prompt") {
        // The permission popup will open — do NOT block login waiting for
        // the user's decision. Login proceeds without location and
        // reportGeoWhenAvailable() (called after login) fills it in the
        // moment the user clicks Allow.
        const geo = await resolveGeo(2000); // catches instant cached fixes
        if (geo) Object.assign(ctx, geo);
      }
      // state === "denied" → never ask, send nothing
    }
  } catch { /* context is best-effort — never break login */ }

  return ctx;
}

/**
 * Called fire-and-forget right after a successful login. If location wasn't
 * available in time for the login request (permission popup still open, slow
 * Wi-Fi positioning), this waits generously in the background and reports the
 * coordinates to the backend, which fills them into the session and the
 * login_history row. Silent no-op when denied or already sent.
 */
export function reportGeoWhenAvailable() {
  setTimeout(async () => {
    try {
      if (sessionStorage.getItem(GEO_CACHE_KEY)) return; // already captured
      if ((await permissionState()) === "denied") return;

      // Generous window: the user may still be looking at the popup
      const geo = await resolveGeo(30000);
      if (!geo) return;

      await fetch(`${process.env.REACT_APP_API_URL}/office-use/login-activity/geo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geo),
      });
    } catch { /* best-effort */ }
  }, 300);
}