'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { EducationSystem, GradeLevel, Role, StudentType } from '@/types/api';

export interface AuthUser {
  id: string;
  fullName: string;
  username: string;
  phone: string;
  parentPhone: string;
  role: Role;
  status: string;
  studentType: StudentType;
  educationSystem: EducationSystem | null;
  gradeLevel: GradeLevel | null;
  academicYearId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  isStaff: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the initial session check resolves. */
  isLoading: boolean;
  /**
   * True from the moment a sign-out starts until the navigation lands.
   *
   * Route guards read this so that clearing the user does not momentarily look
   * like an unauthenticated visit — which would bounce the student to
   * /login?next=<the page they just left>, i.e. ask them to sign back into the
   * page they deliberately signed out of.
   */
  isSigningOut: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<OtpChallenge>;
  verifyRegistration: (challengeId: string, code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface RegisterInput {
  studentType: StudentType;
  fullName: string;
  username: string;
  password: string;
  phone: string;
  parentPhone: string;
  educationSystem: EducationSystem;
  gradeLevel: GradeLevel;
}

export interface OtpChallenge {
  challengeId: string;
  expiresIn: number;
  resendAfterSeconds: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  /**
   * Resolves the current session from the httpOnly cookie.
   *
   * On a 401 it tries one silent refresh before giving up, so a student whose
   * short-lived access token expired while reading is not thrown back to the
   * login screen — the rotating refresh cookie renews it invisibly.
   */
  const loadSession = useCallback(async () => {
    try {
      const me = await api.get<AuthUser>('/auth/me');
      setUser(me);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try {
          await api.post('/auth/refresh');
          setUser(await api.get<AuthUser>('/auth/me'));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { user: next } = await api.post<{ user: AuthUser }>('/auth/login', {
        identifier,
        password,
      });
      setUser(next);
      // Server components render against the cookie, so they must re-run.
      router.refresh();
      return next;
    },
    [router],
  );

  const register = useCallback(
    (input: RegisterInput) => api.post<OtpChallenge>('/auth/register', input),
    [],
  );

  const verifyRegistration = useCallback(
    async (challengeId: string, code: string) => {
      const { user: next } = await api.post<{ user: AuthUser }>('/auth/register/verify', { challengeId, code });
      setUser(next);
      router.refresh();
      return next;
    },
    [router],
  );

  const logout = useCallback(async () => {
    setIsSigningOut(true);
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
    // replace, not push: the signed-in page must not be reachable with Back.
    router.replace('/');
    router.refresh();
  }, [router]);

  // Clear the flag once navigation has actually landed somewhere public.
  useEffect(() => {
    if (isSigningOut && !user) {
      const timer = window.setTimeout(() => setIsSigningOut(false), 600);
      return () => window.clearTimeout(timer);
    }
  }, [isSigningOut, user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isSigningOut, login, register, verifyRegistration, logout, refresh: loadSession }),
    [user, isLoading, isSigningOut, login, register, verifyRegistration, logout, loadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
