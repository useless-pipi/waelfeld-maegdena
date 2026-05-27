import type { Enemy } from './enemy';
import type { Equipment } from './equipment';

export type WeatherType = 'clear' | 'rain' | 'fog' | 'snow' | 'storm';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme' | 'hell';

export interface MissionReward {
  money?: number;
  food?: number;
  wood?: number;
  metal?: number;
  equipment?: Equipment[];
  qualificationIds?: string[];
  /** HeroineDef IDs to rescue and add to the party on mission victory */
  rescuedHeroineIds?: string[];
}

/**
 * One group of zako enemies within a stage template.
 * Multiple groups allow a stage to mix weapon types and quality tiers.
 */
export interface ZakoGroup {
  /** Number of zako to generate for this group. */
  count: number;
  /**
   * Combat power from 1 (weakest) to 10 (strongest).
   * Affects stat base and weapon tier selection.
   */
  quality: number;
  /**
   * Weapon class for this group.
   * One of: 'rifle' | 'shotgun' | 'smg' | 'machine_gun' | 'lmg'
   */
  weaponType: string;
}

/**
 * Describes how to procedurally generate enemies for a stage.
 * When present on a MissionStage, enemies are generated fresh each time
 * the stage is initialized (so every run faces different zako).
 */
export interface StageEnemyTemplate {
  /** Optional list of LyssaDef ids to spawn (from src/data/lyssas.ts). */
  lyssaIds?: string[];
  /**
   * One or more zako groups. Each group spawns `count` enemies of the given
   * quality and weapon type, allowing a stage to mix weapon classes and tiers.
   *
   * Example: [{ count: 3, quality: 4, weaponType: 'rifle' },
   *           { count: 1, quality: 6, weaponType: 'machine_gun' }]
   */
  zako: ZakoGroup[];
}

export interface MissionStage {
  id: string;
  name: string;
  /** Static enemy list — used as fallback when no template is defined. */
  enemies: Enemy[];
  description?: string;
  /** Cover level 0-10: how much natural cover the terrain provides */
  coverLevel: number;
  /**
   * When present, enemies are generated procedurally each time this stage
   * starts. Overrides the static `enemies` array.
   */
  template?: StageEnemyTemplate;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  weather: WeatherType;
  stages: MissionStage[];
  reward: MissionReward;
  /** IDs of maidens captured in this mission (to be rescued) */
  capturedMaidenIds: string[];
  /** Whether the mission has been completed */
  isCompleted: boolean;
  /** Whether the mission is currently locked */
  isLocked: boolean;
  /** Reward specialisation focus assigned at generation time */
  rewardFocus?: 'gold_heavy' | 'supply_run' | 'medal' | 'weapon_gear' | 'consumable' | 'balanced' | 'strike_force' | 'rescue' | 'lyssa_wave';
  /** True when this mission is a mandatory Lyssa Wave base-defence event */
  isLyssaWave?: boolean;
}
