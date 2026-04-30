import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '@platform/db';
import { EbayListingsService } from './ebay-listings.service';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';
import { EbayMediaService } from './ebay-media.service';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { EbayPolicyService } from './ebay-policy.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { FailedOperationsService } from '../../workers/failed-operations.service';

/**
 * Pins the contract that publishListing's two-person rule reads
 * `options.userRoles` (a string[] of role names from the JWT user
 * object), not some other shape. Inventory Manager must NOT publish
 * a DRAFT; Admin / System Manager MUST be able to.
 *
 * If the auth pipeline ever shifts the user shape (e.g. moves roles
 * to permissions, or to a typed enum), these tests fail loudly here
 * instead of silently demoting Inventory Managers to read-only or
 * silently elevating them to publishers.
 */
describe('EbayListingsService.publishListing — role contract', () => {
  let service: EbayListingsService;
  let prismaMock: any;

  // The service short-circuits before any eBay client code when the
  // status precondition fails, so we only need to make the listing
  // lookup return a DRAFT row. The role check happens before the
  // optimistic-lock UPDATE; throwing BadRequestException with the
  // approval-required message is what we assert against.
  const draftListing = {
    id: 'listing-1',
    tenantId: 'tenant-1',
    connectionId: 'conn-1',
    sku: 'sku-1',
    status: 'draft',
    connection: { locationKey: 'loc-1' },
  };

  beforeEach(async () => {
    process.env.MOCK_EXTERNAL_SERVICES = 'true';

    prismaMock = {
      marketplaceListing: {
        findFirst: jest.fn().mockResolvedValue(draftListing),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EbayListingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('tenant-1') } },
        { provide: EbayStoreService, useValue: {} },
        { provide: EbayClientService, useValue: {} },
        { provide: EbayMediaService, useValue: {} },
        { provide: EbayTaxonomyService, useValue: {} },
        { provide: EbayPolicyService, useValue: {} },
        { provide: MarketplaceAuditService, useValue: {} },
        { provide: FailedOperationsService, useValue: { recordFailedOperation: jest.fn() } },
      ],
    }).compile();

    service = module.get<EbayListingsService>(EbayListingsService);
  });

  afterEach(() => {
    delete process.env.MOCK_EXTERNAL_SERVICES;
  });

  it('rejects DRAFT publish when caller has only Inventory Manager role', async () => {
    await expect(
      service.publishListing('listing-1', { userRoles: ['Inventory Manager'] })
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.publishListing('listing-1', { userRoles: ['Inventory Manager'] })
    ).rejects.toThrow(/Only approved listings can be published/);
  });

  it('rejects DRAFT publish when no roles supplied at all', async () => {
    await expect(
      service.publishListing('listing-1', {})
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects DRAFT publish when userRoles is empty', async () => {
    await expect(
      service.publishListing('listing-1', { userRoles: [] })
    ).rejects.toThrow(BadRequestException);
  });

  it('treats role names case-insensitively (Admin matches admin)', async () => {
    // The service lowercases incoming role names. Pass a Title-cased
    // role and verify it does NOT trip the approval guard. We expect
    // the call to advance past the role check and then fail later on
    // missing eBay client setup — but it must not throw the role
    // exception with "Only approved listings can be published".
    await expect(
      service.publishListing('listing-1', { userRoles: ['Admin'] })
    ).rejects.not.toThrow(/Only approved listings can be published/);
  });

  it('"System Manager" role with mixed casing also bypasses approval', async () => {
    await expect(
      service.publishListing('listing-1', { userRoles: ['system manager'] })
    ).rejects.not.toThrow(/Only approved listings can be published/);
    await expect(
      service.publishListing('listing-1', { userRoles: ['SYSTEM MANAGER'] })
    ).rejects.not.toThrow(/Only approved listings can be published/);
  });

  it('Inventory Manager CAN publish an APPROVED listing', async () => {
    prismaMock.marketplaceListing.findFirst.mockResolvedValueOnce({
      ...draftListing,
      status: 'approved',
    });
    // Will fail downstream on missing client/connection mocks — the
    // important assertion is that the role-status precondition does
    // NOT reject this combination.
    await expect(
      service.publishListing('listing-1', { userRoles: ['Inventory Manager'] })
    ).rejects.not.toThrow(/Only approved listings can be published/);
  });
});
