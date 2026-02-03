import { Injectable, Logger } from '@nestjs/common';
import { HookService } from '@platform/meta';
import { PrismaService } from '@platform/db';
import { StockConsumptionStrategy } from '@prisma/client';
import { StockService } from './inventory/stock.service';

@Injectable()
export class BusinessLogicService {
    private readonly logger = new Logger(BusinessLogicService.name);

    constructor(
        private readonly hookService: HookService,
        private readonly prisma: PrismaService,
        private readonly stockService: StockService
    ) {
        this.registerHooks();
    }

    registerHooks() {
        // Masters (sync dynamic DocTypes -> normalized tables)
        this.registerItemMasterHooks();
        this.registerWarehouseMasterHooks();

        // Stock Management
        this.registerPurchaseReceiptHooks();
        this.registerDeliveryNoteHooks();

        // Accounting
        this.registerJournalEntryHooks();
        this.registerPaymentEntryHooks();

        // Tax & Sales
        this.registerSalesOrderHooks();
        this.registerInvoiceHooks();

        // Stock-to-GL Integration is handled in onSubmit hooks.
    }

    private registerItemMasterHooks() {
        this.hookService.register('Item', {
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
                    await tx.item.upsert({
                        where: { tenantId_code: { tenantId, code: doc.name } },
                        update: {
                            name: doc.item_name ?? doc.name,
                            isStockItem: Boolean(doc.is_stock_item ?? true),
                            hasBatch: Boolean(doc.has_batch ?? false),
                            hasSerial: Boolean(doc.has_serial ?? false),
                            isActive: true,
                        },
                        create: {
                            tenantId,
                            code: doc.name,
                            name: doc.item_name ?? doc.name,
                            isStockItem: Boolean(doc.is_stock_item ?? true),
                            hasBatch: Boolean(doc.has_batch ?? false),
                            hasSerial: Boolean(doc.has_serial ?? false),
                        },
                    });
                });
            },
        });
    }

    private registerWarehouseMasterHooks() {
        this.hookService.register('Warehouse', {
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

                    const warehouse = await tx.warehouse.upsert({
                        where: { tenantId_code: { tenantId, code: doc.name } },
                        update: { name: doc.name, isActive: true },
                        create: { tenantId, code: doc.name, name: doc.name },
                    });

                    // Ensure a minimal 2-level location structure per warehouse:
                    // ROOT -> RECEIVING, PICKING
                    const root = await tx.location.upsert({
                        where: {
                            tenantId_warehouseId_code: {
                                tenantId,
                                warehouseId: warehouse.id,
                                code: 'ROOT',
                            },
                        },
                        update: { path: warehouse.code, isActive: true, isPickable: false },
                        create: {
                            tenantId,
                            warehouseId: warehouse.id,
                            parentId: null,
                            code: 'ROOT',
                            name: 'Root',
                            path: warehouse.code,
                            isPickable: false,
                            isPutaway: false,
                            isStaging: false,
                        },
                    });

                    const receiving = await tx.location.upsert({
                        where: {
                            tenantId_warehouseId_code: {
                                tenantId,
                                warehouseId: warehouse.id,
                                code: 'RECEIVING',
                            },
                        },
                        update: {
                            parentId: root.id,
                            path: `${warehouse.code}/RECEIVING`,
                            isActive: true,
                            isPickable: false,
                            isPutaway: true,
                            isStaging: true,
                        },
                        create: {
                            tenantId,
                            warehouseId: warehouse.id,
                            parentId: root.id,
                            code: 'RECEIVING',
                            name: 'Receiving',
                            path: `${warehouse.code}/RECEIVING`,
                            isPickable: false,
                            isPutaway: true,
                            isStaging: true,
                        },
                    });

                    const picking = await tx.location.upsert({
                        where: {
                            tenantId_warehouseId_code: {
                                tenantId,
                                warehouseId: warehouse.id,
                                code: 'PICKING',
                            },
                        },
                        update: {
                            parentId: root.id,
                            path: `${warehouse.code}/PICKING`,
                            isActive: true,
                            isPickable: true,
                            isPutaway: false,
                            isStaging: true,
                        },
                        create: {
                            tenantId,
                            warehouseId: warehouse.id,
                            parentId: root.id,
                            code: 'PICKING',
                            name: 'Picking',
                            path: `${warehouse.code}/PICKING`,
                            isPickable: true,
                            isPutaway: false,
                            isStaging: true,
                        },
                    });

                    if (
                        warehouse.defaultReceivingLocationId !== receiving.id ||
                        warehouse.defaultPickingLocationId !== picking.id
                    ) {
                        await tx.warehouse.update({
                            where: { id: warehouse.id },
                            data: {
                                defaultReceivingLocationId: receiving.id,
                                defaultPickingLocationId: picking.id,
                            },
                        });
                    }
                });
            },
        });
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
	            onSubmit: async (doc) => {
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
	            onSubmit: async (doc, user) => {
	                const tenantId = user?.tenantId;
	                if (!tenantId) throw new Error('Missing tenantId in user context');

	                if (!doc.items || !Array.isArray(doc.items)) return;
	                const postingTs = this.resolvePostingTs(doc);

	                for (const item of doc.items) {
	                    await this.stockService.receiveStock({
	                        tenantId,
	                        voucherType: 'Purchase Receipt',
	                        voucherNo: doc.name,
	                        postingTs,
	                        itemCode: item.item_code,
	                        warehouseCode: item.warehouse,
	                        locationCode: item.location,
	                        batchNo: item.batch_no,
	                        batchExpDate: this.parseDateOnly(item.expiry_date),
	                        qty: item.qty,
	                        incomingRate: item.rate ?? 0,
	                    });
	                }
	                await this.postPurchaseReceiptToGL(doc);
	            },
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
	            onSubmit: async (doc, user) => {
	                const tenantId = user?.tenantId;
	                if (!tenantId) throw new Error('Missing tenantId in user context');

	                if (!doc.items || !Array.isArray(doc.items)) return;
	                const postingTs = this.resolvePostingTs(doc);

	                const strategy =
	                  doc.stock_consumption_strategy === 'FEFO'
	                    ? StockConsumptionStrategy.FEFO
	                    : doc.stock_consumption_strategy === 'FIFO'
	                      ? StockConsumptionStrategy.FIFO
	                      : undefined;

	                for (const item of doc.items) {
	                    await this.stockService.issueStock({
	                        tenantId,
	                        voucherType: 'Delivery Note',
	                        voucherNo: doc.name,
	                        postingTs,
	                        itemCode: item.item_code,
	                        warehouseCode: item.warehouse,
	                        locationCode: item.location,
	                        batchNo: item.batch_no,
	                        qty: item.qty,
	                        strategy,
	                    });
	                }
	                await this.postDeliveryNoteToCOGS(doc);
	            },
	        });
	    }

    private resolvePostingTs(doc: any): Date {
        const postingDate: string | undefined = doc.posting_date;
        const postingTime: string | undefined = doc.posting_time;
        if (!postingDate) return new Date();
        if (!postingTime) return new Date(`${postingDate}T00:00:00.000Z`);
        return new Date(`${postingDate}T${postingTime}Z`);
    }

    private parseDateOnly(value: any): Date | undefined {
        if (!value || typeof value !== 'string') return undefined;
        return new Date(`${value}T00:00:00.000Z`);
    }

    // ==================== ACCOUNTING HOOKS ====================

    private registerJournalEntryHooks() {
        this.hookService.register('Journal Entry', {
            beforeSave: (doc, user) => {
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
                    throw new Error(`Journal Entry is not balanced. Difference: ${doc.difference}`);
                }

                return doc;
            },
            onSubmit: async (doc, user) => {
                if (doc.accounts && Array.isArray(doc.accounts)) {
                    await this.postJournalEntryToGL(doc);
                }
            },
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
            onSubmit: async (doc, user) => {
                await this.postPaymentEntryToGL(doc);
            },
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
                `INSERT INTO "tabGLEntry" 
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
                `INSERT INTO "tabGLEntry" 
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
	     * Get list of counter accounts for "against" field
	     */
	    private getAgainstAccounts(accounts: any[], currentAccount: string): string {
        return accounts
            .filter(acc => acc.account !== currentAccount)
            .map(acc => acc.account)
            .join(', ');
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
