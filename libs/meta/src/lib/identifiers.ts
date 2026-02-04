import { BadRequestException } from '@nestjs/common';

const MAX_PG_IDENTIFIER_LEN = 63;

export function toSafeTableName(docTypeName: string): string {
  const normalized = (docTypeName ?? '').trim();
  if (!normalized) throw new BadRequestException('DocType name is required');

  const compact = normalized.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9_]+$/.test(compact)) {
    throw new BadRequestException(`Invalid DocType name: ${docTypeName}`);
  }

  const tableName = `tab${compact}`;
  if (tableName.length > MAX_PG_IDENTIFIER_LEN) {
    throw new BadRequestException(`DocType name too long: ${docTypeName}`);
  }

  return tableName;
}

export function assertSafeColumnName(columnName: string): string {
  const name = (columnName ?? '').trim();
  if (!name) throw new BadRequestException('Column name is required');
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new BadRequestException(`Invalid column name: ${columnName}`);
  }
  if (name.length > MAX_PG_IDENTIFIER_LEN) {
    throw new BadRequestException(`Column name too long: ${columnName}`);
  }
  return name;
}
