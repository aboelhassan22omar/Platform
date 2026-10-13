import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'node:crypto';
import { RedisService } from '../common/redis/redis.service';
import { normalizeEgyptianPhone } from '../common/utils/phone.util';
import { generateToken, hashToken } from '../common/utils/reference.util';
import { WhatsAppService } from './whatsapp.service';

export type OtpPurpose = 'register' | 'password-reset';
export interface OtpPayload {
  phone: string;
  userId?: string;
  registration?: {
    fullName: string;
    username: string;
    passwordHash: string;
    parentPhone: string;
    educationSystem: string;
    gradeLevel: string;
    studentType?: string;
  };
}
/** `pending`: waiting for the student's WhatsApp message (inbound delivery only). */
export type OtpStatus = 'pending' | 'code_sent' | 'rejected';
interface OtpRecord {
  purpose: OtpPurpose;
  payload: OtpPayload;
  codeHash: string;
  attempts: number;
  status?: OtpStatus;
}
const TTL = 300;
/** Inbound needs time to switch to WhatsApp, send, and come back. */
const INBOUND_TTL = 600;
const COOLDOWN = 60;

/** No I, O, U or lookalike digits: it may be typed by hand when the link is swallowed. */
const NONCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTVWXYZ23456789';
const NONCE_LENGTH = 8;
const MESSAGE_PREFIX = 'كود التفعيل';

/** Finds an exact-length nonce anywhere in what the student actually sent. */
export const extractNonce = (body: string): string | null => {
  for (const run of (body ?? '').toUpperCase().split(new RegExp(`[^${NONCE_ALPHABET}]+`)))
    if (run.length === NONCE_LENGTH) return run;
  return null;
};

export type ClaimOutcome =
  | 'duplicate'
  | 'no_nonce'
  | 'unknown_nonce'
  | 'already_claimed'
  | 'phone_mismatch'
  | 'unknown_account'
  | 'send_failed'
  | 'code_sent';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  private codeHash(id: string, code: string): string {
    return createHmac('sha256', this.config.get<string>('auth.accessSecret')!)
      .update(`${id}:${code}`)
      .digest('hex');
  }
  private phoneKey(purpose: OtpPurpose, phone: string): string {
    return `auth:otp:phone:${purpose}:${hashToken(phone)}`;
  }
  private challengeKey(challengeId: string): string {
    return `auth:otp:challenge:${challengeId}`;
  }
  private nonceKey(nonce: string): string {
    return `auth:otp:nonce:${nonce}`;
  }

  async create(purpose: OtpPurpose, payload: OtpPayload) {
    const delivery = this.whatsapp.ensureConfigured();
    const phoneKey = this.phoneKey(purpose, payload.phone);
    const acquired = await this.redis.client.set(`${phoneKey}:cooldown`, '1', 'EX', COOLDOWN, 'NX');
    if (!acquired) {
      const remaining = await this.redis.client.ttl(`${phoneKey}:cooldown`);
      throw new HttpException(
        { message: 'استنى شوية قبل طلب كود جديد.', retryAfterSeconds: Math.max(1, remaining) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const sends = await this.redis.incrementWithTtl(
      `auth:otp:sends:${hashToken(payload.phone)}`,
      3600,
    );
    if (sends > 5)
      throw new HttpException(
        'وصلت للحد المسموح لطلب الأكواد، حاول بعد ساعة.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const challengeId = generateToken(32);
    try {
      const previous = await this.redis.client.get(phoneKey);
      let record: OtpRecord;
      let ttl = TTL;
      let nonce: string | null = null;
      if (delivery === 'inbound') {
        // The code is minted only when the student's message reaches the webhook.
        ttl = INBOUND_TTL;
        nonce = Array.from(
          { length: NONCE_LENGTH },
          () => NONCE_ALPHABET[randomInt(NONCE_ALPHABET.length)],
        ).join('');
        record = { purpose, payload, codeHash: '', attempts: 0, status: 'pending' };
      } else {
        const code = String(randomInt(0, 1000000)).padStart(6, '0');
        // Unknown reset accounts get an indistinguishable challenge with no message.
        if (purpose === 'register' || payload.userId)
          await this.whatsapp.sendOtp(payload.phone, code);
        record = {
          purpose,
          payload,
          codeHash: this.codeHash(challengeId, code),
          attempts: 0,
          status: 'code_sent',
        };
      }
      const transaction = this.redis.client
        .multi()
        .set(this.challengeKey(challengeId), JSON.stringify(record), 'EX', ttl)
        .set(phoneKey, challengeId, 'EX', ttl);
      if (nonce) transaction.set(this.nonceKey(nonce), challengeId, 'EX', ttl);
      if (previous) transaction.del(this.challengeKey(previous));
      await transaction.exec();
      if (!nonce) return { challengeId, expiresIn: ttl, resendAfterSeconds: COOLDOWN };
      const message = `${MESSAGE_PREFIX}: ${nonce}`;
      return {
        challengeId,
        expiresIn: ttl,
        resendAfterSeconds: COOLDOWN,
        delivery: 'whatsapp-link' as const,
        whatsappLink: this.whatsapp.clickToChatLink(message),
        whatsappMessage: message,
        businessNumber: this.whatsapp.businessNumber(),
      };
    } catch (error) {
      await this.redis.client.del(`${phoneKey}:cooldown`);
      throw error;
    }
  }

  async resend(challengeId: string) {
    const raw = await this.redis.client.get(this.challengeKey(challengeId));
    if (!raw) throw new BadRequestException('انتهت صلاحية الكود. ابدأ من جديد.');
    const record = JSON.parse(raw) as OtpRecord;
    return this.create(record.purpose, record.payload);
  }

  async status(challengeId: string): Promise<{ status: OtpStatus | 'expired' }> {
    const raw = await this.redis.client.get(this.challengeKey(challengeId));
    if (!raw) return { status: 'expired' };
    return { status: (JSON.parse(raw) as OtpRecord).status ?? 'code_sent' };
  }

  /** Atomic status move that preserves expiry; returns false if the record is gone or moved on. */
  private async transition(challengeId: string, to: OtpStatus, codeHash = ''): Promise<boolean> {
    const moved = await this.redis.client.eval(
      `
      local raw = redis.call('GET', KEYS[1])
      if not raw then return 0 end
      local record = cjson.decode(raw)
      if record.status ~= 'pending' then return 0 end
      record.status = ARGV[1]
      if ARGV[2] ~= '' then record.codeHash = ARGV[2] end
      redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL')
      return 1
    `,
      1,
      this.challengeKey(challengeId),
      to,
      codeHash,
    );
    return moved === 1;
  }

  /**
   * One inbound WhatsApp message (from the webhook). Never throws: Meta replays
   * unacknowledged deliveries for days. `waId` comes from Meta's signed payload,
   * never from the browser, which is what proves the student owns the number.
   */
  async claim(waId: string, body: string, messageId: string): Promise<ClaimOutcome> {
    if (messageId) {
      const first = await this.redis.client.set(
        `auth:otp:wa-msg:${hashToken(messageId)}`,
        '1',
        'EX',
        86400,
        'NX',
      );
      if (!first) return 'duplicate';
    }
    const nonce = extractNonce(body);
    if (!nonce) return 'no_nonce';
    const challengeId = await this.redis.client.get(this.nonceKey(nonce));
    const raw = challengeId ? await this.redis.client.get(this.challengeKey(challengeId)) : null;
    if (!challengeId || !raw) {
      if (body.includes(MESSAGE_PREFIX))
        await this.say(waId, 'الكود ده انتهت صلاحيته. ارجع للموقع واطلب كود جديد.');
      return 'unknown_nonce';
    }
    const record = JSON.parse(raw) as OtpRecord;
    if (record.status !== 'pending') return 'already_claimed';

    if (normalizeEgyptianPhone(waId) !== record.payload.phone) {
      // Left pending: the student can still send it from the number they typed.
      await this.say(
        waId,
        'لازم تبعت الرسالة من نفس رقم الواتساب اللي كتبته في الموقع. افتح الرابط من الموبايل اللي عليه الرقم ده وابعتها تاني.',
      );
      return 'phone_mismatch';
    }
    await this.redis.client.del(this.nonceKey(nonce));

    if (record.purpose === 'password-reset' && !record.payload.userId) {
      await this.transition(challengeId, 'rejected');
      await this.say(waId, 'الرقم ده مش مسجل عندنا. اعمل حساب جديد أو تواصل مع الدعم.');
      return 'unknown_account';
    }

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    if (!(await this.transition(challengeId, 'code_sent', this.codeHash(challengeId, code))))
      return 'already_claimed';
    const platform = this.config.get<string>('platform.name') ?? '';
    try {
      await this.whatsapp.sendText(
        waId,
        `كود التحقق بتاعك${platform ? ` في ${platform}` : ''} هو: ${code}\nالكود صالح لمدة محدودة، ومتشاركهوش مع أي حد.`,
      );
      return 'code_sent';
    } catch {
      // Stored but never delivered: unusable, so say so instead of leaving the student waiting.
      await this.redis.client.eval(
        `
        local raw = redis.call('GET', KEYS[1])
        if not raw then return 0 end
        local record = cjson.decode(raw)
        record.status = 'rejected'
        record.codeHash = ''
        redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL')
        return 1
      `,
        1,
        this.challengeKey(challengeId),
      );
      return 'send_failed';
    }
  }

  private async say(waId: string, text: string): Promise<void> {
    try {
      await this.whatsapp.sendText(waId, text);
    } catch {
      this.logger.warn('Could not reply over WhatsApp');
    }
  }

  async verify(challengeId: string, code: string, purpose: OtpPurpose): Promise<OtpPayload> {
    // Check, count failed guesses, preserve expiry and consume exactly once atomically.
    const raw = await this.redis.client.eval(
      `
      local raw = redis.call('GET', KEYS[1])
      if not raw then return '' end
      local record = cjson.decode(raw)
      if record.purpose ~= ARGV[1] then return '' end
      if record.status == 'pending' then return 'pending' end
      if record.status == 'rejected' or record.codeHash ~= ARGV[2] then
        record.attempts = record.attempts + 1
        if record.attempts >= 5 then redis.call('DEL', KEYS[1])
        else redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL') end
        return ''
      end
      redis.call('DEL', KEYS[1])
      return cjson.encode(record.payload)
    `,
      1,
      this.challengeKey(challengeId),
      purpose,
      this.codeHash(challengeId, code),
    );
    if (raw === 'pending')
      throw new BadRequestException(
        'لسه الكود ما اتبعتش. افتح واتساب وابعت الرسالة الأول، وبعدها هيوصلك الكود.',
      );
    if (typeof raw !== 'string' || !raw)
      throw new BadRequestException('الكود غير صحيح أو انتهت صلاحيته.');
    return JSON.parse(raw) as OtpPayload;
  }
}
