import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { apiFetchServer } from '@/lib/api';
import { LessonView } from '@/features/player/lesson-view';
import type { LessonDetail } from '@/types/api';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const lesson = await apiFetchServer<LessonDetail>(`/lessons/${id}`, cookieHeader);
  return { title: lesson?.title ?? 'الحصة' };
}

export default async function LessonPage({ params }: PageProps) {
  const { id } = await params;
  const cookieHeader = (await headers()).get('cookie') ?? '';

  // Returns null for a signed-out visitor (401) as well as a missing lesson.
  const lesson = await apiFetchServer<LessonDetail>(`/lessons/${id}`, cookieHeader);

  if (!lesson) {
    return (
      <div className="container-page flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <h1 className="font-display text-2xl font-black text-midnight-900">
          لازم تسجّل دخولك الأول
        </h1>
        <p className="mt-2 max-w-sm text-sm text-midnight-500">
          سجّل دخولك عشان تقدر تشوف الحصة دي وتتابع تقدمك.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/lessons/${id}`)}`}
          className="mt-6 rounded-xl bg-gold-500 px-6 py-3 text-sm font-bold text-midnight-950"
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (lesson.status !== 'PUBLISHED' && lesson.access.reason === 'NOT_PUBLISHED') {
    notFound();
  }

  return <LessonView lesson={lesson} />;
}
