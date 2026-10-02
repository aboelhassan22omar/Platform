'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api, ApiError } from '@/lib/api';
import { cn, formatEgp, formatNumber, formatRelative } from '@/lib/utils';
import { EASE_ENTRANCE } from '@/lib/motion';
import type { AdminLessonAccess, AdminStudent, EducationSystem, GradeLevel, Paginated } from '@/types/api';

const GRADE_LABELS: Record<string, string> = {
  SEC_1: 'أولى ثانوي',
  SEC_2: 'تانية ثانوي',
  SEC_3: 'تالتة ثانوي',
  BACC_1: 'أولى بكالوريا',
  BACC_2: 'تانية بكالوريا',
};

export function AdminStudents() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [system, setSystem] = useState<EducationSystem | ''>('');
  const [grade, setGrade] = useState<GradeLevel | ''>('');
  const [status, setStatus] = useState<'' | 'ACTIVE' | 'SUSPENDED'>('');
  const [page, setPage] = useState(1);
  const [accessStudent, setAccessStudent] = useState<AdminStudent | null>(null);

  const [pendingAction, setPendingAction] = useState<{
    student: AdminStudent;
    next: 'ACTIVE' | 'SUSPENDED';
  } | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search.trim()) params.set('search', search.trim());
  if (system) params.set('system', system);
  if (grade) params.set('grade', grade);
  if (status) params.set('status', status);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-students', params.toString()],
    queryFn: () => api.get<Paginated<AdminStudent>>(`/admin/students?${params}`),
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'ACTIVE' | 'SUSPENDED' }) =>
      api.patch(`/admin/students/${id}/status`, { status: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      setPendingAction(null);
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">الطلاب</h1>
        <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
          {data ? `${formatNumber(data.total)} طالب مسجل في الصرح` : 'جاري التحميل...'}
        </p>
      </div>

      {/* --- Filters --- */}
      <div className="rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 p-4 transition-colors">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="اسم، اسم مستخدم، أو رقم موبايل"
              aria-label="بحث عن طالب"
              className="min-h-11 w-full rounded-xl border-2 border-ivory-300 dark:border-midnight-700 bg-white dark:bg-midnight-900/90 px-4 py-2.5 text-sm text-midnight-900 dark:text-ivory-50 placeholder:text-midnight-400 dark:placeholder:text-midnight-500 transition-colors focus:border-gold-500 focus:outline-none"
            />
          </div>

          <select
            value={system}
            onChange={(event) => {
              setSystem(event.target.value as EducationSystem | '');
              setGrade('');
              setPage(1);
            }}
            aria-label="النظام التعليمي"
            className="min-h-11 rounded-xl border-2 border-ivory-300 dark:border-midnight-700 bg-white dark:bg-midnight-900/90 px-3 text-sm text-midnight-900 dark:text-ivory-50 focus:border-gold-500 focus:outline-none"
          >
            <option value="">كل الأنظمة</option>
            <option value="GENERAL">الثانوية العامة</option>
            <option value="BACC">البكالوريا المصرية</option>
          </select>

          <select
            value={grade}
            onChange={(event) => {
              setGrade(event.target.value as GradeLevel | '');
              setPage(1);
            }}
            aria-label="الصف الدراسي"
            className="min-h-11 rounded-xl border-2 border-ivory-300 dark:border-midnight-700 bg-white dark:bg-midnight-900/90 px-3 text-sm text-midnight-900 dark:text-ivory-50 focus:border-gold-500 focus:outline-none"
          >
            <option value="">كل الصفوف</option>
            {Object.entries(GRADE_LABELS)
              .filter(([key]) =>
                system === 'GENERAL'
                  ? key.startsWith('SEC')
                  : system === 'BACC'
                    ? key.startsWith('BACC')
                    : true,
              )
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | 'ACTIVE' | 'SUSPENDED');
              setPage(1);
            }}
            aria-label="حالة الحساب"
            className="min-h-11 rounded-xl border-2 border-ivory-300 dark:border-midnight-700 bg-white dark:bg-midnight-900/90 px-3 text-sm text-midnight-900 dark:text-ivory-50 focus:border-gold-500 focus:outline-none"
          >
            <option value="">كل الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="SUSPENDED">موقوف</option>
          </select>
        </div>
      </div>

      {/* --- Table --- */}
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 transition-all shadow-sm',
          isFetching && !isLoading && 'opacity-60',
        )}
      >
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="p-12 text-center">
            <p className="font-display text-base font-bold text-midnight-700 dark:text-ivory-200">
              مفيش طلاب مطابقين
            </p>
            <p className="mt-1.5 text-sm text-midnight-500 dark:text-ivory-300/60">
              جرّب تغيّر الفلاتر أو كلمة البحث.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-start text-sm">
              <thead className="bg-ivory-100/70 dark:bg-midnight-900/90 text-xs text-midnight-700 dark:text-gold-300/90 border-b border-gold-500/20">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-bold">الطالب</th>
                  <th scope="col" className="px-4 py-3 text-start font-bold">الصف</th>
                  <th scope="col" className="px-4 py-3 text-start font-bold">الموبايل</th>
                  <th scope="col" className="px-4 py-3 text-start font-bold">ولي الأمر</th>
                  <th scope="col" className="px-4 py-3 text-start font-bold">الوصول</th>
                  <th scope="col" className="px-4 py-3 text-start font-bold">آخر دخول</th>
                  <th scope="col" className="px-4 py-3 text-start font-bold">الحالة</th>
                  <th scope="col" className="px-4 py-3 text-start font-bold">
                    <span className="sr-only">إجراءات</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200/70 dark:divide-midnight-800">
                <AnimatePresence initial={false}>
                  {data.items.map((student) => (
                    <motion.tr
                      key={student.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, ease: EASE_ENTRANCE }}
                      className="hover:bg-ivory-50/70 dark:hover:bg-midnight-900/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="block font-bold text-midnight-950 dark:text-ivory-50">
                          {student.fullName}
                        </span>
                        <span className="block text-xs text-midnight-500 dark:text-ivory-300/60" dir="ltr">
                          {student.username}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-midnight-700 dark:text-ivory-200">
                        {student.gradeLevel ? GRADE_LABELS[student.gradeLevel] : '—'}
                      </td>
                      <td className="nums-tabular px-4 py-3 text-midnight-700 dark:text-ivory-200" dir="ltr">
                        {student.phone}
                      </td>
                      <td className="nums-tabular px-4 py-3 text-midnight-700 dark:text-ivory-200" dir="ltr">
                        {student.parentPhone}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-midnight-800 dark:text-ivory-200">
                          {formatNumber(student._count.entitlements)} تصريح
                        </span>
                        <span className="block text-[11px] text-midnight-500 dark:text-ivory-300/60">
                          {formatNumber(student._count.orders)} طلب
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-midnight-600 dark:text-ivory-300/70">
                        {student.lastLoginAt ? formatRelative(student.lastLoginAt) : 'لم يدخل'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[11px] font-bold',
                            student.status === 'ACTIVE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-500/20',
                          )}
                        >
                          {student.status === 'ACTIVE' ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAccessStudent(student)}
                          className="min-h-9 rounded-lg border border-gold-500/30 px-3 text-xs font-bold text-gold-700 transition-colors hover:bg-gold-500/10 dark:text-gold-300"
                        >
                          فتح حصص مجانًا
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({
                              student,
                              next: student.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                            })
                          }
                          className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                            student.status === 'ACTIVE'
                              ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                              : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
                          )}
                        >
                          {student.status === 'ACTIVE' ? 'إيقاف' : 'تفعيل'}
                        </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Pagination --- */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <span className="text-xs text-midnight-600 dark:text-ivory-300/70">
            صفحة {formatNumber(page)} من {formatNumber(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}

      <StudentLessonAccessDialog
        student={accessStudent}
        onClose={() => setAccessStudent(null)}
      />

      {/* --- Destructive-action confirmation --- */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.next === 'SUSPENDED' ? 'إيقاف حساب الطالب؟' : 'تفعيل حساب الطالب؟'
        }
        body={
          pendingAction?.next === 'SUSPENDED'
            ? `هيتم إيقاف حساب ${pendingAction.student.fullName} وتسجيل خروجه من كل الأجهزة فوراً. اشتراكاته هتفضل موجودة لكن مش هيقدر يدخل.`
            : `هيتم تفعيل حساب ${pendingAction?.student.fullName} ويقدر يسجّل دخوله تاني.`
        }
        confirmLabel={pendingAction?.next === 'SUSPENDED' ? 'إيقاف الحساب' : 'تفعيل الحساب'}
        destructive={pendingAction?.next === 'SUSPENDED'}
        isPending={statusMutation.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction) return;
          statusMutation.mutate({
            id: pendingAction.student.id,
            next: pendingAction.next,
          });
        }}
      />
    </div>
  );
}

function StudentLessonAccessDialog({
  student,
  onClose,
}: {
  student: AdminStudent | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const accessQuery = useQuery({
    queryKey: ['admin-student-lesson-access', student?.id],
    queryFn: () =>
      api.get<AdminLessonAccess[]>(`/admin/students/${student!.id}/lesson-access`),
    enabled: Boolean(student),
  });

  const accessMutation = useMutation({
    mutationFn: async ({ lesson, revoke }: { lesson: AdminLessonAccess; revoke: boolean }) => {
      if (!student) return;
      if (revoke && lesson.adminGrantEntitlementId) {
        return api.patch(
          `/admin/students/entitlements/${lesson.adminGrantEntitlementId}/revoke`,
          { reason: 'إلغاء المنحة المجانية الخاصة بالطالب من لوحة الإدارة' },
        );
      }
      return api.post(`/admin/students/${student.id}/lesson-entitlements`, {
        lessonId: lesson.id,
        reason: 'منحة مجانية خاصة بالطالب من لوحة الإدارة',
      });
    },
    onMutate: () => setMessage(null),
    onSuccess: (_, variables) => {
      setMessage(variables.revoke ? 'تم إلغاء فتح الحصة لهذا الطالب.' : 'تم فتح الحصة مجانًا لهذا الطالب فقط.');
      void queryClient.invalidateQueries({ queryKey: ['admin-student-lesson-access', student?.id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-students'] });
    },
    onError: (error) => {
      setMessage(error instanceof ApiError ? error.message : 'تعذر تعديل وصول الطالب للحصة.');
    },
  });

  if (!student) return null;

  const normalizedSearch = search.trim().toLocaleLowerCase('ar');
  const lessons = (accessQuery.data ?? []).filter((lesson) =>
    !normalizedSearch ||
    `${lesson.title} ${lesson.chapterTitle} ${lesson.unitTitle} ${lesson.courseTitle} ${lesson.gradeName}`
      .toLocaleLowerCase('ar')
      .includes(normalizedSearch),
  );
  const courseGroups = Array.from(
    lessons.reduce((groups, lesson) => {
      const current = groups.get(lesson.courseId) ?? {
        title: lesson.courseTitle,
        gradeName: lesson.gradeName,
        lessons: [] as AdminLessonAccess[],
      };
      current.lessons.push(lesson);
      groups.set(lesson.courseId, current);
      return groups;
    }, new Map<string, { title: string; gradeName: string; lessons: AdminLessonAccess[] }>()),
  );

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-5">
      <button
        type="button"
        aria-label="إغلاق إدارة حصص الطالب"
        className="absolute inset-0 bg-midnight-950/75 backdrop-blur-sm"
        onClick={() => !accessMutation.isPending && onClose()}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-access-title"
        className="relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gold-500/30 bg-ivory-50 shadow-2xl dark:bg-midnight-950"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gold-500/20 p-5">
          <div>
            <p className="text-xs font-bold text-gold-700 dark:text-gold-300">وصول مجاني خاص</p>
            <h2 id="student-access-title" className="mt-1 font-display text-xl font-black text-midnight-950 dark:text-ivory-50">
              حصص {student.fullName}
            </h2>
            <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
              ظاهر هنا حصص {student.gradeLevel ? GRADE_LABELS[student.gradeLevel] : 'صف الطالب'} فقط، وفتح الحصة يخص الطالب ده ولا يغيّر سعرها لباقي الطلاب.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={accessMutation.isPending}
            aria-label="إغلاق"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl text-midnight-500 transition-colors hover:bg-midnight-100 disabled:opacity-50 dark:text-ivory-300 dark:hover:bg-midnight-800"
          >
            ×
          </button>
        </header>

        <div className="border-b border-gold-500/15 p-4 sm:px-5">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم الحصة أو الكورس أو الصف"
            aria-label="بحث في الحصص"
            className="min-h-11 w-full rounded-xl border-2 border-ivory-300 bg-white px-4 text-sm text-midnight-900 placeholder:text-midnight-400 focus:border-gold-500 focus:outline-none dark:border-midnight-700 dark:bg-midnight-900 dark:text-ivory-50"
          />
          {message && (
            <p role="status" className="mt-3 rounded-lg bg-gold-500/10 px-3 py-2 text-sm font-semibold text-gold-800 dark:text-gold-200">
              {message}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {accessQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => <div key={index} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : accessQuery.isError ? (
            <p className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">
              تعذر تحميل الحصص. اقفل النافذة وحاول مرة تانية.
            </p>
          ) : courseGroups.length === 0 ? (
            <p className="py-10 text-center text-sm text-midnight-500 dark:text-ivory-300/70">مفيش حصص مطابقة للبحث.</p>
          ) : (
            <div className="space-y-5">
              {courseGroups.map(([courseId, group]) => (
                <section key={courseId} className="overflow-hidden rounded-xl border border-ivory-300 bg-white dark:border-midnight-800 dark:bg-midnight-900/70">
                  <div className="border-b border-ivory-200 bg-ivory-100/70 px-4 py-3 dark:border-midnight-800 dark:bg-midnight-900">
                    <h3 className="text-sm font-black text-midnight-900 dark:text-ivory-50">{group.title}</h3>
                    <p className="mt-0.5 text-xs text-midnight-500 dark:text-ivory-300/60">{group.gradeName}</p>
                  </div>
                  <ul className="divide-y divide-ivory-200 dark:divide-midnight-800">
                    {group.lessons.map((lesson) => {
                      const isThisPending = accessMutation.isPending && accessMutation.variables?.lesson.id === lesson.id;
                      return (
                        <li key={lesson.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-midnight-900 dark:text-ivory-50">{lesson.title}</p>
                            <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/60">
                              {lesson.unitTitle} — {lesson.chapterTitle}
                              {lesson.priceMinor ? ` — ${formatEgp(lesson.priceMinor)}` : ''}
                            </p>
                          </div>
                          {lesson.accessKind === 'ADMIN_GRANT' ? (
                            <button
                              type="button"
                              disabled={accessMutation.isPending}
                              onClick={() => accessMutation.mutate({ lesson, revoke: true })}
                              className="min-h-10 shrink-0 rounded-xl border border-red-500/30 px-4 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30"
                            >
                              {isThisPending ? 'جاري الإلغاء…' : 'إلغاء المجانية'}
                            </button>
                          ) : lesson.accessKind === 'OTHER' ? (
                            <span className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-emerald-500/10 px-4 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              متاحة بالفعل
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={accessMutation.isPending}
                              onClick={() => accessMutation.mutate({ lesson, revoke: false })}
                              className="min-h-10 shrink-0 rounded-xl bg-gold-500 px-4 text-xs font-black text-midnight-950 transition-colors hover:bg-gold-400 disabled:opacity-50"
                            >
                              {isThisPending ? 'جاري الفتح…' : 'فتح مجانًا'}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

