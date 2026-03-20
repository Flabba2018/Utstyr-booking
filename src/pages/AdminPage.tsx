// =============================================================================
// AdminPage: Admin/Manager-panel for utstyrsadministrasjon
// =============================================================================

import { useEffect, useState, type FormEvent } from 'react';
import { Settings, Plus, AlertTriangle, Package, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { formatDateTime } from '../lib/utils';
import * as equipmentService from '../services/equipment.service';
import * as loanService from '../services/loan.service';
import * as deviationService from '../services/deviation.service';
import * as serviceService from '../services/service.service';
import type {
  Equipment, EquipmentCategory, Loan, Deviation, ServiceRecord,
  EquipmentStatus, DeviationStatus,
} from '../types';
import {
  EQUIPMENT_STATUS_CONFIG, DEVIATION_SEVERITY_CONFIG,
  DEVIATION_TYPE_LABELS, CATEGORY_LABELS,
} from '../types';

export function AdminPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'equipment' | 'loans' | 'deviations' | 'service'>('equipment');
  const [loading, setLoading] = useState(true);

  // Data
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [openDeviations, setOpenDeviations] = useState<Deviation[]>([]);

  // Create equipment modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceEquipmentId, setServiceEquipmentId] = useState('');
  const [createForm, setCreateForm] = useState({
    asset_tag: '',
    name: '',
    category_id: '',
    location: '',
    department: '',
    description: '',
    serial_number: '',
    requires_booking: false,
    next_service_date: '',
    service_interval_days: '',
    block_if_service_overdue: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    service_type: '',
    description: '',
    performed_by: '',
    performed_at: '',
    next_service_date: '',
    cost: '',
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const results = await Promise.allSettled([
          equipmentService.getEquipmentList(),
          equipmentService.getCategories(),
          loanService.getAllActiveLoans(),
          deviationService.getOpenDeviations(),
        ]);
        if (cancelled) return;
        if (results[0].status === 'fulfilled') setEquipment(results[0].value);
        if (results[1].status === 'fulfilled') setCategories(results[1].value);
        if (results[2].status === 'fulfilled') setActiveLoans(results[2].value);
        if (results[3].status === 'fulfilled') setOpenDeviations(results[3].value);
      } catch (err) {
        console.error('Admin-feil:', err instanceof Error ? err.message : 'Ukjent feil');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleCreateService = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !serviceEquipmentId || !serviceForm.service_type || !serviceForm.performed_at) {
      showToast('Fyll inn utstyr, type og dato', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await serviceService.createServiceRecord(profile.id, {
        equipment_id: serviceEquipmentId,
        service_type: serviceForm.service_type,
        description: serviceForm.description || undefined,
        performed_by: serviceForm.performed_by || undefined,
        performed_at: serviceForm.performed_at,
        next_service_date: serviceForm.next_service_date || undefined,
        cost: serviceForm.cost ? parseFloat(serviceForm.cost) : undefined,
      });
      showToast('Service registrert!', 'success');
      setShowServiceModal(false);
      setServiceForm({
        service_type: '', description: '', performed_by: '',
        performed_at: '', next_service_date: '', cost: '',
      });
      setServiceEquipmentId('');
      // Refresh equipment (service dates updated)
      const eq = await equipmentService.getEquipmentList();
      setEquipment(eq);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Feil ved registrering';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEquipment = async (e: FormEvent) => {
    e.preventDefault();
    if (!createForm.asset_tag || !createForm.name) {
      showToast('Fyll inn inventarnummer og navn', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await equipmentService.createEquipment({
        asset_tag: createForm.asset_tag,
        name: createForm.name,
        category_id: createForm.category_id || undefined,
        location: createForm.location || undefined,
        department: createForm.department || undefined,
        description: createForm.description || undefined,
        serial_number: createForm.serial_number || undefined,
        requires_booking: createForm.requires_booking,
        next_service_date: createForm.next_service_date || undefined,
        service_interval_days: createForm.service_interval_days
          ? parseInt(createForm.service_interval_days)
          : undefined,
        block_if_service_overdue: createForm.block_if_service_overdue,
      });
      showToast('Utstyr opprettet!', 'success');
      setShowCreateModal(false);
      // Reset form
      setCreateForm({
        asset_tag: '', name: '', category_id: '', location: '',
        department: '', description: '', serial_number: '',
        requires_booking: false, next_service_date: '',
        service_interval_days: '', block_if_service_overdue: false,
      });
      // Refresh
      const eq = await equipmentService.getEquipmentList();
      setEquipment(eq);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Feil ved opprettelse';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (equipmentId: string, newStatus: EquipmentStatus) => {
    try {
      await equipmentService.updateEquipment(equipmentId, { status: newStatus });
      showToast('Status oppdatert', 'success');
      const eq = await equipmentService.getEquipmentList();
      setEquipment(eq);
    } catch {
      showToast('Feil ved statusendring', 'error');
    }
  };

  const handleDeviationStatusChange = async (deviationId: string, newStatus: DeviationStatus) => {
    if (!profile) return;
    try {
      await deviationService.updateDeviationStatus(
        deviationId,
        newStatus,
        profile.id,
        newStatus === 'lukket' ? 'Lukket av admin' : undefined
      );
      showToast('Avviksstatus oppdatert', 'success');
      const devs = await deviationService.getOpenDeviations();
      setOpenDeviations(devs);
    } catch {
      showToast('Feil ved oppdatering', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <h2>
          <Settings size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Administrasjon
        </h2>
        <p>Administrer utstyr, utlån og avvik</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'equipment' ? 'active' : ''}`}
          onClick={() => setActiveTab('equipment')}
        >
          <Package size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Utstyr ({equipment.length})
        </button>
        <button
          className={`tab ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          <Wrench size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Aktive utlån ({activeLoans.length})
        </button>
        <button
          className={`tab ${activeTab === 'deviations' ? 'active' : ''}`}
          onClick={() => setActiveTab('deviations')}
        >
          <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Avvik ({openDeviations.length})
        </button>
        <button
          className={`tab ${activeTab === 'service' ? 'active' : ''}`}
          onClick={() => setActiveTab('service')}
        >
          <Wrench size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Service
        </button>
      </div>

      {/* ===== UTSTYRSFANE ===== */}
      {activeTab === 'equipment' && (
        <>
          <button
            className="btn btn-primary"
            style={{ marginBottom: '16px' }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} /> Nytt utstyr
          </button>

          <div className="equipment-grid">
            {equipment.map((item) => (
              <div key={item.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {item.asset_tag}
                    </div>
                  </div>
                  <StatusBadge config={EQUIPMENT_STATUS_CONFIG[item.status]} />
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <select
                    className="form-select"
                    style={{ padding: '6px 8px', fontSize: '0.8rem', minHeight: 'auto', flex: 1 }}
                    value={item.status}
                    onChange={(e) =>
                      handleStatusChange(item.id, e.target.value as EquipmentStatus)
                    }
                  >
                    {Object.entries(EQUIPMENT_STATUS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== UTLÅNSFANE ===== */}
      {activeTab === 'loans' && (
        <>
          {activeLoans.length === 0 ? (
            <EmptyState message="Ingen aktive utlån" />
          ) : (
            <div className="booking-list">
              {activeLoans.map((loan) => (
                <div key={loan.id} className="booking-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="booking-time">{loan.equipment?.name}</span>
                    <StatusBadge config={EQUIPMENT_STATUS_CONFIG['utlånt']} />
                  </div>
                  <span className="booking-meta">
                    Låner: {loan.user?.full_name}
                  </span>
                  <span className="booking-meta">
                    Hentet: {formatDateTime(loan.checked_out_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== AVVIKSFANE ===== */}
      {activeTab === 'deviations' && (
        <>
          {openDeviations.length === 0 ? (
            <EmptyState message="Ingen åpne avvik" />
          ) : (
            <div className="booking-list">
              {openDeviations.map((dev) => (
                <div key={dev.id} className="booking-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{dev.title}</strong>
                    <StatusBadge config={DEVIATION_SEVERITY_CONFIG[dev.severity]} />
                  </div>
                  <span className="booking-meta">
                    {dev.equipment?.name} – {DEVIATION_TYPE_LABELS[dev.type]} – {formatDateTime(dev.created_at)}
                  </span>
                  {dev.description && (
                    <span className="booking-meta">{dev.description}</span>
                  )}
                  <div className="btn-group" style={{ marginTop: '8px' }}>
                    {dev.status === 'åpen' && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleDeviationStatusChange(dev.id, 'under_behandling')}
                      >
                        Start behandling
                      </button>
                    )}
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleDeviationStatusChange(dev.id, 'lukket')}
                    >
                      Lukk avvik
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== SERVICEFANE ===== */}
      {activeTab === 'service' && (
        <>
          <button
            className="btn btn-primary"
            style={{ marginBottom: '16px' }}
            onClick={() => setShowServiceModal(true)}
          >
            <Plus size={18} /> Registrer service
          </button>

          <div className="detail-section">
            <h3>Utstyr med servicebehov</h3>
            <div className="booking-list">
              {equipment
                .filter((e) => e.next_service_date)
                .sort((a, b) => (a.next_service_date ?? '').localeCompare(b.next_service_date ?? ''))
                .map((item) => {
                  const overdue = item.next_service_date && new Date(item.next_service_date) < new Date();
                  return (
                    <div key={item.id} className="booking-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
                        <StatusBadge config={EQUIPMENT_STATUS_CONFIG[item.status]} />
                      </div>
                      <span className="booking-meta">{item.asset_tag}</span>
                      <span className="booking-meta" style={{ color: overdue ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                        Neste service: {item.next_service_date ? formatDateTime(item.next_service_date) : '–'}
                        {overdue && ' ⚠ Utløpt!'}
                      </span>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ marginTop: '8px', alignSelf: 'flex-start' }}
                        onClick={() => {
                          setServiceEquipmentId(item.id);
                          setShowServiceModal(true);
                        }}
                      >
                        <Wrench size={14} /> Registrer service
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}

      {/* ===== OPPRETT UTSTYR MODAL ===== */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nytt utstyr"
      >
        <form onSubmit={handleCreateEquipment}>
          <div className="form-group">
            <label className="form-label">Inventarnummer *</label>
            <input
              className="form-input"
              type="text"
              value={createForm.asset_tag}
              onChange={(e) => setCreateForm({ ...createForm, asset_tag: e.target.value })}
              placeholder="F.eks. TH-002"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Navn *</label>
            <input
              className="form-input"
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="F.eks. Tilhenger 2 - Brenderup 1500kg"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Kategori</label>
            <select
              className="form-select"
              value={createForm.category_id}
              onChange={(e) => setCreateForm({ ...createForm, category_id: e.target.value })}
            >
              <option value="">Velg kategori...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {CATEGORY_LABELS[cat.name] || cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Lokasjon</label>
            <input
              className="form-input"
              type="text"
              value={createForm.location}
              onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
              placeholder="F.eks. Driftsgård - garasje 1"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Avdeling</label>
            <input
              className="form-input"
              type="text"
              value={createForm.department}
              onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
              placeholder="F.eks. Drift/Vedlikehold"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Serienummer</label>
            <input
              className="form-input"
              type="text"
              value={createForm.serial_number}
              onChange={(e) => setCreateForm({ ...createForm, serial_number: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Beskrivelse</label>
            <textarea
              className="form-textarea"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={createForm.requires_booking}
                onChange={(e) =>
                  setCreateForm({ ...createForm, requires_booking: e.target.checked })
                }
                style={{ width: '20px', height: '20px' }}
              />
              <span className="form-label" style={{ margin: 0 }}>Krever booking</span>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Neste service/kontroll</label>
            <input
              className="form-input"
              type="date"
              value={createForm.next_service_date}
              onChange={(e) => setCreateForm({ ...createForm, next_service_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Serviceintervall (dager)</label>
            <input
              className="form-input"
              type="number"
              value={createForm.service_interval_days}
              onChange={(e) =>
                setCreateForm({ ...createForm, service_interval_days: e.target.value })
              }
              placeholder="F.eks. 365"
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={createForm.block_if_service_overdue}
                onChange={(e) =>
                  setCreateForm({ ...createForm, block_if_service_overdue: e.target.checked })
                }
                style={{ width: '20px', height: '20px' }}
              />
              <span className="form-label" style={{ margin: 0 }}>Sperr booking ved utløpt kontroll</span>
            </label>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {submitting ? 'Oppretter...' : 'Opprett utstyr'}
          </button>
        </form>
      </Modal>

      {/* ===== SERVICE MODAL ===== */}
      <Modal
        open={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        title="Registrer service"
      >
        <form onSubmit={handleCreateService}>
          <div className="form-group">
            <label className="form-label">Utstyr *</label>
            <select
              className="form-select"
              value={serviceEquipmentId}
              onChange={(e) => setServiceEquipmentId(e.target.value)}
              required
            >
              <option value="">Velg utstyr...</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.asset_tag} – {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Type service *</label>
            <select
              className="form-select"
              value={serviceForm.service_type}
              onChange={(e) => setServiceForm({ ...serviceForm, service_type: e.target.value })}
              required
            >
              <option value="">Velg type...</option>
              <option value="kontroll">Kontroll</option>
              <option value="vedlikehold">Vedlikehold</option>
              <option value="reparasjon">Reparasjon</option>
              <option value="sertifisering">Sertifisering</option>
              <option value="annet">Annet</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Utført dato *</label>
            <input
              className="form-input"
              type="date"
              value={serviceForm.performed_at}
              onChange={(e) => setServiceForm({ ...serviceForm, performed_at: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Neste service</label>
            <input
              className="form-input"
              type="date"
              value={serviceForm.next_service_date}
              onChange={(e) => setServiceForm({ ...serviceForm, next_service_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Utført av</label>
            <input
              className="form-input"
              type="text"
              value={serviceForm.performed_by}
              onChange={(e) => setServiceForm({ ...serviceForm, performed_by: e.target.value })}
              placeholder="Navn på person/firma"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Kostnad (kr)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={serviceForm.cost}
              onChange={(e) => setServiceForm({ ...serviceForm, cost: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Beskrivelse</label>
            <textarea
              className="form-textarea"
              value={serviceForm.description}
              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              placeholder="Hva ble gjort..."
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {submitting ? 'Registrerer...' : 'Registrer service'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
