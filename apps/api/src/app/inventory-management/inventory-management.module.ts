import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { StockMovementService } from './stock-movement.service';
import { BatchSerialService } from './batch-serial.service';
import { StockReservationService } from './stock-reservation.service';
import { InventoryManagementController } from './inventory-management.controller';
import { StockReservationController } from './stock-reservation.controller';

@Module({
  imports: [DbModule],
  controllers: [InventoryManagementController, StockReservationController],
  providers: [StockMovementService, BatchSerialService, StockReservationService],
  exports: [StockMovementService, BatchSerialService, StockReservationService],
})
export class InventoryManagementModule {}
