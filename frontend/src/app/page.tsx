import { headers } from 'next/headers';
import { apiFetchServer } from '@/lib/api';
import { platformConfig } from '@/config/platform.config';
import { HistoryHome } from '@/features/home/history-home';
import { GenericSubjectHome } from '@/features/home/generic-subject-home';
import type { EducationSystemSummary } from '@/types/api';
export const revalidate = 60;
export default async function HomePage() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const systems =
    (await apiFetchServer<EducationSystemSummary[]>('/academic/systems', cookieHeader)) ?? [];
  return platformConfig.subject.key === 'history' ? (
    <HistoryHome systems={systems} />
  ) : (
    <GenericSubjectHome systems={systems} />
  );
}
