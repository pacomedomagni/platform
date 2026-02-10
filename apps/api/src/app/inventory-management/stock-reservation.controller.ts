import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { StockReservationService } from './stock-reservation.service';

@Controller('inventory/reservations')
@UseGuards(StoreAdminGuard)
export class StockReservationController {
  constructor(private readonly reservationService: StockReservationService) {}

  /**
   * Reserve stock manually
   * POST /api/v1/inventory/reservations/reserve
   */
  @Post('reserve')
  async reserveStock(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      itemCode: string;
      quantity: number;
      warehouseCode?: string;
      reference?: string;
      notes?: string;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reservationService.reserveStock(tenantId, body);
  }

  /**
   * Release reserved stock
   * POST /api/v1/inventory/reservations/release
   */
  @Post('release')
  async releaseStock(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      itemCode: string;
      quantity: number;
      warehouseCode?: string;
      reference?: string;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reservationService.releaseStock(tenantId, body);
  }

  /**
   * Get reserved stock summary
   * GET /api/v1/inventory/reservations
   */
  @Get()
  async getReservedStock(
    @Headers('x-tenant-id') tenantId: string,
    @Query('itemCode') itemCode?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reservationService.getReservedStock(tenantId, itemCode);
  }

  /**
   * Get reservations for a specific order
   * GET /api/v1/inventory/reservations/orders/:orderId
   */
  @Get('orders/:orderId')
  async getOrderReservations(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reservationService.getOrderReservations(tenantId, orderId);
  }
}
