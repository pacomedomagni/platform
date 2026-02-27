import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { StoreAdminGuard } from '@platform/auth';
import { AdminCustomersService } from './admin-customers.service';

/**
 * DTO for admin customer updates (H-4).
 */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

/**
 * DTO for admin customer notes update (M-2).
 */
export class UpdateCustomerNotesDto {
  @IsString()
  @MaxLength(5000)
  notes: string;
}

@Controller('store/admin/customers')
@UseGuards(StoreAdminGuard)
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  /**
   * List all customers (admin)
   * GET /api/v1/store/admin/customers
   */
  @Get()
  async listCustomers(
    @Headers('x-tenant-id') tenantId: string,
    @Query('search') search?: string,
    @Query('segment') segment?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.listCustomers(tenantId, {
      search,
      segment,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Get single customer detail (admin)
   * GET /api/v1/store/admin/customers/:id
   */
  @Get(':id')
  async getCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') customerId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.getCustomer(tenantId, customerId);
  }

  /**
   * Get customer's orders (admin)
   * GET /api/v1/store/admin/customers/:id/orders
   */
  @Get(':id/orders')
  async getCustomerOrders(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') customerId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.getCustomerOrders(tenantId, customerId);
  }

  /**
   * Update customer info (admin)
   * PUT /api/v1/store/admin/customers/:id
   */
  @Put(':id')
  async updateCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') customerId: string,
    @Body() body: UpdateCustomerDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.updateCustomer(tenantId, customerId, body);
  }

  /**
   * Update customer notes (admin)
   * PUT /api/v1/store/admin/customers/:id/notes
   */
  @Put(':id/notes')
  async updateCustomerNotes(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') customerId: string,
    @Body() body: UpdateCustomerNotesDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.updateCustomerNotes(tenantId, customerId, body.notes);
  }
}
