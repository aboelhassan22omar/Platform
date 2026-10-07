'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn, formatNumber } from '@/lib/utils';
import {
  type AdminCourseDetail,
  type AdminCourseSummary,
  type AdminGrade,
  type AdminLesson,
  type EditorTarget,
  type EntityKind,
} from './admin-content.types';
import { PlusIcon } from './admin-content-icons';
import { CourseTree } from './content-course-tree';
import { EntityEditor } from './content-editor';
import { UploadDialog } from './content-upload-dialog';
import { ErrorBox } from './content-ui';

export function AdminContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedGradeId = searchParams.get('gradeId');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [uploadLesson, setUploadLesson] = useState<AdminLesson | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    kind: EntityKind;
    id: string;
    title: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: EntityKind;
    id: string;
    title: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const gradesQuery = useQuery({
    queryKey: ['admin-content-grades'],
    queryFn: () => api.get<AdminGrade[]>('/admin/content/grades'),
  });

  const coursesQuery = useQuery({
    queryKey: ['admin-courses', requestedGradeId],
    queryFn: () =>
      api.get<AdminCourseSummary[]>(
        `/admin/content/courses${requestedGradeId ? `?gradeId=${encodeURIComponent(requestedGradeId)}` : ''}`,
      ),
  });

  useEffect(() => {
    if (!selectedCourseId && coursesQuery.data?.length) {
      const requested = searchParams.get('courseId');
      setSelectedCourseId(
        coursesQuery.data.some((course) => course.id === requested)
          ? requested
          : coursesQuery.data[0].id,
      );
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
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
            استوديو المحتوى
          </p>
          <h1 className="mt-1 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl">
            ابنِ الصفوف والباقات والحصص
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-midnight-600 dark:text-ivory-300/75">
            أضف أو عدّل الوحدات والفصول والحصص من مكان واحد، وارفع الفيديو للحصة مباشرة بدون نسخ أي
            معرّفات.
          </p>
        </div>
        <Button
          variant="accent"
          onClick={() =>
            setEditor({ kind: 'course', mode: 'create', gradeId: requestedGradeId ?? undefined })
          }
        >
          <PlusIcon /> باكدج / كورس جديد
        </Button>
      </header>

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="إغلاق الرسالة"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-emerald-500/10"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-gold-500/20 bg-white p-3 shadow-card dark:bg-midnight-950/80 lg:sticky lg:top-32">
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <h2 className="font-display text-sm font-black text-midnight-900 dark:text-ivory-50">
              الباكدجات والكورسات
            </h2>
            <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-xs font-black text-gold-700 dark:text-gold-300">
              {formatNumber(coursesQuery.data?.length ?? 0)}
            </span>
          </div>

          {coursesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : coursesQuery.error ? (
            <ErrorBox error={coursesQuery.error} onRetry={() => void coursesQuery.refetch()} />
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
                  <span className="block truncate text-sm font-extrabold text-midnight-900 dark:text-ivory-50">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-midnight-500 dark:text-ivory-300/60">
                    {item.grade.shortNameAr ?? item.grade.nameAr} · {item._count.units} وحدة
                  </span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="rounded-xl border border-dashed border-gold-500/30 p-5 text-center text-sm text-midnight-500 dark:text-ivory-300/65">
              ابدأ بأول باكدج للصف.
            </div>
          )}
        </aside>

        <section className="min-w-0" aria-label="تفاصيل الكورس">
          {courseQuery.isLoading ? (
            <div className="space-y-4">
              <div className="skeleton h-40 rounded-2xl" />
              <div className="skeleton h-64 rounded-2xl" />
            </div>
          ) : courseQuery.error ? (
            <ErrorBox error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          ) : course ? (
            <CourseTree
              course={course}
              onEdit={setEditor}
              onUpload={setUploadLesson}
              onArchive={setArchiveTarget}
              onDelete={setDeleteTarget}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-gold-500/30 bg-white p-10 text-center dark:bg-midnight-950/70">
              <p className="font-display font-black text-midnight-800 dark:text-ivory-100">
                اختار كورس أو أنشئ واحد جديد.
              </p>
            </div>
          )}
        </section>
      </div>

      <EntityEditor
        target={editor}
        grades={gradesQuery.data ?? []}
        onClose={() => setEditor(null)}
        onSaved={async (created) => {
          if (editor?.kind === 'course' && editor.mode === 'create' && created?.id)
            setSelectedCourseId(created.id);
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
