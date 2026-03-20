// =============================================================================
// AuthContext: Håndterer innloggingsstatus og brukerprofil
// =============================================================================

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../types';
import * as authService from '../services/auth.service';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hent eksisterende session ved oppstart
    authService.getSession().then((session) => {
      setSession(session);
      if (session?.user) {
        authService.getProfile(session.user.id).then(setProfile).catch((err) => {
          console.error('Profil-feil:', err instanceof Error ? err.message : 'Ukjent feil');
          setProfile(null);
        });
      }
      setLoading(false);
    });

    // Lytt på auth-endringer
    const { data: { subscription } } = authService.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          try {
            const prof = await authService.getProfile(session.user.id);
            setProfile(prof);
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    const { session } = await authService.signIn(email, password);
    setSession(session);
    if (session.user) {
      const prof = await authService.getProfile(session.user.id);
      setProfile(prof);
    }
  };

  const handleSignUp = async (email: string, password: string, fullName: string) => {
    await authService.signUp(email, password, fullName);
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth må brukes innenfor AuthProvider');
  }
  return ctx;
}
