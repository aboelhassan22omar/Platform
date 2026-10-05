import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../generated/prisma/enums';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { LiveService } from './live.service';
import {
  CreateLiveSessionDto,
  LiveChatMessageDto,
  LiveChatToggleDto,
  LiveReactionDto,
  UpdateLiveSessionDto,
} from './live.dto';

/** What a signed-in student (or the teacher) does around a live class. */
@ApiTags('live')
@Controller('live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Get('upcoming')
  @ApiOperation({ summary: 'اللايفات الجاية أو الشغالة لصف الطالب' })
  upcoming(@CurrentUser() user: AuthenticatedUser) {
    return this.live.upcomingFor(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل لايف' })
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.live.detail(user, id);
  }

  @Post(':id/token')
  @ApiOperation({ summary: 'تذكرة دخول غرفة البث' })
  token(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.live.token(user, id);
  }

  @Get(':id/chat')
  @ApiOperation({ summary: 'آخر رسائل الشات' })
  chat(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.live.chatHistory(user, id);
  }

  @Post(':id/chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'إرسال رسالة في الشات' })
  send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: LiveChatMessageDto) {
    return this.live.postChat(user, id, dto.body);
  }

  @Post(':id/reactions')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'إرسال رياكشن' })
  react(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: LiveReactionDto) {
    return this.live.react(user, id, dto.emoji);
  }
}

/** The teacher's side: scheduling, going on air, and moderating. */
@ApiTags('admin')
@Roles(Role.CONTENT_MANAGER)
@Controller('admin/live')
export class AdminLiveController {
  constructor(private readonly live: LiveService) {}

  @Get()
  @ApiOperation({ summary: 'كل اللايفات' })
  list() {
    return this.live.listForAdmin();
  }

  @Post()
  @ApiOperation({ summary: 'جدولة لايف جديد' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLiveSessionDto) {
    return this.live.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل لايف قبل ما يبدأ' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateLiveSessionDto) {
    return this.live.update(user, id, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'بدء البث' })
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.live.start(user, id);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'إنهاء البث' })
  end(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.live.end(user, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'إلغاء لايف مجدول' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.live.cancel(user, id);
  }

  @Patch(':id/chat')
  @ApiOperation({ summary: 'فتح أو قفل الشات' })
  chat(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: LiveChatToggleDto) {
    return this.live.setChat(user, id, dto.enabled);
  }

  @Get('recordings/:recordingId/url')
  @ApiOperation({ summary: 'رابط مؤقت لمشاهدة أو تنزيل تسجيل' })
  recordingUrl(@Param('recordingId') recordingId: string, @Query('download') download?: string) {
    return this.live.recordingUrl(recordingId, download === '1' || download === 'true');
  }

  @Delete('recordings/:recordingId')
  @ApiOperation({ summary: 'مسح تسجيل' })
  deleteRecording(@CurrentUser() user: AuthenticatedUser, @Param('recordingId') recordingId: string) {
    return this.live.deleteRecording(user, recordingId);
  }

  @Get(':id/reactions')
  @ApiOperation({ summary: 'الرياكشنز ومين عملها' })
  reactions(@Param('id') id: string) {
    return this.live.reactionsFor(id);
  }

  @Get(':id/participants')
  participants(@Param('id') id: string) { return this.live.participantsFor(id); }

  @Post(':id/participants/:userId/kick')
  kick(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.live.kickParticipant(user, id, userId);
  }
}
