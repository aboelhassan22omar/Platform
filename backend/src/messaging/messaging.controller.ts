import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, Max, Min, ValidateNested } from 'class-validator';
import type { Request } from 'express';
import { Prisma } from '../generated/prisma/client';
import { MessageKind, MessageStatus, Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { MESSAGE_TEMPLATES } from './message-templates';
import { MessagingSettingsService, type MessagingSettings } from './messaging-settings.service';
import { ParentReportsService } from './parent-reports.service';
import { WhatsAppCloudClient } from './whatsapp-cloud.client';
import { waMeLink } from './outbox.service';

class WeeklyReportDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) weekday!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(23) hour!: number;
  @IsIn(['paying', 'all']) audience!: 'paying' | 'all';
}

class QuietHoursDto {
  @IsBoolean() enabled!: boolean;
  @Type(() => Number) @IsInt() @Min(0) @Max(23) from!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(23) to!: number;
}

class MessagingSettingsDto {
  @IsIn(['off', 'manual', 'cloud'], { message: 'اختار طريقة الإرسال' })
  mode!: 'off' | 'manual' | 'cloud';

  @IsObject()
  kinds!: Record<string, boolean>;

  @ValidateNested() @Type(() => WeeklyReportDto) weeklyReport!: WeeklyReportDto;
  @ValidateNested() @Type(() => QuietHoursDto) quietHours!: QuietHoursDto;
}

class ParentReportsToggleDto {
  @IsBoolean() enabled!: boolean;
}

const KINDS = Object.values(MessageKind);
const STATUSES = Object.values(MessageStatus);

@ApiTags('admin')
@Controller()
export class MessagingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: MessagingSettingsService,
    private readonly reports: ParentReportsService,
    private readonly cloud: WhatsAppCloudClient,
  ) {}

  // --------------------------------------------------------------------------
  // Settings and templates
  // --------------------------------------------------------------------------

  @Roles(Role.ADMIN)
  @Get('admin/messaging')
  @ApiOperation({ summary: 'إعدادات رسائل واتساب والقوالب' })
  async overview() {
    const [settings, counts] = await Promise.all([
      this.settings.get(),
      this.prisma.outboundMessage.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      settings,
      cloud: { configured: this.cloud.configured, phoneNumberId: this.cloud.maskedPhoneNumberId },
      templates: Object.values(MESSAGE_TEMPLATES),
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count])),
    };
  }

  @Roles(Role.ADMIN)
  @Put('admin/messaging/settings')
  async updateSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: MessagingSettingsDto,
    @Req() req: Request,
  ) {
    if (dto.mode === 'cloud' && !this.cloud.configured) {
      throw new BadRequestException(
        'الإرسال الأوتوماتيك محتاج حساب WhatsApp Business متربط بالمنصة الأول. استخدم الإرسال اليدوي لحد ما يتجهز.',
      );
    }
    const kinds = Object.fromEntries(
      KINDS.map((kind) => [kind, dto.kinds[kind] !== false]),
    ) as MessagingSettings['kinds'];
    const saved = await this.settings.set({
      mode: dto.mode,
      kinds,
      weeklyReport: dto.weeklyReport,
      quietHours: dto.quietHours,
    });
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'settings.messaging.update',
      entityType: 'SiteSetting',
      entityId: 'messaging.whatsapp',
      metadata: { ...saved },
      ip: req.ip,
    });
    return saved;
  }

  // --------------------------------------------------------------------------
  // Outbox
  // --------------------------------------------------------------------------

  @Roles(Role.SUPPORT)
  @Get('admin/messaging/messages')
  @ApiOperation({ summary: 'سجل رسائل واتساب' })
  async messages(
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
  ) {
    const take = 30;
    const currentPage = Math.max(Number(page) || 1, 1);
    const term = search?.trim();
    const where: Prisma.OutboundMessageWhereInput = {
      ...(status && STATUSES.includes(status as MessageStatus)
        ? { status: status as MessageStatus }
        : {}),
      ...(kind && KINDS.includes(kind as MessageKind) ? { kind: kind as MessageKind } : {}),
      ...(term
        ? {
            OR: [
              { toPhone: { contains: term.replace(/^0/, '') } },
              { user: { fullName: { contains: term, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total, counts] = await Promise.all([
      this.prisma.outboundMessage.findMany({
        where,
        // Oldest first for the to-do list, newest first for history.
        orderBy: status === MessageStatus.MANUAL ? { createdAt: 'asc' } : { createdAt: 'desc' },
        skip: (currentPage - 1) * take,
        take,
        select: {
          id: true,
          kind: true,
          audience: true,
          toPhone: true,
          body: true,
          status: true,
          attempts: true,
          lastError: true,
          scheduledFor: true,
          expiresAt: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
          createdAt: true,
          user: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.outboundMessage.count({ where }),
      this.prisma.outboundMessage.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      items: rows.map((row) => ({ ...row, whatsappLink: waMeLink(row.toPhone, row.body) })),
      total,
      page: currentPage,
      pageSize: take,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count])),
    };
  }

  /** Staff sent it from their own WhatsApp. */
  @Roles(Role.SUPPORT)
  @Post('admin/messaging/messages/:id/sent')
  @HttpCode(HttpStatus.OK)
  async markSent(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    const { count } = await this.prisma.outboundMessage.updateMany({
      where: { id, status: { in: [MessageStatus.MANUAL, MessageStatus.FAILED] } },
      data: { status: MessageStatus.SENT, sentAt: new Date(), sentById: actor.id },
    });
    if (!count) throw new NotFoundException('الرسالة دي مش مستنية إرسال');
    return { ok: true };
  }

  @Roles(Role.SUPPORT)
  @Post('admin/messaging/messages/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(@Param('id') id: string) {
    const settings = await this.settings.get();
    const { count } = await this.prisma.outboundMessage.updateMany({
      where: { id, status: { in: [MessageStatus.FAILED, MessageStatus.CANCELLED] } },
      data: {
        status: settings.mode === 'cloud' ? MessageStatus.PENDING : MessageStatus.MANUAL,
        attempts: 0,
        lastError: null,
        scheduledFor: new Date(),
        expiresAt: null,
      },
    });
    if (!count) throw new NotFoundException('الرسالة دي مش فاشلة');
    return { ok: true };
  }

  @Roles(Role.SUPPORT)
  @Post('admin/messaging/messages/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string) {
    const { count } = await this.prisma.outboundMessage.updateMany({
      where: { id, status: { in: [MessageStatus.PENDING, MessageStatus.MANUAL] } },
      data: { status: MessageStatus.CANCELLED, lastError: 'اتلغت من لوحة التحكم' },
    });
    if (!count) throw new NotFoundException('الرسالة دي مش مستنية إرسال');
    return { ok: true };
  }

  /** Sends this week's parent reports now instead of waiting for the scheduled hour. */
  @Roles(Role.ADMIN)
  @Post('admin/messaging/weekly-report/run')
  @HttpCode(HttpStatus.OK)
  async runWeekly(@CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    await this.assertSending();
    const queued = await this.reports.runWeekly();
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'messaging.weekly_report.run',
      entityType: 'OutboundMessage',
      metadata: { queued },
      ip: req.ip,
    });
    return { queued };
  }

  // --------------------------------------------------------------------------
  // One student's parent report
  // --------------------------------------------------------------------------

  @Roles(Role.SUPPORT)
  @Get('admin/students/:id/parent-report')
  async studentReport(@Param('id') id: string) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, parentPhone: true, parentReportsEnabled: true },
    });
    if (!student || student.role !== Role.STUDENT) throw new NotFoundException('الطالب غير موجود');
    const { from, to } = this.reports.weekWindow(new Date());
    const [preview, latest, messages] = await Promise.all([
      this.reports.build(id, from, to),
      this.prisma.parentReport.findFirst({
        where: { userId: id },
        orderBy: { weekStart: 'desc' },
        select: { token: true, weekStart: true },
      }),
      this.prisma.outboundMessage.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          kind: true,
          audience: true,
          status: true,
          createdAt: true,
          sentAt: true,
        },
      }),
    ]);
    return {
      enabled: student.parentReportsEnabled,
      parentPhone: student.parentPhone,
      preview,
      latestReportUrl: latest ? this.reports.reportUrl(latest.token) : null,
      messages,
    };
  }

  @Roles(Role.SUPPORT)
  @Post('admin/students/:id/parent-report/send')
  @HttpCode(HttpStatus.OK)
  async sendStudentReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.assertSending();
    const student = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!student || student.role !== Role.STUDENT) throw new NotFoundException('الطالب غير موجود');
    const { queued, report } = await this.reports.sendFor(id, { force: true });
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'messaging.parent_report.sent',
      entityType: 'User',
      entityId: id,
      targetUserId: id,
      metadata: { queued },
      ip: req.ip,
    });
    if (!queued) {
      throw new BadRequestException(
        'مقدرناش نجهّز الرسالة. اتأكد إن رقم ولي الأمر صحيح وإن التقرير الأسبوعي شغّال.',
      );
    }
    return { queued, url: report ? this.reports.reportUrl(report.token) : null };
  }

  @Roles(Role.SUPPORT)
  @Patch('admin/students/:id/parent-report')
  async toggleStudentReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ParentReportsToggleDto,
    @Req() req: Request,
  ) {
    const { count } = await this.prisma.user.updateMany({
      where: { id, role: Role.STUDENT },
      data: { parentReportsEnabled: dto.enabled },
    });
    if (!count) throw new NotFoundException('الطالب غير موجود');
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: dto.enabled ? 'user.parent_reports.enabled' : 'user.parent_reports.disabled',
      entityType: 'User',
      entityId: id,
      targetUserId: id,
      ip: req.ip,
    });
    return { enabled: dto.enabled };
  }

  // --------------------------------------------------------------------------
  // The parent's page
  // --------------------------------------------------------------------------

  @Public()
  @Get('reports/:token')
  @ApiOperation({ summary: 'تقرير ولي الأمر الأسبوعي (بلينك سري)' })
  report(@Param('token') token: string) {
    return this.reports.byToken(token);
  }

  private async assertSending() {
    const settings = await this.settings.get();
    if (settings.mode === 'off') {
      throw new BadRequestException('رسائل واتساب مقفولة. فعّلها الأول من «رسائل واتساب».');
    }
    if (!settings.kinds.WEEKLY_REPORT) {
      throw new BadRequestException('التقرير الأسبوعي مقفول. فعّله الأول من «رسائل واتساب».');
    }
  }
}
