import type { Stats, StatusEffect, Tag } from './stats';
import type { Equipment, Skill, WeaponType } from './equipment';
import type { Qualification } from './qualification';

export interface SubjectExp {
  theoryExp: number;
  practicalExp: number;
}

export type WeaponExpMap = Partial<Record<WeaponType, SubjectExp>>;

export interface ExpData {
  weapons: WeaponExpMap;
  scout: SubjectExp;
  sneak: SubjectExp;
}

export function defaultExpData(): ExpData {
  return {
    weapons: {},
    scout: { theoryExp: 0, practicalExp: 0 },
    sneak: { theoryExp: 0, practicalExp: 0 },
  };
}

export interface Maiden {
  id: string;
  /** 'heroine' = unique named character; 'zako' = generic recruit */
  type: 'heroine' | 'zako';
  /** Links to a HeroineDef.id when type === 'heroine' */
  heroineId?: string;
  /** 'recruit' = can appear in recruitment pool; 'rescue' = must be rescued in a mission */
  heroineStatus?: 'recruit' | 'rescue';
  /**
   * Numeric image ID. Determines folder and filename.
   * 0-899   → public/imgs/chars/{XXX}.png / {XXX}i.png  (zako maiden)
   * 900-999 → public/imgs/chars/{XXX}.png / {XXX}i.png  (heroine)
   */
  imgId: number;
  name: string;
  nickname?: string;
  isFavourite: boolean;
  /** Base stats */
  stats: Stats;
  /** Computed max HP = 7 + 2 × constitution + equipment bonuses */
  maxHp: number;
  currentHp: number;
  equipment: Equipment[];
  qualifications: Qualification[];
  tags: Tag[];
  skills: Skill[];
  /** In-combat temporary effects */
  statusEffects: StatusEffect[];
  /** Kill count for qualification unlock tracking */
  killCount: number;
  /** Mission participation count */
  missionCount: number;
  /** Whether maiden is currently deployed on a mission */
  isDeployed: boolean;
  /** Whether the maiden has been captured by enemies */
  isCaptured: boolean;
  /** Whether the maiden has fallen in battle (dead) */
  isFallen: boolean;
  /** EXP tracking for weapons, scouting and sneaking */
  expData?: ExpData;
  /**
   * Permanent morale bonus accumulated through combat actions (kills, stuns).
   * Personal morale display = clamp(50 + charm + moralePermanentBonus, 0, 100)
   * (temporary stage bonuses are computed on the fly, not stored here)
   */
  moralePermanentBonus?: number;
  /** Quit status: 'escaped' = fled battlefield, 'captured' = taken by enemy due to zero morale */
  moraleQuitStatus?: 'escaped' | 'captured' | null;
  /**
   * Set transiently at mission start when the base had insufficient food to fully feed this maiden.
   * While starved, hit rate, dodge, scout score, and cover chance are all halved.
   * This flag is never persisted to the store — it lives only in missionState.stageMaidens.
   */
  isStarved?: boolean;
}
