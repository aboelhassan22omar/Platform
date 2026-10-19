import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { NativePushService } from './native-push.service';
import { PushService } from './push.service';

/** Phone notifications: Web Push, and FCM / APNs for the store apps. */
@Module({
  controllers: [PushController],
  providers: [PushService, NativePushService],
  exports: [PushService],
})
export class PushModule {}
