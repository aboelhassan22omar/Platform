import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('Student registration phone verification', () => {
  const dto = {
    fullName: 'Test Student',
    username: 'test.student',
    password: 'Str0ng#Password',
    phone: '01012345678',
    parentPhone: '01112345678',
    educationSystem: 'GENERAL',
    gradeLevel: 'SEC_1',
  } as never;

  const build = (mode: string, whatsappConfigured: boolean) => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'user-id',
          tokenVersion: 0,
          ...data,
        })),
      },
      academicYear: { findFirst: jest.fn().mockResolvedValue(null) },
      refreshToken: { create: jest.fn() },
    };
    const otp = { create: jest.fn().mockResolvedValue({ challengeId: 'c', expiresIn: 300 }) };
    const service = new AuthService(
      prisma as never,
      { hash: jest.fn().mockResolvedValue('hash') } as never,
      { signAsync: jest.fn().mockResolvedValue('access') } as never,
      new ConfigService({
        phoneVerification: mode,
        auth: { accessTtl: 900, refreshTtl: 3600, accessSecret: 's' },
      }),
      {} as never,
      otp as never,
      { isConfigured: () => whatsappConfigured } as never,
    );
    jest.spyOn(service, 'toProfile').mockImplementation((user) => user as never);
    return { service, prisma, otp };
  };

  it('requires a WhatsApp OTP when verification is on and configured', async () => {
    const { service, prisma, otp } = build('whatsapp', true);
    const result = await service.register(dto, {});
    expect(result.verificationRequired).toBe(true);
    expect(otp.create).toHaveBeenCalledWith('register', expect.anything());
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it.each([
    ['off', true],
    ['whatsapp', false],
  ])('creates the account directly when mode=%s and configured=%s', async (mode, configured) => {
    const { service, prisma, otp } = build(mode, configured);
    const result = await service.register(dto, {});
    expect(result.verificationRequired).toBe(false);
    expect(otp.create).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '01012345678', phoneVerifiedAt: null }),
      }),
    );
  });
});
