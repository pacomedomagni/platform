export * from './lib/prisma.service';
export * from './lib/db.module';

// Re-export Prisma namespace for Decimal and other types
export { Prisma } from '@prisma/client';

// Alias for convenience
export { PrismaService as DbService } from './lib/prisma.service';
