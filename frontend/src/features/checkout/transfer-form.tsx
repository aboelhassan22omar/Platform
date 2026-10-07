'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatEgp } from '@/lib/utils';
import type { Order } from '@/types/api';

export function TransferForm({ order }: { order: Order }) {
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const details = order.payment.transfer!;
  return (
    <section className="w-full space-y-4 text-start">
      <h1 className="font-display text-2xl font-black">إتمام التحويل</h1>
      <p>
        حوّل {formatEgp(order.totalMinor)} عبر{' '}
        {details.method === 'INSTAPAY' ? 'إنستا باي إلى محفظة الموبايل' : 'فودافون كاش'} إلى الرقم:
      </p>
      <p dir="ltr" className="rounded-xl bg-gold-500/10 p-4 text-center text-2xl font-bold">
        {details.phone}
      </p>
      <p>
        تأكد من اسم المستلم داخل تطبيق الدفع قبل إرسال المبلغ. لا يتم فتح الحصة إلا بعد مراجعة وصول
        التحويل في حساب المستلم.
      </p>
      {submitted || details.submitted ? (
        <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">
          تم إرسال بيانات التحويل للمراجعة. ستفتح الحصة بعد تأكيد وصول المبلغ، ويمكنك العودة للطلب
          لاحقًا.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError('');
            try {
              await api.post(`/orders/${order.reference}/transfer`, {
                senderPhone: phone,
                transactionReference: reference,
              });
              setSubmitted(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'تعذر إرسال التحويل');
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block">
            رقم الموبايل المُرسل
            <input
              dir="ltr"
              className="mt-1 block min-h-11 w-full rounded-lg border p-3"
              required
              inputMode="tel"
              maxLength={11}
              pattern="(010|011|012|015)[0-9]{8}"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="block">
            رقم العملية من تطبيق الدفع
            <input
              dir="ltr"
              className="mt-1 block min-h-11 w-full rounded-lg border p-3"
              required
              minLength={3}
              maxLength={100}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <button
            disabled={pending}
            className="min-h-11 w-full rounded-lg bg-gold-500 p-3 font-bold disabled:opacity-50"
          >
            {pending ? 'جارٍ الإرسال…' : 'إرسال بيانات التحويل للمراجعة'}
          </button>
        </form>
      )}
    </section>
  );
}
