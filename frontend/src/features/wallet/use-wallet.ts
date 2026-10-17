'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { api } from '@/lib/api';
import type { WalletSummary } from '@/types/api';

export const WALLET_QUERY_KEY = ['wallet'] as const;

/** The signed-in student's balance and statement. Disabled for visitors and staff. */
export function useWallet(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: () => api.get<WalletSummary>('/wallet'),
    enabled: enabled && Boolean(user && !user.isStaff),
  });
}
