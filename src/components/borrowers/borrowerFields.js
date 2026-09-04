// src/components/borrowers/borrowerFields.js
//
// The borrower's own fields — the things true about the company regardless of
// any letter. One array, consumed by BorrowerFormModal, BorrowerDetail and the
// registry table, so adding a field is one line in one place.
//
// `group` drives the section headings in the form and the cards on the detail
// page. Only `borrowerName` is required; everything else fills in as the KYC
// pack and the registry sheet arrive.

// PAN is always stored upper-case regardless of how it was typed — the
// income-tax department never issues a lower-case one, and a mixed-case
// value on file just makes later exact-match lookups miss.
const toPan = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
// CIN: same treatment as PAN — MCA never issues a lower-case one, so typed
// case is normalized away rather than preserved. 21 characters, letters and
// digits only; exported so every other CIN input in the app (the sanction
// screens' import-mode correction box, in particular) normalizes identically
// rather than growing its own copy of this rule.
export const toCin = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 21);
// MCA's CIN shape: status digit (U/L), 5-digit industry code, 2-letter state
// code, 4-digit year, 3-letter ownership-type code, 6-digit registration
// number — always exactly 21 characters. Checked only after toCin's own
// normalization, so this only ever needs to catch a genuinely wrong
// structure (wrong length, wrong digit/letter positions), never a case or
// stray-character issue toCin already handles.
export const CIN_REGEX = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
// Digits only — a pincode or phone number with a stray space or dash typed
// into it silently breaks any lookup keyed on the raw string.
const toDigits = (max) => (v) => v.replace(/\D/g, '').slice(0, max);
// Stored lower-case so "Name@Company.com" and "name@company.com" are the
// same row rather than two, and login/notification matching doesn't miss.
const toEmailCase = (v) => v.toLowerCase();

export const BORROWER_FIELDS = [
  // ── Identity ──
  // The sheet's "SL Ref. No" is the sanction's own reference number under
  // another name, so it lives on the sanction, not here.
  { key: 'borrowerName', group: 'Identity', label: 'Borrower name', required: true,
    placeholder: 'Company name in full' },
  { key: 'cin', group: 'Identity', label: 'CIN', mono: true, placeholder: 'U40106RJ2021PTC074829',
    normalize: toCin, maxLength: 21 },
  { key: 'pan', group: 'Identity', label: 'PAN', mono: true, placeholder: 'AAKCR8842J',
    normalize: toPan, maxLength: 10 },

  // ── Group & parties ──
  { key: 'promoterName', group: 'Group & parties', label: 'Promoter name',
    placeholder: 'Promoter behind the SPV' },
  { key: 'sponsorName', group: 'Group & parties', label: 'Sponsor / parent',
    placeholder: 'Promoter group behind the SPV' },
  { key: 'guarantorName', group: 'Group & parties', label: 'Guarantor name',
    placeholder: 'Corporate or personal guarantor' },
  { key: 'groupName', group: 'Group & parties', label: 'Group name',
    placeholder: 'The group the borrower belongs to' },
  { key: 'borrowerCategory', group: 'Group & parties', label: 'Cat',
    placeholder: 'Borrower category' },
  { key: 'borrowerSubCategory', group: 'Group & parties', label: 'Sub Cat',
    placeholder: 'Borrower sub-category' },

  // ── Registered office ──
  // Pincode comes first: City, State and District are looked up from it
  // (see BorrowerFormModal), so asking for it first is the order they
  // actually get filled in.
  { key: 'registeredAddress', group: 'Registered office', label: 'Registered address',
    textarea: true, placeholder: 'Registered office as per MCA' },
  { key: 'pincode', group: 'Registered office', label: 'Pincode', placeholder: '342011',
    normalize: toDigits(6), maxLength: 6, inputMode: 'numeric' },
  { key: 'city', group: 'Registered office', label: 'City', placeholder: 'Jodhpur' },
  { key: 'state', group: 'Registered office', label: 'State', placeholder: 'Rajasthan' },
  { key: 'district', group: 'Registered office', label: 'District', placeholder: 'Jodhpur' },

  // ── Contact ──
  { key: 'contactPerson', group: 'Contact', label: 'Contact person', placeholder: 'Name' },
  { key: 'contactEmail', group: 'Contact', label: 'Email', placeholder: 'name@company.com',
    normalize: toEmailCase, type: 'email' },
  { key: 'contactPhone', group: 'Contact', label: 'Phone', placeholder: '9876543210',
    normalize: toDigits(10), maxLength: 10, inputMode: 'numeric' },

  // ── Notes ──
  { key: 'notes', group: 'Notes', label: 'Notes', textarea: true,
    placeholder: 'Anything worth recording' },
];

/**
 * The subset a parsed sanction letter can supply. These have no home on the
 * sanction row, so the review screen posts them to /borrower/resolve, which
 * fills only the borrower's blank fields — an import never overwrites a value
 * someone typed.
 */
export const BORROWER_IMPORT_KEYS = [
  'cin', 'registeredAddress', 'promoterName', 'sponsorName', 'guarantorName',
  'groupName', 'borrowerCategory', 'borrowerSubCategory', 'state',
];

/** Field definitions keyed by group, in declaration order. */
export const borrowerFieldGroups = () => groupFields(BORROWER_FIELDS);

/** Shared by both field modules: preserve declaration order of the groups. */
export function groupFields(fields) {
  const out = [];
  const index = new Map();
  fields.forEach((f) => {
    const name = f.group || '';
    if (!index.has(name)) {
      index.set(name, out.length);
      out.push({ group: name, fields: [] });
    }
    out[index.get(name)].fields.push(f);
  });
  return out;
}

export default BORROWER_FIELDS;
