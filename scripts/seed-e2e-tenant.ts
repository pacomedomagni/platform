/**
 * E2E Test Tenant Seeder
 *
 * Creates a test tenant with a known UUID matching the Keycloak realm admin user,
 * then seeds all required data (accounts, warehouse, UOMs, DocTypes, legal pages).
 *
 * Usage: npx tsx scripts/seed-e2e-tenant.ts
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const TENANT_ID = '8d334424-054e-4452-949c-21ecc1fff2c0';
const ADMIN_EMAIL = 'admin@noslag.com';
const ADMIN_PASSWORD = 'admin123';
const BUSINESS_NAME = 'E2E Test Store';

// Import seed data defaults
import { DEFAULT_CHART_OF_ACCOUNTS } from '../apps/api/src/app/provisioning/defaults/chart-of-accounts';
import { DEFAULT_WAREHOUSE_CONFIG } from '../apps/api/src/app/provisioning/defaults/warehouse';
import { DEFAULT_UOMS } from '../apps/api/src/app/provisioning/defaults/uoms';
import { DEFAULT_DOC_TYPES } from '../apps/api/src/app/provisioning/defaults/doc-types';
import { DEFAULT_LEGAL_PAGES } from '../apps/api/src/app/provisioning/defaults/legal-pages';

const connectionString = process.env['DATABASE_URL'] || 'postgresql://noslag:noslag_password@localhost:5432/noslag_db?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding E2E test tenant...\n');

  // 1. Create tenant with known UUID
  console.log('  [1/7] Creating tenant...');
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    create: {
      id: TENANT_ID,
      name: BUSINESS_NAME,
      businessName: BUSINESS_NAME,
      email: ADMIN_EMAIL,
      domain: 'e2e-test',
      baseCurrency: 'USD',
      isActive: true,
      storePublished: true,
    },
    update: {
      isActive: true,
      storePublished: true,
    },
  });

  // 2. Create admin user
  console.log('  [2/7] Creating admin user...');
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      tenantId: TENANT_ID,
      roles: ['admin', 'user'],
    },
    update: {
      password: hashedPassword,
      tenantId: TENANT_ID,
    },
  });

  // 3. Seed Chart of Accounts
  console.log('  [3/7] Seeding chart of accounts...');
  for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: {
        tenantId_code: {
          tenantId: TENANT_ID,
          code: account.code,
        },
      },
      create: {
        tenantId: TENANT_ID,
        code: account.code,
        name: account.name,
        rootType: account.rootType,
        accountType: account.accountType,
        isGroup: account.isGroup || false,
        parentAccountCode: account.parentAccountCode || null,
        isActive: true,
      },
      update: {},
    });
  }
  console.log(`         ${DEFAULT_CHART_OF_ACCOUNTS.length} accounts seeded`);

  // 4. Seed Warehouse + Locations
  console.log('  [4/7] Seeding warehouse and locations...');
  const { warehouse: whConfig, locations } = DEFAULT_WAREHOUSE_CONFIG;

  const warehouse = await prisma.warehouse.upsert({
    where: {
      tenantId_code: {
        tenantId: TENANT_ID,
        code: whConfig.code,
      },
    },
    create: {
      tenantId: TENANT_ID,
      code: whConfig.code,
      name: whConfig.name,
      isActive: true,
    },
    update: {},
  });

  const createdLocations: Record<string, string> = {};
  for (const loc of locations) {
    const parentId = loc.parentCode ? createdLocations[loc.parentCode] : null;
    const location = await prisma.location.upsert({
      where: {
        tenantId_warehouseId_code: {
          tenantId: TENANT_ID,
          warehouseId: warehouse.id,
          code: loc.code,
        },
      },
      create: {
        tenantId: TENANT_ID,
        warehouseId: warehouse.id,
        code: loc.code,
        name: loc.name,
        path: loc.path,
        parentId,
        isPickable: loc.isPickable ?? true,
        isPutaway: loc.isPutaway ?? true,
        isStaging: loc.isStaging ?? false,
        isActive: true,
      },
      update: {},
    });
    createdLocations[loc.code] = location.id;
  }

  // Set default locations on warehouse
  const receivingLocation = createdLocations['RECEIVING'];
  const pickingLocation = createdLocations['ROOT'];
  if (receivingLocation || pickingLocation) {
    await prisma.warehouse.update({
      where: { id: warehouse.id },
      data: {
        defaultReceivingLocationId: receivingLocation,
        defaultPickingLocationId: pickingLocation,
      },
    });
  }
  console.log(`         1 warehouse + ${locations.length} locations seeded`);

  // 5. Seed UOMs (global)
  console.log('  [5/7] Seeding units of measure...');
  for (const uom of DEFAULT_UOMS) {
    await prisma.uom.upsert({
      where: { code: uom.code },
      create: {
        code: uom.code,
        name: uom.name,
        isActive: true,
      },
      update: {},
    });
  }
  console.log(`         ${DEFAULT_UOMS.length} UOMs seeded`);

  // 6. Seed DocTypes + Permissions
  console.log('  [6/7] Seeding DocTypes and permissions...');
  for (const docType of DEFAULT_DOC_TYPES) {
    await prisma.docType.upsert({
      where: { name: docType.name },
      create: {
        name: docType.name,
        module: docType.module,
        isSingle: docType.isSingle || false,
        isChild: docType.isChild || false,
        description: docType.description,
      },
      update: {},
    });

    for (const perm of docType.permissions || []) {
      await prisma.docPerm.upsert({
        where: {
          id: `${docType.name}-${perm.role}`,
        },
        create: {
          id: `${docType.name}-${perm.role}`,
          docTypeName: docType.name,
          role: perm.role,
          read: perm.read ?? true,
          write: perm.write ?? false,
          create: perm.create ?? false,
          delete: perm.delete ?? false,
          submit: perm.submit ?? false,
          cancel: perm.cancel ?? false,
          amend: perm.amend ?? false,
          report: perm.report ?? false,
        },
        update: {},
      });
    }
  }
  console.log(`         ${DEFAULT_DOC_TYPES.length} DocTypes seeded`);

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      tenantId: TENANT_ID,
      action: 'CREATE',
      docType: 'Tenant',
      docName: TENANT_ID,
      meta: { event: 'e2e_tenant_provisioned', timestamp: new Date().toISOString() },
    },
  });

  // 7. Seed Legal Pages
  console.log('  [7/7] Seeding legal pages...');
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  for (const page of DEFAULT_LEGAL_PAGES) {
    const content = page.content
      .replace(/\{\{businessName\}\}/g, BUSINESS_NAME)
      .replace(/\{\{email\}\}/g, ADMIN_EMAIL)
      .replace(/\{\{date\}\}/g, date);

    await prisma.storePage.upsert({
      where: { tenantId_slug: { tenantId: TENANT_ID, slug: page.slug } },
      create: {
        tenantId: TENANT_ID,
        slug: page.slug,
        title: page.title,
        content,
        isPublished: true,
      },
      update: {},
    });
  }
  console.log(`         ${DEFAULT_LEGAL_PAGES.length} legal pages seeded`);

  // 8. Seed store currency
  await prisma.storeCurrency.upsert({
    where: {
      tenantId_currencyCode: {
        tenantId: TENANT_ID,
        currencyCode: 'USD',
      },
    },
    update: {},
    create: {
      tenantId: TENANT_ID,
      currencyCode: 'USD',
      symbol: '$',
      exchangeRate: 1,
      isBaseCurrency: true,
      isEnabled: true,
      decimalPlaces: 2,
    },
  });

  console.log('\nE2E test tenant seeded successfully!');
  console.log(`  Tenant ID: ${TENANT_ID}`);
  console.log(`  Admin:     ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Domain:    e2e-test`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
