'use client';
import { motion } from 'motion/react';
import { VideoUploader } from './video-uploader';
import { type AdminLesson } from './admin-content.types';
import { AttachmentUploader } from './content-editor';

export function UploadDialog({
  lesson,
  onClose,
}: {
  lesson: AdminLesson | null;
  onClose: () => void;
}) {
  if (!lesson) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button
        type="button"
        aria-label="إغلاق رفع الفيديو"
        className="absolute inset-0 bg-midnight-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
        className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold-500/30 bg-white p-5 shadow-2xl dark:bg-midnight-950 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-gold-700 dark:text-gold-300">رفع فيديو الحصة</p>
            <h2
              id="upload-dialog-title"
              className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
            >
              {lesson.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-10 w-10 place-items-center rounded-xl text-xl text-midnight-500 hover:bg-midnight-50 dark:text-ivory-300 dark:hover:bg-midnight-800"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/65">
          اختار الفيديو وسيبدأ الرفع ثم التحويل للجودات المختلفة تلقائيًا.
        </p>
        <div className="mt-5">
          <VideoUploader lessonId={lesson.id} />
        </div>
        <AttachmentUploader lesson={lesson} />
      </motion.div>
    </div>
  );
}
