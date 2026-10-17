import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { Role } from '../generated/prisma/enums';
import { CertificateTemplateService } from './certificate-template.service';
import { CertificatesService } from './certificates.service';

class CertificateTemplateDto {
  @IsString() @MinLength(2) @MaxLength(60) title!: string;
  @IsString() @MaxLength(120) intro!: string;
  @IsString() @MinLength(2) @MaxLength(300) body!: string;
  @IsString() @MinLength(2) @MaxLength(80) issuerName!: string;
  @IsString() @MaxLength(60) signatureName!: string;
  @IsString() @MaxLength(60) signatureTitle!: string;
}

@Controller()
export class CertificatesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly certificates: CertificatesService,
    private readonly template: CertificateTemplateService,
  ) {}

  @Roles(Role.STUDENT)
  @Get('certificates/mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.certificates.mine(user.id);
  }

  /** Public so a parent or a school can verify a certificate from its QR. */
  @Public()
  @Get('certificates/:serial')
  view(@Param('serial') serial: string) {
    return this.certificates.publicView(serial);
  }

  @Roles(Role.ADMIN)
  @Get('admin/certificate-template')
  getTemplate() {
    return this.template.get();
  }

  @Roles(Role.ADMIN)
  @Put('admin/certificate-template')
  async updateTemplate(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CertificateTemplateDto,
    @Req() req: Request,
  ) {
    const saved = await this.template.set({
      title: dto.title.trim(),
      intro: dto.intro.trim(),
      body: dto.body.trim(),
      issuerName: dto.issuerName.trim(),
      signatureName: dto.signatureName.trim(),
      signatureTitle: dto.signatureTitle.trim(),
    });
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'certificates.template.update',
      entityType: 'SiteSetting',
      entityId: 'certificates.template',
      metadata: { title: saved.title },
      ip: req.ip,
    });
    return saved;
  }
}
