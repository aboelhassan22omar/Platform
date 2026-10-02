import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/enums';

export class CreateCheckoutDto {
  @ApiProperty({ type: [String], description: 'معرفات المنتجات المطلوب شراؤها' })
  @IsArray()
  @ArrayNotEmpty({ message: 'اختار حاجة الأول' })
  @ArrayMaxSize(20, { message: 'أقصى عدد 20 عنصر في الطلب الواحد' })
  @IsString({ each: true })
  productIds!: string[];

  @ApiPropertyOptional({ description: 'كود الخصم' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ enum: [PaymentMethod.WALLET, PaymentMethod.CARD] })
  @IsOptional()
  @IsIn([PaymentMethod.WALLET, PaymentMethod.CARD], {
    message: 'طريقة الدفع المتاحة هي المحفظة الإلكترونية أو إنستا باي فقط',
  })
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'مفتاح منع التكرار' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
