/**
 * Default Chart of Accounts
 * Based on a simplified structure suitable for small-to-medium businesses
 * Following standard accounting principles
 */
export interface AccountSeed {
  code: string;
  name: string;
  rootType: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  accountType: string;
  isGroup?: boolean;
  parentAccountCode?: string;
}

export const DEFAULT_CHART_OF_ACCOUNTS: AccountSeed[] = [
  // ============ ASSETS ============
  {
    code: 'Assets',
    name: 'Assets',
    rootType: 'Asset',
    accountType: 'Asset',
    isGroup: true,
  },
  
  // Current Assets
  {
    code: 'Current Assets',
    name: 'Current Assets',
    rootType: 'Asset',
    accountType: 'Asset',
    isGroup: true,
    parentAccountCode: 'Assets',
  },
  {
    code: 'Cash',
    name: 'Cash',
    rootType: 'Asset',
    accountType: 'Cash',
    parentAccountCode: 'Current Assets',
  },
  {
    code: 'Bank',
    name: 'Bank Account',
    rootType: 'Asset',
    accountType: 'Bank',
    parentAccountCode: 'Current Assets',
  },
  {
    code: 'Accounts Receivable',
    name: 'Accounts Receivable',
    rootType: 'Asset',
    accountType: 'Receivable',
    parentAccountCode: 'Current Assets',
  },
  {
    code: 'Stock In Hand',
    name: 'Stock In Hand',
    rootType: 'Asset',
    accountType: 'Stock',
    parentAccountCode: 'Current Assets',
  },
  {
    code: 'Stock Received But Not Billed',
    name: 'Stock Received But Not Billed',
    rootType: 'Asset',
    accountType: 'Stock Received But Not Billed',
    parentAccountCode: 'Current Assets',
  },

  // Fixed Assets
  {
    code: 'Fixed Assets',
    name: 'Fixed Assets',
    rootType: 'Asset',
    accountType: 'Asset',
    isGroup: true,
    parentAccountCode: 'Assets',
  },
  {
    code: 'Furniture and Equipment',
    name: 'Furniture and Equipment',
    rootType: 'Asset',
    accountType: 'Fixed Asset',
    parentAccountCode: 'Fixed Assets',
  },
  {
    code: 'Accumulated Depreciation',
    name: 'Accumulated Depreciation',
    rootType: 'Asset',
    accountType: 'Accumulated Depreciation',
    parentAccountCode: 'Fixed Assets',
  },

  // ============ LIABILITIES ============
  {
    code: 'Liabilities',
    name: 'Liabilities',
    rootType: 'Liability',
    accountType: 'Liability',
    isGroup: true,
  },

  // Current Liabilities
  {
    code: 'Current Liabilities',
    name: 'Current Liabilities',
    rootType: 'Liability',
    accountType: 'Liability',
    isGroup: true,
    parentAccountCode: 'Liabilities',
  },
  {
    code: 'Accounts Payable',
    name: 'Accounts Payable',
    rootType: 'Liability',
    accountType: 'Payable',
    parentAccountCode: 'Current Liabilities',
  },
  {
    code: 'Sales Tax Payable',
    name: 'Sales Tax Payable',
    rootType: 'Liability',
    accountType: 'Tax',
    parentAccountCode: 'Current Liabilities',
  },
  {
    code: 'Payroll Liabilities',
    name: 'Payroll Liabilities',
    rootType: 'Liability',
    accountType: 'Payable',
    parentAccountCode: 'Current Liabilities',
  },

  // Long Term Liabilities
  {
    code: 'Long Term Liabilities',
    name: 'Long Term Liabilities',
    rootType: 'Liability',
    accountType: 'Liability',
    isGroup: true,
    parentAccountCode: 'Liabilities',
  },
  {
    code: 'Loans Payable',
    name: 'Loans Payable',
    rootType: 'Liability',
    accountType: 'Payable',
    parentAccountCode: 'Long Term Liabilities',
  },

  // ============ EQUITY ============
  {
    code: 'Equity',
    name: 'Equity',
    rootType: 'Equity',
    accountType: 'Equity',
    isGroup: true,
  },
  {
    code: 'Capital Stock',
    name: 'Capital Stock',
    rootType: 'Equity',
    accountType: 'Equity',
    parentAccountCode: 'Equity',
  },
  {
    code: 'Retained Earnings',
    name: 'Retained Earnings',
    rootType: 'Equity',
    accountType: 'Equity',
    parentAccountCode: 'Equity',
  },
  {
    code: 'Opening Balance Equity',
    name: 'Opening Balance Equity',
    rootType: 'Equity',
    accountType: 'Equity',
    parentAccountCode: 'Equity',
  },

  // ============ INCOME ============
  {
    code: 'Income',
    name: 'Income',
    rootType: 'Income',
    accountType: 'Income Account',
    isGroup: true,
  },
  {
    code: 'Sales',
    name: 'Sales',
    rootType: 'Income',
    accountType: 'Income Account',
    parentAccountCode: 'Income',
  },
  {
    code: 'Service Revenue',
    name: 'Service Revenue',
    rootType: 'Income',
    accountType: 'Income Account',
    parentAccountCode: 'Income',
  },
  {
    code: 'Sales Returns',
    name: 'Sales Returns',
    rootType: 'Income',
    accountType: 'Income Account',
    parentAccountCode: 'Income',
  },
  {
    code: 'Sales Discounts',
    name: 'Sales Discounts',
    rootType: 'Income',
    accountType: 'Income Account',
    parentAccountCode: 'Income',
  },
  {
    code: 'Other Income',
    name: 'Other Income',
    rootType: 'Income',
    accountType: 'Income Account',
    parentAccountCode: 'Income',
  },

  // ============ EXPENSES ============
  {
    code: 'Expenses',
    name: 'Expenses',
    rootType: 'Expense',
    accountType: 'Expense Account',
    isGroup: true,
  },
  
  // Cost of Goods Sold
  {
    code: 'Cost of Goods Sold',
    name: 'Cost of Goods Sold',
    rootType: 'Expense',
    accountType: 'Cost of Goods Sold',
    parentAccountCode: 'Expenses',
  },
  {
    code: 'Stock Adjustment',
    name: 'Stock Adjustment',
    rootType: 'Expense',
    accountType: 'Stock Adjustment',
    parentAccountCode: 'Expenses',
  },

  // Operating Expenses
  {
    code: 'Operating Expenses',
    name: 'Operating Expenses',
    rootType: 'Expense',
    accountType: 'Expense Account',
    isGroup: true,
    parentAccountCode: 'Expenses',
  },
  {
    code: 'Salaries and Wages',
    name: 'Salaries and Wages',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Rent Expense',
    name: 'Rent Expense',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Utilities',
    name: 'Utilities',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Office Supplies',
    name: 'Office Supplies',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Marketing and Advertising',
    name: 'Marketing and Advertising',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Professional Services',
    name: 'Professional Services',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Insurance',
    name: 'Insurance',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Bank Charges',
    name: 'Bank Charges',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Depreciation',
    name: 'Depreciation',
    rootType: 'Expense',
    accountType: 'Depreciation',
    parentAccountCode: 'Operating Expenses',
  },
  {
    code: 'Miscellaneous Expenses',
    name: 'Miscellaneous Expenses',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Operating Expenses',
  },

  // Shipping and Delivery
  {
    code: 'Shipping and Delivery',
    name: 'Shipping and Delivery',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Expenses',
  },

  // Purchase expenses
  {
    code: 'Purchase Returns',
    name: 'Purchase Returns',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Expenses',
  },
  {
    code: 'Purchase Discounts',
    name: 'Purchase Discounts',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Expenses',
  },

  // Write-offs
  {
    code: 'Write Off',
    name: 'Write Off',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Expenses',
  },
  {
    code: 'Exchange Gain/Loss',
    name: 'Exchange Gain/Loss',
    rootType: 'Expense',
    accountType: 'Expense Account',
    parentAccountCode: 'Expenses',
  },

  // Round Off
  {
    code: 'Round Off',
    name: 'Round Off',
    rootType: 'Expense',
    accountType: 'Round Off',
    parentAccountCode: 'Expenses',
  },
];
