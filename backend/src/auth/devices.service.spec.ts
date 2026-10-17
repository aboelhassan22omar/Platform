import { DeviceLimitException, DevicesService, describeDevice } from './devices.service';
import { hashToken } from '../common/utils/reference.util';

const KNOWN = 'k'.repeat(43);

const setup = (opts: { maxDevices: number; devices: string[] }) => {
  const rows = opts.devices.map((token, index) => ({
    id: `d${index}`,
    tokenHash: hashToken(token),
  }));
  const tx = {
    $queryRaw: jest.fn(),
    userDevice: {
      findUnique: jest.fn(
        async ({ where }: { where: { userId_tokenHash: { tokenHash: string } } }) =>
          rows.find((row) => row.tokenHash === where.userId_tokenHash.tokenHash) ?? null,
      ),
      update: jest.fn(),
      count: jest.fn(async () => rows.length),
      create: jest.fn(async () => ({ id: 'new-device' })),
    },
  };
  const prisma = { $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
  const access = {
    get: jest.fn(async () => ({ maxDevices: opts.maxDevices, defaultMaxViews: 0 })),
  };
  const service = new DevicesService(
    prisma as never,
    access as never,
    { record: jest.fn() } as never,
  );
  return { service, tx };
};

const student = { id: 'student', role: 'STUDENT' as const };

describe('Device limit', () => {
  it('lets a known browser sign in again even when the account is full', async () => {
    const { service, tx } = setup({ maxDevices: 1, devices: [KNOWN] });
    const result = await service.register(student, { deviceToken: KNOWN });
    expect(result).toEqual({ deviceId: 'd0', token: KNOWN });
    expect(tx.userDevice.create).not.toHaveBeenCalled();
  });

  it('registers a new browser while there is room, with a fresh cookie', async () => {
    const { service, tx } = setup({ maxDevices: 2, devices: [KNOWN] });
    const result = await service.register(student, {
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36',
    });
    expect(result.deviceId).toBe('new-device');
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(tx.userDevice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ label: 'Chrome على Android' }) }),
    );
  });

  it('refuses a new browser once the account is full', async () => {
    const { service, tx } = setup({ maxDevices: 2, devices: [KNOWN, 'x'.repeat(43)] });
    await expect(service.register(student, { deviceToken: 'n'.repeat(43) })).rejects.toBeInstanceOf(
      DeviceLimitException,
    );
    expect(tx.userDevice.create).not.toHaveBeenCalled();
  });

  it('never limits staff, or anyone when the limit is off', async () => {
    const full = { devices: [KNOWN, 'x'.repeat(43)] };
    const staff = setup({ maxDevices: 1, ...full });
    await expect(staff.service.register({ id: 'admin', role: 'ADMIN' }, {})).resolves.toBeTruthy();
    const off = setup({ maxDevices: 0, ...full });
    await expect(off.service.register(student, {})).resolves.toBeTruthy();
  });

  it('ignores a malformed cookie instead of trusting it', async () => {
    const { service } = setup({ maxDevices: 3, devices: [] });
    const result = await service.register(student, { deviceToken: 'short' });
    expect(result.token).not.toBe('short');
  });

  it('names devices readably', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari على iPhone');
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0',
      ),
    ).toBe('Edge على Windows');
  });
});
