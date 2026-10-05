import { Module } from '@nestjs/common';
import { AdminLiveController, LiveController } from './live.controller';
import { LiveService } from './live.service';

@Module({
  controllers: [LiveController, AdminLiveController],
  providers: [LiveService],
})
export class LiveModule {}
