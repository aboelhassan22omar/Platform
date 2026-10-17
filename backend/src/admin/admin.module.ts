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
import { AdminStudentAccessController } from './admin-student-access.controller';
import { AdminQuestionBanksController } from './admin-question-banks.controller';
import { AdminGradingController } from './admin-grading.controller';
import { AssessmentsModule } from '../assessments/assessments.module';
import { ContentCatalogService } from './content/content-catalog.service';
import { ContentLessonsService } from './content/content-lessons.service';
import { ContentDeletionService } from './content/content-deletion.service';
import { AuthModule } from '../auth/auth.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  providers: [ContentCatalogService, ContentLessonsService, ContentDeletionService],
  imports: [
    AnalyticsModule,
    AssessmentsModule,
    AuthModule,
    CertificatesModule,
    EntitlementsModule,
    PresenceModule,
    VideosModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminStudentsController,
    AdminStudentAccessController,
    AdminContentController,
    AdminPricingController,
    AdminAssessmentsController,
    AdminQuestionBanksController,
    AdminGradingController,
  ],
})
export class AdminModule {}
