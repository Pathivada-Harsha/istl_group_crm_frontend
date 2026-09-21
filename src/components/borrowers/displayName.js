// src/components/borrowers/displayName.js
//
// Display-only: a company name lifted from a sanction letter often carries its
// own legal description — "Vayugrid Erode Solar Power Private Limited, a
// Special Purpose Vehicle incorporated under the Companies Act, 2013". The
// registry stores it exactly as the letter printed it (search, matching and
// duplicate detection all rely on that), but on screen only the name itself
// is wanted. This trims the trailing description for display and never
// touches the stored value.
const DESCRIPTION_RE = /\s*,?\s*\b(?:(?:an?|the)\s+(?:special\s+purpose\s+vehicle|spv|company|public\s+limited\s+company|private\s+limited\s+company|limited\s+liability\s+partnership|body\s+corporate|corporation)\b|incorporated\s+under\b|registered\s+under\b)[\s\S]*$/i;

export const displayName = (name) => {
  if (name === null || name === undefined) return name;
  const raw = String(name);
  const trimmed = raw.replace(DESCRIPTION_RE, '').trim();
  return trimmed || raw;
};

export default displayName;
