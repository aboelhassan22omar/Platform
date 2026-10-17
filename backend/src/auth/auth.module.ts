import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { MeDevicesController } from './me-devices.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DevicesService } from './devices.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), SettingsModule],
  controllers: [AuthController, MeDevicesController],
  providers: [AuthService, PasswordService, JwtStrategy, DevicesService],
  exports: [AuthService, PasswordService, DevicesService],
})
export class AuthModule {}
