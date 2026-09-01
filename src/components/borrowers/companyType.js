// src/components/borrowers/companyType.js
//
// Mirrors BorrowerService.companyTypeLabel on the backend: is_subsidiary and
// is_spv are independent flags, not one enum, so the label is just their
// combination — never a fifth hardcoded string to keep in sync.

export const companyTypeLabel = (isSubsidiary, isSpv) => {
  if (isSubsidiary && isSpv) return 'Subsidiary + SPV';
  if (isSubsidiary) return 'Subsidiary';
  if (isSpv) return 'SPV';
  return 'Standalone';
};

export const companyTypeBadgeClass = (isSubsidiary, isSpv) =>
  (!isSubsidiary && !isSpv) ? 'br-badge br-badge-standalone' : 'br-badge';
