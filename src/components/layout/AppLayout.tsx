// =============================================================================
// AppLayout: Hovedlayout med header og bunnnavigasjon
// =============================================================================

import { Outlet, NavLink } from 'react-router-dom';
import { Home, Package, Calendar, ClipboardList, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const isManagerOrAdmin = profile?.role === 'manager' || profile?.role === 'admin';

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>⚙️ Utstyrsbooking</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            <User size={14} style={{ verticalAlign: 'middle' }} />{' '}
            {profile?.full_name}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={signOut}
            title="Logg ut"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="app-nav">
        <NavLink
          to="/"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          end
        >
          <Home size={22} />
          <span>Hjem</span>
        </NavLink>
        <NavLink
          to="/equipment"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Package size={22} />
          <span>Utstyr</span>
        </NavLink>
        <NavLink
          to="/bookings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Calendar size={22} />
          <span>Booking</span>
        </NavLink>
        <NavLink
          to="/my-items"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <ClipboardList size={22} />
          <span>Mine</span>
        </NavLink>
        {isManagerOrAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Settings size={22} />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}
