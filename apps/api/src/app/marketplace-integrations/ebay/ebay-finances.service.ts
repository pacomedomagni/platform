import { Injectable, Logger } from '@nestjs/common';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';

/**
 * eBay Finances Service
 * Provides access to payouts, transactions, summaries, and seller funds
 * via the eBay Finances API.
 */
@Injectable()
export class EbayFinancesService {
  private readonly logger = new Logger(EbayFinancesService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService
  ) {}

  /**
   * Get a paginated list of seller payouts.
   * Supports filtering, pagination, and sorting.
   */
  async getPayouts(
    connectionId: string,
    params: {
      filter?: string;
      limit?: number;
      offset?: number;
      sort?: string;
    }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock payouts for connection ${connectionId}`);
      return this.getMockPayouts(params);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await client.sell.finances.getPayouts(params as any);

      this.logger.log(`Fetched payouts for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch payouts for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a summary of seller payouts.
   * Optionally filtered by date range or payout status.
   */
  async getPayoutSummary(connectionId: string, filter?: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock payout summary for connection ${connectionId}`);
      return this.getMockPayoutSummary();
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await client.sell.finances.getPayoutSummary({ filter });

      this.logger.log(`Fetched payout summary for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch payout summary for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a paginated list of seller transactions.
   * Supports filtering, pagination, and sorting.
   */
  async getTransactions(
    connectionId: string,
    params: {
      filter?: string;
      limit?: number;
      offset?: number;
      sort?: string;
    }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock transactions for connection ${connectionId}`);
      return this.getMockTransactions(params);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await client.sell.finances.getTransactions(params as any);

      this.logger.log(`Fetched transactions for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch transactions for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a summary of seller transactions.
   * Optionally filtered by date range or transaction type.
   */
  async getTransactionSummary(connectionId: string, filter?: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock transaction summary for connection ${connectionId}`
      );
      return this.getMockTransactionSummary();
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await client.sell.finances.getTransactionSummary({ filter });

      this.logger.log(`Fetched transaction summary for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch transaction summary for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get the seller's current funds summary, including available, processing,
   * and on-hold balances.
   */
  async getSellerFundsSummary(connectionId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock seller funds summary for connection ${connectionId}`
      );
      return this.getMockSellerFundsSummary();
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await client.sell.finances.getSellerFundsSummary();

      this.logger.log(`Fetched seller funds summary for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch seller funds summary for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Mock data generators
  // ---------------------------------------------------------------------------

  private getMockPayouts(params: { limit?: number; offset?: number }): any {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const total = 5;

    const payouts = [
      {
        payoutId: 'mock_payout_001',
        payoutStatus: 'SUCCEEDED',
        payoutStatusDescription: 'Payout completed',
        amount: { value: '1250.00', currency: 'USD' },
        payoutDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        payoutInstrument: {
          instrumentType: 'BANK',
          nickname: 'Checking ****1234',
        },
        transactionCount: 15,
      },
      {
        payoutId: 'mock_payout_002',
        payoutStatus: 'SUCCEEDED',
        payoutStatusDescription: 'Payout completed',
        amount: { value: '890.50', currency: 'USD' },
        payoutDate: new Date(Date.now() - 9 * 86400000).toISOString(),
        payoutInstrument: {
          instrumentType: 'BANK',
          nickname: 'Checking ****1234',
        },
        transactionCount: 8,
      },
      {
        payoutId: 'mock_payout_003',
        payoutStatus: 'INITIATED',
        payoutStatusDescription: 'Payout initiated',
        amount: { value: '430.25', currency: 'USD' },
        payoutDate: new Date().toISOString(),
        payoutInstrument: {
          instrumentType: 'BANK',
          nickname: 'Checking ****1234',
        },
        transactionCount: 5,
      },
      {
        payoutId: 'mock_payout_004',
        payoutStatus: 'SUCCEEDED',
        payoutStatusDescription: 'Payout completed',
        amount: { value: '2100.00', currency: 'USD' },
        payoutDate: new Date(Date.now() - 16 * 86400000).toISOString(),
        payoutInstrument: {
          instrumentType: 'BANK',
          nickname: 'Checking ****1234',
        },
        transactionCount: 22,
      },
      {
        payoutId: 'mock_payout_005',
        payoutStatus: 'SUCCEEDED',
        payoutStatusDescription: 'Payout completed',
        amount: { value: '675.80', currency: 'USD' },
        payoutDate: new Date(Date.now() - 23 * 86400000).toISOString(),
        payoutInstrument: {
          instrumentType: 'BANK',
          nickname: 'Checking ****1234',
        },
        transactionCount: 10,
      },
    ];

    return {
      payouts: payouts.slice(offset, offset + limit),
      total,
      limit,
      offset,
    };
  }

  private getMockPayoutSummary(): any {
    return {
      payoutSummary: {
        totalSucceeded: { value: '4916.30', currency: 'USD' },
        totalInitiated: { value: '430.25', currency: 'USD' },
        totalFailed: { value: '0.00', currency: 'USD' },
        payoutCount: 5,
      },
    };
  }

  private getMockTransactions(params: { limit?: number; offset?: number }): any {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const total = 4;

    const transactions = [
      {
        transactionId: 'mock_txn_001',
        transactionType: 'SALE',
        transactionStatus: 'FUNDS_AVAILABLE_FOR_PAYOUT',
        amount: { value: '89.99', currency: 'USD' },
        totalFeeBasisAmount: { value: '89.99', currency: 'USD' },
        totalFeeAmount: { value: '-11.70', currency: 'USD' },
        netAmount: { value: '78.29', currency: 'USD' },
        transactionDate: new Date(Date.now() - 86400000).toISOString(),
        orderId: 'mock_order_001',
        orderLineItems: [
          {
            lineItemId: 'mock_li_001',
            title: 'Vintage Watch - Excellent Condition',
            quantity: 1,
            lineItemAmount: { value: '89.99', currency: 'USD' },
          },
        ],
        buyer: { username: 'mock_buyer_jane' },
        payoutId: 'mock_payout_003',
      },
      {
        transactionId: 'mock_txn_002',
        transactionType: 'SALE',
        transactionStatus: 'PAYOUT',
        amount: { value: '45.00', currency: 'USD' },
        totalFeeBasisAmount: { value: '45.00', currency: 'USD' },
        totalFeeAmount: { value: '-5.85', currency: 'USD' },
        netAmount: { value: '39.15', currency: 'USD' },
        transactionDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        orderId: 'mock_order_002',
        orderLineItems: [
          {
            lineItemId: 'mock_li_002',
            title: 'Collectible Card Set',
            quantity: 1,
            lineItemAmount: { value: '45.00', currency: 'USD' },
          },
        ],
        buyer: { username: 'mock_buyer_john' },
        payoutId: 'mock_payout_001',
      },
      {
        transactionId: 'mock_txn_003',
        transactionType: 'REFUND',
        transactionStatus: 'PAYOUT',
        amount: { value: '-29.99', currency: 'USD' },
        totalFeeBasisAmount: { value: '0.00', currency: 'USD' },
        totalFeeAmount: { value: '3.90', currency: 'USD' },
        netAmount: { value: '-26.09', currency: 'USD' },
        transactionDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        orderId: 'mock_order_003',
        buyer: { username: 'mock_buyer_alice' },
        payoutId: 'mock_payout_001',
      },
      {
        transactionId: 'mock_txn_004',
        transactionType: 'SHIPPING_LABEL',
        transactionStatus: 'PAYOUT',
        amount: { value: '-7.50', currency: 'USD' },
        totalFeeBasisAmount: { value: '0.00', currency: 'USD' },
        totalFeeAmount: { value: '0.00', currency: 'USD' },
        netAmount: { value: '-7.50', currency: 'USD' },
        transactionDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        orderId: 'mock_order_001',
        buyer: { username: 'mock_buyer_jane' },
        payoutId: 'mock_payout_001',
      },
    ];

    return {
      transactions: transactions.slice(offset, offset + limit),
      total,
      limit,
      offset,
    };
  }

  private getMockTransactionSummary(): any {
    return {
      transactionSummary: {
        totalSales: { value: '134.99', currency: 'USD' },
        totalRefunds: { value: '-29.99', currency: 'USD' },
        totalFees: { value: '-13.65', currency: 'USD' },
        totalShippingLabels: { value: '-7.50', currency: 'USD' },
        netAmount: { value: '83.85', currency: 'USD' },
        creditCount: 2,
        debitCount: 2,
        totalCreditAmount: { value: '134.99', currency: 'USD' },
        totalDebitAmount: { value: '-51.14', currency: 'USD' },
      },
    };
  }

  private getMockSellerFundsSummary(): any {
    return {
      availableFunds: { value: '430.25', currency: 'USD' },
      processingFunds: { value: '89.99', currency: 'USD' },
      fundsOnHold: { value: '0.00', currency: 'USD' },
      totalFunds: { value: '520.24', currency: 'USD' },
    };
  }
}
