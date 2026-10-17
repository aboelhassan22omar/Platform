import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/** Phone notifications for the installed app (Web Push). */
@Module({
  controllers: [PushController],
  providers: [PushService],
})
export class PushModule {}
