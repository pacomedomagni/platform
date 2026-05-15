import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay post-OAuth onboarding orchestration (H1 + M-T7).
 *
 * After a seller completes OAuth, several setup steps are required before
 * they can publish listings. eBay does not stitch these together for us —
 * each is a separate API call — and most silently no-op in surprising ways
 * for sellers who haven't pre-configured their account.
 *
 * Sequence:
 *   1. opt-in SELLING_POLICY_MANAGEMENT  (required before Account API will
 *      return or accept business policies)
 *   2. opt-in OUT_OF_STOCK_CONTROL       (keeps zero-qty listings live)
 *   3. getPrivileges                     (detects "first manual listing
 *      required" trap for new sellers)
 *   4. fetchAndSaveBusinessPolicies      (cache the seller's policy IDs
 *      AFTER opt-in so we don't miss freshly-created defaults)
 *
 * Each step is independent and best-effort. A per-step failure is recorded
 * in `platformConfig.setupErrors` so the UI can surface remediation; it
 * does not block the OAuth callback.
 */
@Injectable()
export class EbayOnboardingService {
  private readonly logger = new Logger(EbayOnboardingService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private ebayStore: EbayStoreService,
  ) {}

  private get apiBaseUrl(): string {
    const isSandbox = process.env['EBAY_SANDBOX'] === 'true';
    return isSandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
  }

  /**
   * Run the full post-OAuth setup sequence. Caller must already be inside
   * runWithTenant. Returns a structured report; we also write a snapshot
   * to platformConfig so the connection-status endpoint can surface it.
   */
  async runPostOAuthSetup(
    connectionId: string,
    tenantId: string,
    accessToken: string,
  ): Promise<{
    optedIn: { policyManagement: boolean; outOfStockControl: boolean };
    privileges: any | null;
    requiresManualFirstListing: boolean;
    setupErrors: string[];
  }> {
    const setupErrors: string[] = [];
    const optedIn = {
      policyManagement: false,
      outOfStockControl: false,
    };

    // Step 1: opt-in SELLING_POLICY_MANAGEMENT.
    try {
      await this.optInProgram(accessToken, 'SELLING_POLICY_MANAGEMENT');
      optedIn.policyManagement = true;
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      if (this.isAlreadyOptedIn(msg)) {
        optedIn.policyManagement = true;
      } else {
        this.logger.warn(
          `SELLING_POLICY_MANAGEMENT opt-in failed for ${connectionId}: ${msg}`,
        );
        setupErrors.push(`policy-management-opt-in: ${msg}`);
      }
    }

    // Step 2: opt-in OUT_OF_STOCK_CONTROL.
    try {
      await this.optInProgram(accessToken, 'OUT_OF_STOCK_CONTROL');
      optedIn.outOfStockControl = true;
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      if (this.isAlreadyOptedIn(msg)) {
        optedIn.outOfStockControl = true;
      } else {
        this.logger.warn(
          `OUT_OF_STOCK_CONTROL opt-in failed for ${connectionId}: ${msg}`,
        );
        setupErrors.push(`out-of-stock-opt-in: ${msg}`);
      }
    }

    // Step 3: privileges check (detects first-listing trap + selling limit).
    let privileges: any = null;
    let requiresManualFirstListing = false;
    try {
      privileges = await this.fetchPrivileges(accessToken);
      if (this.looksLikeFirstListingTrap(privileges)) {
        requiresManualFirstListing = true;
        setupErrors.push(
          'first-manual-listing-required: eBay requires this seller to complete one listing manually on ebay.com before API publishes are allowed',
        );
      }
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      this.logger.warn(`Privileges fetch failed for ${connectionId}: ${msg}`);
      setupErrors.push(`privileges-fetch: ${msg}`);
    }

    // Step 4: cache business policies AFTER opt-in.
    try {
      await this.ebayStore.fetchAndSaveBusinessPolicies(connectionId, tenantId);
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      this.logger.warn(
        `Business-policy fetch failed for ${connectionId}: ${msg}`,
      );
      setupErrors.push(`business-policies: ${msg}`);
    }

    await this.persistSetupReport(connectionId, {
      optedIn,
      privileges,
      requiresManualFirstListing,
      setupErrors,
    });

    if (setupErrors.length === 0) {
      this.logger.log(`Post-OAuth setup complete for connection ${connectionId}`);
    } else {
      this.logger.warn(
        `Post-OAuth setup completed with ${setupErrors.length} issue(s) for ${connectionId}`,
      );
    }

    return { optedIn, privileges, requiresManualFirstListing, setupErrors };
  }

  /**
   * POST /sell/account/v1/program/opt_in — idempotent; eBay returns
   * 409 / error 20407 when already opted in (we treat as success).
   */
  private async optInProgram(
    accessToken: string,
    programType: 'SELLING_POLICY_MANAGEMENT' | 'OUT_OF_STOCK_CONTROL' | 'PARTNER_MOTORS_DEALER',
  ): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] opt-in ${programType}`);
      return;
    }
    const response = await fetch(
      `${this.apiBaseUrl}/sell/account/v1/program/opt_in`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US',
        },
        body: JSON.stringify({ programType }),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '<no body>');
      throw new Error(`opt_in(${programType}) -> ${response.status} ${text}`);
    }
  }

  /**
   * GET /sell/account/v1/privilege — selling limits + registration status.
   * The combination of `sellerRegistrationCompleted=false` (or zero limits)
   * is the canonical "must list manually first" signal.
   */
  private async fetchPrivileges(accessToken: string): Promise<any> {
    if (this.mockMode) {
      return {
        sellerRegistrationCompleted: true,
        sellingLimit: { quantity: 10, amount: { value: '500.00', currency: 'USD' } },
      };
    }
    const response = await fetch(
      `${this.apiBaseUrl}/sell/account/v1/privilege`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '<no body>');
      throw new Error(`getPrivileges -> ${response.status} ${text}`);
    }
    return response.json();
  }

  private looksLikeFirstListingTrap(p: any): boolean {
    if (!p) return false;
    if (p.sellerRegistrationCompleted === false) return true;
    const qty = Number(p?.sellingLimit?.quantity ?? 0);
    const amount = Number(p?.sellingLimit?.amount?.value ?? 0);
    return qty === 0 && amount === 0;
  }

  private isAlreadyOptedIn(message: string): boolean {
    return /20403|20407/.test(message) || /already opted[\s-]?in/i.test(message);
  }

  private async persistSetupReport(
    connectionId: string,
    report: {
      optedIn: { policyManagement: boolean; outOfStockControl: boolean };
      privileges: any;
      requiresManualFirstListing: boolean;
      setupErrors: string[];
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.marketplaceConnection.findUniqueOrThrow({
        where: { id: connectionId },
        select: { platformConfig: true },
      });
      const merged = {
        ...((current.platformConfig as Record<string, unknown>) ?? {}),
        optedIn: report.optedIn,
        privileges: report.privileges,
        requiresManualFirstListing: report.requiresManualFirstListing,
        setupErrors: report.setupErrors,
        setupCompletedAt: new Date().toISOString(),
      };
      await tx.marketplaceConnection.update({
        where: { id: connectionId },
        data: { platformConfig: merged as Prisma.InputJsonValue },
      });
    });
  }
}
