import { DocTypeDefinition } from '@platform/meta';

export const CORE_MODULES: DocTypeDefinition[] = [
    // --- CRM ---
    {
        name: 'Lead',
        module: 'CRM',
        description: 'Potential customer or opportunity.',
        fields: [
            { name: 'name', label: 'Lead Name', type: 'Data', required: true },
            { name: 'email', label: 'Email Address', type: 'Data' },
            { name: 'phone', label: 'Phone', type: 'Data' },
            { name: 'status', label: 'Status', type: 'Select', options: 'New\nContacted\nQualified\nLost\nConverted' },
            { name: 'source', label: 'Source', type: 'Select', options: 'Website\nReferral\nCold Call\nCampaign' },
            { name: 'notes', label: 'Notes', type: 'TextEditor' }
        ]
    },
    {
        name: 'Customer',
        module: 'CRM',
        description: 'A customer who has purchased products or services.',
        fields: [
            { name: 'name', label: 'Customer Name', type: 'Data', required: true },
            { name: 'type', label: 'Type', type: 'Select', options: 'Company\nIndividual' },
            { name: 'email', label: 'Primary Email', type: 'Data' },
            { name: 'phone', label: 'Phone', type: 'Data' },
            { name: 'tax_id', label: 'Tax ID / VAT', type: 'Data' },
            { name: 'address', label: 'Billing Address', type: 'TextEditor' }
        ]
    },

    // --- Stock / Inventory ---
    {
        name: 'Item',
        module: 'Stock',
        description: 'Product or Service item.',
        fields: [
            { name: 'name', label: 'Item Code', type: 'Data', required: true },
            { name: 'item_name', label: 'Item Name', type: 'Data', required: true },
            { name: 'group', label: 'Item Group', type: 'Select', options: 'Products\nServices\nRaw Material' },
            { name: 'standard_rate', label: 'Standard Selling Rate', type: 'Currency' },
            { name: 'description', label: 'Description', type: 'TextEditor' },
            { name: 'image', label: 'Image URL', type: 'Data' },
            { name: 'is_stock_item', label: 'Maintain Stock', type: 'Check' },
            { name: 'has_batch', label: 'Batch Tracked', type: 'Check' },
            { name: 'has_serial', label: 'Serial Tracked', type: 'Check' }
        ]
    },
    {
        name: 'Warehouse',
        module: 'Stock',
        description: 'Physical location where stock is stored.',
        fields: [
            { name: 'name', label: 'Warehouse Name', type: 'Data', required: true },
            { name: 'location', label: 'Location', type: 'Data' }
        ]
    },
    {
        name: 'Stock Ledger Entry',
        module: 'Stock',
        description: 'Immutable record of every stock transaction.',
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'posting_time', label: 'Posting Time', type: 'Data' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'qty_after_transaction', label: 'Qty After Transaction', type: 'Float', readonly: true },
            { name: 'valuation_rate', label: 'Valuation Rate', type: 'Currency', required: true },
            { name: 'stock_value', label: 'Stock Value', type: 'Currency', readonly: true },
            { name: 'stock_value_difference', label: 'Stock Value Difference', type: 'Currency', readonly: true },
            { name: 'voucher_type', label: 'Voucher Type', type: 'Data', required: true },
            { name: 'voucher_no', label: 'Voucher No', type: 'Data', required: true },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'serial_no', label: 'Serial No', type: 'Data' },
            { name: 'incoming_rate', label: 'Incoming Rate', type: 'Currency' }
        ]
    },
    {
        name: 'Bin',
        module: 'Stock',
        description: 'Current stock balance per item per warehouse.',
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'actual_qty', label: 'Actual Quantity', type: 'Float', readonly: true },
            { name: 'reserved_qty', label: 'Reserved Qty', type: 'Float' },
            { name: 'ordered_qty', label: 'Ordered Qty', type: 'Float' },
            { name: 'projected_qty', label: 'Projected Qty', type: 'Float', readonly: true },
            { name: 'valuation_rate', label: 'Valuation Rate', type: 'Currency', readonly: true },
            { name: 'stock_value', label: 'Stock Value', type: 'Currency', readonly: true }
        ]
    },
    {
        name: 'Purchase Receipt',
        module: 'Buying',
        description: 'Goods received from supplier.',
        fields: [
            { name: 'supplier', label: 'Supplier', type: 'Data', required: true },
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'posting_time', label: 'Posting Time', type: 'Data' },
            { name: 'supplier_invoice', label: 'Supplier Invoice', type: 'Data' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Purchase Receipt Item' },
            { name: 'total_amount', label: 'Total Amount', type: 'Currency', readonly: true }
        ]
    },
    {
        name: 'Purchase Receipt Item',
        module: 'Buying',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'location', label: 'Location Code', type: 'Data' },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'expiry_date', label: 'Expiry Date', type: 'Date' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'rate', label: 'Rate', type: 'Currency', required: true },
            { name: 'amount', label: 'Amount', type: 'Currency', readonly: true }
        ]
    },
    {
        name: 'Delivery Note',
        module: 'Stock',
        description: 'Goods delivered to customer.',
        fields: [
            { name: 'customer', label: 'Customer', type: 'Link', target: 'Customer', required: true },
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'posting_time', label: 'Posting Time', type: 'Data' },
            { name: 'stock_consumption_strategy', label: 'Stock Consumption', type: 'Select', options: 'FIFO\nFEFO' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Delivery Note Item' },
            { name: 'total_qty', label: 'Total Qty', type: 'Float', readonly: true }
        ]
    },
    {
        name: 'Delivery Note Item',
        module: 'Stock',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'location', label: 'Location Code', type: 'Data' },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'rate', label: 'Rate', type: 'Currency' },
            { name: 'amount', label: 'Amount', type: 'Currency', readonly: true }
        ]
    },

    // --- Sales ---
    {
        name: 'Sales Order',
        module: 'Selling',
        fields: [
            { name: 'customer', label: 'Customer', type: 'Link', target: 'Customer', required: true },
            { name: 'date', label: 'Order Date', type: 'Date', required: true },
            { name: 'delivery_date', label: 'Delivery Date', type: 'Date' },
            { name: 'customer_po', label: 'Customer PO', type: 'Data' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Sales Order Item' },
            { name: 'taxes', label: 'Taxes and Charges', type: 'Table', target: 'Sales Taxes and Charges' },
            { name: 'net_total', label: 'Net Total', type: 'Currency', readonly: true },
            { name: 'total_taxes', label: 'Total Taxes', type: 'Currency', readonly: true },
            { name: 'grand_total', label: 'Grand Total', type: 'Currency', readonly: true },
            { name: 'status', label: 'Status', type: 'Select', options: 'Draft\nTo Deliver\nTo Bill\nCompleted\nCancelled' }
        ]
    },
    {
        name: 'Sales Taxes and Charges',
        module: 'Selling',
        isChild: true,
        fields: [
            { name: 'charge_type', label: 'Type', type: 'Select', options: 'On Net Total\nOn Previous Row Total\nActual' },
            { name: 'account_head', label: 'Account Head', type: 'Link', target: 'Account', required: true },
            { name: 'description', label: 'Description', type: 'Data' },
            { name: 'rate', label: 'Rate', type: 'Float' },
            { name: 'tax_amount', label: 'Amount', type: 'Currency', readonly: true }
        ]
    },
    {
        name: 'Sales Order Item',
        module: 'Selling',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'rate', label: 'Rate', type: 'Currency', required: true },
            { name: 'amount', label: 'Amount', type: 'Currency', readonly: true } // Calculated
        ]
    },
    {
        name: 'Invoice',
        module: 'Accounting',
        description: 'Sales Invoice with auto GL posting.',
        fields: [
            { name: 'customer', label: 'Customer', type: 'Link', target: 'Customer', required: true },
            { name: 'posting_date', label: 'Date', type: 'Date', required: true },
            { name: 'due_date', label: 'Due Date', type: 'Date' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Invoice Item' },
            { name: 'taxes', label: 'Taxes', type: 'Table', target: 'Sales Taxes and Charges' },
            { name: 'debit_to', label: 'Debit To', type: 'Link', target: 'Account' },
            { name: 'net_total', label: 'Net Total', type: 'Currency', readonly: true },
            { name: 'total_taxes', label: 'Total Taxes', type: 'Currency', readonly: true },
            { name: 'grand_total', label: 'Grand Total', type: 'Currency', readonly: true },
            { name: 'outstanding_amount', label: 'Outstanding Amount', type: 'Currency', readonly: true },
            { name: 'status', label: 'Status', type: 'Select', options: 'Draft\nUnpaid\nPartly Paid\nPaid\nOverdue\nCancelled' }
        ]
    },
    {
        name: 'Invoice Item',
        module: 'Accounting', // Child table usually inherits module but defined explicitly
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'qty', label: 'Quantity', type: 'Float' },
            { name: 'rate', label: 'Rate', type: 'Currency' },
            { name: 'amount', label: 'Amount', type: 'Currency' }
        ]
    },

    // --- Accounting ---
    {
        name: 'Account',
        module: 'Accounting',
        description: 'Chart of Accounts - hierarchical account tree.',
        fields: [
            { name: 'name', label: 'Account Name', type: 'Data', required: true },
            { name: 'account_number', label: 'Account Number', type: 'Data' },
            { name: 'parent_account', label: 'Parent Account', type: 'Link', target: 'Account' },
            { name: 'root_type', label: 'Root Type', type: 'Select', options: 'Asset\nLiability\nEquity\nIncome\nExpense', required: true },
            { name: 'account_type', label: 'Account Type', type: 'Select', options: 'Bank\nCash\nReceivable\nPayable\nStock\nTax\nCost of Goods Sold\nExpense Account\nIncome Account\nFixed Asset\nAccumulated Depreciation' },
            { name: 'is_group', label: 'Is Group', type: 'Check' },
            { name: 'account_currency', label: 'Currency', type: 'Data' },
            { name: 'frozen', label: 'Frozen', type: 'Check' }
        ]
    },
    {
        name: 'GL Entry',
        module: 'Accounting',
        description: 'General Ledger Entry - double-entry bookkeeping.',
        fields: [
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'account', label: 'Account', type: 'Link', target: 'Account', required: true },
            { name: 'debit', label: 'Debit', type: 'Currency' },
            { name: 'credit', label: 'Credit', type: 'Currency' },
            { name: 'against', label: 'Against Account', type: 'Data' },
            { name: 'voucher_type', label: 'Voucher Type', type: 'Data', required: true },
            { name: 'voucher_no', label: 'Voucher No', type: 'Data', required: true },
            { name: 'remarks', label: 'Remarks', type: 'Text' },
            { name: 'is_cancelled', label: 'Is Cancelled', type: 'Check' },
            { name: 'party_type', label: 'Party Type', type: 'Data' },
            { name: 'party', label: 'Party', type: 'Data' },
            { name: 'cost_center', label: 'Cost Center', type: 'Data' },
            { name: 'project', label: 'Project', type: 'Data' }
        ]
    },
    {
        name: 'Journal Entry',
        module: 'Accounting',
        description: 'Manual journal entries for adjustments.',
        fields: [
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'entry_type', label: 'Entry Type', type: 'Select', options: 'Journal Entry\nBank Entry\nCash Entry\nOpening Entry\nContra Entry', required: true },
            { name: 'accounts', label: 'Accounts', type: 'Table', target: 'Journal Entry Account' },
            { name: 'total_debit', label: 'Total Debit', type: 'Currency', readonly: true },
            { name: 'total_credit', label: 'Total Credit', type: 'Currency', readonly: true },
            { name: 'difference', label: 'Difference', type: 'Currency', readonly: true },
            { name: 'user_remark', label: 'User Remark', type: 'Text' }
        ]
    },
    {
        name: 'Journal Entry Account',
        module: 'Accounting',
        isChild: true,
        fields: [
            { name: 'account', label: 'Account', type: 'Link', target: 'Account', required: true },
            { name: 'debit', label: 'Debit', type: 'Currency' },
            { name: 'credit', label: 'Credit', type: 'Currency' },
            { name: 'reference_type', label: 'Reference Type', type: 'Data' },
            { name: 'reference_name', label: 'Reference Name', type: 'Data' }
        ]
    },
    {
        name: 'Payment Entry',
        module: 'Accounting',
        description: 'Record payments received or made.',
        fields: [
            { name: 'payment_type', label: 'Payment Type', type: 'Select', options: 'Receive\nPay', required: true },
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'party_type', label: 'Party Type', type: 'Select', options: 'Customer\nSupplier\nEmployee', required: true },
            { name: 'party', label: 'Party', type: 'Data', required: true },
            { name: 'paid_from', label: 'Paid From', type: 'Link', target: 'Account' },
            { name: 'paid_to', label: 'Paid To', type: 'Link', target: 'Account' },
            { name: 'paid_amount', label: 'Paid Amount', type: 'Currency', required: true },
            { name: 'received_amount', label: 'Received Amount', type: 'Currency' },
            { name: 'reference_no', label: 'Reference No', type: 'Data' },
            { name: 'reference_date', label: 'Reference Date', type: 'Date' },
            { name: 'references', label: 'Payment References', type: 'Table', target: 'Payment Entry Reference' }
        ]
    },
    {
        name: 'Payment Entry Reference',
        module: 'Accounting',
        isChild: true,
        fields: [
            { name: 'reference_doctype', label: 'Reference Type', type: 'Select', options: 'Sales Invoice\nPurchase Invoice' },
            { name: 'reference_name', label: 'Reference Name', type: 'Data' },
            { name: 'total_amount', label: 'Total Amount', type: 'Currency', readonly: true },
            { name: 'outstanding_amount', label: 'Outstanding Amount', type: 'Currency', readonly: true },
            { name: 'allocated_amount', label: 'Allocated Amount', type: 'Currency' }
        ]
    },
    {
        name: 'Tax Template',
        module: 'Accounting',
        description: 'Define tax rates and accounts.',
        fields: [
            { name: 'name', label: 'Tax Template Name', type: 'Data', required: true },
            { name: 'title', label: 'Title', type: 'Data' },
            { name: 'type', label: 'Type', type: 'Select', options: 'Sales\nPurchase\nBoth' },
            { name: 'accounts', label: 'Tax Accounts', type: 'Table', target: 'Tax Template Account' }
        ]
    },
    {
        name: 'Tax Template Account',
        module: 'Accounting',
        isChild: true,
        fields: [
            { name: 'account_head', label: 'Account Head', type: 'Link', target: 'Account', required: true },
            { name: 'rate', label: 'Rate (%)', type: 'Float', required: true },
            { name: 'description', label: 'Description', type: 'Text' }
        ]
    },
    {
        name: 'Bank Reconciliation',
        module: 'Accounting',
        description: 'Reconcile bank statement with GL entries.',
        fields: [
            { name: 'account', label: 'Bank Account', type: 'Link', target: 'Account', required: true },
            { name: 'from_date', label: 'From Date', type: 'Date', required: true },
            { name: 'to_date', label: 'To Date', type: 'Date', required: true },
            { name: 'bank_statement_balance', label: 'Bank Statement Balance', type: 'Currency' },
            { name: 'gl_balance', label: 'GL Balance', type: 'Currency', readonly: true },
            { name: 'difference', label: 'Difference', type: 'Currency', readonly: true },
            { name: 'entries', label: 'Entries', type: 'Table', target: 'Bank Reconciliation Entry' }
        ]
    },
    {
        name: 'Bank Reconciliation Entry',
        module: 'Accounting',
        isChild: true,
        fields: [
            { name: 'payment_entry', label: 'Payment Entry', type: 'Link', target: 'Payment Entry' },
            { name: 'amount', label: 'Amount', type: 'Currency', readonly: true },
            { name: 'cleared', label: 'Cleared', type: 'Check' }
        ]
    },
    {
        name: 'Cost Center',
        module: 'Accounting',
        description: 'Track costs by department or project.',
        fields: [
            { name: 'name', label: 'Cost Center Name', type: 'Data', required: true },
            { name: 'parent_cost_center', label: 'Parent Cost Center', type: 'Link', target: 'Cost Center' },
            { name: 'is_group', label: 'Is Group', type: 'Check' }
        ]
    },

    // --- HR ---
    {
        name: 'Employee',
        module: 'HR',
        fields: [
            { name: 'first_name', label: 'First Name', type: 'Data', required: true },
            { name: 'last_name', label: 'Last Name', type: 'Data' },
            { name: 'status', label: 'Status', type: 'Select', options: 'Active\nLeft\nSuspended' },
            { name: 'department', label: 'Department', type: 'Link', target: 'Department' },
            { name: 'designation', label: 'Designation', type: 'Data' }, // Could be link
            { name: 'date_of_joining', label: 'Date of Joining', type: 'Date' }
        ]
    },
    {
        name: 'Department',
        module: 'HR',
        fields: [
            { name: 'name', label: 'Department Name', type: 'Data', required: true },
            { name: 'head', label: 'Department Head', type: 'Link', target: 'Employee' }
        ]
    }
];
