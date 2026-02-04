import { Injectable, NotFoundException, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { ValidationService } from './validation.service';
import { PermissionService } from './permission.service';
import { HookService } from './hook.service';
import { assertSafeColumnName, toSafeTableName } from './identifiers';

@Injectable()
export class DocService {
  private readonly logger = new Logger(DocService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
    private readonly permissionService: PermissionService,
    private readonly hookService: HookService
  ) {}

  private getTableName(docType: string): string {
    return toSafeTableName(docType);
  }

  private async setTenant(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
  }

  private async assertDocTypeExists(docType: string) {
    const exists = await this.prisma.docType.findUnique({
      where: { name: docType },
      select: { name: true },
    });
    if (!exists) throw new NotFoundException(`DocType ${docType} not found`);
  }

  private async getDocFieldMeta(docType: string) {
    return this.prisma.docField.findMany({
      where: { docTypeName: docType },
      orderBy: { idx: 'asc' },
    });
  }

  async create(docType: string, data: any, user: any) {
    await this.permissionService.ensurePermission(docType, user.roles, 'create');
    await this.assertDocTypeExists(docType);
    const tenantId = user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    
    const tableName = this.getTableName(docType);
    
    // 0. Validate Payload
    await this.validationService.validate(docType, data);

    // 0.1 Hook: beforeSave
    const processedData = await this.hookService.trigger(docType, 'beforeSave', { ...data }, user);
    // Use processed data
    const { id, creation, modified, ...rest } = processedData; // Keep 'name' in rest

    const fieldsMeta = await this.getDocFieldMeta(docType);
    const standardAllowed = new Set(
      fieldsMeta.filter((f) => f.type !== 'Table').map((f) => f.name),
    );
    const tableFieldByName = new Map(
      fieldsMeta.filter((f) => f.type === 'Table').map((f) => [f.name, f]),
    );

    // 1. Separate Fields: Standard vs Child Tables
    
    const standardFields: any = {};
    const childTables: any = {}; // Key: fieldName, Value: Array of objects
    
    for (const key of Object.keys(rest)) {
        assertSafeColumnName(key);
        if (Array.isArray(rest[key])) {
            if (!tableFieldByName.has(key)) {
              throw new BadRequestException(`Unknown child table field: ${key}`);
            }
            childTables[key] = rest[key];
        } else {
            if (key !== 'name' && !standardAllowed.has(key)) {
              throw new BadRequestException(`Unknown field: ${key}`);
            }
            standardFields[key] = rest[key];
        }
    }

    // Prepare separate list of child fields metadata ahead of time
    const childFieldsMeta = fieldsMeta.filter((f) => f.type === 'Table');

    const childDocCache = new Map<
      string,
      { allowed: Set<string>; tableName: string }
    >();

    const result = await this.prisma.$transaction(async (tx) => {
        await this.setTenant(tx, tenantId);
        // ... (transaction existing logic, wait no I need to capture the variable first to return it but also run afterSave)
        // Refactoring to keep transaction logic inside but result outside
        
        // 2. Insert Parent
        standardFields.tenantId = tenantId;
        const columns = Object.keys(standardFields);
        const values = Object.values(standardFields);
        
        let parentDoc: any;

        if (columns.length === 0) {
           const result = await tx.$queryRawUnsafe(`INSERT INTO "${tableName}" DEFAULT VALUES RETURNING *`);
           parentDoc = (result as any[])[0];
        } else {
            const safeColumns = columns.map(assertSafeColumnName);
            const colStr = safeColumns.map(c => `"${c}"`).join(', ');
            const valPlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            
            const sql = `
                INSERT INTO "${tableName}" (${colStr}) 
                VALUES (${valPlaceholders}) 
                RETURNING *;
            `;
            const result = await tx.$queryRawUnsafe(sql, ...values);
            parentDoc = (result as any[])[0];
        }

        // 3. Insert Child Tables
        for (const field of childFieldsMeta) {
            const children = childTables[field.name];
            if (children && children.length > 0 && field.options) {
                 const childDocType = field.options; 
                 await this.assertDocTypeExists(childDocType);

                 let cached = childDocCache.get(childDocType);
                 if (!cached) {
                   const childMeta = await this.getDocFieldMeta(childDocType);
                   const allowed = new Set<string>([
                     'name',
                     'parent',
                     'parenttype',
                     'parentfield',
                     'idx',
                     'tenantId',
                     ...childMeta.filter((f) => f.type !== 'Table').map((f) => f.name),
                   ]);
                   cached = { allowed, tableName: this.getTableName(childDocType) };
                   childDocCache.set(childDocType, cached);
                 }
                 const childTableName = cached.tableName;
                 
                 let idx = 0;
                 // Insert each child
                 for (const child of children) {
                     const { id: cid, ...childPayload } = child;
                     // Link to parent
                     childPayload.parent = parentDoc.name || parentDoc.id;
                     childPayload.parenttype = docType;
                     childPayload.parentfield = field.name;
                     childPayload.idx = idx++;
                     childPayload.tenantId = tenantId;
                     
                     const childCols = Object.keys(childPayload);
                     for (const col of childCols) {
                       assertSafeColumnName(col);
                       if (!cached.allowed.has(col)) {
                         throw new BadRequestException(
                           `Unknown field on ${childDocType}: ${col}`,
                         );
                       }
                     }
                     const childVals = Object.values(childPayload);
                     const childColStr = childCols.map(c => `"${c}"`).join(', ');
                     const childValPh = childCols.map((_, i) => `$${i + 1}`).join(', ');

                     await tx.$executeRawUnsafe(
                         `INSERT INTO "${childTableName}" (${childColStr}) VALUES (${childValPh})`,
                         ...childVals
                     );
                 }
            }
        }

        // Return composited result
        return {
            ...parentDoc,
            ...childTables
        };
    });

    // 4. Hook: afterSave
    await this.hookService.trigger(docType, 'afterSave', result, user);
    await this.logAudit('CREATE', docType, result?.name ?? result?.id ?? '', user);

    return result;
  }

  async findOne(docType: string, name: string, user: any) {
    await this.permissionService.ensurePermission(docType, user.roles, 'read');
    await this.assertDocTypeExists(docType);
    const tenantId = user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const tableName = this.getTableName(docType);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.$queryRawUnsafe(`
          SELECT * FROM "${tableName}" WHERE name = $1 LIMIT 1;
      `, name);
    });
    
    const doc = (result as any[])[0];
    if (!doc) throw new NotFoundException(`${docType} ${name} not found`);

    // Fetch Children
    const childFields = await this.prisma.docField.findMany({
        where: { docTypeName: docType, type: 'Table' }
    });

    for (const field of childFields) {
        if (field.options) {
            await this.assertDocTypeExists(field.options);
            const childTableName = this.getTableName(field.options);
            const children = await this.prisma.$transaction(async (tx) => {
              await this.setTenant(tx, tenantId);
              return tx.$queryRawUnsafe(`
                  SELECT * FROM "${childTableName}" 
                  WHERE parent = $1 AND parentfield = $2 AND parenttype = $3
                  ORDER BY idx ASC
              `, name, field.name, docType);
            });
            
            doc[field.name] = children;
        }
    }

    return doc;
  }

  // async findAll ... (unchanged) -> actually no, I need to remove the broken duplicate findOne below


  async findAll(docType: string, user: any) {
      await this.permissionService.ensurePermission(docType, user.roles, 'read');
      await this.assertDocTypeExists(docType);
      const tenantId = user?.tenantId;
      if (!tenantId) throw new BadRequestException('Missing tenantId');
      const tableName = this.getTableName(docType);
      return this.prisma.$transaction(async (tx) => {
        await this.setTenant(tx, tenantId);
        return tx.$queryRawUnsafe(`SELECT * FROM "${tableName}" LIMIT 100`);
      });
  }

  async update(docType: string, name: string, data: any, user: any) {
    await this.permissionService.ensurePermission(docType, user.roles, 'write');
    await this.assertDocTypeExists(docType);
    const tenantId = user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    
    const tableName = this.getTableName(docType);

    const fieldsMeta = await this.getDocFieldMeta(docType);
    const standardAllowed = new Set(
      fieldsMeta.filter((f) => f.type !== 'Table').map((f) => f.name),
    );
    const tableFieldByName = new Map(
      fieldsMeta.filter((f) => f.type === 'Table').map((f) => [f.name, f]),
    );

    // Check Status
    const existing = await this.findOne(docType, name, user);
    if (existing.docstatus === 1) {
        throw new ForbiddenException('Cannot edit a submitted document');
    }
    // TODO: Allow amending (DocPerm.amend) which creates a new version? 
    // For now, strict lock.

    // 0. Hook: beforeSave (Yes, we run beforeSave on update too. We might want separate beforeUpdate?)
    // Standard ERP pattern: beforeSave runs on both.
    // Merge existing data? 
    // Ideally we should fetch the existing doc to pass "oldDoc" to the hook, but for MVP let's just pass payload.
    const processedData = await this.hookService.trigger(docType, 'beforeSave', { ...data }, user);
    
    // 0. Separate Fields
    const { id, creation, modified, ...rest } = processedData;

    const standardFields: any = {};
    const childTables: any = {};
    
    for (const key of Object.keys(rest)) {
        assertSafeColumnName(key);
        if (Array.isArray(rest[key])) {
            if (!tableFieldByName.has(key)) {
              throw new BadRequestException(`Unknown child table field: ${key}`);
            }
            childTables[key] = rest[key];
        } else {
            if (key !== 'name' && !standardAllowed.has(key)) {
              throw new BadRequestException(`Unknown field: ${key}`);
            }
            standardFields[key] = rest[key];
        }
    }

    // Get Metadata for child tables
    const childFieldsMeta = fieldsMeta.filter((f) => f.type === 'Table');

    const childDocCache = new Map<
      string,
      { allowed: Set<string>; tableName: string }
    >();

        const result = await this.prisma.$transaction(async (tx) => {
            await this.setTenant(tx, tenantId);
        // 1. Update Parent
        let parentDoc: any;
        standardFields.tenantId = tenantId;
        const columns = Object.keys(standardFields);
        
        if (columns.length > 0) {
            const updates: string[] = [];
            const values: any[] = [];
            let i = 1;

            for (const key of columns) {
                assertSafeColumnName(key);
                updates.push(`"${key}" = $${i}`);
                values.push(standardFields[key]);
                i++;
            }
            values.push(name); // WHERE clause param

            const sql = `
                UPDATE "${tableName}" 
                SET ${updates.join(', ')}, modified = NOW() 
                WHERE name = $${i}
                RETURNING *;
            `;
            const result = await tx.$queryRawUnsafe(sql, ...values);
            parentDoc = (result as any[])[0];
            
            if (!parentDoc) throw new NotFoundException(`${docType} ${name} not found`);
        } else {
            // No standard fields changed, fetch current to ensure existence and return
            const result = await tx.$queryRawUnsafe(`SELECT * FROM "${tableName}" WHERE name = $1`, name);
            parentDoc = (result as any[])[0];
            if (!parentDoc) throw new NotFoundException(`${docType} ${name} not found`);
        }

        // 2. Process Child Tables (Delete & Replace)
        for (const field of childFieldsMeta) {
             if (Object.prototype.hasOwnProperty.call(childTables, field.name)) {
                 const children = childTables[field.name];
                 const childDocType = field.options; 
                 if (!childDocType) continue;
                 await this.assertDocTypeExists(childDocType);

                 let cached = childDocCache.get(childDocType);
                 if (!cached) {
                   const childMeta = await this.getDocFieldMeta(childDocType);
                   const allowed = new Set<string>([
                     'name',
                     'parent',
                     'parenttype',
                     'parentfield',
                     'idx',
                     'tenantId',
                     ...childMeta.filter((f) => f.type !== 'Table').map((f) => f.name),
                   ]);
                   cached = { allowed, tableName: this.getTableName(childDocType) };
                   childDocCache.set(childDocType, cached);
                 }
                 const childTableName = cached.tableName;

                 // Delete existing for this field
                 await tx.$executeRawUnsafe(`
                    DELETE FROM "${childTableName}" 
                    WHERE parent = $1 AND parentfield = $2 AND parenttype = $3
                 `, name, field.name, docType);

                 // Insert new
                 if (children.length > 0) {
                     let idx = 0;
                     for (const child of children) {
                         const { id: cid, ...childPayload } = child;
                         childPayload.parent = name;
                         childPayload.parenttype = docType;
                         childPayload.parentfield = field.name;
                         childPayload.idx = idx++;
                         childPayload.tenantId = tenantId;
                         
                         const childCols = Object.keys(childPayload);
                         for (const col of childCols) {
                           assertSafeColumnName(col);
                           if (!cached.allowed.has(col)) {
                             throw new BadRequestException(
                               `Unknown field on ${childDocType}: ${col}`,
                             );
                           }
                         }
                         const childVals = Object.values(childPayload);
                         const childColStr = childCols.map(c => `"${c}"`).join(', ');
                         const childValPh = childCols.map((_, i) => `$${i + 1}`).join(', ');

                         await tx.$executeRawUnsafe(
                             `INSERT INTO "${childTableName}" (${childColStr}) VALUES (${childValPh})`,
                             ...childVals
                         );
                     }
                 }
             }
        }

        return {
            ...parentDoc,
            ...childTables
        };
    });

    // 4. Hook: afterSave
    await this.hookService.trigger(docType, 'afterSave', result, user);
    await this.logAudit('UPDATE', docType, name, user);

    return result;
  }

  async delete(docType: string, name: string, user: any) {
      await this.permissionService.ensurePermission(docType, user.roles, 'delete');
      await this.assertDocTypeExists(docType);
      const tenantId = user?.tenantId;
      if (!tenantId) throw new BadRequestException('Missing tenantId');
      const tableName = this.getTableName(docType);
      await this.prisma.$transaction(async (tx) => {
        await this.setTenant(tx, tenantId);
        await tx.$executeRawUnsafe(`DELETE FROM "${tableName}" WHERE name = $1`, name);
      });
      await this.logAudit('DELETE', docType, name, user);
      return { status: 'deleted', name };
  }

  async submit(docType: string, name: string, user: any) {
      await this.permissionService.ensurePermission(docType, user.roles, 'submit');
      await this.assertDocTypeExists(docType);
      const tenantId = user?.tenantId;
      if (!tenantId) throw new BadRequestException('Missing tenantId');
      const tableName = this.getTableName(docType);

      // Check current state
      const existing = await this.findOne(docType, name, user);
      if (existing.docstatus === 1) throw new BadRequestException('Document already submitted');
      
      // Update DB
      // We assume docstatus column exists if they have submit permission? 
      // Or we try/catch to valid "docstatus" column missing error.
      try {
          await this.prisma.$transaction(async (tx) => {
            await this.setTenant(tx, tenantId);
            await tx.$executeRawUnsafe(`UPDATE "${tableName}" SET docstatus = 1, modified = NOW() WHERE name = $1`, name);
          });
      } catch (e) {
          this.logger.error(e);
          throw new BadRequestException('Failed to submit. Does the DocType have a docstatus field?');
      }

      const updated = await this.findOne(docType, name, user);
      await this.hookService.trigger(docType, 'onSubmit', updated, user);
      await this.logAudit('SUBMIT', docType, name, user);
      return { status: 'submitted', name };
  }

  async cancel(docType: string, name: string, user: any) {
      await this.permissionService.ensurePermission(docType, user.roles, 'cancel');
      await this.assertDocTypeExists(docType);
      const tenantId = user?.tenantId;
      if (!tenantId) throw new BadRequestException('Missing tenantId');
      const tableName = this.getTableName(docType);

      const existing = await this.findOne(docType, name, user);
      if (existing.docstatus !== 1) throw new BadRequestException('Document must be submitted to cancel');

      try {
          await this.prisma.$transaction(async (tx) => {
            await this.setTenant(tx, tenantId);
            await tx.$executeRawUnsafe(`UPDATE "${tableName}" SET docstatus = 2, modified = NOW() WHERE name = $1`, name);
          });
      } catch (e) {
         throw new BadRequestException('Failed to cancel.');
      }

      const updated = await this.findOne(docType, name, user);
      await this.hookService.trigger(docType, 'onCancel', updated, user);
      await this.logAudit('CANCEL', docType, name, user);
      return { status: 'cancelled', name };
  }

  private async logAudit(action: string, docType: string, docName: string, user: any) {
    const tenantId = user?.tenantId;
    if (!tenantId || !docName) return;
    const userId = user?.id ?? user?.userId ?? null;
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId ?? undefined,
        action,
        docType,
        docName,
      },
    });
  }
}
