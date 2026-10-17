import { MessageKind } from '../generated/prisma/enums';
import { MESSAGE_TEMPLATES, cleanParam, renderTemplate } from './message-templates';
import { DEFAULT_MESSAGING_SETTINGS, type MessagingSettings } from './messaging-settings.service';
import { OutboxService, toWhatsAppNumber } from './outbox.service';
import { describeStudyTime } from './parent-reports.service';

const settingsWith = (patch: Partial<MessagingSettings>): MessagingSettings => ({
  ...DEFAULT_MESSAGING_SETTINGS,
  mode: 'manual',
  ...patch,
});

const setup = (settings: MessagingSettings) => {
  const prisma = {
    outboundMessage: {
      createMany: jest.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
  };
  const service = new OutboxService(
    prisma as never,
    { get: jest.fn(async () => settings) } as never,
  );
  return { service, prisma };
};

const message = (kind: MessageKind = MessageKind.NEW_LESSON, phone = '01012345678') => ({
  kind,
  userId: 'student',
  phone,
  params: ['الثورة العرابية', 'التاريخ\nالصف الثالث', 'https://example.com/lessons/1'],
  dedupeKey: `test:${kind}:${phone}`,
});

describe('WhatsApp templates', () => {
  it('never start or end with a variable, as Meta requires', () => {
    for (const template of Object.values(MESSAGE_TEMPLATES)) {
      expect(template.text.trim()).not.toMatch(/^\{\{\d+\}\}/);
      expect(template.text.trim()).not.toMatch(/\{\{\d+\}\}$/);
      const used = new Set(template.text.match(/\{\{\d+\}\}/g));
      expect(used.size).toBe(template.params.length);
    }
  });

  it('fills variables and keeps values on one line', () => {
    expect(cleanParam(' سطر\nتاني\t  تالت ')).toBe('سطر تاني تالت');
    expect(cleanParam('')).toBe('—');
    expect(renderTemplate('أ {{1}} ب {{2}}.', ['x', 'y'])).toBe('أ x ب y.');
  });
});

describe('Outbox', () => {
  it('queues nothing while messaging is off', async () => {
    const { service, prisma } = setup(settingsWith({ mode: 'off' }));
    expect(await service.enqueue([message()])).toBe(0);
    expect(prisma.outboundMessage.createMany).not.toHaveBeenCalled();
  });

  it('hands messages to staff in manual mode, ready to send', async () => {
    const { service, prisma } = setup(settingsWith({ mode: 'manual' }));
    await service.enqueue([message()]);
    const [row] = prisma.outboundMessage.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    expect(row).toMatchObject({
      status: 'MANUAL',
      toPhone: '201012345678',
      templateName: 'new_lesson_available',
      audience: 'STUDENT',
    });
    expect(row.body).toContain('«الثورة العرابية» في التاريخ الصف الثالث.');
  });

  it('skips switched-off kinds and invalid numbers, and ignores repeats', async () => {
    const { service, prisma } = setup(
      settingsWith({ kinds: { ...DEFAULT_MESSAGING_SETTINGS.kinds, NEW_LESSON: false } }),
    );
    await service.enqueue([
      message(MessageKind.NEW_LESSON),
      message(MessageKind.HOMEWORK_DUE, '123'),
    ]);
    expect(prisma.outboundMessage.createMany).not.toHaveBeenCalled();
    await service.enqueue([message(MessageKind.HOMEWORK_DUE)]);
    expect(prisma.outboundMessage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('holds messages written at night until 9 in the morning, Cairo time', () => {
    const { service } = setup(settingsWith({}));
    const settings = settingsWith({});
    // 23:30 Cairo (20:30 UTC in summer time) waits for 09:00 next day.
    expect(service.afterQuietHours(new Date('2026-08-10T20:30:00Z'), settings).toISOString()).toBe(
      '2026-08-11T06:00:00.000Z',
    );
    // 02:00 Cairo waits for 09:00 the same day.
    expect(service.afterQuietHours(new Date('2026-08-10T23:00:00Z'), settings).toISOString()).toBe(
      '2026-08-11T06:00:00.000Z',
    );
    // 15:00 Cairo goes now.
    const afternoon = new Date('2026-08-10T12:00:00Z');
    expect(service.afterQuietHours(afternoon, settings)).toBe(afternoon);
  });

  it('formats numbers the way WhatsApp expects', () => {
    expect(toWhatsAppNumber('01012345678')).toBe('201012345678');
    expect(toWhatsAppNumber('+20 101 234 5678')).toBe('201012345678');
    expect(toWhatsAppNumber('12345')).toBeNull();
  });
});

describe('Parent report wording', () => {
  it('describes study time in plain Arabic', () => {
    expect(describeStudyTime(0)).toBe('مذاكرش فيديوهات الأسبوع ده');
    expect(describeStudyTime(45 * 60)).toBe('٤٥ دقيقة');
    expect(describeStudyTime(2 * 3600 + 20 * 60)).toBe('ساعتين و٢٠ دقيقة');
    expect(describeStudyTime(3600)).toBe('ساعة');
  });
});
