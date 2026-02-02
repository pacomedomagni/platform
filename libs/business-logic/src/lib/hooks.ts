import { Injectable, Logger } from '@nestjs/common';
import { DocHooks, HookService } from '@platform/meta';

@Injectable()
export class BusinessLogicService {
    private readonly logger = new Logger(BusinessLogicService.name);

    constructor(private readonly hookService: HookService) {
        this.registerHooks();
    }

    registerHooks() {
        this.registerSalesOrderHooks();
        this.registerInvoiceHooks();
    }

    private registerSalesOrderHooks() {
        this.hookService.register('Sales Order', {
            beforeSave: (doc, user) => {
                this.logger.log(`Processing Sales Order ${doc.name || 'New'}`);
                
                // Auto-Name
                if (!doc.name) {
                    doc.name = `SO-${Date.now().toString().slice(-6)}`;
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
            afterSave: (doc) => {
                this.logger.log(`Sales Order ${doc.name} saved.`);
            }
        });
    }

    private registerInvoiceHooks() {
         this.hookService.register('Invoice', {
            beforeSave: (doc, user) => {
                // Auto-Name
                if (!doc.name) {
                    doc.name = `INV-${Date.now().toString().slice(-6)}`;
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
                    doc.grand_total = total;
                }
                return doc;
            }
         });
    }
}
