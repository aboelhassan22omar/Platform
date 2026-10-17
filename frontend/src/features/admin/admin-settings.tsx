'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  CertificateSheet,
  type CertificateTemplate,
} from '@/features/certificates/certificate-sheet';
import {
  PROTECTION_QUERY_KEY,
  type ProtectionSettings,
} from '@/features/protection/use-protection';

export function AdminSettings() {
  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
          إعدادات المنصة
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50">
          الحماية والشهادات
        </h1>
      </header>
      <ProtectionSection />
      <CertificateTemplateSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content protection
// ---------------------------------------------------------------------------

function ProtectionSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const settings = useQuery({
    queryKey: ['admin-protection-settings'],
    queryFn: () => api.get<ProtectionSettings>('/admin/settings/protection'),
  });
  const save = useMutation({
    mutationFn: (next: ProtectionSettings) =>
      api.put<ProtectionSettings>('/admin/settings/protection', next),
    onMutate: () => setError(null),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin-protection-settings'], saved);
      void queryClient.invalidateQueries({ queryKey: PROTECTION_QUERY_KEY });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'تعذر الحفظ'),
  });
  const values = save.isPending ? save.variables : settings.data;
  const toggle = (key: keyof ProtectionSettings) =>
    values && save.mutate({ ...values, [key]: !values[key] });

  return (
    <section aria-labelledby="protection-title" className="space-y-4">
      <div>
        <h2
          id="protection-title"
          className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
        >
          حماية المحتوى
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
          بتشتغل على الطلاب بس، وإنت وفريقك بتشوفوا المنصة عادي. التغيير بيوصل للطلاب خلال دقيقة.
        </p>
      </div>

      {settings.isLoading || !values ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <SwitchCard
            checked={values.blockCapture}
            onToggle={() => toggle('blockCapture')}
            disabled={save.isPending}
            title="منع تصوير الشاشة والنسخ"
            points={[
              'الصفحة بتستخبى أول ما الطالب يفتح أداة تصوير أو تسجيل أو يسيب الصفحة',
              'زرار Print Screen واختصارات التصوير بتتقفل',
              'مفيش نسخ ولا كليك يمين ولا حفظ ولا طباعة',
            ]}
          />
          <SwitchCard
            checked={values.watermark}
            onToggle={() => toggle('watermark')}
            disabled={save.isPending}
            title="علامة مائية على الفيديو واللايف"
            points={[
              'اسم الطالب ورقمه بيتحركوا على الفيديو طول الوقت',
              'لو حد سجّل الشاشة وسرّب الفيديو، هتعرف مين من التسجيل نفسه',
              'شغالة في الشاشة الكاملة كمان، على الموبايل والكمبيوتر',
            ]}
          />
        </div>
      )}

      <p className="max-w-3xl rounded-xl border border-amber-500/25 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <strong>معلومة مهمة:</strong> مفيش موقع يقدر يمنع تصوير الشاشة ١٠٠٪. الموبايل بيصوّر من
        أزرار الجهاز نفسه، وفيه برامج تسجيل بتشتغل من غير ما الصفحة تحس. عشان كده العلامة المائية هي
        أقوى حماية: بتخلي أي تسريب يبان صاحبه.
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}

function SwitchCard({
  checked,
  onToggle,
  disabled,
  title,
  points,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
  title: string;
  points: string[];
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-5 shadow-card transition-colors dark:bg-midnight-950/80',
        checked ? 'border-emerald-500/40' : 'border-gold-500/20',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
            {title}
          </h3>
          <p
            className={cn(
              'mt-0.5 text-xs font-black',
              checked
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-midnight-500 dark:text-ivory-300/60',
            )}
          >
            {checked ? 'شغّالة' : 'مقفولة'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={title}
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            'relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60',
            checked ? 'bg-emerald-600' : 'bg-midnight-200 dark:bg-white/15',
          )}
        >
          <span
            className={cn(
              'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[inset-inline-start]',
              checked ? 'start-7' : 'start-1',
            )}
          />
        </button>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-midnight-600 dark:text-ivory-300/75">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span aria-hidden className="text-gold-600">
              •
            </span>
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Certificate template
// ---------------------------------------------------------------------------

const SAMPLE = {
  serial: 'K7Q2-9XDM-4H',
  recipientName: 'سارة أحمد محمود',
  assessmentTitle: 'امتحان الوحدة الأولى',
  percentage: 95,
  issuedAt: new Date().toISOString(),
};

const PLACEHOLDERS = [
  { token: '{exam}', label: 'اسم الامتحان' },
  { token: '{score}', label: 'الدرجة' },
  { token: '{date}', label: 'التاريخ' },
];

function CertificateTemplateSection() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CertificateTemplate | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const template = useQuery({
    queryKey: ['admin-certificate-template'],
    queryFn: () => api.get<CertificateTemplate>('/admin/certificate-template'),
  });
  const values = draft ?? template.data;
  const save = useMutation({
    mutationFn: (next: CertificateTemplate) =>
      api.put<CertificateTemplate>('/admin/certificate-template', next),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin-certificate-template'], saved);
      setDraft(null);
      setMessage({ ok: true, text: 'اتحفظ. كل الشهادات، حتى القديمة، هتظهر بالشكل الجديد.' });
    },
    onError: (caught) =>
      setMessage({ ok: false, text: caught instanceof ApiError ? caught.message : 'تعذر الحفظ' }),
  });
  const set = <K extends keyof CertificateTemplate>(key: K, value: CertificateTemplate[K]) => {
    if (!values) return;
    setMessage(null);
    setDraft({ ...values, [key]: value });
  };

  const input = (key: keyof CertificateTemplate, label: string, max: number) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-midnight-800 dark:text-ivory-100">
        {label}
      </span>
      <input
        value={values?.[key] ?? ''}
        maxLength={max}
        onChange={(event) => set(key, event.target.value)}
        className="input-base"
      />
    </label>
  );

  return (
    <section aria-labelledby="certificate-title" className="space-y-4">
      <div>
        <h2
          id="certificate-title"
          className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
        >
          قالب الشهادة
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
          الشكل ده بيطلع لكل طالب ياخد شهادة. الشهادة نفسها بتتفعّل من كل امتحان في «الواجبات
          والامتحانات»، وهناك تحدد من كام في المية.
        </p>
      </div>

      {template.isLoading || !values ? (
        <div className="skeleton h-96 rounded-2xl" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <form
            className="space-y-4 rounded-2xl border border-gold-500/20 bg-white p-5 shadow-card dark:bg-midnight-950/80"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              save.mutate(values);
            }}
          >
            {input('title', 'عنوان الشهادة', 60)}
            {input('intro', 'السطر اللي قبل اسم الطالب', 120)}
            <label className="block">
              <span className="mb-1.5 block text-sm font-black text-midnight-800 dark:text-ivory-100">
                نص الشهادة
              </span>
              <textarea
                value={values.body}
                maxLength={300}
                rows={3}
                onChange={(event) => set('body', event.target.value)}
                className="input-base resize-y"
              />
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-midnight-500 dark:text-ivory-300/60">
                اضغط تضيف:
                {PLACEHOLDERS.map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => set('body', `${values.body} ${item.token}`.trim())}
                    className="rounded-full border border-gold-500/30 px-2 py-0.5 font-bold text-gold-800 hover:bg-gold-500/10 dark:text-gold-300"
                  >
                    {item.label}
                  </button>
                ))}
              </span>
            </label>
            {input('issuerName', 'اسم الجهة (المنصة)', 80)}
            <div className="grid grid-cols-2 gap-3">
              {input('signatureName', 'اسم الموقّع', 60)}
              {input('signatureTitle', 'صفته', 60)}
            </div>
            <Button
              type="submit"
              variant="accent"
              fullWidth
              isLoading={save.isPending}
              disabled={!draft}
            >
              حفظ القالب
            </Button>
            {message && (
              <p
                role="status"
                className={cn(
                  'text-sm font-semibold',
                  message.ok
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {message.text}
              </p>
            )}
          </form>

          <div className="space-y-2">
            <p className="text-xs font-black text-midnight-500 dark:text-ivory-300/60">
              معاينة ببيانات تجريبية
            </p>
            <CertificateSheet
              data={SAMPLE}
              template={values}
              verifyUrl="https://example.com/certificates/K7Q2-9XDM-4H"
              className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-gold-500/20"
            />
          </div>
        </div>
      )}
    </section>
  );
}
