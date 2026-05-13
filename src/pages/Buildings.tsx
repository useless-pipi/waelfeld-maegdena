import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Equipment } from '../types/equipment';
import equipmentData from '../data/equipment.json';
import { theoryLv, practicalLv } from '../engine/combat';
import { computeForceStrengthIndex } from '../engine/missionGen';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const allEquipment = (equipmentData as Equipment[]).filter(e => !e.faction);
const craftableItems = allEquipment.filter(e => e.craftable);

export default function Buildings() {
  const { mbase, setMBase, buildings, setBuilding, maidens, inventory,
    craftEquipment, buyHQEquipment, sellEquipment, toggleItemLock, meridianStats } = useGameStore();
  const [openBuildingId, setOpenBuildingId] = useState<string | null>(null);

  function upgrade(buildingId: string) {
    const b = buildings.find(x => x.id === buildingId);
    if (!b || b.currentLevel >= b.maxLevel) return;
    const nextLevel = b.levels[b.currentLevel];
    if (!nextLevel) return;
    if (mbase.money < nextLevel.costMoney || mbase.wood < nextLevel.costWood || mbase.metal < nextLevel.costMetal) return;
    setMBase({
      money: mbase.money - nextLevel.costMoney,
      wood: mbase.wood - nextLevel.costWood,
      metal: mbase.metal - nextLevel.costMetal,
    });
    const newLevel = b.currentLevel + 1;
    setBuilding(buildingId, { currentLevel: newLevel, isConstructed: true });
    // Tent Block: update bed capacity when upgraded
    if (buildingId === 'tent_block') {
      const newLevelDef = b.levels[newLevel - 1];
      const beds = newLevelDef?.effectValue?.beds;
      if (beds) setMBase({ beds });
    }
  }

  const openBuilding = buildings.find(b => b.id === openBuildingId) ?? null;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>🏗�E�EBuildings</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {buildings.map(b => (
          <BuildingCard
            key={b.id}
            building={b}
            mbase={mbase}
            onUpgrade={() => upgrade(b.id)}
            onOpen={() => setOpenBuildingId(b.id)}
          />
        ))}
      </div>

      {openBuilding && (
        <div
          onClick={() => setOpenBuildingId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
            <BuildingModal
              building={openBuilding}
              mbase={mbase}
              maidens={maidens}
              inventory={inventory}
              buildings={buildings}
              onUpgrade={() => upgrade(openBuilding.id)}
              onCraft={craftEquipment}
              onBuyHQ={buyHQEquipment}
              onSell={sellEquipment}
              onToggleLock={toggleItemLock}
              onClose={() => setOpenBuildingId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Building Card ──────────────────────────────────────────────────────────────

const CHAR_ICON: Record<string, string> = {
  radio_center:     'shopi.png',
  the_meridian:     'adjudicatori.png',
  farm:             'farmeri.png',
  tent_block:       'housekeepi.png',
  field_hospital:   'nursei.png',
  training_grounds: 'traineri.png',
  factory:          'workeri.png',
};
const CHAR_FULL: Record<string, { file: string; label: string; quote: string }> = {
  radio_center:     { file: 'shop.png',       label: 'HQ Supply Officer',  quote: "...Whatever. Just pick something and get out.\nI didn't ask to be stationed here." },
  the_meridian:     { file: 'adjudicator.png',label: 'HQ Liaison Officer', quote: "Your record precedes you. Let's see if it still does." },
  farm:             { file: 'farmer.png',      label: 'Farm Manager',       quote: "Fields don't lie. Hard work feeds hard fighters." },
  tent_block:       { file: 'housekeep.png',   label: 'Housekeeper',        quote: "Beds are limited. Keep the headcount in check." },
  field_hospital:   { file: 'nurse.png',       label: 'Field Nurse',        quote: "Get some rest. You'll need it for the next one." },
  training_grounds: { file: 'trainer.png',     label: 'Drill Instructor',   quote: "Pain now means survival later. Keep pushing." },
  factory:          { file: 'worker.png',      label: 'Factory Worker',     quote: "Tell me what you need. I'll have it ready." },
};

function BuildingCard({ building, mbase, onUpgrade, onOpen }: any) {
  const currentLevel = building.levels[building.currentLevel - 1];
  const nextLevel = building.levels[building.currentLevel];
  const canUpgrade = nextLevel && mbase.money >= nextLevel.costMoney && mbase.wood >= nextLevel.costWood && mbase.metal >= nextLevel.costMetal;
  const iconFile = CHAR_ICON[building.id];

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
      <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: 4, fontSize: 15 }}>{building.name}</h3>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'capitalize' }}>{building.category}</div>
      {iconFile && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, marginTop: -4 }}>
          <img src={`${BASE}/imgs/chars/${iconFile}`} alt={building.name} style={{ height: 80, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }} />
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>{building.description}</div>

      {building.id !== 'the_meridian' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Level {building.currentLevel}/{building.maxLevel}</div>
          <div style={{ width: '100%', height: 6, background: '#0e0d0b', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div style={{ width: `${(building.currentLevel / building.maxLevel) * 100}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {currentLevel && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10, padding: 8, background: '#0e0d0b', borderRadius: 4 }}>
          {currentLevel.description}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {building.isConstructed && (
          <button onClick={onOpen} style={{ flex: 1, padding: '7px', background: 'rgba(200,149,74,0.15)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-dark)', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
            Manage
          </button>
        )}
        {nextLevel ? (
          <button onClick={onUpgrade} disabled={!canUpgrade} style={{ flex: 1, padding: '7px', background: canUpgrade ? 'var(--color-accent-dark)' : '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: canUpgrade ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 'bold' }}>
            Upgrade
          </button>
        ) : (
          <div style={{ flex: 1, fontSize: 11, color: 'var(--color-accent)', padding: '7px 8px', background: 'rgba(200,149,74,0.1)', borderRadius: 4, textAlign: 'center' }}>
            Max Level
          </div>
        )}
      </div>
      {nextLevel && (
        <div style={{ marginTop: 6, fontSize: 10, color: canUpgrade ? 'var(--color-text-muted)' : 'var(--color-danger)', display: 'flex', gap: 10, justifyContent: 'center' }}>
          <span style={{ color: mbase.money >= nextLevel.costMoney ? 'var(--color-text-muted)' : 'var(--color-danger)' }}>Gold {nextLevel.costMoney}</span>
          <span style={{ color: mbase.wood  >= nextLevel.costWood  ? 'var(--color-text-muted)' : 'var(--color-danger)' }}>Wood {nextLevel.costWood}</span>
          <span style={{ color: mbase.metal >= nextLevel.costMetal ? 'var(--color-text-muted)' : 'var(--color-danger)' }}>Metal {nextLevel.costMetal}</span>
        </div>
      )}
    </div>
  );
}

// ── Building Modal dispatcher ─────────────────────────────────────────────────

function BuildingModal({ building, mbase, maidens, inventory, buildings, onUpgrade, onCraft, onBuyHQ, onSell, onToggleLock, onClose }: any) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-accent)', borderRadius: 10, padding: 24, boxShadow: '0 12px 48px rgba(0,0,0,0.8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: 'var(--color-accent)', margin: 0 }}>{building.name}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 20 }}>X</button>
      </div>

      {building.id === 'tent_block' && <TentBlockPanel building={building} mbase={mbase} maidens={maidens} onUpgrade={onUpgrade} />}
      {building.id === 'field_hospital' && <FieldHospitalPanel building={building} maidens={maidens} onUpgrade={onUpgrade} mbase={mbase} />}
      {building.id === 'factory' && <FactoryPanel building={building} mbase={mbase} onCraft={onCraft} onUpgrade={onUpgrade} />}
      {building.id === 'radio_center' && <RadioCenterPanel building={building} mbase={mbase} inventory={inventory} onBuyHQ={onBuyHQ} onSell={onSell} onToggleLock={onToggleLock} onUpgrade={onUpgrade} />}
      {building.id === 'training_grounds' && <TrainingGroundsPanel building={building} maidens={maidens} buildings={buildings} onUpgrade={onUpgrade} mbase={mbase} />}
      {building.id === 'farm' && <FarmPanel building={building} mbase={mbase} onUpgrade={onUpgrade} />}
      {building.id === 'the_meridian' && <MeridianPanel building={building} />}
    </div>
  );
}

// ── Upgrade strip ─────────────────────────────────────────────────────────────

function UpgradeStrip({ building, mbase, onUpgrade }: any) {
  const nextLevel = building.levels[building.currentLevel];
  if (!nextLevel) return (
    <div style={{ fontSize: 11, color: 'var(--color-accent)', padding: '8px', background: 'rgba(200,149,74,0.1)', borderRadius: 4, textAlign: 'center' }}>
      Building at maximum level
    </div>
  );
  const canAfford = mbase.money >= nextLevel.costMoney && mbase.wood >= nextLevel.costWood && mbase.metal >= nextLevel.costMetal;
  return (
    <div style={{ marginTop: 16, padding: 12, background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Upgrade to Level {building.currentLevel + 1}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{nextLevel.description}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <CostItem icon="Gold" label="Gold" cost={nextLevel.costMoney} have={mbase.money} />
        <CostItem icon="Wood" label="Wood" cost={nextLevel.costWood} have={mbase.wood} />
        <CostItem icon="Metal" label="Metal" cost={nextLevel.costMetal} have={mbase.metal} />
      </div>
      <button onClick={onUpgrade} disabled={!canAfford} style={{ width: '100%', padding: '8px', background: canAfford ? 'var(--color-accent-dark)' : '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: canAfford ? 'pointer' : 'not-allowed', fontSize: 12 }}>
        Upgrade
      </button>
    </div>
  );
}

function CostItem({ icon, label, cost, have }: any) {
  const ok = have >= cost;
  return (
    <div style={{ padding: 6, background: '#0e0d0b', border: `1px solid ${ok ? 'var(--color-border)' : 'var(--color-danger)'}`, borderRadius: 3, fontSize: 10 }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{icon} {label}</div>
      <div style={{ color: ok ? 'var(--color-text)' : 'var(--color-danger)', fontWeight: 'bold', marginTop: 2 }}>{cost}</div>
    </div>
  );
}

// ── Shared portrait column helper ─────────────────────────────────────────────

function CharColumn({ buildingId }: { buildingId: string }) {
  const char = CHAR_FULL[buildingId];
  if (!char) return null;
  return (
    <div style={{ width: 200, flexShrink: 0, background: '#0c0b09', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', overflow: 'hidden' }}>
      <img src={`${BASE}/imgs/chars/${char.file}`} alt={char.label} style={{ width: '100%', display: 'block', objectFit: 'cover', objectPosition: 'top center' }} />
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', background: '#0f0e0c' }}>
        <div style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 'bold', marginBottom: 6 }}>{char.label}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
          "{char.quote}"
        </div>
      </div>
    </div>
  );
}

// ── Panel: Tent Block ─────────────────────────────────────────────────────────

function TentBlockPanel({ building, mbase, maidens, onUpgrade }: any) {
  const currentLvDef = building.levels[building.currentLevel - 1];
  const beds = currentLvDef?.effectValue?.beds ?? mbase.beds;
  return (
    <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <CharColumn buildingId="tent_block" />
      <div style={{ flex: 1, minWidth: 0, padding: 16 }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>Provides sleeping quarters for your maidens. Capacity increases with upgrades. Fallen maidens <strong>do not</strong> occupy a bed; captured maidens <strong>do</strong>.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <StatBox label="Current Capacity" value={`${beds} maidens`} />
          <StatBox label="Currently Housed" value={`${maidens.filter((m: any) => !m.isFallen).length} maidens`} />
        </div>
        <UpgradeStrip building={building} mbase={mbase} onUpgrade={onUpgrade} />
      </div>
    </div>
  );
}

// ── Panel: Field Hospital ─────────────────────────────────────────────────────

function FieldHospitalPanel({ building, maidens, onUpgrade, mbase }: any) {
  const currentLvDef = building.levels[building.currentLevel - 1];
  const fraction: number = currentLvDef?.effectValue?.healFraction ?? 0;
  const injuredMaidens = maidens.filter((m: any) => !m.isFallen && m.currentHp < m.maxHp && m.currentHp > 0);

  return (
    <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <CharColumn buildingId="field_hospital" />
      <div style={{ flex: 1, minWidth: 0, padding: 16 }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
          Automatically recovers HP for injured maidens after each mission concludes.
        </p>
        <StatBox label="Heal per Mission" value={fraction > 0 ? `${Math.round(fraction * 100)}% of max HP` : 'Not active'} />
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Injured Maidens ({injuredMaidens.length})
          </div>
          {injuredMaidens.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: 8 }}>All maidens are at full health.</div>
          ) : injuredMaidens.map((m: any) => {
            const preview = Math.min(m.maxHp, m.currentHp + Math.floor(m.maxHp * fraction));
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text)' }}>{m.nickname ?? m.name}</div>
                <div style={{ fontSize: 11, color: '#e88' }}>{m.currentHp}/{m.maxHp} HP</div>
                {fraction > 0 && <div style={{ fontSize: 11, color: '#6ab06a' }}>→ {preview}/{m.maxHp}</div>}
              </div>
            );
          })}
        </div>
        <UpgradeStrip building={building} mbase={mbase} onUpgrade={onUpgrade} />
      </div>
    </div>
  );
}

// ── Panel: Factory ────────────────────────────────────────────────────────────

function FactoryPanel({ building, mbase, onCraft, onUpgrade }: any) {
  const tier: number = building.currentLevel;
  const available = craftableItems.filter(e => (e.craftTier ?? 1) <= tier);
  const locked = craftableItems.filter(e => (e.craftTier ?? 1) > tier);

  return (
    <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <CharColumn buildingId="factory" />
      <div style={{ flex: 1, minWidth: 0, padding: 16 }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
        Produce equipment using raw resources. Higher factory levels unlock better recipes.
      </p>
      <StatBox label="Factory Tier" value={`Tier ${tier} -- unlocks tier <=${tier} recipes`} />
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Craftable ({available.length})</div>
        {available.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No recipes available at this tier.</div>}
        {available.map(eq => {
          const cc = eq.craftCost!;
          const canCraft = mbase.money >= cc.money && mbase.wood >= cc.wood && mbase.metal >= cc.metal;
          return (
            <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 'bold' }}>{eq.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{eq.description}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Cost: 💰{cc.money} 🪵{cc.wood} ⚙️{cc.metal}
                </div>
                {eq.damage !== undefined && <span style={{ fontSize: 10, color: '#e8a85a', marginRight: 6 }}>DMG {eq.damage}</span>}
                {eq.bonuses.map((b: any, i: number) => (
                  <span key={i} style={{ fontSize: 10, color: b.value >= 0 ? '#6ab06a' : '#c06060', marginRight: 4 }}>
                    {b.label}: {b.value > 0 ? '+' : ''}{b.value}{b.isPercent ? '%' : ''}
                  </span>
                ))}
              </div>
              <button onClick={() => onCraft(eq.id)} disabled={!canCraft} style={{ padding: '6px 12px', background: canCraft ? 'var(--color-accent-dark)' : '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: canCraft ? 'pointer' : 'not-allowed', fontSize: 12, flexShrink: 0 }}>
                Craft
              </button>
            </div>
          );
        })}
        {locked.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Locked ({locked.length})</div>
            {locked.map(eq => (
              <div key={eq.id} style={{ fontSize: 12, color: '#555', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                🔒 {eq.name}  ERequires Factory Tier {eq.craftTier}
              </div>
            ))}
          </div>
        )}
      </div>
      <UpgradeStrip building={building} mbase={mbase} onUpgrade={onUpgrade} />
      </div>
    </div>
  );
}

// ── Panel: Radio Center ───────────────────────────────────────────────────────

const TIER_LABEL: Record<number, string> = {
  1: 'Standard Field Gear', 2: 'Improved Issue', 3: 'Professional Grade',
  4: 'Specialist Gear', 5: 'Heavy Field Equipment', 6: 'Elite Assault Gear',
  7: 'Advanced Tactical', 8: 'Rare HQ Supply', 9: 'Legendary Gear', 10: 'Epic — Game-changing',
};

const tradeBtn: React.CSSProperties = {
  padding: '3px 9px', fontSize: 12, background: 'transparent',
  border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
  borderRadius: 4, cursor: 'pointer',
};

function RadioCenterPanel({ building, mbase, inventory, onBuyHQ, onSell, onToggleLock, onUpgrade }: any) {
  const [tab, setTab] = useState<'shop' | 'sell' | 'trade'>('shop');
  const [tradeFood, setTradeFood]   = useState(0);
  const [tradeWood, setTradeWood]   = useState(0);
  const setMBase = useGameStore(s => s.setMBase);
  const hqShopItems   = useGameStore(s => s.hqShopItems ?? []);
  const refreshHQShop = useGameStore(s => s.refreshHQShop);

  const TRADE_RATE = 2; // gold per 1 food or 1 wood
  const tradeCost  = (tradeFood + tradeWood) * TRADE_RATE;
  const canTrade   = tradeCost > 0 && mbase.money >= tradeCost;

  function executeTrade() {
    if (!canTrade) return;
    setMBase({
      money: mbase.money - tradeCost,
      food:  (mbase.food  ?? 0) + tradeFood,
      wood:  (mbase.wood  ?? 0) + tradeWood,
    });
    setTradeFood(0);
    setTradeWood(0);
  }

  const tier        = building.currentLevel as number;
  // Exponential refresh cost: tier² × 50
  // tier 1 → 50, tier 3 → 450, tier 5 → 1250, tier 7 → 2450, tier 10 → 5000
  const refreshCost = tier * tier * 50;
  const canRefresh  = mbase.money >= refreshCost;

  // Auto-generate the shop the first time the panel opens
  useEffect(() => {
    if (hqShopItems.length === 0) refreshHQShop(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shopItems = hqShopItems
    .map(id => allEquipment.find(e => e.id === id))
    .filter((e): e is Equipment => !!e);

  return (
    /* Two-column layout: portrait left, all content right — mirrors MaidenModal */
    <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>

      {/* ── Portrait column ─────────────────────────────────────────────── */}
      <div style={{
        width: 200, flexShrink: 0,
        background: '#0c0b09',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'stretch',
        overflow: 'hidden',
      }}>
        <img
          src={`${BASE}/imgs/chars/shop.png`}
          alt="HQ Supply Officer"
          style={{
            width: '100%',
            display: 'block',
            objectFit: 'cover',
            objectPosition: 'top center',
          }}
        />
        {/* Name + dialogue pinned below image */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', background: '#0f0e0c' }}>
          <div style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 'bold', marginBottom: 6 }}>HQ Supply Officer</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
            "...Whatever. Just pick something and get out.<br />
            I didn't ask to be stationed here."
          </div>
        </div>
      </div>

      {/* ── Content column ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Description */}
        <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--color-border)' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
            Communications hub for Headquarters. Purchase equipment or liquidate your inventory.
            Higher levels unlock better gear.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
          {(['shop', 'sell', 'trade'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 13, background: tab === t ? 'rgba(200,149,74,0.1)' : 'transparent', color: tab === t ? 'var(--color-accent)' : 'var(--color-text-muted)', borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent' }}>
              {t === 'shop' ? 'HQ Shop' : t === 'sell' ? 'Sell Equipment' : '🔄 Trade'}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {tab === 'shop' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>Tier {tier}</span>
                  {' — '}{TIER_LABEL[tier] ?? 'HQ Supply'}
                  {' · '}{shopItems.length}/3 in stock
                </div>
                <button
                  onClick={() => refreshHQShop(refreshCost)}
                  disabled={!canRefresh}
                  title={`Request fresh stock from HQ`}
                  style={{ padding: '4px 10px', background: canRefresh ? 'rgba(200,149,74,0.2)' : '#333', color: canRefresh ? 'var(--color-accent)' : '#666', border: `1px solid ${canRefresh ? 'var(--color-accent-dark)' : '#444'}`, borderRadius: 4, cursor: canRefresh ? 'pointer' : 'not-allowed', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  New Stock (gold: {refreshCost})
                </button>
              </div>
              {shopItems.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '16px 0', textAlign: 'center' }}>
                  All items sold. Request new stock from HQ.
                </div>
              )}
              {shopItems.map(eq => {
                const canBuy = mbase.money >= (eq.price ?? 0)
                  && mbase.wood   >= (eq.hqExtraCost?.wood  ?? 0)
                  && mbase.metal  >= (eq.hqExtraCost?.metal ?? 0);
                return (
                  <div key={eq.id} style={{ padding: 10, marginBottom: 8, background: '#0e0d0b', border: `1px solid ${eq.isRare ? '#c84a4a' : 'var(--color-border)'}`, borderRadius: 6, boxShadow: eq.isRare ? '0 0 8px rgba(200,74,74,0.15)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: eq.isRare ? '#e88' : 'var(--color-text)', fontWeight: 'bold' }}>
                          {eq.isRare ? '* ' : ''}{eq.name}
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 'normal', marginLeft: 6, textTransform: 'capitalize' }}>{eq.slot}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{eq.description}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {eq.damage !== undefined && <span style={{ fontSize: 10, color: '#e8a85a' }}>DMG {eq.damage}</span>}
                          {eq.hitRateBonus !== undefined && eq.hitRateBonus !== 0 && <span style={{ fontSize: 10, color: eq.hitRateBonus > 0 ? '#6ab06a' : '#c06060' }}>Hit {eq.hitRateBonus > 0 ? '+' : ''}{eq.hitRateBonus}%</span>}
                          {(eq.shotsPerRound ?? 1) > 1 && <span style={{ fontSize: 10, color: '#aaa' }}>{eq.shotsPerRound}x burst</span>}
                          {eq.bonuses.map((b: any, i: number) => (
                            <span key={i} style={{ fontSize: 10, color: b.value >= 0 ? '#6ab06a' : '#c06060' }}>
                              {b.label}: {b.value > 0 ? '+' : ''}{b.value}{b.isPercent ? '%' : ''}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Gold: {eq.price ?? 0}
                          {eq.hqExtraCost?.wood  ? ` + Wood: ${eq.hqExtraCost.wood}`  : ''}
                          {eq.hqExtraCost?.metal ? ` + Metal: ${eq.hqExtraCost.metal}` : ''}
                        </div>
                      </div>
                      <button onClick={() => onBuyHQ(eq.id)} disabled={!canBuy} style={{ padding: '6px 12px', background: canBuy ? (eq.isRare ? '#c84a4a' : 'var(--color-accent-dark)') : '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: canBuy ? 'pointer' : 'not-allowed', fontSize: 12, flexShrink: 0 }}>
                        Buy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'trade' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
                Exchange gold for field supplies via HQ logistics.<br />
                <strong style={{ color: 'var(--color-accent)' }}>Rate: 4 gold = 1 food &nbsp;|&nbsp; 4 gold = 1 wood</strong>
              </p>

              {/* Food row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--color-text)', width: 60 }}>🍖 Food</span>
                <button onClick={() => setTradeFood(Math.max(0, tradeFood - 10))} style={tradeBtn}>−10</button>
                <button onClick={() => setTradeFood(Math.max(0, tradeFood - 1))}  style={tradeBtn}>−1</button>
                <input
                  type="number" min={0} value={tradeFood}
                  onChange={e => setTradeFood(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: 64, textAlign: 'center', background: '#0e0d0b', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 4, padding: '4px 6px', fontSize: 13 }}
                />
                <button onClick={() => setTradeFood(tradeFood + 1)}  style={tradeBtn}>+1</button>
                <button onClick={() => setTradeFood(tradeFood + 10)} style={tradeBtn}>+10</button>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                  = {tradeFood * TRADE_RATE} 💰
                </span>
              </div>

              {/* Wood row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ fontSize: 13, color: 'var(--color-text)', width: 60 }}>🪵 Wood</span>
                <button onClick={() => setTradeWood(Math.max(0, tradeWood - 10))} style={tradeBtn}>−10</button>
                <button onClick={() => setTradeWood(Math.max(0, tradeWood - 1))}  style={tradeBtn}>−1</button>
                <input
                  type="number" min={0} value={tradeWood}
                  onChange={e => setTradeWood(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: 64, textAlign: 'center', background: '#0e0d0b', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 4, padding: '4px 6px', fontSize: 13 }}
                />
                <button onClick={() => setTradeWood(tradeWood + 1)}  style={tradeBtn}>+1</button>
                <button onClick={() => setTradeWood(tradeWood + 10)} style={tradeBtn}>+10</button>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                  = {tradeWood * TRADE_RATE} 💰
                </span>
              </div>

              {/* Summary + confirm */}
              <div style={{ padding: '10px 14px', background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  Total cost: <strong style={{ color: tradeCost > mbase.money ? '#c06060' : 'var(--color-accent)' }}>{tradeCost} 💰</strong>
                  &nbsp;(have {mbase.money} 💰)
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  You receive: <strong style={{ color: 'var(--color-text)' }}>{tradeFood} 🍖 &nbsp;+&nbsp; {tradeWood} 🪵</strong>
                </div>
              </div>

              <button
                onClick={executeTrade}
                disabled={!canTrade}
                style={{ padding: '7px 20px', background: canTrade ? 'var(--color-accent-dark)' : '#333', color: canTrade ? '#fff' : '#666', border: 'none', borderRadius: 4, cursor: canTrade ? 'pointer' : 'not-allowed', fontSize: 13 }}
              >
                Confirm Trade
              </button>

              {tradeCost > 0 && !canTrade && (
                <div style={{ fontSize: 11, color: '#c06060', marginTop: 8 }}>Not enough gold.</div>
              )}
            </div>
          )}

          {tab === 'sell' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                Sell equipment from your inventory at 50% of market price. 🔒 Locked items cannot be sold.
              </div>
              {inventory.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Your inventory is empty.</div>}
              {inventory.map((eq: Equipment) => {
                const sellPrice = Math.floor((eq.price ?? 0) * 0.5);
                const locked = !!eq.isLocked;
                return (
                  <div key={eq.inventoryId ?? eq.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--color-border)', opacity: locked ? 0.7 : 1 }}>
                    <button
                      onClick={() => onToggleLock(eq.inventoryId ?? eq.id)}
                      title={locked ? 'Unlock item (allow selling)' : 'Lock item (prevent selling)'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 2px', lineHeight: 1, color: locked ? '#e8a85a' : '#555', flexShrink: 0 }}
                    >
                      {locked ? '🔒' : '🔓'}
                    </button>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, color: eq.isRare ? '#e88' : 'var(--color-text)', fontWeight: eq.isRare ? 'bold' : 'normal' }}>
                        {eq.isRare ? '* ' : ''}{eq.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>{eq.slot}</span>
                    </div>
                    <div style={{ fontSize: 12, color: locked ? 'var(--color-text-muted)' : '#6ab06a', marginRight: 8 }}>Gold: {sellPrice}</div>
                    <button
                      onClick={() => !locked && onSell(eq.inventoryId ?? eq.id)}
                      disabled={locked}
                      title={locked ? 'Unlock this item first to sell it' : undefined}
                      style={{ padding: '4px 10px', background: locked ? '#222' : '#3a3328', color: locked ? '#555' : 'var(--color-text-muted)', border: `1px solid ${locked ? '#333' : 'var(--color-border)'}`, borderRadius: 4, cursor: locked ? 'not-allowed' : 'pointer', fontSize: 11 }}
                    >
                      {locked ? '🔒' : 'Sell'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <UpgradeStrip building={building} mbase={mbase} onUpgrade={onUpgrade} />
        </div>
      </div>
    </div>
  );
}

// ── Panel: Training Grounds ───────────────────────────────────────────────────

function TrainingGroundsPanel({ building, maidens, onUpgrade, mbase }: any) {
  const currentLvDef = building.levels[building.currentLevel - 1];
  const theoryExpGrant: number = currentLvDef?.effectValue?.theoryExp ?? 0;
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <CharColumn buildingId="training_grounds" />
      <div style={{ flex: 1, minWidth: 0, padding: 16 }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
        Improves maiden skills through structured drills. Theory EXP is awarded to all off-mission maidens after each mission concludes.
      </p>
      <StatBox label="Theory EXP per Mission" value={theoryExpGrant > 0 ? `${theoryExpGrant} EXP (all subjects)` : 'Not active'} />

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Maiden EXP Overview</div>
        {maidens.filter((m: any) => !m.isFallen).map((m: any) => {
          const exp = m.expData ?? { weapons: {}, scout: { theoryExp: 0, practicalExp: 0 }, sneak: { theoryExp: 0, practicalExp: 0 } };
          const isOpen = expanded === m.id;
          return (
            <div key={m.id} style={{ marginBottom: 4, border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded(isOpen ? null : m.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', background: '#0e0d0b' }}
              >
                <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text)' }}>{m.nickname ?? m.name}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                  Scout Lv {theoryLv(exp.scout.theoryExp)}+{practicalLv(exp.scout.practicalExp)} &nbsp;
                  Sneak Lv {theoryLv(exp.sneak.theoryExp)}+{practicalLv(exp.sneak.practicalExp)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{isOpen ? '▲' : '▼'}</div>
              </div>
              {isOpen && (
                <div style={{ padding: '8px 10px', background: '#111', fontSize: 11, color: 'var(--color-text-muted)' }}>
                  <ExpRow label="Scout" exp={exp.scout} />
                  <ExpRow label="Sneak" exp={exp.sneak} />
                  {Object.entries(exp.weapons).map(([wt, wexp]: any) => (
                    <ExpRow key={wt} label={`Weapon: ${wt}`} exp={wexp} />
                  ))}
                  {Object.keys(exp.weapons).length === 0 && (
                    <div style={{ color: '#555' }}>No weapon EXP yet.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <UpgradeStrip building={building} mbase={mbase} onUpgrade={onUpgrade} />
      </div>
    </div>
  );
}

// ── Panel: Farm ─────────────────────────────────────────────────────

function FarmPanel({ building, mbase, onUpgrade }: any) {
  const currentLvDef = building.levels[building.currentLevel - 1];
  const foodPerMission: number = currentLvDef?.effectValue?.food ?? 0;
  const FOOD_BY_LEVEL = [150, 200, 300, 400];
  return (
    <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <CharColumn buildingId="farm" />
      <div style={{ flex: 1, minWidth: 0, padding: 16 }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
        Produces food after every concluded mission, regardless of outcome.
        Higher levels dramatically increase yield.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <StatBox label="Food per Mission" value={`+${foodPerMission}`} />
        <StatBox label="Current Food" value={`${mbase.food ?? 0}`} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Yield by Level</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {FOOD_BY_LEVEL.map((food, i) => (
            <div key={i} style={{
              padding: '6px 8px', borderRadius: 4, textAlign: 'center',
              background: building.currentLevel === i + 1 ? 'rgba(200,149,74,0.18)' : '#0e0d0b',
              border: `1px solid ${building.currentLevel === i + 1 ? 'var(--color-accent-dark)' : 'var(--color-border)'}`,
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>Lv {i + 1}</div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: building.currentLevel === i + 1 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>+{food}</div>
            </div>
          ))}
        </div>
      </div>
      <UpgradeStrip building={building} mbase={mbase} onUpgrade={onUpgrade} />
      </div>
    </div>
  );
}

// ── Panel: The Meridian ───────────────────────────────────────────────────────

function MeridianTooltip({ children, lines }: { children: React.ReactNode; lines: React.ReactNode[] }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: 'relative', cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1a14', border: '1px solid var(--color-accent-dark)', borderRadius: 6,
          padding: '10px 13px', fontSize: 11, color: 'var(--color-text)',
          zIndex: 2000, width: 270, boxShadow: '0 6px 24px rgba(0,0,0,0.9)',
          pointerEvents: 'none', whiteSpace: 'normal', lineHeight: 1.65, textAlign: 'left',
        }}>
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

function generateLiaisonDialogue(
  totalKills: number,
  worstDeathRate: number,
  avgDeathRate: number,
  finalMult: number,
  totalDone: number,
  recentCount: number,
): string {
  if (recentCount === 0) {
    return "I've reviewed your file. No missions on record yet. Return after your first operation and I will have something to say.";
  }
  if (worstDeathRate >= 1.0) {
    const lines = [
      "A complete wipe. Every maiden deployed on that mission — gone. No number of victories before or after can erase that from your record. Headquarters is watching.",
      "I don't care how many enemies you've killed. You sent a whole squad to their deaths. That is not acceptable. HQ has noted this accordingly.",
      "The girls trust you with their lives. One of your recent operations returned nobody. Nobody. I suggest you reflect on what kind of commander you want to be.",
      "Full casualty on a single operation. You can win ten battles in a row — that kind of loss leaves a mark that doesn't fade easily.",
    ];
    return lines[totalDone % lines.length];
  }
  if (worstDeathRate >= 0.7) {
    const lines = [
      "Your kill numbers are... acceptable. But you nearly lost your entire squad on one of those missions. A few more like that and there'll be no one left to congratulate.",
      "Results are results, I suppose. But losing over half your unit in a single engagement? That is a failure of command, not just of luck.",
      "HQ has seen your recent performance. The concern isn't the enemies you've killed — it's how many of your own didn't come back.",
    ];
    return lines[totalDone % lines.length];
  }
  if (totalKills >= 30 && avgDeathRate < 0.1) {
    const lines = [
      "Impressive. High enemy casualties, minimal losses on your side. This is exactly what HQ expects of a well-run unit. Keep it up.",
      "Your record speaks for itself. Aggressive, efficient, and your maidens are coming home. Headquarters is pleased.",
      "Good numbers all around. I'll be honest — reports like this make my job easier. Don't let it get to your head, though.",
      "Strong performance. You're taking the fight to the enemy and bringing your girls back. That's the standard.",
    ];
    return lines[totalDone % lines.length];
  }
  if (totalKills >= 20 && avgDeathRate < 0.3) {
    const lines = [
      "Solid kill count. There have been some losses, but HQ understands the cost of war. Continue improving your casualty management.",
      "You're putting pressure on the enemy — that's acknowledged. Some of your girls didn't make it, though. Make sure it counts for something.",
      "Decent output. The losses are within an acceptable range, but don't let that number creep any higher.",
    ];
    return lines[totalDone % lines.length];
  }
  if (totalKills >= 20 && avgDeathRate >= 0.3) {
    const lines = [
      "You've been racking up kills. Impressive, on paper. But you've also been sending our girls to die. Shame.",
      "High enemy body count. High friendly body count. You're winning battles and losing people. HQ is not satisfied with that trade.",
      "The kills are there. I won't deny that. But look at your casualty list. Look at it. Those aren't numbers — they were people.",
      "You fought hard. I'll give you that. But victory means nothing if your unit bleeds out in the process. Tighten up.",
    ];
    return lines[totalDone % lines.length];
  }
  if (totalKills < 10 && avgDeathRate < 0.15) {
    const lines = [
      "Minimal losses, minimal kills. You're keeping your maidens alive — I respect that — but HQ expects results, not just survival.",
      "Your unit is coming home, which is good. But the enemy body count is low. What are you doing out there? We need more pressure.",
      "Careful. Conservative. Your survival rate is commendable, but at some point, you need to engage.",
    ];
    return lines[totalDone % lines.length];
  }
  if (totalKills < 10 && avgDeathRate >= 0.3) {
    const lines = [
      "Low enemy kills. High friendly casualties. I'm not sure what your strategy is, but it isn't working. HQ is concerned.",
      "You're losing maidens without making the enemy pay for it. That is the worst possible outcome. Reconsider your approach immediately.",
      "These numbers are difficult to defend. Headquarters is questioning your command decisions. I'd suggest a change of tactics.",
    ];
    return lines[totalDone % lines.length];
  }
  if (finalMult >= 1.2) {
    const lines = [
      "Your recent operations are above average. HQ has authorized increased support accordingly.",
      "Performance is trending upward. Headquarters takes note of consistent results.",
      "Above-average performance. The support reflects that. Don't coast on it.",
    ];
    return lines[totalDone % lines.length];
  }
  const lines = [
    "Your performance has been average at best. HQ support will be proportional — don't expect anything generous.",
    "Nothing here stands out in either direction. Middling kills, middling losses. Try harder.",
    "The results are... fine. Fine is not what this unit was established to be. Raise your standards.",
  ];
  return lines[totalDone % lines.length];
}

function MeridianPanel({ building }: any) {
  const { maidens, meridianStats } = useGameStore();
  const tier: number = building.levels[building.currentLevel - 1]?.effectValue?.tier ?? 1;
  const totalDone = meridianStats?.totalMissionsDone ?? 0;
  const { fsi, tierLabel } = computeForceStrengthIndex(maidens);
  const allRecent = (meridianStats?.recentMissions ?? []).slice(-10);
  const winRecords = allRecent.filter((r: any) => r.isWin);
  const diffWeight: Record<string, number> = { easy: 0.6, normal: 1.0, hard: 1.5, extreme: 2.2 };
  const diffScore = winRecords.reduce((a: number, r: any) => a + (diffWeight[r.difficulty] ?? 1.0), 0);
  const recent = allRecent;
  const totalKills = recent.reduce((a: number, r: any) => a + r.kills, 0);
  const totalDeaths = recent.reduce((a: number, r: any) => a + r.deaths, 0);
  const totalDeployed = recent.reduce((a: number, r: any) => a + r.deployedCount, 0);
  const avgDeathRate = totalDeaths / Math.max(1, totalDeployed);
  const worstDeathRate = recent.length > 0
    ? Math.max(...recent.map((r: any) => r.deaths / Math.max(1, r.deployedCount)))
    : 0;

  // Kill multiplier
  const killMult = 1 + Math.min(totalKills / 100, 0.4);

  // Clean mission bonus (wins only)
  const cleanCount = winRecords.filter((r: any) => r.deaths / Math.max(1, r.deployedCount) <= 0.1).length;
  const cleanBonus = 1 + cleanCount * 0.03;

  // Per-mission death penalty (multiplicative stack, all recent)
  const perMissionDeathMult = recent.reduce((acc: number, r: any) => {
    const dr = r.deaths / Math.max(1, r.deployedCount);
    if (dr <= 0.1) return acc;
    const exp = 1.2 + dr * 1.3;
    return acc * Math.max(0.05, Math.pow(1 - dr, exp));
  }, 1.0);
  const deathMult = Math.max(0.05, cleanBonus * perMissionDeathMult);
  const finalMult = Math.min(Math.max(killMult * deathMult, 0.05), 3.0);
  const rawBase = 30 * tier * (1 + diffScore * 0.03) * (1 + fsi / 400);
  const basePay = Math.min(rawBase, 500);
  const estMoney = Math.floor(basePay * finalMult);
  const estMetal = Math.floor(basePay * 0.4 * finalMult);

  const dialogue = generateLiaisonDialogue(totalKills, worstDeathRate, avgDeathRate, finalMult, totalDone, recent.length);

  // Per-mission penalty breakdown for tooltip
  const missionPenaltyRows = recent.map((r: any, i: number) => {
    const dr = r.deaths / Math.max(1, r.deployedCount);
    if (dr <= 0.1) return { i, dr, factor: null, label: 'clean' };
    const exp = 1.2 + dr * 1.3;
    const factor = Math.max(0.05, Math.pow(1 - dr, exp));
    return { i, dr, factor, label: `×${factor.toFixed(3)}` };
  });

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

  const sep = <div style={{ borderTop: '1px solid #2a2820', margin: '5px 0' }} />;
  const dim = (t: string) => <span style={{ color: 'var(--color-text-muted)' }}>{t}</span>;
  const hi = (t: string) => <span style={{ color: 'var(--color-accent)' }}>{t}</span>;
  const good = (t: string) => <span style={{ color: '#6ab06a' }}>{t}</span>;
  const bad = (t: string) => <span style={{ color: '#c06060' }}>{t}</span>;

  return (
    <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <CharColumn buildingId="the_meridian" />
      <div style={{ flex: 1, minWidth: 0, padding: 16, overflowY: 'auto' }}>
      {/* Dialogue */}
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 14, padding: '8px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)' }}>"{dialogue}"</div>

      {/* Current status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <StatBox label="Missions Completed" value={totalDone} />
        <StatBox label="Force Strength" value={`${fsi} FSI (${tierLabel})`} />
        <StatBox label="Wins Reviewed" value={`${winRecords.length} win${winRecords.length !== 1 ? 's' : ''} / ${recent.length} recent`} />
        <StatBox label="Difficulty Score" value={`${diffScore.toFixed(1)} pts`} />
      </div>

      {/* CPI breakdown */}
      <div style={{ padding: 12, background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Next Mission Support Estimate
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>

          {/* Kill Count */}
          <MeridianTooltip lines={[
            <>{hi('Kill Bonus')}</>,
            sep,
            <>{dim('Formula: ')}+1% per 2.5 kills, cap +40%</>,
            <>{dim('= 1 + min(kills/100, 0.40)')}</>,
            sep,
            <>Total kills (recent 10): {hi(String(totalKills))}</>,
            <>Kill multiplier: {hi(`×${killMult.toFixed(3)}`)}</>,
          ]}>
            <div style={{ textAlign: 'center', padding: '6px 4px', background: '#141410', borderRadius: 4, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>Kill Count ⓘ</div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#c8954a' }}>{totalKills}</div>
            </div>
          </MeridianTooltip>

          {/* Avg Loss Rate */}
          <MeridianTooltip lines={[
            <>{hi('Average Loss Rate')}</>,
            sep,
            <>{dim('Avg across all reviewed missions')}</>,
            <>{dim('deaths / deployed (all recent)')}</>,
            sep,
            <>Deaths: {bad(String(totalDeaths))} &nbsp; Deployed: {dim(String(totalDeployed))}</>,
            <>Avg rate: {bad(`${(avgDeathRate * 100).toFixed(1)}%`)}</>,
            sep,
            <>{dim('(Used together with per-mission stacking penalty)')}</>,
          ]}>
            <div style={{ textAlign: 'center', padding: '6px 4px', background: '#141410', borderRadius: 4, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>Avg Loss Rate ⓘ</div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: avgDeathRate > 0.2 ? '#c06060' : '#6ab06a' }}>
                {(avgDeathRate * 100).toFixed(1)}%
              </div>
            </div>
          </MeridianTooltip>

          {/* Worst Mission */}
          <MeridianTooltip lines={[
            <>{hi('Worst Mission Penalty')}</>,
            sep,
            <>{dim('Clean missions (≤10% loss): ')}{good(`+${cleanCount} × 3% bonus`)}</>,
            <>{dim('Clean bonus: ')}{good(`×${cleanBonus.toFixed(3)}`)}</>,
            sep,
            <>{dim('Each high-loss mission stacks:')}</>,
            <>{dim('factor = (1 − dr)^(1.2 + dr×1.3)')}</>,
            sep,
            ...missionPenaltyRows.filter(r => r.factor !== null).map(r =>
              <>{dim(`M${r.i + 1}: ${(r.dr * 100).toFixed(0)}% loss → `)}{bad(r.label!)}</>
            ),
            ...(missionPenaltyRows.filter(r => r.factor !== null).length === 0
              ? [<>{good('No penalty missions.')}</>] : []),
            sep,
            <>Death mult: {deathMult < 0.5 ? bad(`×${deathMult.toFixed(3)}`) : good(`×${deathMult.toFixed(3)}`)}</>,
            <>{dim('= cleanBonus × stacked mission penalties')}</>,
          ]}>
            <div style={{ textAlign: 'center', padding: '6px 4px', background: '#141410', borderRadius: 4, border: `1px solid ${worstDeathRate >= 0.5 ? '#aa4444' : 'var(--color-border)'}` }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>Worst Mission ⓘ</div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: worstDeathRate >= 0.5 ? '#e06060' : '#6ab06a' }}>
                {(worstDeathRate * 100).toFixed(0)}% loss
              </div>
            </div>
          </MeridianTooltip>

          {/* CPI Multiplier */}
          <MeridianTooltip lines={[
            <>{hi('CPI Final Multiplier')}</>,
            sep,
            <>{dim('finalMult = killMult × deathMult')}</>,
            <>{dim('Clamped to [0.05× – 3.0×]')}</>,
            sep,
            <>Kill mult: {hi(`×${killMult.toFixed(3)}`)}</>,
            <>Death mult: {deathMult < 0.5 ? bad(`×${deathMult.toFixed(3)}`) : good(`×${deathMult.toFixed(3)}`)}</>,
            <>Raw: {hi(`×${(killMult * deathMult).toFixed(3)}`)} → clamped: {finalMult < 1 ? bad(`×${finalMult.toFixed(3)}`) : good(`×${finalMult.toFixed(3)}`)}</>,
          ]}>
            <div style={{ textAlign: 'center', padding: '6px 4px', background: '#141410', borderRadius: 4, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>CPI Multiplier ⓘ</div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: finalMult >= 1 ? '#6ab06a' : '#c06060' }}>×{finalMult.toFixed(2)}</div>
            </div>
          </MeridianTooltip>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {/* Est Gold */}
          <MeridianTooltip lines={[
            <>{hi('Estimated Gold')}</>,
            sep,
            <>{dim('basePay = min(30 × tier × (1 + diffScore×0.03) × (1 + FSI/400), 500)')}</>,
            sep,
            <>tier: {hi(String(tier))}</>,
            <>difficulty score: {hi(diffScore.toFixed(1))} pts (wins only; easy×0.6 / normal×1.0 / hard×1.5 / extreme×2.2)</>,
            <>FSI: {hi(String(fsi))}</>,
            <>raw base: {hi(rawBase.toFixed(1))} → capped: {hi(String(basePay))}</>,
            sep,
            <>Gold = floor({hi(String(basePay))} × {hi(`×${finalMult.toFixed(3)}`)}) = {hi(`+${estMoney}`)}</>,
          ]}>
            <div style={{ padding: '8px 12px', background: 'rgba(200,149,74,0.12)', borderRadius: 4, border: '1px solid var(--color-accent-dark)' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>Estimated Gold ⓘ</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--color-accent)' }}>+{estMoney} 💰</div>
            </div>
          </MeridianTooltip>

          {/* Est Metal */}
          <MeridianTooltip lines={[
            <>{hi('Estimated Metal')}</>,
            sep,
            <>{dim('Metal = floor(basePay × 0.4 × finalMult)')}</>,
            sep,
            <>basePay: {hi(String(basePay))}</>,
            <>finalMult: {hi(`×${finalMult.toFixed(3)}`)}</>,
            <>Metal = floor({hi(String(basePay))} × 0.4 × {hi(`${finalMult.toFixed(3)}`)}) = {hi(`+${estMetal}`)}</>,
          ]}>
            <div style={{ padding: '8px 12px', background: 'rgba(130,160,200,0.1)', borderRadius: 4, border: '1px solid #5577aa' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>Estimated Metal ⓘ</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#8ab4e0' }}>+{estMetal} ⚙️</div>
            </div>
          </MeridianTooltip>
        </div>
      </div>

      {/* Recent mission history */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Recent Mission Record (last {recent.length})
        </div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: 8, background: '#0e0d0b', borderRadius: 4 }}>
            No missions reviewed yet. Complete your first mission to receive HQ support.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...recent].reverse().map((r: any, i: number) => {
              const dr = r.deaths / Math.max(1, r.deployedCount);
              const isWipe = dr >= 1.0;
              const isClean = dr <= 0.1;
              const exp = dr > 0.1 ? (1.2 + dr * 1.3) : 0;
              const penaltyFactor = dr > 0.1 ? Math.max(0.05, Math.pow(1 - dr, exp)) : null;
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '0.8fr 1fr 1fr 1fr 1fr', gap: 6,
                  padding: '6px 8px', background: isWipe ? 'rgba(180,40,40,0.12)' : isClean ? 'rgba(60,120,60,0.08)' : '#0e0d0b',
                  borderRadius: 4, border: `1px solid ${isWipe ? '#aa3333' : isClean ? '#2d6b2d' : 'var(--color-border)'}`, fontSize: 11
                }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>M#{recent.length - i}</span>
                  <span style={{ color: '#c8954a' }}>⚔️ {r.kills} kills</span>
                  <span style={{ color: r.deaths > 0 ? '#c06060' : '#6ab06a' }}>💀 {r.deaths} lost</span>
                  <span style={{ color: isWipe ? '#e06060' : isClean ? '#6ab06a' : 'var(--color-text-muted)', fontWeight: isWipe ? 'bold' : 'normal' }}>
                    {(dr * 100).toFixed(0)}%{isWipe ? ' ⚠' : isClean ? ' ✓' : ''}
                  </span>
                  <span style={{ color: penaltyFactor !== null ? '#c06060' : '#6ab06a', fontSize: 10 }}>
                    {penaltyFactor !== null ? `×${penaltyFactor.toFixed(2)}` : '+3%'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formula note */}
      <div style={{ fontSize: 10, color: '#555', padding: '8px 10px', background: '#0a0a08', borderRadius: 4, border: '1px solid #1a1a14' }}>
        <strong style={{ color: '#666' }}>Formula:</strong> basePay (max 500) × killMult (kills/100, max +40%) × deathMult (cleanBonus + stacked per-mission penalties). High-loss missions stack exponentially — a 100% wipe nearly eliminates support for that evaluation window. Hover any stat for details.
      </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '8px 12px', background: '#0e0d0b', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 6 }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--color-accent)', fontWeight: 'bold', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ExpRow({ label, exp }: { label: string; exp: { theoryExp: number; practicalExp: number } }) {
  const tLv = theoryLv(exp.theoryExp);
  const pLv = practicalLv(exp.practicalExp);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1a1a1a' }}>
      <span style={{ textTransform: 'capitalize' }}>{label}</span>
      <span>
        Theory Lv{tLv} ({exp.theoryExp} EXP) &nbsp;|&nbsp;
        Practical Lv{pLv} ({exp.practicalExp} EXP)
      </span>
    </div>
  );
}




