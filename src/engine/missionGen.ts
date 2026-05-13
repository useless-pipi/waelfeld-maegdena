/**
 * Mission enemy generation engine.
 *
 * generateZakoEnemy         — creates a randomised zako enemy scaled by quality (1–10) and weapon type.
 * createLyssaEnemy          — instantiates a Lyssa enemy from a LyssaDef id.
 * initializeStageEnemies    — generates the full enemy list for a stage from its template.
 * computeForceStrengthIndex — evaluates how strong the player's roster is (see detailed doc below).
 * generateMissionSet        — procedurally creates 3–5 missions calibrated to the player's FSI.
 *
 * Generated enemies are returned "raw" (no body/leg gear yet). The caller is expected to run
 * them through enrichEnemyGear (Missions.tsx) which adds faction uniforms and resolves tags.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FORCE STRENGTH INDEX  (FSI)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The FSI measures the raw fighting capability of the player's force.
 * Only current fighting strength is counted — past performance (kills,
 * missions completed) is intentionally excluded because it does not reflect
 * how dangerous a maiden is right now.
 *
 * FORMULA
 * ───────
 *   For each active maiden (alive, not captured, HP > 0):
 *     maidenPower = mean(STR, DEX, CON, AWR) × (currentHp / maxHp)
 *   FSI = Σ maidenPower   (sum across ALL active maidens)
 *
 *   Rationale: both headcount and individual capability matter equally.
 *   A roster of 50 average maidens is genuinely more dangerous than
 *   5 elite ones.  HP factor means injured maidens contribute less.
 *
 * CALIBRATION
 * ───────────
 *   Typical fresh recruit: avg(STR,DEX,CON,AWR) ≈ 8, full HP.
 *     10 maidens → FSI ≈  80   (Rookie ceiling)
 *     20 maidens → FSI ≈ 160   (Seasoned floor)
 *     30 maidens → FSI ≈ 240   (Veteran floor)
 *     40 maidens → FSI ≈ 320   (Elite floor)
 *     50 maidens → FSI ≈ 400+  (Legend territory)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TIER TABLE  (used in Missions page UI)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Tier │ FSI Range │ Label    │ Missions │ Enemy Quality │ Difficulty Range
 *  ─────┼───────────┼──────────┼──────────┼───────────────┼─────────────────
 *    1  │   0 –  89 │ Rookie   │    3     │   Q1 – Q7     │ Easy → Hard
 *    2  │  90 – 159 │ Trained  │    3     │   Q2 – Q7     │ Easy → Hard
 *    3  │ 160 – 239 │ Seasoned │    4     │   Q4 – Q6     │ Normal → Hard
 *    4  │ 240 – 319 │ Veteran  │    4     │   Q5 – Q8     │ Normal → Hard
 *    5  │ 320 – 399 │ Elite    │    5     │   Q7 – Q9     │ Hard → Extreme
 *    6  │   400+    │ Legend   │    5     │   Q8 – Q10    │ Hard → Extreme
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MISSION DISTRIBUTION & DIFFICULTY PROGRESSION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Headquarters assigns missions; commanders cannot reject them.
 * As tier rises, easy assignments disappear and only harder operations remain.
 * Higher tiers receive more choices to compensate for increased danger.
 *
 *  Tier 1–2: includes an easy warm-up mission + normal-level missions.
 *  Tier 3–4: no easy missions; normal and hard only.
 *  Tier 5–6: no easy/normal; hard and extreme only.
 *
 * Every set also gets:
 *  • A "challenge" mission one tier above the current (harder, higher reward).
 *  • If captured maidens exist → 1 rescue mission carrying those maiden IDs.
 *    Unrescued captives carry over to the next generation cycle.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REWARD SPECIALISATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each mission in a generated set has a distinct reward focus, so player
 * choices are always meaningful trade-offs:
 *
 *  gold_heavy  — 3× money,  30% other resources.  Best cash income.
 *  supply_run  — 3× food,   2× wood, 40% money.   Logistics priority.
 *  salvage     — 3× metal,  3× wood, 40% money.   Material haul.
 *  training    — qualification reward, 70% resources, no equipment.
 *  medal       — rare equipment, 50% resources.    Prestige prize.
 *  balanced    — standard distribution of everything.
 *
 * The shuffle ensures no two missions in a set share the same focus.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Enemy } from '../types/enemy';
import type { Mission, MissionStage, Difficulty, WeatherType } from '../types/mission';
import type { Maiden } from '../types/maiden';
import { generateName } from '../utils/nameGen';
import { LYSSA_DEFINITIONS } from '../data/lyssas';
import { makeEquipmentInstance, computeHpBonus, enrichEnemyTags } from './recruit';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Clamp value to [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Roll stat: base ± up to 2 random variance, clamped to [1, 20]. */
function rollStat(base: number): number {
  return clamp(base + Math.floor(Math.random() * 5) - 2, 1, 20);
}

/**
 * Pick the weapon equipment id for a generated zako based on quality and weapon type.
 * All returned ids have faction:'enemy' so enrichEnemyGear will not override them.
 *
 * quality 1–5  → lighter / less accurate weapons
 * quality 6–10 → heavier / more accurate weapons
 */
function pickZakoWeaponId(quality: number, weaponType: string): string {
  switch (weaponType) {
    case 'shotgun':    return 'enemy_shotgun';
    case 'smg':        return 'enemy_smg';
    case 'machine_gun':
    case 'lmg':        return 'enemy_lmg';
    case 'rifle':
    default:
      return quality <= 5 ? 'enemy_rifle' : 'enemy_rifle_mk2';
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a randomised zako enemy.
 *
 * @param quality    Combat power from 1 (weakest) to 10 (strongest).
 *                   Scales stat base and can upgrade the weapon tier.
 * @param weaponType One of: 'rifle' | 'shotgun' | 'smg' | 'machine_gun' | 'lmg'
 * @param stageId    Parent stage id — used to build a deterministic-ish enemy id.
 * @param index      Position index in the stage (0-based).
 */
export function generateZakoEnemy(
  quality: number,
  weaponType: string,
  stageId: string,
  index: number,
): Enemy {
  const q = clamp(quality, 1, 10);

  // Stat base: quality 1 → 3, quality 10 → 14 (linear interpolation)
  const statBase = Math.round(3 + (q - 1) * (14 - 3) / 9);

  // Strategy and charm are slightly lower than combat stats
  const stats = {
    strength:     rollStat(statBase),
    dexterity:    rollStat(statBase),
    constitution: rollStat(statBase),
    strategy:     rollStat(Math.max(1, statBase - 1)),
    awareness:    rollStat(statBase),
    charm:        rollStat(Math.max(1, statBase - 3)),
  };

  const baseHp = 7 + 2 * stats.constitution;

  const prefix = q <= 3 ? 'Rogue' : q <= 6 ? 'Veteran' : 'Elite';
  const name = `${prefix} ${generateName()}`;

  // imgId 1901–1905 for zako (5 variants)
  const imgId = 1901 + Math.floor(Math.random() * 5);

  const weaponId = pickZakoWeaponId(q, weaponType);

  return {
    id: `${stageId}_zako_${index}_${uuidv4().slice(0, 8)}`,
    name,
    type: 'zako',
    imgId,
    stats,
    maxHp: baseHp,
    currentHp: baseHp,
    // Weapon is set here — enrichEnemyGear will preserve it because faction:'enemy'
    equipment: [{ id: weaponId } as any],
    qualifications: [],
    tags: [],   // enrichEnemyGear → enrichEnemyTags will fill 2 pos + 1 de + 1 neg
    skills: [],
    statusEffects: [],
  };
}

/**
 * Instantiate a Lyssa enemy from a pre-defined LyssaDef.
 *
 * @param lyssaId  The id from LYSSA_DEFINITIONS (e.g. 'lyssa_11').
 */
export function createLyssaEnemy(lyssaId: string): Enemy {
  const def = LYSSA_DEFINITIONS.find(l => l.id === lyssaId);
  if (!def) {
    throw new Error(`createLyssaEnemy: unknown lyssa id "${lyssaId}"`);
  }

  const baseHp = 7 + 2 * def.stats.constitution;

  return {
    id: `${def.id}_${uuidv4().slice(0, 8)}`,
    name: def.name,
    type: 'lyssa',
    imgId: def.imgId,
    stats: { ...def.stats },
    maxHp: baseHp,
    currentHp: baseHp,
    equipment: [],  // enrichEnemyGear adds lyssa_rifle + lyssa_armor + lyssa_boots
    qualifications: [],
    tags: [...def.tags],  // 3 pos + 2 de + 1 neg + lyssa — enrichEnemyTags will see they're full
    skills: [],
    statusEffects: [],
  };
}

/**
 * Generate the full enemy list for a stage.
 *
 * If the stage has a `template`, enemies are generated fresh each call (random zako + named lyssas).
 * If there is no template, the stage's static `enemies` array is returned as-is.
 */
export function initializeStageEnemies(stage: MissionStage): Enemy[] {
  if (!stage.template) {
    return stage.enemies;
  }

  const { template } = stage;
  const enemies: Enemy[] = [];

  // Spawn Lyssas first so they appear at the front of the list
  for (const lyssaId of (template.lyssaIds ?? [])) {
    enemies.push(createLyssaEnemy(lyssaId));
  }

  // Generate zako groups — each group can have its own quality and weapon type
  let globalIndex = 0;
  for (const group of (template.zako ?? [])) {
    for (let i = 0; i < group.count; i++) {
      enemies.push(generateZakoEnemy(group.quality, group.weaponType, stage.id, globalIndex++));
    }
  }

  return enemies;
}

/**
 * Enrich a raw enemy (returned by initializeStageEnemies) with fully-resolved
 * equipment instances, faction-appropriate body/leg gear, resolved tags, and
 * correct maxHp/currentHp including HP bonuses from gear.
 *
 * This is the single authoritative implementation used by both Missions.tsx and
 * the Rule Engine.  Always call this on every enemy before passing to simulateStage.
 */
export function enrichEnemyGear(enemy: Enemy): Enemy {
  // Resolve existing equipment stubs into full instances (adds bonuses, weight, etc.)
  const resolvedEquip: any[] = (enemy.equipment ?? []).map((e: any) => {
    try { return makeEquipmentInstance(e.id); } catch { return { ...e }; }
  });

  const hasBody        = resolvedEquip.some((e: any) => e.slot === 'body');
  const hasLegs        = resolvedEquip.some((e: any) => e.slot === 'legs');
  const isLyssa        = enemy.type === 'lyssa';
  const hasWeapon      = resolvedEquip.some((e: any) => e.slot === 'weapon');
  const hasEnemyWeapon = resolvedEquip.some((e: any) => e.faction === 'enemy' && e.slot === 'weapon');

  const newEquip = [...resolvedEquip];
  if (!hasBody) newEquip.push(makeEquipmentInstance(isLyssa ? 'lyssa_armor'  : 'enemy_uniform'));
  if (!hasLegs) newEquip.push(makeEquipmentInstance(isLyssa ? 'lyssa_boots'  : 'enemy_boots'));
  if (hasWeapon && !hasEnemyWeapon) {
    const idx = newEquip.findIndex((e: any) => e.slot === 'weapon');
    if (idx !== -1) newEquip[idx] = makeEquipmentInstance(isLyssa ? 'lyssa_rifle' : 'enemy_rifle');
  } else if (!hasWeapon) {
    newEquip.push(makeEquipmentInstance(isLyssa ? 'lyssa_rifle' : 'enemy_rifle'));
  }

  const fullMaxHp = enemy.maxHp + computeHpBonus(newEquip, enemy.qualifications ?? [], enemy.tags ?? []);
  const normalizedTags = (enemy.tags ?? []).map((t: any) => typeof t === 'string' ? { id: t } : t);
  const enrichedTags = enrichEnemyTags(normalizedTags, isLyssa ? 'lyssa' : 'zako');

  return { ...enemy, equipment: newEquip, tags: enrichedTags, maxHp: fullMaxHp, currentHp: fullMaxHp };
}

// ── Force Strength Index & Procedural Mission Generation ─────────────────────

export interface ForceStrengthResult {
  /** Final FSI value (sum of all active maiden combat powers) */
  fsi: number;
  /** Number of active (living, uncaptured) maidens */
  activeMaidenCount: number;
  /** Average combat power per maiden (for display) */
  avgCombatPower: number;
  /** Tier label: 'Rookie' | 'Trained' | 'Seasoned' | 'Veteran' | 'Elite' | 'Legend' */
  tierLabel: string;
  /** Tier number 1–6 */
  tier: number;
}

/**
 * Compute the Force Strength Index for the current roster.
 * FSI = Σ active maidens [ avg(STR,DEX,CON,AWR) × (currentHp / maxHp) ]
 *
 * Calibration (typical fresh recruit avg power ≈ 8):
 *   10 maidens → FSI ≈  80   (Rookie)
 *   20 maidens → FSI ≈ 160   (Seasoned)
 *   30 maidens → FSI ≈ 240   (Veteran)
 *   40 maidens → FSI ≈ 320   (Elite)
 *   50 maidens → FSI ≈ 400   (Legend)
 */
export function computeForceStrengthIndex(maidens: Maiden[]): ForceStrengthResult {
  const active = maidens.filter(m => !m.isFallen && !m.isCaptured && m.currentHp > 0);
  const activeMaidenCount = active.length;

  let totalPower = 0;
  for (const m of active) {
    const basePower = (m.stats.strength + m.stats.dexterity + m.stats.constitution + m.stats.awareness) / 4;
    const healthFactor = m.maxHp > 0 ? m.currentHp / m.maxHp : 1;
    totalPower += basePower * healthFactor;
  }

  const fsi = Math.round(totalPower);
  const avgCombatPower = activeMaidenCount > 0 ? Math.round((totalPower / activeMaidenCount) * 10) / 10 : 0;

  const TIERS: { min: number; label: string }[] = [
    { min:   0, label: 'Rookie'   },
    { min:  90, label: 'Trained'  },
    { min: 160, label: 'Seasoned' },
    { min: 240, label: 'Veteran'  },
    { min: 320, label: 'Elite'    },
    { min: 400, label: 'Legend'   },
  ];
  let tier = 1;
  let tierLabel = 'Rookie';
  for (let i = 0; i < TIERS.length; i++) {
    if (fsi >= TIERS[i].min) { tier = i + 1; tierLabel = TIERS[i].label; }
  }

  return { fsi, activeMaidenCount, avgCombatPower, tierLabel, tier };
}

// ── Tier configuration table (exported for UI display) ───────────────────────

export interface TierConfig {
  tier: number;
  label: string;
  fsiMin: number;
  fsiMax: string;   // string so we can write '400+'
  missions: number;
  qualityLo: number;
  qualityHi: number;
  difficultyRange: string;
}

export const TIER_CONFIGS: TierConfig[] = [
  { tier: 1, label: 'Rookie',   fsiMin:   0, fsiMax:  '89', missions: 3, qualityLo: 1, qualityHi:  7, difficultyRange: 'Easy → Hard'    },
  { tier: 2, label: 'Trained',  fsiMin:  90, fsiMax: '159', missions: 3, qualityLo: 2, qualityHi:  7, difficultyRange: 'Easy → Hard'    },
  { tier: 3, label: 'Seasoned', fsiMin: 160, fsiMax: '239', missions: 4, qualityLo: 4, qualityHi:  6, difficultyRange: 'Normal → Hard'  },
  { tier: 4, label: 'Veteran',  fsiMin: 240, fsiMax: '319', missions: 4, qualityLo: 5, qualityHi:  8, difficultyRange: 'Normal → Hard'  },
  { tier: 5, label: 'Elite',    fsiMin: 320, fsiMax: '399', missions: 5, qualityLo: 7, qualityHi:  9, difficultyRange: 'Hard → Extreme' },
  { tier: 6, label: 'Legend',   fsiMin: 400, fsiMax:  '∞',  missions: 5, qualityLo: 8, qualityHi: 10, difficultyRange: 'Hard → Extreme' },
];

// ── Internal helpers for mission name/description generation ─────────────────

const LOCATION_PREFIXES = ['Ash', 'Crow', 'Dark', 'Ember', 'Frost', 'Grey', 'Hollow', 'Iron', 'Mire', 'Raven', 'Shadow', 'Stone', 'Thorn', 'Veil', 'Warden'];
const LOCATION_SUFFIXES = ['bridge', 'fell', 'ford', 'gate', 'hold', 'march', 'mere', 'moor', 'reach', 'ridge', 'run', 'spire', 'vale', 'watch', 'wood'];
const WEATHER_LABELS: Record<WeatherType, string> = { clear: 'under clear skies', rain: 'in driving rain', fog: 'through heavy fog', snow: 'across snowbound terrain', storm: 'amid a raging storm' };
const DIFF_FLAVOUR: Record<Difficulty, string> = {
  easy: 'A lightly defended position. Suitable for shaking off rust.',
  normal: 'A prepared enemy force holds the area. Expect moderate resistance.',
  hard: 'A fortified and well-supplied enemy. High casualties are likely.',
  extreme: 'The strongest enemy presence encountered. Only elite forces should attempt this.',
};
const RESCUE_FLAVOUR = 'Captive maidens are being held somewhere in this sector. Fight through to rescue them before they are moved.';

const WEATHERS: WeatherType[] = ['clear', 'rain', 'fog', 'snow', 'storm'];
const WEAPON_POOL: string[] = ['rifle', 'shotgun', 'smg', 'lmg', 'rifle', 'rifle']; // rifle weighted

function randLocation(): string {
  const pre = LOCATION_PREFIXES[Math.floor(Math.random() * LOCATION_PREFIXES.length)];
  const suf = LOCATION_SUFFIXES[Math.floor(Math.random() * LOCATION_SUFFIXES.length)];
  return `${pre}${suf}`;
}

function randWeather(): WeatherType {
  return WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
}

function randWeapon(): string {
  return WEAPON_POOL[Math.floor(Math.random() * WEAPON_POOL.length)];
}

/** Pick a Lyssa definition id appropriate for a quality level */
function pickLyssaForQuality(quality: number): string | null {
  if (quality < 4) return null;
  const eligible = LYSSA_DEFINITIONS.filter(l => {
    const power = (l.stats.strength + l.stats.dexterity + l.stats.constitution + l.stats.awareness) / 4;
    const lo = 3 + (quality - 4) * 1.5;
    const hi = lo + 4;
    return power >= lo && power <= hi;
  });
  if (eligible.length === 0) return LYSSA_DEFINITIONS[Math.floor(Math.random() * LYSSA_DEFINITIONS.length)].id;
  return eligible[Math.floor(Math.random() * eligible.length)].id;
}

function buildStage(
  missionId: string,
  stageIndex: number,
  quality: number,
  withLyssa: boolean,
  coverBase: number,
  locationName: string,
): MissionStage {
  const id = `gen_${missionId}_s${stageIndex}`;
  const lyssaId = withLyssa ? pickLyssaForQuality(quality) : null;

  const groupCount = quality <= 3 ? 1 : quality <= 6 ? 2 : 3;
  const baseCount  = quality <= 3 ? 2 : quality <= 6 ? 2 : 3;

  const zakoGroups = Array.from({ length: groupCount }, (_, i) => ({
    count: baseCount + (i === 0 ? 1 : 0),
    quality: clamp(quality + Math.floor(Math.random() * 2) - 1, 1, 10),
    weaponType: randWeapon(),
  }));

  const STAGE_NAMES = ['Outer Perimeter', 'Forward Position', 'Central Strongpoint', 'Inner Redoubt', 'Command Post', 'Vanguard Line', 'Rear Guard'];
  const stageName = STAGE_NAMES[stageIndex % STAGE_NAMES.length];

  return {
    id,
    name: stageName,
    description: `${withLyssa ? 'A Lyssa overseer commands the defenders at ' : 'Enemy forces hold '}${locationName}. ${DIFF_FLAVOUR[qualityToDifficulty(quality)]}`,
    coverLevel: clamp(coverBase + Math.floor(Math.random() * 3) - 1, 1, 10),
    enemies: [],
    template: {
      ...(lyssaId ? { lyssaIds: [lyssaId] } : {}),
      zako: zakoGroups,
    },
  };
}

function qualityToDifficulty(quality: number): Difficulty {
  if (quality <= 3) return 'easy';
  if (quality <= 5) return 'normal';
  if (quality <= 7) return 'hard';
  return 'extreme';
}

// ── Reward specialisation ────────────────────────────────────────────────────

type RewardFocus = 'gold_heavy' | 'supply_run' | 'salvage' | 'training' | 'medal' | 'balanced';

const QUAL_POOL = ['sharpshooter', 'primary_scout', 'sergeant', 'iron_will', 'field_medic', 'corporal', 'basic_rifle_training'];

function buildReward(quality: number, focus: RewardFocus): Mission['reward'] {
  const diff = qualityToDifficulty(quality);
  // Base values before focus modifier
  const mult = diff === 'easy' ? 1 : diff === 'normal' ? 2 : diff === 'hard' ? 10 : 40;
  const baseMoney = Math.round((80 + Math.random() * 40) * mult);
  const baseFood  = Math.round((12 + Math.random() * 8)  * mult);
  const baseWood  = diff === 'easy' ? 0 : Math.round((8 + Math.random() * 5) * (mult - 1));
  const baseMetal = diff === 'easy' ? 0 : Math.round((5 + Math.random() * 5) * (mult - 1));

  const reward: Mission['reward'] = {
    money: 0, food: 0, wood: 0, metal: 0,
    equipment: [],
    qualificationIds: [],
  };

  switch (focus) {
    case 'gold_heavy':
      reward.money  = Math.round(baseMoney * 3);
      reward.food   = Math.round(baseFood  * 0.3);
      reward.wood   = Math.round(baseWood  * 0.3);
      reward.metal  = Math.round(baseMetal * 0.3);
      break;
    case 'supply_run':
      reward.money  = Math.round(baseMoney * 0.4);
      reward.food   = Math.round(baseFood  * 3);
      reward.wood   = Math.round(baseWood  * 2);
      reward.metal  = Math.round(baseMetal * 0.5);
      break;
    case 'salvage':
      reward.money  = Math.round(baseMoney * 0.4);
      reward.food   = Math.round(baseFood  * 0.5);
      reward.wood   = Math.round(baseWood  * 3);
      reward.metal  = Math.round(baseMetal * 3);
      break;
    case 'training':
      reward.money  = Math.round(baseMoney * 0.7);
      reward.food   = Math.round(baseFood  * 0.7);
      reward.wood   = Math.round(baseWood  * 0.7);
      reward.metal  = Math.round(baseMetal * 0.7);
      reward.qualificationIds = [QUAL_POOL[Math.floor(Math.random() * QUAL_POOL.length)]];
      break;
    case 'medal':
      reward.money  = Math.round(baseMoney * 0.5);
      reward.food   = Math.round(baseFood  * 0.5);
      reward.wood   = Math.round(baseWood  * 0.5);
      reward.metal  = Math.round(baseMetal * 0.5);
      reward.equipment = [{
        id: 'medal_of_bravery',
        name: 'Medal of Bravery',
        slot: 'medal',
        bonuses: [{ label: 'Charm', value: 2, stat: 'charm', isPercent: false }],
        description: 'Awarded for exceptional conduct in a high-risk engagement.',
      } as any];
      break;
    case 'balanced':
    default:
      reward.money  = baseMoney;
      reward.food   = baseFood;
      reward.wood   = baseWood;
      reward.metal  = baseMetal;
      // Hard+ balanced gets a qualification
      if (diff === 'hard' || diff === 'extreme') {
        reward.qualificationIds = [QUAL_POOL[Math.floor(Math.random() * QUAL_POOL.length)]];
      }
      break;
  }

  // Clamp negatives to 0
  reward.money  = Math.max(0, reward.money  ?? 0);
  reward.food   = Math.max(0, reward.food   ?? 0);
  reward.wood   = Math.max(0, reward.wood   ?? 0);
  reward.metal  = Math.max(0, reward.metal  ?? 0);

  return reward;
}

/** Shuffle an array in-place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Tier → base quality range [lo, hi] */
function tierToQualityRange(tier: number): [number, number] {
  const cfg = TIER_CONFIGS[Math.min(tier - 1, TIER_CONFIGS.length - 1)];
  return [cfg.qualityLo, cfg.qualityHi];
}

/**
 * Generate a full set of missions calibrated to the player's Force Strength Index.
 *
 * @param maidens         Current maiden roster (used to compute FSI).
 * @param capturedMaidens Maidens who are currently captured — a rescue mission is added for them.
 */
export function generateMissionSet(maidens: Maiden[], capturedMaidens: Maiden[]): Mission[] {
  const { tier } = computeForceStrengthIndex(maidens);

  const [qLo, qHi] = tierToQualityRange(tier);
  const [qLoDown]  = tierToQualityRange(Math.max(1, tier - 1));
  const [, qHiUp]  = tierToQualityRange(Math.min(6, tier + 1));

  // Assign distinct reward focuses — shuffle so each run varies
  const allFocuses: RewardFocus[] = shuffle(['gold_heavy', 'supply_run', 'salvage', 'training', 'medal', 'balanced']);
  let focusIdx = 0;
  const nextFocus = (): RewardFocus => allFocuses[focusIdx++ % allFocuses.length];

  const missions: Mission[] = [];

  // ── Tier 1 & 2: include one easy warm-up mission ──────────────────────────
  if (tier <= 2) {
    const q = clamp(qLoDown + Math.floor(Math.random() * 2), 1, 5);
    const loc = randLocation();
    const id = `gen_warmup_${uuidv4().slice(0, 8)}`;
    const focus = nextFocus();
    missions.push({
      id,
      name: `Skirmish at ${loc}`,
      description: `A lightly contested outpost near ${loc}. Good for shaking off rust ${WEATHER_LABELS[randWeather()]}.`,
      difficulty: qualityToDifficulty(q),
      weather: randWeather(),
      stages: [buildStage(id, 0, q, false, 4, loc)],
      reward: buildReward(q, focus),
      rewardFocus: focus,
      capturedMaidenIds: [],
      isCompleted: false,
      isLocked: false,
    });
  }

  // ── Standard missions at current tier ─────────────────────────────────────
  // Tier 1–2: 1 standard (+ 1 warmup + 1 challenge = 3 total); Tier 3–4: 3 standard; Tier 5–6: 4 standard
  const standardCount = tier <= 2 ? 1 : tier <= 4 ? 3 : 4;
  for (let i = 0; i < standardCount; i++) {
    const q = clamp(qLo + Math.floor(Math.random() * (qHi - qLo + 1)), 1, 10);
    const stageCount = tier <= 2 ? 2 : 3;
    const loc = randLocation();
    const id = `gen_std_${uuidv4().slice(0, 8)}`;
    const focus = nextFocus();
    const stages: MissionStage[] = [];
    for (let s = 0; s < stageCount; s++) {
      stages.push(buildStage(id, s, clamp(q + s, 1, 10), s === stageCount - 1 && q >= 4, 4 + s, loc));
    }
    missions.push({
      id,
      name: `Operation ${loc}`,
      description: `Enemy forces have fortified ${loc} ${WEATHER_LABELS[randWeather()]}. ${DIFF_FLAVOUR[qualityToDifficulty(q)]}`,
      difficulty: qualityToDifficulty(q),
      weather: randWeather(),
      stages,
      reward: buildReward(q, focus),
      rewardFocus: focus,
      capturedMaidenIds: [],
      isCompleted: false,
      isLocked: false,
    });
  }

  // ── Challenge mission (tier + 1) ──────────────────────────────────────────
  {
    const q = clamp(qHiUp - 1 + Math.floor(Math.random() * 2), 1, 10);
    const loc = randLocation();
    const id = `gen_challenge_${uuidv4().slice(0, 8)}`;
    const focus = nextFocus();
    const stages: MissionStage[] = [];
    for (let s = 0; s < 3; s++) {
      stages.push(buildStage(id, s, clamp(q + s, 1, 10), s >= 1 && q >= 5, 3 + s * 2, loc));
    }
    missions.push({
      id,
      name: `Assault on ${loc}`,
      description: `A heavily fortified installation at ${loc}. This will push your forces to their limit. ${WEATHER_LABELS[randWeather()]}.`,
      difficulty: qualityToDifficulty(q),
      weather: randWeather(),
      stages,
      reward: buildReward(q, focus),
      rewardFocus: focus,
      capturedMaidenIds: [],
      isCompleted: false,
      isLocked: false,
    });
  }

  // ── Rescue mission (if captured maidens exist) ────────────────────────────
  if (capturedMaidens.length > 0) {
    const q = clamp(qLo + 1 + Math.floor(Math.random() * 2), 1, 10);
    const loc = randLocation();
    const id = `gen_rescue_${uuidv4().slice(0, 8)}`;
    const stages: MissionStage[] = [];
    for (let s = 0; s < 2; s++) {
      stages.push(buildStage(id, s, clamp(q + s, 1, 10), s === 1 && q >= 4, 3 + s, loc));
    }
    const baseRescueReward = buildReward(q, 'balanced');
    missions.push({
      id,
      name: `Rescue from ${loc}`,
      description: RESCUE_FLAVOUR + ` Enemy positions are concentrated around ${loc}.`,
      difficulty: qualityToDifficulty(q),
      weather: randWeather(),
      stages,
      reward: { ...baseRescueReward, money: Math.round((baseRescueReward.money ?? 0) * 1.3) },
      rewardFocus: 'rescue',
      capturedMaidenIds: capturedMaidens.map(m => m.id),
      isCompleted: false,
      isLocked: false,
    });
  }

  return missions;
}

