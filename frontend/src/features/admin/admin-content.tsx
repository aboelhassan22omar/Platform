'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DateTimePicker, isoToLocalInput } from '@/components/ui/date-time-picker';
import { VideoUploader } from './video-uploader';
import { LessonPricingFields } from './lesson-pricing-fields';
import { cn, formatEgp, formatNumber } from '@/lib/utils';
import type { PublishStatus } from '@/types/api';
import {
  type AdminCourseDetail,
  type AdminCourseSummary,
  type AdminGrade,
  type AdminLesson,
  type EditorTarget,
  type EntityKind,
  STATUS_LABELS,
  VIDEO_LABELS,
} from './admin-content.types';
import { ArchiveIcon, PencilIcon, PlusIcon, TrashIcon } from './admin-content-icons';

export function AdminContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedGradeId = searchParams.get('gradeId');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [uploadLesson, setUploadLesson] = useState<AdminLesson | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ kind: EntityKind; id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: EntityKind; id: string; title: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const gradesQuery = useQuery({
    queryKey: ['admin-content-grades'],
    queryFn: () => api.get<AdminGrade[]>('/admin/content/grades'),
  });

  const coursesQuery = useQuery({
    queryKey: ['admin-courses', requestedGradeId],
    queryFn: () => api.get<AdminCourseSummary[]>(`/admin/content/courses${requestedGradeId ? `?gradeId=${encodeURIComponent(requestedGradeId)}` : ''}`),
  });

  useEffect(() => {
    if (!selectedCourseId && coursesQuery.data?.length) {
      const requested = searchParams.get('courseId');
      setSelectedCourseId(coursesQuery.data.some((course) => course.id === requested) ? requested : coursesQuery.data[0].id);
    }
  }, [coursesQuery.data, searchParams, selectedCourseId]);

  const courseQuery = useQuery({
    queryKey: ['admin-course-tree', selectedCourseId],
    queryFn: () => api.get<AdminCourseDetail>(`/admin/content/courses/${selectedCourseId}`),
    enabled: Boolean(selectedCourseId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-course-tree'] }),
    ]);
  };

  const archiveMutation = useMutation({
    mutationFn: async (target: { kind: EntityKind; id: string }) => {
      const segment = target.kind === 'course' ? 'courses' : `${target.kind}s`;
      return api.delete(`/admin/content/${segment}/${target.id}`);
    },
    onSuccess: async () => {
      setArchiveTarget(null);
      setNotice('تمت الأرشفة بنجاح، والمحتوى المدفوع القديم محفوظ للطلاب.');
      await refresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: { kind: EntityKind; id: string }) => {
      const segment = target.kind === 'course' ? 'courses' : `${target.kind}s`;
      return api.delete(`/admin/content/${segment}/${target.id}/permanent`);
    },
    onSuccess: async (_, target) => {
      setDeleteTarget(null);
      if (target.kind === 'course' && selectedCourseId === target.id) setSelectedCourseId(null);
      setNotice('تم حذف المحتوى نهائيًا وإعادة ترتيب العناصر التالية.');
      await refresh();
    },
    onError: (caught) => {
      setDeleteTarget(null);
      setNotice(caught instanceof ApiError ? caught.message : 'تعذر حذف المحتوى نهائيًا.');
    },
  });

  const course = courseQuery.data;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">استوديو المحتوى</p>
          <h1 className="mt-1 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl">
            ابنِ الصفوف والباقات والحصص
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-midnight-600 dark:text-ivory-300/75">
            أضف أو عدّل الوحدات والفصول والحصص من مكان واحد، وارفع الفيديو للحصة مباشرة بدون نسخ أي معرّفات.
          </p>
        </div>
        <Button variant="accent" onClick={() => setEditor({ kind: 'course', mode: 'create', gradeId: requestedGradeId ?? undefined })}>
          <PlusIcon /> باكدج / كورس جديد
        </Button>
      </header>

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="إغلاق الرسالة" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-emerald-500/10">×</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-gold-500/20 bg-white p-3 shadow-card dark:bg-midnight-950/80 lg:sticky lg:top-32">
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <h2 className="font-display text-sm font-black text-midnight-900 dark:text-ivory-50">الباكدجات والكورسات</h2>
            <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-xs font-black text-gold-700 dark:text-gold-300">
              {formatNumber(coursesQuery.data?.length ?? 0)}
            </span>
          </div>

          {coursesQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-16 rounded-xl" />)}</div>
          ) : coursesQuery.data?.length ? (
            <nav aria-label="اختيار الكورس" className="space-y-1.5">
              {coursesQuery.data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedCourseId(item.id)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-3 text-start transition-colors',
                    selectedCourseId === item.id
                      ? 'border-gold-500/45 bg-gold-500/10'
                      : 'border-transparent hover:border-gold-500/20 hover:bg-gold-500/5',
                  )}
                >
                  <span className="block truncate text-sm font-extrabold text-midnight-900 dark:text-ivory-50">{item.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-midnight-500 dark:text-ivory-300/60">{item.grade.shortNameAr ?? item.grade.nameAr} · {item._count.units} وحدة</span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="rounded-xl border border-dashed border-gold-500/30 p-5 text-center text-sm text-midnight-500 dark:text-ivory-300/65">ابدأ بأول باكدج للصف.</div>
          )}
        </aside>

        <main className="min-w-0">
          {courseQuery.isLoading ? (
            <div className="space-y-4"><div className="skeleton h-40 rounded-2xl" /><div className="skeleton h-64 rounded-2xl" /></div>
          ) : courseQuery.error ? (
            <ErrorBox error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          ) : course ? (
            <CourseTree course={course} onEdit={setEditor} onUpload={setUploadLesson} onArchive={setArchiveTarget} onDelete={setDeleteTarget} />
          ) : (
            <div className="rounded-2xl border border-dashed border-gold-500/30 bg-white p-10 text-center dark:bg-midnight-950/70">
              <p className="font-display font-black text-midnight-800 dark:text-ivory-100">اختار كورس أو أنشئ واحد جديد.</p>
            </div>
          )}
        </main>
      </div>

      <EntityEditor
        target={editor}
        grades={gradesQuery.data ?? []}
        onClose={() => setEditor(null)}
        onSaved={async (created) => {
          if (editor?.kind === 'course' && editor.mode === 'create' && created?.id) setSelectedCourseId(created.id);
          setEditor(null);
          setNotice('تم حفظ التعديل بنجاح.');
          await refresh();
        }}
      />

      <UploadDialog lesson={uploadLesson} onClose={() => setUploadLesson(null)} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="تأكيد الأرشفة"
        body={`سيختفي «${archiveTarget?.title ?? ''}» من واجهة الطلاب، لكن لن نحذف سجل المشتريات أو المشاهدة.`}
        confirmLabel="أرشف المحتوى"
        destructive
        isPending={archiveMutation.isPending}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف نهائي لا يمكن التراجع عنه"
        body={`سيتم حذف «${deleteTarget?.title ?? ''}» وكل المحتوى الموجود بداخله نهائيًا، بما في ذلك الفيديوهات والتقدم والمنح المجانية. لو له مشتريات قديمة سيرفض النظام الحذف ويطلب الأرشفة.`}
        confirmLabel="احذف نهائيًا"
        destructive
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </div>
  );
}

function CourseTree({ course, onEdit, onUpload, onArchive, onDelete }: {
  course: AdminCourseDetail;
  onEdit: (target: EditorTarget) => void;
  onUpload: (lesson: AdminLesson) => void;
  onArchive: (target: { kind: EntityKind; id: string; title: string }) => void;
  onDelete: (target: { kind: EntityKind; id: string; title: string }) => void;
}) {
  return (
    <div className="space-y-5" data-theme={course.grade.themeKey}>
      <section className="relative overflow-hidden rounded-2xl border border-gold-500/25 bg-midnight-950 p-5 text-ivory-50 shadow-card sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'var(--hero-wash)' }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-ivory-50/10 px-2.5 py-1 text-[11px] font-bold text-ivory-200">{course.grade.nameAr}</span>
              <StatusBadge status={course.status} />
            </div>
            <h2 className="mt-3 font-display text-2xl font-black">{course.title}</h2>
            {course.description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ivory-200/70">{course.description}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-ivory-200/65"><span>{course.units.length} وحدة</span><span aria-hidden>•</span><span>{course.priceMinor ? formatEgp(course.priceMinor) : 'بدون سعر للكورس كاملًا'}</span></div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" className="border-ivory-50/25 text-ivory-50 hover:text-gold-300" onClick={() => onEdit({ kind: 'course', mode: 'edit', entity: { ...course, gradeId: course.grade.id } })}><PencilIcon /> تعديل</Button>
            <Button size="sm" variant="ghost" className="text-red-200 hover:bg-red-500/10 hover:text-red-100" onClick={() => onArchive({ kind: 'course', id: course.id, title: course.title })}>أرشفة</Button>
            <Button size="sm" variant="ghost" className="text-red-300 hover:bg-red-500/20 hover:text-red-100" onClick={() => onDelete({ kind: 'course', id: course.id, title: course.title })}>حذف نهائي</Button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">محتوى الكورس</h2><p className="text-xs text-midnight-500 dark:text-ivory-300/60">الوحدة ← الفصل/الباكدج ← الحصة</p></div>
        <Button size="sm" variant="accent" onClick={() => onEdit({ kind: 'unit', mode: 'create', parentId: course.id })}><PlusIcon /> وحدة جديدة</Button>
      </div>

      {course.units.length === 0 ? <EmptyState title="الكورس فاضي حاليًا" action="أضف أول وحدة علشان تبدأ ترتيب المحتوى." /> : (
        <div className="space-y-4">
          {course.units.map((unit, unitIndex) => (
            <section key={unit.id} className="overflow-hidden rounded-2xl border border-gold-500/20 bg-white shadow-card dark:bg-midnight-950/75">
              <div className="flex flex-wrap items-center gap-3 border-b border-gold-500/15 p-4 sm:p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500/10 font-display text-sm font-black text-gold-700 dark:text-gold-300">{unitIndex + 1}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display font-black text-midnight-950 dark:text-ivory-50">{unit.title}</h3><StatusBadge status={unit.status} /></div>{unit.description && <p className="mt-1 truncate text-xs text-midnight-500 dark:text-ivory-300/60">{unit.description}</p>}</div>
                <div className="flex flex-wrap gap-1.5"><ActionButton label="إضافة باكدج" onClick={() => onEdit({ kind: 'chapter', mode: 'create', parentId: unit.id })}><PlusIcon /></ActionButton><ActionButton label="تعديل الوحدة" onClick={() => onEdit({ kind: 'unit', mode: 'edit', entity: unit })}><PencilIcon /></ActionButton><ActionButton label="أرشفة الوحدة" danger onClick={() => onArchive({ kind: 'unit', id: unit.id, title: unit.title })}><ArchiveIcon /></ActionButton><ActionButton label="حذف الوحدة نهائيًا" danger onClick={() => onDelete({ kind: 'unit', id: unit.id, title: unit.title })}><TrashIcon /></ActionButton></div>
              </div>

              <div className="space-y-3 p-3 sm:p-4">
                {unit.chapters.length === 0 ? <EmptyState compact title="لا توجد باكدجات داخل الوحدة" action="أضف فصلًا أو باكدج ثم ضع الحصص بداخله." /> : unit.chapters.map((chapter) => (
                  <div key={chapter.id} className="overflow-hidden rounded-xl border border-midnight-100 bg-ivory-50/65 dark:border-midnight-800 dark:bg-midnight-900/55">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-black text-midnight-900 dark:text-ivory-100">{chapter.title}</h4><StatusBadge status={chapter.status} /></div><p className="mt-0.5 text-[11px] text-midnight-500 dark:text-ivory-300/60">{chapter.lessons.length} حصة{chapter.priceMinor ? ` · ${formatEgp(chapter.priceMinor)}` : ''}</p></div>
                      <div className="flex flex-wrap gap-1.5"><ActionButton label="إضافة حصة" onClick={() => onEdit({ kind: 'lesson', mode: 'create', parentId: chapter.id })}><PlusIcon /></ActionButton><ActionButton label="تعديل الباكدج" onClick={() => onEdit({ kind: 'chapter', mode: 'edit', entity: chapter })}><PencilIcon /></ActionButton><ActionButton label="أرشفة الباكدج" danger onClick={() => onArchive({ kind: 'chapter', id: chapter.id, title: chapter.title })}><ArchiveIcon /></ActionButton><ActionButton label="حذف الباكدج نهائيًا" danger onClick={() => onDelete({ kind: 'chapter', id: chapter.id, title: chapter.title })}><TrashIcon /></ActionButton></div>
                    </div>

                    {chapter.lessons.length > 0 && (
                      <ul className="divide-y divide-midnight-100 border-t border-midnight-100 dark:divide-midnight-800 dark:border-midnight-800">
                        {chapter.lessons.map((lesson, lessonIndex) => (
                          <li key={lesson.id} className="flex flex-col gap-3 bg-white px-4 py-3 dark:bg-midnight-950/45 sm:flex-row sm:items-center">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-midnight-50 text-xs font-black text-midnight-500 dark:bg-midnight-800 dark:text-ivory-300">{lessonIndex + 1}</span>
                            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-midnight-900 dark:text-ivory-100">{lesson.title}</p>{lesson.isFreePreview && <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">مجانية</span>}</div><p className={cn('mt-0.5 text-[11px] font-semibold', lesson.videoAsset?.status === 'READY' ? 'text-emerald-700 dark:text-emerald-300' : lesson.videoAsset?.status === 'FAILED' ? 'text-red-600 dark:text-red-300' : 'text-midnight-400 dark:text-ivory-300/55')}>{lesson.videoAsset ? VIDEO_LABELS[lesson.videoAsset.status] : 'بدون فيديو'}{lesson.priceMinor ? ` · ${formatEgp(lesson.priceMinor)}` : ''}</p></div>
                            <div className="flex flex-wrap gap-1.5 sm:justify-end"><Button size="sm" variant={lesson.videoAsset?.status === 'READY' ? 'outline' : 'accent'} onClick={() => onUpload(lesson)}>{lesson.videoAsset ? 'استبدال الفيديو' : 'رفع الفيديو'}</Button><ActionButton label="تعديل الحصة" onClick={() => onEdit({ kind: 'lesson', mode: 'edit', entity: lesson })}><PencilIcon /></ActionButton><ActionButton label="أرشفة الحصة" danger onClick={() => onArchive({ kind: 'lesson', id: lesson.id, title: lesson.title })}><ArchiveIcon /></ActionButton><ActionButton label="حذف الحصة نهائيًا" danger onClick={() => onDelete({ kind: 'lesson', id: lesson.id, title: lesson.title })}><TrashIcon /></ActionButton></div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EntityEditor({ target, grades, onClose, onSaved }: { target: EditorTarget | null; grades: AdminGrade[]; onClose: () => void; onSaved: (value?: { id?: string }) => void | Promise<void> }) {
  const [status, setStatus] = useState('PUBLISHED');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!target) return {};
      if (target.mode === 'edit') return api.patch<{ id?: string }>(`/admin/content/${target.kind}s/${target.entity?.id}`, payload);
      if (target.kind === 'course') return api.post<{ id?: string }>('/admin/content/courses', payload);
      if (target.kind === 'unit') return api.post<{ id?: string }>(`/admin/content/courses/${target.parentId}/units`, payload);
      if (target.kind === 'chapter') return api.post<{ id?: string }>(`/admin/content/units/${target.parentId}/chapters`, payload);
      return api.post<{ id?: string }>(`/admin/content/chapters/${target.parentId}/lessons`, payload);
    },
    onSuccess: onSaved,
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'تعذر حفظ التعديل.'),
  });

  useEffect(() => { setError(null); setStatus(target?.entity?.status ?? 'PUBLISHED'); }, [target]);
  if (!target) return null;
  const labels: Record<EntityKind, string> = { course: 'الكورس / الباكدج', unit: 'الوحدة', chapter: 'الفصل / الباكدج', lesson: 'الحصة' };
  const entity = target.entity;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button type="button" aria-label="إغلاق نافذة التعديل" className="absolute inset-0 bg-midnight-950/65 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        key={`${target.kind}-${target.mode}-${entity?.id ?? 'new'}`}
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const payload: Record<string, unknown> = { title: String(form.get('title') ?? '').trim(), description: String(form.get('description') ?? '').trim(), status: String(form.get('status') ?? 'DRAFT') };
          const scheduledAt = String(form.get('scheduledAt') ?? '').trim();
          if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString();
          const sortOrder = String(form.get('sortOrder') ?? '').trim();
          if (sortOrder !== '') payload.sortOrder = Number(sortOrder);
          if (target.kind === 'course') payload.gradeId = String(form.get('gradeId') ?? '');
          if (target.kind === 'course' || target.kind === 'chapter' || target.kind === 'lesson') payload.priceMinor = Math.max(0, Math.round(Number(form.get('price') ?? 0) * 100));
          if (target.kind === 'lesson') payload.isFreePreview = form.get('isFreePreview') === 'on';
          if (target.kind === 'lesson') payload.centerPriceMinor = form.get('customCenterPrice') !== 'on' ? null : form.get('centerFree') === 'on' ? 0 : Math.round(Number(form.get('centerPrice')) * 100);
          mutation.mutate(payload);
        }}
        role="dialog" aria-modal="true" aria-labelledby="entity-editor-title"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gold-500/30 bg-white p-4 shadow-2xl dark:bg-midnight-950 sm:p-4"
      >
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-gold-700 dark:text-gold-300">{target.mode === 'create' ? 'إضافة جديدة' : 'تعديل'}</p><h2 id="entity-editor-title" className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50">{labels[target.kind]}</h2></div><button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-xl text-xl text-midnight-500 hover:bg-midnight-50 dark:text-ivory-300 dark:hover:bg-midnight-800">×</button></div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="editor-label">الاسم</span><input name="title" required minLength={2} maxLength={200} defaultValue={entity?.title ?? ''} className="editor-input" autoFocus /></label>
          {target.kind === 'course' && <label><span className="editor-label">الصف</span><select name="gradeId" required defaultValue={entity?.gradeId ?? target.gradeId ?? ''} className="editor-input"><option value="" disabled>اختار الصف</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.nameAr}</option>)}</select></label>}
          <label><span className="editor-label">الحالة</span><select name="status" value={status} onChange={(event) => setStatus(event.target.value)} className="editor-input"><option value="PUBLISHED">منشور — يظهر للطلاب فورًا</option><option value="DRAFT">مسودة — لا تظهر للطلاب</option><option value="SCHEDULED">مجدول</option><option value="ARCHIVED">مؤرشف</option></select></label>
          {status === 'SCHEDULED' && <div><span className="editor-label">وقت النشر المجدول</span><DateTimePicker name="scheduledAt" disablePast defaultValue={isoToLocalInput(entity?.scheduledAt)} /><span className="mt-1 block text-[11px] text-midnight-400 dark:text-ivory-300/55">مطلوب عند اختيار حالة «مجدول».</span></div>}
          <label><span className="editor-label">الترتيب</span><input name="sortOrder" type="number" min="0" defaultValue={entity?.sortOrder ?? ''} placeholder="تلقائي بعد آخر عنصر" className="editor-input" /></label>
          {(target.kind === 'course' || target.kind === 'chapter') && <label><span className="editor-label">السعر بالجنيه</span><input name="price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={(entity?.priceMinor ?? 0) / 100} className="editor-input" /><span className="mt-1 block text-[11px] text-midnight-400 dark:text-ivory-300/55">اكتب 0 لو غير متاح للبيع منفردًا.</span></label>}
          {target.kind === 'lesson' && <LessonPricingFields priceMinor={entity?.priceMinor} centerPriceMinor={entity?.centerPriceMinor} />}
          <label className="sm:col-span-2"><span className="editor-label">الوصف</span><textarea name="description" rows={1} maxLength={2000} defaultValue={entity?.description ?? ''} className="editor-input resize-y py-2" /></label>
          {target.kind === 'lesson' && <label className="sm:col-span-2 flex min-h-12 items-center gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 px-4"><input name="isFreePreview" type="checkbox" defaultChecked={entity?.isFreePreview} className="h-5 w-5 accent-gold-600" /><span className="text-sm font-bold text-midnight-800 dark:text-ivory-200">اسمح للطلاب بمشاهدة الحصة مجانًا</span></label>}
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/25 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <div className="sticky bottom-0 mt-3 flex justify-end gap-2 bg-white pt-2 dark:bg-midnight-950"><Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>إلغاء</Button><Button type="submit" variant="accent" isLoading={mutation.isPending}>حفظ التغييرات</Button></div>
      </motion.form>
    </div>
  );
}

function UploadDialog({ lesson, onClose }: { lesson: AdminLesson | null; onClose: () => void }) {
  if (!lesson) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button type="button" aria-label="إغلاق رفع الفيديو" className="absolute inset-0 bg-midnight-950/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} role="dialog" aria-modal="true" aria-labelledby="upload-dialog-title" className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold-500/30 bg-white p-5 shadow-2xl dark:bg-midnight-950 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-gold-700 dark:text-gold-300">رفع فيديو الحصة</p><h2 id="upload-dialog-title" className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50">{lesson.title}</h2></div><button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-xl text-xl text-midnight-500 hover:bg-midnight-50 dark:text-ivory-300 dark:hover:bg-midnight-800">×</button></div>
        <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/65">اختار الفيديو وسيبدأ الرفع ثم التحويل للجودات المختلفة تلقائيًا.</p>
        <div className="mt-5"><VideoUploader lessonId={lesson.id} /></div>
        <AttachmentUploader lesson={lesson} />
      </motion.div>
    </div>
  );
}

function AttachmentUploader({ lesson }: { lesson: AdminLesson }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const ticket = await api.post<{ url: string; key: string }>(`/admin/content/lessons/${lesson.id}/attachments/upload-ticket`, {
        fileName: file.name, contentType: file.type, sizeBytes: file.size,
      });
      const sent = await fetch(ticket.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!sent.ok) throw new Error('تعذر رفع الملف إلى التخزين');
      await api.post(`/admin/content/lessons/${lesson.id}/attachments/complete`, {
        key: ticket.key, title: file.name, fileName: file.name, contentType: file.type, sizeBytes: file.size,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-course-tree'] });
      setMessage('تم رفع ملف الحصة بنجاح.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'تعذر رفع الملف.');
    } finally { setBusy(false); }
  };

  return <section className="mt-6 border-t border-gold-500/20 pt-5">
    <h3 className="font-display text-base font-black text-midnight-950 dark:text-ivory-50">ملفات الحصة</h3>
    <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/65">PDF أو Word أو Excel أو PowerPoint، بحد أقصى 25 ميجابايت.</p>
    <label className="mt-3 inline-flex cursor-pointer rounded-xl bg-gold-600 px-4 py-2.5 text-sm font-black text-white">
      {busy ? 'جاري الرفع…' : 'اختيار ملف'}
      <input className="sr-only" type="file" disabled={busy} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ''; }} />
    </label>
    {message && <p className="mt-2 text-xs font-bold text-midnight-600 dark:text-ivory-200">{message}</p>}
    {lesson.attachments.length > 0 && <ul className="mt-3 space-y-2">{lesson.attachments.map((file) => <li key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-midnight-100 px-3 py-2 text-sm dark:border-midnight-800"><span className="truncate font-bold">{file.title}</span><button type="button" className="text-xs font-black text-red-600" onClick={async () => { await api.delete(`/admin/content/attachments/${file.id}`); await queryClient.invalidateQueries({ queryKey: ['admin-course-tree'] }); }}>حذف</button></li>)}</ul>}
  </section>;
}

function StatusBadge({ status }: { status: PublishStatus }) {
  return <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-black', status === 'PUBLISHED' ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : status === 'ARCHIVED' ? 'bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-amber-500/12 text-amber-700 dark:text-amber-300')}>{STATUS_LABELS[status]}</span>;
}

function ActionButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={cn('inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-bold transition-colors', danger ? 'border-red-500/20 text-red-600 hover:bg-red-500/10 dark:text-red-300' : 'border-gold-500/20 text-midnight-600 hover:border-gold-500/45 hover:bg-gold-500/10 hover:text-gold-700 dark:text-ivory-300 dark:hover:text-gold-300')}>{children}<span className="hidden xl:inline">{label}</span></button>;
}

function EmptyState({ title, action, compact }: { title: string; action: string; compact?: boolean }) {
  return <div className={cn('rounded-xl border border-dashed border-gold-500/30 text-center', compact ? 'p-5' : 'bg-white p-10 dark:bg-midnight-950/60')}><p className="font-display text-sm font-black text-midnight-800 dark:text-ivory-100">{title}</p><p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/60">{action}</p></div>;
}

function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <div className="rounded-2xl border border-red-500/25 bg-red-50 p-6 text-center dark:bg-red-950/35"><p className="font-bold text-red-700 dark:text-red-300">{error instanceof Error ? error.message : 'تعذر تحميل المحتوى.'}</p><Button className="mt-4" variant="outline" onClick={onRetry}>حاول مرة أخرى</Button></div>;
}
