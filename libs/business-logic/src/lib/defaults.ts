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
            { name: 'is_stock_item', label: 'Maintain Stock', type: 'Check' }
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
            { name: 'total_amount', label: 'Grand Total', type: 'Currency', readonly: true },
            { name: 'status', label: 'Status', type: 'Select', options: 'Draft\nTo Deliver\nTo Bill\nCompleted\nCancelled' }
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
        fields: [
            { name: 'customer', label: 'Customer', type: 'Link', target: 'Customer', required: true },
            { name: 'posting_date', label: 'Date', type: 'Date', required: true },
            { name: 'due_date', label: 'Due Date', type: 'Date' },
            { name: 'items', label: 'Items', type: 'Table', target: 'Invoice Item' },
            { name: 'grand_total', label: 'Grand Total', type: 'Currency', readonly: true },
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
