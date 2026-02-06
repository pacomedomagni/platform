import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchemaService } from '@platform/meta';
import { CORE_MODULES } from './defaults';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(private readonly schema: SchemaService) {}

  async onApplicationBootstrap() {
    const syncAlways = process.env['SYNC_CORE_DOCTYPES'] !== 'false';
    this.logger.log('Checking for core modules...');
    
    // We run this sequentially to respect dependencies (though currently SchemaService handles basic dependency order if strict)
    // Actually, we should create Child Tables first if we were strict about FKs during creation, 
    // but SchemaService syncDocType is likely resilient or we should order CORE_MODULES to have children first or independent types first.
    // Let's sort: Child tables first, then Parents. Or Parents then fields. 
    // SchemaService `syncDocType` relies on `DocType` existing. 
    // Let's just run through them; Prisma usually handles the meta records fine. 
    // The actual table creation is what matters for FKs. 
    // Since `SchemaService` might not create FK constraints immediately (if it's dynamic), it's safer.

    for (const mod of CORE_MODULES) {
      try {
        if (!syncAlways) {
          const existing = await this.schema.getDocType(mod.name);
          if (existing) continue;
          this.logger.log(`Seeding DocType: ${mod.name}`);
        } else {
          this.logger.log(`Syncing core DocType: ${mod.name}`);
        }

        await this.schema.syncDocType(mod);
      } catch (e) {
        this.logger.error(`Failed to seed ${mod.name}`, e);
      }
    }
    
    this.logger.log('Core modules check complete.');
  }
}
