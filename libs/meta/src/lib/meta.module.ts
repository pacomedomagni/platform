import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { SchemaService } from './schema.service';
import { DocService } from './doc.service';
import { ValidationService } from './validation.service';
import { UniversalController } from './universal.controller';

@Module({
  imports: [DbModule],
  controllers: [UniversalController],
  providers: [SchemaService, DocService, ValidationService],
  exports: [SchemaService, DocService, ValidationService],
})
export class MetaModule {}
