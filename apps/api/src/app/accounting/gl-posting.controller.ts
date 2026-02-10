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
import { GlPostingService } from './gl-posting.service';

@Controller('accounting/gl')
@UseGuards(StoreAdminGuard)
export class GlPostingController {
  constructor(private readonly glPostingService: GlPostingService) {}

  /**
   * Post invoice to GL
   * POST /api/v1/accounting/gl/post-invoice/:invoiceId
   */
  @Post('post-invoice/:invoiceId')
  async postInvoice(
    @Headers('x-tenant-id') tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.glPostingService.postInvoice(tenantId, invoiceId);
  }

  /**
   * Post expense to GL
   * POST /api/v1/accounting/gl/post-expense/:expenseId
   */
  @Post('post-expense/:expenseId')
  async postExpense(
    @Headers('x-tenant-id') tenantId: string,
    @Param('expenseId') expenseId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.glPostingService.postExpense(tenantId, expenseId);
  }

  /**
   * Create manual journal entry
   * POST /api/v1/accounting/gl/journal-entry
   */
  @Post('journal-entry')
  async createJournalEntry(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      postingDate: string;
      voucherType: string;
      voucherNo: string;
      lines: Array<{
        accountCode: string;
        debit?: number;
        credit?: number;
        remarks?: string;
      }>;
      remarks?: string;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.glPostingService.createJournalEntry(tenantId, body);
  }

  /**
   * Get GL entries for a voucher
   * GET /api/v1/accounting/gl/voucher/:voucherType/:voucherNo
   */
  @Get('voucher/:voucherType/:voucherNo')
  async getVoucherEntries(
    @Headers('x-tenant-id') tenantId: string,
    @Param('voucherType') voucherType: string,
    @Param('voucherNo') voucherNo: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.glPostingService.getVoucherEntries(tenantId, voucherType, voucherNo);
  }

  /**
   * Get trial balance
   * GET /api/v1/accounting/gl/trial-balance
   */
  @Get('trial-balance')
  async getTrialBalance(
    @Headers('x-tenant-id') tenantId: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.glPostingService.getTrialBalance(tenantId, asOfDate);
  }

  /**
   * Auto-post all unposted paid invoices
   * POST /api/v1/accounting/gl/auto-post-invoices
   */
  @Post('auto-post-invoices')
  async autoPostInvoices(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.glPostingService.autoPostInvoices(tenantId);
  }
}
