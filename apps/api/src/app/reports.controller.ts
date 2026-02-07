import { Controller, Get, Query, Req, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from '@platform/business-logic';

@Controller('reports')
@UseGuards(AuthGuard('jwt'))
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private ensureReportsAccess(user: any) {
    const roles: string[] = user?.roles || [];
    const allowed = new Set(['System Manager', 'Accounts Manager', 'admin']);
    if (!roles.some((role) => allowed.has(role))) {
      throw new ForbiddenException('Insufficient permissions for reports access');
    }
  }

  @Get('trial-balance')
  async trialBalance(@Req() req: any, @Query('asOfDate') asOfDate?: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureReportsAccess(req.user);
    if (!asOfDate) throw new BadRequestException('asOfDate is required');
    return this.reports.getTrialBalance(tenantId, asOfDate);
  }

  @Get('balance-sheet')
  async balanceSheet(@Req() req: any, @Query('asOfDate') asOfDate?: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureReportsAccess(req.user);
    if (!asOfDate) throw new BadRequestException('asOfDate is required');
    return this.reports.getBalanceSheet(tenantId, asOfDate);
  }

  @Get('profit-loss')
  async profitLoss(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureReportsAccess(req.user);
    if (!fromDate || !toDate) throw new BadRequestException('fromDate and toDate are required');
    return this.reports.getProfitAndLoss(tenantId, fromDate, toDate);
  }

  @Get('cash-flow')
  async cashFlow(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureReportsAccess(req.user);
    if (!fromDate || !toDate) throw new BadRequestException('fromDate and toDate are required');
    return this.reports.getCashFlow(tenantId, fromDate, toDate);
  }

  @Get('general-ledger')
  async generalLedger(
    @Req() req: any,
    @Query('account') account?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureReportsAccess(req.user);
    if (!account || !fromDate || !toDate) {
      throw new BadRequestException('account, fromDate, and toDate are required');
    }
    return this.reports.getGeneralLedger(tenantId, account, fromDate, toDate);
  }

  @Get('receivable-aging')
  async receivableAging(@Req() req: any, @Query('asOfDate') asOfDate?: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureReportsAccess(req.user);
    if (!asOfDate) throw new BadRequestException('asOfDate is required');
    return this.reports.getReceivableAging(tenantId, asOfDate);
  }

  @Get('payable-aging')
  async payableAging(@Req() req: any, @Query('asOfDate') asOfDate?: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureReportsAccess(req.user);
    if (!asOfDate) throw new BadRequestException('asOfDate is required');
    return this.reports.getPayableAging(tenantId, asOfDate);
  }
}
