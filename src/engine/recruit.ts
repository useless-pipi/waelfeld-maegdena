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

/** Sum flat HP bonuses from equipment, qualifications, and tags. */
export function computeHpBonus(
  equipment: { bonuses: { stat: string; value: number; isPercent: boolean }[] }[],
  qualifications: { bonuses: { stat: string; value: number; isPercent: boolean }[] }[],
  tags: { id: string }[],
): number {
  const tagMap = new Map<string, { bonuses: { stat: string; value: number; isPercent: boolean }[] }>(
    (tagsData as any[]).map((t: any) => [t.id, t])
  );
  let bonus = 0;
  for (const src of [...equipment, ...qualifications]) {
    for (const b of src.bonuses) {
      if (b.stat === 'hp' && !b.isPercent) bonus += b.value;
    }
  }
  for (const tag of tags) {
    const def = tagMap.get(tag.id);
    if (def) {
      for (const b of def.bonuses) {
        if (b.stat === 'hp' && !b.isPercent) bonus += b.value;
      }
    }
  }
  return bonus;
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
  const equipment = def.equipment.map(id => makeEquipmentInstance(id, true));
  const qualifications = def.qualifications.map(q => ({ ...q }));
  const tags = [...def.tags];
  const hpBonus = computeHpBonus(equipment, qualifications, tags);
  const maxHp = def.maxHp + hpBonus;
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
  ];
  const qualifications: any[] = [];
  const tags: any[] = [...rollZakoRecruitTags(), { id: 'untrained' }];
  const hpBonus = computeHpBonus(equipment, qualifications, tags);
  const maxHp = Math.max(1, 7 + 2 * stats.constitution + hpBonus);
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
  const maxHp = 7 + 2 * stats.constitution;
  const equipment = [
    makeEquipmentInstance('maiden_dress_standard', true),
    makeEquipmentInstance('maiden_boots_standard', true),
    makeEquipmentInstance('basic_rifle', true),
  ];
  const qualifications: any[] = [];
  const tags: any[] = rollZakoRecruitTags();
  const hpBonus = computeHpBonus(equipment, qualifications, tags);
  const fullMaxHp = maxHp + hpBonus;
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
