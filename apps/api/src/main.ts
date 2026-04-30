/**
 * Production-ready NestJS API Server
 */

import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app/app.module';
import { validateEnvironment } from './app/common/env-validator';

async function bootstrap() {
  // Validate environment variables before starting the application
  validateEnvironment();
  
  const app = await NestFactory.create(AppModule, {
    // Enable raw body for webhooks (Stripe)
    rawBody: true,
    // Buffer logs until Pino logger is ready
    bufferLogs: true,
  });
  
  // Use Pino logger for all NestJS logging
  app.useLogger(app.get(PinoLogger));
  
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

      // Reject all other origins — custom domains are verified via Host header,
      // not via CORS origin. This prevents arbitrary HTTPS sites from making
      // authenticated cross-origin requests to admin endpoints.
      callback(null, false);
    },
    credentials: true,
  });
  
  // Global validation pipe
  //
  // `enableImplicitConversion` lets query-string values like `?limit=1` (which
  // arrive as the string "1") be coerced into the declared TS type so
  // class-validator's @IsInt / @IsNumber pass. Without it, every numeric
  // query DTO field has to be decorated manually with @Type(() => Number).
  // See operations/audit-logs?limit=1 — that 400'd until this was added.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
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
