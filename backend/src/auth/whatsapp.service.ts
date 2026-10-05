import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Meta Cloud API transport adapted from SuperAgent's WhatsApp gateway. */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  constructor(private readonly config: ConfigService) {}

  ensureConfigured(): void {
    if (!this.config.get<string>('whatsapp.phoneNumberId') ||
        !this.config.get<string>('whatsapp.token') ||
        !this.config.get<string>('whatsapp.otpTemplate')) {
      throw new ServiceUnavailableException('إرسال كود واتساب غير متاح حاليًا، حاول لاحقًا أو تواصل مع الدعم.');
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    this.ensureConfigured();
    const version = this.config.get<string>('whatsapp.graphVersion');
    const phoneId = this.config.get<string>('whatsapp.phoneNumberId')!;
    try {
      const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.get<string>('whatsapp.token')}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp', recipient_type: 'individual', to: `2${phone}`,
          type: 'template',
          template: {
            name: this.config.get<string>('whatsapp.otpTemplate'),
            language: { code: this.config.get<string>('whatsapp.otpLanguage') },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
            ],
          },
        }),
      });
      const result = await response.json() as { messages?: { id: string }[]; error?: { code?: number } };
      if (!response.ok || !result.messages?.[0]?.id) {
        this.logger.warn(`WhatsApp OTP rejected: status=${response.status} code=${result.error?.code ?? 'unknown'}`);
        throw new Error('provider rejected');
      }
    } catch {
      // Never log the request, token, phone or OTP, and never claim delivery on failure.
      throw new ServiceUnavailableException('تعذر إرسال كود واتساب. تأكد أن الرقم عليه واتساب وحاول مرة أخرى.');
    }
  }
}
