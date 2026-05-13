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
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
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
}
