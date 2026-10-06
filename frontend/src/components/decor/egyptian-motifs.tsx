'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { platformConfig } from '@/config/platform.config';

interface MotifBaseProps {
  className?: string;
  color?: string;
  glow?: boolean;
}

/**
 * قرص الشمس المجنح (حورس البحدتي)
 * رمز الحماية الملكية والرفعة المصرية القديمة
 */
export function WingedSunOfHorus({ className, glow = true }: MotifBaseProps) {
  return (
    <svg
      viewBox="0 0 400 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn(
        'w-full max-w-md overflow-visible',
        glow && 'drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]',
        className,
      )}
    >
      <defs>
        <linearGradient id="horusGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <radialGradient id="sunDiskGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
      </defs>

      {/* الجناح الأيمن (Right Wing) */}
      <motion.g
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <path
          d="M200 48 C 175 46, 110 32, 25 15 C 65 30, 115 45, 175 58 C 120 54, 70 42, 10 30 C 50 48, 110 65, 175 68 C 115 70, 70 66, 30 55 C 80 75, 140 82, 190 74 Z"
          fill="url(#horusGoldGrad)"
          opacity="0.88"
        />
        {/* ريش تفصيلي */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path
            key={`r-feather-${i}`}
            d={`M${185 - i * 22} ${50 + i * 3} Q${150 - i * 20} ${28 + i * 4} ${45 + i * 18} ${20 + i * 6}`}
            stroke="#fef08a"
            strokeWidth="0.8"
            strokeOpacity="0.6"
          />
        ))}
      </motion.g>

      {/* الجناح الأيسر (Left Wing) */}
      <motion.g
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <path
          d="M200 48 C 225 46, 290 32, 375 15 C 335 30, 285 45, 225 58 C 280 54, 330 42, 390 30 C 350 48, 290 65, 225 68 C 285 70, 330 66, 370 55 C 320 75, 260 82, 210 74 Z"
          fill="url(#horusGoldGrad)"
          opacity="0.88"
        />
        {/* ريش تفصيلي */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path
            key={`l-feather-${i}`}
            d={`M${215 + i * 22} ${50 + i * 3} Q${250 + i * 20} ${28 + i * 4} ${355 - i * 18} ${20 + i * 6}`}
            stroke="#fef08a"
            strokeWidth="0.8"
            strokeOpacity="0.6"
          />
        ))}
      </motion.g>

      {/* أفعى الكوبرا الملكية (Uraeus) يميناً ويساراً */}
      <path
        d="M185 48 C180 38, 172 35, 175 25 C178 18, 185 24, 182 32 C180 38, 186 42, 190 48"
        stroke="#fde047"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M215 48 C220 38, 228 35, 225 25 C222 18, 215 24, 218 32 C220 38, 214 42, 210 48"
        stroke="#fde047"
        strokeWidth="1.8"
        fill="none"
      />

      {/* قرص الشمس المركزي (The Sun Disk) */}
      <motion.circle
        cx="200"
        cy="48"
        r="18"
        fill="url(#sunDiskGlow)"
        initial={{ scale: 0.8 }}
        animate={{ scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <circle
        cx="200"
        cy="48"
        r="22"
        stroke="#fef08a"
        strokeWidth="1"
        strokeDasharray="3 2"
        opacity="0.75"
      />
    </svg>
  );
}

/**
 * الخرطوشة الملكية (Royal Cartouche)
 * الإطار البيضاوي المقدس الذي كان يحمل أسماء ملوك الفراعنة
 * مصمم ليتسع ديناميكياً لأي نص عربي دون أي خروج أو تداخل
 */
export function RoyalCartouche({
  children,
  className,
  title,
  variant = 'gold',
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  variant?: 'gold' | 'midnight';
}) {
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full',
        variant === 'gold'
          ? 'border-2 border-gold-400/90 bg-gradient-to-r from-[#030914]/95 via-[#081f33]/95 to-[#030914]/95 shadow-[0_0_24px_rgba(245,158,11,0.35)]'
          : 'border-2 border-gold-500/40 bg-midnight-950/80 shadow-md',
        'backdrop-blur-md px-6 sm:px-8 py-2 sm:py-2.5 my-1 text-center transition-all duration-300',
        'hover:border-gold-300 hover:shadow-[0_0_32px_rgba(245,158,11,0.5)]',
        className,
      )}
    >
      {/* عقدة الحبل الملكي على الطرف الأيمن */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
      >
        <span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-gold-300 via-gold-500 to-gold-700 shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
        <span className="absolute -left-0.5 h-3.5 w-1 rounded-sm bg-gold-200" />
      </div>

      {/* عقدة الحبل الملكي على الطرف الأيسر */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
      >
        <span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-gold-300 via-gold-500 to-gold-700 shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
        <span className="absolute -right-0.5 h-3.5 w-1 rounded-sm bg-gold-200" />
      </div>

      {/* حلقة داخلية منقوشة */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 sm:inset-1.5 rounded-full border border-dashed border-gold-400/40"
      />

      {/* محتوى النص الملكي */}
      <div className="relative z-10 max-w-full text-gold-300">
        {title && (
          <span className="block font-display text-sm sm:text-base md:text-lg font-black tracking-wide text-gradient-gold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {title}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * عين حورس (Eye of Horus / Wadjet)
 * رمز البصيرة والحكمة وسلامة المعرفة
 */
export function EyeOfHorus({ className, color = '#f59e0b' }: MotifBaseProps) {
  return (
    <svg
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('inline-block h-6 w-8 overflow-visible', className)}
    >
      <path
        d="M10 38 Q50 15 90 38 Q50 62 10 38 Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="rgba(245, 158, 11, 0.08)"
      />
      {/* بؤبؤ العين */}
      <circle cx="50" cy="38" r="9" fill={color} />
      <circle cx="53" cy="35" r="3" fill="#ffffff" opacity="0.8" />
      {/* خط الكحل العلوي (الحاجب) */}
      <path d="M15 22 Q50 8 85 20" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* امتداد دمعة الصقر السفلية */}
      <path d="M50 50 L50 72" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M62 48 C 65 60, 75 64, 82 58 C 88 52, 78 45, 72 45"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * مفتاح الحياة (Ankh)
 * رمز الحياة والخلود والمعرفة المستدامة
 */
export function AnkhLifeKey({ className, color = '#f59e0b' }: MotifBaseProps) {
  return (
    <svg
      viewBox="0 0 60 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('inline-block h-8 w-6 overflow-visible', className)}
    >
      {/* الحلقة العلوية البيضاوية */}
      <path
        d="M30 42 C16 42 16 10 30 10 C44 10 44 42 30 42 Z"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="rgba(245, 158, 11, 0.12)"
      />
      {/* العارضة الأفقية */}
      <path d="M10 46 L50 46" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
      {/* العمود الرأسي */}
      <path d="M30 46 L30 84" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
      {/* حليات صغيرة على أطراف العارضة */}
      <circle cx="10" cy="46" r="2.5" fill={color} />
      <circle cx="50" cy="46" r="2.5" fill={color} />
    </svg>
  );
}

/**
 * زهرة اللوتس المصرية (Sacred Egyptian Lotus)
 * رمز الإشراق والنهضة والتجدد
 */
export function LotusBlossom({ className, color = '#f59e0b' }: MotifBaseProps) {
  return (
    <svg
      viewBox="0 0 80 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('inline-block h-7 w-9 overflow-visible', className)}
    >
      {/* البتلة الوسطى */}
      <path d="M40 8 Q34 30 40 48 Q46 30 40 8 Z" fill={color} opacity="0.9" />
      {/* البتلات الجانبية */}
      <path d="M40 48 Q22 36 14 20 Q28 22 38 38 Z" fill={color} opacity="0.75" />
      <path d="M40 48 Q58 36 66 20 Q52 22 42 38 Z" fill={color} opacity="0.75" />
      {/* البتلات الخارجية الرقيقة */}
      <path d="M40 48 Q10 44 4 32 Q18 32 34 42 Z" fill={color} opacity="0.55" />
      <path d="M40 48 Q70 44 76 32 Q62 32 46 42 Z" fill={color} opacity="0.55" />
      {/* قاعدة الزهرة */}
      <path d="M30 52 C35 56 45 56 50 52" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * عمود الجد (Djed Pillar)
 * رمز الثبات والصلابة والاستمرارية
 */
export function DjedPillar({ className, color = '#f59e0b' }: MotifBaseProps) {
  return (
    <svg
      viewBox="0 0 50 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('inline-block h-8 w-5 overflow-visible', className)}
    >
      {/* العوارض الأربعة في القمة */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={10 - (3 - i) * 1.5}
          y={14 + i * 8}
          width={30 + (3 - i) * 3}
          height={4.5}
          rx={2}
          fill={color}
          opacity={0.9}
        />
      ))}
      {/* العمود المركزي */}
      <rect x="21" y="44" width="8" height="32" rx="1.5" fill={color} opacity="0.85" />
      {/* القاعدة */}
      <rect x="14" y="74" width="22" height="4" rx="1" fill={color} />
    </svg>
  );
}

/**
 * إفريز ونقوش هيروغليفية زخرفية للأشرطة والفواصل
 */
export function HieroglyphRegister({
  className,
  orientation = 'horizontal',
}: {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const glyphs = ['𓀀', '𓁐', '𓂀', '𓃭', '𓄿', '𓆣', '𓇋', '𓈖', '𓉐', '𓊪', '𓋹', '𓌃', '𓍯', '𓎛'];

  if (orientation === 'vertical') {
    return null;
  }

  return (
    <div
      aria-hidden
      className={cn(
        'flex items-center justify-between gap-6 overflow-hidden select-none opacity-25 text-gold-400 font-serif text-sm pointer-events-none py-1',
        className,
      )}
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/40 to-gold-500/80" />
      <div className="flex items-center gap-4 shrink-0">
        {glyphs.map((g, i) => (
          <span
            key={i}
            className="inline-block transform hover:scale-125 transition-transform duration-300"
          >
            {g}
          </span>
        ))}
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/40 to-gold-500/80" />
    </div>
  );
}

/**
 * زوايا الصرح الفرعوني الملكي (تم إزالتها استجابة لطلب المستخدم لإزالة الخطوط الطولية)
 */
export function TempleCornerBrackets(_props: { className?: string }) {
  return null;
}

/**
 * زوايا الصرح والزخارف الهيروغليفية (تم إزالتها استجابة لطلب المستخدم)
 */
export function HieroglyphCorner(_props: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}) {
  return null;
}

/**
 * شعار المنصة الرسمي القابل لإعادة الضبط من إعدادات الهوية.
 * عين حورس حديثة تجمع بين شمس المعرفة ومسار التاريخ.
 */
export function PlatformLogo({
  variant = 'full',
  size = 'md',
  className,
}: {
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10 sm:h-11 sm:w-11',
    lg: 'h-14 w-14 sm:h-16 sm:w-16',
  }[size];

  return (
    <div className={cn('inline-flex items-center gap-3 select-none', className)}>
      <span
        className={cn(
          'relative block shrink-0 overflow-visible transition-transform duration-300 group-hover:scale-105',
          sizeClasses,
        )}
      >
        <img
          src={platformConfig.brand.logoLight}
          alt={variant === 'mark' ? platformConfig.brand.logoAlt : ''}
          width={1006}
          height={618}
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 block h-auto w-[155%] max-w-none -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_7px_rgba(200,149,42,0.3)] dark:hidden"
        />
        <img
          src={platformConfig.brand.logoDark}
          alt=""
          width={1006}
          height={618}
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 hidden h-auto w-[155%] max-w-none -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_7px_rgba(200,149,42,0.3)] dark:block"
        />
      </span>

      {/* كتابة الاسم للنسخة الكاملة */}
      {variant === 'full' && (
        <div className="flex flex-col text-start">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm sm:text-base font-extrabold text-midnight-950 dark:text-ivory-50 tracking-tight transition-colors group-hover:text-gold-700 dark:group-hover:text-gold-300">
              {platformConfig.teacher.displayName}
            </span>
            <span className="rounded-full bg-gold-400/15 border border-gold-400/30 px-1.5 py-0.2 text-[9px] font-black text-gold-300">
              {platformConfig.teacher.tagline}
            </span>
          </div>
          <span className="text-[10px] text-gold-400/80 font-bold tracking-wider">
            {platformConfig.brand.platformName}
          </span>
        </div>
      )}
    </div>
  );
}
