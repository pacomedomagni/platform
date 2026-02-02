import { Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';

@Module({
  controllers: [],
  providers: [GatewayService],
  exports: [GatewayService],
})
export class GatewayModule {}
