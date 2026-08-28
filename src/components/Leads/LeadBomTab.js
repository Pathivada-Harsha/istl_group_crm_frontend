// ─────────────────────────────────────────────────────────────────────────────
//  LeadBomTab — Bill of Materials for a lead, organised UNDER the scope.
//
//  Step 2 of the estimation flow:  Scope → BOM → Budget Estimation.
//
//  The BOM is grouped into sections, one per technical-scope activity (all shown,
//  even empty, so the estimator sees the full checklist), plus a "General /
//  Unassigned" section. Each material line is free-text entry — Component |
//  Specifications | Make | Qty | Units | Unit Price | Amount | Notes — and adding
//  a material under a section links it to that scope activity (lead_bom.scope_item_id).
//
//  Two ways to start:
//   • "Suggest whole BOM" — from this project type + capacity (a similar past job
//     scaled to the target, or the standard template). Pre-fills, fully editable.
//   • "Generate from scope" — one blank line per scope activity.
//
//  Auto-sizing is only as good as its inputs — capacity, a basis on the template
//  line, and a numeric attribute on the chosen make. When one is missing the
//  quantity CANNOT be computed, and the rule throughout this tab is that such a
//  line goes blank and says which input it is waiting for. It must never show a
//  zero (which reads as a real answer) or a bare blank (which reads as "still
//  thinking"). The sizing maths itself lives in `recompute` below and mirrors the
//  backend LeadSuggestionEngine.
//
//  Rates live here; the amounts roll up into Budget Estimation.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import './LeadCardHead.css';
import { Wand2, Plus, Save, Trash2, Download, Upload, AlertTriangle, RefreshCw, Info, ExternalLink, Package } from "lucide-react";
import api from "../../services/leadsapi.js";
import ConfirmationModal from "../ConfirmationModal.js";
import useConfirmationModal from "../HandleConfirmationModal.js";
import UnitSelectCell from "../Dropdowns/UnitSelectCell.js";
import ItemNameAutocomplete from "../OrderBook/ItemNameAutocomplete.js";
import { downloadStyledTemplate, readSheetRows, cell } from "./bomExcel.js";
import { SUGGESTION_WARNING_LABELS, lineReason } from "../../constants/scopeActivities.js";
import "./LeadBomTab.css";

// Leads BOM Excel template columns (header + width). Import is per-scope-section,
// so no "Scope Activity" column is needed — the section you import into decides it.
const BOM_TEMPLATE_COLUMNS = [
  { header: "Component", width: 28 }, { header: "Specifications", width: 24 },
  { header: "Make", width: 16 }, { header: "Qty", width: 10 }, { header: "Units", width: 10 },
  { header: "Unit Price", width: 13 }, { header: "Notes", width: 24 },
];
const BOM_TEMPLATE_SAMPLE = ["Solar Module 550Wp", "Mono PERC Bifacial", "Adani", 60, "Nos", 10000, ""];

const fmtINR = n => Number(Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const lineAmount = l => (Number(l.quantity) || 0) * (Number(l.unitRate) || 0);

// Display label for a variant option: "make model" (either part may be blank).
const variantLabel = v => [v?.make, v?.model].filter(Boolean).join(" ").trim();

const GENERAL = "__general__"; // section key for lines with no scope link

// ── Last-procured-cost hint ─────────────────────────────────────────────────
// A read-only suggestion beside the rate: what this exact catalog item, in this
// exact catalog make, last cost on a real PO. Never applied automatically.
//
// Keyed by item+make and NOT by _key or id: blankLine() mints a fresh _key on
// every load() and a new line's id is null, so a key-based cache would go blank
// after every save. Item+make survives reloads untouched.
const hintKey = l => (l?.bomItemId && l?.variantId ? `${l.bomItemId}:${l.variantId}` : null);

// Whether a purchased rate is even comparable to this line. The unit lives on the
// LINE while a hint is shared across every line using that item+make, so this can
// only be decided here — two lines can share one hint and disagree on unit.
//
// Normalisation stops at case and whitespace on purpose. A synonym table
// ("Nos" = "each" = "pcs") is fuzzy matching wearing a hat, and the whole feature
// is built on refusing to guess. A BLANK on either side is not a mismatch — most
// lines carry no unit at all, and treating that as a conflict would disable apply
// almost everywhere.
const normUnit = u => String(u ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const unitsDiffer = (a, b) => {
  const x = normUnit(a), y = normUnit(b);
  return !!x && !!y && x !== y;
};

const fmtHintDate = iso => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
};

// Where a broken quantity RULE is fixed. The lead tab can only report the
// symptom; the cure is always on the template, so every message that names it
// links straight there rather than leaving the estimator to find it.
const TEMPLATE_ADMIN_PATH = "/officeuse/lead-admin";

// Warnings whose real cause is the template, not this lead.
const TEMPLATE_FAULT_CODES = new Set(["NEEDS_BASIS_VALUE", "NEEDS_STEP_VALUE", "NEEDS_SITE_VISIT_FIELD"]);

// ── Make-driven auto-sizing (mirrors backend LeadSuggestionEngine) ───────────
// Bases whose quantity the client re-derives live from capacity + selected make.
const RECALC_BASES = new Set([
  "FIXED", "PER_KW", "PER_STEP", "PER_WATT_PEAK", "PER_INVERTER_KW", "PER_MODULE", "PER_INVERTER",
]);
const round3n = n => Math.round((Number(n) || 0) * 1000) / 1000;
const driverKeyForBasis = b =>
  b === "PER_WATT_PEAK" ? "wattage" : b === "PER_INVERTER_KW" ? "capacity" : null;

// A basis factor counts as set only when it is present AND positive — same rule
// as the backend. A zero factor would size every lead's line to zero, which is
// indistinguishable from a real zero and is the mistake this guards against.
const isSet = v => { const n = Number(v); return v !== "" && v != null && Number.isFinite(n) && n > 0; };

// The numeric driver a line contributes (module Wp / inverter kW): prefer the
// live selected variant's attribute, fall back to the persisted snapshot.
const driverValueOf = (l) => {
  const key = driverKeyForBasis(l.basis);
  if (!key) return null;
  const v = (l.variants || []).find(x => String(x.variantId) === String(l.variantId));
  const raw = v?.attributeValues?.[key];
  let n = raw != null && raw !== ""
    ? Number(raw)
    : (l.driverAttr != null && l.driverAttr !== "" ? Number(l.driverAttr) : NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// What the "auto" caption is auto FROM. Without this, a line whose basis ignores
// the make is indistinguishable from one that reads it: changing the make updates
// the Specifications cell but leaves the quantity alone, which reads as a bug
// rather than as "this line is a fixed quantity". Two words in the cell answer it.
const autoBasisTag = (l) => ({
  PER_WATT_PEAK: "from make",
  PER_INVERTER_KW: "from make",
  PER_KW: "per kW",
  PER_STEP: "per step",
  PER_MODULE: "per module",
  PER_INVERTER: "per inverter",
  FIXED: "fixed",
  FROM_SITE_VISIT: "site visit",
}[l.basis] || null);

// One human hint for the "auto" badge.
const autoBasisHint = (l) => ({
  PER_WATT_PEAK: "Auto: module count = ceil(kW×1000 ÷ make wattage)",
  PER_INVERTER_KW: "Auto: inverter count = ceil(kW ÷ make kW)",
  PER_MODULE: "Auto: scales with the module count",
  PER_INVERTER: "Auto: scales with the inverter count",
  PER_KW: "Auto: quantity = factor × capacity (kW)",
  PER_STEP: "Auto: one unit per N kW",
  FIXED: "Auto: fixed quantity",
  FROM_SITE_VISIT: "Auto: read from the site visit",
}[l.basis] || "Auto-calculated");

// Re-derive every auto line's quantity from capacity (kW) and the chosen makes.
// Two passes: drivers first (module/inverter counts), then dependents. Manual
// lines (autoQty === false) and non-recalc/legacy lines are left untouched.
//
// Every branch either produces a number or blanks the line AND records why —
// there is no path that writes a zero to stand in for a missing input.
const recompute = (rows, kw) => {
  const K = Number(kw);
  const hasKw = Number.isFinite(K) && K > 0;
  const draft = rows.map(l => ({ ...l }));

  let moduleCount = null, inverterCount = null;
  // Pass 1 — driver lines.
  for (const l of draft) {
    if (l.basis !== "PER_WATT_PEAK" && l.basis !== "PER_INVERTER_KW") continue;
    if (l.autoQty !== false) {
      l._flags = [];
      const d = driverValueOf(l);
      if (!hasKw) { l._flags.push("NEEDS_CAPACITY"); l.quantity = ""; }
      else if (d == null) { l._flags.push(l.basis === "PER_WATT_PEAK" ? "NEEDS_MODULE_WATT" : "NEEDS_INVERTER_KW"); l.quantity = ""; }
      else l.quantity = l.basis === "PER_WATT_PEAK" ? Math.ceil((K * 1000) / d) : Math.ceil(K / d);
    }
    const n = Number(l.quantity);
    if (Number.isFinite(n) && n > 0) {
      if (l.basis === "PER_WATT_PEAK") moduleCount = (moduleCount || 0) + n;
      else inverterCount = (inverterCount || 0) + n;
    }
  }
  // Pass 2 — dependents and the remaining capacity-driven bases.
  for (const l of draft) {
    if (l.basis === "PER_WATT_PEAK" || l.basis === "PER_INVERTER_KW") continue;
    if (l.autoQty === false || !RECALC_BASES.has(l.basis)) continue;
    l._flags = [];
    const bvOk = isSet(l.basisValue), svOk = isSet(l.stepValue);
    const bv = Number(l.basisValue), sv = Number(l.stepValue);
    const cannot = (code) => { l._flags.push(code); l.quantity = ""; };
    switch (l.basis) {
      case "FIXED":
        if (!bvOk) cannot("NEEDS_BASIS_VALUE"); else l.quantity = round3n(bv);
        break;
      case "PER_KW":
        if (!bvOk) cannot("NEEDS_BASIS_VALUE");
        else if (!hasKw) cannot("NEEDS_CAPACITY");
        else l.quantity = round3n(bv * K);
        break;
      case "PER_STEP":
        if (!svOk) cannot("NEEDS_STEP_VALUE");
        else if (!hasKw) cannot("NEEDS_CAPACITY");
        else l.quantity = Math.ceil(K / sv);
        break;
      case "PER_MODULE":
        if (!bvOk) cannot("NEEDS_BASIS_VALUE");
        else if (moduleCount == null) cannot("NEEDS_MODULE_DRIVER");
        else l.quantity = Math.ceil(bv * moduleCount);
        break;
      case "PER_INVERTER":
        if (!bvOk) cannot("NEEDS_BASIS_VALUE");
        else if (inverterCount == null) cannot("NEEDS_INVERTER_DRIVER");
        else l.quantity = Math.ceil(bv * inverterCount);
        break;
      default: break;
    }
  }
  draft.forEach(l => { l._review = Array.isArray(l._flags) && l._flags.length > 0; });
  return draft;
};

/**
 * Whether a line's OWN saved snapshot can produce a quantity — mirrors the
 * backend's isConfigured rules. This is what separates a stored zero that was
 * genuinely calculated from one that only ever stood in for a missing input.
 */
const snapshotIncomplete = (l) => {
  switch (l.basis) {
    case "FIXED": case "PER_KW": case "PER_MODULE": case "PER_INVERTER":
      return !isSet(l.basisValue);
    case "PER_STEP":
      return !isSet(l.stepValue);
    case "FROM_SITE_VISIT":
      return !l.siteVisitField;
    case "PER_WATT_PEAK": case "PER_INVERTER_KW":
      return !isSet(l.driverAttr);
    default:
      return false;
  }
};

/**
 * Saved quantities are shown as-saved — a reload must never overwrite a number
 * an estimator put there. Two kinds of line are re-derived instead:
 *
 *  • saved BLANK — they hold nothing to protect, and leaving them blank on reload
 *    is what turned "could not be sized" into something indistinguishable from
 *    "still loading";
 *  • saved as ZERO by a line whose own snapshot can't produce a quantity — these
 *    predate blank quantities being storable, and would otherwise render as a
 *    confident 0 with an "auto" badge, which is exactly the reading this whole
 *    feature exists to prevent.
 *
 * A genuine zero is untouched: a FIXED line with a factor of 5 that computed to 0
 * has a complete snapshot, so it keeps its 0. Manual lines are never re-derived.
 */
const sizeBlankAutoLines = (rows, kw) => {
  const sized = recompute(rows, kw);
  return rows.map((l, i) => {
    if (l.autoQty === false) return l;
    const blank = l.quantity === "" || l.quantity == null;
    const uncalculatedZero = !blank && Number(l.quantity) === 0 && snapshotIncomplete(l);
    if (!blank && !uncalculatedZero) return l;
    const out = sized[i];
    // recompute only owns the RECALC bases, so a FROM_SITE_VISIT line comes back
    // holding its stored zero. Clear it here rather than leave the one basis that
    // can't self-correct showing the number this change exists to remove.
    return uncalculatedZero && Number(out.quantity) === 0 ? { ...out, quantity: "" } : out;
  });
};

/**
 * Which input a blank auto line is waiting for. Prefers the flag recorded when
 * the line was last sized (client recompute or the server's suggestion); falls
 * back to reading the line's own basis, which is what covers a line reloaded
 * from the database, where flags were never persisted.
 */
const missingInputCode = (l, hasKw) => {
  const known = (l._flags || []).find(Boolean);
  if (known) return known;
  switch (l.basis) {
    case "FIXED":
      return isSet(l.basisValue) ? null : "NEEDS_BASIS_VALUE";
    case "PER_KW":
      if (!isSet(l.basisValue)) return "NEEDS_BASIS_VALUE";
      return hasKw ? null : "NEEDS_CAPACITY";
    case "PER_STEP":
      if (!isSet(l.stepValue)) return "NEEDS_STEP_VALUE";
      return hasKw ? null : "NEEDS_CAPACITY";
    case "PER_WATT_PEAK":
      if (!hasKw) return "NEEDS_CAPACITY";
      return driverValueOf(l) == null ? "NEEDS_MODULE_WATT" : null;
    case "PER_INVERTER_KW":
      if (!hasKw) return "NEEDS_CAPACITY";
      return driverValueOf(l) == null ? "NEEDS_INVERTER_KW" : null;
    case "PER_MODULE":
      return isSet(l.basisValue) ? "NEEDS_MODULE_DRIVER" : "NEEDS_BASIS_VALUE";
    case "PER_INVERTER":
      return isSet(l.basisValue) ? "NEEDS_INVERTER_DRIVER" : "NEEDS_BASIS_VALUE";
    case "FROM_SITE_VISIT":
      return l.siteVisitField ? "NEEDS_SITE_VISIT" : "NEEDS_SITE_VISIT_FIELD";
    default:
      return null;
  }
};

/**
 * How the Qty cell describes itself: computed, waiting on an input, typed by
 * hand, or nothing at all for a free-text line that was never meant to size.
 * Three visibly different states — the point is that a glance tells them apart.
 */
const qtyStatus = (l, hasKw) => {
  if (!l.basis) return null;                       // free-text / imported / legacy line
  if (l.autoQty === false) return { kind: "manual" };
  const blank = l.quantity === "" || l.quantity == null;
  if (!blank) return { kind: "auto" };
  const code = missingInputCode(l, hasKw);
  return { kind: "blocked", code, reason: lineReason(code, l.driverAttrLabel) };
};

const blankLine = (scopeItemId = "") => ({
  _key: `n${Math.random().toString(36).slice(2)}`, // stable local key for new rows
  id: null, scopeItemId, category: "", itemName: "", make: "",
  specification: "", unit: "kW", quantity: "", unitRate: "", notes: "",
  // Pick-a-make: catalog link, chosen make, and the allowed makes (constrained dropdown).
  bomItemId: null, variantId: null, variants: [],
  // Auto-sizing: quantity basis snapshot + the numeric driver of the chosen make.
  basis: null, basisValue: null, stepValue: null, siteVisitField: null,
  driverAttr: null, driverAttrKey: null, driverAttrLabel: null, autoQty: true,
  // Which template version this line's basis was copied from.
  sourceTemplateId: null, templateVersion: null,
  _flags: [], _review: false,
});

export default function LeadBomTab({ lead, currentUser, permissions, onRefreshLead, showSuccess, showError }) {
  const canEdit = permissions?.EDIT !== false;

  const [lines, setLines] = useState([]);
  const [scopeItems, setScopeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [sourceNote, setSourceNote] = useState(null);

  // Capacity comes in two flavours and the difference is never left implicit:
  //   capacityKw      — what the Qty column is being sized from right now
  //   savedCapacityKw — what the LEAD actually has recorded (null = none)
  // They differ only while the estimator is trying a what-if, and the field says
  // so. Nothing may quietly overwrite a what-if, and nothing may quietly imply a
  // what-if was saved.
  const [capacityKw, setCapacityKw] = useState(null);
  const [savedCapacityKw, setSavedCapacityKw] = useState(null);
  const [savingCapacity, setSavingCapacity] = useState(false);
  // The "set capacity" box in the notice. null = untouched (so it can show the
  // what-if as a starting point); "" = deliberately cleared, and stays cleared.
  const [newCapacity, setNewCapacity] = useState(null);
  const [templateStatus, setTemplateStatus] = useState(null);

  // Last-procured-cost hints, keyed "bomItemId:variantId". A value of null is a
  // remembered MISS — it stops a pair that has no history being re-asked on every
  // keystroke, which a plain "not in the object" check would do.
  const [hints, setHints] = useState({});
  const hintCache = useRef({});
  // Pairs a request is already fetching, so a second render cannot ask again for
  // something still in flight.
  const hintPending = useRef(new Set());
  const [openHint, setOpenHint] = useState(null);   // _key of the row whose panel is open
  const [staleDays, setStaleDays] = useState(90);

  const { confirmModal, showConfirmation } = useConfirmationModal();
  const fileInputRef = useRef(null);

  const fail = (msg, e) => { if (!e || e.message !== "SESSION_EXPIRED") showError?.(msg); };

  const hasKw = Number.isFinite(Number(capacityKw)) && Number(capacityKw) > 0;
  // A what-if is any capacity in the box that isn't the lead's own. Both being
  // absent is not a difference — that is simply a lead with no capacity.
  const capacityUnsaved = !((capacityKw == null && savedCapacityKw == null)
    || Number(capacityKw) === Number(savedCapacityKw));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bomRes, scopeRes] = await Promise.all([
        api.get(`/leads/${lead.id}/bom`),
        api.get(`/leads/${lead.id}/scope`),
      ]);
      if (bomRes?.success) {
        const kw = bomRes.data?.capacityKw ?? null;
        setCapacityKw(kw);
        setSavedCapacityKw(kw);
        setTemplateStatus(bomRes.data?.templateStatus || null);
        const mapped = (bomRes.data?.lines || []).map(l => ({
          ...blankLine(l.scopeItemId ?? ""),
          id: l.id,
          category: l.category || "",
          itemName: l.itemName || "",
          make: l.make || "",
          specification: l.specification || "",
          unit: l.unit || "",
          quantity: l.quantity ?? "",
          unitRate: l.unitRate ?? "",
          notes: l.notes || "",
          bomItemId: l.bomItemId ?? null,
          variantId: l.variantId ?? null,
          variants: Array.isArray(l.variants) ? l.variants : [],
          basis: l.basis ?? null,
          basisValue: l.basisValue ?? null,
          stepValue: l.stepValue ?? null,
          siteVisitField: l.siteVisitField ?? null,
          driverAttr: l.driverAttr ?? null,
          driverAttrKey: l.driverAttrKey ?? null,
          driverAttrLabel: l.driverAttrLabel ?? null,
          autoQty: l.autoQty !== false,
          sourceTemplateId: l.sourceTemplateId ?? null,
          templateVersion: l.templateVersion ?? null,
        }));
        setLines(sizeBlankAutoLines(mapped, kw));
      }
      if (scopeRes?.success) setScopeItems(scopeRes.data?.items || []);
      setWarnings([]); setSourceNote(null);
    } catch (e) {
      fail("Failed to load BOM", e);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  useEffect(() => { load(); }, [load]);

  // ── Last procured cost ────────────────────────────────────────────────────
  // Only catalog-identified lines can be priced: a free-text line has no item or
  // make to match on, and guessing from its typed name is exactly what this
  // feature refuses to do.
  const pairKeys = useMemo(
    () => [...new Set(lines.map(hintKey).filter(Boolean))].sort(),
    [lines]);

  // One request per tab open, then deltas only. Every way a pair can appear —
  // picking a make, picking an item, adding a line, importing, suggesting,
  // loading a template — funnels through `lines`, so nothing needs its own hook.
  //
  // Responses are NOT sequence-guarded, deliberately. Each request writes only the
  // keys it asked for and asks only for keys nobody else is fetching, so two
  // replies can never disagree about a key and a slow one is still correct when it
  // lands. Discarding it by sequence would strand those pairs with no hint until
  // something unrelated changed the line set.
  useEffect(() => {
    if (loading) return;
    const missing = pairKeys.filter(k => !(k in hintCache.current) && !hintPending.current.has(k));
    if (missing.length === 0) return;

    missing.forEach(k => hintPending.current.add(k));
    (async () => {
      try {
        const res = await api.get(`/leads/${lead.id}/bom/purchase-hints`,
                                  { params: { pairs: missing.join(",") } });
        const got = res?.data?.hints || {};
        // Misses are cached as explicit nulls — see the state comment above.
        for (const k of missing) hintCache.current[k] = got[k] ?? null;
        if (res?.data?.staleDays != null) setStaleDays(res.data.staleDays);
        setHints({ ...hintCache.current });
      } catch (e) {
        // A missing price hint is never worth a toast: the tab is fully usable
        // without it and the rate field behaves exactly as it always has. Nothing
        // is cached, so the next change to the line set retries.
        if (e?.message !== "SESSION_EXPIRED") console.warn("Price hints unavailable", e);
      } finally {
        missing.forEach(k => hintPending.current.delete(k));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKeys.join("|"), loading, lead.id]);


  // ── Capacity ──────────────────────────────────────────────────────────────
  // Typing re-derives every auto line immediately, so the effect of a what-if is
  // visible before any decision about saving it. Recompute stays user-initiated
  // (here / make change / suggest / reset) so a reloaded BOM's saved quantities
  // are never silently overwritten on load.
  const changeCapacity = (raw) => {
    const kw = raw === "" || raw == null ? null : Number(raw);
    setCapacityKw(kw);
    setLines(prev => recompute(prev, kw));
  };

  /**
   * Write a capacity to the lead. The tab works in kW throughout — the field is
   * labelled kW and the sizing maths is kW — so that is what gets stored, rather
   * than reinterpreting the number under whatever unit the lead happened to hold.
   */
  const persistCapacity = async (kw) => {
    setSavingCapacity(true);
    try {
      const res = await api.put(`/leads/${lead.id}/capacity`, { capacity: String(kw), capacityUnit: "kW" });
      if (!res?.success) { showError?.(res?.message || "Failed to save capacity"); return false; }
      const savedKw = res.data?.capacityKw != null ? Number(res.data.capacityKw) : kw;
      setSavedCapacityKw(savedKw);
      setCapacityKw(savedKw);
      setLines(prev => recompute(prev, savedKw));
      showSuccess?.(`Capacity saved to the lead (${savedKw} kW).`);
      onRefreshLead?.();
      return true;
    } catch (e) {
      // The server rejects a capacity it can't size from and says why ("…is not a
      // capacity the BOM can size from"), which beats a generic failure here.
      fail(e?.message || "Failed to save capacity", e);
      return false;
    } finally { setSavingCapacity(false); }
  };

  // Leaving the field offers to make the typed capacity the lead's own. Declining
  // is a real answer — it keeps the value as a what-if rather than reverting it.
  const commitCapacity = async () => {
    if (!canEdit || savingCapacity) return;
    if (!capacityUnsaved) return;
    const kw = Number(capacityKw);
    if (!Number.isFinite(kw) || kw <= 0) return; // a cleared box is a what-if of "none"
    const ok = await showConfirmation({
      title: "Save capacity to the lead?",
      type: "info",
      message: savedCapacityKw == null
        ? `This lead has no capacity recorded. Save ${kw} kW as its project capacity? Every auto-sized quantity is derived from it.`
        : `Change this lead's project capacity from ${savedCapacityKw} kW to ${kw} kW?`,
      confirmText: "Save to lead", cancelText: "Keep as what-if",
    });
    if (ok) await persistCapacity(kw);
  };

  // The notice's box starts on whatever what-if is already sizing the table, so
  // "I typed 250 to see what it looks like" and "make 250 this lead's capacity"
  // are one click apart rather than a re-type.
  const noticeCapacity = newCapacity != null ? newCapacity : (hasKw ? String(capacityKw) : "");
  const setCapacityFromNotice = async () => {
    const kw = Number(noticeCapacity);
    if (!Number.isFinite(kw) || kw <= 0) { showError?.("Enter a capacity in kW above zero."); return; }
    if (await persistCapacity(kw)) setNewCapacity(null);
  };

  // ── Line editing (flat state, grouped at render) ──
  const updLine = (key, field, val) =>
    setLines(prev => prev.map(l => (l._key === key ? { ...l, [field]: val } : l)));

  /**
   * Copy a suggested cost into the line's rate. This is the ONLY path by which a
   * hint ever reaches the field, and what lands there is an ordinary editable
   * value — nothing else on the line moves. It is a COST: no margin is added
   * here, because markup belongs further down the proposal flow.
   */
  const applyHint = (key, hint) => updLine(key, "unitRate", String(hint.unitRate));
  const removeLine = (key) => setLines(prev => prev.filter(l => l._key !== key));
  const addLineTo = (scopeItemId) => setLines(prev => [...prev, blankLine(scopeItemId)]);

  // Choosing a make snapshots make + spec + the numeric driver onto the line, then
  // recomputes (a driver change moves module/inverter counts and their dependents).
  const pickVariant = (key, variantId) => setLines(prev => recompute(prev.map(l => {
    if (l._key !== key) return l;
    const v = (l.variants || []).find(x => String(x.variantId) === String(variantId));
    if (!v) return { ...l, variantId: null };
    const label = variantLabel(v);
    const dk = driverKeyForBasis(l.basis);
    const nextDriver = dk && v.attributeValues && v.attributeValues[dk] != null && v.attributeValues[dk] !== ""
      ? Number(v.attributeValues[dk]) : l.driverAttr;
    // The chosen make's structured spec ("600 Wp · TOPCon · …") replaces the old one.
    const nextSpec = v.spec || v.description || l.specification;
    return {
      ...l, variantId: v.variantId, make: label || l.make,
      specification: nextSpec, driverAttr: nextDriver,
    };
  }), capacityKw));

  // Editing the quantity by hand marks the line manual so recompute won't overwrite
  // it — and clears the flags, since the reason it couldn't size no longer applies.
  const editQty = (key, val) =>
    setLines(prev => prev.map(l => (
      l._key === key ? { ...l, quantity: val, autoQty: false, _flags: [], _review: false } : l)));
  // Hand a line back to auto-sizing and re-derive it.
  const reAuto = (key) =>
    setLines(prev => recompute(prev.map(l => (l._key === key ? { ...l, autoQty: true } : l)), capacityKw));

  // Resolve a scope activity NAME → its scope item id (for suggestion grouping).
  const scopeIdByActivity = (name) => {
    if (!name) return "";
    const hit = scopeItems.find(s => (s.activity || "").trim().toLowerCase() === name.trim().toLowerCase());
    return hit ? hit.id : "";
  };

  // ── Generate from scope: one blank line per activity ──
  const generateFromScope = async () => {
    if (!scopeItems.length) {
      showError?.("No scope lines to generate from. Add them in the Technical Scope tab first.");
      return;
    }
    if (lines.length > 0) {
      const ok = await showConfirmation({
        title: "Replace BOM", type: "alert",
        message: `This replaces the current ${lines.length} line(s) with one blank line per scope activity. Continue?`,
        confirmText: "Yes, Replace", cancelText: "Cancel",
      });
      if (!ok) return;
    }
    setLines(scopeItems.map(it => ({
      ...blankLine(it.id),
      itemName: it.activity || "",
      specification: it.specification || "",
      quantity: it.quantity ?? "",
      unit: it.unit || "",
    })));
    setWarnings([]); setSourceNote(null);
    showSuccess?.("Seeded one line per scope activity. Add materials and rates, then Save.");
  };

  // ── Excel template download + per-section import ──
  const downloadTemplate = () =>
    downloadStyledTemplate(BOM_TEMPLATE_COLUMNS, BOM_TEMPLATE_SAMPLE, "BOM", "lead_bom_template.xlsx");

  // The section an Import click targets — imported rows all land under it.
  const importTargetRef = useRef("");
  const startImport = (scopeItemId) => { importTargetRef.current = scopeItemId; fileInputRef.current?.click(); };

  const onFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    const scopeItemId = importTargetRef.current;
    try {
      const rows = await readSheetRows(file);
      if (!rows.length) { showError?.("The file has no data rows."); return; }
      const mapped = rows.map(r => ({
        ...blankLine(scopeItemId),
        itemName: String(cell(r, "Component", "Item", "Item Name")).trim(),
        specification: String(cell(r, "Specifications", "Specification")).trim(),
        make: String(cell(r, "Make")).trim(),
        quantity: cell(r, "Qty", "Quantity"),
        unit: String(cell(r, "Units", "Unit")).trim() || "kW",
        unitRate: cell(r, "Unit Price", "Unit Rate", "Rate"),
        notes: String(cell(r, "Notes", "Remarks")).trim(),
      })).filter(l => l.itemName);
      if (!mapped.length) { showError?.("No valid rows found. Each row needs a Component."); return; }
      setLines(prev => [...prev, ...mapped]);
      const where = scopeItemId ? "" : " (General)";
      showSuccess?.(`Imported ${mapped.length} material(s)${where}. Review, then Save.`);
    } catch {
      showError?.("Could not read the file. Use the template format (.xlsx, .xls or .csv).");
    }
  };

  // ── Suggest BOM: mined past job or template, grouped by scope activity ──
  // Fetch a BOM suggestion (mined past job or template). Returns the raw payload
  // or null on failure; both the whole-BOM and per-scope actions share it.
  const fetchBomSuggestion = async () => {
    const res = await api.get(`/leads/${lead.id}/scope/suggest`, { params: { target: "bom" } });
    if (!res?.success) { showError?.(res?.message || "Failed to build suggestion"); return null; }
    return res.data || {};
  };

  /**
   * The capacity a suggestion should be sized from — the ONE place both suggest
   * actions decide this, so they cannot drift apart the way they used to (one
   * overwrote the field, the other preserved it).
   *
   * The server answers with the lead's own capacity. When it has none, the field
   * is not silently blanked: an unsaved what-if is kept unless the estimator says
   * otherwise, and a genuinely empty capacity is stated out loud rather than
   * leaving a column of empty cells to be interpreted.
   *
   * Returns the kW to size with, or `false` if the estimator backed out.
   */
  const resolveSuggestionCapacity = async (d) => {
    const serverKw = d.capacityKw ?? null;
    if (serverKw != null) {
      setSavedCapacityKw(serverKw);
      setCapacityKw(serverKw);
      return serverKw;
    }
    setSavedCapacityKw(null);
    if (hasKw) {
      const keep = await showConfirmation({
        title: "This lead has no capacity recorded",
        type: "alert",
        message: `The suggestion has no capacity to size from — the ${capacityKw} kW in the capacity field is an `
          + `unsaved what-if. Keep it and size the suggestion from it, or clear it and leave the `
          + `capacity-driven quantities blank?`,
        confirmText: `Keep ${capacityKw} kW`, cancelText: "Clear it",
      });
      if (keep) return capacityKw;
      setCapacityKw(null);
      showError?.("This lead has no capacity recorded, so capacity-driven quantities were left blank.");
      return null;
    }
    showError?.("This lead has no capacity recorded, so capacity-driven quantities were left blank.");
    return null;
  };

  const toLine = (b, scopeItemId, meta) => ({
    ...blankLine(scopeItemId),
    category: b.category || "",
    itemName: b.itemName || "",
    make: b.make || "",
    specification: b.specification || "",
    unit: b.unit || "",
    quantity: b.quantity ?? "",
    unitRate: b.unitRate ?? "",
    bomItemId: b.bomItemId ?? null,
    variantId: b.variantId ?? b.defaultVariantId ?? null,
    variants: Array.isArray(b.variants) ? b.variants : [],
    basis: b.basis ?? null,
    basisValue: b.basisValue ?? null,
    stepValue: b.stepValue ?? null,
    siteVisitField: b.siteVisitField ?? null,
    driverAttr: b.driverAttr ?? null,
    driverAttrKey: b.driverAttrKey ?? null,
    driverAttrLabel: b.driverAttrLabel ?? null,
    autoQty: true, // a fresh suggestion is auto until the estimator edits the qty
    // Stamped so this lead can later tell that its BOM predates the template.
    sourceTemplateId: meta?.templateId ?? null,
    templateVersion: meta?.templateVersion ?? null,
    _flags: Array.isArray(b.flags) ? b.flags : [],
    _review: !!b.review,
  });

  /** How many of the current lines carry a hand-typed quantity a replace would discard. */
  const manualCount = (rows) => rows.filter(l => l.autoQty === false && l.quantity !== "" && l.quantity != null).length;

  const replaceWarning = (rows) => {
    const n = manualCount(rows);
    return n === 0 ? "" : ` ${n} hand-entered quantit${n === 1 ? "y" : "ies"} will be lost.`;
  };

  // Whole-BOM suggest — replaces everything, grouped by scope.
  const suggestBom = async () => {
    if (lines.length > 0) {
      const ok = await showConfirmation({
        title: "Replace the whole BOM", type: "alert",
        message: "This replaces every line with a suggestion from this project type and capacity."
          + replaceWarning(lines) + " Continue?",
        confirmText: "Yes, Suggest", cancelText: "Cancel",
      });
      if (!ok) return;
    }
    setSuggesting(true);
    try {
      const d = await fetchBomSuggestion();
      if (!d) return;
      const suggested = Array.isArray(d.bomLines) ? d.bomLines : [];
      if (!suggested.length && d.source === "NONE") {
        setSourceNote({ source: "NONE" });
        setWarnings(d.warnings || []);
        showError?.("No template or similar past job for this project type yet.");
        return;
      }
      const kw = await resolveSuggestionCapacity(d);
      const meta = { templateId: d.templateId ?? null, templateVersion: d.templateVersion ?? null };
      setLines(recompute(suggested.map(b => toLine(b, scopeIdByActivity(b.scopeActivity), meta)), kw));
      setWarnings(d.warnings || []);
      setSourceNote({ source: d.source, sourceCapacity: d.sourceCapacity });
      showSuccess?.(
        d.source === "MINED"
          ? `Suggested from a similar ${d.sourceCapacity || ""} job. Review and save.`
          : "Suggested from the standard template. Review and save."
      );
    } catch (e) {
      fail("Failed to suggest BOM", e);
    } finally { setSuggesting(false); }
  };

  // Per-scope suggest — fills just ONE section's materials, leaving the rest.
  // Identical to the whole-BOM action in how it treats capacity; the only
  // difference is which lines it replaces.
  const [suggestingSection, setSuggestingSection] = useState(null);
  const suggestForSection = async (scopeItem) => {
    const title = scopeItem.activity || "(unnamed activity)";
    const sid = String(scopeItem.id);
    const secLines = lines.filter(l => String(l.scopeItemId) === sid);
    if (secLines.length > 0) {
      const ok = await showConfirmation({
        title: `Replace materials under "${title}"`, type: "alert",
        message: `This replaces the ${secLines.length} material(s) under "${title}" with a suggestion.`
          + replaceWarning(secLines) + " Continue?",
        confirmText: "Yes, Suggest", cancelText: "Cancel",
      });
      if (!ok) return;
    }
    setSuggestingSection(sid);
    try {
      const d = await fetchBomSuggestion();
      if (!d) return;
      const all = Array.isArray(d.bomLines) ? d.bomLines : [];
      // Lines the engine tagged to this activity (case-insensitive by name).
      const mine = all.filter(b => (b.scopeActivity || "").trim().toLowerCase() === title.trim().toLowerCase());
      if (!mine.length) {
        showError?.(`No suggested materials for "${title}".`);
        return;
      }
      const kw = await resolveSuggestionCapacity(d);
      const meta = { templateId: d.templateId ?? null, templateVersion: d.templateVersion ?? null };
      // Replace only this section's lines; keep every other line untouched.
      const keySet = new Set(secLines.map(l => l._key));
      setLines(prev => recompute([
        ...prev.filter(l => !keySet.has(l._key)),
        ...mine.map(b => toLine(b, scopeItem.id, meta)),
      ], kw));
      const codes = new Set(mine.flatMap(m => m.flags || []));
      const secWarn = (d.warnings || []).filter(w => codes.has(w.code));
      if (secWarn.length) {
        setWarnings(prev => {
          const seen = new Set(prev.map(w => w.code));
          return [...prev, ...secWarn.filter(w => !seen.has(w.code))];
        });
      }
      showSuccess?.(`Suggested ${mine.length} material(s) under "${title}". Review and save.`);
    } catch (e) {
      fail("Failed to suggest materials", e);
    } finally { setSuggestingSection(null); }
  };

  const save = async () => {
    if (!canEdit) return;
    for (const l of lines) {
      if (!(l.itemName || "").trim()) { showError?.("Every BOM line needs an item name"); return; }
    }
    setSaving(true);
    try {
      const res = await api.put(`/leads/${lead.id}/bom`, {
        lines: lines.map((l, i) => ({
          id: l.id ?? null,
          seqNo: i + 1,
          scopeItemId: l.scopeItemId === "" || l.scopeItemId == null ? null : Number(l.scopeItemId),
          category: (l.category || "").trim() || null,
          itemName: l.itemName.trim(),
          make: (l.make || "").trim() || null,
          specification: (l.specification || "").trim() || null,
          unit: (l.unit || "").trim() || null,
          // Blank stays blank. Coercing it to 0 here is what used to turn "could
          // not be sized" into a quantity of zero the moment the BOM was saved.
          quantity: l.quantity === "" || l.quantity == null ? null : Number(l.quantity),
          unitRate: l.unitRate === "" || l.unitRate == null ? 0 : Number(l.unitRate),
          notes: (l.notes || "").trim() || null,
          bomItemId: l.bomItemId ?? null,
          variantId: l.variantId ?? null,
          // Auto-sizing snapshot so a reloaded BOM stays live.
          basis: l.basis || null,
          basisValue: l.basisValue === "" || l.basisValue == null ? null : Number(l.basisValue),
          stepValue: l.stepValue === "" || l.stepValue == null ? null : Number(l.stepValue),
          siteVisitField: l.siteVisitField || null,
          driverAttr: l.driverAttr === "" || l.driverAttr == null ? null : Number(l.driverAttr),
          autoQty: l.autoQty !== false,
          sourceTemplateId: l.sourceTemplateId ?? null,
          templateVersion: l.templateVersion ?? null,
        })),
      });
      if (res?.success) {
        showSuccess?.("BOM saved");
        await load();
        onRefreshLead?.();
      } else {
        showError?.(res?.message || "Failed to save BOM");
      }
    } catch (e) {
      fail("Failed to save BOM", e);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="lbm-loading"><span className="lbm-spinner" /> Loading…</div>;

  // Build the sections: every scope item, then General. A line belongs to a
  // section by its scopeItemId (numeric match); anything else falls to General.
  const scopeIds = new Set(scopeItems.map(s => String(s.id)));
  const sections = [
    ...scopeItems.map(s => ({ key: String(s.id), scopeItemId: s.id, title: s.activity || "(unnamed activity)" })),
    { key: GENERAL, scopeItemId: "", title: "General / Unassigned" },
  ];
  const linesFor = (section) => lines.filter(l => {
    const sid = l.scopeItemId === "" || l.scopeItemId == null ? "" : String(l.scopeItemId);
    if (section.key === GENERAL) return sid === "" || !scopeIds.has(sid);
    return sid === section.key;
  });

  const grandTotal = lines.reduce((s, l) => s + lineAmount(l), 0);
  const moveOptions = scopeItems.map(s => ({ id: String(s.id), label: s.activity || "(unnamed)" }));

  // Banner = suggestion warnings + any live-recompute flags currently on the lines.
  const flagCodes = new Set();
  lines.forEach(l => (l._flags || []).forEach(c => flagCodes.add(c)));
  const bannerWarnings = [
    ...warnings,
    ...[...flagCodes].filter(c => !warnings.some(w => w.code === c)).map(c => ({ code: c })),
  ];
  // NEEDS_CAPACITY has its own standing notice with a way to fix it, so repeating
  // it in the warning strip would just be the same sentence twice.
  const stripWarnings = savedCapacityKw == null
    ? bannerWarnings.filter(w => w.code !== "NEEDS_CAPACITY")
    : bannerWarnings;

  const uncomputed = lines.filter(l => qtyStatus(l, hasKw)?.kind === "blocked").length;
  const ts = templateStatus || {};
  const templateOutdated = !!ts.outdated;
  // A BOM with unknown provenance is only worth mentioning when re-running would
  // actually change something — see bomTemplateStatus. The definite "outdated"
  // notice always wins over this maybe.
  const reviewHint = templateOutdated ? "NONE" : (ts.reviewHint || "NONE");
  const example = (ts.changedExamples || [])[0] || null;

  return (
    <div className="lbm">
      <ConfirmationModal {...confirmModal} />

      <div className="lbm-card">
        <div className="lbm-card-head">
          <span className="lead-card-ico"><Package size={17} strokeWidth={2} /></span><h4 className="lbm-card-title">Bill of Materials</h4>
          {canEdit && (
            <div className="lbm-head-actions">
              <button className="lbm-btn-ghost" onClick={suggestBom} disabled={suggesting}
                title="Replace every line with a suggestion for this project type and capacity (past job or template)">
                <Wand2 size={13} /> {suggesting ? "Suggesting…" : "Suggest whole BOM"}
              </button>
              <button className="lbm-btn-ghost" onClick={generateFromScope}
                title="One blank line per scope activity">
                <Plus size={13} /> Generate from scope
              </button>
              <button className="lbm-btn-ghost" onClick={downloadTemplate}
                title="Download a blank Excel template to fill in, then import it under a scope">
                <Download size={13} /> Template
              </button>
              {/* One hidden input; each section's Import button targets it. */}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onFilePicked} />
            </div>
          )}
        </div>

        {/* Standing notice: without a capacity on the lead, nothing capacity-driven
            can size, so it is said once at the top with the fix attached rather
            than left to be inferred from empty cells. */}
        {savedCapacityKw == null && (
          <div className="lbm-notice lbm-notice--block">
            <AlertTriangle size={15} className="lbm-notice-icon" />
            <div className="lbm-notice-body">
              <b>Auto-sizing is unavailable — this lead has no capacity recorded.</b>
              <span>
                Module, inverter and per-kW quantities cannot be calculated until a project capacity is set.
                {hasKw && ` The ${capacityKw} kW below is an unsaved what-if — it sizes the quantities you see now but is not stored on the lead.`}
              </span>
              {canEdit && (
                <div className="lbm-notice-actions">
                  <input className="lbm-inp lbm-notice-inp" type="number" min="0" step="any"
                    placeholder="Capacity in kW" value={noticeCapacity}
                    onChange={e => setNewCapacity(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") setCapacityFromNotice(); }} />
                  <button className="lbm-btn-primary" onClick={setCapacityFromNotice} disabled={savingCapacity}>
                    {savingCapacity ? "Saving…" : hasKw ? `Save ${noticeCapacity} kW to the lead` : "Set capacity"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* A saved BOM carries its own copy of the template's rules, so a template
            corrected afterwards does not reach it. Say so, and offer the re-run. */}
        {templateOutdated && (
          <div className="lbm-notice lbm-notice--warn">
            <RefreshCw size={15} className="lbm-notice-icon" />
            <div className="lbm-notice-body">
              <b>This BOM was built from an older version of the template.</b>
              <span>
                Saved from version {templateStatus.savedTemplateVersion ?? "?"} of
                {templateStatus.templateName ? ` the "${templateStatus.templateName}"` : " the"} template;
                version {templateStatus.currentTemplateVersion} is active now. Its quantity rules are a
                snapshot, so template fixes made since do not apply here until the suggestion is re-run.
              </span>
              {canEdit && (
                <div className="lbm-notice-actions">
                  <button className="lbm-btn-ghost" onClick={suggestBom} disabled={suggesting}>
                    <Wand2 size={13} /> {suggesting ? "Suggesting…" : "Re-run the suggestion"}
                  </button>
                  <a className="lbm-btn-ghost" href={TEMPLATE_ADMIN_PATH} target="_blank" rel="noreferrer">
                    Open the template <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* A BOM saved before template versions were recorded can't prove it is
            current — but saying so on its own would cry wolf, so this appears only
            when the template's rule for one of these materials has actually moved. */}
        {reviewHint !== "NONE" && (
          <div className={`lbm-notice ${reviewHint === "STRONG" ? "lbm-notice--warn" : "lbm-notice--muted"}`}>
            {reviewHint === "STRONG"
              ? <RefreshCw size={15} className="lbm-notice-icon" />
              : <Info size={15} className="lbm-notice-icon" />}
            <div className="lbm-notice-body">
              {reviewHint === "STRONG" ? (
                <>
                  <b>This BOM may be running on outdated template rules.</b>
                  <span>
                    It doesn't record which template version it was built from — it predates that being
                    tracked.{ts.unsizedLineCount ? ` ${ts.unsizedLineCount} line${ts.unsizedLineCount === 1 ? "" : "s"} still can't produce a quantity, and` : " Meanwhile"}
                    {ts.templateName ? ` the "${ts.templateName}"` : " the"} template now sizes
                    {example ? <> <b>{example.itemName}</b> by <b>{example.templateBasisLabel}</b> where this BOM has <b>{example.savedBasisLabel}</b></> : " these materials differently"}.
                    Re-running the suggestion rebuilds every line from the template that is active today.
                  </span>
                </>
              ) : (
                <span>
                  This BOM predates template version tracking, so it may not include later template
                  changes —{ts.templateName ? ` the "${ts.templateName}"` : " the"} template now sizes
                  {example ? <> <b>{example.itemName}</b> by <b>{example.templateBasisLabel}</b></> : " some materials differently"}.
                </span>
              )}
              {canEdit && (
                <div className="lbm-notice-actions">
                  <button className="lbm-btn-ghost" onClick={suggestBom} disabled={suggesting}>
                    <Wand2 size={13} /> {suggesting ? "Suggesting…" : "Re-run the suggestion"}
                  </button>
                  <a className="lbm-btn-ghost" href={TEMPLATE_ADMIN_PATH} target="_blank" rel="noreferrer">
                    Open the template <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="lbm-stat-row">
          <div className="lbm-stat"><label>Line Items</label><span>{lines.length}</span></div>
          <div className="lbm-stat"><label>Total Value</label><span>₹{fmtINR(grandTotal)}</span></div>
          <div className="lbm-stat">
            <label>System Capacity (kW)</label>
            <div className="lbm-cap-cell">
              <input className="lbm-inp" type="number" min="0" step="any" style={{ maxWidth: 110 }}
                value={capacityKw ?? ""} disabled={!canEdit || savingCapacity}
                title="Drives module / inverter / per-kW quantities. Change it to see quantities update live; you'll be asked whether to save it to the lead."
                onChange={e => changeCapacity(e.target.value)}
                onBlur={commitCapacity}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} />
              {/* Which of the two capacities is on screen — never left to guess. */}
              {capacityUnsaved ? (
                <span className="lbm-cap-tag lbm-cap-tag--unsaved"
                  title="Not stored on the lead. Press Enter or click away to save it.">unsaved what-if</span>
              ) : savedCapacityKw != null ? (
                <span className="lbm-cap-tag lbm-cap-tag--saved" title="This is the lead's recorded capacity.">
                  saved on lead
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {sourceNote && sourceNote.source && sourceNote.source !== "NONE" && (
          <div className="lbm-source-note">
            {sourceNote.source === "MINED"
              ? `Suggested from a similar ${sourceNote.sourceCapacity || ""} job — review quantities before saving.`
              : "Suggested from the standard template — review quantities before saving."}
          </div>
        )}
        {stripWarnings.length > 0 && (
          <div className="lbm-warn">
            {stripWarnings.map((w, i) => (
              <div key={i}>
                ⚠ {SUGGESTION_WARNING_LABELS[w.code] || w.message || w.code}
                {/* These are the template's fault, not this lead's — so say where. */}
                {TEMPLATE_FAULT_CODES.has(w.code) && (
                  <> <a className="lbm-warn-link" href={TEMPLATE_ADMIN_PATH} target="_blank" rel="noreferrer">
                    Open Lead Scope / BOM Templates <ExternalLink size={11} />
                  </a></>
                )}
              </div>
            ))}
          </div>
        )}
        {uncomputed > 0 && (
          <div className="lbm-warn">
            ⚠ {uncomputed} line{uncomputed === 1 ? "" : "s"} could not be sized — each one says which input it is
            waiting for, under its Qty box.
          </div>
        )}

        {scopeItems.length === 0 && lines.length === 0 && (
          <div className="lbm-empty">
            No scope activities yet. Add them in the Technical Scope tab, then "Suggest whole BOM" or
            "Generate from scope" — materials are organised under each activity.
          </div>
        )}

        {/* One section per scope activity, plus General */}
        {sections.map(section => {
          const secLines = linesFor(section);
          if (section.key === GENERAL && secLines.length === 0) return null; // hide empty General
          const secTotal = secLines.reduce((s, l) => s + lineAmount(l), 0);
          return (
            <div key={section.key} className="lbm-section">
              <div className="lbm-section-head">
                <span className="lbm-section-title">{section.title}</span>
                {canEdit && section.key !== GENERAL && (
                  <button className="lbm-section-suggest"
                    onClick={() => suggestForSection({ id: section.scopeItemId, activity: section.title })}
                    disabled={suggestingSection === String(section.scopeItemId)}
                    title={`Replace only this section's materials with a suggestion for "${section.title}"`}>
                    <Wand2 size={12} /> {suggestingSection === String(section.scopeItemId) ? "…" : "Suggest this section"}
                  </button>
                )}
                {canEdit && (
                  <button className="lbm-section-suggest"
                    onClick={() => startImport(section.scopeItemId)}
                    title={`Import materials from Excel under "${section.title}"`}>
                    <Upload size={12} /> Import
                  </button>
                )}
                <span className="lbm-section-total">₹{fmtINR(secTotal)}</span>
              </div>

              {secLines.length === 0 ? (
                <div className="lbm-section-empty">No materials for this activity yet.</div>
              ) : (
                <div className="lbm-table-wrap">
                  <table className="lbm-table">
                    <thead>
                      <tr>
                        <th className="lbm-c-num">#</th>
                        <th className="lbm-c-item">Component</th>
                        <th className="lbm-c-spec">Specifications</th>
                        <th className="lbm-c-make">Make</th>
                        <th className="lbm-c-qty">Qty</th>
                        <th className="lbm-c-unit">Units</th>
                        <th className="lbm-c-rate">Unit Price</th>
                        <th className="lbm-c-amt">Amount</th>
                        <th className="lbm-c-notes">Notes</th>
                        {canEdit && <th className="lbm-c-move">Move to</th>}
                        {canEdit && <th className="lbm-c-act" />}
                      </tr>
                    </thead>
                    <tbody>
                      {secLines.map((l, i) => {
                        const status = qtyStatus(l, hasKw);
                        const blocked = status?.kind === "blocked";
                        // Absent OR null both mean "no price to suggest" — null is a
                        // remembered miss. Either way there is nothing to render, which
                        // is how a blank never gets shown as if it were a price.
                        const hint = hints[hintKey(l)] || null;
                        const rateClash = hint ? unitsDiffer(hint.unit, l.unit) : false;
                        const hintOpen = openHint === l._key;
                        return (
                        <React.Fragment key={l._key}>
                        <tr className={blocked ? "lbm-row-blocked" : l._review ? "lbm-row-review" : undefined}>
                          <td className="lbm-c-num">
                            {i + 1}
                            {/* Blocked says which input is missing; a computed line
                                flagged for review says why it's worth checking. */}
                            {blocked ? (
                              <span className="lbm-review-dot" title={status.reason}>●</span>
                            ) : l._review ? (
                              <span className="lbm-review-dot"
                                title={(l._flags || []).map(f => SUGGESTION_WARNING_LABELS[f] || f).join("\n")}>●</span>
                            ) : null}
                          </td>
                          <td className="lbm-c-item">
                            {canEdit ? (
                              <ItemNameAutocomplete
                                className="lbm-inp"
                                value={l.itemName}
                                user={currentUser}
                                placeholder="Component name"
                                onChange={v => updLine(l._key, "itemName", v)}
                                onSelect={item => setLines(prev => prev.map(row => (row._key === l._key ? {
                                  ...row,
                                  itemName: item.itemName || row.itemName,
                                  unit: item.unit || row.unit,
                                  // Fill the rate from the catalogue price when this line has none yet.
                                  unitRate: (row.unitRate === "" || row.unitRate == null) && item.unitPrice != null
                                    ? item.unitPrice : row.unitRate,
                                  specification: row.specification || item.specification || "",
                                } : row)))}
                              />
                            ) : (
                              <input className="lbm-inp" value={l.itemName} disabled
                                onChange={() => {}} placeholder="Component name" />
                            )}
                          </td>
                          <td className="lbm-c-spec">
                            <input className="lbm-inp" value={l.specification} disabled={!canEdit}
                              onChange={e => updLine(l._key, "specification", e.target.value)} placeholder="Specifications" />
                          </td>
                          <td className="lbm-c-make">
                            {(l.variants && l.variants.length > 0) ? (
                              <select className="lbm-inp" value={l.variantId ?? ""} disabled={!canEdit}
                                title="Choose an approved make for this item"
                                onChange={e => pickVariant(l._key, e.target.value)}>
                                {l.variantId == null && <option value="">— make —</option>}
                                {l.variants.map(v => (
                                  <option key={v.variantId} value={v.variantId}>{variantLabel(v) || "(make)"}</option>
                                ))}
                              </select>
                            ) : (
                              <input className="lbm-inp" value={l.make} disabled={!canEdit}
                                onChange={e => updLine(l._key, "make", e.target.value)} placeholder="Make / brand" />
                            )}
                          </td>
                          <td className="lbm-c-qty">
                            <input className={`lbm-inp${blocked ? " lbm-inp--blocked" : ""}`} type="number" min="0" step="any"
                              value={l.quantity} disabled={!canEdit}
                              placeholder={blocked ? "—" : undefined}
                              onChange={e => editQty(l._key, e.target.value)} />
                            {/* Computed, waiting, or hand-typed — one caption, always
                                distinguishable, never an unexplained blank. */}
                            {status?.kind === "manual" && canEdit && RECALC_BASES.has(l.basis) && (
                              <button type="button" className="lbm-qty-note lbm-qty-note--manual"
                                onClick={() => reAuto(l._key)}
                                title="Quantity was entered by hand, so auto-sizing leaves it alone. Click to hand it back to auto-sizing.">
                                ✎ manual · reset ↺
                              </button>
                            )}
                            {status?.kind === "manual" && !(canEdit && RECALC_BASES.has(l.basis)) && (
                              <span className="lbm-qty-note lbm-qty-note--manual" title="Entered by hand.">✎ manual</span>
                            )}
                            {status?.kind === "auto" && (
                              <span className="lbm-qty-note lbm-qty-note--auto" title={autoBasisHint(l)}>
                                auto{autoBasisTag(l) ? ` · ${autoBasisTag(l)}` : ""}
                              </span>
                            )}
                            {blocked && (
                              <span className="lbm-qty-note lbm-qty-note--blocked" title={status.reason}>
                                ⚠ {status.reason}
                              </span>
                            )}
                          </td>
                          <td className="lbm-c-unit">
                            <UnitSelectCell className="lbm-inp" value={l.unit} disabled={!canEdit}
                              onChange={v => updLine(l._key, "unit", v)} />
                          </td>
                          <td className="lbm-c-rate">
                            <input className="lbm-inp" type="number" min="0" step="any" value={l.unitRate}
                              disabled={!canEdit} onChange={e => updLine(l._key, "unitRate", e.target.value)} />
                            {/* What this item last actually cost. A suggestion only —
                                the estimator clicks to take it, and the ex-GST label
                                is on the caption because a procured rate excludes tax,
                                freight and handling and is not a landed cost. */}
                            {hint && (
                              <span className={`lbm-rate-note lbm-rate-note--${
                                hint.match === "ITEM" ? "other" : hint.stale ? "stale" : "ok"}`}>
                                {hint.match === "ITEM" && (
                                  // The other make's name LEADS, so this can never be
                                  // misread as the price of the make actually selected.
                                  <span className="lbm-rate-make" title="This make was never purchased. Price shown is for a different make.">
                                    {hint.makeLabel} ·
                                  </span>
                                )}
                                {canEdit ? (
                                  <button type="button" className="lbm-rate-apply"
                                    disabled={rateClash}
                                    title={rateClash
                                      ? `Purchased per ${hint.unit}, this line is per ${l.unit} — not comparable, so it cannot be applied.`
                                      : `Use ₹${fmtINR(hint.unitRate)} — last procured cost, ex-GST`}
                                    onClick={() => applyHint(l._key, hint)}>
                                    ₹{fmtINR(hint.unitRate)}
                                  </button>
                                ) : (
                                  <span className="lbm-rate-apply lbm-rate-apply--ro">₹{fmtINR(hint.unitRate)}</span>
                                )}
                                <span className="lbm-rate-tag">ex-GST</span>
                                {hint.stale && <span className="lbm-rate-tag lbm-rate-tag--stale">
                                  {`${hint.ageDays}d old`}</span>}
                                {rateClash && <span className="lbm-rate-tag lbm-rate-tag--clash"
                                  title={`Purchased per ${hint.unit}; this line is per ${l.unit}.`}>
                                  {`per ${hint.unit} ≠ ${l.unit}`}</span>}
                                <button type="button" className="lbm-rate-more"
                                  aria-expanded={hintOpen}
                                  title={hintOpen ? "Hide purchase details" : "Show when, from whom, and how many"}
                                  onClick={() => setOpenHint(hintOpen ? null : l._key)}>
                                  {hintOpen ? "▾" : "▸"}
                                </button>
                              </span>
                            )}
                          </td>
                          <td className="lbm-c-amt lbm-amt">₹{fmtINR(lineAmount(l))}</td>
                          <td className="lbm-c-notes">
                            <input className="lbm-inp" value={l.notes} disabled={!canEdit}
                              onChange={e => updLine(l._key, "notes", e.target.value)} />
                          </td>
                          {canEdit && (
                            <td className="lbm-c-move">
                              <select className="lbm-inp" value={scopeIds.has(String(l.scopeItemId)) ? String(l.scopeItemId) : ""}
                                onChange={e => updLine(l._key, "scopeItemId", e.target.value)}>
                                <option value="">General</option>
                                {moveOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                              </select>
                            </td>
                          )}
                          {canEdit && (
                            <td className="lbm-c-act">
                              <button className="lbm-icon-del" title="Remove line" onClick={() => removeLine(l._key)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                        {/* A real row rather than a floating card: .lbm-table-wrap
                            scrolls horizontally, and a popover would be clipped by it.
                            Draft POs count towards this hint, so every line carries its
                            PO status — a price nobody has approved says so. */}
                        {hint && hintOpen && (
                          <tr className="lbm-hint-row">
                            <td colSpan={9 + (canEdit ? 2 : 0)}>
                              <div className="lbm-hint-panel">
                                <div className="lbm-hint-head">
                                  Last {hint.history.length === 1 ? "purchase" : `${hint.history.length} purchases`} ·
                                  {" "}procured cost, ex-GST (excludes tax, freight and handling — not landed cost)
                                  {hint.match === "ITEM" && " · a DIFFERENT make: the one you selected was never purchased"}
                                </div>
                                <table className="lbm-hint-table">
                                  <thead>
                                    <tr>
                                      <th>Date</th><th>Vendor</th><th className="lbm-hint-num">Qty</th>
                                      <th className="lbm-hint-num">Rate</th><th>Make</th><th>PO</th><th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {hint.history.map((r, hi) => (
                                      <tr key={`${r.poNo}-${hi}`}>
                                        <td>{fmtHintDate(r.orderDate)}</td>
                                        <td>{r.vendorName || "—"}</td>
                                        <td className="lbm-hint-num">
                                          {Number(r.quantity).toLocaleString("en-IN")} {r.unit}
                                        </td>
                                        <td className="lbm-hint-num">₹{fmtINR(r.unitRate)}</td>
                                        <td>{r.makeLabel || "—"}</td>
                                        <td>{r.poNo}</td>
                                        <td>{r.poStatus || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="lbm-hint-foot">
                                  Ordered rate, not amount paid. Flagged stale after {staleDays} days.
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {canEdit && (
                <button className="lbm-add-material" onClick={() => addLineTo(section.scopeItemId)}>
                  ＋ Add material{section.key !== GENERAL ? ` to ${section.title}` : ""}
                </button>
              )}
            </div>
          );
        })}

        {canEdit && (
          <div className="lbm-card-foot">
            <div className="lbm-grand">Total <b>₹{fmtINR(grandTotal)}</b></div>
            <button className="lbm-btn-primary" onClick={save} disabled={saving}>
              <Save size={13} /> {saving ? "Saving…" : "Save BOM"}
            </button>
          </div>
        )}

        <p className="lbm-hint">
          Materials organised under each scope activity. These amounts are the base of the budget —
          extra allocations are added in Budget Estimation.
        </p>
      </div>
    </div>
  );
}
