'use client';

import { useEffect, useState } from 'react';
import { useProtection } from './use-protection';

const randomSpot = () => ({ top: 6 + Math.random() * 78, left: 4 + Math.random() * 60 });

/**
 * The student's name and phone drifting over a video, when the admin turns the
 * watermark on. It cannot stop a screen recorder, but it puts the recorder's
 * identity in every frame of the recording. Place it inside a positioned
 * container (the player or the live stage).
 */
export function Watermark() {
  const { watermarkText } = useProtection();
  const [spot, setSpot] = useState({ top: 12, left: 8 });

  useEffect(() => {
    if (!watermarkText) return;
    setSpot(randomSpot());
    const timer = window.setInterval(() => setSpot(randomSpot()), 7000);
    return () => window.clearInterval(timer);
  }, [watermarkText]);

  if (!watermarkText) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      <span
        dir="auto"
        className="absolute select-none whitespace-nowrap rounded-md bg-black/10 px-2 py-1 text-xs font-bold text-white/45 transition-[top,left] duration-[2500ms] ease-in-out [text-shadow:0_1px_2px_rgb(0_0_0/60%)] sm:text-sm"
        style={{ top: `${spot.top}%`, left: `${spot.left}%` }}
      >
        {watermarkText}
      </span>
    </div>
  );
}
