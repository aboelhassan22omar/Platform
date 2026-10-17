import { Module } from '@nestjs/common';
import { ProtectionSettingsService } from './protection-settings.service';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [ProtectionSettingsService],
  exports: [ProtectionSettingsService],
})
export class SettingsModule {}
