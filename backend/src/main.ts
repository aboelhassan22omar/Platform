import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import json from 'express';
import { AppModule } from './app.module';
import { validateEnv, type AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });

  const config = app.get(ConfigService);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  const appConfig = {
    env: config.get('env'),
    isProduction: config.get('isProduction'),
    port: config.get('port'),
    platform: config.get('platform'),
    database: config.get('database'),
    auth: config.get('auth'),
    playback: config.get('playback'),
    payments: config.get('payments'),
    corsOrigins: config.get('corsOrigins'),
    rateLimit: config.get('rateLimit'),
    seedDemoData: config.get('seedDemoData'),
  } as AppConfig;

  // Refuse to start on an unsafe configuration rather than running degraded.
  validateEnv(appConfig);

  app.setGlobalPrefix('api');

  // Payment webhooks are HMAC-signed over the exact request bytes, so the raw
  // body must survive JSON parsing.
  app.use(
    json.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(json.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  app.use(
    helmet({
      // The API serves JSON and HLS segments, never HTML, so CSP belongs on
      // the frontend. COEP would break cross-origin media loading.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Behind nginx: trust one proxy hop so req.ip is the real client address,
  // which the auth rate limiter depends on.
  app.set('trust proxy', 1);

  app.enableCors({
    origin: appConfig.corsOrigins.length ? appConfig.corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Reject unknown fields outright rather than silently dropping them.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (!appConfig.isProduction) {
    const swagger = new DocumentBuilder()
      .setTitle(`${config.get<string>('platform.name')} — API`)
      .setDescription(
        'Amr Mahrous Educational Platform API. Built by Aurexis (https://aurexis.cc/).',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('access_token')
      .build();

    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger), {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log('API documentation available at /api/docs');
  }

  app.enableShutdownHooks();

  await app.listen(appConfig.port, '0.0.0.0');

  logger.log(`API listening on port ${appConfig.port} (${appConfig.env})`);
  if (appConfig.payments.provider === 'dev') {
    logger.warn(
      'PAYMENT_PROVIDER=dev — the sandbox adapter is active. NO REAL PAYMENTS ARE PROCESSED.',
    );
  }
}

void bootstrap();
