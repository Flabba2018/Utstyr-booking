// =============================================================================
// Service: Booking
// Alle Supabase-kall for bookingsystemet
// =============================================================================

import { supabase } from '../lib/supabase';
import type { Booking, CreateBookingInput, BookingStatus } from '../types';

/** Hent bookinger for et utstyr (med brukerinfo) */
export async function getBookingsForEquipment(
  equipmentId: string,
  status?: BookingStatus
): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select('*, equipment:equipment(*), user:profiles(*)')
    .eq('equipment_id', equipmentId)
    .order('start_time', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Booking[];
}

/** Hent aktive bookinger for en bruker */
export async function getMyBookings(userId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, equipment:equipment(*, category:equipment_categories(*)), user:profiles(*)')
    .eq('user_id', userId)
    .in('status', ['aktiv'])
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data as Booking[];
}

/** Hent alle bookinger (for kalendervisning) */
export async function getAllBookings(
  from?: string,
  to?: string
): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select('*, equipment:equipment(*, category:equipment_categories(*)), user:profiles(*)')
    .eq('status', 'aktiv')
    .order('start_time', { ascending: true });

  if (from) query = query.gte('start_time', from);
  if (to) query = query.lte('end_time', to);

  const { data, error } = await query;
  if (error) throw error;
  return data as Booking[];
}

/** Opprett ny booking (med overlappskontroll i DB-trigger) */
export async function createBooking(
  userId: string,
  input: CreateBookingInput
): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      ...input,
      user_id: userId,
    })
    .select('*, equipment:equipment(*), user:profiles(*)')
    .single();

  if (error) {
    // Overlapp-feil fra trigger kommer som PostgreSQL exception
    if (error.message?.includes('Booking-konflikt')) {
      throw new Error('Utstyret er allerede booket i dette tidsrommet.');
    }
    throw error;
  }
  return data as Booking;
}

/** Kanseller booking */
export async function cancelBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'kansellert' as BookingStatus })
    .eq('id', bookingId);

  if (error) throw error;
}

/** Fullfør booking (etter retur) */
export async function completeBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'fullført' as BookingStatus })
    .eq('id', bookingId);

  if (error) throw error;
}

/**
 * Sjekk om et utstyr har konflikter i et gitt tidsrom
 * (klientside dobbeltsjekk – DB-trigger er hovedsikring)
 */
export async function checkBookingConflict(
  equipmentId: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<boolean> {
  let query = supabase
    .from('bookings')
    .select('id')
    .eq('equipment_id', equipmentId)
    .eq('status', 'aktiv')
    .lt('start_time', endTime)
    .gt('end_time', startTime);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
