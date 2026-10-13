import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Public } from '../common/decorators';
import { OtpService } from './otp.service';

interface InboundMessage {
  waId: string;
  text: string;
  messageId: string;
}

/** Every text message in one delivery. Defensive: a strange payload is just no messages. */
export const inboundTextMessages = (payload: unknown): InboundMessage[] => {
  const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const get = (value: unknown, key: string): unknown =>
    value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
  const found: InboundMessage[] = [];
  for (const entry of list(get(payload, 'entry')))
    for (const change of list(get(entry, 'changes')))
      for (const message of list(get(get(change, 'value'), 'messages'))) {
        if (get(message, 'type') !== 'text') continue;
        const waId = String(get(message, 'from') ?? '');
        if (waId)
          found.push({
            waId,
            text: String(get(get(message, 'text'), 'body') ?? ''),
            messageId: String(get(message, 'id') ?? ''),
          });
      }
  return found;
};

export const signatureIsValid = (rawBody: Buffer, header: string | undefined, secret: string) => {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(header.slice('sha256='.length).trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/**
 * Meta's WhatsApp webhook: https://<domain>/api/auth/whatsapp/webhook,
 * subscribed to the `messages` field. Students message the business number
 * with the code word, and the reply carries their OTP (see OtpService.claim).
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('auth/whatsapp/webhook')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  constructor(
    private readonly otp: OtpService,
    private readonly config: ConfigService,
  ) {}

  /** Subscription handshake: answer the bare challenge as plain text, byte for byte. */
  @Get()
  handshake(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = this.config.get<string>('whatsapp.verifyToken');
    if (mode === 'subscribe' && expected && token === expected)
      return res.type('text/plain').send(challenge ?? '');
    return res.status(HttpStatus.FORBIDDEN).type('text/plain').send('');
  }

  /** Always 200 once the signature checks out, or Meta replays the delivery for days. */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: Request) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
    const secret = this.config.get<string>('whatsapp.appSecret');
    if (secret) {
      if (!signatureIsValid(rawBody, req.get('x-hub-signature-256'), secret))
        throw new ForbiddenException();
    } else if (this.config.get<boolean>('isProduction')) {
      // Unsigned, anyone who finds this URL could claim any number's code.
      this.logger.error('Rejected WhatsApp webhook: set WHATSAPP_APP_SECRET (Meta App Secret)');
      throw new ForbiddenException();
    } else {
      this.logger.warn('Accepting an unsigned WhatsApp webhook (WHATSAPP_APP_SECRET unset)');
    }

    for (const message of inboundTextMessages(req.body)) {
      try {
        const outcome = await this.otp.claim(message.waId, message.text, message.messageId);
        // The phone number is deliberately not logged.
        this.logger.log(`WhatsApp OTP: outcome=${outcome} message_id=${message.messageId}`);
      } catch (error) {
        this.logger.error(`WhatsApp OTP claim failed: ${(error as Error)?.message ?? 'unknown'}`);
      }
    }
    return { received: true };
  }
}
