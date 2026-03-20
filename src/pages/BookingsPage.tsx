// =============================================================================
// BookingsPage: Kalender/listevisning av alle bookinger
// =============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDateTime } from '../lib/utils';
import * as bookingService from '../services/booking.service';
import type { Booking } from '../types';
import { BOOKING_STATUS_CONFIG } from '../types';

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await bookingService.getAllBookings(
          weekStart.toISOString(),
          weekEnd.toISOString()
        );
        if (!cancelled) setBookings(data);
      } catch (err) {
        console.error('Feil ved lasting av bookinger:', err instanceof Error ? err.message : 'Ukjent feil');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const getBookingsForDay = (day: Date) =>
    bookings.filter((b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      return (
        isSameDay(start, day) ||
        isSameDay(end, day) ||
        (start < day && end > day)
      );
    });

  return (
    <div>
      <div className="page-header">
        <h2>
          <Calendar size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Bookingkalender
        </h2>
        <p>Oversikt over reservasjoner</p>
      </div>

      {/* Uke-navigasjon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 600 }}>
          {format(weekStart, 'd. MMM', { locale: nb })} –{' '}
          {format(weekEnd, 'd. MMM yyyy', { locale: nb })}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <button
        className="btn btn-outline btn-sm"
        style={{ marginBottom: '16px' }}
        onClick={() => setCurrentWeek(new Date())}
      >
        Denne uken
      </button>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div>
          {/* Uke-oversikt minibar */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px', marginBottom: '16px', padding: '8px',
            background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}>
            {days.map((day) => {
              const count = getBookingsForDay(day).length;
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 600,
                    color: isToday ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}>
                    {format(day, 'EEE', { locale: nb })}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--color-primary)' : 'var(--color-text)',
                  }}>
                    {format(day, 'd')}
                  </div>
                  <div style={{
                    height: '4px', borderRadius: '2px', marginTop: '4px',
                    background: count > 0
                      ? count >= 3 ? 'var(--color-danger)' : count >= 2 ? 'var(--color-warning)' : 'var(--color-primary)'
                      : 'var(--color-border)',
                  }} />
                  {count > 0 && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {count}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {days.map((day) => {
            const dayBookings = getBookingsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={day.toISOString()} style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    marginBottom: '8px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: isToday ? 'var(--color-primary-light)' : 'transparent',
                    color: isToday ? 'var(--color-primary)' : 'var(--color-text)',
                  }}
                >
                  {format(day, 'EEEE d. MMMM', { locale: nb })}
                </div>

                {dayBookings.length === 0 ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                      borderLeft: '2px solid var(--color-border)',
                      marginLeft: '8px',
                    }}
                  >
                    Ingen bookinger
                  </div>
                ) : (
                  <div className="booking-list">
                    {dayBookings.map((b) => (
                      <Link
                        key={b.id}
                        to={`/equipment/${b.equipment_id}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <div className="booking-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="booking-time">
                              {b.equipment?.name}
                            </span>
                            <StatusBadge config={BOOKING_STATUS_CONFIG[b.status]} />
                          </div>
                          <span className="booking-meta">
                            {formatDateTime(b.start_time)} – {formatDateTime(b.end_time)}
                          </span>
                          <span className="booking-meta">
                            Booket av: {b.user?.full_name}
                            {b.purpose ? ` – ${b.purpose}` : ''}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <EmptyState message="Ingen bookinger denne uken" />
      )}
    </div>
  );
}
