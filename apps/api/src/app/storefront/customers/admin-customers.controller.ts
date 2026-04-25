import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { StoreAdminGuard } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
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

  @Get()
  async listCustomers(
    @Tenant() tenantId: string,
    @Query('search') search?: string,
    @Query('segment') segment?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customersService.listCustomers(tenantId, {
      search,
      segment,
      page: page ? parseInt(page, 10) : undefined,
      limit: Math.min(limit ? parseInt(limit, 10) || 50 : 50, 200),
    });
  }

  @Get(':id')
  async getCustomer(@Tenant() tenantId: string, @Param('id') customerId: string) {
    return this.customersService.getCustomer(tenantId, customerId);
  }

  @Get(':id/orders')
  async getCustomerOrders(
    @Tenant() tenantId: string,
    @Param('id') customerId: string,
  ) {
    return this.customersService.getCustomerOrders(tenantId, customerId);
  }

  @Put(':id')
  async updateCustomer(
    @Tenant() tenantId: string,
    @Param('id') customerId: string,
    @Body() body: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(tenantId, customerId, body);
  }

  @Put(':id/notes')
  async updateCustomerNotes(
    @Tenant() tenantId: string,
    @Param('id') customerId: string,
    @Body() body: UpdateCustomerNotesDto,
  ) {
    return this.customersService.updateCustomerNotes(tenantId, customerId, body.notes);
  }
}
