import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { GradeLevel, Role } from '../generated/prisma/enums';
import { ProgressService } from './progress.service';

class RecordProgressDto {
  @IsInt()
  @Min(0)
  @Max(86_400)
  positionSeconds!: number;

  @IsInt()
  @Min(0)
  @Max(86_400)
  durationSeconds!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  watchedSeconds?: number;
}

@ApiTags('progress')
@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Put('lessons/:id/progress')
  @ApiOperation({ summary: 'حفظ موضع المشاهدة' })
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') lessonId: string,
    @Body() dto: RecordProgressDto,
  ) {
    return this.progress.record(user.id, lessonId, dto, {
      isStaff: user.role !== Role.STUDENT,
    });
  }

  @Get('lessons/:id/progress')
  @ApiOperation({ summary: 'موضع المشاهدة الحالي' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') lessonId: string) {
    return this.progress.getForLesson(user.id, lessonId);
  }

  @Get('me/progress/summary')
  @ApiOperation({ summary: 'ملخص تقدم الطالب' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.progress.summaryForUser(user.id);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'أفضل الطلاب بالنقاط لكل صف دراسي' })
  leaderboard(@CurrentUser() user: AuthenticatedUser, @Query('gradeLevel') gradeLevel?: string) {
    const requestedGrade =
      gradeLevel && Object.values(GradeLevel).includes(gradeLevel as GradeLevel)
        ? (gradeLevel as GradeLevel)
        : undefined;
    // Students only see their own cohort. Staff may inspect another grade.
    return this.progress.leaderboard(
      user.id,
      user.role === Role.STUDENT ? undefined : requestedGrade,
    );
  }

  @Get('me/achievements')
  @ApiOperation({ summary: 'لقب الطالب ومكتبة شارات صفه' })
  achievements(@CurrentUser() user: AuthenticatedUser) {
    return this.progress.achievementsForUser(user.id);
  }
}
