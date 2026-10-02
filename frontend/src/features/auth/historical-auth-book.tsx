'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { EducationSystem, GradeLevel } from '@/types/api';

export type BookPhase = 'closed' | 'opening' | 'ready' | 'flipping' | 'entering';

export interface AuthBookContextValue {
  isReady: boolean;
  isPageTurning: boolean;
  isVortexing: boolean;
  currentMode: 'login' | 'register';
  registerStep: 'grade' | 'fields';
  setRegisterStep: (step: 'grade' | 'fields') => void;
  selectedSystem: EducationSystem | null;
  selectedGrade: GradeLevel | null;
  setSystemAndGrade: (system: EducationSystem, grade: GradeLevel) => void;
  turnPage: (href: '/login' | '/register') => Promise<void>;
  triggerVortex: () => Promise<void>;
  skipAnimation: () => void;
}

const AuthBookContext = createContext<AuthBookContextValue>({
  isReady: false,
  isPageTurning: false,
  isVortexing: false,
  currentMode: 'login',
  registerStep: 'fields',
  setRegisterStep: () => undefined,
  selectedSystem: null,
  selectedGrade: null,
  setSystemAndGrade: () => undefined,
  turnPage: async () => undefined,
  triggerVortex: async () => undefined,
  skipAnimation: () => undefined,
});

export function useAuthBook() {
  return useContext(AuthBookContext);
}

const OPENING_START_MS = 600;
const OPENING_FINISH_MS = 2200;
const PAGE_TURN_DURATION_MS = 900;
const VORTEX_DURATION_MS = 1600;
const BOOK_SESSION_KEY = 'historical-auth-book-session';

/**
 * 3D Golden Egyptian Time Portal / Vortex
 * Expands dynamically from the book's historic Cairo engraving when authentication succeeds.
 */
function TimeVortexPortal() {
  return (
    <motion.div
      className="book-3d-vortex-portal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      aria-hidden
    >
      <motion.div
        className="book-3d-vortex-portal__shade"
        animate={{ opacity: [0, 0.3, 0.95] }}
        transition={{ duration: 1.5, times: [0, 0.4, 1] }}
      />
      <motion.div
        className="book-3d-vortex-portal__halo"
        animate={{ scale: [0.1, 1.2, 4.2], opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.45, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.div
        className="book-3d-vortex-portal__ring"
        animate={{ rotate: 360, scale: [0.2, 1.4, 0.05], opacity: [0, 1, 0] }}
        transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
      />
      {Array.from({ length: 12 }).map((_, index) => (
        <motion.span
          key={index}
          className="book-3d-vortex-portal__ray"
          style={{ rotate: `${index * 30}deg` }}
          animate={{ scaleY: [0.1, 1.5, 0], opacity: [0, 0.85, 0] }}
          transition={{ duration: 1.2, delay: index * 0.02, ease: 'easeIn' }}
        />
      ))}
      <motion.div
        className="book-3d-vortex-portal__core"
        animate={{ scale: [0, 1.2, 0.05], opacity: [0, 1, 1] }}
        transition={{ duration: 1.45, times: [0, 0.45, 1], ease: [0.65, 0, 0.35, 1] }}
      />
    </motion.div>
  );
}

export function HistoricalAuthBook({
  children,
  wide = false,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const currentMode: 'login' | 'register' = pathname === '/register' ? 'register' : 'login';

  const [phase, setPhase] = useState<BookPhase>(reduceMotion ? 'ready' : 'closed');
  const [registerStep, setRegisterStep] = useState<'grade' | 'fields'>('fields');
  const [selectedSystem, setSelectedSystem] = useState<EducationSystem | null>('GENERAL');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>('SEC_3');

  // 3D Mouse Parallax Tilt
  const [tilt, setTilt] = useState({ rotX: 0, rotY: 0 });
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  // Check if book was already opened in this tab session
  useEffect(() => {
    if (reduceMotion) {
      setPhase('ready');
      return;
    }

    const wasOpened = typeof window !== 'undefined' && sessionStorage.getItem(BOOK_SESSION_KEY) === 'opened';
    if (wasOpened) {
      setPhase('ready');
      return;
    }

    // Play Initial Opening Sequence
    setPhase('closed');
    timers.current.push(
      window.setTimeout(() => setPhase('opening'), OPENING_START_MS),
      window.setTimeout(() => {
        setPhase('ready');
        sessionStorage.setItem(BOOK_SESSION_KEY, 'opened');
      }, OPENING_FINISH_MS),
    );

    return clearTimers;
  }, [clearTimers, reduceMotion]);

  // Handle 3D Mouse Parallax
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== 'ready') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    // Smooth subtle tilt
    setTilt({
      rotX: -y * 12, // max 6 deg
      rotY: x * 16,  // max 8 deg
    });
  }, [phase]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotX: 0, rotY: 0 });
  }, []);

  const skipAnimation = useCallback(() => {
    clearTimers();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(BOOK_SESSION_KEY, 'opened');
    }
    setPhase('ready');
  }, [clearTimers]);

  // 3D Page Flip between Login and Register
  const turnPage = useCallback(
    async (href: '/login' | '/register') => {
      if (href === pathname || phase === 'flipping' || phase === 'entering') return;

      if (reduceMotion) {
        router.push(href);
        return;
      }

      clearTimers();
      setPhase('flipping');

      // Slight camera reaction during page turn
      setTilt({ rotX: 3, rotY: href === '/register' ? -8 : 8 });

      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, PAGE_TURN_DURATION_MS),
      );

      setTilt({ rotX: 0, rotY: 0 });
      setPhase('ready');
      router.push(href);
    },
    [clearTimers, pathname, phase, reduceMotion, router],
  );

  // Time Vortex on Authentication
  const triggerVortex = useCallback(async () => {
    if (reduceMotion) {
      setPhase('entering');
      await new Promise<void>((r) => window.setTimeout(r, 100));
      return;
    }

    clearTimers();
    setPhase('entering');
    await new Promise<void>((r) => window.setTimeout(r, VORTEX_DURATION_MS));
  }, [clearTimers, reduceMotion]);

  const setSystemAndGrade = useCallback((system: EducationSystem, grade: GradeLevel) => {
    setSelectedSystem(system);
    setSelectedGrade(grade);
  }, []);

  const isPageTurning = phase === 'flipping';
  const isVortexing = phase === 'entering';
  const isReady = phase === 'ready';

  const contextValue = useMemo<AuthBookContextValue>(
    () => ({
      isReady,
      isPageTurning,
      isVortexing,
      currentMode,
      registerStep,
      setRegisterStep,
      selectedSystem,
      selectedGrade,
      setSystemAndGrade,
      turnPage,
      triggerVortex,
      skipAnimation,
    }),
    [
      isReady,
      isPageTurning,
      isVortexing,
      currentMode,
      registerStep,
      selectedSystem,
      selectedGrade,
      setSystemAndGrade,
      turnPage,
      triggerVortex,
      skipAnimation,
    ],
  );

  return (
    <AuthBookContext.Provider value={contextValue}>
      <div
        className={cn('book-3d-stage', wide && 'book-3d-stage--wide')}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-busy={!isReady && !isVortexing}
      >
        {/* 3D Transform Wrapper with Parallax & Vortex Zoom */}
        <motion.div
          className="book-3d-wrapper"
          animate={
            isVortexing
              ? {
                  scale: 3.6,
                  x: '22%',
                  y: '5%',
                  rotateX: 18,
                  rotateY: -4,
                  filter: 'blur(3px) brightness(1.7)',
                }
              : phase === 'closed'
                ? {
                    scale: 0.95,
                    rotateX: 10,
                    rotateY: -3,
                    y: 15,
                    filter: 'blur(0px) brightness(1)',
                  }
                : phase === 'opening'
                  ? {
                      scale: 1,
                      rotateX: 4,
                      rotateY: 0,
                      y: 0,
                      filter: 'blur(0px) brightness(1)',
                    }
                  : {
                      scale: 1,
                      rotateX: tilt.rotX,
                      rotateY: tilt.rotY,
                      x: 0,
                      y: 0,
                      filter: 'blur(0px) brightness(1)',
                    }
          }
          transition={
            isVortexing
              ? { duration: 1.5, ease: [0.65, 0, 0.35, 1] }
              : phase === 'closed' || phase === 'opening'
                ? { duration: 1.2, ease: [0.16, 1, 0.3, 1] }
                : { duration: 0.2, ease: 'easeOut' }
          }
        >
          {/* Ground Drop Shadow */}
          <div
            className="book-3d-ground-shadow"
            style={{
              transform: `translateZ(-60px) rotateX(90deg) scale(${phase === 'closed' ? 0.88 : 1})`,
            }}
            aria-hidden
          />

          {/* 1. Closed Book Cover */}
          <motion.div
            className="book-3d-layer book-3d-layer--closed"
            animate={{
              opacity: phase === 'closed' ? 1 : 0,
              scale: phase === 'closed' ? 1 : 1.05,
              rotateY: phase === 'closed' ? 0 : -25,
            }}
            transition={{ duration: 0.65, ease: 'easeInOut' }}
            aria-hidden={phase !== 'closed'}
          >
            <Image
              src="/images/auth/book_cover_closed.jpg"
              alt="كتاب تاريخي جلدي أثري مغلق"
              fill
              priority
              sizes="(max-width: 1024px) 94vw, 1024px"
              className="object-contain pointer-events-none select-none"
            />
          </motion.div>

          {/* 2. Opening Motion Flutter */}
          <motion.div
            className="book-3d-layer book-3d-layer--opening"
            animate={{
              opacity: phase === 'opening' ? 1 : 0,
            }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            aria-hidden={phase !== 'opening'}
          >
            <Image
              src="/images/auth/book_opening_motion.jpg"
              alt="فتح صفحات كتاب التاريخ الأثري"
              fill
              priority
              sizes="(max-width: 1024px) 94vw, 1024px"
              className="object-contain pointer-events-none select-none"
            />
          </motion.div>

          {/* 3. Open Book Spread (Login or Register) */}
          <motion.div
            className="book-3d-layer book-3d-layer--spread"
            animate={{
              opacity: phase === 'ready' || phase === 'entering' || phase === 'flipping' ? 1 : 0,
            }}
            transition={{ duration: 0.55 }}
          >
            {/* The Background Spread Artwork */}
            <div className="book-3d-spread-bg-container">
              <Image
                src={
                  currentMode === 'login'
                    ? '/images/auth/book_login_spread.jpg'
                    : '/images/auth/book_register_spread.jpg'
                }
                alt={currentMode === 'login' ? 'سجل تسجيل الدخول' : 'سجل إنشاء الحساب الجديد'}
                fill
                priority
                sizes="(max-width: 1024px) 94vw, 1024px"
                className="object-contain pointer-events-none select-none"
              />
            </div>

            {/* Interactive HTML Form Layer */}
            <div
              className={cn(
                'book-3d-form-overlay',
                !isReady && 'pointer-events-none opacity-90',
              )}
            >
              {children}
            </div>
          </motion.div>

          {/* 4. Flipping Page Leaf */}
          <AnimatePresence>
            {phase === 'flipping' && (
              <motion.div
                key="flipping-leaf"
                className="book-3d-layer book-3d-layer--flipping"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.98, 1.02, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: PAGE_TURN_DURATION_MS / 1000, times: [0, 0.15, 0.85, 1] }}
                aria-hidden
              >
                <Image
                  src="/images/auth/book_flipping_spread.jpg"
                  alt="تقليب صفحات كتاب التاريخ"
                  fill
                  priority
                  sizes="(max-width: 1024px) 94vw, 1024px"
                  className="object-contain pointer-events-none select-none"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 5. Time Vortex Portal */}
          <AnimatePresence>{isVortexing && <TimeVortexPortal key="portal" />}</AnimatePresence>
        </motion.div>

        {/* Skip Animation Pill during initial opening */}
        {(phase === 'closed' || phase === 'opening') && !reduceMotion && (
          <div className="book-3d-opening-indicator">
            <span className="book-3d-opening-indicator__pulse" />
            <span>{phase === 'closed' ? 'المخطوطة التاريخية تستعد للفتح…' : 'جاري فتح صفحات التاريخ…'}</span>
            <button type="button" onClick={skipAnimation} className="book-3d-skip-btn">
              تخطي الحركة ◄
            </button>
          </div>
        )}
      </div>
    </AuthBookContext.Provider>
  );
}
