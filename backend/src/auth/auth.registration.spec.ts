import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('Student registration', () => {
  const dto = {
    fullName: 'Test Student',
    username: 'test.student',
    password: 'Str0ng#Password',
    phone: '01012345678',
    parentPhone: '01112345678',
    educationSystem: 'GENERAL',
    gradeLevel: 'SEC_1',
  } as never;

  const build = (existing: { username: string; phone: string } | null = null) => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'user-id',
          tokenVersion: 0,
          ...data,
        })),
      },
      academicYear: { findFirst: jest.fn().mockResolvedValue({ id: 'year' }) },
      refreshToken: { create: jest.fn() },
    };
    const service = new AuthService(
      prisma as never,
      { hash: jest.fn().mockResolvedValue('hash') } as never,
      { signAsync: jest.fn().mockResolvedValue('access') } as never,
      new ConfigService({ auth: { accessTtl: 900, refreshTtl: 3600, accessSecret: 's' } }),
      {} as never,
    );
    jest.spyOn(service, 'toProfile').mockImplementation((user) => user as never);
    return { service, prisma };
  };

  it('creates an active student immediately and signs them in, with no OTP', async () => {
    const { service, prisma } = build();
    const result = await service.register(dto, {});
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '01012345678',
        parentPhone: '01112345678',
        passwordHash: 'hash',
        role: 'STUDENT',
        status: 'ACTIVE',
        academicYearId: 'year',
      }),
    });
    expect(result.tokens.accessToken).toBe('access');
    expect(result.user).toMatchObject({ username: 'test.student' });
  });

  it('refuses a phone number that is already registered', async () => {
    const { service, prisma } = build({ username: 'someone', phone: '01012345678' });
    await expect(service.register(dto, {})).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
