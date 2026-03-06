import { Injectable, Logger } from '@nestjs/common';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';

/**
 * eBay Analytics Service
 * Provides traffic reports, seller performance standards, customer service
 * metrics, and listing recommendations via the eBay Analytics & Recommendation APIs.
 */
@Injectable()
export class EbayAnalyticsService {
  private readonly logger = new Logger(EbayAnalyticsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService
  ) {}

  /**
   * Get traffic report for the seller's listings within a date range.
   * Returns impressions, views, click-through rate, conversion rate, and transactions
   * aggregated by the specified dimension (default: DAY).
   */
  async getTrafficReport(
    connectionId: string,
    dateRange: { startDate: string; endDate: string },
    dimension?: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock traffic report for connection ${connectionId}`);
      return this.getMockTrafficReport(dateRange);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await client.sell.analytics.getTrafficReport({
        dimension: dimension || 'DAY',
        filter: `date_range:[${dateRange.startDate}..${dateRange.endDate}]`,
        metric:
          'LISTING_IMPRESSION_TOTAL,LISTING_VIEWS_TOTAL,CLICK_THROUGH_RATE,SALES_CONVERSION_RATE,TRANSACTION',
      });

      this.logger.log(`Fetched traffic report for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch traffic report for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get seller standards profiles (TOP_RATED, ABOVE_STANDARD, BELOW_STANDARD).
   * Returns seller level and evaluation cycle information.
   */
  async getSellerStandards(connectionId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock seller standards for connection ${connectionId}`);
      return this.getMockSellerStandards();
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await client.sell.analytics.findSellerStandardsProfiles();

      this.logger.log(`Fetched seller standards for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch seller standards for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get customer service metrics (e.g. ITEM_NOT_AS_DESCRIBED).
   * Supports CURRENT or PROJECTED evaluation types.
   */
  async getCustomerServiceMetrics(
    connectionId: string,
    evaluationType?: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock customer service metrics for connection ${connectionId}`
      );
      return this.getMockCustomerServiceMetrics();
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client as any).sell.analytics.getCustomerServiceMetric(
        'ITEM_NOT_AS_DESCRIBED',
        evaluationType || 'CURRENT'
      );

      this.logger.log(`Fetched customer service metrics for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch customer service metrics for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get listing optimization recommendations from the eBay Recommendation API.
   * Optionally filter by specific listing IDs.
   */
  async getRecommendations(
    connectionId: string,
    listingIds?: string[]
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock recommendations for connection ${connectionId}`
      );
      return this.getMockRecommendations();
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body = listingIds ? { listingIds } : {};
      const response = await client.sell.recommendation.findListingRecommendations(body as any);

      this.logger.log(`Fetched listing recommendations for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch listing recommendations for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Mock data generators
  // ---------------------------------------------------------------------------

  private getMockTrafficReport(dateRange: { startDate: string; endDate: string }): any {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const records: any[] = [];

    const current = new Date(start);
    while (current <= end) {
      records.push({
        date: current.toISOString().split('T')[0],
        listingImpressionTotal: Math.floor(Math.random() * 500) + 100,
        listingViewsTotal: Math.floor(Math.random() * 200) + 50,
        clickThroughRate: parseFloat((Math.random() * 5 + 1).toFixed(2)),
        salesConversionRate: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
        transaction: Math.floor(Math.random() * 20),
      });
      current.setDate(current.getDate() + 1);
    }

    return {
      dimensionMetadata: [
        { dimensionKey: 'DAY', dataType: 'DATE' },
      ],
      records,
      header: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    };
  }

  private getMockSellerStandards(): any {
    return {
      standardsProfiles: [
        {
          cycle: {
            cycleType: 'CURRENT',
            evaluationDate: new Date().toISOString(),
            evaluationMonth: new Date().toISOString().substring(0, 7),
          },
          defaultProgram: true,
          programType: 'PROGRAM_DE',
          standardsLevel: 'TOP_RATED',
          metrics: [
            {
              metricKey: 'TRANSACTION_DEFECT_RATE',
              level: 'TOP_RATED',
              value: '0.2',
              lookbackStartDate: new Date(Date.now() - 90 * 86400000).toISOString(),
              lookbackEndDate: new Date().toISOString(),
            },
            {
              metricKey: 'LATE_SHIPMENT_RATE',
              level: 'TOP_RATED',
              value: '1.0',
              lookbackStartDate: new Date(Date.now() - 90 * 86400000).toISOString(),
              lookbackEndDate: new Date().toISOString(),
            },
            {
              metricKey: 'CASES_CLOSED_WITHOUT_SELLER_RESOLUTION',
              level: 'TOP_RATED',
              value: '0.0',
              lookbackStartDate: new Date(Date.now() - 12 * 30 * 86400000).toISOString(),
              lookbackEndDate: new Date().toISOString(),
            },
          ],
        },
      ],
    };
  }

  private getMockCustomerServiceMetrics(): any {
    return {
      evaluationCycle: {
        evaluationType: 'CURRENT',
        startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
        endDate: new Date().toISOString(),
      },
      customerServiceMetricType: 'ITEM_NOT_AS_DESCRIBED',
      metricDistributions: [
        {
          metricKey: 'ITEM_NOT_AS_DESCRIBED_RATE',
          expectedBaseline: '0.50',
          value: '0.15',
          basis: {
            totalCount: 200,
            issueCount: 3,
          },
        },
      ],
    };
  }

  private getMockRecommendations(): any {
    return {
      listingRecommendations: [
        {
          listingId: 'mock_listing_001',
          marketing: {
            ad: {
              bidPercentages: [
                { basis: 'TRENDING', value: '5.0' },
              ],
            },
            promotionalPricing: null,
          },
          recommendations: [
            {
              type: 'LISTING_QUALITY',
              message: 'Add more item specifics to improve visibility.',
              value: {
                name: 'Brand',
                value: 'Add brand name for better search ranking.',
              },
            },
            {
              type: 'LISTING_QUALITY',
              message: 'Use a higher-resolution main image.',
              value: {
                name: 'Image',
                value: 'Recommended minimum 1600x1600 pixels.',
              },
            },
          ],
        },
        {
          listingId: 'mock_listing_002',
          recommendations: [
            {
              type: 'PRICING',
              message: 'Your price is above the average for similar items.',
              value: {
                name: 'CompetitivePrice',
                value: 'Consider pricing at $24.99 to match market trends.',
              },
            },
          ],
        },
      ],
    };
  }
}
