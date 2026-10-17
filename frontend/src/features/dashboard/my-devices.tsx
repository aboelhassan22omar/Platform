'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { formatRelative, pluralizeAr } from '@/lib/utils';
import { EASE_ENTRANCE } from '@/lib/motion';
import type { DeviceList } from '@/types/api';

/** Read-only: the browsers this account is signed in from. Support removes old ones. */
export function MyDevices() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-devices'],
    queryFn: () => api.get<DeviceList>('/me/devices'),
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.45, ease: EASE_ENTRANCE }}
      className="rounded-2xl border border-ivory-300 bg-white p-6 shadow-card dark:border-midnight-700 dark:bg-midnight-900"
      aria-labelledby="devices-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="devices-heading"
          className="font-display text-base font-extrabold text-midnight-900 dark:text-ivory-50"
        >
          أجهزتي
        </h2>
        {data && data.limit > 0 && (
          <p className="text-xs font-bold text-midnight-500 dark:text-ivory-300/70">
            مستخدم {data.devices.length.toLocaleString('ar-EG')} من{' '}
            {pluralizeAr(data.limit, ['جهاز واحد', 'جهازين', 'أجهزة'])}
          </p>
        )}
      </div>
      <p className="mt-1 text-xs leading-5 text-midnight-500 dark:text-ivory-300/70">
        حسابك بيشتغل على الأجهزة دي بس. لو غيّرت موبايلك أو جهازك، كلّم الدعم يشيلوا القديم. مسح
        بيانات المتصفح بيخلّيه يتحسب جهاز جديد.
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          <div className="skeleton h-14 rounded-xl" />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {data?.devices.map((device) => (
            <li
              key={device.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-midnight-900 dark:text-ivory-100">
                  {device.label}
                </p>
                <p className="mt-0.5 text-xs text-midnight-500 dark:text-ivory-300/60">
                  آخر استخدام {formatRelative(device.lastSeenAt)}
                </p>
              </div>
              {device.isCurrent && (
                <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  الجهاز ده
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
