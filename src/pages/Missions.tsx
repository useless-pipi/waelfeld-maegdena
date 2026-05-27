import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { simulateStage, computePersonalMoraleBase, getStat, type StageOutcome, type CombatEvent, type ExpGain } from '../engine/combat';
import { computeForceStrengthIndex, TIER_CONFIGS } from '../engine/missionGen';
import type { Maiden } from '../types/maiden';
import type { Equipment } from '../types/equipment';
import { getUnitIcon, getMaidenIcon } from '../utils/portraits';
import { HEROINE_DEFINITIONS } from '../data/heroines';
import { heroineDefToMaiden, recruitMaiden, enrichRecruitGear, computeFullMaxHp } from '../engine/recruit';
import { initializeStageEnemies, enrichEnemyGear } from '../engine/missionGen';
import equipmentData from '../data/equipment.json';

const allEquipment = (equipmentData as Equipment[]).filter(e => !(e as any).faction);
const _BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// ── Battle-speed cookie ───────────────────────────────────────────────────────
const SPEED_COOKIE = 'wm_battle_speed';

function readSpeedCookie(): 1 | 2 | 4 | 8 {
  const match = document.cookie.split('; ').find(r => r.startsWith(SPEED_COOKIE + '='));
  if (match) {
    const v = parseInt(match.split('=')[1], 10);
    if (v === 1 || v === 2 || v === 4 || v === 8) return v;
  }
  return 1;
}

function writeSpeedCookie(speed: 1 | 2 | 4 | 8) {
  // Expires in 1 year
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${SPEED_COOKIE}=${speed}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

// ── Auto-equip ────────────────────────────────────────────────────────────────
const AUTO_EQUIP_SLOTS = ['weapon','head','mask','body','arms','legs','accessory','medal','potion','ration','grenade'] as const;
type AutoEquipSlot = typeof AUTO_EQUIP_SLOTS[number];
type AutoEquipConfig = Record<AutoEquipSlot, boolean>;

const AE_LS_KEY = 'wm_auto_equip_v2';
const AE_SLOT_LABELS: Record<AutoEquipSlot, string> = {
  weapon: '🔫 Weapon', head: '⛑️ Head', mask: '🎭 Mask', body: '🥋 Body',
  arms: '🧤 Arms', legs: '👢 Legs', accessory: '🔭 Accessory', medal: '🏅 Medal',
  potion: '💊 Potions', ration: '🍖 Rations', grenade: '💣 Grenades',
};

function loadAutoEquipConfig(): AutoEquipConfig {
  try {
    const raw = localStorage.getItem(AE_LS_KEY);
    if (raw) return JSON.parse(raw) as AutoEquipConfig;
  } catch { /* ignore */ }
  // Default: all off
  return Object.fromEntries(AUTO_EQUIP_SLOTS.map(s => [s, false])) as AutoEquipConfig;
}

function saveAutoEquipConfig(cfg: AutoEquipConfig) {
  localStorage.setItem(AE_LS_KEY, JSON.stringify(cfg));
}

/** Score an equipment item for auto-equip comparison (higher = better). */
function rateItem(item: Equipment): number {
  let score = 0;
  for (const b of (item.bonuses ?? [])) {
    const val = b.isPercent ? b.value * 0.5 : b.value;
    switch (b.stat) {
      case 'hp':           score += val * 1.0; break;
      case 'strength':     score += val * 2.0; break;
      case 'dexterity':    score += val * 2.0; break;
      case 'constitution': score += val * 2.0; break;
      case 'awareness':    score += val * 1.5; break;
      case 'strategy':     score += val * 1.5; break;
      case 'charm':        score += val * 1.0; break;
      case 'hitRate':      score += val * 1.5; break;
      case 'dodge':        score += val * 1.5; break;
      default:             score += val;
    }
  }
  if (item.slot === 'weapon') {
    score += (item.damage ?? 0) * 2;
    score += ((item.shotsPerRound ?? 1) - 1) * 5;
    score += (item.hitRateBonus ?? 0) * 0.5;
  }
  return score;
}

type ConsumableCategory = 'potion' | 'ration' | 'grenade';
function consumableCategory(item: Equipment): ConsumableCategory | null {
  if (item.slot !== 'consumable') return null;
  if (item.healPercent != null) return 'potion';
  if (item.rationMoraleBonus != null || item.rationHpBonus != null) return 'ration';
  if ((item as any).weaponType === 'grenade' || item.burstPercent != null) return 'grenade';
  return null;
}

/**
 * Compute the auto-equip changes for a set of deploying maidens.
 * Returns updated maiden equipment arrays and which inventory item ids to remove from stock.
 */
function autoEquipForMission(
  deployingMaidens: Maiden[],
  inventory: Equipment[],
  cfg: AutoEquipConfig,
  stageCount: number,
): { updatedMaidens: { id: string; equipment: Equipment[]; maxHp: number; currentHp: number }[]; removedInventoryIds: string[] } {
  // Work on clones — shared inventory pool shrinks as items are assigned
  // Priority order: heroines first (in any order), then zakos by charm descending
  const workMaidens = [...deployingMaidens]
    .sort((a, b) => {
      const aH = a.type === 'heroine' ? 0 : 1;
      const bH = b.type === 'heroine' ? 0 : 1;
      if (aH !== bH) return aH - bH;
      return (b.stats.charm ?? 0) - (a.stats.charm ?? 0);
    })
    .map(m => ({ id: m.id, equipment: [...m.equipment], maxHp: m.maxHp, currentHp: m.currentHp, stats: m.stats }));
  let workInventory: Equipment[] = inventory
    .filter(i => i.inventoryId && i.faction !== 'enemy')
    .map(i => ({ ...i }));
  const removedInventoryIds: string[] = [];

  const removeFromInv = (invId: string) => {
    const idx = workInventory.findIndex(i => i.inventoryId === invId);
    if (idx !== -1) { workInventory.splice(idx, 1); removedInventoryIds.push(invId); }
  };

  for (const m of workMaidens) {
    const getWeight = () => m.equipment.reduce((s, e) => s + (e.weight ?? 0), 0);
    const getMaxWeight = () => {
      const str = m.stats.strength + m.equipment.reduce((s, e) =>
        s + (e.bonuses ?? []).filter(b => b.stat === 'strength').reduce((ss, b) => ss + b.value, 0), 0);
      return 20 + 5 * str;
    };
    const canFit = (item: Equipment) => getWeight() + (item.weight ?? 0) <= getMaxWeight();

    // ── Exclusive slots ────────────────────────────────────────────────────────
    for (const slot of ['weapon','head','mask','body','arms','legs'] as AutoEquipSlot[]) {
      if (!cfg[slot]) continue;
      const candidates = workInventory.filter(i => i.slot === slot);
      if (candidates.length === 0) continue;
      const best = candidates.reduce((a, b) => rateItem(b) > rateItem(a) ? b : a);
      const current = m.equipment.find(e => e.slot === slot);
      if (current && rateItem(best) <= rateItem(current)) continue; // already has better or equal
      // Compute post-swap effective STR (same logic as gameStore.equipItem)
      const currentStrBonus = m.equipment.reduce((s, e) =>
        s + (e.bonuses ?? []).filter(b => b.stat === 'strength').reduce((ss, b) => ss + b.value, 0), 0);
      const displacedStrBonus = current
        ? (current.bonuses ?? []).filter(b => b.stat === 'strength').reduce((s, b) => s + b.value, 0)
        : 0;
      const bestStrBonus = (best.bonuses ?? []).filter(b => b.stat === 'strength').reduce((s, b) => s + b.value, 0);
      const postSwapStr = m.stats.strength + currentStrBonus - displacedStrBonus + bestStrBonus;
      const postSwapMax = 20 + 5 * postSwapStr;
      const removed = current ? (current.weight ?? 0) : 0;
      const newW = getWeight() - removed + (best.weight ?? 0);
      if (newW > postSwapMax) continue; // would exceed post-swap capacity
      removeFromInv(best.inventoryId!);
      if (current) workInventory.push({ ...current }); // displaced goes back to pool
      m.equipment = m.equipment.filter(e => e.slot !== slot);
      m.equipment.push({ ...best });
    }

    // ── Accessories ────────────────────────────────────────────────────────────
    if (cfg['accessory']) {
      const pool = workInventory.filter(i => i.slot === 'accessory').sort((a, b) => rateItem(b) - rateItem(a));
      for (const item of pool) {
        if (!canFit(item)) continue;
        removeFromInv(item.inventoryId!);
        m.equipment.push({ ...item });
      }
    }

    // ── Medals ─────────────────────────────────────────────────────────────────
    if (cfg['medal']) {
      const pool = workInventory.filter(i => i.slot === 'medal').sort((a, b) => ((b as any).medalRarity ?? 0) - ((a as any).medalRarity ?? 0));
      for (const item of pool) {
        if (!canFit(item)) continue;
        removeFromInv(item.inventoryId!);
        m.equipment.push({ ...item });
      }
    }

    // ── Consumables ────────────────────────────────────────────────────────────
    const consumableFlagMap: Record<ConsumableCategory, AutoEquipSlot> = {
      potion: 'potion', ration: 'ration', grenade: 'grenade',
    };
    for (const cat of ['potion','ration','grenade'] as ConsumableCategory[]) {
      if (!cfg[consumableFlagMap[cat]]) continue;
      const alreadyHave = m.equipment.filter(e => consumableCategory(e as Equipment) === cat).length;
      const need = Math.max(0, stageCount - alreadyHave);
      if (need === 0) continue;
      const pool = workInventory
        .filter(i => consumableCategory(i) === cat)
        .sort((a, b) => rateItem(b) - rateItem(a));
      let taken = 0;
      for (const item of pool) {
        if (taken >= need) break;
        if (!canFit(item)) continue;
        removeFromInv(item.inventoryId!);
        m.equipment.push({ ...item });
        taken++;
      }
    }

    // Recompute maxHp / currentHp using the full formula (flat + percent bonuses from all sources)
    const originalMaiden = deployingMaidens.find(d => d.id === m.id)!;
    m.maxHp = computeFullMaxHp(originalMaiden.stats.constitution, m.equipment as Equipment[], originalMaiden.qualifications as any[], originalMaiden.tags as any[]);
    m.currentHp = Math.min(originalMaiden.currentHp + Math.max(0, m.maxHp - originalMaiden.maxHp), m.maxHp);
  }

  return { updatedMaidens: workMaidens, removedInventoryIds };
}

interface MissionState {
  missionId: string | null;
  inProgress: boolean;
  selectedTeamId: string | null;
  leaderId: string | undefined;
  currentStageIdx: number;
  events: CombatEvent[];
  stageMaidens: Maiden[];
  stageEnemies: any[];
}

export default function Missions() {
  const { missions, teams, maidens, setMaiden, setMission, setTeam, addMaiden, setCombatLocked, setMBase,
    removeInventoryItem, autoRecruit, setAutoRecruit,
    healInjuredMaidens, awardTrainingExp, applyPracticalExpGains, applyMoraleGains, applyMoraleQuitEvents, postMissionReset, rescueCapturedMaidens, refreshMissions,
    recordMeridianMission, applyMeridianSupport, decrementMissionsUntilWave, completeLyssaWave, incrementFreeRecruit } = useGameStore();
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [hoveredMission, setHoveredMission] = useState<any | null>(null);
  const [combatSpeed, setCombatSpeed] = useState<1 | 2 | 4 | 8>(() => readSpeedCookie());
  // Accumulate enemy kills across stages for Meridian reporting
  const missionKillsRef = useRef(0);
  // Track whether the last mission ended in victory (for lyssa wave handling)
  const missionWonRef = useRef(false);
  // Percentage of resources lost to a lyssa wave raid (null = no raid this session)
  const [lyssaRaidPercent, setLyssaRaidPercent] = useState<number | null>(null);
  const missionsUntilNextWave = useGameStore(s => s.missionsUntilNextWave ?? 20);
  const consecutiveEasyMissions = useGameStore(s => s.consecutiveEasyMissions ?? 0);

  // Generate missions only when the list is empty (app startup / after a mission concludes)
  useEffect(() => { if (missions.length === 0) refreshMissions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [missionState, setMissionState] = useState<MissionState>({
    missionId: null,
    inProgress: false,
    selectedTeamId: null,
    leaderId: undefined,
    currentStageIdx: 0,
    events: [],
    stageMaidens: [],
    stageEnemies: [],
  });

  const selectedMission = missions.find(m => m.id === selectedMissionId);
  // Derive the active combat mission from missionState so it persists even after selectedMissionId is cleared
  const activeMission = missions.find(m => m.id === missionState.missionId);
  const unlockedMissions = missions; // Show all missions

  // enrichEnemyGear is the canonical implementation in missionGen.ts — imported above.

  function startMission(teamId: string, autoTradeFood = false, autoEquipCfg?: AutoEquipConfig) {
    if (!selectedMission || !teamId) return;
    const maidenTeam = teams.find(t => t.id === teamId);
    if (!maidenTeam) return;

    // ── Auto-equip: apply before deriving stageMaidens so changes are reflected ──
    if (autoEquipCfg && Object.values(autoEquipCfg).some(Boolean)) {
      const currentState = useGameStore.getState();
      const deployingIds = new Set(
        maidenTeam.memberIds.filter(id => {
          const m = currentState.maidens.find((m: Maiden) => m.id === id);
          return m && !m.isCaptured && !m.isFallen && m.currentHp > 0 && m.moraleQuitStatus !== 'escaped';
        })
      );
      const deployingMaidens = currentState.maidens.filter((m: Maiden) => deployingIds.has(m.id));
      const { updatedMaidens, removedInventoryIds } = autoEquipForMission(
        deployingMaidens,
        currentState.inventory,
        autoEquipCfg,
        selectedMission.stages.length,
      );
      for (const u of updatedMaidens) {
        const orig = deployingMaidens.find((m: Maiden) => m.id === u.id)!;
        const changed = orig.equipment.length !== u.equipment.length ||
          orig.equipment.some((e, i) => e.inventoryId !== u.equipment[i]?.inventoryId);
        if (changed) setMaiden(u.id, { equipment: u.equipment, maxHp: u.maxHp, currentHp: u.currentHp });
      }
      for (const invId of removedInventoryIds) removeInventoryItem(invId);
    }

    // Double-check: exclude any maiden who is captured, fallen, or has escaped
    const stageMaidens = maidens.filter(
      m => maidenTeam.memberIds.includes(m.id)
        && !m.isCaptured
        && !m.isFallen
        && m.currentHp > 0
        && m.moraleQuitStatus !== 'escaped'
    );
    const stageEnemies = initializeStageEnemies(selectedMission.stages[0]).map(enrichEnemyGear);

    // Auto-trade: if enabled and Radio Center is built, spend gold to buy food (2 gold → 1 food)
    // before march rations are calculated.
    if (autoTradeFood) {
      const rcBuilt = useGameStore.getState().buildings.find((b: any) => b.id === 'radio_center')?.isConstructed ?? false;
      if (rcBuilt) {
        const stageMembersForCost = maidens.filter(
          (m: Maiden) => maidenTeam.memberIds.includes(m.id) && !m.isCaptured && !m.isFallen && m.currentHp > 0
        );
        const needed = stageMembersForCost.reduce((s: number, m: Maiden) => s + 20 + (m.stats?.strength ?? 0), 0);
        const currentFoodNow = useGameStore.getState().mbase.food ?? 0;
        const deficit = Math.max(0, needed - currentFoodNow);
        if (deficit > 0) {
          const currentMoneyNow = useGameStore.getState().mbase.money ?? 0;
          const maxBuy = Math.floor(currentMoneyNow / 2);
          const buy = Math.min(maxBuy, deficit);
          if (buy > 0) {
            setMBase({ food: currentFoodNow + buy, money: currentMoneyNow - buy * 2 });
          }
        }
      }
    }

    // Food consumption: each deployed maiden eats (20 + Strength) rations on the march.
    // Leader is fed first, then the rest in order. A maiden with insufficient food becomes starved:
    //   · isStarved = true for the whole mission
    //   · currentHp halved immediately
    //   · −3 permanent personal morale penalty (applied once, here)
    let remainingFood = useGameStore.getState().mbase.food ?? 0;
    const leaderId = maidenTeam.leaderId;
    const orderedMaidens = [
      ...stageMaidens.filter(m => m.id === leaderId),
      ...stageMaidens.filter(m => m.id !== leaderId),
    ];
    const stageMaidensWithStarved = orderedMaidens.map(m => {
      const cost = 20 + (m.stats?.strength ?? 0);
      if (remainingFood >= cost) {
        remainingFood -= cost;
        return m; // fully fed
      } else {
        remainingFood = 0;
        // Apply -3 permanent morale penalty to the store immediately
        const currentPermanent = m.moralePermanentBonus ?? 0;
        setMaiden(m.id, { moralePermanentBonus: currentPermanent - 3 });
        return { ...m, isStarved: true, currentHp: Math.max(1, Math.floor(m.currentHp / 2)) };
      }
    });
    setMBase({ food: remainingFood });

    setCombatLocked(true);
    setMissionState({
      missionId: selectedMission.id,
      inProgress: true,
      selectedTeamId: teamId,
      leaderId: maidenTeam.leaderId,
      currentStageIdx: 0,
      events: [],
      stageMaidens: stageMaidensWithStarved,
      stageEnemies,
    });
  }

  function applyPostMissionEffects(deployedMaidenIds: string[], missionKills: number, isWin: boolean) {
    const hospitalBuilding = useGameStore.getState().buildings.find(b => b.id === 'field_hospital');
    if (hospitalBuilding && hospitalBuilding.isConstructed) {
      const lvDef = hospitalBuilding.levels[hospitalBuilding.currentLevel - 1];
      const fraction: number = lvDef?.effectValue?.healFraction ?? 0;
      if (fraction > 0) healInjuredMaidens(fraction);
    }
    const trainingBuilding = useGameStore.getState().buildings.find(b => b.id === 'training_grounds');
    if (trainingBuilding && trainingBuilding.isConstructed) {
      const lvDef = trainingBuilding.levels[trainingBuilding.currentLevel - 1];
      const theoryExpGrant: number = lvDef?.effectValue?.theoryExp ?? 0;
      if (theoryExpGrant > 0) awardTrainingExp(theoryExpGrant, deployedMaidenIds);
    }
    const farmBuilding = useGameStore.getState().buildings.find(b => b.id === 'farm');
    if (farmBuilding && farmBuilding.isConstructed) {
      const lvDef = farmBuilding.levels[farmBuilding.currentLevel - 1];
      const foodProduced: number = lvDef?.effectValue?.food ?? 0;
      if (foodProduced > 0) setMBase({ food: (useGameStore.getState().mbase.food ?? 0) + foodProduced });
    }
    const meridianBuilding = useGameStore.getState().buildings.find(b => b.id === 'the_meridian');
    if (meridianBuilding && meridianBuilding.isConstructed && meridianBuilding.currentLevel > 0) {
      const lvDef = meridianBuilding.levels[meridianBuilding.currentLevel - 1];
      const tier: number = lvDef?.effectValue?.tier ?? 1;
      const currentMaidens = useGameStore.getState().maidens;
      const missionDeaths = deployedMaidenIds.filter(id => {
        const m = currentMaidens.find(x => x.id === id);
        return m && (m.isFallen || m.currentHp <= 0);
      }).length;
      const activeMissionForRecord = useGameStore.getState().missions.find(m => m.id === missionState.missionId);
      recordMeridianMission({
        missionId: missionState.missionId ?? 'unknown',
        kills: missionKills,
        deaths: missionDeaths,
        deployedCount: deployedMaidenIds.length,
        difficulty: activeMissionForRecord?.difficulty ?? 'normal',
        isWin,
      });
      applyMeridianSupport(tier);
    }
    // Rosarium Vocis: chance for a free recruit on victory
    if (isWin) {
      const rosariumBuilding = useGameStore.getState().buildings.find(b => b.id === 'rosarium_vocis');
      if (rosariumBuilding && rosariumBuilding.isConstructed && rosariumBuilding.currentLevel > 0) {
        const lvDef = rosariumBuilding.levels[rosariumBuilding.currentLevel - 1];
        const chance: number = (lvDef?.effectValue as any)?.freeRecruitChance ?? 0;
        if (chance > 0 && Math.random() < chance) {
          incrementFreeRecruit();
        }
      }
    }
  }

  function handleAbortMission(escapedIds: string[] = [], capturedIds: string[] = []) {
    // Apply any morale captures/escapes that happened in the last completed stage
    // (these are only passed by the abort button, which fires before onStageComplete)
    if (escapedIds.length > 0 || capturedIds.length > 0) {
      applyMoraleQuitEvents(escapedIds, capturedIds);
    }
    // Apply all non-win-gated post-mission effects (farm, training EXP, hospital, Meridian payout)
    const abortedMaidenIds = missionState.stageMaidens.map((m: any) => m.id);
    applyPostMissionEffects(abortedMaidenIds, missionKillsRef.current, false);
    handleReturnToMissions();
  }

  function handleReturnToMissions() {
    const wasWin = missionWonRef.current;
    missionWonRef.current = false;
    const isLyssaWave = activeMission?.rewardFocus === 'lyssa_wave';

    // Lyssa wave defeated / aborted — raid the base for 25–75% of all resources
    if (isLyssaWave && !wasWin) {
      const raidFraction = 0.25 + Math.random() * 0.5;
      const state = useGameStore.getState();
      const mb = state.mbase;
      setMBase({
        money: Math.floor(mb.money * (1 - raidFraction)),
        food:  Math.floor((mb.food  ?? 0) * (1 - raidFraction)),
        wood:  Math.floor((mb.wood  ?? 0) * (1 - raidFraction)),
        metal: Math.floor((mb.metal ?? 0) * (1 - raidFraction)),
      });
      // Maidens remaining in the base must attempt to escape the Lyssa onslaught.
      // Each non-deployed, non-fallen, non-already-captured maiden has a 50/50 chance:
      // captured by the Lyssas, or barely escaping and returning later.
      const deployedInWave = new Set(missionState.stageMaidens.map((m: any) => m.id));
      const homeMaidens = state.maidens.filter(
        m => !m.isFallen && !m.isCaptured && !deployedInWave.has(m.id)
      );
      const escapedIds: string[] = [];
      const capturedIds: string[] = [];
      for (const m of homeMaidens) {
        if (Math.random() < 0.5) capturedIds.push(m.id);
        else escapedIds.push(m.id);
      }
      if (escapedIds.length > 0 || capturedIds.length > 0) {
        state.applyMoraleQuitEvents(escapedIds, capturedIds);
      }
      setLyssaRaidPercent(Math.round(raidFraction * 100));
    }

    // Factory pipeline: produce consumables after every mission
    {
      const state = useGameStore.getState();
      const factoryBuilding = state.buildings.find((b: any) => b.id === 'factory');
      const factoryTier: number = factoryBuilding?.currentLevel ?? 0;
      const PIPELINE: Record<number, { potionId: string; potions: number; rationId: string; rations: number; grenadeId: string; grenades: number }> = {
        1: { potionId: 'healing_potion',   potions: 10,  rationId: 'field_rations',     rations: 5,   grenadeId: 'frag_grenade',       grenades: 5  },
        2: { potionId: 'field_potion',     potions: 20,  rationId: 'improved_rations',  rations: 10,  grenadeId: 'concussion_grenade', grenades: 10 },
        3: { potionId: 'field_potion',     potions: 50,  rationId: 'improved_rations',  rations: 20,  grenadeId: 'concussion_grenade', grenades: 20 },
        4: { potionId: 'advanced_potion',  potions: 50,  rationId: 'highgrade_rations', rations: 50,  grenadeId: 'incendiary_grenade', grenades: 30 },
        5: { potionId: 'advanced_potion',  potions: 100, rationId: 'highgrade_rations', rations: 100, grenadeId: 'incendiary_grenade', grenades: 60 },
      };
      const out = PIPELINE[factoryTier];
      if (out) {
        const ts = Date.now();
        const potionTemplate = allEquipment.find(e => e.id === out.potionId);
        const rationTemplate = allEquipment.find(e => e.id === out.rationId);
        const grenadeTemplate = allEquipment.find(e => e.id === out.grenadeId);
        if (potionTemplate)
          for (let i = 0; i < out.potions; i++)
            state.addInventoryItem({ ...potionTemplate, inventoryId: `pipe_potion_${ts}_${i}` });
        if (rationTemplate)
          for (let i = 0; i < out.rations; i++)
            state.addInventoryItem({ ...rationTemplate, inventoryId: `pipe_ration_${ts}_${i}` });
        if (grenadeTemplate)
          for (let i = 0; i < out.grenades; i++)
            state.addInventoryItem({ ...grenadeTemplate, inventoryId: `pipe_grenade_${ts}_${i}` });
      }
    }
    // Reset escape flags, deployed state, and apply morale floor
    postMissionReset();
    // Auto-recruit: fill empty beds if setting is enabled
    if (autoRecruit) {
      const state = useGameStore.getState();
      const liveMaidens = state.maidens.filter(m => !m.isFallen);
      let beds = state.mbase.beds - liveMaidens.length;
      let currentMaidens = [...state.maidens];
      let currentMoney = state.mbase.money;
      let freeFree = state.freeRecruitCount;
      let freeUsed = 0;
      const rosariumBuilding = state.buildings.find((b: any) => b.id === 'rosarium_vocis');
      const rosariumLvDef = rosariumBuilding?.isConstructed && rosariumBuilding.currentLevel > 0
        ? rosariumBuilding.levels[rosariumBuilding.currentLevel - 1]
        : null;
      const perRecruitCost: number = (rosariumLvDef?.effectValue as any)?.recruitCost ?? 150;
      const gearRarity: number = Number((rosariumLvDef?.effectValue as any)?.gearRarity ?? 1);
      while (beds > 0) {
        const rollCost = freeFree > 0 ? 0 : perRecruitCost;
        if (rollCost > currentMoney) break;
        if (freeFree > 0) { freeFree--; freeUsed++; } else currentMoney -= rollCost;
        const pool = [recruitMaiden(currentMaidens), recruitMaiden(currentMaidens), recruitMaiden(currentMaidens)];
        const heroines = pool.filter(m => m.type === 'heroine');
        const candidates = heroines.length > 0 ? heroines : pool;
        let best = candidates.reduce((a, b) => b.stats.dexterity > a.stats.dexterity ? b : a);
        if (gearRarity > 1) best = enrichRecruitGear(best, gearRarity);
        state.addMaiden(best);
        currentMaidens = [...currentMaidens, best];
        beds--;
      }
      if (currentMoney !== state.mbase.money) state.setMBase({ money: currentMoney });
      for (let i = 0; i < freeUsed; i++) state.decrementFreeRecruit();
    }
    // Wave counter management
    if (!isLyssaWave) {
      decrementMissionsUntilWave();
    } else {
      completeLyssaWave(); // reset counter to N for current tier — both win and loss
    }

    setCombatLocked(false);
    missionKillsRef.current = 0;
    // Regenerate mission pool after every mission conclusion
    refreshMissions();
    setMissionState({
      missionId: null,
      inProgress: false,
      selectedTeamId: null,
      leaderId: undefined,
      currentStageIdx: 0,
      events: [],
      stageMaidens: [],
      stageEnemies: [],
    });
  }

  if (missionState.inProgress && activeMission) {
    return (
      <BattleScreen
        key={`${activeMission.id}_stage_${missionState.currentStageIdx}`}
        mission={activeMission}
        missionState={missionState}
        speed={combatSpeed}
        setSpeed={setCombatSpeed}
        onReturnToMissions={handleReturnToMissions}
        onSyncHP={(updatedMaidens: Maiden[]) => {
          // Sync HP and handle casualties immediately after a stage concludes
          const deadIds = new Set<string>();
          updatedMaidens.forEach((m: Maiden) => {
            if (m.currentHp <= 0) {
              deadIds.add(m.id);
              // Strip weapon from fallen maiden — drop it to common inventory
              const weapon = m.equipment.find(eq => eq.slot === 'weapon');
              const equipWithoutWeapon = m.equipment.filter(eq => eq.slot !== 'weapon');
              if (weapon) {
                useGameStore.getState().addInventoryItem(weapon);
              }
              setMaiden(m.id, { currentHp: 0, isFallen: true, isDeployed: false, equipment: equipWithoutWeapon });
            } else {
              setMaiden(m.id, { currentHp: m.currentHp });
            }
          });

          if (deadIds.size > 0) {
            // Remove dead maidens from every team they belong to;
            // if the team leader died, promote the best survivor:
            // heroines first, then highest charm.
            teams.forEach(team => {
              const hadDead = team.memberIds.some(id => deadIds.has(id));
              if (!hadDead) return;
              const newMemberIds = team.memberIds.filter(id => !deadIds.has(id));
              let newLeaderId = team.leaderId;
              if (team.leaderId && deadIds.has(team.leaderId)) {
                // Gather living survivors from current stage + the rest of the roster
                const survivors = updatedMaidens.filter(
                  m => newMemberIds.includes(m.id) && m.currentHp > 0
                );
                const storeMembers = maidens.filter(
                  m => newMemberIds.includes(m.id) && !deadIds.has(m.id) && m.currentHp > 0 && !m.isFallen
                );
                const candidates: Maiden[] = survivors.length > 0 ? survivors : storeMembers;
                // Heroines first; within each group sort by charm descending
                const heroines = candidates.filter(m => m.type === 'heroine');
                const pool = heroines.length > 0 ? heroines : candidates;
                const best = pool.reduce<Maiden | null>(
                  (top, m) => (!top || getStat(m, 'charm') > getStat(top, 'charm') ? m : top),
                  null
                );
                newLeaderId = best?.id ?? undefined;
              }
              setTeam(team.id, { memberIds: newMemberIds, leaderId: newLeaderId });
            });
          }
        }}
        onAbortMission={handleAbortMission}
        onStageComplete={(updatedMaidens: Maiden[], stageOutcome: StageOutcome, stageExpGains: ExpGain[], _stageMoraleGains: any[], moraleEscapedIds: string[], moraleCapturedIds: string[], permanentMoraleDeltas: Map<string, number>) => {
          // Apply practical EXP for this stage
          applyPracticalExpGains(stageExpGains);
          // Apply permanent morale gains (net delta per maiden from kills/stuns)
          applyMoraleGains(permanentMoraleDeltas);
          // Handle morale-zero escapes/captures
          if (moraleEscapedIds.length > 0 || moraleCapturedIds.length > 0) {
            applyMoraleQuitEvents(moraleEscapedIds, moraleCapturedIds);
            // Record newly captured maiden IDs on the mission so they appear in the pop-up
            // Filter out escaped IDs to ensure only truly captured maidens are persisted
            const actualCapturedIds = moraleCapturedIds.filter(id => !moraleEscapedIds.includes(id));
            if (actualCapturedIds.length > 0) {
              const existing = activeMission.capturedMaidenIds ?? [];
              const merged = [...new Set([...existing, ...actualCapturedIds])];
              setMission(activeMission.id, { capturedMaidenIds: merged });
            }
          }

          // HP/casualties already synced by onSyncHP when battleComplete fired.
          const nextStageIdx = missionState.currentStageIdx + 1;
          const isWin = stageOutcome === 'maiden_victory' || stageOutcome === 'enemy_retreat';

          // Track enemy kills for Meridian review
          if (isWin) missionKillsRef.current += missionState.stageEnemies.length;

          // NOTE: Maidens captured mid-mission (moraleCapturedIds) are NOT rescued here.
          // They stay captured (recorded on mission.capturedMaidenIds) until the entire
          // mission is won. Only then are they rescued in the final-stage block below.
          // This ensures aborting mid-mission does not accidentally free them.
          if (nextStageIdx >= activeMission.stages.length || !isWin) {
            // Mission complete or failed — apply post-mission building effects
            const deployedIds = missionState.stageMaidens.map(m => m.id);
            const missionIsWin = isWin && nextStageIdx >= activeMission.stages.length;
            applyPostMissionEffects(deployedIds, missionKillsRef.current, missionIsWin);

            if (isWin && nextStageIdx >= activeMission.stages.length) {
              // Mission victory!
              // Rescue all maidens still listed as captives on this mission
              // (those captured in previous attempts and any remaining from this run).
              // Read the freshest mission state from the store since setMission calls above
              // may have already removed some ids from capturedMaidenIds.
              const freshMission = useGameStore.getState().missions.find(m => m.id === activeMission.id);
              const remainingCapturedIds = freshMission?.capturedMaidenIds ?? [];
              if (remainingCapturedIds.length > 0 && missionState.selectedTeamId) {
                rescueCapturedMaidens(remainingCapturedIds, missionState.selectedTeamId);
                setMission(activeMission.id, { capturedMaidenIds: [] });
              }
              setMission(activeMission.id, { isCompleted: true });
              // Grant resource rewards
              const reward = activeMission.reward;
              if (reward) {
                const resourcePatch: Record<string, number> = {};
                if (reward.money) resourcePatch.money = (useGameStore.getState().mbase.money ?? 0) + reward.money;
                if (reward.wood)  resourcePatch.wood  = (useGameStore.getState().mbase.wood  ?? 0) + reward.wood;
                if (reward.metal) resourcePatch.metal = (useGameStore.getState().mbase.metal ?? 0) + reward.metal;
                if (reward.food)  resourcePatch.food  = (useGameStore.getState().mbase.food  ?? 0) + reward.food;
                if (Object.keys(resourcePatch).length > 0) setMBase(resourcePatch);
                // Grant equipment rewards
                (reward.equipment ?? []).forEach((eq: any) => {
                  useGameStore.getState().addInventoryItem({ ...eq, inventoryId: `reward_${activeMission.id}_${eq.id}_${Date.now()}` });
                });
              }
              updatedMaidens.forEach((m: Maiden) => {
                if (!m.isFallen && m.currentHp > 0) {
                  setMaiden(m.id, { missionCount: m.missionCount + 1 });
                }
              });
              // Add any rescued heroines from this mission's reward
              const rescuedIds = activeMission.reward?.rescuedHeroineIds ?? [];
              rescuedIds.forEach((heroineId: string) => {
                const alreadyHave = maidens.some(m => m.heroineId === heroineId);
                if (!alreadyHave) {
                  const def = HEROINE_DEFINITIONS.find(h => h.id === heroineId);
                  if (def) addMaiden(heroineDefToMaiden(def));
                }
              });
            }
            missionWonRef.current = isWin && nextStageIdx >= activeMission.stages.length;
            handleReturnToMissions();
            return;
          }

          // Advance to next stage (only with survivors — exclude captured and escaped)
          const outIds = new Set([...moraleCapturedIds, ...moraleEscapedIds]);
          const survivors = updatedMaidens.filter(m => m.currentHp > 0 && !outIds.has(m.id));
          const nextStage = activeMission.stages[nextStageIdx];
          // If the leader fell this stage, use the newly promoted leader for the next stage
          const currentLeaderId = missionState.leaderId;
          const leaderAlive = currentLeaderId && survivors.some(m => m.id === currentLeaderId);
          let nextLeaderId = currentLeaderId;
          if (!leaderAlive && survivors.length > 0) {
            const heroines = survivors.filter(m => m.type === 'heroine');
            const pool = heroines.length > 0 ? heroines : survivors;
            const best = pool.reduce<Maiden | null>(
              (top, m) => (!top || getStat(m, 'charm') > getStat(top, 'charm') ? m : top),
              null
            );
            nextLeaderId = best?.id ?? undefined;
          }
          setMissionState(s => ({
            ...s,
            currentStageIdx: nextStageIdx,
            leaderId: nextLeaderId,
            events: [],
            stageMaidens: survivors,
            stageEnemies: initializeStageEnemies(nextStage).map(e => enrichEnemyGear(e)),
          }));
        }}
        setMaidens={maidens}
      />
    );
  }

  const fsi = computeForceStrengthIndex(maidens);
  const lyssaWaveActive = missions.length === 1 && missions[0]?.rewardFocus === 'lyssa_wave';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>⚔️ Missions</h2>
        {/* Lyssa wave countdown */}
        {lyssaWaveActive ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ff4444', background: 'rgba(139,0,0,0.2)', border: '1px solid #ff4444', borderRadius: 5, padding: '3px 10px', animation: 'none' }}>
            🚨 LYSSA WAVE ACTIVE
          </span>
        ) : (
          <span
            title="Missions remaining before a Lyssa Wave is triggered"
            style={{
              fontSize: 12, fontWeight: 600,
              color: missionsUntilNextWave <= 3 ? '#ff4444' : missionsUntilNextWave <= 7 ? '#c8954a' : 'var(--color-text-muted)',
              background: missionsUntilNextWave <= 3 ? 'rgba(139,0,0,0.15)' : 'transparent',
              border: `1px solid ${missionsUntilNextWave <= 3 ? '#ff444488' : 'var(--color-border)'}`,
              borderRadius: 5, padding: '3px 10px', cursor: 'default',
            }}
          >
            {missionsUntilNextWave <= 3 ? '⚠️' : '🌊'} Wave in {missionsUntilNextWave}
          </span>
        )}
        {/* Auto-recruit toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 12, color: autoRecruit ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
            ⚡ Auto-Recruit
          </span>
          <div
            onClick={() => setAutoRecruit(!autoRecruit)}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: autoRecruit ? 'var(--color-accent-dark)' : '#333',
              border: `1px solid ${autoRecruit ? 'var(--color-accent)' : '#555'}`,
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: autoRecruit ? 18 : 2,
              width: 14, height: 14, borderRadius: '50%',
              background: autoRecruit ? 'var(--color-accent)' : '#666',
              transition: 'left 0.2s',
            }} />
          </div>
        </label>
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        {/* Left: banners + missions + FSI */}
        <div>

      {/* ── Lyssa Wave emergency banner ── */}
      {lyssaWaveActive && (
        <div style={{
          background: 'rgba(139,0,0,0.18)', border: '2px solid #ff4444', borderRadius: 8,
          padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🚨</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6666', marginBottom: 4 }}>EMERGENCY — BASE UNDER ATTACK</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              A massive Lyssa-led force is advancing on Fort Waelfeld. All normal operations are suspended.
              You <strong style={{ color: '#ff6666' }}>must</strong> deploy and defend the base.
              Defeat will result in <strong style={{ color: '#ff6666' }}>25–75% of all resources being looted</strong>.
            </div>
          </div>
        </div>
      )}

      {/* ── Lyssa raid result notification ── */}
      {lyssaRaidPercent !== null && (
        <div style={{
          background: 'rgba(139,0,0,0.25)', border: '2px solid #ff4444', borderRadius: 8,
          padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6666', marginBottom: 4 }}>💥 Base Overrun!</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              The Lyssa wave was not repelled. Enemy forces looted <strong style={{ color: '#ff6666' }}>{lyssaRaidPercent}%</strong> of all base resources.
              Maidens left behind scrambled to flee — some were captured, others barely made it out.
              The wave countdown has reset. Rebuild before the next assault arrives.
            </div>
          </div>
          <button
            onClick={() => setLyssaRaidPercent(null)}
            style={{ background: 'none', border: '1px solid #ff4444', color: '#ff6666', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
          >Dismiss</button>
        </div>
      )}

      {/* ── Mission list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {unlockedMissions.map(m => (
          <MissionListItem
            key={m.id}
            mission={m}
            selected={selectedMissionId === m.id}
            onSelect={() => setSelectedMissionId(m.id)}
            onHoverIn={(hm: any) => setHoveredMission(hm)}
            onHoverOut={() => setHoveredMission(null)}
          />
        ))}
        {unlockedMissions.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No missions available</div>}
      </div>

      {/* ── Force Strength Index panel (below missions) ── */}
      <details style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
        <summary style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--color-accent)', fontWeight: 'bold', userSelect: 'none' }}>
          📊 Force Strength Index: {fsi.fsi} — {fsi.tierLabel} (Tier {fsi.tier}/6)
        </summary>
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
          {/* Current FSI breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginBottom: 12 }}>
            <div>🧍 Active maidens: <strong style={{ color: 'var(--color-text)' }}>{fsi.activeMaidenCount}</strong></div>
            <div>⚔️ Avg power/maiden: <strong style={{ color: 'var(--color-text)' }}>{fsi.avgCombatPower}</strong></div>
            <div>📈 Total FSI: <strong style={{ color: 'var(--color-accent)' }}>{fsi.fsi}</strong></div>
            <div>Next tier at: <strong style={{ color: 'var(--color-text)' }}>{TIER_CONFIGS[Math.min(fsi.tier, TIER_CONFIGS.length - 1)].fsiMin}</strong></div>
            <div>
              {lyssaWaveActive
                ? <span style={{ color: '#ff4444', fontWeight: 700 }}>🚨 LYSSA WAVE ACTIVE</span>
                : <>
                    🌊 Next Lyssa Wave in:{' '}
                    <strong style={{ color: missionsUntilNextWave <= 3 ? '#ff4444' : missionsUntilNextWave <= 7 ? '#c8954a' : 'var(--color-text)' }}>
                      {missionsUntilNextWave} mission{missionsUntilNextWave !== 1 ? 's' : ''}
                    </strong>
                  </>
              }
            </div>
          </div>

          {/* Tier reference table */}
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Tier Reference</div>
          <div style={{ overflowX: 'auto', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                  {['Tier', 'FSI Range', 'Label', 'Missions', 'Enemy Quality', 'Difficulty'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIER_CONFIGS.map(cfg => {
                  const isCurrentTier = cfg.tier === fsi.tier;
                  return (
                    <tr key={cfg.tier} style={{ background: isCurrentTier ? 'rgba(200,149,74,0.12)' : 'transparent' }}>
                      <td style={{ padding: '4px 8px', color: isCurrentTier ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: isCurrentTier ? 'bold' : 'normal' }}>{cfg.tier}</td>
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', color: isCurrentTier ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{cfg.fsiMin}–{cfg.fsiMax}</td>
                      <td style={{ padding: '4px 8px', color: isCurrentTier ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: isCurrentTier ? 'bold' : 'normal' }}>{cfg.label}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: isCurrentTier ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{cfg.missions}{cfg.tier <= 2 ? '+' : ''}</td>
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', color: isCurrentTier ? 'var(--color-text)' : 'var(--color-text-muted)' }}>Q{cfg.qualityLo}–Q{cfg.qualityHi}</td>
                      <td style={{ padding: '4px 8px', color: isCurrentTier ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{cfg.difficultyRange}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 10, opacity: 0.65, borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 10 }}>
            <strong>FSI formula:</strong> Sum of avg(STR, DEX, CON, AWR) × (HP/maxHP) across all active maidens.
            Killed or captured maidens do not contribute. Injured maidens weigh less.
            Typical fresh recruit contributes ≈8 points; 50 maidens at full health ≈ 400 FSI (Legend).
            <br/>
            <strong>Missions are assigned by HQ</strong> and regenerate after each sortie.
            Higher tiers lose access to easy assignments but gain more choices among harder operations.
            Each set guarantees distinct reward focuses: <em>Gold-heavy, Supply run, Salvage, Training, Medal, Balanced</em> — no two missions in a set share the same focus.
          </div>
        </div>
      </details>

        </div>

        {/* Right: Adjudicator panel */}
        <AdjudicatorPanel
          missions={missions}
          hoveredMission={hoveredMission}
          maidens={maidens}
          teams={teams}
          missionsUntilNextWave={missionsUntilNextWave}
          lyssaWaveActive={lyssaWaveActive}
          consecutiveEasyMissions={consecutiveEasyMissions}
        />
      </div>{/* end two-column grid */}

      {/* Mission detail popup */}
      {selectedMission && (
        <div
          onClick={() => setSelectedMissionId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <MissionDetail
              mission={selectedMission}
              teams={teams}
              maidens={maidens}
              onStartMission={(teamId: string, autoTrade: boolean, aeCfg: AutoEquipConfig) => { setSelectedMissionId(null); startMission(teamId, autoTrade, aeCfg); }}
              onClose={() => setSelectedMissionId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Adjudicator of the Meridian ─────────────────────────────────────────────
// Moods calibrated to simulation data:
//   'overwhelming' ≈ 99%+ win  (ratio ≥ 1.6)
//   'safe'         ≈ 82%+ win  (ratio ≥ 1.1)
//   'contested'    ≈ 54%+ win  (ratio ≥ 0.85)
//   'risky'        ≈ 19%+ win  (ratio ≥ 0.55)
//   'dire'         < 19% win   (ratio < 0.55)
type AdjMood =
  | 'overwhelming' | 'safe' | 'contested' | 'risky' | 'dire'
  | 'lyssa_wave' | 'strike_force' | 'wave_imminent' | 'strike_available'
  | 'no_team' | 'idle'
  | 'easy_streak_warning'  // 3–4 consecutive easy missions
  | 'easy_forced';         // 5 consecutive — HQ mandate, easy missions removed

const ADJ_LINES: Record<AdjMood, string[]> = {
  overwhelming: [
    "This engagement is well within your current capability. A clean sweep is the expected outcome. Remain tactically disciplined — even favourable odds punish complacency.",
    "Force projection shows a decisive advantage. At this FSI ratio I project near-certain success. The mission is yours; do not let overconfidence blunt your edge.",
    "Your team significantly outclasses this objective. Execute cleanly, minimise unnecessary exposure, and extract with full accountability. HQ will have nothing to note in the after-action.",
    "An operation this manageable should generate minimal friction. Send your best-equipped element, maintain formation discipline, and be back before nightfall.",
  ],
  safe: [
    "Your team holds a measurable edge over this threat. Projected success rate is strong. Proceed — but multi-stage engagements demand sustained attention, not just initial momentum.",
    "Force assessment: your FSI exceeds the projected threat by a comfortable margin. A clean outcome is the most probable scenario. Execute with standard precaution.",
    "A favourable engagement at current force levels. The risk of significant casualties is low, though not zero. Ensure your maidens are well-supplied before committing.",
    "This operation is within parameters. The enemy is outmatched but not trivial. Cover your withdrawal lanes, and complete the objective efficiently.",
  ],
  contested: [
    "Comparable forces on both sides. This engagement will be competitive — your maidens will take fire and the outcome is not guaranteed. Confirm your loadout is complete before deploying.",
    "The threat assessment puts this engagement close to parity. Based on the FSI spread, I estimate 60 to 75 percent probability of success. Preparation will determine the outcome.",
    "A contested engagement. Your team is capable, but the enemy will extract a cost. In multi-stage operations, attrition compounds — what you lose early cannot be recovered mid-mission.",
    "This is not a certain operation. The enemy's combat rating is within striking distance of your force. Avoid overextension, and have an exit contingency ready.",
  ],
  risky: [
    "Your current FSI falls notably short of what this engagement demands. I estimate a 25 to 40 percent success probability. Reinforcing your team before deployment is strongly advised.",
    "The projected outcome at your current force levels is unfavourable. The enemy outclasses your available strength by a meaningful margin. Proceed only if you have no alternative.",
    "I am required to note that this operation exceeds your current projected capability. High casualty and capture risk. HQ does not prohibit high-risk sorties — but the record will reflect who made the call.",
    "A difficult engagement at current force levels. The FSI mismatch is significant, and in multi-stage operations that gap compounds across each phase. Reinforce or wait for a better window.",
  ],
  dire: [
    "I cannot recommend this engagement at current force levels. Your FSI is critically insufficient for the projected threat. Deploying this team is likely to result in total loss.",
    "The force imbalance here is severe. The enemy's assessed strength dwarfs your available deployment by a wide margin. This is not a difficult mission — it is an unsurvivable one at present strength.",
    "My assessment is unambiguous: this objective is beyond your capacity at this time. I strongly advise against commitment. Recover your forces, reinforce your roster, and revisit when the numbers are viable.",
  ],
  lyssa_wave: [
    "This is not a field operation — this is a base defence emergency. HQ requires immediate deployment. There are no acceptable alternatives.",
    "A Lyssa formation is advancing on Fort Waelfeld. Every second you hesitate is ground yielded to the enemy. Deploy. Now.",
    "My report to HQ will note whether you met this threat with appropriate urgency. Do not make me write a failure report, Commander.",
  ],
  strike_force: [
    "A Strike Force operation. The Lyssa commanding this sector is the primary target — HQ has flagged her as a strategic threat. The longer she operates unchecked, the more dangerous she becomes.",
    "Strike Force tasking. This is not a routine sweep. The Lyssa element here represents a consolidation of enemy leadership. Your team's FSI must be sufficient for this class of engagement.",
    "HQ's Strike Force designation reflects the severity of the threat. Lyssa commanders do not yield without a fight — ensure your team's combat weight matches the mission rating before deploying.",
    "These are priority operations from HQ. Lyssa commanders amplify the threat of every unit around them. At contested odds against a Lyssa, expect the engagement to be harder than the numbers suggest.",
  ],
  wave_imminent: [
    "Commander — the Lyssa wave interval is nearly exhausted. I strongly advise addressing your force readiness before the window closes.",
    "According to HQ's tracking, a Lyssa wave is imminent. Any mission you select now must be weighed against that coming pressure.",
    "I am on record recommending you prepare for the incoming Lyssa wave. HQ will not be forgiving if the base is caught undersupplied.",
  ],
  strike_available: [
    "There is a Strike Force operation in the available pool. HQ has flagged the Lyssa presence in that sector as a growing threat. I recommend prioritising it.",
    "One of the available missions carries Strike Force classification. The Lyssa element there will only strengthen if left unaddressed. Take note.",
    "A Strike Force tasking is available. The longer it goes unanswered, the more coordinated the enemy becomes. HQ is paying attention.",
  ],
  no_team: [
    "You have no deployable team assembled. No assessment can be made and no mission can proceed. Organise your roster in the Composition page.",
    "There is no formed unit to evaluate. The Composition page is where you build teams, Commander. I will wait.",
  ],
  idle: [
    "Adjudicator, attached to Fort Waelfeld by order of The Meridian. I review operational performance and report to HQ. Hover over a mission for my assessment.",
    "I am here to evaluate, not to choose for you. Hover over a mission and I will give you my honest assessment of the odds.",
    "The Meridian keeps records of every sortie — victories, losses, and the decisions that led to both. Choose your next operation carefully.",
    "HQ monitors the Lyssa activity in this region closely. My role is to ensure that field decisions reflect the strategic picture. Proceed thoughtfully.",
  ],
  easy_streak_warning: [
    "I have been watching your recent mission selections. Easy assignments, one after another. HQ has noticed. They expect more from a commander at your level.",
    "Your last few sorties have all been low-intensity operations. I understand the appeal — low risk, acceptable return. But this unit was not established to take strolls. Headquarters is paying attention.",
    "I have flagged your recent record to HQ. Three or more consecutive easy assignments is not a pattern they approve of. I recommend selecting something with real stakes before they are forced to act.",
    "The easy missions are there for warm-ups, Commander — not as a permanent strategy. Your recent run of low-difficulty sorties is beginning to attract scrutiny from above.",
    "I will be direct. Headquarters did not build this operation for you to farm easy targets. A few more of these and I won't have a choice but to escalate. Take something harder.",
  ],
  easy_forced: [
    "That is enough. Five consecutive easy assignments — HQ has issued a formal mandate. Easy operations are suspended until you demonstrate your unit can handle real opposition. The choice has been made for you.",
    "Headquarters has reviewed your sortie history and found it unacceptable. Effective immediately, low-difficulty assignments have been withdrawn from your pool. Take a real mission, or stand down entirely.",
    "I have been directed by HQ to restrict your assignment pool. You had your chances to self-correct. Instead, you took the easy path five times running. No more easy missions until you show results at a higher tier.",
    "Command has had enough. I filed the report, HQ acted on it. No easy missions this cycle — the mandate is in effect. Prove your unit is worth the resources invested in it.",
    "Five easy missions. Five. I warned you, and you chose comfort over contribution. HQ's patience has run out. Normal-tier or above, this cycle. Non-negotiable.",
  ],
};

function pickAdjLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Rough FSI for a specific set of maidens (same formula as computeForceStrengthIndex). */
function teamFsi(teamMaidens: Maiden[]): number {
  let total = 0;
  for (const m of teamMaidens) {
    const base = (m.stats.strength + m.stats.dexterity + m.stats.constitution + m.stats.awareness) / 4;
    total += base * (m.maxHp > 0 ? m.currentHp / m.maxHp : 1);
  }
  return Math.round(total);
}

/**
 * Estimated FSI requirement for a mission — computed per stage.
 *
 * Calibrated against 5000+ mission simulation runs. Key findings:
 *   - Lyssa multiplier must be 0.75 per Lyssa to match the engine's 1.5× FSI requirement.
 *     At 0.5 (old), normal+Lyssa threat=72 showed ratio 0.22 but retreated — the gap was
 *     being dramatically underestimated. Log data: normal+L retreats at avg ratio 0.83
 *     of threshold; wins at avg 1.26. Raising to 0.75 aligns UI threat with engine gate.
 *   - Stage attrition: each successive stage compounds casualties because HP is not
 *     restored between stages. Factors below calibrated to log KIA curves.
 *   - Quality weights W calibrated so ratio=1.0 → ~50% win (non-Lyssa single-stage).
 */
function missionThreatFsi(mission: any): number {
  // Per-quality-tier base threat weights (calibrated to 5k-run simulation)
  const W: Record<string, number> = { easy: 14, normal: 28, hard: 48, extreme: 76, hell: 115 };
  function qToDiff(q: number): string {
    if (q <= 3) return 'easy';
    if (q <= 5) return 'normal';
    if (q <= 7) return 'hard';
    if (q <= 9) return 'extreme';
    return 'hell';
  }

  const stages: any[] = mission.stages ?? [];
  if (stages.length === 0) return 0;

  let total = 0;
  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    const zakoGroups: any[] = stage.template?.zako ?? [];
    const lyssaCount: number =
      (stage.template?.lyssaIds?.length ?? 0) +
      (stage.enemies?.filter((e: any) => e.type === 'lyssa').length ?? 0);

    // Effective enemy quality for this stage — read from template or fall back.
    let stageQ: number;
    if (zakoGroups.length > 0) {
      stageQ = Math.max(...zakoGroups.map((g: any) => Number(g.quality ?? 1)));
    } else {
      const diffToQ: Record<string, number> = { easy: 2, normal: 4, hard: 6, extreme: 8, hell: 10 };
      stageQ = diffToQ[mission.difficulty] ?? 4;
    }

    const stageWeight = W[qToDiff(stageQ)] ?? 28;
    // Lyssa multiplier: 0.75 per Lyssa — matches engine's 1.5× FSI gate.
    // Log analysis: old 0.5 multiplier caused UI to show "Safe" for missions that
    // had avg 7 KIA and 31% retreat rate. 0.75 aligns displayed threat with reality.
    const stageThreat = stageWeight * (1 + lyssaCount * 0.75);

    // Sub-linear stage accumulation: HP attrition means stage 2+ starts degraded.
    // Log calibration from multi-run data — not strictly multiplicative.
    const stageFactor = si === 0 ? 1.0 : si === 1 ? 0.90 : si === 2 ? 0.80 : 0.70;
    total += stageThreat * stageFactor;
  }

  return Math.round(total);
}

/**
 * Estimate win probability from FSI ratio.
 * Two separate sigmoids calibrated to 5k-run log data:
 *
 * Non-Lyssa: inflection at 0.70 — easy missions win at almost any ratio; hard non-Lyssa
 *   is uncommon but still more forgiving than Lyssa equivalents.
 *
 * Lyssa: inflection at 1.05 — log data showed:
 *   - normal+L retreated at avg ratio 0.83 (31% retreat rate total)
 *   - normal+L won at avg ratio 1.26
 *   - hard+L retreated at avg ratio 0.88 (66% retreat rate)
 *   - extreme+L all retreated below FSI 400 (100% retreat rate at ratio < 0.5)
 *   Steeper slope (k=6) reflects the high variance Lyssa missions exhibit.
 */
function estimateWinPct(ratio: number, hasLyssa: boolean): number {
  if (hasLyssa) {
    // Lyssa sigmoid — steeper, inflection at 1.05 (need FSI parity+ to have 50% win)
    return Math.min(95, Math.max(3, Math.round(100 / (1 + Math.exp(-6.0 * (ratio - 1.05))))));
  }
  // Non-Lyssa sigmoid — gentler, inflection at 0.70
  return Math.min(97, Math.max(3, Math.round(100 / (1 + Math.exp(-5.5 * (ratio - 0.70))))));
}

/**
 * Estimate expected KIA based on mission type and FSI ratio.
 * Derived from aggregate log statistics across 5000+ missions:
 *   easy (no Lyssa): ~0 KIA regardless of ratio
 *   easy+Lyssa:      avg 1.9 KIA overall; scales ~2× at poor ratio
 *   normal+Lyssa:    avg 7 KIA; 9-14 KIA when ratio < 0.5
 *   hard+Lyssa:      avg 12 KIA; 20-33 KIA in poor engagements
 *   extreme+Lyssa:   avg 20 KIA; 40-55 KIA at low FSI
 *   hell+Lyssa:      avg 50 KIA
 * Scale: KIA ∝ (1/ratio)^0.6, floored at the "win" average, capped at recorded max.
 */
function estimateExpectedKia(
  ratio: number,
  difficulty: string,
  lyssaCount: number,
  stageCount: number,
): { low: number; high: number } {
  if (lyssaCount === 0) {
    // Non-Lyssa: near-zero casualties at any reasonable ratio
    const base = difficulty === 'hard' ? 1 : difficulty === 'extreme' ? 3 : 0;
    return { low: 0, high: Math.max(0, Math.round(base * (1 / Math.max(ratio, 0.3)))) };
  }
  // Base KIA range [win-avg, retreat-avg] by difficulty tier from log data
  const BASE: Record<string, [number, number]> = {
    easy:    [1,  4],
    normal:  [4, 14],
    hard:    [8, 33],
    extreme: [14, 54],
    hell:    [30, 54],
  };
  const [winBase, retreatBase] = BASE[difficulty] ?? BASE.normal;
  // Interpolate between win-case and retreat-case using ratio (clamped 0.3–2.0)
  const r = Math.min(2.0, Math.max(0.3, ratio));
  // At ratio=2.0: near win-base; at ratio=0.5: near retreat-base
  const t = Math.max(0, Math.min(1, (2.0 - r) / 1.5));
  const midKia = Math.round(winBase + t * (retreatBase - winBase));
  // Multi-stage adds ~20% KIA per extra stage (attrition compounds)
  const stageMult = 1 + (stageCount - 1) * 0.2;
  return {
    low:  Math.round(Math.max(0, midKia * 0.6 * stageMult)),
    high: Math.round(midKia * 1.4 * stageMult),
  };
}

function AdjudicatorPanel({
  missions, hoveredMission, maidens, teams, missionsUntilNextWave, lyssaWaveActive, consecutiveEasyMissions,
}: {
  missions: any[];
  hoveredMission: any | null;
  maidens: Maiden[];
  teams: any[];
  missionsUntilNextWave: number;
  lyssaWaveActive: boolean;
  consecutiveEasyMissions: number;
}) {
  // Best deployable team FSI
  const bestTeamFsi = (() => {
    let best = 0;
    for (const t of teams) {
      const members = maidens.filter(
        m => t.memberIds.includes(m.id) && !m.isFallen && !m.isCaptured && m.currentHp > 0
      );
      const f = teamFsi(members);
      if (f > best) best = f;
    }
    return best;
  })();
  const hasDeployableTeam = bestTeamFsi > 0;

  // Determine mood — thresholds calibrated to simulation data
  const mood: AdjMood = (() => {
    if (lyssaWaveActive) return 'lyssa_wave';
    if (hoveredMission) {
      if (hoveredMission.rewardFocus === 'lyssa_wave') return 'lyssa_wave';
      if (hoveredMission.rewardFocus === 'strike_force') return 'strike_force';
      if (!hasDeployableTeam) return 'no_team';
      const threat = missionThreatFsi(hoveredMission);
      const ratio = threat > 0 ? bestTeamFsi / threat : 2;
      // Data-calibrated (15k-combo sim): 50% win ≈ ratio 0.82; 82% win ≈ ratio 1.1; 99% win ≈ ratio 1.6
      if (ratio >= 1.6) return 'overwhelming';
      if (ratio >= 1.1) return 'safe';
      if (ratio >= 0.85) return 'contested';
      if (ratio >= 0.55) return 'risky';
      return 'dire';
    }
    if (!hasDeployableTeam) return 'no_team';
    if (missionsUntilNextWave <= 3 && !lyssaWaveActive) return 'wave_imminent';
    if (missions.some(m => m.rewardFocus === 'strike_force')) return 'strike_available';
    // Easy-streak system (tier 1–2 only): warn at 3–4; forced at 5 (missions already have no easy)
    if (consecutiveEasyMissions >= 5) return 'easy_forced';
    if (consecutiveEasyMissions >= 3) return 'easy_streak_warning';
    return 'idle';
  })();

  const [line, setLine] = useState(() => pickAdjLine(ADJ_LINES[mood]));
  const prevMoodRef = useRef(mood);
  useEffect(() => {
    if (prevMoodRef.current !== mood) {
      prevMoodRef.current = mood;
      setLine(pickAdjLine(ADJ_LINES[mood]));
    }
  }, [mood]);

  const accentColor =
    mood === 'lyssa_wave'    ? '#ff4444' :
    mood === 'dire'          ? '#c84a4a' :
    mood === 'risky'         ? '#c8954a' :
    mood === 'contested'     ? '#b8a04a' :
    mood === 'safe'          ? '#4caf50' :
    mood === 'overwhelming'  ? '#4caf50' :
    mood === 'strike_force' || mood === 'strike_available' ? '#c87040' :
    mood === 'wave_imminent' ? '#ff9800' :
    mood === 'no_team' ? '#666' :
    'var(--color-accent)';

  const moodLabel =
    mood === 'lyssa_wave'    ? '🚨 EMERGENCY' :
    mood === 'strike_force'  ? '🛡️ Strike Force' :
    mood === 'overwhelming'  ? '✦ Overwhelming' :
    mood === 'safe'          ? '✔ Safe' :
    mood === 'contested'     ? '⚡ Contested' :
    mood === 'risky'         ? '⚠ Risky' :
    mood === 'dire'          ? '☠ Dire' :
    mood === 'wave_imminent' ? '⚠ Wave Imminent' :
    mood === 'strike_available' ? '🛡️ SF Available' :
    mood === 'no_team' ? '— No Team' : '';

  // Threat gauge for hovered mission
  const threatInfo = hoveredMission && hasDeployableTeam ? (() => {
    const threat = missionThreatFsi(hoveredMission);
    const ratio = threat > 0 ? bestTeamFsi / threat : 2;
    const lyssaCount: number = hoveredMission.stages.reduce((n: number, s: any) =>
      n + (s.template?.lyssaIds?.length ?? (s.enemies?.filter((e: any) => e.type === 'lyssa').length ?? 0)), 0);
    const stageCount: number = hoveredMission.stages.length;
    const hasLyssa = lyssaCount > 0;
    const winPct = estimateWinPct(ratio, hasLyssa);
    const pct = winPct;
    const expectedKia = estimateExpectedKia(ratio, hoveredMission.difficulty ?? 'normal', lyssaCount, stageCount);
    // FSI needed for "safe" run (82% win): reverse the sigmoid inflection point × threat
    // Lyssa inflection 1.05; non-Lyssa 0.70
    const safeRatioTarget = hasLyssa ? 1.05 : 0.70;
    const fsiNeeded = Math.round(threat * safeRatioTarget);
    const fsiForSafe82 = Math.round(threat * (hasLyssa ? 1.40 : 1.00)); // ~82% win threshold
    return { threat, ratio: Math.round(ratio * 100) / 100, winPct, pct, lyssaCount, stageCount, hasLyssa, expectedKia, fsiNeeded, fsiForSafe82 };
  })() : null;

  return (
    <div style={{
      background: 'var(--color-surface)', border: `1px solid ${accentColor}`,
      borderRadius: 8, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: mood === 'lyssa_wave' ? '0 0 18px rgba(255,68,68,0.2)' : mood === 'safe' ? '0 0 10px rgba(76,175,80,0.1)' : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      position: 'sticky', top: 12,
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(0,0,0,0.35)', borderBottom: `1px solid ${accentColor}`,
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 12, fontWeight: 'bold', color: accentColor }}>Adjudicator · The Meridian</span>
        {moodLabel && (
          <span style={{
            fontSize: 10, color: accentColor, border: `1px solid ${accentColor}`,
            borderRadius: 3, padding: '1px 6px', background: 'rgba(0,0,0,0.3)',
          }}>{moodLabel}</span>
        )}
      </div>

      {/* Portrait + speech */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Portrait */}
        <div style={{
          flexShrink: 0, width: 130,
          background: 'linear-gradient(to bottom, #0c0d10, #141618)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          borderRight: '1px solid var(--color-border)', overflow: 'hidden',
        }}>
          <img
            src={`${_BASE}/imgs/chars/adjudicator.png`}
            alt="Adjudicator of the Meridian"
            style={{
              width: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block',
              filter:
                mood === 'lyssa_wave' ? 'sepia(0.3) hue-rotate(-10deg)' :
                mood === 'no_team' ? 'saturate(0.4)' :
                mood === 'dire' ? 'sepia(0.4) hue-rotate(-5deg)' :
                mood === 'risky' ? 'sepia(0.2)' : 'none',
              transition: 'filter 0.3s',
            }}
          />
        </div>

        {/* Speech + data */}
        <div style={{ flex: 1, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quote */}
          <div style={{ position: 'relative', background: 'rgba(0,0,0,0.3)', border: `1px solid ${accentColor}`, borderRadius: 8, padding: '12px 14px' }}>
            <div style={{
              position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '7px solid transparent', borderBottom: '7px solid transparent',
              borderRight: `8px solid ${accentColor}`,
            }} />
            <div style={{
              position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
              borderRight: '7px solid #0e0d0b',
            }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text)', lineHeight: 1.7, fontStyle: 'italic' }}>
              "{line}"
            </p>
          </div>

          {/* Easy-streak tick indicator: visible at tiers 1–2 when streak ≥ 1 */}
          {consecutiveEasyMissions > 0 && (
            <div style={{
              background: consecutiveEasyMissions >= 5 ? 'rgba(192,96,128,0.15)' : 'rgba(0,0,0,0.25)',
              border: `1px solid ${consecutiveEasyMissions >= 5 ? '#c06080' : '#6a4a30'}`,
              borderRadius: 5, padding: '6px 10px',
            }}>
              <div style={{ fontSize: 10, color: consecutiveEasyMissions >= 5 ? '#e080a0' : '#a07050', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {consecutiveEasyMissions >= 5
                  ? '🚧 HQ Mandate — Easy missions removed'
                  : '📄 Consecutive easy missions'}
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[1,2,3,4,5].map(n => (
                  <div key={n} style={{
                    width: 16, height: 16, borderRadius: 3,
                    background: n <= consecutiveEasyMissions
                      ? (consecutiveEasyMissions >= 5 ? '#c06080' : n >= 4 ? '#b06040' : '#6a5030')
                      : 'transparent',
                    border: `2px solid ${n <= consecutiveEasyMissions
                      ? (consecutiveEasyMissions >= 5 ? '#e080a0' : '#c8954a')
                      : '#3a3020'}`,
                    transition: 'background 0.2s, border-color 0.2s',
                  }} />
                ))}
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                  {consecutiveEasyMissions}/5
                </span>
              </div>
              {consecutiveEasyMissions < 5 && (
                <div style={{ fontSize: 10, color: '#7a5540', marginTop: 4 }}>
                  {5 - consecutiveEasyMissions} more easy mission{5 - consecutiveEasyMissions !== 1 ? 's' : ''} until HQ intervenes
                </div>
              )}
            </div>
          )}

          {/* Threat gauge */}
          {threatInfo && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {/* Mission Intel strip */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '4px 8px',
                padding: '5px 8px',
                background: 'rgba(0,0,0,0.25)', borderRadius: 5,
                border: '1px solid var(--color-border)',
              }}>
                <span>FSI <strong style={{ color: 'var(--color-text)' }}>{bestTeamFsi}</strong></span>
                <span style={{ color: 'var(--color-border)' }}>|</span>
                <span>Threat <strong style={{ color: 'var(--color-text)' }}>{threatInfo.threat}</strong></span>
                <span style={{ color: 'var(--color-border)' }}>|</span>
                <span>{threatInfo.stageCount} stage{threatInfo.stageCount > 1 ? 's' : ''}</span>
                {threatInfo.lyssaCount > 0 && (
                  <><span style={{ color: 'var(--color-border)' }}>|</span>
                  <span style={{ color: '#f88' }}>⚔ {threatInfo.lyssaCount} Lyssa</span></>
                )}
                <span style={{ color: 'var(--color-border)' }}>|</span>
                <span style={{ color: 'var(--color-text-muted)' }}>ratio <strong style={{ color: threatInfo.ratio >= 1.4 ? '#4caf50' : threatInfo.ratio >= 0.9 ? '#c8954a' : '#c84a4a' }}>{threatInfo.ratio}×</strong></span>
              </div>

              {/* Win probability bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10 }}>Est. success probability{threatInfo.hasLyssa ? ' (Lyssa-adjusted)' : ''}</span>
                  <strong style={{
                    color: threatInfo.winPct >= 75 ? '#4caf50' : threatInfo.winPct >= 40 ? '#c8954a' : '#c84a4a'
                  }}>{threatInfo.winPct}%</strong>
                </div>
                <div style={{ height: 7, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    height: '100%', width: `${threatInfo.pct}%`,
                    background: threatInfo.winPct >= 75 ? '#4caf50' : threatInfo.winPct >= 40 ? '#c8954a' : '#c84a4a',
                    borderRadius: 3, transition: 'width 0.3s, background 0.3s',
                  }} />
                  {/* 50% and 82% marker lines */}
                  <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: '100%', background: 'rgba(255,255,255,0.15)' }} />
                  <div style={{ position: 'absolute', top: 0, left: '82%', width: 1, height: '100%', background: 'rgba(255,255,255,0.15)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, color: 'var(--color-text-muted)', opacity: 0.6 }}>
                  <span>0%</span><span style={{ marginLeft: '42%' }}>50</span><span style={{ marginLeft: '22%' }}>82</span><span>100%</span>
                </div>
              </div>

              {/* Expected KIA */}
              {(threatInfo.lyssaCount > 0 || threatInfo.expectedKia.high > 0) && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 8px', borderRadius: 4,
                  background: threatInfo.expectedKia.high >= 20 ? 'rgba(200,74,74,0.12)' : threatInfo.expectedKia.high >= 8 ? 'rgba(200,149,74,0.10)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${threatInfo.expectedKia.high >= 20 ? 'rgba(200,74,74,0.3)' : threatInfo.expectedKia.high >= 8 ? 'rgba(200,149,74,0.25)' : 'var(--color-border)'}`,
                }}>
                  <span style={{ fontSize: 10 }}>Est. casualties</span>
                  <strong style={{
                    fontSize: 11,
                    color: threatInfo.expectedKia.high >= 20 ? '#c84a4a' : threatInfo.expectedKia.high >= 8 ? '#c8954a' : '#6ab06a',
                  }}>
                    {threatInfo.expectedKia.low === 0 && threatInfo.expectedKia.high === 0
                      ? '~0'
                      : threatInfo.expectedKia.low === threatInfo.expectedKia.high
                        ? `~${threatInfo.expectedKia.low}`
                        : `${threatInfo.expectedKia.low}–${threatInfo.expectedKia.high}`} KIA
                  </strong>
                </div>
              )}

              {/* FSI-needed bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10 }}>
                  <span>FSI needed for safe run (82%)</span>
                  <span style={{ color: bestTeamFsi >= threatInfo.fsiForSafe82 ? '#4caf50' : '#c8954a' }}>
                    {bestTeamFsi} / <strong>{threatInfo.fsiForSafe82}</strong>
                  </span>
                </div>
                <div style={{ height: 5, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((bestTeamFsi / threatInfo.fsiForSafe82) * 100))}%`,
                    background: bestTeamFsi >= threatInfo.fsiForSafe82 ? '#4caf50' : bestTeamFsi >= threatInfo.fsiNeeded ? '#c8954a' : '#c84a4a',
                    borderRadius: 3, transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              {threatInfo.hasLyssa && (
                <div style={{ fontSize: 9, color: '#f884', fontStyle: 'italic' }}>
                  ⚠ Lyssa missions carry higher variance than estimates imply — outcome depends on squad HP entering each stage.
                </div>
              )}
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={() => setLine(pickAdjLine(ADJ_LINES[mood]))}
            style={{
              alignSelf: 'flex-start', background: 'none',
              border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
              borderRadius: 4, fontSize: 10, padding: '3px 10px', cursor: 'pointer',
            }}
          >↻ another word</button>
        </div>
      </div>
    </div>
  );
}

function MissionListItem({ mission, selected, onSelect, onHoverIn, onHoverOut }: any) {
  const diffColor = mission.difficulty === 'easy' ? '#4a8c4a' : mission.difficulty === 'normal' ? '#c8954a' : mission.difficulty === 'hard' ? '#c84a4a' : mission.difficulty === 'hell' ? '#8b0000' : '#b84040';
  const rescueDefs = (mission.reward?.rescuedHeroineIds ?? []).map((id: string) => HEROINE_DEFINITIONS.find(h => h.id === id)).filter(Boolean);
  const FOCUS_BADGE: Record<string, { icon: string; label: string; color: string; tooltip: string }> = {
    gold_heavy:   { icon: '💰', label: 'Gold-heavy',   color: '#c8a84b', tooltip: "Raid the enemy's gold reserves or mine. Reward: 3× money, 0.5× all other resources." },
    supply_run:   { icon: '🍖', label: 'Supply Run',   color: '#6ab06a', tooltip: "Strike the enemy's supply lines or depot. Reward: 2× money, 2× food, 2× wood, 2× metal." },
    medal:        { icon: '🏅', label: 'Medal',        color: '#d4a84b', tooltip: 'Critical HQ strategic objective. Enemies +2 quality, +1 extra stage, extra Lyssa on final stage. Reward: 0.3× resources + prestige medal.' },
    weapon_gear:  { icon: '⚔️', label: 'Weapon/Gear', color: '#8ab0c8', tooltip: "Raid the enemy's arms cache. Reward: 0.5× resources + non-consumable equipment (1–4 items, scales with difficulty)." },
    consumable:   { icon: '💊', label: 'Consumable',  color: '#80c8a0', tooltip: "Hit the enemy's supply depot. Reward: 1× resources + consumable items (2–8, scales with difficulty)." },
    balanced:     { icon: '⚖️', label: 'Balanced',    color: '#888888', tooltip: 'Standard wipeout against a normal enemy force. Reward: 1× all resources. No equipment.' },
    strike_force: { icon: '🛡️', label: 'Strike Force',color: '#c87040', tooltip: 'Counter an enemy invasion advancing on HQ. Enemies +2 quality, +1 extra stage, extra Lyssa on final stage. Reward: 0.5× resources + prestige medal.' },
    rescue:       { icon: '⛓️', label: 'Rescue',      color: '#e08080', tooltip: 'Captive maidens are being held in this sector. Complete the mission to rescue them.' },
    lyssa_wave:   { icon: '🚨', label: 'Lyssa Wave',   color: '#ff4444', tooltip: 'EMERGENCY: A massive Lyssa-led force is attacking Fort Waelfeld directly. This is a mandatory defence — no other missions are available. Defeat = 25–75% of all base resources looted.' },
  };
  const focus = mission.rewardFocus ? FOCUS_BADGE[mission.rewardFocus] : null;
  const [focusTipPos, setFocusTipPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => onHoverIn?.(mission)}
      onMouseLeave={() => onHoverOut?.()}
      style={{
        padding: 10, background: 'var(--color-surface)', border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-text)' }}>
          {mission.isLocked && <span style={{ marginRight: 4 }}>🔒</span>}
          {mission.name}
          {mission.isCompleted && <span style={{ marginLeft: 4, color: '#4a8c4a' }}>✓</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: diffColor }}>{mission.difficulty === 'hell' ? '☠ HELL' : mission.difficulty.toUpperCase()} · {mission.stages.length} stages</span>
          {focus && (
            <span
              onMouseEnter={e => { const z = parseFloat(document.documentElement.style.zoom)||1; setFocusTipPos({ x: e.clientX/z, y: e.clientY/z }); }}
              onMouseMove={e => { const z = parseFloat(document.documentElement.style.zoom)||1; setFocusTipPos({ x: e.clientX/z, y: e.clientY/z }); }}
              onMouseLeave={() => setFocusTipPos(null)}
              style={{
                fontSize: 10, color: focus.color,
                background: `${focus.color}18`, border: `1px solid ${focus.color}55`,
                borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap', cursor: 'help',
                position: 'relative',
              }}
            >
              {focus.icon} {focus.label}
              {focusTipPos && ReactDOM.createPortal(
                <div style={{
                  position: 'fixed',
                  left: focusTipPos.x + 14,
                  top: focusTipPos.y + 14,
                  zIndex: 99999,
                  background: 'var(--color-surface)',
                  border: `1px solid ${focus.color}88`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  maxWidth: 270,
                  pointerEvents: 'none',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.65)',
                }}>
                  <div style={{ fontWeight: 700, color: focus.color, fontSize: 12, marginBottom: 5 }}>
                    {focus.icon} {focus.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {focus.tooltip}
                  </div>
                </div>,
                document.body,
              )}
            </span>
          )}
        </div>
      </div>
      {rescueDefs.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {rescueDefs.map((def: any) => (
            <div key={def.id} title={`Rescue: ${def.name}`} style={{ position: 'relative' }}>
              <img src={getMaidenIcon(def.imgId)} alt={def.name}
                style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3, border: '1px solid #ffd700', opacity: mission.isCompleted ? 0.4 : 1 }} />
              <span style={{ position: 'absolute', top: -5, right: -5, fontSize: 9, lineHeight: 1, filter: 'drop-shadow(0 0 2px #ffd700)' }}>★</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MissionDetail({ mission, teams, maidens, onStartMission, onClose }: any) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => {
    const firstNonEmpty = (teams as any[]).find(t => t.memberIds && t.memberIds.length > 0);
    return firstNonEmpty ? firstNonEmpty.id : null;
  });
  const [autoTradeFood, setAutoTradeFood] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoTradeFood');
    return saved === null ? true : saved === 'true';
  });
  const setAndSaveAutoTradeFood = (val: boolean) => {
    setAutoTradeFood(val);
    localStorage.setItem('autoTradeFood', String(val));
  };
  const [autoEquipCfg, setAutoEquipCfg] = useState<AutoEquipConfig>(loadAutoEquipConfig);
  const [autoEquipExpanded, setAutoEquipExpanded] = useState(false);
  const setAutoEquipSlot = (slot: AutoEquipSlot, val: boolean) => {
    const next = { ...autoEquipCfg, [slot]: val };
    setAutoEquipCfg(next);
    saveAutoEquipConfig(next);
  };
  const autoEquipActive = Object.values(autoEquipCfg).some(Boolean);
  const navigate = useNavigate();
  const currentFood = useGameStore(s => s.mbase.food ?? 0);
  const currentMoney = useGameStore(s => s.mbase.money ?? 0);
  const radioBuilt = useGameStore(s => s.buildings.find(b => b.id === 'radio_center')?.isConstructed ?? false);
  const maidenTeams = teams.filter((t: any) => t.type === 'maiden');
  const selectedTeam = maidenTeams.find((t: any) => t.id === selectedTeamId);
  const teamMembers = selectedTeam ? maidens.filter((m: Maiden) => selectedTeam.memberIds.includes(m.id)) : [];
  const rescueDefs = (mission.reward?.rescuedHeroineIds ?? []).map((id: string) => HEROINE_DEFINITIONS.find(h => h.id === id)).filter(Boolean);

  // A team is deployable only if it has at least one living member
  const teamDeployable = (t: any): boolean => {
    if (t.memberIds.length === 0) return false;
    return maidens.some((m: Maiden) => t.memberIds.includes(m.id) && m.currentHp > 0 && !m.isFallen && !m.isCaptured);
  };

  const selectedTeamBlocked = selectedTeam ? !teamDeployable(selectedTeam) : false;
  const canStart = !!selectedTeamId && !mission.isLocked && !selectedTeamBlocked;

  const blockReason = selectedTeam
    ? selectedTeam.memberIds.length === 0
      ? 'This team has no members.'
      : selectedTeamBlocked
      ? 'All members are dead or fallen — this team cannot deploy.'
      : null
    : null;

  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-accent)', borderRadius: 10, padding: 24, boxShadow: '0 12px 48px rgba(0,0,0,0.8)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ color: 'var(--color-accent)', margin: 0 }}>{mission.name}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginLeft: 12 }}>✕</button>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16, marginTop: 0 }}>{mission.description}</p>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>Conditions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <InfoBox label="Difficulty" value={mission.difficulty} />
          <InfoBox label="Weather" value={mission.weather} />
          <InfoBox label="Stages" value={mission.stages.length} />
          <InfoBox label="Status" value={mission.isCompleted ? 'Completed' : mission.isLocked ? 'Locked' : 'Available'} />
        </div>
      </div>

      {mission.reward && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>Rewards</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(mission.reward.money ?? 0) > 0 && <InfoBox label="Gold" value={mission.reward.money} />}
            {(mission.reward.food  ?? 0) > 0 && <InfoBox label="Food" value={mission.reward.food} />}
            {(mission.reward.wood  ?? 0) > 0 && <InfoBox label="Wood" value={mission.reward.wood} />}
            {(mission.reward.metal ?? 0) > 0 && <InfoBox label="Metal" value={mission.reward.metal} />}
          </div>
        </div>
      )}

      {/* Rescue heroines */}
      {rescueDefs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#ffd700', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>★ Rescue</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {rescueDefs.map((def: any) => (
              <div key={def.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,215,0,0.07)', border: '1px solid #ffd70066',
                borderRadius: 6, padding: '6px 10px',
              }}>
                <div style={{ position: 'relative' }}>
                  <img src={getMaidenIcon(def.imgId)} alt={def.name}
                    style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #ffd700', display: 'block' }} />
                  <span style={{ position: 'absolute', top: -6, right: -6, fontSize: 11, filter: 'drop-shadow(0 0 3px #ffd700)' }}>★</span>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ffd700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.nickname ?? def.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.name !== (def.nickname ?? def.name) ? def.name : ''}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{def.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mission.capturedMaidenIds?.length > 0 && (() => {
        // Filter to only show truly captured maidens, excluding those who escaped (have moraleQuitStatus === 'escaped')
        const capturedMaidens = mission.capturedMaidenIds
          .map((id: string) => maidens.find((m: Maiden) => m.id === id) as Maiden | undefined)
          .filter((m: Maiden | undefined): m is Maiden => Boolean(m) && (m as Maiden).isCaptured && (m as Maiden).moraleQuitStatus !== 'escaped');
        return (
          <div style={{ background: 'rgba(184,64,64,0.12)', border: '1px solid var(--color-danger)', borderRadius: 6, padding: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#e88', fontWeight: 'bold', marginBottom: capturedMaidens.length > 0 ? 8 : 0 }}>
              ⛓️ {capturedMaidens.length} maiden(s) held captive — defeat this mission to free them
            </div>
            {capturedMaidens.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {capturedMaidens.map((m: Maiden) => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'rgba(184,64,64,0.18)', border: '1px solid rgba(220,80,80,0.45)',
                    borderRadius: 6, padding: '5px 9px',
                  }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={getMaidenIcon(m.imgId)}
                        alt={m.name}
                        style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(220,80,80,0.6)', display: 'block', filter: 'saturate(0.6) brightness(0.85)' }}
                      />
                      <span style={{ position: 'absolute', top: -5, right: -5, fontSize: 11 }}>⛓️</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#e88', whiteSpace: 'nowrap' }}>{m.nickname ?? m.name.split(' ')[0]}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{m.name !== (m.nickname ?? m.name) ? m.name : ''}</div>
                      <div style={{ fontSize: 10, color: '#b66' }}>HP: {m.currentHp}/{m.maxHp}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Select Team</div>
        {maidenTeams.length === 0 ? (
          <div style={{ padding: '12px 14px', background: '#0e0d0b', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            No teams found. <button onClick={() => { onClose(); navigate('/composition'); }} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 12, padding: 0 }}>Create one on the Composition page →</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {maidenTeams.map((t: any) => {
              const deployable = teamDeployable(t);
              const members: Maiden[] = maidens.filter((m: Maiden) => t.memberIds.includes(m.id));
              const aliveMembers = members.filter((m: Maiden) => m.currentHp > 0 && !m.isFallen && !m.isCaptured);
              const leader = members.find((m: Maiden) => m.id === t.leaderId) ?? members[0];
              const foodCost = aliveMembers.reduce((sum: number, m: Maiden) => sum + 20 + (m.stats?.strength ?? 0), 0);
              const isSelected = selectedTeamId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => deployable && setSelectedTeamId(isSelected ? null : t.id)}
                  style={{
                    position: 'relative',
                    background: isSelected ? 'rgba(200,149,74,0.12)' : '#0e0d0b',
                    border: `2px solid ${isSelected ? 'var(--color-accent)' : deployable ? 'var(--color-border)' : '#3a2020'}`,
                    borderRadius: 8,
                    padding: '10px 10px 8px',
                    cursor: deployable ? 'pointer' : 'not-allowed',
                    opacity: deployable ? 1 : 0.5,
                    transition: 'border-color 0.15s, background 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    userSelect: 'none',
                  }}
                >
                  {/* Edit button */}
                  <button
                    onClick={e => { e.stopPropagation(); onClose(); navigate('/composition'); }}
                    title="Edit team formation"
                    style={{
                      position: 'absolute', top: 5, right: 5,
                      background: 'rgba(200,149,74,0.15)',
                      border: '1px solid var(--color-accent-dark)',
                      borderRadius: 4, color: 'var(--color-accent)',
                      cursor: 'pointer', fontSize: 11, lineHeight: 1,
                      padding: '2px 4px',
                    }}
                  >✏️</button>

                  {/* Leader portrait */}
                  {leader ? (
                    <img
                      src={getMaidenIcon(leader.imgId)}
                      alt={leader.name}
                      style={{
                        width: 52, height: 52,
                        objectFit: 'cover',
                        borderRadius: 6,
                        border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        filter: deployable ? 'none' : 'grayscale(80%)',
                      }}
                    />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
                  )}

                  {/* Team name */}
                  <div style={{
                    fontSize: 11, fontWeight: 'bold',
                    color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
                    textAlign: 'center', lineHeight: 1.2,
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.name}</div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--color-text-muted)' }}>
                    <span title="Alive / total members">👤 {aliveMembers.length}/{members.length}</span>
                    <span title="Food cost to deploy">🍖 {foodCost}</span>
                  </div>

                  {/* Selected checkmark */}
                  {isSelected && (
                    <div style={{ position: 'absolute', top: 5, left: 7, fontSize: 12, color: 'var(--color-accent)' }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedTeam && (() => {
        const deployableMembers = teamMembers.filter((m: Maiden) => m.currentHp > 0 && !m.isFallen && !m.isCaptured);
        const totalCost = deployableMembers.reduce((sum: number, m: Maiden) => sum + 20 + (m.stats?.strength ?? 0), 0);
        const deficit = Math.max(0, totalCost - currentFood);
        // Auto-trade: 2 gold → 1 food
        const maxTradeable = autoTradeFood && radioBuilt ? Math.floor(currentMoney / 2) : 0;
        const tradedFood = Math.min(maxTradeable, deficit);
        const effectiveFood = currentFood + tradedFood;
        const insufficient = effectiveFood < totalCost;
        // Compute which maidens will starve using effectiveFood
        let remaining = effectiveFood;
        const starvedNames: string[] = [];
        for (const m of deployableMembers) {
          const cost = 20 + (m.stats?.strength ?? 0);
          if (remaining >= cost) { remaining -= cost; }
          else { remaining = 0; starvedNames.push(m.nickname ?? m.name.split(' ')[0]); }
        }
        return (
          <div style={{
            padding: '7px 10px', marginBottom: 8, borderRadius: 4,
            background: insufficient ? 'rgba(184,64,64,0.12)' : 'rgba(0,0,0,0.25)',
            border: `1px solid ${insufficient ? 'var(--color-danger)' : 'var(--color-border)'}`,
            fontSize: 11,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>🍖 March rations</span>
              <span style={{ color: insufficient ? '#e88' : 'var(--color-text-muted)' }}>
                {totalCost} food&nbsp;
                <span style={{ opacity: 0.65 }}>(have: {currentFood}{tradedFood > 0 ? ` +${tradedFood} traded` : ''})</span>
              </span>
            </div>
            {radioBuilt && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--color-text-muted)', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={autoTradeFood}
                    onChange={e => setAndSaveAutoTradeFood(e.target.checked)}
                    style={{ accentColor: 'var(--color-accent)', width: 13, height: 13, cursor: 'pointer' }}
                  />
                  Auto-trade food &nbsp;<span style={{ opacity: 0.6 }}>(2💰 → 1🍖)</span>
                </label>
                {autoTradeFood && (
                  <span style={{ opacity: 0.65 }}>
                    💰 {currentMoney} → spend {tradedFood * 2}
                  </span>
                )}
              </div>
            )}
            {starvedNames.length > 0 && (
              <div style={{ marginTop: 5, color: '#e88', lineHeight: 1.5 }}>
                ⚠️ <strong>Starved:</strong> {starvedNames.join(', ')} — HP halved, −3 permanent morale, −50% hit rate / dodge / scout / cover
              </div>
            )}
          </div>
        );
      })()}

      {/* Auto-Equip */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setAutoEquipExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: autoEquipActive ? 'rgba(200,149,74,0.1)' : '#0e0d0b',
            border: `1px solid ${autoEquipActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: autoEquipExpanded ? '4px 4px 0 0' : 4,
            color: autoEquipActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
            cursor: 'pointer', fontSize: 11, padding: '5px 10px', userSelect: 'none',
          }}
        >
          <span>🎒 Auto-Equip{autoEquipActive ? ` (${Object.values(autoEquipCfg).filter(Boolean).length} active)` : ''}</span>
          <span>{autoEquipExpanded ? '▲' : '▼'}</span>
        </button>
        {autoEquipExpanded && (
          <div style={{
            background: '#0e0d0b', border: '1px solid var(--color-border)',
            borderTop: 'none', borderRadius: '0 0 4px 4px',
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>
              Before deployment, equipped maidens will automatically take better gear from the base inventory.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px 12px' }}>
              {(AUTO_EQUIP_SLOTS.filter(s => !['potion','ration','grenade'].includes(s)) as AutoEquipSlot[]).map(slot => (
                <label key={slot} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', fontSize: 11, color: autoEquipCfg[slot] ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={autoEquipCfg[slot]}
                    onChange={e => setAutoEquipSlot(slot, e.target.checked)}
                    style={{ accentColor: 'var(--color-accent)', width: 12, height: 12, cursor: 'pointer' }}
                  />
                  {AE_SLOT_LABELS[slot]}
                </label>
              ))}
            </div>
            <div style={{ paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 5 }}>Consumables <span style={{ opacity: 0.55 }}>(up to {mission.stages.length} per type)</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px 12px' }}>
                {(['potion','ration','grenade'] as AutoEquipSlot[]).map(slot => (
                  <label key={slot} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', fontSize: 11, color: autoEquipCfg[slot] ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    <input
                      type="checkbox"
                      checked={autoEquipCfg[slot]}
                      onChange={e => setAutoEquipSlot(slot, e.target.checked)}
                      style={{ accentColor: 'var(--color-accent)', width: 12, height: 12, cursor: 'pointer' }}
                    />
                    {AE_SLOT_LABELS[slot]}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>
              ⚠️ Carry weight limits are respected. Exclusive slots (Weapon / Head / Mask / Body / Arms / Legs) swap only if a better-rated item is found. Accessories and medals fill remaining capacity.
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => canStart && onStartMission(selectedTeamId, autoTradeFood, autoEquipCfg)}
        disabled={!canStart}
        style={{
          width: '100%', padding: '10px', background: canStart ? 'var(--color-accent-dark)' : '#555',
          color: '#fff', border: 'none', borderRadius: 6, cursor: canStart ? 'pointer' : 'not-allowed',
          fontSize: 13, fontWeight: 'bold',
        }}
      >
        {mission.isLocked ? '🔒 Locked' : 'Start Mission'}
      </button>
      {blockReason && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-danger)', textAlign: 'center' }}>
          ⚠️ {blockReason}
        </div>
      )}
    </div>
  );
}

function BattleScreen({ mission, missionState, speed, setSpeed, onSyncHP, onAbortMission, onStageComplete }: any) {
  const [stageOutcome, setStageOutcome] = useState<StageOutcome | null>(null);
  const [stageExpGains, setStageExpGains] = useState<ExpGain[]>([]);
  const [stageMoraleGains, setStageMoraleGains] = useState<any[]>([]);
  const [permanentMoraleDeltas, setPermanentMoraleDeltas] = useState<Map<string, number>>(new Map());
  const [moraleEscapedIds, setMoraleEscapedIds] = useState<string[]>([]);;
  const [moraleCapturedIds, setMoraleCapturedIds] = useState<string[]>([]);
  const [maidenStates, setMaidenStates] = useState<Maiden[]>([...missionState.stageMaidens]);
  const [enemyStates, setEnemyStates] = useState<any[]>([...missionState.stageEnemies]);
  const [allRawEvents, setAllRawEvents] = useState<CombatEvent[]>([]);
  const [displayedEvents, setDisplayedEvents] = useState<CombatEvent[]>([]);
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [battleComplete, setBattleComplete] = useState(false);
  const [maidenCover, setMaidenCover] = useState<string[]>([]);
  const [enemyCover, setEnemyCover] = useState<string[]>([]);
  const [stunnedEnemies, setStunnedEnemies] = useState<string[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);
  const [moraleLogExpanded, setMoraleLogExpanded] = useState(false);
  const [moraleLogFilter, setMoraleLogFilter] = useState<'all' | 'maiden' | 'enemy'>('all');
  const [moraleLogCombatantId, setMoraleLogCombatantId] = useState<string>('');
  const [moraleLogText, setMoraleLogText] = useState<string>('');
  // Morale display state
  const [maidenTeamMorale, setMaidenTeamMorale] = useState(50);
  const [enemyTeamMorale, setEnemyTeamMorale] = useState(50);
  const [personalMoraleState, setPersonalMoraleState] = useState<Record<string, number>>({});
  // Per-combatant status icons: by combatant display name
  const [escapingNames, setEscapingNames] = useState<string[]>([]);   // morale=0, outcome pending
  const [escapedNames, setEscapedNames] = useState<string[]>([]);     // fled successfully
  const [capturedNames, setCapturedNames] = useState<string[]>([]);   // taken captive
  const hpSyncedRef = useRef(false); // ensure we only auto-sync HP once per stage
  // speedRef keeps speed readable inside timeouts without stale closures; sync on every render
  const speedRef = useRef<number>(speed);
  speedRef.current = speed;
  const [skipped, setSkipped] = useState(false);  // true after Skip is pressed
  const skippedRef = useRef(false);
  // The event currently shown in the action stage (latest non-trivial event)
  const [stageEvent, setStageEvent] = useState<CombatEvent | null>(null);
  const [stageVisible, setStageVisible] = useState(false);

  const currentStage = mission.stages[missionState.currentStageIdx];
  const coverLevel: number = currentStage?.coverLevel ?? 0;

  // All combatants lookup for portrait resolution
  const allCombatants = [...maidenStates, ...enemyStates];

  useEffect(() => {
    if (allRawEvents.length === 0) {
      const result = simulateStage(missionState.stageMaidens, missionState.stageEnemies, coverLevel, undefined, missionState.leaderId);
      setAllRawEvents(result.events);
      setStageOutcome(result.outcome);
      setStageExpGains(result.expGains);
      setStageMoraleGains(result.moraleGains ?? []);
      setPermanentMoraleDeltas(result.permanentMoraleDeltas ?? new Map());
      setMoraleEscapedIds(result.moraleEscapedIds ?? []);
      setMoraleCapturedIds(result.moraleCapturedIds ?? []);
      // Seed initial team morale from first moraleSnapshot if available
      const firstMoraleEvt = result.events.find(e => e.moraleSnapshot);
      if (firstMoraleEvt?.moraleSnapshot) {
        setMaidenTeamMorale(firstMoraleEvt.moraleSnapshot.maidenTeam);
        setEnemyTeamMorale(firstMoraleEvt.moraleSnapshot.enemyTeam);
        if (firstMoraleEvt.moraleSnapshot.personal) {
          setPersonalMoraleState(firstMoraleEvt.moraleSnapshot.personal);
        }
      }
    }
  }, []);

  // Auto-sync HP to store as soon as a stage concludes (before player clicks Next)
  const maidenStatesRef = useRef(maidenStates);
  maidenStatesRef.current = maidenStates;
  // Keep a ref to moraleCapturedIds so the battleComplete effect can read the latest value
  const moraleCapturedIdsRef = useRef(moraleCapturedIds);
  moraleCapturedIdsRef.current = moraleCapturedIds;
  useEffect(() => {
    if (battleComplete && !hpSyncedRef.current) {
      hpSyncedRef.current = true;
      // Morale-captured maidens have HP=0 in the simulation as an internal mechanism;
      // they must NOT be treated as "dead by gunfire" here — applyMoraleQuitEvents
      // handles their state (isCaptured: true). Only truly dead maidens are synced.
      const capturedSet = new Set(moraleCapturedIdsRef.current);
      const syncMaidens = maidenStatesRef.current.map(m => {
        // If the simulation has her at 0 HP but she is NOT in capturedSet, her death
        // may not have been parsed from the log (e.g. grenade friendly-fire).
        // Use maidenStates HP as-is for everyone; the captured guard in onSyncHP
        // ensures captured maidens are never falsely marked fallen.
        return capturedSet.has(m.id) ? { ...m, currentHp: Math.max(1, m.currentHp) } : m;
      });
      onSyncHP(syncMaidens);
    }
  }, [battleComplete]);

  useEffect(() => {
    if (allRawEvents.length === 0 || currentEventIdx >= allRawEvents.length) {
      if (currentEventIdx >= allRawEvents.length && allRawEvents.length > 0) {
        setBattleComplete(true);
      }
      return;
    }

    const event = allRawEvents[currentEventIdx];
    // Base hold times; divided by current speed multiplier
    const baseHoldMs =
      event.type === 'log' && event.message.includes('Round') ? 2200
      : (event.type === 'attack' || event.type === 'retreat_fire') &&
        (event.message.startsWith('💣') || event.message.startsWith('💥'))    ? 2000
      : event.type === 'attack' || event.type === 'retreat_fire'               ? 1800
      : event.type === 'miss'   && event.message.startsWith('💣')              ? 1600
      : event.type === 'log'    && (event.message.startsWith('💊') || event.message.startsWith('🍖')) ? 1800
      : event.type === 'miss'                                                   ? 1400
      : event.type === 'cover_gained' || event.type === 'cover_lost' || event.type === 'cover_blocked' ? 1000
      : 600;
    const holdMs   = Math.round(baseHoldMs / speedRef.current);
    const fadeOutMs = Math.max(60, Math.round(200  / speedRef.current));
    const pauseMs   = Math.max(30, Math.round(150  / speedRef.current));

    // If Skip was pressed between renders, bail out immediately
    if (skippedRef.current) return;

    const timer = setTimeout(() => {
      if (skippedRef.current) return;
      setDisplayedEvents(prev => [...prev, event]);
      applyEventToStates(event);

      setStageEvent(event);
      setStageVisible(true);

      setTimeout(() => {
        setStageVisible(false);
        setTimeout(() => setCurrentEventIdx(currentEventIdx + 1), pauseMs);
      }, holdMs - fadeOutMs);
    }, Math.round(80 / speedRef.current));

    return () => clearTimeout(timer);
  }, [currentEventIdx, allRawEvents]);

  const handleSkip = () => {
    skippedRef.current = true;
    setSkipped(true);
    // Apply every remaining event immediately
    const remaining = allRawEvents.slice(currentEventIdx);
    // We need to compute final HP/cover purely from the raw events, then batch-set state
    let nextMaidens = [...maidenStates];
    let nextEnemies = [...enemyStates];
    let nextMaidenCover = [...maidenCover];
    let nextEnemyCover  = [...enemyCover];
    for (const ev of remaining) {
      if (ev.type === 'attack') {
        // Standard hit
        const m = ev.message.match(/(.+?)\s+hits\s+(.+?)\s+for\s+(\d+)\s+damage/);
        if (m) {
          const target = m[2]; const dmg = parseInt(m[3]);
          nextMaidens = nextMaidens.map(x =>
            (x.nickname ?? x.name.split(' ')[0]) === target || x.name === target
              ? { ...x, currentHp: Math.max(0, x.currentHp - dmg) } : x);
          nextEnemies = nextEnemies.map(x =>
            x.name === target ? { ...x, currentHp: (x as any).type === 'lyssa' ? Math.max(1, x.currentHp - dmg) : Math.max(0, x.currentHp - dmg) } : x);
        }
        // Grenade multi-hits
        if (ev.message.startsWith('💣') || ev.message.startsWith('💥')) {
          const pairRx = /([\w\s'\-]+?)\s+\((\d+)\s+dmg/g;
          let gm: RegExpExecArray | null;
          while ((gm = pairRx.exec(ev.message)) !== null) {
            const tName = gm[1].trim(); const gdmg = parseInt(gm[2]);
            nextEnemies = nextEnemies.map(x =>
              x.name === tName ? { ...x, currentHp: (x as any).type === 'lyssa' ? Math.max(1, x.currentHp - gdmg) : Math.max(0, x.currentHp - gdmg) } : x);
            nextMaidens = nextMaidens.map(x =>
              (x.nickname ?? x.name.split(' ')[0]) === tName || x.name === tName
                ? { ...x, currentHp: Math.max(0, x.currentHp - gdmg) } : x);
          }
        }
      }
      if (ev.type === 'log') {
        // Potion heal
        const potionM = ev.message.match(/^💊\s+(.+?)\s+uses .+?now\s+(\d+)\/(\d+)\s+HP/);
        if (potionM) {
          const healerName = potionM[1].trim(); const newHp = parseInt(potionM[2]);
          nextMaidens = nextMaidens.map(x =>
            (x.nickname ?? x.name.split(' ')[0]) === healerName || x.name === healerName
              ? { ...x, currentHp: newHp } : x);
        }
        // Rations HP
        const rationsM = ev.message.match(/^🍖\s+(.+?)\s+eats .+?\+\s*(\d+)\s+HP/);
        if (rationsM && parseInt(rationsM[2]) > 0) {
          const eaterName = rationsM[1].trim(); const hpGain = parseInt(rationsM[2]);
          nextMaidens = nextMaidens.map(x =>
            (x.nickname ?? x.name.split(' ')[0]) === eaterName || x.name === eaterName
              ? { ...x, currentHp: Math.min(x.maxHp, x.currentHp + hpGain) } : x);
        }
        // Grenade critical error (friendly-fire)
        const ffM = ev.message.match(/^💥 \[Critical Error!\].+?([\w\s'\-]+?)\s+takes\s+(\d+)\s+friendly-fire damage/);
        if (ffM) {
          const victimName = ffM[1].trim(); const dmg = parseInt(ffM[2]);
          nextMaidens = nextMaidens.map(x =>
            (x.nickname ?? x.name.split(' ')[0]) === victimName || x.name === victimName
              ? { ...x, currentHp: Math.max(0, x.currentHp - dmg) } : x);
        }
      }
      if (ev.type === 'cover_gained') {
        const isMaiden = nextMaidens.some(x => (x.nickname ?? x.name) === ev.attackerName || x.name === ev.attackerName);
        if (isMaiden) { if (!nextMaidenCover.includes(ev.attackerName)) nextMaidenCover = [...nextMaidenCover, ev.attackerName]; }
        else          { if (!nextEnemyCover.includes(ev.attackerName))  nextEnemyCover  = [...nextEnemyCover,  ev.attackerName]; }
      }
      if (ev.type === 'cover_lost') {
        nextMaidenCover = nextMaidenCover.filter(n => n !== ev.attackerName);
        nextEnemyCover  = nextEnemyCover.filter(n => n !== ev.attackerName);
      }
    }
    // Accumulate status changes from remaining events
    let nextEscaping = [...escapingNames];
    let nextEscaped  = [...escapedNames];
    let nextCaptured = [...capturedNames];
    for (const ev of remaining) {
      if (ev.type === 'log') {
        if (ev.message.includes('RETREAT: Your team attempts to retreat')) setRetreatingTeam('maiden');
        if (ev.message.includes('ENEMY RETREATS')) setRetreatingTeam('enemy');
        if (ev.message.includes('[Lyssa Stun]') && ev.message.includes('stunned')) {
          const n = ev.attackerName;
          setStunnedEnemies(prev => prev.includes(n) ? prev : [...prev, n]);
        }
        if (ev.message.includes('[Lyssa]') && ev.message.includes('Stun clears')) {
          const n = ev.attackerName;
          setStunnedEnemies(prev => prev.filter(x => x !== n));
        }
        if (ev.message.includes('[Morale]') && ev.message.includes('lost her nerve')) {
          const n = ev.attackerName;
          if (!nextEscaping.includes(n)) nextEscaping = [...nextEscaping, n];
        }
        if (ev.message.includes('[Morale]') && ev.message.includes('escapes from the battlefield')) {
          const n = ev.attackerName;
          nextEscaping = nextEscaping.filter(x => x !== n);
          if (!nextEscaped.includes(n)) nextEscaped = [...nextEscaped, n];
        }
        if (ev.message.includes('[Morale]') && ev.message.includes('captured by the enemy')) {
          const n = ev.attackerName;
          nextEscaping = nextEscaping.filter(x => x !== n);
          if (!nextCaptured.includes(n)) nextCaptured = [...nextCaptured, n];
        }
      }
    }
    setEscapingNames(nextEscaping);
    setEscapedNames(nextEscaped);
    setCapturedNames(nextCaptured);
    setMaidenStates(nextMaidens);
    setEnemyStates(nextEnemies);
    setMaidenCover(nextMaidenCover);
    setEnemyCover(nextEnemyCover);
    setDisplayedEvents(allRawEvents);
    setStageVisible(false);
    // Apply final morale snapshot
    const lastMoraleEvt = [...remaining].reverse().find(e => e.moraleSnapshot);
    if (lastMoraleEvt?.moraleSnapshot) {
      setMaidenTeamMorale(lastMoraleEvt.moraleSnapshot.maidenTeam);
      setEnemyTeamMorale(lastMoraleEvt.moraleSnapshot.enemyTeam);
      if (lastMoraleEvt.moraleSnapshot.personal) {
        setPersonalMoraleState(lastMoraleEvt.moraleSnapshot.personal);
      }
    }
    setCurrentEventIdx(allRawEvents.length); // triggers battleComplete via useEffect
  };

  const [retreatingTeam, setRetreatingTeam] = useState<'maiden' | 'enemy' | null>(null);

  const applyEventToStates = (event: CombatEvent) => {
    if (event.type === 'attack') {
      // Standard hit: "X hits Y for N damage"
      const match = event.message.match(/(.+?)\s+hits\s+(.+?)\s+for\s+(\d+)\s+damage/);
      if (match) {
        const targetName = match[2];
        const damage = parseInt(match[3]);
        const targetMaiden = maidenStates.find(m =>
          (m.nickname ?? m.name.split(' ')[0]) === targetName || m.name === targetName
        );
        const targetEnemy = enemyStates.find(e => e.name === targetName);
        if (targetMaiden) {
          setMaidenStates(prev => prev.map(m =>
            m.id === targetMaiden.id ? { ...m, currentHp: Math.max(0, m.currentHp - damage) } : m
          ));
        } else if (targetEnemy) {
          setEnemyStates(prev => prev.map(e =>
            e.id === targetEnemy.id
              ? { ...e, currentHp: (e as any).type === 'lyssa' ? Math.max(1, e.currentHp - damage) : Math.max(0, e.currentHp - damage) }
              : e
          ));
        }
      }
      // Grenade hits: individual "NAME (N dmg)" pairs in the message
      if (event.message.startsWith('💣') || event.message.startsWith('💥')) {
        const pairRegex = /([\w\s'\-]+?)\s+\((\d+)\s+dmg/g;
        let m: RegExpExecArray | null;
        while ((m = pairRegex.exec(event.message)) !== null) {
          const tName = m[1].trim();
          const dmg = parseInt(m[2]);
          const tEnemy = enemyStates.find(e => e.name === tName);
          const tMaiden = maidenStates.find(x => (x.nickname ?? x.name.split(' ')[0]) === tName || x.name === tName);
          if (tEnemy) {
            setEnemyStates(prev => prev.map(e =>
              e.id === tEnemy.id
                ? { ...e, currentHp: (e as any).type === 'lyssa' ? Math.max(1, e.currentHp - dmg) : Math.max(0, e.currentHp - dmg) }
                : e
            ));
          } else if (tMaiden) {
            setMaidenStates(prev => prev.map(x =>
              x.id === tMaiden.id ? { ...x, currentHp: Math.max(0, x.currentHp - dmg) } : x
            ));
          }
        }
      }
    }
    if (event.type === 'log') {
      // Healing potion: "💊 NAME uses ITEM! (+N HP, now C/M HP)"
      const potionMatch = event.message.match(/^💊\s+(.+?)\s+uses .+?now\s+(\d+)\/(\d+)\s+HP/);
      if (potionMatch) {
        const healerName = potionMatch[1].trim();
        const newHp = parseInt(potionMatch[2]);
        setMaidenStates(prev => prev.map(m =>
          (m.nickname ?? m.name.split(' ')[0]) === healerName || m.name === healerName
            ? { ...m, currentHp: newHp } : m
        ));
      }
      // Grenade critical error (friendly-fire): "💥 [Critical Error!] X's grenade ... Y takes N friendly-fire damage!"
      const ffMatch = event.message.match(/^💥 \[Critical Error!\].+?([\w\s'\-]+?)\s+takes\s+(\d+)\s+friendly-fire damage/);
      if (ffMatch) {
        const victimName = ffMatch[1].trim();
        const dmg = parseInt(ffMatch[2]);
        setMaidenStates(prev => prev.map(m =>
          (m.nickname ?? m.name.split(' ')[0]) === victimName || m.name === victimName
            ? { ...m, currentHp: Math.max(0, m.currentHp - dmg) } : m
        ));
      }
      // Rations: "🍖 NAME eats ITEM before the engagement. (+N HP, +M morale)"
      const rationsHpMatch = event.message.match(/^🍖\s+(.+?)\s+eats .+?\+\s*(\d+)\s+HP/);
      if (rationsHpMatch && parseInt(rationsHpMatch[2]) > 0) {
        const eaterName = rationsHpMatch[1].trim();
        const hpGain = parseInt(rationsHpMatch[2]);
        setMaidenStates(prev => prev.map(m =>
          (m.nickname ?? m.name.split(' ')[0]) === eaterName || m.name === eaterName
            ? { ...m, currentHp: Math.min(m.maxHp, m.currentHp + hpGain) } : m
        ));
      }
    }
    if (event.type === 'cover_gained') {
      const name = event.attackerName;
      const isMaiden = maidenStates.some(m => (m.nickname ?? m.name) === name || m.name === name);
      if (isMaiden) setMaidenCover(prev => prev.includes(name) ? prev : [...prev, name]);
      else setEnemyCover(prev => prev.includes(name) ? prev : [...prev, name]);
    }
    if (event.type === 'cover_lost') {
      const name = event.attackerName;
      setMaidenCover(prev => prev.filter(n => n !== name));
      setEnemyCover(prev => prev.filter(n => n !== name));
    }
    if (event.type === 'log') {
      if (event.message.includes('RETREAT: Your team attempts to retreat')) setRetreatingTeam('maiden');
      if (event.message.includes('ENEMY RETREATS')) setRetreatingTeam('enemy');
      // Lyssa stun tracking
      if (event.message.includes('[Lyssa Stun]') && event.message.includes('stunned')) {
        const name = event.attackerName;
        setStunnedEnemies(prev => prev.includes(name) ? prev : [...prev, name]);
      }
      if (event.message.includes('[Lyssa]') && event.message.includes('Stun clears')) {
        const name = event.attackerName;
        setStunnedEnemies(prev => prev.filter(n => n !== name));
      }
      // Morale-zero status tracking
      if (event.message.includes('[Morale]') && event.message.includes('lost her nerve')) {
        const name = event.attackerName;
        setEscapingNames(prev => prev.includes(name) ? prev : [...prev, name]);
      }
      if (event.message.includes('[Morale]') && event.message.includes('escapes from the battlefield')) {
        const name = event.attackerName;
        setEscapingNames(prev => prev.filter(n => n !== name));
        setEscapedNames(prev => prev.includes(name) ? prev : [...prev, name]);
      }
      if (event.message.includes('[Morale]') && event.message.includes('captured by the enemy')) {
        const name = event.attackerName;
        setEscapingNames(prev => prev.filter(n => n !== name));
        setCapturedNames(prev => prev.includes(name) ? prev : [...prev, name]);
      }
    }
    // Update team morale display from snapshot on any event
    if (event.moraleSnapshot) {
      setMaidenTeamMorale(event.moraleSnapshot.maidenTeam);
      setEnemyTeamMorale(event.moraleSnapshot.enemyTeam);
      if (event.moraleSnapshot.personal) {
        setPersonalMoraleState(event.moraleSnapshot.personal);
      }
    }
  };

  const isVictory = stageOutcome === 'maiden_victory' || stageOutcome === 'enemy_retreat';

  return (
    <div style={{ minHeight: '100vh', padding: 24, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {!battleComplete && (
          <>
            {/* Speed cycling button: 1x → 2x → 4x → 8x → 1x */}
            <button
              onClick={() => {
                const next = speed === 1 ? 2 : speed === 2 ? 4 : speed === 4 ? 8 : 1;
                speedRef.current = next;
                setSpeed(next as 1 | 2 | 4 | 8);
                writeSpeedCookie(next as 1 | 2 | 4 | 8);
              }}
              title="Cycle playback speed"
              style={{
                padding: '6px 14px',
                background: speed === 1 ? '#1e2a1e' : speed === 2 ? '#1e2a38' : speed === 4 ? '#2a1e38' : '#3a1e1e',
                color:      speed === 1 ? '#6ab06a' : speed === 2 ? '#6aaad0' : speed === 4 ? '#a06ad0' : '#d06a6a',
                border: `1px solid ${speed === 1 ? '#3a6a3a' : speed === 2 ? '#3a6a9a' : speed === 4 ? '#6a3a9a' : '#9a3a3a'}`,
                borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', minWidth: 52,
              }}
            >
              {speed === 1 ? '▶ 1×' : speed === 2 ? '⏩ 2×' : speed === 4 ? '⏩ 4×' : '⏩ 8×'}
            </button>
            {/* Skip: resolve battle instantly */}
            <button
              onClick={handleSkip}
              disabled={skipped}
              title="Skip all animations and resolve the battle instantly"
              style={{
                padding: '6px 14px', background: skipped ? '#333' : '#2a2a2a', color: skipped ? '#555' : '#aaa',
                border: `1px solid ${skipped ? '#444' : '#666'}`, borderRadius: 4,
                cursor: skipped ? 'default' : 'pointer', fontSize: 12,
              }}
            >
              ⏭ Skip
            </button>
          </>
        )}
      </div>

      <h2 style={{ marginBottom: 4 }}>🗡️ {mission.name} — Stage {missionState.currentStageIdx + 1}/{mission.stages.length}</h2>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>{currentStage.description}</div>
      <div style={{ borderTop: '1px dashed var(--color-border)', marginBottom: 16 }} />

      {/* Stage result — shown at the top as soon as battle concludes */}
      {battleComplete && (() => {
        const capturedSet  = new Set(moraleCapturedIds);
        const escapedSet   = new Set(moraleEscapedIds);
        // Morale-captured/escaped IDs not yet reflected in maidenStates flags (applied on Next click)
        const alive        = maidenStates.filter(m => m.currentHp > 0 && !m.isFallen && !m.isCaptured && !capturedSet.has(m.id) && !escapedSet.has(m.id));
        const dead         = maidenStates.filter(m => m.isFallen || (m.currentHp <= 0 && !capturedSet.has(m.id)));
        // Morale-captured: IDs in capturedSet — resolve names from maidenStates
        const moraleCaptured = maidenStates.filter(m => capturedSet.has(m.id));
        // Morale-escaped: IDs in escapedSet
        const moraleEscaped  = maidenStates.filter(m => escapedSet.has(m.id));
        const belowHalf    = alive.filter(m => m.currentHp < (m.maxHp ?? 1) * 0.5);
        const lowMorale    = alive.filter(m => (personalMoraleState[m.id] ?? 50) < 30);
        const isFinalStage = isVictory && missionState.currentStageIdx >= mission.stages.length - 1;
        const reward       = isFinalStage ? mission.reward : null;
        return (
          <div style={{
            background: isVictory ? 'rgba(74,140,74,0.1)' : 'rgba(184,64,64,0.1)',
            border: `1px solid ${isVictory ? '#4a8c4a' : 'var(--color-danger)'}`,
            borderRadius: 8, padding: 16, marginBottom: 16,
          }}>
            <h3 style={{ marginTop: 0, color: isVictory ? '#4a8c4a' : 'var(--color-danger)' }}>
              {stageOutcome === 'maiden_victory' ? '✓ Stage Victory!' : stageOutcome === 'enemy_retreat' ? '⟳ Enemy Retreated!' : stageOutcome === 'maiden_retreat_success' ? '⟳ Retreat Successful' : '✗ Stage Defeat'}
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 12 }}>
              {stageOutcome === 'maiden_victory'
                ? 'Your team defeated all enemies! Proceed to the next stage.'
                : stageOutcome === 'enemy_retreat'
                ? 'The enemy force broke and retreated! Proceed to the next stage.'
                : stageOutcome === 'maiden_retreat_success'
                ? 'Your team retreated successfully with survivors. Mission failed.'
                : 'Your team was defeated. Some maidens were captured!'}
            </p>

            {/* Maiden status summary */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {([
                { icon: '🟢', label: 'Alive',        count: alive.length,             color: '#4a9c5a', always: true },
                { icon: '💀', label: 'KIA',           count: dead.length,              color: '#b84040', always: false },
                { icon: '⛓️', label: 'Captured',     count: moraleCaptured.length,    color: '#c8a84b', always: false },
                { icon: '🏃', label: 'Fled',          count: moraleEscaped.length,     color: '#8b8b40', always: false },
                { icon: '🩸', label: 'Below 50% HP', count: belowHalf.length,         color: '#c87040', always: false },
                { icon: '😰', label: 'Low Morale',   count: lowMorale.length,         color: '#8b5fc4', always: false },
              ] as const).filter(s => s.always || s.count > 0).map(s => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}44`,
                  borderRadius: 6, padding: '5px 12px', fontSize: 13,
                }}>
                  <span>{s.icon}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{s.label}:</span>
                  <span style={{ color: s.color, fontWeight: 'bold', fontFamily: 'monospace' }}>{s.count}</span>
                </div>
              ))}
            </div>

            {/* Detail rows — only when something noteworthy */}
            {dead.length > 0 && (
              <div style={{ fontSize: 11, color: '#b84040', marginBottom: 6 }}>
                <strong>KIA:</strong> {dead.map(m => m.nickname ?? m.name.split(' ')[0]).join(', ')}
              </div>
            )}
            {moraleCaptured.length > 0 && (
              <div style={{ fontSize: 11, color: '#c8a84b', marginBottom: 6 }}>
                <strong>⛓️ Captured:</strong> {moraleCaptured.map(m => m.nickname ?? m.name.split(' ')[0]).join(', ')}
              </div>
            )}
            {moraleEscaped.length > 0 && (
              <div style={{ fontSize: 11, color: '#8b8b40', marginBottom: 6 }}>
                <strong>🏃 Fled:</strong> {moraleEscaped.map(m => m.nickname ?? m.name.split(' ')[0]).join(', ')}
              </div>
            )}
            {belowHalf.length > 0 && (
              <div style={{ fontSize: 11, color: '#c87040', marginBottom: 6 }}>
                <strong>Wounded (&lt;50% HP):</strong> {belowHalf.map(m => `${m.nickname ?? m.name.split(' ')[0]} (${m.currentHp}/${m.maxHp})`).join(', ')}
              </div>
            )}
            {lowMorale.length > 0 && (
              <div style={{ fontSize: 11, color: '#8b5fc4', marginBottom: 8 }}>
                <strong>Shaken (morale&lt;30):</strong> {lowMorale.map(m => `${m.nickname ?? m.name.split(' ')[0]} (${Math.round(personalMoraleState[m.id] ?? 0)})`).join(', ')}
              </div>
            )}

            {/* Mission reward — only on final stage victory */}
            {reward && (
              <div style={{
                background: 'rgba(0,0,0,0.25)', border: '1px solid #4a6a3a',
                borderRadius: 6, padding: '10px 14px', marginBottom: 12,
              }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  🏆 Mission Reward
                </div>
                {/* Resources row */}
                {((reward.money ?? 0) > 0 || (reward.food ?? 0) > 0 || (reward.wood ?? 0) > 0 || (reward.metal ?? 0) > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                    {(reward.money ?? 0) > 0 && (
                      <span style={{ fontSize: 13, color: '#e6c84b' }}>💰 {reward.money}</span>
                    )}
                    {(reward.food ?? 0) > 0 && (
                      <span style={{ fontSize: 13, color: '#78c878' }}>🍖 {reward.food}</span>
                    )}
                    {(reward.wood ?? 0) > 0 && (
                      <span style={{ fontSize: 13, color: '#c8a464' }}>🪵 {reward.wood}</span>
                    )}
                    {(reward.metal ?? 0) > 0 && (
                      <span style={{ fontSize: 13, color: '#8ab4d0' }}>⚙️ {reward.metal}</span>
                    )}
                  </div>
                )}
                {/* Equipment list */}
                {(reward.equipment ?? []).length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <span style={{ color: '#a0c0e0', marginRight: 6 }}>🎒 Items:</span>
                    {(reward.equipment as any[]).map((eq: any) => eq.name ?? eq.id).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* KIA icon strip */}
            {dead.length > 0 && (() => {
              const heroineKia = dead.filter((m: any) => m.type === 'heroine');
              return (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#b84040', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    💀 KIA {dead.length}({heroineKia.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {dead.map((m: any) => {
                      const isHeroine = m.type === 'heroine';
                      return (
                        <img
                          key={m.id}
                          src={getUnitIcon(m.imgId)}
                          alt={m.name}
                          title={m.nickname ?? m.name.split(' ')[0]}
                          style={{
                            width: 32, height: 32, objectFit: 'cover', borderRadius: 4,
                            border: isHeroine ? '2px solid #f5c842' : '2px solid #555',
                            boxShadow: isHeroine ? '0 0 6px #f5c84266' : 'none',
                            filter: 'grayscale(100%) brightness(0.5)', opacity: 0.8,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Captured icon strip */}
            {moraleCaptured.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#c8a84b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>⛓️ Captured ({moraleCaptured.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {moraleCaptured.map((m: any) => {
                    const isHeroine = m.type === 'heroine';
                    return (
                      <img
                        key={m.id}
                        src={getUnitIcon(m.imgId)}
                        alt={m.name}
                        title={m.nickname ?? m.name.split(' ')[0]}
                        style={{
                          width: 32, height: 32, objectFit: 'cover', borderRadius: 4,
                          border: isHeroine ? '2px solid #f5c842' : '2px solid #8b6020',
                          boxShadow: isHeroine ? '0 0 6px #f5c84266' : 'none',
                          filter: 'grayscale(100%) sepia(0.4) brightness(0.55)', opacity: 0.85,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => onStageComplete(maidenStates, stageOutcome, stageExpGains, stageMoraleGains, moraleEscapedIds, moraleCapturedIds, permanentMoraleDeltas)}
                style={{ padding: '10px 20px', background: 'var(--color-accent-dark)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}
              >
                {isVictory && missionState.currentStageIdx < mission.stages.length - 1 ? 'Next Stage →' : 'Return to Missions'}
              </button>
              {isVictory && missionState.currentStageIdx < mission.stages.length - 1 && (
                <button
                  onClick={() => onAbortMission(moraleEscapedIds, moraleCapturedIds)}
                  style={{
                    padding: '10px 20px', background: 'transparent',
                    color: 'var(--color-danger)', border: '1px solid var(--color-danger)',
                    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
                  }}
                  title="End the mission here and keep current HP"
                >
                  ✕ Abort Mission
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Event animation strip — hidden once battle concludes; icon summary takes over */}
      {!battleComplete && (
        <ActionStage
          event={stageEvent}
          visible={stageVisible}
          allCombatants={allCombatants}
          battleComplete={battleComplete}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        {/* Maiden team morale */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>
            Your Morale: <strong style={{ color: maidenTeamMorale >= 70 ? '#4a8c4a' : maidenTeamMorale >= 30 ? '#c8a84b' : '#b84040' }}>{Math.round(maidenTeamMorale)}</strong>
          </div>
          <div style={{ height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${maidenTeamMorale}%`, background: maidenTeamMorale >= 70 ? '#4a8c4a' : maidenTeamMorale >= 30 ? '#c8a84b' : '#b84040', transition: 'width 0.4s' }} />
          </div>
        </div>
        {/* Enemy team morale */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>
            Enemy Morale: <strong style={{ color: enemyTeamMorale >= 70 ? '#4a8c4a' : enemyTeamMorale >= 30 ? '#c8a84b' : '#b84040' }}>{Math.round(enemyTeamMorale)}</strong>
          </div>
          <div style={{ height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${enemyTeamMorale}%`, background: enemyTeamMorale >= 70 ? '#4a8c4a' : enemyTeamMorale >= 30 ? '#c8a84b' : '#b84040', transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Maiden team — 2-col RTL wrap */}
        <CombatantPanel
          label="Your Team"
          combatants={maidenStates}
          coverList={maidenCover}
          hpBarAlive="#4a8c4a"
          borderAlive="var(--color-accent)"
          borderDead="#555"
          enemyBorder="#8b2020"
          isEnemy={false}
          coverLevel={coverLevel}
          retreating={retreatingTeam === 'maiden'}
          personalMoraleState={personalMoraleState}
          escapingNames={escapingNames}
          escapedNames={escapedNames}
          capturedNames={capturedNames}
          displayedEvents={displayedEvents}
          stageMoraleGains={stageMoraleGains}
          leaderId={missionState.leaderId}
          twoCol={true}
          rtl={true}
        />

        {/* Enemy team — 2-col LTR wrap */}
        <CombatantPanel
          label="Enemy Team"
          combatants={enemyStates}
          coverList={enemyCover}
          stunnedList={stunnedEnemies}
          hpBarAlive="#8b2020"
          borderAlive="#8b2020"
          borderDead="#555"
          enemyBorder="#8b2020"
          isEnemy={true}
          coverLevel={coverLevel}
          retreating={retreatingTeam === 'enemy'}
          personalMoraleState={personalMoraleState}
          escapingNames={escapingNames}
          escapedNames={escapedNames}
          capturedNames={capturedNames}
          displayedEvents={displayedEvents}
          stageMoraleGains={stageMoraleGains}
          twoCol={true}
          rtl={false}
          leaderId={(() => {
            const aliveEnemies = enemyStates.filter((e: any) => e.currentHp > 0);
            if (aliveEnemies.length === 0) return undefined;
            const lyssas = aliveEnemies.filter((e: any) => e.type === 'lyssa');
            const pool = lyssas.length > 0 ? lyssas : aliveEnemies;
            return pool.reduce((top: any, e: any) => getStat(e, 'strategy') > getStat(top, 'strategy') ? e : top).id;
          })()}
        />
      </div>

      {/* Collapsible battle log */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
        <button
          onClick={() => setLogExpanded(e => !e)}
          style={{
            width: '100%', padding: '10px 14px', background: 'var(--color-surface)', border: 'none',
            color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer', textAlign: 'left',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>📋 Battle Log ({displayedEvents.length} entries)</span>
          <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: logExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>
        {logExpanded && (
          <div style={{ padding: 12, maxHeight: 260, overflowY: 'auto', fontSize: 11, background: '#0a0908' }}>
            {displayedEvents.map((evt, idx) => (
              <BattleLogEntry key={idx} event={evt} />
            ))}
            {displayedEvents.length === 0 && <div style={{ color: 'var(--color-text-muted)' }}>No events yet.</div>}
          </div>
        )}
      </div>

      {/* Collapsible morale log */}
      <MoraleLog
        gains={stageMoraleGains}
        maidens={maidenStates}
        enemies={enemyStates}
        expanded={moraleLogExpanded}
        setExpanded={setMoraleLogExpanded}
        filter={moraleLogFilter}
        setFilter={setMoraleLogFilter}
        combatantId={moraleLogCombatantId}
        setCombatantId={setMoraleLogCombatantId}
        textFilter={moraleLogText}
        setTextFilter={setMoraleLogText}
      />
    </div>
  );
}

// ── Combatant side panel ──────────────────────────────────────────────────────
function CombatantPanel({ label, combatants, coverList, stunnedList = [], hpBarAlive, borderAlive, borderDead, isEnemy, coverLevel, retreating, personalMoraleState = {}, escapingNames = [], escapedNames = [], capturedNames = [], displayedEvents = [], stageMoraleGains = [], leaderId, twoCol = false, rtl = false }: any) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div style={{ background: 'var(--color-surface)', border: retreating ? '2px solid #c8954a' : '1px solid var(--color-border)', borderRadius: 8, padding: 12, transition: 'border-color 0.3s' }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {label}
        {retreating && <span style={{ marginLeft: 6, fontSize: 10, color: '#c8954a', fontWeight: 'bold', letterSpacing: 0 }}>🏃 RETREATING</span>}
      </div>
      {coverLevel > 0 && (
        <div style={{ fontSize: 10, color: '#4a9eff', marginBottom: 6 }}>🛡 Cover Level {coverLevel}</div>
      )}
      <div style={twoCol ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, direction: rtl ? 'rtl' : 'ltr', overflow: 'hidden', paddingLeft: 16, paddingRight: 16 } : undefined}>
      {([...combatants].sort((a: any, b: any) => {
        if (a.id === leaderId) return -1;
        if (b.id === leaderId) return 1;
        return 0;
      }) as any[]).map((c: any) => {
        const cName = !isEnemy ? (c.nickname ?? c.name) : c.name;
        const hasCover = coverList.includes(cName);
        const isStunned = stunnedList.includes(cName);
        const alive = c.currentHp > 0;
        // Filter events relevant to this combatant
        const relevantEvents = (displayedEvents as CombatEvent[]).filter(ev => {
          const attName = ev.attackerName;
          const defName = ev.defenderName ?? '';
          const displayName = !isEnemy ? (c.nickname ?? c.name.split(' ')[0]) : c.name;
          return attName === displayName || attName === c.name ||
                 defName === displayName || defName === c.name;
        }).filter(ev => ev.type === 'attack' || ev.type === 'miss' || ev.type === 'cover_blocked');

        return (
          <div
            key={c.id}
            style={{ marginBottom: twoCol ? 4 : 12, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', position: 'relative', minWidth: 0, ...(twoCol ? { direction: 'ltr', padding: '2px 4px' } : {}) }}
            onMouseEnter={e => {
              if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
              setHoveredId(c.id);
              const z = parseFloat(document.documentElement.style.zoom) || 1;
              setTooltipPos({ x: e.clientX / z, y: e.clientY / z });
            }}

            onMouseLeave={() => {
              leaveTimerRef.current = setTimeout(() => setHoveredId(null), 250);
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={getUnitIcon(c.imgId)}
                alt={c.name}
                style={{
                  width: 40, height: 40, objectFit: 'cover', borderRadius: 4,
                  border: c.id === leaderId && alive
                    ? '2px solid #f5c842'
                    : hasCover ? '2px solid #4a9eff' : `2px solid ${alive ? (isEnemy ? '#8b2020' : borderAlive) : borderDead}`,
                  boxShadow: c.id === leaderId && alive
                    ? '0 0 8px #f5c84288'
                    : hasCover ? '0 0 6px #4a9eff88' : 'none',
                  opacity: alive ? 1 : 0.45,
                  transition: 'border-color 0.3s, box-shadow 0.3s, opacity 0.4s',
                }}
              />
              {c.id === leaderId && alive && (
                <span title="Team leader" style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', fontSize: 11, lineHeight: 1, filter: 'drop-shadow(0 0 3px #f5c842)' }}>👑</span>
              )}
              {hasCover && (
                <span style={{ position: 'absolute', top: -5, right: -5, fontSize: 11, filter: 'drop-shadow(0 0 3px #4a9eff)' }}>🛡</span>
              )}
              {isStunned && (
                <span style={{ position: 'absolute', bottom: -5, right: -5, fontSize: 11, filter: 'drop-shadow(0 0 4px #e0c040)' }}>💫</span>
              )}
              {!isEnemy && (c as any).isStarved && (
                <span title="Starved — HP halved, −50% hit/dodge/scout/cover" style={{ position: 'absolute', bottom: -5, left: -5, fontSize: 11, filter: 'drop-shadow(0 0 4px #e07030)' }}>🥀</span>
              )}
              {alive && (c.equipment ?? []).some((e: any) => e.weaponType === 'grenade' || (e.id ?? '').includes('grenade')) && (
                <span title="Carrying a grenade" style={{ position: 'absolute', top: '50%', left: -14, transform: 'translateY(-50%)', fontSize: 12, filter: 'drop-shadow(0 0 3px #e8a020)', lineHeight: 1 }}>💣</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: alive ? (isEnemy ? '#e08080' : 'var(--color-text)') : '#666', fontWeight: 'bold', marginBottom: 2, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
                {!alive && !capturedNames.includes(cName) && !escapedNames.includes(cName) && <span title="Fallen" style={{ flexShrink: 0 }}>💀</span>}
                {retreating && alive && !escapingNames.includes(cName) && !escapedNames.includes(cName) && !capturedNames.includes(cName) && (
                  <span title="Retreating" style={{ fontSize: 10, color: '#c8954a', flexShrink: 0 }}>🏃</span>
                )}
                {escapingNames.includes(cName) && (
                  <span title="Escaping — lost all morale, fate unknown" style={{ fontSize: 10, flexShrink: 0 }}>😱</span>
                )}
                {escapedNames.includes(cName) && (
                  <span title="Escaped the battlefield" style={{ fontSize: 10, color: '#7dd87d', flexShrink: 0 }}>🏃‍♀️</span>
                )}
                {capturedNames.includes(cName) && (
                  <span title="Captured by the enemy" style={{ fontSize: 10, color: '#e08080', flexShrink: 0 }}>⛓️</span>
                )}
                {!isEnemy && (c as any).isStarved && alive && (
                  <span title="Starved" style={{ fontSize: 10, color: '#e07030', flexShrink: 0 }}>🥀</span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{!isEnemy ? (c.nickname ?? c.name.split(' ')[0]) : c.name}</span>
              </div>
              <div style={{ background: '#0e0d0b', borderRadius: 3, height: 6, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 2 }}>
                <div style={{
                  height: '100%', width: `${Math.max(0, (c.currentHp / c.maxHp) * 100)}%`,
                  background: c.currentHp > c.maxHp * 0.5 ? hpBarAlive : c.currentHp > 0 ? '#c8954a' : '#444',
                  transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }} />
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 9 }}>
                {Math.max(0, c.currentHp)}/{c.maxHp} HP
              </div>
              {(() => {
                if (c.moraleQuitStatus === 'escaped') {
                  return (
                    <div style={{ color: '#7dd87d', fontSize: 9, marginTop: 2 }}>🏃 Escaped</div>
                  );
                }
                const morale = personalMoraleState[c.id] ?? computePersonalMoraleBase(c);
                const moraleColor = morale >= 70 ? '#4a8c4a' : morale >= 30 ? '#c8a84b' : '#b84040';
                return (
                  <>
                    <div style={{ background: '#0e0d0b', borderRadius: 3, height: 4, overflow: 'hidden', border: '1px solid var(--color-border)', marginTop: 2, marginBottom: 1 }}>
                      <div style={{ height: '100%', width: `${morale}%`, background: moraleColor, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 9 }}>Morale {Math.round(morale)}</div>
                  </>
                );
              })()}
            </div>

            {/* Hover tooltip — click to pin; renders via portal */}
            {(hoveredId === c.id || pinnedId === c.id) && (
              <CombatantTooltip
                combatant={c}
                isEnemy={isEnemy}
                relevantEvents={relevantEvents}
                personalMorale={personalMoraleState[c.id] ?? computePersonalMoraleBase(c)}
                mousePos={pinnedId === c.id ? pinnedPos : tooltipPos}
                isPinned={pinnedId === c.id}
                onPin={() => { setPinnedId(c.id); setPinnedPos(tooltipPos); }}
                onUnpin={() => { setPinnedId(null); setHoveredId(null); }}
                combatantMoraleGains={stageMoraleGains.filter((g: any) => g.combatantId === c.id)}
                onTooltipMouseEnter={() => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current); }}
                onTooltipMouseLeave={() => { leaveTimerRef.current = setTimeout(() => setHoveredId(null), 150); }}
              />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ── Per-combatant hover tooltip ───────────────────────────────────────────────
const STAT_LABELS: [string, string][] = [
  ['strength', 'STR'],
  ['dexterity', 'DEX'],
  ['constitution', 'CON'],
  ['strategy', 'STG'],
  ['awareness', 'AWR'],
  ['charm', 'CHA'],
];

function CombatantTooltip({ combatant, isEnemy, relevantEvents, personalMorale, mousePos, isPinned, onPin, onUnpin, combatantMoraleGains, onTooltipMouseEnter, onTooltipMouseLeave }: {
  combatant: any;
  isEnemy: boolean;
  relevantEvents: CombatEvent[];
  personalMorale: number;
  mousePos: { x: number; y: number };
  isPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  combatantMoraleGains: any[];
  onTooltipMouseEnter: () => void;
  onTooltipMouseLeave: () => void;
}) {
  const displayName = !isEnemy ? (combatant.nickname ?? combatant.name.split(' ')[0]) : combatant.name;

  // Draggable offset (only active when pinned)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const onDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPinned) onPin();
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: dragOffset.x, oy: dragOffset.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      setDragOffset({
        x: dragStart.current.ox + ev.clientX - dragStart.current.mx,
        y: dragStart.current.oy + ev.clientY - dragStart.current.my,
      });
    };
    const onUp = () => {
      dragStart.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Position: prefer right of cursor, flip left if near right edge
  const tipWidth = 300;
  const baseLeft = mousePos.x + 14 + tipWidth > window.innerWidth ? mousePos.x - tipWidth - 10 : mousePos.x + 14;
  const baseTop = Math.min(mousePos.y - 10, window.innerHeight - 490);
  const left = baseLeft + dragOffset.x;
  const top = baseTop + dragOffset.y;

  // Bucket events into dealt (attacker is this combatant) and received (defender)
  const dealt = relevantEvents.filter(ev => {
    const a = ev.attackerName;
    return a === displayName || a === combatant.name;
  });
  const received = relevantEvents.filter(ev => {
    const d = ev.defenderName ?? '';
    return d === displayName || d === combatant.name;
  });

  const totalDealt = dealt.filter(ev => ev.type === 'attack').reduce((s, ev) => s + (ev.damage ?? 0), 0);
  const totalReceived = received.filter(ev => ev.type === 'attack').reduce((s, ev) => s + (ev.damage ?? 0), 0);

  return ReactDOM.createPortal(
    <>
      {isPinned && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={onUnpin}
        />
      )}
      <div style={{
        position: 'fixed',
        left,
        top,
        width: tipWidth,
        background: '#12110e',
        border: `1px solid ${isEnemy ? '#8b2020' : 'var(--color-accent)'}`,
        borderRadius: 8,
        padding: '12px 14px',
        zIndex: 9999,
        pointerEvents: 'auto',
        boxShadow: isPinned
          ? `0 8px 32px rgba(0,0,0,0.8), 0 0 0 2px rgba(200,149,74,0.4)`
          : '0 8px 32px rgba(0,0,0,0.8)',
        fontSize: 11,
        cursor: isPinned ? 'default' : 'pointer',
      }}
      onClick={isPinned ? (e => e.stopPropagation()) : onPin}
      onMouseEnter={onTooltipMouseEnter}
      onMouseLeave={onTooltipMouseLeave}
      >
        {/* Pin state hint / drag handle — always visible */}
        <div
          onMouseDown={onDragMouseDown}
          style={{ fontSize: 9, color: isPinned ? '#c8954a' : '#555', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none' }}
        >
          <span style={{ opacity: 0.4 }}>⠿ drag</span>
          <span>{isPinned ? '📌 Pinned — click outside to dismiss' : 'Click or drag to pin'}</span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <img src={getUnitIcon(combatant.imgId)} alt={combatant.name} style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 4, border: `1px solid ${isEnemy ? '#8b2020' : 'var(--color-accent)'}` }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: isEnemy ? '#e08080' : 'var(--color-accent)' }}>{displayName}</div>
            {combatant.name !== displayName && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{combatant.name}</div>}
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{Math.max(0, combatant.currentHp)}/{combatant.maxHp} HP · Morale {Math.round(personalMorale)}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 10 }}>
          {STAT_LABELS.map(([key, label]) => {
            const effective = getStat(combatant, key as any);
            const pct = Math.min(100, (effective / 20) * 100);
            return (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 2 }}>{label}</div>
                <div style={{
                  height: 28,
                  background: '#1a1815',
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: '1px solid #333',
                  display: 'flex',
                  alignItems: 'flex-end',
                }}>
                  <div style={{
                    width: '100%',
                    height: `${pct}%`,
                    background: isEnemy ? '#8b2020' : 'var(--color-accent-dark)',
                    transition: 'height 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--color-text)', marginTop: 1, fontWeight: 600 }}>
                  {effective}
                </div>
              </div>
            );
          })}
        </div>

        {/* Battle summary */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, background: '#1a1210', borderRadius: 4, padding: '5px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#e08080', marginBottom: 2 }}>DMG DEALT</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e08080' }}>{totalDealt}</div>
          </div>
          <div style={{ flex: 1, background: '#101a10', borderRadius: 4, padding: '5px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#80c080', marginBottom: 2 }}>DMG TAKEN</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#80c080' }}>{totalReceived}</div>
          </div>
        </div>

        {/* Event log */}
        {relevantEvents.length > 0 && (
          <div style={{ marginBottom: combatantMoraleGains.length > 0 ? 8 : 0 }}>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Battle Log</div>
            <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {relevantEvents.map((ev, i) => {
                const isMiss = ev.type === 'miss';
                const isBlocked = ev.type === 'cover_blocked';
                const isDealing = ev.attackerName === displayName || ev.attackerName === combatant.name;
                const color = isBlocked ? '#4a9eff' : isMiss ? '#888' : isDealing ? '#e08080' : '#80c080';
                return (
                  <div key={i} style={{ fontSize: 10, color, lineHeight: 1.4, padding: '1px 0', borderBottom: '1px solid #1e1c18', display: 'flex', gap: 4, alignItems: 'baseline' }}>
                    <span style={{ color: '#444', fontSize: 9, minWidth: 20, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>R{ev.round ?? 0}</span>
                    <span>{ev.message.replace(/^\[.*?\]\s*/, '')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {relevantEvents.length === 0 && combatantMoraleGains.length === 0 && (
          <div style={{ fontSize: 10, color: '#555', fontStyle: 'italic' }}>No combat actions yet.</div>
        )}

        {/* Morale log for this combatant */}
        {combatantMoraleGains.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Morale Log</div>
            <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {combatantMoraleGains.map((g: any, i: number) => {
                const isInitial = g.reason === 'Initial';
                const deltaColor = isInitial ? '#c8a84b' : g.delta > 0 ? '#6ab06a' : '#e08080';
                const deltaSign = (isInitial || g.delta > 0) ? '+' : '';
                return (
                  <div key={i} style={{ fontSize: 10, display: 'flex', gap: 4, lineHeight: 1.4, borderBottom: '1px solid #1e1c18', padding: '1px 0', alignItems: 'baseline' }}>
                    <span style={{ color: '#444', fontSize: 9, minWidth: 20, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>R{g.round ?? 0}</span>
                    <span style={{ color: deltaColor, fontWeight: 700, minWidth: 30, flexShrink: 0 }}>{isInitial ? '' : deltaSign}{g.delta}</span>
                    <span style={{ color: 'var(--color-text-muted)', flex: 1, fontStyle: 'italic' }}>{g.reason}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

// ── Action stage center panel ─────────────────────────────────────────────────
function ActionStage({ event, visible, allCombatants, battleComplete }: {
  event: CombatEvent | null;
  visible: boolean;
  allCombatants: any[];
  battleComplete: boolean;
}) {
  function findPortrait(name: string): string {
    const c = allCombatants.find(x =>
      x.name === name || (x.nickname ?? x.name.split(' ')[0]) === name || x.nickname === name
    );
    return c ? getUnitIcon(c.imgId) : '';
  }

  // Determine what to render
  type StageView =
    | { kind: 'round'; round: number }
    | { kind: 'attack'; attackerName: string; defenderName: string; damage: number; attackerImg: string; defenderImg: string }
    | { kind: 'miss'; attackerName: string; defenderName: string; attackerImg: string; defenderImg: string }
    | { kind: 'cover_gained'; name: string; img: string }
    | { kind: 'cover_lost'; name: string; img: string }
    | { kind: 'cover_blocked'; attackerName: string; defenderName: string; attackerImg: string; defenderImg: string }
    | { kind: 'retreat'; attackerName: string; defenderName: string; damage: number; attackerImg: string; defenderImg: string }
    | { kind: 'grenade'; throwerName: string; throwerImg: string; damage: number; hitCount: number; isCritError: boolean }
    | { kind: 'grenade_miss'; throwerName: string; throwerImg: string }
    | { kind: 'potion'; name: string; img: string; healAmount: number }
    | { kind: 'ration'; name: string; img: string; hpGain: number; moraleGain: number }
    | { kind: 'idle' };

  let view: StageView = { kind: 'idle' };

  if (event) {
    if (event.type === 'log') {
      // Healing potion
      const potionM = event.message.match(/^💊\s+(.+?)\s+uses .+?\+(\d+)\s+HP/);
      if (potionM) {
        view = { kind: 'potion', name: potionM[1].trim(), img: findPortrait(potionM[1].trim()), healAmount: parseInt(potionM[2]) };
      } else {
        // Rations
        const rationM = event.message.match(/^🍖\s+(.+?)\s+eats .+?\+(\d+)\s+HP,\s*\+(\d+)\s+morale/);
        if (rationM) {
          view = { kind: 'ration', name: rationM[1].trim(), img: findPortrait(rationM[1].trim()), hpGain: parseInt(rationM[2]), moraleGain: parseInt(rationM[3]) };
        } else {
          const roundMatch = event.message.match(/[-=]+\s*Round\s*(\d+)/i) || event.message.match(/Round\s*(\d+)/i);
          if (roundMatch) view = { kind: 'round', round: parseInt(roundMatch[1]) };
          else view = { kind: 'idle' };
        }
      }
    } else if (event.type === 'attack' && (event.message.startsWith('💣') || event.message.startsWith('💥'))) {
      // Grenade hit or critical error
      const isCritError = event.message.startsWith('💥');
      const totalM = event.message.match(/total\s+(\d+)\s+damage/);
      const hitNames = (event.message.match(/([\w\s'\-]+?)\s+\(\d+\s+dmg/g) || []).length;
      view = {
        kind: 'grenade', throwerName: event.attackerName, throwerImg: findPortrait(event.attackerName),
        damage: event.damage ?? (totalM ? parseInt(totalM[1]) : 0), hitCount: hitNames, isCritError,
      };
    } else if (event.type === 'miss' && event.message.startsWith('💣')) {
      view = { kind: 'grenade_miss', throwerName: event.attackerName, throwerImg: findPortrait(event.attackerName) };
    } else if (event.type === 'attack') {
      const match = event.message.match(/(.+?)\s+hits\s+(.+?)\s+for\s+(\d+)/);
      if (match) {
        view = {
          kind: 'attack',
          attackerName: event.attackerName,
          defenderName: match[2],
          damage: parseInt(match[3]),
          attackerImg: findPortrait(event.attackerName),
          defenderImg: findPortrait(match[2]),
        };
      }
    } else if (event.type === 'miss') {
      const match = event.message.match(/(.+?)\s+misses\s+(.+)/);
      view = {
        kind: 'miss',
        attackerName: event.attackerName,
        defenderName: match ? match[2].replace(/[.!]$/, '') : (event.defenderName ?? ''),
        attackerImg: findPortrait(event.attackerName),
        defenderImg: findPortrait(match ? match[2].replace(/[.!]$/, '') : (event.defenderName ?? '')),
      };
    } else if (event.type === 'cover_gained') {
      view = { kind: 'cover_gained', name: event.attackerName, img: findPortrait(event.attackerName) };
    } else if (event.type === 'cover_lost') {
      view = { kind: 'cover_lost', name: event.attackerName, img: findPortrait(event.attackerName) };
    } else if (event.type === 'cover_blocked') {

      view = {
        kind: 'cover_blocked',
        attackerName: event.attackerName,
        defenderName: event.defenderName ?? '',
        attackerImg: findPortrait(event.attackerName),
        defenderImg: findPortrait(event.defenderName ?? ''),
      };
    } else if (event.type === 'retreat_fire') {
      const match = event.message.match(/(.+?)\s+fires.*at\s+(.+?)\s+for\s+(\d+)/);
      view = {
        kind: 'retreat',
        attackerName: event.attackerName,
        defenderName: match ? match[2] : (event.defenderName ?? ''),
        damage: match ? parseInt(match[3]) : 0,
        attackerImg: findPortrait(event.attackerName),
        defenderImg: findPortrait(match ? match[2] : (event.defenderName ?? '')),
      };
    }
  }

  const opacity = visible ? 1 : 0;
  const translateY = visible ? 0 : 12;

  // Shared container style
  const stageBox: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 220,
    // Wide enough to hold two 72px portraits + ~120px centre gap without reflowing
    minWidth: 320,
    width: '100%',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  };

  const transitionStyle: React.CSSProperties = {
    opacity,
    transform: `translateY(${translateY}px)`,
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  };

  const portraitStyle = (glowColor?: string): React.CSSProperties => ({
    width: 72, height: 72, objectFit: 'cover', borderRadius: 6,
    border: `2px solid ${glowColor ?? 'var(--color-border)'}`,
    boxShadow: glowColor ? `0 0 12px ${glowColor}66` : 'none',
  });

  const nameTag = (_name: string, color = 'var(--color-text)'): React.CSSProperties => ({
    fontSize: 11, color, fontWeight: 'bold', marginTop: 2, textAlign: 'center',
    maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  });

  const actionIcon = (_emoji: string, size = 28): React.CSSProperties => ({
    fontSize: size, lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
  });

  const renderContent = () => {
    if (!event || view.kind === 'idle') {
      return (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center' }}>
          {battleComplete ? '' : 'Waiting…'}
        </div>
      );
    }

    if (view.kind === 'round') {
      return (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>— Combat —</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: 'var(--color-accent)', letterSpacing: 2, textShadow: '0 0 20px var(--color-accent)' }}>
            Round {view.round}
          </div>
          <div style={{ marginTop: 8, fontSize: 18 }}>⚔️</div>
        </div>
      );
    }

    if (view.kind === 'attack' || view.kind === 'retreat') {
      const isRetreat = view.kind === 'retreat';
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {view.attackerImg && <img src={view.attackerImg} alt={view.attackerName} style={portraitStyle('var(--color-accent)')} />}
            <div style={nameTag(view.attackerName, 'var(--color-accent)')}>{view.attackerName}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={actionIcon(isRetreat ? '🏃' : '🔫', 26)}>{ isRetreat ? '🏃' : '🔫'}</span>
            <span style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>{isRetreat ? 'retreat fire' : 'shoots'}</span>
            <span style={{ fontSize: 14, color: '#e05050', fontWeight: 'bold' }}>-{view.damage} HP</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {view.defenderImg && <img src={view.defenderImg} alt={view.defenderName} style={portraitStyle('#b84040')} />}
            <div style={nameTag(view.defenderName, '#e08080')}>{view.defenderName}</div>
          </div>
        </div>
      );
    }

    if (view.kind === 'miss') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {view.attackerImg && <img src={view.attackerImg} alt={view.attackerName} style={portraitStyle('#888')} />}
            <div style={nameTag(view.attackerName, '#aaa')}>{view.attackerName}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={actionIcon('💨')}>💨</span>
            <span style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>missed</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {view.defenderImg && <img src={view.defenderImg} alt={view.defenderName} style={portraitStyle('#555')} />}
            <div style={nameTag(view.defenderName, '#888')}>{view.defenderName}</div>
          </div>
        </div>
      );
    }

    if (view.kind === 'cover_gained') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            {view.img && <img src={view.img} alt={view.name} style={portraitStyle('#4a9eff')} />}
            <span style={{ position: 'absolute', bottom: -8, right: -8, fontSize: 22, filter: 'drop-shadow(0 0 6px #4a9eff)' }}>🛡</span>
          </div>
          <div style={nameTag(view.name, '#4a9eff')}>{view.name}</div>
          <div style={{ fontSize: 13, color: '#4a9eff', fontWeight: 'bold', letterSpacing: 1 }}>TAKES COVER</div>
          <div style={{ fontSize: 10, color: '#4a9effa0', textAlign: 'center' }}>Protected from incoming fire</div>
        </div>
      );
    }

    if (view.kind === 'cover_lost') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            {view.img && <img src={view.img} alt={view.name} style={portraitStyle('#a06030')} />}
            <span style={{ position: 'absolute', bottom: -8, right: -8, fontSize: 22, opacity: 0.5 }}>🛡</span>
            <span style={{ position: 'absolute', bottom: -6, right: -6, fontSize: 14, color: '#e05050' }}>✕</span>
          </div>
          <div style={nameTag(view.name, '#c8954a')}>{view.name}</div>
          <div style={{ fontSize: 13, color: '#c8954a', fontWeight: 'bold', letterSpacing: 1 }}>COVER LOST</div>
          <div style={{ fontSize: 10, color: '#a07040', textAlign: 'center' }}>Now exposed to enemy fire</div>
        </div>
      );
    }

    if (view.kind === 'cover_blocked') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {view.attackerImg && <img src={view.attackerImg} alt={view.attackerName} style={portraitStyle('#888')} />}
            <div style={nameTag(view.attackerName, '#aaa')}>{view.attackerName}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={actionIcon('🛡', 26)}>🛡</span>
            <span style={{ fontSize: 9, color: '#4a9eff', textTransform: 'uppercase', letterSpacing: 1 }}>blocked</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {view.defenderImg && <img src={view.defenderImg} alt={view.defenderName} style={portraitStyle('#4a9eff')} />}
            <div style={nameTag(view.defenderName, '#4a9eff')}>{view.defenderName}</div>
          </div>
        </div>
      );
    }

    if (view.kind === 'grenade') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            {view.throwerImg && <img src={view.throwerImg} alt={view.throwerName} style={portraitStyle(view.isCritError ? '#e05050' : '#e8a020')} />}
            <span style={{ position: 'absolute', bottom: -8, right: -8, fontSize: 22, filter: `drop-shadow(0 0 6px ${view.isCritError ? '#e05050' : '#e8a020'})` }}>💣</span>
          </div>
          <div style={nameTag(view.throwerName, view.isCritError ? '#e08080' : '#e8c060')}>{view.throwerName}</div>
          <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 1, color: view.isCritError ? '#e05050' : '#e8a020' }}>
            {view.isCritError ? '💥 CRITICAL ERROR' : `GRENADE — ${view.damage} DMG`}
          </div>
          {!view.isCritError && view.hitCount > 0 && (
            <div style={{ fontSize: 10, color: '#e8a020a0' }}>{view.hitCount} target{view.hitCount !== 1 ? 's' : ''} hit</div>
          )}
        </div>
      );
    }

    if (view.kind === 'grenade_miss') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            {view.throwerImg && <img src={view.throwerImg} alt={view.throwerName} style={portraitStyle('#888')} />}
            <span style={{ position: 'absolute', bottom: -8, right: -8, fontSize: 22, opacity: 0.5 }}>💣</span>
          </div>
          <div style={nameTag(view.throwerName, '#aaa')}>{view.throwerName}</div>
          <div style={{ fontSize: 13, color: '#8a7a62', fontWeight: 'bold', letterSpacing: 1 }}>GRENADE MISSED</div>
          <div style={{ fontSize: 10, color: '#6a5a50' }}>Detonated harmlessly</div>
        </div>
      );
    }

    if (view.kind === 'potion') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            {view.img && <img src={view.img} alt={view.name} style={portraitStyle('#6ab06a')} />}
            <span style={{ position: 'absolute', bottom: -8, right: -8, fontSize: 22, filter: 'drop-shadow(0 0 6px #6ab06a)' }}>💊</span>
          </div>
          <div style={nameTag(view.name, '#6ab06a')}>{view.name}</div>
          <div style={{ fontSize: 13, color: '#6ab06a', fontWeight: 'bold', letterSpacing: 1 }}>HEALING POTION</div>
          <div style={{ fontSize: 14, color: '#6ab06a' }}>+{view.healAmount} HP</div>
        </div>
      );
    }

    if (view.kind === 'ration') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            {view.img && <img src={view.img} alt={view.name} style={portraitStyle('#c8954a')} />}
            <span style={{ position: 'absolute', bottom: -8, right: -8, fontSize: 22, filter: 'drop-shadow(0 0 6px #c8954a)' }}>🍖</span>
          </div>
          <div style={nameTag(view.name, '#c8954a')}>{view.name}</div>
          <div style={{ fontSize: 13, color: '#c8954a', fontWeight: 'bold', letterSpacing: 1 }}>FIELD RATIONS</div>
          <div style={{ fontSize: 11, color: '#c8954a', display: 'flex', gap: 10 }}>
            {view.hpGain > 0 && <span>+{view.hpGain} HP</span>}
            {view.moraleGain > 0 && <span>+{view.moraleGain} morale</span>}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={stageBox}>
      <div style={transitionStyle}>
        {renderContent()}
      </div>
    </div>
  );
}

// ── Morale Log ──────────────────────────────────────────────────────────────
interface MoraleGainEntry {
  team: 'maiden' | 'enemy';
  combatantId?: string;
  delta: number;
  reason: string;
  round?: number;
}

function MoraleLog({ gains, maidens, enemies, expanded, setExpanded, filter, setFilter, combatantId, setCombatantId, textFilter, setTextFilter }: {
  gains: MoraleGainEntry[];
  maidens: any[];
  enemies: any[];
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  filter: 'all' | 'maiden' | 'enemy';
  setFilter: (v: 'all' | 'maiden' | 'enemy') => void;
  combatantId: string;
  setCombatantId: (v: string) => void;
  textFilter: string;
  setTextFilter: (v: string) => void;
}) {
  function resolveName(g: MoraleGainEntry): string {
    if (!g.combatantId) return g.team === 'maiden' ? 'Your Team' : 'Enemy Team';
    const maiden = maidens.find((m: any) => m.id === g.combatantId);
    if (maiden) return maiden.nickname ?? maiden.name.split(' ')[0];
    const enemy = enemies.find((e: any) => e.id === g.combatantId);
    if (enemy) return enemy.name;
    return g.combatantId;
  }

  // Build dropdown options: unique combatants present in gains
  const combatantOptions: { id: string; label: string; team: 'maiden' | 'enemy' }[] = [];
  const seen = new Set<string>();
  for (const g of gains) {
    const key = g.combatantId ?? `__team_${g.team}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combatantOptions.push({ id: key, label: resolveName(g), team: g.team });
  }
  combatantOptions.sort((a, b) => {
    if (a.team !== b.team) return a.team === 'maiden' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  const textLower = textFilter.trim().toLowerCase();
  const filtered = gains.filter(g => {
    if (filter !== 'all' && g.team !== filter) return false;
    if (combatantId) {
      const key = g.combatantId ?? `__team_${g.team}`;
      if (key !== combatantId) return false;
    }
    if (textLower) {
      const name = resolveName(g).toLowerCase();
      if (!name.includes(textLower) && !g.reason.toLowerCase().includes(textLower)) return false;
    }
    return true;
  });

  const btnBase: React.CSSProperties = {
    padding: '3px 10px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)',
    cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.15s, color 0.15s',
  };

  const hasActiveFilter = filter !== 'all' || combatantId !== '' || textFilter !== '';

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '10px 14px', background: 'var(--color-surface)', border: 'none',
          color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>💛 Morale Log ({gains.length} entries{hasActiveFilter ? `, showing ${filtered.length}` : ''})</span>
        <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>
      {expanded && (
        <div style={{ background: '#0a0908' }}>
          {/* Team filter buttons */}
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 4 }}>Team:</span>
            {(['all', 'maiden', 'enemy'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  ...btnBase,
                  background: filter === f ? (f === 'maiden' ? 'rgba(74,140,74,0.25)' : f === 'enemy' ? 'rgba(184,64,64,0.25)' : 'rgba(200,149,74,0.2)') : 'transparent',
                  color: filter === f ? (f === 'maiden' ? '#6ab06a' : f === 'enemy' ? '#e08080' : 'var(--color-accent)') : 'var(--color-text-muted)',
                  borderColor: filter === f ? (f === 'maiden' ? '#4a8c4a' : f === 'enemy' ? '#b84040' : 'var(--color-accent-dark)') : 'var(--color-border)',
                }}
              >
                {f === 'all' ? 'All' : f === 'maiden' ? '⚔ Maiden' : '☠ Enemy'}
              </button>
            ))}
          </div>
          {/* Combatant dropdown + text filter */}
          <div style={{ display: 'flex', gap: 6, padding: '6px 12px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 4 }}>Unit:</span>
            <select
              value={combatantId}
              onChange={e => setCombatantId(e.target.value)}
              style={{
                background: 'var(--color-bg-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)',
                borderRadius: 4, padding: '3px 6px', fontSize: 11, cursor: 'pointer',
              }}
            >
              <option value=''>All units</option>
              {combatantOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.team === 'maiden' ? '⚔ ' : '☠ '}{opt.label}
                </option>
              ))}
            </select>
            <input
              type='text'
              placeholder='Search name or reason…'
              value={textFilter}
              onChange={e => setTextFilter(e.target.value)}
              style={{
                background: 'var(--color-bg-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)',
                borderRadius: 4, padding: '3px 8px', fontSize: 11, flex: '1 1 120px', minWidth: 100,
              }}
            />
            {hasActiveFilter && (
              <button
                onClick={() => { setFilter('all'); setCombatantId(''); setTextFilter(''); }}
                style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >Clear</button>
            )}
          </div>
          {/* Entries */}
          <div style={{ padding: 12, maxHeight: 300, overflowY: 'auto', fontSize: 11 }}>
            {filtered.length === 0 && (
              <div style={{ color: 'var(--color-text-muted)' }}>No morale events match the filter.</div>
            )}
            {filtered.map((g, idx) => {
              const isMaidenTeam = g.team === 'maiden';
              const teamColor = isMaidenTeam ? '#6ab06a' : '#e08080';
              const isInitial = g.reason === 'Initial';
              const deltaColor = isInitial ? '#c8a84b' : g.delta > 0 ? '#6ab06a' : '#e08080';
              const deltaSign = (isInitial || g.delta > 0) ? '+' : '';
              const isPersonal = !!g.combatantId;
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'baseline', gap: 6,
                  marginBottom: 4, lineHeight: 1.4, borderLeft: `2px solid ${isInitial ? '#555' : teamColor}`, paddingLeft: 7,
                  opacity: isInitial ? 0.65 : 1,
                }}>
                  <span style={{ color: '#444', fontSize: 9, minWidth: 22, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>R{g.round ?? 0}</span>
                  <span style={{ color: isInitial ? '#666' : teamColor, fontWeight: 'bold', minWidth: 52, fontSize: 10 }}>
                    {isInitial ? 'START' : isMaidenTeam ? 'MAIDEN' : 'ENEMY'}
                  </span>
                  <span style={{ color: 'var(--color-text)', flex: 1 }}>
                    {resolveName(g)}
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', marginLeft: 4 }}>
                      {isPersonal ? '(personal)' : '(team)'}
                    </span>
                  </span>
                  <span style={{ color: deltaColor, fontWeight: 'bold', minWidth: 34, textAlign: 'right' }}>
                    {isInitial ? '' : deltaSign}{g.delta}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', minWidth: 90, textAlign: 'right' }}>
                    {g.reason}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BattleLogEntry({ event }: { event: CombatEvent }) {
  const color =
    (event.type === 'log' && (event.message.startsWith('💊'))) ? '#6ab06a' :
    (event.type === 'log' && (event.message.startsWith('🍖'))) ? '#c8954a' :
    (event.type === 'log' || event.type === 'attack' || event.type === 'miss') &&
      (event.message.startsWith('💣') || event.message.startsWith('💥')) ? '#e8a020' :
    event.type === 'log' ? 'var(--color-text-muted)' :
    event.type === 'attack' ? '#4a8c4a' :
    event.type === 'miss' ? '#8a7a62' :
    event.type === 'cover_gained' ? '#4a9eff' :
    event.type === 'cover_lost' ? '#a0c0ff' :
    event.type === 'cover_blocked' ? '#2a6fbf' :
    'var(--color-accent)';

  return (
    <div style={{ color, marginBottom: 5, fontSize: 11, lineHeight: 1.4, display: 'flex', gap: 5, alignItems: 'baseline' }}>
      <span style={{ color: '#444', fontSize: 9, minWidth: 22, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>R{event.round ?? 0}</span>
      <span>{event.message}</span>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ padding: 8, background: '#0e0d0b', border: '1px solid var(--color-border)', borderRadius: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-text)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
