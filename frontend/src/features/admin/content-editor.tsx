'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { DateTimePicker, isoToLocalInput } from '@/components/ui/date-time-picker';
import { LessonPricingFields } from './lesson-pricing-fields';
import {
  type AdminGrade,
  type AdminLesson,
  type EditorTarget,
  type EntityKind,
} from './admin-content.types';

export function EntityEditor({
  target,
  grades,
  onClose,
  onSaved,
}: {
  target: EditorTarget | null;
  grades: AdminGrade[];
  onClose: () => void;
  onSaved: (value?: { id?: string }) => void | Promise<void>;
}) {
  const [status, setStatus] = useState('PUBLISHED');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!target) return {};
      if (target.mode === 'edit')
        return api.patch<{ id?: string }>(
          `/admin/content/${target.kind}s/${target.entity?.id}`,
          payload,
        );
      if (target.kind === 'course')
        return api.post<{ id?: string }>('/admin/content/courses', payload);
      if (target.kind === 'unit')
        return api.post<{ id?: string }>(
          `/admin/content/courses/${target.parentId}/units`,
          payload,
        );
      if (target.kind === 'chapter')
        return api.post<{ id?: string }>(
          `/admin/content/units/${target.parentId}/chapters`,
          payload,
        );
      return api.post<{ id?: string }>(
        `/admin/content/chapters/${target.parentId}/lessons`,
        payload,
      );
    },
    onSuccess: onSaved,
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'تعذر حفظ التعديل.'),
  });

  useEffect(() => {
    setError(null);
    setStatus(target?.entity?.status ?? 'PUBLISHED');
  }, [target]);
  if (!target) return null;
  const labels: Record<EntityKind, string> = {
    course: 'الكورس / الباكدج',
    unit: 'الوحدة',
    chapter: 'الفصل / الباكدج',
    lesson: 'الحصة',
  };
  const entity = target.entity;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button
        type="button"
        aria-label="إغلاق نافذة التعديل"
        className="absolute inset-0 bg-midnight-950/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.form
        key={`${target.kind}-${target.mode}-${entity?.id ?? 'new'}`}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const payload: Record<string, unknown> = {
            title: String(form.get('title') ?? '').trim(),
            description: String(form.get('description') ?? '').trim(),
            status: String(form.get('status') ?? 'DRAFT'),
          };
          const scheduledAt = String(form.get('scheduledAt') ?? '').trim();
          if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString();
          const sortOrder = String(form.get('sortOrder') ?? '').trim();
          if (sortOrder !== '') payload.sortOrder = Number(sortOrder);
          if (target.kind === 'course') payload.gradeId = String(form.get('gradeId') ?? '');
          if (target.kind === 'course' || target.kind === 'chapter' || target.kind === 'lesson')
            payload.priceMinor = Math.max(0, Math.round(Number(form.get('price') ?? 0) * 100));
          if (target.kind === 'lesson') payload.isFreePreview = form.get('isFreePreview') === 'on';
          if (target.kind === 'lesson')
            payload.centerPriceMinor =
              form.get('customCenterPrice') !== 'on'
                ? null
                : form.get('centerFree') === 'on'
                  ? 0
                  : Math.round(Number(form.get('centerPrice')) * 100);
          mutation.mutate(payload);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-editor-title"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gold-500/30 bg-white p-4 shadow-2xl dark:bg-midnight-950 sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-gold-700 dark:text-gold-300">
              {target.mode === 'create' ? 'إضافة جديدة' : 'تعديل'}
            </p>
            <h2
              id="entity-editor-title"
              className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
            >
              {labels[target.kind]}
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

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="editor-label">الاسم</span>
            <input
              name="title"
              required
              minLength={2}
              maxLength={200}
              defaultValue={entity?.title ?? ''}
              className="editor-input"
              autoFocus
            />
          </label>
          {target.kind === 'course' && (
            <label>
              <span className="editor-label">الصف</span>
              <select
                name="gradeId"
                required
                defaultValue={entity?.gradeId ?? target.gradeId ?? ''}
                className="editor-input"
              >
                <option value="" disabled>
                  اختار الصف
                </option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.nameAr}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="editor-label">الحالة</span>
            <select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="editor-input"
            >
              <option value="PUBLISHED">منشور — يظهر للطلاب فورًا</option>
              <option value="DRAFT">مسودة — لا تظهر للطلاب</option>
              <option value="SCHEDULED">مجدول</option>
              <option value="ARCHIVED">مؤرشف</option>
            </select>
          </label>
          {status === 'SCHEDULED' && (
            <div>
              <span className="editor-label">وقت النشر المجدول</span>
              <DateTimePicker
                name="scheduledAt"
                disablePast
                defaultValue={isoToLocalInput(entity?.scheduledAt)}
              />
              <span className="mt-1 block text-[11px] text-midnight-400 dark:text-ivory-300/55">
                مطلوب عند اختيار حالة «مجدول».
              </span>
            </div>
          )}
          <label>
            <span className="editor-label">الترتيب</span>
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={entity?.sortOrder ?? ''}
              placeholder="تلقائي بعد آخر عنصر"
              className="editor-input"
            />
          </label>
          {(target.kind === 'course' || target.kind === 'chapter') && (
            <label>
              <span className="editor-label">السعر بالجنيه</span>
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={(entity?.priceMinor ?? 0) / 100}
                className="editor-input"
              />
              <span className="mt-1 block text-[11px] text-midnight-400 dark:text-ivory-300/55">
                اكتب 0 لو غير متاح للبيع منفردًا.
              </span>
            </label>
          )}
          {target.kind === 'lesson' && (
            <LessonPricingFields
              priceMinor={entity?.priceMinor}
              centerPriceMinor={entity?.centerPriceMinor}
            />
          )}
          <label className="sm:col-span-2">
            <span className="editor-label">الوصف</span>
            <textarea
              name="description"
              rows={1}
              maxLength={2000}
              defaultValue={entity?.description ?? ''}
              className="editor-input resize-y py-2"
            />
          </label>
          {target.kind === 'lesson' && (
            <label className="sm:col-span-2 flex min-h-12 items-center gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 px-4">
              <input
                name="isFreePreview"
                type="checkbox"
                defaultChecked={entity?.isFreePreview}
                className="h-5 w-5 accent-gold-600"
              />
              <span className="text-sm font-bold text-midnight-800 dark:text-ivory-200">
                اسمح للطلاب بمشاهدة الحصة مجانًا
              </span>
            </label>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-500/25 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        )}
        <div className="sticky bottom-0 mt-3 flex justify-end gap-2 bg-white pt-2 dark:bg-midnight-950">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            إلغاء
          </Button>
          <Button type="submit" variant="accent" isLoading={mutation.isPending}>
            حفظ التغييرات
          </Button>
        </div>
      </motion.form>
    </div>
  );
}

export function AttachmentUploader({ lesson }: { lesson: AdminLesson }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const ticket = await api.post<{ url: string; key: string }>(
        `/admin/content/lessons/${lesson.id}/attachments/upload-ticket`,
        {
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        },
      );
      const sent = await fetch(ticket.url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!sent.ok) throw new Error('تعذر رفع الملف إلى التخزين');
      await api.post(`/admin/content/lessons/${lesson.id}/attachments/complete`, {
        key: ticket.key,
        title: file.name,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-course-tree'] });
      setMessage('تم رفع ملف الحصة بنجاح.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'تعذر رفع الملف.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 border-t border-gold-500/20 pt-5">
      <h3 className="font-display text-base font-black text-midnight-950 dark:text-ivory-50">
        ملفات الحصة
      </h3>
      <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/65">
        PDF أو Word أو Excel أو PowerPoint، بحد أقصى 25 ميجابايت.
      </p>
      <label className="mt-3 inline-flex cursor-pointer rounded-xl bg-gold-600 px-4 py-2.5 text-sm font-black text-white">
        {busy ? 'جاري الرفع…' : 'اختيار ملف'}
        <input
          className="sr-only"
          type="file"
          disabled={busy}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.currentTarget.value = '';
          }}
        />
      </label>
      {message && (
        <p className="mt-2 text-xs font-bold text-midnight-600 dark:text-ivory-200">{message}</p>
      )}
      {lesson.attachments.length > 0 && (
        <ul className="mt-3 space-y-2">
          {lesson.attachments.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-midnight-100 px-3 py-2 text-sm dark:border-midnight-800"
            >
              <span className="truncate font-bold">{file.title}</span>
              <button
                type="button"
                className="text-xs font-black text-red-600"
                onClick={async () => {
                  await api.delete(`/admin/content/attachments/${file.id}`);
                  await queryClient.invalidateQueries({ queryKey: ['admin-course-tree'] });
                }}
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
