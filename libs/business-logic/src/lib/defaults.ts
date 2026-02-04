import { DocTypeDefinition } from '@platform/meta';

const BASE_PERMISSIONS = [
    { role: 'System Manager', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, report: true },
    { role: 'user', read: true, write: true, create: true, submit: true, cancel: true, report: true },
    { role: 'Stock Manager', read: true, write: true, create: true, submit: true, cancel: true, report: true },
    { role: 'Sales Manager', read: true, write: true, create: true, submit: true, cancel: true, report: true },
    { role: 'Purchase Manager', read: true, write: true, create: true, submit: true, cancel: true, report: true },
    { role: 'Accounts Manager', read: true, write: true, create: true, submit: true, cancel: true, report: true },
];

const ACCOUNTING_PERMISSIONS = [
    { role: 'System Manager', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, report: true },
    { role: 'Accounts Manager', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, report: true },
];

const CORE_DOCS: DocTypeDefinition[] = [
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
    {
        name: 'Supplier',
        module: 'Buying',
        description: 'A supplier providing goods or services.',
        fields: [
            { name: 'name', label: 'Supplier Name', type: 'Data', required: true },
            { name: 'type', label: 'Type', type: 'Select', options: 'Company\nIndividual' },
            { name: 'email', label: 'Primary Email', type: 'Data' },
            { name: 'phone', label: 'Phone', type: 'Data' },
            { name: 'tax_id', label: 'Tax ID / VAT', type: 'Data' },
            { name: 'address', label: 'Billing Address', type: 'TextEditor' }
        ]
    },

    // --- Stock / Inventory ---
    {
        name: 'UOM',
        module: 'Stock',
        description: 'Unit of Measure.',
        fields: [
            { name: 'name', label: 'UOM', type: 'Data', required: true },
            { name: 'uom_name', label: 'UOM Name', type: 'Data' },
            { name: 'is_active', label: 'Active', type: 'Check' }
        ]
    },
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
            { name: 'has_serial', label: 'Serial Tracked', type: 'Check' },
            { name: 'reorder_level', label: 'Reorder Level', type: 'Float' },
            { name: 'reorder_qty', label: 'Reorder Qty', type: 'Float' },
            { name: 'income_account', label: 'Income Account', type: 'Link', target: 'Account' },
            { name: 'expense_account', label: 'Expense Account', type: 'Link', target: 'Account' },
            { name: 'stock_account', label: 'Stock Account', type: 'Link', target: 'Account' },
            { name: 'cogs_account', label: 'COGS Account', type: 'Link', target: 'Account' },
            { name: 'stock_uom', label: 'Stock UOM', type: 'Link', target: 'UOM' },
            { name: 'purchase_uom', label: 'Purchase UOM', type: 'Link', target: 'UOM' },
            { name: 'sales_uom', label: 'Sales UOM', type: 'Link', target: 'UOM' },
            { name: 'uoms', label: 'UOMs', type: 'Table', target: 'Item UOM' }
        ]
    },
    {
        name: 'Item UOM',
        module: 'Stock',
        isChild: true,
        fields: [
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM', required: true },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float', required: true },
            { name: 'is_stock_uom', label: 'Stock UOM', type: 'Check' }
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
        name: 'Location',
        module: 'Stock',
        description: 'Warehouse location/bins.',
        fields: [
            { name: 'name', label: 'Location Code', type: 'Data', required: true },
            { name: 'location_name', label: 'Location Name', type: 'Data' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'parent_location', label: 'Parent Location Code', type: 'Data' },
            { name: 'is_pickable', label: 'Pickable', type: 'Check' },
            { name: 'is_putaway', label: 'Putaway', type: 'Check' },
            { name: 'is_staging', label: 'Staging', type: 'Check' },
            { name: 'is_active', label: 'Active', type: 'Check' },
        ],
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
            { name: 'supplier', label: 'Supplier', type: 'Link', target: 'Supplier', required: true },
            { name: 'purchase_order', label: 'Purchase Order', type: 'Link', target: 'Purchase Order' },
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
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'purchase_order', label: 'Purchase Order', type: 'Link', target: 'Purchase Order' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'location', label: 'Location Code', type: 'Data' },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'expiry_date', label: 'Expiry Date', type: 'Date' },
            { name: 'serial_nos', label: 'Serial Nos', type: 'Small Text' },
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
            { name: 'sales_order', label: 'Sales Order', type: 'Link', target: 'Sales Order' },
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
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'sales_order', label: 'Sales Order', type: 'Link', target: 'Sales Order' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'location', label: 'Location Code', type: 'Data' },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'serial_nos', label: 'Serial Nos', type: 'Small Text' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'rate', label: 'Rate', type: 'Currency' },
            { name: 'amount', label: 'Amount', type: 'Currency', readonly: true }
        ]
    },
    {
        name: 'Stock Reservation',
        module: 'Stock',
        description: 'Reserve stock at warehouse level.',
        fields: [
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'posting_time', label: 'Posting Time', type: 'Data' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'items', label: 'Items', type: 'Table', target: 'Stock Reservation Item' },
        ],
    },
    {
        name: 'Stock Reservation Item',
        module: 'Stock',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'location', label: 'Location Code', type: 'Data' },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
        ],
    },

    // --- Stock Operations ---
    {
        name: 'Stock Transfer',
        module: 'Stock',
        description: 'Transfer stock between warehouses/locations.',
        fields: [
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'posting_time', label: 'Posting Time', type: 'Data' },
            { name: 'from_warehouse', label: 'From Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'from_location', label: 'From Location Code', type: 'Data' },
            { name: 'to_warehouse', label: 'To Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'to_location', label: 'To Location Code', type: 'Data' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Stock Transfer Item' },
        ],
    },
    {
        name: 'Stock Transfer Item',
        module: 'Stock',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'serial_nos', label: 'Serial Nos', type: 'Small Text' },
        ],
    },
    {
        name: 'Stock Reconciliation',
        module: 'Stock',
        description: 'Adjust stock to match a physical count (per location).',
        fields: [
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'posting_time', label: 'Posting Time', type: 'Data' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'location', label: 'Location Code', type: 'Data', required: true },
            { name: 'purpose', label: 'Purpose', type: 'Select', options: 'Cycle Count\nAdjustment\nOpening Balance' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Stock Reconciliation Item' },
        ],
    },
    {
        name: 'Stock Reconciliation Item',
        module: 'Stock',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'qty', label: 'Target Quantity', type: 'Float', required: true },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'serial_nos', label: 'Serial Nos', type: 'Small Text' },
            { name: 'rate', label: 'Rate (for increases)', type: 'Currency' },
        ],
    },

    {
        name: 'Pick List',
        module: 'Stock',
        description: 'Pick stock from locations into staging.',
        fields: [
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'posting_time', label: 'Posting Time', type: 'Data' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'from_location', label: 'From Location Code', type: 'Data' },
            { name: 'to_location', label: 'To Location Code', type: 'Data' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Pick List Item' },
        ],
    },
    {
        name: 'Pick List Item',
        module: 'Stock',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'location', label: 'From Location Code', type: 'Data' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'serial_nos', label: 'Serial Nos', type: 'Small Text' },
        ],
    },
    {
        name: 'Pack List',
        module: 'Stock',
        description: 'Pack picked items before shipment.',
        fields: [
            { name: 'posting_date', label: 'Posting Date', type: 'Date', required: true },
            { name: 'posting_time', label: 'Posting Time', type: 'Data' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse', required: true },
            { name: 'pick_list', label: 'Pick List', type: 'Link', target: 'Pick List' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Pack List Item' },
        ],
    },
    {
        name: 'Pack List Item',
        module: 'Stock',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'serial_nos', label: 'Serial Nos', type: 'Small Text' },
        ],
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
            { name: 'reserve_stock', label: 'Reserve Stock', type: 'Check' },
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
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse' },
            { name: 'location', label: 'Location Code', type: 'Data' },
            { name: 'batch_no', label: 'Batch No', type: 'Data' },
            { name: 'serial_nos', label: 'Serial Nos', type: 'Small Text' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'delivered_qty', label: 'Delivered Qty', type: 'Float', readonly: true },
            { name: 'billed_qty', label: 'Billed Qty', type: 'Float', readonly: true },
            { name: 'rate', label: 'Rate', type: 'Currency', required: true },
            { name: 'amount', label: 'Amount', type: 'Currency', readonly: true } // Calculated
        ]
    },
    {
        name: 'Purchase Order',
        module: 'Buying',
        fields: [
            { name: 'supplier', label: 'Supplier', type: 'Link', target: 'Supplier', required: true },
            { name: 'date', label: 'Order Date', type: 'Date', required: true },
            { name: 'schedule_date', label: 'Schedule Date', type: 'Date' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Purchase Order Item' },
            { name: 'taxes', label: 'Taxes and Charges', type: 'Table', target: 'Sales Taxes and Charges' },
            { name: 'net_total', label: 'Net Total', type: 'Currency', readonly: true },
            { name: 'total_taxes', label: 'Total Taxes', type: 'Currency', readonly: true },
            { name: 'grand_total', label: 'Grand Total', type: 'Currency', readonly: true },
            { name: 'status', label: 'Status', type: 'Select', options: 'Draft\nTo Receive\nTo Bill\nCompleted\nCancelled' }
        ]
    },
    {
        name: 'Purchase Order Item',
        module: 'Buying',
        isChild: true,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'warehouse', label: 'Warehouse', type: 'Link', target: 'Warehouse' },
            { name: 'qty', label: 'Quantity', type: 'Float', required: true },
            { name: 'received_qty', label: 'Received Qty', type: 'Float', readonly: true },
            { name: 'billed_qty', label: 'Billed Qty', type: 'Float', readonly: true },
            { name: 'rate', label: 'Rate', type: 'Currency', required: true },
            { name: 'amount', label: 'Amount', type: 'Currency', readonly: true }
        ]
    },
    {
        name: 'Purchase Invoice',
        module: 'Accounting',
        description: 'Supplier invoice with AP posting.',
        permissions: ACCOUNTING_PERMISSIONS,
        fields: [
            { name: 'supplier', label: 'Supplier', type: 'Link', target: 'Supplier', required: true },
            { name: 'purchase_order', label: 'Purchase Order', type: 'Link', target: 'Purchase Order' },
            { name: 'purchase_receipt', label: 'Purchase Receipt', type: 'Link', target: 'Purchase Receipt' },
            { name: 'posting_date', label: 'Date', type: 'Date', required: true },
            { name: 'due_date', label: 'Due Date', type: 'Date' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Purchase Invoice Item' },
            { name: 'taxes', label: 'Taxes', type: 'Table', target: 'Sales Taxes and Charges' },
            { name: 'credit_to', label: 'Credit To', type: 'Link', target: 'Account' },
            { name: 'net_total', label: 'Net Total', type: 'Currency', readonly: true },
            { name: 'total_taxes', label: 'Total Taxes', type: 'Currency', readonly: true },
            { name: 'grand_total', label: 'Grand Total', type: 'Currency', readonly: true },
            { name: 'outstanding_amount', label: 'Outstanding Amount', type: 'Currency', readonly: true },
            { name: 'status', label: 'Status', type: 'Select', options: 'Draft\nUnpaid\nPartly Paid\nPaid\nOverdue\nCancelled' }
        ]
    },
    {
        name: 'Purchase Invoice Item',
        module: 'Accounting',
        isChild: true,
        permissions: ACCOUNTING_PERMISSIONS,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'purchase_order', label: 'Purchase Order', type: 'Link', target: 'Purchase Order' },
            { name: 'uom', label: 'UOM', type: 'Link', target: 'UOM' },
            { name: 'conversion_factor', label: 'Conversion Factor', type: 'Float' },
            { name: 'qty', label: 'Quantity', type: 'Float' },
            { name: 'rate', label: 'Rate', type: 'Currency' },
            { name: 'amount', label: 'Amount', type: 'Currency' }
        ]
    },
    {
        name: 'Invoice',
        module: 'Accounting',
        description: 'Sales Invoice with auto GL posting.',
        permissions: ACCOUNTING_PERMISSIONS,
        fields: [
            { name: 'customer', label: 'Customer', type: 'Link', target: 'Customer', required: true },
            { name: 'sales_order', label: 'Sales Order', type: 'Link', target: 'Sales Order' },
            { name: 'delivery_note', label: 'Delivery Note', type: 'Link', target: 'Delivery Note' },
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
        permissions: ACCOUNTING_PERMISSIONS,
        fields: [
            { name: 'item_code', label: 'Item', type: 'Link', target: 'Item', required: true },
            { name: 'sales_order', label: 'Sales Order', type: 'Link', target: 'Sales Order' },
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
        fields: [
            { name: 'reference_doctype', label: 'Reference Type', type: 'Select', options: 'Invoice\nPurchase Invoice' },
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
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
        permissions: ACCOUNTING_PERMISSIONS,
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

export const CORE_MODULES: DocTypeDefinition[] = CORE_DOCS.map((doc) => ({
    ...doc,
    permissions: doc.permissions ?? BASE_PERMISSIONS,
}));
