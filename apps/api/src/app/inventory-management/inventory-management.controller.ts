import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthGuard, RolesGuard, Roles, AuthenticatedUser } from '@platform/auth';
import { Tenant } from '../tenant.middleware';
import { StockMovementService } from './stock-movement.service';
import { BatchSerialService } from './batch-serial.service';
import { WarehouseService } from './warehouse.service';
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
  CreateWarehouseDto,
  UpdateWarehouseDto,
  CreateLocationDto,
  UpdateLocationDto,
} from './inventory-management.dto';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

interface RequestWithUser extends ExpressRequest {
  user: AuthenticatedUser;
}

@Controller('inventory-management')
@UseGuards(AuthGuard, RolesGuard)
export class InventoryManagementController {
  constructor(
    private readonly stockMovement: StockMovementService,
    private readonly batchSerial: BatchSerialService,
    private readonly warehouseService: WarehouseService,
  ) {}

  private getContext(tenantId: string, req: RequestWithUser): TenantContext {
    return { tenantId, userId: req.user.userId };
  }

  // ==========================================
  // Stock Movements
  // ==========================================

  @Post('movements')
  @Roles('admin', 'Stock Manager')
  async createMovement(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stockMovement.createMovement(this.getContext(tenantId, req), dto);
  }

  @Get('movements')
  @Roles('admin', 'Stock Manager', 'user')
  async getMovements(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Query() query: StockMovementQueryDto,
  ) {
    return this.stockMovement.queryMovements(this.getContext(tenantId, req), query);
  }

  @Get('movements/summary')
  @Roles('admin', 'Stock Manager')
  async getMovementSummary(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
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
    @Request() req: RequestWithUser,
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
    @Request() req: RequestWithUser,
    @Body() dto: CreateBatchDto,
  ) {
    return this.batchSerial.createBatch(this.getContext(tenantId, req), dto);
  }

  @Get('batches')
  @Roles('admin', 'Stock Manager', 'user')
  async getBatches(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Query() query: BatchQueryDto,
  ) {
    return this.batchSerial.queryBatches(this.getContext(tenantId, req), query);
  }

  @Get('batches/expiring')
  @Roles('admin', 'Stock Manager')
  async getExpiringBatches(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
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
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.batchSerial.getBatchDetails(this.getContext(tenantId, req), id);
  }

  @Put('batches/:id')
  @Roles('admin', 'Stock Manager')
  async updateBatch(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
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
    @Request() req: RequestWithUser,
    @Body() dto: CreateSerialDto,
  ) {
    return this.batchSerial.createSerial(this.getContext(tenantId, req), dto);
  }

  @Post('serials/bulk')
  @Roles('admin', 'Stock Manager')
  async createSerialsBulk(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Body() dto: CreateSerialBulkDto,
  ) {
    return this.batchSerial.createSerialsBulk(this.getContext(tenantId, req), dto);
  }

  @Get('serials')
  @Roles('admin', 'Stock Manager', 'user')
  async getSerials(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Query() query: SerialQueryDto,
  ) {
    return this.batchSerial.querySerials(this.getContext(tenantId, req), query);
  }

  @Get('serials/history/:serialNo')
  @Roles('admin', 'Stock Manager', 'user')
  async getSerialHistory(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('serialNo') serialNo: string,
  ) {
    return this.batchSerial.getSerialHistory(this.getContext(tenantId, req), serialNo);
  }

  @Put('serials/:id')
  @Roles('admin', 'Stock Manager')
  async updateSerial(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateSerialDto,
  ) {
    return this.batchSerial.updateSerial(this.getContext(tenantId, req), id, dto);
  }

  // ==========================================
  // Warehouses
  // ==========================================

  @Get('warehouses')
  @Roles('admin', 'Stock Manager', 'user')
  async listWarehouses(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.warehouseService.listWarehouses(this.getContext(tenantId, req));
  }

  @Get('warehouses/:id')
  @Roles('admin', 'Stock Manager', 'user')
  async getWarehouse(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.warehouseService.getWarehouse(this.getContext(tenantId, req), id);
  }

  @Post('warehouses')
  @Roles('admin', 'Stock Manager')
  async createWarehouse(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.warehouseService.createWarehouse(this.getContext(tenantId, req), dto);
  }

  @Put('warehouses/:id')
  @Roles('admin', 'Stock Manager')
  async updateWarehouse(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouseService.updateWarehouse(this.getContext(tenantId, req), id, dto);
  }

  @Delete('warehouses/:id')
  @Roles('admin', 'Stock Manager')
  async deleteWarehouse(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.warehouseService.deleteWarehouse(this.getContext(tenantId, req), id);
  }

  // ==========================================
  // Locations
  // ==========================================

  @Post('warehouses/:warehouseId/locations')
  @Roles('admin', 'Stock Manager')
  async createLocation(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('warehouseId') warehouseId: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.warehouseService.createLocation(this.getContext(tenantId, req), warehouseId, dto);
  }

  @Put('locations/:id')
  @Roles('admin', 'Stock Manager')
  async updateLocation(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.warehouseService.updateLocation(this.getContext(tenantId, req), id, dto);
  }

  @Delete('locations/:id')
  @Roles('admin', 'Stock Manager')
  async deleteLocation(
    @Tenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.warehouseService.deleteLocation(this.getContext(tenantId, req), id);
  }
}
