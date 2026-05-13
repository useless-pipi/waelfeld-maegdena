import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { recruitMaiden, recruitEmergencyMaiden } from '../engine/recruit';
import { getMaidenIcon } from '../utils/portraits';
import type { Maiden } from '../types/maiden';
import type { Equipment } from '../types/equipment';

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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Recruits() {
  const { mbase, maidens, setMBase, addMaiden, freeRecruitCount, decrementFreeRecruit } = useGameStore();
  const [candidates, setCandidates] = useState<Maiden[] | null>(null);
  const [emergencyDone, setEmergencyDone] = useState(false);

  const bedOccupancy = maidens.filter(m => !m.isFallen).length;
  const aliveCount = maidens.filter(m => !m.isFallen && !m.isCaptured).length;
  const showEmergency = aliveCount < 7;
  const emergencyCount = Math.max(0, 10 - aliveCount);
  const canRecruit = mbase.beds > bedOccupancy;
  const cost = freeRecruitCount > 0 ? 0 : 150;
  const canAfford = mbase.money >= cost;
  const canRoll = canRecruit && canAfford;

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
    setCandidates([recruitMaiden(maidens), recruitMaiden(maidens), recruitMaiden(maidens)]);
  }

  function acceptCandidate(m: Maiden) {
    addMaiden(m);
    setCandidates(null);
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

          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Each roll shows 3 candidates. Accept one to recruit her, or pass — a new set rolls automatically.
          </div>
        </div>

        {/* Right: tag system info */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 8, padding: 20, fontSize: 13,
        }}>
          {candidates ? (
            <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>
              ⏳ A selection pop-up is open — choose a candidate or pass to get a new set.
            </div>
          ) : (
            <>
              <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: 12 }}>🏷️ Tag System</h3>
              <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 14, lineHeight: 1.6 }}>
                Every maiden carries <strong>tags</strong> that reflect her personality, background and skills.
                Tags grant stat bonuses or penalties and shape how she performs in combat.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#4caf50', fontSize: 16, minWidth: 20 }}>🟢</span>
                  <div>
                    <span style={{ color: '#4caf50', fontWeight: 'bold' }}>Positive</span>
                    <span style={{ color: 'var(--color-text-muted)' }}> — pure stat bonuses (e.g. <em>marksman</em>, <em>tough</em>, <em>alert</em>)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#ff9800', fontSize: 16, minWidth: 20 }}>⚡</span>
                  <div>
                    <span style={{ color: '#ff9800', fontWeight: 'bold' }}>Double-edged</span>
                    <span style={{ color: 'var(--color-text-muted)' }}> — a bonus and a penalty (e.g. <em>angry</em>, <em>impulsive</em>, <em>reckless</em>)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#f44336', fontSize: 16, minWidth: 20 }}>🔴</span>
                  <div>
                    <span style={{ color: '#f44336', fontWeight: 'bold' }}>Negative</span>
                    <span style={{ color: 'var(--color-text-muted)' }}> — pure stat penalties (e.g. <em>timid</em>, <em>frail</em>, <em>stubborn</em>)</span>
                  </div>
                </div>
              </div>

              <h4 style={{ color: 'var(--color-accent)', marginBottom: 8 }}>Starting tag composition</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div style={{ padding: '10px 12px', background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Zako maiden</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                    <span><span style={{ color: '#4caf50' }}>🟢 ×2</span> Positive</span>
                    <span><span style={{ color: '#ff9800' }}>⚡ ×1</span> Double-edged</span>
                    <span><span style={{ color: '#f44336' }}>🔴 ×1</span> Negative</span>
                  </div>
                </div>
                <div style={{ padding: '10px 12px', background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#ffd700' }}>★ Heroine</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                    <span><span style={{ color: '#4caf50' }}>🟢 ×3</span> Positive</span>
                    <span><span style={{ color: '#ff9800' }}>⚡ ×2</span> Double-edged</span>
                    <span><span style={{ color: '#f44336' }}>🔴 ×1</span> Negative</span>
                  </div>
                </div>
              </div>

              <p style={{ color: 'var(--color-text-muted)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                Tags assigned at recruitment come from personality, skill, and background pools.
                Combat events can add further tags such as <em>Coward</em>, <em>Thrall</em> or <em>Rescued</em>.
              </p>
            </>
          )}
        </div>
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
