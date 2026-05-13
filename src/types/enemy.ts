import type { Stats, StatusEffect, Tag } from './stats';
import type { Equipment, Skill } from './equipment';
import type { ExpData } from './maiden';
import type { Qualification } from './qualification';

export interface Enemy {
  id: string;
  /** 'lyssa' = unique undead boss (never drops below 1 HP; stunned when pinned); 'zako' = generic enemy */
  type: 'lyssa' | 'zako';
  /**
   * Numeric image ID. Determines folder and filename.
   * 1000-1899 → public/imgs/enemy/{XXXX}.png / {XXXX}i.png  (Lyssa)
   * 1900-1999 → public/imgs/enemy/{XXXX}.png / {XXXX}i.png  (zako enemy)
   */
  imgId: number;
  /** Runtime flag: true when a Lyssa is currently stunned (pinned to 1 HP) */
  lyssaStunned?: boolean;
  name: string;
  stats: Stats;
  maxHp: number;
  currentHp: number;
  equipment: Equipment[];
  qualifications: Qualification[];
  tags: Tag[];
  skills: Skill[];
  statusEffects: StatusEffect[];
  /** EXP data — predefined for enemies, affects combat effectiveness */
  expData?: ExpData;
  /** Permanent morale bonus (for enemies) */
  moralePermanentBonus?: number;
}
