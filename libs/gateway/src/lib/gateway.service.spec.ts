import { Test } from '@nestjs/testing';
import { GatewayService } from './gateway.service';

describe('GatewayService', () => {
  let service: GatewayService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GatewayService],
    }).compile();

    service = module.get(GatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });
});
