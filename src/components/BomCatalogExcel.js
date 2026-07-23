// ─────────────────────────────────────────────────────────────────────────────
//  BomCatalogExcel — the .xlsx shape for the BOM master catalog, so a catalog
//  built up locally can be exported and re-imported on another server instead of
//  being re-typed. Three sheets:
//
//    Items       one row per catalog item
//    Attributes  one row per spec field of an item (OPTIONAL — omit the sheet and
//                each item keeps whatever schema it already has on the server)
//    Makes       one row per make, plus one column per attribute LABEL (the union
//                across all items); each make fills only its own item's columns.
//
//  Pure data in / data out — no API calls, no React. The page drives the saving.
// ─────────────────────────────────────────────────────────────────────────────
import { cell } from "./Leads/bomExcel.js";

export const ITEM_COLUMNS = [
  { header: "Category", width: 20 },
  { header: "Item Name", width: 32 },
  { header: "Specification", width: 30 },
  { header: "Description", width: 26 },
  { header: "Default Unit", width: 13 },
  { header: "Default Tax %", width: 13 },
  { header: "HSN", width: 13 },
  { header: "Active", width: 8 },
];

export const ATTR_COLUMNS = [
  { header: "Item Name", width: 32 },
  { header: "Label", width: 20 },
  { header: "Key", width: 18 },
  { header: "Type", width: 12 },
  { header: "Options", width: 32 },
  { header: "Unit", width: 10 },
  { header: "Required", width: 10 },
];

const MAKE_BASE_COLUMNS = [
  { header: "Item Name", width: 32 },
  { header: "Make", width: 18 },
  { header: "Model", width: 18 },
  { header: "Description", width: 24 },
  { header: "Active", width: 8 },
];

const TYPES = ["text", "dropdown", "number"];

export const slugify = (s) =>
  (s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Item's schema JSON string → field defs. */
export const parseSchemaStr = (raw) => {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr.map((f) => ({
    key: f.key || "", label: f.label || f.key || "", type: f.type || "text",
    options: Array.isArray(f.options) ? f.options : [], unit: f.unit || "", required: !!f.required,
  }));
};

/** Variant's attribute_values JSON string → plain object. */
export const parseValuesStr = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { const o = JSON.parse(raw); return o && typeof o === "object" ? o : {}; } catch { return {}; }
};

const yn = (b) => (b === false ? "N" : "Y");
const toBool = (v, dflt = true) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return dflt;
  return !["n", "no", "0", "false", "inactive"].includes(s);
};
const rowHasAny = (r) => Object.values(r || {}).some((v) => String(v ?? "").trim() !== "");

// ── Export ───────────────────────────────────────────────────────────────────
/**
 * Build the three sheets from the loaded catalog.
 * @param items          array from GET /bom-items-master/admin (carries variantAttributes)
 * @param makesByItemId  { [itemId]: variants[] } from GET /bom-items-master/{id}/variants
 */
export function buildSheets(items, makesByItemId) {
  const itemRows = items.map((it) => [
    it.category || "", it.itemName || "", it.specification || "", it.description || "",
    it.defaultUnit || "", it.defaultTaxPercent == null ? "" : it.defaultTaxPercent,
    it.hsnCode || "", yn(it.isActive),
  ]);

  const schemaByItemId = {};
  const attrRows = [];
  const labelOrder = [];
  items.forEach((it) => {
    const fields = parseSchemaStr(it.variantAttributes);
    schemaByItemId[it.id] = fields;
    fields.forEach((f) => {
      attrRows.push([
        it.itemName || "", f.label, f.key, f.type,
        (f.options || []).join(", "), f.unit || "", yn(f.required),
      ]);
      if (f.label && !labelOrder.includes(f.label)) labelOrder.push(f.label);
    });
  });

  const makeColumns = [...MAKE_BASE_COLUMNS, ...labelOrder.map((l) => ({ header: l, width: 16 }))];
  const makeRows = [];
  items.forEach((it) => {
    const byLabel = {};
    (schemaByItemId[it.id] || []).forEach((f) => { byLabel[f.label] = f; });
    (makesByItemId[it.id] || []).forEach((v) => {
      const vals = parseValuesStr(v.attributeValues);
      const row = [it.itemName || "", v.make || "", v.model || "", v.description || "", yn(v.isActive)];
      labelOrder.forEach((l) => {
        const f = byLabel[l];
        row.push(f ? (vals[f.key] ?? "") : "");
      });
      makeRows.push(row);
    });
  });

  return [
    { name: "Items", columns: ITEM_COLUMNS, rows: itemRows },
    { name: "Attributes", columns: ATTR_COLUMNS, rows: attrRows },
    { name: "Makes", columns: makeColumns, rows: makeRows },
  ];
}

/** A blank workbook with one worked example per sheet, for hand entry. */
export function buildTemplateSheets() {
  const makeColumns = [
    ...MAKE_BASE_COLUMNS,
    { header: "Wattage", width: 14 }, { header: "Cell Type", width: 16 }, { header: "Face", width: 14 },
  ];
  return [
    {
      name: "Items", columns: ITEM_COLUMNS, sampleRows: 1,
      rows: [["Solar_Rooftop", "Solar PV Module", "Mono PERC module", "", "Nos", 18, "85414011", "Y"]],
    },
    {
      name: "Attributes", columns: ATTR_COLUMNS, sampleRows: 3,
      rows: [
        ["Solar PV Module", "Wattage", "wattage", "number", "", "Wp", "Y"],
        ["Solar PV Module", "Cell Type", "cell_type", "dropdown", "Mono PERC, TOPCon", "", "N"],
        ["Solar PV Module", "Face", "face", "dropdown", "Monofacial, Bifacial", "", "N"],
      ],
    },
    {
      name: "Makes", columns: makeColumns, sampleRows: 2,
      rows: [
        ["Solar PV Module", "Waaree", "540Wp", "", "Y", 540, "Mono PERC", "Monofacial"],
        ["Solar PV Module", "Adani", "550Wp", "", "Y", 550, "TOPCon", "Bifacial"],
      ],
    },
  ];
}

// ── Import ───────────────────────────────────────────────────────────────────
/**
 * Parse + validate a workbook read by readWorkbookSheets().
 * Row numbers in messages are 1-based spreadsheet rows (header is row 1).
 * @returns { items: [{ name, category, …, schema|null, makes:[{make,model,raw,…}] }], errors: string[] }
 */
export function parseWorkbook(sheets) {
  const errors = [];
  const pick = (name) => {
    const k = Object.keys(sheets || {}).find((s) => s.trim().toLowerCase() === name);
    return k ? sheets[k] : null;
  };
  const itemRows = pick("items");
  const attrRows = pick("attributes") || [];
  const makeRows = pick("makes") || [];
  if (!itemRows) return { items: [], errors: ["No “Items” sheet found in this workbook."] };

  // Items
  const order = [];
  const byName = new Map();
  itemRows.forEach((r, i) => {
    const rowNo = i + 2;
    const name = String(cell(r, "Item Name", "ItemName", "Item")).trim();
    if (!name) { if (rowHasAny(r)) errors.push(`Items row ${rowNo}: Item Name is required.`); return; }
    const k = name.toLowerCase();
    if (byName.has(k)) { errors.push(`Items row ${rowNo}: duplicate Item Name “${name}”.`); return; }
    const taxRaw = String(cell(r, "Default Tax %", "Tax %", "Tax")).trim();
    if (taxRaw && isNaN(Number(taxRaw))) errors.push(`Items row ${rowNo}: Default Tax % must be a number.`);
    byName.set(k, {
      name,
      category: String(cell(r, "Category", "Subgroup", "Sub Group")).trim(),
      specification: String(cell(r, "Specification", "Specifications")).trim(),
      description: String(cell(r, "Description")).trim(),
      defaultUnit: String(cell(r, "Default Unit", "Unit", "Units")).trim(),
      defaultTaxPercent: taxRaw === "" || isNaN(Number(taxRaw)) ? null : Number(taxRaw),
      hsnCode: String(cell(r, "HSN", "HSN Code")).trim(),
      isActive: toBool(cell(r, "Active")),
      schema: null,
      makes: [],
      rowNo,
    });
    order.push(k);
  });

  // Attributes (optional sheet)
  const seenKeys = new Map();
  attrRows.forEach((r, i) => {
    const rowNo = i + 2;
    const iname = String(cell(r, "Item Name", "Item")).trim();
    if (!iname) { if (rowHasAny(r)) errors.push(`Attributes row ${rowNo}: Item Name is required.`); return; }
    const k = iname.toLowerCase();
    const entry = byName.get(k);
    if (!entry) { errors.push(`Attributes row ${rowNo}: “${iname}” is not in the Items sheet.`); return; }
    const label = String(cell(r, "Label", "Attribute", "Field")).trim();
    if (!label) { errors.push(`Attributes row ${rowNo}: Label is required.`); return; }
    const key = slugify(String(cell(r, "Key")).trim()) || slugify(label);
    if (!key) { errors.push(`Attributes row ${rowNo}: Key can’t be empty — use letters or digits.`); return; }
    const type = (String(cell(r, "Type")).trim().toLowerCase() || "text");
    if (!TYPES.includes(type)) { errors.push(`Attributes row ${rowNo}: Type must be text, dropdown or number.`); return; }
    const options = String(cell(r, "Options")).split(",").map((s) => s.trim()).filter(Boolean);
    if (type === "dropdown" && options.length === 0) { errors.push(`Attributes row ${rowNo}: a dropdown needs at least one Option.`); return; }
    if (!seenKeys.has(k)) seenKeys.set(k, new Set());
    if (seenKeys.get(k).has(key)) { errors.push(`Attributes row ${rowNo}: duplicate Key “${key}” for “${iname}”.`); return; }
    seenKeys.get(k).add(key);

    const f = { key, label, type, required: toBool(cell(r, "Required"), false) };
    if (type === "dropdown") f.options = options;
    if (type === "number") { const u = String(cell(r, "Unit")).trim(); if (u) f.unit = u; }
    entry.schema = entry.schema || [];
    entry.schema.push(f);
  });

  // Makes
  makeRows.forEach((r, i) => {
    const rowNo = i + 2;
    const iname = String(cell(r, "Item Name", "Item")).trim();
    if (!iname) { if (rowHasAny(r)) errors.push(`Makes row ${rowNo}: Item Name is required.`); return; }
    const entry = byName.get(iname.toLowerCase());
    if (!entry) { errors.push(`Makes row ${rowNo}: “${iname}” is not in the Items sheet.`); return; }
    const make = String(cell(r, "Make", "Make / brand", "Brand")).trim();
    const model = String(cell(r, "Model")).trim();
    if (!make && !model) { errors.push(`Makes row ${rowNo}: needs a Make or a Model.`); return; }
    entry.makes.push({
      make, model,
      description: String(cell(r, "Description", "Spec / description")).trim(),
      isActive: toBool(cell(r, "Active")),
      raw: r, rowNo,
    });
  });

  // Validate make values against the sheet-supplied schema (when the sheet defines one).
  byName.forEach((entry) => {
    if (!entry.schema) return;
    entry.makes.forEach((m) => {
      entry.schema.forEach((f) => {
        const val = String(cell(m.raw, f.label, f.key) ?? "").trim();
        if (!val) { if (f.required) errors.push(`Makes row ${m.rowNo}: “${f.label}” is required.`); return; }
        if (f.type === "number" && isNaN(Number(val))) errors.push(`Makes row ${m.rowNo}: “${f.label}” must be a number.`);
        if (f.type === "dropdown" && !(f.options || []).includes(val)) {
          errors.push(`Makes row ${m.rowNo}: “${f.label}” must be one of: ${(f.options || []).join(", ")}.`);
        }
      });
    });
  });

  return { items: order.map((k) => byName.get(k)), errors };
}

/** Build a variant's attributeValues JSON from its sheet row against an effective schema. */
export function valuesFromRow(raw, schema) {
  const clean = {};
  (schema || []).forEach((f) => {
    const val = String(cell(raw, f.label, f.key) ?? "").trim();
    if (val) clean[f.key] = val;
  });
  return clean;
}
