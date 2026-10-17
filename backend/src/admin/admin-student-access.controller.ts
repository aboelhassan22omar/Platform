import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { DevicesService } from '../auth/devices.service';
import { ViewLimitsService } from '../videos/view-limits.service';

class GrantViewsDto {
  @Type(() => Number)
  @IsInt({ message: 'عدد المشاهدات لازم يكون رقم صحيح' })
  @Min(1, { message: 'زوّد مشاهدة واحدة على الأقل' })
  @Max(20, { message: 'أقصى زيادة 20 مشاهدة مرة واحدة' })
  views!: number;
}

/**
 * The anti-sharing side of a student's account: the devices they sign in
 * from and how many views of each lesson they have left. Support handles the
 * everyday "I changed my phone" and "I need to rewatch" requests.
 */
@ApiTags('admin')
@Roles(Role.SUPPORT)
@Controller('admin/students/:id')
export class AdminStudentAccessController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly devices: DevicesService,
    private readonly views: ViewLimitsService,
  ) {}

  private async assertStudent(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!user || user.role !== Role.STUDENT) throw new NotFoundException('الطالب غير موجود');
  }

  @Get('devices')
  @ApiOperation({ summary: 'الأجهزة المسجّل عليها حساب الطالب' })
  async listDevices(@Param('id') id: string) {
    await this.assertStudent(id);
    return this.devices.list(id);
  }

  @Delete('devices/:deviceId')
  @ApiOperation({ summary: 'إزالة جهاز من حساب الطالب' })
  async removeDevice(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('deviceId') deviceId: string,
    @Req() req: Request,
  ) {
    await this.assertStudent(id);
    return this.devices.remove({ actorId: actor.id, userId: id, deviceId, ip: req.ip });
  }

  @Delete('devices')
  @ApiOperation({ summary: 'إزالة كل أجهزة الطالب' })
  async resetDevices(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.assertStudent(id);
    return this.devices.remove({ actorId: actor.id, userId: id, ip: req.ip });
  }

  @Get('views')
  @ApiOperation({ summary: 'مشاهدات الطالب لكل حصة' })
  async listViews(@Param('id') id: string) {
    await this.assertStudent(id);
    return this.views.usageForStudent(id);
  }

  @Post('views/:lessonId')
  @ApiOperation({ summary: 'زيادة مشاهدات حصة لطالب' })
  async grantViews(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: GrantViewsDto,
    @Req() req: Request,
  ) {
    await this.assertStudent(id);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true },
    });
    if (!lesson) throw new NotFoundException('الحصة غير موجودة');
    const bonusViews = await this.views.grantBonus(id, lessonId, dto.views);
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'lesson.views.granted',
      entityType: 'Lesson',
      entityId: lessonId,
      targetUserId: id,
      metadata: { views: dto.views, bonusViews, lesson: lesson.title },
      ip: req.ip,
    });
    await this.prisma.notification.create({
      data: {
        userId: id,
        kind: 'CONTENT',
        title: 'اتزوّدت مشاهدات حصة 🎬',
        body: `اتضافلك ${dto.views === 1 ? 'مشاهدة' : `${dto.views} مشاهدات`} لحصة «${lesson.title}».`,
        href: `/lessons/${lessonId}`,
      },
    });
    return this.views.allowance(id, lessonId);
  }
}
