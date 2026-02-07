import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

// ==========================================
// Stock Movement DTOs
// ==========================================

export enum MovementType {
  RECEIPT = 'receipt',
  ISSUE = 'issue',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
}

export class StockMovementItemDto {
  @IsString()
  itemCode!: string;

  // Sign validation is handled by the service layer based on movement type.
  // Negative values are allowed for adjustments.
  @IsNumber()
  quantity!: number;

  @IsString()
  @IsOptional()
  batchNo?: string;

  @IsString()
  @IsOptional()
  serialNo?: string;

  @IsNumber()
  @IsOptional()
  rate?: number;

  @IsString()
  @IsOptional()
  locationCode?: string;

  @IsString()
  @IsOptional()
  toLocationCode?: string;
}

export class CreateStockMovementDto {
  @IsEnum(MovementType)
  movementType!: MovementType;

  @IsString()
  warehouseCode!: string;

  @IsString()
  @IsOptional()
  toWarehouseCode?: string;

  @IsDateString()
  @IsOptional()
  postingDate?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockMovementItemDto)
  items!: StockMovementItemDto[];
}

export class StockMovementQueryDto {
  @IsEnum(MovementType)
  @IsOptional()
  movementType?: MovementType;

  @IsString()
  @IsOptional()
  warehouseCode?: string;

  @IsString()
  @IsOptional()
  itemCode?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

// ==========================================
// Batch DTOs
// ==========================================

export class CreateBatchDto {
  @IsString()
  itemCode!: string;

  @IsString()
  batchNo!: string;

  @IsDateString()
  @IsOptional()
  mfgDate?: string;

  @IsDateString()
  @IsOptional()
  expDate?: string;
}

export class UpdateBatchDto {
  @IsDateString()
  @IsOptional()
  mfgDate?: string;

  @IsDateString()
  @IsOptional()
  expDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BatchQueryDto {
  @IsString()
  @IsOptional()
  itemCode?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeExpired?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  withStock?: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

// ==========================================
// Serial DTOs
// ==========================================

export class CreateSerialDto {
  @IsString()
  itemCode!: string;

  @IsString()
  serialNo!: string;

  @IsString()
  @IsOptional()
  warehouseCode?: string;

  @IsString()
  @IsOptional()
  locationCode?: string;

  @IsString()
  @IsOptional()
  batchNo?: string;
}

export class CreateSerialBulkDto {
  @IsString()
  itemCode!: string;

  @IsArray()
  @IsString({ each: true })
  serialNos!: string[];

  @IsString()
  @IsOptional()
  warehouseCode?: string;

  @IsString()
  @IsOptional()
  locationCode?: string;

  @IsString()
  @IsOptional()
  batchNo?: string;
}

export class UpdateSerialDto {
  @IsEnum(['AVAILABLE', 'ISSUED'])
  @IsOptional()
  status?: 'AVAILABLE' | 'ISSUED';

  @IsString()
  @IsOptional()
  warehouseCode?: string;

  @IsString()
  @IsOptional()
  locationCode?: string;

  @IsString()
  @IsOptional()
  batchNo?: string;
}

export class SerialQueryDto {
  @IsString()
  @IsOptional()
  itemCode?: string;

  @IsString()
  @IsOptional()
  warehouseCode?: string;

  @IsEnum(['AVAILABLE', 'ISSUED'])
  @IsOptional()
  status?: 'AVAILABLE' | 'ISSUED';

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

// ==========================================
// Warehouse & Location DTOs
// ==========================================

export class CreateWarehouseDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateLocationDto {
  @IsString()
  warehouseCode!: string;

  @IsString()
  code!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  parentCode?: string;

  @IsBoolean()
  @IsOptional()
  isPickable?: boolean;

  @IsBoolean()
  @IsOptional()
  isPutaway?: boolean;

  @IsBoolean()
  @IsOptional()
  isStaging?: boolean;
}
