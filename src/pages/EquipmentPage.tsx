import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Equipment } from '../types/equipment';

// ── Slot display helpers ───────────────────────────────────────────────────────
const SLOT_LABELS: Record<string, string> = {
  weapon: '🔫 Weapon',
  head: '🪖 Head',
  body: '🧥 Body',
  legs: '👢 Legs',
  accessory: '🔭 Accessory',
  medal: '🎖️ Medal',
  consumable: '🧪 Consumable',
};

const SLOT_ORDER = ['weapon', 'head', 'body', 'legs', 'accessory', 'medal', 'consumable'];

const WEAPON_TYPE_LABELS: Record<string, string> = {
  rifle: 'Rifle',
  shotgun: 'Shotgun',
  machine_gun: 'Machine Gun',
  smg: 'SMG',
  sniper_rifle: 'Sniper Rifle',
  pistol: 'Pistol',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EquipmentPage() {
  const inventory = useGameStore(s => s.inventory);
  const maidens = useGameStore(s => s.maidens);

  const [selected, setSelected] = useState<Equipment | null>(null);
  const [filterSlot, setFilterSlot] = useState<string>('all');

  // Aggregate: each unique id -> count in base stock + count on maidens
  const stockMap = new Map<string, { item: Equipment; baseCount: number; equippedCount: number; lockedCount: number }>();

  // Base inventory
  for (const eq of inventory) {
    const existing = stockMap.get(eq.id);
    if (existing) {
      existing.baseCount++;
      if (eq.isLocked) existing.lockedCount++;
    } else {
      stockMap.set(eq.id, { item: eq, baseCount: 1, equippedCount: 0, lockedCount: eq.isLocked ? 1 : 0 });
    }
  }

  // Equipped on maidens
  for (const maiden of maidens.filter(m => !m.isFallen)) {
    for (const eq of maiden.equipment) {
      const existing = stockMap.get(eq.id);
      if (existing) {
        existing.equippedCount++;
      } else {
        stockMap.set(eq.id, { item: eq, baseCount: 0, equippedCount: 1 });
      }
    }
  }

  const allEntries = [...stockMap.values()].filter(e => e.item.faction !== 'enemy');

  const filtered = filterSlot === 'all'
    ? allEntries
    : allEntries.filter(e => e.item.slot === filterSlot);

  // Group by slot for display
  const grouped = SLOT_ORDER.reduce<Record<string, typeof allEntries>>((acc, slot) => {
    const items = filtered.filter(e => e.item.slot === slot);
    if (items.length > 0) acc[slot] = items;
    return acc;
  }, {});

  return (
    <div style={{ padding: '0 0 32px' }}>
      <h2 style={{ marginBottom: 16 }}>🎒 Equipment</h2>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <FilterButton active={filterSlot === 'all'} onClick={() => setFilterSlot('all')} label="All" />
        {SLOT_ORDER.map(slot => (
          <FilterButton
            key={slot}
            active={filterSlot === slot}
            onClick={() => setFilterSlot(slot)}
            label={SLOT_LABELS[slot] ?? slot}
          />
        ))}
      </div>

      {allEntries.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>No equipment in base or on maidens.</p>
      )}

      {Object.entries(grouped).map(([slot, entries]) => (
        <div key={slot} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            {SLOT_LABELS[slot] ?? slot}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {entries.map(({ item, baseCount, equippedCount, lockedCount }) => (
              <EquipmentCard
                key={item.inventoryId ?? item.id}
                item={item}
                baseCount={baseCount}
                equippedCount={equippedCount}
                lockedCount={lockedCount ?? 0}
                onClick={() => setSelected(item)}
              />
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <EquipmentDetailModal
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ── Filter Button ─────────────────────────────────────────────────────────────
function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        fontSize: 12,
        borderRadius: 4,
        border: '1px solid var(--color-border)',
        background: active ? 'var(--color-accent)' : 'var(--color-surface)',
        color: active ? '#000' : 'var(--color-text)',
        cursor: 'pointer',
        fontWeight: active ? 700 : 400,
      }}
    >
      {label}
    </button>
  );
}

// ── Equipment Card ────────────────────────────────────────────────────────────
function EquipmentCard({
  item,
  baseCount,
  equippedCount,
  lockedCount,
  onClick,
}: {
  item: Equipment;
  baseCount: number;
  equippedCount: number;
  lockedCount: number;
  onClick: () => void;
}) {
  const total = baseCount + equippedCount;
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${item.isRare ? '#c0392b' : 'var(--color-border)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = item.isRare ? '#c0392b' : 'var(--color-border)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: item.isRare ? '#e74c3c' : 'var(--color-text)' }}>
          {item.isRare && '⭐ '}{item.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', marginLeft: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          {lockedCount > 0 && <span title={`${lockedCount} locked`} style={{ fontSize: 12 }}>🔒</span>}
          ×{total}
        </span>
      </div>
      {item.weaponType && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>
          {WEAPON_TYPE_LABELS[item.weaponType] ?? item.weaponType}
          {item.shotsPerRound && item.shotsPerRound > 1 && ` · ${item.shotsPerRound} shots/turn`}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {item.damage !== undefined && (
          <StatChip label={`⚔️ ${item.damage} dmg`} color="var(--color-accent)" />
        )}
        {item.hitRateBonus !== undefined && item.hitRateBonus !== 0 && (
          <StatChip
            label={`🎯 ×${(1 + item.hitRateBonus / 100).toFixed(2)} hit`}
            color={item.hitRateBonus >= 0 ? '#27ae60' : '#e74c3c'}
          />
        )}
        {item.bonuses.map((b, i) => (
          <StatChip
            key={i}
            label={`${b.label}: ${b.value > 0 ? '+' : ''}${b.value}${b.isPercent ? '%' : ''}`}
            color={b.value >= 0 ? '#27ae60' : '#e74c3c'}
          />
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
        {baseCount > 0 && <span>🏠 {baseCount} in stock</span>}
        {baseCount > 0 && equippedCount > 0 && <span style={{ margin: '0 4px' }}>·</span>}
        {equippedCount > 0 && <span>👤 {equippedCount} equipped</span>}
      </div>
    </button>
  );
}

function StatChip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10,
      padding: '1px 6px',
      borderRadius: 4,
      background: `${color}22`,
      color,
      border: `1px solid ${color}55`,
      fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function EquipmentDetailModal({ item, onClose }: { item: Equipment; onClose: () => void }) {
  const maidens = useGameStore(s => s.maidens);
  const inventory = useGameStore(s => s.inventory);
  const toggleItemLock = useGameStore(s => s.toggleItemLock);

  const equippedBy = maidens
    .filter(m => !m.isFallen && m.equipment.some(e => e.id === item.id))
    .map(m => m.nickname ?? m.name);

  const inStockInstances = inventory.filter(e => e.id === item.id);
  const inStock = inStockInstances.length;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          border: `1px solid ${item.isRare ? '#c0392b' : 'var(--color-border)'}`,
          borderRadius: 10,
          padding: 24,
          maxWidth: 480,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: item.isRare ? '#e74c3c' : 'var(--color-text)' }}>
              {item.isRare && '⭐ '}{item.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {SLOT_LABELS[item.slot] ?? item.slot}
              {item.weaponType && ` · ${WEAPON_TYPE_LABELS[item.weaponType] ?? item.weaponType}`}
              {item.isRare && ' · Rare'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 0 0 12px' }}
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
          {item.description}
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', marginBottom: 16 }} />

        {/* Stats section */}
        {item.slot === 'weapon' && (
          <Section title="Combat Stats">
            <StatRow label="Damage per shot" value={`${item.damage ?? '—'}`} />
            {item.shotsPerRound && item.shotsPerRound > 1 && (
              <StatRow label="Shots per turn (burst)" value={`${item.shotsPerRound}`} />
            )}
            {item.shotsPerRound && item.shotsPerRound > 1 && (
              <StatRow
                label="Max damage per turn"
                value={`${(item.damage ?? 0) * item.shotsPerRound}`}
                note="If all burst shots hit"
              />
            )}
            {item.hitRateBonus !== undefined && item.hitRateBonus !== 0 && (
              <StatRow
                label="Hit rate multiplier"
                value={`×${(1 + item.hitRateBonus / 100).toFixed(2)}  (${item.hitRateBonus > 0 ? '+' : ''}${item.hitRateBonus}%)`}
                positive={item.hitRateBonus >= 0}
                note="Multiplies the additive subtotal after all other bonuses"
              />
            )}
            {item.shotsPerRound && item.shotsPerRound > 1 && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--color-bg)', borderRadius: 6, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                💡 Each burst shot independently rolls hit chance and cover block against the same target. The burst stops early if the target is defeated.
              </div>
            )}
          </Section>
        )}

        {item.bonuses.length > 0 && (
          <Section title="Attribute Bonuses">
            {item.bonuses.map((b, i) => (
              <StatRow
                key={i}
                label={b.label}
                value={`${b.value >= 0 ? '+' : ''}${b.value}${b.isPercent ? '%' : ''}`}
                positive={b.value >= 0}
              />
            ))}
          </Section>
        )}

        {item.price !== undefined && (
          <Section title="Economy">
            <StatRow label="Market price" value={`💰 ${item.price}`} />
            <StatRow label="Sell value" value={`💰 ${Math.floor(item.price * 0.5)}`} note="50% of price" />
            {item.craftable && item.craftCost && (
              <>
                <StatRow label="Craftable (Factory tier)" value={`${item.craftTier ?? '?'}`} />
                <StatRow label="Craft cost" value={[
                  item.craftCost.money > 0 ? `💰 ${item.craftCost.money}` : '',
                  item.craftCost.wood > 0 ? `🪵 ${item.craftCost.wood}` : '',
                  item.craftCost.metal > 0 ? `⚙️ ${item.craftCost.metal}` : '',
                ].filter(Boolean).join('  ')} />
              </>
            )}
          </Section>
        )}

        {/* Ownership */}
        <Section title="Inventory">
          <StatRow label="In base stock" value={`${inStock}`} />
          {equippedBy.length > 0 && (
            <StatRow label="Equipped by" value={equippedBy.join(', ')} />
          )}
          {inStockInstances.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                🔒 Lock items to prevent accidental selling at the Radio Center.
              </div>
              {inStockInstances.map((inst, i) => (
                <div key={inst.inventoryId ?? `${inst.id}_${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Copy #{i + 1}</span>
                  <button
                    onClick={() => toggleItemLock(inst.inventoryId ?? inst.id)}
                    title={inst.isLocked ? 'Unlock (allow selling)' : 'Lock (prevent selling)'}
                    style={{ background: inst.isLocked ? 'rgba(200,149,74,0.15)' : 'none', border: `1px solid ${inst.isLocked ? 'var(--color-accent-dark)' : 'var(--color-border)'}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: inst.isLocked ? 'var(--color-accent)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {inst.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function StatRow({ label, value, note, positive }: { label: string; value: string; note?: string; positive?: boolean }) {
  const valueColor = positive === undefined ? 'var(--color-text)' : positive ? '#27ae60' : '#e74c3c';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, gap: 8 }}>
      <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, textAlign: 'right' }}>
        <span style={{ fontWeight: 600, color: valueColor }}>{value}</span>
        {note && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>({note})</span>}
      </span>
    </div>
  );
}
