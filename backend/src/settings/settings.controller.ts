import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import type { Request } from 'express';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { Role } from '../generated/prisma/enums';
import { ProtectionSettingsService } from './protection-settings.service';

class ProtectionSettingsDto {
  @IsBoolean() watermark!: boolean;
}

@Controller()
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly protection: ProtectionSettingsService,
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
}
