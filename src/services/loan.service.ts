// =============================================================================
// Service: Utlån (Loans)
// Håndterer utlevering og retur av utstyr
// =============================================================================

import { supabase } from '../lib/supabase';
import type {
  Loan,
  CreateLoanInput,
  ReturnLoanInput,
  CreateConditionReportInput,
  ConditionReport,
} from '../types';

/** Hent aktive utlån for en bruker */
export async function getMyLoans(userId: string): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loans')
    .select('*, equipment:equipment(*, category:equipment_categories(*)), user:profiles(*), booking:bookings(*)')
    .eq('user_id', userId)
    .eq('status', 'aktiv')
    .order('checked_out_at', { ascending: false });

  if (error) throw error;
  return data as Loan[];
}

/** Hent alle aktive utlån (for admin) */
export async function getAllActiveLoans(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loans')
    .select('*, equipment:equipment(*, category:equipment_categories(*)), user:profiles(*)')
    .eq('status', 'aktiv')
    .order('checked_out_at', { ascending: false });

  if (error) throw error;
  return data as Loan[];
}

/** Hent utlånshistorikk for et utstyr */
export async function getLoanHistory(equipmentId: string, limit = 20): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loans')
    .select('*, user:profiles(*), booking:bookings(*)')
    .eq('equipment_id', equipmentId)
    .order('checked_out_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Loan[];
}

/**
 * Registrer nytt utlån (Flyt A steg 2-4, Flyt B steg 4)
 * Oppdaterer også utstyrsstatus til 'utlånt'
 */
export async function createLoan(
  userId: string,
  input: CreateLoanInput
): Promise<Loan> {
  // Start utlån
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .insert({
      ...input,
      user_id: userId,
    })
    .select('*, equipment:equipment(*), user:profiles(*)')
    .single();

  if (loanError) throw loanError;

  // Oppdater utstyrsstatus til 'utlånt'
  const { error: eqError } = await supabase
    .from('equipment')
    .update({ status: 'utlånt' })
    .eq('id', input.equipment_id);

  if (eqError) throw eqError;

  return loan as Loan;
}

/**
 * Registrer retur (Flyt A steg 5-6, Flyt B steg 5-6)
 * Oppdaterer utlån, utstyrsstatus, og evt. booking
 */
export async function returnLoan(
  loanId: string,
  input: ReturnLoanInput
): Promise<Loan> {
  // Hent utlånet for å finne utstyr og booking
  const { data: existing, error: fetchError } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (fetchError) throw fetchError;

  // Oppdater utlånet
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .update({
      status: 'returnert',
      returned_at: new Date().toISOString(),
      return_comment: input.return_comment,
    })
    .eq('id', loanId)
    .select('*, equipment:equipment(*), user:profiles(*)')
    .single();

  if (loanError) throw loanError;

  // Sett utstyr tilbake til 'ledig'
  const { error: eqError } = await supabase
    .from('equipment')
    .update({ status: 'ledig' })
    .eq('id', existing.equipment_id);

  if (eqError) throw eqError;

  // Hvis knyttet til booking, fullfør bookingen
  if (existing.booking_id) {
    const { error: bookError } = await supabase
      .from('bookings')
      .update({ status: 'fullført' })
      .eq('id', existing.booking_id);

    if (bookError) throw bookError;
  }

  return loan as Loan;
}

/** Opprett tilstandsrapport (ved ut- eller innsjekk) */
export async function createConditionReport(
  userId: string,
  input: CreateConditionReportInput
): Promise<ConditionReport> {
  const { data, error } = await supabase
    .from('condition_reports')
    .insert({
      ...input,
      reported_by: userId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as ConditionReport;
}

/** Hent tilstandsrapporter for et utlån */
export async function getConditionReports(loanId: string): Promise<ConditionReport[]> {
  const { data, error } = await supabase
    .from('condition_reports')
    .select('*, reporter:profiles(*)')
    .eq('loan_id', loanId)
    .order('created_at');

  if (error) throw error;
  return data as ConditionReport[];
}
