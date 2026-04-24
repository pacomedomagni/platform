import { Logger } from '@nestjs/common';

const BOOTSTRAP = 'Bootstrap';

const DEFAULT_VALUE_BLOCKLIST: readonly string[] = [
  'dev-only-secret-change-in-production',
  'default-dev-key-change-in-production',
  'default-secret',
  'dev-secret',
  'change-this-to-a-secure-random-string-in-production',
  'changeme',
  'minioadmin',
];

interface RequiredEnv {
  name: string;
  prodOnly?: boolean;
  minLength?: number;
  description?: string;
}

const REQUIRED: readonly RequiredEnv[] = [
  { name: 'DATABASE_URL' },
  { name: 'REDIS_HOST' },
  { name: 'REDIS_PORT' },
  { name: 'KEYCLOAK_ISSUER' },
  { name: 'KEYCLOAK_JWKS_URI' },
];

const REQUIRED_IN_PROD: readonly RequiredEnv[] = [
  { name: 'JWT_SECRET', prodOnly: true, minLength: 32, description: 'Primary JWT signing secret' },
  { name: 'CUSTOMER_JWT_SECRET', prodOnly: true, minLength: 32, description: 'Storefront customer JWT signing secret' },
  { name: 'ENCRYPTION_KEY', prodOnly: true, minLength: 32, description: 'Symmetric key for at-rest credential encryption' },
  { name: 'LOCAL_STORAGE_SECRET', prodOnly: true, minLength: 32, description: 'HMAC key for local presigned URLs' },
  { name: 'STRIPE_WEBHOOK_SECRET', prodOnly: true, description: 'Stripe webhook signing secret' },
  { name: 'STRIPE_SECRET_KEY', prodOnly: true, description: 'Stripe API secret key' },
  { name: 'SENDGRID_WEBHOOK_VERIFICATION_KEY', prodOnly: true, description: 'SendGrid webhook ECDSA public key' },
  { name: 'DOMAIN', prodOnly: true, description: 'Platform root domain (e.g. noslag.com)' },
];

const FORBIDDEN_IN_PROD_WHEN_TRUE: readonly string[] = [
  'ALLOW_TENANT_HEADER',
];

function isProd(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

function valueIsDefault(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return DEFAULT_VALUE_BLOCKLIST.some((blocked) => normalized === blocked.toLowerCase());
}

export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Hard-required (every environment)
  for (const entry of REQUIRED) {
    const value = process.env[entry.name];
    if (!value) {
      errors.push(`Missing required env: ${entry.name}`);
    }
  }

  // Required only in production, but always checked for default values
  for (const entry of REQUIRED_IN_PROD) {
    const value = process.env[entry.name];
    if (!value) {
      if (isProd()) {
        errors.push(`Missing required production env: ${entry.name}${entry.description ? ` (${entry.description})` : ''}`);
      } else {
        warnings.push(`Dev mode: ${entry.name} is unset (${entry.description ?? 'no description'})`);
      }
      continue;
    }

    if (valueIsDefault(value)) {
      const msg = `Env ${entry.name} is set to a known insecure default value`;
      if (isProd()) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }

    if (entry.minLength && value.length < entry.minLength) {
      const msg = `Env ${entry.name} is shorter than ${entry.minLength} chars (actual: ${value.length})`;
      if (isProd()) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  // Prod-forbidden when true
  if (isProd()) {
    for (const name of FORBIDDEN_IN_PROD_WHEN_TRUE) {
      if (process.env[name] === 'true') {
        errors.push(`Env ${name}=true is forbidden in production`);
      }
    }
  }

  for (const w of warnings) {
    Logger.warn(`⚠️  ${w}`, BOOTSTRAP);
  }

  if (errors.length > 0) {
    Logger.error(`❌ Environment validation failed:`, BOOTSTRAP);
    for (const e of errors) {
      Logger.error(`   - ${e}`, BOOTSTRAP);
    }
    Logger.error(
      '💡 Fix the above before starting the application. In dev, copy .env.example to .env.',
      BOOTSTRAP,
    );
    process.exit(1);
  }

  Logger.log('✅ Environment validation passed', BOOTSTRAP);
}
