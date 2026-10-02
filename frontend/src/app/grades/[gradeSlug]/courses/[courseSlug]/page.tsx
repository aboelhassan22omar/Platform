import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { apiFetchServer } from '@/lib/api';
import { CourseOutline } from '@/features/catalog/course-outline';
import type { CourseDetail } from '@/types/api';

interface PageProps {
  params: Promise<{ gradeSlug: string; courseSlug: string }>;
}

function apiCourseSlug(value: string): string {
  // Dynamic params can arrive either decoded or already percent-encoded,
  // depending on how the URL was reached. Normalize before calling the API so
  // Arabic slugs are never encoded twice.
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, courseSlug } = await params;
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const course = await apiFetchServer<CourseDetail>(
    `/grades/${gradeSlug}/courses/${apiCourseSlug(courseSlug)}`,
    cookieHeader,
  );

  return {
    title: course?.title ?? 'الكورس',
    description: course?.description ?? undefined,
  };
}

export default async function CoursePage({ params }: PageProps) {
  const { gradeSlug, courseSlug } = await params;
  const cookieHeader = (await headers()).get('cookie') ?? '';

  const course = await apiFetchServer<CourseDetail>(
    `/grades/${gradeSlug}/courses/${apiCourseSlug(courseSlug)}`,
    cookieHeader,
  );

  if (!course) notFound();

  return <CourseOutline course={course} />;
}
