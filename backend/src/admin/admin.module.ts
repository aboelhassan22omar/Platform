import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { PresenceModule } from '../presence/presence.module';
import { VideosModule } from '../videos/videos.module';
import { AdminContentController } from './admin-content.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminPricingController } from './admin-pricing.controller';
import { AdminStudentsController } from './admin-students.controller';
import { AdminAssessmentsController } from './admin-assessments.controller';
import { ContentCatalogService } from './content/content-catalog.service';
import { ContentLessonsService } from './content/content-lessons.service';
import { ContentDeletionService } from './content/content-deletion.service';

@Module({
  providers: [ContentCatalogService, ContentLessonsService, ContentDeletionService],
  imports: [AnalyticsModule, EntitlementsModule, PresenceModule, VideosModule],
  controllers: [
    AdminDashboardController,
    AdminStudentsController,
    AdminContentController,
    AdminPricingController,
    AdminAssessmentsController,
  ],
})
export class AdminModule {}
