// =============================================================================
// Service: Utstyr (Equipment)
// Alle Supabase-kall for utstyrsregisteret
// =============================================================================

import { supabase } from '../lib/supabase';
import type {
  Equipment,
  EquipmentCategory,
  CreateEquipmentInput,
  UpdateEquipmentInput,
} from '../types';

/** Hent alt aktivt utstyr med kategori */
export async function getEquipmentList(filters?: {
  category?: string;
  status?: string;
  search?: string;
  location?: string;
}): Promise<Equipment[]> {
  let query = supabase
    .from('equipment')
    .select('*, category:equipment_categories(*)')
    .eq('active', true)
    .order('name');

  if (filters?.category) {
    query = query.eq('category_id', filters.category);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,asset_tag.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }
  if (filters?.location) {
    query = query.ilike('location', `%${filters.location}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Equipment[];
}

/** Hent enkelt utstyr med alle detaljer */
export async function getEquipment(id: string): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*, category:equipment_categories(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Equipment;
}

/** Opprett nytt utstyr (manager/admin) */
export async function createEquipment(input: CreateEquipmentInput): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .insert(input)
    .select('*, category:equipment_categories(*)')
    .single();

  if (error) throw error;
  return data as Equipment;
}

/** Oppdater utstyr (manager/admin) */
export async function updateEquipment(
  id: string,
  input: UpdateEquipmentInput
): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .update(input)
    .eq('id', id)
    .select('*, category:equipment_categories(*)')
    .single();

  if (error) throw error;
  return data as Equipment;
}

/** Hent alle kategorier */
export async function getCategories(): Promise<EquipmentCategory[]> {
  const { data, error } = await supabase
    .from('equipment_categories')
    .select('*')
    .order('name');

  if (error) throw error;
  return data as EquipmentCategory[];
}

/** Hent utstyr som har servicebehov (utløpt eller nærmer seg) */
export async function getEquipmentNeedingService(): Promise<Equipment[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('equipment')
    .select('*, category:equipment_categories(*)')
    .eq('active', true)
    .not('next_service_date', 'is', null)
    .lte('next_service_date', today)
    .order('next_service_date');

  if (error) throw error;
  return data as Equipment[];
}
