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
 *    1  │   0 –  89 │ Rookie   │    3     │   Q1 – Q3     │ Easy → Hard
 *    2  │  90 – 159 │ Trained  │    3     │   Q2 – Q5     │ Easy → Hard
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
import { makeEquipmentInstance, computeFullMaxHp, enrichEnemyTags } from './recruit';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Clamp value to [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Roll stat: base ± up to 2 random variance, clamped to [1, 20]. */
function rollStat(base: number): number {
  return clamp(base + Math.floor(Math.random() * 5) - 2, 1, 20);
}

/** Pick a random element from an array. */
function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Lyssa accessory & medal pools (indexed by quality tier) ──────────────────

const LYSSA_ACC_POOL: Record<string, string[]> = {
  low:   ['lyssa_acc_1',  'lyssa_acc_2',  'lyssa_acc_3',  'lyssa_acc_11', 'lyssa_acc_12',
           'lyssa_acc_13', 'lyssa_acc_14', 'lyssa_acc_15', 'lyssa_acc_16', 'lyssa_acc_17'],
  mid:   ['lyssa_acc_4',  'lyssa_acc_5',  'lyssa_acc_6',  'lyssa_acc_18', 'lyssa_acc_19',
           'lyssa_acc_20', 'lyssa_acc_21', 'lyssa_acc_22', 'lyssa_acc_23', 'lyssa_acc_24'],
  high:  ['lyssa_acc_7',  'lyssa_acc_8',  'lyssa_acc_25', 'lyssa_acc_26', 'lyssa_acc_27',
           'lyssa_acc_28', 'lyssa_acc_29', 'lyssa_acc_30', 'lyssa_acc_31', 'lyssa_acc_32'],
  elite: ['lyssa_acc_9',  'lyssa_acc_10', 'lyssa_acc_33', 'lyssa_acc_34', 'lyssa_acc_35',
           'lyssa_acc_36', 'lyssa_acc_37', 'lyssa_acc_38', 'lyssa_acc_39', 'lyssa_acc_40'],
};

const LYSSA_MEDAL_POOL: Record<string, string[]> = {
  low:   ['lyssa_medal_1',  'lyssa_medal_2',  'lyssa_medal_3',  'lyssa_medal_11', 'lyssa_medal_12',
           'lyssa_medal_13', 'lyssa_medal_14', 'lyssa_medal_15', 'lyssa_medal_16', 'lyssa_medal_17'],
  mid:   ['lyssa_medal_4',  'lyssa_medal_5',  'lyssa_medal_6',  'lyssa_medal_18', 'lyssa_medal_19',
           'lyssa_medal_20', 'lyssa_medal_21', 'lyssa_medal_22', 'lyssa_medal_23', 'lyssa_medal_24'],
  high:  ['lyssa_medal_7',  'lyssa_medal_8',  'lyssa_medal_25', 'lyssa_medal_26', 'lyssa_medal_27',
           'lyssa_medal_28', 'lyssa_medal_29', 'lyssa_medal_30', 'lyssa_medal_31', 'lyssa_medal_32'],
  elite: ['lyssa_medal_9',  'lyssa_medal_10', 'lyssa_medal_33', 'lyssa_medal_34', 'lyssa_medal_35',
           'lyssa_medal_36', 'lyssa_medal_37', 'lyssa_medal_38', 'lyssa_medal_39', 'lyssa_medal_40'],
};

function lyssaQualityTier(q: number): 'low' | 'mid' | 'high' | 'elite' {
  if (q <= 3) return 'low';
  if (q <= 6) return 'mid';
  if (q <= 8) return 'high';
  return 'elite';
}

// ── Quality-tiered gear pickers ───────────────────────────────────────────────
//
// Each picker maps quality 1–10 to a faction:'enemy' item id.
// Three tiers:  Q1-3 (low)  ·  Q4-6 (mid)  ·  Q7-10 (high)
// Lyssa tiers:  Q1-5 (light) · Q6-8 (standard) · Q9-10 (heavy)

// ── Zako ─────────────────────────────────────────────────────────────────────

function pickZakoWeaponId(quality: number, weaponType: string): string {
  const q = quality;
  switch (weaponType) {
    case 'shotgun':
      return q <= 2 ? 'enemy_shotgun' : q <= 5 ? 'enemy_shotgun_mk2' : 'enemy_shotgun_mk3';
    case 'smg':
      return q <= 2 ? 'enemy_smg' : q <= 5 ? 'enemy_smg_mk2' : 'enemy_smg_mk3';
    case 'machine_gun':
    case 'lmg':
      return q <= 2 ? 'enemy_lmg' : q <= 5 ? 'enemy_lmg_mk2' : 'enemy_lmg_mk3';
    case 'sniper_rifle':
      return q <= 2 ? 'enemy_sniper' : q <= 5 ? 'enemy_sniper_mk2' : 'enemy_sniper_mk3';
    case 'pistol':
      return q <= 2 ? 'enemy_pistol' : q <= 5 ? 'enemy_pistol_mk2' : 'enemy_pistol_mk3';
    case 'rifle':
    default:
      return q <= 2 ? 'enemy_rifle' : q <= 5 ? 'enemy_rifle_mk2' : 'enemy_rifle_mk3';
  }
}

function pickZakoBodyId(q: number): string {
  return q <= 2 ? 'enemy_uniform' : q <= 5 ? 'enemy_uniform_mk2' : 'enemy_uniform_mk3';
}
function pickZakoLegsId(q: number): string {
  return q <= 2 ? 'enemy_boots' : q <= 5 ? 'enemy_boots_mk2' : 'enemy_boots_mk3';
}
function pickZakoArmsId(q: number): string {
  return q <= 2 ? 'enemy_armguards' : q <= 5 ? 'enemy_armguards_mk2' : 'enemy_armguards_mk3';
}
function pickZakoMaskId(q: number): string {
  return q <= 5 ? 'enemy_mask' : 'enemy_mask_mk2';
}

// ── Lyssa ─────────────────────────────────────────────────────────────────────

function pickLyssaBodyId(q: number): string {
  return q <= 4 ? 'lyssa_armor_light' : q <= 7 ? 'lyssa_armor' : 'lyssa_armor_heavy';
}
function pickLyssaLegsId(q: number): string {
  return q <= 4 ? 'lyssa_boots_light' : q <= 7 ? 'lyssa_boots' : 'lyssa_boots_heavy';
}
function pickLyssaArmsId(q: number): string {
  return q <= 4 ? 'lyssa_armguards_light' : q <= 7 ? 'lyssa_armguards' : 'lyssa_armguards_heavy';
}
function pickLyssaMaskId(q: number): string {
  return q <= 6 ? 'lyssa_mask' : 'lyssa_mask_enhanced';
}

/**
 * Derive a weapon type for a Lyssa based on her combat tags and quality.
 * Called only when the lyssa has no prior weapon to preserve.
 */
function pickLyssaWeaponTypeFromTags(tags: any[], quality: number): string {
  const ids = new Set((tags ?? []).map((t: any) => (typeof t === 'string' ? t : t.id)));
  // Assassin / shadow operatives carry SMGs for close-quarters work
  if (ids.has('assassin') || ids.has('shadow')) return 'smg';
  // Enforcers and raiders at mid+ quality use breach shotguns
  if ((ids.has('enforcer') || ids.has('raider')) && quality >= 6) return 'shotgun';
  // High-quality boss / overlord / champion / fortress / commander types carry machine guns
  const heavyTags = ['boss', 'overlord', 'champion', 'fortress', 'commander'];
  if (heavyTags.some(id => ids.has(id)) && quality >= 6) return 'machine_gun';
  // Random heavy weapon chance for very high quality
  if (quality >= 9 && Math.random() < 0.35) return 'machine_gun';
  if (quality >= 7 && Math.random() < 0.15) return 'shotgun';
  return 'rifle';
}

function pickLyssaWeaponId(q: number, weaponType: string): string {
  switch (weaponType) {
    case 'shotgun':      return q <= 7 ? 'lyssa_shotgun'      : 'lyssa_shotgun_mk2';
    case 'smg':          return q <= 7 ? 'lyssa_smg'           : 'lyssa_smg_mk2';
    case 'sniper_rifle': return q <= 7 ? 'lyssa_sniper'        : 'lyssa_sniper_mk2';
    case 'pistol':       return q <= 7 ? 'lyssa_pistol'        : 'lyssa_pistol_mk2';
    case 'machine_gun':  return q <= 7 ? 'lyssa_machine_gun'   : 'lyssa_machine_gun_mk2';
    case 'rifle':
    default:             return q <= 4 ? 'lyssa_rifle' : q <= 7 ? 'lyssa_rifle_mk2' : 'lyssa_rifle_mk3';
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Roll consumable equipment and matching grenade EXP for an enemy.
 *
 * Zako:
 *   quality 1–3  : each item has a small independent chance; only cheapest tiers available
 *   quality 4–6  : moderate chance; mid-tier items possible
 *   quality 7–10 : high chance; rarest items possible; may carry 2 grenades
 *
 * Lyssa:
 *   Grenade only — she focuses on fire.  High-quality Lyssas may carry 2.
 *
 * All enemies that receive a grenade also receive grenade EXP (theory + practical),
 * scaled so quality 1–3 stay below Lv1, quality 4–6 reach Lv1, quality 7–10 may hit Lv2.
 */

/**
 * Deterministic EXP values for an enemy of the given quality tier.
 * Theory EXP thresholds: 1 level = 500. Practical EXP thresholds: 1 level = 50.
 *
 * Base (Zako):
 *   Q1–Q3 : weapon T1/P0, grenade T0/P0
 *   Q4–Q5 : weapon T2/P1, grenade T1/P0
 *   Q6–Q7 : weapon T3/P2, grenade T2/P1
 *   Q8–Q9 : weapon T4/P3, grenade T3/P2
 *   Q10   : weapon T5/P4, grenade T4/P3
 *
 * Lyssa bonus: +1 practical level for both weapon and grenade.
 */
function enemyQualityExpValues(quality: number, isLyssa: boolean): {
  weaponTheory: number; weaponPractical: number;
  grenadeTheory: number; grenadePractical: number;
} {
  const q = clamp(quality, 1, 10);
  // tier index 0-4
  const tier = q <= 3 ? 0 : q <= 5 ? 1 : q <= 7 ? 2 : q <= 9 ? 3 : 4;
  const wTheoryLvs  = [1, 2, 3, 4, 5];
  const wPractLvs   = [0, 1, 2, 3, 4];
  const gTheoryLvs  = [0, 1, 2, 3, 4];
  const gPractLvs   = [0, 0, 1, 2, 3];
  const lyssaBonus  = isLyssa ? 1 : 0;
  return {
    weaponTheory:    wTheoryLvs[tier] * 500,
    weaponPractical: (wPractLvs[tier] + lyssaBonus) * 50,
    grenadeTheory:   gTheoryLvs[tier] * 500,
    grenadePractical:(gPractLvs[tier] + lyssaBonus) * 50,
  };
}

function rollEnemyConsumables(
  quality: number,
  isLyssa: boolean,
): { equipment: ReturnType<typeof makeEquipmentInstance>[]; hasGrenade: boolean } {
  const q = clamp(quality, 1, 10);
  const equipment: ReturnType<typeof makeEquipmentInstance>[] = [];
  let hasGrenade = false;

  if (isLyssa) {
    // Lyssa: grenade only
    // q1-3 → 20% chance, 1 grenade | q4-6 → 50%, 1 grenade | q7-10 → 80%, 1-2 grenades
    const grenadeChance = q <= 3 ? 0.20 : q <= 6 ? 0.50 : 0.80;
    if (Math.random() < grenadeChance) {
      const grenadeId = q <= 3 ? 'frag_grenade' : q <= 6 ? 'concussion_grenade' : 'incendiary_grenade';
      equipment.push(makeEquipmentInstance(grenadeId));
      if (q >= 7 && Math.random() < 0.5) equipment.push(makeEquipmentInstance(grenadeId));
      hasGrenade = true;
    }
    return { equipment, hasGrenade };
  }

  // ── Zako ──────────────────────────────────────────────────────────────────
  // Healing potion
  const potionChance = q <= 3 ? 0.15 : q <= 6 ? 0.40 : 0.70;
  if (Math.random() < potionChance) {
    const potionId = q <= 3 ? 'healing_potion' : q <= 6 ? 'field_potion' : 'advanced_potion';
    equipment.push(makeEquipmentInstance(potionId));
    if (q >= 8 && Math.random() < 0.4) equipment.push(makeEquipmentInstance(potionId));
  }

  // Rations
  const rationChance = q <= 3 ? 0.20 : q <= 6 ? 0.45 : 0.75;
  if (Math.random() < rationChance) {
    const rationId = q <= 3 ? 'field_rations' : q <= 6 ? 'improved_rations' : 'highgrade_rations';
    equipment.push(makeEquipmentInstance(rationId));
    if (q >= 8 && Math.random() < 0.4) equipment.push(makeEquipmentInstance(rationId));
  }

  // Grenade
  const grenadeChance = q <= 3 ? 0.10 : q <= 6 ? 0.30 : 0.60;
  if (Math.random() < grenadeChance) {
    const grenadeId = q <= 3 ? 'frag_grenade' : q <= 6 ? 'concussion_grenade' : 'incendiary_grenade';
    equipment.push(makeEquipmentInstance(grenadeId));
    if (q >= 7 && Math.random() < 0.4) equipment.push(makeEquipmentInstance(grenadeId));
    hasGrenade = true;
  }

  return { equipment, hasGrenade };
}

/**
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

  const { equipment: consumables, hasGrenade } = rollEnemyConsumables(q, false);

  const expVals = enemyQualityExpValues(q, false);
  const expData = {
    weapons: {
      [weaponType]: { theoryExp: expVals.weaponTheory, practicalExp: expVals.weaponPractical },
      ...(hasGrenade ? { grenade: { theoryExp: expVals.grenadeTheory, practicalExp: expVals.grenadePractical } } : {}),
    },
    scout: { theoryExp: 0, practicalExp: 0 },
    sneak: { theoryExp: 0, practicalExp: 0 },
  };

  return {
    id: `${stageId}_zako_${index}_${uuidv4().slice(0, 8)}`,
    name,
    type: 'zako',
    imgId,
    stats,
    maxHp: baseHp,
    currentHp: baseHp,
    // Weapon is set here — enrichEnemyGear will preserve it because faction:'enemy'
    equipment: [{ id: weaponId } as any, ...consumables],
    qualifications: [],
    tags: [],   // enrichEnemyGear → enrichEnemyTags will fill 2 pos + 1 de + 1 neg
    skills: [],
    statusEffects: [],
    expData,
    quality: q,
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

  const lyssaQuality = def.quality;
  const { equipment: consumables, hasGrenade } = rollEnemyConsumables(lyssaQuality, true);

  const expVals = enemyQualityExpValues(lyssaQuality, true);
  const expData = {
    weapons: {
      rifle: { theoryExp: expVals.weaponTheory, practicalExp: expVals.weaponPractical },
      ...(hasGrenade ? { grenade: { theoryExp: expVals.grenadeTheory, practicalExp: expVals.grenadePractical } } : {}),
    },
    scout: { theoryExp: 0, practicalExp: 0 },
    sneak: { theoryExp: 0, practicalExp: 0 },
  };

  return {
    id: `${def.id}_${uuidv4().slice(0, 8)}`,
    name: def.name,
    type: 'lyssa',
    imgId: def.imgId,
    stats: { ...def.stats },
    maxHp: baseHp,
    currentHp: baseHp,
    equipment: consumables,  // enrichEnemyGear adds lyssa_rifle + lyssa_armor + lyssa_boots
    qualifications: [],
    tags: [...def.tags],  // 3 pos + 2 de + 1 neg + lyssa — enrichEnemyTags will see they're full
    skills: [],
    statusEffects: [],
    expData,
    quality: lyssaQuality,
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

  const isLyssa = enemy.type === 'lyssa';

  // Derive quality (1–10) from average combat stats.
  // Zako formula mirrors generateZakoEnemy: statBase = 3 + (q-1)*(14-3)/9
  // Lyssa stats are higher but the same formula naturally clamps to 9-10 for tier 3.
  const avgStat = (enemy.stats.strength + enemy.stats.dexterity +
                   enemy.stats.constitution + enemy.stats.awareness) / 4;
  const quality = clamp(Math.round(1 + (avgStat - 3) * 9 / 11), 1, 10);

  // Remember the weapon type of any existing enemy-faction weapon so we can
  // upgrade to the same type rather than defaulting to rifle.
  const existingEnemyWeapon = resolvedEquip.find(
    (e: any) => e.faction === 'enemy' && e.slot === 'weapon');
  const priorWeaponType: string = existingEnemyWeapon?.weaponType ?? '';

  // Strip all enemy-faction body / legs / arms / mask / weapon slots —
  // we replace them below with quality-appropriate versions.
  // Non-enemy items (consumables, player-origin specials) are kept as-is.
  const baseEquip = resolvedEquip.filter((e: any) => {
    if (e.faction === 'enemy' &&
        ['body', 'legs', 'arms', 'mask', 'weapon'].includes(e.slot)) return false;
    return true;
  });

  const newEquip = [...baseEquip];
  const hasWeapon = baseEquip.some((e: any) => e.slot === 'weapon');

  if (isLyssa) {
    newEquip.push(makeEquipmentInstance(pickLyssaBodyId(quality)));
    newEquip.push(makeEquipmentInstance(pickLyssaLegsId(quality)));
    newEquip.push(makeEquipmentInstance(pickLyssaArmsId(quality)));
    if (quality >= 4) newEquip.push(makeEquipmentInstance(pickLyssaMaskId(quality)));
    if (!hasWeapon) {
      const derivedType = priorWeaponType || pickLyssaWeaponTypeFromTags(enemy.tags ?? [], quality);
      newEquip.push(makeEquipmentInstance(pickLyssaWeaponId(quality, derivedType)));
    }

    // Accessories: 0-3 — probability scales with quality (proxy for mission difficulty)
    // q1: ~20% for 1st acc, near-zero for 2nd/3rd  |  q10: ~90% / ~58% / ~28%
    const q0 = (quality - 1) / 9; // 0.0 at q1 … 1.0 at q10
    const accPool   = LYSSA_ACC_POOL[lyssaQualityTier(quality)];
    const medalPool = LYSSA_MEDAL_POOL[lyssaQualityTier(quality)];
    if (Math.random() < 0.20 + q0 * 0.70) newEquip.push(makeEquipmentInstance(pickFrom(accPool)));
    if (Math.random() < 0.03 + q0 * 0.55) newEquip.push(makeEquipmentInstance(pickFrom(accPool)));
    if (Math.random() < q0 * 0.28)         newEquip.push(makeEquipmentInstance(pickFrom(accPool)));

    // Medals: always 1; 2nd and 3rd scale with quality
    // q1: 1 medal guaranteed, ~10% 2nd  |  q10: guaranteed 1, ~80% 2nd, ~35% 3rd
    newEquip.push(makeEquipmentInstance(pickFrom(medalPool)));
    if (Math.random() < 0.10 + q0 * 0.70) newEquip.push(makeEquipmentInstance(pickFrom(medalPool)));
    if (Math.random() < q0 * 0.35)         newEquip.push(makeEquipmentInstance(pickFrom(medalPool)));
  } else {
    newEquip.push(makeEquipmentInstance(pickZakoBodyId(quality)));
    newEquip.push(makeEquipmentInstance(pickZakoLegsId(quality)));
    newEquip.push(makeEquipmentInstance(pickZakoArmsId(quality)));
    if (quality >= 4) newEquip.push(makeEquipmentInstance(pickZakoMaskId(quality)));
    if (!hasWeapon) {
      const wt = priorWeaponType || 'rifle';
      newEquip.push(makeEquipmentInstance(pickZakoWeaponId(quality, wt)));
    }
  }

  const normalizedTags = (enemy.tags ?? []).map((t: any) => typeof t === 'string' ? { id: t } : t);
  const enrichedTags = enrichEnemyTags(normalizedTags, isLyssa ? 'lyssa' : 'zako');
  // Use enrichedTags so any HP-percent tags assigned during enrichment are included
  const fullMaxHp = computeFullMaxHp(enemy.stats.constitution, newEquip, enemy.qualifications ?? [], enrichedTags);

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
  { tier: 1, label: 'Rookie',   fsiMin:   0, fsiMax:  '89', missions: 3, qualityLo: 1, qualityHi:  3, difficultyRange: 'Easy → Hard'    },
  { tier: 2, label: 'Trained',  fsiMin:  90, fsiMax: '159', missions: 3, qualityLo: 2, qualityHi:  5, difficultyRange: 'Easy → Hard'    },
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
  hell: 'A catastrophic assault. Overwhelming numbers and elite Lyssa commanders. Survive at any cost.',
};
const RESCUE_FLAVOUR = 'Captive maidens are being held somewhere in this sector. Fight through to rescue them before they are moved.';

const WEATHERS: WeatherType[] = ['clear', 'rain', 'fog', 'snow', 'storm'];
const WEAPON_POOL: string[] = ['rifle', 'shotgun', 'smg', 'lmg', 'sniper_rifle', 'pistol', 'rifle', 'rifle']; // rifle weighted

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

/** Pick a Lyssa definition id appropriate for a quality level, avoiding any ids in the exclude set.
 *  maxQ caps quality so Lyssas above the tier ceiling are never chosen, even in the fallback pool.
 *  Lyssa quality is derived via the same formula as createLyssaEnemy:
 *    lyssaQuality = clamp(round((avgStat - 5) * 10 / 13), 1, 10)
 */
function pickLyssaForQuality(quality: number, exclude: Set<string> | undefined, maxQ: number): string | null {
  if (quality < 3) return null;

  // Primary: Lyssas whose quality is within ±1 of the target and ≤ maxQ
  const eligible = LYSSA_DEFINITIONS.filter(l => {
    if (exclude?.has(l.id)) return false;
    return l.quality >= quality - 1 && l.quality <= quality + 1 && l.quality <= maxQ;
  });

  // Fallback: any Lyssa at or below maxQ
  const pool = eligible.length > 0
    ? eligible
    : LYSSA_DEFINITIONS.filter(l => {
        if (exclude?.has(l.id)) return false;
        return l.quality <= maxQ;
      });

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function buildStage(
  missionId: string,
  stageIndex: number,
  quality: number,
  withLyssa: boolean,
  coverBase: number,
  locationName: string,
  forceExtraLyssa = false,
  usedLyssaIds: Set<string> | undefined,
  maxQ: number,
): MissionStage {
  const id = `gen_${missionId}_s${stageIndex}`;

  const primaryLyssaId = (withLyssa || forceExtraLyssa) ? pickLyssaForQuality(quality, usedLyssaIds, maxQ) : null;
  if (primaryLyssaId) usedLyssaIds?.add(primaryLyssaId);
  const extraLyssaId   = forceExtraLyssa ? pickLyssaForQuality(clamp(quality + 1, 1, maxQ), usedLyssaIds, maxQ) : null;
  if (extraLyssaId) usedLyssaIds?.add(extraLyssaId);
  const lyssaIds       = [primaryLyssaId, extraLyssaId].filter((x): x is string => !!x);
  const hasLyssa       = lyssaIds.length > 0;

  const groupCount = quality <= 3 ? 1 : quality <= 6 ? 2 : 3;
  const baseCount  = quality <= 3 ? 2 : quality <= 6 ? 2 : 3;

  const zakoGroups = Array.from({ length: groupCount }, (_, i) => ({
    count: baseCount + (i === 0 ? 1 : 0),
    quality: clamp(quality + Math.floor(Math.random() * 2) - 1, 1, maxQ),
    weaponType: randWeapon(),
  }));

  const STAGE_NAMES = ['Outer Perimeter', 'Forward Position', 'Central Strongpoint', 'Inner Redoubt', 'Command Post', 'Vanguard Line', 'Rear Guard'];
  const stageName = STAGE_NAMES[stageIndex % STAGE_NAMES.length];

  return {
    id,
    name: stageName,
    description: `${hasLyssa ? 'A Lyssa overseer commands the defenders at ' : 'Enemy forces hold '}${locationName}. ${DIFF_FLAVOUR[qualityToDifficulty(quality)]}`,
    coverLevel: clamp(coverBase + Math.floor(Math.random() * 3) - 1, 1, 10),
    enemies: [],
    template: {
      ...(lyssaIds.length > 0 ? { lyssaIds } : {}),
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

type RewardFocus = 'gold_heavy' | 'supply_run' | 'medal' | 'weapon_gear' | 'consumable' | 'balanced' | 'strike_force';

/** Medal template definitions keyed by rarity 1–10. */
const MEDAL_TEMPLATES: Record<number, { id: string; name: string; bonuses: { label: string; value: number; stat: string; isPercent: boolean }[]; description: string; isRare?: boolean }> = {
  1:  { id: 'medal_r1',  name: 'Campaign Ribbon',        bonuses: [{ label: 'Charm', value: 1, stat: 'charm', isPercent: false }], description: 'Awarded for completing a frontline campaign.' },
  2:  { id: 'medal_r2',  name: 'Service Cross',           bonuses: [{ label: 'Charm', value: 1, stat: 'charm', isPercent: false }, { label: 'Awareness', value: 1, stat: 'awareness', isPercent: false }], description: 'Recognises sustained service under difficult conditions.' },
  3:  { id: 'medal_r3',  name: 'Valor Badge',             bonuses: [{ label: 'Charm', value: 2, stat: 'charm', isPercent: false }], description: 'Presented for demonstrating personal bravery during combat.' },
  4:  { id: 'medal_r4',  name: 'Distinguished Cross',     bonuses: [{ label: 'Charm', value: 2, stat: 'charm', isPercent: false }, { label: 'Strategy', value: 1, stat: 'strategy', isPercent: false }], description: 'Awarded for distinguished conduct and battlefield leadership.' },
  5:  { id: 'medal_r5',  name: 'Silver Star',             bonuses: [{ label: 'Charm', value: 3, stat: 'charm', isPercent: false }, { label: 'Awareness', value: 1, stat: 'awareness', isPercent: false }], description: 'A prestigious commendation for exceptional field performance.' },
  6:  { id: 'medal_r6',  name: "Commander's Cross",       bonuses: [{ label: 'Charm', value: 3, stat: 'charm', isPercent: false }, { label: 'Strategy', value: 2, stat: 'strategy', isPercent: false }], description: 'Granted to commanders who demonstrate exemplary tactical leadership.' },
  7:  { id: 'medal_r7',  name: 'Legion of Honour',        bonuses: [{ label: 'Charm', value: 4, stat: 'charm', isPercent: false }, { label: 'Strategy', value: 2, stat: 'strategy', isPercent: false }], description: 'One of the highest honours for battlefield service.', isRare: true },
  8:  { id: 'medal_r8',  name: "Hero's Medallion",        bonuses: [{ label: 'Charm', value: 4, stat: 'charm', isPercent: false }, { label: 'Strategy', value: 3, stat: 'strategy', isPercent: false }, { label: 'Awareness', value: 1, stat: 'awareness', isPercent: false }], description: 'Awarded only to heroes whose deeds inspired the entire force.', isRare: true },
  9:  { id: 'medal_r9',  name: 'Grand Cross of Valour',   bonuses: [{ label: 'Charm', value: 5, stat: 'charm', isPercent: false }, { label: 'Strategy', value: 3, stat: 'strategy', isPercent: false }, { label: 'Awareness', value: 2, stat: 'awareness', isPercent: false }], description: 'Near the pinnacle of military decoration. Seldom awarded, never forgotten.', isRare: true },
  10: { id: 'medal_r10', name: 'Supreme Valour Medal',    bonuses: [{ label: 'Charm', value: 6, stat: 'charm', isPercent: false }, { label: 'Strategy', value: 4, stat: 'strategy', isPercent: false }, { label: 'Awareness', value: 3, stat: 'awareness', isPercent: false }], description: 'The highest military honour. Awarded for acts that turned the tide of battle.', isRare: true },
};

/** Roll a rarity-appropriate medal for the given difficulty and return it as an equipment instance. */
function generateMedalForDifficulty(diff: Difficulty): any {
  // Rarity ranges per difficulty
  const [lo, hi] = diff === 'easy' ? [1, 2] : diff === 'normal' ? [3, 5] : diff === 'hard' ? [5, 7] : [7, 10];
  const rarity = lo + Math.floor(Math.random() * (hi - lo + 1));
  const tpl = MEDAL_TEMPLATES[rarity];
  return {
    ...tpl,
    slot: 'medal',
    price: [30, 60, 90, 130, 180, 250, 350, 500, 700, 1000][rarity - 1],
    weight: 0.1,
    medalRarity: rarity,
    inventoryId: uuidv4(),
  };
}

// ── Equipment ID pools for procedural rewards ────────────────────────────────
/** Non-consumable gear pools grouped by quality tier (weapon_gear missions). */
const GEAR_POOL_LOW  = ['basic_rifle','field_gloves','iron_helmet','combat_boots','leather_vest','steel_helmet','cloth_mask'];
const GEAR_POOL_MID  = ['marksman_rifle','reinforced_vest','shotgun','combat_smg','reinforced_gauntlets','combat_mask','sturdy_legguards','heavy_assault_boots','combat_plate','tactical_smg','thermal_goggles','machine_gun','long_rifle','light_machine_gun','spyglass'];
const GEAR_POOL_HIGH = ['fieldwork_boots','tactical_plate','stalker_smg','phantom_mask','sniper_scope_mkii','power_gauntlets','void_mask','ironclad_shotgun','reaper_smg','titan_arms','phantom_sniper','shadowveil_cloak','void_armor','valkyrie_crown','eclipse_rifle','annihilator','aegis_plate'];

/** Consumable item pools grouped by quality tier (consumable missions). */
const CONS_POOL_LOW  = ['field_rations','healing_potion','improved_rations','frag_grenade'];
const CONS_POOL_MID  = ['field_potion','highgrade_rations','concussion_grenade','advanced_potion'];
const CONS_POOL_HIGH = ['elite_rations','incendiary_grenade','premium_potion','void_grenade'];

function pickGearItem(quality: number): any {
  const pool = quality <= 3 ? GEAR_POOL_LOW : quality <= 6 ? GEAR_POOL_MID : GEAR_POOL_HIGH;
  const id = pool[Math.floor(Math.random() * pool.length)];
  try { return makeEquipmentInstance(id); } catch { return { id, inventoryId: uuidv4() }; }
}

function pickConsumableItem(quality: number): any {
  const pool = quality <= 3 ? CONS_POOL_LOW : quality <= 6 ? CONS_POOL_MID : CONS_POOL_HIGH;
  const id = pool[Math.floor(Math.random() * pool.length)];
  try { return makeEquipmentInstance(id); } catch { return { id, inventoryId: uuidv4() }; }
}

/** Non-consumable equipment rewards. Count and tier scale with difficulty. */
function generateGearRewards(quality: number): any[] {
  const diff = qualityToDifficulty(quality);
  const [minC, maxC] = diff === 'easy' ? [1,1] : diff === 'normal' ? [1,2] : diff === 'hard' ? [2,3] : [3,4];
  const count = minC + Math.floor(Math.random() * (maxC - minC + 1));
  const items: any[] = [];
  for (let i = 0; i < count; i++) items.push(pickGearItem(quality));
  // High quality: bonus chance at a higher-tier item
  if (quality >= 7 && Math.random() < 0.45) items.push(pickGearItem(Math.min(quality + 2, 10)));
  return items;
}

/** Consumable rewards. Larger batches than gear. */
function generateConsumableRewards(quality: number, fsiTier: number): any[] {
  const diff = qualityToDifficulty(quality);
  const [minC, maxC] = diff === 'easy' ? [2,3] : diff === 'normal' ? [3,5] : diff === 'hard' ? [4,6] : [5,8];
  const count = minC + Math.floor(Math.random() * (maxC - minC + 1));
  const items: any[] = [];
  for (let i = 0; i < count; i++) items.push(pickConsumableItem(quality));
  // Revenant Bloom: chance = (fsiTier + 10) × 5%, amount = (fsiTier × 2 + 1) − rand(0..2)
  const bloomChance = (fsiTier + 10) * 0.05;
  if (Math.random() < bloomChance) {
    const bloomAmt = Math.max(1, (fsiTier * 2 + 1) - Math.floor(Math.random() * 3));
    for (let b = 0; b < bloomAmt; b++) {
      try { items.push(makeEquipmentInstance('revenant_bloom')); }
      catch { items.push({ id: 'revenant_bloom', inventoryId: uuidv4(), name: 'The Revenant Bloom', slot: 'consumable', bonuses: [], quantity: 1, noEquip: true }); }
    }
  }
  return items;
}

function buildReward(quality: number, focus: RewardFocus, fsiTier = 1): Mission['reward'] {
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
      reward.food   = Math.round(baseFood  * 0.5);
      reward.wood   = Math.round(baseWood  * 0.5);
      reward.metal  = Math.round(baseMetal * 0.5);
      break;
    case 'supply_run':
      reward.money  = Math.round(baseMoney * 2);
      reward.food   = Math.round(baseFood  * 2);
      reward.wood   = Math.round(baseWood  * 2);
      reward.metal  = Math.round(baseMetal * 2);
      break;
    case 'medal': {
      reward.money  = Math.round(baseMoney * 0.3);
      reward.food   = Math.round(baseFood  * 0.3);
      reward.wood   = Math.round(baseWood  * 0.3);
      reward.metal  = Math.round(baseMetal * 0.3);
      reward.equipment = [generateMedalForDifficulty(diff)];
      break;
    }
    case 'weapon_gear':
      reward.money  = Math.round(baseMoney * 0.5);
      reward.food   = Math.round(baseFood  * 0.5);
      reward.wood   = Math.round(baseWood  * 0.5);
      reward.metal  = Math.round(baseMetal * 0.5);
      reward.equipment = generateGearRewards(quality);
      break;
    case 'consumable':
      reward.money  = Math.round(baseMoney * 1);
      reward.food   = Math.round(baseFood  * 1);
      reward.wood   = Math.round(baseWood  * 1);
      reward.metal  = Math.round(baseMetal * 1);
      reward.equipment = generateConsumableRewards(quality, fsiTier);
      break;
    case 'strike_force': {
      reward.money  = Math.round(baseMoney * 4);
      reward.food   = Math.round(baseFood  * 1);
      reward.wood   = 0;
      reward.metal  = 0;
      reward.equipment = [generateMedalForDifficulty(diff)];
      break;
    }
    case 'balanced':
    default:
      reward.money  = baseMoney;
      reward.food   = baseFood;
      reward.wood   = baseWood;
      reward.metal  = baseMetal;
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

// ── Mission name / description tables ────────────────────────────────────────

const FOCUS_NAMES: Record<RewardFocus, string[]> = {
  gold_heavy:   ['Golden Chicken Operation', 'Operation Payday', 'The Treasury Raid', 'Midas Touch Strike', 'Fort Knox Fiasco', 'Operation Cashflow', 'The Pension Heist'],
  supply_run:   ['Operation Empty Plate', 'The Convoy Crusher', 'Operation Quartermaster', 'The Hungry Run', 'Raid on the Breadbasket', 'Operation Bite the Hand', 'The Bread Run'],
  medal:        ['Operation Glory', 'The Prestige Assault', 'Charge of the Brave', 'Operation Iron Will', 'Blood and Honour', 'The Hard Road', 'Red Banner Assault'],
  weapon_gear:  ['Operation Armory Raid', 'The Great Loot', "Quartermaster's Nightmare", 'Operation Sticky Fingers', 'The Gear Snatch', 'Arms Deal Gone Wrong', 'Operation Procurement'],
  consumable:   ['Operation Medicine Cabinet', 'The Candy Run', 'Operation Resupply Express', 'Raid the Fridge', 'The Pill Run', 'Operation Bottomless Bag', 'The Supply Snatch'],
  balanced:     ['Operation Pest Control', 'Standard Wipeout', 'The Routine', 'Operation Cleanup Crew', 'Enemy Disposal', 'Operation Mop-Up', 'Spring Cleaning'],
  strike_force: ['Operation Sentinel', 'Red Alert', 'The Wall', 'Emergency Response', 'Operation Last Stand', 'Breach and Hold', 'Counterforce Alpha'],
};

const FOCUS_DESCS: Record<RewardFocus, (loc: string, weather: string) => string> = {
  gold_heavy:   (loc, w) => `Maidens are dispatched to raid the enemy's gold reserves at ${loc} ${w}. Drain the vault — HQ needs the funding.`,
  supply_run:   (loc, w) => `Maidens strike the enemy's supply line running through ${loc} ${w}. Disrupt their logistics and strip the depot bare.`,
  medal:        (loc, w) => `HQ has designated ${loc} as a critical strategic objective ${w}. Capture it at all costs — command has eyes on this one.`,
  weapon_gear:  (loc, w) => `Intelligence indicates enemy weapon caches are stored near ${loc} ${w}. Neutralise the garrison and haul back everything useful.`,
  consumable:   (loc, w) => `Enemy supply depots near ${loc} ${w} are stocked with consumables and medicine. A quick raid will keep Fort Waelfeld's stores full.`,
  balanced:     (loc, w) => `Standard engagement orders: locate and eliminate enemy forces holding ${loc} ${w}. Maintain discipline and keep casualties low.`,
  strike_force: (loc, w) => `Enemy strike teams are advancing on HQ assets near ${loc} ${w}. Deploy immediately — stop the invasion before it reaches the perimeter.`,
};

function buildMissionFlavour(focus: RewardFocus, loc: string, weather: WeatherType): { name: string; description: string } {
  const names = FOCUS_NAMES[focus];
  const name  = names[Math.floor(Math.random() * names.length)];
  return { name, description: FOCUS_DESCS[focus](loc, WEATHER_LABELS[weather]) };
}

// ── Lyssa Wave ─────────────────────────────────────────────────────────────────────

/** Configuration for each FSI tier's Lyssa Wave event. */
export const LYSSA_WAVE_CONFIGS: Record<number, { n: number; difficulty: Difficulty; lyssaCount: number; quality: number }> = {
  1: { n: 20, difficulty: 'normal',  lyssaCount: 1, quality: 5  },
  2: { n: 15, difficulty: 'normal',  lyssaCount: 1, quality: 6  },
  3: { n: 10, difficulty: 'hard',    lyssaCount: 2, quality: 7  },
  4: { n: 10, difficulty: 'extreme', lyssaCount: 3, quality: 9  },
  5: { n:  7, difficulty: 'extreme', lyssaCount: 4, quality: 10 },
  6: { n:  5, difficulty: 'hell',    lyssaCount: 5, quality: 10 },
};

/**
 * Generate the single mandatory Lyssa Wave mission that replaces the normal pool.
 * The stage has doubled zako counts and one or more Lyssa officers.
 * Difficulty and Lyssa count scale with FSI tier.
 * If defeated, 25–75% of base resources are lost to the raid.
 */
function generateLyssaWaveMission(tier: number): Mission {
  const cfg = LYSSA_WAVE_CONFIGS[Math.min(Math.max(tier, 1), 6)];
  const id = `gen_lyssawave_${uuidv4().slice(0, 8)}`;

  // Pick Lyssas appropriate for quality, no duplicates
  const lyssaIds: string[] = [];
  const usedWaveLyssaIds = new Set<string>();
  for (let i = 0; i < cfg.lyssaCount; i++) {
    const lId = pickLyssaForQuality(cfg.quality, usedWaveLyssaIds, cfg.quality);
    if (lId) { lyssaIds.push(lId); usedWaveLyssaIds.add(lId); }
  }

  // Double the normal zako count to create a massive assault wave
  const groupCount = [1,1,2,3,4,4,5,6][cfg.quality - 3] ?? 6; 
  const baseCount  = [1,2,2,2,2,3,3,3][cfg.quality - 3] ?? 3;
  const zakoGroups = Array.from({ length: groupCount }, (_, i) => ({
    count:      (baseCount + (i === 0 ? 1 : 0)) * 2, // doubled
    quality:    clamp(cfg.quality - i, 1, 10),  
    weaponType: randWeapon(),
  }));

  const stage: MissionStage = {
    id: `${id}_s0`,
    name: 'Fort Waelfeld — Defence Line',
    description: `A massive Lyssa war party breaches the outer perimeter. Every available unit must hold the line or the base will be overrun.`,
    coverLevel: 5,
    enemies: [],
    template: { lyssaIds, zako: zakoGroups },
  };

  const reward = buildReward(cfg.quality, 'weapon_gear', tier);

  return {
    id,
    name: '🚨 LYSSA WAVE — Defend Fort Waelfeld',
    description: `EMERGENCY ALERT: A massive enemy force led by ${cfg.lyssaCount} Lyssa${cfg.lyssaCount > 1 ? 's' : ''} has launched a direct assault on Fort Waelfeld. All other operations are suspended — this base must not fall. Enemy numbers are twice the normal strength. If the attack is repelled, normal operations will resume. Defeat results in 25–75% of all base resources being looted.`,
    difficulty: cfg.difficulty,
    weather: randWeather(),
    stages: [stage],
    reward,
    rewardFocus: 'lyssa_wave',
    capturedMaidenIds: [],
    isCompleted: false,
    isLocked: false,
    isLyssaWave: true,
  };
}

/**
 * Generate a full set of missions calibrated to the player's Force Strength Index.
 *
 * @param maidens           Current maiden roster (used to compute FSI).
 * @param capturedMaidens   Maidens who are currently captured — a rescue mission is added for them.
 * @param lyssaWavePending  When true, returns ONLY the mandatory Lyssa Wave mission.
 */

export function generateMissionSet(maidens: Maiden[], capturedMaidens: Maiden[], lyssaWavePending = false, forceNoEasy = false): Mission[] {
  const { tier } = computeForceStrengthIndex(maidens);

  // Lyssa Wave overrides the normal mission pool
  if (lyssaWavePending) {
    return [generateLyssaWaveMission(tier)];
  }

  const [qLo, qHi] = tierToQualityRange(tier);
  const [qLoDown]  = tierToQualityRange(Math.max(1, tier - 1));
  const [, qHiUp]  = tierToQualityRange(Math.min(6, tier + 1));

  // Assign reward focuses using a tier-weighted pool so early tiers see fewer
  // Medal/Strike-Force missions (which are significantly harder) and late tiers
  // see them more often.
  // Multiplicity table (gold_heavy / supply_run / medal / weapon_gear / consumable / balanced / strike_force):
  //   Tier 1–2 → 3 / 3 / 1 / 2 / 2 / 2 / 1
  //   Tier 3–4 → 2 / 2 / 1 / 2 / 2 / 1 / 1 (reduced balanced at high tier)
  //   Tier 5–6 → 2 / 1 / 2 / 1 / 1 / 3 / 3 (medal & strike_force become frequent)
  const FOCUS_POOL: Record<number, RewardFocus[]> = {
    1: [
      'gold_heavy','gold_heavy','gold_heavy',
      'supply_run','supply_run','supply_run',
      'medal',
      'weapon_gear','weapon_gear',
      'consumable','consumable',
      'balanced','balanced',
      'strike_force',
    ],
    2: [
      'gold_heavy','gold_heavy',
      'supply_run','supply_run',
      'medal',
      'weapon_gear','weapon_gear',
      'consumable','consumable',
      'balanced',
      'strike_force',
    ],
    3: [
      'gold_heavy','gold_heavy',
      'supply_run',
      'medal','medal',
      'weapon_gear',
      'consumable',
      'balanced','balanced','balanced',
      'strike_force','strike_force','strike_force',
    ],
  };
  const poolKey = tier <= 2 ? 1 : tier <= 4 ? 2 : 3;
  const allFocuses: RewardFocus[] = shuffle([...FOCUS_POOL[poolKey]]);
  let focusIdx = 0;
  const nextFocus = (): RewardFocus => allFocuses[focusIdx++ % allFocuses.length];

  const missions: Mission[] = [];

  // ── Helper: build stages, applying +2 quality and +1 stage for elite types ─
  // maxQ caps quality for every stage; defaults to the tier's qHi so elite
  // missions cannot push enemies beyond the tier ceiling.
  function buildMissionStages(mId: string, baseQ: number, stageCount: number, loc: string, isElite: boolean, maxQ: number): MissionStage[] {
    const q = isElite ? clamp(baseQ + 2, 1, maxQ) : clamp(baseQ, 1, maxQ);
    const total = stageCount + (isElite ? 1 : 0);
    const stages: MissionStage[] = [];
    const usedLyssaIds = new Set<string>();
    for (let s = 0; s < total; s++) {
      const isLast = s === total - 1;
      const stageQ = clamp(q + s, 1, maxQ);
      const withLyssa = s >= 1 && stageQ >= 3;
      stages.push(buildStage(mId, s, stageQ, withLyssa, 4 + s, loc, isElite && isLast, usedLyssaIds, maxQ));
    }
    return stages;
  }

  // ── Tier 1 & 2: include one easy warm-up mission ──────────────────────────
  // Suppressed when forceNoEasy=true (HQ mandate after 5 consecutive easy missions).
  if (tier <= 2 && !forceNoEasy) {
    const baseQ   = clamp(qLoDown + Math.floor(Math.random() * 2), 1, qHi);
    const loc     = randLocation();
    const id      = `gen_warmup_${uuidv4().slice(0, 8)}`;
    const focus   = nextFocus();
    const isElite = focus === 'strike_force' || focus === 'medal';
    const effectiveQ = isElite ? clamp(baseQ + 2, 1, qHi) : baseQ;
    const weather = randWeather();
    const { name, description } = buildMissionFlavour(focus, loc, weather);
    missions.push({
      id, name, description,
      difficulty: qualityToDifficulty(effectiveQ),
      weather,
      stages: buildMissionStages(id, baseQ, 1, loc, isElite, qHi),
      reward: buildReward(effectiveQ, focus, tier),
      rewardFocus: focus,
      capturedMaidenIds: [],
      isCompleted: false,
      isLocked: false,
    });
  }

  // ── Standard missions at current tier ─────────────────────────────────────
  // When forceNoEasy at tier 1–2, generate 2 standard missions to compensate for
  // the suppressed easy warm-up, and clamp quality to ≥ normal tier (Q4 minimum).
  // NOTE: Tier 1 has qHi=3 (all easy), so we must also raise the quality ceiling to
  // normalQMin when forced — otherwise clamp(max(rawQ,4),1,3) just collapses back to 3.
  const standardCount = tier <= 2 ? (forceNoEasy ? 2 : 1) : tier <= 4 ? 3 : 4;
  const normalQMin = 4; // quality 4 = first 'normal' band
  for (let i = 0; i < standardCount; i++) {
    const rawQ    = qLo + Math.floor(Math.random() * (qHi - qLo + 1));
    // When forced at tier 1–2: raise both the floor AND the ceiling to normalQMin so the
    // clamp doesn't cancel the floor out.  effectiveQHi is at least normalQMin.
    const effectiveQHi = forceNoEasy && tier <= 2 ? Math.max(qHi, normalQMin) : qHi;
    const baseQ   = clamp(forceNoEasy && tier <= 2 ? Math.max(rawQ, normalQMin) : rawQ, 1, effectiveQHi);
    const loc     = randLocation();
    const id      = `gen_std_${uuidv4().slice(0, 8)}`;
    const focus   = nextFocus();
    const isElite = focus === 'strike_force' || focus === 'medal';
    const effectiveQ = isElite ? clamp(baseQ + 2, 1, effectiveQHi) : baseQ;
    const baseStageCount = tier <= 2 ? 2 : 3;
    const weather = randWeather();
    const { name, description } = buildMissionFlavour(focus, loc, weather);
    missions.push({
      id, name, description,
      difficulty: qualityToDifficulty(effectiveQ),
      weather,
      stages: buildMissionStages(id, baseQ, baseStageCount, loc, isElite, effectiveQHi),
      reward: buildReward(effectiveQ, focus, tier),
      rewardFocus: focus,
      capturedMaidenIds: [],
      isCompleted: false,
      isLocked: false,
    });
  }

  // ── Challenge mission (tier + 1) ──────────────────────────────────────────
  {
    const baseQ   = clamp(qHiUp - 1 + Math.floor(Math.random() * 2), 1, qHiUp);
    const loc     = randLocation();
    const id      = `gen_challenge_${uuidv4().slice(0, 8)}`;
    const focus   = nextFocus();
    const isElite = focus === 'strike_force' || focus === 'medal';
    const effectiveQ = isElite ? clamp(baseQ + 2, 1, qHiUp) : baseQ;
    const weather = randWeather();
    const { name, description } = buildMissionFlavour(focus, loc, weather);
    missions.push({
      id, name, description,
      difficulty: qualityToDifficulty(effectiveQ),
      weather,
      stages: buildMissionStages(id, baseQ, 3, loc, isElite, qHiUp),
      reward: buildReward(effectiveQ, focus, tier),
      rewardFocus: focus,
      capturedMaidenIds: [],
      isCompleted: false,
      isLocked: false,
    });
  }

  // ── Rescue mission (if captured maidens exist) ────────────────────────────
  if (capturedMaidens.length > 0) {
    const q = clamp(qLo + 1 + Math.floor(Math.random() * 2), 1, qHi);
    const loc = randLocation();
    const id = `gen_rescue_${uuidv4().slice(0, 8)}`;
    const stages: MissionStage[] = [];
    for (let s = 0; s < 2; s++) {
      stages.push(buildStage(id, s, clamp(q + s, 1, qHi), s === 1 && q >= 4, 3 + s, loc, false, undefined, qHi));
    }
    const baseRescueReward = buildReward(q, 'balanced', tier);
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

