/**
 * Default Units of Measure
 * Common UOMs for retail and wholesale businesses
 */
export interface UomSeed {
  code: string;
  name: string;
}

export const DEFAULT_UOMS: UomSeed[] = [
  // Count-based
  { code: 'Nos', name: 'Numbers' },
  { code: 'Pcs', name: 'Pieces' },
  { code: 'Unit', name: 'Unit' },
  { code: 'Pair', name: 'Pair' },
  { code: 'Set', name: 'Set' },
  { code: 'Dozen', name: 'Dozen' },

  // Weight-based (Metric)
  { code: 'g', name: 'Gram' },
  { code: 'Kg', name: 'Kilogram' },
  { code: 'mg', name: 'Milligram' },
  { code: 'Ton', name: 'Metric Ton' },

  // Weight-based (Imperial)
  { code: 'oz', name: 'Ounce' },
  { code: 'lb', name: 'Pound' },

  // Volume-based (Metric)
  { code: 'mL', name: 'Milliliter' },
  { code: 'L', name: 'Liter' },
  { code: 'cL', name: 'Centiliter' },

  // Volume-based (Imperial)
  { code: 'fl oz', name: 'Fluid Ounce' },
  { code: 'gal', name: 'Gallon' },
  { code: 'qt', name: 'Quart' },
  { code: 'pt', name: 'Pint' },

  // Length-based (Metric)
  { code: 'mm', name: 'Millimeter' },
  { code: 'cm', name: 'Centimeter' },
  { code: 'm', name: 'Meter' },
  { code: 'km', name: 'Kilometer' },

  // Length-based (Imperial)
  { code: 'in', name: 'Inch' },
  { code: 'ft', name: 'Foot' },
  { code: 'yd', name: 'Yard' },

  // Area
  { code: 'sqm', name: 'Square Meter' },
  { code: 'sqft', name: 'Square Foot' },

  // Packaging
  { code: 'Box', name: 'Box' },
  { code: 'Case', name: 'Case' },
  { code: 'Carton', name: 'Carton' },
  { code: 'Pack', name: 'Pack' },
  { code: 'Bundle', name: 'Bundle' },
  { code: 'Roll', name: 'Roll' },
  { code: 'Bag', name: 'Bag' },
  { code: 'Bottle', name: 'Bottle' },
  { code: 'Can', name: 'Can' },
  { code: 'Jar', name: 'Jar' },
  { code: 'Tray', name: 'Tray' },
  { code: 'Pallet', name: 'Pallet' },

  // Time-based (for services)
  { code: 'Hour', name: 'Hour' },
  { code: 'Day', name: 'Day' },
  { code: 'Week', name: 'Week' },
  { code: 'Month', name: 'Month' },
];
