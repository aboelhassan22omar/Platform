import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Role } from '../generated/prisma/enums';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import {
  CompleteAttachmentDto,
  UploadTicketDto,
  UpsertChapterDto,
  UpsertCourseDto,
  UpsertLessonDto,
  UpdateLessonDto,
  UpsertUnitDto,
} from './dto/content.dto';
import { ContentCatalogService } from './content/content-catalog.service';
import { ContentLessonsService } from './content/content-lessons.service';
import { ContentDeletionService } from './content/content-deletion.service';

@ApiTags('admin')
@Roles(Role.CONTENT_MANAGER)
@Controller('admin/content')
export class AdminContentController {
  constructor(
    private readonly catalog: ContentCatalogService,
    private readonly lessons: ContentLessonsService,
    private readonly deletion: ContentDeletionService,
  ) {}

  // -------------------------------------------------------------------------
  // Courses
  // -------------------------------------------------------------------------
  @Get('courses')
  @ApiOperation({ summary: 'كل الكورسات (بما فيها المسودات)' })
  listCourses(
    @Query('gradeId')
    gradeId?: string,
  ) {
    return this.catalog.listCourses(gradeId);
  }

  @Get('grades')
  @ApiOperation({ summary: 'الصفوف المتاحة لإدارة المحتوى' })
  listGrades() {
    return this.catalog.listGrades();
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'شجرة الكورس كاملة للإدارة' })
  getCourse(
    @Param('id')
    id: string,
  ) {
    return this.catalog.getCourse(id);
  }

  @Post('courses')
  @ApiOperation({ summary: 'إنشاء كورس' })
  createCourse(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Body()
    dto: UpsertCourseDto,
    @Req()
    req: Request,
  ) {
    return this.catalog.createCourse(actor, dto, req.ip);
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'تعديل كورس' })
  updateCourse(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('id')
    id: string,
    @Body()
    dto: Partial<UpsertCourseDto>,
    @Req()
    req: Request,
  ) {
    return this.catalog.updateCourse(actor, id, dto, req.ip);
  }

  // -------------------------------------------------------------------------
  // Units & chapters
  // -------------------------------------------------------------------------
  @Post('courses/:courseId/units')
  @ApiOperation({ summary: 'إضافة وحدة' })
  createUnit(
    @Param('courseId')
    courseId: string,
    @Body()
    dto: UpsertUnitDto,
  ) {
    return this.catalog.createUnit(courseId, dto);
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'تعديل وحدة' })
  updateUnit(
    @Param('id')
    id: string,
    @Body()
    dto: Partial<UpsertUnitDto>,
  ) {
    return this.catalog.updateUnit(id, dto);
  }

  @Post('units/:unitId/chapters')
  @ApiOperation({ summary: 'إضافة فصل' })
  createChapter(
    @Param('unitId')
    unitId: string,
    @Body()
    dto: UpsertChapterDto,
  ) {
    return this.catalog.createChapter(unitId, dto);
  }

  @Patch('chapters/:id')
  @ApiOperation({ summary: 'تعديل فصل' })
  updateChapter(
    @Param('id')
    id: string,
    @Body()
    dto: Partial<UpsertChapterDto>,
  ) {
    return this.catalog.updateChapter(id, dto);
  }

  @Delete('courses/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'أرشفة كورس' })
  archiveCourse(
    @Param('id')
    id: string,
  ) {
    return this.catalog.archiveCourse(id);
  }

  @Delete('units/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'أرشفة وحدة' })
  archiveUnit(
    @Param('id')
    id: string,
  ) {
    return this.catalog.archiveUnit(id);
  }

  @Delete('chapters/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'أرشفة فصل' })
  archiveChapter(
    @Param('id')
    id: string,
  ) {
    return this.catalog.archiveChapter(id);
  }

  // -------------------------------------------------------------------------
  // Lessons
  // -------------------------------------------------------------------------
  @Post('lessons/:id/attachments/upload-ticket')
  createAttachmentUpload(
    @Param('id')
    lessonId: string,
    @Body()
    dto: UploadTicketDto,
  ) {
    return this.lessons.createAttachmentUpload(lessonId, dto);
  }

  @Post('lessons/:id/attachments/complete')
  completeAttachment(
    @Param('id')
    lessonId: string,
    @Body()
    dto: CompleteAttachmentDto,
  ) {
    return this.lessons.completeAttachment(lessonId, dto);
  }

  @Delete('attachments/:id')
  deleteAttachment(
    @Param('id')
    id: string,
  ) {
    return this.lessons.deleteAttachment(id);
  }

  @Post('chapters/:chapterId/lessons')
  @ApiOperation({ summary: 'إضافة حصة' })
  createLesson(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('chapterId')
    chapterId: string,
    @Body()
    dto: UpsertLessonDto,
    @Req()
    req: Request,
  ) {
    return this.lessons.createLesson(actor, chapterId, dto, req.ip);
  }

  @Patch('lessons/:id')
  @ApiOperation({ summary: 'تعديل حصة' })
  updateLesson(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('id')
    id: string,
    @Body()
    dto: UpdateLessonDto,
    @Req()
    req: Request,
  ) {
    return this.lessons.updateLesson(actor, id, dto, req.ip);
  }

  @Delete('lessons/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'أرشفة حصة' })
  archiveLesson(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('id')
    id: string,
    @Req()
    req: Request,
  ) {
    return this.lessons.archiveLesson(actor, id, req.ip);
  }

  @Delete('courses/:id/permanent')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'حذف كورس نهائياً' })
  deleteCoursePermanently(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('id')
    id: string,
    @Req()
    req: Request,
  ) {
    return this.deletion.deleteCoursePermanently(actor, id, req.ip);
  }

  @Delete('units/:id/permanent')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'حذف وحدة نهائياً' })
  deleteUnitPermanently(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('id')
    id: string,
    @Req()
    req: Request,
  ) {
    return this.deletion.deleteUnitPermanently(actor, id, req.ip);
  }

  @Delete('chapters/:id/permanent')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'حذف باكدج نهائياً' })
  deleteChapterPermanently(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('id')
    id: string,
    @Req()
    req: Request,
  ) {
    return this.deletion.deleteChapterPermanently(actor, id, req.ip);
  }

  @Delete('lessons/:id/permanent')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'حذف حصة نهائياً' })
  deleteLessonPermanently(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('id')
    id: string,
    @Req()
    req: Request,
  ) {
    return this.deletion.deleteLessonPermanently(actor, id, req.ip);
  }

  // -------------------------------------------------------------------------
  // Video upload
  // -------------------------------------------------------------------------
  @Post('lessons/:id/video/upload-ticket')
  @ApiOperation({ summary: 'طلب رابط رفع مباشر للفيديو' })
  createUploadTicket(
    @Param('id')
    id: string,
    @Body()
    dto: UploadTicketDto,
  ) {
    return this.lessons.createUploadTicket(id, dto);
  }

  @Post('lessons/:id/video/complete')
  @ApiOperation({ summary: 'تأكيد انتهاء الرفع وبدء المعالجة' })
  completeUpload(
    @CurrentUser()
    actor: AuthenticatedUser,
    @Param('id')
    id: string,
    @Req()
    req: Request,
  ) {
    return this.lessons.completeUpload(actor, id, req.ip);
  }

  @Get('lessons/:id/video/status')
  @ApiOperation({ summary: 'حالة معالجة الفيديو' })
  videoStatus(
    @Param('id')
    id: string,
  ) {
    return this.lessons.videoStatus(id);
  }

  @Post('lessons/:id/video/retry')
  @ApiOperation({ summary: 'إعادة محاولة معالجة الفيديو' })
  retry(
    @Param('id')
    id: string,
  ) {
    return this.lessons.retry(id);
  }
}
