'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { AchievementBadge, AchievementsResponse } from '@/types/api';

const GROUPS: Array<{ key: AchievementBadge['category']; label: string }> = [
  { key: 'ranking', label: 'كؤوس الترتيب' }, { key: 'videos', label: 'رحلة الفيديوهات' },
  { key: 'homework', label: 'تحديات الواجبات' }, { key: 'exams', label: 'بطولات الامتحانات' },
  { key: 'points', label: 'مراحل النقاط' }, { key: 'completion', label: 'إكمال المنهج' },
  { key: 'units', label: 'كنوز الوحدات' }, { key: 'special', label: 'شارات خاصة' },
];

export function AchievementsLibrary() {
  const [selected, setSelected] = useState<AchievementBadge | null>(null);
  const achievements = useQuery({ queryKey: ['achievements'], queryFn: () => api.get<AchievementsResponse>('/me/achievements') });

  if (achievements.isLoading) return <section className="skeleton h-96 rounded-2xl" aria-label="جاري تحميل مكتبة الشارات" />;
  if (achievements.isError || !achievements.data) return <section role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 font-bold text-red-700 dark:text-red-300">تعذر تحميل الشارات حاليًا.</section>;
  const data = achievements.data;

  return <section className="overflow-hidden rounded-2xl border border-gold-500/25 bg-white shadow-card dark:bg-midnight-900" aria-labelledby="achievements-heading">
    <div className="relative overflow-hidden border-b border-gold-500/20 bg-gradient-to-l from-gold-500/20 via-gold-500/5 to-transparent p-6">
      <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs font-black text-gold-700 dark:text-gold-300">لقبك الحالي</p><h2 id="achievements-heading" className="mt-1 font-display text-3xl font-black">{data.title.name}</h2><p className="mt-2 text-sm text-midnight-600 dark:text-ivory-300/70">أنجزت {formatNumber(data.completionPercent)}% من محتوى {data.gradeName}</p><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-midnight-950/10 dark:bg-white/10"><span className="block h-full rounded-full bg-gold-500 transition-[width]" style={{ width: `${data.completionPercent}%` }} /></div>{data.title.nextAt && <p className="mt-2 text-xs text-midnight-500 dark:text-ivory-300/60">اللقب التالي عند {formatNumber(data.title.nextAt)}%</p>}</div><div className="grid h-24 w-24 place-items-center rounded-full border-4 border-gold-400/60 bg-midnight-950 text-gold-300 shadow-lg"><BadgeIcon icon="crown" /></div></div>
    </div>
    <div className="p-6"><div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-display text-xl font-black">مكتبة شاراتك</h3><p className="mt-1 text-sm text-midnight-500 dark:text-ivory-300/65">اضغط على أي شارة لمعرفة شروطها وتقدمك.</p></div><p className="text-sm font-black text-gold-700 dark:text-gold-300">{formatNumber(data.earnedCount)} من {formatNumber(data.totalCount)}</p></div>
      <div className="mt-6 space-y-7">{GROUPS.map((group) => { const badges = data.badges.filter((badge) => badge.category === group.key); if (!badges.length) return null; return <section key={group.key} aria-labelledby={`badge-group-${group.key}`}><h4 id={`badge-group-${group.key}`} className="mb-3 font-display text-base font-black text-midnight-800 dark:text-ivory-100">{group.label}</h4><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{badges.map((badge) => <button key={badge.id} type="button" onClick={() => setSelected(badge)} aria-label={`${badge.name}: ${badge.earned ? 'مكتسبة' : 'غير مكتسبة'}`} className={cn('group min-h-44 rounded-2xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500', badge.earned ? 'border-gold-500/35 bg-gold-500/8 hover:bg-gold-500/15' : 'border-midnight-200 bg-midnight-50 hover:border-gold-500/30 dark:border-white/10 dark:bg-midnight-950/70')}><span className={cn('mx-auto grid h-20 w-20 place-items-center rounded-full border-2 transition-transform group-hover:scale-105', badge.earned ? 'border-gold-400 bg-gradient-to-br from-gold-300 to-gold-600 text-midnight-950 shadow-[0_0_22px_rgba(216,163,40,.25)]' : 'border-midnight-300 bg-midnight-100 text-midnight-400 grayscale dark:border-white/15 dark:bg-white/5 dark:text-ivory-300/30')}><BadgeIcon icon={badge.icon} /></span><span className="mt-3 block text-sm font-black">{badge.name}</span><span className={cn('mt-1 block text-xs font-bold', badge.earned ? 'text-emerald-700 dark:text-emerald-300' : 'text-midnight-400 dark:text-ivory-300/45')}>{badge.earned ? 'تم تحقيقها' : `${formatNumber(badge.progress)}%`}</span></button>)}</div></section>; })}</div>
    </div>
    {selected && <div className="fixed inset-0 z-[100] grid place-items-center bg-midnight-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="badge-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><div className="w-full max-w-md rounded-3xl border border-gold-500/30 bg-white p-6 shadow-2xl dark:bg-midnight-900"><div className={cn('mx-auto grid h-28 w-28 place-items-center rounded-full border-4', selected.earned ? 'border-gold-400 bg-gradient-to-br from-gold-300 to-gold-600 text-midnight-950' : 'border-midnight-300 bg-midnight-100 text-midnight-400 grayscale dark:border-white/15 dark:bg-white/5')}><BadgeIcon icon={selected.icon} large /></div><h3 id="badge-dialog-title" className="mt-4 text-center font-display text-2xl font-black">{selected.name}</h3><p className="mt-3 text-center text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">{selected.requirement}</p><div className="mt-5"><div className="flex justify-between text-xs font-bold"><span>تقدمك</span><span>{formatNumber(selected.progress)}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-midnight-100 dark:bg-white/10"><span className="block h-full rounded-full bg-gold-500" style={{ width: `${selected.progress}%` }} /></div></div><button type="button" autoFocus onClick={() => setSelected(null)} className="mt-6 min-h-12 w-full rounded-xl bg-gold-500 px-5 font-black text-midnight-950 hover:bg-gold-400">حسنًا</button></div></div>}
  </section>;
}

function BadgeIcon({ icon, large = false }: { icon: AchievementBadge['icon']; large?: boolean }) {
  const size = large ? 64 : 46;
  const common = { width: size, height: size, viewBox: '0 0 64 64', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (icon === 'eye') return <svg {...common}><path d="M5 32s10-16 27-16 27 16 27 16-10 16-27 16S5 32 5 32Z"/><circle cx="32" cy="32" r="8"/><path d="M32 24V10M32 54V40"/></svg>;
  if (icon === 'ankh') return <svg {...common}><ellipse cx="32" cy="17" rx="10" ry="12"/><path d="M32 29v27M18 38h28"/></svg>;
  if (icon === 'scarab') return <svg {...common}><ellipse cx="32" cy="34" rx="13" ry="17"/><path d="M32 17v34M19 29 8 20M45 29l11-9M19 39 7 47M45 39l12 8M25 17l-6-8M39 17l6-8"/></svg>;
  if (icon === 'pyramid') return <svg {...common}><path d="m32 7 26 48H6L32 7Z"/><path d="m32 7 8 48M6 55l34-16 18 16"/></svg>;
  if (icon === 'lotus') return <svg {...common}><path d="M32 49c-13-7-18-17-17-29 9 2 15 7 17 16 2-9 8-14 17-16 1 12-4 22-17 29Z"/><path d="M32 49C21 46 12 42 6 34c10-2 18 0 26 8 8-8 16-10 26-8-6 8-15 12-26 15ZM18 56h28"/></svg>;
  if (icon === 'scroll') return <svg {...common}><path d="M18 10h30v38a8 8 0 0 1-8 8H16a7 7 0 0 1 0-14h24V16H18a6 6 0 0 1 0-12h30"/><path d="M22 26h12M22 34h12"/></svg>;
  if (icon === 'star') return <svg {...common}><path d="m32 7 7.5 15.5L57 25l-12.5 12 3 17L32 46l-15.5 8 3-17L7 25l17.5-2.5L32 7Z"/></svg>;
  if (icon === 'crown') return <svg {...common}><path d="m8 18 12 12 12-20 12 20 12-12-5 32H13L8 18Z"/><path d="M14 50h36"/></svg>;
  if (icon === 'medal') return <svg {...common}><path d="M19 6h12l7 19M45 6H33l-7 19"/><circle cx="32" cy="39" r="16"/><path d="m32 29 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/></svg>;
  if (icon === 'play') return <svg {...common}><circle cx="32" cy="32" r="25"/><path d="m27 20 17 12-17 12V20Z"/></svg>;
  if (icon === 'book') return <svg {...common}><path d="M8 12h17c5 0 7 3 7 7v35c0-5-3-8-8-8H8V12ZM56 12H39c-5 0-7 3-7 7v35c0-5 3-8 8-8h16V12Z"/></svg>;
  if (icon === 'compass') return <svg {...common}><circle cx="32" cy="32" r="25"/><path d="m42 20-6 16-16 6 6-16 16-6Z"/><circle cx="32" cy="32" r="3"/></svg>;
  if (icon === 'shield') return <svg {...common}><path d="M32 6 54 14v16c0 14-9 23-22 28C19 53 10 44 10 30V14L32 6Z"/><path d="m21 32 7 7 15-17"/></svg>;
  if (icon === 'lightning') return <svg {...common}><path d="M36 5 13 36h16l-2 23 24-34H35l1-20Z"/></svg>;
  if (icon === 'diamond') return <svg {...common}><path d="m12 22 10-13h20l10 13-20 34L12 22Z"/><path d="M12 22h40M22 9l10 13L42 9M22 22l10 34 10-34"/></svg>;
  if (icon === 'sword') return <svg {...common}><path d="m48 7 9 9-31 31-9-9L48 7Z"/><path d="m14 34 16 16M11 45l8 8M8 56l7-7"/></svg>;
  if (icon === 'brain') return <svg {...common}><path d="M27 12a9 9 0 0 0-16 6 9 9 0 0 0 0 16 9 9 0 0 0 8 14c2 6 8 9 13 5V15c0-6-5-9-5-3ZM37 12a9 9 0 0 1 16 6 9 9 0 0 1 0 16 9 9 0 0 1-8 14c-2 6-8 9-13 5V15c0-6 5-9 5-3Z"/><path d="M18 25c6-1 9 3 9 8M46 25c-6-1-9 3-9 8M20 42c4-3 8-2 12 2M44 42c-4-3-8-2-12 2"/></svg>;
  return <svg {...common}><path d="M18 8h28v12c0 11-6 18-14 18S18 31 18 20V8Z"/><path d="M18 14H8v5c0 8 5 13 13 13M46 14h10v5c0 8-5 13-13 13M32 38v10M22 56h20M26 48h12"/></svg>;
}
