import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Response } from 'express';
import { Role } from '../generated/prisma/enums';
import { CurrentUser, Public } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@Controller()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  /**
   * Public route, but a signed-in visitor gets their access flags filled in.
   * JwtAuthGuard skips @Public() routes entirely, so the principal is read
   * off the request rather than injected.
   */
  @Public()
  @Get('grades/:gradeSlug/courses/:courseSlug')
  @ApiOperation({ summary: 'تفاصيل الكورس بوحداته وفصوله وحصصه' })
  getCourse(
    @Param('gradeSlug') gradeSlug: string,
    @Param('courseSlug') courseSlug: string,
    @Req() req: Request,
  ) {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    return this.courses.getCourseBySlug(
      gradeSlug,
      courseSlug,
      user ? { id: user.id, isStaff: user.role !== Role.STUDENT } : undefined,
    );
  }

  @Get('me/lessons')
  @ApiOperation({ summary: 'حصصي — كل الحصص المتاحة للطالب' })
  myLessons(@CurrentUser() user: AuthenticatedUser) {
    return this.courses.listMyLessons(user.id, { isStaff: user.role !== Role.STUDENT });
  }

  @Get('me/continue-watching')
  @ApiOperation({ summary: 'كمّل من مكان ما وقفت' })
  continueWatching(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.courses.listContinueWatching(user.id, Math.min(Number(limit) || 6, 20));
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'تفاصيل حصة مع حالة الوصول' })
  getLesson(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.courses.getLessonForViewer(id, {
      id: user.id,
      isStaff: user.role !== Role.STUDENT,
    });
  }


  @Get('lessons/:id/attachments/:attachmentId')
  @ApiOperation({ summary: 'تنزيل ملف الحصة بعد التحقق من الصلاحية' })
  async downloadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ) {
    const url = await this.courses.getAttachmentDownload(id, attachmentId, {
      id: user.id,
      isStaff: user.role !== Role.STUDENT,
    });
    return response.redirect(url);
  }
}
