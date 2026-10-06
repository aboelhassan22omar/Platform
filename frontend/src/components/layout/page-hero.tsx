import Image from 'next/image';
import { Reveal } from '@/components/motion/reveal';
import { fadeUp } from '@/lib/motion';

/** Shared header for the simple informational pages. */
export function PageHero({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-midnight-950 to-midnight-900 py-14 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25 hidden md:block">
        <Image
          src="/images/teacher-modern-egypt.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-left"
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-l from-midnight-950/95 via-midnight-950/80 to-midnight-950/35"
      />
      <div className="texture-parchment pointer-events-none absolute inset-0" aria-hidden />

      <div className="container-page relative">
        <Reveal variants={fadeUp}>
          {eyebrow && (
            <span className="inline-block rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-bold text-gold-200">
              {eyebrow}
            </span>
          )}
          <h1 className="mt-4 font-display text-3xl font-black text-ivory-50 sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ivory-200/75">{subtitle}</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Prose container for legal and informational copy.
 * Arabic long-form needs a generous line height and a constrained measure.
 */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page py-12 sm:py-16">
      <div
        className="mx-auto max-w-3xl space-y-6 leading-loose text-midnight-700 dark:text-ivory-200/85
          [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-midnight-900 dark:[&_h2]:text-ivory-50
          [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-midnight-800 dark:[&_h3]:text-ivory-100
          [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pe-6
          [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pe-6
          [&_a]:font-semibold [&_a]:text-gold-700 dark:[&_a]:text-gold-400 [&_a]:underline"
      >
        {children}
      </div>
    </div>
  );
}
