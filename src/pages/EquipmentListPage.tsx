// =============================================================================
// EquipmentListPage: Utstyrsoversikt med søk og filter
// =============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Tag } from 'lucide-react';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import * as equipmentService from '../services/equipment.service';
import type { Equipment, EquipmentCategory } from '../types';
import { EQUIPMENT_STATUS_CONFIG, CATEGORY_LABELS } from '../types';

export function EquipmentListPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  useEffect(() => {
    equipmentService.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    const loadEquipment = async () => {
      setLoading(true);
      try {
        const data = await equipmentService.getEquipmentList({
          category: selectedCategory || undefined,
          status: selectedStatus || undefined,
          search: search || undefined,
        });
        setEquipment(data);
      } catch (err) {
        console.error('Feil ved lasting av utstyr:', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce søk
    const timer = setTimeout(loadEquipment, 300);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedStatus]);

  return (
    <div>
      <div className="page-header">
        <h2>Utstyr</h2>
        <p>Finn og lån utstyr</p>
      </div>

      {/* Søkefelt */}
      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Søk på navn, inventarnr..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Kategorifilter */}
      <div className="filter-chips">
        <button
          className={`filter-chip ${selectedCategory === '' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('')}
        >
          Alle
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`filter-chip ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() =>
              setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)
            }
          >
            {CATEGORY_LABELS[cat.name] || cat.name}
          </button>
        ))}
      </div>

      {/* Statusfilter */}
      <div className="filter-chips">
        <button
          className={`filter-chip ${selectedStatus === '' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('')}
        >
          Alle statuser
        </button>
        {Object.entries(EQUIPMENT_STATUS_CONFIG).map(([key, config]) => (
          <button
            key={key}
            className={`filter-chip ${selectedStatus === key ? 'active' : ''}`}
            onClick={() =>
              setSelectedStatus(selectedStatus === key ? '' : key)
            }
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Utstyrsliste */}
      {loading ? (
        <LoadingSpinner />
      ) : equipment.length === 0 ? (
        <EmptyState message="Ingen utstyr funnet" />
      ) : (
        <div className="equipment-grid">
          {equipment.map((item) => (
            <Link
              key={item.id}
              to={`/equipment/${item.id}`}
              className="equipment-card"
            >
              <div className="equipment-card-header">
                <div>
                  <div className="equipment-card-name">{item.name}</div>
                  <div className="equipment-card-tag">{item.asset_tag}</div>
                </div>
                <StatusBadge config={EQUIPMENT_STATUS_CONFIG[item.status]} />
              </div>
              <div className="equipment-card-meta">
                {item.location && (
                  <span>
                    <MapPin size={14} />
                    {item.location}
                  </span>
                )}
                {item.category && (
                  <span>
                    <Tag size={14} />
                    {CATEGORY_LABELS[item.category.name] || item.category.name}
                  </span>
                )}
              </div>
              {item.requires_booking && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-primary)',
                    fontWeight: 500,
                  }}
                >
                  Krever booking
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
