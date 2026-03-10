import { Test, TestingModule } from '@nestjs/testing';
import { EbayMediaService } from './ebay-media.service';
import { PrismaService } from '@platform/db';
import { StorageService } from '@platform/storage';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';

describe('EbayMediaService', () => {
  let service: EbayMediaService;
  let storageMock: jest.Mocked<Partial<StorageService>>;
  let ebayStoreMock: jest.Mocked<Partial<EbayStoreService>>;
  let ebayClientMock: jest.Mocked<Partial<EbayClientService>>;

  beforeEach(async () => {
    process.env.MOCK_EXTERNAL_SERVICES = 'true';

    storageMock = {
      download: jest.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    };

    ebayStoreMock = {
      getClient: jest.fn().mockResolvedValue({}),
    };

    ebayClientMock = {
      getAccessToken: jest.fn().mockReturnValue('mock-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EbayMediaService,
        { provide: PrismaService, useValue: {} },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('tenant-1') } },
        { provide: EbayStoreService, useValue: ebayStoreMock },
        { provide: EbayClientService, useValue: ebayClientMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();

    service = module.get<EbayMediaService>(EbayMediaService);
  });

  afterEach(() => {
    delete process.env.MOCK_EXTERNAL_SERVICES;
  });

  describe('extractStorageKey', () => {
    it('should extract key from MinIO path-style URL', () => {
      const url = 'http://localhost:9000/noslag-uploads/tenant-1/products/image_123_abc.jpg';
      const key = service.extractStorageKey(url);
      expect(key).toBe('tenant-1/products/image_123_abc.jpg');
    });

    it('should extract key from S3-style URL', () => {
      const url = 'https://my-bucket.s3.us-east-1.amazonaws.com/tenant-1/products/image.png';
      const key = service.extractStorageKey(url);
      // S3 subdomain-style has no bucket in path, so first segment IS the tenant
      expect(key).toBe('products/image.png');
    });

    it('should return as-is if not a valid URL (already a key)', () => {
      const key = 'tenant-1/products/image_123.jpg';
      expect(service.extractStorageKey(key)).toBe(key);
    });

    it('should handle URL with single path segment', () => {
      const url = 'http://localhost:9000/just-a-file.jpg';
      const key = service.extractStorageKey(url);
      expect(key).toBe('just-a-file.jpg');
    });
  });

  describe('uploadImageFromStorage (mock mode)', () => {
    it('should return mock EPS URL', async () => {
      const result = await service.uploadImageFromStorage(
        'conn-1',
        'http://localhost:9000/bucket/tenant-1/product/img.jpg'
      );
      expect(result.imageId).toContain('mock_image_storage_');
      expect(result.imageUrl).toContain('i.ebayimg.com');
    });
  });

  describe('uploadImageFromUrl (mock mode)', () => {
    it('should return mock EPS URL', async () => {
      const result = await service.uploadImageFromUrl('conn-1', 'https://example.com/image.jpg');
      expect(result.imageId).toContain('mock_image_');
      expect(result.imageUrl).toContain('i.ebayimg.com');
    });
  });

  describe('uploadImageFromFile (mock mode)', () => {
    it('should return mock EPS URL', async () => {
      const buffer = Buffer.from('fake-image');
      const result = await service.uploadImageFromFile('conn-1', buffer, 'image/jpeg');
      expect(result.imageId).toContain('mock_image_file_');
      expect(result.imageUrl).toContain('i.ebayimg.com');
    });
  });

  describe('uploadVideoFromStorage (mock mode)', () => {
    it('should return mock video ID', async () => {
      const result = await service.uploadVideoFromStorage(
        'conn-1',
        'tenant-1/videos/demo.mp4',
        'Demo Video'
      );
      expect(result.videoId).toContain('mock_video_storage_');
      expect(result.status).toBe('PROCESSING');
    });
  });

  describe('createVideo (mock mode)', () => {
    it('should return mock video ID and upload URL', async () => {
      const result = await service.createVideo('conn-1', 'Test Video', 'Description');
      expect(result.videoId).toContain('mock_video_');
      expect(result.uploadUrl).toContain('/upload');
    });
  });

  describe('getVideo (mock mode)', () => {
    it('should return LIVE status', async () => {
      const result = await service.getVideo('conn-1', 'video-123');
      expect(result.videoId).toBe('video-123');
      expect(result.status).toBe('LIVE');
      expect(result.playableUrl).toBeDefined();
    });
  });

  describe('getImage (mock mode)', () => {
    it('should return image details', async () => {
      const result = await service.getImage('conn-1', 'img-123');
      expect(result.imageId).toBe('img-123');
      expect(result.status).toBe('UPLOADED');
      expect(result.width).toBe(1600);
      expect(result.height).toBe(1600);
    });
  });
});
