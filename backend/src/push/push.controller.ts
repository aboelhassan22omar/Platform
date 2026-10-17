import { Body, Controller, Delete, Get, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { CurrentUser, Public } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { PushService } from './push.service';

class PushKeysDto {
  @IsString() @MaxLength(200) p256dh!: string;
  @IsString() @MaxLength(100) auth!: string;
}

class SubscribeDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'اشتراك غير صالح' })
  @MaxLength(1000)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

class UnsubscribeDto {
  @IsString() @MaxLength(1000) endpoint!: string;
}

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** The browser needs it to subscribe; it is public by design. */
  @Public()
  @Get('public-key')
  async publicKey() {
    return { publicKey: (await this.push.vapidKeys()).publicKey };
  }

  @Get('status')
  @ApiOperation({ summary: 'هل إشعارات الموبايل شغالة' })
  async status(@CurrentUser() user: AuthenticatedUser) {
    return { devices: await this.push.count(user.id) };
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'تشغيل إشعارات الموبايل على الجهاز ده' })
  subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscribeDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.push.subscribe(user.id, dto, userAgent);
  }

  @Delete('subscriptions')
  unsubscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(user.id, dto.endpoint);
  }
}
