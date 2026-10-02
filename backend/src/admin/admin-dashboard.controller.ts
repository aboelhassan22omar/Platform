import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums';
import { Roles } from '../common/decorators';
import { AuditService } from '../common/audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PresenceService } from '../presence/presence.service';

/** Resolves a `days` query parameter into a UTC date range. */
const rangeFromDays = (days?: string) => {
  const span = Math.min(Math.max(Number(days) || 30, 1), 365);
  const to = new Date();
  const from = new Date(to.getTime() - span * 86_400_000);
  return { from, to, days: span };
};

@ApiTags('admin')
@Roles(Role.SUPPORT)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly presence: PresenceService,
    private readonly audit: AuditService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'مؤشرات لوحة التحكم الرئيسية' })
  overview() {
    return this.analytics.overview();
  }

  @Get('online')
  @ApiOperation({ summary: 'الطلاب المتواجدون الآن' })
  online() {
    return this.presence.onlineBreakdown();
  }

  @Get('online/recent')
  @ApiOperation({ summary: 'آخر نشاط للطلاب المتواجدين' })
  recent(@Query('limit') limit?: string) {
    return this.presence.recentlyActive(Math.min(Number(limit) || 20, 100));
  }

  @Get('registrations')
  @ApiOperation({ summary: 'التسجيلات عبر الزمن' })
  registrations(@Query('days') days?: string) {
    return this.analytics.registrationsOverTime(rangeFromDays(days));
  }

  @Get('sales')
  @ApiOperation({ summary: 'المبيعات والإيرادات عبر الزمن' })
  sales(@Query('days') days?: string) {
    return this.analytics.salesOverTime(rangeFromDays(days));
  }

  @Get('popular-courses')
  @ApiOperation({ summary: 'أكثر الكورسات مبيعًا' })
  popular(@Query('limit') limit?: string) {
    return this.analytics.popularCourses(Math.min(Number(limit) || 8, 30));
  }

  @Get('engagement')
  @ApiOperation({ summary: 'تفاعل الطلاب مع الحصص' })
  engagement(@Query('limit') limit?: string) {
    return this.analytics.lessonEngagement(Math.min(Number(limit) || 15, 50));
  }

  @Get('recent-orders')
  @ApiOperation({ summary: 'آخر الطلبات المدفوعة' })
  recentOrders(@Query('limit') limit?: string) {
    return this.analytics.recentOrders(Math.min(Number(limit) || 10, 50));
  }

  @Get('audit')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'سجل العمليات الإدارية' })
  auditLog(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
  ) {
    return this.audit.list({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
      action,
    });
  }
}
