import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { BankReconciliationService } from './bank-reconciliation.service';

@Controller('accounting/bank-reconciliation')
@UseGuards(StoreAdminGuard)
export class BankReconciliationController {
  constructor(private readonly bankReconciliationService: BankReconciliationService) {}

  /**
   * Import bank transactions from CSV
   * POST /api/v1/accounting/bank-reconciliation/import
   */
  @Post('import')
  async importTransactions(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { bankAccount: string; csvContent: string },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.bankReconciliationService.importBankTransactions(
      tenantId,
      body.bankAccount,
      body.csvContent,
    );
  }

  /**
   * Auto-match transactions
   * POST /api/v1/accounting/bank-reconciliation/auto-match
   */
  @Post('auto-match')
  async autoMatch(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { bankAccount: string },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.bankReconciliationService.autoMatch(tenantId, body.bankAccount);
  }

  /**
   * Manual match transaction
   * POST /api/v1/accounting/bank-reconciliation/manual-match/:transactionId
   */
  @Post('manual-match/:transactionId')
  async manualMatch(
    @Headers('x-tenant-id') tenantId: string,
    @Param('transactionId') transactionId: string,
    @Body() body: { invoiceId?: string; paymentEntryId?: string },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.bankReconciliationService.manualMatch(tenantId, transactionId, body);
  }

  /**
   * Create reconciliation
   * POST /api/v1/accounting/bank-reconciliation
   */
  @Post()
  async createReconciliation(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      name: string;
      bankAccount: string;
      fromDate: string;
      toDate: string;
      bankStatementBalance: number;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.bankReconciliationService.createReconciliation(tenantId, body);
  }

  /**
   * Get unreconciled transactions
   * GET /api/v1/accounting/bank-reconciliation/unreconciled
   */
  @Get('unreconciled')
  async getUnreconciledTransactions(
    @Headers('x-tenant-id') tenantId: string,
    @Query('bankAccount') bankAccount?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.bankReconciliationService.getUnreconciledTransactions(tenantId, bankAccount);
  }

  /**
   * List reconciliations
   * GET /api/v1/accounting/bank-reconciliation
   */
  @Get()
  async listReconciliations(
    @Headers('x-tenant-id') tenantId: string,
    @Query('bankAccount') bankAccount?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.bankReconciliationService.listReconciliations(tenantId, {
      bankAccount,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Get reconciliation by ID
   * GET /api/v1/accounting/bank-reconciliation/:id
   */
  @Get(':id')
  async getReconciliation(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.bankReconciliationService.getReconciliation(tenantId, id);
  }
}
