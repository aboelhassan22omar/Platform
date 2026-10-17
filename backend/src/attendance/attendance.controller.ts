import { Body, Controller, Delete, Get, Header, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AttendanceMethod, Role } from '../generated/prisma/enums';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { AttendanceService } from './attendance.service';

class CreateSessionDto {
  @IsString() @MinLength(2) @MaxLength(140) title!: string;
  @IsString() gradeId!: string;
  @IsDateString() startsAt!: string;
}

class ScanDto {
  @IsString() @MaxLength(200) token!: string;
}

class ManualDto {
  @IsString() userId!: string;
}

class CloseDto {
  @IsOptional() @IsBoolean() notifyParents?: boolean;
}

@ApiTags('attendance')
@Controller()
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('attendance/card')
  @ApiOperation({ summary: 'كارنيه الحضور (QR الطالب)' })
  card(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.card(user.id);
  }

  @Get('attendance/mine')
  @ApiOperation({ summary: 'حضوري في السنتر' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.mine(user.id);
  }

  // --------------------------------------------------------------------------
  // Staff (assistants at the door are SUPPORT accounts)
  // --------------------------------------------------------------------------

  @Roles(Role.SUPPORT)
  @Get('admin/attendance/sessions')
  list(@Query('gradeId') gradeId?: string) {
    return this.attendance.listSessions(gradeId);
  }

  @Roles(Role.SUPPORT)
  @Post('admin/attendance/sessions')
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateSessionDto) {
    return this.attendance.createSession(actor.id, {
      title: dto.title,
      gradeId: dto.gradeId,
      startsAt: new Date(dto.startsAt),
    });
  }

  @Roles(Role.SUPPORT)
  @Get('admin/attendance/sessions/:id')
  detail(@Param('id') id: string) {
    return this.attendance.detail(id);
  }

  @Roles(Role.SUPPORT)
  @Post('admin/attendance/sessions/:id/scan')
  scan(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ScanDto) {
    return this.attendance.scan(actor.id, id, dto.token);
  }

  @Roles(Role.SUPPORT)
  @Post('admin/attendance/sessions/:id/manual')
  manual(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ManualDto) {
    return this.attendance.mark(actor.id, id, dto.userId, AttendanceMethod.MANUAL);
  }

  @Roles(Role.SUPPORT)
  @Delete('admin/attendance/sessions/:id/records/:userId')
  unmark(@Param('id') id: string, @Param('userId') userId: string) {
    return this.attendance.unmark(id, userId);
  }

  @Roles(Role.SUPPORT)
  @Post('admin/attendance/sessions/:id/close')
  close(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloseDto) {
    return this.attendance.close(actor.id, id, dto.notifyParents ?? false);
  }

  @Roles(Role.SUPPORT)
  @Post('admin/attendance/sessions/:id/reopen')
  reopen(@Param('id') id: string) {
    return this.attendance.reopen(id);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/attendance/sessions/:id')
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.attendance.remove(actor.id, id);
  }

  @Roles(Role.SUPPORT)
  @Get('admin/attendance/sessions/:id/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  export(@Param('id') id: string) {
    return this.attendance.csv(id);
  }
}
