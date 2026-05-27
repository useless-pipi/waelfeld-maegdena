import { v4 as uuidv4 } from 'uuid';
import type { Maiden } from '../types';
import { randomStat, generateName } from '../utils/nameGen';
import equipmentData from '../data/equipment.json';
import type { Equipment, WeaponType } from '../types';
import { randomZakoMaidenImgId } from '../utils/portraits';
import { HEROINE_DEFINITIONS, type HeroineDef } from '../data/heroines';
import { defaultExpData, type ExpData, type SubjectExp } from '../types/maiden';
import tagsData from '../data/tags.json';

// ── Tag helpers ───────────────────────────────────────────────────────────────

interface TagDef { id: string; category: string; isRecruit: boolean; }

const allTags = tagsData as TagDef[];

/** Get recruit-eligible tags of a given category */
function getRecruitTags(category: 'positive' | 'double_edged' | 'negative'): TagDef[] {
  return allTags.filter(t => t.isRecruit && t.category === category);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick N distinct tags from pool, avoiding ids already in excludeIds */
function pickDistinct(pool: TagDef[], n: number, excludeIds: string[]): TagDef[] {
  const available = pool.filter(t => !excludeIds.includes(t.id));
  const picked: TagDef[] = [];
  const used = new Set(excludeIds);
  for (let i = 0; i < n && available.length > 0; i++) {
    const remaining = available.filter(t => !used.has(t.id));
    if (remaining.length === 0) break;
    const choice = pickRandom(remaining);
    picked.push(choice);
    used.add(choice.id);
  }
  return picked;
}

/** Roll initial recruit tags: 2 positive + 1 double-edged + 1 negative */
export function rollZakoRecruitTags(): { id: string }[] {
  const pos = pickDistinct(getRecruitTags('positive'), 2, []);
  const de  = pickDistinct(getRecruitTags('double_edged'), 1, pos.map(t => t.id));
  const neg = pickDistinct(getRecruitTags('negative'), 1, [...pos, ...de].map(t => t.id));
  return [...pos, ...de, ...neg].map(t => ({ id: t.id }));
}

/**
 * Enrich an enemy's tags to meet composition targets.
 * Zako: 2 positive + 1 double-edged + 1 negative (enemy tags, not isRecruit).
 * Lyssa: 3 positive + 2 double-edged + 1 negative.
 * Existing tags are kept; only the missing slots are filled from enemy pools.
 */
export function enrichEnemyTags(
  existingTags: { id: string }[],
  enemyType: 'zako' | 'lyssa',
): { id: string }[] {
  const enemyPosTags   = allTags.filter(t => !t.isRecruit && t.category === 'positive' && !['heroine', 'lyssa', 'undead'].includes(t.id));
  const enemyDeTags    = allTags.filter(t => !t.isRecruit && t.category === 'double_edged');
  const enemyNegTags   = allTags.filter(t => !t.isRecruit && t.category === 'negative');

  const tagMap = new Map(allTags.map(t => [t.id, t]));
  const countOf = (cat: string) => existingTags.filter(t => tagMap.get(t.id)?.category === cat).length;

  const targetPos = enemyType === 'lyssa' ? 3 : 2;
  const targetDe  = enemyType === 'lyssa' ? 2 : 1;
  const targetNeg = 1;

  const usedIds = existingTags.map(t => t.id);
  const result = [...existingTags];

  const addFrom = (pool: TagDef[], needed: number) => {
    const picks = pickDistinct(pool, needed, usedIds);
    for (const p of picks) { result.push({ id: p.id }); usedIds.push(p.id); }
  };

  const needPos = Math.max(0, targetPos - countOf('positive'));
  const needDe  = Math.max(0, targetDe  - countOf('double_edged'));
  const needNeg = Math.max(0, targetNeg - countOf('negative'));

  addFrom(enemyPosTags, needPos);
  addFrom(enemyDeTags,  needDe);
  addFrom(enemyNegTags, needNeg);

  return result;
}

/**
 * Maximum carry weight in pounds for a given strength score.
 * Formula: 20 + 5 × strength
 */
export function computeMaxCarryWeight(strength: number): number {
  return 20 + 5 * strength;
}

/** Total weight in pounds of an array of equipment pieces. */
export function computeCarryWeight(equipment: { weight?: number }[]): number {
  return equipment.reduce((sum, e) => sum + (e.weight ?? 0), 0);
}

/**
 * Create a full Equipment instance from a template id with a fresh inventoryId.
 * Throws if the template id is not found in equipment.json.
 */
export function makeEquipmentInstance(id: string, locked = false): Equipment {
  const template = (equipmentData as Equipment[]).find(e => e.id === id);
  if (!template) throw new Error(`Equipment template not found: ${id}`);
  return { ...template, inventoryId: uuidv4(), ...(locked ? { isLocked: true } : {}) };
}

type BonusSource = { bonuses: { stat: string; value: number; isPercent: boolean }[] };

/**
 * Compute final maxHp for a maiden given all bonus sources.
 * Formula: (7 + 2 × (baseCON + flat CON bonuses) + flat HP bonuses) × (1 + Σ HP% bonuses / 100), rounded.
 */
export function computeFullMaxHp(
  baseCon: number,
  equipment: BonusSource[],
  qualifications: BonusSource[],
  tags: { id: string }[],
): number {
  const tagMap = new Map<string, BonusSource>(
    (tagsData as any[]).map((t: any) => [t.id, t])
  );
  let flatHp = 0;
  let pctHp = 0;
  let flatCon = 0;
  const allSources: BonusSource[] = [...equipment, ...qualifications];
  for (const tag of tags) {
    const def = tagMap.get(tag.id);
    if (def) allSources.push(def);
  }
  for (const src of allSources) {
    for (const b of src.bonuses) {
      if (b.stat === 'hp')           { if (b.isPercent) pctHp += b.value; else flatHp += b.value; }
      else if (b.stat === 'constitution' && !b.isPercent) { flatCon += b.value; }
    }
  }
  const effectiveCon = baseCon + flatCon;
  return Math.round((7 + 2 * effectiveCon + flatHp) * (1 + pctHp / 100));
}

/** @deprecated Use computeFullMaxHp instead. Returns only the flat HP bonus (ignores percent bonuses). */
export function computeHpBonus(
  equipment: BonusSource[],
  qualifications: BonusSource[],
  tags: { id: string }[],
): number {
  return computeFullMaxHp(0, equipment, qualifications, tags);
}
function randomHeroineSubjectExp(): SubjectExp {
  return {
    theoryExp: Math.floor(Math.random() * 1000) + 500,   // 500-1499 → Lv 1-2
    practicalExp: Math.floor(Math.random() * 100) + 50,  // 50-149  → Lv 1-2
  };
}

function heroineExpData(def: HeroineDef): ExpData {
  const weaponId = def.equipment.find(id => {
    const tmpl = (equipmentData as Equipment[]).find(e => e.id === id);
    return tmpl?.slot === 'weapon';
  });
  const weaponType = weaponId
    ? ((equipmentData as Equipment[]).find(e => e.id === weaponId)?.weaponType as WeaponType | undefined)
    : undefined;
  const weaponExp = weaponType ? { [weaponType]: randomHeroineSubjectExp() } : {};
  return {
    weapons: weaponExp,
    scout: randomHeroineSubjectExp(),
    sneak: randomHeroineSubjectExp(),
  };
}

/** Convert a HeroineDef into a full Maiden instance ready to join the party. */
export function heroineDefToMaiden(def: HeroineDef): Maiden {
  const baseEquip = def.equipment.map(id => makeEquipmentInstance(id, true));
  const hasArms = baseEquip.some(e => e.slot === 'arms');
  const equipment = [
    ...baseEquip,
    ...(!hasArms ? [makeEquipmentInstance('field_gloves', true)] : []),
    makeEquipmentInstance('frag_grenade'),
    makeEquipmentInstance('field_rations'),
    makeEquipmentInstance('healing_potion'),
  ];
  const qualifications = def.qualifications.map(q => ({ ...q }));
  const tags = [...def.tags];
  const maxHp = computeFullMaxHp(def.stats.constitution, equipment, qualifications as any[], tags as any[]);
  return {
    id: uuidv4(),
    type: 'heroine',
    heroineId: def.id,
    heroineStatus: def.heroineStatus,
    imgId: def.imgId,
    name: def.name,
    nickname: def.nickname,
    isFavourite: false,
    stats: { ...def.stats },
    maxHp,
    currentHp: maxHp,
    equipment,
    qualifications,
    tags,
    skills: [],
    statusEffects: [],
    killCount: 0,
    missionCount: 0,
    isDeployed: false,
    isCaptured: false,
    isFallen: false,
    expData: heroineExpData(def),
  };
}

/**
 * Build an emergency-recruited zako maiden.
 *
 * Emergency maidens are untrained volunteers. All stats are reduced by 2 (min 1),
 * they carry only civilian gear, and they always carry the 'untrained' tag.
 */
export function recruitEmergencyMaiden(): Maiden {
  const rawStats = {
    strength:     randomStat(),
    dexterity:    randomStat(),
    constitution: randomStat(),
    strategy:     randomStat(),
    awareness:    randomStat(),
    charm:        randomStat(),
  };
  // Apply the -2 untrained penalty to all stats (min 1)
  const stats = {
    strength:     Math.max(1, rawStats.strength - 2),
    dexterity:    Math.max(1, rawStats.dexterity - 2),
    constitution: Math.max(1, rawStats.constitution - 2),
    strategy:     Math.max(1, rawStats.strategy - 2),
    awareness:    Math.max(1, rawStats.awareness - 2),
    charm:        Math.max(1, rawStats.charm - 2),
  };
  const equipment = [
    makeEquipmentInstance('emergency_clothes', true),
    makeEquipmentInstance('emergency_boots', true),
    makeEquipmentInstance('basic_rifle', true),
    makeEquipmentInstance('field_gloves', true),
  ];
  const qualifications: any[] = [];
  const tags: any[] = [...rollZakoRecruitTags(), { id: 'untrained' }];
  const maxHp = Math.max(1, computeFullMaxHp(stats.constitution, equipment, qualifications, tags));
  return {
    id: uuidv4(),
    type: 'zako',
    imgId: randomZakoMaidenImgId(),
    name: generateName(),
    nickname: undefined,
    isFavourite: false,
    stats,
    maxHp,
    currentHp: maxHp,
    equipment,
    qualifications,
    tags,
    skills: [],
    statusEffects: [],
    killCount: 0,
    missionCount: 0,
    isDeployed: false,
    isCaptured: false,
    isFallen: false,
    expData: defaultExpData(),
  };
}

// ── Rosarium Vocis: enrichRecruitGear ─────────────────────────────────────────

/**
 * Re-equip a newly recruited maiden with gear appropriate for the given
 * Rosarium Vocis gear rarity tier (1–5).
 *
 * - Body and legs are drawn from faction:maiden items at the highest
 *   rarityValue ≤ gearRarity (heroines get gearRarity + 1, capped at 5).
 * - Arms are drawn from non-faction arms items (field_gloves → power_gauntlets).
 * - Weapon is drawn from non-faction, non-enemy weapons preserving weapon type
 *   if possible.
 * - Consumables scale with the tier.
 * - All previously unlocked (non-locked) equipment is replaced.
 */
export function enrichRecruitGear(maiden: Maiden, gearRarity: number): Maiden {
  const allItems = equipmentData as Equipment[];
  const isHeroine = maiden.type === 'heroine';
  const effectiveRarity = isHeroine ? Math.min(gearRarity + 1, 5) : gearRarity;

  // Keep locked items that are NOT in the slots we intend to replace.
  // Body/legs/arms/weapon are always replaced regardless of lock status —
  // zako starter gear is locked to prevent accidental selling, but Rosarium
  // should still upgrade it. Heroine signature items in other slots are kept.
  const REPLACED_SLOTS = new Set(['body', 'legs', 'arms', 'weapon']);
  const locked = maiden.equipment.filter(e => (e as any).isLocked && !REPLACED_SLOTS.has(e.slot as string));
  const newEquip: Equipment[] = [...locked];

  // lockedSlots tracks slots already filled by the kept locked items (non-replaced slots only)
  const lockedSlots = new Set(locked.map(e => e.slot as string));

  // Pick best maiden-faction item for a slot
  const pickMaidenSlot = (slot: string): Equipment | null => {
    if (lockedSlots.has(slot)) return null;
    const pool = allItems.filter(e =>
      e.slot === slot &&
      (e as any).faction === 'maiden' &&
      !(e as any).quantity &&
      ((e as any).rarityValue ?? 1) <= effectiveRarity
    );
    if (!pool.length) return null;
    const maxR = Math.max(...pool.map(e => (e as any).rarityValue ?? 1));
    const best = pool.filter(e => ((e as any).rarityValue ?? 1) === maxR);
    return best[Math.floor(Math.random() * best.length)];
  };

  // Body
  const body = pickMaidenSlot('body');
  if (body) newEquip.push(makeEquipmentInstance(body.id));

  // Legs
  const legs = pickMaidenSlot('legs');
  if (legs) newEquip.push(makeEquipmentInstance(legs.id));

  // Arms (non-faction, non-enemy)
  if (!lockedSlots.has('arms')) {
    const armsPool = allItems.filter(e =>
      e.slot === 'arms' &&
      !(e as any).faction &&
      !(e as any).quantity &&
      ((e as any).rarityValue ?? 1) <= effectiveRarity
    );
    if (armsPool.length) {
      const maxR = Math.max(...armsPool.map(e => (e as any).rarityValue ?? 1));
      const best = armsPool.filter(e => ((e as any).rarityValue ?? 1) === maxR);
      const chosen = best[Math.floor(Math.random() * best.length)];
      newEquip.push(makeEquipmentInstance(chosen.id));
    }
  }

  // Weapon (non-faction/maiden-faction, non-enemy)
  if (!lockedSlots.has('weapon')) {
    const existingWeapon = maiden.equipment.find(e => e.slot === 'weapon');
    const weaponType = existingWeapon ? (existingWeapon as any).weaponType as string | undefined : undefined;
    const weaponPool = allItems.filter(e =>
      e.slot === 'weapon' &&
      ((e as any).faction === 'maiden' || !(e as any).faction) &&
      !['enemy', 'lyssa'].includes((e as any).faction ?? '') &&
      !(e as any).quantity &&
      ((e as any).rarityValue ?? 1) <= effectiveRarity
    );
    // Prefer same weapon type; fall back to any weapon
    let weapon: Equipment | undefined = weaponType
      ? weaponPool.filter(e => (e as any).weaponType === weaponType)
          .sort((a, b) => ((b as any).rarityValue ?? 1) - ((a as any).rarityValue ?? 1))[0]
      : undefined;
    if (!weapon) weapon = weaponPool.sort((a, b) => ((b as any).rarityValue ?? 1) - ((a as any).rarityValue ?? 1))[0];
    if (weapon) newEquip.push(makeEquipmentInstance(weapon.id));
  }

  // Consumables scaled by rarity tier
  const potionId   = effectiveRarity >= 4 ? 'premium_potion'      : effectiveRarity >= 3 ? 'advanced_potion'    : effectiveRarity >= 2 ? 'field_potion'       : 'healing_potion';
  const rationsId  = effectiveRarity >= 4 ? 'elite_rations'        : effectiveRarity >= 3 ? 'highgrade_rations'  : effectiveRarity >= 2 ? 'improved_rations'    : 'field_rations';
  const grenadeId  = effectiveRarity >= 4 ? 'void_grenade'         : effectiveRarity >= 3 ? 'incendiary_grenade' : effectiveRarity >= 2 ? 'concussion_grenade'  : 'frag_grenade';

  const findAndAdd = (id: string) => {
    const tmpl = allItems.find(e => e.id === id);
    if (tmpl) newEquip.push(makeEquipmentInstance(id));
  };
  findAndAdd(potionId);
  findAndAdd(rationsId);
  findAndAdd(grenadeId);

  // Recompute maxHp — flat bonuses first, then percent multiplier applied on top
  const newMaxHp = computeFullMaxHp(maiden.stats.constitution, newEquip, maiden.qualifications as any[], maiden.tags as any[]);

  return { ...maiden, equipment: newEquip, maxHp: newMaxHp, currentHp: newMaxHp };
}

/**
 * Build a newly recruited Maiden.
 *
 * @param existingMaidens - The current roster, used to check heroine uniqueness.
 *
 * There is a 3% chance of recruiting an available "Heroine" (recruit-status).
 * A heroine is "available" if she is not already in the party and not fallen.
 * If no heroine is available the roll produces a normal zako maiden instead.
 */
export function recruitMaiden(existingMaidens: Maiden[] = []): Maiden {
  // 3% heroine chance
  if (Math.random() < 0.03) {
    const available = HEROINE_DEFINITIONS.filter(h => {
      if (h.heroineStatus !== 'recruit') return false;
      // Already in party or fallen → not available
      const inParty = existingMaidens.find(m => m.heroineId === h.id);
      return !inParty;
    });

    if (available.length > 0) {
      const def = available[Math.floor(Math.random() * available.length)];
      return heroineDefToMaiden(def);
    }
  }

  // ── Normal zako recruit ───────────────────────────────────────────────────
  const stats = {
    strength: randomStat(),
    dexterity: randomStat(),
    constitution: randomStat(),
    strategy: randomStat(),
    awareness: randomStat(),
    charm: randomStat(),
  };
  const equipment = [
    makeEquipmentInstance('maiden_dress_standard', true),
    makeEquipmentInstance('maiden_boots_standard', true),
    makeEquipmentInstance('basic_rifle', true),
    makeEquipmentInstance('field_gloves', true),
    makeEquipmentInstance('frag_grenade'),
    makeEquipmentInstance('field_rations'),
    makeEquipmentInstance('healing_potion'),
  ];
  const qualifications: any[] = [];
  const tags: any[] = rollZakoRecruitTags();
  const fullMaxHp = computeFullMaxHp(stats.constitution, equipment, qualifications, tags);
  return {
    id: uuidv4(),
    type: 'zako',
    imgId: randomZakoMaidenImgId(),
    name: generateName(),
    nickname: undefined,
    isFavourite: false,
    stats,
    maxHp: fullMaxHp,
    currentHp: fullMaxHp,
    equipment,
    qualifications,
    tags,
    skills: [],
    statusEffects: [],
    killCount: 0,
    missionCount: 0,
    isDeployed: false,
    isCaptured: false,
    isFallen: false,
    expData: defaultExpData(),
  };
}
