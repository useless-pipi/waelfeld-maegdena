import type { Maiden, ExpData } from '../types/maiden';
import type { Enemy } from '../types/enemy';
import type { Equipment, WeaponType } from '../types/equipment';
import type { Stats } from '../types/stats';
import tagsData from '../data/tags.json';

const TAG_BONUS_MAP = new Map<string, { stat: string; value: number; isPercent: boolean }[]>(
  (tagsData as { id: string; bonuses: { stat: string; value: number; isPercent: boolean }[] }[])
    .map(t => [t.id, t.bonuses])
);

type Combatant = Maiden | Enemy;

// ── Morale ────────────────────────────────────────────────────────────────────

export interface MoraleState {
  maidenTeamMorale: number;
  enemyTeamMorale: number;
  /** personal morale per combatant id (base + permanent + current temp) */
  personal: Map<string, number>;
}

/**
 * Compute personal morale display value.
 * = clamp(50 + charm + permanent bonus + temp stage bonus, 0, 100)
 */
export function computePersonalMoraleBase(c: Combatant): number {
  const permanent = (c as any).moralePermanentBonus ?? 0;
  return Math.max(0, Math.min(100, 50 + getStat(c, 'charm') + permanent));
}

export function computePersonalMorale(c: Combatant, tempBonus: number = 0): number {
  return Math.max(0, Math.min(100, computePersonalMoraleBase(c) + tempBonus));
}

/**
 * Compute team base morale.
 * = clamp(50 - stddev(charm of all members) + leader charm, 0, 100)
 */
export function computeTeamMoraleBase(members: Combatant[], leaderId?: string): number {
  if (members.length === 0) return 50;
  const charms = members.map(m => getStat(m, 'charm'));
  const avg = charms.reduce((a, b) => a + b, 0) / charms.length;
  const stdDev = Math.sqrt(charms.reduce((s, c) => s + (c - avg) ** 2, 0) / charms.length);
  let leaderCharm = 0;
  if (leaderId) {
    const leader = members.find(m => isMaiden(m) && (m as Maiden).id === leaderId);
    if (leader) leaderCharm = getStat(leader, 'charm');
  }
  return Math.max(0, Math.min(100, 50 - stdDev + leaderCharm));
}

/**
 * Compute stage temporary morale modifiers for a team.
 * Returns a net bonus/penalty to be added to base morale.
 */
export function computeTeamMoraleTemp(
  aliveMembers: Combatant[],
  aliveOpponents: Combatant[],
  totalMembers: number,
  fallenCount: number,
): number {
  let bonus = 0;

  // 2a. Outnumber: +2 if outnumbering, -2 if outnumbered
  const aliveFriendly = aliveMembers.length;
  const aliveEnemy = aliveOpponents.length;
  if (aliveFriendly > aliveEnemy) bonus += 2;
  else if (aliveEnemy > aliveFriendly) bonus -= 2;

  // 2b. HP ratio: (avgHP/maxHP − 0.5) × 20
  if (aliveMembers.length > 0) {
    const sumCurrent = aliveMembers.reduce((s, c) => s + c.currentHp, 0);
    const sumMax = aliveMembers.reduce((s, c) => s + c.maxHp, 0);
    const hpRatio = sumMax > 0 ? sumCurrent / sumMax : 1;
    bonus += (hpRatio - 0.5) * 20;
  }

  // 2c. Death ratio: −(fallen / total) × 30
  if (totalMembers > 0) bonus -= (fallenCount / totalMembers) * 30;

  return bonus;
}

// ── EXP gain tracking ────────────────────────────────────────────────────────

export interface ExpGain {
  maidenId: string;
  subject: 'scout' | 'sneak' | 'weapon';
  weaponType?: WeaponType;
}

// ── EXP level helpers ─────────────────────────────────────────────────────────

/** 1 theory level per 500 theory EXP */
export function theoryLv(exp: number): number { return Math.floor(exp / 500); }
/** 1 practical level per 50 practical EXP */
export function practicalLv(exp: number): number { return Math.floor(exp / 50); }

function getExpData(c: Combatant): ExpData {
  return c.expData ?? { weapons: {}, scout: { theoryExp: 0, practicalExp: 0 }, sneak: { theoryExp: 0, practicalExp: 0 } };
}

function isMaiden(c: Combatant): c is Maiden {
  return 'isFavourite' in c;
}

function isLyssa(c: Combatant): c is Enemy {
  return !isMaiden(c) && (c as Enemy).type === 'lyssa';
}

/** Sum all bonus values for a given stat across equipment, qualifications, and tags */
function sumBonuses(c: Combatant, stat: string): number {
  let total = 0;
  for (const eq of c.equipment) {
    for (const b of eq.bonuses) {
      if (b.stat === stat) total += b.value;
    }
  }
  for (const q of c.qualifications) {
    for (const b of q.bonuses) {
      if (b.stat === stat) total += b.value;
    }
  }
  for (const tag of c.tags) {
    const bonuses = TAG_BONUS_MAP.get(tag.id);
    if (bonuses) {
      for (const b of bonuses) {
        if (b.stat === stat && !b.isPercent) total += b.value;
      }
    }
  }
  return total;
}

/**
 * Get the effective value of one of the six core stats, including all equipment
 * and qualification bonuses. Always use this instead of c.stats.X directly so
 * bonuses are never accidentally omitted.
 */
export function getStat(c: Combatant, stat: keyof Stats): number {
  return c.stats[stat] + sumBonuses(c, stat);
}

/** Computed max HP = constitution + constitution bonuses + hp bonuses */
export function computeMaxHp(c: Combatant): number {
  return getStat(c, 'constitution') + sumBonuses(c, 'hp');
}

/** Equipped weapon (first weapon slot item) */
function getWeapon(c: Combatant): Equipment | undefined {
  return c.equipment.find(e => e.slot === 'weapon');
}

function getEquippedWeaponType(c: Combatant): WeaponType | undefined {
  return getWeapon(c)?.weaponType;
}

/**
 * Hit rate of an attack (as percentage 0-100).
 * Formula (two-stage):
 *   1. Additive subtotal:
 *        base (Dexterity × 5)
 *      + equipment/qualification hitRate bonuses
 *      + weapon EXP bonus (+1% per theory lv, +2% per practical lv)
 *      − defender dodge bonuses
 *      − defender sneak EXP dodge
 *      + personal morale bonus (±0.2% per point from 50)
 *      + team morale bonus    (±0.1% per point from 50)
 *   2. Multiplicative weapon modifier applied last:
 *        subtotal × (1 + weapon.hitRateBonus / 100)
 *      e.g. hitRateBonus +20 → ×1.20 (+20% boost)
 *           hitRateBonus −50 → ×0.50 (−50% reduction)
 *   3. Result clamped to [5, 95].
 */
export function computeHitRate(
  attacker: Combatant,
  defender: Combatant,
  attackerPersonalMorale: number = 50,
  attackerTeamMorale: number = 50,
): number {
  const weapon = getWeapon(attacker);
  const base = getStat(attacker, 'dexterity') * 5;
  const attackerBonus = sumBonuses(attacker, 'hitRate');
  // Defender dodge is halved if she is starved
  const rawDefenderDodge = sumBonuses(defender, 'dodge');
  const defenderDodge = isMaiden(defender) && (defender as Maiden).isStarved
    ? rawDefenderDodge * 0.5 : rawDefenderDodge;

  // Attacker weapon EXP bonus: +1% per theory lv, +2% per practical lv
  const wType = getEquippedWeaponType(attacker);
  const attackerExpData = getExpData(attacker);
  const wExp = wType ? (attackerExpData.weapons[wType] ?? { theoryExp: 0, practicalExp: 0 }) : { theoryExp: 0, practicalExp: 0 };
  const weaponExpBonus = theoryLv(wExp.theoryExp) * 1 + practicalLv(wExp.practicalExp) * 2;

  // Defender sneak EXP dodge bonus: -0.5% per theory lv, -1% per practical lv
  const defExpData = getExpData(defender);
  const sneakDodgeBonus = theoryLv(defExpData.sneak.theoryExp) * 0.5 + practicalLv(defExpData.sneak.practicalExp) * 1;

  // Personal morale bonus: ±0.2% per point from 50
  const personalMoraleBonus = (attackerPersonalMorale - 50) * 0.2;
  // Team morale bonus: ±0.1% per point from 50
  const teamMoraleBonus = (attackerTeamMorale - 50) * 0.1;

  // Step 1: additive subtotal (no weapon bonus yet)
  const subtotal = base + attackerBonus + weaponExpBonus - defenderDodge - sneakDodgeBonus + personalMoraleBonus + teamMoraleBonus;

  // Step 2: apply weapon hitRateBonus multiplicatively
  const weaponMultiplier = 1 + (weapon?.hitRateBonus ?? 0) / 100;
  const adjusted = subtotal * weaponMultiplier;

  // Starved attacker fires at half effectiveness (applied last, after all other modifiers)
  const starvedMultiplier = isMaiden(attacker) && (attacker as Maiden).isStarved ? 0.5 : 1;
  return Math.max(5, Math.min(95, adjusted * starvedMultiplier));
}

/** Damage of an attack = weapon damage only */
export function computeDamage(attacker: Combatant): number {
  const weapon = getWeapon(attacker);
  return weapon?.damage ?? 4;
}

export interface CombatEvent {
  type: 'attack' | 'miss' | 'retreat_fire' | 'log' | 'cover_gained' | 'cover_lost' | 'cover_blocked' | 'morale';
  attackerName: string;
  defenderName?: string;
  damage?: number;
  message: string;
  /** Round number: 0 = pre-battle (spot/surprise), 1+ = encounter rounds */
  round?: number;
  /** Snapshot of team morales at the time of this event (for UI replay) */
  moraleSnapshot?: { maidenTeam: number; enemyTeam: number; personal?: Record<string, number> };
}

/** Get display name of a combatant */
function getName(c: Combatant): string {
  return isMaiden(c) ? (c.nickname ?? c.name) : c.name;
}

/**
 * Cover chance for a combatant (0-95%).
 * Formula: (coverLevel × 5%) + ((dex - 10) × 2%) + ((strategy - 10) × 4%)
 *   + sneak EXP cover bonus: +1% per theory lv, +2% per practical lv
 */
export function calculateCoverChance(c: Combatant, coverLevel: number): number {
  const base = coverLevel * 5;
  const dexBonus = (getStat(c, 'dexterity') - 10) * 2;
  const stratBonus = (getStat(c, 'strategy') - 10) * 4;
  const expData = getExpData(c);
  const sneakCoverBonus = theoryLv(expData.sneak.theoryExp) * 1 + practicalLv(expData.sneak.practicalExp) * 2;
  const coverStarvedMultiplier = isMaiden(c) && (c as Maiden).isStarved ? 0.5 : 1;
  return Math.max(0, Math.min(95, (base + dexBonus + stratBonus + sneakCoverBonus) * coverStarvedMultiplier));
}

/**
 * Block rate when behind cover (0-90%).
 * Formula: 50% + (coverLevel × 3%)
 */
export function calculateCoverBlockRate(coverLevel: number): number {
  return Math.min(90, 50 + coverLevel * 3);
}


export interface SpotResult {
  /** Which team spotted first: "maiden" | "enemy" | "simultaneous" */
  spotter: 'maiden' | 'enemy' | 'simultaneous';
  rounds: number;
  /** Best-awareness maiden's ID (for EXP awarding) */
  bestScoutMaidenId?: string;
  /** Best-sneak maiden's ID (for EXP awarding) */
  bestSneakMaidenId?: string;
}

/** Box-Muller transform: returns a normally distributed random number (mean=0, sd=1). */
function randNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Random multiplier for scout scores: normal distribution mean=1, SD=0.25.
 * Clamped to [0.25, 2.0] to prevent extreme outliers.
 */
function scoutRoll(): number {
  return Math.max(0.25, Math.min(2.0, 1 + randNormal() * 0.25));
}

/** Compute base scout spot score including EXP bonus (before random multiplier). */
function computeSpotScore(c: Combatant): number {
  const expData = getExpData(c);
  const scoutBonus = theoryLv(expData.scout.theoryExp) * 0.5 + practicalLv(expData.scout.practicalExp) * 1;
  const base = getStat(c, 'awareness') + scoutBonus;
  // Starved maiden scouts at half effectiveness (applied last)
  const starvedMultiplier = isMaiden(c) && (c as Maiden).isStarved ? 0.5 : 1;
  return base * starvedMultiplier;
}

/** Compute sneak index multiplier from sneak EXP */
function computeSneakIndex(c: Combatant): number {
  const expData = getExpData(c);
  return 1 + theoryLv(expData.sneak.theoryExp) * 0.03 + practicalLv(expData.sneak.practicalExp) * 0.10;
}

/**
 * Resolve the spot phase.
 * Approach index starts at 3.0, decreases 0.3 per round.
 * Sneak = dexterity * approachIndex * sneakIndexFactor (from sneak EXP).
 * Spot = awareness + scout EXP bonus of the best spotter.
 */
export function resolveSpot(maidens: Combatant[], enemies: Combatant[]): SpotResult {
  let approach = 3.0;
  let round = 0;

  // Identify best scout maiden and best sneak maiden for EXP purposes
  const bestScout = [...maidens].sort((a, b) => computeSpotScore(b) - computeSpotScore(a))[0];
  const bestSneak = [...maidens].sort((a, b) => getStat(b, 'dexterity') - getStat(a, 'dexterity'))[0];
  const bestScoutMaidenId = bestScout && isMaiden(bestScout) ? (bestScout as Maiden).id : undefined;
  const bestSneakMaidenId = bestSneak && isMaiden(bestSneak) ? (bestSneak as Maiden).id : undefined;

  while (approach > 0) {
    round++;
    // Best maiden spot vs best enemy sneak (with sneak index)
    const maidenSpotScore = Math.max(...maidens.map(m => computeSpotScore(m))) * scoutRoll();
    const enemySneak = Math.max(...enemies.map(e => getStat(e, 'dexterity') * approach * computeSneakIndex(e)));
    const maidenSpots = maidenSpotScore > enemySneak;

    // Best enemy spot vs best maiden sneak (with sneak index)
    const enemySpotScore = Math.max(...enemies.map(e => computeSpotScore(e))) * scoutRoll();
    const maidenSneak = Math.max(...maidens.map(m => getStat(m, 'dexterity') * approach * computeSneakIndex(m)));
    const enemySpots = enemySpotScore > maidenSneak;

    if (maidenSpots && enemySpots) return { spotter: 'simultaneous', rounds: round, bestScoutMaidenId, bestSneakMaidenId };
    if (maidenSpots) return { spotter: 'maiden', rounds: round, bestScoutMaidenId, bestSneakMaidenId };
    if (enemySpots) return { spotter: 'enemy', rounds: round, bestScoutMaidenId, bestSneakMaidenId };

    approach = Math.round((approach - 0.3) * 10) / 10;
  }
  return { spotter: 'simultaneous', rounds: round, bestScoutMaidenId, bestSneakMaidenId };
}

/**
 * Execute a single fire round: each attacker in `attackers` fires at a random alive `defenders`.
 * Mutates HP of defenders. Returns log of events.
 * coverSet: set of combatant names currently behind cover (mutated in-place).
 * coverLevel: terrain cover level (0-10) for block rate calculation.
 * expGainsOut: optional array to append EXP gain events to (1 practical EXP per qualifying action).
 * moraleMap: optional map from combatant id → current personal morale (default 50)
 * attackerTeamMorale: current team morale for the attacking side (default 50)
 * onKill: optional callback when a kill/stun happens (for morale tracking)
 */
export function fireRound(
  attackers: Combatant[],
  defenders: Combatant[],
  label: string,
  coverSet: Set<string> = new Set(),
  coverLevel: number = 0,
  expGainsOut?: ExpGain[],
  moraleMap?: Map<string, number>,
  attackerTeamMorale: number = 50,
  onKill?: (attacker: Combatant, target: Combatant, isLyssaStun: boolean) => void,
  onHit?: (target: Combatant, damage: number) => void,
): CombatEvent[] {
  const events: CombatEvent[] = [];
  const aliveDefenders = () => defenders.filter(d => d.currentHp > 0);

  // Sort by dexterity descending (initiative)
  const order = [...attackers].sort((a, b) => getStat(b, 'dexterity') - getStat(a, 'dexterity'));

  for (const attacker of order) {
    if (attacker.currentHp <= 0) continue;

    // ── Lyssa stun: skip this attack turn and clear stun ──────────────────
    if (isLyssa(attacker) && (attacker as Enemy).lyssaStunned) {
      (attacker as Enemy).lyssaStunned = false;
      events.push({
        type: 'log',
        attackerName: getName(attacker),
        message: `💫 [Lyssa] ${getName(attacker)} is stunned and cannot attack! Stun clears.`,
      });
      continue;
    }

    const targets = aliveDefenders();
    if (targets.length === 0) break;

    // Maiden with no weapon cannot fire
    if (isMaiden(attacker) && !getWeapon(attacker)) {
      events.push({
        type: 'log',
        attackerName: getName(attacker),
        message: `[No Weapon] ${getName(attacker)} has no weapon and cannot fire!`,
      });
      continue;
    }

    const attackerName = getName(attacker);

    // Attacker breaks cover when firing
    if (coverSet.has(attackerName)) {
      coverSet.delete(attackerName);
      events.push({
        type: 'cover_lost',
        attackerName,
        message: `[Cover] ${attackerName} breaks cover to fire!`,
      });
    }

    // Pick a single target for this attacker's entire turn (machine guns stay locked on)
    const target = targets[Math.floor(Math.random() * targets.length)];
    const targetName = getName(target);
    const attackerId = isMaiden(attacker) ? (attacker as Maiden).id : (attacker as Enemy).id;
    const personalMorale = moraleMap?.get(attackerId) ?? 50;
    const hitRate = computeHitRate(attacker, target, personalMorale, attackerTeamMorale);

    // Determine how many shots this weapon fires per turn
    const weapon = getWeapon(attacker);
    const shotsThisTurn = (weapon?.shotsPerRound ?? 1);
    const isBurst = shotsThisTurn > 1;

    if (isBurst) {
      events.push({
        type: 'log',
        attackerName,
        message: `[${label}] ${attackerName} opens up with a burst of ${shotsThisTurn} shots at ${targetName}! (hit rate per shot: ${hitRate.toFixed(0)}%)`,
      });
    }

    let burstHits = 0;
    let burstMisses = 0;

    for (let shot = 0; shot < shotsThisTurn; shot++) {
      // Re-check: target may have died mid-burst
      if (target.currentHp <= 0) break;

      const roll = Math.random() * 100;

      if (roll <= hitRate) {
        const dmg = computeDamage(attacker);

        // Each shot independently checks cover
        if (coverLevel > 0 && coverSet.has(targetName)) {
          const blockRate = calculateCoverBlockRate(coverLevel);
          const blockRoll = Math.random() * 100;
          if (blockRoll <= blockRate) {
            if (!isBurst) {
              events.push({
                type: 'cover_blocked',
                attackerName,
                defenderName: targetName,
                message: `[Cover] ${targetName}'s cover blocks ${attackerName}'s shot! (${blockRate.toFixed(0)}% block)`,
              });
            }
            // For burst, tally and report summary later
            if (isBurst) burstMisses++;
            continue;
          }
        }

        // ── Lyssa 1-HP floor + stun ─────────────────────────────────────────
        const wouldDie = isLyssa(target) && target.currentHp - dmg <= 0;
        const hitAt1   = isLyssa(target) && target.currentHp === 1 && !wouldDie;
        const prevHp   = target.currentHp;
        target.currentHp = isLyssa(target)
          ? Math.max(1, target.currentHp - dmg)
          : Math.max(0, target.currentHp - dmg);

        if (wouldDie || hitAt1) {
          (target as Enemy).lyssaStunned = true;
          if (!isBurst) {
            events.push({
              type: 'attack',
              attackerName,
              defenderName: targetName,
              damage: dmg,
              message: `[${label}] ${attackerName} hits ${targetName} for ${dmg} damage.`,
            });
          }
          events.push({
            type: 'log',
            attackerName: targetName,
            message: wouldDie
              ? `⚡ [Lyssa Stun] ${targetName} cannot be slain — pinned to 1 HP and stunned!`
              : `⚡ [Lyssa Stun] ${targetName} is hit at 1 HP — stunned again!`,
          });
          if (prevHp > 1 && onKill) onKill(attacker, target, true);
          if (onHit) onHit(target, dmg);
          if (isBurst) burstHits++;
          // Stop burst if Lyssa is now stunned (1 HP)
          break;
        }

        if (!isBurst) {
          events.push({
            type: 'attack',
            attackerName,
            defenderName: targetName,
            damage: dmg,
            message: `[${label}] ${attackerName} hits ${targetName} for ${dmg} damage.`,
          });
        }
        if (isBurst) burstHits++;

        if (onHit) onHit(target, dmg);
        if (target.currentHp <= 0 && onKill) onKill(attacker, target, false);

        // Weapon practical EXP on first hit only
        if (shot === 0 && expGainsOut && isMaiden(attacker)) {
          const wt = getEquippedWeaponType(attacker);
          if (wt) expGainsOut.push({ maidenId: (attacker as Maiden).id, subject: 'weapon', weaponType: wt });
        }
      } else {
        if (isBurst) { burstMisses++; }
        else {
          // Sneak practical EXP for maiden defender on dodge (+1)
          if (expGainsOut && isMaiden(target)) {
            expGainsOut.push({ maidenId: (target as Maiden).id, subject: 'sneak' });
          }
          events.push({
            type: 'miss',
            attackerName,
            defenderName: targetName,
            message: `[${label}] ${attackerName} misses ${targetName}.`,
          });
        }
      }
    } // end shot loop

    // Burst summary event
    if (isBurst) {
      const totalBlocked = shotsThisTurn - burstHits - burstMisses;
      const parts: string[] = [];
      if (burstHits > 0) parts.push(`${burstHits} hit`);
      if (totalBlocked > 0) parts.push(`${totalBlocked} blocked`);
      if (burstMisses > 0) parts.push(`${burstMisses} miss`);
      const burstTotalDmg = burstHits * (weapon?.damage ?? 4);
      events.push({
        type: burstHits > 0 ? 'attack' : 'miss',
        attackerName,
        defenderName: targetName,
        damage: burstTotalDmg,
        // Keep "hits X for Y damage" so the UI replay regex can parse HP correctly.
        message: burstHits > 0
          ? `[${label}] ${attackerName} hits ${targetName} for ${burstTotalDmg} damage (burst: ${parts.join(', ')}, ${shotsThisTurn} shots).`
          : `[${label}] ${attackerName}'s burst at ${targetName}: all shots missed or blocked (${shotsThisTurn} shots).`,
      });
      // Sneak EXP for dodging maiden if all shots missed/blocked
      if (burstHits === 0 && expGainsOut && isMaiden(target)) {
        expGainsOut.push({ maidenId: (target as Maiden).id, subject: 'sneak' });
      }
    }

    if (false) { // dead code block — replaced by shot loop above
      // Sneak practical EXP for maiden defender on dodge (+1)
      if (expGainsOut && isMaiden(target)) {
        expGainsOut?.push({ maidenId: (target as Maiden).id, subject: 'sneak' });
      }
      events.push({
        type: 'miss',
        attackerName,
        defenderName: targetName,
        message: `[${label}] ${attackerName} misses ${targetName}.`,
      });
    }
  }
  return events;
}

export type StageOutcome = 'maiden_victory' | 'maiden_retreat_success' | 'maiden_captured' | 'enemy_retreat';

export interface MoraleGain {
  /** 'maiden' or 'enemy' — which team the gain applies to */
  team: 'maiden' | 'enemy';
  /** Which maiden/enemy ID earned this (if applicable) */
  combatantId?: string;
  /** Delta value (positive = bonus, negative = penalty) */
  delta: number;
  /** Reason string */
  reason: string;
  /** Round when this gain occurred: 0 = pre-battle, 1+ = encounter rounds */
  round?: number;
}

export interface StageResult {
  outcome: StageOutcome;
  events: CombatEvent[];
  updatedMaidens: Combatant[];
  updatedEnemies: Combatant[];
  /** Practical EXP gains earned by maidens during this stage */
  expGains: ExpGain[];
  /** Final team morale values */
  finalMorale: { maidenTeam: number; enemyTeam: number };
  /** Permanent morale gains/losses to apply to each combatant after the stage */
  moraleGains: MoraleGain[];
  /**
   * Net permanent morale delta per maiden ID (kills/stuns only, excludes temporary stage effects).
   * This is the value to persist to moralePermanentBonus.
   */
  permanentMoraleDeltas: Map<string, number>;
  /** Maiden IDs whose morale hit zero — escaped from battlefield */
  moraleEscapedIds: string[];
  /** Maiden IDs whose morale hit zero — captured by enemy */
  moraleCapturedIds: string[];
  /** Enemy IDs that escaped the battlefield (zako: morale=0 → 100%; lyssa: 25% per turn) */
  enemyEscapedIds: string[];
}

/**
 * Simulate a full combat stage.
 * `coverLevel`: terrain cover level 0-10 for this stage.
 * `playerRetreatsAtRound`: if set, the maiden team will attempt retreat at this round number.
 * `leaderId`: ID of the team leader maiden.
 */
export function simulateStage(
  maidens: Combatant[],
  enemies: Combatant[],
  coverLevel: number = 0,
  playerRetreatsAtRound?: number,
  leaderId?: string
): StageResult {
  const events: CombatEvent[] = [];
  const expGains: ExpGain[] = [];
  const moraleGains: MoraleGain[] = [];
  let mgRound = 0; // current round for morale gain tracking (0 = pre-battle)

  // Deep copy
  const m: Combatant[] = maidens.map(x => ({ ...x, equipment: [...x.equipment], qualifications: [...x.qualifications] }));
  const e: Combatant[] = enemies.map(x => ({ ...x, equipment: [...x.equipment], qualifications: [...x.qualifications] }));

  const alive = (team: Combatant[]) => team.filter(c => {
    if (c.currentHp <= 0) return false;
    // Escaped maidens have left the battlefield and are no longer active combatants
    if (isMaiden(c) && moraleZeroState.get((c as Maiden).id) === 'escaped') return false;
    // Escaped enemies have fled the battlefield
    if (!isMaiden(c) && enemyEscapedIds.includes((c as Enemy).id)) return false;
    return true;
  });
  const getId = (c: Combatant) => isMaiden(c) ? (c as Maiden).id : (c as Enemy).id;

  // ── Morale initialisation ────────────────────────────────────────────────
  // Team base morale
  let mTeamMorale = computeTeamMoraleBase(m, leaderId);
  let eTeamMorale = computeTeamMoraleBase(e);
  // Permanent morale bonuses for each individual
  const mPersonalPermBonus = new Map<string, number>(m.map(c => [getId(c), (c as any).moralePermanentBonus ?? 0]));
  const ePersonalPermBonus = new Map<string, number>(e.map(c => [getId(c), (c as any).moralePermanentBonus ?? 0]));
  // Current personal morale (base + perm)
  const personalMoraleMap = new Map<string, number>();
  for (const c of [...m, ...e]) {
    personalMoraleMap.set(getId(c), computePersonalMoraleBase(c));
  }

  // Track "morale zero" states for maidens: id → 'pending_check' | 'escaped' | 'captured'
  const moraleZeroState = new Map<string, 'pending_check' | 'escaped' | 'captured'>();
  const moraleEscapedIds: string[] = [];
  const moraleCapturedIds: string[] = [];
  const enemyEscapedIds: string[] = [];
  // Per-combatant accumulated hit temp penalty (cleared each stage, applied in refreshPersonalTempMorale)
  const hitTempPenaltyMap = new Map<string, number>();
  // Tracks the last HP temp bonus (+10 / 0 / -10) so HP-threshold crossings are logged separately from hit shock
  const prevTempBonusMap = new Map<string, number>();

  const applyTeamMorale = (team: 'maiden' | 'enemy', delta: number, reason: string, cId?: string) => {
    if (team === 'maiden') {
      mTeamMorale = Math.max(0, Math.min(100, mTeamMorale + delta));
    } else {
      eTeamMorale = Math.max(0, Math.min(100, eTeamMorale + delta));
    }
    moraleGains.push({ team, combatantId: cId, delta, reason, round: mgRound });
  };

  const applyPersonalMorale = (cId: string, delta: number, reason: string, team: 'maiden' | 'enemy') => {
    const current = personalMoraleMap.get(cId) ?? 50;
    const next = Math.max(0, Math.min(100, current + delta));
    personalMoraleMap.set(cId, next);
    moraleGains.push({ team, combatantId: cId, delta, reason, round: mgRound });
  };

  function emitMoraleSnapshot(evts: CombatEvent[]) {
    const personalSnapshot: Record<string, number> = {};
    for (const [id, val] of personalMoraleMap) {
      personalSnapshot[id] = val;
    }
    for (const ev of evts) {
      (ev as CombatEvent).moraleSnapshot = { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale, personal: personalSnapshot };
    }
  }

  // ── Recalculate team temp morale (call at start of each stage) ────────────
  let hasInitialized = false;
  const refreshTeamTempMorale = () => {
    const prevM = mTeamMorale;
    const prevE = eTeamMorale;
    const mBase = computeTeamMoraleBase(m, leaderId);
    const eBase = computeTeamMoraleBase(e);
    const mFallen = m.filter(c => c.currentHp <= 0).length;
    const eFallen = e.filter(c => c.currentHp <= 0).length;
    const mTemp = computeTeamMoraleTemp(alive(m), alive(e), m.length, mFallen);
    const eTemp = computeTeamMoraleTemp(alive(e), alive(m), e.length, eFallen);
    // Combine base + permanent bonuses accumulated so far + temp
    // Only count explicit team-level events (kills, KIA, stun) — exclude 'Initial' and 'Combat situation' recalculations
    const PERM_REASONS = new Set(['Kill', 'Lyssa stunned', 'Maiden fell']);
    const mPermBonus = moraleGains.filter(g => g.team === 'maiden' && !g.combatantId && PERM_REASONS.has(g.reason)).reduce((s, g) => s + g.delta, 0);
    const ePermBonus = moraleGains.filter(g => g.team === 'enemy' && !g.combatantId && PERM_REASONS.has(g.reason)).reduce((s, g) => s + g.delta, 0);
    mTeamMorale = Math.max(0, Math.min(100, mBase + mPermBonus + mTemp));
    eTeamMorale = Math.max(0, Math.min(100, eBase + ePermBonus + eTemp));
    if (hasInitialized) {
      const mDiff = Math.round(mTeamMorale) - Math.round(prevM);
      const eDiff = Math.round(eTeamMorale) - Math.round(prevE);
      if (mDiff !== 0) moraleGains.push({ team: 'maiden', delta: mDiff, reason: 'Combat situation', round: mgRound });
      if (eDiff !== 0) moraleGains.push({ team: 'enemy', delta: eDiff, reason: 'Combat situation', round: mgRound });
    }
  };

  // Recalculate personal temp morale (HP ratio + hit temp penalty)
  const refreshPersonalTempMorale = () => {
    for (const c of [...m, ...e]) {
      if (c.currentHp <= 0) continue; // skip dead
      const id = getId(c);
      const prevVal = personalMoraleMap.get(id);
      const permBonus = (isMaiden(c) ? mPersonalPermBonus : ePersonalPermBonus).get(id) ?? 0;
      const hpRatio = c.currentHp / c.maxHp;
      let tempBonus = 0;
      if (hpRatio > 0.7) tempBonus = 10;
      else if (hpRatio < 0.3) tempBonus = -10;
      // Hit temp penalty: −20 per hit received this stage (stacks)
      const hitPenalty = hitTempPenaltyMap.get(id) ?? 0;
      const newVal = Math.max(0, Math.min(100, 50 + getStat(c, 'charm') + permBonus + tempBonus + hitPenalty));
      personalMoraleMap.set(id, newVal);
      if (hasInitialized && prevVal !== undefined) {
        const team: 'maiden' | 'enemy' = isMaiden(c) ? 'maiden' : 'enemy';
        const prevTempBonus = prevTempBonusMap.get(id) ?? 0;
        const prevHitPenalty = hitTempPenaltyMap.get(id + '__prev') ?? (hitPenalty + (hitTempPenaltyMap.has(id) && !hitTempPenaltyMap.has(id + '__prev') ? 0 : 0));
        // Compute the unclamped components so we can attribute the diff correctly
        const unclamped = 50 + getStat(c, 'charm') + permBonus + tempBonus + hitPenalty;
        const prevUnclamped = 50 + getStat(c, 'charm') + permBonus + prevTempBonus + prevHitPenalty;
        const hpTempDelta = tempBonus - prevTempBonus;
        const hitShockDelta = hitPenalty - prevHitPenalty;
        // Log HP temp bonus change separately (threshold crossing)
        // "baseline with shock already applied" = prevUnclamped + hitShockDelta
        const baselineWithShock = prevUnclamped + hitShockDelta;
        if (hpTempDelta !== 0) {
          const hpReason = tempBonus > 0 ? 'HP high (+)' : tempBonus < 0 ? 'HP critical (−)' : prevTempBonus > 0 ? 'HP high lost' : 'HP critical recovered';
          // Attribute only the portion that fits within the clamp
          const clampedHpDelta = Math.round(Math.max(0, Math.min(100, unclamped)) - Math.max(0, Math.min(100, baselineWithShock)));
          if (clampedHpDelta !== 0) {
            moraleGains.push({ team, combatantId: id, delta: clampedHpDelta, reason: hpReason, round: mgRound });
          }
        }
        // Log hit shock change separately
        if (hitShockDelta !== 0) {
          const clampedShockDelta = Math.round(newVal) - Math.round(Math.max(0, Math.min(100, prevUnclamped))) - (hpTempDelta !== 0 ? Math.round(Math.max(0, Math.min(100, unclamped)) - Math.max(0, Math.min(100, baselineWithShock))) : 0);
          if (clampedShockDelta !== 0) {
            moraleGains.push({ team, combatantId: id, delta: clampedShockDelta, reason: 'Hit shock', round: mgRound });
          }
        }
        // If neither component changed but total did (rounding edge), log as morale refresh
        if (hpTempDelta === 0 && hitShockDelta === 0) {
          const diff = Math.round(newVal) - Math.round(prevVal);
          if (diff !== 0) {
            moraleGains.push({ team, combatantId: id, delta: diff, reason: 'Morale refresh', round: mgRound });
          }
        }
      }
      prevTempBonusMap.set(id, tempBonus);
      hitTempPenaltyMap.set(id + '__prev', hitTempPenaltyMap.get(id) ?? 0);
    }
  };

  // Initial morale calculation
  refreshTeamTempMorale();
  refreshPersonalTempMorale();
  hasInitialized = true;

  // Push initial morale entries so the log starts with baseline values
  moraleGains.push({ team: 'maiden', delta: Math.round(mTeamMorale), reason: 'Initial', round: 0 });
  moraleGains.push({ team: 'enemy', delta: Math.round(eTeamMorale), reason: 'Initial', round: 0 });
  for (const c of [...m, ...e]) {
    const id = getId(c);
    const val = personalMoraleMap.get(id) ?? 50;
    moraleGains.push({ team: isMaiden(c) ? 'maiden' : 'enemy', combatantId: id, delta: Math.round(val), reason: 'Initial', round: 0 });
  }

  {
    const initPersonal: Record<string, number> = {};
    for (const [id, val] of personalMoraleMap) initPersonal[id] = val;
    events.push({
      type: 'morale',
      attackerName: '',
      message: `⚡ [Morale] Your team morale: ${Math.round(mTeamMorale)} | Enemy morale: ${Math.round(eTeamMorale)}`,
      moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale, personal: initPersonal },
    });
  }

  // ── Kill / stun callback ──────────────────────────────────────────────────
  const onMaidenKill = (attacker: Combatant, _target: Combatant, isStun: boolean) => {
    const aid = getId(attacker);
    const isMaidenAttacker = isMaiden(attacker);
    const team: 'maiden' | 'enemy' = isMaidenAttacker ? 'maiden' : 'enemy';
    if (isStun) {
      // Team +2, personal +10 for maiden attacker
      applyTeamMorale(team, 2, 'Lyssa stunned', undefined);
      if (isMaidenAttacker) {
        applyPersonalMorale(aid, 10, 'Stunned a Lyssa', team);
        mPersonalPermBonus.set(aid, Math.min(100, (mPersonalPermBonus.get(aid) ?? 0) + 10));
      } else {
        applyPersonalMorale(aid, 10, 'Stunned a maiden Lyssa', team);
        ePersonalPermBonus.set(aid, Math.min(100, (ePersonalPermBonus.get(aid) ?? 0) + 10));
      }
    } else {
      // Kill: team +1, personal +10
      applyTeamMorale(team, 1, 'Kill', undefined);
      if (isMaidenAttacker) {
        applyPersonalMorale(aid, 10, 'Kill', team);
        mPersonalPermBonus.set(aid, Math.min(100, (mPersonalPermBonus.get(aid) ?? 0) + 10));
      } else {
        applyPersonalMorale(aid, 10, 'Kill', team);
        ePersonalPermBonus.set(aid, Math.min(100, (ePersonalPermBonus.get(aid) ?? 0) + 10));
      }
      // Death penalty for the opposing team
      if (isMaidenAttacker) {
        // enemy dies → no morale penalty for maiden team
        // maiden dies → maiden team morale -2
      } else {
        // a maiden was killed → maiden team loses morale -2
        applyTeamMorale('maiden', -2, 'Maiden fell', undefined);
        // personal morale of fallen maiden → will hit 0 handled below
      }
    }
  };

  const onEnemyKill = (attacker: Combatant, target: Combatant, isStun: boolean) => {
    const aid = getId(attacker);
    const isMaidenAttacker = isMaiden(attacker);
    const team: 'maiden' | 'enemy' = isMaidenAttacker ? 'maiden' : 'enemy';
    if (isStun) {
      applyTeamMorale(team, 2, 'Lyssa stunned', undefined);
      if (isMaidenAttacker) {
        applyPersonalMorale(aid, 10, 'Stunned a Lyssa', team);
        mPersonalPermBonus.set(aid, Math.min(100, (mPersonalPermBonus.get(aid) ?? 0) + 10));
      }
    } else {
      applyTeamMorale(team, 1, 'Kill', undefined);
      if (isMaidenAttacker) {
        applyPersonalMorale(aid, 10, 'Kill', team);
        mPersonalPermBonus.set(aid, Math.min(100, (mPersonalPermBonus.get(aid) ?? 0) + 10));
      } else {
        // enemy killed maiden → maiden team -2
        applyTeamMorale('maiden', -2, 'Maiden fell', undefined);
        // apply to target personal morale
        if (isMaiden(target)) {
          personalMoraleMap.set(getId(target), 0);
        }
      }
    }
  };

  const handleHit = (target: Combatant, damage: number) => {
    if (target.currentHp <= 0) return; // already dead — kill callback handles it
    const tid = getId(target);
    const tTeam: 'maiden' | 'enemy' = isMaiden(target) ? 'maiden' : 'enemy';
    // Permanent penalty: −damage points to permanent morale bonus
    applyPersonalMorale(tid, -damage, `Hit for ${damage} dmg`, tTeam);
    if (isMaiden(target)) {
      mPersonalPermBonus.set(tid, (mPersonalPermBonus.get(tid) ?? 0) - damage);
    } else {
      ePersonalPermBonus.set(tid, (ePersonalPermBonus.get(tid) ?? 0) - damage);
    }
    // Temp penalty: −20 for this stage (stacks per hit)
    hitTempPenaltyMap.set(tid, (hitTempPenaltyMap.get(tid) ?? 0) - 20);
  };

  const handleKill = (attacker: Combatant, target: Combatant, isStun: boolean) => {
    if (isMaiden(attacker)) {
      onEnemyKill(attacker, target, isStun);
    } else {
      onMaidenKill(attacker, target, isStun);
    }
  };

  // Check for maiden zero morale & handle escape/capture scheduling
  const checkZeroMoraleMaidens = () => {
    for (const c of alive(m)) {
      if (!isMaiden(c)) continue;
      const mid = (c as Maiden).id;
      if (moraleZeroState.has(mid)) continue; // already tracked
      // Use full displayed personal morale (base + perm + temp) — temp penalties like hit shock
      // and HP critical can push it to 0 and must trigger the flee check just as permanent losses do
      const currentMorale = personalMoraleMap.get(mid) ?? 50;
      if (currentMorale <= 0) {
        // Strip weapon permanently
        const maidenTyped = c as Maiden;
        const weapon = maidenTyped.equipment.find(eq => eq.slot === 'weapon');
        if (weapon) {
          (c as any).equipment = maidenTyped.equipment.filter(eq => eq.slot !== 'weapon');
          events.push({
            type: 'log', attackerName: getName(c),
            message: `💔 [Morale] ${getName(c)} has lost her nerve! She drops her weapon and cannot fight!`,
            moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale },
          });
        } else {
          events.push({
            type: 'log', attackerName: getName(c),
            message: `💔 [Morale] ${getName(c)} has lost her nerve and cannot fight!`,
            moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale },
          });
        }
        moraleZeroState.set(mid, 'pending_check');
      }
    }
  };

  // Resolve pending morale-zero escape checks
  const resolveMoraleEscapes = () => {
    for (const [mid, state] of moraleZeroState) {
      if (state !== 'pending_check') continue;
      const c = m.find(x => isMaiden(x) && (x as Maiden).id === mid);
      if (!c) continue;
      if (Math.random() < 0.5) {
        moraleZeroState.set(mid, 'escaped');
        moraleEscapedIds.push(mid);
        events.push({
          type: 'log', attackerName: getName(c),
          message: `🏃 [Morale] ${getName(c)} escapes from the battlefield in panic!`,
          moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale },
        });
        moraleGains.push({ team: 'maiden', combatantId: mid, delta: 0, reason: '🏃 FLED — escaped battlefield', round: mgRound });
      } else {
        moraleZeroState.set(mid, 'captured');
        moraleCapturedIds.push(mid);
        // Mark as fallen in simulation
        c.currentHp = 0;
        events.push({
          type: 'log', attackerName: getName(c),
          message: `⛓ [Morale] ${getName(c)} breaks down and is captured by the enemy!`,
          moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale },
        });
        moraleGains.push({ team: 'maiden', combatantId: mid, delta: 0, reason: '⛓ CAPTURED — morale collapse', round: mgRound });
      }
    }
  };

  // Check zako enemies whose personal morale hit 0 — they escape 100%
  const checkZeroMoraleEnemies = () => {
    for (const c of [...e]) {
      if (isMaiden(c)) continue;
      const enemy = c as Enemy;
      if (enemy.type !== 'zako') continue;
      if (enemyEscapedIds.includes(enemy.id)) continue;
      if (enemy.currentHp <= 0) continue;
      const morale = personalMoraleMap.get(enemy.id) ?? 50;
      if (morale <= 0) {
        enemyEscapedIds.push(enemy.id);
        events.push({
          type: 'log', attackerName: enemy.name,
          message: `🏃 [Enemy Morale] ${enemy.name} breaks and flees the battlefield!`,
          moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale },
        });
        moraleGains.push({ team: 'enemy', combatantId: enemy.id, delta: 0, reason: '🏃 FLED — morale 0', round: mgRound });
      }
    }
  };

  // On the enemy fire phase: each Lyssa whose morale has hit 0 rolls an escalating flee chance.
  // Base flee chance = 25%; increases by +10% per consecutive failed check (25% → 35% → 45% → …)
  // so a Lyssa cannot stall indefinitely by repeatedly rallying.
  const lyssaFleeCheckCount = new Map<string, number>(); // enemy.id → number of times checked
  const checkLyssaEscapeOrRecover = () => {
    for (const c of alive(e)) {
      if (isMaiden(c) || (c as Enemy).type !== 'lyssa') continue;
      const enemy = c as Enemy;
      const morale = personalMoraleMap.get(enemy.id) ?? 50;
      if (morale > 0) continue; // only zero-morale Lyssa face this check

      // Increment consecutive check counter and compute escalating flee probability
      const prevChecks = lyssaFleeCheckCount.get(enemy.id) ?? 0;
      const checkNumber = prevChecks + 1;
      lyssaFleeCheckCount.set(enemy.id, checkNumber);
      // 25% base + 10% per additional check, capped at 95%
      const fleePct = Math.min(0.95, 0.25 + (checkNumber - 1) * 0.10);

      if (Math.random() < fleePct) {
        enemyEscapedIds.push(enemy.id);
        const pctLabel = Math.round(fleePct * 100);
        events.push({
          type: 'log', attackerName: enemy.name,
          message: `🏃 [Lyssa] ${enemy.name} has lost her nerve and flees the battlefield! (flee chance: ${pctLabel}%, check #${checkNumber})`,
          moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale },
        });
      } else {
        const recovery = 50 + getStat(enemy, 'charm');
        const eid = enemy.id;
        const current = personalMoraleMap.get(eid) ?? 0;
        const next = Math.min(100, current + recovery);
        const pctLabel = Math.round(fleePct * 100);
        // Use applyPersonalMorale so the gain is recorded in moraleGains (morale log)
        applyPersonalMorale(eid, recovery, 'Lyssa rally', 'enemy');
        events.push({
          type: 'log', attackerName: enemy.name,
          message: `✨ [Lyssa] ${enemy.name} steels herself and fights on! (Morale +${recovery} → ${Math.min(100, next)}) [flee was ${pctLabel}%, check #${checkNumber} — next: ${Math.round(Math.min(0.95, fleePct + 0.10) * 100)}%]`,
          moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale },
        });
      }
    }
  };

  // Helper: fire round with morale context
  const fireWithMorale = (
    attackers: Combatant[],
    defenders: Combatant[],
    label: string,
    isMaidenAttacking: boolean,
  ) => {
    // Filter out zero-morale maidens from attacking
    const filteredAttackers = attackers.filter(c => {
      if (!isMaiden(c)) return true;
      const mid = (c as Maiden).id;
      return !moraleZeroState.has(mid);
    });
    // Filter out escaped combatants from being targeted — they have left the battlefield
    const filteredDefenders = defenders.filter(c => {
      if (isMaiden(c)) {
        const mid = (c as Maiden).id;
        return moraleZeroState.get(mid) !== 'escaped';
      }
      return !enemyEscapedIds.includes((c as Enemy).id);
    });
    const teamMorale = isMaidenAttacking ? mTeamMorale : eTeamMorale;
    const roundEvts = fireRound(
      filteredAttackers, filteredDefenders, label, coverSet, coverLevel, expGains,
      personalMoraleMap, teamMorale, handleKill, handleHit,
    );
    emitMoraleSnapshot(roundEvts);
    return roundEvts;
  };

  const coverSet = new Set<string>();

  // Leader strategy bonus
  const leaderStratBonus = (() => {
    if (!leaderId || coverLevel === 0) return 0;
    const leader = m.find(c => isMaiden(c) && (c as Maiden).id === leaderId) as Maiden | undefined;
    return leader ? getStat(leader, 'strategy') * 2 : 0;
  })();

  function applyCoverChecks(team: Combatant[], isMaidenTeam: boolean): CombatEvent[] {
    const evts: CombatEvent[] = [];
    if (coverLevel === 0) return evts;
    for (const c of alive(team)) {
      const name = getName(c);
      if (coverSet.has(name)) continue;
      const baseChance = calculateCoverChance(c, coverLevel);
      const chance = Math.max(0, Math.min(95, baseChance + (isMaidenTeam ? leaderStratBonus : 0)));
      if (Math.random() * 100 <= chance) {
        coverSet.add(name);
        evts.push({ type: 'cover_gained', attackerName: name, message: `[Cover] ${name} takes cover! (${chance.toFixed(0)}% chance)`, moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
        if (isMaidenTeam && isMaiden(c)) {
          expGains.push({ maidenId: (c as Maiden).id, subject: 'sneak' });
        }
      }
    }
    return evts;
  }

  // ── STARVATION NOTICES ───────────────────────────────────────────────────
  for (const c of m) {
    if (isMaiden(c) && (c as Maiden).isStarved) {
      const name = (c as Maiden).nickname ?? (c as Maiden).name.split(' ')[0];
      events.push({ type: 'log', attackerName: name, message: `🥀 [Starved] ${name} marched without rations — HP halved, −50% hit / dodge / scout / cover.`, moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      // Morale log entry for the -3 permanent morale penalty
      const id = (c as Maiden).id;
      moraleGains.push({ team: 'maiden', combatantId: id, delta: -3, reason: 'Starved', round: mgRound });
    }
  }

  // ── SPOT PHASE ───────────────────────────────────────────────────────────
  const spotResult = resolveSpot(alive(m), alive(e));
  events.push({ type: 'log', attackerName: '', message: `--- SPOT PHASE: ${spotResult.spotter === 'maiden' ? 'Your team spots the enemy first!' : spotResult.spotter === 'enemy' ? 'Enemy spots you first!' : 'Both teams spot each other simultaneously!'} (${spotResult.rounds} round${spotResult.rounds !== 1 ? 's' : ''})`, moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });

  if (spotResult.spotter === 'maiden' || spotResult.spotter === 'simultaneous') {
    if (spotResult.bestScoutMaidenId) expGains.push({ maidenId: spotResult.bestScoutMaidenId, subject: 'scout' });
  }
  if (spotResult.spotter === 'maiden') {
    for (const c of alive(m)) {
      if (isMaiden(c)) expGains.push({ maidenId: (c as Maiden).id, subject: 'sneak' });
    }
  }

  if (coverLevel > 0) {
    const leaderNote = leaderStratBonus > 0 ? ` | Leader +${leaderStratBonus}% cover bonus` : '';
    events.push({ type: 'log', attackerName: '', message: `--- COVER CHECK (Terrain Level ${coverLevel}${leaderNote}) ---`, moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
    events.push(...applyCoverChecks(m, true));
    events.push(...applyCoverChecks(e, false));
  }

  // ── SURPRISE FIRE ─────────────────────────────────────────────────────────
  if (spotResult.spotter === 'maiden') {
    events.push({ type: 'log', attackerName: '', message: '--- SURPRISE FIRE: Your team fires first!', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
    events.push(...fireWithMorale(alive(m), e, 'Surprise', true));
    refreshTeamTempMorale(); refreshPersonalTempMorale(); checkZeroMoraleMaidens(); checkZeroMoraleEnemies();
  } else if (spotResult.spotter === 'enemy') {
    events.push({ type: 'log', attackerName: '', message: '--- SURPRISE FIRE: Enemy fires first!', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
    events.push(...fireWithMorale(alive(e), m, 'Surprise', false));
    refreshTeamTempMorale(); refreshPersonalTempMorale(); checkZeroMoraleMaidens(); checkZeroMoraleEnemies();
  }

  // ── HELPER: build stage result ────────────────────────────────────────────
  const makeResult = (outcome: StageOutcome): StageResult => {
    // Assign round numbers to all events based on encounter round log markers
    let evtRound = 0;
    for (const ev of events) {
      if (ev.type === 'log') {
        const rm = ev.message.match(/--- ENCOUNTER ROUND (\d+) ---/);
        if (rm) evtRound = parseInt(rm[1]);
      }
      ev.round = evtRound;
    }
    // Compute net permanent deltas: final permBonus - starting permBonus for each maiden
    const permanentMoraleDeltas = new Map<string, number>();
    for (const c of m) {
      const id = getId(c);
      const original = (c as any).moralePermanentBonus ?? 0;
      const final = mPersonalPermBonus.get(id) ?? original;
      const delta = final - original;
      if (delta !== 0) permanentMoraleDeltas.set(id, delta);
    }
    return {
      outcome,
      events,
      updatedMaidens: m,
      updatedEnemies: e,
      expGains,
      finalMorale: { maidenTeam: Math.round(mTeamMorale), enemyTeam: Math.round(eTeamMorale) },
      moraleGains,
      permanentMoraleDeltas,
      moraleEscapedIds,
      moraleCapturedIds,
      enemyEscapedIds,
    };
  };

  // ── ENCOUNTER ROUNDS ──────────────────────────────────────────────────────
  let round = 0;
  while (alive(m).length > 0 && alive(e).length > 0) {
    round++;
    mgRound = round;
    events.push({ type: 'log', attackerName: '', message: `--- ENCOUNTER ROUND ${round} ---`, moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });

    if (coverLevel > 0) {
      events.push(...applyCoverChecks(m, true));
      events.push(...applyCoverChecks(e, false));
    }

    // Team morale == 0: force retreat
    if (mTeamMorale <= 0 && alive(m).length > 0) {
      events.push({ type: 'log', attackerName: '', message: '--- MORALE COLLAPSE: Your team has lost all will to fight and retreats!', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      for (const c of alive(m)) { coverSet.delete(getName(c)); }
      events.push(...fireWithMorale(alive(e), m, 'Morale Retreat Fire', false));
      const survivingMaidens = alive(m).length;
      const survivingEnemies = alive(e).length;
      if (survivingMaidens <= survivingEnemies / 3) {
        events.push({ type: 'log', attackerName: '', message: '--- RETREAT FAILED: Maidens captured!', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
        return makeResult('maiden_captured');
      }
      events.push({ type: 'log', attackerName: '', message: '--- RETREAT SUCCESS (morale)!', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      return makeResult('maiden_retreat_success');
    }

    // Player-initiated retreat
    if (playerRetreatsAtRound !== undefined && round >= playerRetreatsAtRound) {
      events.push({ type: 'log', attackerName: '', message: '--- RETREAT: Your team attempts to retreat!', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      for (const c of alive(m)) { coverSet.delete(getName(c)); }
      events.push(...fireWithMorale(alive(e), m, 'Retreat Fire', false));
      const survivingMaidens = alive(m).length;
      const survivingEnemies = alive(e).length;
      if (survivingMaidens <= survivingEnemies / 3) {
        events.push({ type: 'log', attackerName: '', message: '--- RETREAT FAILED: Maidens captured!', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
        return makeResult('maiden_captured');
      }
      events.push({ type: 'log', attackerName: '', message: '--- RETREAT SUCCESS!', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      return makeResult('maiden_retreat_success');
    }

    events.push(...fireWithMorale(alive(m), e, 'Attack', true));
    refreshTeamTempMorale(); refreshPersonalTempMorale(); checkZeroMoraleMaidens(); checkZeroMoraleEnemies();

    if (alive(e).length === 0) {
      events.push({ type: 'log', attackerName: '', message: '--- VICTORY! All enemies defeated or fled.', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      return makeResult('maiden_victory');
    }

    // Lyssa escape-or-rally check before they fire
    checkLyssaEscapeOrRecover();

    if (alive(e).length === 0) {
      events.push({ type: 'log', attackerName: '', message: '--- VICTORY! All Lyssa enemies have fled the battlefield.', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      return makeResult('maiden_victory');
    }

    events.push(...fireWithMorale(alive(e), m, 'Counter', false));
    refreshTeamTempMorale(); refreshPersonalTempMorale(); checkZeroMoraleMaidens(); checkZeroMoraleEnemies();

    // Morale-zero escape check at end of round
    resolveMoraleEscapes();

    if (alive(m).length === 0) {
      events.push({ type: 'log', attackerName: '', message: '--- DEFEAT: All maidens fallen. Survivors captured.', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      return makeResult('maiden_captured');
    }

    // Enemy retreat: 70% dead or escaped
    const totalEnemies = e.length;
    const deadOrEscapedEnemies = e.filter(c => c.currentHp <= 0 || enemyEscapedIds.includes((c as Enemy).id)).length;
    if (deadOrEscapedEnemies / totalEnemies >= 0.7) {
      events.push({ type: 'log', attackerName: '', message: `--- ENEMY RETREATS: 70% dead or fled!`, moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
      events.push(...fireWithMorale(alive(m), e, 'Retreat Fire on Enemy', true));
      return makeResult('enemy_retreat');
    }

    // Emit morale update event each round
    events.push({
      type: 'morale',
      attackerName: '',
      message: `⚡ [Morale] Your team: ${Math.round(mTeamMorale)} | Enemy: ${Math.round(eTeamMorale)}`,
      moraleSnapshot: { maidenTeam: Math.round(mTeamMorale), enemyTeam: Math.round(eTeamMorale) },
    });
  }

  if (alive(m).length > 0 && alive(e).length === 0) {
    events.push({ type: 'log', attackerName: '', message: '--- VICTORY! All enemies defeated.', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
    return makeResult('maiden_victory');
  }

  events.push({ type: 'log', attackerName: '', message: '--- DEFEAT: All maidens fallen. Survivors captured.', moraleSnapshot: { maidenTeam: mTeamMorale, enemyTeam: eTeamMorale } });
  return makeResult('maiden_captured');
}
