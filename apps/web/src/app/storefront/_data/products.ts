export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  compareAt?: number;
  rating: number;
  reviews: number;
  badge?: 'Best Seller' | 'New Arrival' | 'Limited';
  description: string;
  stockStatus: 'In Stock' | 'Low Stock' | 'Preorder';
  leadTime: string;
  tone: string;
};

export const productCategories = [
  {
    name: 'Warehouse Essentials',
    description: 'Core equipment designed for accuracy, flow, and control.',
    count: 48,
  },
  {
    name: 'Front of House',
    description: 'Premium retail fixtures and storefront experiences.',
    count: 32,
  },
  {
    name: 'Fulfillment Tech',
    description: 'Automation-ready gear that scales with your growth.',
    count: 21,
  },
  {
    name: 'Workspace Studio',
    description: 'Ergonomic setups for modern operations teams.',
    count: 16,
  },
];

export const products: StorefrontProduct[] = [
  {
    id: 'nsl-001',
    name: 'Atlas Flow Rack',
    slug: 'atlas-flow-rack',
    category: 'Warehouse Essentials',
    price: 1290,
    compareAt: 1490,
    rating: 4.8,
    reviews: 128,
    badge: 'Best Seller',
    description: 'Gravity-fed modular rack with precision-labeled lanes.',
    stockStatus: 'In Stock',
    leadTime: '2-4 days',
    tone: 'from-blue-50 via-slate-50 to-amber-50',
  },
  {
    id: 'nsl-002',
    name: 'Lumen Barcode Station',
    slug: 'lumen-barcode-station',
    category: 'Fulfillment Tech',
    price: 820,
    rating: 4.6,
    reviews: 84,
    badge: 'New Arrival',
    description: 'LED-lit scanning station with ergonomic tilt controls.',
    stockStatus: 'In Stock',
    leadTime: '3-5 days',
    tone: 'from-indigo-50 via-blue-50 to-amber-100/60',
  },
  {
    id: 'nsl-003',
    name: 'Vantage Pick Cart',
    slug: 'vantage-pick-cart',
    category: 'Warehouse Essentials',
    price: 640,
    compareAt: 710,
    rating: 4.7,
    reviews: 64,
    description: 'Multi-zone pick cart with silent casters and tablet mount.',
    stockStatus: 'Low Stock',
    leadTime: '5-7 days',
    tone: 'from-sky-50 via-blue-50 to-slate-50',
  },
  {
    id: 'nsl-004',
    name: 'Aurora Checkout Pod',
    slug: 'aurora-checkout-pod',
    category: 'Front of House',
    price: 980,
    rating: 4.5,
    reviews: 52,
    badge: 'Limited',
    description: 'Compact checkout pod with integrated POS cable routing.',
    stockStatus: 'Preorder',
    leadTime: '2-3 weeks',
    tone: 'from-slate-50 via-amber-50 to-blue-50',
  },
  {
    id: 'nsl-005',
    name: 'Helios Smart Labels',
    slug: 'helios-smart-labels',
    category: 'Fulfillment Tech',
    price: 210,
    rating: 4.4,
    reviews: 41,
    description: 'RFID-ready labels with tamper-evident finish.',
    stockStatus: 'In Stock',
    leadTime: '1-2 days',
    tone: 'from-blue-50 via-indigo-50 to-slate-50',
  },
  {
    id: 'nsl-006',
    name: 'Meridian Display Wall',
    slug: 'meridian-display-wall',
    category: 'Front of House',
    price: 1760,
    compareAt: 1980,
    rating: 4.9,
    reviews: 33,
    description: 'Showcase wall system with configurable shelving planes.',
    stockStatus: 'In Stock',
    leadTime: '1-2 weeks',
    tone: 'from-blue-50 via-amber-50 to-slate-100',
  },
  {
    id: 'nsl-007',
    name: 'Nimbus Ops Desk',
    slug: 'nimbus-ops-desk',
    category: 'Workspace Studio',
    price: 1120,
    rating: 4.7,
    reviews: 27,
    badge: 'New Arrival',
    description: 'Sit-stand desk with hidden power rails and cable trays.',
    stockStatus: 'In Stock',
    leadTime: '4-6 days',
    tone: 'from-slate-50 via-blue-50 to-indigo-50',
  },
  {
    id: 'nsl-008',
    name: 'Pulse Inventory Tablet',
    slug: 'pulse-inventory-tablet',
    category: 'Fulfillment Tech',
    price: 1590,
    rating: 4.8,
    reviews: 91,
    badge: 'Best Seller',
    description: 'Ruggedized tablet tuned for high-volume cycle counts.',
    stockStatus: 'In Stock',
    leadTime: '3-5 days',
    tone: 'from-indigo-50 via-slate-50 to-amber-50',
  },
];

export const featuredProducts = products.slice(0, 4);
export const bestSellers = products.filter((product) => product.badge === 'Best Seller');
