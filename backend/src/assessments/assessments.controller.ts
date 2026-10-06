import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { Role } from '../generated/prisma/enums';
import { AssessmentsService } from './assessments.service';

class AnswerDto {
  @IsString() questionId!: string;
  @IsString() optionId!: string;
}
class SubmitAssessmentDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

@Controller('assessments')
@Roles(Role.STUDENT)
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.assessments.listForStudent(user);
  }
  @Get(':id') get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assessments.getForStudent(id, user);
  }
  @Post(':id/start') start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assessments.start(id, user);
  }
  @Post(':id/save') save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitAssessmentDto,
  ) {
    return this.assessments.save(id, user, dto.answers);
  }
  @Post(':id/submit') submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitAssessmentDto,
  ) {
    return this.assessments.submit(id, user, dto.answers);
  }
}
