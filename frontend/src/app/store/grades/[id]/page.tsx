import { GradeStore } from '@/features/store/grade-store';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GradeStore id={id} />;
}
