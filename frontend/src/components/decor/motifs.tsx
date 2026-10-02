'use client';

import { motion } from 'motion/react';
import type { MotifKey } from '@/themes/registry';

/**
 * Decorative hero motifs — one per academic identity.
 *
 * All five are hand-drawn inline SVG rather than images, which means:
 *   - no extra network request and nothing to block first paint
 *   - they take their colour from the grade's accent token
 *   - they scale to any viewport without a second asset
 *
 * They are original geometric abstractions evoking each era, NOT reproductions
 * of any existing artwork or of the teacher's promotional material.
 *
 * Every one is aria-hidden: they carry no information a screen reader needs.
 * Animation is transform/opacity only, so they stay on the compositor.
 */

interface MotifProps {
  accent: string;
  secondary: string;
  className?: string;
}

/** أولى ثانوي — colonnade of temple columns with abstract glyph bands. */
function HieroglyphColumns({ accent, secondary, className }: MotifProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      aria-hidden
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Column shaft */}
          <rect
            x={40 + i * 70}
            y={70}
            width={30}
            height={200}
            rx={3}
            fill={accent}
            opacity={0.14}
          />
          {/* Lotus capital */}
          <path
            d={`M${34 + i * 70} 70 Q${55 + i * 70} 48 ${76 + i * 70} 70 Z`}
            fill={accent}
            opacity={0.22}
          />
          {/* Glyph register bands */}
          {[0, 1, 2, 3].map((b) => (
            <rect
              key={b}
              x={45 + i * 70}
              y={95 + b * 45}
              width={20}
              height={6}
              rx={2}
              fill={secondary}
              opacity={0.3}
            />
          ))}
        </motion.g>
      ))}
      {/* Horizontal architrave */}
      <motion.rect
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.1, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: 'right center' }}
        x={20}
        y={52}
        width={360}
        height={8}
        rx={3}
        fill={accent}
        opacity={0.2}
      />
    </svg>
  );
}

/** تانية ثانوي — compass rose over latitude/longitude graticule. */
function CompassAtlas({ accent, secondary, className }: MotifProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" aria-hidden className={className}>
      {/* Graticule */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={30 + i * 48}
          x2={400}
          y2={30 + i * 48}
          stroke={secondary}
          strokeWidth={0.6}
          opacity={0.18}
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={`v${i}`}
          x1={i * 55}
          y1={0}
          x2={i * 55}
          y2={300}
          stroke={secondary}
          strokeWidth={0.6}
          opacity={0.18}
        />
      ))}

      {/* Compass rose, rotating very slowly */}
      <motion.g
        style={{ transformOrigin: '200px 150px' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 160, repeat: Infinity, ease: 'linear' }}
      >
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <path
            key={angle}
            d="M200 150 L200 62 L208 150 Z"
            fill={accent}
            opacity={i % 2 === 0 ? 0.3 : 0.16}
            transform={`rotate(${angle} 200 150)`}
          />
        ))}
      </motion.g>

      <motion.circle
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        cx={200}
        cy={150}
        r={92}
        stroke={accent}
        strokeWidth={1.2}
        opacity={0.3}
        fill="none"
      />
      <circle cx={200} cy={150} r={60} stroke={accent} strokeWidth={0.8} opacity={0.2} fill="none" />
      <circle cx={200} cy={150} r={7} fill={accent} opacity={0.5} />
    </svg>
  );
}

/** تالتة ثانوي — stacked archival documents. Calm, dense, exam-focused. */
function ArchiveStack({ accent, secondary, className }: MotifProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" aria-hidden className={className}>
      {[0, 1, 2, 3].map((i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 24, rotate: -2 + i }}
          animate={{ opacity: 1, y: 0, rotate: -3 + i * 2 }}
          transition={{ delay: 0.2 + i * 0.12, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: '200px 150px' }}
        >
          <rect
            x={110 + i * 6}
            y={60 + i * 14}
            width={180}
            height={190}
            rx={4}
            fill={i === 3 ? accent : secondary}
            opacity={i === 3 ? 0.16 : 0.1}
            stroke={accent}
            strokeWidth={0.8}
            strokeOpacity={0.25}
          />
        </motion.g>
      ))}

      {/* Text ruling on the topmost sheet */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <motion.rect
          key={i}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: 'right center' }}
          x={148}
          y={130 + i * 18}
          width={i % 3 === 2 ? 80 : 128}
          height={4}
          rx={2}
          fill={accent}
          opacity={0.28}
        />
      ))}

      {/* Wax seal */}
      <motion.circle
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 220, damping: 16 }}
        cx={270}
        cy={228}
        r={17}
        fill={accent}
        opacity={0.4}
      />
    </svg>
  );
}

/** أولى بكالوريا — papyrus fibre grid with analytical node overlay. */
function PapyrusGrid({ accent, secondary, className }: MotifProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" aria-hidden className={className}>
      {/* Woven fibres */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect
          key={`h${i}`}
          x={20}
          y={20 + i * 19}
          width={360}
          height={9}
          rx={2}
          fill={secondary}
          opacity={0.07}
        />
      ))}
      {Array.from({ length: 16 }).map((_, i) => (
        <rect
          key={`v${i}`}
          x={20 + i * 23}
          y={20}
          width={9}
          height={260}
          rx={2}
          fill={accent}
          opacity={0.06}
        />
      ))}

      {/* Analytical nodes + connections — the "التفكير التاريخي" framing. */}
      {[
        [90, 90],
        [200, 60],
        [300, 110],
        [150, 180],
        [270, 220],
      ].map(([cx, cy], i) => (
        <motion.circle
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.12, type: 'spring', stiffness: 200, damping: 18 }}
          cx={cx}
          cy={cy}
          r={8}
          fill={accent}
          opacity={0.55}
        />
      ))}
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        d="M90 90 L200 60 L300 110 L270 220 L150 180 Z"
        stroke={accent}
        strokeWidth={1.4}
        opacity={0.35}
        fill="none"
      />
    </svg>
  );
}

/** تانية بكالوريا — rising banners for the revolution chronicle. */
function BannerWaves({ accent, secondary, className }: MotifProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" aria-hidden className={className}>
      {[0, 1, 2, 3].map((i) => (
        <motion.path
          key={i}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.13, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          d={`M0 ${140 + i * 34} Q100 ${112 + i * 34} 200 ${140 + i * 34} T400 ${140 + i * 34} L400 300 L0 300 Z`}
          fill={i % 2 === 0 ? accent : secondary}
          opacity={0.1 + i * 0.03}
        />
      ))}

      {/* Banner poles */}
      {[70, 150, 230, 310].map((x, i) => (
        <motion.g
          key={x}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.5 + i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${x}px 160px` }}
        >
          <rect x={x} y={54} width={2.5} height={106} fill={accent} opacity={0.4} />
          <path
            d={`M${x + 2} 58 L${x + 42} 70 L${x + 2} 82 Z`}
            fill={accent}
            opacity={0.3}
          />
        </motion.g>
      ))}

      {/* Sunburst */}
      <motion.circle
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.22 }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
        cx={200}
        cy={46}
        r={30}
        fill={secondary}
      />
    </svg>
  );
}

const MOTIFS: Record<MotifKey, (props: MotifProps) => React.ReactElement> = {
  'hieroglyph-columns': HieroglyphColumns,
  'compass-atlas': CompassAtlas,
  'archive-stack': ArchiveStack,
  'papyrus-grid': PapyrusGrid,
  'banner-waves': BannerWaves,
};

export function HeroMotif({
  motif,
  accent,
  secondary,
  className,
}: { motif: MotifKey } & MotifProps) {
  const Component = MOTIFS[motif] ?? HieroglyphColumns;
  return <Component accent={accent} secondary={secondary} className={className} />;
}
