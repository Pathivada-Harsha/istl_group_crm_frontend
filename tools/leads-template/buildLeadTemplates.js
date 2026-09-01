/**
 * Builds / repairs the lead-import .xlsx templates in public/templates.
 *
 *   node tools/leads-template/buildLeadTemplates.js
 *
 * Why patch instead of generate: the app depends on `xlsx` 0.18 and
 * `xlsx-js-style`, and NEITHER can write Excel data validation. A workbook
 * built in JS would come out with no dropdowns at all — silently. So each
 * template is produced by rewriting the XML inside a known-good .xlsx, which
 * preserves the banner, column widths, styling and existing validations.
 * An .xlsx is a plain zip, so this needs nothing beyond Node's zlib.
 *
 * What it does:
 *   1. leads_import_template.xlsx      (standard)  — refresh the Source list.
 *   2. leads_import_pm_suryagarh.xlsx  (PM)        — add Source + Priority lists
 *                                                    (it had no validations).
 *   3. leads_import_telecaller.xlsx    (telecaller) — cut from the standard file:
 *                                                    Assigned To → Capacity,
 *                                                    Group/Category required.
 *
 * The first two are edited IN PLACE. This repo is not under version control,
 * so the original is copied to <name>.pre-dropdown.bak the first time.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..", "..");
const DIR = path.join(ROOT, "public", "templates");

// ── The canonical lists ──────────────────────────────────────────────────────
// Standard/PM sheets feed the BD leads page: mirror the Add/Edit Lead form in
// src/Pages/Leads-Enquire.js.
const LEAD_SOURCES = ["Website", "Referral", "Cold Call", "Email", "Walk-in",
                      "Social Media", "Digital Marketing", "Campaign", "Others"];
// The telecaller sheet mirrors SOURCES in src/Pages/Telecallerleadspage.js,
// which offers "Phone" instead of "Cold Call".
const TELECALLER_SOURCES = ["Website", "Referral", "Walk-in", "Phone", "Email",
                            "Social Media", "Digital Marketing", "Campaign", "Others"];
const PRIORITIES = ["High", "Medium", "Low"];

// ── Minimal zip reader/writer (deflate + stored entries) ─────────────────────
function readZip(buf) {
  const entries = [];
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a zip file: no EOCD record");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Bad central directory entry");
    const method   = buf.readUInt16LE(p + 10);
    const nameLen  = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen   = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const compSize = buf.readUInt32LE(p + 20);
    const name     = buf.toString("utf8", p + 46, p + 46 + nameLen);

    // The local header's extra-field length can differ from the central one.
    const lNameLen  = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw       = buf.slice(dataStart, dataStart + compSize);

    entries.push({ name, data: method === 0 ? raw : zlib.inflateRawSync(raw) });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return entries;
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const comp = zlib.deflateRawSync(e.data, { level: 9 });
    const crc = crc32(e.data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);

    offset += 30 + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(locals), centralBuf, eocd]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const load = f => readZip(fs.readFileSync(path.join(DIR, f)));
const sheetOf = (entries, n) => {
  const e = entries.find(x => x.name === `xl/worksheets/sheet${n}.xml`);
  if (!e) throw new Error(`sheet${n}.xml missing`);
  return e;
};
const backup = (f) => {
  const src = path.join(DIR, f);
  const bak = path.join(DIR, f.replace(/\.xlsx$/, ".pre-dropdown.bak.xlsx"));
  if (!fs.existsSync(bak)) { fs.copyFileSync(src, bak); console.log("  backed up → " + path.basename(bak)); }
};
const save = (entries, f) => {
  fs.writeFileSync(path.join(DIR, f), writeZip(entries));
  console.log("  wrote " + f);
};
const listFormula = vals => `"${vals.join(",")}"`;

/** Replace the list on an existing dataValidation, keyed by its sqref. */
function setValidation(xml, sqref, vals) {
  const re = new RegExp(`(<dataValidation sqref="${sqref}"[^>]*>)<formula1>"[^"]*"</formula1>`);
  if (!re.test(xml)) throw new Error(`No dataValidation for ${sqref}`);
  return xml.replace(re, `$1<formula1>${listFormula(vals)}</formula1>`);
}

/**
 * Insert a whole <dataValidations> block into a sheet that has none.
 * Schema order matters: it belongs after mergeCells and before pageMargins.
 */
function addValidations(xml, defs) {
  if (xml.includes("<dataValidations")) throw new Error("sheet already has dataValidations");
  const body = defs.map(d =>
    `<dataValidation sqref="${d.sqref}" showDropDown="0" showInputMessage="0" ` +
    `showErrorMessage="0" allowBlank="1" type="list">` +
    `<formula1>${listFormula(d.values)}</formula1></dataValidation>`).join("");
  const block = `<dataValidations count="${defs.length}">${body}</dataValidations>`;
  if (!xml.includes("<pageMargins")) throw new Error("no <pageMargins> anchor in sheet");
  return xml.replace("<pageMargins", block + "<pageMargins");
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("1. leads_import_template.xlsx (standard)");
{
  const F = "leads_import_template.xlsx";
  backup(F);
  const entries = load(F);
  const sheet = sheetOf(entries, 1);
  let xml = sheet.data.toString("utf8");
  // The shipped list offered "Exhibition" (retired) and was missing Digital
  // Marketing / Campaign, so a user could pick a source the app never uses.
  xml = setValidation(xml, "D4:D503", LEAD_SOURCES);
  xml = setValidation(xml, "E4:E503", PRIORITIES);
  sheet.data = Buffer.from(xml, "utf8");

  // Keep the field guide's Source line in step with the dropdown.
  const guide = sheetOf(entries, 2);
  let g = guide.data.toString("utf8");
  const oldLine = "<t>Website / Referral / Cold Call / Email / Walk-in / Exhibition / Social Media / Others</t>";
  if (g.includes(oldLine)) g = g.split(oldLine).join(`<t>${LEAD_SOURCES.join(" / ")}</t>`);
  else console.warn("  ! guide: Source line not found");
  guide.data = Buffer.from(g, "utf8");

  save(entries, F);
}

console.log("2. leads_import_pm_suryagarh.xlsx (PM Surya Ghar)");
{
  const F = "leads_import_pm_suryagarh.xlsx";
  backup(F);
  const entries = load(F);
  const sheet = sheetOf(entries, 1);
  let xml = sheet.data.toString("utf8");
  // Cols: A Group | B Name | C Email | D Phone | E Source | F Priority | ...
  // Data starts at row 5. This sheet shipped with no validations at all.
  xml = addValidations(xml, [
    { sqref: "E5:E504", values: LEAD_SOURCES },
    { sqref: "F5:F504", values: PRIORITIES },
  ]);
  sheet.data = Buffer.from(xml, "utf8");
  save(entries, F);
}

console.log("3. leads_import_telecaller.xlsx (telecaller)");
{
  const F = "leads_import_telecaller.xlsx";
  const entries = load("leads_import_template.xlsx"); // cut from the standard file
  const sheet = sheetOf(entries, 1);
  let xml = sheet.data.toString("utf8");

  xml = xml.replace("<t>LEADS IMPORT TEMPLATE  &#8212;  CRM Portal</t>",
                    "<t>TELECALLER LEADS IMPORT  &#8212;  CRM Portal</t>");
  // A telecaller import always lands on the importer, so an assignee column
  // would be a field the server ignores. Same column count and order as the
  // standard sheet, which is what lets the parser reuse its column indices.
  xml = xml.replace("<t>Assigned To (Email)</t>", "<t>Capacity (kW)</t>");
  xml = setValidation(xml, "D4:D503", TELECALLER_SOURCES);
  xml = setValidation(xml, "E4:E503", PRIORITIES);
  if (!xml.includes("Capacity (kW)")) throw new Error("header patch did not take");
  sheet.data = Buffer.from(xml, "utf8");

  const guide = sheetOf(entries, 2);
  let g = guide.data.toString("utf8");
  const gSubs = [
    ["<t>Assigned To (Email)</t>", "<t>Capacity (kW)</t>"],
    ["<t>Email of a specific user to assign this lead to.\nLeave BLANK for automatic round-robin assignment to telecallers.</t>",
     "<t>Proposed system capacity in kW. Optional.</t>"],
    [`<t>${LEAD_SOURCES.join(" / ")}</t>`, `<t>${TELECALLER_SOURCES.join(" / ")}</t>`],
    ["<t>Business group. E.g. Solar, MSME, Agriculture.</t>",
     "<t>Must match a group in the CRM, e.g. EPC or IoT.</t>"],
    ["<t>Sub-group. Use exactly 'Solar_Rooftop' to enable Solar Scheme field.</t>",
     "<t>Sub-group within the group, e.g. Solar_Rooftop.</t>"],
    // The example row used a "Solar" group; solar is a sub-group of EPC.
    ["<t>Solar</t>", "<t>EPC</t>"],
  ];
  for (const [from, to] of gSubs) {
    if (!g.includes(from)) console.warn("  ! guide: no match for " + from.slice(0, 55));
    g = g.split(from).join(to);
  }
  // Group (row 11) and Category (row 12) are optional on the standard import
  // but required here — the telecaller create path rejects a lead without them.
  for (const ref of ["B11", "B12"]) {
    const re = new RegExp(`(<c r="${ref}"[^>]*>\\s*<is>\\s*<t>)Optional(</t>)`);
    if (!re.test(g)) throw new Error(`Could not flip ${ref} to Required`);
    g = g.replace(re, "$1Required$2");
  }
  guide.data = Buffer.from(g, "utf8");

  save(entries, F);
}

console.log("\nSource lists now in the sheets:");
console.log("  standard / PM : " + LEAD_SOURCES.join(", "));
console.log("  telecaller    : " + TELECALLER_SOURCES.join(", "));
