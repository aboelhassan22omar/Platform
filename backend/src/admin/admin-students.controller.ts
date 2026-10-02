import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import {
  EducationSystem,
  EntitlementScope,
  EntitlementSource,
  EntitlementStatus,
  GradeLevel,
  ProductKind,
  PublishStatus,
  Role,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { AuditService } from '../common/audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

class UpdateStudentStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class GrantAccessDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class GrantLessonAccessDto {
  @IsString()
  lessonId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class RevokeAccessDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}

@ApiTags('admin')
@Roles(Role.SUPPORT)
@Controller('admin/students')
export class AdminStudentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'قائمة الطلاب مع بحث وفلاتر' })
  async list(
    @Query('search') search?: string,
    @Query('system') system?: EducationSystem,
    @Query('grade') grade?: GradeLevel,
    @Query('status') status?: UserStatus,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    const take = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = {
      role: Role.STUDENT,
      ...(system ? { educationSystem: system } : {}),
      ...(grade ? { gradeLevel: grade } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { username: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { parentPhone: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        // passwordHash and tokenVersion are never selected.
        select: {
          id: true,
          fullName: true,
          username: true,
          phone: true,
          parentPhone: true,
          educationSystem: true,
          gradeLevel: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { entitlements: true, orders: true, progress: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page: Number(page) || 1, pageSize: take };
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل طالب' })
  async detail(@Param('id') id: string) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        username: true,
        phone: true,
        parentPhone: true,
        educationSystem: true,
        gradeLevel: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        academicYear: { select: { label: true } },
        entitlements: {
          orderBy: { createdAt: 'desc' },
          include: {
            order: { select: { reference: true, totalMinor: true, paidAt: true } },
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: { plan: { select: { title: true, kind: true } } },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { items: { select: { titleSnapshot: true, totalMinor: true } } },
        },
        progress: {
          orderBy: { lastWatchedAt: 'desc' },
          take: 20,
          include: { lesson: { select: { title: true } } },
        },
      },
    });

    if (!student) throw new NotFoundException('الطالب غير موجود');
    return student;
  }

  @Get(':id/lesson-access')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'الحصص المتاحة والمنح المجانية الخاصة بطالب' })
  async lessonAccess(@Param('id') id: string) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        educationSystem: true,
        gradeLevel: true,
      },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException('الطالب غير موجود');
    }
    if (!student.educationSystem || !student.gradeLevel) {
      throw new BadRequestException('لازم تحدد الصف الدراسي للطالب الأول');
    }

    const now = new Date();
    const [lessons, grants] = await Promise.all([
      this.prisma.lesson.findMany({
        where: {
          status: PublishStatus.PUBLISHED,
          chapter: {
            unit: {
              course: {
                status: PublishStatus.PUBLISHED,
                grade: {
                  educationSystem: student.educationSystem,
                  level: student.gradeLevel,
                },
              },
            },
          },
        },
        orderBy: [
          { chapter: { unit: { course: { grade: { sortOrder: 'asc' } } } } },
          { chapter: { unit: { course: { sortOrder: 'asc' } } } },
          { chapter: { unit: { sortOrder: 'asc' } } },
          { chapter: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
        ],
        select: {
          id: true,
          title: true,
          priceMinor: true,
          chapterId: true,
          chapter: {
            select: {
              title: true,
              unit: {
                select: {
                  title: true,
                  course: {
                    select: {
                      id: true,
                      title: true,
                      gradeId: true,
                      academicYearId: true,
                      grade: { select: { nameAr: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.entitlement.findMany({
        where: {
          userId: id,
          status: EntitlementStatus.ACTIVE,
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: {
          id: true,
          scope: true,
          source: true,
          lessonId: true,
          chapterId: true,
          courseId: true,
          gradeId: true,
          academicYearId: true,
        },
      }),
    ]);

    return lessons.map((lesson) => {
      const course = lesson.chapter.unit.course;
      const coveringGrant = grants.find(
        (grant) =>
          (grant.scope === EntitlementScope.LESSON && grant.lessonId === lesson.id) ||
          (grant.scope === EntitlementScope.CHAPTER && grant.chapterId === lesson.chapterId) ||
          (grant.scope === EntitlementScope.COURSE && grant.courseId === course.id) ||
          ((grant.scope === EntitlementScope.GRADE_MONTHLY ||
            grant.scope === EntitlementScope.GRADE_YEARLY) &&
            grant.gradeId === course.gradeId &&
            grant.academicYearId === course.academicYearId),
      );
      const directAdminGrant = grants.find(
        (grant) =>
          grant.scope === EntitlementScope.LESSON &&
          grant.lessonId === lesson.id &&
          grant.source === EntitlementSource.ADMIN_GRANT,
      );

      return {
        id: lesson.id,
        title: lesson.title,
        priceMinor: lesson.priceMinor,
        chapterTitle: lesson.chapter.title,
        unitTitle: lesson.chapter.unit.title,
        courseId: course.id,
        courseTitle: course.title,
        gradeName: course.grade.nameAr,
        isAccessible: Boolean(coveringGrant),
        accessKind: directAdminGrant
          ? 'ADMIN_GRANT'
          : coveringGrant
            ? 'OTHER'
            : 'NONE',
        adminGrantEntitlementId: directAdminGrant?.id ?? null,
      };
    });
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'إيقاف أو تفعيل حساب طالب' })
  async setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentStatusDto,
    @Req() req: Request,
  ) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
    if (!student) throw new NotFoundException('الطالب غير موجود');
    if (student.role !== Role.STUDENT) {
      throw new BadRequestException('لا يمكن تعديل حسابات الطاقم من هنا');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          status: dto.status,
          // Suspending must take effect immediately, not when the access
          // token happens to expire.
          ...(dto.status === UserStatus.SUSPENDED
            ? { tokenVersion: { increment: 1 } }
            : {}),
        },
        select: { id: true, status: true },
      });

      if (dto.status === UserStatus.SUSPENDED) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await this.audit.record(tx, {
        actorId: actor.id,
        action: dto.status === UserStatus.SUSPENDED ? 'student.suspend' : 'student.reactivate',
        entityType: 'User',
        entityId: id,
        targetUserId: id,
        metadata: { from: student.status, to: dto.status, reason: dto.reason },
        ip: req.ip,
      });

      return user;
    });

    return updated;
  }

  /**
   * Manual entitlement grant, for support cases such as a payment that
   * cleared out-of-band. Recorded in the audit log with the acting admin.
   */
  @Post(':id/entitlements')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'منح وصول يدوي لطالب' })
  async grant(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GrantAccessDto,
    @Req() req: Request,
  ) {
    const [student, product] = await Promise.all([
      this.prisma.user.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.product.findUnique({ where: { id: dto.productId } }),
    ]);

    if (!student) throw new NotFoundException('الطالب غير موجود');
    if (!product) throw new NotFoundException('المنتج غير موجود');

    return this.prisma.$transaction(async (tx) => {
      const result = await this.entitlements.grantForProduct(tx, {
        userId: id,
        product: {
          kind: product.kind,
          lessonId: product.lessonId,
          chapterId: product.chapterId,
          courseId: product.courseId,
          planId: product.planId,
        },
        source: EntitlementSource.ADMIN_GRANT,
        grantedById: actor.id,
      });

      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'entitlement.grant',
        entityType: 'Entitlement',
        entityId: result.entitlementId,
        targetUserId: id,
        metadata: {
          productId: product.id,
          productTitle: product.title,
          reason: dto.reason,
          created: result.created,
        },
        ip: req.ip,
      });

      return result;
    });
  }

  @Post(':id/lesson-entitlements')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'فتح حصة مجاناً لطالب واحد' })
  async grantLesson(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GrantLessonAccessDto,
    @Req() req: Request,
  ) {
    const [student, lesson] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
          educationSystem: true,
          gradeLevel: true,
        },
      }),
      this.prisma.lesson.findUnique({
        where: { id: dto.lessonId },
        select: {
          id: true,
          title: true,
          status: true,
          chapter: {
            select: {
              unit: {
                select: {
                  course: {
                    select: {
                      status: true,
                      grade: { select: { educationSystem: true, level: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException('الطالب غير موجود');
    }
    if (!student.educationSystem || !student.gradeLevel) {
      throw new BadRequestException('لازم تحدد الصف الدراسي للطالب الأول');
    }
    if (!lesson || lesson.status !== PublishStatus.PUBLISHED ||
        lesson.chapter.unit.course.status !== PublishStatus.PUBLISHED) {
      throw new NotFoundException('الحصة غير موجودة أو غير منشورة');
    }
    if (
      lesson.chapter.unit.course.grade.educationSystem !== student.educationSystem ||
      lesson.chapter.unit.course.grade.level !== student.gradeLevel
    ) {
      throw new BadRequestException('لا يمكن فتح حصة من صف دراسي مختلف للطالب');
    }

    const access = await this.entitlements.checkLessonAccess(id, lesson.id);
    if (access.allowed) {
      throw new BadRequestException('الحصة متاحة للطالب بالفعل');
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await this.entitlements.grantForProduct(tx, {
        userId: id,
        product: {
          kind: ProductKind.LESSON,
          lessonId: lesson.id,
          chapterId: null,
          courseId: null,
          planId: null,
        },
        source: EntitlementSource.ADMIN_GRANT,
        grantedById: actor.id,
      });

      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'lesson.free_access.grant',
        entityType: 'Entitlement',
        entityId: result.entitlementId,
        targetUserId: id,
        metadata: { lessonId: lesson.id, lessonTitle: lesson.title, reason: dto.reason },
        ip: req.ip,
      });

      return result;
    });
  }

  @Patch('entitlements/:entitlementId/revoke')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'سحب وصول من طالب' })
  async revoke(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('entitlementId') entitlementId: string,
    @Body() dto: RevokeAccessDto,
    @Req() req: Request,
  ) {
    const entitlement = await this.prisma.entitlement.findUnique({
      where: { id: entitlementId },
      select: { id: true, userId: true, scope: true },
    });
    if (!entitlement) throw new NotFoundException('التصريح غير موجود');

    await this.entitlements.revoke(entitlementId, actor.id, dto.reason);
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'entitlement.revoke',
      entityType: 'Entitlement',
      entityId: entitlementId,
      targetUserId: entitlement.userId,
      metadata: { scope: entitlement.scope, reason: dto.reason },
      ip: req.ip,
    });

    return { ok: true };
  }
}
