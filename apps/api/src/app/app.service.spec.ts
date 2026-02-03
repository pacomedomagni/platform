import { Test } from '@nestjs/testing';
import { AppService } from './app.service';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: PrismaService, useValue: {} },
        { provide: ClsService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      expect(service.getData()).toEqual({ message: 'Hello API' });
    });
  });
});
