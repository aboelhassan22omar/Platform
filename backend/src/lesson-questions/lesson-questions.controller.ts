import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Role } from '../generated/prisma/enums';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { LessonQuestionsService } from './lesson-questions.service';

class AskDto {
  @IsString()
  @MinLength(3, { message: 'اكتب سؤالك بوضوح' })
  @MaxLength(2000, { message: 'السؤال طويل أوي، اختصره شوية' })
  body!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86_400)
  videoSeconds?: number;
}

class TextDto {
  @IsString()
  @MinLength(1, { message: 'اكتب ردك' })
  @MaxLength(3000, { message: 'الرد طويل أوي' })
  body!: string;
}

class ModerateDto {
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsBoolean() hidden?: boolean;
}

@ApiTags('lesson-questions')
@Controller()
export class LessonQuestionsController {
  constructor(private readonly questions: LessonQuestionsService) {}

  @Get('lessons/:lessonId/questions')
  @ApiOperation({ summary: 'أسئلة الطلاب تحت الحصة' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Query('sort') sort?: string,
    @Query('filter') filter?: string,
    @Query('page') page?: string,
  ) {
    return this.questions.list(user, lessonId, { sort, filter, page: Number(page) || 1 });
  }

  @Post('lessons/:lessonId/questions')
  @ApiOperation({ summary: 'اسأل تحت الحصة' })
  ask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: AskDto,
  ) {
    return this.questions.ask(user, lessonId, dto);
  }

  @Patch('lesson-questions/:id')
  edit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: TextDto) {
    return this.questions.edit(user, id, dto.body);
  }

  @Delete('lesson-questions/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.questions.remove(user, id);
  }

  @Post('lesson-questions/:id/replies')
  reply(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: TextDto) {
    return this.questions.reply(user, id, dto.body);
  }

  @Post('lesson-questions/:id/vote')
  vote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.questions.vote(user, id);
  }

  @Delete('lesson-questions/replies/:replyId')
  removeReply(@CurrentUser() user: AuthenticatedUser, @Param('replyId') replyId: string) {
    return this.questions.removeReply(user, replyId);
  }

  // --------------------------------------------------------------------------
  // Staff inbox
  // --------------------------------------------------------------------------

  @Roles(Role.SUPPORT)
  @Get('admin/lesson-questions')
  @ApiOperation({ summary: 'كل أسئلة الطلاب' })
  inbox(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('courseId') courseId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {
    return this.questions.inbox(user, { status, courseId, search, page: Number(page) || 1 });
  }

  @Roles(Role.SUPPORT)
  @Patch('admin/lesson-questions/:id')
  moderate(@Param('id') id: string, @Body() dto: ModerateDto) {
    return this.questions.moderate(id, dto);
  }
}
