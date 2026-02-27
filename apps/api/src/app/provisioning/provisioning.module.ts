import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { ProvisioningController } from './provisioning.controller';
import { ProvisioningService } from './provisioning.service';
import { SeedDataService } from './seed-data.service';

@Module({
  imports: [DbModule],
  controllers: [ProvisioningController],
  providers: [ProvisioningService, SeedDataService],
  exports: [ProvisioningService, SeedDataService],
})
export class ProvisioningModule {}
