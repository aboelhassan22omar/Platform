'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import type { Role } from '@/types/api';

const STAFF_ROLES: Role[] = ['SUPPORT', 'CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

/**
 * Client-side route guard.
 *
 * This is a UX convenience only — it stops a signed-out visitor from seeing an
 * empty shell while requests 401. It is NOT the security boundary: every piece
 * of protected data comes from an API endpoint that authorises the request on
 * the server, so bypassing this component reveals nothing.
 */
export function RequireAuth({
  children,
  staffOnly = false,
  studentOnly = false,
}: {
  children: React.ReactNode;
  staffOnly?: boolean;
  studentOnly?: boolean;
}) {
  const { user, isLoading, isSigningOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    // A deliberate sign-out is already navigating home; redirecting to /login
    // here would send the student back to the page they just left.
    if (isSigningOut) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (staffOnly && !STAFF_ROLES.includes(user.role)) {
      router.replace('/dashboard');
      return;
    }

    if (studentOnly && STAFF_ROLES.includes(user.role)) {
      router.replace('/admin');
    }
  }, [user, isLoading, isSigningOut, staffOnly, studentOnly, router, pathname]);

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="space-y-4">
          <div className="skeleton h-36 rounded-3xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (
    !user ||
    (staffOnly && !STAFF_ROLES.includes(user.role)) ||
    (studentOnly && STAFF_ROLES.includes(user.role))
  )
    return null;

  return <>{children}</>;
}
