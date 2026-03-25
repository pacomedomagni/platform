import { Injectable, Logger, BadRequestException, NotImplementedException } from '@nestjs/common';
import { PrismaService, Prisma } from '@platform/db';
import { Response } from 'express';
import { BackgroundJobService } from './background-job.service';
import { StockMovementService } from '../inventory-management/stock-movement.service';
import { MovementType } from '../inventory-management/inventory-management.dto';
import { AuditLogService } from './audit-log.service';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

type ImportEntityType = 'products' | 'customers' | 'inventory';
type ExportEntityType = 'products' | 'customers' | 'inventory' | 'orders' | 'transactions';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

@Injectable()
export class ImportExportService {
  private readonly logger = new Logger(ImportExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: BackgroundJobService,
    private readonly stockMovementService: StockMovementService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ==========================================
  // Import Functions
  // ==========================================

  /**
   * Import data from CSV
   */
  // M-IE-4: Maximum import content size (10MB)
  private static readonly MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;

  private validateImportSize(content: string): void {
    const sizeBytes = Buffer.byteLength(content, 'utf-8');
    if (sizeBytes > ImportExportService.MAX_IMPORT_SIZE_BYTES) {
      throw new BadRequestException(
        `Import content exceeds maximum size of 10MB (received ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB)`,
      );
    }
  }

  async importCsv(
    ctx: TenantContext,
    entityType: ImportEntityType,
    csvContent: string,
    options: {
      skipDuplicates?: boolean;
      updateExisting?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<ImportResult> {
    this.validateImportSize(csvContent);
    const rows = this.parseCsv(csvContent);

    if (rows.length === 0) {
      throw new BadRequestException('No data found in CSV');
    }

    switch (entityType) {
      case 'products':
        return this.importProducts(ctx, rows, options);
      case 'customers':
        return this.importCustomers(ctx, rows, options);
      case 'inventory':
        return this.importInventory(ctx, rows, options);
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Import data from JSON
   */
  async importJson(
    ctx: TenantContext,
    entityType: ImportEntityType,
    jsonContent: string,
    options: {
      skipDuplicates?: boolean;
      updateExisting?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<ImportResult> {
    this.validateImportSize(jsonContent);
    let data: unknown;
    try {
      data = JSON.parse(jsonContent);
    } catch {
      throw new BadRequestException('Invalid JSON content');
    }
    const rows = Array.isArray(data) ? data : [data];

    if (rows.length === 0) {
      throw new BadRequestException('No data found in JSON');
    }

    switch (entityType) {
      case 'products':
        return this.importProducts(ctx, rows, options);
      case 'customers':
        return this.importCustomers(ctx, rows, options);
      case 'inventory':
        return this.importInventory(ctx, rows, options);
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Schedule an async import job
   */
  async scheduleImport(
    ctx: TenantContext,
    entityType: ImportEntityType,
    format: 'csv' | 'json',
    content: string,
    options: {
      skipDuplicates?: boolean;
      updateExisting?: boolean;
    } = {}
  ) {
    this.validateImportSize(content);

    // M-IE-5: For large imports (>1MB), store content in a temporary file
    // instead of embedding it in the job payload to avoid bloating the jobs table.
    const sizeBytes = Buffer.byteLength(content, 'utf-8');
    const LARGE_IMPORT_THRESHOLD = 1 * 1024 * 1024; // 1MB

    if (sizeBytes > LARGE_IMPORT_THRESHOLD) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      const tempDir = path.join(os.tmpdir(), 'platform-imports');
      await fs.mkdir(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, `import-${Date.now()}-${Math.random().toString(36).slice(2)}.${format}`);
      await fs.writeFile(tempFile, content, 'utf-8');

      return this.jobService.createJob(ctx, {
        type: `import.${entityType}`,
        payload: {
          format,
          tempFilePath: tempFile,
          options,
          userId: ctx.userId,
        },
        priority: 5,
      });
    }

    return this.jobService.createJob(ctx, {
      type: `import.${entityType}`,
      payload: {
        format,
        content,
        options,
        userId: ctx.userId,
      },
      priority: 5,
    });
  }

  private async importProducts(
    ctx: TenantContext,
    rows: Record<string, unknown>[],
    options: { skipDuplicates?: boolean; updateExisting?: boolean; dryRun?: boolean }
  ): Promise<ImportResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const result: ImportResult = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Account for header row

        try {
          const code = String(row['code'] || row['sku'] || '').trim();
          if (!code) {
            result.errors.push({ row: rowNum, error: 'Missing product code' });
            continue;
          }

          const existing = await tx.item.findFirst({
            where: { tenantId: ctx.tenantId, code },
            include: { productListing: true },
          });

          if (existing) {
            if (options.updateExisting && !options.dryRun) {
              // Update Item
              await tx.item.update({
                where: { id: existing.id },
                data: {
                  name: String(row['name'] || existing.name),
                },
              });

              // Update ProductListing if it exists and price data provided
              if (existing.productListing && (row['price'] || row['cost'])) {
                await tx.productListing.update({
                  where: { id: existing.productListing.id },
                  data: {
                    price: row['price'] ? parseFloat(String(row['price'])) : undefined,
                    costPrice: row['cost'] ? parseFloat(String(row['cost'])) : undefined,
                  },
                });
              }
              result.updated++;
            } else if (options.skipDuplicates) {
              result.skipped++;
            } else {
              result.errors.push({ row: rowNum, error: `Duplicate code: ${code}` });
            }
            continue;
          }

          if (!options.dryRun) {
            // Create Item only (ProductListing should be created via storefront API)
            await tx.item.create({
              data: {
                tenantId: ctx.tenantId,
                code,
                name: String(row['name'] || code),
                isActive: true,
              },
            });
          }
          result.created++;
        } catch (error) {
          result.errors.push({
            row: rowNum,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return result;
    }, { timeout: 60000 });

    await this.auditLogService.log(ctx, {
      action: 'IMPORT_PRODUCTS',
      docType: 'Product',
      docName: 'bulk-import',
      meta: { total: result.total, created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.length },
    });

    return result;
  }

  private async importCustomers(
    ctx: TenantContext,
    rows: Record<string, unknown>[],
    options: { skipDuplicates?: boolean; updateExisting?: boolean; dryRun?: boolean }
  ): Promise<ImportResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const result: ImportResult = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
          const email = String(row['email'] || '').trim().toLowerCase();
          if (!email) {
            result.errors.push({ row: rowNum, error: 'Missing email' });
            continue;
          }

          const existing = await tx.storeCustomer.findFirst({
            where: { tenantId: ctx.tenantId, email },
          });

          if (existing) {
            if (options.updateExisting && !options.dryRun) {
              await tx.storeCustomer.update({
                where: { id: existing.id },
                data: {
                  firstName: row['firstName'] ? String(row['firstName']) : existing.firstName,
                  lastName: row['lastName'] ? String(row['lastName']) : existing.lastName,
                  phone: row['phone'] ? String(row['phone']) : existing.phone,
                },
              });
              result.updated++;
            } else if (options.skipDuplicates) {
              result.skipped++;
            } else {
              result.errors.push({ row: rowNum, error: `Duplicate email: ${email}` });
            }
            continue;
          }

          if (!options.dryRun) {
            await tx.storeCustomer.create({
              data: {
                tenantId: ctx.tenantId,
                email,
                firstName: row['firstName'] ? String(row['firstName']) : null,
                lastName: row['lastName'] ? String(row['lastName']) : null,
                phone: row['phone'] ? String(row['phone']) : null,
                passwordHash: '', // No password for imported customers
              },
            });
          }
          result.created++;
        } catch (error) {
          result.errors.push({
            row: rowNum,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return result;
    }, { timeout: 60000 });

    await this.auditLogService.log(ctx, {
      action: 'IMPORT_CUSTOMERS',
      docType: 'Customer',
      docName: 'bulk-import',
      meta: { total: result.total, created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.length },
    });

    return result;
  }

  private async importInventory(
    ctx: TenantContext,
    rows: Record<string, unknown>[],
    options: { skipDuplicates?: boolean; updateExisting?: boolean; dryRun?: boolean }
  ): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

    // M-IE-6: Process each row individually without wrapping stockMovementService.createMovement
    // in a $transaction. StockMovementService manages its own transactions internally, and
    // nesting it inside another transaction can cause deadlocks and unexpected behavior.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const code = String(row['code'] || row['sku'] || '').trim();
        if (!code) {
          result.errors.push({ row: rowNum, error: 'Missing product code' });
          continue;
        }

        const item = await this.prisma.item.findFirst({
          where: { tenantId: ctx.tenantId, code },
        });

        if (!item) {
          result.errors.push({ row: rowNum, error: `Product not found: ${code}` });
          continue;
        }

        const quantity = parseFloat(String(row['quantity'] || row['qty'] || 0));
        const warehouseCode = String(row['warehouse'] || 'MAIN').trim();

        if (!options.dryRun) {
          // Find or create the warehouse
          let warehouse = await this.prisma.warehouse.findFirst({
            where: { tenantId: ctx.tenantId, code: warehouseCode },
          });

          if (!warehouse) {
            warehouse = await this.prisma.warehouse.create({
              data: {
                tenantId: ctx.tenantId,
                code: warehouseCode,
                name: warehouseCode,
                isActive: true,
              },
            });
          }

          // Calculate delta between target quantity and current balance
          const existingBalance = await this.prisma.warehouseItemBalance.findFirst({
            where: {
              tenantId: ctx.tenantId,
              warehouseId: warehouse.id,
              itemId: item.id,
            },
          });

          const currentQty = existingBalance ? Number(existingBalance.actualQty) : 0;
          const delta = quantity - currentQty;

          if (delta !== 0) {
            // Call outside any wrapping transaction - StockMovementService manages its own
            await this.stockMovementService.createMovement(ctx, {
              movementType: MovementType.ADJUSTMENT,
              warehouseCode,
              items: [{
                itemCode: code,
                quantity: delta,
                rate: 0,
              }],
              remarks: `Inventory import adjustment for ${code}`,
              reference: 'IMPORT',
            });
          }
        }
        result.updated++;
      } catch (error) {
        result.errors.push({
          row: rowNum,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await this.auditLogService.log(ctx, {
      action: 'IMPORT_INVENTORY',
      docType: 'Inventory',
      docName: 'bulk-import',
      meta: { total: result.total, created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.length },
    });

    return result;
  }

  // ==========================================
  // Export Functions
  // ==========================================

  /**
   * Export data to CSV
   */
  async exportCsv(
    ctx: TenantContext,
    entityType: ExportEntityType,
    res: Response,
    filters: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<void> {
    const generator = this.getExportDataGenerator(ctx, entityType, filters);
    const filename = `${entityType}-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    let aborted = false;
    res.on('close', () => { aborted = true; });

    let isFirst = true;
    let headers: string[] = [];

    for await (const chunk of generator) {
      if (aborted) break;
      if (chunk.length === 0) continue;

      if (isFirst) {
        headers = Object.keys(chunk[0]);
        const canContinueHeader = res.write(headers.map(h => `"${h}"`).join(',') + '\n');
        if (!canContinueHeader) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
        isFirst = false;
      }

      for (const row of chunk) {
        const values = headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '""';
          if (typeof val === 'string') {
            // Sanitize against CSV formula injection
            let sanitized = val.replace(/"/g, '""');
            if (/^[=+\-@\t\r]/.test(sanitized)) {
              sanitized = `'${sanitized}`;
            }
            return `"${sanitized}"`;
          }
          return `"${val}"`;
        });
        const canContinue = res.write(values.join(',') + '\n');
        if (!canContinue) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
    }

    res.end();
  }

  /**
   * Export data to JSON
   */
  async exportJson(
    ctx: TenantContext,
    entityType: ExportEntityType,
    res: Response,
    filters: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<void> {
    const generator = this.getExportDataGenerator(ctx, entityType, filters);
    const filename = `${entityType}-export-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    let aborted = false;
    res.on('close', () => { aborted = true; });

    let isFirst = true;
    res.write('[\n');

    for await (const chunk of generator) {
      if (aborted) break;
      for (const row of chunk) {
        if (!isFirst) {
          res.write(',\n');
        }
        const canContinue = res.write(JSON.stringify(row, null, 2));
        if (!canContinue) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
        isFirst = false;
      }
    }

    res.write('\n]');
    res.end();
  }

  private getExportDataGenerator(
    ctx: TenantContext,
    entityType: ExportEntityType,
    filters: { startDate?: Date; endDate?: Date }
  ): AsyncGenerator<Record<string, unknown>[]> {
    switch (entityType) {
      case 'products':
        return this.exportProducts(ctx);
      case 'customers':
        return this.exportCustomers(ctx);
      case 'inventory':
        return this.exportInventory(ctx);
      case 'orders':
        return this.exportOrders(ctx, filters);
      case 'transactions':
        throw new NotImplementedException(
          'Transactions export is not yet implemented. Query GlEntry/Payment records directly.',
        );
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  private async *exportProducts(ctx: TenantContext): AsyncGenerator<Record<string, unknown>[]> {
    const CHUNK_SIZE = 1000;
    let skip = 0;

    while (true) {
      const items = await this.prisma.item.findMany({
        where: { tenantId: ctx.tenantId, isActive: true },
        include: { productListing: true },
        orderBy: { code: 'asc' },
        take: CHUNK_SIZE,
        skip,
      });

      if (items.length === 0) break;

      yield items.map(i => ({
        code: i.code,
        name: i.name,
        price: i.productListing ? Number(i.productListing.price) : 0,
        cost: i.productListing?.costPrice ? Number(i.productListing.costPrice) : 0,
        reorderLevel: i.reorderLevel ? Number(i.reorderLevel) : 0,
        createdAt: i.createdAt.toISOString(),
      }));

      skip += CHUNK_SIZE;
      if (items.length < CHUNK_SIZE) break;
    }
  }

  private async *exportCustomers(ctx: TenantContext): AsyncGenerator<Record<string, unknown>[]> {
    const CHUNK_SIZE = 1000;
    let skip = 0;

    while (true) {
      const customers = await this.prisma.storeCustomer.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { email: 'asc' },
        take: CHUNK_SIZE,
        skip,
      });

      if (customers.length === 0) break;

      yield customers.map(c => ({
        email: c.email,
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        phone: c.phone || '',
        createdAt: c.createdAt.toISOString(),
      }));

      skip += CHUNK_SIZE;
      if (customers.length < CHUNK_SIZE) break;
    }
  }

  private async *exportInventory(ctx: TenantContext): AsyncGenerator<Record<string, unknown>[]> {
    const CHUNK_SIZE = 1000;
    let offset = 0;

    while (true) {
      const items = await this.prisma.$queryRaw<Array<{
        code: string;
        name: string;
        qty_on_hand: number;
        cost_price: number;
      }>>`
        SELECT
          i.code,
          i.name,
          COALESCE(SUM(wb."actualQty")::float, 0) as qty_on_hand,
          COALESCE(pl."costPrice"::float, 0) as cost_price
        FROM items i
        LEFT JOIN warehouse_item_balances wb ON wb."itemId" = i.id
        LEFT JOIN product_listings pl ON pl."itemId" = i.id
        WHERE i."tenantId" = ${ctx.tenantId}
          AND i."isActive" = true
        GROUP BY i.id, i.code, i.name, pl."costPrice"
        ORDER BY i.code ASC
        LIMIT ${CHUNK_SIZE} OFFSET ${offset}
      `;

      if (items.length === 0) break;

      yield items.map(i => ({
        code: i.code,
        name: i.name,
        qtyOnHand: Number(i.qty_on_hand),
        costPrice: Number(i.cost_price),
        stockValue: Number(i.qty_on_hand) * Number(i.cost_price),
      }));

      offset += CHUNK_SIZE;
      if (items.length < CHUNK_SIZE) break;
    }
  }

  private async *exportOrders(
    ctx: TenantContext,
    filters: { startDate?: Date; endDate?: Date }
  ): AsyncGenerator<Record<string, unknown>[]> {
    const where: Prisma.OrderWhereInput = { tenantId: ctx.tenantId };
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) (where.createdAt as any).gte = filters.startDate;
      if (filters.endDate) (where.createdAt as any).lte = filters.endDate;
    }

    const CHUNK_SIZE = 1000;
    let skip = 0;

    while (true) {
      const orders = await this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
        take: CHUNK_SIZE,
        skip,
      });

      if (orders.length === 0) break;

      yield orders.map(o => ({
        orderNumber: o.orderNumber,
        customerEmail: o.email,
        status: o.status,
        paymentStatus: o.paymentStatus,
        subtotal: Number(o.subtotal),
        tax: Number(o.taxTotal),
        shipping: Number(o.shippingTotal),
        discount: Number(o.discountTotal),
        total: Number(o.grandTotal),
        itemCount: o.items.length,
        createdAt: o.createdAt.toISOString(),
      }));

      skip += CHUNK_SIZE;
      if (orders.length < CHUNK_SIZE) break;
    }
  }

  // ==========================================
  // Utility Functions
  // ==========================================

  private parseCsv(content: string): Record<string, string>[] {
    const lines = content.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const row: Record<string, string> = {};

      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }

      rows.push(row);
    }

    return rows;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }
}
