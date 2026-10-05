import { LiveParticipants } from '@/features/admin/live-participants';

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveParticipants id={id} />;
}
