import { Module } from '@nestjs/common';
import { CertificateTemplateService } from './certificate-template.service';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  controllers: [CertificatesController],
  providers: [CertificatesService, CertificateTemplateService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
