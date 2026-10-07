'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatEgp } from '@/lib/utils';

interface Transfer {
  id: string;
  amountMinor: number;
  method: string;
  providerPayload: { senderPhone?: string; transactionReference?: string } | null;
  order: { id: string; reference: string; user: { fullName: string; phone: string } };
}
export function AdminTransfers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-transfers'],
    queryFn: () => api.get<Transfer[]>('/admin/transfers'),
    refetchInterval: 30000,
  });
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">مراجعة التحويلات</h1>
      <p>
        راجع وصول المبلغ فعليًا في المحفظة أو الحساب البنكي قبل تأكيد أي طلب. بيانات الطالب وحدها لا
        تثبت الدفع.
      </p>
      {isLoading && <p role="status">جارٍ تحميل الطلبات…</p>}
      {error && <p role="alert">{error.message}</p>}
      {data?.length === 0 && <p>لا توجد تحويلات معلّقة.</p>}
      {data?.map((t) => (
        <Review key={t.id} transfer={t} />
      ))}
    </section>
  );
}
function Review({ transfer: t }: { transfer: Transfer }) {
  const client = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="space-y-3 rounded-xl border bg-white p-5 text-midnight-900"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!checked) return;
        setPending(true);
        setError('');
        try {
          await api.post(`/admin/transfers/${t.order.id}/approve`, {
            receivedAmountMinor: Math.round(Number(amount) * 100),
            transactionReference: reference,
          });
          await client.invalidateQueries({ queryKey: ['admin-transfers'] });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'تعذر تأكيد التحويل');
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="font-bold">
        {t.order.user.fullName} — {t.order.reference}
      </h2>
      <p>المبلغ المطلوب: {formatEgp(t.amountMinor)}</p>
      <p>هاتف الطالب: {t.order.user.phone}</p>
      <p>
        بيانات الطالب: {t.providerPayload?.senderPhone ?? 'لم ترسل بعد'} /{' '}
        {t.providerPayload?.transactionReference ?? 'لا يوجد رقم عملية'}
      </p>
      <label className="block">
        المبلغ الذي وصل فعليًا بالجنيه
        <input
          className="ml-2 min-h-11 rounded border p-2"
          required
          inputMode="decimal"
          pattern="[0-9]+([.][0-9]{1,2})?"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className="block">
        رقم العملية في حساب المستلم
        <input
          className="ml-2 min-h-11 rounded border p-2"
          required
          minLength={3}
          maxLength={100}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          required
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        راجعت حساب المستلم وتأكدت من وصول هذا المبلغ لهذا الطلب
      </label>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={pending || !checked}
        className="min-h-11 rounded-lg bg-gold-500 px-5 font-bold disabled:opacity-50"
      >
        {pending ? 'جارٍ التأكيد…' : 'تأكيد وصول المبلغ وفتح المحتوى'}
      </button>
    </form>
  );
}
