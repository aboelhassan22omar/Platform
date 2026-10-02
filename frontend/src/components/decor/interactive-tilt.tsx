'use client';

import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

interface InteractiveTiltProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  sheen?: boolean;
}

export function InteractiveTilt({
  children,
  className,
  maxTilt = 8,
  perspective = 1000,
  sheen = true,
}: InteractiveTiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [sheenPos, setSheenPos] = useState({ x: 50, y: 50, opacity: 0 });

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -maxTilt;
    const rY = ((x - centerX) / centerX) * maxTilt;

    setRotateX(rX);
    setRotateY(rY);

    if (sheen) {
      setSheenPos({
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
        opacity: 0.18,
      });
    }
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setSheenPos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX,
        rotateY,
        transformPerspective: perspective,
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      style={{ transformStyle: 'preserve-3d' }}
      className={cn('relative overflow-hidden transition-shadow duration-300', className)}
    >
      {sheen && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
          style={{
            opacity: sheenPos.opacity,
            background: `radial-gradient(circle 280px at ${sheenPos.x}% ${sheenPos.y}%, rgba(254, 240, 138, 0.45), rgba(245, 158, 11, 0.15) 40%, transparent 80%)`,
          }}
        />
      )}
      {children}
    </motion.div>
  );
}

