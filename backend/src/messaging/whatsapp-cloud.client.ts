import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';

/** A send the Cloud API refused. `permanent` failures are not worth retrying. */
export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
  }
}

/**
 * Minimal WhatsApp Business Cloud API client: sends one approved template.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 */
@Injectable()
export class WhatsAppCloudClient {
  private readonly cfg: AppConfig['whatsapp'];

  constructor(config: ConfigService) {
    this.cfg = config.get<AppConfig['whatsapp']>('whatsapp')!;
  }

  get configured(): boolean {
    return Boolean(this.cfg.phoneNumberId && this.cfg.accessToken);
  }

  /** The sending number id with all but the last 4 digits hidden, for the admin. */
  get maskedPhoneNumberId(): string | null {
    const id = this.cfg.phoneNumberId;
    return id ? `••••${id.slice(-4)}` : null;
  }

  async sendTemplate(to: string, templateName: string, params: string[]): Promise<string> {
    if (!this.configured) throw new WhatsAppSendError('WhatsApp Cloud API is not configured', true);
    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/${this.cfg.apiVersion}/${this.cfg.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cfg.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: templateName,
              language: { code: this.cfg.templateLanguage },
              components: [
                { type: 'body', parameters: params.map((text) => ({ type: 'text', text })) },
              ],
            },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch (error) {
      throw new WhatsAppSendError(`Network error: ${(error as Error).message}`, false);
    }

    const payload = (await response.json().catch(() => null)) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string; code?: number };
    } | null;
    if (!response.ok || !payload?.messages?.[0]?.id) {
      const message = payload?.error?.message ?? `HTTP ${response.status}`;
      // 4xx other than rate limiting means a bad number, template or token:
      // retrying the same request will fail the same way.
      const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
      throw new WhatsAppSendError(message.slice(0, 500), permanent);
    }
    return payload.messages[0].id;
  }
}
