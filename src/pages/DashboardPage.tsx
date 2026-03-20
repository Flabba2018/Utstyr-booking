// =============================================================================
// DashboardPage: Oversikt med status, mine bookinger/utlån og varsler
// =============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, Package, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDateTime, isServiceOverdue } from '../lib/utils';
import * as equipmentService from '../services/equipment.service';
import * as bookingService from '../services/booking.service';
import * as loanService from '../services/loan.service';
import * as deviationService from '../services/deviation.service';
import type { Equipment, Booking, Loan, Deviation } from '../types';
import { EQUIPMENT_STATUS_CONFIG, BOOKING_STATUS_CONFIG } from '../types';

export function DashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [openDeviations, setOpenDeviations] = useState<Deviation[]>([]);
  const [serviceAlerts, setServiceAlerts] = useState<Equipment[]>([]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        const results = await Promise.allSettled([
          equipmentService.getEquipmentList(),
          bookingService.getMyBookings(profile.id),
          loanService.getMyLoans(profile.id),
          deviationService.getOpenDeviations(),
          equipmentService.getEquipmentNeedingService(),
        ]);
        if (cancelled) return;
        if (results[0].status === 'fulfilled') setEquipment(results[0].value);
        if (results[1].status === 'fulfilled') setMyBookings(results[1].value);
        if (results[2].status === 'fulfilled') setMyLoans(results[2].value);
        if (results[3].status === 'fulfilled') setOpenDeviations(results[3].value);
        if (results[4].status === 'fulfilled') setServiceAlerts(results[4].value);
      } catch (err) {
        console.error('Dashboard-feil:', err instanceof Error ? err.message : 'Ukjent feil');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDashboard();
    return () => { cancelled = true; };
  }, [profile]);

  if (loading) return <LoadingSpinner />;

  const availableCount = equipment.filter((e) => e.status === 'ledig').length;
  const loanedCount = equipment.filter((e) => e.status === 'utlånt').length;
  const bookedCount = equipment.filter((e) => e.status === 'booket').length;
  const outOfServiceCount = equipment.filter(
    (e) => e.status === 'ute_av_drift' || e.status === 'på_service'
  ).length;

  return (
    <div>
      <div className="page-header">
        <h2>Hei, {profile?.full_name?.split(' ')[0]} 👋</h2>
        <p>Oversikt over utstyr og dine reservasjoner</p>
      </div>

      {/* Hurtigstatistikk */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {availableCount}
          </div>
          <div className="stat-label">Ledig</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {loanedCount}
          </div>
          <div className="stat-label">Utlånt</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
            {bookedCount}
          </div>
          <div className="stat-label">Booket</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {outOfServiceCount}
          </div>
          <div className="stat-label">Utilgjengelig</div>
        </div>
      </div>

      {/* Serviceadvarsler */}
      {serviceAlerts.length > 0 && (
        <div className="detail-section">
          <h3>⚠️ Servicevarsler</h3>
          {serviceAlerts.map((eq) => (
            <Link
              key={eq.id}
              to={`/equipment/${eq.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                className={`service-alert ${
                  isServiceOverdue(eq.next_service_date) ? 'danger' : 'warning'
                }`}
                style={{ marginBottom: '8px' }}
              >
                <Wrench size={16} />
                <span>
                  {eq.name} – Service{' '}
                  {isServiceOverdue(eq.next_service_date)
                    ? 'utløpt!'
                    : 'nærmer seg'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Åpne avvik */}
      {openDeviations.length > 0 && (
        <div className="detail-section">
          <h3>
            <AlertTriangle
              size={16}
              style={{ verticalAlign: 'middle', marginRight: '4px' }}
            />
            Åpne avvik ({openDeviations.length})
          </h3>
          {openDeviations.slice(0, 5).map((dev) => (
            <Link
              key={dev.id}
              to={`/equipment/${dev.equipment_id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="booking-item" style={{ marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{dev.title}</strong>
                  <StatusBadge
                    config={{
                      label: dev.severity,
                      color:
                        dev.severity === 'kritisk' || dev.severity === 'høy'
                          ? 'var(--color-danger)'
                          : 'var(--color-warning)',
                      bgColor:
                        dev.severity === 'kritisk' || dev.severity === 'høy'
                          ? 'var(--color-danger-light)'
                          : 'var(--color-warning-light)',
                    }}
                  />
                </div>
                <span className="booking-meta">
                  {dev.equipment?.name} – {dev.type}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Mine aktive bookinger */}
      <div className="detail-section">
        <h3>
          <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Mine bookinger
        </h3>
        {myBookings.length === 0 ? (
          <EmptyState message="Ingen aktive bookinger" />
        ) : (
          <div className="booking-list">
            {myBookings.map((booking) => (
              <Link
                key={booking.id}
                to={`/equipment/${booking.equipment_id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="booking-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="booking-time">
                      {booking.equipment?.name}
                    </span>
                    <StatusBadge config={BOOKING_STATUS_CONFIG[booking.status]} />
                  </div>
                  <span className="booking-meta">
                    {formatDateTime(booking.start_time)} – {formatDateTime(booking.end_time)}
                  </span>
                  {booking.purpose && (
                    <span className="booking-meta">{booking.purpose}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Mine aktive utlån */}
      <div className="detail-section">
        <h3>
          <Package size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Mine utlån
        </h3>
        {myLoans.length === 0 ? (
          <EmptyState message="Ingen aktive utlån" />
        ) : (
          <div className="booking-list">
            {myLoans.map((loan) => (
              <Link
                key={loan.id}
                to={`/equipment/${loan.equipment_id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="booking-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="booking-time">
                      {loan.equipment?.name}
                    </span>
                    <StatusBadge config={EQUIPMENT_STATUS_CONFIG['utlånt']} />
                  </div>
                  <span className="booking-meta">
                    Hentet: {formatDateTime(loan.checked_out_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
