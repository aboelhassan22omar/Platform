import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * The certificate layout the admin edits from the dashboard. It is applied
 * when a certificate is displayed, so a wording change reaches certificates
 * already issued too. `body` supports {exam}, {score} and {date}.
 */
export interface CertificateTemplate {
  title: string;
  intro: string;
  body: string;
  issuerName: string;
  signatureName: string;
  signatureTitle: string;
}

const KEY = 'certificates.template';

@Injectable()
export class CertificateTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  defaults(): CertificateTemplate {
    const platform = this.config.get<{ name: string; teacherName: string; subjectName: string }>(
      'platform',
    );
    return {
      title: 'شهادة تفوّق',
      intro: 'تتشرّف المنصة بمنح هذه الشهادة إلى',
      body: 'وذلك لاجتياز «{exam}» بنسبة {score}، تقديرًا للتفوّق والاجتهاد.',
      issuerName: platform?.name ?? '',
      signatureName: platform?.teacherName ?? '',
      signatureTitle: platform?.subjectName ? `مدرس ${platform.subjectName}` : 'مدرس المادة',
    };
  }

  async get(): Promise<CertificateTemplate> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<CertificateTemplate>;
    const defaults = this.defaults();
    return {
      title: stored.title || defaults.title,
      intro: stored.intro ?? defaults.intro,
      body: stored.body || defaults.body,
      issuerName: stored.issuerName || defaults.issuerName,
      signatureName: stored.signatureName ?? defaults.signatureName,
      signatureTitle: stored.signatureTitle ?? defaults.signatureTitle,
    };
  }

  async set(template: CertificateTemplate): Promise<CertificateTemplate> {
    const value = { ...template } as unknown as Prisma.InputJsonValue;
    await this.prisma.siteSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value },
      update: { value },
    });
    return this.get();
  }
}
