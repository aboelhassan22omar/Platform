import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { Role } from '../generated/prisma/enums';
import { AccessSettingsService } from './access-settings.service';
import { ProtectionSettingsService } from './protection-settings.service';

class ProtectionSettingsDto {
  @IsBoolean() watermark!: boolean;
}

class AccessSettingsDto {
  @Type(() => Number)
  @IsInt({ message: 'عدد الأجهزة لازم يكون رقم صحيح' })
  @Min(0)
  @Max(10, { message: 'أقصى عدد أجهزة 10' })
  maxDevices!: number;

  @Type(() => Number)
  @IsInt({ message: 'عدد المشاهدات لازم يكون رقم صحيح' })
  @Min(0)
  @Max(100, { message: 'أقصى عدد مشاهدات 100' })
  defaultMaxViews!: number;
}

@Controller()
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly protection: ProtectionSettingsService,
    private readonly access: AccessSettingsService,
  ) {}

  /** Read by every page load, so the switches take effect without a redeploy. */
  @Public()
  @Get('settings/protection')
  getProtection() {
    return this.protection.get();
  }

  @Roles(Role.ADMIN)
  @Get('admin/settings/protection')
  getProtectionForAdmin() {
    return this.protection.get();
  }

  @Roles(Role.ADMIN)
  @Put('admin/settings/protection')
  async updateProtection(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ProtectionSettingsDto,
    @Req() req: Request,
  ) {
    const saved = await this.protection.set({
      watermark: dto.watermark,
    });
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'settings.protection.update',
      entityType: 'SiteSetting',
      entityId: 'security.protection',
      metadata: { ...saved },
      ip: req.ip,
    });
    return saved;
  }

  @Roles(Role.ADMIN)
  @Get('admin/settings/access')
  getAccess() {
    return this.access.get();
  }

  @Roles(Role.ADMIN)
  @Put('admin/settings/access')
  async updateAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AccessSettingsDto,
    @Req() req: Request,
  ) {
    const saved = await this.access.set({
      maxDevices: dto.maxDevices,
      defaultMaxViews: dto.defaultMaxViews,
    });
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'settings.access.update',
      entityType: 'SiteSetting',
      entityId: 'security.access',
      metadata: { ...saved },
      ip: req.ip,
    });
    return saved;
  }
}
