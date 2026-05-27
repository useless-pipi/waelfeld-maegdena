/**
 * ThreatReview — Developer-only simulation workbench for calibrating
 * the Force Strength Index (FSI) and Mission Threat Score systems.
 *
 * Run thousands of maiden-team × mission combos in the browser and
 * export the results as JSON for offline analysis.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { simulateStage } from '../engine/combat';
import {
  initializeStageEnemies,
  enrichEnemyGear,
  computeForceStrengthIndex,
} from '../engine/missionGen';
import { recruitMaiden, enrichRecruitGear, heroineDefToMaiden } from '../engine/recruit';
import { HEROINE_DEFINITIONS } from '../data/heroines';
import type { MissionStage } from '../types/mission';
import type { Maiden } from '../types/maiden';

// ── Constants ───────────────────────────────────────────────────────────────

// Same weights and stage scaling as missionThreatFsi in Missions.tsx
// Calibrated to simulation data: ratio ≈1.0 → ~50% win probability
const ALL_TEAM_SIZES   = [5, 10, 20, 30, 40, 60];
const ALL_HERO_RATIOS  = [0, 0.25, 0.5];          // fraction of team that are heroines
const ALL_GEAR_RARITIES= [1, 2, 3, 4];
const ALL_QUALITIES    = [1,2,3,4,5,6,7,8,9,10];
const ALL_STAGE_COUNTS = [1, 2, 3];
const ALL_WEAPON_TYPES = ['rifle', 'shotgun', 'smg', 'machine_gun'];

const GEAR_LABELS: Record<number, string> = {
  1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Very Rare',
};

// Lyssa IDs by quality tier (pick first available for each quality >= 4)
const QUALITY_LYSSA_IDS: Record<number, string> = {
  4: 'lyssa_01', 5: 'lyssa_04', 6: 'lyssa_07',
  7: 'lyssa_11', 8: 'lyssa_16', 9: 'lyssa_22', 10: 'lyssa_27',
};

function qualityToDifficulty(q: number): string {
  if (q <= 2) return 'easy';
  if (q <= 4) return 'normal';
  if (q <= 6) return 'hard';
  if (q <= 8) return 'extreme';
  return 'hell';
}

function computeMissionThreatScore(quality: number, stageCount: number, hasLyssa: boolean): number {
  // Per-stage quality computation mirrors missionThreatFsi() in Missions.tsx.
  // Real missions escalate quality per stage, but ThreatReview uses uniform quality — so
  // we approximate using the same weight + sub-linear stage factors.
  const w: Record<string, number> = { easy: 14, normal: 28, hard: 48, extreme: 76, hell: 115 };
  const diff = qualityToDifficulty(quality);
  const baseWeight = w[diff];
  // Lyssa appears on stage 1+ only; last stage gets one Lyssa when hasLyssa=true
  // Stage factors: s0=1.0, s1=0.85, s2=0.75, s3+=0.65
  const stageFactors = [1.0, 0.85, 0.75, 0.65];
  let total = 0;
  for (let si = 0; si < stageCount; si++) {
    const isLastStage = si === stageCount - 1;
    const lyssaHere = hasLyssa && isLastStage ? 1 : 0;
    const stageThreat = baseWeight * (1 + lyssaHere * 0.5);
    total += stageThreat * (stageFactors[si] ?? 0.65);
  }
  return Math.round(total);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SimConfig {
  attempts: number;
  teamSizes: number[];
  heroineRatios: number[];
  gearRarities: number[];
  qualities: number[];
  stageCounts: number[];
  withLyssa: boolean;
  weaponTypes: string[];
}

interface SimResult {
  teamSize: number;
  heroineCount: number;
  zakoCount: number;
  gearRarity: number;
  gearRarityLabel: string;
  teamFsi: number;
  tierLabel: string;
  enemyQuality: number;
  difficulty: string;
  stageCount: number;
  hasLyssa: boolean;
  weaponType: string;
  coverLevelAvg: number;
  missionThreat: number;
  fsiRatio: number;
  attempts: number;
  winRate: number;
  avgAlive: number;
  avgCaptured: number;
  avgKia: number;
  avgSurvivalRate: number;
}

interface AttemptResult {
  win: boolean;
  alive: number;
  captured: number;
  kia: number;
}

// ── Engine helpers ───────────────────────────────────────────────────────────

function makeSyntheticStage(
  quality: number,
  weaponType: string,
  stageIdx: number,
  hasLyssa: boolean,
  isLastStage: boolean,
): MissionStage {
  const coverLevel = Math.max(0, Math.min(5, Math.floor((quality - 1) / 2)));
  const zakoCount  = 2 + Math.floor(quality / 2); // Q1 → 2, Q10 → 7
  return {
    id:       `sim_q${quality}_s${stageIdx}_${Date.now()}`,
    name:     `Stage ${stageIdx + 1}`,
    enemies:  [],
    coverLevel,
    template: {
      lyssaIds: (hasLyssa && isLastStage && quality >= 4)
        ? [QUALITY_LYSSA_IDS[quality] ?? 'lyssa_01']
        : [],
      zako: [{ count: zakoCount, quality, weaponType }],
    },
  };
}

function buildTeam(teamSize: number, heroineCount: number, gearRarity: number): Maiden[] {
  const team: Maiden[] = [];
  for (let i = 0; i < heroineCount; i++) {
    const def = HEROINE_DEFINITIONS[i % HEROINE_DEFINITIONS.length];
    team.push(enrichRecruitGear(heroineDefToMaiden(def), gearRarity));
  }
  for (let i = 0; i < teamSize - heroineCount; i++) {
    team.push(enrichRecruitGear(recruitMaiden(team), gearRarity));
  }
  return team;
}

function runAttempt(
  team: Maiden[],
  quality: number,
  weaponType: string,
  stageCount: number,
  hasLyssa: boolean,
): AttemptResult {
  // Fresh shallow copy of every maiden so stats are reset between attempts
  let currentMaidens: Maiden[] = team.map(m => ({
    ...m,
    currentHp: m.maxHp,
    statusEffects: [],
    moraleQuitStatus: null,
  }));

  let win = false;
  let totalCaptured = 0;

  for (let si = 0; si < stageCount; si++) {
    if (currentMaidens.length === 0) break;

    const isLast = si === stageCount - 1;
    const stage  = makeSyntheticStage(quality, weaponType, si, hasLyssa, isLast);
    const enemies = initializeStageEnemies(stage).map(enrichEnemyGear);

    if (enemies.length === 0) {
      if (isLast) win = true;
      continue;
    }

    const result = simulateStage(currentMaidens as any, enemies as any, stage.coverLevel);

    totalCaptured += result.moraleCapturedIds.length;

    const capturedSet = new Set(result.moraleCapturedIds);
    const survivors   = result.updatedMaidens.filter(
      (m: any) => m.currentHp > 0 && !capturedSet.has(m.id),
    ) as Maiden[];

    if (result.outcome === 'maiden_victory' || result.outcome === 'enemy_retreat') {
      currentMaidens = survivors;
      if (isLast) win = true;
    } else {
      currentMaidens = survivors;
      break;
    }
  }

  const alive = currentMaidens.length;
  const kia   = Math.max(0, team.length - alive - totalCaptured);
  return { win, alive, captured: totalCaptured, kia };
}

function countCombos(cfg: SimConfig): number {
  let n = 0;
  for (const teamSize of cfg.teamSizes) {
    for (const ratio of cfg.heroineRatios) {
      const heroineCount = Math.min(Math.round(teamSize * ratio), teamSize);
      void heroineCount;
      for (const _ of cfg.gearRarities) {
        for (const q of cfg.qualities) {
          for (const _ of cfg.stageCounts) {
            // always no-lyssa
            n += cfg.weaponTypes.length;
            // lyssa variant (only Q3+, matching engine rule: stageQ >= 3)
            if (cfg.withLyssa && q >= 3) {
              n += cfg.weaponTypes.length;
            }
          }
        }
      }
    }
  }
  return n;
}

// ── Scatter Plot Canvas ───────────────────────────────────────────────────────

function ScatterPlot({ results }: { results: SimResult[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD = 36;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = PAD + (i / 10) * (W - PAD * 2);
      ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, H - PAD);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const y = PAD + (i / 5) * (H - PAD * 2);
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#888';
    ctx.font      = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FSI Ratio (Team FSI / Mission Threat)', W / 2, H - 4);
    ctx.save();
    ctx.translate(10, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Win Rate', 0, 0);
    ctx.restore();

    // Reference line at win rate 0.5 and fsi ratio 1.0
    ctx.strokeStyle = '#444';
    ctx.setLineDash([4, 4]);
    const refX = PAD + (1.0 / 3) * (W - PAD * 2);
    ctx.beginPath(); ctx.moveTo(refX, PAD); ctx.lineTo(refX, H - PAD); ctx.stroke();
    const refY = PAD + (0.5 / 1) * (H - PAD * 2);
    ctx.beginPath(); ctx.moveTo(PAD, refY); ctx.lineTo(W - PAD, refY); ctx.stroke();
    ctx.setLineDash([]);

    // Dots
    const MAX_FSI_RATIO = 3.0;
    for (const r of results) {
      const x = PAD + Math.min(r.fsiRatio / MAX_FSI_RATIO, 1) * (W - PAD * 2);
      const y = PAD + (1 - r.winRate) * (H - PAD * 2);

      const wr = r.winRate;
      const hue = wr < 0.4 ? 0 : wr < 0.7 ? 40 : 120;
      ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.55)`;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tick labels X
    ctx.fillStyle = '#666';
    ctx.font      = '9px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 3; i++) {
      const x = PAD + (i / 3) * (W - PAD * 2);
      ctx.fillText(String(i), x, H - PAD + 12);
    }
    // Tick labels Y
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = PAD + (i / 4) * (H - PAD * 2);
      ctx.fillText((1 - i / 4).toFixed(1), PAD - 4, y + 4);
    }
  }, [results]);

  return (
    <canvas
      ref={canvasRef}
      width={460}
      height={280}
      style={{ border: '1px solid var(--color-border)', borderRadius: 6, display: 'block' }}
    />
  );
}

// ── Toggle-list helper ────────────────────────────────────────────────────────

function ToggleList<T extends number | string>({
  label,
  all,
  selected,
  onChange,
  fmt,
}: {
  label: string;
  all: T[];
  selected: T[];
  onChange: (v: T[]) => void;
  fmt?: (v: T) => string;
}) {
  const toggle = (v: T) => {
    if (selected.includes(v)) {
      onChange(selected.filter(x => x !== v));
    } else {
      onChange([...selected, v].sort((a, b) => Number(a) - Number(b)));
    }
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {all.map(v => (
          <button
            key={String(v)}
            onClick={() => toggle(v)}
            style={{
              padding: '2px 7px',
              fontSize: 12,
              border: '1px solid',
              borderRadius: 4,
              cursor: 'pointer',
              background: selected.includes(v) ? 'var(--color-accent)' : 'transparent',
              borderColor: selected.includes(v) ? 'var(--color-accent)' : 'var(--color-border)',
              color: selected.includes(v) ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {fmt ? fmt(v) : String(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = keyof SimResult;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ThreatReview() {
  // Guard: dev-only
  if (!import.meta.env.DEV) {
    return (
      <div style={{ padding: 32, color: 'var(--color-text-muted)' }}>
        This page is only available in development mode.
      </div>
    );
  }

  const [config, setConfig] = useState<SimConfig>({
    attempts: 5,
    teamSizes:     [5, 10, 20, 40],
    heroineRatios: [0, 0.5],
    gearRarities:  [1, 2, 3, 4],
    qualities:     ALL_QUALITIES,
    stageCounts:   [1, 2, 3],
    withLyssa:     true,
    weaponTypes:   ['rifle'],
  });

  const [running,   setRunning]   = useState(false);
  const [progress,  setProgress]  = useState(0);   // 0–1
  const [status,    setStatus]    = useState('');
  const [results,   setResults]   = useState<SimResult[]>([]);
  const [sortKey,   setSortKey]   = useState<SortKey>('fsiRatio');
  const [sortAsc,   setSortAsc]   = useState(true);
  const cancelRef = useRef(false);

  const totalCombos = countCombos(config);
  const totalRuns   = totalCombos * config.attempts;

  // ── Simulation runner ─────────────────────────────────────────────────────

  const runSimulation = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setResults([]);
    cancelRef.current = false;

    const allResults: SimResult[] = [];
    let done = 0;

    for (const teamSize of config.teamSizes) {
      if (cancelRef.current) break;

      for (const ratio of config.heroineRatios) {
        if (cancelRef.current) break;
        const heroineCount = Math.min(Math.round(teamSize * ratio), teamSize);

        for (const gearRarity of config.gearRarities) {
          if (cancelRef.current) break;

          // Build team once per (size, heroineCount, gearRarity)
          const team = buildTeam(teamSize, heroineCount, gearRarity);
          const fsiResult = computeForceStrengthIndex(team);
          const teamFsi   = fsiResult.fsi;
          const tierLabel = fsiResult.tierLabel;

          for (const quality of config.qualities) {
            if (cancelRef.current) break;

            const lyssaVariants = config.withLyssa && quality >= 3
              ? [false, true]
              : [false];

            for (const hasLyssa of lyssaVariants) {
              for (const stageCount of config.stageCounts) {
                for (const weaponType of config.weaponTypes) {
                  if (cancelRef.current) break;

                  // Run N attempts
                  let wins = 0, sumAlive = 0, sumCaptured = 0, sumKia = 0;
                  for (let a = 0; a < config.attempts; a++) {
                    const r = runAttempt(team, quality, weaponType, stageCount, hasLyssa);
                    if (r.win) wins++;
                    sumAlive    += r.alive;
                    sumCaptured += r.captured;
                    sumKia      += r.kia;
                  }

                  const missionThreat = computeMissionThreatScore(quality, stageCount, hasLyssa);
                  const fsiRatio      = missionThreat > 0 ? teamFsi / missionThreat : 99;
                  const winRate       = wins / config.attempts;
                  const avgAlive      = sumAlive    / config.attempts;
                  const avgCaptured   = sumCaptured / config.attempts;
                  const avgKia        = sumKia      / config.attempts;
                  const avgSurvival   = teamSize > 0 ? avgAlive / teamSize : 0;

                  const row: SimResult = {
                    teamSize, heroineCount, zakoCount: teamSize - heroineCount,
                    gearRarity, gearRarityLabel: GEAR_LABELS[gearRarity],
                    teamFsi: Math.round(teamFsi * 10) / 10,
                    tierLabel,
                    enemyQuality: quality,
                    difficulty: qualityToDifficulty(quality),
                    stageCount, hasLyssa, weaponType,
                    coverLevelAvg: Math.max(0, Math.min(5, Math.floor((quality - 1) / 2))),
                    missionThreat: Math.round(missionThreat * 10) / 10,
                    fsiRatio: Math.round(fsiRatio * 100) / 100,
                    attempts: config.attempts,
                    winRate: Math.round(winRate * 1000) / 1000,
                    avgAlive: Math.round(avgAlive * 10) / 10,
                    avgCaptured: Math.round(avgCaptured * 10) / 10,
                    avgKia: Math.round(avgKia * 10) / 10,
                    avgSurvivalRate: Math.round(avgSurvival * 1000) / 1000,
                  };

                  allResults.push(row);
                  done++;

                  setProgress(done / totalCombos);
                  setStatus(
                    `[${done}/${totalCombos}] Team ${teamSize}p / Q${quality}×${stageCount}s` +
                    (hasLyssa ? ' +Lyssa' : ''),
                  );

                  // Yield to browser every 20 combos
                  if (done % 20 === 0) {
                    setResults([...allResults]);
                    await new Promise(res => setTimeout(res, 0));
                  }
                }
              }
            }
          }
        }
      }
    }

    setResults([...allResults]);
    setProgress(cancelRef.current ? progress : 1);
    setStatus(cancelRef.current ? '⛔ Cancelled.' : `✅ Done — ${allResults.length} records generated.`);
    setRunning(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const cancelSimulation = () => { cancelRef.current = true; };

  // ── Export ────────────────────────────────────────────────────────────────

  const exportJSON = () => {
    const payload = {
      meta: {
        generatedAt: new Date().toISOString(),
        totalCombos: results.length,
        attemptsPerCombo: config.attempts,
        config,
        notes: 'Threat Review simulation for FSI / Mission Threat Score calibration',
      },
      results,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `threat-review-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Table sort ────────────────────────────────────────────────────────────

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...results].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (typeof va === 'boolean') return sortAsc ? (va ? 1 : -1) : (va ? -1 : 1);
    return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
  });

  const TH = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => handleSort(k)}
      style={{
        padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
        background: sortKey === k ? 'var(--color-accent)' : 'transparent',
        color: sortKey === k ? '#fff' : 'var(--color-text-muted)',
        userSelect: 'none', fontSize: 11,
      }}
    >
      {label}{sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', color: 'var(--color-accent)' }}>🧪 Threat Review</h2>
      <p style={{ margin: '0 0 20px', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Developer tool for FSI &amp; Mission Threat Score calibration. Simulate maiden teams against
        procedurally generated missions and export the results as JSON.
      </p>

      {/* ── Config + Scatter layout ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, marginBottom: 16 }}>

        {/* Config panel */}
        <div style={panelStyle}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--color-text)' }}>
            ⚙️ Simulation Parameters
          </div>

          <ToggleList
            label="Team Sizes"
            all={ALL_TEAM_SIZES}
            selected={config.teamSizes}
            onChange={v => setConfig(c => ({ ...c, teamSizes: v as number[] }))}
          />
          <ToggleList
            label="Heroine Ratio (0 = all zako, 0.5 = half heroines)"
            all={ALL_HERO_RATIOS}
            selected={config.heroineRatios}
            onChange={v => setConfig(c => ({ ...c, heroineRatios: v as number[] }))}
            fmt={v => `${Math.round(Number(v) * 100)}%`}
          />
          <ToggleList
            label="Gear Rarity"
            all={ALL_GEAR_RARITIES}
            selected={config.gearRarities}
            onChange={v => setConfig(c => ({ ...c, gearRarities: v as number[] }))}
            fmt={v => GEAR_LABELS[Number(v)]}
          />
          <ToggleList
            label="Enemy Quality"
            all={ALL_QUALITIES}
            selected={config.qualities}
            onChange={v => setConfig(c => ({ ...c, qualities: v as number[] }))}
          />
          <ToggleList
            label="Stage Count"
            all={ALL_STAGE_COUNTS}
            selected={config.stageCounts}
            onChange={v => setConfig(c => ({ ...c, stageCounts: v as number[] }))}
          />
          <ToggleList
            label="Weapon Type"
            all={ALL_WEAPON_TYPES}
            selected={config.weaponTypes}
            onChange={v => setConfig(c => ({ ...c, weaponTypes: v as string[] }))}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              <input
                type="checkbox"
                checked={config.withLyssa}
                onChange={e => setConfig(c => ({ ...c, withLyssa: e.target.checked }))}
                style={{ marginRight: 5 }}
              />
              Include Lyssa variants (Q3+ only)
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Attempts per combo</label>
            <input
              type="number"
              min={1} max={50}
              value={config.attempts}
              onChange={e => setConfig(c => ({ ...c, attempts: Math.max(1, Math.min(50, Number(e.target.value))) }))}
              style={{
                width: 60, padding: '2px 6px', fontSize: 13,
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                borderRadius: 4, color: 'var(--color-text)',
              }}
            />
          </div>

          <div style={{
            fontSize: 12, padding: '8px 10px',
            background: 'var(--color-bg)', borderRadius: 6,
            color: 'var(--color-text-muted)', marginBottom: 14,
          }}>
            <span style={{ color: 'var(--color-text)' }}>{totalCombos.toLocaleString()}</span> combos ×{' '}
            <span style={{ color: 'var(--color-text)' }}>{config.attempts}</span> attempts ={' '}
            <span style={{ color: 'var(--color-accent)' }}>{totalRuns.toLocaleString()}</span> stage runs
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={runSimulation}
              disabled={running || totalCombos === 0}
              style={{
                flex: 1, padding: '8px 0', fontWeight: 600,
                background: running ? 'var(--color-border)' : 'var(--color-accent)',
                color: '#fff', border: 'none', borderRadius: 6, cursor: running ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              {running ? '⏳ Running…' : '▶ Run Simulation'}
            </button>
            {running && (
              <button
                onClick={cancelSimulation}
                style={{
                  padding: '8px 14px', background: 'transparent',
                  border: '1px solid var(--color-danger, #c94)', color: 'var(--color-danger, #c94)',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                }}
              >
                ⛔ Stop
              </button>
            )}
          </div>

          {/* Progress */}
          {(running || progress > 0) && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                height: 6, background: 'var(--color-bg)',
                borderRadius: 3, overflow: 'hidden', marginBottom: 6,
              }}>
                <div style={{
                  height: '100%', width: `${progress * 100}%`,
                  background: 'var(--color-accent)', borderRadius: 3,
                  transition: 'width 0.2s',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
                {status}
              </div>
            </div>
          )}
        </div>

        {/* Right: scatter + summary */}
        <div>
          <div style={{ ...panelStyle, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--color-text)' }}>
              📈 Win Rate vs FSI Ratio
            </div>
            <ScatterPlot results={results} />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
              X = Team FSI ÷ Mission Threat Score &nbsp;|&nbsp;
              Y = Win rate &nbsp;|&nbsp;
              🔴 &lt;40% &nbsp;🟡 40–70% &nbsp;🟢 &gt;70%
              &nbsp;&nbsp;Dashed lines at ratio=1 and winRate=0.5
            </div>
          </div>

          {/* Summary stats */}
          {results.length > 0 && (
            <div style={{ ...panelStyle, marginBottom: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
                📊 Summary ({results.length} records)
              </div>
              <SummaryStats results={results} />
            </div>
          )}
        </div>
      </div>

      {/* ── Results table ─────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              📋 Results — top 500 shown, sorted by{' '}
              <span style={{ color: 'var(--color-accent)' }}>{sortKey}</span>
            </div>
            <button
              onClick={exportJSON}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                background: 'var(--color-accent)', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              ⬇ Export JSON ({results.length})
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <TH k="teamSize"        label="Team" />
                  <TH k="heroineCount"    label="♀" />
                  <TH k="gearRarityLabel" label="Gear" />
                  <TH k="teamFsi"         label="FSI" />
                  <TH k="tierLabel"       label="Tier" />
                  <TH k="enemyQuality"    label="Q" />
                  <TH k="difficulty"      label="Diff" />
                  <TH k="stageCount"      label="S" />
                  <TH k="hasLyssa"        label="Lyssa" />
                  <TH k="weaponType"      label="Wpn" />
                  <TH k="missionThreat"   label="Threat" />
                  <TH k="fsiRatio"        label="Ratio" />
                  <TH k="winRate"         label="Win%" />
                  <TH k="avgAlive"        label="⊕Alive" />
                  <TH k="avgCaptured"     label="⊕Capt" />
                  <TH k="avgKia"          label="⊕KIA" />
                  <TH k="avgSurvivalRate" label="Surv%" />
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 500).map((r, i) => {
                  const wr = r.winRate;
                  const winColor = wr >= 0.7 ? '#4a9' : wr >= 0.4 ? '#ca6' : '#c44';
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <td style={{ padding: '3px 8px', textAlign: 'center' }}>{r.teamSize}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'center' }}>{r.heroineCount}</td>
                      <td style={{ padding: '3px 8px' }}>{r.gearRarityLabel}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>{r.teamFsi}</td>
                      <td style={{ padding: '3px 8px', fontSize: 11, color: 'var(--color-text-muted)' }}>{r.tierLabel}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'center' }}>{r.enemyQuality}</td>
                      <td style={{ padding: '3px 8px', fontSize: 11, color: 'var(--color-text-muted)' }}>{r.difficulty}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'center' }}>{r.stageCount}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'center', color: r.hasLyssa ? '#f88' : 'var(--color-text-muted)' }}>
                        {r.hasLyssa ? '✓' : '–'}
                      </td>
                      <td style={{ padding: '3px 8px', fontSize: 11 }}>{r.weaponType}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>{r.missionThreat}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 600,
                        color: r.fsiRatio >= 1.2 ? '#4a9' : r.fsiRatio >= 0.8 ? '#ca6' : '#c44' }}>
                        {r.fsiRatio.toFixed(2)}
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 700, color: winColor }}>
                        {(r.winRate * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>{r.avgAlive}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>{r.avgCaptured}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>{r.avgKia}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        {(r.avgSurvivalRate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary stats component ───────────────────────────────────────────────────

function SummaryStats({ results }: { results: SimResult[] }) {
  const overallWinRate = results.reduce((s, r) => s + r.winRate, 0) / results.length;

  // Win rate by quality bucket
  const byQuality: Record<number, { sum: number; n: number }> = {};
  for (const r of results) {
    if (!byQuality[r.enemyQuality]) byQuality[r.enemyQuality] = { sum: 0, n: 0 };
    byQuality[r.enemyQuality].sum += r.winRate;
    byQuality[r.enemyQuality].n++;
  }

  // Win rate by FSI ratio bucket
  const fsiRatioBuckets = [0.5, 1.0, 1.5, 2.0, 3.0];
  const byRatio: { label: string; sum: number; n: number }[] = fsiRatioBuckets.map((upper, i) => ({
    label: `${(fsiRatioBuckets[i - 1] ?? 0).toFixed(1)}–${upper.toFixed(1)}`,
    sum: 0, n: 0,
  }));
  for (const r of results) {
    const bi = fsiRatioBuckets.findIndex(u => r.fsiRatio <= u);
    if (bi >= 0) {
      byRatio[bi].sum += r.winRate;
      byRatio[bi].n++;
    }
  }

  const wr = (sum: number, n: number) => n === 0 ? '—' : `${(sum / n * 100).toFixed(1)}%`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Overall Win Rate</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-accent)' }}>
          {(overallWinRate * 100).toFixed(1)}%
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 4 }}>
          Win Rate by FSI Ratio Bucket
        </div>
        {byRatio.map((b, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>ratio {b.label}</span>
            <span style={{ fontWeight: 600 }}>{wr(b.sum, b.n)}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Win Rate by Enemy Quality
        </div>
        {ALL_QUALITIES.map(q => (
          <div key={q} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '1px 0' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Q{q} ({qualityToDifficulty(q)})</span>
            <span style={{ fontWeight: 600 }}>
              {wr(byQuality[q]?.sum ?? 0, byQuality[q]?.n ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
