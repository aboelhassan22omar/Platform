import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetchServer } from '@/lib/api';
import { GradeHero } from '@/features/catalog/grade-hero';
import { PlanCards } from '@/features/catalog/plan-cards';
import { Reveal, StaggerGroup } from '@/components/motion/reveal';
import { fadeUp } from '@/lib/motion';
import { pluralizeAr } from '@/lib/utils';
import { getTheme } from '@/themes/registry';
import type { GradeDetail } from '@/types/api';
import { platformConfig } from '@/config/platform.config';

// Catalogue edits made by the teacher must be visible as soon as the page is
// refreshed; this page deliberately does not use ISR caching.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ gradeSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug } = await params;
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const grade = await apiFetchServer<GradeDetail>(`/academic/grades/${gradeSlug}`, cookieHeader);

  if (!grade) return { title: 'الصف غير موجود' };

  return {
    title: grade.nameAr,
    description:
      grade.description ??
      `حصص ${platformConfig.subject.name} لـ${grade.nameAr} مع ${platformConfig.teacher.displayName}`,
  };
}

export default async function GradePage({ params }: PageProps) {
  const { gradeSlug } = await params;
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const grade = await apiFetchServer<GradeDetail>(`/academic/grades/${gradeSlug}`, cookieHeader);

  if (!grade) notFound();
  const theme = getTheme(grade.themeKey);

  return (
    <div data-theme={theme.key}>
      <GradeHero grade={grade} />

      {/* ------------------------------------------------------------------
          Courses
          ------------------------------------------------------------------ */}
      <section className="container-page py-14 sm:py-20" aria-labelledby="courses-heading">
        <Reveal variants={fadeUp}>
          <h2
            id="courses-heading"
            className="font-display text-2xl font-black text-midnight-900 sm:text-3xl"
          >
            كورسات {grade.shortNameAr}
          </h2>
          <p className="mt-2 text-sm text-midnight-500">
            كل كورس متقسم وحدات وفصول وحصص بنفس ترتيب المنهج.
          </p>
        </Reveal>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(340px,1fr)_minmax(0,2fr)] xl:gap-10">
          <div className="min-w-0">
            {grade.courses.length === 0 ? (
              <Reveal variants={fadeUp}>
                <div className="rounded-2xl border border-dashed border-ivory-400 bg-ivory-100 p-10 text-center">
                  <p className="font-display text-lg font-bold text-midnight-700">
                    لسه مفيش كورسات منشورة للصف ده
                  </p>
                  <p className="mt-2 text-sm text-midnight-500">
                    الكورسات هتظهر هنا أول ما تتنشر من لوحة التحكم.
                  </p>
                </div>
              </Reveal>
            ) : (
              <StaggerGroup as="ul" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                {grade.courses.map((course) => (
                  <Reveal as="li" key={course.id} variants={fadeUp}>
                    <Link
                      href={`/grades/${grade.slug}/courses/${course.slug}`}
                      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ivory-300 bg-white shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--accent)] hover:shadow-lifted"
                    >
                      {/* Cover */}
                      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-bl from-midnight-800 to-midnight-950">
                        {course.thumbnailUrl ? (
                          <img
                            src={course.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <img
                            src={theme.heroImage}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover object-left transition-transform duration-700 group-hover:scale-105"
                          />
                        )}
                        <span className="absolute bottom-3 right-3 rounded-lg bg-midnight-950/70 px-2.5 py-1 text-[11px] font-bold text-ivory-100 backdrop-blur-sm">
                          {pluralizeAr(course.unitCount, ['وحدة واحدة', 'وحدتان', 'وحدات'])}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        {/*
                      Honest labelling: courses whose curriculum has not been
                      verified against an official source say so, rather than
                      presenting provisional content as confirmed.
                    */}
                        {course.isProvisional && (
                          <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                            محتوى مبدئي — قيد المراجعة
                          </span>
                        )}

                        <h3 className="font-display text-lg font-extrabold text-midnight-900">
                          {course.title}
                        </h3>
                        {course.description && (
                          <p className="mt-2 flex-1 text-sm leading-relaxed text-midnight-500 line-clamp-3">
                            {course.description}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between border-t border-ivory-200 pt-4">
                          <span className="text-xs text-midnight-400">{course.academicYear}</span>
                          <span className="font-display text-sm font-black text-[var(--accent)]">
                            استعرض الوحدات والأسعار ←
                          </span>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </StaggerGroup>
            )}
          </div>

          <PlanCards plans={grade.plans} gradeName={grade.shortNameAr} />
        </div>
      </section>
    </div>
  );
}
