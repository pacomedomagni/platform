import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { DocTypeDefinition, DocFieldDefinition } from './types';
import { assertSafeColumnName, toSafeTableName } from './identifiers';

@Injectable()
export class SchemaService {
  private readonly logger = new Logger(SchemaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listDocTypes(): Promise<DocTypeDefinition[]> {
      const docTypes = await this.prisma.docType.findMany({
          orderBy: { name: 'asc' },
          include: { fields: true }
      });
      
      return docTypes.map(dt => ({
          name: dt.name,
          module: dt.module,
          isSingle: dt.isSingle,
          fields: dt.fields.map(f => ({
              name: f.name,
              label: f.label,
              type: f.type,
              hidden: f.hidden
          }))
      }));
  }

  async getDocType(name: string): Promise<DocTypeDefinition | null> {
    const docType = await this.prisma.docType.findUnique({
      where: { name },
      include: {
        fields: {
          orderBy: { idx: 'asc' }
        },
        perms: {
          orderBy: { idx: 'asc' }
        }
      }
    });

    if (!docType) return null;

    return {
      name: docType.name,
      module: docType.module,
      isSingle: docType.isSingle,
      isChild: docType.isChild,
      description: docType.description || undefined,
      fields: docType.fields.map(f => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: f.required,
        unique: f.unique,
        hidden: f.hidden,
        readonly: f.readonly,
        options: f.options || undefined,
        target: f.target || undefined,
        idx: f.idx
      })),
      permissions: docType.perms.map(p => ({
        role: p.role,
        read: p.read,
        write: p.write,
        create: p.create,
        delete: p.delete,
        submit: p.submit,
        cancel: p.cancel,
        amend: p.amend,
        report: p.report,
        idx: p.idx
      }))
    };
  }

  /**
   * Syncs a JSON DocType definition to the DocType and DocField tables.
   * Also orchestrates the physical DDL changes.
   */
  async syncDocType(def: DocTypeDefinition) {
    this.logger.log(`Syncing metadata for: ${def.name}`);

    // Validate names early since they may be used as SQL identifiers later.
    this.getTableName(def.name);
    for (const field of def.fields) {
      assertSafeColumnName(field.name);
    }
    
    // 1. Upsert DocType Metadata
    await this.prisma.docType.upsert({
      where: { name: def.name },
      update: {
        module: def.module,
        isSingle: def.isSingle ?? false,
        isChild: def.isChild ?? false,
        description: def.description,
      },
      create: {
        name: def.name,
        module: def.module,
        isSingle: def.isSingle ?? false,
        isChild: def.isChild ?? false,
        description: def.description,
      },
    });

    // 2. Sync Fields Metadata
    const fieldNames = def.fields.map(f => f.name);
    
    // Remove deleted fields
    await this.prisma.docField.deleteMany({
      where: {
        docTypeName: def.name,
        name: { notIn: fieldNames }
      }
    });

    for (const [idx, fieldDef] of def.fields.entries()) {
      const existing = await this.prisma.docField.findFirst({
        where: { docTypeName: def.name, name: fieldDef.name }
      });

      const data = {
        label: fieldDef.label,
        type: fieldDef.type,
        required: fieldDef.required ?? false,
        unique: fieldDef.unique ?? false,
        hidden: fieldDef.hidden ?? false,
        readonly: fieldDef.readonly ?? false,
        options: fieldDef.options,
        target: fieldDef.target,
        idx: idx
      };

      if (existing) {
        await this.prisma.docField.update({
          where: { id: existing.id },
          data
        });
      } else {
        await this.prisma.docField.create({
          data: {
            ...data,
            name: fieldDef.name,
            docTypeName: def.name
          }
        });
      }
    }

    // 3. Sync Permissions
    if (def.permissions) {
        // Simple strategy: Clear all and re-insert. 
        // Identifiers for perms are just indexes basically.
        await this.prisma.docPerm.deleteMany({
            where: { docTypeName: def.name }
        });

        for (const [idx, perm] of def.permissions.entries()) {
            await this.prisma.docPerm.create({
                data: {
                    docTypeName: def.name,
                    role: perm.role,
                    read: perm.read ?? true,
                    write: perm.write ?? false,
                    create: perm.create ?? false,
                    delete: perm.delete ?? false,
                    submit: perm.submit ?? false,
                    cancel: perm.cancel ?? false,
                    amend: perm.amend ?? false,
                    report: perm.report ?? false,
                    idx: idx
                }
            });
        }
    }

    // 4. Physical Schema Migration (DDL)
    // Only for standard tables, not Singles (which might be key-value store) or Virtual
    if (!def.isSingle) {
        await this.ensureTable(def.name);
        for (const field of def.fields) {
            await this.ensureColumn(def.name, field);
        }
    }
  }

  private getTableName(docTypeName: string): string {
    return toSafeTableName(docTypeName);
  }

  private async ensureTable(docTypeName: string) {
    const tableName = this.getTableName(docTypeName);
    // Check if table exists
    const result = await this.prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
      ) AS "exists";
    `;
    const exists = result[0]?.exists;

    if (!exists) {
        this.logger.log(`Creating table ${tableName}`);
        
        let extraColumns = '';
        // If this is a Child Table, it needs parent pointers
        const isChild = await this.prisma.docType.findUnique({ where: { name: docTypeName } }).then(d => d?.isChild);
        
        if (isChild) {
            extraColumns = `
                , "parent" VARCHAR(255)
                , "parenttype" VARCHAR(255)
                , "parentfield" VARCHAR(255)
            `;
        }

        // Create table with standard columns
        // name (PK) is usually just ID in modern systems, but we keep 'name' for human readable ID if needed
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE "${tableName}" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" VARCHAR(255), 
                "creation" TIMESTAMP DEFAULT NOW(),
                "modified" TIMESTAMP DEFAULT NOW(),
                "owner" VARCHAR(255),
                "docstatus" INT DEFAULT 0,
                "idx" INT DEFAULT 0
                ${extraColumns}
            );
        `);
    }
  }

  // Also need to handle 'isChild' update manually if table already exists, 
  // but for now let's assume table creation is sufficient.
  // Ideally ensureTable should check for missing standard columns too.

  private async ensureColumn(docTypeName: string, field: DocFieldDefinition) {
     const tableName = this.getTableName(docTypeName);
     let colName: string;
     try {
       colName = assertSafeColumnName(field.name);
     } catch {
       this.logger.warn(`Skipping invalid column name: ${field.name}`);
       return;
     }
     
     // Check existence
     const result = await this.prisma.$queryRaw<{ column_name: string }[]>`
       SELECT column_name
       FROM information_schema.columns
       WHERE table_name = ${tableName}
         AND column_name = ${colName};
     `;
     const exists = result.length > 0;

     if (!exists) {
         const sqlType = this.mapTypeToSQL(field.type);
         if (sqlType) {
            this.logger.log(`Adding column ${colName} to ${tableName}`);
            await this.prisma.$executeRawUnsafe(`
                ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlType};
            `);
         }
     }
  }

  private mapTypeToSQL(type: string): string | null {
      // Basic mapping
      switch (type) {
          case 'Data': 
          case 'Link':
          case 'Select':
          case 'Password':
            return 'VARCHAR(255)';
          
          case 'Int': 
            return 'INTEGER';
          
          case 'Float': 
          case 'Currency':
            return 'DECIMAL(18, 6)';
            
          case 'Check': 
            return 'BOOLEAN';
            
          case 'Date': 
            return 'DATE';
            
          case 'Datetime': 
            return 'TIMESTAMP';
            
          case 'Text': 
          case 'Small Text':
          case 'Long Text':
            return 'TEXT';
          
          case 'Table':
            // Table fields do not create columns in the parent table.
            return null;

          default: return null; 
      }
  }
}
