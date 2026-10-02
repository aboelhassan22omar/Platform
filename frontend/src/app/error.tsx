'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest lets this be correlated with the server log without
    // exposing the stack trace to the student.
    console.error('Unhandled page error:', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[70dvh] items-center justify-center bg-ivory-100">
      <div className="container-page max-w-md text-center">
        <span
          aria-hidden
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-500"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth="1.6" />
            <path d="M12 7.5v5M12 16h.01" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <h1 className="mt-5 font-display text-2xl font-black text-midnight-900">
          حصل خطأ غير متوقع
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-midnight-500">
          جرّب تحدّث الصفحة. لو المشكلة اتكررت، كلّم الدعم.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-midnight-900 px-6 text-sm font-bold text-ivory-50"
        >
          حاول تاني
        </button>
      </div>
    </div>
  );
}
