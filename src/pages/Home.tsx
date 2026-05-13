import { Link } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { getMaidenPortrait } from '../utils/portraits';

const NAV_SHORTCUTS = [
  { to: '/howtoplay',   icon: '📘', label: 'How to Play' },
  { to: '/members',    icon: '👤', label: 'Members' },
  { to: '/composition',icon: '🛡️', label: 'Composition' },
  { to: '/missions',   icon: '⚔️', label: 'Missions' },
  { to: '/recruits',   icon: '📋', label: 'Recruits' },
  { to: '/buildings',  icon: '🏗️', label: 'Buildings' },
  { to: '/save',       icon: '💾', label: 'Save' },
  { to: '/rules',      icon: '📖', label: 'Rules' },
  { to: '/credits',    icon: '📜', label: 'Credits' },
  ...(!import.meta.env.PROD ? [{ to: '/admin', icon: '🔧', label: 'Admin' }] : []),
];

const RESOURCES = [
  { icon: '💰', label: 'Gold',    key: 'money' as const },
  { icon: '🍞', label: 'Food',    key: 'food'  as const },
  { icon: '🪵', label: 'Wood',    key: 'wood'  as const },
  { icon: '⚙️', label: 'Metal',  key: 'metal' as const },
];

export default function Home() {
  const { maidens, mbase } = useGameStore();
  const favourite = maidens.find(m => m.isFavourite) ?? maidens[0];
  const bedOccupancy = maidens.filter(m => !m.isFallen).length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      /* push down past the app header; adjust 48px if your header height differs */
      top: 48,
      overflow: 'hidden',
    }}>
      {/* ── Background portrait ── */}
      {favourite && (
        <img
          src={getMaidenPortrait(favourite.imgId)}
          alt=""
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            height: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            objectPosition: 'bottom center',
            filter: 'drop-shadow(0 0 60px rgba(200,149,74,0.25))',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* ── Top resource bar ── */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        background: 'rgba(14,13,11,0.72)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '6px 14px',
        zIndex: 10,
        backdropFilter: 'blur(6px)',
      }}>
        {RESOURCES.map(r => (
          <div
            key={r.key}
            title={`${r.label}: ${mbase[r.key]}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', cursor: 'default' }}
          >
            <span style={{ fontSize: 15 }}>{r.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-text)' }}>{mbase[r.key]}</span>
          </div>
        ))}
        <div
          title={`Beds occupied: ${bedOccupancy} / ${mbase.beds}`}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', cursor: 'default', borderLeft: '1px solid var(--color-border)', marginLeft: 4 }}
        >
          <span style={{ fontSize: 15 }}>🛏️</span>
          <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-text)' }}>{bedOccupancy}/{mbase.beds}</span>
        </div>
      </div>

      {/* ── Left nav column ── */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 180,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        zIndex: 10,
        background: 'rgba(14,13,11,0.72)',
        borderRight: '1px solid var(--color-border)',
        backdropFilter: 'blur(6px)',
        padding: '8px 0',
        overflowY: 'auto',
      }}>
        {NAV_SHORTCUTS.slice(0, Math.ceil(NAV_SHORTCUTS.length / 2)).map(s => (
          <NavButton key={s.to} to={s.to} icon={s.icon} label={s.label} />
        ))}
      </div>

      {/* ── Right nav column ── */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 180,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        zIndex: 10,
        background: 'rgba(14,13,11,0.72)',
        borderLeft: '1px solid var(--color-border)',
        backdropFilter: 'blur(6px)',
        padding: '8px 0',
        overflowY: 'auto',
      }}>
        {NAV_SHORTCUTS.slice(Math.ceil(NAV_SHORTCUTS.length / 2)).map(s => (
          <NavButton key={s.to} to={s.to} icon={s.icon} label={s.label} align="right" />
        ))}
      </div>
    </div>
  );
}

function NavButton({ to, icon, label, align = 'left' }: { to: string; icon: string; label: string; align?: 'left' | 'right' }) {
  const isRight = align === 'right';
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: isRight ? 'row-reverse' : 'row',
        gap: 8,
        background: 'transparent',
        border: 'none',
        borderLeft: isRight ? 'none' : '3px solid transparent',
        borderRight: isRight ? '3px solid transparent' : 'none',
        padding: '8px 16px',
        color: 'var(--color-text)',
        textDecoration: 'none',
        fontSize: 13,
        transition: 'border-color 0.15s, background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => {
        if (isRight) e.currentTarget.style.borderRightColor = 'var(--color-accent)';
        else e.currentTarget.style.borderLeftColor = 'var(--color-accent)';
        e.currentTarget.style.background = 'rgba(200,149,74,0.12)';
        e.currentTarget.style.color = 'var(--color-accent)';
      }}
      onMouseLeave={e => {
        if (isRight) e.currentTarget.style.borderRightColor = 'transparent';
        else e.currentTarget.style.borderLeftColor = 'transparent';
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--color-text)';
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

