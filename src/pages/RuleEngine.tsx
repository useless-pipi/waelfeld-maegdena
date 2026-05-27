/**
 * Rule Engine — Automated game simulator.
 *
 * Runs the full game loop without any user interaction. Every decision is
 * logged so you can review the run afterwards.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * OPTIMAL STRATEGY — Maximize FSI, Maxed Buildings, Best Equipment,
 *                    and Abundant Resources
 *
 * Key thresholds (tuned from log analysis — 1793 KIA/400 missions was old baseline):
 *   FSI_PER_THREAT=3.5, LYSSA_FSI_MULTIPLIER=2.0, POST_WIPE_COOLDOWN=15
 *   FSI_FOR_DIFFICULTY: easy=0, normal=60, hard=130, extreme=260
 *   FSI_MAX_STAGES: <80→1 stage, <250→2 stages, ≥250→any
 * ═══════════════════════════════════════════════════════════════════════
 *
 * FSI (Force Strength Index) = Σ mean(STR,DEX,CON,AWR) × (HP/maxHP)
 * for every active maiden. To maximize it: grow roster, gear up maidens,
 * improve their stats through training, and keep them healthy.
 *
 * Priority queue each tick:
 *   1. Emergency recruit   — if roster < MIN_TEAM_SIZE, recruit immediately
 *   2. Build / upgrade     — compound benefits that pay off every mission
 *   3. Buy HQ Shop         — purchase best affordable gear
 *   4. Full-slot equip     — weapon, body, legs, head, accessory, medal
 *   5. Roster expansion    — recruit when beds available + food surplus
 *   6. Trade (Radio Ctr)  — buy food/wood with surplus gold
 *   7. Mission selection   — hardest achievable (difficulty-first, FSI-gated)
 *   8. Deploy              — strongest available, keep DEPLOY_RESERVE home
 *   9. Resolve stages      — real simulateStage() — identical to in-game combat
 *  10. Post-mission         — hospital, farm, training grounds, Meridian
 */

import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { INITIAL_SAVE } from '../data/seed';
import { generateMissionSet as _generateMissionSet } from '../engine/missionGen';
import { simulateStage, getStat } from '../engine/combat';
import {
  recruitMaiden,
  makeEquipmentInstance,
  computeMaxCarryWeight,
  computeCarryWeight,
} from '../engine/recruit';
import {
  initializeStageEnemies,
  enrichEnemyGear,
  computeForceStrengthIndex,
} from '../engine/missionGen';
import type { Maiden } from '../types/maiden';
import type { Mission } from '../types/mission';
import type { Building } from '../types/building';
import type { Equipment } from '../types/equipment';
import { v4 as uuidv4 } from 'uuid';
import { HEROINE_DEFINITIONS } from '../data/heroines';
import { heroineDefToMaiden } from '../engine/recruit';
import equipmentData from '../data/equipment.json';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Compact per-mission log entry.
 * Exported in JSON — no full maiden data, just the numbers needed for balance analysis.
 */
export interface MissionLogEntry {
  /** Simulation tick when the mission resolved. */
  tick: number;
  /** Running missions-completed count (after this mission, if win). */
  msn: number;
  /** Mission reward focus (gold_heavy, supply_run, rescue, lyssa_wave, …). */
  focus: string;
  /** Difficulty string (easy / normal / hard / extreme). */
  diff: string;
  /** Number of stages in the mission. */
  stages: number;
  /** FSI of deployed team only (sum of maidens that actually fought). */
  deployFsi: number;
  /** Full base FSI (all active maidens). */
  baseFsi: number;
  /** Peak stage threat score: max over stages of Σ count×quality. */
  threat: number;
  /** Average enemy quality across all stage zako groups. */
  quality: number;
  /** True if any stage contained a Lyssa. */
  hasLyssa: boolean;
  /** True if this is a Lyssa Wave (mandatory defence). */
  isWave: boolean;
  /** Outcome: won all stages / retreated mid-mission / total team wipe. */
  out: 'win' | 'retreat' | 'wipe';
  /** KIA count (isFallen after mission). */
  kia: number;
  /** Captured count. */
  cap: number;
  /** Escaped count. */
  esc: number;
  /** Total enemy kills. */
  kills: number;
  /** Resource delta: money change (reward money, ignoring food cost). */
  dm: number;
  /** Resource delta: food change (reward food minus food eaten). */
  df: number;
  /** Resource delta: wood gained. */
  dw: number;
  /** Resource delta: metal gained. */
  dme: number;
  /** FSI after mission (casualties reduce it). */
  fsiAfter: number;
  /** Active roster count after mission. */
  roster: number;
  /** FSI tier label at mission start. */
  tier: string;
}

/** Lightweight display entry for the UI log table (never exported). */
interface DisplayEntry {
  tick: number;
  msn: number;
  action: string;
  detail: string;
  outcome: 'win' | 'loss' | 'info' | 'warn';
  money: number;
  food: number;
  wood: number;
  metal: number;
  fsi: number;
  roster: number;
}

/** 0=none, 1=low, 2=medium, 3=high */
export type Intensity = 'none' | 'low' | 'medium' | 'high';

export interface EngineSettings {
  buyIntensity: Intensity;
  sellIntensity: Intensity;
  craftIntensity: Intensity;
}

/** Full JSON export structure — compact, analysis-ready. */
export interface RuleEngineExport {
  meta: {
    generatedAt: string;
    totalMissions: number;
    totalTicks: number;
    settings: EngineSettings;
    finalFsi: number;
    finalTier: string;
    finalRoster: number;
    totalKia: number;
    resources: { money: number; food: number; wood: number; metal: number };
  };
  missions: MissionLogEntry[];
}

// ── Multi-run types ───────────────────────────────────────────────────────────

/** Lightweight snapshot taken every MULTI_SNAPSHOT_INTERVAL successful missions. */
export interface RunSnapshot {
  msn: number;
  tick: number;
  fsi: number;
  tier: string;
  roster: number;
  kia: number;
  money: number;
  food: number;
  wood: number;
  metal: number;
  /** Comma-separated constructed buildings with levels, e.g. "Farm L2, Hospital L1". */
  buildings: string;
}

export interface MultiRunAttempt {
  attemptIndex: number;
  snapshots: RunSnapshot[];
  summary: string;
  totalTicks: number;
  missionsCompleted: number;
  missions: MissionLogEntry[];
}

export interface MultiRunResult {
  exportedAt: string;
  targetMissions: number;
  totalAttempts: number;
  settings: EngineSettings;
  snapshotInterval: number;
  attempts: MultiRunAttempt[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_TICKS = 50_000;
const MULTI_SNAPSHOT_INTERVAL = 50;
const MIN_TEAM_SIZE = 5;
const BED_BUFFER = 4;
const DEPLOY_RESERVE = 4;

/**
 * FSI floors required before accepting each difficulty tier.
 */
const FSI_FOR_DIFFICULTY: Record<string, number> = {
  easy:    0,
  normal:  60,
  hard:    130,
  extreme: 260,
};

const MIN_MISSIONS_FOR_DIFFICULTY: Record<string, number> = {
  easy:    0,
  normal:  0,
  hard:    12,
  extreme: 30,
};

const FSI_MAX_STAGES: Array<{ minFsi: number; maxStages: number }> = [
  { minFsi: 120, maxStages: 99 },
  { minFsi:  60, maxStages:  2 },
  { minFsi:   0, maxStages:  1 },
];

const POST_WIPE_COOLDOWN_MISSIONS = 15;
const STAGE_CASUALTY_RETREAT_FRAC = 0.25;

/**
 * How many consecutive refreshes to attempt before conceding to an unsafe Lyssa
 * mission. Raised from 3 to 8 — log analysis showed idleStreak=3 was too eager;
 * a 4th–8th refresh frequently yields a safe non-Lyssa pool.
 */
const LYSSA_IDLE_THRESHOLD = 10;


/**
 * When the active roster falls below this floor, missions are skipped entirely
 * so every tick goes to recruiting. Prevents running 4–6-person teams into
 * Lyssa missions that wipe the entire remaining force.
 * = MIN_TEAM_SIZE + DEPLOY_RESERVE  (exactly enough for one safe deployment)
 */
const MISSION_FLOOR_ROSTER = MIN_TEAM_SIZE + DEPLOY_RESERVE; // 9

/**
 * FSI / missionThreat ratio required to accept a mission.
 * 3.5 = need at least 3.5× FSI vs threat. Log analysis showed 2.0 was far too
 * permissive — FSI 177 vs threat 27 still wiped 21 maidens on a 3-stage mission.
 */
const FSI_PER_THREAT = 3.5;

/**
 * Extra FSI multiplier applied to missions that contain a Lyssa.
 * Lyssa missions consistently caused 4–21 KIA even at the 2.0 threshold when
 * baseFsi was used — but deployFsi (the troops that actually fight) is often
 * 15–30% lower. Raised to 2.5 to account for that effective gap.
 * At 1.5× a threat-22 Lyssa mission needs deployed FSI ≥ 115 before it's accepted.
 * Hard Lyssa (threat~40) needs FSI ≥ 210; extreme (threat~93) needs FSI ≥ 488 — still gated.
 */
const LYSSA_FSI_MULTIPLIER = 1.5;

/**
 * Lower FSI/threat ratio for rescue missions — worth running even at a disadvantage
 * to recover a captured maiden before her morale is permanently damaged.
 */
const RESCUE_FSI_RATIO = 1.5;

const MIN_DEPLOY_HP_FRAC = 0.30;

const BUILDING_PRIORITY = [
  'farm',            // food production — starvation is a permanent morale penalty
  'field_hospital',  // healing throughput keeps roster battle-ready every mission
  'rosarium_vocis',  // free recruits after victories (20→80%) + geared arrivals — fastest FSI snowball
  'training_grounds',// passive theory EXP each mission — earlier built = more total stat gains
  'tent_block',      // bed capacity for the expanding roster
  'factory',         // crafting tiers once basic survival is secured
  'radio_center',    // HQ shop — strong but expensive, defer to mid/late game
  'the_meridian',    // performance bonus — maxLevel 1, rarely relevant in loop
];

/**
 * While the active roster is below this headcount, only survival-critical buildings
 * (farm, field_hospital) are allowed. All other upgrades are skipped so ticks fall
 * through to the recruit step (step 5) — a thin roster is far more dangerous than
 * a slightly lower building level.
 * = MIN_TEAM_SIZE(5) + DEPLOY_RESERVE(4) + buffer(3)
 */
const RECRUIT_PRIORITY_THRESHOLD = MIN_TEAM_SIZE + DEPLOY_RESERVE + 3; // 12

// ── Helpers ──────────────────────────────────────────────────────────────────

function snap(store: ReturnType<typeof useGameStore.getState>) {
  return {
    maidens:      store.maidens,
    teams:        store.teams,
    missions:     store.missions,
    buildings:    store.buildings,
    inventory:    store.inventory,
    mbase:        store.mbase,
    hqShopItems:  store.hqShopItems ?? [],
    meridianStats:store.meridianStats,
    missionsUntilNextWave: store.missionsUntilNextWave ?? 20,
  };
}

function activeMaidens(maidens: Maiden[]) {
  return maidens.filter(m => !m.isFallen && !m.isCaptured && m.moraleQuitStatus !== 'escaped');
}

function deployableMaidens(maidens: Maiden[]) {
  return activeMaidens(maidens).filter(m => {
    if (m.currentHp <= 0) return false;
    return m.currentHp >= (m.maxHp ?? 1) * MIN_DEPLOY_HP_FRAC;
  });
}

function deployableMaidensAny(maidens: Maiden[]) {
  return activeMaidens(maidens).filter(m => m.currentHp > 0);
}

function maxBeds(buildings: Building[]): number {
  const b = buildings.find(b => b.id === 'tent_block');
  if (!b || !b.isConstructed) return 20;
  return b.levels[b.currentLevel - 1]?.effectValue?.beds ?? 30;
}

const DIFF_RANK: Record<string, number> = { easy: 0, normal: 1, hard: 2, extreme: 3, hell: 4 };

function missionMaxThreat(m: Mission): number {
  if (!m.stages?.length) return 0;
  return Math.max(
    ...m.stages.map(s => {
      const zako = (s as any).template?.zako as Array<{ count: number; quality: number }> | undefined;
      if (zako && zako.length > 0) return zako.reduce((sum, g) => sum + g.count * g.quality, 0);
      return (s.enemies?.length ?? 0) * 5;
    }),
  );
}

function missionAvgQuality(m: Mission): number {
  const groups: Array<{ count: number; quality: number }> = [];
  for (const s of m.stages) {
    const zako = (s as any).template?.zako as Array<{ count: number; quality: number }> | undefined;
    if (zako) groups.push(...zako);
  }
  if (groups.length === 0) return 5;
  const total = groups.reduce((s, g) => s + g.count, 0);
  return total === 0 ? 5 : groups.reduce((s, g) => s + g.quality * g.count, 0) / total;
}

function missionHasLyssa(m: Mission): boolean {
  return m.stages.some(s => {
    const ids = (s as any).template?.lyssaIds as string[] | undefined;
    return ids && ids.length > 0;
  });
}

function missionValue(m: Mission): number {
  const r = m.reward ?? {};
  const baseVal = (r.money ?? 0) + (r.wood ?? 0) * 2 + (r.metal ?? 0) * 2 + (r.food ?? 0) * 0.5;
  const diffMult = { easy: 0.5, normal: 1.0, hard: 5.0, extreme: 20.0, hell: 100.0 }[m.difficulty] ?? 1.0;
  const stageCount = m.stages?.length ?? 1;
  return (baseVal * diffMult) / Math.sqrt(stageCount);
}

function itemPower(eq: Equipment): number {
  return (eq.bonuses ?? []).reduce((s, b) => s + Math.abs(b.value), 0);
}

/** Compute deployed-team FSI only (sum of deployed maidens' combat powers). */
function computeDeployedFsi(team: Maiden[]): number {
  let total = 0;
  for (const m of team) {
    const basePower = (m.stats.strength + m.stats.dexterity + m.stats.constitution + m.stats.awareness) / 4;
    const healthFactor = m.maxHp > 0 ? m.currentHp / m.maxHp : 1;
    total += basePower * healthFactor;
  }
  return Math.round(total);
}

// ── Combat resolution ─────────────────────────────────────────────────────────

/**
 * Resolve all stages of a mission using the real simulateStage() engine.
 * Applies all store side-effects (EXP, morale, KIA, HP sync) matching Missions.tsx.
 */
function resolveInstant(
  mission: Mission,
  stageMaidens: Maiden[],
  store: ReturnType<typeof useGameStore.getState>,
  log: (action: string, detail: string, outcome?: DisplayEntry['outcome']) => void,
): { won: boolean; survivors: Maiden[]; kills: number; deaths: number; escapedIds: string[]; capturedIds: string[] } {
  let currentMaidens = [...stageMaidens];
  let totalKills = 0;
  let totalDeaths = 0;
  const allEscapedIds: string[] = [];
  const allCapturedIds: string[] = [];

  for (let si = 0; si < mission.stages.length; si++) {
    const stage = mission.stages[si];

    if (currentMaidens.length === 0) {
      log('Stage skipped', `Stage ${si + 1}/${mission.stages.length} — no survivors`, 'warn');
      break;
    }

    const enemies = initializeStageEnemies(stage).map(enrichEnemyGear);
    const coverLevel = (stage as any).coverLevel ?? 0;
    const result = simulateStage(currentMaidens as any[], enemies, coverLevel);

    store.applyPracticalExpGains(result.expGains);
    store.applyMoraleGains(result.permanentMoraleDeltas);

    const killedEnemies = result.updatedEnemies.filter(e => (e as any).currentHp <= 0).length;
    totalKills += killedEnemies;

    const stageWon = result.outcome === 'maiden_victory' || result.outcome === 'enemy_retreat';

    const stageEscaped = result.moraleEscapedIds ?? [];
    const stageCaptured = (result.moraleCapturedIds ?? []).filter(id => !stageEscaped.includes(id));
    for (const id of stageEscaped) if (!allEscapedIds.includes(id)) allEscapedIds.push(id);
    for (const id of stageCaptured) if (!allCapturedIds.includes(id)) allCapturedIds.push(id);

    if (stageEscaped.length > 0 || stageCaptured.length > 0) {
      store.applyMoraleQuitEvents(stageEscaped, stageCaptured);
      if (stageCaptured.length > 0) {
        const existing = useGameStore.getState().missions.find(m => m.id === mission.id)?.capturedMaidenIds ?? [];
        store.setMission(mission.id, { capturedMaidenIds: [...new Set([...existing, ...stageCaptured])] });
      }
      if (stageWon && stageCaptured.length > 0) {
        const teamId = useGameStore.getState().teams[0]?.id ?? '';
        store.rescueCapturedMaidens(stageCaptured, teamId);
        const afterRescue = useGameStore.getState().missions.find(m => m.id === mission.id)?.capturedMaidenIds ?? [];
        store.setMission(mission.id, { capturedMaidenIds: afterRescue.filter(id => !stageCaptured.includes(id)) });
      }
    }

    const removedFromField = new Set([...allEscapedIds, ...allCapturedIds]);
    const updated: Maiden[] = currentMaidens.map(m => {
      const after = result.updatedMaidens.find(u => (u as any).id === m.id);
      return after ? { ...m, currentHp: Math.max(0, (after as any).currentHp) } : m;
    });

    const fallen = updated.filter(m => m.currentHp <= 0 && !removedFromField.has(m.id));
    totalDeaths += fallen.length;

    for (const m of updated) {
      if (removedFromField.has(m.id)) continue;
      if (m.currentHp <= 0) {
        const orig = stageMaidens.find(o => o.id === m.id)!;
        const weapon = orig.equipment.find(e => e.slot === 'weapon');
        const equipWithoutWeapon = orig.equipment.filter(e => e.slot !== 'weapon');
        if (weapon) store.addInventoryItem(weapon);
        store.setMaiden(m.id, { currentHp: 0, isFallen: true, isDeployed: false, equipment: equipWithoutWeapon });
      } else {
        store.setMaiden(m.id, { currentHp: m.currentHp });
      }
    }

    log(
      `Stage ${si + 1}/${mission.stages.length}`,
      `${stageWon ? '✅' : '❌'} ${result.outcome} | in:${currentMaidens.length} | enemies:${enemies.length} | KIA:${fallen.length} | esc:${stageEscaped.length} | cap:${stageCaptured.length} | kills:${killedEnemies}`,
      stageWon ? 'info' : 'warn',
    );

    if (!stageWon) break;

    const stageSurvivors = updated.filter(m => m.currentHp > 0 && !removedFromField.has(m.id));
    currentMaidens = stageSurvivors;

    if (si < mission.stages.length - 1) {
      const casualtyFrac = fallen.length / Math.max(1, currentMaidens.length + fallen.length);
      const tooFew = currentMaidens.length < MIN_TEAM_SIZE;
      const heavyLoss = casualtyFrac >= STAGE_CASUALTY_RETREAT_FRAC;
      if (tooFew || heavyLoss) {
        const reason = tooFew
          ? `Only ${currentMaidens.length} survivors`
          : `${fallen.length}/${fallen.length + currentMaidens.length} KIA (${(casualtyFrac * 100).toFixed(0)}% losses)`;
        log(`Stage ${si + 1} — retreat`, `${reason} — pulling back to preserve the force.`, 'warn');
        break;
      }
    }

    if (si === mission.stages.length - 1) {
      return { won: true, survivors: currentMaidens, kills: totalKills, deaths: totalDeaths, escapedIds: allEscapedIds, capturedIds: allCapturedIds };
    }
  }

  return { won: false, survivors: currentMaidens, kills: totalKills, deaths: totalDeaths, escapedIds: allEscapedIds, capturedIds: allCapturedIds };
}

// ── Strategy functions ────────────────────────────────────────────────────────

function pickBestMission(
  missions: Mission[],
  maidens: Maiden[],
  wipeCooldownRemaining: number,
  missionsCompleted: number,
  hasCapturedMaidens: boolean,
  mbase: { food: number; wood: number; metal: number; money: number },
  idleStreak: number,
  bloomCount: number,
  hasFallenHeroine: boolean,
): Mission | null {
  const available = missions.filter(m => !m.isCompleted);
  if (available.length === 0) return null;

  // Lyssa Wave is mandatory — always run it first when present.
  const wave = available.find(m => m.isLyssaWave);
  if (wave) return wave;

  const { fsi } = computeForceStrengthIndex(maidens);
  const maxStagesAllowed = FSI_MAX_STAGES.find(r => fsi >= r.minFsi)?.maxStages ?? 1;

  // Use the estimated DEPLOYED FSI for threat checks — DEPLOY_RESERVE maidens
  // stay home and never fight, so baseFsi overstates actual combat power.
  // Log analysis: baseFsi=157 passed a threat-22 Lyssa check (threshold=154) but
  // deployFsi was only 107, causing 11 KIA. Using deployed estimate rejects it.
  const deployablePool = deployableMaidens(maidens);
  const deployCount = Math.max(MIN_TEAM_SIZE, deployablePool.length - DEPLOY_RESERVE);
  const deployFraction = deployablePool.length > 0 ? deployCount / deployablePool.length : 1;
  const effectiveFsi = fsi * deployFraction;

  const diffOk = (diff: string) =>
    fsi >= (FSI_FOR_DIFFICULTY[diff] ?? 0) &&
    missionsCompleted >= (MIN_MISSIONS_FOR_DIFFICULTY[diff] ?? 0);

  const threatOk = (m: Mission) => {
    const ratio = m.rewardFocus === 'rescue' ? RESCUE_FSI_RATIO : FSI_PER_THREAT;
    // Lyssa missions are far more dangerous than raw threat implies —
    // use effectiveFsi (deployed estimate) so the reserve doesn't inflate the check.
    const lyssaMult = missionHasLyssa(m) ? LYSSA_FSI_MULTIPLIER : 1;
    return effectiveFsi >= missionMaxThreat(m) * ratio * lyssaMult;
  };

  const focusScore = (m: Mission): number => {
    let score: number;
    switch (m.rewardFocus) {
      case 'rescue':      score = hasCapturedMaidens ? 1200 : 300; break;
      case 'supply_run':  score = mbase.food < 50 ? 600 : 20; break;
      case 'gold_heavy':  score = 50; break;
      case 'weapon_gear': score = (mbase.wood < 30 || mbase.metal < 30) ? 80 : 10; break;
      case 'medal':       score = 0; break;
      case 'consumable':  score = (hasFallenHeroine && bloomCount < 7) ? 500 : 10; break;
      case 'strike_force':score = 30; break;
      default:            score = 0; break;
    }
    // Slight devalue for Lyssa so equally-scored non-Lyssa wins ties, but don't
    // actively suppress Lyssa that has passed the threat gate.
    return missionHasLyssa(m) ? Math.round(score * 0.8) : score;
  };

  // ── Mission pools — progressively relaxes constraints ───────────────────────
  //
  // RULE: Lyssa-bearing missions NEVER bypass threatOk in any pool.
  //       Analysis showed Pool 3/4 bypassing threatOk caused ~80% of all KIA
  //       (e.g. normal+Lyssa threat=25 with FSI=126 wiped 10–16 maidens).
  //
  const pools = [
    // Pool 0: all gates active
    available.filter(m => {
      if (!diffOk(m.difficulty)) return false;
      if (wipeCooldownRemaining > 0 && DIFF_RANK[m.difficulty] >= 2) return false;
      if ((m.stages?.length ?? 1) > maxStagesAllowed) return false;
      if (!threatOk(m)) return false;
      return true;
    }),
    // Pool 1: lift wipe-cooldown restriction (all other gates still active)
    available.filter(m => {
      if (!diffOk(m.difficulty)) return false;
      if ((m.stages?.length ?? 1) > maxStagesAllowed) return false;
      if (!threatOk(m)) return false;
      return true;
    }),
    // Pool 2: easy-only, lift stage-count gate, still enforce threatOk (incl. Lyssa mult).
    // This allows grinding easy Lyssa missions only when FSI is high enough to survive them.
    available.filter(m => {
      if (m.difficulty !== 'easy') return false;
      if (!threatOk(m)) return false;
      return true;
    }),
    // Pool 3: easy-only, non-Lyssa — safe grinding with any threat level.
    // Never use this pool for Lyssa-bearing missions; the casualties are too high.
    available.filter(m => m.difficulty === 'easy' && !missionHasLyssa(m)),
    // Pool 4: any difficulty, non-Lyssa — prefer a hard clean mission over any Lyssa.
    available.filter(m => !missionHasLyssa(m)),
    // Pool 5: true last resort — all missions including Lyssa.
    // Sort: fewest stages first (multi-stage Lyssa causes cascade retreat losses),
    // then lowest threat, so we pick the least destructive option.
    available,
  ];

  for (let pi = 0; pi < pools.length; pi++) {
    const pool = pools[pi];
    if (pool.length === 0) continue;

    if (pi === 5) {
      // A Lyssa mission is "too risky" if it fails the FSI/threat check or
      // exceeds the stage cap. LYSSA_FSI_MULTIPLIER=1.5 already gates hard Lyssa
      // (FSI ≥ 210) and extreme Lyssa (FSI ≥ 488) — no need for a separate diff cap.
      const lyssaTooRisky = (m: Mission) =>
        !threatOk(m) ||
        (m.stages?.length ?? 1) > maxStagesAllowed;

      if (pool.every(m => missionHasLyssa(m)) && pool.every(m => lyssaTooRisky(m))) {
        // Return null (trigger refresh) until LYSSA_IDLE_THRESHOLD attempts.
        // More refreshes dramatically improve the chance of a clean pool.
        if (idleStreak < LYSSA_IDLE_THRESHOLD) return null;
      }

      // When forced (idleStreak >= LYSSA_IDLE_THRESHOLD), pick the best safe option.
      // lyssaTooRisky gates hard/extreme Lyssa via threatOk (mult=1.5 requires
      // FSI>=210 for hard, FSI>=488 for extreme) -- no separate diff cap needed.
      const safeForced = pool.filter(m => !lyssaTooRisky(m));
      if (safeForced.length > 0) {
        return safeForced.sort((a, b) => {
          const stageDiff = (a.stages?.length ?? 1) - (b.stages?.length ?? 1);
          if (stageDiff !== 0) return stageDiff;
          return missionMaxThreat(a) - missionMaxThreat(b);
        })[0];
      }
      // Nothing passed the threat gate. Force the least-deadly option available.
      // Sort: difficulty ASC (easy < normal < hard < extreme < hell) first — easy Lyssa
      // at FSI deficit causes 1-3 KIA; normal causes 7-14; extreme causes 30-54.
      // Cap difficulty by FSI so a small early-game roster never absorbs extreme KIA.
      const maxForcedRank = fsi < 150 ? (DIFF_RANK['normal'] ?? 1)
                          : fsi < 260 ? (DIFF_RANK['hard']   ?? 2)
                          :             (DIFF_RANK['extreme'] ?? 3);
      const cappedForced = pool.filter(m => (DIFF_RANK[m.difficulty] ?? 0) <= maxForcedRank);
      // Fall back to full pool only if the cap eliminates everything (avoids infinite loop).
      const forcedPool = cappedForced.length > 0 ? cappedForced : pool;
      return forcedPool.sort((a, b) => {
        const dDiff = (DIFF_RANK[a.difficulty] ?? 0) - (DIFF_RANK[b.difficulty] ?? 0);
        if (dDiff !== 0) return dDiff;
        const stageDiff = (a.stages?.length ?? 1) - (b.stages?.length ?? 1);
        if (stageDiff !== 0) return stageDiff;
        return missionMaxThreat(a) - missionMaxThreat(b);
      })[0];
    }

    return pool.sort((a, b) => {
      const dDiff = (DIFF_RANK[b.difficulty] ?? 0) - (DIFF_RANK[a.difficulty] ?? 0);
      if (dDiff !== 0) return dDiff;
      const fDiff = focusScore(b) - focusScore(a);
      if (fDiff !== 0) return fDiff;
      return missionValue(b) - missionValue(a);
    })[0];
  }
  return null;
}

/**
 * Pick the best N maidens for deployment.
 * For rescue missions, slightly favour high-AWR maidens (better at spotting captives).
 * Pass allHands=true (Lyssa Wave) to deploy every maiden with HP > 0, ignoring the
 * 30% HP floor — spreading casualties across a larger force saves more lives overall.
 */
function pickBestTeam(maidens: Maiden[], _size: number, missionFocus?: string, allHands?: boolean): Maiden[] {
  let pool = allHands ? deployableMaidensAny(maidens) : deployableMaidens(maidens);
  if (pool.length < MIN_TEAM_SIZE) pool = deployableMaidensAny(maidens);

  const awarBonus = missionFocus === 'rescue' ? 0.5 : 0;
  const sorted = pool.sort((a, b) => {
    const pa = getStat(a, 'strength') + getStat(a, 'dexterity') + getStat(a, 'constitution') + getStat(a, 'awareness') * awarBonus;
    const pb = getStat(b, 'strength') + getStat(b, 'dexterity') + getStat(b, 'constitution') + getStat(b, 'awareness') * awarBonus;
    return pb - pa;
  });

  const maxDeploy = Math.max(MIN_TEAM_SIZE, sorted.length - DEPLOY_RESERVE);
  return sorted.slice(0, maxDeploy);
}

function foodCost(team: Maiden[]): number {
  return team.reduce((s, m) => s + 20 + getStat(m, 'strength'), 0);
}

/** Buildings that are allowed even when the roster is critically thin. */
const SURVIVAL_BUILDINGS = new Set(['farm', 'field_hospital']);

function pickBuildingUpgrade(
  buildings: Building[],
  mbase: { money: number; wood: number; metal: number },
  activeRoster: number,
): Building | null {
  // Metal overflow: build The Meridian early if hoarding above 3000
  if (mbase.metal > 3000) {
    const meridian = buildings.find(b => b.id === 'the_meridian');
    if (meridian && !meridian.isConstructed) {
      const level = meridian.levels[0];
      if (level &&
          (level.costMoney ?? 0) <= mbase.money &&
          (level.costWood  ?? 0) <= mbase.wood &&
          (level.costMetal ?? 0) <= mbase.metal) {
        return meridian;
      }
    }
  }

  for (const bid of BUILDING_PRIORITY) {
    const b = buildings.find(x => x.id === bid);
    if (!b) continue;
    if (b.isConstructed && b.currentLevel >= b.maxLevel) continue;

    // If the roster is thin, skip non-survival buildings so ticks fall through
    // to step 5 (recruit). Growing headcount is more valuable than building upgrades
    // when we barely have enough maidens to field a safe team.
    if (activeRoster < RECRUIT_PRIORITY_THRESHOLD && !SURVIVAL_BUILDINGS.has(bid)) continue;

    const notBuiltYet = !b.isConstructed;
    const level = notBuiltYet ? b.levels[0] : b.levels[b.currentLevel];
    if (!level) continue;

    if ((level.costMoney ?? 0) <= mbase.money &&
        (level.costWood  ?? 0) <= mbase.wood &&
        (level.costMetal ?? 0) <= mbase.metal) {
      return b;
    }
  }
  return null;
}

function autoEquip(
  maidens: Maiden[],
  inventory: Equipment[],
  store: ReturnType<typeof useGameStore.getState>,
): string[] {
  const acted: string[] = [];
  const EQUIPPABLE_SLOTS = ['weapon', 'body', 'legs', 'head', 'accessory', 'medal'];
  const avail = inventory.filter(eq => !eq.isLocked && eq.faction !== 'enemy');
  const pool = deployableMaidens(maidens).map(m => ({ ...m, equipment: [...m.equipment] }));

  for (const slot of EQUIPPABLE_SLOTS) {
    const slotItems = avail
      .filter(eq => eq.slot === slot)
      .sort((a, b) => itemPower(b) - itemPower(a));

    for (const item of slotItems) {
      let bestMaiden: (typeof pool)[0] | null = null;
      let bestGain = 0;
      let bestMaidenCurItem: Equipment | undefined;

      for (const m of pool) {
        const cur = m.equipment
          .filter(e => e.slot === slot)
          .sort((a, b) => itemPower(b) - itemPower(a))[0];
        const gain = itemPower(item) - (cur ? itemPower(cur) : 0);
        if (gain > bestGain) {
          bestGain = gain;
          bestMaiden = m;
          bestMaidenCurItem = cur;
        }
      }

      if (bestMaiden && bestGain > 0) {
        const pIdx = pool.findIndex(m => m.id === bestMaiden!.id);
        let unequippedItem: Equipment | undefined;
        if (slot !== 'weapon' && bestMaidenCurItem) {
          store.unequipItem(bestMaiden.id, bestMaidenCurItem);
          unequippedItem = bestMaidenCurItem;
          if (pIdx !== -1) pool[pIdx].equipment = pool[pIdx].equipment.filter(e => e !== bestMaidenCurItem);
        }

        store.equipItem(bestMaiden.id, item, null);

        const freshInv = useGameStore.getState().inventory;
        const equipBlocked = freshInv.some(e =>
          item.inventoryId ? e.inventoryId === item.inventoryId : e.id === item.id
        );
        if (equipBlocked) {
          if (unequippedItem) {
            const restored = freshInv.find(e =>
              unequippedItem!.inventoryId ? e.inventoryId === unequippedItem!.inventoryId : e.id === unequippedItem!.id
            );
            if (restored) store.equipItem(bestMaiden.id, restored, null);
          }
          continue;
        }

        acted.push(`${bestMaiden.name}[${slot}]←${item.name}`);
        if (pIdx !== -1) pool[pIdx].equipment = [...pool[pIdx].equipment.filter(e => e.slot !== slot), item];
        const invIdx = avail.findIndex(e => e.inventoryId === item.inventoryId);
        if (invIdx !== -1) avail.splice(invIdx, 1);
      }
    }
  }
  return acted;
}

function maidenCarryCapacity(m: Maiden): number {
  const strBonus = m.equipment.reduce(
    (sum, e) => sum + e.bonuses.filter(b => b.stat === 'strength').reduce((s, b) => s + b.value, 0), 0);
  return computeMaxCarryWeight((m.stats.strength ?? 0) + strBonus);
}

function maidenUsedWeight(m: Maiden): number {
  return computeCarryWeight(m.equipment);
}

function maidenNeedsItem(m: Maiden, item: Equipment, inventory: Equipment[]): boolean {
  const cur = m.equipment.find(e => e.slot === item.slot);
  const newPow = itemPower(item);
  if (cur && itemPower(cur) >= newPow) return false;
  const inventoryBest = inventory
    .filter(e => e.slot === item.slot && e.faction !== 'enemy')
    .reduce((best, e) => Math.max(best, itemPower(e)), 0);
  if (inventoryBest >= newPow) return false;
  if (item.weight && maidenUsedWeight(m) + item.weight > maidenCarryCapacity(m)) return false;
  return true;
}

function tryCraftEquipment(
  intensity: Intensity,
  store: ReturnType<typeof useGameStore.getState>,
): string | null {
  if (intensity === 'none') return null;
  const factory = store.buildings.find(b => b.id === 'factory');
  if (!factory?.isConstructed) return null;
  const factoryTier = factory.levels[factory.currentLevel - 1]?.effectValue?.tier ?? 1;
  const mb = store.mbase;
  const deployable = deployableMaidens(store.maidens);
  if (deployable.length === 0) return null;

  const craftables = (equipmentData as Equipment[])
    .filter(eq => eq.craftable && (eq as any).craftTier <= factoryTier)
    .sort((a, b) => itemPower(b) - itemPower(a));

  const reserve = intensity === 'high' ? 1 : intensity === 'medium' ? 2 : 3;

  for (const eq of craftables) {
    const cost = (eq as any).craftCost as { money: number; wood: number; metal: number };
    if (!cost) continue;
    if (mb.money < (cost.money ?? 0) * reserve) continue;
    if (mb.wood  < (cost.wood  ?? 0) * reserve) continue;
    if (mb.metal < (cost.metal ?? 0) * reserve) continue;

    const wouldHelp = deployable.some(m => maidenNeedsItem(m, eq, store.inventory));
    if (!wouldHelp) continue;

    store.craftEquipment(eq.id);
    return `Craft: ${eq.name} [${eq.slot}] costing ${cost.wood ?? 0}🪵+${cost.metal ?? 0}⚙️`;
  }
  return null;
}

function trySellEquipment(
  maidens: Maiden[],
  inventory: Equipment[],
  intensity: Intensity,
  store: ReturnType<typeof useGameStore.getState>,
): string | null {
  if (intensity === 'none') return null;
  const sellable = inventory.filter(eq => !eq.isLocked && eq.faction !== 'enemy');
  if (sellable.length === 0) return null;

  const deployable = deployableMaidens(maidens);
  const slotMinPower: Record<string, number> = {};
  const slotMaxPower: Record<string, number> = {};
  for (const m of deployable) {
    for (const eq of m.equipment) {
      const p = itemPower(eq);
      slotMinPower[eq.slot] = Math.min(slotMinPower[eq.slot] ?? Infinity, p);
      slotMaxPower[eq.slot] = Math.max(slotMaxPower[eq.slot] ?? 0, p);
    }
  }
  const slotTopPowers: Record<string, number[]> = {};
  for (const eq of sellable) {
    slotTopPowers[eq.slot] = slotTopPowers[eq.slot] ?? [];
    slotTopPowers[eq.slot].push(itemPower(eq));
  }
  for (const slot of Object.keys(slotTopPowers)) {
    slotTopPowers[slot].sort((a, b) => b - a);
  }

  for (const eq of sellable) {
    const pow = itemPower(eq);
    if (intensity === 'low') {
      if (pow >= (slotMinPower[eq.slot] ?? 0)) continue;
    } else if (intensity === 'medium') {
      if (pow >= (slotMaxPower[eq.slot] ?? 0)) continue;
    } else {
      const top3 = (slotTopPowers[eq.slot] ?? []).slice(0, Math.max(3, deployable.length));
      if (top3.includes(pow) && top3.indexOf(pow) < deployable.length) continue;
    }
    const price = Math.floor((eq.price ?? 0) * 0.5);
    if (price <= 0) continue;
    store.sellEquipment(eq.inventoryId!);
    return `Sold ${eq.name} [${eq.slot}] for ${price}💰`;
  }
  return null;
}

function tryBuyHQItem(
  maidens: Maiden[],
  hqShopItemIds: string[],
  intensity: Intensity,
  store: ReturnType<typeof useGameStore.getState>,
): string | null {
  if (intensity === 'none') return null;
  if (hqShopItemIds.length === 0) return null;
  const mb = store.mbase;
  const deployable = deployableMaidens(maidens);
  if (deployable.length === 0) return null;

  const reserve = intensity === 'high' ? 1 : intensity === 'medium' ? 1.5 : 2.5;
  const shopItems = hqShopItemIds
    .map(id => { try { return makeEquipmentInstance(id); } catch { return null; } })
    .filter(Boolean) as Equipment[];
  shopItems.sort((a, b) => itemPower(b) - itemPower(a));

  for (const item of shopItems) {
    const price = item.price ?? 0;
    const extraWood  = (item as any).hqExtraCost?.wood  ?? 0;
    const extraMetal = (item as any).hqExtraCost?.metal ?? 0;
    if (mb.money < price * reserve || mb.wood < extraWood || mb.metal < extraMetal) continue;

    const wouldHelp = deployable.some(m => maidenNeedsItem(m, item, store.inventory));
    if (!wouldHelp) continue;

    store.buyHQEquipment(item.id);
    return `HQ Shop: ${item.name} [${item.slot}] ${price}💰${extraWood ? `+${extraWood}🪵` : ''}${extraMetal ? `+${extraMetal}⚙️` : ''}`;
  }
  return null;
}

// ── Shared tick core ──────────────────────────────────────────────────────────

interface TickState {
  tick: number;
  missionsCompleted: number;
  wipeCooldown: number;
  idleStreak: number;
}

interface TickResult {
  type: 'mission' | 'action' | 'idle';
  missionEntry?: MissionLogEntry;
}

function runTick(
  state: TickState,
  settings: EngineSettings,
  display: ((action: string, detail: string, outcome?: DisplayEntry['outcome']) => void) | null,
): TickResult {
  const store = useGameStore.getState();
  const { maidens, missions, buildings, mbase } = snap(store);

  // ── 0. Refresh if pool exhausted ──────────────────────────────────────────
  if (missions.filter(m => !m.isCompleted).length === 0) {
    store.refreshMissions();
    state.idleStreak = 0;
    return { type: 'action' };
  }

  // ── 1. Emergency recruit ───────────────────────────────────────────────────
  const active = activeMaidens(maidens).length;
  if (active < MIN_TEAM_SIZE) {
    const nm = recruitMaiden(maidens);
    store.addMaiden(nm);
    return { type: 'action' };
  }

  // ── 2. Build / upgrade ─────────────────────────────────────────────────────
  const upgrade = pickBuildingUpgrade(buildings, mbase, active);
  if (upgrade) {
    const notBuilt = !upgrade.isConstructed;
    const nextLvIdx = notBuilt ? 0 : upgrade.currentLevel;
    const lvDef = upgrade.levels[nextLvIdx];
    const newLevel = notBuilt ? 1 : upgrade.currentLevel + 1;
    store.setBuilding(upgrade.id, { isConstructed: true, currentLevel: newLevel });
    store.setMBase({
      money: mbase.money - (lvDef.costMoney ?? 0),
      wood:  mbase.wood  - (lvDef.costWood  ?? 0),
      metal: mbase.metal - (lvDef.costMetal ?? 0),
    });
    if (upgrade.id === 'tent_block') {
      const beds = upgrade.levels[newLevel - 1]?.effectValue?.beds;
      if (beds) store.setMBase({ beds });
    }
    return { type: 'action' };
  }

  // ── 3–4. Equipment management (free actions, no mission tick consumed) ────
  {
    const equipLogs: string[] = [];
    let st = useGameStore.getState();
    const radioBuilt = st.buildings.find(b => b.id === 'radio_center')?.isConstructed ?? false;

    if (radioBuilt && settings.buyIntensity !== 'none') {
      let bought: string | null;
      while ((bought = tryBuyHQItem(st.maidens, st.hqShopItems ?? [], settings.buyIntensity, st)) !== null) {
        equipLogs.push(bought); st = useGameStore.getState();
      }
    }
    if (settings.craftIntensity !== 'none') {
      let crafted: string | null;
      while ((crafted = tryCraftEquipment(settings.craftIntensity, st)) !== null) {
        equipLogs.push(crafted); st = useGameStore.getState();
      }
    }
    if (settings.sellIntensity !== 'none') {
      st = useGameStore.getState();
      const sold = trySellEquipment(st.maidens, st.inventory, settings.sellIntensity, st);
      if (sold) equipLogs.push(sold);
    }
    st = useGameStore.getState();
    const equipped = autoEquip(st.maidens, st.inventory, st);
    if (equipped.length > 0) equipLogs.push(...equipped.map(e => `Equip: ${e}`));
  }

  // ── 4b. Revenant Bloom revival (free action) ──────────────────────────────
  {
    const st = useGameStore.getState();
    const bloomCount = st.inventory
      .filter(i => i.id === 'revenant_bloom')
      .reduce((s, i) => s + (i.quantity ?? 1), 0);
    if (bloomCount >= 7) {
      const fallen = st.maidens.find(m => m.isFallen && !!m.heroineId);
      if (fallen) {
        store.reviveHeroine(fallen.id);
        return { type: 'action' };
      }
    }
  }

  // ── 5. Roster expansion ────────────────────────────────────────────────────
  {
    const st = useGameStore.getState();
    const beds = maxBeds(st.buildings);
    const activeNow = activeMaidens(st.maidens).length;
    const recruitCap = beds - BED_BUFFER;
    const deployable = deployableMaidens(st.maidens);
    const teamCost = deployable.length > 0 ? foodCost(deployable) : 0;
    // Recruit unconditionally when below the wave-safety threshold — food shortage
    // is recoverable; a tiny roster destroyed by a Lyssa Wave is not.
    // Above the threshold, still gate on food so we don't starve the team.
    const belowWaveThreshold = activeNow < RECRUIT_PRIORITY_THRESHOLD;
    if (activeNow < recruitCap && (belowWaveThreshold || st.mbase.food > teamCost)) {
      const nm = recruitMaiden(st.maidens);
      store.addMaiden(nm);
      return { type: 'action' };
    }
  }

  // ── 6. Trade gold → food / wood ───────────────────────────────────────────
  {
    const st = useGameStore.getState();
    const mb = st.mbase;
    const radioBuilt = st.buildings.find(b => b.id === 'radio_center')?.isConstructed ?? false;
    if (radioBuilt) {
      const FOOD_RATE = 2;
      const WOOD_RATE = 4;
      const deployable = deployableMaidens(st.maidens);
      const teamCost = deployable.length > 0 ? foodCost(deployable) : 0;
      if (mb.food < teamCost && mb.money > 200) {
        const toBuy = Math.min(Math.floor((mb.money - 100) / FOOD_RATE), teamCost * 3 - mb.food);
        if (toBuy > 0) {
          useGameStore.getState().setMBase({ money: mb.money - toBuy * FOOD_RATE, food: mb.food + toBuy });
          return { type: 'action' };
        }
      }
      const nextUp = pickBuildingUpgrade(st.buildings, { ...mb, wood: mb.wood + 50 }, activeMaidens(st.maidens).length);
      if (nextUp) {
        const lvIdx = nextUp.isConstructed ? nextUp.currentLevel : 0;
        const lv = nextUp.levels[lvIdx];
        const woodNeeded = (lv?.costWood ?? 0) - mb.wood;
        if (woodNeeded > 0 && woodNeeded <= 50 && mb.money >= woodNeeded * WOOD_RATE + 100) {
          const cost = woodNeeded * WOOD_RATE;
          useGameStore.getState().setMBase({ money: mb.money - cost, wood: mb.wood + woodNeeded });
          return { type: 'action' };
        }
      }
    }
  }

  // ── 7. Pick mission ────────────────────────────────────────────────────────
  const st7 = useGameStore.getState();
  // Mission floor: if the active roster is critically thin, skip missions and
  // spend ticks recruiting instead. A 4-6 person team running into any Lyssa
  // mission (even easy) reliably loses 5-10 maidens — those ticks are better
  // spent rebuilding. Mandatory waves always bypass this gate.
  const activeForMission = activeMaidens(st7.maidens).length;
  const hasMandatoryWave = st7.missions.some(m => !m.isCompleted && m.isLyssaWave);
  if (activeForMission < MISSION_FLOOR_ROSTER && !hasMandatoryWave) {
    const beds7 = maxBeds(st7.buildings);
    if (activeForMission < beds7 - BED_BUFFER) {
      const nm = recruitMaiden(st7.maidens);
      store.addMaiden(nm);
      return { type: 'action' };
    }
    // Beds are full — can't recruit. Fall through to mission selection rather
    // than spinning idle forever. The mission pool will pick the safest option.
  }

  const hasCaptured = st7.maidens.some(m => m.isCaptured && !m.isFallen);
  const bloomCount7 = st7.inventory
    .filter(i => i.id === 'revenant_bloom')
    .reduce((s, i) => s + (i.quantity ?? 1), 0);
  const hasFallenHeroine7 = st7.maidens.some(m => m.isFallen && !!m.heroineId);
  const mission = pickBestMission(st7.missions, st7.maidens, state.wipeCooldown, state.missionsCompleted, hasCaptured, st7.mbase, state.idleStreak, bloomCount7, hasFallenHeroine7);
  if (!mission) {
    state.idleStreak++;
    store.refreshMissions();
    if (state.idleStreak > LYSSA_IDLE_THRESHOLD) {
      state.idleStreak = 0;
    }
    return { type: 'idle' };
  }
  state.idleStreak = 0;

  // ── 8. Assemble & feed team ────────────────────────────────────────────────
  const freshMaidens8 = useGameStore.getState().maidens;
  // For Lyssa Waves, deploy ALL maidens with HP > 0 ("all hands").
  // Log analysis: roster=29 → wave won with 3 KIA; roster=4-9 → retreat with 12-18 KIA.
  // More bodies spread casualties and dramatically improve survival odds.
  const fullTeam = pickBestTeam(freshMaidens8, deployableMaidens(freshMaidens8).length, mission.rewardFocus, mission.isLyssaWave);
  let deployTeam = fullTeam;
  if (useGameStore.getState().mbase.food < foodCost(fullTeam)) {
    let shrunk = [...fullTeam];
    while (shrunk.length > 1 && foodCost(shrunk) > useGameStore.getState().mbase.food) shrunk.pop();
    deployTeam = shrunk.length > 0 ? shrunk : fullTeam.slice(0, 1);
  }
  if (deployTeam.length < 1) {
    const nm = recruitMaiden(useGameStore.getState().maidens);
    store.addMaiden(nm);
    return { type: 'action' };
  }

  // Snapshot resources BEFORE mission for delta calculation
  const resBefore = { ...useGameStore.getState().mbase };
  const { fsi: fsiBeforeRaw, tierLabel } = computeForceStrengthIndex(useGameStore.getState().maidens);
  const deployFsi = computeDeployedFsi(deployTeam);
  const baseFsi = Math.round(fsiBeforeRaw);

  let remainingFood = useGameStore.getState().mbase.food ?? 0;
  const leader = deployTeam.reduce((b, m) => getStat(m, 'strategy') > getStat(b, 'strategy') ? m : b, deployTeam[0]);
  const ordered = [leader, ...deployTeam.filter(m => m.id !== leader.id)];
  const fedTeam = ordered.map(m => {
    const cost2 = 20 + getStat(m, 'strength');
    if (remainingFood >= cost2) { remainingFood -= cost2; return m; }
    remainingFood = 0;
    const perm = m.moralePermanentBonus ?? 0;
    store.setMaiden(m.id, { moralePermanentBonus: perm - 3 });
    return { ...m, isStarved: true, currentHp: Math.max(1, Math.floor(m.currentHp / 2)) };
  });
  store.setMBase({ food: remainingFood });

  display?.('Mission', `"${mission.name}" [${mission.difficulty}${mission.isLyssaWave ? ' 🚨WAVE' : ''}] | ${fedTeam.length} maidens | ${mission.stages.length} stage(s) | FSI:${deployFsi}/${baseFsi}`, 'info');

  // ── 9. Resolve mission ─────────────────────────────────────────────────────
  const { won, survivors, kills, deaths, escapedIds, capturedIds } = resolveInstant(
    mission, fedTeam, useGameStore.getState(),
    (action, detail, outcome) => display?.(action, detail, outcome),
  );

  if (capturedIds.length > 0) display?.('Captured', `${capturedIds.length} maiden(s) captured`, 'warn');
  if (escapedIds.length > 0) display?.('Escaped', `${escapedIds.length} maiden(s) fled`, 'warn');

  store.postMissionReset();

  // Purge KIA/captured from team rosters
  {
    const stAfter = useGameStore.getState();
    const fallenIds = new Set(stAfter.maidens.filter(m => m.isFallen || m.isCaptured).map(m => m.id));
    if (fallenIds.size > 0) {
      for (const team of stAfter.teams) {
        if (!team.memberIds.some(id => fallenIds.has(id))) continue;
        const newMemberIds = team.memberIds.filter(id => !fallenIds.has(id));
        const newLeaderId = team.leaderId && fallenIds.has(team.leaderId)
          ? stAfter.maidens.find(m => newMemberIds.includes(m.id) && !m.isFallen && !m.isCaptured && m.currentHp > 0)?.id ?? undefined
          : team.leaderId;
        store.setTeam(team.id, { memberIds: newMemberIds, leaderId: newLeaderId });
      }
    }
  }

  // ── 10. Post-mission effects ──────────────────────────────────────────────
  const deployedIds = fedTeam.map(m => m.id);

  const hospital = useGameStore.getState().buildings.find(b => b.id === 'field_hospital');
  if (hospital?.isConstructed) {
    const frac = hospital.levels[hospital.currentLevel - 1]?.effectValue?.healFraction ?? 0;
    if (frac > 0) store.healInjuredMaidens(frac);
  }

  const tg = useGameStore.getState().buildings.find(b => b.id === 'training_grounds');
  if (tg?.isConstructed) {
    const exp = tg.levels[tg.currentLevel - 1]?.effectValue?.theoryExp ?? 0;
    if (exp > 0) store.awardTrainingExp(exp, deployedIds);
  }

  const farm = useGameStore.getState().buildings.find(b => b.id === 'farm');
  if (farm?.isConstructed) {
    const foodProd = farm.levels[farm.currentLevel - 1]?.effectValue?.food ?? 0;
    if (foodProd > 0) store.setMBase({ food: (useGameStore.getState().mbase.food ?? 0) + foodProd });
  }

  const meridian = useGameStore.getState().buildings.find(b => b.id === 'the_meridian');
  if (meridian?.isConstructed) {
    const mTier = meridian.levels[meridian.currentLevel - 1]?.effectValue?.tier ?? 1;
    const curMaidens = useGameStore.getState().maidens;
    const mDeaths = deployedIds.filter(id => {
      const m = curMaidens.find(x => x.id === id);
      return m && (m.isFallen || m.currentHp <= 0);
    }).length;
    store.recordMeridianMission({ missionId: mission.id, kills, deaths: mDeaths, deployedCount: deployedIds.length, difficulty: mission.difficulty, isWin: won });
    store.applyMeridianSupport(mTier);
  }

  // Wipe cooldown
  if (!won && deaths >= 4) {
    state.wipeCooldown = POST_WIPE_COOLDOWN_MISSIONS;
    display?.('Strategy', `Heavy loss (${deaths} KIA) — easy/normal only for ${POST_WIPE_COOLDOWN_MISSIONS} missions.`, 'warn');
  } else if (won && state.wipeCooldown > 0) {
    state.wipeCooldown = Math.max(0, state.wipeCooldown - 1);
  }

  // Rewards & store completion
  if (won) {
    const freshMission = useGameStore.getState().missions.find(m => m.id === mission.id);
    const stillCaptured = freshMission?.capturedMaidenIds ?? [];
    if (stillCaptured.length > 0) {
      const teamId = useGameStore.getState().teams[0]?.id ?? '';
      store.rescueCapturedMaidens(stillCaptured, teamId);
      store.setMission(mission.id, { capturedMaidenIds: [] });
      display?.('Rescue', `Rescued ${stillCaptured.length} maiden(s)`, 'info');
    }

    const reward = mission.reward;
    if (reward) {
      const s2 = useGameStore.getState().mbase;
      const patch: Record<string, number> = {};
      if (reward.money) patch.money = s2.money + reward.money;
      if (reward.wood)  patch.wood  = s2.wood  + reward.wood;
      if (reward.metal) patch.metal = s2.metal + reward.metal;
      if (reward.food)  patch.food  = s2.food  + reward.food;
      if (Object.keys(patch).length > 0) store.setMBase(patch);
      (reward.equipment ?? []).forEach((eq: any) => store.addInventoryItem({ ...eq, inventoryId: `re_${mission.id}_${uuidv4()}` }));
      (reward.rescuedHeroineIds ?? []).forEach((hid: string) => {
        if (!useGameStore.getState().maidens.some(m => m.heroineId === hid)) {
          const def = HEROINE_DEFINITIONS.find(h => h.id === hid);
          if (def) store.addMaiden(heroineDefToMaiden(def));
        }
      });
    }

    for (const m of fedTeam) {
      if (!m.isFallen && m.currentHp > 0) {
        store.setMaiden(m.id, { missionCount: (useGameStore.getState().maidens.find(x => x.id === m.id)?.missionCount ?? 0) + 1 });
      }
    }
    store.setMission(mission.id, { isCompleted: true });
    state.missionsCompleted++;

    // ── Lyssa Wave countdown ───────────────────────────────────────────────
    // Wave win: reset countdown via completeLyssaWave()
    // Normal win: decrement countdown — when it hits 0, refreshMissions() injects the wave
    if (mission.isLyssaWave) {
      store.completeLyssaWave();
      display?.('Lyssa Wave', `🛡️ Wave repelled! Countdown reset.`, 'win');
    } else {
      store.decrementMissionsUntilWave();
    }

    display?.('Mission complete',
      `✅ "${mission.name}" — win #${state.missionsCompleted} | kills:${kills} | KIA:${deaths} | survivors:${survivors.length}`,
      'win');
  } else {
    // Lyssa Wave loss: resource penalty + escape check for home maidens + reset countdown
    if (mission.isLyssaWave) {
      const lossRate = 0.25 + Math.random() * 0.5;
      const st = useGameStore.getState();
      store.setMBase({
        money: Math.floor(st.mbase.money * (1 - lossRate)),
        food:  Math.floor(st.mbase.food  * (1 - lossRate)),
        wood:  Math.floor(st.mbase.wood  * (1 - lossRate)),
        metal: Math.floor(st.mbase.metal * (1 - lossRate)),
      });
      // Home maidens (not deployed in the wave) face a 50/50 capture or escape check
      const deployedSet = new Set(fedTeam.map(m => m.id));
      const homeMaidens = useGameStore.getState().maidens.filter(
        m => !m.isFallen && !m.isCaptured && !deployedSet.has(m.id)
      );
      const waveEscapedIds: string[] = [];
      const waveCapturedIds: string[] = [];
      for (const m of homeMaidens) {
        if (Math.random() < 0.5) waveCapturedIds.push(m.id);
        else waveEscapedIds.push(m.id);
      }
      if (waveEscapedIds.length > 0 || waveCapturedIds.length > 0) {
        store.applyMoraleQuitEvents(waveEscapedIds, waveCapturedIds);
      }
      store.completeLyssaWave();
      display?.('Lyssa Wave', `💀 Wave lost! ${Math.round(lossRate * 100)}% looted. Home maidens: ${waveCapturedIds.length} captured, ${waveEscapedIds.length} escaped.`, 'loss');
    }

    display?.('Mission failed', `❌ "${mission.name}" — kills:${kills} | KIA:${deaths}`, 'loss');
  }

  store.refreshMissions();

  // ── Build compact MissionLogEntry ─────────────────────────────────────────
  const resAfter = useGameStore.getState().mbase;
  const { fsi: fsiAfterRaw } = computeForceStrengthIndex(useGameStore.getState().maidens);
  const rosterAfter = activeMaidens(useGameStore.getState().maidens).length;

  const missionEntry: MissionLogEntry = {
    tick: state.tick,
    msn: state.missionsCompleted,
    focus: mission.rewardFocus ?? 'balanced',
    diff: mission.difficulty,
    stages: mission.stages.length,
    deployFsi,
    baseFsi,
    threat: missionMaxThreat(mission),
    quality: Math.round(missionAvgQuality(mission) * 10) / 10,
    hasLyssa: missionHasLyssa(mission),
    isWave: !!mission.isLyssaWave,
    out: won ? 'win' : (deaths >= deployTeam.length ? 'wipe' : 'retreat'),
    kia: deaths,
    cap: capturedIds.length,
    esc: escapedIds.length,
    kills,
    dm: resAfter.money - resBefore.money,
    df: resAfter.food  - resBefore.food,
    dw: resAfter.wood  - resBefore.wood,
    dme: resAfter.metal - resBefore.metal,
    fsiAfter: Math.round(fsiAfterRaw),
    roster: rosterAfter,
    tier: tierLabel,
  };

  return { type: 'mission', missionEntry };
}

// ── Single-run simulation ─────────────────────────────────────────────────────

function runSimulation(
  targetMissions: number,
  settings: EngineSettings,
  onDisplay: (entry: DisplayEntry) => void,
  onDone: (summary: string, exportData: RuleEngineExport) => void,
) {
  const missionLog: MissionLogEntry[] = [];
  const state: TickState = { tick: 0, missionsCompleted: 0, wipeCooldown: 0, idleStreak: 0 };

  function mkDisplay(action: string, detail: string, outcome: DisplayEntry['outcome'] = 'info') {
    const s = useGameStore.getState();
    const { fsi } = computeForceStrengthIndex(s.maidens);
    onDisplay({
      tick: state.tick,
      msn: state.missionsCompleted,
      action, detail, outcome,
      money: s.mbase.money,
      food: s.mbase.food,
      wood: s.mbase.wood,
      metal: s.mbase.metal,
      fsi: Math.round(fsi),
      roster: activeMaidens(s.maidens).length,
    });
  }

  function runChunk() {
    const CHUNK = 200;
    let i = 0;
    while (i < CHUNK && state.tick < MAX_TICKS && state.missionsCompleted < targetMissions) {
      state.tick++;
      i++;
      const result = runTick(state, settings, mkDisplay);
      if (result.missionEntry) missionLog.push(result.missionEntry);
    }

    if (state.missionsCompleted >= targetMissions || state.tick >= MAX_TICKS) {
      const s = useGameStore.getState();
      const { fsi, tierLabel } = computeForceStrengthIndex(s.maidens);
      const alive  = s.maidens.filter(m => !m.isFallen && !m.isCaptured).length;
      const fallen = s.maidens.filter(m => m.isFallen).length;
      const summary =
        `${state.missionsCompleted >= targetMissions ? '✅' : '⚠️'} ${state.missionsCompleted}/${targetMissions} missions in ${state.tick} ticks.\n` +
        `FSI: ${fsi} (${tierLabel}) | Roster: ${alive} alive, ${fallen} KIA, ${s.maidens.filter(m => m.isCaptured).length} captured.\n` +
        `Resources: 💰${s.mbase.money} 🪵${s.mbase.wood} ⚙️${s.mbase.metal} 🍖${s.mbase.food}`;

      const exportData: RuleEngineExport = {
        meta: {
          generatedAt: new Date().toISOString(),
          totalMissions: state.missionsCompleted,
          totalTicks: state.tick,
          settings,
          finalFsi: fsi,
          finalTier: tierLabel,
          finalRoster: alive,
          totalKia: fallen,
          resources: { money: s.mbase.money, food: s.mbase.food, wood: s.mbase.wood, metal: s.mbase.metal },
        },
        missions: missionLog,
      };

      onDone(summary, exportData);
    } else {
      setTimeout(runChunk, 0);
    }
  }

  setTimeout(runChunk, 0);
}

// ── Multi-run simulation ──────────────────────────────────────────────────────

function buildRunSnapshot(tick: number, msn: number): RunSnapshot {
  const s = useGameStore.getState();
  const { fsi, tierLabel } = computeForceStrengthIndex(s.maidens);
  const roster = s.maidens.filter(m => !m.isFallen && !m.isCaptured).length;
  const kia = s.maidens.filter(m => m.isFallen).length;
  const builtBuildings = s.buildings
    .filter(b => b.isConstructed)
    .map(b => `${b.id.replace(/_/g, ' ')} L${b.currentLevel}`)
    .join(', ');
  return {
    msn, tick,
    fsi: Math.round(fsi * 10) / 10,
    tier: tierLabel,
    roster, kia,
    money: s.mbase.money, food: s.mbase.food, wood: s.mbase.wood, metal: s.mbase.metal,
    buildings: builtBuildings,
  };
}

function runMultiSimulation(
  totalAttempts: number,
  targetMissions: number,
  settings: EngineSettings,
  onProgress: (done: number, total: number) => void,
  onDone: (result: MultiRunResult) => void,
) {
  const store = useGameStore.getState();
  const attempts: MultiRunAttempt[] = [];
  let currentAttempt = 0;

  function runNextAttempt() {
    if (currentAttempt >= totalAttempts) {
      onDone({ exportedAt: new Date().toISOString(), targetMissions, totalAttempts, settings, snapshotInterval: MULTI_SNAPSHOT_INTERVAL, attempts });
      return;
    }

    const freshSave = JSON.parse(JSON.stringify(INITIAL_SAVE));
    freshSave.missions = _generateMissionSet(freshSave.maidens, []);
    store.importSave(freshSave);
    useGameStore.getState().refreshMissions();

    const snapshots: RunSnapshot[] = [buildRunSnapshot(0, 0)];
    const missionLog: MissionLogEntry[] = [];
    let lastSnapshotAt = 0;
    const state: TickState = { tick: 0, missionsCompleted: 0, wipeCooldown: 0, idleStreak: 0 };

    function runChunk() {
      const CHUNK = 300;
      let i = 0;
      while (i < CHUNK && state.tick < MAX_TICKS && state.missionsCompleted < targetMissions) {
        state.tick++;
        i++;
        const result = runTick(state, settings, null);
        if (result.missionEntry) {
          missionLog.push(result.missionEntry);
          if (state.missionsCompleted % MULTI_SNAPSHOT_INTERVAL === 0 && state.missionsCompleted !== lastSnapshotAt) {
            snapshots.push(buildRunSnapshot(state.tick, state.missionsCompleted));
            lastSnapshotAt = state.missionsCompleted;
          }
        }
      }

      if (state.tick < MAX_TICKS && state.missionsCompleted < targetMissions) {
        setTimeout(runChunk, 0);
        return;
      }

      if (lastSnapshotAt !== state.missionsCompleted) {
        snapshots.push(buildRunSnapshot(state.tick, state.missionsCompleted));
      }

      const { fsi } = computeForceStrengthIndex(useGameStore.getState().maidens);
      attempts.push({
        attemptIndex: currentAttempt,
        snapshots,
        missions: missionLog,
        summary: `Run ${currentAttempt + 1}: ${state.missionsCompleted}/${targetMissions} in ${state.tick} ticks | FSI: ${fsi.toFixed(1)}`,
        totalTicks: state.tick,
        missionsCompleted: state.missionsCompleted,
      });

      currentAttempt++;
      onProgress(currentAttempt, totalAttempts);
      setTimeout(runNextAttempt, 0);
    }

    setTimeout(runChunk, 0);
  }

  runNextAttempt();
}

// ── UI ───────────────────────────────────────────────────────────────────────

const OUTCOME_COLOR: Record<string, string> = {
  win:  '#4a8c4a',
  loss: '#b84040',
  warn: '#c8a84b',
  info: 'var(--color-text-muted)',
};

const OUTCOME_BG: Record<string, string> = {
  win:  'rgba(74,140,74,0.07)',
  loss: 'rgba(184,64,64,0.07)',
  warn: 'rgba(200,168,75,0.05)',
  info: 'transparent',
};

export default function RuleEngine() {
  const [activeTab, setActiveTab] = useState<'single' | 'multi'>('single');

  // ── Single-run state ──
  const [targetMissions, setTargetMissions] = useState(50);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');
  const [displayLog, setDisplayLog] = useState<DisplayEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'warn'>('all');
  const [settings, setSettings] = useState<EngineSettings>({
    buyIntensity: 'medium',
    sellIntensity: 'low',
    craftIntensity: 'medium',
  });
  const displayRef = useRef<DisplayEntry[]>([]);
  const exportDataRef = useRef<RuleEngineExport | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Multi-run state ──
  const [multiAttempts, setMultiAttempts] = useState(5);
  const [multiTargetMissions, setMultiTargetMissions] = useState(200);
  const [multiRunning, setMultiRunning] = useState(false);
  const [multiDone, setMultiDone] = useState(false);
  const [multiProgress, setMultiProgress] = useState(0);
  const [multiResult, setMultiResult] = useState<MultiRunResult | null>(null);
  const [multiSettings, setMultiSettings] = useState<EngineSettings>({
    buyIntensity: 'medium',
    sellIntensity: 'low',
    craftIntensity: 'medium',
  });

  const addDisplay = useCallback((entry: DisplayEntry) => {
    displayRef.current = [...displayRef.current, entry];
    if (displayRef.current.length % 20 === 0 || entry.outcome === 'win' || entry.outcome === 'loss') {
      setDisplayLog([...displayRef.current]);
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 10);
    }
  }, []);

  function handleStart() {
    displayRef.current = [];
    exportDataRef.current = null;
    setDisplayLog([]);
    setSummary('');
    setDone(false);
    setRunning(true);

    const freshSave = JSON.parse(JSON.stringify(INITIAL_SAVE));
    freshSave.missions = _generateMissionSet(freshSave.maidens, []);
    useGameStore.getState().importSave(freshSave);
    useGameStore.getState().refreshMissions();

    runSimulation(
      targetMissions, settings, addDisplay,
      (sum, expData) => {
        setDisplayLog([...displayRef.current]);
        exportDataRef.current = expData;
        setSummary(sum);
        setDone(true);
        setRunning(false);
      },
    );
  }

  function handleMultiStart() {
    setMultiResult(null);
    setMultiDone(false);
    setMultiProgress(0);
    setMultiRunning(true);
    runMultiSimulation(
      multiAttempts, multiTargetMissions, multiSettings,
      (done, total) => setMultiProgress(done / total),
      (result) => {
        setMultiResult(result);
        setMultiDone(true);
        setMultiRunning(false);
        setMultiProgress(1);
      },
    );
  }

  function exportJson() {
    if (!exportDataRef.current) return;
    const blob = new Blob([JSON.stringify(exportDataRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rule_engine_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    if (!exportDataRef.current) return;
    const rows = [
      'tick,msn,focus,diff,stages,deployFsi,baseFsi,threat,quality,hasLyssa,isWave,out,kia,cap,esc,kills,dm,df,dw,dme,fsiAfter,roster,tier',
    ];
    for (const e of exportDataRef.current.missions) {
      rows.push([
        e.tick, e.msn, e.focus, e.diff, e.stages, e.deployFsi, e.baseFsi,
        e.threat, e.quality, e.hasLyssa ? 1 : 0, e.isWave ? 1 : 0,
        e.out, e.kia, e.cap, e.esc, e.kills,
        e.dm, e.df, e.dw, e.dme, e.fsiAfter, e.roster, `"${e.tier}"`,
      ].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rule_engine_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportMultiJson() {
    if (!multiResult) return;
    const blob = new Blob([JSON.stringify(multiResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `multi_run_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const filteredLog = filter === 'all' ? displayLog : displayLog.filter(e => e.outcome === filter);

  function IntensityPicker({ label, value, disabled, onChange }: { label: string; value: Intensity; disabled: boolean; onChange: (v: Intensity) => void }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>
        <select
          value={value} onChange={e => onChange(e.target.value as Intensity)} disabled={disabled}
          style={{ padding: '6px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {(['none', 'low', 'medium', 'high'] as Intensity[]).map(v => (
            <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
          ))}
        </select>
      </div>
    );
  }



  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>🤖 Rule Engine</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
        Automated strategy simulator. Plays from a fresh save using built-in decision rules.
        JSON export is compact and analysis-ready — no per-maiden bloat.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
        {(['single', 'multi'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 20px', fontSize: 13, cursor: 'pointer', border: 'none',
            borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === tab ? 'var(--color-accent)' : 'var(--color-text-muted)',
            fontWeight: activeTab === tab ? 'bold' : 'normal', marginBottom: -1,
          }}>
            {tab === 'single' ? '▶ Single Run' : '📊 Multi-Run'}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ SINGLE RUN ════════════════════════════ */}
      {activeTab === 'single' && (<>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '14px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Target missions</label>
            <input type="number" min={1} max={10000} value={targetMissions}
              onChange={e => setTargetMissions(Math.max(1, parseInt(e.target.value) || 1))} disabled={running}
              style={{ width: 100, padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
          </div>

          <IntensityPicker label="🛒 Buy" value={settings.buyIntensity} disabled={running} onChange={v => setSettings(p => ({ ...p, buyIntensity: v }))} />
          <IntensityPicker label="💸 Sell" value={settings.sellIntensity} disabled={running} onChange={v => setSettings(p => ({ ...p, sellIntensity: v }))} />
          <IntensityPicker label="🔧 Craft" value={settings.craftIntensity} disabled={running} onChange={v => setSettings(p => ({ ...p, craftIntensity: v }))} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 2 }}>
            <button onClick={handleStart} disabled={running} style={{
              padding: '8px 20px', fontSize: 13, borderRadius: 4, cursor: running ? 'not-allowed' : 'pointer',
              background: running ? 'rgba(200,149,74,0.1)' : 'rgba(200,149,74,0.25)',
              color: 'var(--color-accent)', border: '1px solid var(--color-accent-dark)', fontWeight: 'bold', opacity: running ? 0.6 : 1,
            }}>
              {running ? '⏳ Running…' : '▶ Start'}
            </button>
            {(done || displayLog.length > 0) && (<>
              <button onClick={exportJson} style={{ padding: '8px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                📥 Export JSON
              </button>
              <button onClick={exportCsv} style={{ padding: '8px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                📥 Export CSV
              </button>
            </>)}
          </div>

          {running && displayLog.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Tick {displayLog[displayLog.length - 1]?.tick} — {displayLog[displayLog.length - 1]?.msn}/{targetMissions} missions
            </div>
          )}
        </div>

        {/* Strategy info */}
        <details style={{ marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
          <summary style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--color-accent)', fontWeight: 'bold', userSelect: 'none' }}>
            📋 Strategy overview
          </summary>
          <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 8px' }}>
              <strong style={{ color: 'var(--color-text)' }}>Goal:</strong> Maximise FSI = Σ mean(STR,DEX,CON,AWR)×(HP/maxHP) across all active maidens.
              Hard gate: FSI ≥ {FSI_FOR_DIFFICULTY['hard']}. Extreme gate: FSI ≥ {FSI_FOR_DIFFICULTY['extreme']}.
            </p>
            <ol style={{ paddingLeft: 20, margin: '0 0 8px' }}>
              <li><strong style={{ color: 'var(--color-text)' }}>Emergency recruit</strong> — roster &lt; {MIN_TEAM_SIZE}</li>
              <li><strong style={{ color: 'var(--color-text)' }}>Build/upgrade</strong> — Farm → Hospital → Training → Tent → Radio → Factory → Meridian</li>
              <li><strong style={{ color: 'var(--color-text)' }}>HQ Shop / Craft / Sell / Equip</strong> — free actions, all in one tick</li>
              <li><strong style={{ color: 'var(--color-text)' }}>Roster expansion</strong> — recruit up to beds−{BED_BUFFER}</li>
              <li><strong style={{ color: 'var(--color-text)' }}>Trade</strong> — 2💰→1🍖 when food low; 4💰→1🪵 for building shortfall</li>
              <li><strong style={{ color: 'var(--color-text)' }}>Mission selection</strong> — 6-pool fallback (threat/diff/stage/wipe gates, rescue priority, Lyssa Wave mandatory)</li>
              <li><strong style={{ color: 'var(--color-text)' }}>Deploy</strong> — top maidens by STR+DEX+CON (AWR bonus for rescue), keep {DEPLOY_RESERVE} home</li>
              <li><strong style={{ color: 'var(--color-text)' }}>Retreat trigger</strong> — ≥{Math.round(STAGE_CASUALTY_RETREAT_FRAC * 100)}% casualties between stages or &lt;{MIN_TEAM_SIZE} survivors</li>
              <li><strong style={{ color: 'var(--color-text)' }}>Post-mission</strong> — Hospital heal, Farm food, Training EXP, Meridian bonus</li>
            </ol>
            <p style={{ margin: 0, fontSize: 11 }}>
              Lyssa Waves are mandatory: the wave mission is always run first regardless of other pool logic.
              A lost wave incurs a {25}–{75}% resource loot penalty and still resets the countdown.
              Rescue missions use a lower FSI/threat ratio ({RESCUE_FSI_RATIO}×) to prioritise recovering captured maidens.
            </p>
          </div>
        </details>

        {/* Run summary */}
        {summary && (
          <div style={{
            padding: '12px 16px', marginBottom: 16, borderRadius: 6,
            background: summary.startsWith('✅') ? 'rgba(74,140,74,0.1)' : 'rgba(200,168,75,0.1)',
            border: `1px solid ${summary.startsWith('✅') ? '#4a8c4a' : '#c8a84b'}`,
            fontSize: 13, color: 'var(--color-text)', whiteSpace: 'pre-line',
          }}>
            {summary}
          </div>
        )}

        {/* Display log */}
        {displayLog.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{displayLog.length} events</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'win', 'loss', 'warn'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: '3px 10px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
                    background: filter === f ? 'rgba(200,149,74,0.2)' : 'transparent',
                    color: filter === f ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    border: `1px solid ${filter === f ? 'var(--color-accent-dark)' : 'var(--color-border)'}`,
                  }}>
                    {f === 'all' ? 'All' : f === 'win' ? '✅ Wins' : f === 'loss' ? '❌ Losses' : '⚠️ Warnings'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 480, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, fontFamily: 'monospace', fontSize: 11 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
                  <tr>
                    {['Tick', 'Msn', 'Action', 'Detail', '💰', '🍖', '🪵', '⚙️', 'FSI', 'Roster'].map(h => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: 10, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.map((e, i) => (
                    <tr key={i} style={{ background: OUTCOME_BG[e.outcome] ?? 'transparent' }}>
                      <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.tick}</td>
                      <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)' }}>{e.msn}</td>
                      <td style={{ padding: '3px 8px', color: OUTCOME_COLOR[e.outcome] ?? 'inherit', whiteSpace: 'nowrap', fontWeight: (e.outcome === 'win' || e.outcome === 'loss') ? 'bold' : 'normal' }}>{e.action}</td>
                      <td style={{ padding: '3px 8px', color: 'var(--color-text)', maxWidth: 380 }}>{e.detail}</td>
                      <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.money}</td>
                      <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.food}</td>
                      <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.wood}</td>
                      <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.metal}</td>
                      <td style={{ padding: '3px 8px', color: '#4a8cc8', whiteSpace: 'nowrap' }}>{e.fsi}</td>
                      <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)' }}>{e.roster}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </>)}

      {/* ═══════════════════════ MULTI-RUN ═════════════════════════════ */}
      {activeTab === 'multi' && (
        <div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 16 }}>
            Runs N independent attempts from fresh saves. Records a lightweight snapshot every {MULTI_SNAPSHOT_INTERVAL} successful missions
            and a compact per-mission log (no full maiden data). Exported JSON is suitable for balance analysis.
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '14px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Attempts (N)</label>
              <input type="number" min={1} max={100} value={multiAttempts}
                onChange={e => setMultiAttempts(Math.max(1, parseInt(e.target.value) || 1))} disabled={multiRunning}
                style={{ width: 80, padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Missions / run</label>
              <input type="number" min={50} max={10000} step={50} value={multiTargetMissions}
                onChange={e => setMultiTargetMissions(Math.max(50, parseInt(e.target.value) || 50))} disabled={multiRunning}
                style={{ width: 100, padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
            </div>

            <IntensityPicker label="🛒 Buy" value={multiSettings.buyIntensity} disabled={multiRunning} onChange={v => setMultiSettings(p => ({ ...p, buyIntensity: v }))} />
            <IntensityPicker label="💸 Sell" value={multiSettings.sellIntensity} disabled={multiRunning} onChange={v => setMultiSettings(p => ({ ...p, sellIntensity: v }))} />
            <IntensityPicker label="🔧 Craft" value={multiSettings.craftIntensity} disabled={multiRunning} onChange={v => setMultiSettings(p => ({ ...p, craftIntensity: v }))} />

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 2 }}>
              <button onClick={handleMultiStart} disabled={multiRunning} style={{
                padding: '8px 20px', fontSize: 13, borderRadius: 4, cursor: multiRunning ? 'not-allowed' : 'pointer',
                background: multiRunning ? 'rgba(74,140,200,0.1)' : 'rgba(74,140,200,0.25)',
                color: '#4a8cc8', border: '1px solid #3a6a98', fontWeight: 'bold', opacity: multiRunning ? 0.6 : 1,
              }}>
                {multiRunning ? '⏳ Running…' : '📊 Start Multi-Run'}
              </button>
              {multiDone && multiResult && (
                <button onClick={exportMultiJson} style={{ padding: '8px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                  📥 Export JSON
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {(multiRunning || multiDone) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                <span>{multiRunning ? `Running attempt ${Math.round(multiProgress * multiAttempts) + 1} / ${multiAttempts}…` : `✅ All ${multiAttempts} attempts complete`}</span>
                <span>{Math.round(multiProgress * 100)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: multiDone ? '#4a8c4a' : '#4a8cc8', width: `${Math.round(multiProgress * 100)}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {/* Results */}
          {multiDone && multiResult && (() => {
            const lastSnaps = multiResult.attempts.map(a => a.snapshots[a.snapshots.length - 1]);
            const n = Math.max(lastSnaps.length, 1);
            const avg = (fn: (s: RunSnapshot) => number) => (lastSnaps.reduce((s, r) => s + fn(r), 0) / n).toFixed(1);
            const count = (fn: (s: RunSnapshot) => boolean) => lastSnaps.filter(fn).length;

            const cell = (label: string, value: string | number, color?: string) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, padding: '6px 14px', borderRight: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>{label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: color ?? 'var(--color-text)' }}>{value}</span>
              </div>
            );

            return (
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: 13 }}>
                  Results — {multiResult.totalAttempts} attempts × {multiResult.targetMissions} missions (snapshot every {multiResult.snapshotInterval})
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 10, overflow: 'hidden' }}>
                  {cell('Avg FSI', avg(r => r.fsi), '#4a8cc8')}
                  {cell('Avg KIA', avg(r => r.kia), '#b84040')}
                  {cell('Avg Ticks', avg(r => multiResult.attempts[lastSnaps.indexOf(r)].totalTicks))}
                  {cell('Avg Roster', avg(r => r.roster), '#4a9c5a')}
                  {cell('FSI ≥160', count(r => r.fsi >= 160), '#4a8cc8')}
                  {cell('FSI ≥320', count(r => r.fsi >= 320), '#4a8cc8')}
                  {cell('KIA ≥50', count(r => r.kia >= 50), '#b84040')}
                </div>

                {/* Per-attempt summary table */}
                <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface)' }}>
                        {['Run', 'Missions', 'Ticks', 'FSI', 'Tier', 'Roster', 'KIA', '💰', '🍖', '🪵', '⚙️', 'Summary'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {multiResult.attempts.map(attempt => {
                        const last = attempt.snapshots[attempt.snapshots.length - 1];
                        return (
                          <tr key={attempt.attemptIndex} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>#{attempt.attemptIndex + 1}</td>
                            <td style={{ padding: '4px 10px' }}>{attempt.missionsCompleted}</td>
                            <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{attempt.totalTicks}</td>
                            <td style={{ padding: '4px 10px', color: '#4a8cc8' }}>{last ? last.fsi.toFixed(1) : '—'}</td>
                            <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.tier : '—'}</td>
                            <td style={{ padding: '4px 10px' }}>{last ? last.roster : '—'}</td>
                            <td style={{ padding: '4px 10px', color: '#b84040' }}>{last ? last.kia : '—'}</td>
                            <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.money : '—'}</td>
                            <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.food : '—'}</td>
                            <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.wood : '—'}</td>
                            <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.metal : '—'}</td>
                            <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attempt.summary}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* FSI progression per attempt */}
                <details style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                  <summary style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--color-accent)', fontWeight: 'bold', userSelect: 'none' }}>
                    📈 FSI progression (every {multiResult.snapshotInterval} missions)
                  </summary>
                  <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
                    {multiResult.attempts.map(attempt => (
                      <div key={attempt.attemptIndex} style={{ marginBottom: 20 }}>
                        <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>Run #{attempt.attemptIndex + 1}</div>
                        <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace', width: '100%' }}>
                          <thead>
                            <tr>
                              {['@Msn', 'Tick', 'FSI', 'Tier', 'Roster', 'KIA', '💰', '🍖', '🪵', '⚙️', 'Buildings'].map(h => (
                                <th key={h} style={{ padding: '3px 10px', textAlign: 'left', fontSize: 10, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {attempt.snapshots.map((snap, si) => (
                              <tr key={si} style={{ borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                                <td style={{ padding: '3px 10px', color: 'var(--color-accent)' }}>{snap.msn}</td>
                                <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.tick}</td>
                                <td style={{ padding: '3px 10px', color: '#4a8cc8', fontWeight: 'bold' }}>{snap.fsi.toFixed(1)}</td>
                                <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.tier}</td>
                                <td style={{ padding: '3px 10px' }}>{snap.roster}</td>
                                <td style={{ padding: '3px 10px', color: '#b84040' }}>{snap.kia}</td>
                                <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.money}</td>
                                <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.food}</td>
                                <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.wood}</td>
                                <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.metal}</td>
                                <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{snap.buildings}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
