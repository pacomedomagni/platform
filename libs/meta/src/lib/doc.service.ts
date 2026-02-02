import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ValidationService } from './validation.service';

@Injectable()
export class DocService {
  private readonly logger = new Logger(DocService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService
  ) {}

  private getTableName(docType: string): string {
    return `tab${docType.replace(/\s+/g, '')}`;
  }

  async create(docType: string, data: any) {
    const tableName = this.getTableName(docType);
    
    // 0. Validate Payload
    await this.validationService.validate(docType, data);

    // 1. Separate Fields: Standard vs Child Tables
    const { id, name, creation, modified, ...rest } = data;
    
    const standardFields: any = {};
    const childTables: any = {}; // Key: fieldName, Value: Array of objects
    
    for (const key of Object.keys(rest)) {
        if (Array.isArray(rest[key])) {
            childTables[key] = rest[key];
        } else {
            standardFields[key] = rest[key];
        }
    }

    // Prepare separate list of child fields metadata ahead of time
    const childFieldsMeta = await this.prisma.docField.findMany({
        where: { docTypeName: docType, type: 'Table' }
    });

    return await this.prisma.$transaction(async (tx) => {
        // 2. Insert Parent
        const columns = Object.keys(standardFields);
        const values = Object.values(standardFields);
        
        let parentDoc: any;

        if (columns.length === 0) {
           const result = await tx.$queryRawUnsafe(`INSERT INTO "${tableName}" DEFAULT VALUES RETURNING *`);
           parentDoc = (result as any[])[0];
        } else {
            const colStr = columns.map(c => `"${c}"`).join(', ');
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
                 const childTableName = this.getTableName(childDocType);
                 
                 let idx = 0;
                 // Insert each child
                 for (const child of children) {
                     const { id: cid, ...childPayload } = child;
                     // Link to parent
                     childPayload.parent = parentDoc.name || parentDoc.id;
                     childPayload.parenttype = docType;
                     childPayload.parentfield = field.name;
                     childPayload.idx = idx++;
                     
                     const childCols = Object.keys(childPayload);
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
  }

  async findOne(docType: string, name: string) {
    const tableName = this.getTableName(docType);
    const result = await this.prisma.$queryRawUnsafe(`
        SELECT * FROM "${tableName}" WHERE name = $1 LIMIT 1;
    `, name);
    
    const doc = (result as any[])[0];
    if (!doc) throw new NotFoundException(`${docType} ${name} not found`);

    // Fetch Children
    const childFields = await this.prisma.docField.findMany({
        where: { docTypeName: docType, type: 'Table' }
    });

    for (const field of childFields) {
        if (field.options) {
            const childTableName = this.getTableName(field.options);
            const children = await this.prisma.$queryRawUnsafe(`
                SELECT * FROM "${childTableName}" 
                WHERE parent = $1 AND parentfield = $2 AND parenttype = $3
                ORDER BY idx ASC
            `, name, field.name, docType);
            
            doc[field.name] = children;
        }
    }

    return doc;
  }

  // async findAll ... (unchanged) -> actually no, I need to remove the broken duplicate findOne below


  async findAll(docType: string) {
      const tableName = this.getTableName(docType);
      return this.prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}" LIMIT 100`);
  }

  async update(docType: string, name: string, data: any) {
    const tableName = this.getTableName(docType);
    
    // 0. Validate (Partial or Full?) 
    // Usually updates patch data. For full validation we might need to merge with existing.
    // For now, let's validate the fields provided against type rules.
    // Required checks might fail if we partial update. So we might need a partial flag in validationService.
    // Let's defer strict required check for updates or fetch existing doc and merge.
    
    // For MVP, simple type check on provided fields via same service? 
  async update(docType: string, name: string, data: any) {
    const tableName = this.getTableName(docType);
    
    // 0. Separate Fields
    const { id, creation, modified, ...rest } = data;

    const standardFields: any = {};
    const childTables: any = {};
    
    for (const key of Object.keys(rest)) {
        if (Array.isArray(rest[key])) {
            childTables[key] = rest[key];
        } else {
            standardFields[key] = rest[key];
        }
    }

    // Get Metadata for child tables
    const childFieldsMeta = await this.prisma.docField.findMany({
        where: { docTypeName: docType, type: 'Table' }
    });

    return await this.prisma.$transaction(async (tx) => {
        // 1. Update Parent
        let parentDoc: any;
        const columns = Object.keys(standardFields);
        
        if (columns.length > 0) {
            const updates: string[] = [];
            const values: any[] = [];
            let i = 1;

            for (const key of columns) {
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
             if (childTables.hasOwnProperty(field.name)) {
                 const children = childTables[field.name];
                 const childDocType = field.options; 
                 if (!childDocType) continue;
                 const childTableName = this.getTableName(childDocType);

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
                         
                         const childCols = Object.keys(childPayload);
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
  }

  async delete(docType: string, name: string) {
      const tableName = this.getTableName(docType);
      await this.prisma.$executeRawUnsafe(`DELETE FROM "${tableName}" WHERE name = $1`, name);
      return { status: 'deleted', name };
  }
}
