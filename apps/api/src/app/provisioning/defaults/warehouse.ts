/**
 * Default Warehouse Configuration
 * Creates a main warehouse with essential locations for inventory operations
 */
export interface LocationSeed {
  code: string;
  name: string;
  path: string;
  parentCode?: string;
  isPickable?: boolean;
  isPutaway?: boolean;
  isStaging?: boolean;
}

export interface WarehouseSeed {
  code: string;
  name: string;
}

export const DEFAULT_WAREHOUSE_CONFIG: {
  warehouse: WarehouseSeed;
  locations: LocationSeed[];
} = {
  warehouse: {
    code: 'MAIN',
    name: 'Main Warehouse',
  },
  locations: [
    // Root location - represents the entire warehouse
    {
      code: 'ROOT',
      name: 'Main Storage',
      path: 'MAIN',
      isPickable: true,
      isPutaway: true,
      isStaging: false,
    },
    // Receiving location - where goods are received from suppliers
    {
      code: 'RECEIVING',
      name: 'Receiving Area',
      path: 'MAIN/RECEIVING',
      parentCode: 'ROOT',
      isPickable: false,
      isPutaway: true,
      isStaging: true,
    },
    // Staging location - for orders being prepared for shipment
    {
      code: 'STAGING',
      name: 'Shipping Staging',
      path: 'MAIN/STAGING',
      parentCode: 'ROOT',
      isPickable: true,
      isPutaway: false,
      isStaging: true,
    },
    // Quality Control location - for items pending inspection
    {
      code: 'QC',
      name: 'Quality Control',
      path: 'MAIN/QC',
      parentCode: 'ROOT',
      isPickable: false,
      isPutaway: true,
      isStaging: false,
    },
    // Returns location - for processing customer returns
    {
      code: 'RETURNS',
      name: 'Returns Processing',
      path: 'MAIN/RETURNS',
      parentCode: 'ROOT',
      isPickable: false,
      isPutaway: true,
      isStaging: false,
    },
    // Default storage zones (A, B, C)
    {
      code: 'ZONE-A',
      name: 'Zone A',
      path: 'MAIN/ZONE-A',
      parentCode: 'ROOT',
      isPickable: true,
      isPutaway: true,
      isStaging: false,
    },
    {
      code: 'ZONE-B',
      name: 'Zone B',
      path: 'MAIN/ZONE-B',
      parentCode: 'ROOT',
      isPickable: true,
      isPutaway: true,
      isStaging: false,
    },
    {
      code: 'ZONE-C',
      name: 'Zone C',
      path: 'MAIN/ZONE-C',
      parentCode: 'ROOT',
      isPickable: true,
      isPutaway: true,
      isStaging: false,
    },
  ],
};
