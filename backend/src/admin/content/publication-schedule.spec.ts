import { BadRequestException } from '@nestjs/common';
import { PublishStatus } from '../../generated/prisma/enums';
import { resolvePublicationSchedule } from './publication-schedule';

describe('publication schedule shared by content services', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-06T10:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('clears schedules when a draft or published item changes status', () => {
    expect(resolvePublicationSchedule(PublishStatus.DRAFT, 'invalid')).toBeNull();
    expect(resolvePublicationSchedule(PublishStatus.PUBLISHED, '2026-10-07T10:00:00Z')).toBeNull();
  });

  it.each([undefined, 'invalid', '2026-10-05T10:00:00Z', '2026-10-06T10:00:00Z'])(
    'rejects missing, invalid or elapsed scheduled dates: %s',
    (date) =>
      expect(() => resolvePublicationSchedule(PublishStatus.SCHEDULED, date)).toThrow(
        BadRequestException,
      ),
  );

  it('keeps a valid future date', () => {
    expect(resolvePublicationSchedule(PublishStatus.SCHEDULED, '2026-10-07T10:00:00Z')).toEqual(
      new Date('2026-10-07T10:00:00Z'),
    );
  });
});
