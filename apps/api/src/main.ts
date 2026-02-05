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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable raw body for webhooks (Stripe)
    rawBody: true,
  });
  
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  
  // Enable CORS
  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000', 'http://localhost:4200'],
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
