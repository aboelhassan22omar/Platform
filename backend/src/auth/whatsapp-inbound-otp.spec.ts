import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import Redis from 'ioredis';
import { extractNonce, OtpService } from './otp.service';
import { inboundTextMessages, signatureIsValid } from './whatsapp-webhook.controller';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsApp click-to-chat OTP helpers', () => {
  it('finds the nonce in an edited message and ignores longer words', () => {
    expect(extractNonce('كود التفعيل: AB23CD45')).toBe('AB23CD45');
    expect(extractNonce('مرحبا ab23cd45 شكرا')).toBe('AB23CD45');
    expect(extractNonce('STRENGTHS only')).toBeNull();
    expect(extractNonce('')).toBeNull();
  });

  it('reads text messages from a Meta delivery and skips everything else', () => {
    const value = (messages: unknown[]) => ({ entry: [{ changes: [{ value: { messages } }] }] });
    expect(
      inboundTextMessages(
        value([
          { from: '201012345678', id: 'm1', type: 'text', text: { body: 'hi' } },
          { from: '201012345678', id: 'm2', type: 'image' },
        ]),
      ),
    ).toEqual([{ waId: '201012345678', text: 'hi', messageId: 'm1' }]);
    expect(inboundTextMessages({ entry: 'nonsense' })).toEqual([]);
    expect(inboundTextMessages(null)).toEqual([]);
  });

  it('accepts only bodies signed with the app secret', () => {
    const body = Buffer.from('{"entry":[]}');
    const good = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
    expect(signatureIsValid(body, good, 'secret')).toBe(true);
    expect(signatureIsValid(body, good, 'other')).toBe(false);
    expect(signatureIsValid(body, undefined, 'secret')).toBe(false);
  });

  it('prefers the click-to-chat flow when the business number is set', () => {
    const service = (whatsapp: object) =>
      new WhatsAppService(
        new ConfigService({ whatsapp: { phoneNumberId: 'id', token: 't', ...whatsapp } }),
      );
    expect(service({ businessNumber: '201000000000', otpTemplate: 'x' }).deliveryMode()).toBe(
      'inbound',
    );
    expect(service({ otpTemplate: 'x' }).deliveryMode()).toBe('template');
    expect(service({}).deliveryMode()).toBeNull();
  });
});

/** Runs the real Lua scripts; set REDIS_TEST_URL (e.g. redis://127.0.0.1:6390) to enable. */
const withRedis = process.env.REDIS_TEST_URL ? describe : describe.skip;
withRedis('WhatsApp click-to-chat OTP flow (Redis)', () => {
  let redis: Redis;
  const sent: Array<[string, string]> = [];
  const whatsapp = new WhatsAppService(
    new ConfigService({
      whatsapp: { phoneNumberId: 'id', token: 't', businessNumber: '201000000000' },
    }),
  );
  jest.spyOn(whatsapp, 'sendText').mockImplementation(async (to, body) => {
    sent.push([to, body]);
  });
  let otp: OtpService;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_TEST_URL!);
    otp = new OtpService(
      {
        client: redis,
        incrementWithTtl: async (key: string, ttl: number) => {
          const value = await redis.incr(key);
          if (value === 1) await redis.expire(key, ttl);
          return value;
        },
      } as never,
      new ConfigService({ auth: { accessSecret: 'x'.repeat(32) }, platform: { name: 'المنصة' } }),
      whatsapp,
    );
  });
  beforeEach(async () => {
    sent.length = 0;
    await redis.flushdb();
  });
  afterAll(() => redis.quit());

  const nonceOf = (message?: string) => extractNonce(message ?? '')!;

  it('replies with the code to the matching number, which then verifies once', async () => {
    const challenge = await otp.create('register', { phone: '01012345678' });
    expect(challenge).toMatchObject({ delivery: 'whatsapp-link', expiresIn: 600 });
    expect(challenge.whatsappLink).toContain('https://wa.me/201000000000?text=');
    await expect(otp.verify(challenge.challengeId, '000000', 'register')).rejects.toThrow(
      'لسه الكود',
    );
    expect(await otp.status(challenge.challengeId)).toEqual({ status: 'pending' });

    const nonce = nonceOf(challenge.whatsappMessage);
    expect(await otp.claim('201099999999', `كود التفعيل: ${nonce}`, 'w0')).toBe('phone_mismatch');
    expect(await otp.claim('201012345678', `كود التفعيل: ${nonce}`, 'w1')).toBe('code_sent');
    expect(await otp.claim('201012345678', `كود التفعيل: ${nonce}`, 'w1')).toBe('duplicate');
    expect(await otp.claim('201012345678', `كود التفعيل: ${nonce}`, 'w2')).toBe('unknown_nonce');
    expect(await otp.status(challenge.challengeId)).toEqual({ status: 'code_sent' });

    const code = /(\d{6})/.exec(sent.find(([to]) => to === '201012345678')![1])![1];
    await expect(otp.verify(challenge.challengeId, code, 'register')).resolves.toMatchObject({
      phone: '01012345678',
    });
    await expect(otp.verify(challenge.challengeId, code, 'register')).rejects.toThrow();
  });

  it('tells an unregistered number that asked for a reset instead of sending a code', async () => {
    const challenge = await otp.create('password-reset', { phone: '01012345678' });
    const nonce = nonceOf(challenge.whatsappMessage);
    expect(await otp.claim('201012345678', nonce, 'w3')).toBe('unknown_account');
    expect(await otp.status(challenge.challengeId)).toEqual({ status: 'rejected' });
    expect(sent[0][1]).not.toMatch(/\d{6}/);
  });
});
