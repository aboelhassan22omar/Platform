import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * How an OTP reaches the student.
 *
 * - `inbound`  — SuperAgent's flow: the student taps a wa.me link and sends a
 *   pre-filled message to the business number; the webhook replies with the
 *   code as plain text inside the 24h service window. No template needed.
 * - `template` — the server sends an approved AUTHENTICATION template.
 */
export type OtpDelivery = 'inbound' | 'template';

/** Meta error codes, and what each one actually means for this deployment. */
const DIAGNOSES: Record<string, string> = {
  '190':
    'access token expired or revoked; use a System User token with whatsapp_business_messaging and no expiry',
  '131030': 'recipient not on the allowed list (app is in development mode)',
  '131047': 'more than 24h since the user last messaged us; only a template may be sent',
  '131056': 'too many messages to this number too quickly',
  '100':
    'bad parameter, usually WHATSAPP_PHONE_NUMBER_ID (the ID beside the number, not the number)',
  '132001': 'template name/language does not exist or is not approved',
  '133010': 'the sending number is not registered on Cloud API',
  '80007': 'the account hit its rate limit',
};

/** Meta Cloud API transport adapted from SuperAgent's WhatsApp gateway. */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  constructor(private readonly config: ConfigService) {}

  private hasCredentials(): boolean {
    return Boolean(
      this.config.get<string>('whatsapp.phoneNumberId') &&
        this.config.get<string>('whatsapp.token'),
    );
  }

  /** Inbound (click-to-chat) wins when the business number is set, as in SuperAgent. */
  deliveryMode(): OtpDelivery | null {
    if (!this.hasCredentials()) return null;
    if (this.config.get<string>('whatsapp.businessNumber')) return 'inbound';
    if (this.config.get<string>('whatsapp.otpTemplate')) return 'template';
    return null;
  }

  isConfigured(): boolean {
    return this.deliveryMode() !== null;
  }

  ensureConfigured(): OtpDelivery {
    const mode = this.deliveryMode();
    if (!mode) {
      this.logger.error(
        'WhatsApp OTP is not configured: set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TOKEN and WHATSAPP_NUMBER (or WHATSAPP_OTP_TEMPLATE)',
      );
      throw new ServiceUnavailableException(
        'إرسال كود واتساب غير متاح حاليًا، حاول لاحقًا أو تواصل مع الدعم.',
      );
    }
    return mode;
  }

  /** The wa.me link that opens WhatsApp with `message` typed; the student still taps send. */
  clickToChatLink(message: string): string {
    return `https://wa.me/${this.config.get<string>('whatsapp.businessNumber')}?text=${encodeURIComponent(message)}`;
  }

  businessNumber(): string {
    return this.config.get<string>('whatsapp.businessNumber') ?? '';
  }

  /** A plain text reply. Only deliverable inside the 24h window the student opened. */
  async sendText(waId: string, body: string): Promise<void> {
    await this.post({
      to: waId.replace(/\D/g, ''),
      type: 'text',
      // A link preview inside a security code is exactly the shape a phishing message takes.
      text: { preview_url: false, body },
    });
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    if (!this.config.get<string>('whatsapp.otpTemplate')) this.ensureConfigured();
    await this.post({
      to: `2${phone}`,
      type: 'template',
      template: {
        name: this.config.get<string>('whatsapp.otpTemplate'),
        language: { code: this.config.get<string>('whatsapp.otpLanguage') },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: code }],
          },
        ],
      },
    });
  }

  private async post(message: Record<string, unknown>): Promise<void> {
    if (!this.hasCredentials()) this.ensureConfigured();
    const version = this.config.get<string>('whatsapp.graphVersion');
    const phoneId = this.config.get<string>('whatsapp.phoneNumberId')!;
    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.get<string>('whatsapp.token')}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            ...message,
          }),
        },
      );
      const result = (await response.json()) as {
        messages?: { id: string }[];
        error?: { code?: number; message?: string };
      };
      if (!response.ok || !result.messages?.[0]?.id) {
        // Meta's error text names the cause (template, token, number) and carries no secrets.
        const code = String(result.error?.code ?? 'unknown');
        const hint =
          DIAGNOSES[code] ?? ([401, 403].includes(response.status) ? 'token rejected' : '');
        this.logger.warn(
          `WhatsApp send rejected: status=${response.status} code=${code} message=${result.error?.message ?? 'none'}${hint ? ` — ${hint}` : ''}`,
        );
        throw new Error('provider rejected');
      }
    } catch (error) {
      // Never log the request, token, phone or OTP, and never claim delivery on failure.
      if (!(error instanceof Error && error.message === 'provider rejected'))
        this.logger.warn(`WhatsApp request failed: ${(error as Error)?.name ?? 'unknown'}`);
      throw new ServiceUnavailableException(
        'تعذر إرسال كود واتساب. تأكد أن الرقم عليه واتساب وحاول مرة أخرى.',
      );
    }
  }
}
