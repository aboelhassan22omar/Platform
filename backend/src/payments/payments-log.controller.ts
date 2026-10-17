import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '../generated/prisma/client';
import { OrderStatus, PaymentStatus, Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { Roles } from '../common/decorators';

/**
 * Read-only ledger of what was actually paid: who, how much, for what, how and
 * when. Rows come from PAID orders only, so an abandoned checkout or a failed
 * attempt never appears as income.
 */
@ApiTags('admin')
@Roles(Role.ADMIN)
@Controller('admin/payments')
export class PaymentsLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'سجل المدفوعات' })
  async list(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    const take = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const term = search?.trim();

    const where: Prisma.OrderWhereInput = {
      status: OrderStatus.PAID,
      ...(term
        ? {
            OR: [
              { reference: { contains: term, mode: 'insensitive' } },
              { user: { fullName: { contains: term, mode: 'insensitive' } } },
              { user: { username: { contains: term, mode: 'insensitive' } } },
              { user: { phone: { contains: term } } },
              { items: { some: { titleSnapshot: { contains: term, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [orders, total, cash] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: (currentPage - 1) * take,
        take,
        select: {
          id: true,
          reference: true,
          totalMinor: true,
          discountMinor: true,
          currency: true,
          purpose: true,
          paidFromWallet: true,
          paidAt: true,
          user: { select: { fullName: true, username: true, phone: true } },
          items: { select: { titleSnapshot: true, kindSnapshot: true } },
          payments: {
            where: { status: PaymentStatus.SUCCEEDED },
            select: { provider: true, method: true },
            take: 1,
          },
        },
      }),
      this.prisma.order.count({ where }),
      // Balance purchases are spending of money already counted at top-up.
      this.prisma.order.aggregate({
        where: { AND: [where, { paidFromWallet: false }] },
        _sum: { totalMinor: true },
      }),
    ]);

    return {
      items: orders.map(({ payments, ...order }) => ({
        ...order,
        provider: payments[0]?.provider ?? null,
        method: payments[0]?.method ?? null,
      })),
      total,
      page: currentPage,
      pageSize: take,
      totalPaidMinor: cash._sum.totalMinor ?? 0,
    };
  }
}
