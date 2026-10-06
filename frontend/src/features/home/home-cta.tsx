'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { ButtonLink } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { EASE_ENTRANCE } from '@/lib/motion';
import {
  WingedSunOfHorus,
  RoyalCartouche,
  TempleCornerBrackets,
  HieroglyphRegister,
} from '@/components/decor/egyptian-motifs';
import { platformConfig } from '@/config/platform.config';

export function HomeCta() {
  const { user } = useAuth();
  const content = user?.isStaff
    ? {
        title: 'صرح الإدارة: إدارة مسيرة الأجيال',
        body: 'تابع سير العملية التعليمية، والطلاب، والمحتوى، والأسعار من لوحة التحكم الملكية.',
        href: '/admin',
        action: 'افتح لوحة الإدارة',
      }
    : user
      ? {
          title: `كمّل رحلة ${platformConfig.subject.name}`,
          body: 'حصصك تنتظرك؛ استأنف من اللحظة التي توقفت عندها في منهجك واستكشف نواتج التعلم الجديدة.',
          href: '/dashboard/lessons',
          action: 'ادخل لحصصك الآن',
        }
      : {
          title: `ابدأ رحلتك في ${platformConfig.subject.name}`,
          body: `سجل حسابك في دقيقة واحدة، اختر صفك الدراسي، وابدأ فوراً بالحصص المجانية لتجرب طريقة فهم ${platformConfig.subject.name}.`,
          href: '/register',
          action: 'ابدأ رحلتك الملكية مجاناً',
        };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#eee2c6] via-[#f7f2e4] to-[#fbf8f0] dark:bg-[#06121e] py-20 sm:py-28 text-midnight-950 dark:text-ivory-50 transition-colors duration-300">
      <div
        className="texture-parchment pointer-events-none absolute inset-0 opacity-20"
        aria-hidden
      />

      {/* هالة إضاءة ذهبية ناعمة */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 inset-x-0 h-64 opacity-25 dark:opacity-15"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgb(245 158 11 / 0.35), transparent 75%)',
        }}
      />

      <div className="container-page relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 0.7, ease: EASE_ENTRANCE }}
          className="relative overflow-hidden rounded-3xl border-2 border-gold-400/50 bg-white/95 dark:bg-gradient-to-b dark:from-midnight-950 dark:via-[#071929] dark:to-midnight-950 px-6 py-14 text-center sm:px-14 sm:py-20 shadow-[0_0_50px_rgba(245,158,11,0.2)] dark:shadow-[0_0_50px_rgba(245,158,11,0.25)]"
        >
          <TempleCornerBrackets />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply dark:mix-blend-screen"
          >
            <Image
              src="/images/revolution-era-mural.png"
              alt=""
              fill
              sizes="(min-width: 1280px) 1216px, calc(100vw - 32px)"
              className="object-cover object-center"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-white/95 dark:from-midnight-950 via-white/80 dark:via-midnight-950/70 to-white/95 dark:to-midnight-950" />

          <div className="relative z-10 mx-auto max-w-2xl flex flex-col items-center">
            <WingedSunOfHorus className="h-10 sm:h-12 mb-4 opacity-90" />

            <RoyalCartouche title={platformConfig.brand.platformName} />

            <h2 className="mt-5 font-display text-3xl sm:text-4xl lg:text-5xl font-black text-midnight-950 dark:text-ivory-50 leading-tight">
              {content.title}
            </h2>

            <p className="mt-4 text-base sm:text-lg leading-relaxed text-midnight-800/85 dark:text-ivory-200/85 max-w-xl">
              {content.body}
            </p>

            <div className="w-full my-6">
              <HieroglyphRegister />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              <ButtonLink
                href={content.href}
                variant="accent"
                size="lg"
                className="w-full sm:w-auto px-10 py-4 font-black text-base shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:shadow-[0_0_40px_rgba(245,158,11,0.8)]"
              >
                <span className="flex items-center gap-2">
                  <span>{content.action}</span>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path
                      d="M11 4l-5 5 5 5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </ButtonLink>

              <ButtonLink
                href="/grades"
                size="lg"
                className="w-full sm:w-auto border border-gold-400/50 bg-gold-500/10 dark:bg-midnight-950/70 text-amber-800 dark:text-gold-200 hover:bg-gold-500/20 hover:border-gold-400 backdrop-blur-sm"
              >
                تصفح كل الصفوف الدراسية
              </ButtonLink>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
