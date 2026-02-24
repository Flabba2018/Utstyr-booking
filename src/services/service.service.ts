// =============================================================================
// Service: Servicehistorikk
// Håndterer service/kontroll av utstyr
// =============================================================================

import { supabase } from '../lib/supabase';
import type { ServiceRecord } from '../types';

/** Hent servicehistorikk for utstyr */
export async function getServiceRecords(equipmentId: string): Promise<ServiceRecord[]> {
  const { data, error } = await supabase
    .from('service_records')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('performed_at', { ascending: false });

  if (error) throw error;
  return data as ServiceRecord[];
}

/** Registrer ny service/kontroll */
export async function createServiceRecord(
  userId: string,
  input: {
    equipment_id: string;
    service_type: string;
    description?: string;
    performed_by?: string;
    performed_at: string;
    next_service_date?: string;
    cost?: number;
  }
): Promise<ServiceRecord> {
  const { data, error } = await supabase
    .from('service_records')
    .insert({
      ...input,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw error;

  // Oppdater utstyr med service-datoer
  const updateData: Record<string, unknown> = {
    last_service_date: input.performed_at,
  };
  if (input.next_service_date) {
    updateData.next_service_date = input.next_service_date;
  }
  // Sett status tilbake til ledig hvis det var på service
  updateData.status = 'ledig';

  await supabase
    .from('equipment')
    .update(updateData)
    .eq('id', input.equipment_id);

  return data as ServiceRecord;
}
