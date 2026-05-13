import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

const NAV_LINKS = [
  { to: '/', label: '🏠 Home', end: true },
  { to: '/howtoplay', label: '📘 How to Play' },
  { to: '/members', label: '👤 Members' },
  { to: '/composition', label: '🛡️ Composition' },
  { to: '/missions', label: '⚔️ Missions' },
  { to: '/recruits', label: '📋 Recruits' },
  { to: '/buildings', label: '🏗️ Buildings' },
  { to: '/equipment', label: '🎒 Equipment' },
  { to: '/save', label: '💾 Save' },  { to: '/rules', label: '📖 Rules' },
  { to: '/balance', label: '⚖️ Balance' },  { to: '/credits', label: '📜 Credits' },
  { to: '/ruleengine', label: '🤖 Rule Engine' },
];

if (!import.meta.env.PROD) {
  NAV_LINKS.push({ to: '/admin', label: '🔧 Admin' });
  NAV_LINKS.push({ to: '/devanalysis', label: '🔬 Dev Analysis' });
}

export default function Layout() {
  const mbase = useGameStore(s => s.mbase);
  const maidens = useGameStore(s => s.maidens);
  const combatLocked = useGameStore(s => s.combatLocked);
  const bedOccupancy = maidens.filter(m => !m.isFallen).length;
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <aside style={{
        display: isHome ? 'none' : 'flex',
        width: 180,
        flexShrink: 0,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        flexDirection: 'column',
        padding: '16px 0',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* Title */}
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Waelfeld</div>
          <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--color-accent)' }}>Maegdena</div>
        </div>

        {/* Currency HUD */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 12 }}>
          <CurrencyRow icon="💰" label="Gold" value={mbase.money} />
          <CurrencyRow icon="🍞" label="Food" value={mbase.food} />
          <CurrencyRow icon="🪵" label="Wood" value={mbase.wood} />
          <CurrencyRow icon="⚙️" label="Metal" value={mbase.metal} />
          <CurrencyRow icon="🛏️" label="Beds" value={`${bedOccupancy}/${mbase.beds}`} />
        </div>

        {/* Navigation */}
        <nav style={{ padding: '8px 0', flex: 1 }}>
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={combatLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}
              title={combatLocked ? 'Complete or abort the current combat first' : undefined}
              style={({ isActive }) => ({
                display: 'block',
                padding: '8px 16px',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                background: isActive ? 'rgba(200,149,74,0.12)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
                textDecoration: 'none',
                fontSize: 13,
                transition: 'all 0.15s',
                opacity: combatLocked && !isActive ? 0.4 : 1,
                cursor: combatLocked ? 'not-allowed' : 'pointer',
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Base name */}
        <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
          📍 {mbase.name}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: isHome ? 'hidden' : 'auto', padding: isHome ? 0 : 24, minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  );
}

function CurrencyRow({ icon, label, value }: { icon: string; label: string; value: number | string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{icon} {label}</span>
      <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}
