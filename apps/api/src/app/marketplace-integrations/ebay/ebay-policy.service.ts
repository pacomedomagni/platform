import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type eBayApi from 'ebay-api';
import { EbayClientService } from './ebay-client.service';
import { EbayFulfillmentPolicy } from './ebay.types';

export interface ShippingServiceOverride {
  serviceCode: string;
  cost: number;
  additionalCost?: number;
  freeShipping?: boolean;
  priority?: number;
}

export interface FulfillmentPolicyOverride {
  handlingTimeDays?: number;
  shippingCostType?: string;
  shippingServices?: ShippingServiceOverride[];
}

/**
 * Lazy-clone helper for eBay business policies.
 *
 * The seller's eBay account holds a small set of "saved" policies they manage
 * in Seller Hub. Per-listing overrides (handling time, shipping services,
 * cost type) cannot be expressed on the offer payload — they live on the
 * fulfillment policy. To apply them without mutating the seller's saved
 * policies, we look up or lazily create a derivative policy whose shape
 * matches the requested override, named like
 *   "<base name> [override:<hash>]"
 * and reuse it for any future listing requesting the same override set.
 */
@Injectable()
export class EbayPolicyService {
  private readonly logger = new Logger(EbayPolicyService.name);

  constructor(private ebayClient: EbayClientService) {}

  /**
   * Returns a fulfillment policy ID that matches the requested override.
   * If no override is requested, returns the base ID unchanged.
   */
  async ensureFulfillmentPolicyMatching(
    client: eBayApi,
    marketplaceId: string,
    basePolicyId: string,
    override: FulfillmentPolicyOverride
  ): Promise<string> {
    const hasOverride =
      override.handlingTimeDays !== undefined ||
      override.shippingCostType !== undefined ||
      (override.shippingServices && override.shippingServices.length > 0);
    if (!hasOverride) return basePolicyId;

    const base = await this.ebayClient.getFulfillmentPolicy(client, basePolicyId);
    const overrideHash = this.hashOverride(override);
    // Include the basePolicyId in the derived name so two distinct base
    // policies that happen to share an override fingerprint can never alias
    // to the same clone name. Without this, "Standard policy [ovr:abcd]" and
    // "Heavy-item policy [ovr:abcd]" would collide when both shared a
    // base name suffix.
    const derivedName = this.deriveName(
      base.name || 'Policy',
      basePolicyId,
      overrideHash
    );

    // If a derivative with this name already exists, reuse it.
    const existing = await this.ebayClient.getFulfillmentPolicies(client, marketplaceId);
    const match = existing.find((p) => p.name === derivedName);
    if (match?.fulfillmentPolicyId) {
      return match.fulfillmentPolicyId;
    }

    const body = this.buildPolicyBody(base, override, marketplaceId, derivedName);
    const created = await this.ebayClient.createFulfillmentPolicy(client, body);
    if (!created.fulfillmentPolicyId) {
      throw new Error('eBay createFulfillmentPolicy returned no fulfillmentPolicyId');
    }
    this.logger.log(
      `Cloned fulfillment policy ${basePolicyId} → ${created.fulfillmentPolicyId} (${derivedName})`
    );
    return created.fulfillmentPolicyId;
  }

  private hashOverride(override: FulfillmentPolicyOverride): string {
    const canonical = JSON.stringify({
      h: override.handlingTimeDays ?? null,
      c: override.shippingCostType ?? null,
      s: (override.shippingServices || [])
        .map((s) => ({
          c: s.serviceCode,
          $: s.cost,
          a: s.additionalCost ?? 0,
          f: !!s.freeShipping,
          p: s.priority ?? 0,
        }))
        .sort((a, b) => a.c.localeCompare(b.c)),
    });
    return createHash('sha1').update(canonical).digest('hex').slice(0, 8);
  }

  private deriveName(baseName: string, basePolicyId: string, hash: string): string {
    // eBay policy name max length is 64; build a tag that fully identifies
    // the parent policy and the override fingerprint, then truncate the
    // human-readable prefix to fit. Use the first 6 chars of the policyId
    // (eBay policy IDs are numeric strings in the 10–13 digit range, so 6
    // is plenty to disambiguate within a single seller account while
    // keeping the tag compact).
    const idSlice = String(basePolicyId).slice(-6);
    const tag = ` [ovr:${idSlice}:${hash}]`;
    const room = 64 - tag.length;
    const trimmedBase = baseName.length > room ? baseName.slice(0, room) : baseName;
    return `${trimmedBase}${tag}`;
  }

  /**
   * Build a FulfillmentPolicy create-request body that mirrors the base
   * policy but applies the listing-level overrides.
   */
  private buildPolicyBody(
    base: EbayFulfillmentPolicy,
    override: FulfillmentPolicyOverride,
    marketplaceId: string,
    name: string
  ): Record<string, unknown> {
    const handlingTime =
      override.handlingTimeDays !== undefined
        ? { value: override.handlingTimeDays, unit: 'DAY' }
        : base.handlingTime;

    const shippingOptions = this.buildShippingOptions(base, override);

    // categoryTypes.default is a multi-policy default-flag and must NOT be
    // sent when only one categoryTypes entry is supplied — eBay validates
    // and rejects the request otherwise.
    // See https://developer.ebay.com/api-docs/sell/account/types/api:CategoryType
    return {
      name,
      marketplaceId,
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      handlingTime,
      shippingOptions,
    };
  }

  private buildShippingOptions(
    base: EbayFulfillmentPolicy,
    override: FulfillmentPolicyOverride
  ): unknown[] {
    const baseDomestic = (base.shippingOptions || []).find((o) => o.optionType === 'DOMESTIC');
    const baseInternational = (base.shippingOptions || []).filter(
      (o) => o.optionType === 'INTERNATIONAL'
    );

    const costType = override.shippingCostType || baseDomestic?.costType || 'FLAT_RATE';

    let services = baseDomestic?.shippingServices || [];
    if (override.shippingServices && override.shippingServices.length > 0) {
      services = override.shippingServices.map((s, idx) => ({
        sortOrder: s.priority ?? idx + 1,
        shippingServiceCode: s.serviceCode,
        shippingCost: s.freeShipping
          ? { value: '0.00', currency: this.currencyForMarketplace(base.marketplaceId) }
          : { value: s.cost.toFixed(2), currency: this.currencyForMarketplace(base.marketplaceId) },
        additionalShippingCost: {
          value: (s.additionalCost ?? 0).toFixed(2),
          currency: this.currencyForMarketplace(base.marketplaceId),
        },
        freeShipping: !!s.freeShipping,
      }));
    }

    const domestic = {
      optionType: 'DOMESTIC',
      costType,
      shippingServices: services,
    };

    return [domestic, ...baseInternational];
  }

  private currencyForMarketplace(marketplaceId: string | undefined): string {
    switch (marketplaceId) {
      case 'EBAY_GB':
      case 'EBAY_UK':
        return 'GBP';
      case 'EBAY_DE':
      case 'EBAY_FR':
      case 'EBAY_IT':
      case 'EBAY_ES':
        return 'EUR';
      case 'EBAY_CA':
        return 'CAD';
      case 'EBAY_AU':
        return 'AUD';
      default:
        return 'USD';
    }
  }
}
