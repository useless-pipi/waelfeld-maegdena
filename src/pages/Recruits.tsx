import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { recruitMaiden, recruitEmergencyMaiden, enrichRecruitGear } from '../engine/recruit';
import { getMaidenIcon } from '../utils/portraits';
import type { Maiden } from '../types/maiden';
import type { Equipment } from '../types/equipment';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Stat order for compact display: STR/DEX/CON/STG/AWR/CHM  HP:xx
const STAT_KEYS: Array<keyof Maiden['stats']> = [
  'strength', 'dexterity', 'constitution', 'strategy', 'awareness', 'charm',
];
const STAT_ABBR = ['STR', 'DEX', 'CON', 'STG', 'AWR', 'CHM'];

function compactStats(m: Maiden): string {
  return STAT_KEYS.map(k => m.stats[k]).join('/') + `  HP:${m.maxHp}`;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function StatTooltip() {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        style={{
          background: 'none', border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)', borderRadius: '50%',
          width: 16, height: 16, fontSize: 10, cursor: 'help',
          padding: 0, lineHeight: '14px', textAlign: 'center',
        }}
        aria-label="Stat format explanation"
      >?</button>
      {show && (
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1814', border: '1px solid var(--color-accent-dark)',
          borderRadius: 6, padding: '10px 12px', zIndex: 100, whiteSpace: 'nowrap',
          fontSize: 11, color: 'var(--color-text)', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 4 }}>
            Format: STR/DEX/CON/STG/AWR/CHM  HP:xx
          </div>
          {STAT_KEYS.map((k, i) => (
            <div key={k}>
              <span style={{ color: 'var(--color-accent)', fontWeight: 'bold', display: 'inline-block', minWidth: 34 }}>{STAT_ABBR[i]}</span>
              {' — '}{k.charAt(0).toUpperCase() + k.slice(1)}
            </div>
          ))}
          <div>
            <span style={{ color: 'var(--color-accent)', fontWeight: 'bold', display: 'inline-block', minWidth: 34 }}>HP</span>
            {' — Max Hit Points (= CON)'}
          </div>
        </div>
      )}
    </span>
  );
}

// ── Equipment popup ───────────────────────────────────────────────────────────
function EquipmentPopup({ equipment, onClose }: { equipment: Equipment[]; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)', border: '1px solid var(--color-accent)',
          borderRadius: 8, padding: 20, minWidth: 280, maxWidth: 380,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)' }}>⚙ Equipment</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        {equipment.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No equipment.</div>
          : equipment.map(eq => (
            <div key={eq.id} style={{
              marginBottom: 10, padding: '8px 10px',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 3 }}>
                {eq.name}{' '}
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 'normal' }}>[{eq.slot}]</span>
              </div>
              {eq.damage != null && <div style={{ fontSize: 11, color: '#c8954a' }}>Damage: {eq.damage}</div>}
              {eq.hitRateBonus != null && eq.hitRateBonus !== 0 && (
                <div style={{ fontSize: 11, color: '#4a9eff' }}>Hit Rate: +{eq.hitRateBonus}%</div>
              )}
              {eq.bonuses.map((b, i) => (
                <div key={i} style={{ fontSize: 11, color: '#a0d080' }}>
                  {b.label}: +{b.value}{b.isPercent ? '%' : ''}
                </div>
              ))}
              {eq.description && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 3 }}>{eq.description}</div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Candidate card ────────────────────────────────────────────────────────────
function CandidateCard({
  maiden,
  onAccept,
  disabled,
}: {
  maiden: Maiden;
  onAccept: () => void;
  disabled: boolean;
}) {
  const [showEq, setShowEq] = useState(false);
  return (
    <div style={{
      background: maiden.type === 'heroine' ? 'rgba(255,215,0,0.05)' : 'var(--color-surface)',
      border: maiden.type === 'heroine' ? '2px solid #ffd700' : '1px solid #111',
      borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: maiden.type === 'heroine' ? '0 0 12px rgba(255,215,0,0.2)' : 'none',
    }}>
      {showEq && <EquipmentPopup equipment={maiden.equipment} onClose={() => setShowEq(false)} />}

      {/* Portrait + name */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={getMaidenIcon(maiden.imgId)}
            alt={maiden.name}
            style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 5, border: maiden.type === 'heroine' ? '2px solid #ffd700' : '1px solid var(--color-border)', display: 'block' }}
          />
          {maiden.type === 'heroine' && (
            <span style={{ position: 'absolute', top: -8, right: -8, fontSize: 14, lineHeight: 1, filter: 'drop-shadow(0 0 4px #ffd700)' }}>★</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: maiden.type === 'heroine' ? '#ffd700' : 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {maiden.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {maiden.qualifications.length > 0
              ? maiden.qualifications.map(q => q.name).join(', ')
              : 'No qualifications'}
          </div>
        </div>
      </div>

      {/* Compact stat strip */}
      <div style={{
        background: '#0e0d0b', borderRadius: 4, padding: '6px 8px',
        fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text)', letterSpacing: 0.3,
      }}>
        {compactStats(maiden)}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onAccept}
          disabled={disabled}
          style={{
            flex: 1, padding: '7px 0',
            background: disabled ? '#333' : 'var(--color-accent-dark)',
            color: disabled ? '#666' : '#fff',
            border: 'none', borderRadius: 4,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 'bold',
          }}
        >Accept</button>
        <button
          onClick={() => setShowEq(true)}
          title="View equipment"
          style={{
            padding: '7px 10px', background: '#1a1814',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)', borderRadius: 4,
            cursor: 'pointer', fontSize: 12,
          }}
        >⚙</button>
      </div>
    </div>
  );
}

// ── Candidates modal ─────────────────────────────────────────────────────────
function CandidatesModal({
  candidates,
  bedsAvailable,
  onAccept,
  onPass,
}: {
  candidates: Maiden[];
  bedsAvailable: boolean;
  onAccept: (m: Maiden) => void;
  onPass: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--color-bg)', border: '1px solid var(--color-accent)',
        borderRadius: 10, padding: 28, width: '100%', maxWidth: 740,
        boxShadow: '0 12px 48px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--color-accent)' }}>⚔️ Choose a Recruit</span>
          <StatTooltip />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>STR/DEX/CON/STG/AWR/CHM  HP:xx</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            You must decide before continuing
          </span>
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
          {candidates.map(m => (
            <CandidateCard
              key={m.id}
              maiden={m}
              onAccept={() => onAccept(m)}
              disabled={!bedsAvailable}
            />
          ))}
        </div>

        {/* Pass */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={onPass}
            style={{
              padding: '8px 28px', background: 'transparent',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)', borderRadius: 5,
              cursor: 'pointer', fontSize: 12,
            }}
          >Pass — decline all</button>
        </div>
      </div>
    </div>
  );
}

// ── Officer of the Rosarium Vocis ─────────────────────────────────────────────
type OfficerMood = 'free' | 'heroine' | 'no_beds' | 'food_warn' | 'no_gold' | 'full' | 'idle';

const OFFICER_LINES: Record<OfficerMood, string[]> = {
  free: [
    "Commander — you have a free recruitment token waiting. Don't let it go to waste. Every maiden who answers the call could be the one who turns the tide.",
    "A volunteer is ready to step forward at no cost to you. The Rosarium has earned her. Now — will you have her?",
    "Our gates are open and the call has been answered. You hold a free token, Commander. Use it.",
  ],
  heroine: [
    "A heroine has joined our ranks — I felt it the moment she passed through these doors. Treasure her well, Commander. They do not come often.",
    "★ Remarkable. A true heroine has answered our call. The Rosarium's reputation grows with her arrival. Keep her close.",
    "I rarely say this, but… she is extraordinary. Welcome her properly, Commander. A heroine is no common recruit.",
  ],
  no_beds: [
    "Commander, our barracks are at full capacity. I cannot process new volunteers until beds are freed — build more tents or accept the losses.",
    "The Rosarium is ready to receive candidates, but the base has no room. Not my problem. Fix your housing situation first.",
    "Every girl who steps through that gate deserves a bed. You have none to offer. Tend to your barracks before you come back here.",
  ],
  food_warn: [
    "A word of caution, Commander — your food stores are running low. More maidens means more mouths. Upgrade the farm before you recruit further, or they march hungry.",
    "I can recruit all the volunteers you want, but a starving unit fights poorly. Your food supply will not sustain more maidens. Tend to the farm first.",
    "The kitchen reports that rations are stretched thin. Adding more girls to the roster now is a risk. Make sure the farm can keep up.",
  ],
  no_gold: [
    "No free tokens, and the treasury is bare. I'm afraid the Rosarium cannot recruit on goodwill alone, Commander.",
    "Gold buys maidens. You have none to spare. Earn more through missions and return when you can afford a proper recruitment.",
    "The coffers are empty. Even the most willing volunteer needs to be outfitted. Come back with gold.",
  ],
  full: [
    "Everything looks in order, Commander. Beds available, resources steady. Whenever you are ready, say the word and I'll call for candidates.",
    "The Rosarium stands ready. Three candidates can be presented at your command.",
    "Roll three names and pick one — that is the tradition of this hall. Speak the word, Commander.",
  ],
  idle: [
    "Welcome to the Rosarium Vocis. Every campaign begins with the right people. I'll find them for you.",
    "Not every maiden who walks through these gates will make history — but the right ones will. Trust the process, Commander.",
    "The Rosarium has supplied this unit since its founding. Ask, and I shall answer.",
  ],
};

function pickLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

function OfficerPanel({
  freeRecruitCount,
  canRecruit,
  canAfford,
  foodShortfall,
  justRecruitedHeroine,
}: {
  freeRecruitCount: number;
  canRecruit: boolean;
  canAfford: boolean;
  foodShortfall: boolean;
  justRecruitedHeroine: boolean;
}) {
  const mood: OfficerMood =
    justRecruitedHeroine ? 'heroine' :
    !canRecruit ? 'no_beds' :
    freeRecruitCount > 0 ? 'free' :
    foodShortfall ? 'food_warn' :
    !canAfford ? 'no_gold' :
    canRecruit && canAfford ? 'full' : 'idle';

  const [line, setLine] = useState(() => pickLine(OFFICER_LINES[mood]));
  const prevMood = useState(mood)[0];

  useEffect(() => {
    setLine(pickLine(OFFICER_LINES[mood]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  const accentColor =
    mood === 'heroine' ? '#ffd700' :
    mood === 'no_beds' || mood === 'no_gold' ? 'var(--color-danger)' :
    mood === 'food_warn' ? '#ff9800' :
    mood === 'free' ? '#4caf50' :
    'var(--color-accent)';

  const moodLabel =
    mood === 'heroine' ? '★ Heroine enrolled' :
    mood === 'no_beds' ? '⚠ Barracks full' :
    mood === 'food_warn' ? '⚠ Food shortage' :
    mood === 'no_gold' ? '⚠ Insufficient gold' :
    mood === 'free' ? '📋 Free token available' :
    mood === 'full' ? '✔ Ready to recruit' : '';

  return (
    <div style={{
      background: 'var(--color-surface)', border: `1px solid ${accentColor}`,
      borderRadius: 8, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: mood === 'heroine' ? '0 0 18px rgba(255,215,0,0.18)' : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>
      {/* Header bar */}
      <div style={{
        background: 'rgba(0,0,0,0.35)', borderBottom: `1px solid ${accentColor}`,
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 12, fontWeight: 'bold', color: accentColor }}>
          Officer of the Rosarium Vocis
        </span>
        {moodLabel && (
          <span style={{
            fontSize: 10, color: accentColor, border: `1px solid ${accentColor}`,
            borderRadius: 3, padding: '1px 6px', background: 'rgba(0,0,0,0.3)',
          }}>{moodLabel}</span>
        )}
      </div>

      {/* Body: portrait + speech */}
      <div style={{ display: 'flex', gap: 0, flex: 1 }}>
        {/* Portrait */}
        <div style={{
          flexShrink: 0, width: 160,
          background: 'linear-gradient(to bottom, #0e0c09, #181410)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          borderRight: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <img
            src={`${BASE}/imgs/chars/promo.png`}
            alt="Officer of the Rosarium Vocis"
            style={{
              width: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              display: 'block',
              filter: mood === 'no_beds' || mood === 'no_gold' ? 'saturate(0.5)' : 'none',
              transition: 'filter 0.3s',
            }}
          />
        </div>

        {/* Speech bubble area */}
        <div style={{
          flex: 1, padding: '20px 18px', display: 'flex',
          flexDirection: 'column', justifyContent: 'center', gap: 16,
        }}>
          {/* Quote */}
          <div style={{
            position: 'relative',
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${accentColor}`,
            borderRadius: 8, padding: '14px 16px',
          }}>
            {/* Speech triangle pointing left */}
            <div style={{
              position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '7px solid transparent',
              borderBottom: '7px solid transparent',
              borderRight: `8px solid ${accentColor}`,
            }} />
            <div style={{
              position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderRight: '7px solid #0e0d0b',
            }} />
            <p style={{
              margin: 0, fontSize: 13, color: 'var(--color-text)',
              lineHeight: 1.7, fontStyle: 'italic',
            }}>
              "{line}"
            </p>
          </div>

          {/* Refresh line button */}
          <button
            onClick={() => setLine(pickLine(OFFICER_LINES[mood]))}
            style={{
              alignSelf: 'flex-start',
              background: 'none', border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)', borderRadius: 4,
              fontSize: 10, padding: '3px 10px', cursor: 'pointer',
            }}
          >↻ another word</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Recruits() {
  const { mbase, maidens, setMBase, addMaiden, freeRecruitCount, decrementFreeRecruit, buildings } = useGameStore();
  const [candidates, setCandidates] = useState<Maiden[] | null>(null);
  const [emergencyDone, setEmergencyDone] = useState(false);
  const [fastRecruitLog, setFastRecruitLog] = useState<{ id: string; name: string; nickname?: string; imgId: number; type: 'heroine' | 'zako'; dex: number }[] | null>(null);
  const [justRecruitedHeroine, setJustRecruitedHeroine] = useState(false);

  // Rosarium Vocis: cost per recruit and gear rarity
  const rosariumBuilding = buildings.find(b => b.id === 'rosarium_vocis');
  const rosariumLvDef = rosariumBuilding?.isConstructed && rosariumBuilding.currentLevel > 0
    ? rosariumBuilding.levels[rosariumBuilding.currentLevel - 1]
    : null;
  const rosariumCost: number = (rosariumLvDef?.effectValue as any)?.recruitCost ?? 150;
  const rosariumGearRarity: number = Number((rosariumLvDef?.effectValue as any)?.gearRarity ?? 1);

  const bedOccupancy = maidens.filter(m => !m.isFallen).length;
  const aliveCount = maidens.filter(m => !m.isFallen && !m.isCaptured).length;
  const showEmergency = aliveCount < 7;
  const emergencyCount = Math.max(0, 10 - aliveCount);
  const canRecruit = mbase.beds > bedOccupancy;
  const cost = freeRecruitCount > 0 ? 0 : rosariumCost;
  const canAfford = mbase.money >= cost;
  const canRoll = canRecruit && canAfford;

  const freeBeds = mbase.beds - bedOccupancy;
  // Food shortfall: total expected food cost for all active maidens vs current food stores
  const totalFoodCost = maidens
    .filter(m => !m.isFallen && !m.isCaptured)
    .reduce((sum, m) => sum + 20 + m.stats.strength, 0);
  const foodShortfall = mbase.food < totalFoodCost;
  // How many can we actually afford: free slots consumed by freeRecruitCount, rest by money
  const affordablePaid = Math.floor(Math.max(0, mbase.money) / rosariumCost);
  const affordableTotal = Math.min(freeBeds, freeRecruitCount + affordablePaid);
  const fastCost = Math.max(0, affordableTotal - freeRecruitCount) * rosariumCost;
  const canFastRecruit = affordableTotal > 0;
  const canFastFreeRecruit = freeRecruitCount > 0 && freeBeds > 0;

  function pickBest(pool: Maiden[]): Maiden {
    // Prefer heroines; among equals pick highest DEX
    const heroines = pool.filter(m => m.type === 'heroine');
    const candidates = heroines.length > 0 ? heroines : pool;
    return candidates.reduce((best, m) => m.stats.dexterity > best.stats.dexterity ? m : best);
  }

  function doFastRecruit() {
    if (!canFastRecruit) return;
    const log: { id: string; name: string; nickname?: string; imgId: number; type: 'heroine' | 'zako'; dex: number }[] = [];
    let currentMaidens = [...maidens];
    let currentMoney = mbase.money;
    let freeFree = freeRecruitCount;
    let freeUsed = 0;
    let beds = mbase.beds - currentMaidens.filter(m => !m.isFallen).length;

    while (beds > 0) {
      const rollCost = freeFree > 0 ? 0 : rosariumCost;
      if (currentMoney < rollCost) break;
      if (freeFree > 0) { freeFree--; freeUsed++; } else currentMoney -= rollCost;
      const pool = [recruitMaiden(currentMaidens), recruitMaiden(currentMaidens), recruitMaiden(currentMaidens)];
      let chosen = pickBest(pool);
      if (rosariumGearRarity > 1) chosen = enrichRecruitGear(chosen, rosariumGearRarity);
      addMaiden(chosen);
      currentMaidens = [...currentMaidens, chosen];
      beds--;
      log.push({ id: chosen.id, name: chosen.name, nickname: chosen.nickname, imgId: chosen.imgId, type: chosen.type, dex: chosen.stats.dexterity });
    }
    setMBase({ money: currentMoney });
    for (let i = 0; i < freeUsed; i++) decrementFreeRecruit();
    setFastRecruitLog(log);
  }

  function doFastFreeRecruit() {
    if (!canFastFreeRecruit) return;
    const log: { id: string; name: string; nickname?: string; imgId: number; type: 'heroine' | 'zako'; dex: number }[] = [];
    let currentMaidens = [...maidens];
    let freeFree = freeRecruitCount;
    let freeUsed = 0;
    let beds = mbase.beds - currentMaidens.filter(m => !m.isFallen).length;

    while (beds > 0 && freeFree > 0) {
      freeFree--; freeUsed++;
      const pool = [recruitMaiden(currentMaidens), recruitMaiden(currentMaidens), recruitMaiden(currentMaidens)];
      let chosen = pickBest(pool);
      if (rosariumGearRarity > 1) chosen = enrichRecruitGear(chosen, rosariumGearRarity);
      addMaiden(chosen);
      currentMaidens = [...currentMaidens, chosen];
      beds--;
      log.push({ id: chosen.id, name: chosen.name, nickname: chosen.nickname, imgId: chosen.imgId, type: chosen.type, dex: chosen.stats.dexterity });
    }
    for (let i = 0; i < freeUsed; i++) decrementFreeRecruit();
    setFastRecruitLog(log);
  }

  function doEmergencyRecruit() {
    if (emergencyCount <= 0) return;
    for (let i = 0; i < emergencyCount; i++) {
      addMaiden(recruitEmergencyMaiden());
    }
    setEmergencyDone(true);
  }

  function rollCandidates() {
    if (!canRoll) return;
    if (freeRecruitCount > 0) {
      decrementFreeRecruit();
    } else {
      setMBase({ money: mbase.money - cost });
    }
    let pool: Maiden[] = [recruitMaiden(maidens), recruitMaiden(maidens), recruitMaiden(maidens)];
    if (rosariumGearRarity > 1) pool = pool.map(m => enrichRecruitGear(m, rosariumGearRarity));
    setCandidates(pool);
  }

  function acceptCandidate(m: Maiden) {
    addMaiden(m);
    setCandidates(null);
    if (m.type === 'heroine') {
      setJustRecruitedHeroine(true);
      setTimeout(() => setJustRecruitedHeroine(false), 30000);
    } else {
      setJustRecruitedHeroine(false);
    }
  }

  function passCandidates() {
    setCandidates(null);
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>📋 Recruits</h2>

      {/* Blocking modal when candidates are available */}
      {candidates && (
        <CandidatesModal
          candidates={candidates}
          bedsAvailable={mbase.beds > bedOccupancy}
          onAccept={acceptCandidate}
          onPass={passCandidates}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: status */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
          <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: 12 }}>Recruitment</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <StatRow label="Free Recruits Left" value={freeRecruitCount} />
            <StatRow label="Roll Cost" value={freeRecruitCount > 0 ? 'FREE' : `${cost}g`} />
            <StatRow label="Beds Available" value={`${mbase.beds - bedOccupancy}/${mbase.beds}`} />
            <StatRow label="Gold" value={mbase.money} />
          </div>

          {!canRecruit && (
            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(184,64,64,0.15)', border: '1px solid var(--color-danger)', borderRadius: 6, fontSize: 12, color: '#e88' }}>
              ⚠️ No beds available. Build more tents.
            </div>
          )}
          {canRecruit && !canAfford && freeRecruitCount === 0 && (
            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(184,64,64,0.15)', border: '1px solid var(--color-danger)', borderRadius: 6, fontSize: 12, color: '#e88' }}>
              ⚠️ Not enough gold.
            </div>
          )}

          <button
              onClick={rollCandidates}
              disabled={!canRoll}
              style={{
                width: '100%', padding: '10px',
                background: canRoll ? 'var(--color-accent-dark)' : '#555',
                color: '#fff', border: 'none', borderRadius: 6,
                cursor: canRoll ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 'bold',
              }}
            >Roll 3 Candidates</button>

          {/* Fast Recruit */}
          <button
            onClick={doFastRecruit}
            disabled={!canFastRecruit}
            style={{
              width: '100%', padding: '10px',
              marginTop: 8,
              background: canFastRecruit ? '#5a3a7e' : '#555',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: canFastRecruit ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 'bold',
            }}
          >
            ⚡ Fast Recruit ({affordableTotal} maiden{affordableTotal !== 1 ? 's' : ''} — {fastCost > 0 ? `${fastCost}g` : 'free'})
          </button>

          {/* Fast Free Recruit */}
          <button
            onClick={doFastFreeRecruit}
            disabled={!canFastFreeRecruit}
            style={{
              width: '100%', padding: '10px',
              marginTop: 6,
              background: canFastFreeRecruit ? '#1a5a3a' : '#555',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: canFastFreeRecruit ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 'bold',
            }}
          >
            🎟️ Free Recruit ({Math.min(freeRecruitCount, freeBeds)} free token{Math.min(freeRecruitCount, freeBeds) !== 1 ? 's' : ''})
          </button>

          {fastRecruitLog && (
            <div style={{ marginTop: 8, background: 'var(--color-bg)', borderRadius: 6, padding: '8px 10px', fontSize: 11 }}>
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold', marginBottom: 6 }}>
                Recruited {fastRecruitLog.length}:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fastRecruitLog.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img
                      src={getMaidenIcon(entry.imgId)}
                      alt={entry.name}
                      style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: entry.type === 'heroine' ? '2px solid #ffd700' : '1px solid var(--color-border)', flexShrink: 0 }}
                    />
                    <span style={{ color: entry.type === 'heroine' ? '#ffd700' : 'var(--color-text-muted)', fontWeight: entry.type === 'heroine' ? 'bold' : 'normal' }}>
                      {entry.nickname ?? entry.name.split(' ')[0]}
                      {entry.type === 'heroine' && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.8 }}>★ Heroine</span>}
                    </span>
                    <span style={{ fontSize: 10, color: '#666', marginLeft: 'auto' }}>DEX {entry.dex}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setFastRecruitLog(null)}
                style={{ marginTop: 8, background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: 10, cursor: 'pointer', padding: '2px 8px' }}
              >Dismiss</button>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Each roll shows 3 candidates. Accept one to recruit her, or pass — a new set rolls automatically.
          </div>
        </div>

        {/* Right: officer commentary */}
        <OfficerPanel
          freeRecruitCount={freeRecruitCount}
          canRecruit={canRecruit}
          canAfford={canAfford}
          foodShortfall={foodShortfall}
          justRecruitedHeroine={justRecruitedHeroine}
        />
      </div>

      {/* Emergency Recruitment ─────────────────────────────────────────── */}
      {showEmergency && (
        <div style={{
          marginTop: 24,
          background: 'rgba(180,30,30,0.08)',
          border: '1px solid #7a1a1a',
          borderRadius: 8, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 'bold', color: '#e05050' }}>🚨 Emergency Recruitment</span>
            <span style={{
              fontSize: 10, fontWeight: 'bold', color: '#e05050',
              border: '1px solid #7a1a1a', borderRadius: 3, padding: '1px 5px',
              background: 'rgba(180,30,30,0.2)',
            }}>CRITICAL</span>
          </div>
          <p style={{ fontSize: 12, color: '#c88', margin: '0 0 12px', lineHeight: 1.7 }}>
            Your unit is critically undermanned —{' '}
            <strong style={{ color: '#e88' }}>{aliveCount} maiden{aliveCount !== 1 ? 's' : ''}</strong> still active.
            Desperate volunteers can be pressed into service immediately.
          </p>

          {/* Warning box */}
          <div style={{
            background: 'rgba(120,20,20,0.25)', border: '1px solid #5a1010',
            borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12,
          }}>
            <div style={{ fontWeight: 'bold', color: '#e05050', marginBottom: 6 }}>⚠ Emergency recruits are untrained volunteers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#b88' }}>
              <span>• All stats <strong style={{ color: '#e88' }}>−2</strong> (untrained tag — permanent)</span>
              <span>• Equipped only with <strong>civilian clothes</strong>, worn shoes, and a basic rifle</span>
              <span>• No formal Waelfeld dress or marching greaves</span>
              <span>• Bed capacity limit is <strong>waived</strong> for emergency intake</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 13, color: '#c88' }}>
              Volunteers to recruit: <strong style={{ color: '#e88', fontSize: 15 }}>{emergencyCount}</strong>
              <span style={{ fontSize: 11, color: '#888', marginLeft: 6 }}>(= 10 − {aliveCount} active)</span>
            </div>
            {emergencyDone ? (
              <div style={{
                padding: '9px 20px', background: '#1a2a1a',
                border: '1px solid #3a7a3a', borderRadius: 6,
                color: '#7c7', fontSize: 13, fontWeight: 'bold',
              }}>✔ Intake complete</div>
            ) : (
              <button
                onClick={doEmergencyRecruit}
                style={{
                  padding: '9px 22px',
                  background: '#7a1a1a', color: '#ffc0c0',
                  border: '1px solid #e05050', borderRadius: 6,
                  cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
                  letterSpacing: 0.3,
                }}
              >🚨 Conscript {emergencyCount} Volunteer{emergencyCount !== 1 ? 's' : ''}</button>
            )}
          </div>
          {!emergencyDone && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#777', fontStyle: 'italic' }}>
              No selection — volunteers are assigned automatically. This can only be done once per threshold crossing.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-text)' }}>{value}</span>
    </div>
  );
}
