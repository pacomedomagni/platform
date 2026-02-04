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
        this.registerUomMasterHooks();
        this.registerItemMasterHooks();
        this.registerWarehouseMasterHooks();
        this.registerLocationMasterHooks();

        // Stock Management
        this.registerPurchaseReceiptHooks();
        this.registerDeliveryNoteHooks();
        this.registerStockTransferHooks();
        this.registerStockReconciliationHooks();
        this.registerStockReservationHooks();
        this.registerPickListHooks();
        this.registerPackListHooks();

        // Accounting
        this.registerJournalEntryHooks();
        this.registerPaymentEntryHooks();

        // Tax & Sales
        this.registerSalesOrderHooks();
        this.registerInvoiceHooks();
        this.registerPurchaseOrderHooks();
        this.registerPurchaseInvoiceHooks();

        // Stock-to-GL Integration is handled in onSubmit hooks.
    }

    private registerUomMasterHooks() {
        this.hookService.register('UOM', {
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
                    await tx.uom.upsert({
                        where: { code: doc.name },
                        update: {
                            name: doc.uom_name ?? doc.name,
                            isActive: Boolean(doc.is_active ?? true),
                        },
                        create: {
                            code: doc.name,
                            name: doc.uom_name ?? doc.name,
                            isActive: Boolean(doc.is_active ?? true),
                        },
                    });
                });
            },
        });
    }

    private registerItemMasterHooks() {
        this.hookService.register('Item', {
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
                    const ensureUom = async (code?: string) => {
                        if (!code) return;
                        await tx.uom.upsert({
                            where: { code },
                            update: { name: code, isActive: true },
                            create: { code, name: code, isActive: true },
                        });
                    };
                    await Promise.all([
                        ensureUom(doc.stock_uom),
                        ensureUom(doc.purchase_uom),
                        ensureUom(doc.sales_uom),
                    ]);

                    await tx.item.upsert({
                        where: { tenantId_code: { tenantId, code: doc.name } },
                        update: {
                            name: doc.item_name ?? doc.name,
                            isStockItem: Boolean(doc.is_stock_item ?? true),
                            hasBatch: Boolean(doc.has_batch ?? false),
                            hasSerial: Boolean(doc.has_serial ?? false),
                            isActive: true,
                            stockUomCode: doc.stock_uom ?? null,
                            purchaseUomCode: doc.purchase_uom ?? null,
                            salesUomCode: doc.sales_uom ?? null,
                            reorderLevel: doc.reorder_level ?? null,
                            reorderQty: doc.reorder_qty ?? null,
                            incomeAccount: doc.income_account ?? null,
                            expenseAccount: doc.expense_account ?? null,
                            stockAccount: doc.stock_account ?? null,
                            cogsAccount: doc.cogs_account ?? null,
                        },
                        create: {
                            tenantId,
                            code: doc.name,
                            name: doc.item_name ?? doc.name,
                            isStockItem: Boolean(doc.is_stock_item ?? true),
                            hasBatch: Boolean(doc.has_batch ?? false),
                            hasSerial: Boolean(doc.has_serial ?? false),
                            stockUomCode: doc.stock_uom ?? null,
                            purchaseUomCode: doc.purchase_uom ?? null,
                            salesUomCode: doc.sales_uom ?? null,
                            reorderLevel: doc.reorder_level ?? null,
                            reorderQty: doc.reorder_qty ?? null,
                            incomeAccount: doc.income_account ?? null,
                            expenseAccount: doc.expense_account ?? null,
                            stockAccount: doc.stock_account ?? null,
                            cogsAccount: doc.cogs_account ?? null,
                        },
                    });

                    if (Array.isArray(doc.uoms)) {
                        const item = await tx.item.findUnique({
                            where: { tenantId_code: { tenantId, code: doc.name } },
                        });
                        if (!item) return;

                        const uomCodes = new Set<string>();
                        for (const row of doc.uoms) {
                            const uomCode = row.uom;
                            if (!uomCode) continue;
                            uomCodes.add(uomCode);
                            await ensureUom(uomCode);
                            await tx.itemUom.upsert({
                                where: {
                                    tenantId_itemId_uomCode: {
                                        tenantId,
                                        itemId: item.id,
                                        uomCode,
                                    },
                                },
                                update: {
                                    conversionFactor: row.conversion_factor ?? 1,
                                    isActive: true,
                                },
                                create: {
                                    tenantId,
                                    itemId: item.id,
                                    uomCode,
                                    conversionFactor: row.conversion_factor ?? 1,
                                    isActive: true,
                                },
                            });
                        }

                        await tx.itemUom.deleteMany({
                            where: {
                                tenantId,
                                itemId: item.id,
                                uomCode: { notIn: Array.from(uomCodes) },
                            },
                        });
                    }
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

                    await tx.location.upsert({
                        where: {
                            tenantId_warehouseId_code: {
                                tenantId,
                                warehouseId: warehouse.id,
                                code: 'STAGING',
                            },
                        },
                        update: {
                            parentId: root.id,
                            path: `${warehouse.code}/STAGING`,
                            isActive: true,
                            isPickable: false,
                            isPutaway: false,
                            isStaging: true,
                        },
                        create: {
                            tenantId,
                            warehouseId: warehouse.id,
                            parentId: root.id,
                            code: 'STAGING',
                            name: 'Staging',
                            path: `${warehouse.code}/STAGING`,
                            isPickable: false,
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

    private registerLocationMasterHooks() {
        this.hookService.register('Location', {
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name || !doc?.warehouse) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
                    const warehouse = await tx.warehouse.findUnique({
                        where: { tenantId_code: { tenantId, code: doc.warehouse } },
                    });
                    if (!warehouse) throw new Error(`Unknown warehouse: ${doc.warehouse}`);

                    const parentCode = doc.parent_location || 'ROOT';
                    const parent =
                        doc.name === 'ROOT' && !doc.parent_location
                            ? null
                            : await tx.location.findUnique({
                                  where: {
                                      tenantId_warehouseId_code: {
                                          tenantId,
                                          warehouseId: warehouse.id,
                                          code: parentCode,
                                      },
                                  },
                              });

                    if (!parent && doc.name !== 'ROOT') {
                        throw new Error(
                            `Unknown parent location: ${parentCode}. Create ROOT or parent first.`,
                        );
                    }

                    const path =
                        doc.name === 'ROOT'
                            ? warehouse.code
                            : `${parent!.path}/${doc.name}`;

                    await tx.location.upsert({
                        where: {
                            tenantId_warehouseId_code: {
                                tenantId,
                                warehouseId: warehouse.id,
                                code: doc.name,
                            },
                        },
                        update: {
                            parentId: parent?.id ?? null,
                            name: doc.location_name ?? doc.name,
                            path,
                            isPickable: Boolean(doc.is_pickable ?? true),
                            isPutaway: Boolean(doc.is_putaway ?? true),
                            isStaging: Boolean(doc.is_staging ?? false),
                            isActive: Boolean(doc.is_active ?? true),
                        },
                        create: {
                            tenantId,
                            warehouseId: warehouse.id,
                            parentId: parent?.id ?? null,
                            code: doc.name,
                            name: doc.location_name ?? doc.name,
                            path,
                            isPickable: Boolean(doc.is_pickable ?? true),
                            isPutaway: Boolean(doc.is_putaway ?? true),
                            isStaging: Boolean(doc.is_staging ?? false),
                            isActive: Boolean(doc.is_active ?? true),
                        },
                    });
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
            onSubmit: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                const items = Array.isArray(doc.items) ? doc.items : [];
                if (doc.reserve_stock && items.length) {
                    await this.fillUomDetails(tenantId, items);
                    const postingTs = this.resolveDateFieldTs(doc.date);

                    for (const item of items) {
                        if (!item.warehouse) {
                            throw new Error(`Sales Order ${doc.name}: warehouse required on item ${item.item_code}`);
                        }
                        await this.stockService.reserveStock({
                            tenantId,
                            postingKey: `SO:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                            voucherType: 'Sales Order',
                            voucherNo: doc.name,
                            postingTs,
                            itemCode: item.item_code,
                            warehouseCode: item.warehouse,
                            locationCode: item.location,
                            batchNo: item.batch_no,
                            uomCode: item.uom,
                            conversionFactor: item.conversion_factor,
                            qty: item.qty,
                        });
                    }
                }
                await this.updateDocStatus('Sales Order', doc.name, 'To Deliver');
            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc.items || !Array.isArray(doc.items)) return;
                if (!doc.reserve_stock) return;

                await this.fillUomDetails(tenantId, doc.items);
                const postingTs = new Date();

                for (const item of doc.items) {
                    if (!item.warehouse) continue;
                    await this.stockService.unreserveStock({
                        tenantId,
                        postingKey: `CANCEL:Sales Order:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                        voucherType: 'Sales Order (Cancel)',
                        voucherNo: doc.name,
                        postingTs,
                        itemCode: item.item_code,
                        warehouseCode: item.warehouse,
                        locationCode: item.location,
                        batchNo: item.batch_no,
                        uomCode: item.uom,
                        conversionFactor: item.conversion_factor,
                        qty: item.qty,
                    });
                }

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
	            onSubmit: async (doc, user) => {
	                const tenantId = user?.tenantId;
	                if (!tenantId) throw new Error('Missing tenantId in user context');
	                // Post to GL when invoice is submitted (docstatus = 1)
	                await this.postInvoiceToGL(doc);
                    await this.applyInvoiceToSalesOrders(doc);
                    await this.updateInvoiceOutstandingStatus('Invoice', doc.name);
	            }
	         });
	    }

	    private registerPurchaseOrderHooks() {
	        this.hookService.register('Purchase Order', {
	            beforeSave: async (doc) => {
	                if (!doc.name) {
	                    doc.name = `PO-${Date.now().toString().slice(-6)}`;
	                }
	                await this.calculateTaxes(doc);
	                return doc;
	            },
	            onSubmit: async (doc, user) => {
	                const tenantId = user?.tenantId;
	                if (!tenantId) throw new Error('Missing tenantId in user context');
                    await this.updateDocStatus('Purchase Order', doc.name, 'To Receive');
	            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
            },
	        });
	    }

	    private registerPurchaseInvoiceHooks() {
	        this.hookService.register('Purchase Invoice', {
	            beforeSave: async (doc) => {
	                if (!doc.name) {
	                    doc.name = `PINV-${Date.now().toString().slice(-6)}`;
	                }
	                await this.calculateTaxes(doc);
	                return doc;
	            },
	            onSubmit: async (doc, user) => {
	                const tenantId = user?.tenantId;
	                if (!tenantId) throw new Error('Missing tenantId in user context');
	                await this.postPurchaseInvoiceToGL(doc);
                    await this.applyPurchaseInvoiceToPurchaseOrders(doc);
                    await this.updateInvoiceOutstandingStatus('Purchase Invoice', doc.name);
	            },
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

                await this.fillUomDetails(tenantId, doc.items);

                for (const item of doc.items) {
                    await this.stockService.receiveStock({
                        tenantId,
                        postingKey: `PR:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                        voucherType: 'Purchase Receipt',
	                        voucherNo: doc.name,
	                        postingTs,
	                        itemCode: item.item_code,
	                        warehouseCode: item.warehouse,
	                        locationCode: item.location,
	                        batchNo: item.batch_no,
	                        batchExpDate: this.parseDateOnly(item.expiry_date),
	                        serialNos: item.serial_nos,
	                        uomCode: item.uom,
	                        conversionFactor: item.conversion_factor,
	                        qty: item.qty,
                        incomingRate: item.rate ?? 0,
                    });
                }
                await this.postPurchaseReceiptToGL(doc);
                await this.applyPurchaseReceiptToPurchaseOrders(doc);
            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc?.name) return;
                await this.stockService.cancelPurchaseReceipt({
                    tenantId,
                    voucherNo: doc.name,
                    cancelTs: new Date(),
                });
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

                await this.fillUomDetails(tenantId, doc.items);

                const strategy =
                  doc.stock_consumption_strategy === 'FEFO'
                    ? StockConsumptionStrategy.FEFO
                    : doc.stock_consumption_strategy === 'FIFO'
                      ? StockConsumptionStrategy.FIFO
	                      : undefined;

                for (const item of doc.items) {
                    await this.stockService.issueStock({
                        tenantId,
                        postingKey: `DN:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                        voucherType: 'Delivery Note',
                        voucherNo: doc.name,
                        postingTs,
                        itemCode: item.item_code,
                        warehouseCode: item.warehouse,
                        locationCode: item.location,
                        batchNo: item.batch_no,
                        serialNos: item.serial_nos,
                        uomCode: item.uom,
                        conversionFactor: item.conversion_factor,
                        qty: item.qty,
                        strategy,
                        consumeReservation: true,
                    });
                }
                await this.postDeliveryNoteToCOGS(doc);
                await this.applyDeliveryNoteToSalesOrders(doc);
            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc?.name) return;
                await this.stockService.cancelDeliveryNote({
                    tenantId,
                    voucherNo: doc.name,
                    cancelTs: new Date(),
                });
            },
        });
    }

	    private registerStockTransferHooks() {
	        this.hookService.register('Stock Transfer', {
	            beforeSave: (doc) => {
	                if (!doc.name) {
	                    doc.name = `ST-${Date.now().toString().slice(-6)}`;
	                }
	                return doc;
	            },
            onSubmit: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc.items || !Array.isArray(doc.items)) return;

                const postingTs = this.resolvePostingTs(doc);
                await this.fillUomDetails(tenantId, doc.items);
                for (const item of doc.items) {
                    await this.stockService.transferStock({
                        tenantId,
                        postingKey: `ST:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                        voucherType: 'Stock Transfer',
	                        voucherNo: doc.name,
	                        postingTs,
	                        itemCode: item.item_code,
	                        uomCode: item.uom,
	                        conversionFactor: item.conversion_factor,
	                        qty: item.qty,
	                        batchNo: item.batch_no,
	                        serialNos: item.serial_nos,
	                        fromWarehouseCode: doc.from_warehouse,
	                        fromLocationCode: doc.from_location,
	                        toWarehouseCode: doc.to_warehouse,
                        toLocationCode: doc.to_location,
                    });
                }
            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc?.name) return;
                await this.stockService.cancelStockTransfer({
                    tenantId,
                    voucherNo: doc.name,
                    cancelTs: new Date(),
                });
            },
        });
    }

	    private registerStockReconciliationHooks() {
	        this.hookService.register('Stock Reconciliation', {
	            beforeSave: (doc) => {
	                if (!doc.name) {
	                    doc.name = `SR-${Date.now().toString().slice(-6)}`;
	                }
	                return doc;
	            },
            onSubmit: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc.items || !Array.isArray(doc.items)) return;

                const postingTs = this.resolvePostingTs(doc);
                await this.fillUomDetails(tenantId, doc.items);
                for (const item of doc.items) {
                    await this.stockService.reconcileStock({
                        tenantId,
                        postingKey: `SR:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                        voucherType: 'Stock Reconciliation',
	                        voucherNo: doc.name,
	                        postingTs,
	                        itemCode: item.item_code,
	                        warehouseCode: doc.warehouse,
	                        locationCode: doc.location,
	                        batchNo: item.batch_no,
	                        serialNos: item.serial_nos,
	                        uomCode: item.uom,
	                        conversionFactor: item.conversion_factor,
                        targetQty: item.qty,
                        increaseRate: item.rate ?? 0,
                    });
                }
            },
        });
    }

	    private registerStockReservationHooks() {
	        this.hookService.register('Stock Reservation', {
	            beforeSave: (doc) => {
	                if (!doc.name) {
	                    doc.name = `SRV-${Date.now().toString().slice(-6)}`;
	                }
	                return doc;
	            },
            onSubmit: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc.items || !Array.isArray(doc.items)) return;
                const postingTs = this.resolvePostingTs(doc);

                await this.fillUomDetails(tenantId, doc.items);

                for (const item of doc.items) {
                    await this.stockService.reserveStock({
                        tenantId,
                        postingKey: `SRV:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                        voucherType: 'Stock Reservation',
	                        voucherNo: doc.name,
	                        postingTs,
	                        itemCode: item.item_code,
	                        warehouseCode: doc.warehouse,
	                        locationCode: item.location,
	                        batchNo: item.batch_no,
	                        uomCode: item.uom,
                        conversionFactor: item.conversion_factor,
                        qty: item.qty,
                    });
                }
            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc.items || !Array.isArray(doc.items)) return;
                const postingTs = new Date();

                await this.fillUomDetails(tenantId, doc.items);

                for (const item of doc.items) {
                    await this.stockService.unreserveStock({
                        tenantId,
                        postingKey: `CANCEL:Stock Reservation:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                        voucherType: 'Stock Reservation (Cancel)',
	                        voucherNo: doc.name,
	                        postingTs,
	                        itemCode: item.item_code,
	                        warehouseCode: doc.warehouse,
	                        locationCode: item.location,
	                        batchNo: item.batch_no,
	                        uomCode: item.uom,
                        conversionFactor: item.conversion_factor,
                        qty: item.qty,
                    });
                }
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

    private resolveDateFieldTs(dateValue?: string): Date {
        if (!dateValue) return new Date();
        return new Date(`${dateValue}T00:00:00.000Z`);
    }

    private resolveUserId(user: any): string | null {
        return user?.id ?? user?.userId ?? null;
    }

    private parseDateOnly(value: any): Date | undefined {
        if (!value || typeof value !== 'string') return undefined;
        return new Date(`${value}T00:00:00.000Z`);
    }

    private toTableName(docType: string): string {
        const compact = (docType ?? '').replace(/\s+/g, '');
        return `tab${compact}`;
    }

    private async updateDocStatus(docType: string, docName: string, status: string) {
        if (!docName) return;
        const tableName = this.toTableName(docType);
        await this.prisma.$executeRawUnsafe(
            `UPDATE "${tableName}" SET status = $1 WHERE name = $2`,
            status,
            docName,
        );
    }

    private async incrementSalesOrderItemQty(
        salesOrder: string,
        itemCode: string,
        field: 'delivered_qty' | 'billed_qty',
        qty: number,
    ) {
        if (!salesOrder || !itemCode || !qty) return;
        const itemTable = this.toTableName('Sales Order Item');
        const safeField = field === 'delivered_qty' ? 'delivered_qty' : 'billed_qty';
        await this.prisma.$executeRawUnsafe(
            `UPDATE "${itemTable}" SET ${safeField} = COALESCE(${safeField}, 0) + $1
             WHERE parent = $2 AND parenttype = 'Sales Order' AND item_code = $3`,
            qty,
            salesOrder,
            itemCode,
        );
    }

    private async incrementPurchaseOrderItemQty(
        purchaseOrder: string,
        itemCode: string,
        field: 'received_qty' | 'billed_qty',
        qty: number,
    ) {
        if (!purchaseOrder || !itemCode || !qty) return;
        const itemTable = this.toTableName('Purchase Order Item');
        const safeField = field === 'received_qty' ? 'received_qty' : 'billed_qty';
        await this.prisma.$executeRawUnsafe(
            `UPDATE "${itemTable}" SET ${safeField} = COALESCE(${safeField}, 0) + $1
             WHERE parent = $2 AND parenttype = 'Purchase Order' AND item_code = $3`,
            qty,
            purchaseOrder,
            itemCode,
        );
    }

    private async updateSalesOrderStatus(salesOrder: string) {
        if (!salesOrder) return;
        const itemTable = this.toTableName('Sales Order Item');
        const rows = await this.prisma.$queryRawUnsafe(
            `SELECT qty, delivered_qty, billed_qty FROM "${itemTable}"
             WHERE parent = $1 AND parenttype = 'Sales Order'`,
            salesOrder,
        );
        const items = rows as Array<{ qty: any; delivered_qty: any; billed_qty: any }>;
        if (!items.length) return;

        let totalQty = 0;
        let deliveredQty = 0;
        let billedQty = 0;
        for (const row of items) {
            totalQty += Number(row.qty || 0);
            deliveredQty += Number(row.delivered_qty || 0);
            billedQty += Number(row.billed_qty || 0);
        }

        if (totalQty <= 0) return;
        const deliveredComplete = deliveredQty >= totalQty - 0.000001;
        const billedComplete = billedQty >= totalQty - 0.000001;

        let status = 'To Deliver';
        if (deliveredComplete && billedComplete) {
            status = 'Completed';
        } else if (deliveredComplete) {
            status = 'To Bill';
        }

        await this.updateDocStatus('Sales Order', salesOrder, status);
    }

    private async updatePurchaseOrderStatus(purchaseOrder: string) {
        if (!purchaseOrder) return;
        const itemTable = this.toTableName('Purchase Order Item');
        const rows = await this.prisma.$queryRawUnsafe(
            `SELECT qty, received_qty, billed_qty FROM "${itemTable}"
             WHERE parent = $1 AND parenttype = 'Purchase Order'`,
            purchaseOrder,
        );
        const items = rows as Array<{ qty: any; received_qty: any; billed_qty: any }>;
        if (!items.length) return;

        let totalQty = 0;
        let receivedQty = 0;
        let billedQty = 0;
        for (const row of items) {
            totalQty += Number(row.qty || 0);
            receivedQty += Number(row.received_qty || 0);
            billedQty += Number(row.billed_qty || 0);
        }

        if (totalQty <= 0) return;
        const receivedComplete = receivedQty >= totalQty - 0.000001;
        const billedComplete = billedQty >= totalQty - 0.000001;

        let status = 'To Receive';
        if (receivedComplete && billedComplete) {
            status = 'Completed';
        } else if (receivedComplete) {
            status = 'To Bill';
        }

        await this.updateDocStatus('Purchase Order', purchaseOrder, status);
    }

    private async applyDeliveryNoteToSalesOrders(doc: any) {
        const items = Array.isArray(doc.items) ? doc.items : [];
        const salesOrders = new Set<string>();
        for (const item of items) {
            const salesOrder = item.sales_order ?? doc.sales_order;
            if (!salesOrder) continue;
            const qty = Number(item.qty || 0);
            if (!qty) continue;
            await this.incrementSalesOrderItemQty(salesOrder, item.item_code, 'delivered_qty', qty);
            salesOrders.add(salesOrder);
        }
        for (const salesOrder of salesOrders) {
            await this.updateSalesOrderStatus(salesOrder);
        }
    }

    private async applyInvoiceToSalesOrders(doc: any) {
        const items = Array.isArray(doc.items) ? doc.items : [];
        const salesOrders = new Set<string>();
        for (const item of items) {
            const salesOrder = item.sales_order ?? doc.sales_order;
            if (!salesOrder) continue;
            const qty = Number(item.qty || 0);
            if (!qty) continue;
            await this.incrementSalesOrderItemQty(salesOrder, item.item_code, 'billed_qty', qty);
            salesOrders.add(salesOrder);
        }
        for (const salesOrder of salesOrders) {
            await this.updateSalesOrderStatus(salesOrder);
        }
    }

    private async applyPurchaseReceiptToPurchaseOrders(doc: any) {
        const items = Array.isArray(doc.items) ? doc.items : [];
        const purchaseOrders = new Set<string>();
        for (const item of items) {
            const purchaseOrder = item.purchase_order ?? doc.purchase_order;
            if (!purchaseOrder) continue;
            const qty = Number(item.qty || 0);
            if (!qty) continue;
            await this.incrementPurchaseOrderItemQty(purchaseOrder, item.item_code, 'received_qty', qty);
            purchaseOrders.add(purchaseOrder);
        }
        for (const purchaseOrder of purchaseOrders) {
            await this.updatePurchaseOrderStatus(purchaseOrder);
        }
    }

    private async applyPurchaseInvoiceToPurchaseOrders(doc: any) {
        const items = Array.isArray(doc.items) ? doc.items : [];
        const purchaseOrders = new Set<string>();
        for (const item of items) {
            const purchaseOrder = item.purchase_order ?? doc.purchase_order;
            if (!purchaseOrder) continue;
            const qty = Number(item.qty || 0);
            if (!qty) continue;
            await this.incrementPurchaseOrderItemQty(purchaseOrder, item.item_code, 'billed_qty', qty);
            purchaseOrders.add(purchaseOrder);
        }
        for (const purchaseOrder of purchaseOrders) {
            await this.updatePurchaseOrderStatus(purchaseOrder);
        }
    }

    private async applyPaymentEntryToReferences(doc: any, direction: -1 | 1) {
        const references = Array.isArray(doc.references) ? doc.references : [];
        for (const ref of references) {
            const refType = ref.reference_doctype;
            if (refType !== 'Invoice' && refType !== 'Purchase Invoice') continue;
            const refName = ref.reference_name;
            if (!refName) continue;
            const allocated = Number(ref.allocated_amount || 0);
            if (!allocated) continue;
            await this.updateInvoiceOutstandingStatus(refType, refName, allocated * direction);
        }
    }

    private resolveOutstandingStatus(outstanding: number, grandTotal: number, dueDate?: string) {
        if (outstanding <= 0) return 'Paid';
        const today = new Date();
        const due = dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null;
        if (due && due < today) return 'Overdue';
        if (outstanding < grandTotal) return 'Partly Paid';
        return 'Unpaid';
    }

    private async updateInvoiceOutstandingStatus(
        docType: 'Invoice' | 'Purchase Invoice',
        docName: string,
        delta = 0,
    ) {
        if (!docName) return;
        const tableName = this.toTableName(docType);
        const rows = await this.prisma.$queryRawUnsafe(
            `SELECT outstanding_amount, grand_total, due_date FROM "${tableName}" WHERE name = $1`,
            docName,
        );
        const doc = (rows as Array<{ outstanding_amount: any; grand_total: any; due_date: any }>)[0];
        if (!doc) return;

        const currentOutstanding = Number(doc.outstanding_amount || 0);
        const grandTotal = Number(doc.grand_total || 0);
        const nextOutstanding = Math.max(0, currentOutstanding + delta);
        const status = this.resolveOutstandingStatus(nextOutstanding, grandTotal, doc.due_date);

        await this.prisma.$executeRawUnsafe(
            `UPDATE "${tableName}" SET outstanding_amount = $1, status = $2 WHERE name = $3`,
            nextOutstanding,
            status,
            docName,
        );
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

    private registerPickListHooks() {
        this.hookService.register('Pick List', {
            beforeSave: (doc) => {
                if (!doc.name) {
                    doc.name = `PL-${Date.now().toString().slice(-6)}`;
                }
                return doc;
            },
            onSubmit: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc.items || !Array.isArray(doc.items)) return;

                const postingTs = this.resolvePostingTs(doc);
                await this.fillUomDetails(tenantId, doc.items);

                const warehouseCode = doc.warehouse;
                const toLocationCode = doc.to_location ?? 'STAGING';
                for (const item of doc.items) {
                    await this.stockService.transferStock({
                        tenantId,
                        postingKey: `PL:${doc.name}:${item.id ?? item.idx ?? item.item_code ?? 'row'}`,
                        voucherType: 'Pick List',
                        voucherNo: doc.name,
                        postingTs,
                        itemCode: item.item_code,
                        uomCode: item.uom,
                        conversionFactor: item.conversion_factor,
                        qty: item.qty,
                        batchNo: item.batch_no,
                        serialNos: item.serial_nos,
                        fromWarehouseCode: warehouseCode,
                        fromLocationCode: item.location ?? doc.from_location,
                        toWarehouseCode: warehouseCode,
                        toLocationCode: toLocationCode,
                    });
                }
            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                if (!doc?.name) return;
                await this.stockService.cancelStockTransfer({
                    tenantId,
                    voucherNo: doc.name,
                    cancelTs: new Date(),
                    voucherType: 'Pick List',
                });
            },
        });
    }

    private registerPackListHooks() {
        this.hookService.register('Pack List', {
            beforeSave: (doc) => {
                if (!doc.name) {
                    doc.name = `PK-${Date.now().toString().slice(-6)}`;
                }
                return doc;
            },
            onSubmit: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
            },
        });
    }

    private async fillUomDetails(tenantId: string, items: any[]) {
        if (!items || !Array.isArray(items)) return;
        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            for (const row of items) {
                if (!row?.item_code) continue;
                const item = await tx.item.findUnique({
                    where: { tenantId_code: { tenantId, code: row.item_code } },
                    select: { id: true, stockUomCode: true },
                });
                if (!item) continue;
                if (!row.uom) {
                    row.uom = item.stockUomCode ?? undefined;
                }
                if (row.uom && !row.conversion_factor) {
                    if (item.stockUomCode && row.uom === item.stockUomCode) {
                        row.conversion_factor = 1;
                    } else {
                        const itemUom = await tx.itemUom.findUnique({
                            where: {
                                tenantId_itemId_uomCode: {
                                    tenantId,
                                    itemId: item.id,
                                    uomCode: row.uom,
                                },
                            },
                        });
                        if (itemUom) {
                            row.conversion_factor = itemUom.conversionFactor;
                        }
                    }
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
            onSubmit: async (doc, user) => {
                await this.postPaymentEntryToGL(doc);
                await this.applyPaymentEntryToReferences(doc, -1);
            },
            onCancel: async (doc, user) => {
                await this.applyPaymentEntryToReferences(doc, 1);
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
        const tenantId = doc.tenant_id ?? doc.tenantId;
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
        const itemAccountCache = new Map<string, { incomeAccount?: string | null }>();
        for (const item of items) {
            let incomeAccount = 'Sales';
            if (item?.item_code && tenantId) {
                const cached = itemAccountCache.get(item.item_code);
                if (cached) {
                    incomeAccount = cached.incomeAccount ?? incomeAccount;
                } else {
                    const itemRow = await this.prisma.item.findUnique({
                        where: { tenantId_code: { tenantId, code: item.item_code } },
                        select: { incomeAccount: true },
                    });
                    itemAccountCache.set(item.item_code, { incomeAccount: itemRow?.incomeAccount });
                    incomeAccount = itemRow?.incomeAccount ?? incomeAccount;
                }
            }
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

    private async postPurchaseInvoiceToGL(doc: any) {
        const tenantId = doc.tenant_id ?? doc.tenantId;
        const voucherType = 'Purchase Invoice';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().split('T')[0];

        // Debit: Expenses (or Stock/Expense by item in future)
        const items = doc.items || [];
        const itemAccountCache = new Map<string, { expenseAccount?: string | null; stockAccount?: string | null; isStockItem?: boolean }>();
        for (const item of items) {
            let debitAccount = 'Expenses';
            if (item?.item_code && tenantId) {
                const cached = itemAccountCache.get(item.item_code);
                if (cached) {
                    if (cached.isStockItem) {
                        debitAccount = cached.stockAccount ?? 'Stock Asset';
                    } else {
                        debitAccount = cached.expenseAccount ?? debitAccount;
                    }
                } else {
                    const itemRow = await this.prisma.item.findUnique({
                        where: { tenantId_code: { tenantId, code: item.item_code } },
                        select: { expenseAccount: true, stockAccount: true, isStockItem: true },
                    });
                    itemAccountCache.set(item.item_code, {
                        expenseAccount: itemRow?.expenseAccount,
                        stockAccount: itemRow?.stockAccount,
                        isStockItem: itemRow?.isStockItem,
                    });
                    if (itemRow?.isStockItem) {
                        debitAccount = itemRow.stockAccount ?? 'Stock Asset';
                    } else {
                        debitAccount = itemRow?.expenseAccount ?? debitAccount;
                    }
                }
            }
            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                        voucher_type, voucher_no, against, docstatus)
                VALUES ($1, gen_random_uuid()::text, $2, $3, $4, 0, $5, $6, $7, 1)
            `, tenantId, postingDate, debitAccount, item.amount, voucherType, voucherNo, doc.supplier);
        }

        // Credit: Accounts Payable (credit_to)
        const creditTo = doc.credit_to || 'Creditors';
        await this.prisma.$executeRawUnsafe(`
            INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                    voucher_type, voucher_no, party_type, party, against, docstatus)
            VALUES ($1, gen_random_uuid()::text, $2, $3, 0, $4, $5, $6, 'Supplier', $7, 'Expenses', 1)
        `, tenantId, postingDate, creditTo, doc.grand_total, voucherType, voucherNo, doc.supplier);

        // Credit: Tax accounts
        const taxes = doc.taxes || [];
        for (const tax of taxes) {
            if (tax.tax_amount > 0) {
                await this.prisma.$executeRawUnsafe(`
                    INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                            voucher_type, voucher_no, against, docstatus)
                    VALUES ($1, gen_random_uuid()::text, $2, $3, 0, $4, $5, $6, $7, 1)
                `, tenantId, postingDate, tax.account_head, tax.tax_amount, voucherType, voucherNo, doc.supplier);
            }
        }
    }

	    private async postPurchaseReceiptToGL(doc: any) {
        const tenantId = doc.tenant_id ?? doc.tenantId;
        const voucherType = 'Purchase Receipt';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().split('T')[0];

        const items = doc.items || [];
        let totalAmount = 0;
        const itemAccountCache = new Map<string, { stockAccount?: string | null }>();

        // Debit: Stock Asset
        for (const item of items) {
            const amount = (item.qty || 0) * (item.rate || 0);
            totalAmount += amount;
            let stockAccount = 'Stock Asset';
            if (item?.item_code && tenantId) {
                const cached = itemAccountCache.get(item.item_code);
                if (cached) {
                    stockAccount = cached.stockAccount ?? stockAccount;
                } else {
                    const itemRow = await this.prisma.item.findUnique({
                        where: { tenantId_code: { tenantId, code: item.item_code } },
                        select: { stockAccount: true },
                    });
                    itemAccountCache.set(item.item_code, { stockAccount: itemRow?.stockAccount });
                    stockAccount = itemRow?.stockAccount ?? stockAccount;
                }
            }

            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                        voucher_type, voucher_no, against, docstatus)
                VALUES ($1, gen_random_uuid()::text, $2, $3, $4, 0, $5, $6, 'Creditors', 1)
            `, tenantId, postingDate, stockAccount, amount, voucherType, voucherNo);
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
        const tenantId = doc.tenant_id ?? doc.tenantId;
        const voucherType = 'Delivery Note';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().split('T')[0];

        const items = doc.items || [];
        const itemAccountCache = new Map<string, { stockAccount?: string | null; cogsAccount?: string | null }>();

        for (const item of items) {
            // Get FIFO valuation (already calculated in stock hooks)
            const valuationAmount = item.valuation_amount || 0;
            let stockAccount = 'Stock Asset';
            let cogsAccount = 'Cost of Goods Sold';
            if (item?.item_code && tenantId) {
                const cached = itemAccountCache.get(item.item_code);
                if (cached) {
                    stockAccount = cached.stockAccount ?? stockAccount;
                    cogsAccount = cached.cogsAccount ?? cogsAccount;
                } else {
                    const itemRow = await this.prisma.item.findUnique({
                        where: { tenantId_code: { tenantId, code: item.item_code } },
                        select: { stockAccount: true, cogsAccount: true },
                    });
                    itemAccountCache.set(item.item_code, {
                        stockAccount: itemRow?.stockAccount,
                        cogsAccount: itemRow?.cogsAccount,
                    });
                    stockAccount = itemRow?.stockAccount ?? stockAccount;
                    cogsAccount = itemRow?.cogsAccount ?? cogsAccount;
                }
            }

            // Debit: Cost of Goods Sold
            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                        voucher_type, voucher_no, against, docstatus)
                VALUES ($1, gen_random_uuid()::text, $2, $3, $4, 0, $5, $6, $7, 1)
            `, tenantId, postingDate, cogsAccount, valuationAmount, voucherType, voucherNo, stockAccount);

            // Credit: Stock Asset
            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "GL Entry" (tenant_id, name, posting_date, account, debit, credit,
                                        voucher_type, voucher_no, against, docstatus)
                VALUES ($1, gen_random_uuid()::text, $2, $3, 0, $4, $5, $6, $7, 1)
            `, tenantId, postingDate, stockAccount, valuationAmount, voucherType, voucherNo, cogsAccount);
	    }
}
}
