// =============================================================================
// EquipmentDetailPage: Detaljert visning med booking, utlån, avvik, historikk
// Implementerer Flyt A (lån verktøy), Flyt B (book tilhenger/lift), Flyt C (avvik)
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Package, AlertTriangle, Wrench,
  MapPin, Tag, QrCode, Clock, Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { ImageUpload } from '../components/ui/ImageUpload';
import {
  formatDate, formatDateTime, formatRelative,
  getEquipmentUrl, isServiceOverdue, isServiceApproaching,
  toDateTimeLocal, fromDateTimeLocal,
} from '../lib/utils';
import * as equipmentService from '../services/equipment.service';
import * as bookingService from '../services/booking.service';
import * as loanService from '../services/loan.service';
import * as deviationService from '../services/deviation.service';
import * as serviceService from '../services/service.service';
import type {
  Equipment, Booking, Loan, Deviation, ServiceRecord,
  ConditionRating, DeviationType, DeviationSeverity,
} from '../types';
import {
  EQUIPMENT_STATUS_CONFIG, BOOKING_STATUS_CONFIG,
  CONDITION_LABELS, DEVIATION_TYPE_LABELS,
  DEVIATION_SEVERITY_CONFIG, CATEGORY_LABELS,
} from '../types';

export function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loanHistory, setLoanHistory] = useState<Loan[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal-states
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDeviationModal, setShowDeviationModal] = useState(false);

  // Booking form
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [bookingPriority, setBookingPriority] = useState<'normal' | 'høy' | 'akutt'>('normal');

  // Loan form
  const [loanCondition, setLoanCondition] = useState<ConditionRating>('ok');
  const [loanComment, setLoanComment] = useState('');
  const [loanImages, setLoanImages] = useState<string[]>([]);
  const [selectedBookingForLoan, setSelectedBookingForLoan] = useState<string>('');

  // Return form
  const [returnCondition, setReturnCondition] = useState<ConditionRating>('ok');
  const [returnComment, setReturnComment] = useState('');
  const [returnImages, setReturnImages] = useState<string[]>([]);
  const [activeLoanId, setActiveLoanId] = useState<string>('');

  // Deviation form
  const [devType, setDevType] = useState<DeviationType>('skade');
  const [devSeverity, setDevSeverity] = useState<DeviationSeverity>('middels');
  const [devTitle, setDevTitle] = useState('');
  const [devDescription, setDevDescription] = useState('');
  const [devImages, setDevImages] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const results = await Promise.allSettled([
        equipmentService.getEquipment(id),
        bookingService.getBookingsForEquipment(id, 'aktiv'),
        loanService.getLoanHistory(id),
        deviationService.getDeviationsForEquipment(id),
        serviceService.getServiceRecords(id),
      ]);
      if (results[0].status === 'fulfilled') setEquipment(results[0].value);
      if (results[1].status === 'fulfilled') setBookings(results[1].value);
      if (results[2].status === 'fulfilled') setLoanHistory(results[2].value);
      if (results[3].status === 'fulfilled') setDeviations(results[3].value);
      if (results[4].status === 'fulfilled') setServiceRecords(results[4].value);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ukjent feil';
      console.error('Feil ved lasting:', msg);
      showToast('Kunne ikke laste utstyr', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Finn aktivt utlån for denne brukeren
  const myActiveLoan = loanHistory.find(
    (l) => l.user_id === profile?.id && l.status === 'aktiv'
  );

  // Mine aktive bookinger for dette utstyret
  const myActiveBookings = bookings.filter(
    (b) => b.user_id === profile?.id && b.status === 'aktiv'
  );

  // Sjekk om service er blokkert
  const serviceBlocked =
    equipment?.block_if_service_overdue &&
    isServiceOverdue(equipment?.next_service_date);

  // ---- Handlers ----

  const handleCreateBooking = async () => {
    if (!profile || !id || !bookingStart || !bookingEnd) return;
    setSubmitting(true);
    try {
      await bookingService.createBooking(profile.id, {
        equipment_id: id,
        start_time: fromDateTimeLocal(bookingStart),
        end_time: fromDateTimeLocal(bookingEnd),
        priority: bookingPriority,
        purpose: bookingPurpose || undefined,
      });
      showToast('Booking opprettet!', 'success');
      setShowBookingModal(false);
      setBookingStart('');
      setBookingEnd('');
      setBookingPurpose('');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Feil ved booking';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartLoan = async () => {
    if (!profile || !id) return;
    setSubmitting(true);
    try {
      const loan = await loanService.createLoan(profile.id, {
        equipment_id: id,
        booking_id: selectedBookingForLoan || undefined,
        checkout_comment: loanComment || undefined,
      });
      // Opprett tilstandsrapport
      await loanService.createConditionReport(profile.id, {
        loan_id: loan.id,
        equipment_id: id,
        report_type: 'checkout',
        condition: loanCondition,
        description: loanComment || undefined,
        images: loanImages.length > 0 ? loanImages : undefined,
      });
      showToast('Utlån registrert!', 'success');
      setShowLoanModal(false);
      setLoanComment('');
      setLoanCondition('ok');
      setLoanImages([]);
      setSelectedBookingForLoan('');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Feil ved utlån';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!profile || !activeLoanId) return;
    setSubmitting(true);
    try {
      // Opprett tilstandsrapport for retur
      await loanService.createConditionReport(profile.id, {
        loan_id: activeLoanId,
        equipment_id: id!,
        report_type: 'return',
        condition: returnCondition,
        description: returnComment || undefined,
        images: returnImages.length > 0 ? returnImages : undefined,
      });
      // Registrer retur
      await loanService.returnLoan(activeLoanId, {
        return_comment: returnComment || undefined,
      });
      showToast('Retur registrert!', 'success');
      setShowReturnModal(false);
      setReturnComment('');
      setReturnCondition('ok');
      setReturnImages([]);

      // Hvis alvorlig skade, opprett avvik automatisk
      if (returnCondition === 'skade') {
        await deviationService.createDeviation(profile.id, {
          equipment_id: id!,
          loan_id: activeLoanId,
          type: 'skade',
          severity: 'høy',
          title: `[AUTO] Skade registrert ved retur`,
          description: returnComment || 'Skade oppdaget ved innlevering',
        });
        showToast('Avvik opprettet automatisk pga. skade', 'info');
      }

      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Feil ved retur';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDeviation = async () => {
    if (!profile || !id || !devTitle) return;
    setSubmitting(true);
    try {
      await deviationService.createDeviation(profile.id, {
        equipment_id: id,
        type: devType,
        severity: devSeverity,
        title: devTitle,
        description: devDescription || undefined,
        images: devImages.length > 0 ? devImages : undefined,
      });
      showToast('Avvik registrert!', 'success');
      setShowDeviationModal(false);
      setDevTitle('');
      setDevDescription('');
      setDevImages([]);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Feil ved registrering av avvik';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await bookingService.cancelBooking(bookingId);
      showToast('Booking kansellert', 'success');
      await loadData();
    } catch {
      showToast('Feil ved kansellering', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!equipment) return <EmptyState message="Utstyr ikke funnet" />;

  const qrUrl = getEquipmentUrl(equipment.id);

  return (
    <div>
      {/* Tilbake-knapp */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate(-1)}
        style={{ marginBottom: '8px' }}
      >
        <ArrowLeft size={18} /> Tilbake
      </button>

      {/* Header */}
      <div className="detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>{equipment.name}</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {equipment.asset_tag}
            </span>
          </div>
          <StatusBadge config={EQUIPMENT_STATUS_CONFIG[equipment.status]} />
        </div>
      </div>

      {/* Servicevarsler */}
      {isServiceOverdue(equipment.next_service_date) && (
        <div className="service-alert danger" style={{ marginBottom: '16px' }}>
          <Wrench size={16} />
          Service utløpt! Neste service: {formatDate(equipment.next_service_date)}
          {serviceBlocked && ' – Booking sperret'}
        </div>
      )}
      {!isServiceOverdue(equipment.next_service_date) &&
        isServiceApproaching(equipment.next_service_date) && (
        <div className="service-alert warning" style={{ marginBottom: '16px' }}>
          <Wrench size={16} />
          Service nærmer seg: {formatDate(equipment.next_service_date)}
        </div>
      )}

      {/* Handlingsknapper */}
      <div className="btn-group" style={{ marginBottom: '24px' }}>
        {/* Booking-knapp (for utstyr som krever booking) */}
        {equipment.requires_booking && equipment.status === 'ledig' && !serviceBlocked && (
          <button
            className="btn btn-primary"
            onClick={() => setShowBookingModal(true)}
          >
            <Calendar size={18} /> Book
          </button>
        )}

        {/* Lån ut-knapp */}
        {(equipment.status === 'ledig' || equipment.status === 'booket') && !serviceBlocked && (
          <button
            className="btn btn-success"
            onClick={() => {
              if (equipment.status === 'booket' && myActiveBookings.length > 0) {
                setSelectedBookingForLoan(myActiveBookings[0].id);
              }
              setShowLoanModal(true);
            }}
          >
            <Package size={18} /> Lån ut
          </button>
        )}

        {/* Lever inn-knapp */}
        {myActiveLoan && (
          <button
            className="btn btn-warning"
            onClick={() => {
              setActiveLoanId(myActiveLoan.id);
              setShowReturnModal(true);
            }}
          >
            <Package size={18} /> Lever inn
          </button>
        )}

        {/* Meld avvik */}
        <button
          className="btn btn-outline"
          onClick={() => setShowDeviationModal(true)}
        >
          <AlertTriangle size={18} /> Meld avvik
        </button>
      </div>

      {/* Detaljer */}
      <div className="detail-section">
        <h3>Detaljer</h3>
        <div className="detail-row">
          <span className="detail-row-label"><Tag size={14} /> Kategori</span>
          <span className="detail-row-value">
            {equipment.category
              ? CATEGORY_LABELS[equipment.category.name] || equipment.category.name
              : '–'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-row-label"><MapPin size={14} /> Lokasjon</span>
          <span className="detail-row-value">{equipment.location || '–'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-row-label"><Shield size={14} /> Avdeling</span>
          <span className="detail-row-value">{equipment.department || '–'}</span>
        </div>
        {equipment.serial_number && (
          <div className="detail-row">
            <span className="detail-row-label">Serienummer</span>
            <span className="detail-row-value">{equipment.serial_number}</span>
          </div>
        )}
        {equipment.description && (
          <div className="detail-row">
            <span className="detail-row-label">Beskrivelse</span>
            <span className="detail-row-value" style={{ maxWidth: '60%' }}>
              {equipment.description}
            </span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-row-label"><Clock size={14} /> Siste service</span>
          <span className="detail-row-value">{formatDate(equipment.last_service_date)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-row-label"><Wrench size={14} /> Neste service</span>
          <span className="detail-row-value">{formatDate(equipment.next_service_date)}</span>
        </div>
      </div>

      {/* QR-kode seksjon */}
      <div className="detail-section">
        <h3><QrCode size={16} style={{ verticalAlign: 'middle' }} /> QR-kode</h3>
        <div className="qr-section">
          <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
            Skann QR-koden for å åpne denne utstyrssiden direkte
          </p>
          <div className="qr-url">{qrUrl}</div>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: '8px' }}
            onClick={() => {
              navigator.clipboard.writeText(qrUrl);
              showToast('URL kopiert!', 'success');
            }}
          >
            Kopier URL
          </button>
        </div>
      </div>

      {/* Aktive bookinger */}
      <div className="detail-section">
        <h3><Calendar size={16} style={{ verticalAlign: 'middle' }} /> Bookinger</h3>
        {bookings.length === 0 ? (
          <EmptyState message="Ingen aktive bookinger" />
        ) : (
          <div className="booking-list">
            {bookings.map((b) => (
              <div key={b.id} className="booking-item">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="booking-time">
                    {formatDateTime(b.start_time)} – {formatDateTime(b.end_time)}
                  </span>
                  <StatusBadge config={BOOKING_STATUS_CONFIG[b.status]} />
                </div>
                <span className="booking-meta">
                  {b.user?.full_name} {b.purpose ? `– ${b.purpose}` : ''}
                </span>
                {b.user_id === profile?.id && b.status === 'aktiv' && (
                  <div className="btn-group" style={{ marginTop: '8px' }}>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => {
                        setSelectedBookingForLoan(b.id);
                        setShowLoanModal(true);
                      }}
                    >
                      Start utlån
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleCancelBooking(b.id)}
                    >
                      Kanseller
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avvik */}
      {deviations.length > 0 && (
        <div className="detail-section">
          <h3><AlertTriangle size={16} style={{ verticalAlign: 'middle' }} /> Avvik</h3>
          <div className="booking-list">
            {deviations.slice(0, 10).map((d) => (
              <div key={d.id} className="booking-item">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{d.title}</strong>
                  <StatusBadge config={DEVIATION_SEVERITY_CONFIG[d.severity]} />
                </div>
                <span className="booking-meta">
                  {DEVIATION_TYPE_LABELS[d.type]} – {d.status} – {formatRelative(d.created_at)}
                </span>
                {d.description && (
                  <span className="booking-meta">{d.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historikk (utlån) */}
      <div className="detail-section">
        <h3><Clock size={16} style={{ verticalAlign: 'middle' }} /> Utlånshistorikk</h3>
        {loanHistory.length === 0 ? (
          <EmptyState message="Ingen historikk" />
        ) : (
          <div className="timeline">
            {loanHistory.slice(0, 10).map((loan) => (
              <div key={loan.id} className="timeline-item">
                <div>
                  <div className="timeline-date">{formatDateTime(loan.checked_out_at)}</div>
                  <div className="timeline-content">
                    <strong>{loan.user?.full_name}</strong>
                    {loan.status === 'aktiv' ? ' – Aktiv' : ''}
                    {loan.returned_at && ` → Returnert ${formatDateTime(loan.returned_at)}`}
                    {loan.checkout_comment && (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {loan.checkout_comment}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service-historikk */}
      {serviceRecords.length > 0 && (
        <div className="detail-section">
          <h3><Wrench size={16} style={{ verticalAlign: 'middle' }} /> Servicehistorikk</h3>
          <div className="timeline">
            {serviceRecords.map((sr) => (
              <div key={sr.id} className="timeline-item">
                <div>
                  <div className="timeline-date">{formatDate(sr.performed_at)}</div>
                  <div className="timeline-content">
                    <strong>{sr.service_type}</strong>
                    {sr.performed_by && ` – ${sr.performed_by}`}
                    {sr.description && (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {sr.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== MODALER ===== */}

      {/* Booking Modal */}
      <Modal
        open={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        title="Ny booking"
      >
        {/* Eksisterende bookinger for visuell konfliktsjekk */}
        {bookings.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Eksisterende bookinger</label>
            <div style={{
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
              padding: '8px', maxHeight: '140px', overflowY: 'auto', background: 'var(--color-bg)',
            }}>
              {bookings.map((b) => {
                const isConflict = bookingStart && bookingEnd &&
                  new Date(fromDateTimeLocal(bookingStart)) < new Date(b.end_time) &&
                  new Date(fromDateTimeLocal(bookingEnd)) > new Date(b.start_time);
                return (
                  <div key={b.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 8px', marginBottom: '4px', borderRadius: '4px', fontSize: '0.8rem',
                    background: isConflict ? 'var(--color-danger-light)' : 'var(--color-surface)',
                    border: isConflict ? '1px solid var(--color-danger)' : '1px solid transparent',
                  }}>
                    <span>{formatDateTime(b.start_time)} – {formatDateTime(b.end_time)}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                      {b.user?.full_name ?? 'Booket'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Konfliktvarsel */}
        {bookingStart && bookingEnd && bookings.some((b) =>
          new Date(fromDateTimeLocal(bookingStart)) < new Date(b.end_time) &&
          new Date(fromDateTimeLocal(bookingEnd)) > new Date(b.start_time)
        ) && (
          <div className="service-alert danger" style={{ marginBottom: '16px' }}>
            <AlertTriangle size={16} />
            Tidspunktet overlapper med eksisterende booking
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Fra</label>
          <input
            className="form-input"
            type="datetime-local"
            value={bookingStart}
            onChange={(e) => setBookingStart(e.target.value)}
            min={toDateTimeLocal(new Date().toISOString())}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Til</label>
          <input
            className="form-input"
            type="datetime-local"
            value={bookingEnd}
            onChange={(e) => setBookingEnd(e.target.value)}
            min={bookingStart}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Prioritet</label>
          <select
            className="form-select"
            value={bookingPriority}
            onChange={(e) => setBookingPriority(e.target.value as 'normal' | 'høy' | 'akutt')}
          >
            <option value="normal">Normal</option>
            <option value="høy">Høy</option>
            <option value="akutt">Akutt</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Formål (valgfritt)</label>
          <textarea
            className="form-textarea"
            value={bookingPurpose}
            onChange={(e) => setBookingPurpose(e.target.value)}
            placeholder="Hva skal utstyret brukes til?"
          />
        </div>
        <button
          className="btn btn-primary btn-full"
          onClick={handleCreateBooking}
          disabled={submitting || !bookingStart || !bookingEnd}
        >
          {submitting ? 'Booker...' : 'Opprett booking'}
        </button>
      </Modal>

      {/* Utlån Modal */}
      <Modal
        open={showLoanModal}
        onClose={() => setShowLoanModal(false)}
        title="Registrer utlån"
      >
        {myActiveBookings.length > 0 && (
          <div className="form-group">
            <label className="form-label">Tilknyttet booking</label>
            <select
              className="form-select"
              value={selectedBookingForLoan}
              onChange={(e) => setSelectedBookingForLoan(e.target.value)}
            >
              <option value="">Ingen (direkte utlån)</option>
              {myActiveBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatDateTime(b.start_time)} – {formatDateTime(b.end_time)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Tilstand ved utlevering</label>
          <select
            className="form-select"
            value={loanCondition}
            onChange={(e) => setLoanCondition(e.target.value as ConditionRating)}
          >
            {Object.entries(CONDITION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Kommentar (valgfritt)</label>
          <textarea
            className="form-textarea"
            value={loanComment}
            onChange={(e) => setLoanComment(e.target.value)}
            placeholder="Eventuelle merknader..."
          />
        </div>
        <ImageUpload
          folder="conditions"
          onUpload={(urls) => setLoanImages((prev) => [...prev, ...urls])}
        />
        <button
          className="btn btn-success btn-full"
          onClick={handleStartLoan}
          disabled={submitting}
        >
          {submitting ? 'Registrerer...' : 'Bekreft utlån'}
        </button>
      </Modal>

      {/* Retur Modal */}
      <Modal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Registrer retur"
      >
        <div className="form-group">
          <label className="form-label">Tilstand ved retur</label>
          <select
            className="form-select"
            value={returnCondition}
            onChange={(e) => setReturnCondition(e.target.value as ConditionRating)}
          >
            {Object.entries(CONDITION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {returnCondition === 'skade' && (
            <p className="form-error">
              ⚠ Skade vil automatisk opprette et avvik og kan sette utstyret ut av drift.
            </p>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Kommentar</label>
          <textarea
            className="form-textarea"
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
            placeholder="Beskriv eventuell skade eller merknad..."
          />
        </div>
        <ImageUpload
          folder="conditions"
          onUpload={(urls) => setReturnImages((prev) => [...prev, ...urls])}
        />
        <button
          className="btn btn-warning btn-full"
          onClick={handleReturn}
          disabled={submitting}
        >
          {submitting ? 'Registrerer...' : 'Bekreft retur'}
        </button>
      </Modal>

      {/* Avvik Modal */}
      <Modal
        open={showDeviationModal}
        onClose={() => setShowDeviationModal(false)}
        title="Meld avvik"
      >
        <div className="form-group">
          <label className="form-label">Overskrift *</label>
          <input
            className="form-input"
            type="text"
            value={devTitle}
            onChange={(e) => setDevTitle(e.target.value)}
            placeholder="Kort beskrivelse av avviket"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select
            className="form-select"
            value={devType}
            onChange={(e) => setDevType(e.target.value as DeviationType)}
          >
            {Object.entries(DEVIATION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Alvorlighetsgrad</label>
          <select
            className="form-select"
            value={devSeverity}
            onChange={(e) => setDevSeverity(e.target.value as DeviationSeverity)}
          >
            {Object.entries(DEVIATION_SEVERITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          {(devSeverity === 'høy' || devSeverity === 'kritisk') && (
            <p className="form-error">
              ⚠ Høy/kritisk alvorlighetsgrad vil sette utstyret automatisk ut av drift.
            </p>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Beskrivelse</label>
          <textarea
            className="form-textarea"
            value={devDescription}
            onChange={(e) => setDevDescription(e.target.value)}
            placeholder="Detaljert beskrivelse..."
          />
        </div>
        <ImageUpload
          folder="deviations"
          onUpload={(urls) => setDevImages((prev) => [...prev, ...urls])}
        />
        <button
          className="btn btn-danger btn-full"
          onClick={handleCreateDeviation}
          disabled={submitting || !devTitle}
        >
          {submitting ? 'Registrerer...' : 'Meld avvik'}
        </button>
      </Modal>
    </div>
  );
}
