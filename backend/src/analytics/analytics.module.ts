import { Module } from '@nestjs/common';
import { PresenceModule } from '../presence/presence.module';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PresenceModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
