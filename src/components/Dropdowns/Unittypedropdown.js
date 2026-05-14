import React from 'react';

/**
 * Common units used across the application
 * Sorted alphabetically for easy selection
 */
const COMMON_UNITS = [
  // Quantity
  'Nos', 'Pcs', 'Units', 'Pairs', 'Dozen', 'Gross',
  // Length
  'Meter', 'Meters', 'Feet', 'Inch', 'Km', 'mm', 'cm',
  // Area
  'Sqft', 'Sq.ft', 'Sqm', 'Sq.m', 'Acres', 'Hectares',
  // Volume
  'Liters', 'Litres', 'ml', 'Gallons', 'Cu.ft', 'Cu.m',
  // Weight
  'Kg', 'Kgs', 'Grams', 'Tons', 'MT', 'Quintal', 'Lbs',
  // Electrical
  'Watt', 'KW', 'KVA', 'Amp', 'Volt',
  // Solar / Power
  'MW', 'MWp', 'kW', 'kWp', 'kWh', 'MWh', 'kVAh', 'MVA', 'kVA',
  // Set/Bundle
  'Set', 'Sets', 'Kit', 'Kits', 'Bundle', 'Lot', 'Box', 'Boxes', 'Carton', 'Bag', 'Bags',
  // Time
  'Hours', 'Days', 'Months', 'Years',
  // Others
  'Roll', 'Rolls', 'Sheet', 'Sheets', 'Panel', 'Panels', 'RM', 'RMT', 'Running Meter', 'Coil', 'Drum'
].sort();

/**
 * UnitTypeDropdown Component
 * 
 * @param {string} value - Current selected value
 * @param {function} onChange - Callback when value changes
 * @param {string} className - Optional CSS class
 * @param {boolean} disabled - Optional disabled state
 * @param {string} name - Optional input name
 * @param {string} placeholder - Optional placeholder text
 */
const UnitTypeDropdown = ({ 
  value, 
  onChange, 
  className = '', 
  disabled = false,
  name = 'unitType',
  placeholder = 'Select Unit'
}) => {
  return (
    <select
      name={name}
      value={value}
      onChange={onChange}
      className={className}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {COMMON_UNITS.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
      <option value="Custom" style={{ fontWeight: '600', color: '#3182ce', borderTop: '1px solid #e2e8f0' }}>
        ✏️ Custom
      </option>
    </select>
  );
};

export default UnitTypeDropdown;
export { COMMON_UNITS };