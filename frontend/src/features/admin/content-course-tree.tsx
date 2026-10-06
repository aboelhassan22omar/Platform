'use client';
import { Button } from '@/components/ui/button';
import { cn, formatEgp } from '@/lib/utils';
import {
  type AdminCourseDetail,
  type AdminLesson,
  type EditorTarget,
  type EntityKind,
  VIDEO_LABELS,
} from './admin-content.types';
import { ArchiveIcon, PencilIcon, PlusIcon, TrashIcon } from './admin-content-icons';
import { StatusBadge, ActionButton, EmptyState } from './content-ui';

export function CourseTree({
  course,
  onEdit,
  onUpload,
  onArchive,
  onDelete,
}: {
  course: AdminCourseDetail;
  onEdit: (target: EditorTarget) => void;
  onUpload: (lesson: AdminLesson) => void;
  onArchive: (target: { kind: EntityKind; id: string; title: string }) => void;
  onDelete: (target: { kind: EntityKind; id: string; title: string }) => void;
}) {
  return (
    <div className="space-y-5" data-theme={course.grade.themeKey}>
      <section className="relative overflow-hidden rounded-2xl border border-gold-500/25 bg-midnight-950 p-5 text-ivory-50 shadow-card sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--hero-wash)' }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-ivory-50/10 px-2.5 py-1 text-[11px] font-bold text-ivory-200">
                {course.grade.nameAr}
              </span>
              <StatusBadge status={course.status} />
            </div>
            <h2 className="mt-3 font-display text-2xl font-black">{course.title}</h2>
            {course.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ivory-200/70">
                {course.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-ivory-200/65">
              <span>{course.units.length} وحدة</span>
              <span aria-hidden>•</span>
              <span>
                {course.priceMinor ? formatEgp(course.priceMinor) : 'بدون سعر للكورس كاملًا'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-ivory-50/25 text-ivory-50 hover:text-gold-300"
              onClick={() =>
                onEdit({
                  kind: 'course',
                  mode: 'edit',
                  entity: { ...course, gradeId: course.grade.id },
                })
              }
            >
              <PencilIcon /> تعديل
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-200 hover:bg-red-500/10 hover:text-red-100"
              onClick={() => onArchive({ kind: 'course', id: course.id, title: course.title })}
            >
              أرشفة
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-300 hover:bg-red-500/20 hover:text-red-100"
              onClick={() => onDelete({ kind: 'course', id: course.id, title: course.title })}
            >
              حذف نهائي
            </Button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
            محتوى الكورس
          </h2>
          <p className="text-xs text-midnight-500 dark:text-ivory-300/60">
            الوحدة ← الفصل/الباكدج ← الحصة
          </p>
        </div>
        <Button
          size="sm"
          variant="accent"
          onClick={() => onEdit({ kind: 'unit', mode: 'create', parentId: course.id })}
        >
          <PlusIcon /> وحدة جديدة
        </Button>
      </div>

      {course.units.length === 0 ? (
        <EmptyState title="الكورس فاضي حاليًا" action="أضف أول وحدة علشان تبدأ ترتيب المحتوى." />
      ) : (
        <div className="space-y-4">
          {course.units.map((unit, unitIndex) => (
            <section
              key={unit.id}
              className="overflow-hidden rounded-2xl border border-gold-500/20 bg-white shadow-card dark:bg-midnight-950/75"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-gold-500/15 p-4 sm:p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500/10 font-display text-sm font-black text-gold-700 dark:text-gold-300">
                  {unitIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-black text-midnight-950 dark:text-ivory-50">
                      {unit.title}
                    </h3>
                    <StatusBadge status={unit.status} />
                  </div>
                  {unit.description && (
                    <p className="mt-1 truncate text-xs text-midnight-500 dark:text-ivory-300/60">
                      {unit.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ActionButton
                    label="إضافة باكدج"
                    onClick={() => onEdit({ kind: 'chapter', mode: 'create', parentId: unit.id })}
                  >
                    <PlusIcon />
                  </ActionButton>
                  <ActionButton
                    label="تعديل الوحدة"
                    onClick={() => onEdit({ kind: 'unit', mode: 'edit', entity: unit })}
                  >
                    <PencilIcon />
                  </ActionButton>
                  <ActionButton
                    label="أرشفة الوحدة"
                    danger
                    onClick={() => onArchive({ kind: 'unit', id: unit.id, title: unit.title })}
                  >
                    <ArchiveIcon />
                  </ActionButton>
                  <ActionButton
                    label="حذف الوحدة نهائيًا"
                    danger
                    onClick={() => onDelete({ kind: 'unit', id: unit.id, title: unit.title })}
                  >
                    <TrashIcon />
                  </ActionButton>
                </div>
              </div>

              <div className="space-y-3 p-3 sm:p-4">
                {unit.chapters.length === 0 ? (
                  <EmptyState
                    compact
                    title="لا توجد باكدجات داخل الوحدة"
                    action="أضف فصلًا أو باكدج ثم ضع الحصص بداخله."
                  />
                ) : (
                  unit.chapters.map((chapter) => (
                    <div
                      key={chapter.id}
                      className="overflow-hidden rounded-xl border border-midnight-100 bg-ivory-50/65 dark:border-midnight-800 dark:bg-midnight-900/55"
                    >
                      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-midnight-900 dark:text-ivory-100">
                              {chapter.title}
                            </h4>
                            <StatusBadge status={chapter.status} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-midnight-500 dark:text-ivory-300/60">
                            {chapter.lessons.length} حصة
                            {chapter.priceMinor ? ` · ${formatEgp(chapter.priceMinor)}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <ActionButton
                            label="إضافة حصة"
                            onClick={() =>
                              onEdit({ kind: 'lesson', mode: 'create', parentId: chapter.id })
                            }
                          >
                            <PlusIcon />
                          </ActionButton>
                          <ActionButton
                            label="تعديل الباكدج"
                            onClick={() =>
                              onEdit({ kind: 'chapter', mode: 'edit', entity: chapter })
                            }
                          >
                            <PencilIcon />
                          </ActionButton>
                          <ActionButton
                            label="أرشفة الباكدج"
                            danger
                            onClick={() =>
                              onArchive({ kind: 'chapter', id: chapter.id, title: chapter.title })
                            }
                          >
                            <ArchiveIcon />
                          </ActionButton>
                          <ActionButton
                            label="حذف الباكدج نهائيًا"
                            danger
                            onClick={() =>
                              onDelete({ kind: 'chapter', id: chapter.id, title: chapter.title })
                            }
                          >
                            <TrashIcon />
                          </ActionButton>
                        </div>
                      </div>

                      {chapter.lessons.length > 0 && (
                        <ul className="divide-y divide-midnight-100 border-t border-midnight-100 dark:divide-midnight-800 dark:border-midnight-800">
                          {chapter.lessons.map((lesson, lessonIndex) => (
                            <li
                              key={lesson.id}
                              className="flex flex-col gap-3 bg-white px-4 py-3 dark:bg-midnight-950/45 sm:flex-row sm:items-center"
                            >
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-midnight-50 text-xs font-black text-midnight-500 dark:bg-midnight-800 dark:text-ivory-300">
                                {lessonIndex + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-bold text-midnight-900 dark:text-ivory-100">
                                    {lesson.title}
                                  </p>
                                  {lesson.isFreePreview && (
                                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                                      مجانية
                                    </span>
                                  )}
                                </div>
                                <p
                                  className={cn(
                                    'mt-0.5 text-[11px] font-semibold',
                                    lesson.videoAsset?.status === 'READY'
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : lesson.videoAsset?.status === 'FAILED'
                                        ? 'text-red-600 dark:text-red-300'
                                        : 'text-midnight-400 dark:text-ivory-300/55',
                                  )}
                                >
                                  {lesson.videoAsset
                                    ? VIDEO_LABELS[lesson.videoAsset.status]
                                    : 'بدون فيديو'}
                                  {lesson.priceMinor ? ` · ${formatEgp(lesson.priceMinor)}` : ''}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                                <Button
                                  size="sm"
                                  variant={
                                    lesson.videoAsset?.status === 'READY' ? 'outline' : 'accent'
                                  }
                                  onClick={() => onUpload(lesson)}
                                >
                                  {lesson.videoAsset ? 'استبدال الفيديو' : 'رفع الفيديو'}
                                </Button>
                                <ActionButton
                                  label="تعديل الحصة"
                                  onClick={() =>
                                    onEdit({ kind: 'lesson', mode: 'edit', entity: lesson })
                                  }
                                >
                                  <PencilIcon />
                                </ActionButton>
                                <ActionButton
                                  label="أرشفة الحصة"
                                  danger
                                  onClick={() =>
                                    onArchive({
                                      kind: 'lesson',
                                      id: lesson.id,
                                      title: lesson.title,
                                    })
                                  }
                                >
                                  <ArchiveIcon />
                                </ActionButton>
                                <ActionButton
                                  label="حذف الحصة نهائيًا"
                                  danger
                                  onClick={() =>
                                    onDelete({ kind: 'lesson', id: lesson.id, title: lesson.title })
                                  }
                                >
                                  <TrashIcon />
                                </ActionButton>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
