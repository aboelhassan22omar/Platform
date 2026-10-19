import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Response } from 'express';
import { Role } from '../generated/prisma/enums';
import { CurrentUser, Public } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { OfflineDownloadsService } from './offline-downloads.service';

class OfflineSyncItemDto {
  @IsString() @MaxLength(64) lessonId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(7 * 86_400)
  watchedSeconds!: number;
}

class OfflineSyncDto {
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => OfflineSyncItemDto)
  items!: OfflineSyncItemDto[];
}

/** Lessons saved on the phone by the store apps (see OfflineDownloadsService). */
@ApiTags('videos')
@Controller('videos')
export class OfflineDownloadsController {
  constructor(private readonly offline: OfflineDownloadsService) {}

  @Post('offline/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'مراجعة الحصص المحفوظة على الموبايل وحساب المشاهدة بدون نت' })
  sync(@CurrentUser() user: AuthenticatedUser, @Body() dto: OfflineSyncDto) {
    return this.offline.sync(user.id, dto.items, { isStaff: user.role !== Role.STUDENT });
  }

  @Post(':lessonId/offline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تنزيل الحصة على الموبايل للمشاهدة بدون نت' })
  request(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.offline.request(user.id, lessonId, { isStaff: user.role !== Role.STUDENT });
  }

  @Delete(':lessonId/offline')
  forget(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.offline.forget(user.id, lessonId);
  }

  /** Fetched by the app's native downloader, which sends no cookie: the ticket is the key. */
  @Public()
  @Get(':lessonId/offline/file')
  @ApiExcludeEndpoint()
  async file(
    @Param('lessonId') lessonId: string,
    @Query('ticket') ticket: string,
    @Res() res: Response,
  ) {
    if (!ticket) throw new ForbiddenException('رابط التنزيل غير صالح');
    const { stream, sizeBytes } = await this.offline.file(lessonId, ticket);
    res.setHeader('Content-Type', 'video/mp4');
    if (sizeBytes) res.setHeader('Content-Length', String(sizeBytes));
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Disposition', 'attachment; filename="lesson.mp4"');
    stream.pipe(res);
  }
}
