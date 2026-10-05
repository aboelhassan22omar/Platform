'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { Button, ButtonLink } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toArabicDigits } from '@/lib/utils';

interface Person { id: string; name: string; isHost: boolean; canKick: boolean }
interface Attendance { title: string; status: string; count: number; studentCount: number; items: Person[] }

export function LiveParticipants({ id }: { id: string }) {
  const [target, setTarget] = useState<Person | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['live-participants', id],
    queryFn: () => api.get<Attendance>(`/admin/live/${id}/participants`),
    refetchInterval: 5_000,
  });
  const kick = async () => {
    if (!target || pending) return;
    setPending(true); setActionError(''); setNotice('');
    try {
      await api.post(`/admin/live/${id}/participants/${target.id}/kick`);
      setNotice(`تم إخراج ${target.name} من الحصة ومنع رجوعه لها`);
      setTarget(null);
      await refetch();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'مقدرناش نطرد الطالب، حاول تاني');
      setTarget(null);
    } finally { setPending(false); }
  };
  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-black">الحاضرين في اللايف</h1><p className="mt-1 text-sm">{data?.title}</p></div>
        <div className="flex gap-2"><ButtonLink href={`/live/${id}`} variant="accent">رجوع للايف</ButtonLink><ButtonLink href="/admin/live">كل اللايفات</ButtonLink></div>
      </div>
      <p className="text-sm">القائمة بتتحدث كل ٥ ثواني. العدد بيشمل المتصلين حاليًا بس.</p>
      {data && <div className="flex flex-wrap gap-3 rounded-2xl border border-gold-500/30 p-4 font-bold"><span>إجمالي الحاضرين: {toArabicDigits(String(data.count))}</span><span>الطلبة: {toArabicDigits(String(data.studentCount))}</span></div>}
      {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {(error || actionError) && <div role="alert" className="rounded-xl bg-red-500/10 p-3 text-red-700 dark:text-red-300"><p>{actionError || (error instanceof ApiError ? error.message : 'تعذر تحديث الحاضرين')}</p><Button className="mt-2" onClick={() => void refetch()}>تحديث القائمة</Button></div>}
      {isLoading ? <p role="status">بنجيب الحاضرين…</p> : <ul className="divide-y divide-gold-500/15 rounded-2xl border border-gold-500/25">
        {data?.items.length === 0 && <li className="p-6 text-center">مفيش حد متصل باللايف دلوقتي</li>}
        {data?.items.map((person) => <li key={person.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="break-words font-bold">{person.name}</p><span className="text-sm">{person.isHost ? 'المستر' : person.canKick ? 'طالب' : 'فريق المنصة'}</span></div>{person.canKick && data.status === 'LIVE' && <Button variant="danger" disabled={pending} onClick={() => setTarget(person)} aria-label={`طرد ${person.name}`}>طرد</Button>}</li>)}
      </ul>}
      <ConfirmDialog open={Boolean(target)} title="تطرد الطالب من اللايف؟" body={`هتخرج ${target?.name ?? ''} من الحصة، ومش هيقدر يرجع لنفس اللايف.`} confirmLabel="أيوه، اطرده" cancelLabel="إلغاء" destructive isPending={pending} onConfirm={() => void kick()} onCancel={() => setTarget(null)} />
    </section>
  );
}
