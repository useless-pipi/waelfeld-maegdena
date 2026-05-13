import { useState, useCallback } from 'react';
import equipmentData from '../data/equipment.json';
import type { Equipment } from '../types/equipment';

// ── Helpers ──────────────────────────────────────────────────────────────────

function rng(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Difficulty = 'easy' | 'average' | 'very_good';

interface OpponentProfile {
  label: string;
  dexRange: [number, number];
  dodgeRange: [number, number]; // dodge percent bonus from gear
  constitutionRange: [number, number];
  hpGearRange: [number, number];   // flat HP bonus from gear
  strategyRange: [number, number];
  coverLevelRange: [number, number];
  sneakExpRange: [number, number]; // practical sneak exp (affects dodge)
}

const PROFILES: Record<Difficulty, OpponentProfile> = {
  easy: {
    label: 'Easy (Grunt)',
    dexRange: [3, 6],
    dodgeRange: [0, 0],
    constitutionRange: [8, 12],
    hpGearRange: [1, 4],
    strategyRange: [3, 6],
    coverLevelRange: [0, 1],
    sneakExpRange: [0, 0],
  },
  average: {
    label: 'Average (Regular)',
    dexRange: [7, 11],
    dodgeRange: [0, 2],
    constitutionRange: [13, 18],
    hpGearRange: [3, 8],
    strategyRange: [7, 11],
    coverLevelRange: [1, 3],
    sneakExpRange: [0, 50],
  },
  very_good: {
    label: 'Very Good (Elite)',
    dexRange: [12, 18],
    dodgeRange: [5, 15],
    constitutionRange: [18, 28],
    hpGearRange: [8, 15],
    strategyRange: [12, 18],
    coverLevelRange: [2, 5],
    sneakExpRange: [50, 200],
  },
};

function theoryLv(exp: number) { return Math.floor(exp / 500); }
function practicalLv(exp: number) { return Math.floor(exp / 50); }

interface Opponent {
  dexterity: number;
  constitution: number;
  strategy: number;
  dodgeBonus: number;   // percent
  hpGearBonus: number;
  coverLevel: number;
  sneakPracticalExp: number;
  maxHp: number;
}

function rollOpponent(diff: Difficulty): Opponent {
  const p = PROFILES[diff];
  const dex = rng(...p.dexRange);
  const con = rng(...p.constitutionRange);
  const hpGear = rng(...p.hpGearRange);
  const dodge = rng(...p.dodgeRange);
  const strategy = rng(...p.strategyRange);
  const cover = rng(...p.coverLevelRange);
  const sneakExp = rng(...p.sneakExpRange);
  return {
    dexterity: dex,
    constitution: con,
    strategy,
    dodgeBonus: dodge,
    hpGearBonus: hpGear,
    coverLevel: cover,
    sneakPracticalExp: sneakExp,
    maxHp: con + hpGear,
  };
}

interface AttackerConfig {
  dexterity: number;
  personalMorale: number;
  teamMorale: number;
  weaponPracticalExp: number;
  weaponTheoryExp: number;
}

const DEFAULT_ATTACKER: AttackerConfig = {
  dexterity: 10,
  personalMorale: 50,
  teamMorale: 50,
  weaponPracticalExp: 0,
  weaponTheoryExp: 0,
};

function computeHitRate(weapon: Equipment, attacker: AttackerConfig, opp: Opponent): number {
  const base = attacker.dexterity * 5;
  const weaponExpBonus = theoryLv(attacker.weaponTheoryExp) * 1 + practicalLv(attacker.weaponPracticalExp) * 2;
  const sneakDodge = practicalLv(opp.sneakPracticalExp) * 1 + theoryLv(0) * 0.5;
  const personalMoraleBonus = (attacker.personalMorale - 50) * 0.2;
  const teamMoraleBonus = (attacker.teamMorale - 50) * 0.1;
  const subtotal = base + weaponExpBonus - opp.dodgeBonus - sneakDodge + personalMoraleBonus + teamMoraleBonus;
  const multiplier = 1 + (weapon.hitRateBonus ?? 0) / 100;
  return Math.max(5, Math.min(95, subtotal * multiplier));
}

function computeCoverBlockRate(coverLevel: number) {
  return Math.min(90, 50 + coverLevel * 3);
}

function computeCoverChance(opp: Opponent) {
  const base = opp.coverLevel * 5;
  const dexBonus = (opp.dexterity - 10) * 2;
  const stratBonus = (opp.strategy - 10) * 4;
  return Math.max(0, Math.min(95, base + dexBonus + stratBonus));
}

// Expected damage per shot accounting for hit rate and cover
function expectedDamagePerShot(weapon: Equipment, hitRate: number, opp: Opponent): number {
  const hr = hitRate / 100;
  const coverChance = computeCoverChance(opp) / 100;
  const blockRate = computeCoverBlockRate(opp.coverLevel) / 100;
  // P(damage) = P(hit) × [P(no cover) + P(cover) × P(not blocked)]
  const pDamage = hr * ((1 - coverChance) + coverChance * (1 - blockRate));
  return pDamage * (weapon.damage ?? 0);
}

function shotsPerRound(weapon: Equipment): number {
  return (weapon as any).shotsPerRound ?? 1;
}

function shotsToKill(weapon: Equipment, hitRate: number, opp: Opponent): number {
  const expPerShot = expectedDamagePerShot(weapon, hitRate, opp);
  if (expPerShot <= 0) return Infinity;
  return opp.maxHp / expPerShot;
}

// ── Stat row helper ───────────────────────────────────────────────────────────

function StatRow({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ width: 170, fontSize: 13, color: 'var(--color-text-muted)' }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--color-accent)' }}
      />
      <span style={{ width: 36, textAlign: 'right', fontSize: 13, fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function hitRateColor(hr: number) {
  if (hr >= 75) return '#4ade80';
  if (hr >= 50) return '#facc15';
  if (hr >= 25) return '#fb923c';
  return '#f87171';
}

function ResultCard({ title, value, sub, color }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: '14px 18px', minWidth: 140, flex: 1,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 'bold', color: color ?? 'var(--color-accent)', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const weapons = (equipmentData as Equipment[]).filter(e => e.slot === 'weapon');

export default function Balance() {
  const [weaponId, setWeaponId] = useState(weapons[0]?.id ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>('average');
  const [attacker, setAttacker] = useState<AttackerConfig>(DEFAULT_ATTACKER);
  const [opponent, setOpponent] = useState<Opponent>(() => rollOpponent('average'));

  const weapon = weapons.find(w => w.id === weaponId) ?? weapons[0];

  const handleReroll = useCallback(() => {
    setOpponent(rollOpponent(difficulty));
  }, [difficulty]);

  const handleDiffChange = (d: Difficulty) => {
    setDifficulty(d);
    setOpponent(rollOpponent(d));
  };

  const setA = (key: keyof AttackerConfig) => (v: number) =>
    setAttacker(prev => ({ ...prev, [key]: v }));

  const hitRate = weapon ? computeHitRate(weapon, attacker, opponent) : 0;
  const spr = weapon ? shotsPerRound(weapon) : 1;
  const expDmgPerShot = weapon ? expectedDamagePerShot(weapon, hitRate, opponent) : 0;
  const expDmgPerRound = expDmgPerShot * spr;
  const stk = weapon ? shotsToKill(weapon, hitRate, opponent) : Infinity;
  const roundsToKill = expDmgPerRound > 0 ? opponent.maxHp / expDmgPerRound : Infinity;
  const coverChance = computeCoverChance(opponent);
  const coverBlock = computeCoverBlockRate(opponent.coverLevel);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 860, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>⚖️ Balance Calculator</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 24 }}>
        Simulate hit rate and expected damage against a randomised opponent. Adjust attacker stats and difficulty to explore weapon balance.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* ── Left panel ── */}
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Weapon selector */}
          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>🔫 Weapon</h3>
            <select
              value={weaponId}
              onChange={e => setWeaponId(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', background: 'var(--color-bg)',
                color: 'var(--color-text)', border: '1px solid var(--color-border)',
                borderRadius: 6, fontSize: 13,
              }}
            >
              {weapons.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            {weapon && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                <div>🗡️ Damage: <strong style={{ color: 'var(--color-text)' }}>{weapon.damage}</strong></div>
                <div>🎯 Hit modifier: <strong style={{ color: 'var(--color-text)' }}>{(weapon.hitRateBonus ?? 0) > 0 ? '+' : ''}{weapon.hitRateBonus ?? 0}%</strong> (multiplicative)</div>
                <div>💥 Shots/round: <strong style={{ color: 'var(--color-text)' }}>{spr}</strong></div>
                <div>⚖️ Weight: <strong style={{ color: 'var(--color-text)' }}>{(weapon as any).weight ?? '?'} lb</strong></div>
                <div style={{ marginTop: 6, fontStyle: 'italic' }}>{weapon.description}</div>
              </div>
            )}
          </section>

          {/* Attacker stats */}
          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>🧍 Attacker Stats</h3>
            <StatRow label="Dexterity (1–20)" value={attacker.dexterity} min={1} max={20} onChange={setA('dexterity')} />
            <StatRow label="Personal Morale (0–100)" value={attacker.personalMorale} min={0} max={100} onChange={setA('personalMorale')} />
            <StatRow label="Team Morale (0–100)" value={attacker.teamMorale} min={0} max={100} onChange={setA('teamMorale')} />
            <StatRow label="Weapon Theory EXP" value={attacker.weaponTheoryExp} min={0} max={2000} step={50} onChange={setA('weaponTheoryExp')} />
            <StatRow label="Weapon Practical EXP" value={attacker.weaponPracticalExp} min={0} max={500} step={10} onChange={setA('weaponPracticalExp')} />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Weapon EXP bonus: +{theoryLv(attacker.weaponTheoryExp) * 1 + practicalLv(attacker.weaponPracticalExp) * 2}% to additive subtotal
            </div>
          </section>
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Opponent */}
          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>🎯 Opponent</h3>
              <button
                onClick={handleReroll}
                style={{
                  padding: '5px 12px', fontSize: 12, borderRadius: 5,
                  background: 'var(--color-accent)', color: '#000',
                  border: 'none', cursor: 'pointer', fontWeight: 'bold',
                }}
              >
                🎲 Re-roll
              </button>
            </div>

            {/* Difficulty selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['easy', 'average', 'very_good'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => handleDiffChange(d)}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 5,
                    background: difficulty === d ? 'var(--color-accent)' : 'var(--color-bg)',
                    color: difficulty === d ? '#000' : 'var(--color-text)',
                    border: '1px solid var(--color-border)', cursor: 'pointer', fontWeight: difficulty === d ? 'bold' : 'normal',
                  }}
                >
                  {PROFILES[d].label}
                </button>
              ))}
            </div>

            {/* Rolled stats */}
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>❤️ Max HP</span><strong style={{ color: 'var(--color-text)' }}>{opponent.maxHp} ({opponent.constitution} CON + {opponent.hpGearBonus} gear)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>👁️ Dexterity</span><strong style={{ color: 'var(--color-text)' }}>{opponent.dexterity}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🧠 Strategy</span><strong style={{ color: 'var(--color-text)' }}>{opponent.strategy}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🏃 Dodge bonus (gear)</span><strong style={{ color: 'var(--color-text)' }}>−{opponent.dodgeBonus}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🥷 Sneak practical EXP</span><strong style={{ color: 'var(--color-text)' }}>{opponent.sneakPracticalExp} (Lv {practicalLv(opponent.sneakPracticalExp)})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🪵 Cover level</span><strong style={{ color: 'var(--color-text)' }}>{opponent.coverLevel}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🛡️ Cover chance</span><strong style={{ color: 'var(--color-text)' }}>{coverChance.toFixed(0)}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🛡️ Cover block rate</span><strong style={{ color: 'var(--color-text)' }}>{coverBlock.toFixed(0)}%</strong>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── Results ── */}
      <section style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>📊 Results</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ResultCard
            title="Hit Rate"
            value={`${hitRate.toFixed(1)}%`}
            sub={`per shot (clamped 5–95%)`}
            color={hitRateColor(hitRate)}
          />
          <ResultCard
            title="Dmg if Hit"
            value={`${weapon?.damage ?? 0}`}
            sub={`flat per shot`}
          />
          <ResultCard
            title="Exp Dmg / Round"
            value={expDmgPerRound.toFixed(1)}
            sub={`${spr} shot${spr > 1 ? 's' : ''} × ${expDmgPerShot.toFixed(2)} exp dmg/shot`}
          />
          <ResultCard
            title="Shots to Kill"
            value={isFinite(stk) ? stk.toFixed(1) : '∞'}
            sub={`individual shots (no cover factor)`}
          />
          <ResultCard
            title="Rounds to Kill"
            value={isFinite(roundsToKill) ? roundsToKill.toFixed(1) : '∞'}
            sub={`accounting for cover`}
          />
        </div>

        {/* Hit rate breakdown */}
        <div style={{
          marginTop: 20, background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 8, padding: 16,
        }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13 }}>🔍 Hit Rate Breakdown</h4>
          <div style={{ fontSize: 12, lineHeight: 2, color: 'var(--color-text-muted)' }}>
            {(() => {
              const base = attacker.dexterity * 5;
              const expBonus = theoryLv(attacker.weaponTheoryExp) + practicalLv(attacker.weaponPracticalExp) * 2;
              const sneakPenalty = practicalLv(opponent.sneakPracticalExp);
              const moralePer = (attacker.personalMorale - 50) * 0.2;
              const moraleTeam = (attacker.teamMorale - 50) * 0.1;
              const subtotal = base + expBonus - opponent.dodgeBonus - sneakPenalty + moralePer + moraleTeam;
              const multiplier = 1 + (weapon?.hitRateBonus ?? 0) / 100;
              return (
                <>
                  <div>Base (DEX {attacker.dexterity} × 5): <strong style={{ color: 'var(--color-text)' }}>+{base}%</strong></div>
                  <div>Weapon EXP: <strong style={{ color: 'var(--color-text)' }}>+{expBonus}%</strong></div>
                  <div>Opponent dodge (gear): <strong style={{ color: '#f87171' }}>−{opponent.dodgeBonus}%</strong></div>
                  <div>Opponent sneak EXP dodge: <strong style={{ color: '#f87171' }}>−{sneakPenalty}%</strong></div>
                  <div>Personal morale ({attacker.personalMorale}): <strong style={{ color: moralePer >= 0 ? '#4ade80' : '#f87171' }}>{moralePer >= 0 ? '+' : ''}{moralePer.toFixed(1)}%</strong></div>
                  <div>Team morale ({attacker.teamMorale}): <strong style={{ color: moraleTeam >= 0 ? '#4ade80' : '#f87171' }}>{moraleTeam >= 0 ? '+' : ''}{moraleTeam.toFixed(1)}%</strong></div>
                  <div>Additive subtotal: <strong style={{ color: 'var(--color-text)' }}>{subtotal.toFixed(1)}%</strong></div>
                  <div>Weapon multiplier ({weapon?.hitRateBonus ?? 0 > 0 ? '+' : ''}{weapon?.hitRateBonus ?? 0}%): <strong style={{ color: 'var(--color-text)' }}>× {multiplier.toFixed(2)}</strong></div>
                  <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 4 }}>
                    Final: <strong style={{ color: hitRateColor(hitRate), fontSize: 14 }}>{hitRate.toFixed(1)}%</strong>
                    {(subtotal * multiplier < 5 || subtotal * multiplier > 95) && (
                      <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>(clamped)</span>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </section>
    </div>
  );
}
