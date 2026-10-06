import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { DiscountType, ProductKind, Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { AuditService } from '../common/audit/audit.service';

class UpsertPlanDto {
  @IsString() gradeId!: string;
  @IsOptional() @IsString() academicYearId?: string;
  @IsEnum(ProductKind) kind!: ProductKind;
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(160) titleEn?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(1000) descriptionEn?: string;
  /** Price in piastres. 12000 = 120.00 ج.م */
  @IsInt() @Min(0) priceMinor!: number;
  @IsOptional() @IsInt() @Min(1) durationDays?: number;
  @IsOptional() @IsDateString() accessUntil?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) highlightsEn?: string[];
}

class UpsertCouponDto {
  @IsString() @MinLength(3) @MaxLength(32) code!: string;
  @IsEnum(DiscountType) discountType!: DiscountType;
  @IsInt() @Min(1) discountValue!: number;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsInt() @Min(1) maxPerUser?: number;
  @IsOptional() @IsInt() @Min(0) minOrderMinor?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('admin')
@Roles(Role.ADMIN)
@Controller('admin/pricing')
export class AdminPricingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Plans (monthly / yearly packages)
  // -------------------------------------------------------------------------

  @Get('plans')
  @ApiOperation({ summary: 'كل الباقات' })
  listPlans() {
    return this.prisma.plan.findMany({
      orderBy: [{ gradeId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        grade: { select: { nameAr: true, slug: true } },
        academicYear: { select: { label: true } },
        products: { select: { id: true, isActive: true } },
        _count: { select: { subscriptions: true } },
      },
    });
  }

  @Post('plans')
  @ApiOperation({ summary: 'إنشاء باقة' })
  async createPlan(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpsertPlanDto,
    @Req() req: Request,
  ) {
    const academicYearId =
      dto.academicYearId ??
      (
        await this.prisma.academicYear.findFirstOrThrow({
          where: { isCurrent: true },
          select: { id: true },
        })
      ).id;

    // A plan without a duration would grant access that never ends; the DB
    // CHECK enforces this too, this is just the friendlier error.
    const durationDays =
      dto.durationDays ??
      (dto.accessUntil ? undefined : dto.kind === ProductKind.YEARLY_PLAN ? 365 : 30);

    const plan = await this.prisma.plan.create({
      data: {
        gradeId: dto.gradeId,
        academicYearId,
        kind: dto.kind,
        title: dto.title,
        titleEn: dto.titleEn,
        description: dto.description,
        descriptionEn: dto.descriptionEn,
        priceMinor: dto.priceMinor,
        durationDays,
        accessUntil: dto.accessUntil ? new Date(dto.accessUntil) : null,
        isActive: dto.isActive ?? false,
        sortOrder: dto.sortOrder ?? 0,
        highlights: dto.highlights ?? [],
        highlightsEn: dto.highlightsEn ?? [],
        // Every plan gets its matching Product so it can be checked out.
        products: {
          create: {
            kind: dto.kind,
            title: dto.title,
            titleEn: dto.titleEn,
            description: dto.description,
            descriptionEn: dto.descriptionEn,
            priceMinor: dto.priceMinor,
            isActive: dto.isActive ?? false,
          },
        },
      },
      include: { products: true },
    });

    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'plan.create',
      entityType: 'Plan',
      entityId: plan.id,
      metadata: { title: plan.title, priceMinor: plan.priceMinor },
      ip: req.ip,
    });

    return plan;
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'تعديل باقة' })
  async updatePlan(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: Partial<UpsertPlanDto>,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.plan.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!existing) throw new NotFoundException('الباقة غير موجودة');

    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.descriptionEn !== undefined ? { descriptionEn: dto.descriptionEn || null } : {}),
        ...(dto.priceMinor !== undefined ? { priceMinor: dto.priceMinor } : {}),
        ...(dto.durationDays !== undefined ? { durationDays: dto.durationDays } : {}),
        ...(dto.accessUntil !== undefined
          ? { accessUntil: dto.accessUntil ? new Date(dto.accessUntil) : null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.highlights ? { highlights: dto.highlights } : {}),
        ...(dto.highlightsEn ? { highlightsEn: dto.highlightsEn } : {}),
      },
    });

    // Mirror onto the Product. Existing orders keep their snapshotted price.
    const product = existing.products[0];
    if (product) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          ...(dto.title ? { title: dto.title } : {}),
          ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn || null } : {}),
          ...(dto.descriptionEn !== undefined ? { descriptionEn: dto.descriptionEn || null } : {}),
          ...(dto.priceMinor !== undefined ? { priceMinor: dto.priceMinor } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    }

    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'plan.update',
      entityType: 'Plan',
      entityId: id,
      metadata: { changed: Object.keys(dto) },
      ip: req.ip,
    });

    return plan;
  }

  // -------------------------------------------------------------------------
  // Coupons
  // -------------------------------------------------------------------------

  @Get('coupons')
  @ApiOperation({ summary: 'أكواد الخصم' })
  listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
  }

  @Post('coupons')
  @ApiOperation({ summary: 'إنشاء كود خصم' })
  async createCoupon(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpsertCouponDto,
    @Req() req: Request,
  ) {
    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxRedemptions: dto.maxRedemptions,
        maxPerUser: dto.maxPerUser ?? 1,
        minOrderMinor: dto.minOrderMinor,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'coupon.create',
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code },
      ip: req.ip,
    });

    return coupon;
  }

  @Patch('coupons/:id')
  @ApiOperation({ summary: 'تعديل كود خصم' })
  updateCoupon(@Param('id') id: string, @Body() dto: Partial<UpsertCouponDto>) {
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.maxRedemptions !== undefined ? { maxRedemptions: dto.maxRedemptions } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Product catalogue
  // -------------------------------------------------------------------------

  @Get('products')
  @ApiOperation({ summary: 'كل المنتجات القابلة للشراء' })
  listProducts() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        lesson: { select: { title: true } },
        chapter: { select: { title: true } },
        course: { select: { title: true } },
        plan: { select: { title: true } },
      },
    });
  }
}
