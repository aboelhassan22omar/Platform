import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductKind,
  SubscriptionStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { computeDiscountMinor, generateOrderReference } from '../common/utils';
import { PAYMENT_PROVIDER } from './payments.constants';
import { lessonPriceFor } from '../common/utils/lesson-pricing';
import type { IPaymentProvider, VerifiedWebhook } from './providers/payment-provider.interface';

export interface CreateOrderParams {
  userId: string;
  productIds: string[];
  couponCode?: string;
  method?: PaymentMethod;
  idempotencyKey?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: IPaymentProvider,
  ) {}

  // --------------------------------------------------------------------------
  // Checkout
  // --------------------------------------------------------------------------

  /**
   * Creates an order and a provider checkout session.
   *
   * Prices are read from the database, never from the request — a client that
   * posts its own price is simply ignored. Amounts are snapshotted onto the
   * order lines so a later admin price change cannot rewrite history.
   */
  async createOrder(params: CreateOrderParams) {
    const { userId, productIds } = params;
    if (!productIds.length) throw new BadRequestException('مفيش حاجة في طلبك');
    const method = params.method ?? PaymentMethod.WALLET;
    if (method !== PaymentMethod.WALLET && method !== PaymentMethod.CARD) {
      throw new BadRequestException('طريقة الدفع المتاحة هي المحفظة الإلكترونية أو إنستا باي فقط');
    }

    // A retried checkout returns the original order rather than a second one.
    if (params.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
        include: { items: true, payments: true },
      });
      if (existing) return this.presentOrder(existing, null);
    }

    const storedProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { plan: true, lesson: true },
    });

    if (storedProducts.length !== productIds.length) {
      throw new BadRequestException('في حاجة في طلبك مش متاحة دلوقتي');
    }

    const pricingUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { studentType: true },
    });
    const products = storedProducts.map((product) => {
      const priceMinor =
        product.kind === ProductKind.LESSON && product.lesson
          ? lessonPriceFor(product.lesson, pricingUser.studentType)
          : product.priceMinor;
      if (product.kind === ProductKind.LESSON && (priceMinor === null || priceMinor <= 0))
        throw new BadRequestException('الحصة مجانية لحسابك أو غير متاحة للبيع منفردة');
      return { ...product, priceMinor: priceMinor ?? product.priceMinor };
    });
    await this.assertNotAlreadyOwned(userId, products);

    const subtotalMinor = products.reduce((sum, p) => sum + p.priceMinor, 0);
    const coupon = params.couponCode
      ? await this.resolveCoupon(params.couponCode, userId, subtotalMinor)
      : null;

    const discountMinor = coupon
      ? computeDiscountMinor(subtotalMinor, coupon.discountType, coupon.discountValue)
      : 0;
    const totalMinor = subtotalMinor - discountMinor;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, fullName: true, phone: true },
    });

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          reference: generateOrderReference(),
          status: OrderStatus.PENDING,
          subtotalMinor,
          discountMinor,
          totalMinor,
          currency: this.config.get<string>('payments.currency')!,
          couponId: coupon?.id ?? null,
          idempotencyKey: params.idempotencyKey ?? null,
          items: {
            create: products.map((product) => ({
              productId: product.id,
              titleSnapshot: product.title,
              kindSnapshot: product.kind,
              unitPriceMinor: product.priceMinor,
              quantity: 1,
              totalMinor: product.priceMinor,
            })),
          },
        },
        include: { items: true, payments: true },
      });

      if (coupon) {
        await tx.couponRedemption.create({
          data: { couponId: coupon.id, userId, orderId: created.id },
        });
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { redemptionCount: { increment: 1 } },
        });
      }

      return created;
    });

    // A zero-cost order (100% coupon) has nothing to charge, so it is settled
    // immediately rather than sent to the provider.
    if (totalMinor === 0) {
      await this.settleOrder(order.id, {
        eventId: `free_${order.id}`,
        eventType: 'free.order',
        providerRef: `free_${order.id}`,
        orderReference: order.reference,
        succeeded: true,
        amountMinor: 0,
        method: PaymentMethod.MANUAL,
        raw: { reason: 'zero-cost order' },
      });
      const settled = await this.findOrderById(order.id);
      return this.presentOrder(settled!, null);
    }

    const session = await this.provider.createCheckout({
      orderId: order.id,
      reference: order.reference,
      amountMinor: totalMinor,
      currency: order.currency,
      method,
      customer: { id: user.id, fullName: user.fullName, phone: user.phone },
      returnUrl: `${this.config.get<string>('publicSiteUrl')}/checkout/return?ref=${order.reference}`,
    });

    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: this.provider.key,
          method,
          status: PaymentStatus.PENDING,
          amountMinor: totalMinor,
          currency: order.currency,
          providerRef: session.providerRef,
        },
      }),
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.AWAITING_PAYMENT },
      }),
    ]);

    const refreshed = await this.findOrderById(order.id);
    return this.presentOrder(refreshed!, session.redirectUrl, session.isSandbox);
  }

  /**
   * Refuses to sell something the student already has. Without this a student
   * could pay twice for one lesson and the idempotent grant would silently
   * swallow the second entitlement — taking their money for nothing.
   */
  private async assertNotAlreadyOwned(
    userId: string,
    products: Array<{
      kind: ProductKind;
      lessonId: string | null;
      assessmentId: string | null;
      title: string;
    }>,
  ): Promise<void> {
    const lessonIds = products
      .filter((p) => p.kind === ProductKind.LESSON && p.lessonId)
      .map((p) => p.lessonId!);

    const assessmentIds = products
      .filter((p) => p.kind === ProductKind.ASSESSMENT && p.assessmentId)
      .map((p) => p.assessmentId!);
    if (assessmentIds.length) {
      const owned = await this.prisma.entitlement.count({
        where: { userId, assessmentId: { in: assessmentIds }, status: 'ACTIVE' },
      });
      if (owned) throw new BadRequestException('إنت بالفعل عندك وصول للمحتوى ده');
    }
    if (!lessonIds.length) return;

    const accessible = await this.entitlements.filterAccessibleLessonIds(userId, lessonIds);
    if (accessible.size) {
      throw new BadRequestException('إنت بالفعل عندك وصول للمحتوى ده');
    }
  }

  private async resolveCoupon(code: string, userId: string, subtotalMinor: number) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: { equals: code.trim(), mode: 'insensitive' }, isActive: true },
    });

    if (!coupon) throw new BadRequestException('كود الخصم غير صحيح');

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('كود الخصم لسه مبدأش');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('كود الخصم انتهت صلاحيته');
    }
    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new BadRequestException('كود الخصم خلص');
    }
    if (coupon.minOrderMinor && subtotalMinor < coupon.minOrderMinor) {
      throw new BadRequestException('قيمة الطلب أقل من الحد الأدنى للكوبون');
    }

    const usedByUser = await this.prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    });
    if (usedByUser >= coupon.maxPerUser) {
      throw new BadRequestException('إنت استخدمت الكود ده قبل كده');
    }

    return coupon;
  }

  // --------------------------------------------------------------------------
  // Settlement
  // --------------------------------------------------------------------------

  /**
   * Marks an order paid and grants everything it bought — atomically.
   *
   * The whole thing is one transaction, so it is impossible to end up with a
   * PAID order whose entitlements were never created, or entitlements for an
   * order that was not actually paid.
   *
   * Safe to call repeatedly with the same webhook: an already-PAID order
   * returns early, and each grant is itself idempotent.
   */
  async settleOrder(orderId: string, event: VerifiedWebhook): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: { include: { plan: true } } } } },
      });

      if (!order) throw new NotFoundException('الطلب غير موجود');

      if (order.status === OrderStatus.PAID) {
        this.logger.log(`Order ${order.reference} already settled; ignoring replay`);
        return;
      }

      if (!event.succeeded) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED },
        });
        await tx.payment.updateMany({
          where: { orderId: order.id, providerRef: event.providerRef },
          data: {
            status: PaymentStatus.FAILED,
            failureReason: event.failureReason?.slice(0, 500),
          },
        });
        return;
      }

      // The provider must have charged what we asked for. A mismatch means
      // either tampering or a provider bug; either way, do not grant access.
      if (typeof event.amountMinor === 'number' && event.amountMinor !== order.totalMinor) {
        this.logger.error(
          `Amount mismatch on ${order.reference}: expected ${order.totalMinor}, got ${event.amountMinor}`,
        );
        throw new BadRequestException('قيمة الدفع لا تطابق قيمة الطلب');
      }

      const paidAt = new Date();

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID, paidAt },
      });

      await tx.payment.upsert({
        where: {
          provider_providerRef: {
            provider: this.provider.key,
            providerRef: event.providerRef,
          },
        },
        create: {
          orderId: order.id,
          provider: this.provider.key,
          method: event.method ?? PaymentMethod.CARD,
          status: PaymentStatus.SUCCEEDED,
          amountMinor: order.totalMinor,
          currency: order.currency,
          providerRef: event.providerRef,
          providerPayload: event.raw as Prisma.InputJsonValue,
          paidAt,
        },
        update: {
          status: PaymentStatus.SUCCEEDED,
          method: event.method ?? PaymentMethod.CARD,
          paidAt,
          providerPayload: event.raw as Prisma.InputJsonValue,
        },
      });

      for (const item of order.items) {
        const { entitlementId, created } = await this.entitlements.grantForProduct(tx, {
          userId: order.userId,
          product: {
            kind: item.product.kind,
            lessonId: item.product.lessonId,
            chapterId: item.product.chapterId,
            courseId: item.product.courseId,
            planId: item.product.planId,
            assessmentId: item.product.assessmentId,
          },
          orderId: order.id,
        });

        // A plan purchase also produces a Subscription row, which is what the
        // "اشتراكاتي" screen and the admin's active-subscription count read.
        if (item.product.plan) {
          const entitlement = await tx.entitlement.findUniqueOrThrow({
            where: { id: entitlementId },
            select: { startsAt: true, expiresAt: true },
          });

          await tx.subscription.create({
            data: {
              userId: order.userId,
              planId: item.product.plan.id,
              orderId: order.id,
              status: SubscriptionStatus.ACTIVE,
              startsAt: entitlement.startsAt,
              expiresAt: entitlement.expiresAt ?? new Date(Date.now() + 30 * 86_400_000),
            },
          });
        }

        this.logger.log(
          `Order ${order.reference}: ${created ? 'granted' : 'reused'} entitlement ${entitlementId}`,
        );
      }

      await tx.notification.create({
        data: {
          userId: order.userId,
          kind: 'PURCHASE',
          title: 'تم تفعيل اشتراكك 🎉',
          body: `طلبك رقم ${order.reference} اتفعّل، تقدر تبدأ تذاكر دلوقتي.`,
          href: '/dashboard/lessons',
        },
      });
    });
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  private findOrderById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
  }

  async findByReference(reference: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { reference },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    // A student may only read their own orders.
    if (userId && order.userId !== userId) throw new NotFoundException('الطلب غير موجود');
    return this.presentOrder(order, null);
  }

  async listForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, payments: true },
      take: 50,
    });
    return orders.map((order) => this.presentOrder(order, null));
  }

  async listSubscriptions(userId: string) {
    const now = new Date();
    return this.prisma.subscription
      .findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { include: { grade: true } },
          order: { select: { reference: true, totalMinor: true, paidAt: true } },
        },
      })
      .then((subs) =>
        subs.map((sub) => ({
          ...sub,
          isActive: sub.status === SubscriptionStatus.ACTIVE && sub.expiresAt > now,
          daysRemaining: Math.max(
            0,
            Math.ceil((sub.expiresAt.getTime() - now.getTime()) / 86_400_000),
          ),
        })),
      );
  }

  private presentOrder(
    order: Prisma.OrderGetPayload<{ include: { items: true; payments: true } }>,
    redirectUrl: string | null,
    isSandbox = this.provider.isSandbox,
  ) {
    return {
      id: order.id,
      reference: order.reference,
      status: order.status,
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      totalMinor: order.totalMinor,
      currency: order.currency,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      items: order.items.map((item) => ({
        id: item.id,
        title: item.titleSnapshot,
        kind: item.kindSnapshot,
        totalMinor: item.totalMinor,
      })),
      redirectUrl,
      payment: {
        provider: this.provider.key,
        isSandbox,
        ...(isSandbox
          ? {
              notice: 'وضع تجريبي: لا تتم أي عملية دفع حقيقية. هذا الوضع للتطوير والاختبار فقط.',
            }
          : {}),
      },
    };
  }

  /** Housekeeping: mark subscriptions whose window has closed as EXPIRED. */
  async expireLapsedSubscriptions(): Promise<number> {
    const { count } = await this.prisma.subscription.updateMany({
      where: { status: SubscriptionStatus.ACTIVE, expiresAt: { lte: new Date() } },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    return count;
  }
}
