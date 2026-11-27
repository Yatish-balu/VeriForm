import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const DEV_SESSION_STORAGE_KEY = 'veriform_dev_auth_session';
const IS_DEV = Boolean(import.meta.env.DEV);

const AuthContext = createContext(null);

function readDevSession() {
  if (!IS_DEV) return null;
  try {
    const raw = window.localStorage.getItem(DEV_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.isDevMock === true && parsed?.user?.email) {
      return parsed;
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const authMode = isSupabaseConfigured
    ? 'supabase'
    : IS_DEV
    ? 'dev-mock'
    : 'unconfigured';

  useEffect(() => {
    let active = true;

    if (isSupabaseConfigured && supabase) {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return;
          const nextSession = data?.session ?? null;
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          setLoading(false);
        })
        .catch(() => {
          if (active) setLoading(false);
        });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    }

    // Clear dev mock session if not running in development mode
    if (!IS_DEV) {
      try {
        window.localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
      setLoading(false);
      return () => {
        active = false;
      };
    }

    // Development-only session hydration
    const devSession = readDevSession();
    if (devSession) {
      setSession(devSession);
      setUser(devSession.user);
    }
    setLoading(false);

    return () => {
      active = false;
    };
  }, []);

  const signIn = async (rawEmail, password) => {
    const email = rawEmail.trim();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        if (error.message?.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        }
        throw new Error(error.message || 'Unable to sign in. Please try again.');
      }
      setSession(data.session);
      setUser(data.user);
      return { user: data.user, session: data.session };
    }

    if (!IS_DEV) {
      throw new Error(
        'Authentication service is not configured for this environment. Contact your administrator.'
      );
    }

    // Development-only mock authentication (never enabled in production builds)
    await new Promise((r) => setTimeout(r, 450));

    if (!password || password.length < 6) {
      throw new Error('Invalid email or password. Password must be at least 6 characters.');
    }

    const devSession = {
      isDevMock: true,
      access_token: null,
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email,
        role: 'Exam Coordinator',
      },
      createdAt: new Date().toISOString(),
    };

    window.localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(devSession));
    setSession(devSession);
    setUser(devSession.user);
    return { user: devSession.user, session: devSession };
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    try {
      window.localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        authMode,
        isSupabaseConfigured,
        isDevMockMode: authMode === 'dev-mock',
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
