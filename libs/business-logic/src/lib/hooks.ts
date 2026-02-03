import { Injectable, Logger } from '@nestjs/common';
import { DocHooks, HookService } from '@platform/meta';
import { PrismaService } from '@platform/db';

@Injectable()
export class BusinessLogicService {
    private readonly logger = new Logger(BusinessLogicService.name);

    constructor(
        private readonly hookService: HookService,
        private readonly prisma: PrismaService
    ) {
        this.registerHooks();
    }

    registerHooks() {
        // Stock Management
        this.registerPurchaseReceiptHooks();
        this.registerDeliveryNoteHooks();

        // Accounting
        this.registerJournalEntryHooks();
        this.registerPaymentEntryHooks();

        // Tax & Sales
        this.registerSalesOrderHooks();
        this.registerInvoiceHooks();

        // Stock-to-GL Integration
        this.registerPurchaseReceiptGLHooks();
        this.registerDeliveryNoteGLHooks();
    }

    private registerSalesOrderHooks() {
        this.hookService.register('Sales Order', {
            beforeSave: async (doc, user) => {
                this.logger.log(`Processing Sales Order ${doc.name || 'New'}`);
                
                // Auto-Name
                if (!doc.name) {
                    doc.name = `SO-${Date.now().toString().slice(-6)}`;
                }

                // Calculate taxes and totals
                await this.calculateTaxes(doc);

                return doc;
            },
            afterSave: (doc) => {
                this.logger.log(`Sales Order ${doc.name} saved.`);
            }
        });
    }

    private registerInvoiceHooks() {
         this.hookService.register('Invoice', {
            beforeSave: async (doc, user) => {
                // Auto-Name
                if (!doc.name) {
                    doc.name = `INV-${Date.now().toString().slice(-6)}`;
                }

                // Calculate taxes and totals
                await this.calculateTaxes(doc);
                return doc;
            },
            afterSubmit: async (doc) => {
                // Post to GL when invoice is submitted (docstatus = 1)
                await this.postInvoiceToGL(doc);
            }
         });
    }

    private registerPurchaseReceiptHooks() {
        this.hookService.register('Purchase Receipt', {
            beforeSave: (doc, user) => {
                // Auto-Name
                if (!doc.name) {
                    doc.name = `PR-${Date.now().toString().slice(-6)}`;
                }

                // Calculate Totals
                if (doc.items && Array.isArray(doc.items)) {
                    let total = 0;
                    doc.items = doc.items.map((item: any) => {
                        const qty = Number(item.qty || 0);
                        const rate = Number(item.rate || 0);
                        const amount = qty * rate;
                        total += amount;
                        return { ...item, amount };
                    });
                    doc.total_amount = total;
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                // Create Stock Ledger Entries on Submit (docstatus = 1)
                if (doc.docstatus === 1 && doc.items && Array.isArray(doc.items)) {
                    await this.createStockLedgerEntries(doc, 'Purchase Receipt', 1);
                }
            }
        });
    }

    private registerDeliveryNoteHooks() {
        this.hookService.register('Delivery Note', {
            beforeSave: (doc, user) => {
                // Auto-Name
                if (!doc.name) {
                    doc.name = `DN-${Date.now().toString().slice(-6)}`;
                }

                // Calculate Total Qty
                if (doc.items && Array.isArray(doc.items)) {
                    let totalQty = 0;
                    doc.items = doc.items.map((item: any) => {
                        const qty = Number(item.qty || 0);
                        const rate = Number(item.rate || 0);
                        const amount = qty * rate;
                        totalQty += qty;
                        return { ...item, amount };
                    });
                    doc.total_qty = totalQty;
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                // Create Stock Ledger Entries on Submit (docstatus = 1)
                if (doc.docstatus === 1 && doc.items && Array.isArray(doc.items)) {
                    await this.createStockLedgerEntries(doc, 'Delivery Note', -1);
                }
            }
        });
    }

    /**
     * Create Stock Ledger Entries and update Bin
     * @param doc Parent document (Purchase Receipt or Delivery Note)
     * @param voucherType Type of transaction
     * @param multiplier 1 for IN, -1 for OUT
     */
    private async createStockLedgerEntries(doc: any, voucherType: string, multiplier: number) {
        for (const item of doc.items) {
            const itemCode = item.item_code;
            const warehouse = item.warehouse;
            const qty = Number(item.qty || 0) * multiplier;
            const rate = Number(item.rate || 0);

            // Get current stock value using FIFO
            const valuationRate = await this.getValuationRate(itemCode, warehouse, qty, rate);
            
            // Get qty before transaction
            const qtyBefore = await this.getCurrentQty(itemCode, warehouse);
            const qtyAfter = qtyBefore + qty;

            const stockValueDifference = qty * valuationRate;
            const stockValue = qtyAfter * valuationRate;

            // Insert Stock Ledger Entry
            const ledgerEntry = {
                name: `SLE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                item_code: itemCode,
                warehouse: warehouse,
                posting_date: doc.posting_date,
                posting_time: new Date().toISOString().split('T')[1].slice(0, 8),
                qty: qty,
                qty_after_transaction: qtyAfter,
                valuation_rate: valuationRate,
                stock_value: stockValue,
                stock_value_difference: stockValueDifference,
                voucher_type: voucherType,
                voucher_no: doc.name,
                incoming_rate: multiplier > 0 ? rate : null
            };

            await this.prisma.$queryRawUnsafe(
                `INSERT INTO "tabStockLedgerEntry" 
                (name, item_code, warehouse, posting_date, posting_time, qty, qty_after_transaction, 
                 valuation_rate, stock_value, stock_value_difference, voucher_type, voucher_no, incoming_rate)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                ledgerEntry.name, ledgerEntry.item_code, ledgerEntry.warehouse, 
                ledgerEntry.posting_date, ledgerEntry.posting_time, ledgerEntry.qty,
                ledgerEntry.qty_after_transaction, ledgerEntry.valuation_rate,
                ledgerEntry.stock_value, ledgerEntry.stock_value_difference,
                ledgerEntry.voucher_type, ledgerEntry.voucher_no, ledgerEntry.incoming_rate
            );

            // Update or Create Bin
            await this.updateBin(itemCode, warehouse, qtyAfter, valuationRate, stockValue);
        }
    }

    /**
     * Get current quantity from Bin
     */
    private async getCurrentQty(itemCode: string, warehouse: string): Promise<number> {
        const result = await this.prisma.$queryRawUnsafe(
            `SELECT actual_qty FROM "tabBin" WHERE item_code = $1 AND warehouse = $2`,
            itemCode, warehouse
        );
        return (result as any)[0]?.actual_qty || 0;
    }

    /**
     * Calculate valuation rate using FIFO method
     */
    private async getValuationRate(
        itemCode: string, 
        warehouse: string, 
        qty: number, 
        incomingRate: number
    ): Promise<number> {
        if (qty > 0) {
            // Incoming: Use the incoming rate
            return incomingRate;
        } else {
            // Outgoing: Use FIFO - get weighted average of existing stock
            const bin = await this.prisma.$queryRawUnsafe(
                `SELECT valuation_rate FROM "tabBin" WHERE item_code = $1 AND warehouse = $2`,
                itemCode, warehouse
            );
            return (bin as any)[0]?.valuation_rate || 0;
        }
    }

    /**
     * Update Bin with latest stock levels
     */
    private async updateBin(
        itemCode: string, 
        warehouse: string, 
        actualQty: number, 
        valuationRate: number,
        stockValue: number
    ) {
        const existing = await this.prisma.$queryRawUnsafe(
            `SELECT name FROM "tabBin" WHERE item_code = $1 AND warehouse = $2`,
            itemCode, warehouse
        );

        const projectedQty = actualQty; // Simplified: actual + ordered - reserved

        if ((existing as any).length > 0) {
            // Update
            await this.prisma.$queryRawUnsafe(
                `UPDATE "tabBin" 
                SET actual_qty = $1, valuation_rate = $2, stock_value = $3, projected_qty = $4, modified = NOW()
                WHERE item_code = $5 AND warehouse = $6`,
                actualQty, valuationRate, stockValue, projectedQty, itemCode, warehouse
            );
        } else {
            // Insert
            const binName = `BIN-${itemCode}-${warehouse}`;
            await this.prisma.$queryRawUnsafe(
                `INSERT INTO "tabBin" 
                (name, item_code, warehouse, actual_qty, reserved_qty, ordered_qty, projected_qty, valuation_rate, stock_value)
                VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7)`,
                binName, itemCode, warehouse, actualQty, projectedQty, valuationRate, stockValue
            );
        }
    }

    // ==================== ACCOUNTING HOOKS ====================

    private registerJournalEntryHooks() {
        this.hookService.register('Journal Entry', {\n            beforeSave: (doc, user) => {
                // Auto-Name
                if (!doc.name) {
                    doc.name = `JE-${Date.now().toString().slice(-6)}`;
                }

                // Calculate totals
                if (doc.accounts && Array.isArray(doc.accounts)) {
                    let totalDebit = 0;
                    let totalCredit = 0;
                    
                    doc.accounts.forEach((account: any) => {
                        totalDebit += Number(account.debit || 0);
                        totalCredit += Number(account.credit || 0);
                    });
                    
                    doc.total_debit = totalDebit;
                    doc.total_credit = totalCredit;
                    doc.difference = Math.abs(totalDebit - totalCredit);
                }

                // Validation: Debit must equal Credit
                if (doc.difference > 0.01) {
                    throw new Error(`Journal Entry is not balanced. Difference: ${doc.difference}`);\n                }

                return doc;
            },
            afterSave: async (doc, user) => {
                // Post to GL on Submit
                if (doc.docstatus === 1 && doc.accounts && Array.isArray(doc.accounts)) {
                    await this.postJournalEntryToGL(doc);
                }
            }
        });
    }

    private registerPaymentEntryHooks() {
        this.hookService.register('Payment Entry', {
            beforeSave: (doc, user) => {
                // Auto-Name
                if (!doc.name) {
                    doc.name = `PE-${Date.now().toString().slice(-6)}`;
                }

                // Set received amount = paid amount by default
                if (!doc.received_amount) {
                    doc.received_amount = doc.paid_amount;
                }

                return doc;
            },
            afterSave: async (doc, user) => {
                // Post to GL on Submit
                if (doc.docstatus === 1) {
                    await this.postPaymentEntryToGL(doc);
                }
            }
        });
    }

    /**
     * Post Journal Entry to GL
     */
    private async postJournalEntryToGL(doc: any) {
        for (const account of doc.accounts) {
            const glEntry = {
                name: `GLE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                posting_date: doc.posting_date,
                account: account.account,
                debit: Number(account.debit || 0),
                credit: Number(account.credit || 0),
                against: this.getAgainstAccounts(doc.accounts, account.account),
                voucher_type: 'Journal Entry',
                voucher_no: doc.name,
                remarks: doc.user_remark || `Journal Entry: ${doc.name}`,
                is_cancelled: false
            };

            await this.prisma.$queryRawUnsafe(
                `INSERT INTO \"tabGLEntry\" 
                (name, posting_date, account, debit, credit, against, voucher_type, voucher_no, remarks, is_cancelled)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                glEntry.name, glEntry.posting_date, glEntry.account,
                glEntry.debit, glEntry.credit, glEntry.against,
                glEntry.voucher_type, glEntry.voucher_no, glEntry.remarks, glEntry.is_cancelled
            );
        }
    }

    /**
     * Post Payment Entry to GL
     */
    private async postPaymentEntryToGL(doc: any) {
        const glEntries = [];

        if (doc.payment_type === 'Receive') {
            // Debit: Paid To (Bank/Cash)
            glEntries.push({
                account: doc.paid_to,
                debit: doc.paid_amount,
                credit: 0,
                against: doc.party
            });

            // Credit: Receivable (if customer) or other
            glEntries.push({
                account: doc.paid_from || 'Accounts Receivable',
                debit: 0,
                credit: doc.paid_amount,
                against: doc.paid_to
            });
        } else {
            // Payment Type = Pay
            // Debit: Payable (if supplier) or Expense
            glEntries.push({
                account: doc.paid_to || 'Accounts Payable',
                debit: doc.paid_amount,
                credit: 0,
                against: doc.paid_from
            });

            // Credit: Paid From (Bank/Cash)
            glEntries.push({
                account: doc.paid_from,
                debit: 0,
                credit: doc.paid_amount,
                against: doc.party
            });
        }

        for (const entry of glEntries) {
            const glEntry = {
                name: `GLE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                posting_date: doc.posting_date,
                account: entry.account,
                debit: entry.debit,
                credit: entry.credit,
                against: entry.against,
                voucher_type: 'Payment Entry',
                voucher_no: doc.name,
                remarks: `Payment ${doc.payment_type} - ${doc.party}`,
                is_cancelled: false,
                party_type: doc.party_type,
                party: doc.party
            };

            await this.prisma.$queryRawUnsafe(
                `INSERT INTO \"tabGLEntry\" 
                (name, posting_date, account, debit, credit, against, voucher_type, voucher_no, remarks, is_cancelled, party_type, party)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                glEntry.name, glEntry.posting_date, glEntry.account,
                glEntry.debit, glEntry.credit, glEntry.against,
                glEntry.voucher_type, glEntry.voucher_no, glEntry.remarks,
                glEntry.is_cancelled, glEntry.party_type, glEntry.party
            );
        }
    }

    /**
     * Get list of counter accounts for \"against\" field
     */
    private getAgainstAccounts(accounts: any[], currentAccount: string): string {
        return accounts
            .filter(acc => acc.account !== currentAccount)
            .map(acc => acc.account)
            .join(', ');
    }

    // ==================== TAX CALCULATION ENGINE ====================

    registerSalesOrderHooks() {
        this.registerHook('Sales Order', 'beforeSave', async (doc: any) => {
            await this.calculateTaxes(doc);
        });
    }

    registerInvoiceHooks() {
        this.registerHook('Invoice', 'beforeSave', async (doc: any) => {
            await this.calculateTaxes(doc);
        });

        this.registerHook('Invoice', 'afterSubmit', async (doc: any) => {
            await this.postInvoiceToGL(doc);
        });
    }

    private async calculateTaxes(doc: any) {
        const items = doc.items || [];
        let netTotal = 0;

        // Calculate net total from items
        for (const item of items) {
            const amount = (item.qty || 0) * (item.rate || 0);
            item.amount = amount;
            netTotal += amount;
        }

        doc.net_total = netTotal;

        // Calculate taxes
        const taxes = doc.taxes || [];
        let totalTaxes = 0;
        let runningTotal = netTotal;

        for (const tax of taxes) {
            let taxAmount = 0;

            if (tax.charge_type === 'On Net Total') {
                taxAmount = (netTotal * (tax.rate || 0)) / 100;
            } else if (tax.charge_type === 'On Previous Row Total') {
                taxAmount = (runningTotal * (tax.rate || 0)) / 100;
            } else if (tax.charge_type === 'Actual') {
                taxAmount = tax.rate || 0; // Actual amount
            }

            tax.tax_amount = taxAmount;
            totalTaxes += taxAmount;
            runningTotal += taxAmount;
        }

        doc.total_taxes = totalTaxes;
        doc.grand_total = netTotal + totalTaxes;
        doc.outstanding_amount = doc.grand_total; // For invoices
    }

    private async postInvoiceToGL(doc: any) {
        const tenantId = doc.tenant_id;
        const voucherType = 'Invoice';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().split('T')[0];

        // Debit: Accounts Receivable (debit_to)
        await this.prisma.$executeRawUnsafe(`
            INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit, 
                                    voucher_type, voucher_no, party_type, party, against, docstatus)
            VALUES ($1, gen_random_uuid()::text, $2, $3, $4, 0, $5, $6, 'Customer', $7, $8, 1)
        `, tenantId, postingDate, doc.debit_to, doc.grand_total, voucherType, voucherNo, doc.customer, 'Sales');

        // Credit: Sales (Revenue)
        const items = doc.items || [];
        for (const item of items) {
            const incomeAccount = 'Sales'; // TODO: Get from item or default
            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                        voucher_type, voucher_no, against, docstatus)
                VALUES ($1, gen_random_uuid()::text, $2, $3, 0, $4, $5, $6, $7, 1)
            `, tenantId, postingDate, incomeAccount, item.amount, voucherType, voucherNo, doc.customer);
        }

        // Credit: Tax accounts
        const taxes = doc.taxes || [];
        for (const tax of taxes) {
            if (tax.tax_amount > 0) {
                await this.prisma.$executeRawUnsafe(`
                    INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                            voucher_type, voucher_no, against, docstatus)
                    VALUES ($1, gen_random_uuid()::text, $2, $3, 0, $4, $5, $6, $7, 1)
                `, tenantId, postingDate, tax.account_head, tax.tax_amount, voucherType, voucherNo, doc.customer);
            }
        }
    }

    // ==================== STOCK-TO-GL INTEGRATION ====================

    registerPurchaseReceiptGLHooks() {
        this.registerHook('Purchase Receipt', 'afterSubmit', async (doc: any) => {
            await this.postPurchaseReceiptToGL(doc);
        });
    }

    private async postPurchaseReceiptToGL(doc: any) {
        const tenantId = doc.tenant_id;
        const voucherType = 'Purchase Receipt';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().split('T')[0];

        const items = doc.items || [];
        let totalAmount = 0;

        // Debit: Stock Asset
        for (const item of items) {
            const amount = (item.qty || 0) * (item.rate || 0);
            totalAmount += amount;

            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                        voucher_type, voucher_no, against, docstatus)
                VALUES ($1, gen_random_uuid()::text, $2, 'Stock Asset', $3, 0, $4, $5, 'Creditors', 1)
            `, tenantId, postingDate, amount, voucherType, voucherNo);
        }

        // Credit: Accounts Payable
        const supplier = doc.supplier || 'Supplier';
        await this.prisma.$executeRawUnsafe(`
            INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                    voucher_type, voucher_no, party_type, party, against, docstatus)
            VALUES ($1, gen_random_uuid()::text, $2, 'Creditors', 0, $3, $4, $5, 'Supplier', $6, 'Stock Asset', 1)
        `, tenantId, postingDate, totalAmount, voucherType, voucherNo, supplier);
    }

    registerDeliveryNoteGLHooks() {
        this.registerHook('Delivery Note', 'afterSubmit', async (doc: any) => {
            await this.postDeliveryNoteToCOGS(doc);
        });
    }

    private async postDeliveryNoteToCOGS(doc: any) {
        const tenantId = doc.tenant_id;
        const voucherType = 'Delivery Note';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().split('T')[0];

        const items = doc.items || [];

        for (const item of items) {
            // Get FIFO valuation (already calculated in stock hooks)
            const valuationAmount = item.valuation_amount || 0;

            // Debit: Cost of Goods Sold
            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                        voucher_type, voucher_no, against, docstatus)
                VALUES ($1, gen_random_uuid()::text, $2, 'Cost of Goods Sold', $3, 0, $4, $5, 'Stock Asset', 1)
            `, tenantId, postingDate, valuationAmount, voucherType, voucherNo);

            // Credit: Stock Asset
            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                        voucher_type, voucher_no, against, docstatus)
                VALUES ($1, gen_random_uuid()::text, $2, 'Stock Asset', 0, $3, $4, $5, 'Cost of Goods Sold', 1)
            `, tenantId, postingDate, valuationAmount, voucherType, voucherNo);
        }
    }
}

