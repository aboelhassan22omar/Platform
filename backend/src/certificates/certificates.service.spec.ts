import { CertificatesService, newCertificateSerial } from './certificates.service';

type Existing = { serial: string; percentage: number } | null;

const attempt = (
  percentage: number,
  exam: { certificateEnabled: boolean; certificateMinScore: number },
  status = 'SUBMITTED',
) => ({
  id: 'attempt-2',
  userId: 'student',
  status,
  percentage,
  user: { fullName: 'سارة أحمد' },
  assessment: { id: 'exam', title: 'امتحان الوحدة الأولى', ...exam },
});

const setup = (row: ReturnType<typeof attempt> | null, existing: Existing = null) => {
  const prisma = {
    assessmentAttempt: { findUnique: jest.fn().mockResolvedValue(row) },
    certificate: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => args.data),
      update: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        ...existing,
        ...args.data,
      })),
    },
  };
  const service = new CertificatesService(prisma as never, {} as never);
  return { prisma, service };
};

describe('Exam certificates', () => {
  it('issues a certificate when the attempt reaches the minimum score', async () => {
    const { prisma, service } = setup(
      attempt(90, { certificateEnabled: true, certificateMinScore: 85 }),
    );
    const certificate = await service.issueForAttempt('attempt-2');
    expect(certificate).toMatchObject({
      recipientName: 'سارة أحمد',
      assessmentTitle: 'امتحان الوحدة الأولى',
      percentage: 90,
    });
    expect(prisma.certificate.create).toHaveBeenCalledTimes(1);
  });

  it('issues nothing below the minimum, when switched off, or before submission', async () => {
    for (const row of [
      attempt(84, { certificateEnabled: true, certificateMinScore: 85 }),
      attempt(100, { certificateEnabled: false, certificateMinScore: 85 }),
      attempt(100, { certificateEnabled: true, certificateMinScore: 85 }, 'IN_PROGRESS'),
    ]) {
      const { prisma, service } = setup(row);
      expect(await service.issueForAttempt('attempt-2')).toBeNull();
      expect(prisma.certificate.create).not.toHaveBeenCalled();
    }
  });

  it('upgrades the score of a better attempt without changing the serial', async () => {
    const { prisma, service } = setup(
      attempt(95, { certificateEnabled: true, certificateMinScore: 85 }),
      { serial: 'ABCD-EFGH-JK', percentage: 88 },
    );
    const certificate = await service.issueForAttempt('attempt-2');
    expect(certificate).toMatchObject({ serial: 'ABCD-EFGH-JK', percentage: 95 });
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('keeps the better certificate when a later attempt scores lower', async () => {
    const { prisma, service } = setup(
      attempt(86, { certificateEnabled: true, certificateMinScore: 85 }),
      { serial: 'ABCD-EFGH-JK', percentage: 98 },
    );
    expect(await service.issueForAttempt('attempt-2')).toMatchObject({ percentage: 98 });
    expect(prisma.certificate.update).not.toHaveBeenCalled();
  });

  it('prints serials that are easy to read back (no 0/O/1/I/L)', () => {
    for (let i = 0; i < 200; i += 1)
      expect(newCertificateSerial()).toMatch(
        /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/,
      );
  });
});
