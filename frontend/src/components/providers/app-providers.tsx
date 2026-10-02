'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from './theme-provider';
import { AuthProvider } from './auth-provider';
import { PresenceReporter } from './presence-reporter';
import { ScrollToTop } from './scroll-to-top';

export function AppProviders({ children }: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              const status = (error as { status?: number })?.status;
              if (status === 401 || status === 403 || status === 404) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <AuthProvider>
            <ScrollToTop />
            {children}
            <PresenceReporter />
          </AuthProvider>
        </ThemeProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
