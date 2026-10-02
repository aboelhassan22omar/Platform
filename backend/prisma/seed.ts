/**
 * Database seed.
 *
 * Idempotent: every write is an upsert keyed on a natural key, so running it
 * twice changes nothing. Safe to run on every `docker compose up`.
 *
 * Seeds:
 *   1. the current academic year
 *   2. the five grades
 *   3. the curriculum from curriculum-data.ts (courses -> units -> chapters ->
 *      lessons) plus the Product rows that make lessons purchasable
 *   4. subscription plan templates, created INACTIVE
 *   5. site settings (brand text, contact placeholders)
 *   6. demo students and a demo purchase — ONLY when SEED_DEMO_DATA=true
 *
 * Demo rows are clearly labelled and refuse to run in production.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hash } from '@node-rs/argon2';
import { CURRICULUM, GRADES, PLAN_TEMPLATES, type GradeKey } from './curriculum-data';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const slugify = (input: string): string =>
  input
    .trim()
    .replace(/[ً-ْٰـ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ء-ي٠-٩]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

const log = (message: string) => console.log(`[seed] ${message}`);

async function seedAcademicYear() {
  const label = '2026/2027';
  const year = await prisma.academicYear.upsert({
    where: { label },
    create: {
      label,
      startsOn: new Date('2026-09-01T00:00:00Z'),
      endsOn: new Date('2027-07-31T00:00:00Z'),
      isCurrent: true,
    },
    update: {},
  });
  log(`academic year ${year.label}`);
  return year;
}

async function seedGrades() {
  const grades = new Map<GradeKey, string>();

  for (const grade of GRADES) {
    const row = await prisma.grade.upsert({
      where: {
        educationSystem_level: {
          educationSystem: grade.educationSystem,
          level: grade.level,
        },
      },
      create: {
        educationSystem: grade.educationSystem,
        level: grade.level,
        nameAr: grade.nameAr,
        nameEn: grade.nameEn,
        shortNameAr: grade.shortNameAr,
        shortNameEn: grade.shortNameEn,
        slug: grade.slug,
        themeKey: grade.themeKey,
        description: grade.description,
        descriptionEn: grade.descriptionEn,
        sortOrder: grade.sortOrder,
      },
      // Presentation fields are refreshed; the enum pair is the identity.
      update: {
        nameAr: grade.nameAr,
        nameEn: grade.nameEn,
        shortNameAr: grade.shortNameAr,
        shortNameEn: grade.shortNameEn,
        themeKey: grade.themeKey,
        description: grade.description,
        descriptionEn: grade.descriptionEn,
        sortOrder: grade.sortOrder,
      },
    });
    grades.set(grade.level, row.id);
  }

  log(`${grades.size} grades`);
  return grades;
}

async function seedCurriculum(grades: Map<GradeKey, string>, academicYearId: string) {
  let lessonCount = 0;
  let productCount = 0;

  for (const [gradeKey, courses] of Object.entries(CURRICULUM) as Array<
    [GradeKey, (typeof CURRICULUM)[GradeKey]]
  >) {
    const gradeId = grades.get(gradeKey);
    if (!gradeId) continue;

    for (const [courseIndex, course] of courses.entries()) {
      const courseSlug = slugify(course.title);

      const courseRow = await prisma.course.upsert({
        where: { gradeId_slug: { gradeId, slug: courseSlug } },
        create: {
          gradeId,
          academicYearId,
          title: course.title,
          slug: courseSlug,
          description: course.description,
          status: 'PUBLISHED',
          sortOrder: courseIndex,
          priceMinor: course.priceMinor ?? null,
          isProvisional: course.isProvisional,
          publishedAt: new Date(),
        },
        update: {
          description: course.description,
          isProvisional: course.isProvisional,
          priceMinor: course.priceMinor ?? null,
        },
      });

      // Whole-course product.
      if (course.priceMinor) {
        await prisma.product.upsert({
          where: { courseId: courseRow.id },
          create: {
            kind: 'COURSE',
            courseId: courseRow.id,
            title: `${course.title} — الكورس كامل`,
            priceMinor: course.priceMinor,
          },
          update: { priceMinor: course.priceMinor },
        });
        productCount += 1;
      }

      for (const [unitIndex, unit] of course.units.entries()) {
        const unitRow = await prisma.unit.upsert({
          // Units have no natural key, so find-or-create on (course, title).
          where: {
            id:
              (
                await prisma.unit.findFirst({
                  where: { courseId: courseRow.id, title: unit.title },
                  select: { id: true },
                })
              )?.id ?? '__none__',
          },
          create: {
            courseId: courseRow.id,
            title: unit.title,
            description: unit.description,
            sortOrder: unitIndex,
            status: 'PUBLISHED',
          },
          update: { description: unit.description, sortOrder: unitIndex },
        });

        for (const [chapterIndex, chapter] of unit.chapters.entries()) {
          const chapterRow = await prisma.chapter.upsert({
            where: {
              id:
                (
                  await prisma.chapter.findFirst({
                    where: { unitId: unitRow.id, title: chapter.title },
                    select: { id: true },
                  })
                )?.id ?? '__none__',
            },
            create: {
              unitId: unitRow.id,
              title: chapter.title,
              description: chapter.description,
              sortOrder: chapterIndex,
              status: 'PUBLISHED',
              priceMinor: chapter.priceMinor ?? null,
            },
            update: { sortOrder: chapterIndex, priceMinor: chapter.priceMinor ?? null },
          });

          if (chapter.priceMinor) {
            await prisma.product.upsert({
              where: { chapterId: chapterRow.id },
              create: {
                kind: 'CHAPTER_BUNDLE',
                chapterId: chapterRow.id,
                title: `${chapter.title} — باقة الفصل`,
                priceMinor: chapter.priceMinor,
              },
              update: { priceMinor: chapter.priceMinor },
            });
            productCount += 1;
          }

          for (const [lessonIndex, lesson] of chapter.lessons.entries()) {
            const lessonSlug = slugify(lesson.title);

            const lessonRow = await prisma.lesson.upsert({
              where: { chapterId_slug: { chapterId: chapterRow.id, slug: lessonSlug } },
              create: {
                chapterId: chapterRow.id,
                title: lesson.title,
                slug: lessonSlug,
                description: lesson.description,
                sortOrder: lessonIndex,
                status: 'PUBLISHED',
                priceMinor: lesson.priceMinor ?? null,
                isFreePreview: lesson.isFreePreview ?? false,
                publishedAt: new Date(),
              },
              update: {
                description: lesson.description,
                sortOrder: lessonIndex,
                priceMinor: lesson.priceMinor ?? null,
                isFreePreview: lesson.isFreePreview ?? false,
              },
            });
            lessonCount += 1;

            if (lesson.priceMinor) {
              await prisma.product.upsert({
                where: { lessonId: lessonRow.id },
                create: {
                  kind: 'LESSON',
                  lessonId: lessonRow.id,
                  title: lesson.title,
                  priceMinor: lesson.priceMinor,
                },
                update: { priceMinor: lesson.priceMinor },
              });
              productCount += 1;
            }
          }
        }
      }
    }
  }

  log(`${lessonCount} lessons, ${productCount} products`);
}

async function seedPlans(grades: Map<GradeKey, string>, academicYearId: string) {
  let count = 0;

  for (const grade of GRADES) {
    const gradeId = grades.get(grade.level);
    if (!gradeId) continue;

    for (const template of PLAN_TEMPLATES) {
      const title = `${grade.shortNameAr} — ${template.titleSuffix}`;
      const existing = await prisma.plan.findFirst({
        where: { gradeId, kind: template.kind, academicYearId },
        select: { id: true },
      });

      if (existing) continue;

      await prisma.plan.create({
        data: {
          gradeId,
          academicYearId,
          kind: template.kind,
          title,
          description: template.description,
          priceMinor: template.priceMinor,
          durationDays: template.durationDays,
          sortOrder: template.sortOrder,
          highlights: template.highlights,
          // Deliberately inactive: the teacher sets real prices and activates.
          isActive: false,
          products: {
            create: {
              kind: template.kind,
              title,
              description: template.description,
              priceMinor: template.priceMinor,
              isActive: false,
            },
          },
        },
      });
      count += 1;
    }
  }

  log(`${count} subscription plans (inactive — activate from the dashboard)`);
}

async function seedSiteSettings() {
  const settings: Array<{ key: string; value: unknown }> = [
    {
      key: 'brand',
      value: {
        teacherName: 'مستر عمرو محروس',
        teacherTitle: 'مدرس التاريخ',
        platformName: 'منصة مستر عمرو محروس التعليمية',
        tagline: 'ابدأ رحلة التاريخ',
        // Populated once the teacher supplies authorised assets.
        logoUrl: null,
        portraitUrl: null,
        assetsNote:
          'ارفع الشعار وصور الأستاذ المعتمدة من لوحة التحكم. لا تُستخدم أي صور غير مرخّصة.',
      },
    },
    {
      key: 'contact',
      value: {
        // Placeholders — no contact details were supplied for this build.
        whatsapp: null,
        phone: null,
        email: null,
        facebookUrl: 'https://www.facebook.com/share/19mGXkUMKQ/',
      },
    },
    {
      key: 'legal',
      value: {
        privacyUpdatedAt: null,
        termsUpdatedAt: null,
        note: 'النصوص القانونية مسودة ويجب مراجعتها قانونيًا قبل الإطلاق.',
      },
    },
  ];

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      create: { key: setting.key, value: setting.value as object },
      update: {},
    });
  }

  log(`${settings.length} site settings`);
}

/**
 * Demo students so the dashboard has something to show in development.
 * Every account is prefixed `demo.` and the password is printed below —
 * these are test credentials and nothing else.
 */
async function seedDemoData(grades: Map<GradeKey, string>, academicYearId: string) {
  const password = 'Demo12345';
  const passwordHash = await hash(password, {
    algorithm: 2, // Argon2id; avoids consuming the dependency's ambient const enum.
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const demos: Array<{
    username: string;
    fullName: string;
    phone: string;
    grade: GradeKey;
    system: 'GENERAL' | 'BACC';
  }> = [
    { username: 'demo.ahmed', fullName: 'أحمد محمد علي', phone: '01000000001', grade: 'SEC_1', system: 'GENERAL' },
    { username: 'demo.mariam', fullName: 'مريم حسن إبراهيم', phone: '01000000002', grade: 'SEC_2', system: 'GENERAL' },
    { username: 'demo.youssef', fullName: 'يوسف طارق سعيد', phone: '01000000003', grade: 'SEC_3', system: 'GENERAL' },
    { username: 'demo.nour', fullName: 'نور الدين عماد', phone: '01000000004', grade: 'BACC_1', system: 'BACC' },
    { username: 'demo.salma', fullName: 'سلمى أشرف فؤاد', phone: '01000000005', grade: 'BACC_2', system: 'BACC' },
  ];

  for (const demo of demos) {
    await prisma.user.upsert({
      where: { username: demo.username },
      create: {
        username: demo.username,
        fullName: demo.fullName,
        passwordHash,
        phone: demo.phone,
        parentPhone: '01100000000',
        educationSystem: demo.system,
        gradeLevel: demo.grade,
        academicYearId,
        role: 'STUDENT',
      },
      update: {},
    });
  }

  log(`${demos.length} demo students (password: ${password}) — TEST DATA ONLY`);
}

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  const wantsDemo = process.env.SEED_DEMO_DATA === 'true';

  log('starting...');

  const year = await seedAcademicYear();
  const grades = await seedGrades();
  await seedCurriculum(grades, year.id);
  await seedPlans(grades, year.id);
  await seedSiteSettings();

  if (wantsDemo && isProduction) {
    throw new Error(
      'SEED_DEMO_DATA=true with NODE_ENV=production. Refusing to write demo accounts to a production database.',
    );
  }

  if (wantsDemo) {
    await seedDemoData(grades, year.id);
  } else {
    log('demo data skipped (SEED_DEMO_DATA is not "true")');
  }

  log('done.');
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
