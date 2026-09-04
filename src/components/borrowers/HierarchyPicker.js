// src/components/borrowers/HierarchyPicker.js
//
// The company-hierarchy widget: pick an existing Parent Group, optionally a
// Sub Group under it (filtered to that parent), create either on the fly, or
// keep the company standalone — plus the Subsidiary / SPV type flags.
//
// Creating a new group is deferred: picking "+ Create new..." only records the
// name to create, via `value.newParentName` / `value.newSubName`. The actual
// POST /borrower/groups call happens in `resolveHierarchyGroupId` below, called
// by whichever screen is about to save the company — so cancelling the form
// never leaves an orphan group behind.

import React, { useEffect, useState } from 'react';
import borrowerApi from '../../services/borrowerApi';
import { toCin, CIN_REGEX } from './borrowerFields';

const NONE = '__none__';
const NEW = '__new__';

export const EMPTY_HIERARCHY = {
  parentGroupId: null,
  parentGroupName: '',
  subGroupId: null,
  subGroupName: '',
  newParentName: '',
  newParentCin: '',
  newParentAddress: '',
  newSubName: '',
  newSubCin: '',
  newSubAddress: '',
  isSubsidiary: false,
  isSpv: false,
};

/** Prefill from a saved borrower's wrapper fields (parentGroupId/Name, subGroupId/Name, isSubsidiary, isSpv). */
export const hierarchyFromBorrower = (b) => ({
  ...EMPTY_HIERARCHY,
  parentGroupId: b?.parentGroupId || null,
  parentGroupName: b?.parentGroupName || '',
  subGroupId: b?.subGroupId || null,
  subGroupName: b?.subGroupName || '',
  isSubsidiary: !!b?.isSubsidiary,
  isSpv: !!b?.isSpv,
});

/**
 * Turns the picker's state into a concrete group_id, creating any new
 * Parent/Sub Group first. Returns null for "standalone". Call this right
 * before saving the company, not on every keystroke.
 */
// Non-blank must be a full, valid 21-character CIN — same rule the backend
// enforces (SanctionValueParser.requireValidCin), checked here too so a bad
// value never even reaches the network call below. Blank is always fine;
// CIN is optional for both Parent and Sub Groups.
const assertValidGroupCin = (cin) => {
  if (cin && !CIN_REGEX.test(cin)) {
    throw new Error('Enter a valid 21-character CIN, e.g. U40106MH2026PTC223978');
  }
};

export const resolveHierarchyGroupId = async (value) => {
  let parentId = value.parentGroupId;
  if (!parentId && value.newParentName?.trim()) {
    const cin = value.newParentCin?.trim();
    assertValidGroupCin(cin);
    const created = await borrowerApi.createGroup({
      groupName: value.newParentName.trim(),
      cin: cin || undefined,
      registeredAddress: value.newParentAddress?.trim() || undefined,
    });
    parentId = created.id;
  }
  if (!parentId) return null; // standalone, or no sub-group possible without a parent

  if (value.subGroupId) return value.subGroupId;
  if (value.newSubName?.trim()) {
    const cin = value.newSubCin?.trim();
    assertValidGroupCin(cin);
    const created = await borrowerApi.createGroup({
      groupName: value.newSubName.trim(), parentGroupId: parentId,
      cin: cin || undefined,
      registeredAddress: value.newSubAddress?.trim() || undefined,
    });
    return created.id;
  }
  return parentId; // directly under the Parent Group, no Sub Group
};

const HierarchyPicker = ({ value, onChange, hideCompanyType = false }) => {
  const [parents, setParents] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  // Which UI mode each select is in — kept separate from value.newParentName /
  // value.newSubName so picking "+ Create new..." reveals the text input
  // immediately, before anything has been typed into it. Deriving visibility
  // from the (still-empty) text value instead was the bug: the input that
  // lets you type a name only appeared once the name already had text in it.
  const [parentMode, setParentMode] = useState(value.parentGroupId ? 'select' : (value.newParentName ? 'new' : 'select'));
  const [subMode, setSubMode] = useState(value.subGroupId ? 'select' : (value.newSubName ? 'new' : 'select'));

  useEffect(() => {
    borrowerApi.getGroups().then(setParents).catch(() => setParents([]));
  }, []);

  useEffect(() => {
    if (!value.parentGroupId) { setSubs([]); return; }
    setLoadingSubs(true);
    borrowerApi.getGroups(value.parentGroupId)
      .then(setSubs)
      .catch(() => setSubs([]))
      .finally(() => setLoadingSubs(false));
  }, [value.parentGroupId]);

  const set = (patch) => onChange({ ...value, ...patch });

  const handleParentSelect = (e) => {
    const v = e.target.value;
    setSubMode('select');
    if (v === NONE) {
      setParentMode('select');
      set({ parentGroupId: null, parentGroupName: '', newParentName: '', newParentCin: '', newParentAddress: '',
            subGroupId: null, subGroupName: '', newSubName: '', newSubCin: '', newSubAddress: '' });
    } else if (v === NEW) {
      setParentMode('new');
      set({ parentGroupId: null, parentGroupName: '',
            subGroupId: null, subGroupName: '', newSubName: '', newSubCin: '', newSubAddress: '' });
    } else {
      setParentMode('select');
      const g = parents.find((p) => String(p.id) === v);
      set({ parentGroupId: g?.id || null, parentGroupName: g?.groupName || '',
            newParentName: '', newParentCin: '', newParentAddress: '',
            subGroupId: null, subGroupName: '', newSubName: '', newSubCin: '', newSubAddress: '' });
    }
  };

  const handleSubSelect = (e) => {
    const v = e.target.value;
    if (v === NONE) {
      setSubMode('select');
      set({ subGroupId: null, subGroupName: '', newSubName: '', newSubCin: '', newSubAddress: '' });
    } else if (v === NEW) {
      setSubMode('new');
      set({ subGroupId: null, subGroupName: '' });
    } else {
      setSubMode('select');
      const g = subs.find((s) => String(s.id) === v);
      set({ subGroupId: g?.id || null, subGroupName: g?.groupName || '', newSubName: '', newSubCin: '', newSubAddress: '' });
    }
  };

  // A Sub Group can never exist without a Parent Group. Picking "+ Create
  // new Parent Group..." alone is NOT enough — until a name is actually
  // typed there is no Parent Group to attach a Sub Group to yet (this was
  // the bug: hasParent used to go true the instant `parentMode` became
  // 'new', before `newParentName` had anything in it, which left the Sub
  // Group control enabled with nothing real behind it).
  const hasParent = !!(value.parentGroupId || (parentMode === 'new' && value.newParentName?.trim()));

  // Safety net for requirement #6 (reset behavior): the moment there's no
  // longer a real Parent Group behind this picker — parent cleared, mode
  // switched away from 'new', or a typed new-parent name deleted back to
  // blank — drop any Sub Group selection/draft so it can never be silently
  // carried into a save once a parent exists again, and so the control
  // reads as genuinely empty while it's hidden/disabled.
  useEffect(() => {
    if (hasParent) return;
    if (value.subGroupId || value.subGroupName || value.newSubName || value.newSubCin || value.newSubAddress) {
      setSubMode('select');
      set({ subGroupId: null, subGroupName: '', newSubName: '', newSubCin: '', newSubAddress: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasParent]);

  return (
    <div className="br-form-grid">
      <label className="br-field">
        <span className="br-field-label">Parent Group</span>
        <select
          className="br-input"
          value={parentMode === 'new' ? NEW : (value.parentGroupId ? String(value.parentGroupId) : NONE)}
          onChange={handleParentSelect}
        >
          <option value={NONE}>— Standalone (no group) —</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{p.groupName}</option>
          ))}
          <option value={NEW}>+ Create new Parent Group…</option>
        </select>
        {parentMode === 'new' && (
          <>
            <input
              className="br-input"
              style={{ marginTop: 6 }}
              placeholder="New Parent Group name"
              autoFocus
              value={value.newParentName}
              onChange={(e) => set({ newParentName: e.target.value })}
            />
            <input
              className="br-input br-input-mono"
              style={{ marginTop: 6 }}
              placeholder="CIN (optional)"
              value={value.newParentCin}
              onChange={(e) => set({ newParentCin: toCin(e.target.value) })}
              maxLength={21}
            />
            <input
              className="br-input"
              style={{ marginTop: 6 }}
              placeholder="Registered address (optional)"
              value={value.newParentAddress}
              onChange={(e) => set({ newParentAddress: e.target.value })}
            />
          </>
        )}
      </label>

      {hasParent && (
        <label className="br-field">
          <span className="br-field-label">Sub Group (optional)</span>
          <select
            className="br-input"
            value={subMode === 'new' ? NEW : (value.subGroupId ? String(value.subGroupId) : NONE)}
            onChange={handleSubSelect}
            disabled={loadingSubs}
          >
            <option value={NONE}>— None (directly under the Parent Group) —</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>{s.groupName}</option>
            ))}
            <option value={NEW}>+ Create new Sub Group…</option>
          </select>
          {!value.parentGroupId && (
            <span className="br-field-hint">
              The Parent Group above will be created first, then this Sub Group under it.
            </span>
          )}
          {subMode === 'new' && (
            <>
              <input
                className="br-input"
                style={{ marginTop: 6 }}
                placeholder="New Sub Group name"
                autoFocus
                value={value.newSubName}
                onChange={(e) => set({ newSubName: e.target.value })}
              />
              <input
                className="br-input br-input-mono"
                style={{ marginTop: 6 }}
                placeholder="CIN (optional)"
                value={value.newSubCin}
                onChange={(e) => set({ newSubCin: toCin(e.target.value) })}
                maxLength={21}
              />
              <input
                className="br-input"
                style={{ marginTop: 6 }}
                placeholder="Registered address (optional)"
                value={value.newSubAddress}
                onChange={(e) => set({ newSubAddress: e.target.value })}
              />
            </>
          )}
        </label>
      )}

      {/* hideCompanyType: the sanction-import "Confirm company" screen
          replaces this section with its own "Sanction belongs to" selector
          at this exact spot (see CompanyMatchModal's New Company fieldset) —
          every other caller (BorrowerFormModal, BorrowerDetail, the
          standalone "Change organization" dialogs) leaves this on. */}
      {!hideCompanyType && (
        <label className="br-field">
          <span className="br-field-label">Company type</span>
          <div className="br-checkbox-row">
            <label className="br-checkbox">
              <input
                type="checkbox"
                checked={!!value.isSubsidiary}
                onChange={(e) => set({ isSubsidiary: e.target.checked })}
              />
              Subsidiary
            </label>
            <label className="br-checkbox">
              <input
                type="checkbox"
                checked={!!value.isSpv}
                onChange={(e) => set({ isSpv: e.target.checked })}
              />
              SPV
            </label>
          </div>
          {/* Neither checked = Standalone; both checked = "Subsidiary + SPV" — both are
              valid combinations, independently selectable (see companyType.js label logic). */}
        </label>
      )}
    </div>
  );
};

export default HierarchyPicker;
