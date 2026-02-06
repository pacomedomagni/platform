import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { StockMovementService } from './stock-movement.service';
import { BatchSerialService } from './batch-serial.service';
import { InventoryManagementController } from './inventory-management.controller';

@Module({
  imports: [DbModule],
  controllers: [InventoryManagementController],
  providers: [StockMovementService, BatchSerialService],
  exports: [StockMovementService, BatchSerialService],
})
export class InventoryManagementModule {}
