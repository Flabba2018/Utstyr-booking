// =============================================================================
// Service: Avvik (Deviations)
// Håndterer registrering og oppfølging av skader/avvik
// =============================================================================

import { supabase } from '../lib/supabase';
import type { Deviation, CreateDeviationInput, DeviationStatus } from '../types';

/** Hent åpne avvik (for dashboard) */
export async function getOpenDeviations(): Promise<Deviation[]> {
  const { data, error } = await supabase
    .from('deviations')
    .select('*, equipment:equipment(*), reporter:profiles!reported_by(*)')
    .in('status', ['åpen', 'under_behandling'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Deviation[];
}

/** Hent avvik for et spesifikt utstyr */
export async function getDeviationsForEquipment(equipmentId: string): Promise<Deviation[]> {
  const { data, error } = await supabase
    .from('deviations')
    .select('*, reporter:profiles!reported_by(*), resolver:profiles!resolved_by(*)')
    .eq('equipment_id', equipmentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Deviation[];
}

/** Opprett nytt avvik (DB-trigger håndterer statusendring ved kritisk avvik) */
export async function createDeviation(
  userId: string,
  input: CreateDeviationInput
): Promise<Deviation> {
  const { data, error } = await supabase
    .from('deviations')
    .insert({
      ...input,
      reported_by: userId,
    })
    .select('*, equipment:equipment(*)')
    .single();

  if (error) throw error;
  return data as Deviation;
}

/** Oppdater avviksstatus (manager/admin) */
export async function updateDeviationStatus(
  deviationId: string,
  status: DeviationStatus,
  userId: string,
  comment?: string
): Promise<Deviation> {
  const updateData: Record<string, unknown> = { status };

  if (status === 'lukket') {
    updateData.resolved_by = userId;
    updateData.resolved_at = new Date().toISOString();
    updateData.resolution_comment = comment;
  }

  const { data, error } = await supabase
    .from('deviations')
    .update(updateData)
    .eq('id', deviationId)
    .select('*, equipment:equipment(*)')
    .single();

  if (error) throw error;
  return data as Deviation;
}
