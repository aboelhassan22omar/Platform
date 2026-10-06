import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'node:crypto';
import { RedisService } from '../common/redis/redis.service';
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
interface OtpRecord {
  purpose: OtpPurpose;
  payload: OtpPayload;
  codeHash: string;
  attempts: number;
}
const TTL = 300;
const COOLDOWN = 60;

@Injectable()
export class OtpService {
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

  async create(purpose: OtpPurpose, payload: OtpPayload) {
    this.whatsapp.ensureConfigured();
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
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    try {
      // Unknown reset accounts get an indistinguishable challenge with no message.
      if (purpose === 'register' || payload.userId)
        await this.whatsapp.sendOtp(payload.phone, code);
      const previous = await this.redis.client.get(phoneKey);
      const record: OtpRecord = {
        purpose,
        payload,
        codeHash: this.codeHash(challengeId, code),
        attempts: 0,
      };
      const transaction = this.redis.client
        .multi()
        .set(`auth:otp:challenge:${challengeId}`, JSON.stringify(record), 'EX', TTL)
        .set(phoneKey, challengeId, 'EX', TTL);
      if (previous) transaction.del(`auth:otp:challenge:${previous}`);
      await transaction.exec();
      return { challengeId, expiresIn: TTL, resendAfterSeconds: COOLDOWN };
    } catch (error) {
      await this.redis.client.del(`${phoneKey}:cooldown`);
      throw error;
    }
  }

  async resend(challengeId: string) {
    const raw = await this.redis.client.get(`auth:otp:challenge:${challengeId}`);
    if (!raw) throw new BadRequestException('انتهت صلاحية الكود. ابدأ من جديد.');
    const record = JSON.parse(raw) as OtpRecord;
    return this.create(record.purpose, record.payload);
  }

  async verify(challengeId: string, code: string, purpose: OtpPurpose): Promise<OtpPayload> {
    // Check, count failed guesses, preserve expiry and consume exactly once atomically.
    const raw = await this.redis.client.eval(
      `
      local raw = redis.call('GET', KEYS[1])
      if not raw then return '' end
      local record = cjson.decode(raw)
      if record.purpose ~= ARGV[1] then return '' end
      if record.codeHash ~= ARGV[2] then
        record.attempts = record.attempts + 1
        if record.attempts >= 5 then redis.call('DEL', KEYS[1])
        else redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL') end
        return ''
      end
      redis.call('DEL', KEYS[1])
      return cjson.encode(record.payload)
    `,
      1,
      `auth:otp:challenge:${challengeId}`,
      purpose,
      this.codeHash(challengeId, code),
    );
    if (typeof raw !== 'string' || !raw)
      throw new BadRequestException('الكود غير صحيح أو انتهت صلاحيته.');
    return JSON.parse(raw) as OtpPayload;
  }
}
