import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { StreamAdmissionService } from './stream-admission.service';
import { ViewLimitsService } from './view-limits.service';
import { OfflineDownloadsController } from './offline-downloads.controller';
import { OfflineDownloadsService } from './offline-downloads.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [EntitlementsModule, SettingsModule],
  controllers: [VideosController, OfflineDownloadsController],
  providers: [VideosService, StreamAdmissionService, ViewLimitsService, OfflineDownloadsService],
  exports: [VideosService, StreamAdmissionService, ViewLimitsService],
})
export class VideosModule {}
