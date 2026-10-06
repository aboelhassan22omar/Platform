import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { apiFetchServer } from '@/lib/api';
import { Reveal, StaggerGroup } from '@/components/motion/reveal';
import { fadeUp } from '@/lib/motion';
import { getTheme } from '@/themes/registry';
import type { EducationSystemSummary } from '@/types/api';
import {
  WingedSunOfHorus,
  TempleCornerBrackets,
  HieroglyphRegister,
  EyeOfHorus,
  DjedPillar,
} from '@/components/decor/egyptian-motifs';
import { platformConfig } from '@/config/platform.config';

export const revalidate = 60;

export const metadata: Metadata = {
  title: `المناهج والصفوف الدراسية — ${platformConfig.brand.shortPlatformName}`,
  description: `المناهج والصفوف الدراسية للثانوية العامة والبكالوريا المصرية مع ${platformConfig.teacher.displayName}`,
};

export default async function GradesPage() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const systems =
    (await apiFetchServer<EducationSystemSummary[]>('/academic/systems', cookieHeader)) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbf8f0] via-[#f7f2e4] to-[#eee2c6] dark:from-[#030712] dark:via-[#05131f] dark:to-[#081726] text-midnight-950 dark:text-ivory-50 transition-colors duration-300">
      {/* --- الهيدر الملكي الفخم لصفحة الصفوف والمناهج — خلفية سينمائية كاملة بمقاس متناسق --- */}
      <section className="relative overflow-hidden min-h-[480px] sm:min-h-[520px] lg:min-h-[560px] xl:min-h-[580px] flex items-center bg-[#040a14] text-ivory-50 py-16 sm:py-20 lg:py-24 border-b border-gold-500/15">
        {/* خلفية الصرح التعليمي والبانوراما الرسمية المعتمدة للمنصة (ديسكتوب وتابلت فقط >= md) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          <Image
            src={
              platformConfig.subject.key === 'history'
                ? '/images/teacher-bacc-foundations.png'
                : platformConfig.assets.teacher
            }
            alt={`${platformConfig.teacher.displayName} - الصفوف والمناهج الدراسية`}
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover object-[left_center] sm:object-[left_bottom] lg:object-left"
          />
        </div>

        {/* تدرجات دمج محيطية تضمن وضوح وقراءة النصوص مع الحفاظ التام على كامل تفاصيل مشهد المستر الأصلي */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block bg-gradient-to-l from-[#040a14]/90 via-[#040a14]/55 to-transparent sm:from-[#040a14]/85 sm:via-[#040a14]/25 sm:to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbf8f0] dark:from-[#030712] via-transparent to-transparent"
        />
        <div
          className="texture-parchment pointer-events-none absolute inset-0 opacity-15"
          aria-hidden
        />

        <div className="container-page relative z-10 w-full">
          <Reveal variants={fadeUp}>
            <div className="max-w-2xl sm:mr-auto lg:mr-0 ml-auto text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/15 px-4 py-1.5 text-xs font-black text-gold-300 mb-4 shadow-sm backdrop-blur-xs">
                <WingedSunOfHorus className="h-4 w-7 text-gold-400" />
                بوابات المناهج والصفوف المعتمدة
              </span>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-ivory-50 leading-tight">
                الصفوف و<span className="text-gradient-gold">المناهج الدراسية</span>
              </h1>

              <p className="mt-4 text-base sm:text-lg leading-relaxed text-ivory-200/90 font-medium max-w-xl">
                كل صف دراسي مصمم كصرح متكامل: دروس تفاعلية، نواتج تعلم مطابقة لمواصفات الوزارة،
                ومتابعة مستمرة تصنع تفوقك في مادة {platformConfig.subject.name} مع{' '}
                {platformConfig.teacher.displayName}.
              </p>

              {/* شريط تعريف الأستاذ على الهاتف فقط (< md) */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gold-500/30 bg-[#06121d]/90 p-3 shadow-lg backdrop-blur-md md:hidden">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gold-500/50 shadow-md">
                  <Image
                    src="/images/eras/bacc-portrait.jpg"
                    alt={platformConfig.teacher.displayName}
                    fill
                    sizes="56px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-black text-ivory-50 truncate">
                    {platformConfig.teacher.displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-gold-300 truncate">
                    كبير معلمي ومعد برامج التاريخ
                  </p>
                </div>
              </div>

              <div className="mt-6 max-w-xs">
                <HieroglyphRegister />
              </div>

              {/* ميزات سريعة للصرح التعليمي */}
              <div className="mt-6 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs font-bold text-gold-200">
                  <span>𓋹</span>
                  <span>٥ مسارات دراسية معتمدة</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs font-bold text-gold-200">
                  <span>𓂀</span>
                  <span>بنوك أسئلة ونواتج تعلم وزارية</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs font-bold text-gold-200">
                  <span>𓎛</span>
                  <span>شروحات تفاعلية وتقييم مستمر</span>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- الصفوف والمسارات التعليمية --- */}
      <div className="container-page space-y-16 py-14 sm:py-20 relative z-10">
        {systems.map((system) => (
          <section key={system.key} aria-labelledby={`system-${system.key}`} className="relative">
            <Reveal variants={fadeUp}>
              <div className="flex items-center gap-3.5 mb-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-500/15 border border-gold-400/35 text-amber-700 dark:text-gold-300 shadow-xs">
                  {system.key === 'GENERAL' ? (
                    <EyeOfHorus className="h-5 w-6" />
                  ) : (
                    <DjedPillar className="h-5 w-5" />
                  )}
                </span>
                <div>
                  <h2
                    id={`system-${system.key}`}
                    className="font-display text-2xl sm:text-3xl font-black text-midnight-950 dark:text-ivory-50"
                  >
                    {system.nameAr}
                  </h2>
                  <p className="text-sm text-midnight-700/80 dark:text-ivory-300/75 mt-0.5">
                    {system.descriptionAr}
                  </p>
                </div>
              </div>
            </Reveal>

            <StaggerGroup as="ul" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {system.grades.map((grade) => {
                const theme = getTheme(grade.themeKey);
                return (
                  <Reveal as="li" key={grade.id} variants={fadeUp}>
                    <Link
                      href={`/grades/${grade.slug}`}
                      data-theme={theme.key}
                      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-gold-500/25 dark:border-gold-500/20 bg-white/95 dark:bg-midnight-950/85 shadow-card transition-all duration-300 hover:-translate-y-2 hover:border-gold-400 hover:shadow-[0_12px_35px_rgba(217,119,6,0.22)] dark:hover:shadow-[0_12px_35px_rgba(245,158,11,0.25)]"
                    >
                      <TempleCornerBrackets />

                      <div aria-hidden className="relative h-48 overflow-hidden bg-midnight-950">
                        <Image
                          src={theme.heroImage}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover object-[center_20%] transition-transform duration-700 group-hover:scale-105"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-midnight-950/90 via-midnight-950/30 to-transparent" />
                        <span
                          className="absolute inset-x-0 top-0 h-1"
                          style={{ background: theme.accentHex }}
                        />
                        <span className="absolute bottom-3 right-3 px-3 py-1 rounded-lg text-xs font-black bg-midnight-950/90 border border-gold-400/40 text-gold-300 backdrop-blur-md shadow-md">
                          {theme.eraLabel}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50 group-hover:text-amber-700 dark:group-hover:text-gold-200 transition-colors">
                          {grade.nameAr}
                        </h3>

                        <p className="mt-2.5 flex-1 text-xs sm:text-sm leading-relaxed text-midnight-700/80 dark:text-ivory-200/75">
                          {grade.description ?? theme.eraTagline}
                        </p>

                        <div className="mt-5 pt-3.5 border-t border-gold-500/15 dark:border-gold-500/20 flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-amber-700 dark:text-gold-300 group-hover:text-amber-800 dark:group-hover:text-gold-200 transition-colors">
                            ادخل الصف وابدأ الحصص
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="none"
                              aria-hidden="true"
                              className="transition-transform duration-300 group-hover:-translate-x-1"
                            >
                              <path
                                d="M10 3.5L5.5 8l4.5 4.5"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </StaggerGroup>
          </section>
        ))}
      </div>
    </div>
  );
}
