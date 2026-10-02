import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { PresenceService } from './presence.service';

class HeartbeatDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  route?: string;
}

@ApiTags('presence')
@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  // Heartbeats are frequent by design; the global limiter would reject them.
  @SkipThrottle()
  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'نبضة تواجد الطالب' })
  async heartbeat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: HeartbeatDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.presence.heartbeat(user.id, dto.route, req.get('user-agent') ?? undefined);
  }

  @SkipThrottle()
  @Post('offline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'إنهاء التواجد' })
  async offline(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.presence.goOffline(user.id);
  }
}
