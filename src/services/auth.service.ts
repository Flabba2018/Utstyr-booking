// =============================================================================
// Service: Auth
// Autentisering og brukerprofil via Supabase Auth
// =============================================================================

import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import type { Session, User } from '@supabase/supabase-js';

/** Logg inn med e-post/passord */
export async function signIn(email: string, password: string): Promise<{ user: User; session: Session }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Registrer ny bruker */
export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<{ user: User | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return data;
}

/** Logg ut */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Hent gjeldende session */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Hent brukerprofil */
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as Profile;
}

/** Lytt på auth-endringer */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

// Forberedelse for Entra/SSO (fase 2):
// - Bruk supabase.auth.signInWithOAuth({ provider: 'azure' })
// - Konfigurer Azure AD i Supabase Dashboard → Auth → Providers
// - Mapperegel: Azure AD grupper → user_role i profiles-tabellen
