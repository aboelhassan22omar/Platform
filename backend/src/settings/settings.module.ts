import { Module } from '@nestjs/common';
import { AccessSettingsService } from './access-settings.service';
import { ProtectionSettingsService } from './protection-settings.service';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [ProtectionSettingsService, AccessSettingsService],
  exports: [ProtectionSettingsService, AccessSettingsService],
})
export class SettingsModule {}
