import type { Metadata } from 'next';
import { MyLessons } from '@/features/dashboard/my-lessons';

export const metadata: Metadata = { title: 'حصصي' };

export default function MyLessonsPage() {
  return <MyLessons />;
}
