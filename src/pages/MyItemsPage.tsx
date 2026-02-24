// =============================================================================
// MyItemsPage: Mine utlån og bookinger
// =============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDateTime } from '../lib/utils';
import * as bookingService from '../services/booking.service';
import * as loanService from '../services/loan.service';
import type { Booking, Loan } from '../types';
import { BOOKING_STATUS_CONFIG, EQUIPMENT_STATUS_CONFIG } from '../types';

export function MyItemsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activeTab, setActiveTab] = useState<'loans' | 'bookings'>('loans');

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const [bk, ln] = await Promise.all([
          bookingService.getMyBookings(profile.id),
          loanService.getMyLoans(profile.id),
        ]);
        setBookings(bk);
        setLoans(ln);
      } catch (err) {
        console.error('Feil:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h2>Mine lån & bookinger</h2>
        <p>Oversikt over dine aktive reservasjoner</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          <Package size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Utlån ({loans.length})
        </button>
        <button
          className={`tab ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Bookinger ({bookings.length})
        </button>
      </div>

      {activeTab === 'loans' && (
        <>
          {loans.length === 0 ? (
            <EmptyState message="Du har ingen aktive utlån" />
          ) : (
            <div className="booking-list">
              {loans.map((loan) => (
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
                    {loan.equipment?.location && (
                      <span className="booking-meta">
                        Lokasjon: {loan.equipment.location}
                      </span>
                    )}
                    {loan.checkout_comment && (
                      <span className="booking-meta">
                        Merknad: {loan.checkout_comment}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'bookings' && (
        <>
          {bookings.length === 0 ? (
            <EmptyState message="Du har ingen aktive bookinger" />
          ) : (
            <div className="booking-list">
              {bookings.map((booking) => (
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
                      <span className="booking-meta">
                        Formål: {booking.purpose}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
