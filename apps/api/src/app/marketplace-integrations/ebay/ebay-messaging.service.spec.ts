import { Test, TestingModule } from '@nestjs/testing';
import { EbayMessagingService } from './ebay-messaging.service';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { DistributedLockService } from '../shared/distributed-lock.service';

describe('EbayMessagingService', () => {
  let service: EbayMessagingService;
  let prismaMock: any;

  beforeEach(async () => {
    process.env.MOCK_EXTERNAL_SERVICES = 'true';
    process.env.ENABLE_SCHEDULED_TASKS = 'false';

    prismaMock = {
      marketplaceConnection: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      marketplaceSyncLog: {
        create: jest.fn().mockResolvedValue({ id: 'sync-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      marketplaceMessageThread: {
        upsert: jest.fn().mockResolvedValue({ id: 'thread-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
      marketplaceMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EbayMessagingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('tenant-1') } },
        {
          provide: EbayStoreService,
          useValue: { getClient: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: MarketplaceAuditService,
          useValue: { logMessageSent: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: DistributedLockService,
          useValue: {
            withLock: jest.fn().mockImplementation((_key, _ttl, fn) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get<EbayMessagingService>(EbayMessagingService);
  });

  afterEach(() => {
    delete process.env.MOCK_EXTERNAL_SERVICES;
    delete process.env.ENABLE_SCHEDULED_TASKS;
    service.onModuleDestroy();
  });

  describe('syncMessages', () => {
    it('should sync mock messages and create sync log', async () => {
      const result = await service.syncMessages('tenant-1', 'conn-1');
      expect(result.syncLogId).toBe('sync-1');
      expect(result.itemsTotal).toBe(3); // 3 mock messages
      expect(result.itemsSuccess).toBe(3);
      expect(result.itemsFailed).toBe(0);
    });

    it('should handle message upsert failures gracefully', async () => {
      prismaMock.marketplaceMessageThread.upsert.mockRejectedValueOnce(
        new Error('DB error')
      );

      const result = await service.syncMessages('tenant-1', 'conn-1');
      expect(result.itemsFailed).toBe(1);
      expect(result.itemsSuccess).toBe(2);
    });

    it('should create sync log with correct status on partial failure', async () => {
      prismaMock.marketplaceMessageThread.upsert.mockRejectedValueOnce(
        new Error('DB error')
      );

      await service.syncMessages('tenant-1', 'conn-1');

      // Second update call should set PARTIAL status
      const updateCalls = prismaMock.marketplaceSyncLog.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      const lastUpdate = updateCalls[updateCalls.length - 1][0];
      expect(lastUpdate.data.status).toBe('partial');
    });
  });

  describe('getThreads', () => {
    it('should query with tenant filter', async () => {
      prismaMock.marketplaceMessageThread.findMany.mockResolvedValue([]);
      prismaMock.marketplaceMessageThread.count.mockResolvedValue(0);

      const result = await service.getThreads('tenant-1');
      expect(result.threads).toEqual([]);
      expect(result.total).toBe(0);
      expect(prismaMock.marketplaceMessageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
        })
      );
    });

    it('should apply unreadOnly filter', async () => {
      prismaMock.marketplaceMessageThread.findMany.mockResolvedValue([]);
      prismaMock.marketplaceMessageThread.count.mockResolvedValue(0);

      await service.getThreads('tenant-1', { unreadOnly: true });
      expect(prismaMock.marketplaceMessageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: false }),
        })
      );
    });

    it('should apply connectionId filter', async () => {
      prismaMock.marketplaceMessageThread.findMany.mockResolvedValue([]);
      prismaMock.marketplaceMessageThread.count.mockResolvedValue(0);

      await service.getThreads('tenant-1', { connectionId: 'conn-1' });
      expect(prismaMock.marketplaceMessageThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ connectionId: 'conn-1' }),
        })
      );
    });
  });

  describe('getThread', () => {
    it('should throw NotFoundException for missing thread', async () => {
      prismaMock.marketplaceMessageThread.findFirst.mockResolvedValue(null);
      await expect(service.getThread('tenant-1', 'thread-999')).rejects.toThrow(
        'Message thread thread-999 not found'
      );
    });

    it('should return thread with messages', async () => {
      const mockThread = {
        id: 'thread-1',
        tenantId: 'tenant-1',
        messages: [{ id: 'msg-1', body: 'Hello' }],
      };
      prismaMock.marketplaceMessageThread.findFirst.mockResolvedValue(mockThread);

      const result = await service.getThread('tenant-1', 'thread-1');
      expect(result.id).toBe('thread-1');
      expect(result.messages).toHaveLength(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark thread as read', async () => {
      prismaMock.marketplaceMessageThread.findFirst.mockResolvedValue({
        id: 'thread-1',
        tenantId: 'tenant-1',
      });

      await service.markAsRead('tenant-1', 'thread-1');
      expect(prismaMock.marketplaceMessageThread.update).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { isRead: true },
      });
    });

    it('should throw for missing thread', async () => {
      prismaMock.marketplaceMessageThread.findFirst.mockResolvedValue(null);
      await expect(service.markAsRead('tenant-1', 'thread-999')).rejects.toThrow();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for tenant', async () => {
      prismaMock.marketplaceMessageThread.count.mockResolvedValue(5);

      const count = await service.getUnreadCount('tenant-1');
      expect(count).toBe(5);
      expect(prismaMock.marketplaceMessageThread.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', isRead: false },
      });
    });

    it('should filter by connectionId when provided', async () => {
      prismaMock.marketplaceMessageThread.count.mockResolvedValue(2);

      await service.getUnreadCount('tenant-1', 'conn-1');
      expect(prismaMock.marketplaceMessageThread.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', isRead: false, connectionId: 'conn-1' },
      });
    });
  });
});
