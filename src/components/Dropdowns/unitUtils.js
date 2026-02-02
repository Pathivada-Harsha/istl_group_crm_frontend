// ============================================
// UNIT UTILITIES
// ============================================

/**
 * Normalize unit values to match COMMON_UNITS
 * Use this when importing data from external sources
 */
export const normalizeUnit = (unit) => {
  if (!unit) return 'Nos';
  
  // Create a mapping for common variations
  const unitMap = {
    // Weight variations
    'kg': 'Kg',
    'kgs': 'Kgs',
    'kilogram': 'Kg',
    'kilograms': 'Kgs',
    'gram': 'Grams',
    'grams': 'Grams',
    'gm': 'Grams',
    'ton': 'Tons',
    'tons': 'Tons',
    'mt': 'MT',
    'quintal': 'Quintal',
    'lbs': 'Lbs',
    'lb': 'Lbs',
    
    // Length variations
    'meter': 'Meter',
    'meters': 'Meters',
    'metre': 'Meter',
    'metres': 'Meters',
    'm': 'Meter',
    'km': 'Km',
    'kilometer': 'Km',
    'kilometres': 'Km',
    'feet': 'Feet',
    'ft': 'Feet',
    'inch': 'Inch',
    'inches': 'Inch',
    'mm': 'mm',
    'cm': 'cm',
    
    // Quantity variations
    'nos': 'Nos',
    'no': 'Nos',
    'number': 'Nos',
    'numbers': 'Nos',
    'pcs': 'Pcs',
    'pc': 'Pcs',
    'piece': 'Pcs',
    'pieces': 'Pcs',
    'unit': 'Units',
    'units': 'Units',
    'pair': 'Pairs',
    'pairs': 'Pairs',
    'dozen': 'Dozen',
    'gross': 'Gross',
    
    // Volume variations
    'liter': 'Liters',
    'liters': 'Liters',
    'litre': 'Litres',
    'litres': 'Litres',
    'l': 'Liters',
    'ml': 'ml',
    'gallon': 'Gallons',
    'gallons': 'Gallons',
    
    // Area variations
    'sqft': 'Sqft',
    'sq.ft': 'Sq.ft',
    'sqm': 'Sqm',
    'sq.m': 'Sq.m',
    'acre': 'Acres',
    'acres': 'Acres',
    'hectare': 'Hectares',
    'hectares': 'Hectares',
    
    // Set/Bundle variations
    'set': 'Set',
    'sets': 'Sets',
    'kit': 'Kit',
    'kits': 'Kits',
    'bundle': 'Bundle',
    'lot': 'Lot',
    'box': 'Box',
    'boxes': 'Boxes',
    'carton': 'Carton',
    'bag': 'Bag',
    'bags': 'Bags',
    
    // Others
    'roll': 'Roll',
    'rolls': 'Rolls',
    'sheet': 'Sheet',
    'sheets': 'Sheets',
    'panel': 'Panel',
    'panels': 'Panels',
    'rm': 'RM',
    'rmt': 'RMT',
    'running meter': 'Running Meter',
    'coil': 'Coil',
    'drum': 'Drum',
    
    // Time variations
    'hour': 'Hours',
    'hours': 'Hours',
    'day': 'Days',
    'days': 'Days',
    'month': 'Months',
    'months': 'Months',
    'year': 'Years',
    'years': 'Years',
    
    // Electrical variations
    'watt': 'Watt',
    'w': 'Watt',
    'kw': 'KW',
    'kilowatt': 'KW',
    'kva': 'KVA',
    'amp': 'Amp',
    'ampere': 'Amp',
    'volt': 'Volt',
    'v': 'Volt'
  };
  
  const normalized = unitMap[unit.toLowerCase()];
  return normalized || unit;
};



// import UnitTypeDropdown, { COMMON_UNITS } from '../components/UnitTypeDropdown';
// import { normalizeUnit } from '../utils/unitUtils';

// // In your invoice items rendering:
// <div className="Invoices-page-form-group Invoices-page-form-group-small">
//   <label>Unit Type</label>
//   <UnitTypeDropdown
//     value={item.unitType}
//     onChange={(e) => updateItem(index, 'unitType', e.target.value)}
//     className="your-css-class"
//   />
// </div>

// // In selectOrderBookItem function:
// const selectOrderBookItem = (index, item) => {
//   const newItems = [...formData.items];
//   newItems[index] = {
//     ...newItems[index],
//     description: item.itemName,
//     quantity: item.quantity || 1,
//     unitPrice: item.unitPrice || 0,
//     taxPercent: item.taxPercent || 18,
//     unitType: normalizeUnit(item.unit),  // ✅ Normalize the unit
//     orderBookItemId: item.id
//   };

//   setFormData({ ...formData, items: newItems });
//   setShowDropdown(prev => ({ ...prev, [index]: false }));
//   setFilteredItems(prev => ({ ...prev, [index]: [] }));
// };

// // Example 2: In Purchase Orders (PurchaseOrders.js)
// // ============================================

// import UnitTypeDropdown from '../components/UnitTypeDropdown';

// // In PO items table:
// <td style={{ padding: '12px', textAlign: 'center' }}>
//   <UnitTypeDropdown
//     value={item.unitType || 'Nos'}
//     onChange={(e) => handleUpdatePOItemUnit(index, e.target.value)}
//     disabled={!item.selected}
//   />
// </td>

// // Example 3: In RFQ/Quotations
// // ============================================

// <UnitTypeDropdown
//   value={formData.unitType}
//   onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
//   className="rfq-unit-dropdown"
// />

// // Example 4: In Order Book Items
// // ============================================

// {orderBookItems.map((item, index) => (
//   <tr key={index}>
//     <td>
//       <UnitTypeDropdown
//         value={item.unit}
//         onChange={(e) => updateOrderBookItem(index, 'unit', e.target.value)}
//       />
//     </td>
//   </tr>
// ))}

// // Example 5: With custom placeholder
// // ============================================

// <UnitTypeDropdown
//   value={item.unitType}
//   onChange={(e) => updateItem(index, 'unitType', e.target.value)}
//   placeholder="-- Select Unit --"
//   className="custom-dropdown"
//   disabled={loading}
// />

// // Example 6: Grouped rendering with categories (Optional Advanced Version)
// // ============================================

// const UnitTypeGroupedDropdown = ({ value, onChange, className = '' }) => {
//   const unitGroups = {
//     'Quantity': ['Nos', 'Pcs', 'Units', 'Pairs', 'Dozen', 'Gross'],
//     'Length': ['Meter', 'Meters', 'Feet', 'Inch', 'Km', 'mm', 'cm'],
//     'Area': ['Sqft', 'Sq.ft', 'Sqm', 'Sq.m', 'Acres', 'Hectares'],
//     'Volume': ['Liters', 'Litres', 'ml', 'Gallons', 'Cu.ft', 'Cu.m'],
//     'Weight': ['Kg', 'Kgs', 'Grams', 'Tons', 'MT', 'Quintal', 'Lbs'],
//     'Electrical': ['Watt', 'KW', 'KVA', 'Amp', 'Volt'],
//     'Set/Bundle': ['Set', 'Sets', 'Kit', 'Kits', 'Bundle', 'Lot', 'Box', 'Boxes', 'Carton', 'Bag', 'Bags'],
//     'Time': ['Hours', 'Days', 'Months', 'Years'],
//     'Others': ['Roll', 'Rolls', 'Sheet', 'Sheets', 'Panel', 'Panels', 'RM', 'RMT', 'Running Meter', 'Coil', 'Drum']
//   };

//   return (
//     <select value={value} onChange={onChange} className={className}>
//       <option value="">Select Unit</option>
//       {Object.entries(unitGroups).map(([category, units]) => (
//         <optgroup key={category} label={category}>
//           {units.map(unit => (
//             <option key={unit} value={unit}>{unit}</option>
//           ))}
//         </optgroup>
//       ))}
//     </select>
//   );
// };