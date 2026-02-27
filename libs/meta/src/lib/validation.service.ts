import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { toSafeTableName } from './identifiers';

@Injectable()
export class ValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(docType: string, data: any, tenantId: string) {
    const docTypeExists = await this.prisma.docType.findUnique({ where: { name: docType } });
    if (!docTypeExists) throw new BadRequestException(`DocType ${docType} does not exist`);

    // 1. Fetch Metadata
    const fields = await this.prisma.docField.findMany({
      where: { docTypeName: docType },
      orderBy: { idx: 'asc' }
    });

    if (!fields || fields.length === 0) {
       return;
    }

    // 2. Iterate fields
    for (const field of fields) {
      const value = data[field.name];

      // Required Check
      if (field.required && (value === undefined || value === null || value === '')) {
        throw new BadRequestException(`Field '${field.label}' (${field.name}) is required`);
      }

      // Type Check (Basic)
      if (value !== undefined && value !== null) {
        switch (field.type) {
            case 'Int':
                if (!Number.isInteger(Number(value))) throw new BadRequestException(`Field '${field.name}' must be an Integer`);
                break;
            case 'Float':
            case 'Currency':
                if (isNaN(Number(value))) throw new BadRequestException(`Field '${field.name}' must be a Number`);
                break;
            case 'Date':
                if (isNaN(Date.parse(value))) throw new BadRequestException(`Field '${field.name}' must be a valid Date string`);
                break;
            case 'Link':
                if (field.target) {
                    await this.validateLink(field.target, value, tenantId);
                }
                break;
        }
      }
    }
  }

  private async validateLink(targetDocType: string, name: string, tenantId: string) {
    const targetExists = await this.prisma.docType.findUnique({ where: { name: targetDocType } });
    if (!targetExists) throw new BadRequestException(`Invalid Link Target: ${targetDocType}`);

    const tableName = toSafeTableName(targetDocType);
    // Wrap query in a transaction that sets RLS context to enforce tenant isolation
    try {
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
            return tx.$queryRawUnsafe(
                `SELECT name FROM "${tableName}" WHERE name = $1`,
                name
            );
        });
        if ((result as any[]).length === 0) {
            throw new BadRequestException(`Link mismatch: ${name} not found in ${targetDocType}`);
        }
    } catch (e) {
        if (e instanceof BadRequestException) throw e;
        // Table might not exist
        throw new BadRequestException(`Invalid Link Target: ${targetDocType}`);
    }
  }
}
