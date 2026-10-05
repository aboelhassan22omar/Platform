/* Run against the local Docker backend:
 * Get-Content -Raw backend/test/otp.integration.cjs | docker compose exec -T backend node
 * Uses real PostgreSQL, Redis, Argon2 and JWT; only WhatsApp delivery is recorded.
 * No provider messages are sent and all fixture records/Redis keys are removed.
 */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomInt } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { configuration } = require('./dist/src/config/configuration');
const { PrismaService } = require('./dist/src/common/prisma/prisma.service');
const { RedisService } = require('./dist/src/common/redis/redis.service');
const { PasswordService } = require('./dist/src/auth/password.service');
const { AuthService } = require('./dist/src/auth/auth.service');
const { OtpService } = require('./dist/src/auth/otp.service');
const { hashToken } = require('./dist/src/common/utils/reference.util');

(async () => {
  const settings = configuration();
  assert.equal(settings.payments.provider, 'dev', 'Only run this fixture test against the local sandbox');
  const config = new ConfigService(settings);
  const prisma = new PrismaService(config);
  const redis = new RedisService(config);
  const passwords = new PasswordService();
  const messages = [];
  const gateway = { ensureConfigured() {}, async sendOtp(phone, code) { messages.push({ phone, code }); } };
  const otp = new OtpService(redis, config, gateway);
  const auth = new AuthService(prisma, passwords, new JwtService(), config, redis, otp);
  const phones = [];
  const challengeIds = [];
  let fixtureId;
  const phone = () => { const value = `0109${randomInt(1000000, 9999999)}`; phones.push(value); return value; };
  const remember = result => { challengeIds.push(result.challengeId); return result; };
  const wrong = code => code === '000000' ? '000001' : '000000';
  const rejected = (operation, status = 400) => assert.rejects(operation, error => error.getStatus?.() === status);
  try {
    await prisma.$connect(); await redis.onModuleInit();
    const student = { fullName: 'OTP integration fixture', username: `otp_fixture_${Date.now()}`, password: 'Original12345', phone: phone(), parentPhone: '01112345678', educationSystem: 'GENERAL', gradeLevel: 'SEC_1', studentType: 'CENTER' };
    const started = remember(await auth.register(student));
    assert.deepEqual(Object.keys(started).sort(), ['challengeId', 'expiresIn', 'resendAfterSeconds']);
    assert.equal(await prisma.user.findUnique({ where: { phone: student.phone } }), null);
    const pending = await redis.client.get(`auth:otp:challenge:${started.challengeId}`);
    assert(!pending.includes(student.password), 'Pending registration must not retain plaintext passwords');
    assert.match(JSON.parse(pending).payload.registration.passwordHash, /^\$argon2/);
    const firstCode = messages.at(-1).code;
    await rejected(() => auth.verifyRegistration(started.challengeId, wrong(firstCode), {}));
    await rejected(() => auth.verifyPasswordReset(started.challengeId, firstCode));
    const registered = await auth.verifyRegistration(started.challengeId, firstCode, {});
    fixtureId = registered.user.id;
    const stored = await prisma.user.findUnique({ where: { id: fixtureId } });
    assert(stored.phoneVerifiedAt); assert.equal(stored.studentType, 'CENTER');
    assert(await passwords.verify(stored.passwordHash, student.password));
    await rejected(() => auth.verifyRegistration(started.challengeId, firstCode, {}));
    const session = await auth.login({ identifier: student.username, password: student.password }, {});
    const before = await fetch('http://localhost:4000/api/auth/me', { headers: { Cookie: `access_token=${session.tokens.accessToken}` } });
    assert.equal(before.status, 200);

    const reset = remember(await auth.requestPasswordReset(student.phone));
    assert(!('token' in reset) && !('devToken' in reset));
    const resetCode = messages.at(-1).code;
    await rejected(() => auth.verifyPasswordReset(reset.challengeId, wrong(resetCode)));
    const verified = await auth.verifyPasswordReset(reset.challengeId, resetCode);
    await rejected(() => auth.verifyPasswordReset(reset.challengeId, resetCode));
    const newPassword = 'Updated12345';
    const outcomes = await Promise.allSettled([
      auth.confirmPasswordReset({ token: verified.token, newPassword }),
      auth.confirmPasswordReset({ token: verified.token, newPassword }),
    ]);
    assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1, 'Reset grant must be single use under concurrency');
    await rejected(() => auth.confirmPasswordReset({ token: verified.token, newPassword }));
    await rejected(() => auth.login({ identifier: student.username, password: student.password }, {}), 401);
    await auth.login({ identifier: student.phone, password: newPassword }, {});
    const updated = await prisma.user.findUnique({ where: { id: fixtureId } });
    assert(await passwords.verify(updated.passwordHash, newPassword));
    const after = await fetch('http://localhost:4000/api/auth/me', { headers: { Cookie: `access_token=${session.tokens.accessToken}` } });
    assert.equal(after.status, 401, 'Password reset must revoke existing access tokens');
    const oldRefresh = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(session.tokens.refreshToken) } });
    assert(oldRefresh.revokedAt);
    console.log('PASS: verified registration, database password update, old password/session revocation, concurrent reset replay protection');

    const resendPhone = phone();
    const original = remember(await otp.create('register', { phone: resendPhone }));
    const originalCode = messages.at(-1).code;
    await rejected(() => otp.resend(original.challengeId), 429);
    await redis.client.del(`auth:otp:phone:register:${hashToken(resendPhone)}:cooldown`);
    const replacement = remember(await otp.resend(original.challengeId));
    const replacementCode = messages.at(-1).code;
    await rejected(() => otp.verify(original.challengeId, originalCode, 'register'));
    await otp.verify(replacement.challengeId, replacementCode, 'register');
    await rejected(() => otp.verify(replacement.challengeId, replacementCode, 'register'));

    const locked = remember(await otp.create('register', { phone: phone() }));
    const lockedCode = messages.at(-1).code;
    for (let i = 0; i < 5; i++) await rejected(() => otp.verify(locked.challengeId, wrong(lockedCode), 'register'));
    await rejected(() => otp.verify(locked.challengeId, lockedCode, 'register'));
    const expired = remember(await otp.create('register', { phone: phone() }));
    const expiredCode = messages.at(-1).code;
    await redis.client.pexpire(`auth:otp:challenge:${expired.challengeId}`, 1);
    await new Promise(resolve => setTimeout(resolve, 10));
    await rejected(() => otp.verify(expired.challengeId, expiredCode, 'register'));

    const countBeforeUnknown = messages.length;
    const unknown = remember(await auth.requestPasswordReset(phone()));
    assert.equal(messages.length, countBeforeUnknown);
    assert.deepEqual(Object.keys(unknown).sort(), Object.keys(reset).sort());
    assert.equal(await prisma.passwordReset.count({ where: { userId: fixtureId, usedAt: null } }), 0);
    const ratePhone = phone();
    await redis.client.set(`auth:otp:sends:${hashToken(ratePhone)}`, '5', 'EX', 3600);
    await rejected(() => otp.create('register', { phone: ratePhone }), 429);
    console.log('PASS: resend cooldown, old-code invalidation, one-use OTP, expiry, five-attempt lock, hourly send limit, unknown-account privacy');
  } finally {
    if (fixtureId) await prisma.user.deleteMany({ where: { id: fixtureId } });
    for (const value of phones) {
      const phoneHash = hashToken(value);
      await redis.client.del(`auth:otp:sends:${phoneHash}`);
      for (const purpose of ['register', 'password-reset']) {
        const key = `auth:otp:phone:${purpose}:${phoneHash}`;
        const id = await redis.client.get(key);
        if (id) await redis.client.del(`auth:otp:challenge:${id}`);
        await redis.client.del(key, `${key}:cooldown`);
      }
    }
    for (const id of challengeIds) await redis.client.del(`auth:otp:challenge:${id}`);
    await redis.onModuleDestroy(); await prisma.$disconnect();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
