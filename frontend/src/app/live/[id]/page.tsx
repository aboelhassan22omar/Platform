import type { Metadata } from 'next';
import { RequireAuth } from '@/features/auth/require-auth';
import { LiveRoom } from '@/features/live/live-room';

export const metadata: Metadata = { title: 'لايف' };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // RequireAuth is a UX guard; the API decides who may join which class.
  return (
    <RequireAuth>
      <LiveRoom id={id} />
    </RequireAuth>
  );
}
