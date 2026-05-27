import type { Maiden } from './maiden';
import type { Team } from './team';
import type { Mission } from './mission';
import type { Building } from './building';
import type { Equipment } from './equipment';
import type { MBase } from './mbase';

export interface MeridianMissionRecord {
  missionId: string;
  kills: number;
  deaths: number;
  deployedCount: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme' | 'hell';
  isWin: boolean;
}

export interface MeridianStats {
  recentMissions: MeridianMissionRecord[];
  totalMissionsDone: number;
}

export interface SaveData {
  saveVersion: number;
  savedAt: string;
  mbase: MBase;
  maidens: Maiden[];
  teams: Team[];
  missions: Mission[];
  buildings: Building[];
  inventory: Equipment[];
  freeRecruitCount: number;
  defaultTeamId?: string;
  /** Current HQ shop listing (equipment IDs). Empty = needs generation. */
  hqShopItems?: string[];
  /** Rolling mission history for The Meridian building review. */
  meridianStats?: MeridianStats;
  /** If true, automatically recruit to fill empty beds after every mission. */
  autoRecruit?: boolean;
  /** Countdown to the next Lyssa Wave. When 0, the next refreshMissions generates a wave. */
  missionsUntilNextWave?: number;
  /**
   * Number of consecutive "easy" difficulty missions completed (win or lose) by the player.
   * Tiers 1–2 only. When this reaches 5, HQ forces the next mission set to contain no easy
   * assignments. Resets to 0 once the player completes any non-easy mission.
   */
  consecutiveEasyMissions?: number;
}
