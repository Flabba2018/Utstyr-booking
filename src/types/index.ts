// =============================================================================
// Felles TypeScript-typer for hele applikasjonen
// Speiler databaseskjemaet i supabase/schema.sql
// =============================================================================

// ----- Enums -----

export type UserRole = 'user' | 'manager' | 'admin';

export type EquipmentStatus =
  | 'ledig'
  | 'booket'
  | 'utlånt'
  | 'ute_av_drift'
  | 'på_service'
  | 'savnet';

export type BookingStatus = 'aktiv' | 'kansellert' | 'fullført';
export type BookingPriority = 'normal' | 'høy' | 'akutt';

export type LoanStatus = 'aktiv' | 'returnert' | 'forsinket';

export type ConditionRating = 'ok' | 'mangler' | 'skade' | 'annet';
export type ReportType = 'checkout' | 'return';

export type DeviationType =
  | 'skade'
  | 'feil'
  | 'mangler'
  | 'servicebehov'
  | 'rengjøring'
  | 'annet';

export type DeviationSeverity = 'lav' | 'middels' | 'høy' | 'kritisk';
export type DeviationStatus = 'åpen' | 'under_behandling' | 'lukket';

// ----- Profil -----

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  role: UserRole;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ----- Utstyrskategori -----

export interface EquipmentCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

// ----- Utstyr -----

export interface Equipment {
  id: string;
  asset_tag: string;
  name: string;
  category_id: string | null;
  location: string | null;
  department: string | null;
  status: EquipmentStatus;
  serial_number: string | null;
  image_url: string | null;
  description: string | null;
  requires_booking: boolean;
  active: boolean;
  next_service_date: string | null;
  last_service_date: string | null;
  service_interval_days: number | null;
  block_if_service_overdue: boolean;
  created_at: string;
  updated_at: string;
  // Join-felt (ikke alltid tilgjengelig)
  category?: EquipmentCategory;
}

// ----- Booking -----

export interface Booking {
  id: string;
  equipment_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  priority: BookingPriority;
  purpose: string | null;
  created_at: string;
  updated_at: string;
  // Join-felt
  equipment?: Equipment;
  user?: Profile;
}

// ----- Utlån -----

export interface Loan {
  id: string;
  equipment_id: string;
  user_id: string;
  booking_id: string | null;
  status: LoanStatus;
  checked_out_at: string;
  expected_return_at: string | null;
  returned_at: string | null;
  checkout_comment: string | null;
  return_comment: string | null;
  created_at: string;
  updated_at: string;
  // Join-felt
  equipment?: Equipment;
  user?: Profile;
  booking?: Booking;
}

// ----- Tilstandsrapport -----

export interface ConditionReport {
  id: string;
  loan_id: string;
  equipment_id: string;
  report_type: ReportType;
  condition: ConditionRating;
  description: string | null;
  reported_by: string;
  images: string[] | null;
  created_at: string;
  // Join-felt
  reporter?: Profile;
}

// ----- Avvik -----

export interface Deviation {
  id: string;
  equipment_id: string;
  loan_id: string | null;
  booking_id: string | null;
  reported_by: string;
  type: DeviationType;
  severity: DeviationSeverity;
  title: string;
  description: string | null;
  images: string[] | null;
  status: DeviationStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_comment: string | null;
  created_at: string;
  updated_at: string;
  // Join-felt
  equipment?: Equipment;
  reporter?: Profile;
  resolver?: Profile;
}

// ----- Servicelogg -----

export interface ServiceRecord {
  id: string;
  equipment_id: string;
  service_type: string;
  description: string | null;
  performed_by: string | null;
  performed_at: string;
  next_service_date: string | null;
  cost: number | null;
  created_by: string | null;
  created_at: string;
  // Join-felt
  equipment?: Equipment;
}

// ----- Eksterne referanser (FAMAC) -----

export interface EquipmentExternalRef {
  id: string;
  equipment_id: string;
  external_system: string;
  external_id: string;
  external_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ----- Integrasjonshendelser -----

export interface IntegrationEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  target_system: string;
  payload: Record<string, unknown> | null;
  status: 'pending' | 'sent' | 'failed' | 'acknowledged';
  error_message: string | null;
  attempts: number;
  created_at: string;
  processed_at: string | null;
}

// ----- Fase 2: Kompetanser -----

export interface Competency {
  id: string;
  name: string;
  description: string | null;
  valid_months: number | null;
  created_at: string;
}

// ----- Input-typer for opprettelse/oppdatering -----

export interface CreateBookingInput {
  equipment_id: string;
  start_time: string;
  end_time: string;
  priority?: BookingPriority;
  purpose?: string;
}

export interface CreateLoanInput {
  equipment_id: string;
  booking_id?: string;
  expected_return_at?: string;
  checkout_comment?: string;
}

export interface ReturnLoanInput {
  return_comment?: string;
}

export interface CreateConditionReportInput {
  loan_id: string;
  equipment_id: string;
  report_type: ReportType;
  condition: ConditionRating;
  description?: string;
  images?: string[];
}

export interface CreateDeviationInput {
  equipment_id: string;
  loan_id?: string;
  booking_id?: string;
  type: DeviationType;
  severity: DeviationSeverity;
  title: string;
  description?: string;
  images?: string[];
}

export interface CreateEquipmentInput {
  asset_tag: string;
  name: string;
  category_id?: string;
  location?: string;
  department?: string;
  serial_number?: string;
  description?: string;
  requires_booking: boolean;
  next_service_date?: string;
  service_interval_days?: number;
  block_if_service_overdue?: boolean;
}

export interface UpdateEquipmentInput {
  name?: string;
  category_id?: string;
  location?: string;
  department?: string;
  status?: EquipmentStatus;
  serial_number?: string;
  image_url?: string;
  description?: string;
  requires_booking?: boolean;
  active?: boolean;
  next_service_date?: string;
  last_service_date?: string;
  service_interval_days?: number;
  block_if_service_overdue?: boolean;
}

// ----- Hjelpetype for UI -----

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

/** Norske labels for ulike statuser */
export const EQUIPMENT_STATUS_CONFIG: Record<EquipmentStatus, StatusConfig> = {
  ledig: { label: 'Ledig', color: '#16a34a', bgColor: '#dcfce7' },
  booket: { label: 'Booket', color: '#ca8a04', bgColor: '#fef9c3' },
  utlånt: { label: 'Utlånt', color: '#2563eb', bgColor: '#dbeafe' },
  ute_av_drift: { label: 'Ute av drift', color: '#dc2626', bgColor: '#fee2e2' },
  på_service: { label: 'På service', color: '#9333ea', bgColor: '#f3e8ff' },
  savnet: { label: 'Savnet', color: '#dc2626', bgColor: '#fee2e2' },
};

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, StatusConfig> = {
  aktiv: { label: 'Aktiv', color: '#16a34a', bgColor: '#dcfce7' },
  kansellert: { label: 'Kansellert', color: '#6b7280', bgColor: '#f3f4f6' },
  fullført: { label: 'Fullført', color: '#2563eb', bgColor: '#dbeafe' },
};

export const DEVIATION_SEVERITY_CONFIG: Record<DeviationSeverity, StatusConfig> = {
  lav: { label: 'Lav', color: '#16a34a', bgColor: '#dcfce7' },
  middels: { label: 'Middels', color: '#ca8a04', bgColor: '#fef9c3' },
  høy: { label: 'Høy', color: '#ea580c', bgColor: '#ffedd5' },
  kritisk: { label: 'Kritisk', color: '#dc2626', bgColor: '#fee2e2' },
};

export const CONDITION_LABELS: Record<ConditionRating, string> = {
  ok: 'OK',
  mangler: 'Mangler',
  skade: 'Skade',
  annet: 'Annet',
};

export const DEVIATION_TYPE_LABELS: Record<DeviationType, string> = {
  skade: 'Skade',
  feil: 'Feil',
  mangler: 'Mangler',
  servicebehov: 'Servicebehov',
  rengjøring: 'Rengjøring',
  annet: 'Annet',
};

export const CATEGORY_LABELS: Record<string, string> = {
  verktøy: 'Verktøy',
  tilhenger: 'Tilhenger',
  lift: 'Lift',
  gressklipper: 'Gressklipper',
  maskin: 'Maskin',
  måleinstrument: 'Måleinstrument',
  annet: 'Annet',
};
