'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';

export interface ProtectionSettings {
  watermark: boolean;
}

export const PROTECTION_QUERY_KEY = ['protection-settings'] as const;

/**
 * The admin's protection switches, as they apply to the person viewing.
 * Staff are never restricted, so a teacher can still copy, print and record.
 */
export function useProtection(): ProtectionSettings & { watermarkText: string | null } {
  const { user } = useAuth();
  const isStudent = Boolean(user && !user.isStaff);
  const { data } = useQuery({
    queryKey: PROTECTION_QUERY_KEY,
    queryFn: () => api.get<ProtectionSettings>('/settings/protection'),
    enabled: isStudent,
    staleTime: 60_000,
  });
  const watermark = isStudent && Boolean(data?.watermark);
  return {
    watermark,
    watermarkText: watermark && user ? `${user.fullName} · ${user.phone}` : null,
  };
}
