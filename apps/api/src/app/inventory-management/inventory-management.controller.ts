import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../tenant.middleware';
import { StockMovementService } from './stock-movement.service';
import { BatchSerialService } from './batch-serial.service';
import {
  CreateStockMovementDto,
  StockMovementQueryDto,
  CreateBatchDto,
  UpdateBatchDto,
  BatchQueryDto,
  CreateSerialDto,
  CreateSerialBulkDto,
  UpdateSerialDto,
  SerialQueryDto,
} from './inventory-management.dto';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

@Controller('api/v1/inventory-management')
@UseGuards(AuthGuard, RolesGuard)
export class InventoryManagementController {
  constructor(
    private readonly stockMovement: StockMovementService,
    private readonly batchSerial: BatchSerialService,
  ) {}

  private getContext(tenantId: string, req: any): TenantContext {
    return { tenantId, userId: req?.user?.sub };
  }

  // ==========================================
  // Stock Movements
  // ==========================================

  @Post('movements')
  @Roles('admin', 'Stock Manager')
  async createMovement(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stockMovement.createMovement(this.getContext(tenantId, req), dto);
  }

  @Get('movements')
  @Roles('admin', 'Stock Manager', 'user')
  async getMovements(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Query() query: StockMovementQueryDto,
  ) {
    return this.stockMovement.queryMovements(this.getContext(tenantId, req), query);
  }

  @Get('movements/summary')
  @Roles('admin', 'Stock Manager')
  async getMovementSummary(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.stockMovement.getMovementSummary(
      this.getContext(tenantId, req),
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('movements/item/:itemCode')
  @Roles('admin', 'Stock Manager', 'user')
  async getItemMovements(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Param('itemCode') itemCode: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockMovement.getItemMovements(
      this.getContext(tenantId, req),
      itemCode,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ==========================================
  // Batches
  // ==========================================

  @Post('batches')
  @Roles('admin', 'Stock Manager')
  async createBatch(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Body() dto: CreateBatchDto,
  ) {
    return this.batchSerial.createBatch(this.getContext(tenantId, req), dto);
  }

  @Get('batches')
  @Roles('admin', 'Stock Manager', 'user')
  async getBatches(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Query() query: BatchQueryDto,
  ) {
    return this.batchSerial.queryBatches(this.getContext(tenantId, req), query);
  }

  @Get('batches/expiring')
  @Roles('admin', 'Stock Manager')
  async getExpiringBatches(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Query('daysAhead') daysAhead?: string,
  ) {
    return this.batchSerial.getExpiringBatches(
      this.getContext(tenantId, req),
      daysAhead ? parseInt(daysAhead, 10) : 30,
    );
  }

  @Get('batches/:id')
  @Roles('admin', 'Stock Manager', 'user')
  async getBatchDetails(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.batchSerial.getBatchDetails(this.getContext(tenantId, req), id);
  }

  @Put('batches/:id')
  @Roles('admin', 'Stock Manager')
  async updateBatch(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto,
  ) {
    return this.batchSerial.updateBatch(this.getContext(tenantId, req), id, dto);
  }

  // ==========================================
  // Serials
  // ==========================================

  @Post('serials')
  @Roles('admin', 'Stock Manager')
  async createSerial(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Body() dto: CreateSerialDto,
  ) {
    return this.batchSerial.createSerial(this.getContext(tenantId, req), dto);
  }

  @Post('serials/bulk')
  @Roles('admin', 'Stock Manager')
  async createSerialsBulk(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Body() dto: CreateSerialBulkDto,
  ) {
    return this.batchSerial.createSerialsBulk(this.getContext(tenantId, req), dto);
  }

  @Get('serials')
  @Roles('admin', 'Stock Manager', 'user')
  async getSerials(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Query() query: SerialQueryDto,
  ) {
    return this.batchSerial.querySerials(this.getContext(tenantId, req), query);
  }

  @Get('serials/history/:serialNo')
  @Roles('admin', 'Stock Manager', 'user')
  async getSerialHistory(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Param('serialNo') serialNo: string,
  ) {
    return this.batchSerial.getSerialHistory(this.getContext(tenantId, req), serialNo);
  }

  @Put('serials/:id')
  @Roles('admin', 'Stock Manager')
  async updateSerial(
    @Tenant() tenantId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSerialDto,
  ) {
    return this.batchSerial.updateSerial(this.getContext(tenantId, req), id, dto);
  }
}
