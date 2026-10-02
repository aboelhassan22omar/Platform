import { Injectable, NotFoundException } from '@nestjs/common';
import { EducationSystem, GradeLevel, PublishStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';

/**
 * The grades reachable from each educational pathway.
 *
 * This is the rule behind "اختار صفك الدراسي": a student on الثانوية العامة
 * must never be offered a بكالوريا grade, and vice versa. Enforced here, in
 * the registration DTO and by the (educationSystem, level) unique key.
 */
export const GRADES_BY_SYSTEM: Record<EducationSystem, GradeLevel[]> = {
  [EducationSystem.GENERAL]: [GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3],
  [EducationSystem.BACC]: [GradeLevel.BACC_1, GradeLevel.BACC_2],
};

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** The two pathway cards on the homepage, each with its grades. */
  async listSystems() {
    const grades = await this.prisma.grade.findMany({
      where: { isActive: true },
      orderBy: [{ educationSystem: 'asc' }, { sortOrder: 'asc' }],
    });

    const build = (system: EducationSystem) => ({
      key: system,
      nameAr: system === EducationSystem.GENERAL ? 'الثانوية العامة' : 'البكالوريا المصرية',
      nameEn: system === EducationSystem.GENERAL ? 'General Secondary' : 'Egyptian Baccalaureate',
      descriptionAr:
        system === EducationSystem.GENERAL
          ? 'المسار التقليدي للثانوية العامة المصرية'
          : 'نظام البكالوريا المصرية الجديد',
      descriptionEn:
        system === EducationSystem.GENERAL
          ? 'The traditional Egyptian general secondary pathway'
          : 'The new Egyptian Baccalaureate pathway',
      grades: grades
        .filter((grade) => grade.educationSystem === system)
        .map((grade) => this.presentGrade(grade)),
    });

    return [build(EducationSystem.GENERAL), build(EducationSystem.BACC)];
  }

  async listGrades(system?: EducationSystem) {
    const grades = await this.prisma.grade.findMany({
      where: { isActive: true, ...(system ? { educationSystem: system } : {}) },
      orderBy: [{ educationSystem: 'asc' }, { sortOrder: 'asc' }],
    });
    return grades.map((grade) => this.presentGrade(grade));
  }

  async getGradeBySlug(slug: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { slug },
      include: {
        courses: {
          where: { status: PublishStatus.PUBLISHED },
          orderBy: { sortOrder: 'asc' },
          include: {
            academicYear: true,
            _count: { select: { units: true } },
          },
        },
        plans: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { products: { where: { isActive: true }, select: { id: true } } },
        },
      },
    });

    if (!grade) throw new NotFoundException('الصف الدراسي غير موجود');

    return {
      ...this.presentGrade(grade),
      courses: grade.courses.map((course) => ({
        id: course.id,
        title: course.title,
        titleEn: course.titleEn,
        slug: course.slug,
        description: course.description,
        descriptionEn: course.descriptionEn,
        thumbnailUrl: this.storage.publicUrl(course.thumbnailKey),
        coverUrl: this.storage.publicUrl(course.coverKey),
        unitCount: course._count.units,
        academicYear: course.academicYear.label,
        priceMinor: course.priceMinor,
        isProvisional: course.isProvisional,
      })),
      plans: grade.plans.map((plan) => ({
        id: plan.id,
        productId: plan.products[0]?.id ?? null,
        kind: plan.kind,
        title: plan.title,
        titleEn: plan.titleEn,
        description: plan.description,
        descriptionEn: plan.descriptionEn,
        priceMinor: plan.priceMinor,
        currency: plan.currency,
        durationDays: plan.durationDays,
        accessUntil: plan.accessUntil,
        highlights: plan.highlights,
        highlightsEn: plan.highlightsEn,
      })),
    };
  }

  async listAcademicYears() {
    return this.prisma.academicYear.findMany({ orderBy: { startsOn: 'desc' } });
  }

  async currentAcademicYear() {
    const year = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!year) throw new NotFoundException('لم يتم ضبط العام الدراسي الحالي');
    return year;
  }

  private presentGrade(grade: {
    id: string;
    educationSystem: EducationSystem;
    level: GradeLevel;
    nameAr: string;
    nameEn: string | null;
    shortNameAr: string;
    shortNameEn: string | null;
    slug: string;
    themeKey: string;
    description: string | null;
    descriptionEn: string | null;
    sortOrder: number;
  }) {
    return {
      id: grade.id,
      educationSystem: grade.educationSystem,
      level: grade.level,
      nameAr: grade.nameAr,
      nameEn: grade.nameEn,
      shortNameAr: grade.shortNameAr,
      shortNameEn: grade.shortNameEn,
      slug: grade.slug,
      // The frontend theme registry keys each of the five distinct academic
      // experiences off this value.
      themeKey: grade.themeKey,
      description: grade.description,
      descriptionEn: grade.descriptionEn,
      sortOrder: grade.sortOrder,
    };
  }
}
