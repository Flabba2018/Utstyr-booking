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
import type {
  Equipment, EquipmentCategory, Loan, Deviation,
  EquipmentStatus, DeviationStatus,
} from '../types';
import {
  EQUIPMENT_STATUS_CONFIG, DEVIATION_SEVERITY_CONFIG,
  DEVIATION_TYPE_LABELS, CATEGORY_LABELS,
} from '../types';

export function AdminPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'equipment' | 'loans' | 'deviations'>('equipment');
  const [loading, setLoading] = useState(true);

  // Data
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [openDeviations, setOpenDeviations] = useState<Deviation[]>([]);

  // Create equipment modal
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  useEffect(() => {
    const load = async () => {
      try {
        const [eq, cats, loans, devs] = await Promise.all([
          equipmentService.getEquipmentList(),
          equipmentService.getCategories(),
          loanService.getAllActiveLoans(),
          deviationService.getOpenDeviations(),
        ]);
        setEquipment(eq);
        setCategories(cats);
        setActiveLoans(loans);
        setOpenDeviations(devs);
      } catch (err) {
        console.error('Admin-feil:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
    </div>
  );
}
