'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-midnight-900 text-ivory-50 hover:bg-midnight-800 dark:bg-gold-500 dark:text-midnight-950 dark:hover:bg-gold-400 dark:shadow-[0_8px_24px_-10px_rgb(200_149_42/0.4)] shadow-[0_8px_24px_-12px_rgb(10_17_32/0.5)]',
  accent:
    'bg-[var(--accent)] text-[var(--accent-contrast)] hover:brightness-110 shadow-[0_10px_30px_-14px_var(--accent)]',
  outline:
    'border border-midnight-200 dark:border-gold-500/30 bg-transparent text-midnight-800 dark:text-ivory-100 hover:border-[var(--accent)] hover:text-[var(--accent)] dark:hover:border-gold-400 dark:hover:text-gold-300',
  ghost: 'bg-transparent text-midnight-700 dark:text-ivory-200 hover:bg-midnight-50 dark:hover:bg-midnight-800/60',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-10 px-4 text-sm gap-1.5',
  md: 'min-h-11 px-5 text-sm gap-2',
  lg: 'min-h-13 px-7 text-base gap-2.5',
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

const baseClasses = (
  variant: Variant,
  size: Size,
  fullWidth?: boolean,
  className?: string,
) =>
  cn(
    'relative inline-flex items-center justify-center rounded-xl font-semibold',
    'transition-[background-color,border-color,color,filter] duration-200',
    'disabled:pointer-events-none disabled:opacity-55',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );

function Spinner() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 grid place-items-center rounded-xl bg-inherit"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </span>
  );
}

export interface ButtonProps
  extends BaseProps,
    Omit<React.ComponentPropsWithoutRef<'button'>, keyof BaseProps> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={disabled || isLoading ? undefined : { scale: 1.02 }}
      whileTap={disabled || isLoading ? undefined : { scale: 0.97 }}
      transition={springSnappy}
      className={baseClasses(variant, size, fullWidth, className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      <span className={cn('inline-flex items-center gap-inherit', isLoading && 'invisible')}>
        {children}
      </span>
      {isLoading && <Spinner />}
    </motion.button>
  );
});

export interface ButtonLinkProps
  extends BaseProps,
    Omit<React.ComponentPropsWithoutRef<typeof Link>, keyof BaseProps | 'href'> {
  href: string;
  external?: boolean;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  href,
  external,
  ...props
}: ButtonLinkProps) {
  const classes = baseClasses(variant, size, fullWidth, className);

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
