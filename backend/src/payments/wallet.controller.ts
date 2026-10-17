import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  NotEquals,
} from 'class-validator';
import type { Request } from 'express';
import { PaymentMethod, Role } from '../generated/prisma/enums';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { WalletService } from '../wallet/wallet.service';
import { OrdersService } from './orders.service';

class TopUpDto {
  @Type(() => Number)
  @IsInt({ message: 'اكتب مبلغ الشحن صح' })
  amountMinor!: number;

  @IsOptional()
  @IsIn([PaymentMethod.WALLET, PaymentMethod.CARD], {
    message: 'اشحن بفودافون كاش أو إنستا باي',
  })
  method?: PaymentMethod;
}

class AdjustWalletDto {
  /** Signed piastres: positive adds, negative removes. */
  @Type(() => Number)
  @IsInt({ message: 'اكتب مبلغ صحيح' })
  @NotEquals(0, { message: 'المبلغ مينفعش يكون صفر' })
  amountMinor!: number;

  @IsString()
  @MinLength(3, { message: 'اكتب سبب واضح، الطالب هيشوفه' })
  @MaxLength(200)
  note!: string;
}

@ApiTags('wallet')
@Controller()
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly orders: OrdersService,
  ) {}

  @Get('wallet')
  @ApiOperation({ summary: 'رصيدي وكشف الحساب' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.summary(user.id);
  }

  @Post('wallet/topups')
  @ApiOperation({ summary: 'شحن رصيد المحفظة' })
  topUp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TopUpDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orders.createTopUp({
      userId: user.id,
      amountMinor: dto.amountMinor,
      method: dto.method,
      idempotencyKey,
    });
  }

  @Roles(Role.SUPPORT)
  @Get('admin/students/:id/wallet')
  @ApiOperation({ summary: 'رصيد طالب وكشف حسابه' })
  forStudent(@Param('id') id: string) {
    return this.wallet.summary(id, 100);
  }

  @Roles(Role.ADMIN)
  @Post('admin/students/:id/wallet/adjust')
  @ApiOperation({ summary: 'إضافة أو خصم رصيد يدويًا' })
  adjust(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdjustWalletDto,
    @Req() req: Request,
  ) {
    return this.wallet.adjustByStaff({
      actorId: actor.id,
      userId: id,
      amountMinor: dto.amountMinor,
      note: dto.note.trim(),
      ip: req.ip,
    });
  }
}
