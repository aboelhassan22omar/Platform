import type { Metadata } from 'next';
import { StudentLeaderboard } from '@/features/dashboard/student-leaderboard';

export const metadata: Metadata = { title: 'المتصدرون' };

export default function LeaderboardPage() {
  return <StudentLeaderboard />;
}
