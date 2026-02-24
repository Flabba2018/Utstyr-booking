// =============================================================================
// Hjelpefunksjoner brukt på tvers av applikasjonen
// =============================================================================

import { format, formatDistanceToNow, isPast, addDays, isWithinInterval } from 'date-fns';
import { nb } from 'date-fns/locale';

/** Formater dato til norsk lesbart format */
export function formatDate(date: string | Date | null): string {
  if (!date) return '–';
  return format(new Date(date), 'dd.MM.yyyy', { locale: nb });
}

/** Formater dato med klokkeslett */
export function formatDateTime(date: string | Date | null): string {
  if (!date) return '–';
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: nb });
}

/** Relativ tid (f.eks. "3 dager siden") */
export function formatRelative(date: string | Date | null): string {
  if (!date) return '–';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: nb });
}

/** Sjekk om servicedato er utløpt */
export function isServiceOverdue(nextServiceDate: string | null): boolean {
  if (!nextServiceDate) return false;
  return isPast(new Date(nextServiceDate));
}

/** Sjekk om service nærmer seg (innen 30 dager) */
export function isServiceApproaching(nextServiceDate: string | null, daysThreshold = 30): boolean {
  if (!nextServiceDate) return false;
  const serviceDate = new Date(nextServiceDate);
  const now = new Date();
  return isWithinInterval(serviceDate, {
    start: now,
    end: addDays(now, daysThreshold),
  });
}

/** Generer utstyrs-URL for QR-kode */
export function getEquipmentUrl(equipmentId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/equipment/${equipmentId}`;
}

/** Forkort tekst med ellipsis */
export function truncate(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

/** Generer tilfeldige farger basert på streng (for avatarer) */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 45%)`;
}

/** Hent initialer fra navn */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Format ISO-dato til input[type=datetime-local] verdi */
export function toDateTimeLocal(date: string | Date): string {
  return format(new Date(date), "yyyy-MM-dd'T'HH:mm");
}

/** Format input[type=datetime-local] verdi til ISO */
export function fromDateTimeLocal(dateTimeLocal: string): string {
  return new Date(dateTimeLocal).toISOString();
}
