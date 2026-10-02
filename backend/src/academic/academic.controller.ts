import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EducationSystem } from '../generated/prisma/enums';
import { Public } from '../common/decorators';
import { AcademicService } from './academic.service';

@ApiTags('academic')
@Controller('academic')
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  @Public()
  @Get('systems')
  @ApiOperation({ summary: 'الأنظمة التعليمية والصفوف التابعة لها' })
  listSystems() {
    return this.academic.listSystems();
  }

  @Public()
  @Get('grades')
  @ApiOperation({ summary: 'كل الصفوف الدراسية' })
  listGrades(@Query('system') system?: EducationSystem) {
    return this.academic.listGrades(system);
  }

  @Public()
  @Get('grades/:slug')
  @ApiOperation({ summary: 'تفاصيل صف دراسي مع كورساته وباقاته' })
  getGrade(@Param('slug') slug: string) {
    return this.academic.getGradeBySlug(slug);
  }

  @Public()
  @Get('years')
  @ApiOperation({ summary: 'الأعوام الدراسية' })
  listYears() {
    return this.academic.listAcademicYears();
  }
}
