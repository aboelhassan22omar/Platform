import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

import { AuthModule } from './auth/auth.module';
import { AcademicModule } from './academic/academic.module';
import { CoursesModule } from './courses/courses.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { ProgressModule } from './progress/progress.module';
import { PaymentsModule } from './payments/payments.module';
import { VideosModule } from './videos/videos.module';
import { PresenceModule } from './presence/presence.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MaintenanceService } from './common/maintenance.service';
import { AssessmentsModule } from './assessments/assessments.module';
import { LiveModule } from './live/live.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], cache: true }),
    ScheduleModule.forRoot(),

    // ONE throttler, applied globally.
    //
    // Registering a second named throttler here would apply it to every route
    // as well, not only to the ones that reference it — which would lock
    // students out of the whole API after a handful of requests. Auth routes
    // instead tighten this same throttler with
    // `@Throttle({ default: { limit, ttl } })`.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('rateLimit.ttl')! * 1000,
            limit: config.get<number>('rateLimit.max')!,
          },
        ],
      }),
    }),

    // Global infrastructure
    PrismaModule,
    RedisModule,
    StorageModule,
    AuditModule,

    // Domain
    AuthModule,
    AcademicModule,
    CoursesModule,
    EntitlementsModule,
    ProgressModule,
    PaymentsModule,
    VideosModule,
    PresenceModule,
    AnalyticsModule,
    AssessmentsModule,
    AdminModule,
    HealthModule,
    NotificationsModule,
    LiveModule,
  ],
  providers: [
    MaintenanceService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: authenticate, then authorise, then rate-limit.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
