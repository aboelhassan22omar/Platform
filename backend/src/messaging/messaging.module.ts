import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { MessageProducersService } from './message-producers.service';
import { MessagingController } from './messaging.controller';
import { MessagingSettingsService } from './messaging-settings.service';
import { OutboxService } from './outbox.service';
import { ParentReportsService } from './parent-reports.service';
import { WhatsAppCloudClient } from './whatsapp-cloud.client';
import { WhatsAppDispatcherService } from './whatsapp-dispatcher.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

/** WhatsApp messages to students and parents, and the weekly parent report. */
@Module({
  imports: [EntitlementsModule],
  controllers: [MessagingController, WhatsAppWebhookController],
  providers: [
    MessagingSettingsService,
    OutboxService,
    WhatsAppCloudClient,
    WhatsAppDispatcherService,
    ParentReportsService,
    MessageProducersService,
  ],
  exports: [MessageProducersService, OutboxService],
})
export class MessagingModule {}
