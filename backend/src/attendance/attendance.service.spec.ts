import { ConfigService } from '@nestjs/config';
import { AttendanceService } from './attendance.service';

const grade = { id: 'g', nameAr: 'تانية بكالوريا', educationSystem: 'BACC', level: 'BACC_2' };

const setup = (opts: { closed?: boolean; created?: number; studentGrade?: string } = {}) => {
  const prisma = {
    attendanceSession: {
      findUnique: jest.fn(async () => ({
        id: 's1',
        title: 'حصة السبت',
        startsAt: new Date('2026-10-17T15:00:00Z'),
        closedAt: opts.closed ? new Date() : null,
        absenceNotifiedAt: null,
        grade,
      })),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(async () => ({
        id: 'stu',
        fullName: 'يوسف محمد',
        role: 'STUDENT',
        status: 'ACTIVE',
        studentType: 'CENTER',
        educationSystem: 'BACC',
        gradeLevel: opts.studentGrade ?? 'BACC_2',
      })),
      findMany: jest.fn(async () => [
        { id: 'stu', fullName: 'يوسف محمد', phone: '01000000001', parentPhone: '01100000001' },
        { id: 'abs', fullName: 'كريم سامي', phone: '01000000002', parentPhone: '01100000002' },
      ]),
    },
    grade: { findUnique: jest.fn(async () => ({ nameAr: 'أولى بكالوريا' })) },
    attendance: {
      createMany: jest.fn(async () => ({ count: opts.created ?? 1 })),
      findMany: jest.fn(async () => [
        {
          method: 'SCAN',
          markedAt: new Date(),
          user: { id: 'stu', fullName: 'يوسف محمد', phone: '01000000001', studentType: 'CENTER' },
        },
      ]),
    },
  };
  const outbox = { enqueue: jest.fn(async (rows: unknown[]) => rows.length) };
  const service = new AttendanceService(
    prisma as never,
    { record: jest.fn() } as never,
    outbox as never,
    new ConfigService({ auth: { accessSecret: 'test-secret' } }),
  );
  return { service, prisma, outbox };
};

describe('Center attendance', () => {
  it("accepts the student's own signed QR and rejects made-up ones", async () => {
    const { service } = setup();
    const token = service.cardToken('stu');
    expect(token).toMatch(/^ATT1\.stu\./);
    expect(await service.scan('assistant', 's1', token)).toMatchObject({ status: 'marked' });
    expect(await service.scan('assistant', 's1', 'ATT1.stu.forgedsignature000000')).toEqual({
      status: 'invalid',
    });
    expect(await service.scan('assistant', 's1', 'random text')).toEqual({ status: 'invalid' });
  });

  it('says when a student was already marked', async () => {
    const { service } = setup({ created: 0 });
    expect(await service.scan('assistant', 's1', service.cardToken('stu'))).toMatchObject({
      status: 'already',
    });
  });

  it('does not mark a student of another grade', async () => {
    const { service, prisma } = setup({ studentGrade: 'BACC_1' });
    expect(await service.scan('assistant', 's1', service.cardToken('stu'))).toMatchObject({
      status: 'wrong_grade',
      student: { grade: 'أولى بكالوريا' },
    });
    expect(prisma.attendance.createMany).not.toHaveBeenCalled();
  });

  it('refuses scans once the class is closed', async () => {
    const { service } = setup({ closed: true });
    await expect(service.scan('assistant', 's1', service.cardToken('stu'))).rejects.toThrow(
      'الحصة اتقفلت',
    );
  });

  it('lists absent center students and messages only their parents on close', async () => {
    const { service, outbox } = setup();
    const detail = await service.detail('s1');
    expect(detail.absent.map((student) => student.id)).toEqual(['abs']);
    const result = await service.close('assistant', 's1', true);
    expect(result.notified).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'CENTER_ABSENCE',
        userId: 'abs',
        phone: '01100000002',
        dedupeKey: 'absence:s1:abs',
      }),
    ]);
  });

  it('exports a spreadsheet Excel reads as Arabic', async () => {
    const { service } = setup();
    const csv = await service.csv('s1');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"يوسف محمد"');
    expect(csv).toContain('"غايب"');
  });
});
