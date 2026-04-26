import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';
import { OperationsModule } from '../../operations/operations.module';

@Module({
  imports: [DbModule, OperationsModule],
  controllers: [ThemesController],
  providers: [ThemesService],
  exports: [ThemesService],
})
export class ThemesModule {}
