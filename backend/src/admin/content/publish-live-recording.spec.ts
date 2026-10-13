import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentLessonsService } from './content-lessons.service';

describe('Publishing a live recording as a lesson video', () => {
  const build = (recording: Record<string, unknown> | null) => {
    const tx = { liveRecording: { update: jest.fn() } };
    const prisma = {
      liveRecording: { findUnique: jest.fn().mockResolvedValue(recording) },
      lesson: { findUnique: jest.fn().mockResolvedValue({ title: 'حصة موجودة' }) },
      chapter: { findUnique: jest.fn().mockResolvedValue({ id: 'chapter-1' }) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const audit = { record: jest.fn() };
    const videos = { attachExistingSource: jest.fn().mockResolvedValue({ status: 'QUEUED' }) };
    const storage = {
      videoBucket: 'videos',
      statObject: jest.fn().mockResolvedValue({ size: 1234 }),
      copyObject: jest.fn(),
    };
    const service = new ContentLessonsService(
      prisma as never,
      audit as never,
      videos as never,
      storage as never,
    );
    const createLesson = jest
      .spyOn(service, 'createLesson')
      .mockResolvedValue({ id: 'new-lesson', title: 'لايف المراجعة' } as never);
    return { service, prisma, tx, audit, videos, storage, createLesson };
  };
  const ready = {
    id: 'rec-1',
    status: 'READY',
    objectKey: 'live-recordings/s1/r.mp4',
    session: { title: 'لايف المراجعة' },
  };
  const actor = { id: 'admin' } as never;

  it('creates a lesson, copies the file (never moves it) and queues the transcode', async () => {
    const { service, storage, videos, tx, createLesson } = build(ready);
    const result = await service.publishLiveRecording(
      actor,
      'rec-1',
      { chapterId: 'chapter-1', priceMinor: 2500, status: 'PUBLISHED' as never },
      '127.0.0.1',
    );
    expect(createLesson).toHaveBeenCalledWith(
      actor,
      'chapter-1',
      expect.objectContaining({ title: 'لايف المراجعة', priceMinor: 2500, status: 'PUBLISHED' }),
      '127.0.0.1',
    );
    const [, source, target] = storage.copyObject.mock.calls[0];
    expect(source).toBe('live-recordings/s1/r.mp4');
    expect(target).toMatch(/^sources\/new-lesson\/\d+-live\.mp4$/);
    expect(videos.attachExistingSource).toHaveBeenCalledWith(
      'new-lesson',
      expect.objectContaining({ key: target, sizeBytes: BigInt(1234) }),
    );
    expect(tx.liveRecording.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishedLessonId: 'new-lesson' }),
      }),
    );
    expect(result.lessonId).toBe('new-lesson');
  });

  it('replaces the video of an existing lesson without creating one', async () => {
    const { service, createLesson, videos } = build(ready);
    await service.publishLiveRecording(actor, 'rec-1', { lessonId: 'lesson-9' }, undefined);
    expect(createLesson).not.toHaveBeenCalled();
    expect(videos.attachExistingSource).toHaveBeenCalledWith('lesson-9', expect.anything());
  });

  it('refuses recordings that are not ready, missing files and missing targets', async () => {
    await expect(
      build({ ...ready, status: 'PROCESSING' }).service.publishLiveRecording(
        actor,
        'rec-1',
        { chapterId: 'c' },
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build(null).service.publishLiveRecording(actor, 'x', { chapterId: 'c' }, undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
    const missingFile = build(ready);
    missingFile.storage.statObject.mockRejectedValue(new Error('NoSuchKey'));
    await expect(
      missingFile.service.publishLiveRecording(actor, 'rec-1', { chapterId: 'c' }, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build(ready).service.publishLiveRecording(actor, 'rec-1', {}, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
