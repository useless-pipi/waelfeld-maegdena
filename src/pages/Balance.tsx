/**
 * DEV-only page: Mission Generation Preview
 */

import { useState, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  generateMissionSet,
  initializeStageEnemies,
  enrichEnemyGear,
  TIER_CONFIGS,
} from '../engine/missionGen';
import { theoryLv, practicalLv } from '../engine/combat';
import { getUnitIcon } from '../utils/portraits';
import type { Mission, MissionStage } from '../types/mission';
import type { Enemy } from '../types/enemy';
import type { Maiden } from '../types/maiden';
import type { Equipment } from '../types/equipment';
import tagsData from '../data/tags.json';
import type { TagDef } from '../types/stats';

// -- Tag definitions --

const TAG_DEFS: Record<string, TagDef> = Object.fromEntries(
  (tagsData as TagDef[]).map(td => [td.id, td])
);

const TAG_CATEGORY_STYLE: Record<string, { color: string; border: string; bg: string }> = {
  positive:     { color: '#7ecb7e', border: 'rgba(126,203,126,0.5)',  bg: 'rgba(126,203,126,0.10)' },
  double_edged: { color: '#d4a84b', border: 'rgba(212,168,75,0.5)',   bg: 'rgba(212,168,75,0.10)'  },
  negative:     { color: '#d46b6b', border: 'rgba(212,107,107,0.5)',  bg: 'rgba(212,107,107,0.10)' },
};

function TagTooltip({ tagId }: { tagId: string }) {
  const def = TAG_DEFS[tagId];
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const cs = def?.category ? (TAG_CATEGORY_STYLE[def.category] ?? null) : null;

  function handleMouseEnter(e: React.MouseEvent) {
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left / zoom, y: (rect.bottom + 6) / zoom });
    setVisible(true);
  }

  return (
    <>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        style={{
          background: cs ? cs.bg : 'rgba(200,149,74,0.12)',
          border: `1px solid ${cs ? cs.border : 'var(--color-border)'}`,
          padding: '1px 6px', borderRadius: 3, fontSize: 10,
          color: cs ? cs.color : 'var(--color-text-muted)',
          cursor: def ? 'help' : 'default', userSelect: 'none',
        }}
      >
        {def?.name ?? tagId}
      </span>
      {visible && def && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 10001,
          background: '#1e1c17', border: '1px solid var(--color-accent)',
          borderRadius: 6, padding: '10px 12px', maxWidth: 260,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 'bold', fontSize: 12, color: cs?.color ?? 'var(--color-accent)', marginBottom: 4 }}>{def.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5, marginBottom: def.bonuses.length || def.ability ? 8 : 0 }}>{def.description}</div>
          {def.bonuses.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: def.ability ? 6 : 0 }}>
              {def.bonuses.map((b, i) => {
                const pos2 = b.value > 0;
                return (
                  <div key={i} style={{ fontSize: 10, color: pos2 ? '#7ecb7e' : '#d46b6b' }}>
                    {pos2 ? '＋' : '－'} {b.label}: <span style={{ fontWeight: 'bold' }}>{pos2 ? '+' : ''}{b.value}{b.isPercent ? '%' : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
          {def.ability && <div style={{ fontSize: 10, color: '#c8a85a', fontStyle: 'italic' }}>✦ {def.ability}</div>}
        </div>
      )}
    </>
  );
}

// -- Synthetic maiden factory --

const TIER_MAIDEN_COUNTS: Record<number, number> = { 1: 5, 2: 12, 3: 20, 4: 28, 5: 36, 6: 45 };

function makeSyntheticMaidens(tier: number): Maiden[] {
  const count = TIER_MAIDEN_COUNTS[tier] ?? 5;
  return Array.from({ length: count }, (_, i) => ({
    id: `__synth_${i}`,
    type: 'zako' as const,
    imgId: 901,
    name: `Synthetic ${i + 1}`,
    isFavourite: false,
    stats: { strength: 10, dexterity: 10, constitution: 10, strategy: 10, awareness: 10, charm: 10 },
    maxHp: 27,
    currentHp: 27,
    equipment: [],
    qualifications: [],
    tags: [],
    skills: [],
    statusEffects: [],
    expData: { weapons: {}, scout: { theoryExp: 0, practicalExp: 0 }, sneak: { theoryExp: 0, practicalExp: 0 } },
    isCaptured: false,
    isFallen: false,
    killCount: 0,
    missionCount: 0,
    isDeployed: false,
  } as unknown as Maiden));
}

// -- Mission type options --

type RewardFocus =
  | 'all'
  | 'gold_heavy'
  | 'supply_run'
  | 'medal'
  | 'weapon_gear'
  | 'consumable'
  | 'balanced'
  | 'strike_force'
  | 'rescue'
  | 'lyssa_wave';

const FOCUS_OPTIONS: { value: RewardFocus; label: string }[] = [
  { value: 'all',          label: 'All types'    },
  { value: 'gold_heavy',   label: 'Gold Heavy'   },
  { value: 'supply_run',   label: 'Supply Run'   },
  { value: 'medal',        label: 'Medal'        },
  { value: 'weapon_gear',  label: 'Weapon Gear'  },
  { value: 'consumable',   label: 'Consumable'   },
  { value: 'balanced',     label: 'Balanced'     },
  { value: 'strike_force', label: 'Strike Force' },
  { value: 'rescue',       label: 'Rescue'       },
  { value: 'lyssa_wave',   label: 'Lyssa Wave'   },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:    '#4ade80',
  normal:  '#facc15',
  hard:    '#fb923c',
  extreme: '#f87171',
  hell:    '#c084fc',
};

const STAT_LABELS: [keyof Enemy['stats'], string][] = [
  ['strength',     'STR'],
  ['dexterity',    'DEX'],
  ['constitution', 'CON'],
  ['strategy',     'STG'],
  ['awareness',    'AWR'],
  ['charm',        'CHR'],
];

// -- Rarity meta --
const RARITY_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Common',    color: '#aaaaaa' },
  2: { label: 'Uncommon',  color: '#5aac44' },
  3: { label: 'Rare',      color: '#4a90d9' },
  4: { label: 'Very Rare', color: '#c84ad9' },
  5: { label: 'Legendary', color: '#e8a840' },
};

// -- Equipment tooltip --

function EquipTooltip({ eq, x, y }: { eq: Equipment; x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (ref.current) setRect({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
  }, []);

  const zoom = parseFloat(document.documentElement.style.zoom) || 1;
  const vw = window.innerWidth / zoom;
  const vh = window.innerHeight / zoom;
  const w = rect?.w ?? 220;
  const h = rect?.h ?? 80;
  const left = Math.min(x + 12, vw - w - 8);
  const top  = y + h + 8 > vh ? y - h - 8 : y + 12;

  return ReactDOM.createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed', left, top, zIndex: 10000,
        background: '#1e1c17', border: '1px solid var(--color-accent)',
        borderRadius: 6, padding: '10px 12px', maxWidth: 260,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none',
        visibility: rect ? 'visible' : 'hidden',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: 12, color: 'var(--color-accent)', marginBottom: 4 }}>
        {eq.name}
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{eq.slot}{eq.weaponType ? ` - ${eq.weaponType.replace('_', ' ')}` : ''}</span>
        {(() => {
          const rv = (eq as any).rarityValue as number | undefined;
          const meta = RARITY_META[rv ?? 1];
          return (
            <span style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${meta.color}`, color: meta.color, fontWeight: 'bold', textTransform: 'none', letterSpacing: 0, fontSize: 9 }}>
              {meta.label}
            </span>
          );
        })()}
      </div>
      {eq.slot === 'weapon' && (
        <div style={{ fontSize: 11, color: 'var(--color-text)', marginBottom: 4 }}>
          DMG: <strong>{eq.damage ?? 0}</strong>
          {eq.shotsPerRound && eq.shotsPerRound > 1 ? <span>  x{eq.shotsPerRound} shots</span> : null}
          {eq.hitRateBonus ? <span>  +{eq.hitRateBonus}% hit</span> : null}
        </div>
      )}
      {(eq.bonuses ?? []).map((b, i) => (
        <div key={i} style={{ fontSize: 10, color: b.value >= 0 ? '#7ecb7e' : '#d46b6b' }}>
          {b.value >= 0 ? '+' : '-'} {b.stat}: <strong>{Math.abs(b.value)}{b.isPercent ? '%' : ''}</strong>
        </div>
      ))}
      {eq.description && (
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
          {eq.description}
        </div>
      )}
    </div>,
    document.body
  );
}

// -- Enemy detail modal --

function deriveEnemyQuality(enemy: Enemy): number {
  if (enemy.quality !== undefined) return enemy.quality;
  const avg = (enemy.stats.strength + enemy.stats.dexterity +
               enemy.stats.constitution + enemy.stats.awareness) / 4;
  return Math.max(1, Math.min(10, Math.round(1 + (avg - 3) * 9 / 11)));
}

function EnemyDetailModal({ enemy, onClose }: { enemy: Enemy; onClose: () => void }) {
  const [eqTooltip, setEqTooltip] = useState<{ eq: Equipment; x: number; y: number } | null>(null);

  const weaponEntries = Object.entries(enemy.expData?.weapons ?? {});
  const scout = enemy.expData?.scout;
  const sneak = enemy.expData?.sneak;

  function handleBgClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const SLOT_ORDER = ['weapon','head','mask','body','arms','legs','accessory','medal','consumable'];
  const equip = [...enemy.equipment].sort(
    (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)
  );

  return ReactDOM.createPortal(
    <div
      onClick={handleBgClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10, padding: 24,
        maxWidth: 560, width: '95%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)', position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
            fontSize: 18, cursor: 'pointer', lineHeight: 1,
          }}
        >X</button>

        {/* Header */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
          <img
            src={getUnitIcon(enemy.imgId)}
            alt={enemy.name}
            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 2 }}>
              {enemy.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              {enemy.type === 'lyssa' ? 'Lyssa' : 'Zako'} &middot; <span style={{ color: '#facc15', fontWeight: 'bold' }}>Q{deriveEnemyQuality(enemy)}</span> &middot; HP {enemy.currentHp}/{enemy.maxHp}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {enemy.tags.map((tag, i) => {
                const tagId = typeof tag === 'string' ? tag : (tag as any).id;
                return <TagTooltip key={i} tagId={tagId} />;
              })}
            </div>
          </div>
        </div>

        {/* Stats */}
        <Section title="Stats">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 12px' }}>
            {STAT_LABELS.map(([key, label]) => (
              <StatBreakdownRow key={key} enemy={enemy} statKey={key} label={label} />
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <HpBreakdownRow enemy={enemy} />
          </div>
        </Section>

        {/* Qualifications */}
        {enemy.qualifications.length > 0 && (
          <Section title="Qualifications">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {enemy.qualifications.map((q, i) => (
                <span key={i} style={{
                  background: 'rgba(200,149,74,0.12)',
                  border: '1px solid var(--color-accent)',
                  color: 'var(--color-accent)',
                  padding: '2px 8px', borderRadius: 4, fontSize: 11,
                }}>
                  {q.name}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* EXP */}
        <Section title="Experience">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {weaponEntries.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>No weapon EXP recorded</span>
            )}
            {weaponEntries.map(([wt, exp]) => exp && (
              <ExpRow key={wt} label={`${wt.replace(/_/g, ' ')} weapon`}
                theory={(exp as any).theoryExp} practical={(exp as any).practicalExp} />
            ))}
            {scout && (scout.theoryExp > 0 || scout.practicalExp > 0) && (
              <ExpRow label="Scout" theory={scout.theoryExp} practical={scout.practicalExp} />
            )}
            {sneak && (sneak.theoryExp > 0 || sneak.practicalExp > 0) && (
              <ExpRow label="Sneak" theory={sneak.theoryExp} practical={sneak.practicalExp} />
            )}
          </div>
        </Section>

        {/* Equipment */}
        {equip.length > 0 && (
          <Section title="Equipment">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {equip.map((eq, i) => {
                const rv = (eq as any).rarityValue as number | undefined;
                const rarMeta = RARITY_META[rv ?? 1];
                return (
                <div
                  key={i}
                  onMouseEnter={e => {
                    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
                    setEqTooltip({ eq, x: e.clientX / zoom, y: e.clientY / zoom });
                  }}
                  onMouseMove={e => {
                    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
                    setEqTooltip({ eq, x: e.clientX / zoom, y: e.clientY / zoom });
                  }}
                  onMouseLeave={() => setEqTooltip(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(200,149,74,0.07)',
                    border: `1px solid ${rarMeta.color}`,
                    borderRadius: 5, padding: '5px 10px', cursor: 'default',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: `1px solid ${rarMeta.color}`, color: rarMeta.color, fontWeight: 'bold', flexShrink: 0 }}>
                        {rarMeta.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {eq.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {eq.slot}{eq.weaponType ? ` - ${eq.weaponType.replace('_', ' ')}` : ''}
                    </div>
                  </div>
                  {eq.slot === 'weapon' && (
                    <span style={{ fontSize: 11, color: '#fb923c', flexShrink: 0 }}>
                      DMG {eq.damage ?? 0}
                    </span>
                  )}
                </div>
                );
              })}
            </div>
          </Section>
        )}

        {eqTooltip && <EquipTooltip eq={eqTooltip.eq} x={eqTooltip.x} y={eqTooltip.y} />}
      </div>
    </div>,
    document.body
  );
}

// -- Stat bonus breakdown --

interface StatBonus { source: string; value: number; isPercent: boolean; }

function collectEnemyStatBonuses(enemy: Enemy, stat: string): StatBonus[] {
  const result: StatBonus[] = [];
  for (const eq of enemy.equipment) {
    for (const b of (eq.bonuses ?? [])) {
      if (b.stat === stat) result.push({ source: eq.name, value: b.value, isPercent: b.isPercent });
    }
  }
  for (const q of enemy.qualifications) {
    for (const b of q.bonuses) {
      if (b.stat === stat) result.push({ source: q.name, value: b.value, isPercent: b.isPercent });
    }
  }
  for (const tag of enemy.tags) {
    const tagId = typeof tag === 'string' ? tag : (tag as any).id;
    const def = TAG_DEFS[tagId];
    if (def) {
      for (const b of def.bonuses) {
        if (b.stat === stat) result.push({ source: `[${def.name}]`, value: b.value, isPercent: b.isPercent });
      }
    }
  }
  return result;
}

function StatBreakdownRow({ enemy, statKey, label }: { enemy: Enemy; statKey: keyof Enemy['stats']; label: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const base = enemy.stats[statKey];
  const bonuses = collectEnemyStatBonuses(enemy, statKey);
  const flatBonus = bonuses.filter(b => !b.isPercent).reduce((s, b) => s + b.value, 0);
  const total = base + flatBonus;
  const pct = Math.min(100, (total / 20) * 100);
  const color = total >= 15 ? '#4ade80' : total >= 10 ? '#facc15' : '#fb923c';

  function handleMouseEnter(e: React.MouseEvent) {
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const rightEdge = rect.right / zoom + 8;
    const x = rightEdge + 220 > window.innerWidth / zoom ? rect.left / zoom - 228 : rightEdge;
    setPos({ x, y: rect.top / zoom });
    setVisible(true);
  }

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: bonuses.length > 0 ? 'help' : 'default' }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {flatBonus !== 0 && (
            <span style={{ fontSize: 10, color: flatBonus > 0 ? '#6db86d' : '#cc6060' }}>
              {flatBonus > 0 ? '+' : ''}{flatBonus}
            </span>
          )}
          <div style={{ width: 52, height: 5, background: '#2a2720', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 'bold', color, minWidth: 18, textAlign: 'right' }}>{total}</span>
        </div>
      </div>
      {visible && bonuses.length > 0 && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 10001,
          background: '#1e1c17', border: '1px solid var(--color-accent)',
          borderRadius: 6, padding: '10px 12px', minWidth: 200,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 'bold', marginBottom: 6 }}>{label} breakdown</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #333' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Base</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{base}</span>
          </div>
          {bonuses.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 2 }}>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.source}</span>
              <span style={{ color: b.value > 0 ? '#6db86d' : '#cc6060', fontWeight: 'bold', flexShrink: 0 }}>
                {b.value > 0 ? '+' : ''}{b.value}{b.isPercent ? '%' : ''}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #333', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total</span>
            <span style={{ color: total > base ? '#6db86d' : total < base ? '#cc6060' : 'var(--color-text)', fontWeight: 'bold' }}>
              {total}{flatBonus !== 0 && <span style={{ fontSize: 10, opacity: 0.7 }}> ({base}{flatBonus > 0 ? '+' : ''}{flatBonus})</span>}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function HpBreakdownRow({ enemy }: { enemy: Enemy }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const hpBonuses = collectEnemyStatBonuses(enemy, 'hp');
  const conBonuses = collectEnemyStatBonuses(enemy, 'constitution').filter(b => !b.isPercent);
  const flatCon  = conBonuses.reduce((s, b) => s + b.value, 0);
  const flatHp   = hpBonuses.filter(b => !b.isPercent).reduce((s, b) => s + b.value, 0);
  const pctHp    = hpBonuses.filter(b =>  b.isPercent).reduce((s, b) => s + b.value, 0);
  const effCon   = enemy.stats.constitution + flatCon;
  const hpBase   = 7 + 2 * effCon;
  const total    = Math.round((hpBase + flatHp) * (1 + pctHp / 100));
  const hasBonuses = conBonuses.length > 0 || hpBonuses.length > 0;

  function handleMouseEnter(e: React.MouseEvent) {
    const zoom = parseFloat(document.documentElement.style.zoom) || 1;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const rightEdge = rect.right / zoom + 8;
    const x = rightEdge + 240 > window.innerWidth / zoom ? rect.left / zoom - 248 : rightEdge;
    setPos({ x, y: rect.top / zoom });
    setVisible(true);
  }

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: hasBonuses ? 'help' : 'default' }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Max HP</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {pctHp !== 0 && (
            <span style={{ fontSize: 10, color: '#6db86d' }}>→ {total}</span>
          )}
          {pctHp === 0 && flatHp !== 0 && (
            <span style={{ fontSize: 10, color: flatHp > 0 ? '#6db86d' : '#cc6060' }}>{flatHp > 0 ? '+' : ''}{flatHp}</span>
          )}
          <span style={{ fontSize: 11, fontWeight: 'bold', color: '#e07070' }}>{total}</span>
        </div>
      </div>
      {visible && hasBonuses && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 10001,
          background: '#1e1c17', border: '1px solid var(--color-accent)',
          borderRadius: 6, padding: '10px 12px', minWidth: 220,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 'bold', marginBottom: 6 }}>Max HP breakdown</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #333' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Base (7 + 2×CON {effCon})</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{hpBase}</span>
          </div>
          {conBonuses.map((b, i) => (
            <div key={`con${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 2 }}>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.source} (CON)</span>
              <span style={{ color: b.value > 0 ? '#6db86d' : '#cc6060', fontWeight: 'bold', flexShrink: 0 }}>{b.value > 0 ? '+' : ''}{b.value * 2} HP</span>
            </div>
          ))}
          {hpBonuses.map((b, i) => (
            <div key={`hp${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 2 }}>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.source}</span>
              <span style={{ color: b.value > 0 ? '#6db86d' : '#cc6060', fontWeight: 'bold', flexShrink: 0 }}>
                {b.value > 0 ? '+' : ''}{b.value}{b.isPercent ? '%' : ''}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #333', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total</span>
            <span style={{ color: '#e07070', fontWeight: 'bold' }}>
              {total}
              {pctHp !== 0 && flatHp === 0 && <span style={{ fontSize: 10, opacity: 0.7 }}> ({hpBase} × {(1 + pctHp / 100).toFixed(2)})</span>}
              {pctHp !== 0 && flatHp !== 0 && <span style={{ fontSize: 10, opacity: 0.7 }}> ({hpBase}+{flatHp}) × {(1 + pctHp / 100).toFixed(2)}</span>}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// -- Sub-components --

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 1,
        color: 'var(--color-text-muted)', marginBottom: 8,
        borderBottom: '1px solid var(--color-border)', paddingBottom: 4,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ExpRow({ label, theory, practical }: { label: string; theory: number; practical: number }) {
  const tLv = theoryLv(theory);
  const pLv = practicalLv(practical);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
      <span style={{ color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{label}</span>
      <div style={{ display: 'flex', gap: 10 }}>
        <span style={{ color: '#93c5fd' }}>Theory Lv{tLv} <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>({theory})</span></span>
        <span style={{ color: '#86efac' }}>Practical Lv{pLv} <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>({practical})</span></span>
      </div>
    </div>
  );
}

// -- Stage panel --

function StagePanel({ stage }: { stage: MissionStage }) {
  const [enemies] = useState<Enemy[]>(() => {
    const raw = initializeStageEnemies(stage);
    return raw.map(e => enrichEnemyGear(e));
  });
  const [selectedEnemy, setSelectedEnemy] = useState<Enemy | null>(null);

  const lyssas = enemies.filter(e => e.type === 'lyssa');
  const zakos  = enemies.filter(e => e.type === 'zako');

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>{stage.name}</span>
        <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 10 }}>Cover {stage.coverLevel}</span>
        <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 10 }}>{enemies.length} enemies</span>
      </div>
      {stage.description && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
          {stage.description}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[...lyssas, ...zakos].map(enemy => (
          <EnemyChip key={enemy.id} enemy={enemy} onClick={() => setSelectedEnemy(enemy)} />
        ))}
      </div>
      {selectedEnemy && (
        <EnemyDetailModal enemy={selectedEnemy} onClose={() => setSelectedEnemy(null)} />
      )}
    </div>
  );
}

function EnemyChip({ enemy, onClick }: { enemy: Enemy; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const isLyssa = enemy.type === 'lyssa';
  const weapon = enemy.equipment.find(e => e.slot === 'weapon');
  const quality = deriveEnemyQuality(enemy);
  // Primary weapon EXP for badge display
  const weaponExpEntries = Object.entries(enemy.expData?.weapons ?? {});
  const primaryWpnExp = weaponExpEntries.find(([wt]) => wt !== 'grenade')?.[1] as { theoryExp: number; practicalExp: number } | undefined;
  const hasGrenadeExp = !!enemy.expData?.weapons?.['grenade' as any];

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${enemy.name} - click to inspect`}
      style={{
        background: hover
          ? (isLyssa ? 'rgba(192,38,211,0.25)' : 'rgba(200,149,74,0.18)')
          : (isLyssa ? 'rgba(192,38,211,0.12)' : 'rgba(180,60,60,0.10)'),
        border: `1px solid ${hover
          ? (isLyssa ? '#c026d3' : 'var(--color-accent)')
          : (isLyssa ? 'rgba(192,38,211,0.5)' : 'rgba(139,32,32,0.6)')}`,
        borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        minWidth: 64, transition: 'all 0.12s',
      }}
    >
      <img
        src={getUnitIcon(enemy.imgId)}
        alt={enemy.name}
        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: `1px solid ${isLyssa ? 'rgba(192,38,211,0.5)' : 'rgba(139,32,32,0.4)'}` }}
      />
      <div style={{ fontSize: 8, color: '#facc15', fontWeight: 'bold' }}>Q{quality}</div>
      <div style={{ fontSize: 9, color: isLyssa ? '#e879f9' : 'var(--color-text-muted)', maxWidth: 62, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {(enemy as any).nickname ?? enemy.name.split(' ')[0]}
      </div>
      {weapon && (
        <div style={{ fontSize: 8, color: '#fb923c' }}>
          {weapon.weaponType?.replace('_', ' ') ?? weapon.name}
        </div>
      )}
      {primaryWpnExp && (
        <div style={{ fontSize: 8, color: '#93c5fd', lineHeight: 1.3 }}>
          T{theoryLv(primaryWpnExp.theoryExp)}/P{practicalLv(primaryWpnExp.practicalExp)}
          {hasGrenadeExp && <span style={{ color: '#fbbf24' }}> 💣</span>}
        </div>
      )}
    </button>
  );
}

// -- Mission card --

function MissionCard({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const diffColor = DIFFICULTY_COLORS[mission.difficulty] ?? '#aaa';

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 8, marginBottom: 12, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>
            {mission.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: diffColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{mission.difficulty}</span>
            <span>{mission.stages.length} stage{mission.stages.length > 1 ? 's' : ''}</span>
            {mission.rewardFocus && <span>{mission.rewardFocus.replace('_', ' ')}</span>}
            {mission.isLyssaWave && <span style={{ color: '#e879f9' }}>Lyssa Wave</span>}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{open ? '[collapse]' : '[expand]'}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 12, fontStyle: 'italic', lineHeight: 1.5 }}>
            {mission.description}
          </div>
          {mission.stages.map(stage => (
            <StagePanel key={stage.id} stage={stage} />
          ))}
        </div>
      )}
    </div>
  );
}

// -- Main page --

export default function Balance() {
  const [selectedTier, setSelectedTier] = useState(1);
  const [focusFilter, setFocusFilter] = useState<RewardFocus>('all');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    const fakeMaidens = makeSyntheticMaidens(selectedTier);
    const isLyssaWave = focusFilter === 'lyssa_wave';
    const all = generateMissionSet(fakeMaidens, [], isLyssaWave);
    const filtered =
      focusFilter === 'all' || focusFilter === 'lyssa_wave'
        ? all
        : all.filter(m => m.rewardFocus === focusFilter);
    setMissions(filtered);
    setGenerated(true);
  }

  const tier = TIER_CONFIGS[selectedTier - 1];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.4)',
        borderRadius: 4, padding: '3px 10px', fontSize: 10, color: '#facc15',
        marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1,
      }}>
        DEV - Mission Generation Preview
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 4 }}>
        Mission Generation Preview
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
        Generate a mission set for a given FSI tier and browse the resulting enemy formations.
        Click any enemy chip to inspect their stats, tags, qualifications, experience and equipment.
      </p>

      {/* Controls */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: 20, marginBottom: 28,
      }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {/* Tier picker */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              FSI Tier
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TIER_CONFIGS.map(tc => (
                <button
                  key={tc.tier}
                  onClick={() => setSelectedTier(tc.tier)}
                  style={{
                    padding: '6px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
                    background: selectedTier === tc.tier ? 'var(--color-accent)' : 'transparent',
                    border: `1px solid ${selectedTier === tc.tier ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    color: selectedTier === tc.tier ? '#1a1713' : 'var(--color-text)',
                    fontWeight: selectedTier === tc.tier ? 700 : 400,
                  }}
                >
                  {tc.tier} - {tc.label}
                </button>
              ))}
            </div>
            {tier && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                FSI {tier.fsiMin}-{tier.fsiMax} &middot; Q{tier.qualityLo}-Q{tier.qualityHi} &middot; {tier.difficultyRange}
              </div>
            )}
          </div>

          {/* Mission type filter */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Mission Type
            </label>
            <select
              value={focusFilter}
              onChange={e => setFocusFilter(e.target.value as RewardFocus)}
              style={{
                background: '#1a1713', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', borderRadius: 5, padding: '7px 10px',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {FOCUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            style={{
              background: 'var(--color-accent)', border: 'none', color: '#1a1713',
              borderRadius: 6, padding: '9px 22px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            Generate
          </button>
        </div>
      </div>

      {/* Results */}
      {generated && (
        missions.length === 0 ? (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: 24, textAlign: 'center',
            color: 'var(--color-text-muted)', fontSize: 13,
          }}>
            No missions matched the selected type filter. Try <strong>All types</strong> or re-generate.
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
              Generated <strong style={{ color: 'var(--color-text)' }}>{missions.length}</strong> mission{missions.length > 1 ? 's' : ''} for Tier {selectedTier} ({tier?.label}).
              Click a mission header to expand its stages.
            </div>
            {missions.map(m => <MissionCard key={m.id} mission={m} />)}
          </div>
        )
      )}
    </div>
  );
}