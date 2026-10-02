'use client';

import { forwardRef, useId, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface FieldProps extends Omit<React.ComponentPropsWithoutRef<'input'>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * Labelled text input with inline validation feedback.
 *
 * Accessibility: the label is a real <label>, errors are wired through
 * aria-describedby + aria-invalid, and the error is announced via role="alert".
 * Inputs are min-h-12 so they clear the 44px touch target on phones.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, className, type = 'text', ...props },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cn(
          'block text-sm font-bold text-midnight-800 dark:text-ivory-200',
          props.required && 'field-required',
        )}
      >
        {label}
      </label>

      <div className="relative mt-1.5">
        <input
          ref={ref}
          id={id}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hint && hintId, error && errorId) || undefined}
          className={cn(
            'min-h-12 w-full rounded-xl border-2 bg-white dark:bg-midnight-900/90 px-4 py-3 text-sm text-midnight-900 dark:text-ivory-50',
            'transition-colors duration-200 placeholder:text-midnight-300 dark:placeholder:text-midnight-500',
            'focus:outline-none focus-visible:outline-none',
            // The reveal button is physically on the left; keep its spacing
            // correct even when a password input explicitly switches to LTR.
            isPassword && 'pl-12',
            error
              ? 'border-red-400 dark:border-red-500 focus:border-red-500'
              : 'border-ivory-300 dark:border-midnight-700 focus:border-gold-500 dark:focus:border-gold-400',
          )}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
            aria-pressed={showPassword}
            disabled={props.disabled}
            className="absolute inset-y-0 left-0 grid w-12 place-items-center rounded-s-xl text-midnight-400 transition-colors hover:bg-midnight-100/70 hover:text-midnight-700 disabled:cursor-wait disabled:opacity-50 dark:text-midnight-400 dark:hover:bg-gold-400/10 dark:hover:text-gold-300"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              {showPassword ? (
                <path
                  d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10zm8 2.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM3 3l14 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  <path
                    d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-midnight-400 dark:text-ivory-300/60">
          {hint}
        </p>
      )}

      {error && (
        <motion.p
          id={errorId}
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
});
