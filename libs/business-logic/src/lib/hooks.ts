import { Injectable, Logger } from '@nestjs/common';
import { HookService } from '@platform/meta';
import { PrismaService } from '@platform/db';
import { Prisma, StockConsumptionStrategy } from '@prisma/client';
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
        this.registerAccountMasterHooks();
        this.registerCustomerMasterHooks();
        this.registerSupplierMasterHooks();
        this.registerAddressMasterHooks();
        this.registerContactMasterHooks();

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
        this.registerQuotationHooks();

        // Banking
        this.registerBankMasterHooks();
        this.registerBankAccountHooks();
        this.registerBankTransactionHooks();
        this.registerBankReconciliationHooks();

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

    private registerAccountMasterHooks() {
        this.hookService.register('Account', {
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
                    await tx.account.upsert({
                        where: { tenantId_code: { tenantId, code: doc.name } },
                        update: {
                            name: doc.name,
                            rootType: doc.root_type ?? null,
                            accountType: doc.account_type ?? null,
                            isGroup: Boolean(doc.is_group ?? false),
                            parentAccountCode: doc.parent_account ?? null,
                            currency: doc.account_currency ?? null,
                            isActive: !doc.frozen,
                        },
                        create: {
                            tenantId,
                            code: doc.name,
                            name: doc.name,
                            rootType: doc.root_type ?? null,
                            accountType: doc.account_type ?? null,
                            isGroup: Boolean(doc.is_group ?? false),
                            parentAccountCode: doc.parent_account ?? null,
                            currency: doc.account_currency ?? null,
                            isActive: !doc.frozen,
                        },
                    });
                });
            },
        });
    }

    private registerCustomerMasterHooks() {
        this.hookService.register('Customer', {
            beforeSave: async (doc, user) => {
                // Auto-Name based on customer_name if not provided
                if (!doc.name && doc.customer_name) {
                    doc.name = doc.customer_name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 100);
                }
                // Set full_name for display
                if (doc.customer_name) {
                    doc.full_name = doc.customer_name;
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
                    
                    // Build primary address string from address fields if present
                    let primaryAddress = '';
                    if (doc.address_line1) {
                        primaryAddress = [
                            doc.address_line1,
                            doc.address_line2,
                            doc.city,
                            doc.state,
                            doc.country,
                            doc.postal_code
                        ].filter(Boolean).join(', ');
                    }

                    await tx.customer.upsert({
                        where: { tenantId_code: { tenantId, code: doc.name } },
                        update: {
                            customerName: doc.customer_name ?? doc.name,
                            customerType: doc.customer_type ?? 'Company',
                            customerGroup: doc.customer_group ?? null,
                            territory: doc.territory ?? null,
                            taxId: doc.tax_id ?? null,
                            taxCategory: doc.tax_category ?? null,
                            defaultCurrency: doc.default_currency ?? null,
                            defaultPriceList: doc.default_price_list ?? null,
                            defaultPaymentTerms: doc.payment_terms ?? null,
                            creditLimit: doc.credit_limit ?? 0,
                            creditDays: doc.credit_days ?? 0,
                            receivableAccount: doc.receivable_account ?? null,
                            primaryAddress: primaryAddress || doc.primary_address || null,
                            primaryContact: doc.primary_contact ?? null,
                            isActive: Boolean(doc.is_active ?? true),
                            isFrozen: Boolean(doc.is_frozen ?? false),
                            website: doc.website ?? null,
                            notes: doc.notes ?? null,
                        },
                        create: {
                            tenantId,
                            code: doc.name,
                            customerName: doc.customer_name ?? doc.name,
                            customerType: doc.customer_type ?? 'Company',
                            customerGroup: doc.customer_group ?? null,
                            territory: doc.territory ?? null,
                            taxId: doc.tax_id ?? null,
                            taxCategory: doc.tax_category ?? null,
                            defaultCurrency: doc.default_currency ?? null,
                            defaultPriceList: doc.default_price_list ?? null,
                            defaultPaymentTerms: doc.payment_terms ?? null,
                            creditLimit: doc.credit_limit ?? 0,
                            creditDays: doc.credit_days ?? 0,
                            receivableAccount: doc.receivable_account ?? null,
                            primaryAddress: primaryAddress || doc.primary_address || null,
                            primaryContact: doc.primary_contact ?? null,
                            isActive: Boolean(doc.is_active ?? true),
                            isFrozen: Boolean(doc.is_frozen ?? false),
                            website: doc.website ?? null,
                            notes: doc.notes ?? null,
                        },
                    });

                    // Handle address child table if present
                    if (Array.isArray(doc.addresses)) {
                        // Delete existing addresses for this customer
                        await tx.address.deleteMany({
                            where: { tenantId, linkDoctype: 'Customer', linkName: doc.name },
                        });

                        // Create new addresses
                        for (const addr of doc.addresses) {
                            await tx.address.create({
                                data: {
                                    tenantId,
                                    linkDoctype: 'Customer',
                                    linkName: doc.name,
                                    addressType: addr.address_type ?? 'Billing',
                                    addressTitle: addr.address_title ?? null,
                                    addressLine1: addr.address_line1 ?? null,
                                    addressLine2: addr.address_line2 ?? null,
                                    city: addr.city ?? null,
                                    state: addr.state ?? null,
                                    country: addr.country ?? 'United States',
                                    postalCode: addr.postal_code ?? null,
                                    phone: addr.phone ?? null,
                                    fax: addr.fax ?? null,
                                    email: addr.email ?? null,
                                    isPrimaryAddress: Boolean(addr.is_primary_address ?? false),
                                    isShippingAddress: Boolean(addr.is_shipping_address ?? false),
                                    isActive: true,
                                },
                            });
                        }
                    }

                    // Handle contact links if present
                    if (Array.isArray(doc.contacts)) {
                        // Delete existing contact links
                        await tx.contactLink.deleteMany({
                            where: { tenantId, linkDoctype: 'Customer', linkName: doc.name },
                        });

                        // Create new contact links
                        for (const contactName of doc.contacts) {
                            const contact = await tx.contact.findUnique({
                                where: { tenantId_name: { tenantId, name: contactName.contact ?? contactName } },
                            });
                            if (contact) {
                                await tx.contactLink.create({
                                    data: {
                                        tenantId,
                                        contactId: contact.id,
                                        linkDoctype: 'Customer',
                                        linkName: doc.name,
                                    },
                                });
                            }
                        }
                    }
                });
            },
        });
    }

    private registerSupplierMasterHooks() {
        this.hookService.register('Supplier', {
            beforeSave: async (doc, user) => {
                // Auto-Name based on supplier_name if not provided
                if (!doc.name && doc.supplier_name) {
                    doc.name = doc.supplier_name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 100);
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

                    // Build primary address string from address fields if present
                    let primaryAddress = '';
                    if (doc.address_line1) {
                        primaryAddress = [
                            doc.address_line1,
                            doc.address_line2,
                            doc.city,
                            doc.state,
                            doc.country,
                            doc.postal_code
                        ].filter(Boolean).join(', ');
                    }

                    await tx.supplier.upsert({
                        where: { tenantId_code: { tenantId, code: doc.name } },
                        update: {
                            supplierName: doc.supplier_name ?? doc.name,
                            supplierType: doc.supplier_type ?? 'Company',
                            supplierGroup: doc.supplier_group ?? null,
                            country: doc.country ?? null,
                            taxId: doc.tax_id ?? null,
                            taxCategory: doc.tax_category ?? null,
                            taxWithholdingCategory: doc.tax_withholding_category ?? null,
                            defaultCurrency: doc.default_currency ?? null,
                            defaultPriceList: doc.default_price_list ?? null,
                            defaultPaymentTerms: doc.payment_terms ?? null,
                            paymentDays: doc.payment_days ?? 0,
                            payableAccount: doc.payable_account ?? null,
                            expenseAccount: doc.expense_account ?? null,
                            primaryAddress: primaryAddress || doc.primary_address || null,
                            primaryContact: doc.primary_contact ?? null,
                            isActive: Boolean(doc.is_active ?? true),
                            isFrozen: Boolean(doc.is_frozen ?? false),
                            website: doc.website ?? null,
                            notes: doc.notes ?? null,
                        },
                        create: {
                            tenantId,
                            code: doc.name,
                            supplierName: doc.supplier_name ?? doc.name,
                            supplierType: doc.supplier_type ?? 'Company',
                            supplierGroup: doc.supplier_group ?? null,
                            country: doc.country ?? null,
                            taxId: doc.tax_id ?? null,
                            taxCategory: doc.tax_category ?? null,
                            taxWithholdingCategory: doc.tax_withholding_category ?? null,
                            defaultCurrency: doc.default_currency ?? null,
                            defaultPriceList: doc.default_price_list ?? null,
                            defaultPaymentTerms: doc.payment_terms ?? null,
                            paymentDays: doc.payment_days ?? 0,
                            payableAccount: doc.payable_account ?? null,
                            expenseAccount: doc.expense_account ?? null,
                            primaryAddress: primaryAddress || doc.primary_address || null,
                            primaryContact: doc.primary_contact ?? null,
                            isActive: Boolean(doc.is_active ?? true),
                            isFrozen: Boolean(doc.is_frozen ?? false),
                            website: doc.website ?? null,
                            notes: doc.notes ?? null,
                        },
                    });

                    // Handle address child table if present
                    if (Array.isArray(doc.addresses)) {
                        // Delete existing addresses for this supplier
                        await tx.address.deleteMany({
                            where: { tenantId, linkDoctype: 'Supplier', linkName: doc.name },
                        });

                        // Create new addresses
                        for (const addr of doc.addresses) {
                            await tx.address.create({
                                data: {
                                    tenantId,
                                    linkDoctype: 'Supplier',
                                    linkName: doc.name,
                                    addressType: addr.address_type ?? 'Billing',
                                    addressTitle: addr.address_title ?? null,
                                    addressLine1: addr.address_line1 ?? null,
                                    addressLine2: addr.address_line2 ?? null,
                                    city: addr.city ?? null,
                                    state: addr.state ?? null,
                                    country: addr.country ?? 'United States',
                                    postalCode: addr.postal_code ?? null,
                                    phone: addr.phone ?? null,
                                    fax: addr.fax ?? null,
                                    email: addr.email ?? null,
                                    isPrimaryAddress: Boolean(addr.is_primary_address ?? false),
                                    isShippingAddress: Boolean(addr.is_shipping_address ?? false),
                                    isActive: true,
                                },
                            });
                        }
                    }

                    // Handle contact links if present
                    if (Array.isArray(doc.contacts)) {
                        // Delete existing contact links
                        await tx.contactLink.deleteMany({
                            where: { tenantId, linkDoctype: 'Supplier', linkName: doc.name },
                        });

                        // Create new contact links
                        for (const contactName of doc.contacts) {
                            const contact = await tx.contact.findUnique({
                                where: { tenantId_name: { tenantId, name: contactName.contact ?? contactName } },
                            });
                            if (contact) {
                                await tx.contactLink.create({
                                    data: {
                                        tenantId,
                                        contactId: contact.id,
                                        linkDoctype: 'Supplier',
                                        linkName: doc.name,
                                    },
                                });
                            }
                        }
                    }
                });
            },
        });
    }

    private registerAddressMasterHooks() {
        this.hookService.register('Address', {
            beforeSave: async (doc, user) => {
                // Auto-Name
                if (!doc.name) {
                    const parts = [
                        doc.address_title || doc.link_name,
                        doc.address_type || 'Address',
                    ];
                    doc.name = parts.filter(Boolean).join('-').replace(/[^a-zA-Z0-9-]/g, '').substring(0, 100);
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;
                if (!doc?.link_doctype || !doc?.link_name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

                    // Find existing address by unique combination
                    const existing = await tx.address.findFirst({
                        where: {
                            tenantId,
                            linkDoctype: doc.link_doctype,
                            linkName: doc.link_name,
                            addressType: doc.address_type ?? 'Billing',
                        },
                    });

                    const addressData = {
                        tenantId,
                        linkDoctype: doc.link_doctype,
                        linkName: doc.link_name,
                        addressType: doc.address_type ?? 'Billing',
                        addressTitle: doc.address_title ?? null,
                        addressLine1: doc.address_line1 ?? null,
                        addressLine2: doc.address_line2 ?? null,
                        city: doc.city ?? null,
                        state: doc.state ?? null,
                        country: doc.country ?? 'United States',
                        postalCode: doc.postal_code ?? null,
                        phone: doc.phone ?? null,
                        fax: doc.fax ?? null,
                        email: doc.email ?? null,
                        isPrimaryAddress: Boolean(doc.is_primary_address ?? false),
                        isShippingAddress: Boolean(doc.is_shipping_address ?? false),
                        isActive: Boolean(doc.is_active ?? true),
                    };

                    if (existing) {
                        await tx.address.update({
                            where: { id: existing.id },
                            data: addressData,
                        });
                    } else {
                        await tx.address.create({ data: addressData });
                    }

                    // If this is marked as primary, unmark others
                    if (doc.is_primary_address) {
                        await tx.address.updateMany({
                            where: {
                                tenantId,
                                linkDoctype: doc.link_doctype,
                                linkName: doc.link_name,
                                isPrimaryAddress: true,
                                NOT: { addressType: doc.address_type },
                            },
                            data: { isPrimaryAddress: false },
                        });
                    }
                });
            },
        });
    }

    private registerContactMasterHooks() {
        this.hookService.register('Contact', {
            beforeSave: async (doc, user) => {
                // Auto-Name and full_name
                const fullName = [doc.first_name, doc.last_name].filter(Boolean).join(' ');
                doc.full_name = fullName || doc.name;
                
                if (!doc.name) {
                    doc.name = fullName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 100) || `CONTACT-${Date.now()}`;
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

                    const contact = await tx.contact.upsert({
                        where: { tenantId_name: { tenantId, name: doc.name } },
                        update: {
                            firstName: doc.first_name ?? null,
                            lastName: doc.last_name ?? null,
                            fullName: doc.full_name ?? null,
                            salutation: doc.salutation ?? null,
                            designation: doc.designation ?? null,
                            email: doc.email ?? null,
                            phone: doc.phone ?? null,
                            mobile: doc.mobile ?? null,
                            isPrimaryContact: Boolean(doc.is_primary_contact ?? false),
                            isBillingContact: Boolean(doc.is_billing_contact ?? false),
                            isActive: Boolean(doc.is_active ?? true),
                        },
                        create: {
                            tenantId,
                            name: doc.name,
                            firstName: doc.first_name ?? null,
                            lastName: doc.last_name ?? null,
                            fullName: doc.full_name ?? null,
                            salutation: doc.salutation ?? null,
                            designation: doc.designation ?? null,
                            email: doc.email ?? null,
                            phone: doc.phone ?? null,
                            mobile: doc.mobile ?? null,
                            isPrimaryContact: Boolean(doc.is_primary_contact ?? false),
                            isBillingContact: Boolean(doc.is_billing_contact ?? false),
                            isActive: Boolean(doc.is_active ?? true),
                        },
                    });

                    // Handle links (child table linking contact to customers/suppliers)
                    if (Array.isArray(doc.links)) {
                        // Delete existing links
                        await tx.contactLink.deleteMany({
                            where: { tenantId, contactId: contact.id },
                        });

                        // Create new links
                        for (const link of doc.links) {
                            if (link.link_doctype && link.link_name) {
                                await tx.contactLink.create({
                                    data: {
                                        tenantId,
                                        contactId: contact.id,
                                        linkDoctype: link.link_doctype,
                                        linkName: link.link_name,
                                    },
                                });
                            }
                        }
                    }
                });
            },
        });
    }

    private registerQuotationHooks() {
        this.hookService.register('Quotation', {
            beforeSave: async (doc, user) => {
                // Auto-Name
                if (!doc.name) {
                    doc.name = `QTN-${Date.now().toString().slice(-6)}`;
                }

                // Set customer name from customer link
                if (doc.customer && !doc.customer_name) {
                    const tenantId = user?.tenantId;
                    if (tenantId) {
                        const customer = await this.prisma.customer.findUnique({
                            where: { tenantId_code: { tenantId, code: doc.customer } },
                            select: { customerName: true },
                        });
                        if (customer) {
                            doc.customer_name = customer.customerName;
                        }
                    }
                }

                // Calculate taxes and totals
                await this.calculateTaxes(doc);

                return doc;
            },
            onSubmit: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                
                // Set validity if not set
                if (!doc.valid_till && doc.quotation_date) {
                    const validityDays = doc.validity_days || 30;
                    const validTill = new Date(doc.quotation_date);
                    validTill.setDate(validTill.getDate() + validityDays);
                    doc.valid_till = validTill.toISOString().slice(0, 10);
                }

                await this.updateDocStatus('Quotation', doc.name, 'Submitted', tenantId);
            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                await this.updateDocStatus('Quotation', doc.name, 'Cancelled', tenantId);
            },
        });
    }

    // ==================== BANKING HOOKS ====================

    private registerBankMasterHooks() {
        this.hookService.register('Bank', {
            beforeSave: async (doc, user) => {
                if (!doc.name && doc.bank_name) {
                    doc.name = doc.bank_name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 100);
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
                    await tx.bank.upsert({
                        where: { tenantId_code: { tenantId, code: doc.name } },
                        update: {
                            bankName: doc.bank_name ?? doc.name,
                            website: doc.website ?? null,
                            swiftCode: doc.swift_code ?? null,
                            isActive: Boolean(doc.is_active ?? true),
                        },
                        create: {
                            tenantId,
                            code: doc.name,
                            bankName: doc.bank_name ?? doc.name,
                            website: doc.website ?? null,
                            swiftCode: doc.swift_code ?? null,
                            isActive: Boolean(doc.is_active ?? true),
                        },
                    });
                });
            },
        });
    }

    private registerBankAccountHooks() {
        this.hookService.register('Bank Account', {
            beforeSave: async (doc, user) => {
                if (!doc.name) {
                    const parts = [doc.bank, doc.account_type, doc.account_number?.slice(-4)];
                    doc.name = parts.filter(Boolean).join('-').substring(0, 100) || `BA-${Date.now()}`;
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
                    await tx.bankAccount.upsert({
                        where: { tenantId_name: { tenantId, name: doc.name } },
                        update: {
                            bankCode: doc.bank ?? null,
                            accountNumber: doc.account_number ?? null,
                            accountType: doc.account_type ?? 'Current',
                            iban: doc.iban ?? null,
                            branchCode: doc.branch_code ?? null,
                            glAccount: doc.account ?? null,
                            currency: doc.currency ?? 'USD',
                            integrationId: doc.integration_id ?? null,
                            isDefault: Boolean(doc.is_default ?? false),
                            isActive: Boolean(doc.is_active ?? true),
                        },
                        create: {
                            tenantId,
                            name: doc.name,
                            bankCode: doc.bank ?? null,
                            accountNumber: doc.account_number ?? null,
                            accountType: doc.account_type ?? 'Current',
                            iban: doc.iban ?? null,
                            branchCode: doc.branch_code ?? null,
                            glAccount: doc.account ?? null,
                            currency: doc.currency ?? 'USD',
                            integrationId: doc.integration_id ?? null,
                            isDefault: Boolean(doc.is_default ?? false),
                            isActive: Boolean(doc.is_active ?? true),
                        },
                    });

                    // Ensure the GL account exists
                    if (doc.account) {
                        await this.ensureAccount(tx, tenantId, doc.account);
                    }
                });
            },
        });
    }

    private registerBankTransactionHooks() {
        this.hookService.register('Bank Transaction', {
            beforeSave: async (doc, user) => {
                if (!doc.name) {
                    doc.name = `BT-${Date.now().toString().slice(-8)}`;
                }
                // Determine transaction type from amount if not set
                if (!doc.transaction_type && doc.amount !== undefined) {
                    doc.transaction_type = Number(doc.amount) >= 0 ? 'Credit' : 'Debit';
                }
                return doc;
            },
            afterSave: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) return;
                if (!doc?.name) return;

                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

                    await tx.bankTransaction.upsert({
                        where: { tenantId_name: { tenantId, name: doc.name } },
                        update: {
                            bankAccount: doc.bank_account,
                            transactionDate: new Date(`${doc.date || doc.transaction_date}T00:00:00.000Z`),
                            amount: Math.abs(doc.amount || 0),
                            currency: doc.currency ?? 'USD',
                            transactionType: doc.transaction_type ?? 'Credit',
                            description: doc.description ?? null,
                            referenceNumber: doc.reference_number ?? null,
                            partyType: doc.party_type ?? null,
                            party: doc.party ?? null,
                            status: doc.status ?? 'Unreconciled',
                            paymentEntry: doc.payment_entry ?? null,
                            invoice: doc.invoice ?? null,
                            importBatch: doc.import_batch ?? null,
                            externalId: doc.external_id ?? null,
                        },
                        create: {
                            tenantId,
                            name: doc.name,
                            bankAccount: doc.bank_account,
                            transactionDate: new Date(`${doc.date || doc.transaction_date}T00:00:00.000Z`),
                            amount: Math.abs(doc.amount || 0),
                            currency: doc.currency ?? 'USD',
                            transactionType: doc.transaction_type ?? 'Credit',
                            description: doc.description ?? null,
                            referenceNumber: doc.reference_number ?? null,
                            partyType: doc.party_type ?? null,
                            party: doc.party ?? null,
                            status: doc.status ?? 'Unreconciled',
                            paymentEntry: doc.payment_entry ?? null,
                            invoice: doc.invoice ?? null,
                            importBatch: doc.import_batch ?? null,
                            externalId: doc.external_id ?? null,
                        },
                    });

                    // Auto-match using rules if unreconciled
                    if (doc.status !== 'Reconciled' && doc.status !== 'Matched') {
                        await this.tryAutoMatchBankTransaction(tx, tenantId, doc);
                    }
                });
            },
        });
    }

    private async tryAutoMatchBankTransaction(tx: Prisma.TransactionClient, tenantId: string, doc: any) {
        // Get matching rules sorted by priority
        const rules = await tx.bankMatchingRule.findMany({
            where: {
                tenantId,
                isActive: true,
                OR: [
                    { bankAccount: null },
                    { bankAccount: doc.bank_account },
                ],
            },
            orderBy: { priority: 'desc' },
        });

        for (const rule of rules) {
            let matches = true;

            // Check description contains
            if (rule.descriptionContains && doc.description) {
                matches = matches && doc.description.toLowerCase().includes(rule.descriptionContains.toLowerCase());
            }

            // Check description regex
            if (rule.descriptionRegex && doc.description) {
                try {
                    const regex = new RegExp(rule.descriptionRegex, 'i');
                    matches = matches && regex.test(doc.description);
                } catch {
                    // Invalid regex, skip
                    continue;
                }
            }

            // Check amount range
            const amount = Math.abs(Number(doc.amount || 0));
            if (rule.amountMin !== null && amount < Number(rule.amountMin)) matches = false;
            if (rule.amountMax !== null && amount > Number(rule.amountMax)) matches = false;

            // Check transaction type
            if (rule.transactionType && rule.transactionType !== doc.transaction_type) matches = false;

            if (matches) {
                // Apply the rule - update the bank transaction with categorization
                await tx.bankTransaction.update({
                    where: { tenantId_name: { tenantId, name: doc.name } },
                    data: {
                        partyType: rule.partyType ?? doc.party_type,
                        party: rule.party ?? doc.party,
                        status: 'Matched',
                    },
                });
                this.logger.log(`Auto-matched bank transaction ${doc.name} using rule ${rule.name}`);
                break;
            }
        }
    }

    private registerBankReconciliationHooks() {
        this.hookService.register('Bank Reconciliation', {
            beforeSave: async (doc, user) => {
                if (!doc.name) {
                    doc.name = `RECON-${doc.bank_account}-${Date.now().toString().slice(-6)}`;
                }

                // Calculate difference
                const closing = Number(doc.closing_balance || 0);
                const statement = Number(doc.bank_statement_balance || 0);
                doc.difference = Math.abs(closing - statement);

                return doc;
            },
            onSubmit: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');

                // Mark all matched transactions as reconciled
                await this.prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

                    // Get the reconciliation record
                    const recon = await tx.bankReconciliation.findUnique({
                        where: { tenantId_name: { tenantId, name: doc.name } },
                        include: { details: true },
                    });

                    if (recon) {
                        // Update all matched bank transactions to Reconciled status
                        for (const detail of recon.details) {
                            if (detail.isMatched && detail.bankTransaction) {
                                await tx.bankTransaction.update({
                                    where: { tenantId_name: { tenantId, name: detail.bankTransaction } },
                                    data: { 
                                        status: 'Reconciled',
                                        reconciliationId: recon.id,
                                    },
                                });
                            }
                        }

                        // Update bank account balance
                        await tx.bankAccount.update({
                            where: { tenantId_name: { tenantId, name: doc.bank_account } },
                            data: {
                                bankBalance: doc.bank_statement_balance ?? 0,
                                lastSyncDate: new Date(doc.to_date),
                            },
                        });
                    }
                });

                await this.updateDocStatus('Bank Reconciliation', doc.name, 'Reconciled', tenantId);
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
                await this.updateDocStatus('Sales Order', doc.name, 'To Deliver', tenantId);
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
	                await this.postInvoiceToGL(doc, user);
                    await this.applyInvoiceToSalesOrders(doc, tenantId);
                    await this.updateInvoiceOutstandingStatus('Invoice', doc.name, tenantId);
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
                    await this.updateDocStatus('Purchase Order', doc.name, 'To Receive', tenantId);
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
	                await this.postPurchaseInvoiceToGL(doc, user);
                    await this.applyPurchaseInvoiceToPurchaseOrders(doc, tenantId);
                    await this.updateInvoiceOutstandingStatus('Purchase Invoice', doc.name, tenantId);
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
                await this.postPurchaseReceiptToGL(doc, user);
                await this.applyPurchaseReceiptToPurchaseOrders(doc, tenantId);
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
                await this.postDeliveryNoteToCOGS(doc, user);
                await this.applyDeliveryNoteToSalesOrders(doc, tenantId);
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

    private async updateDocStatus(docType: string, docName: string, status: string, tenantId: string) {
        if (!docName) return;
        const tableName = this.toTableName(docType);
        await this.withTenant(tenantId, async (tx) => {
            await tx.$executeRawUnsafe(
                `UPDATE "${tableName}" SET status = $1 WHERE name = $2`,
                status,
                docName,
            );
        });
    }

    private async incrementSalesOrderItemQty(
        salesOrder: string,
        itemCode: string,
        field: 'delivered_qty' | 'billed_qty',
        qty: number,
        tenantId: string,
    ) {
        if (!salesOrder || !itemCode || !qty) return;
        const itemTable = this.toTableName('Sales Order Item');
        const safeField = field === 'delivered_qty' ? 'delivered_qty' : 'billed_qty';
        await this.withTenant(tenantId, async (tx) => {
            await tx.$executeRawUnsafe(
                `UPDATE "${itemTable}" SET ${safeField} = COALESCE(${safeField}, 0) + $1
                 WHERE parent = $2 AND parenttype = 'Sales Order' AND item_code = $3`,
                qty,
                salesOrder,
                itemCode,
            );
        });
    }

    private async incrementPurchaseOrderItemQty(
        purchaseOrder: string,
        itemCode: string,
        field: 'received_qty' | 'billed_qty',
        qty: number,
        tenantId: string,
    ) {
        if (!purchaseOrder || !itemCode || !qty) return;
        const itemTable = this.toTableName('Purchase Order Item');
        const safeField = field === 'received_qty' ? 'received_qty' : 'billed_qty';
        await this.withTenant(tenantId, async (tx) => {
            await tx.$executeRawUnsafe(
                `UPDATE "${itemTable}" SET ${safeField} = COALESCE(${safeField}, 0) + $1
                 WHERE parent = $2 AND parenttype = 'Purchase Order' AND item_code = $3`,
                qty,
                purchaseOrder,
                itemCode,
            );
        });
    }

    private async updateSalesOrderStatus(salesOrder: string, tenantId: string) {
        if (!salesOrder) return;
        const itemTable = this.toTableName('Sales Order Item');
        const rows = await this.withTenant(tenantId, async (tx) => {
            return tx.$queryRawUnsafe(
                `SELECT qty, delivered_qty, billed_qty FROM "${itemTable}"
                 WHERE parent = $1 AND parenttype = 'Sales Order'`,
                salesOrder,
            );
        });
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

        await this.updateDocStatus('Sales Order', salesOrder, status, tenantId);
    }

    private async updatePurchaseOrderStatus(purchaseOrder: string, tenantId: string) {
        if (!purchaseOrder) return;
        const itemTable = this.toTableName('Purchase Order Item');
        const rows = await this.withTenant(tenantId, async (tx) => {
            return tx.$queryRawUnsafe(
                `SELECT qty, received_qty, billed_qty FROM "${itemTable}"
                 WHERE parent = $1 AND parenttype = 'Purchase Order'`,
                purchaseOrder,
            );
        });
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

        await this.updateDocStatus('Purchase Order', purchaseOrder, status, tenantId);
    }

    private async applyDeliveryNoteToSalesOrders(doc: any, tenantId: string) {
        const items = Array.isArray(doc.items) ? doc.items : [];
        const salesOrders = new Set<string>();
        for (const item of items) {
            const salesOrder = item.sales_order ?? doc.sales_order;
            if (!salesOrder) continue;
            const qty = Number(item.qty || 0);
            if (!qty) continue;
            await this.incrementSalesOrderItemQty(salesOrder, item.item_code, 'delivered_qty', qty, tenantId);
            salesOrders.add(salesOrder);
        }
        for (const salesOrder of salesOrders) {
            await this.updateSalesOrderStatus(salesOrder, tenantId);
        }
    }

    private async applyInvoiceToSalesOrders(doc: any, tenantId: string) {
        const items = Array.isArray(doc.items) ? doc.items : [];
        const salesOrders = new Set<string>();
        for (const item of items) {
            const salesOrder = item.sales_order ?? doc.sales_order;
            if (!salesOrder) continue;
            const qty = Number(item.qty || 0);
            if (!qty) continue;
            await this.incrementSalesOrderItemQty(salesOrder, item.item_code, 'billed_qty', qty, tenantId);
            salesOrders.add(salesOrder);
        }
        for (const salesOrder of salesOrders) {
            await this.updateSalesOrderStatus(salesOrder, tenantId);
        }
    }

    private async applyPurchaseReceiptToPurchaseOrders(doc: any, tenantId: string) {
        const items = Array.isArray(doc.items) ? doc.items : [];
        const purchaseOrders = new Set<string>();
        for (const item of items) {
            const purchaseOrder = item.purchase_order ?? doc.purchase_order;
            if (!purchaseOrder) continue;
            const qty = Number(item.qty || 0);
            if (!qty) continue;
            await this.incrementPurchaseOrderItemQty(purchaseOrder, item.item_code, 'received_qty', qty, tenantId);
            purchaseOrders.add(purchaseOrder);
        }
        for (const purchaseOrder of purchaseOrders) {
            await this.updatePurchaseOrderStatus(purchaseOrder, tenantId);
        }
    }

    private async applyPurchaseInvoiceToPurchaseOrders(doc: any, tenantId: string) {
        const items = Array.isArray(doc.items) ? doc.items : [];
        const purchaseOrders = new Set<string>();
        for (const item of items) {
            const purchaseOrder = item.purchase_order ?? doc.purchase_order;
            if (!purchaseOrder) continue;
            const qty = Number(item.qty || 0);
            if (!qty) continue;
            await this.incrementPurchaseOrderItemQty(purchaseOrder, item.item_code, 'billed_qty', qty, tenantId);
            purchaseOrders.add(purchaseOrder);
        }
        for (const purchaseOrder of purchaseOrders) {
            await this.updatePurchaseOrderStatus(purchaseOrder, tenantId);
        }
    }

    private async applyPaymentEntryToReferences(doc: any, direction: -1 | 1, tenantId: string) {
        const references = Array.isArray(doc.references) ? doc.references : [];
        for (const ref of references) {
            const refType = ref.reference_doctype;
            if (refType !== 'Invoice' && refType !== 'Purchase Invoice') continue;
            const refName = ref.reference_name;
            if (!refName) continue;
            const allocated = Number(ref.allocated_amount || 0);
            if (!allocated) continue;
            await this.updateInvoiceOutstandingStatus(refType, refName, tenantId, allocated * direction);
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
        tenantId: string,
        delta = 0,
    ) {
        if (!docName) return;
        const tableName = this.toTableName(docType);
        const rows = await this.withTenant(tenantId, async (tx) => {
            return tx.$queryRawUnsafe(
                `SELECT outstanding_amount, grand_total, due_date FROM "${tableName}" WHERE name = $1`,
                docName,
            );
        });
        const doc = (rows as Array<{ outstanding_amount: any; grand_total: any; due_date: any }>)[0];
        if (!doc) return;

        const currentOutstanding = Number(doc.outstanding_amount || 0);
        const grandTotal = Number(doc.grand_total || 0);
        const nextOutstanding = Math.max(0, currentOutstanding + delta);
        const status = this.resolveOutstandingStatus(nextOutstanding, grandTotal, doc.due_date);

        await this.withTenant(tenantId, async (tx) => {
            await tx.$executeRawUnsafe(
                `UPDATE "${tableName}" SET outstanding_amount = $1, status = $2 WHERE name = $3`,
                nextOutstanding,
                status,
                docName,
            );
        });
    }

    private async withTenant<T>(
        tenantId: string,
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            return fn(tx);
        });
    }

    private resolveAccountDefaults(code: string) {
        const normalized = (code || '').toLowerCase();
        if (['accounts receivable', 'receivables', 'debtors'].includes(normalized)) {
            return { rootType: 'Asset', accountType: 'Receivable' };
        }
        if (['accounts payable', 'creditors', 'payables'].includes(normalized)) {
            return { rootType: 'Liability', accountType: 'Payable' };
        }
        if (['stock asset', 'inventory'].includes(normalized)) {
            return { rootType: 'Asset', accountType: 'Stock' };
        }
        if (['sales', 'revenue'].includes(normalized)) {
            return { rootType: 'Income', accountType: 'Income Account' };
        }
        if (['cost of goods sold', 'cogs'].includes(normalized)) {
            return { rootType: 'Expense', accountType: 'Cost of Goods Sold' };
        }
        if (['expenses'].includes(normalized)) {
            return { rootType: 'Expense', accountType: 'Expense Account' };
        }
        return null;
    }

    private async ensureAccount(
        tx: Prisma.TransactionClient,
        tenantId: string,
        code: string,
    ) {
        if (!code) {
            throw new Error('Account code is required for GL posting');
        }
        const existing = await tx.account.findUnique({
            where: { tenantId_code: { tenantId, code } },
        });
        if (existing) return existing;

        const defaults = this.resolveAccountDefaults(code);
        if (!defaults) {
            throw new Error(`Account not found: ${code}`);
        }

        return tx.account.create({
            data: {
                tenantId,
                code,
                name: code,
                rootType: defaults.rootType,
                accountType: defaults.accountType,
                isGroup: false,
                isActive: true,
            },
        });
    }

    private async createGlEntries(
        tenantId: string,
        postingDate: string,
        postingTs: Date,
        entries: Array<{ accountCode: string; debit: number; credit: number; remarks?: string }>,
        voucherType: string,
        voucherNo: string,
    ) {
        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            const tenant = await tx.tenant.findUnique({
                where: { id: tenantId },
                select: { baseCurrency: true },
            });
            const currency = tenant?.baseCurrency ?? 'USD';
            const postingDateValue = new Date(`${postingDate}T00:00:00.000Z`);

            for (const entry of entries) {
                const debit = new Prisma.Decimal(entry.debit || 0);
                const credit = new Prisma.Decimal(entry.credit || 0);
                if (debit.eq(0) && credit.eq(0)) continue;

                const account = await this.ensureAccount(tx, tenantId, entry.accountCode);
                await tx.glEntry.create({
                    data: {
                        tenantId,
                        postingDate: postingDateValue,
                        postingTs,
                        accountId: account.id,
                        currency,
                        exchangeRate: new Prisma.Decimal(1),
                        debitBc: debit,
                        creditBc: credit,
                        debitFc: debit,
                        creditFc: credit,
                        voucherType,
                        voucherNo,
                        remarks: entry.remarks ?? null,
                    },
                });
            }
        });
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
                    await this.postJournalEntryToGL(doc, user);
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
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                await this.postPaymentEntryToGL(doc, user);
                await this.applyPaymentEntryToReferences(doc, -1, tenantId);
            },
            onCancel: async (doc, user) => {
                const tenantId = user?.tenantId;
                if (!tenantId) throw new Error('Missing tenantId in user context');
                await this.applyPaymentEntryToReferences(doc, 1, tenantId);
            },
        });
    }

    /**
     * Post Journal Entry to GL
     */
    private async postJournalEntryToGL(doc: any, user: any) {
        const tenantId = user?.tenantId ?? doc.tenant_id ?? doc.tenantId;
        if (!tenantId) throw new Error('Missing tenantId for GL posting');
        const postingDate = doc.posting_date || new Date().toISOString().slice(0, 10);
        const postingTs = this.resolveDateFieldTs(postingDate);

        const entries = (doc.accounts || []).map((account: any) => ({
            accountCode: account.account,
            debit: Number(account.debit || 0),
            credit: Number(account.credit || 0),
            remarks: doc.user_remark || `Journal Entry: ${doc.name}`,
        }));

        await this.createGlEntries(tenantId, postingDate, postingTs, entries, 'Journal Entry', doc.name);
    }

    /**
     * Post Payment Entry to GL
     */
    private async postPaymentEntryToGL(doc: any, user: any) {
        const tenantId = user?.tenantId ?? doc.tenant_id ?? doc.tenantId;
        if (!tenantId) throw new Error('Missing tenantId for GL posting');
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

        const postingDate = doc.posting_date || new Date().toISOString().slice(0, 10);
        const postingTs = this.resolveDateFieldTs(postingDate);
        const entries = glEntries.map((entry) => ({
            accountCode: entry.account,
            debit: Number(entry.debit || 0),
            credit: Number(entry.credit || 0),
            remarks: `Payment ${doc.payment_type} - ${doc.party}`,
        }));

        await this.createGlEntries(tenantId, postingDate, postingTs, entries, 'Payment Entry', doc.name);
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

    private async postInvoiceToGL(doc: any, user: any) {
        const tenantId = user?.tenantId ?? doc.tenant_id ?? doc.tenantId;
        if (!tenantId) throw new Error('Missing tenantId for GL posting');
        const voucherType = 'Invoice';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().slice(0, 10);
        const postingTs = this.resolveDateFieldTs(postingDate);

        const items = doc.items || [];
        const itemAccountCache = new Map<string, { incomeAccount?: string | null }>();

        const entries: Array<{ accountCode: string; debit: number; credit: number; remarks?: string }> = [];
        const debitAccount = doc.debit_to || 'Accounts Receivable';
        entries.push({
            accountCode: debitAccount,
            debit: Number(doc.grand_total || 0),
            credit: 0,
            remarks: `Invoice ${voucherNo}`,
        });

        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

            for (const item of items) {
                let incomeAccount = 'Sales';
                if (item?.item_code) {
                    const cached = itemAccountCache.get(item.item_code);
                    if (cached) {
                        incomeAccount = cached.incomeAccount ?? incomeAccount;
                    } else {
                        const itemRow = await tx.item.findUnique({
                            where: { tenantId_code: { tenantId, code: item.item_code } },
                            select: { incomeAccount: true },
                        });
                        itemAccountCache.set(item.item_code, { incomeAccount: itemRow?.incomeAccount });
                        incomeAccount = itemRow?.incomeAccount ?? incomeAccount;
                    }
                }
                entries.push({
                    accountCode: incomeAccount,
                    debit: 0,
                    credit: Number(item.amount || 0),
                    remarks: `Invoice ${voucherNo}`,
                });
            }

            const taxes = doc.taxes || [];
            for (const tax of taxes) {
                const taxAmount = Number(tax.tax_amount || 0);
                if (taxAmount > 0) {
                    entries.push({
                        accountCode: tax.account_head,
                        debit: 0,
                        credit: taxAmount,
                        remarks: `Invoice ${voucherNo}`,
                    });
                }
            }
        });

        await this.createGlEntries(tenantId, postingDate, postingTs, entries, voucherType, voucherNo);
    }

    private async postPurchaseInvoiceToGL(doc: any, user: any) {
        const tenantId = user?.tenantId ?? doc.tenant_id ?? doc.tenantId;
        if (!tenantId) throw new Error('Missing tenantId for GL posting');
        const voucherType = 'Purchase Invoice';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().slice(0, 10);
        const postingTs = this.resolveDateFieldTs(postingDate);

        const items = doc.items || [];
        const itemAccountCache = new Map<string, { expenseAccount?: string | null; stockAccount?: string | null; isStockItem?: boolean }>();
        const entries: Array<{ accountCode: string; debit: number; credit: number; remarks?: string }> = [];

        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            for (const item of items) {
                let debitAccount = 'Expenses';
                if (item?.item_code) {
                    const cached = itemAccountCache.get(item.item_code);
                    if (cached) {
                        if (cached.isStockItem) {
                            debitAccount = cached.stockAccount ?? 'Stock Asset';
                        } else {
                            debitAccount = cached.expenseAccount ?? debitAccount;
                        }
                    } else {
                        const itemRow = await tx.item.findUnique({
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
                entries.push({
                    accountCode: debitAccount,
                    debit: Number(item.amount || 0),
                    credit: 0,
                    remarks: `Purchase Invoice ${voucherNo}`,
                });
            }
        });

        const creditTo = doc.credit_to || 'Accounts Payable';
        entries.push({
            accountCode: creditTo,
            debit: 0,
            credit: Number(doc.grand_total || 0),
            remarks: `Purchase Invoice ${voucherNo}`,
        });

        const taxes = doc.taxes || [];
        for (const tax of taxes) {
            const taxAmount = Number(tax.tax_amount || 0);
            if (taxAmount > 0) {
                entries.push({
                    accountCode: tax.account_head,
                    debit: 0,
                    credit: taxAmount,
                    remarks: `Purchase Invoice ${voucherNo}`,
                });
            }
        }

        await this.createGlEntries(tenantId, postingDate, postingTs, entries, voucherType, voucherNo);
    }

    private async postPurchaseReceiptToGL(doc: any, user: any) {
        const tenantId = user?.tenantId ?? doc.tenant_id ?? doc.tenantId;
        if (!tenantId) throw new Error('Missing tenantId for GL posting');
        const voucherType = 'Purchase Receipt';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().slice(0, 10);
        const postingTs = this.resolveDateFieldTs(postingDate);

        const items = doc.items || [];
        let totalAmount = 0;
        const itemAccountCache = new Map<string, { stockAccount?: string | null }>();
        const entries: Array<{ accountCode: string; debit: number; credit: number; remarks?: string }> = [];

        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            for (const item of items) {
                const amount = Number(item.qty || 0) * Number(item.rate || 0);
                totalAmount += amount;
                let stockAccount = 'Stock Asset';
                if (item?.item_code) {
                    const cached = itemAccountCache.get(item.item_code);
                    if (cached) {
                        stockAccount = cached.stockAccount ?? stockAccount;
                    } else {
                        const itemRow = await tx.item.findUnique({
                            where: { tenantId_code: { tenantId, code: item.item_code } },
                            select: { stockAccount: true },
                        });
                        itemAccountCache.set(item.item_code, { stockAccount: itemRow?.stockAccount });
                        stockAccount = itemRow?.stockAccount ?? stockAccount;
                    }
                }
                entries.push({
                    accountCode: stockAccount,
                    debit: amount,
                    credit: 0,
                    remarks: `Purchase Receipt ${voucherNo}`,
                });
            }
        });

        entries.push({
            accountCode: 'Creditors',
            debit: 0,
            credit: totalAmount,
            remarks: `Purchase Receipt ${voucherNo}`,
        });

        await this.createGlEntries(tenantId, postingDate, postingTs, entries, voucherType, voucherNo);
    }

    private async postDeliveryNoteToCOGS(doc: any, user: any) {
        const tenantId = user?.tenantId ?? doc.tenant_id ?? doc.tenantId;
        if (!tenantId) throw new Error('Missing tenantId for GL posting');
        const voucherType = 'Delivery Note';
        const voucherNo = doc.name;
        const postingDate = doc.posting_date || new Date().toISOString().slice(0, 10);
        const postingTs = this.resolveDateFieldTs(postingDate);

        const items = doc.items || [];
        const itemAccountCache = new Map<string, { stockAccount?: string | null; cogsAccount?: string | null }>();
        const entries: Array<{ accountCode: string; debit: number; credit: number; remarks?: string }> = [];

        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            for (const item of items) {
                const valuationAmount = Number(item.valuation_amount || item.amount || 0);
                if (!valuationAmount) continue;
                let stockAccount = 'Stock Asset';
                let cogsAccount = 'Cost of Goods Sold';
                if (item?.item_code) {
                    const cached = itemAccountCache.get(item.item_code);
                    if (cached) {
                        stockAccount = cached.stockAccount ?? stockAccount;
                        cogsAccount = cached.cogsAccount ?? cogsAccount;
                    } else {
                        const itemRow = await tx.item.findUnique({
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

                entries.push({
                    accountCode: cogsAccount,
                    debit: valuationAmount,
                    credit: 0,
                    remarks: `Delivery Note ${voucherNo}`,
                });
                entries.push({
                    accountCode: stockAccount,
                    debit: 0,
                    credit: valuationAmount,
                    remarks: `Delivery Note ${voucherNo}`,
                });
            }
        });

        if (entries.length) {
            await this.createGlEntries(tenantId, postingDate, postingTs, entries, voucherType, voucherNo);
        }
    }
}
