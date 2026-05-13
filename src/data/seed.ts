import { v4 as uuidv4 } from 'uuid';
import type { SaveData } from '../types/save';
import type { Maiden } from '../types/maiden';
import buildingsData from '../data/buildings.json';
import type { Building } from '../types/building';
import type { Mission } from '../types/mission';
import { recruitMaiden, heroineDefToMaiden } from '../engine/recruit';
import { HEROINE_DEFINITIONS } from '../data/heroines';
import { generateMissionSet } from '../engine/missionGen';
import equipmentData from '../data/equipment.json';
import type { Equipment } from '../types/equipment';

function makeInventoryItem(id: string): Equipment {
  const template = (equipmentData as Equipment[]).find(e => e.id === id);
  if (!template) throw new Error(`Equipment template not found: ${id}`);
  return { ...template, inventoryId: uuidv4() };
}

/**
 * Generate the seed roster: 9 randomised zako maidens + 1 starting heroine.
 *
 * Zako maidens are created with the same recruitMaiden() path used in-game,
 * so they get proper randomised stats, names, and tag composition (2pos+1de+1neg).
 *
 * The starting heroine is always Valkyria von Ashtern (imgId 1, recruit-status)
 * — a reliable, recognisable anchor for the opening squad.
 */
function generateSeedMaidens(): Maiden[] {
  const zakos: Maiden[] = [];
  // recruitMaiden has a 3% heroine chance; force zako by looping until we get one
  while (zakos.length < 9) {
    const m = recruitMaiden([]);
    if (m.type === 'zako') zakos.push(m);
  }

  const startingHeroineDef = HEROINE_DEFINITIONS.find(h => h.id === 'heroine_000')!;
  const heroine = heroineDefToMaiden(startingHeroineDef);
  heroine.isFavourite = true;

  return [heroine, ...zakos];
}

export const SEED_MAIDENS: Maiden[] = generateSeedMaidens();
const ALPHA_SQUAD_ID = uuidv4();

// Generate initial missions from the seed roster (no captured maidens yet)
const SEED_MISSIONS: Mission[] = generateMissionSet(SEED_MAIDENS, []);

export const INITIAL_SAVE: SaveData = {
  saveVersion: 1,
  savedAt: new Date().toISOString(),
  mbase: {
    name: 'Fort Waelfeld',
    money: 100,
    food: 500,
    beds: 20,
    wood: 200,
    metal: 60,
    maidenCount: 15,
  },
  maidens: SEED_MAIDENS,
  teams: [
    {
      id: ALPHA_SQUAD_ID,
      name: 'Alpha Squad',
      type: 'maiden',
      memberIds: SEED_MAIDENS.map(m => m.id),
      leaderId: SEED_MAIDENS[0].id,
      compositionChoiceId: 'scouting_team',
    },
  ],
  missions: SEED_MISSIONS,
  buildings: buildingsData as Building[],
  inventory: [
    makeInventoryItem('light_machine_gun'),
    makeInventoryItem('heavy_machine_gun'),
  ],
  freeRecruitCount: 5,
  defaultTeamId: ALPHA_SQUAD_ID,
};
