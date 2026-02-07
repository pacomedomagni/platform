/**
 * Production-ready NestJS API Server
 */

// Initialize Sentry FIRST, before any other imports
import { initSentry } from './app/sentry/sentry';
initSentry();

import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { SentryExceptionFilter } from './app/sentry/sentry.filter';

/**
 * Validate required environment variables
 * Exits with error code 1 if any required variables are missing
 */
function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'KEYCLOAK_ISSUER',
    'KEYCLOAK_JWKS_URI',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    Logger.error(
      `❌ Missing required environment variables: ${missing.join(', ')}`,
      'Bootstrap'
    );
    Logger.error(
      '💡 Tip: Copy .env.example to .env and fill in the values',
      'Bootstrap'
    );
    process.exit(1);
  }

  Logger.log('✅ Environment validation passed', 'Bootstrap');
}

async function bootstrap() {
  // Validate environment variables before starting the application
  validateEnvironment();
  const app = await NestFactory.create(AppModule, {
    // Enable raw body for webhooks (Stripe)
    rawBody: true,
  });
  
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);
  
  // Enable CORS — allow platform domains + any verified custom domain
  const allowedOrigins = process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000', 'http://localhost:4200'];
  const platformDomain = process.env['DOMAIN'] || 'noslag.com';

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) return callback(null, true);

      // Allow explicitly configured origins
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Allow any subdomain of the platform domain
      try {
        const url = new URL(origin);
        if (url.hostname === platformDomain || url.hostname.endsWith(`.${platformDomain}`)) {
          return callback(null, true);
        }
      } catch {
        // Invalid origin URL
      }

      // Allow any HTTPS origin for storefront routes (custom domains)
      // Custom domains are verified at the Traefik + DNS level before traffic arrives
      if (origin.startsWith('https://')) {
        return callback(null, true);
      }

      callback(null, false);
    },
    credentials: true,
  });
  
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  
  // Global exception filter (Sentry integration)
  app.useGlobalFilters(new SentryExceptionFilter());
  
  const port = process.env['PORT'] || 3000;
  await app.listen(port, '0.0.0.0');
  
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(
    `📊 Health check available at: http://localhost:${port}/${globalPrefix}/health`,
  );
}

bootstrap();
