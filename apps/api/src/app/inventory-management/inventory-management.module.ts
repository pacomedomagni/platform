import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { StockMovementService } from './stock-movement.service';
import { BatchSerialService } from './batch-serial.service';
import { WarehouseService } from './warehouse.service';
import { InventoryManagementController } from './inventory-management.controller';

@Module({
  imports: [DbModule],
  controllers: [InventoryManagementController],
  providers: [StockMovementService, BatchSerialService, WarehouseService],
  exports: [StockMovementService, BatchSerialService, WarehouseService],
})
export class InventoryManagementModule {}
