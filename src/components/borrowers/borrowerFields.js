// src/components/borrowers/borrowerFields.js
//
// The borrower's own fields — the things true about the company regardless of
// any letter. One array, consumed by BorrowerFormModal, BorrowerDetail and the
// registry table, so adding a field is one line in one place.
//
// `group` drives the section headings in the form and the cards on the detail
// page. Only `borrowerName` is required; everything else fills in as the KYC
// pack and the registry sheet arrive.

export const BORROWER_FIELDS = [
  // ── Identity ──
  // The sheet's "SL Ref. No" is the sanction's own reference number under
  // another name, so it lives on the sanction, not here.
  { key: 'borrowerName', group: 'Identity', label: 'Borrower name', required: true,
    placeholder: 'Company name in full' },
  { key: 'cin', group: 'Identity', label: 'CIN', mono: true, placeholder: 'U40106RJ2021PTC074829' },
  { key: 'pan', group: 'Identity', label: 'PAN', mono: true, placeholder: 'AAKCR8842J' },

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
  { key: 'registeredAddress', group: 'Registered office', label: 'Registered address',
    textarea: true, placeholder: 'Registered office as per MCA' },
  { key: 'city', group: 'Registered office', label: 'City', placeholder: 'Jodhpur' },
  { key: 'state', group: 'Registered office', label: 'State', placeholder: 'Rajasthan' },
  { key: 'pincode', group: 'Registered office', label: 'Pincode', placeholder: '342011' },

  // ── Contact ──
  { key: 'contactPerson', group: 'Contact', label: 'Contact person', placeholder: 'Name' },
  { key: 'contactEmail', group: 'Contact', label: 'Email', placeholder: 'name@company.com' },
  { key: 'contactPhone', group: 'Contact', label: 'Phone', placeholder: '0291 244 8817' },

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
  'promoterName', 'sponsorName', 'guarantorName',
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
