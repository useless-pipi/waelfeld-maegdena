/**
 * Rule Engine — Automated game simulator.
 *
 * Runs the full game loop without any user interaction. Every decision is
 * logged so you can review the run afterwards.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * OPTIMAL STRATEGY — Maximize FSI, Maxed Buildings, Best Equipment,
 *                    and Abundant Resources
 * ═══════════════════════════════════════════════════════════════════════
 *
 * FSI (Force Strength Index) = Σ mean(STR,DEX,CON,AWR) × (HP/maxHP)
 * for every active maiden. To maximize it: grow roster, gear up maidens,
 * improve their stats through training, and keep them healthy.
 *
 * The virtuous cycle:
 *   Hard/Extreme missions → massive resources → build upgrades + HQ gear
 *   → larger roster + stronger maidens → can tackle even harder missions
 *
 * Priority queue each tick:
 *   1. Emergency recruit   — if roster < MIN_TEAM_SIZE, recruit immediately
 *   2. Build / upgrade     — compound benefits that pay off every mission:
 *        Farm              → more food → bigger deployable teams
 *        Hospital          → maidens recover faster between missions
 *        Training Grounds  → permanent stat growth directly raises FSI
 *        Tent Block        → more beds → larger roster ceiling
 *        Radio Center      → higher HQ shop tiers (best gear in the game)
 *        Factory           → crafting capability
 *        The Meridian      → performance-based bonus resources
 *   3. Buy HQ Shop         — purchase best affordable gear (all slots)
 *   4. Full-slot equip     — weapon, body, legs, head, accessory, medal
 *   5. Roster expansion    — recruit when beds available + food surplus
 *   6. Trade (Radio Ctr)  — buy food/wood with surplus gold
 *   7. Mission selection   — hardest achievable (difficulty-first, FSI-gated):
 *        Normal:  FSI ≥ 20 (T1 normal missions can carry Q6-7 enemies)
 *        Hard:    FSI ≥ 65 (10+ enemies per stage; needs a proper force)
 *        Extreme: FSI ≥ 110 (requires fully geared, large force)
 *        Multi-stage: 2-stage needs FSI ≥ 30; 3-stage needs FSI ≥ 60
 *        Post-wipe cooldown (10 missions) after losing ≥ 4 maidens
 *   8. Deploy active − 2 reserve (HP ≥ 30%) — always keep 2 home
 *   9. Resolve all stages — full combat simulation, no animation
 *  10. Post-mission        — hospital heals, farm produces, Meridian pays
 */

import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { INITIAL_SAVE } from '../data/seed';
import { generateMissionSet as _generateMissionSet } from '../engine/missionGen';
import {
  simulateStage,
  getStat,
} from '../engine/combat';
import {
  recruitMaiden,
  makeEquipmentInstance,
  computeMaxCarryWeight,
  computeCarryWeight,
} from '../engine/recruit';
import { initializeStageEnemies, enrichEnemyGear, computeForceStrengthIndex } from '../engine/missionGen';
import type { Maiden } from '../types/maiden';
import type { Mission } from '../types/mission';
import type { Building } from '../types/building';
import type { Equipment } from '../types/equipment';
import { v4 as uuidv4 } from 'uuid';
import { HEROINE_DEFINITIONS } from '../data/heroines';
import { heroineDefToMaiden } from '../engine/recruit';
import equipmentData from '../data/equipment.json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LogEntry {
  tick: number;
  missionsCompleted: number;
  action: string;
  detail: string;
  resources: { money: number; food: number; wood: number; metal: number };
  rosterSize: number;
  level?: string; // e.g. "stage 2/3"
  outcome?: 'win' | 'loss' | 'info' | 'warn' | 'error';
}

/** 0=none, 1=low, 2=medium, 3=high */
export type Intensity = 'none' | 'low' | 'medium' | 'high';

export interface EngineSettings {
  /** How aggressively to spend gold buying HQ shop items */
  buyIntensity: Intensity;
  /** How aggressively to sell surplus/weaker inventory items for gold */
  sellIntensity: Intensity;
  /** How aggressively to spend resources crafting factory equipment */
  craftIntensity: Intensity;
  /**
   * Exploit: equip duplicate non-weapon items on the same maiden to stack
   * extra stat/HP bonuses (e.g. two helmets for double HP bonus).
   */
  equipStacking: boolean;
  /**
   * Exploit: when a maiden falls in combat, strip ALL of her equipment
   * (not just the weapon) back into inventory for reuse.
   */
  reclaimKIAGear: boolean;
}

// ── Multi-run types ───────────────────────────────────────────────────────────

/** A snapshot of game state taken every MULTI_SNAPSHOT_INTERVAL successful missions. */
export interface MultiRunSnapshot {
  /** How many successful missions had been completed when this snapshot was taken. */
  missionsCompleted: number;
  /** Simulation tick at snapshot time. */
  tick: number;
  /** Force Strength Index at snapshot time. */
  fsi: number;
  resources: { money: number; food: number; wood: number; metal: number };
  /** Every maiden (alive, captured, or KIA) with name, status, and key stats. */
  maidens: Array<{
    id: string;
    name: string;
    type: 'zako' | 'heroine';
    status: 'active' | 'captured' | 'kia' | 'escaped';
    missionCount: number;
    stats: { strength: number; dexterity: number; constitution: number; awareness: number; charm: number };
    currentHp: number;
    maxHp: number;
    equipment: Array<{ id: string; name: string; slot: string }>;
  }>;
  /** Building states (id, level, isConstructed). */
  buildings: Array<{ id: string; currentLevel: number; isConstructed: boolean }>;
  /** Inventory item counts grouped by item id. */
  inventorySummary: Record<string, number>;
}

/** Result of a single simulation attempt within a multi-run batch. */
export interface MultiRunAttempt {
  attemptIndex: number; // 0-based
  snapshots: MultiRunSnapshot[];
  /** Summary string (same as single-run onDone message). */
  summary: string;
  /** Total ticks taken for this attempt. */
  totalTicks: number;
  /** Total successful missions completed. */
  missionsCompleted: number;
}

/** Full multi-run result exported as JSON. */
export interface MultiRunResult {
  exportedAt: string;
  targetMissions: number;
  totalAttempts: number;
  settings: EngineSettings;
  snapshotInterval: number;
  attempts: MultiRunAttempt[];
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Max ticks before giving up (safety valve) */
const MAX_TICKS = 50_000;

/** How often (in successful missions) to take a multi-run snapshot. */
const MULTI_SNAPSHOT_INTERVAL = 50;

/** Minimum deployable team size before we halt missions and recruit instead. */
const MIN_TEAM_SIZE = 5;

/**
 * Beds to keep free above the current roster.
 * 4 keeps recruiting aggressive enough to grow FSI out of the Rookie tier.
 * (8 was too conservative — roster plateaued at 12 on 20 beds, FSI never
 *  reached 160 needed to unlock hard missions, causing an infinite stall.)
 */
const BED_BUFFER = 4;

/**
 * Number of maidens kept at home as a reserve (not deployed).
 * Guarantees the roster never reaches 0 even on a total stage wipe.
 */
/**
 * Number of maidens always kept home as a reserve.
 * Raised to 4: with a 12-maiden roster this means ~8 deploy instead of ~10,
 * protecting more veterans and reducing per-mission KIA, which lets FSI grow.
 */
const DEPLOY_RESERVE = 4;

/**
 * FSI floors required before accepting each difficulty tier.
 *
 * Calibrated from missionGen.ts tier table (fresh recruit ≈ avg stat 8):
 *   10 maidens → FSI  80  (Tier 1 ceiling)
 *   20 maidens → FSI 160  (Tier 3 floor — Seasoned, max enemy Q6)
 *   30 maidens → FSI 240  (Tier 4 floor — Veteran, max enemy Q8)
 *   40 maidens → FSI 320  (Tier 5 floor — Elite, max enemy Q9)
 *
 * Tier 1-2 (0-159) includes Q1-Q7 hard missions.  Unequipped maidens vs
 * Q7-rifle enemies is a guaranteed wipe regardless of headcount.
 * Only run hard once at Tier 3 (FSI 160) where enemy quality caps at Q6
 * and several missions' worth of gear rewards will have been collected.
 */
const FSI_FOR_DIFFICULTY: Record<string, number> = {
  easy:    0,
  normal:  30,
  hard:    100,  // Tier 3 — Seasoned (~13 average maidens)
  extreme: 220,  // Tier 5 — Elite   (~28 well-geared maidens)
};

/**
 * Minimum completed missions before accepting each difficulty.
 * Ensures the team has accumulated loot/gear before facing harder fights.
 */
const MIN_MISSIONS_FOR_DIFFICULTY: Record<string, number> = {
  easy:    0,
  normal:  0,
  hard:    12,  // 12 normal missions worth of gear/EXP before first hard
  extreme: 30,  // extensive campaign before extreme
};

/**
 * Max stages accepted per FSI band.
 * FSI 96 = 12 fresh maidens = Tier 2 (Trained). They can handle normal
 * 2-stage missions fine; gating at 120 caused a deadlock where the engine
 * could only run easy 1-stage skirmishes and never accumulated enough
 * resources/roster to cross the threshold.
 *
 * Thresholds calibrated to tier table:
 *   FSI  50  ≈  6 maidens  — enough for normal 2-stage
 *   FSI 200  ≈ 25 maidens  — safe for any stage count
 */
const FSI_MAX_STAGES: Array<{ minFsi: number; maxStages: number }> = [
  { minFsi: 200, maxStages: 99 },  // Tier 3+: any stage count
  { minFsi:  50, maxStages:  2 },  // 6+ maidens: 2-stage fine
  { minFsi:   0, maxStages:  1 },  // tiny force: single stage only
];

/**
 * After losing ≥ 4 maidens in one mission, stay on easy/normal for this
 * many missions while the force recovers and rebuilds.
 */
const POST_WIPE_COOLDOWN_MISSIONS = 10;

/**
 * Fraction of the entering team that, if lost in a single stage, triggers
 * an early retreat before the next stage begins.
 * 0.25 → retreat after losing 25 % or more of the stage's entering force.
 */
const STAGE_CASUALTY_RETREAT_FRAC = 0.25;

/**
 * FSI / missionMaxThreat ratio required to accept a mission in Pool 0.
 * Raised to 2.2 (was 1.8): the engine now demands a larger FSI buffer before
 * engaging, pushing more missions into safer pools and reducing casualty rate.
 */
const FSI_PER_THREAT = 2.2;

/**
 * Minimum HP fraction for deployment eligibility.
 * 30% gives a bit more flexibility than the old 35% — the hospital will
 * top them up quickly anyway.
 */
const MIN_DEPLOY_HP_FRAC = 0.30;

/**
 * Building upgrade priority — compound benefits; upgraded as soon as
 * resources allow.
 *
 *  farm            → food per mission; directly enables larger deployed teams
 *  field_hospital  → heal fraction; more maidens stay deployable
 *  training_grounds→ theory EXP every mission; permanently raises maiden stats
 *  tent_block      → bed capacity; larger roster ceiling → higher FSI cap
 *  radio_center    → HQ shop tier; higher levels unlock elite/legendary gear
 *  factory         → crafting tier
 *  the_meridian    → performance bonuses (worth most when running hard/extreme)
 */
const BUILDING_PRIORITY = [
  'farm',
  'field_hospital',
  'training_grounds',
  'tent_block',
  'radio_center',
  'factory',
  'the_meridian',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function snap(store: ReturnType<typeof useGameStore.getState>) {
  return {
    maidens: store.maidens,
    teams: store.teams,
    missions: store.missions,
    buildings: store.buildings,
    inventory: store.inventory,
    mbase: store.mbase,
    hqShopItems: store.hqShopItems ?? [],
    meridianStats: store.meridianStats,
  };
}

function activeMaidens(maidens: Maiden[]) {
  return maidens.filter(m => !m.isFallen && !m.isCaptured && m.moraleQuitStatus !== 'escaped');
}

function deployableMaidens(maidens: Maiden[]) {
  return activeMaidens(maidens).filter(m => {
    if (m.currentHp <= 0) return false;
    const maxHp = m.maxHp ?? 1;
    return m.currentHp >= maxHp * MIN_DEPLOY_HP_FRAC;
  });
}

/** Same as deployableMaidens but ignores the HP threshold (for emergency fill-up). */
function deployableMaidensAny(maidens: Maiden[]) {
  return activeMaidens(maidens).filter(m => m.currentHp > 0);
}

function maxBeds(buildings: Building[]): number {
  const b = buildings.find(b => b.id === 'tent_block');
  if (!b || !b.isConstructed) return 20;
  return b.levels[b.currentLevel - 1]?.effectValue?.beds ?? 20;
}

const DIFF_RANK: Record<string, number> = { easy: 0, normal: 1, hard: 2, extreme: 3 };

/**
 * Compute the peak enemy threat score across all stages of a mission.
 * threat = Σ(count × quality) for each zako group in the stage's template.
 * Uses the hardest stage so we gate on worst-case exposure.
 * Falls back to enemies.length × 5 when no template is present.
 */
function missionMaxThreat(m: Mission): number {
  if (!m.stages?.length) return 0;
  return Math.max(
    ...m.stages.map(s => {
      const zako = (s as any).template?.zako as Array<{ count: number; quality: number }> | undefined;
      if (zako && zako.length > 0) {
        return zako.reduce((sum, g) => sum + g.count * g.quality, 0);
      }
      return (s.enemies?.length ?? 0) * 5; // fallback: assume avg quality 5
    }),
  );
}

/**
 * Mission value score used for tiebreaking within a difficulty tier.
 * Hard/extreme missions are already preferred by difficulty-first sorting in
 * pool 0, so the diffMult here mainly separates missions of the same tier.
 * √stageCount penalty discourages very long missions when a shorter one of
 * equal difficulty is available.
 */
function missionValue(m: Mission): number {
  const r = m.reward ?? {};
  const baseVal = (r.money ?? 0) + (r.wood ?? 0) * 2 + (r.metal ?? 0) * 2 + (r.food ?? 0) * 0.5;
  const diffMult = { easy: 0.5, normal: 1.0, hard: 5.0, extreme: 20.0 }[m.difficulty] ?? 1.0;
  const stageCount = m.stages?.length ?? 1;
  return (baseVal * diffMult) / Math.sqrt(stageCount);
}

/**
 * Total "power" of an equipment item: sum of absolute bonus values across all
 * stat bonuses. Used to compare items slot-for-slot when auto-equipping.
 */
function itemPower(eq: Equipment): number {
  return (eq.bonuses ?? []).reduce((s, b) => s + Math.abs(b.value), 0);
}

/** Resolve all stages of a mission instantly (no animation). Returns outcome. */
function resolveInstant(
  mission: Mission,
  stageMaidens: Maiden[],
  store: ReturnType<typeof useGameStore.getState>,
  log: (action: string, detail: string, outcome?: LogEntry['outcome']) => void,
  settings: { reclaimKIAGear: boolean },
): { won: boolean; survivors: Maiden[]; kills: number; deaths: number; escapedIds: string[]; capturedIds: string[] } {
  let currentMaidens = [...stageMaidens];
  let totalKills = 0;
  let totalDeaths = 0;
  const allEscapedIds: string[] = [];
  const allCapturedIds: string[] = [];

  for (let si = 0; si < mission.stages.length; si++) {
    const stage = mission.stages[si];

    if (currentMaidens.length === 0) {
      log('Stage skipped', `Stage ${si + 1}/${mission.stages.length} — no survivors to continue`, 'warn');
      break;
    }

    // initializeStageEnemies returns raw enemies; enrichEnemyGear resolves equipment stubs,
    // adds faction body/leg gear, enriches tags, and computes correct maxHp — matching Missions.tsx.
    const enemies = initializeStageEnemies(stage).map(enrichEnemyGear);
    const coverLevel = (stage as any).coverLevel ?? 0;
    const result = simulateStage(currentMaidens as any[], enemies, coverLevel);

    // Apply practical EXP and permanent morale deltas — real store functions
    // (matches Missions.tsx onStageComplete)
    store.applyPracticalExpGains(result.expGains);
    store.applyMoraleGains(result.permanentMoraleDeltas);

    // Count kills
    const killedEnemies = result.updatedEnemies.filter(e => (e as any).currentHp <= 0).length;
    totalKills += killedEnemies;

    const stageWon = result.outcome === 'maiden_victory' || result.outcome === 'enemy_retreat';

    // Stage-level morale-quit events (escaped / captured)
    const stageEscaped = result.moraleEscapedIds ?? [];
    const stageCaptured = (result.moraleCapturedIds ?? []).filter(id => !stageEscaped.includes(id));
    for (const id of stageEscaped) if (!allEscapedIds.includes(id)) allEscapedIds.push(id);
    for (const id of stageCaptured) if (!allCapturedIds.includes(id)) allCapturedIds.push(id);

    if (stageEscaped.length > 0 || stageCaptured.length > 0) {
      // Mark escaped/captured in store (matches Missions.tsx applyMoraleQuitEvents)
      store.applyMoraleQuitEvents(stageEscaped, stageCaptured);
      if (stageCaptured.length > 0) {
        const existing = useGameStore.getState().missions.find(m => m.id === mission.id)?.capturedMaidenIds ?? [];
        store.setMission(mission.id, { capturedMaidenIds: [...new Set([...existing, ...stageCaptured])] });
      }
      // If stage was won, immediately rescue captured maidens (matches Missions.tsx)
      if (stageWon && stageCaptured.length > 0) {
        const teamId = useGameStore.getState().teams[0]?.id ?? '';
        store.rescueCapturedMaidens(stageCaptured, teamId);
        const afterRescue = useGameStore.getState().missions.find(m => m.id === mission.id)?.capturedMaidenIds ?? [];
        store.setMission(mission.id, { capturedMaidenIds: afterRescue.filter(id => !stageCaptured.includes(id)) });
      }
    }

    // Sync HP and handle KIA — matches Missions.tsx onSyncHP
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
        // KIA — real game: strip weapon to inventory; exploit: reclaim all non-locked gear
        const orig = stageMaidens.find(o => o.id === m.id)!;
        if (settings.reclaimKIAGear) {
          for (const eq of orig.equipment.filter(e => !e.isLocked)) store.addInventoryItem(eq);
          store.setMaiden(m.id, { currentHp: 0, isFallen: true, isDeployed: false, equipment: [] });
        } else {
          // Default (matches Missions.tsx): always strip weapon, no isLocked check
          const weapon = orig.equipment.find(e => e.slot === 'weapon');
          const equipWithoutWeapon = orig.equipment.filter(e => e.slot !== 'weapon');
          if (weapon) store.addInventoryItem(weapon);
          store.setMaiden(m.id, { currentHp: 0, isFallen: true, isDeployed: false, equipment: equipWithoutWeapon });
        }
      } else {
        store.setMaiden(m.id, { currentHp: m.currentHp });
      }
    }

    log(
      `Stage ${si + 1}/${mission.stages.length}`,
      `${stageWon ? '\u2705' : '\u274c'} ${result.outcome} | maidens: ${currentMaidens.length} | enemies: ${enemies.length} | KIA: ${fallen.length} | escaped: ${stageEscaped.length} | captured: ${stageCaptured.length} | kills: ${killedEnemies}`,
      stageWon ? 'info' : 'warn',
    );

    if (!stageWon) break;

    const stageSurvivors = updated.filter(m => m.currentHp > 0 && !removedFromField.has(m.id));
    currentMaidens = stageSurvivors;

    // Between-stage retreat — trigger if EITHER:
    //  a) fewer than MIN_TEAM_SIZE survivors remain, OR
    //  b) this stage wiped out ≥ STAGE_CASUALTY_RETREAT_FRAC of the entering force
    if (si < mission.stages.length - 1) {
      const casualtyFrac = fallen.length / Math.max(1, currentMaidens.length + fallen.length);
      const tooFewSurvivors = currentMaidens.length < MIN_TEAM_SIZE;
      const heavyCasualties = casualtyFrac >= STAGE_CASUALTY_RETREAT_FRAC;
      if (tooFewSurvivors || heavyCasualties) {
        const reason = tooFewSurvivors
          ? `Only ${currentMaidens.length} survivors`
          : `${fallen.length}/${fallen.length + currentMaidens.length} KIA (${(casualtyFrac * 100).toFixed(0)}% losses)`;
        log(
          `Stage ${si + 1}/${mission.stages.length} — early retreat`,
          `${reason} — retreating to preserve the force.`,
          'warn',
        );
        break;
      }
    }

    if (si === mission.stages.length - 1) {
      return { won: true, survivors: currentMaidens, kills: totalKills, deaths: totalDeaths, escapedIds: allEscapedIds, capturedIds: allCapturedIds };
    }
  }

  return { won: false, survivors: currentMaidens, kills: totalKills, deaths: totalDeaths, escapedIds: allEscapedIds, capturedIds: allCapturedIds };
}

// ── Strategy functions ───────────────────────────────────────────────────────

/** Pick the best mission: highest value/risk for the current team strength */
function pickBestMission(
  missions: Mission[],
  maidens: Maiden[],
  wipeCooldownRemaining: number,
  missionsCompleted: number,
  hasCapturedMaidens: boolean,
  mbase: { food: number; wood: number; metal: number; money: number },
): Mission | null {
  const available = missions.filter(m => !m.isCompleted);
  if (available.length === 0) return null;

  const { fsi } = computeForceStrengthIndex(maidens);

  // Determine max stages we'll accept at this FSI level
  const maxStagesAllowed = FSI_MAX_STAGES.find(r => fsi >= r.minFsi)?.maxStages ?? 1;

  /** True when both FSI AND missions-completed gates are satisfied for this difficulty */
  const diffOk = (diff: string) =>
    fsi >= (FSI_FOR_DIFFICULTY[diff] ?? 0) &&
    missionsCompleted >= (MIN_MISSIONS_FOR_DIFFICULTY[diff] ?? 0);

  /** True when the mission's worst-case enemy threat is within our FSI budget */
  const threatOk = (m: Mission) => fsi >= missionMaxThreat(m) * FSI_PER_THREAT;

  /**
   * Priority score for rewardFocus — context-sensitive bonuses:
   *  rescue      — top priority whenever we have captured maidens (+1000)
   *  supply_run  — high priority when food is dangerously low (+500)
   *  gold_heavy  — slight bonus (gold is always useful) (+50)
   *  salvage     — bonus when metal/wood are low (+30)
   *  training    — small constant bonus for EXP gain (+10)
   *  balanced    — neutral (0)
   *  medal       — slightly deprioritised unless nothing better (0)
   */
  const focusScore = (m: Mission): number => {
    switch (m.rewardFocus) {
      case 'rescue':     return hasCapturedMaidens ? 1000 : 200;
      case 'supply_run': return mbase.food < 50 ? 500 : 20;
      case 'gold_heavy': return 50;
      case 'salvage':    return (mbase.wood < 30 || mbase.metal < 30) ? 80 : 10;
      case 'training':   return 10;
      default:           return 0;
    }
  };

  // Four progressively looser pools — each drops one safety constraint.
  // IMPORTANT: we NEVER relax the FSI+missions gate for hard/extreme.
  // If the only available missions are hard/extreme and we're not ready,
  // we return null (skip this tick and keep building / recruiting).
  const pools = [
    // Pool 0: fully safe — all gates active
    available.filter(m => {
      if (!diffOk(m.difficulty)) return false;
      if (wipeCooldownRemaining > 0 && (m.difficulty === 'hard' || m.difficulty === 'extreme')) return false;
      if ((m.stages?.length ?? 1) > maxStagesAllowed) return false;
      if (!threatOk(m)) return false;
      return true;
    }),
    // Pool 1: drop wipe-cooldown restriction
    available.filter(m => {
      if (!diffOk(m.difficulty)) return false;
      if ((m.stages?.length ?? 1) > maxStagesAllowed) return false;
      if (!threatOk(m)) return false;
      return true;
    }),
    // Pool 2: drop threat check (still respect FSI+missions gate + stage count)
    available.filter(m => {
      if (!diffOk(m.difficulty)) return false;
      if ((m.stages?.length ?? 1) > maxStagesAllowed) return false;
      return true;
    }),
    // Pool 3: drop stage-count gate (still respect FSI+missions gate)
    available.filter(m => diffOk(m.difficulty)),
    // Pool 4: last resort before absolute fallback — easy/normal only, regardless of other gates.
    // This prevents the engine from running hard/extreme at FSI 30 when normal missions are exhausted.
    available.filter(m => m.difficulty === 'easy' || m.difficulty === 'normal'),
    // Pool 5: absolute last resort — any non-completed mission. Only reached if the entire available
    // pool contains exclusively hard/extreme missions AND the above pools were all empty. Better to
    // run something than idle forever, but this should be extremely rare after the idleStreak refresh.
    available,
  ];

  for (let pi = 0; pi < pools.length; pi++) {
    const pool = pools[pi];
    if (pool.length === 0) continue;
    // Sort: difficulty first, then focusScore (context-aware type priority), then raw value
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

/** Pick the best N maidens for deployment by combat power.
 *  Always leaves DEPLOY_RESERVE maidens at home so a total wipe can't
 *  zero out the roster (unless the entire force is below MIN_TEAM_SIZE).
 */
function pickBestTeam(maidens: Maiden[], size: number): Maiden[] {
  let pool = deployableMaidens(maidens);
  // If not enough healthy maidens, fall back to anyone with >0 HP
  if (pool.length < MIN_TEAM_SIZE) pool = deployableMaidensAny(maidens);
  // Sort best → worst so we can just slice from the front
  const sorted = pool.sort((a, b) => {
    const pa = getStat(a, 'strength') + getStat(a, 'dexterity') + getStat(a, 'constitution');
    const pb = getStat(b, 'strength') + getStat(b, 'dexterity') + getStat(b, 'constitution');
    return pb - pa;
  });
  // Keep DEPLOY_RESERVE maidens at home, but never reduce below MIN_TEAM_SIZE
  const maxDeploy = Math.max(MIN_TEAM_SIZE, sorted.length - DEPLOY_RESERVE);
  return sorted.slice(0, Math.min(size, maxDeploy));
}

/** Estimated food cost to deploy a team */
function foodCost(team: Maiden[]): number {
  return team.reduce((s, m) => s + 20 + getStat(m, 'strength'), 0);
}

/** Find the next affordable building to upgrade */
function pickBuildingUpgrade(
  buildings: Building[],
  mbase: { money: number; wood: number; metal: number },
): Building | null {
  // Metal overflow: if metal is hoarding above 3000 and the_meridian is unbuilt, build it now
  // rather than letting metal sit permanently unused.
  if (mbase.metal > 3000) {
    const meridian = buildings.find(b => b.id === 'the_meridian');
    if (meridian && !meridian.isConstructed) {
      const level = meridian.levels[0];
      if (level &&
          (level.costMoney ?? 0) <= mbase.money &&
          (level.costWood  ?? 0) <= mbase.wood  &&
          (level.costMetal ?? 0) <= mbase.metal) {
        return meridian;
      }
    }
  }

  for (const bid of BUILDING_PRIORITY) {
    const b = buildings.find(x => x.id === bid);
    if (!b) continue;
    const notBuiltYet = !b.isConstructed;
    const atMax = b.isConstructed && b.currentLevel >= b.maxLevel;
    if (atMax) continue;

    const level = notBuiltYet
      ? b.levels[0]
      : b.levels[b.currentLevel]; // next level (0-indexed array)
    if (!level) continue;

    if ((level.costMoney ?? 0) <= mbase.money &&
        (level.costWood ?? 0) <= mbase.wood &&
        (level.costMetal ?? 0) <= mbase.metal) {
      return b;
    }
  }
  return null;
}

/** Auto-equip: give every deployable maiden the best available item for every
 *  equippable slot from inventory.  Covers weapon, body, legs, head, accessory,
 *  and medal — not just weapons.
 *
 *  Algorithm: for each slot, iterate items best→worst and assign each to the
 *  maiden who gains the most (largest itemPower delta).  Local pool/inventory
 *  state is updated after each assignment so we never double-assign.
 */
function autoEquip(
  maidens: Maiden[],
  inventory: Equipment[],
  store: ReturnType<typeof useGameStore.getState>,
): string[] {
  const acted: string[] = [];
  const EQUIPPABLE_SLOTS = ['weapon', 'body', 'legs', 'head', 'accessory', 'medal'];

  // Mutable local inventory (only non-locked, non-enemy items)
  const avail = inventory.filter(eq => !eq.isLocked && eq.faction !== 'enemy');

  // Mutable local copy of the maiden pool with current equipment tracked
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
        // Use the best-powered item already in this slot (handles stacked duplicates)
        const cur = m.equipment
          .filter(e => e.slot === slot)
          .sort((a, b) => itemPower(b) - itemPower(a))[0];
        const curPow = cur ? itemPower(cur) : 0;
        const gain = itemPower(item) - curPow;
        if (gain > bestGain) {
          bestGain = gain;
          bestMaiden = m;
          bestMaidenCurItem = cur;
        }
      }

      if (bestMaiden && bestGain > 0) {
        const pIdx = pool.findIndex(m => m.id === bestMaiden!.id);

        // For non-weapon slots, unequip the existing item first so its weight is freed
        // and the maiden never accumulates duplicate items in the same slot.
        let unequippedItem: Equipment | undefined;
        if (slot !== 'weapon' && bestMaidenCurItem) {
          store.unequipItem(bestMaiden.id, bestMaidenCurItem);
          unequippedItem = bestMaidenCurItem;
          if (pIdx !== -1) {
            pool[pIdx].equipment = pool[pIdx].equipment.filter(e => e !== bestMaidenCurItem);
          }
        }

        store.equipItem(bestMaiden.id, item, null);

        // Verify the equip actually worked — store.equipItem silently returns early if
        // the item is still over the maiden's carry weight after the unequip.
        const freshInv = useGameStore.getState().inventory;
        const equipBlocked = freshInv.some(e =>
          item.inventoryId ? e.inventoryId === item.inventoryId : e.id === item.id
        );
        if (equipBlocked) {
          // Restore the old item if we already unequipped it
          if (unequippedItem) {
            const restored = freshInv.find(e =>
              unequippedItem!.inventoryId
                ? e.inventoryId === unequippedItem!.inventoryId
                : e.id === unequippedItem!.id
            );
            if (restored) store.equipItem(bestMaiden.id, restored, null);
          }
          continue;
        }

        acted.push(`${bestMaiden.name}[${slot}] ← ${item.name}`);

        // Update local pool so next iterations see correct equipment
        if (pIdx !== -1) {
          pool[pIdx].equipment = [
            ...pool[pIdx].equipment.filter(e => e.slot !== slot),
            item,
          ];
        }

        // Remove item from local available list
        const invIdx = avail.findIndex(e => e.inventoryId === item.inventoryId);
        if (invIdx !== -1) avail.splice(invIdx, 1);
      }
    }
  }
  return acted;
}



/**
 * Effective carry capacity of a maiden (lbs) — matches the formula in store.equipItem:
 * base STR + sum of STR bonuses from currently equipped items.
 * Uses the real engine functions computeMaxCarryWeight / computeCarryWeight.
 */
function maidenCarryCapacity(m: Maiden): number {
  const strBonus = m.equipment.reduce(
    (sum, e) => sum + e.bonuses.filter(b => b.stat === 'strength').reduce((s, b) => s + b.value, 0),
    0,
  );
  return computeMaxCarryWeight((m.stats.strength ?? 0) + strBonus);
}

/** Total weight of a maiden's currently equipped items. Uses the real engine function. */
function maidenUsedWeight(m: Maiden): number {
  return computeCarryWeight(m.equipment);
}

/**
 * Returns true when `item` would be genuinely useful for maiden `m`:
 *   1. The item is actually better (higher power) than what she currently has
 *      equipped in that slot, OR the slot is empty.
 *   2. No unequipped inventory item already covers that slot equally well or better
 *      (so we don't spend resources on something we'd get for free from autoEquip).
 *   3. She has enough carry capacity remaining to hold the new item (weight check).
 */
function maidenNeedsItem(m: Maiden, item: Equipment, inventory: Equipment[]): boolean {
  const cur = m.equipment.find(e => e.slot === item.slot);
  const newPow = itemPower(item);

  // Upgrade check: must be strictly better than what's already equipped
  if (cur && itemPower(cur) >= newPow) return false;

  // Inventory coverage: does the maiden already have access to something
  // this good or better in that slot sitting in inventory (free via autoEquip)?
  const inventoryBest = inventory
    .filter(e => e.slot === item.slot && e.faction !== 'enemy')
    .reduce((best, e) => Math.max(best, itemPower(e)), 0);
  if (inventoryBest >= newPow) return false;

  // Weight check: total current weight + new item weight ≤ carry capacity
  // Uses the same effective-strength formula as store.equipItem.
  if (item.weight) {
    if (maidenUsedWeight(m) + item.weight > maidenCarryCapacity(m)) return false;
  }

  return true;
}

/**
 * Try to craft the best available factory equipment that would upgrade at
 * least one maiden's slot.  Craft threshold scales with intensity:
 *   low    — only craft if we have > 3× the cost in each resource
 *   medium — craft if we have > 2× the cost in each resource
 *   high   — craft any time we can afford it
 */
function tryCraftEquipment(
  intensity: Intensity,
  store: ReturnType<typeof useGameStore.getState>,
  stackingEnabled = false,
): string | null {
  if (intensity === 'none') return null;
  const factory = store.buildings.find(b => b.id === 'factory');
  if (!factory?.isConstructed) return null;
  const factoryTier = factory.levels[factory.currentLevel - 1]?.effectValue?.tier ?? 1;
  const mb = store.mbase;
  const deployable = deployableMaidens(store.maidens);
  if (deployable.length === 0) return null;

  // Resolve craftable items for this factory tier, sorted best → worst
  const craftables = (equipmentData as Equipment[])
    .filter(eq => eq.craftable && (eq as any).craftTier <= factoryTier)
    .sort((a, b) => itemPower(b) - itemPower(a));

  const reserve = intensity === 'high' ? 1 : intensity === 'medium' ? 2 : 3;

  for (const eq of craftables) {
    const cost = (eq as any).craftCost as { money: number; wood: number; metal: number };
    if (!cost) continue;
    // Resource check with reserve multiplier
    if (mb.money < (cost.money ?? 0) * reserve) continue;
    if (mb.wood  < (cost.wood  ?? 0) * reserve) continue;
    if (mb.metal < (cost.metal ?? 0) * reserve) continue;

    let wouldHelp: boolean;
    if (stackingEnabled && eq.slot !== 'weapon') {
      // Stacking mode: craft if any maiden still has weight room for this item
      wouldHelp = deployable.some(m => {
        const room = maidenCarryCapacity(m) - maidenUsedWeight(m);
        return room >= Math.max(eq.weight ?? 0, 1);
      });
    } else {
      // Normal mode: only craft if it's a genuine upgrade
      wouldHelp = deployable.some(m => maidenNeedsItem(m, eq, store.inventory));
    }
    if (!wouldHelp) continue;

    store.craftEquipment(eq.id);
    return `Craft: made ${eq.name} [${eq.slot}] costing ${cost.wood ?? 0}🪵 + ${cost.metal ?? 0}⚙️`;
  }
  return null;
}

/**
 * Sell surplus inventory items that no maiden needs.
 * Sell threshold scales with intensity:
 *   low    — only sell items whose slot is already covered by something better for EVERY maiden
 *   medium — sell any item weaker than what every maiden currently has equipped in that slot
 *   high   — sell all unequipped, non-locked items below the top-3 power in their slot
 */
function trySellEquipment(
  maidens: Maiden[],
  inventory: Equipment[],
  intensity: Intensity,
  store: ReturnType<typeof useGameStore.getState>,
): string | null {
  if (intensity === 'none') return null;
  const sellable = inventory.filter(eq => !eq.isLocked && eq.faction !== 'enemy');
  if (sellable.length === 0) return null;

  // Build per-slot equipped power stats across ALL maidens
  const deployable = deployableMaidens(maidens);
  const slotMinPower: Record<string, number> = {}; // worst-equipped maiden's power in slot (low threshold)
  const slotMaxPower: Record<string, number> = {}; // best-equipped maiden's power in slot (medium threshold)
  for (const m of deployable) {
    for (const eq of m.equipment) {
      const p = itemPower(eq);
      slotMinPower[eq.slot] = Math.min(slotMinPower[eq.slot] ?? Infinity, p);
      slotMaxPower[eq.slot] = Math.max(slotMaxPower[eq.slot] ?? 0, p);
    }
  }
  // Best power in inventory per slot (top-3 keeps)
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
      // Sell only if strictly weaker than the worst-equipped maiden's slot power
      // (keeps items that could upgrade at least one maiden)
      const minEquipped = slotMinPower[eq.slot] ?? 0;
      if (pow >= minEquipped) continue;
    } else if (intensity === 'medium') {
      // Sell if weaker than the best-equipped maiden's slot power
      // (keeps items only if they could be an upgrade for someone)
      const maxEquipped = slotMaxPower[eq.slot] ?? 0;
      if (pow >= maxEquipped) continue;
    } else {
      // high: sell if not in the top-3 power items for this slot in inventory
      const top3 = (slotTopPowers[eq.slot] ?? []).slice(0, Math.max(3, deployable.length));
      if (top3.includes(pow) && top3.indexOf(pow) < deployable.length) continue;
    }
    const price = Math.floor((eq.price ?? 0) * 0.5);
    if (price <= 0) continue;
    store.sellEquipment(eq.inventoryId);
    return `Sold ${eq.name} [${eq.slot}] for ${price}💰`;
  }
  return null;
}

/**
 * Try to purchase the best affordable HQ Shop item that upgrades at least one
 * deployable maiden's equipment.  Returns a log string on success, null if
 * nothing was bought.
 *
 * Only called when no building upgrade is currently affordable — buildings
 * always take priority because they compound across every future mission.
 */
function tryBuyHQItem(
  maidens: Maiden[],
  hqShopItemIds: string[],
  intensity: Intensity,
  store: ReturnType<typeof useGameStore.getState>,
  stackingEnabled = false,
): string | null {
  if (intensity === 'none') return null;
  if (hqShopItemIds.length === 0) return null;
  const mb = store.mbase;
  const deployable = deployableMaidens(maidens);
  if (deployable.length === 0) return null;

  // reserve multiplier: keep more gold in reserve at lower intensities
  const reserve = intensity === 'high' ? 1 : intensity === 'medium' ? 1.5 : 2.5;

  // Resolve item templates via makeEquipmentInstance (already imported)
  const shopItems = hqShopItemIds
    .map(id => { try { return makeEquipmentInstance(id); } catch { return null; } })
    .filter(Boolean) as Equipment[];

  // Sort best → worst so we always buy the most impactful item first
  shopItems.sort((a, b) => itemPower(b) - itemPower(a));

  for (const item of shopItems) {
    const price = item.price ?? 0;
    const extraWood  = (item as any).hqExtraCost?.wood  ?? 0;
    const extraMetal = (item as any).hqExtraCost?.metal ?? 0;
    if (mb.money < price * reserve || mb.wood < extraWood || mb.metal < extraMetal) continue;

    let wouldHelp: boolean;
    if (stackingEnabled && item.slot !== 'weapon') {
      // Stacking mode: buy if any maiden has weight room for one more of this item
      wouldHelp = deployable.some(m => {
        const room = maidenCarryCapacity(m) - maidenUsedWeight(m);
        return room >= Math.max(item.weight ?? 0, 1);
      });
    } else {
      // Normal mode: only buy if it's a genuine upgrade
      wouldHelp = deployable.some(m => maidenNeedsItem(m, item, store.inventory));
    }
    if (!wouldHelp) continue;

    store.buyHQEquipment(item.id);
    return `HQ Shop: bought ${item.name} [${item.slot}] for ${price}💰${extraWood ? ` + ${extraWood}🪵` : ''}${extraMetal ? ` + ${extraMetal}⚙️` : ''}`;
  }
  return null;
}

/**
 * Equip stacking exploit: allow a maiden to equip multiple items of the
 * same NON-WEAPON slot, stacking all their bonuses.  Only activates when
 * the equipStacking exploit is enabled in EngineSettings.
 *
 * For each non-weapon slot, assigns surplus items from inventory to any
 * maiden who has no item in that slot (or an extra slot assignment).
 * Implementation: adds extra equipment entries with unique inventoryIds.
 */
function autoEquipStacking(
  _maidens: Maiden[],
  inventory: Equipment[],
  store: ReturnType<typeof useGameStore.getState>,
): string[] {
  const acted: string[] = [];
  const NON_WEAPON_SLOTS = ['body', 'legs', 'head', 'accessory', 'medal'];

  // Mutable available pool (inventory items that can be stacked)
  const avail = inventory
    .filter(eq => !eq.isLocked && eq.faction !== 'enemy' && NON_WEAPON_SLOTS.includes(eq.slot))
    .sort((a, b) => itemPower(b) - itemPower(a));

  // Mutable per-maiden weight tracker — uses the same effective-strength formula as store.equipItem
  const pool = deployableMaidens(store.maidens).map(m => ({
    id: m.id,
    name: m.name,
    usedWeight: maidenUsedWeight(m),
    capacity: maidenCarryCapacity(m),
  }));

  // Greedily assign: for each item in inventory (best-first), find the maiden
  // with the most remaining capacity who can still carry it.  Keep going until
  // no more assignments are possible.
  let assigned = true;
  while (assigned && avail.length > 0) {
    assigned = false;
    for (let i = 0; i < avail.length; i++) {
      const item = avail[i];
      const itemWeight = item.weight ?? 0;

      // Find the maiden with the most spare capacity who fits this item
      let bestMaiden: (typeof pool)[0] | null = null;
      let bestRoom = 0;
      for (const m of pool) {
        const room = m.capacity - m.usedWeight;
        if (room >= Math.max(itemWeight, 1) && room > bestRoom) {
          bestRoom = room;
          bestMaiden = m;
        }
      }
      if (!bestMaiden) continue;

      store.equipItem(bestMaiden.id, item, null);
      acted.push(`[stack] ${bestMaiden.name} +${item.name} (${bestMaiden.usedWeight + itemWeight}/${bestMaiden.capacity}lbs)`);

      // Update local weight tracker
      bestMaiden.usedWeight += itemWeight;
      // Remove used item from available pool
      avail.splice(i, 1);
      assigned = true;
      break; // restart loop so best-power sort is re-evaluated
    }
  }
  return acted;
}

// ── Main simulation ───────────────────────────────────────────────────────────

function runSimulation(
  targetMissions: number,
  settings: EngineSettings,
  onLog: (entry: LogEntry) => void,
  onDone: (summary: string) => void,
) {
  let tick = 0;
  let missionsCompleted = 0;
  let wipeCooldown = 0;
  let idleStreak = 0; // consecutive ticks where no mission was found

  function mkLog(action: string, detail: string, outcome: LogEntry['outcome'] = 'info') {
    const s = useGameStore.getState();
    const entry: LogEntry = {
      tick,
      missionsCompleted,
      action,
      detail,
      outcome,
      resources: {
        money: s.mbase.money ?? 0,
        food: s.mbase.food ?? 0,
        wood: s.mbase.wood ?? 0,
        metal: s.mbase.metal ?? 0,
      },
      rosterSize: activeMaidens(s.maidens).length,
    };
    onLog(entry);
  }

  function runChunk() {
    const CHUNK = 200;
    let i = 0;
    while (i < CHUNK && tick < MAX_TICKS && missionsCompleted < targetMissions) {
      tick++;
      i++;

      const store = useGameStore.getState();
      const { maidens, missions, buildings, mbase } = snap(store);

      // ── 0. Refresh missions if pool is empty ──────────────────────────────
      if (missions.filter(m => !m.isCompleted).length === 0) {
        store.refreshMissions();
        mkLog('Refresh missions', 'Mission pool exhausted — regenerated.');
        continue;
      }

      // ── 1. Emergency recruit ───────────────────────────────────────────────
      // Always ensure we have at least MIN_TEAM_SIZE maidens before anything else.
      const active = activeMaidens(maidens).length;
      if (active < MIN_TEAM_SIZE) {
        const nm = recruitMaiden(maidens);
        store.addMaiden(nm);
        mkLog('Recruit', `Emergency recruit: ${nm.name} (roster now ${active + 1})`, 'warn');
        continue;
      }

      // ── 2. Build / upgrade ─────────────────────────────────────────────────
      // Buildings compound — every mission benefits from a higher-level farm,
      // hospital, training grounds, etc.  Upgrade as soon as affordable.
      const upgrade = pickBuildingUpgrade(buildings, mbase);
      if (upgrade) {
        const notBuilt = !upgrade.isConstructed;
        const nextLvIdx = notBuilt ? 0 : upgrade.currentLevel;
        const lvDef = upgrade.levels[nextLvIdx];
        const newLevel = notBuilt ? 1 : upgrade.currentLevel + 1;
        store.setBuilding(upgrade.id, {
          isConstructed: true,
          currentLevel: newLevel,
        });
        store.setMBase({
          money: mbase.money - (lvDef.costMoney ?? 0),
          wood:  mbase.wood  - (lvDef.costWood  ?? 0),
          metal: mbase.metal - (lvDef.costMetal ?? 0),
        });
        // Tent Block: sync mbase.beds capacity after upgrade — matches Buildings.tsx upgrade()
        if (upgrade.id === 'tent_block') {
          const newLevelDef = upgrade.levels[newLevel - 1];
          const beds = newLevelDef?.effectValue?.beds;
          if (beds) store.setMBase({ beds });
        }
        mkLog(
          'Build',
          `${notBuilt ? 'Constructed' : 'Upgraded'} ${upgrade.id} → Lv ${notBuilt ? 1 : upgrade.currentLevel + 1}`,
          'info',
        );
        continue;
      }

      // ── 3–4. Equipment management (buy / craft / sell / equip) ───────────
      // All equipment steps are FREE ACTIONS executed in a single tick so that
      // the engine never spins buying→selling→crafting without running missions.
      {
        const equipLogs: string[] = [];
        let st = useGameStore.getState();

        // 3a. Buy from HQ Shop
        const radioBuilt = st.buildings.find(b => b.id === 'radio_center')?.isConstructed ?? false;
        if (radioBuilt && settings.buyIntensity !== 'none') {
          let bought: string | null;
          st = useGameStore.getState();
          while ((bought = tryBuyHQItem(st.maidens, st.hqShopItems ?? [], settings.buyIntensity, st, settings.equipStacking)) !== null) {
            equipLogs.push(bought);
            st = useGameStore.getState();
          }
        }

        // 3b. Craft from Factory
        if (settings.craftIntensity !== 'none') {
          let crafted: string | null;
          st = useGameStore.getState();
          while ((crafted = tryCraftEquipment(settings.craftIntensity, st, settings.equipStacking)) !== null) {
            equipLogs.push(crafted);
            st = useGameStore.getState();
          }
        }

        // 3c. Sell surplus equipment (run once — avoid buy/sell loop)
        if (settings.sellIntensity !== 'none') {
          st = useGameStore.getState();
          const sold = trySellEquipment(st.maidens, st.inventory, settings.sellIntensity, st);
          if (sold) equipLogs.push(sold);
        }

        // 4. Full-slot auto-equip
        st = useGameStore.getState();
        const equipped = autoEquip(st.maidens, st.inventory, st);
        if (equipped.length > 0) equipLogs.push(...equipped.map(e => `Equip: ${e}`));

        // 4b. Equip stacking exploit
        if (settings.equipStacking) {
          st = useGameStore.getState();
          const stacked = autoEquipStacking(st.maidens, st.inventory, st);
          if (stacked.length > 0) equipLogs.push(...stacked.map(e => `Stack: ${e}`));
        }

        if (equipLogs.length > 0) {
          mkLog('Equip/Gear', equipLogs.join(' | '), 'info');
        }
      }

      // ── 5. Roster expansion ────────────────────────────────────────────────
      // Recruit when beds are available and food supply is comfortable.
      // Larger roster → more maidens deployed → higher FSI + more combat power.
      {
        const st = useGameStore.getState();
        const beds = maxBeds(st.buildings);
        const activeNow = activeMaidens(st.maidens).length;
        const recruitCap = beds - BED_BUFFER;
        const deployable = deployableMaidens(st.maidens);
        const teamCost = deployable.length > 0 ? foodCost(deployable) : 0;
        if (activeNow < recruitCap && st.mbase.food > teamCost) {
          const nm = recruitMaiden(st.maidens);
          store.addMaiden(nm);
          mkLog('Recruit', `Recruited ${nm.name} (${activeNow + 1}/${beds} beds)`, 'info');
          continue;
        }
      }

      // ── 6. Trade gold → food / wood when short ────────────────────────────
      // Radio Center enables gold→resource trading: 2💰=1🍖, 4💰=1🪵.
      // Buy food if dangerously low; buy wood if just short of a building.
      {
        const st = useGameStore.getState();
        const mb = st.mbase;
        const radioBuilt = st.buildings.find(b => b.id === 'radio_center')?.isConstructed ?? false;
        if (radioBuilt) {
          const FOOD_RATE = 2;
          const WOOD_RATE = 4;
          const deployable = deployableMaidens(st.maidens);
          const teamCost = deployable.length > 0 ? foodCost(deployable) : 0;

          // Food: buy if food < 1 team cost and we have spare gold (keep ≥100 reserve)
          if (mb.food < teamCost && mb.money > 200) {
            const toBuy = Math.min(
              Math.floor((mb.money - 100) / FOOD_RATE),
              teamCost * 3 - mb.food,
            );
            if (toBuy > 0) {
              useGameStore.getState().setMBase({ money: mb.money - toBuy * FOOD_RATE, food: mb.food + toBuy });
              mkLog('Trade', `Bought ${toBuy} 🍖 for ${toBuy * FOOD_RATE}💰 (Radio Center)`, 'info');
              continue;
            }
          }

          // Wood: buy if just short of the next building upgrade's wood cost
          const nextUp = pickBuildingUpgrade(
            st.buildings,
            { ...mb, wood: mb.wood + 50 }, // hypothetically 50 more wood
          );
          if (nextUp) {
            const lvIdx = nextUp.isConstructed ? nextUp.currentLevel : 0;
            const lv = nextUp.levels[lvIdx];
            const woodNeeded = (lv?.costWood ?? 0) - mb.wood;
            if (woodNeeded > 0 && woodNeeded <= 50 && mb.money >= woodNeeded * WOOD_RATE + 100) {
              const cost = woodNeeded * WOOD_RATE;
              useGameStore.getState().setMBase({ money: mb.money - cost, wood: mb.wood + woodNeeded });
              mkLog('Trade', `Bought ${woodNeeded}🪵 for ${cost}💰 to unlock ${nextUp.id} upgrade`, 'info');
              continue;
            }
          }
        }
      }

      // ── 7. Food crisis check ───────────────────────────────────────────────
      // If we can't feed even a tiny team, log a warning and try to run with
      // whatever maidens we can afford to feed.  The farm will produce after
      // the next mission — we just need to get one mission done.
      const freshMaidens7 = useGameStore.getState().maidens;
      const fullTeam = pickBestTeam(freshMaidens7, deployableMaidens(freshMaidens7).length);
      const neededFood = foodCost(fullTeam);
      let deployTeam = fullTeam;
      if (useGameStore.getState().mbase.food < neededFood) {
        // Shrink team until we can feed them
        let shrunk = [...fullTeam];
        while (shrunk.length > 1 && foodCost(shrunk) > useGameStore.getState().mbase.food) {
          shrunk.pop();
        }
        if (foodCost(shrunk) > useGameStore.getState().mbase.food && shrunk.length <= 1) {
          mkLog('Food crisis', `Only ${useGameStore.getState().mbase.food} food — farm will produce after next mission.`, 'warn');
          // Force-run with 1 maiden on smallest available mission to trigger farm
          deployTeam = shrunk.length > 0 ? shrunk : fullTeam.slice(0, 1);
        } else {
          deployTeam = shrunk;
        }
      }

      // ── 8. Pick mission ────────────────────────────────────────────────────
      {
        const st8 = useGameStore.getState();
        const freshMissions = st8.missions;
        const hasCaptured = st8.maidens.some(m => m.isCaptured && !m.isFallen);
        const mission8 = pickBestMission(freshMissions, st8.maidens, wipeCooldown, missionsCompleted, hasCaptured, st8.mbase);
        if (!mission8) {
          idleStreak++;
          if (idleStreak >= 5) {
            mkLog('Idle', `Stuck for ${idleStreak} consecutive ticks with no valid mission — force-refreshing and resetting streak.`, 'warn');
            store.refreshMissions();
            idleStreak = 0;
          } else {
            mkLog('Idle', `No suitable missions — refreshing pool (streak: ${idleStreak}).`, 'warn');
            store.refreshMissions();
          }
          continue;
        }
        idleStreak = 0;
        // reassign to outer `mission` variable used below — done via block re-scope trick
        var missionPicked = mission8;
      }
      const mission = (missionPicked as Mission);

      // ── 9. Assemble team ───────────────────────────────────────────────────
      if (deployTeam.length < 1) {
        mkLog('Idle', `No deployable maidens — recruiting.`, 'warn');
        const nm = recruitMaiden(useGameStore.getState().maidens);
        store.addMaiden(nm);
        continue;
      }
      if (deployTeam.length < MIN_TEAM_SIZE) {
        mkLog('Small team', `Only ${deployTeam.length} maiden(s) deployable — running anyway (food crisis).`, 'warn');
      }

      // ── 10. Consume food ───────────────────────────────────────────────────
      let remainingFood = useGameStore.getState().mbase.food ?? 0;
      const leader = deployTeam.reduce(
        (best, m) => getStat(m, 'strategy') > getStat(best, 'strategy') ? m : best,
        deployTeam[0],
      );
      const ordered = [leader, ...deployTeam.filter(m => m.id !== leader.id)];

      const fedTeam = ordered.map(m => {
        const cost2 = 20 + getStat(m, 'strength');
        if (remainingFood >= cost2) {
          remainingFood -= cost2;
          return m;
        } else {
          remainingFood = 0;
          const perm = m.moralePermanentBonus ?? 0;
          store.setMaiden(m.id, { moralePermanentBonus: perm - 3 });
          return { ...m, isStarved: true, currentHp: Math.max(1, Math.floor(m.currentHp / 2)) };
        }
      });
      store.setMBase({ food: remainingFood });

      mkLog(
        'Mission start',
        `"${mission.name}" [${mission.difficulty}] | ${fedTeam.length} maidens | ${mission.stages.length} stage(s) | food left: ${remainingFood}`,
        'info',
      );

      // ── 11. Resolve mission stage by stage ─────────────────────────────────
      // resolveInstant calls the real store functions per stage (applyPracticalExpGains,
      // applyMoraleGains, applyMoraleQuitEvents, setMaiden HP/KIA sync) matching Missions.tsx.
      const { won, survivors, kills, deaths, escapedIds, capturedIds } = resolveInstant(
        mission,
        fedTeam,
        useGameStore.getState(),
        (action, detail, outcome) => mkLog(action, detail, outcome),
        { reclaimKIAGear: settings.reclaimKIAGear },
      );

      // Log morale-quit events (HP sync, morale events, KIA handling already applied per stage)
      if (capturedIds.length > 0) mkLog('Captured', `${capturedIds.length} maiden(s) captured by enemy`, 'warn');
      if (escapedIds.length > 0) mkLog('Escaped', `${escapedIds.length} maiden(s) fled the battlefield`, 'warn');

      // Post-mission reset: clears isDeployed for all survivors, resets morale state
      store.postMissionReset();

      // Purge KIA/fallen maidens from all team memberIds — mirrors Missions.tsx setTeam cleanup.
      // resolveInstant marks KIA maidens with isFallen=true in the store but never touches teams,
      // so dead maidens would remain in squads indefinitely without this step.
      {
        const stAfter = useGameStore.getState();
        const fallenIds = new Set(stAfter.maidens.filter(m => m.isFallen || m.isCaptured).map(m => m.id));
        if (fallenIds.size > 0) {
          for (const team of stAfter.teams) {
            const hadDead = team.memberIds.some(id => fallenIds.has(id));
            if (!hadDead) continue;
            const newMemberIds = team.memberIds.filter(id => !fallenIds.has(id));
            const newLeaderId = team.leaderId && fallenIds.has(team.leaderId)
              ? stAfter.maidens.find(m => newMemberIds.includes(m.id) && !m.isFallen && !m.isCaptured && m.currentHp > 0)?.id ?? undefined
              : team.leaderId;
            store.setTeam(team.id, { memberIds: newMemberIds, leaderId: newLeaderId });
          }
        }
      }

      // ── 12. Post-mission effects ────────────────────────────────────────────
      const deployedIds = fedTeam.map(m => m.id);

      // Hospital heal
      const hospital = useGameStore.getState().buildings.find(b => b.id === 'field_hospital');
      if (hospital?.isConstructed) {
        const frac = hospital.levels[hospital.currentLevel - 1]?.effectValue?.healFraction ?? 0;
        if (frac > 0) store.healInjuredMaidens(frac);
      }

      // Training grounds
      const tg = useGameStore.getState().buildings.find(b => b.id === 'training_grounds');
      if (tg?.isConstructed) {
        const exp = tg.levels[tg.currentLevel - 1]?.effectValue?.theoryExp ?? 0;
        if (exp > 0) store.awardTrainingExp(exp, deployedIds);
      }

      // Farm
      const farm = useGameStore.getState().buildings.find(b => b.id === 'farm');
      if (farm?.isConstructed) {
        const foodProd = farm.levels[farm.currentLevel - 1]?.effectValue?.food ?? 0;
        if (foodProd > 0) {
          store.setMBase({ food: (useGameStore.getState().mbase.food ?? 0) + foodProd });
        }
      }

      // Meridian
      const meridian = useGameStore.getState().buildings.find(b => b.id === 'the_meridian');
      if (meridian?.isConstructed) {
        const tier = meridian.levels[meridian.currentLevel - 1]?.effectValue?.tier ?? 1;
        const curMaidens = useGameStore.getState().maidens;
        const mDeaths = deployedIds.filter(id => {
          const m = curMaidens.find(x => x.id === id);
          return m && (m.isFallen || m.currentHp <= 0);
        }).length;
        store.recordMeridianMission({
          missionId: mission.id,
          kills,
          deaths: mDeaths,
          deployedCount: deployedIds.length,
          difficulty: mission.difficulty,
          isWin: won,
        });
        store.applyMeridianSupport(tier);
      }

      // Wipe cooldown
      if (!won && deaths >= 4) {
        wipeCooldown = POST_WIPE_COOLDOWN_MISSIONS;
        mkLog('Strategy', `Heavy loss (${deaths} KIA) — easy/normal only for next ${POST_WIPE_COOLDOWN_MISSIONS} missions while rebuilding.`, 'warn');
      } else if (won && wipeCooldown > 0) {
        wipeCooldown = Math.max(0, wipeCooldown - 1);
      }

      // Mission rewards
      if (won) {
        // Rescue all maidens listed as captives on this mission
        // (captured in this run via applyMoraleQuitEvents, or in previous failed attempts)
        const freshMission = useGameStore.getState().missions.find(m => m.id === mission.id);
        const stillCapturedOnMission = freshMission?.capturedMaidenIds ?? [];
        if (stillCapturedOnMission.length > 0) {
          // Find any team ID to use as the rescue destination (use the deployed team's first member's team)
          const teamId = useGameStore.getState().teams[0]?.id ?? '';
          store.rescueCapturedMaidens(stillCapturedOnMission, teamId);
          store.setMission(mission.id, { capturedMaidenIds: [] });
          mkLog('Rescue', `Rescued ${stillCapturedOnMission.length} captured maiden(s) from "${mission.name}"`, 'info');
        }

        const reward = mission.reward;
        if (reward) {
          const patch: Record<string, number> = {};
          const s2 = useGameStore.getState().mbase;
          if (reward.money) patch.money = s2.money + reward.money;
          if (reward.wood)  patch.wood  = s2.wood  + reward.wood;
          if (reward.metal) patch.metal = s2.metal + reward.metal;
          if (reward.food)  patch.food  = s2.food  + reward.food;
          if (Object.keys(patch).length > 0) store.setMBase(patch);
          (reward.equipment ?? []).forEach((eq: any) => {
            store.addInventoryItem({ ...eq, inventoryId: `re_${mission.id}_${uuidv4()}` });
          });
          // Rescue heroines
          (reward.rescuedHeroineIds ?? []).forEach((hid: string) => {
            const already = useGameStore.getState().maidens.some(m => m.heroineId === hid);
            if (!already) {
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
        missionsCompleted++;
        mkLog(
          'Mission complete',
          `✅ "${mission.name}" — win #${missionsCompleted}/${targetMissions} | kills: ${kills} | KIA: ${deaths} | survivors: ${survivors.length}`,
          'win',
        );
      } else {
        mkLog(
          'Mission failed',
          `❌ "${mission.name}" — kills: ${kills} | KIA: ${deaths}`,
          'loss',
        );
      }

      store.refreshMissions();
    }

    if (missionsCompleted >= targetMissions) {
      const s = useGameStore.getState();
      const { fsi } = computeForceStrengthIndex(s.maidens);
      const fallen = s.maidens.filter(m => m.isFallen).length;
      const alive  = s.maidens.filter(m => !m.isFallen && !m.isCaptured).length;
      onDone(
        `✅ Completed ${missionsCompleted} missions in ${tick} ticks.\n` +
        `FSI: ${fsi.toFixed(1)} | Roster: ${alive} alive, ${fallen} KIA, ${s.maidens.filter(m => m.isCaptured).length} captured.\n` +
        `Resources: 💰${s.mbase.money} 🪵${s.mbase.wood} ⚙️${s.mbase.metal} 🍖${s.mbase.food}`,
      );
    } else if (tick >= MAX_TICKS) {
      onDone(`⚠️ Simulation stopped at ${MAX_TICKS} ticks — only ${missionsCompleted}/${targetMissions} missions completed.`);
    } else {
      setTimeout(runChunk, 0);
    }
  }

  setTimeout(runChunk, 0);
}

// ── Multi-run simulation ──────────────────────────────────────────────────────

/** Build a snapshot of the current store state for multi-run recording. */
function buildMultiSnapshot(tick: number, missionsCompleted: number): MultiRunSnapshot {
  const s = useGameStore.getState();
  const { fsi } = computeForceStrengthIndex(s.maidens);

  const maidens = s.maidens.map(m => ({
    id: m.id,
    name: m.name,
    type: m.type as 'zako' | 'heroine',
    status: (
      m.isFallen ? 'kia' :
      m.isCaptured ? 'captured' :
      m.moraleQuitStatus === 'escaped' ? 'escaped' :
      'active'
    ) as 'active' | 'captured' | 'kia' | 'escaped',
    missionCount: m.missionCount ?? 0,
    stats: {
      strength:   getStat(m, 'strength'),
      dexterity:  getStat(m, 'dexterity'),
      constitution: getStat(m, 'constitution'),
      awareness:  getStat(m, 'awareness'),
      charm:      getStat(m, 'charm'),
    },
    currentHp: m.currentHp,
    maxHp: m.maxHp,
    equipment: m.equipment.map(e => ({ id: e.id, name: e.name, slot: e.slot })),
  }));

  const buildings = s.buildings.map(b => ({
    id: b.id,
    currentLevel: b.currentLevel,
    isConstructed: b.isConstructed,
  }));

  const inventorySummary: Record<string, number> = {};
  for (const e of s.inventory) {
    inventorySummary[e.id] = (inventorySummary[e.id] ?? 0) + 1;
  }

  return {
    missionsCompleted,
    tick,
    fsi: parseFloat(fsi.toFixed(2)),
    resources: {
      money: s.mbase.money,
      food:  s.mbase.food,
      wood:  s.mbase.wood,
      metal: s.mbase.metal,
    },
    maidens,
    buildings,
    inventorySummary,
  };
}

/**
 * Run N independent simulation attempts, each starting from a fresh new-game
 * state, and call back with the aggregated MultiRunResult when all are done.
 *
 * State is reset via store.importSave(INITIAL_SAVE) before each attempt so
 * every run is isolated from the previous one's state.
 */
function runMultiSimulation(
  totalAttempts: number,
  targetMissions: number,
  settings: EngineSettings,
  onProgress: (attemptsDone: number, totalAttempts: number) => void,
  onDone: (result: MultiRunResult) => void,
) {
  const store = useGameStore.getState();
  const attempts: MultiRunAttempt[] = [];
  let currentAttempt = 0;

  function runNextAttempt() {
    if (currentAttempt >= totalAttempts) {
      onDone({
        exportedAt: new Date().toISOString(),
        targetMissions,
        totalAttempts,
        settings,
        snapshotInterval: MULTI_SNAPSHOT_INTERVAL,
        attempts,
      });
      return;
    }

    // Reset to pristine new-game state
    // INITIAL_SAVE references the same seed object; deep-clone it to prevent
    // cross-run mutation (especially the mutable maidens/teams arrays).
    const freshSave = JSON.parse(JSON.stringify(INITIAL_SAVE));
    // Regenerate missions fresh for this run's new maiden roster
    freshSave.missions = _generateMissionSet(freshSave.maidens, []);
    store.importSave(freshSave);
    // Re-read store after import
    const freshStore = useGameStore.getState();
    freshStore.refreshMissions();

    const snapshots: MultiRunSnapshot[] = [];
    let tick = 0;
    let missionsCompleted = 0;
    let wipeCooldown = 0;
    let idleStreak = 0;
    let lastSnapshotAt = -1; // missions count at last snapshot (-1 = none yet)

    // Take snapshot at mission 0 (baseline)
    snapshots.push(buildMultiSnapshot(0, 0));
    lastSnapshotAt = 0;

    function runChunk() {
      const CHUNK = 300;
      let i = 0;
      while (i < CHUNK && tick < MAX_TICKS && missionsCompleted < targetMissions) {
        tick++;
        i++;

        const st = useGameStore.getState();
        const { maidens, missions, buildings, mbase } = snap(st);

        // Refresh mission pool if empty
        if (missions.filter(m => !m.isCompleted).length === 0) {
          st.refreshMissions();
          continue;
        }

        const active = activeMaidens(maidens).length;
        if (active < MIN_TEAM_SIZE) {
          const nm = recruitMaiden(maidens);
          st.addMaiden(nm);
          continue;
        }

        // Build
        const upgrade = pickBuildingUpgrade(buildings, mbase);
        if (upgrade) {
          const notBuilt = !upgrade.isConstructed;
          const nextLvIdx = notBuilt ? 0 : upgrade.currentLevel;
          const lvDef = upgrade.levels[nextLvIdx];
          const newLevel = notBuilt ? 1 : upgrade.currentLevel + 1;
          st.setBuilding(upgrade.id, { isConstructed: true, currentLevel: newLevel });
          st.setMBase({
            money: mbase.money - (lvDef.costMoney ?? 0),
            wood:  mbase.wood  - (lvDef.costWood  ?? 0),
            metal: mbase.metal - (lvDef.costMetal ?? 0),
          });
          if (upgrade.id === 'tent_block') {
            const beds = upgrade.levels[newLevel - 1]?.effectValue?.beds;
            if (beds) st.setMBase({ beds });
          }
          continue;
        }

        // Equipment (buy, craft, sell, equip)
        {
          let cst = useGameStore.getState();
          const radioBuilt = cst.buildings.find(b => b.id === 'radio_center')?.isConstructed ?? false;
          if (radioBuilt && settings.buyIntensity !== 'none') {
            cst = useGameStore.getState();
            while (tryBuyHQItem(cst.maidens, cst.hqShopItems ?? [], settings.buyIntensity, cst, settings.equipStacking) !== null) {
              cst = useGameStore.getState();
            }
          }
          if (settings.craftIntensity !== 'none') {
            cst = useGameStore.getState();
            while (tryCraftEquipment(settings.craftIntensity, cst, settings.equipStacking) !== null) {
              cst = useGameStore.getState();
            }
          }
          if (settings.sellIntensity !== 'none') {
            cst = useGameStore.getState();
            while (trySellEquipment(cst.maidens, cst.inventory, settings.sellIntensity, cst) !== null) {
              cst = useGameStore.getState();
            }
          }
          cst = useGameStore.getState();
          autoEquip(cst.maidens, cst.inventory, cst);
          if (settings.equipStacking) {
            cst = useGameStore.getState();
            autoEquipStacking(cst.maidens, cst.inventory, cst);
          }
        }

        // Recruit
        {
          const cst = useGameStore.getState();
          const beds = maxBeds(cst.buildings);
          const activeNow = activeMaidens(cst.maidens).length;
          const recruitCap = beds - BED_BUFFER;
          const deployable = deployableMaidens(cst.maidens);
          const teamCost = deployable.length > 0 ? foodCost(deployable) : 0;
          if (activeNow < recruitCap && cst.mbase.food > teamCost) {
            const nm = recruitMaiden(cst.maidens);
            st.addMaiden(nm);
            continue;
          }
        }

        // Trade
        {
          const cst = useGameStore.getState();
          const mb = cst.mbase;
          const radioBuilt = cst.buildings.find(b => b.id === 'radio_center')?.isConstructed ?? false;
          if (radioBuilt) {
            if (mb.food < 50 && mb.money >= 4) {
              const canBuy = Math.floor(mb.money / 2);
              st.setMBase({ money: mb.money - canBuy * 2, food: mb.food + canBuy });
            }
            const nextUpgrade = pickBuildingUpgrade(cst.buildings, mb);
            if (nextUpgrade) {
              const nextLvIdx = !nextUpgrade.isConstructed ? 0 : nextUpgrade.currentLevel;
              const lvDef = nextUpgrade.levels[nextLvIdx];
              const woodShort = (lvDef.costWood ?? 0) - mb.wood;
              if (woodShort > 0 && mb.money >= woodShort * 4) {
                st.setMBase({ money: mb.money - woodShort * 4, wood: mb.wood + woodShort });
              }
            }
          }
        }

        // Pick mission
        let missionPicked: Mission | null = null;
        {
          const cst = useGameStore.getState();
          const hasCaptured = cst.maidens.some(m => m.isCaptured && !m.isFallen);
          const m8 = pickBestMission(cst.missions, cst.maidens, wipeCooldown, missionsCompleted, hasCaptured, cst.mbase);
          if (!m8) {
            idleStreak++;
            if (idleStreak >= 5) { st.refreshMissions(); idleStreak = 0; }
            else { st.refreshMissions(); }
            continue;
          }
          idleStreak = 0;
          missionPicked = m8;
        }
        const mission = missionPicked!;

        // Assemble + feed team
        const freshMaidens = useGameStore.getState().maidens;
        const fullTeam = pickBestTeam(freshMaidens, deployableMaidens(freshMaidens).length);
        let deployTeam = fullTeam;
        if (useGameStore.getState().mbase.food < foodCost(fullTeam)) {
          let shrunk = [...fullTeam];
          while (shrunk.length > 1 && foodCost(shrunk) > useGameStore.getState().mbase.food) shrunk.pop();
          deployTeam = shrunk.length > 0 ? shrunk : fullTeam.slice(0, 1);
        }
        if (deployTeam.length < 1) {
          const nm = recruitMaiden(useGameStore.getState().maidens);
          st.addMaiden(nm);
          continue;
        }

        let remainingFood = useGameStore.getState().mbase.food ?? 0;
        const leader = deployTeam.reduce((b, m) => getStat(m, 'strategy') > getStat(b, 'strategy') ? m : b, deployTeam[0]);
        const ordered = [leader, ...deployTeam.filter(m => m.id !== leader.id)];
        const fedTeam = ordered.map(m => {
          const cost2 = 20 + getStat(m, 'strength');
          if (remainingFood >= cost2) { remainingFood -= cost2; return m; }
          remainingFood = 0;
          const perm = m.moralePermanentBonus ?? 0;
          st.setMaiden(m.id, { moralePermanentBonus: perm - 3 });
          return { ...m, isStarved: true, currentHp: Math.max(1, Math.floor(m.currentHp / 2)) };
        });
        st.setMBase({ food: remainingFood });

        // Resolve
        const { won, kills, deaths } = resolveInstant(
          mission, fedTeam, useGameStore.getState(),
          () => { /* no logging in multi-run */ },
          { reclaimKIAGear: settings.reclaimKIAGear },
        );

        st.postMissionReset();

        // Purge KIA/captured from teams
        {
          const stAfter = useGameStore.getState();
          const fallenIds = new Set(stAfter.maidens.filter(m => m.isFallen || m.isCaptured).map(m => m.id));
          if (fallenIds.size > 0) {
            for (const team of stAfter.teams) {
              const hadDead = team.memberIds.some(id => fallenIds.has(id));
              if (!hadDead) continue;
              const newMemberIds = team.memberIds.filter(id => !fallenIds.has(id));
              const newLeaderId = team.leaderId && fallenIds.has(team.leaderId)
                ? stAfter.maidens.find(m => newMemberIds.includes(m.id) && !m.isFallen && !m.isCaptured && m.currentHp > 0)?.id ?? undefined
                : team.leaderId;
              st.setTeam(team.id, { memberIds: newMemberIds, leaderId: newLeaderId });
            }
          }
        }

        // Post-mission effects
        const deployedIds = fedTeam.map(m => m.id);
        const hospital = useGameStore.getState().buildings.find(b => b.id === 'field_hospital');
        if (hospital?.isConstructed) {
          const frac = hospital.levels[hospital.currentLevel - 1]?.effectValue?.healFraction ?? 0;
          if (frac > 0) st.healInjuredMaidens(frac);
        }
        const tg = useGameStore.getState().buildings.find(b => b.id === 'training_grounds');
        if (tg?.isConstructed) {
          const exp = tg.levels[tg.currentLevel - 1]?.effectValue?.theoryExp ?? 0;
          if (exp > 0) st.awardTrainingExp(exp, deployedIds);
        }
        const farm = useGameStore.getState().buildings.find(b => b.id === 'farm');
        if (farm?.isConstructed) {
          const foodProd = farm.levels[farm.currentLevel - 1]?.effectValue?.food ?? 0;
          if (foodProd > 0) st.setMBase({ food: (useGameStore.getState().mbase.food ?? 0) + foodProd });
        }
        const meridian = useGameStore.getState().buildings.find(b => b.id === 'the_meridian');
        if (meridian?.isConstructed) {
          const tier = meridian.levels[meridian.currentLevel - 1]?.effectValue?.tier ?? 1;
          const curMaidens = useGameStore.getState().maidens;
          const mDeaths = deployedIds.filter(id => { const m = curMaidens.find(x => x.id === id); return m && (m.isFallen || m.currentHp <= 0); }).length;
          st.recordMeridianMission({ missionId: mission.id, kills, deaths: mDeaths, deployedCount: deployedIds.length, difficulty: mission.difficulty, isWin: won });
          st.applyMeridianSupport(tier);
        }

        // Wipe cooldown
        if (!won && deaths >= 4) wipeCooldown = POST_WIPE_COOLDOWN_MISSIONS;
        else if (won && wipeCooldown > 0) wipeCooldown = Math.max(0, wipeCooldown - 1);

        // Rewards
        if (won) {
          const freshMission = useGameStore.getState().missions.find(m => m.id === mission.id);
          const stillCaptured = freshMission?.capturedMaidenIds ?? [];
          if (stillCaptured.length > 0) {
            const teamId = useGameStore.getState().teams[0]?.id ?? '';
            st.rescueCapturedMaidens(stillCaptured, teamId);
            st.setMission(mission.id, { capturedMaidenIds: [] });
          }
          const reward = mission.reward;
          if (reward) {
            const s2 = useGameStore.getState().mbase;
            const patch: Record<string, number> = {};
            if (reward.money) patch.money = s2.money + reward.money;
            if (reward.wood)  patch.wood  = s2.wood  + reward.wood;
            if (reward.metal) patch.metal = s2.metal + reward.metal;
            if (reward.food)  patch.food  = s2.food  + reward.food;
            if (Object.keys(patch).length > 0) st.setMBase(patch);
            (reward.equipment ?? []).forEach((eq: any) => st.addInventoryItem({ ...eq, inventoryId: `re_${mission.id}_${uuidv4()}` }));
          }
          for (const m of fedTeam) {
            if (!m.isFallen && m.currentHp > 0) {
              st.setMaiden(m.id, { missionCount: (useGameStore.getState().maidens.find(x => x.id === m.id)?.missionCount ?? 0) + 1 });
            }
          }
          st.setMission(mission.id, { isCompleted: true });
          missionsCompleted++;

          // Snapshot every MULTI_SNAPSHOT_INTERVAL missions
          if (missionsCompleted % MULTI_SNAPSHOT_INTERVAL === 0 && missionsCompleted !== lastSnapshotAt) {
            snapshots.push(buildMultiSnapshot(tick, missionsCompleted));
            lastSnapshotAt = missionsCompleted;
          }
        }

        st.refreshMissions();
      }

      // Still more ticks/missions to go — reschedule and yield to keep UI responsive
      if (tick < MAX_TICKS && missionsCompleted < targetMissions) {
        setTimeout(runChunk, 0);
        return;
      }

      // Attempt finished (target reached or MAX_TICKS hit)
      // Take a final snapshot if not already at a clean interval
      if (lastSnapshotAt !== missionsCompleted) {
        snapshots.push(buildMultiSnapshot(tick, missionsCompleted));
      }

      const finalState = useGameStore.getState();
      const { fsi: finalFsi } = computeForceStrengthIndex(finalState.maidens);
      attempts.push({
        attemptIndex: currentAttempt,
        snapshots,
        summary: `Attempt ${currentAttempt + 1}: ${missionsCompleted}/${targetMissions} missions in ${tick} ticks | FSI: ${finalFsi.toFixed(1)}`,
        totalTicks: tick,
        missionsCompleted,
      });

      currentAttempt++;
      onProgress(currentAttempt, totalAttempts);

      // Yield to the event loop between attempts to keep UI responsive
      setTimeout(runNextAttempt, 0);
    }

    setTimeout(runChunk, 0);
  }

  runNextAttempt();
}

// ── UI ───────────────────────────────────────────────────────────────────────

const OUTCOME_COLOR: Record<string, string> = {
  win:   '#4a8c4a',
  loss:  '#b84040',
  warn:  '#c8a84b',
  error: '#e05050',
  info:  'var(--color-text-muted)',
};

const OUTCOME_BG: Record<string, string> = {
  win:   'rgba(74,140,74,0.07)',
  loss:  'rgba(184,64,64,0.07)',
  warn:  'rgba(200,168,75,0.05)',
  error: 'rgba(224,80,80,0.08)',
  info:  'transparent',
};

export default function RuleEngine() {
  const [activeTab, setActiveTab] = useState<'single' | 'multi'>('single');

  // ── Single-run state ──
  const [targetMissions, setTargetMissions] = useState(50);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'warn'>('all');
  const [settings, setSettings] = useState<EngineSettings>({
    buyIntensity: 'medium',
    sellIntensity: 'low',
    craftIntensity: 'medium',
    equipStacking: false,
    reclaimKIAGear: false,
  });
  const logRef = useRef<LogEntry[]>([]);
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
    equipStacking: false,
    reclaimKIAGear: false,
  });

  const addEntry = useCallback((entry: LogEntry) => {
    logRef.current = [...logRef.current, entry];
    // Batch UI updates: only re-render every 20 entries to keep it snappy
    if (logRef.current.length % 20 === 0 || entry.outcome === 'win' || entry.outcome === 'loss') {
      setLog([...logRef.current]);
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 10);
    }
  }, []);

  function handleStart() {
    logRef.current = [];
    setLog([]);
    setSummary('');
    setDone(false);
    setRunning(true);
    runSimulation(
      targetMissions,
      settings,
      addEntry,
      (sum: string) => {
        setLog([...logRef.current]);
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
      multiAttempts,
      multiTargetMissions,
      multiSettings,
      (done, total) => setMultiProgress(done / total),
      (result) => {
        setMultiResult(result);
        setMultiDone(true);
        setMultiRunning(false);
        setMultiProgress(1);
      },
    );
  }

  function exportMultiJson() {
    if (!multiResult) return;
    const blob = new Blob([JSON.stringify(multiResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi_run_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportLog() {
    const rows = ['tick,missionsCompleted,outcome,action,detail,money,food,wood,metal,roster'];
    for (const e of logRef.current) {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      rows.push([
        e.tick, e.missionsCompleted, e.outcome ?? 'info',
        esc(e.action), esc(e.detail),
        e.resources.money, e.resources.food, e.resources.wood, e.resources.metal,
        e.rosterSize,
      ].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rule_engine_log_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(logRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rule_engine_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredLog = filter === 'all' ? log : log.filter(e => e.outcome === filter);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>🤖 Rule Engine</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
        Automated strategy simulator. The engine plays the game using built-in decision rules.
      </p>

      {/* ── Tab selector ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
        {(['single', 'multi'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px', fontSize: 13, cursor: 'pointer', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              marginBottom: -1,
            }}
          >
            {tab === 'single' ? '▶ Single Run' : '📊 Multi-Run'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SINGLE RUN TAB                                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'single' && (<>

      {/* ── Config panel ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: '14px 20px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Target missions
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={targetMissions}
            onChange={e => setTargetMissions(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={running}
            style={{
              width: 100, padding: '6px 10px', fontSize: 14, borderRadius: 4,
              border: '1px solid var(--color-border)', background: 'var(--color-bg)',
              color: 'var(--color-text)',
            }}
          />  
        </div>

        {/* ── Buy / Sell / Craft intensity ── */}
        {(['buy', 'sell', 'craft'] as const).map(key => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {key === 'buy' ? '🛒 Buy' : key === 'sell' ? '💸 Sell' : '🔧 Craft'}
            </label>
            <select
              value={settings[`${key}Intensity`]}
              onChange={e => setSettings(prev => ({ ...prev, [`${key}Intensity`]: e.target.value as Intensity }))}
              disabled={running}
              style={{
                padding: '6px 8px', fontSize: 13, borderRadius: 4,
                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                color: 'var(--color-text)', cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {(['none', 'low', 'medium', 'high'] as Intensity[]).map(v => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </div>
        ))}

        {/* ── Exploit toggles ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end', paddingBottom: 2 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.5 : 1 }}>
            <input
              type="checkbox"
              checked={settings.equipStacking}
              onChange={e => setSettings(prev => ({ ...prev, equipStacking: e.target.checked }))}
              disabled={running}
            />
            <span title="Stack duplicate non-weapon items on the same maiden for extra stats">⚠️ Equip Stacking</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.5 : 1 }}>
            <input
              type="checkbox"
              checked={settings.reclaimKIAGear}
              onChange={e => setSettings(prev => ({ ...prev, reclaimKIAGear: e.target.checked }))}
              disabled={running}
            />
            <span title="Strip ALL equipment from fallen maidens back to inventory">⚠️ Reclaim KIA Gear</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 2 }}>
          <button
            onClick={handleStart}
            disabled={running}
            style={{
              padding: '8px 20px', fontSize: 13, borderRadius: 4, cursor: running ? 'not-allowed' : 'pointer',
              background: running ? 'rgba(200,149,74,0.1)' : 'rgba(200,149,74,0.25)',
              color: 'var(--color-accent)', border: '1px solid var(--color-accent-dark)',
              fontWeight: 'bold', opacity: running ? 0.6 : 1,
            }}
          >
            {running ? '⏳ Running…' : '▶ Start'}
          </button>
          {(done || log.length > 0) && (
            <>
              <button
                onClick={exportLog}
                style={{
                  padding: '8px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                  background: 'transparent', color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                📥 Export CSV
              </button>
              <button
                onClick={exportJson}
                style={{
                  padding: '8px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                  background: 'transparent', color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                📥 Export JSON
              </button>
            </>
          )}
        </div>

        {running && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 18 }}>
            {log.length > 0 && `Tick ${log[log.length-1]?.tick} — ${log[log.length-1]?.missionsCompleted}/${targetMissions} missions`}
          </div>
        )}
      </div>

      {/* ── Strategy summary ── */}
      <details style={{ marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
        <summary style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--color-accent)', fontWeight: 'bold', userSelect: 'none' }}>
          📋 Decision strategy
        </summary>
        <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 6px', color: 'var(--color-text)', fontWeight: 'bold' }}>Goal</p>
          <p style={{ margin: '0 0 12px' }}>
            Maximise FSI (Force Strength Index) = Σ mean(STR, DEX, CON, AWR) × (HP/maxHP) across all active maidens.
            FSI grows by keeping veterans alive, healing them between missions, equipping better gear, and building Training Grounds for passive stat gains.
            The hard-mission gate sits at FSI ≥ {FSI_FOR_DIFFICULTY['hard']}; extreme at FSI ≥ {FSI_FOR_DIFFICULTY['extreme']}.
          </p>
          <p style={{ margin: '0 0 6px', color: 'var(--color-text)', fontWeight: 'bold' }}>Decision order (each tick)</p>
          <ol style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li><strong style={{ color: 'var(--color-text)' }}>Emergency recruit</strong> — if active roster &lt; {MIN_TEAM_SIZE}, recruit immediately regardless of food or gold.</li>
            <li><strong style={{ color: 'var(--color-text)' }}>Build / upgrade</strong> — priority order: Farm → Field Hospital → Training Grounds → Tent Block → Radio Center → Factory → The Meridian.
              Exception: if metal &gt; 3 000 and The Meridian is unbuilt and affordable, build it right away to avoid hoarding.</li>
            <li><strong style={{ color: 'var(--color-text)' }}>HQ Shop</strong> — when no building upgrade is currently affordable, spend gold on the best gear available for any equipment slot.</li>
            <li><strong style={{ color: 'var(--color-text)' }}>Auto-equip</strong> — redistribute inventory so every deployable maiden holds the strongest item in each slot (weapon, body, legs, head, accessory, medal).</li>
            <li><strong style={{ color: 'var(--color-text)' }}>Roster expansion</strong> — recruit up to beds − {BED_BUFFER} when food ≥ next team's ration cost and a bed is free.</li>
            <li><strong style={{ color: 'var(--color-text)' }}>Trade (Radio Center)</strong> — convert 2 💰 → 1 🍖 when food is low; convert 4 💰 → 1 🪵 when just short of a building upgrade.</li>
            <li><strong style={{ color: 'var(--color-text)' }}>Mission selection</strong> — pick the highest-difficulty mission the force can safely handle using four safety pools:
              <ul style={{ paddingLeft: 18, margin: '4px 0' }}>
                <li>Pool 0 — all gates active (FSI gate + wipe cooldown + stage count + threat check)</li>
                <li>Pool 1 — drop wipe-cooldown restriction</li>
                <li>Pool 2 — drop threat check (FSI gate + stage count still apply)</li>
                <li>Pool 3 — drop stage-count gate (FSI gate still applies)</li>
                <li>Pool 4 — easy / normal only, no gates (safe fallback when hard/extreme dominate the board)</li>
                <li>Pool 5 — absolute last resort: any mission (prevents infinite idle if only hard/extreme exist)</li>
              </ul>
              After losing ≥ 4 maidens in one mission, a {POST_WIPE_COOLDOWN_MISSIONS}-mission wipe-cooldown bars hard/extreme missions while the force recovers.
            </li>
            <li><strong style={{ color: 'var(--color-text)' }}>Deploy</strong> — send the strongest available maidens (HP ≥ {Math.round(MIN_DEPLOY_HP_FRAC * 100)}%), always keeping {DEPLOY_RESERVE} veterans at home as a reserve. Minimum deployed team size: {MIN_TEAM_SIZE}.</li>
            <li><strong style={{ color: 'var(--color-text)' }}>Between-stage retreat</strong> — pull out early if ≥ {Math.round(STAGE_CASUALTY_RETREAT_FRAC * 100)}% of the stage's entering force is lost or fewer than {MIN_TEAM_SIZE} survivors remain.</li>
            <li><strong style={{ color: 'var(--color-text)' }}>Post-mission</strong> — Field Hospital heals wounded; Training Grounds award EXP; Farm produces food; The Meridian pays a performance bonus.</li>
          </ol>
          <p style={{ margin: '0', color: 'var(--color-text-muted)', fontSize: 11 }}>
            Key insight from simulation: the largest driver of stagnant FSI is high veteran KIA — every dead experienced maiden is replaced by a weak recruit,
            wiping out the stat gains her training provided. Protecting the veterans matters more than squeezing maximum difficulty from every mission.
          </p>
        </div>
      </details>

      {/* ── Summary ── */}
      {summary && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 6,
          background: done && summary.startsWith('✅') ? 'rgba(74,140,74,0.1)' : 'rgba(200,168,75,0.1)',
          border: `1px solid ${done && summary.startsWith('✅') ? '#4a8c4a' : '#c8a84b'}`,
          fontSize: 13, color: 'var(--color-text)', whiteSpace: 'pre-line',
        }}>
          {summary}
        </div>
      )}

      {/* ── Log ── */}
      {log.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {log.length} log entries
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'win', 'loss', 'warn'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '3px 10px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
                    background: filter === f ? 'rgba(200,149,74,0.2)' : 'transparent',
                    color: filter === f ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    border: `1px solid ${filter === f ? 'var(--color-accent-dark)' : 'var(--color-border)'}`,
                  }}
                >
                  {f === 'all' ? 'All' : f === 'win' ? '✅ Wins' : f === 'loss' ? '❌ Losses' : '⚠️ Warnings'}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            height: 480, overflowY: 'auto',
            border: '1px solid var(--color-border)', borderRadius: 6,
            fontFamily: 'monospace', fontSize: 11,
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
                <tr>
                  {['Tick', 'Msn', 'Action', 'Detail', '💰', '🍖', '🪵', '⚙️', 'Roster'].map(h => (
                    <th key={h} style={{
                      padding: '5px 8px', textAlign: 'left', fontSize: 10,
                      color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLog.map((e, i) => (
                  <tr
                    key={i}
                    style={{ background: OUTCOME_BG[e.outcome ?? 'info'] ?? 'transparent' }}
                  >
                    <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.tick}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)' }}>{e.missionsCompleted}</td>
                    <td style={{ padding: '3px 8px', color: OUTCOME_COLOR[e.outcome ?? 'info'], whiteSpace: 'nowrap', fontWeight: e.outcome === 'win' || e.outcome === 'loss' ? 'bold' : 'normal' }}>{e.action}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--color-text)', maxWidth: 380 }}>{e.detail}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.resources.money}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.resources.food}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.resources.wood}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.resources.metal}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--color-text-muted)' }}>{e.rosterSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      </>)}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MULTI-RUN TAB                                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'multi' && (
        <div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 16 }}>
            Runs N independent attempts from a fresh new-game state each time. Records a snapshot every {MULTI_SNAPSHOT_INTERVAL} successful missions
            (resources, FSI, all maidens, buildings, inventory). No per-mission detail log — optimised for bulk data collection.
          </p>

          {/* Config */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '14px 20px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Attempts (N)</label>
              <input type="number" min={1} max={100} value={multiAttempts}
                onChange={e => setMultiAttempts(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={multiRunning}
                style={{ width: 80, padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Missions / run</label>
              <input type="number" min={50} max={10000} step={50} value={multiTargetMissions}
                onChange={e => setMultiTargetMissions(Math.max(50, parseInt(e.target.value) || 50))}
                disabled={multiRunning}
                style={{ width: 100, padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              />
            </div>

            {/* Buy / Sell / Craft intensity */}
            {(['buy', 'sell', 'craft'] as const).map(key => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {key === 'buy' ? '🛒 Buy' : key === 'sell' ? '💸 Sell' : '🔧 Craft'}
                </label>
                <select
                  value={multiSettings[`${key}Intensity`]}
                  onChange={e => setMultiSettings(prev => ({ ...prev, [`${key}Intensity`]: e.target.value as Intensity }))}
                  disabled={multiRunning}
                  style={{ padding: '6px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: multiRunning ? 'not-allowed' : 'pointer' }}
                >
                  {(['none', 'low', 'medium', 'high'] as Intensity[]).map(v => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>
            ))}

            {/* Exploit toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end', paddingBottom: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: multiRunning ? 'not-allowed' : 'pointer', opacity: multiRunning ? 0.5 : 1 }}>
                <input type="checkbox" checked={multiSettings.equipStacking}
                  onChange={e => setMultiSettings(prev => ({ ...prev, equipStacking: e.target.checked }))}
                  disabled={multiRunning} />
                <span>⚠️ Equip Stacking</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: multiRunning ? 'not-allowed' : 'pointer', opacity: multiRunning ? 0.5 : 1 }}>
                <input type="checkbox" checked={multiSettings.reclaimKIAGear}
                  onChange={e => setMultiSettings(prev => ({ ...prev, reclaimKIAGear: e.target.checked }))}
                  disabled={multiRunning} />
                <span>⚠️ Reclaim KIA Gear</span>
              </label>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 2 }}>
              <button
                onClick={handleMultiStart}
                disabled={multiRunning}
                style={{
                  padding: '8px 20px', fontSize: 13, borderRadius: 4, cursor: multiRunning ? 'not-allowed' : 'pointer',
                  background: multiRunning ? 'rgba(74,140,200,0.1)' : 'rgba(74,140,200,0.25)',
                  color: '#4a8cc8', border: '1px solid #3a6a98',
                  fontWeight: 'bold', opacity: multiRunning ? 0.6 : 1,
                }}
              >
                {multiRunning ? '⏳ Running…' : '📊 Start Multi-Run'}
              </button>
              {multiDone && multiResult && (
                <button
                  onClick={exportMultiJson}
                  style={{
                    padding: '8px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                    background: 'transparent', color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
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

          {/* Results summary table */}
          {multiDone && multiResult && (
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: 13 }}>Results — {multiResult.totalAttempts} attempts × {multiResult.targetMissions} missions (snapshot every {multiResult.snapshotInterval})</h4>
              {/* ── Aggregate summary bar ── */}
              {(() => {
                const rows = multiResult.attempts.map(a => {
                  const last = a.snapshots[a.snapshots.length - 1];
                  return {
                    ticks: a.totalTicks,
                    fsi:   last ? last.fsi : 0,
                    kia:   last ? last.maidens.filter(m => m.status === 'kia').length : 0,
                    alive: last ? last.maidens.filter(m => m.status === 'active').length : 0,
                    metal: last ? last.resources.metal : 0,
                  };
                });
                const n = rows.length || 1;
                const avg = (fn: (r: typeof rows[0]) => number) =>
                  (rows.reduce((s, r) => s + fn(r), 0) / n).toFixed(1);
                const count = (fn: (r: typeof rows[0]) => boolean) =>
                  rows.filter(fn).length;
                const statCell = (label: string, value: string | number, color?: string) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, padding: '6px 14px', borderRight: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>{label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: color ?? 'var(--color-text)' }}>{value}</span>
                  </div>
                );
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 10, overflow: 'hidden' }}>
                    {statCell('Avg FSI', avg(r => r.fsi), '#4a8cc8')}
                    {statCell('Avg KIA', avg(r => r.kia), '#b84040')}
                    {statCell('Avg Ticks', avg(r => r.ticks))}
                    {statCell('Avg Alive', avg(r => r.alive), '#4a9c5a')}
                    {statCell('Avg Metal', avg(r => r.metal))}
                    {statCell('FSI 100+', count(r => r.fsi >= 100), '#4a8cc8')}
                    {statCell('FSI < 50', count(r => r.fsi < 50), '#b84040')}
                    {statCell('KIA 200+', count(r => r.kia >= 200), '#b84040')}
                    {statCell('Fast (<500)', count(r => r.ticks < 500), '#4a9c5a')}
                  </div>
                );
              })()}
              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface)' }}>
                      {['Run', 'Missions', 'Ticks', 'Final FSI', 'Roster', '💰', '🍖', '🪵', '⚙️', 'KIA', 'Summary'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {multiResult.attempts.map(attempt => {
                      const last = attempt.snapshots[attempt.snapshots.length - 1];
                      const alive = last ? last.maidens.filter(m => m.status === 'active').length : '—';
                      const kia   = last ? last.maidens.filter(m => m.status === 'kia').length : '—';
                      return (
                        <tr key={attempt.attemptIndex} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>#{attempt.attemptIndex + 1}</td>
                          <td style={{ padding: '4px 10px' }}>{attempt.missionsCompleted}</td>
                          <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{attempt.totalTicks}</td>
                          <td style={{ padding: '4px 10px', color: '#4a8cc8' }}>{last ? last.fsi.toFixed(1) : '—'}</td>
                          <td style={{ padding: '4px 10px' }}>{alive}</td>
                          <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.resources.money : '—'}</td>
                          <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.resources.food : '—'}</td>
                          <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.resources.wood : '—'}</td>
                          <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)' }}>{last ? last.resources.metal : '—'}</td>
                          <td style={{ padding: '4px 10px', color: '#b84040' }}>{kia}</td>
                          <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attempt.summary}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Snapshot progression for each attempt */}
              <details style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                <summary style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--color-accent)', fontWeight: 'bold', userSelect: 'none' }}>
                  📈 Snapshot progression (FSI / resources at every {multiResult.snapshotInterval} missions)
                </summary>
                <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
                  {multiResult.attempts.map(attempt => (
                    <div key={attempt.attemptIndex} style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>Run #{attempt.attemptIndex + 1}</div>
                      <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace', width: '100%' }}>
                        <thead>
                          <tr>
                            {['@Mission', 'Tick', 'FSI', 'Roster', 'KIA', '💰', '🍖', '🪵', '⚙️'].map(h => (
                              <th key={h} style={{ padding: '3px 10px', textAlign: 'left', fontSize: 10, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {attempt.snapshots.map((snap, si) => (
                            <tr key={si} style={{ borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                              <td style={{ padding: '3px 10px', color: 'var(--color-accent)' }}>{snap.missionsCompleted}</td>
                              <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.tick}</td>
                              <td style={{ padding: '3px 10px', color: '#4a8cc8', fontWeight: 'bold' }}>{snap.fsi.toFixed(1)}</td>
                              <td style={{ padding: '3px 10px' }}>{snap.maidens.filter(m => m.status === 'active').length}</td>
                              <td style={{ padding: '3px 10px', color: '#b84040' }}>{snap.maidens.filter(m => m.status === 'kia').length}</td>
                              <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.resources.money}</td>
                              <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.resources.food}</td>
                              <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.resources.wood}</td>
                              <td style={{ padding: '3px 10px', color: 'var(--color-text-muted)' }}>{snap.resources.metal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
