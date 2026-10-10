import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { StreamAdmissionService } from './stream-admission.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [VideosController],
  providers: [VideosService, StreamAdmissionService],
  exports: [VideosService, StreamAdmissionService],
})
export class VideosModule {}
