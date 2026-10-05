// E2E-only subprocess. No HTTP bypass or test OTP exists in the application.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Logger } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { plainToInstance } = require('class-transformer');
const { validateOrReject } = require('class-validator');
const { configuration } = require('./dist/src/config/configuration');
const { PrismaService } = require('./dist/src/common/prisma/prisma.service');
const { RedisService } = require('./dist/src/common/redis/redis.service');
const { AuthService } = require('./dist/src/auth/auth.service');
const { PasswordService } = require('./dist/src/auth/password.service');
const { OtpService } = require('./dist/src/auth/otp.service');
const { RegisterDto } = require('./dist/src/auth/dto/auth.dto');
Logger.overrideLogger(false);

(async () => {
  const settings = configuration();
  assert.equal(settings.payments.provider, 'dev', 'Fixture messaging is only allowed in the local sandbox');
  assert(['localhost', '127.0.0.1'].includes(new URL(settings.publicSiteUrl).hostname), 'Fixture messaging is restricted to localhost');
  const config = new ConfigService(settings);
  const prisma = new PrismaService(config);
  const redis = new RedisService(config);
  let code;
  const gateway = { ensureConfigured() {}, async sendOtp(_phone, value) { code = value; } };
  const otp = new OtpService(redis, config, gateway);
  const auth = new AuthService(prisma, new PasswordService(), new JwtService(), config, redis, otp);
  try {
    await prisma.$connect(); await redis.onModuleInit();
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const dto = plainToInstance(RegisterDto, JSON.parse(input));
    await validateOrReject(dto, { whitelist: true, forbidNonWhitelisted: true });
    const challenge = await auth.register(dto);
    process.stdout.write(JSON.stringify({ ...challenge, code }));
  } finally {
    await redis.onModuleDestroy(); await prisma.$disconnect();
  }
})().catch(() => { process.stderr.write('Unable to create local OTP fixture'); process.exitCode = 1; });
