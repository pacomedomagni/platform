/**
 * Default DocTypes and their permissions
 * Defines the core document types available in the system
 */
export interface DocPermSeed {
  role: string;
  read?: boolean;
  write?: boolean;
  create?: boolean;
  delete?: boolean;
  submit?: boolean;
  cancel?: boolean;
  amend?: boolean;
  report?: boolean;
}

export interface DocTypeSeed {
  name: string;
  module: string;
  isSingle?: boolean;
  isChild?: boolean;
  description?: string;
  permissions?: DocPermSeed[];
}

export const DEFAULT_DOC_TYPES: DocTypeSeed[] = [
  // ============ STOCK MODULE ============
  {
    name: 'Item',
    module: 'Stock',
    description: 'Products, goods, or services that can be bought or sold',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, report: true },
    ],
  },
  {
    name: 'Warehouse',
    module: 'Stock',
    description: 'Physical locations where inventory is stored',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: false, create: false, delete: false, report: true },
    ],
  },
  {
    name: 'Stock Entry',
    module: 'Stock',
    description: 'Material Receipt, Material Issue, Material Transfer',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, report: true },
    ],
  },
  {
    name: 'Stock Reconciliation',
    module: 'Stock',
    description: 'Adjust inventory quantities based on physical count',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: false, cancel: false, report: true },
    ],
  },
  {
    name: 'Batch',
    module: 'Stock',
    description: 'Batch/Lot tracking for inventory items',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, report: true },
    ],
  },
  {
    name: 'Serial No',
    module: 'Stock',
    description: 'Serial number tracking for inventory items',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, report: true },
    ],
  },

  // ============ SELLING MODULE ============
  {
    name: 'Customer',
    module: 'Selling',
    description: 'Customer master data',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, report: true },
    ],
  },
  {
    name: 'Quotation',
    module: 'Selling',
    description: 'Sales quotation or estimate',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, amend: true, report: true },
    ],
  },
  {
    name: 'Sales Order',
    module: 'Selling',
    description: 'Customer sales order',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, amend: true, report: true },
    ],
  },
  {
    name: 'Delivery Note',
    module: 'Selling',
    description: 'Record of goods shipped to customer',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, report: true },
    ],
  },

  // ============ BUYING MODULE ============
  {
    name: 'Supplier',
    module: 'Buying',
    description: 'Supplier/Vendor master data',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, report: true },
    ],
  },
  {
    name: 'Purchase Order',
    module: 'Buying',
    description: 'Order placed with supplier',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, amend: true, report: true },
    ],
  },
  {
    name: 'Purchase Receipt',
    module: 'Buying',
    description: 'Record of goods received from supplier',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, report: true },
    ],
  },

  // ============ ACCOUNTS MODULE ============
  {
    name: 'Account',
    module: 'Accounts',
    description: 'Chart of Accounts entry',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: false, create: false, delete: false, report: true },
    ],
  },
  {
    name: 'Sales Invoice',
    module: 'Accounts',
    description: 'Invoice issued to customer',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, amend: true, report: true },
    ],
  },
  {
    name: 'Purchase Invoice',
    module: 'Accounts',
    description: 'Invoice received from supplier',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, amend: true, report: true },
    ],
  },
  {
    name: 'Payment Entry',
    module: 'Accounts',
    description: 'Payment received or made',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, report: true },
      { role: 'user', read: true, write: true, create: true, delete: false, submit: true, cancel: false, report: true },
    ],
  },
  {
    name: 'Journal Entry',
    module: 'Accounts',
    description: 'Manual accounting entry',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, submit: true, cancel: true, report: true },
      { role: 'user', read: true, write: false, create: false, delete: false, submit: false, cancel: false, report: true },
    ],
  },

  // ============ SETUP MODULE ============
  {
    name: 'UOM',
    module: 'Setup',
    description: 'Unit of Measure',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: false, create: false, delete: false, report: true },
    ],
  },
  {
    name: 'Currency',
    module: 'Setup',
    description: 'Currency definition',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: false, create: false, delete: false, report: true },
    ],
  },
  {
    name: 'Tax Template',
    module: 'Setup',
    description: 'Tax rate and account configuration',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: false, create: false, delete: false, report: true },
    ],
  },

  // ============ CORE MODULE ============
  {
    name: 'User',
    module: 'Core',
    description: 'System user',
    permissions: [
      { role: 'admin', read: true, write: true, create: true, delete: true, report: true },
      { role: 'user', read: true, write: false, create: false, delete: false, report: false },
    ],
  },
  {
    name: 'Tenant',
    module: 'Core',
    isSingle: true,
    description: 'Tenant/Company settings',
    permissions: [
      { role: 'admin', read: true, write: true, create: false, delete: false, report: true },
      { role: 'user', read: true, write: false, create: false, delete: false, report: false },
    ],
  },
];
