export const PRINT_MODULE_OPTIONS = 'PRINT_MODULE_OPTIONS';

export interface PrintModuleOptions {
  templatesPath: string;
  defaultOptions?: PdfOptions;
  cacheTemplates?: boolean;
}

export interface PdfOptions {
  format?: 'A4' | 'A3' | 'Letter' | 'Legal' | 'Tabloid';
  landscape?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
  scale?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  preferCSSPageSize?: boolean;
}

export interface PrintFormatDefinition {
  name: string;
  doctype: string;
  template: string;
  options?: PdfOptions;
  isDefault?: boolean;
  headerHtml?: string;
  footerHtml?: string;
  css?: string;
}

export interface RenderContext {
  doc: Record<string, unknown>;
  doctype: string;
  docname: string;
  tenant?: {
    id: string;
    name: string;
    currency: string;
    logo?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
  };
  company?: {
    name: string;
    logo?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
  };
  user?: {
    name: string;
    email: string;
  };
  printDate: string;
  printTime: string;
  pageNumber?: number;
  totalPages?: number;
  locale?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface GeneratePdfResult {
  buffer: Buffer;
  pages: number;
  filename: string;
}

// Standard print format types
export type StandardPrintFormat = 
  | 'quotation'
  | 'sales-order'
  | 'delivery-note'
  | 'sales-invoice'
  | 'purchase-order'
  | 'purchase-receipt'
  | 'purchase-invoice'
  | 'payment-receipt'
  | 'statement-of-account'
  | 'packing-slip'
  | 'pick-list'
  | 'label';

// Helper types for common document structures
export interface LineItem {
  idx: number;
  itemCode: string;
  itemName: string;
  description?: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  discount?: number;
  taxRate?: number;
  taxAmount?: number;
  netAmount?: number;
}

export interface TaxSummary {
  taxName: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface DocumentTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  roundingAdjustment?: number;
  amountInWords?: string;
}
