import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { SaveData, MeridianMissionRecord } from '../types/save';
import type { Maiden } from '../types/maiden';
import type { Team } from '../types/team';
import type { Mission } from '../types/mission';
import type { Building } from '../types/building';
import type { Equipment } from '../types/equipment';
import type { MBase } from '../types/mbase';
import type { ExpGain } from '../engine/combat';
import { getStat } from '../engine/combat';
import { computeMaxCarryWeight, computeCarryWeight } from '../engine/recruit';
import { generateMissionSet, computeForceStrengthIndex } from '../engine/missionGen';
import { generateHQShopItems } from '../engine/hqShop';
import { INITIAL_SAVE } from '../data/seed';
import equipmentData from '../data/equipment.json';
import buildingsData from '../data/buildings.json';

const SAVE_KEY = 'wm_save_v1';

/** Apply forward-migrations to any save data (file import or localStorage). */
function migrateSaveData(saved: SaveData): SaveData {
  // 1. Inject any buildings added to buildingsData after this save was created
  const savedIds = new Set((saved.buildings ?? []).map((b: Building) => b.id));
  const missing = (buildingsData as Building[]).filter(b => !savedIds.has(b.id));
  if (missing.length > 0) {
    saved.buildings = [...(saved.buildings ?? []), ...missing];
  }
  // 2. Always refresh static fields from canonical JSON so balance/description
  //    fixes in buildings.json are reflected without a full reset
  saved.buildings = (saved.buildings ?? []).map(savedB => {
    const canonical = (buildingsData as Building[]).find(b => b.id === savedB.id);
    if (!canonical) return savedB;
    return {
      ...savedB,
      description: canonical.description,
      maxLevel: canonical.maxLevel,
      levels: canonical.levels,
    };
  });
  // 3. Default optional top-level fields that may be missing in older saves
  if (!saved.hqShopItems) saved.hqShopItems = [];
  if (!saved.meridianStats) saved.meridianStats = { recentMissions: [], totalMissionsDone: 0 };
  return saved;
}

function loadFromStorage(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as SaveData;
      return migrateSaveData(saved);
    }
  } catch {
    // corrupt save — ignore
  }
  return INITIAL_SAVE;
}

interface GameState extends SaveData {
  // Actions
  setMBase: (mbase: Partial<MBase>) => void;
  setMaiden: (id: string, patch: Partial<Maiden>) => void;
  addMaiden: (maiden: Maiden) => void;
  removeMaiden: (id: string) => void;
  setTeam: (id: string, patch: Partial<Team>) => void;
  addTeam: (team: Team) => void;
  removeTeam: (id: string) => void;
  setMission: (id: string, patch: Partial<Mission>) => void;
  setBuilding: (id: string, patch: Partial<Building>) => void;
  addInventoryItem: (item: Equipment) => void;
  removeInventoryItem: (inventoryId: string) => void;
  /**
   * Atomically equip an item to a maiden.
   * Handles weapon-slot swap, cross-maiden transfer, and inventory tracking.
   * ownerMaidenId: set if the item is currently equipped by another maiden (null = from stock).
   */
  equipItem: (targetMaidenId: string, item: Equipment, ownerMaidenId: string | null) => void;
  /** Atomically unequip an item from a maiden back to stock. */
  unequipItem: (maidenId: string, item: Equipment) => void;
  decrementFreeRecruit: () => void;
  setDefaultTeamId: (teamId: string | undefined) => void;
  combatLocked: boolean;
  setCombatLocked: (locked: boolean) => void;
  // Building effects
  healInjuredMaidens: (fraction: number) => void;
  craftEquipment: (equipmentId: string) => void;
  buyHQEquipment: (equipmentId: string) => void;
  sellEquipment: (inventoryId: string) => void;
  /** Toggle the isLocked flag on an inventory item or an equipped item. */
  toggleItemLock: (inventoryId: string) => void;
  awardTrainingExp: (amount: number, excludeMaidenIds?: string[]) => void;
  applyPracticalExpGains: (gains: ExpGain[]) => void;
  /** Apply permanent morale bonus gains to individual maidens after a stage */
  applyMoraleGains: (deltas: Map<string, number>) => void;
  /** Handle maiden morale-zero events: escaped or captured */
  applyMoraleQuitEvents: (escapedIds: string[], capturedIds: string[]) => void;
  /** Rescue maidens captured during this mission when the team wins — un-captures them and grants the Rescued tag */
  rescueCapturedMaidens: (capturedIds: string[], teamId: string) => void;
  /**
   * Run after every mission return:
   * - clears moraleQuitStatus on non-captured maidens
   * - sets isDeployed false for all active maidens
   * - raises moralePermanentBonus so computed morale >= 20 for any maiden below the floor
   */
  postMissionReset: () => void;
  importSave: (data: SaveData) => void;
  exportSave: () => SaveData;
  persistSave: () => void;
  resetSave: () => void;
  /**
   * Re-generate the mission pool based on the current roster strength.
   * Call on: app start, save load, mission conclusion.
   * Captured maidens are automatically placed in a rescue mission.
   */
  refreshMissions: () => void;
  /** Regenerate the HQ shop items for the current Radio Center tier. Costs `cost` gold (0 = free). */
  refreshHQShop: (cost?: number) => void;
  /** Record a mission's result in the rolling Meridian review window (last 10 missions). */
  recordMeridianMission: (record: MeridianMissionRecord) => void;
  /** Compute and apply Meridian HQ support (money + metal) after a mission conclusion. */
  applyMeridianSupport: (tier: number) => void;
}

export const useGameStore = create<GameState>((set, get) => {
  const initial = loadFromStorage();

  return {
    ...initial,
    hqShopItems: initial.hqShopItems ?? [],

    setMBase: (patch) =>
      set(s => ({ mbase: { ...s.mbase, ...patch } })),

    setMaiden: (id, patch) =>
      set(s => ({
        maidens: s.maidens.map(m => m.id === id ? { ...m, ...patch } : m),
      })),

    addMaiden: (maiden) =>
      set(s => {
        const newMaidens = [...s.maidens, maiden];
        // Auto-assign to default team if one is set
        if (s.defaultTeamId) {
          const team = s.teams.find(t => t.id === s.defaultTeamId);
          if (team && !team.memberIds.includes(maiden.id)) {
            const newMemberIds = [...team.memberIds, maiden.id];
            // Auto-assign leader if team is currently empty
            let newLeaderId = team.leaderId;
            if (team.memberIds.length === 0) {
              // Best strategy among new roster (just this maiden at this point)
              newLeaderId = maiden.id;
            }
            return {
              maidens: newMaidens,
              teams: s.teams.map(t =>
                t.id === s.defaultTeamId
                  ? { ...t, memberIds: newMemberIds, leaderId: newLeaderId }
                  : t
              ),
            };
          }
        }
        return { maidens: newMaidens };
      }),

    setDefaultTeamId: (teamId) =>
      set(() => ({ defaultTeamId: teamId })),

    removeMaiden: (id) =>
      set(s => ({
        maidens: s.maidens.filter(m => m.id !== id),
      })),

    setTeam: (id, patch) =>
      set(s => ({
        teams: s.teams.map(t => t.id === id ? { ...t, ...patch } : t),
      })),

    addTeam: (team) =>
      set(s => ({ teams: [...s.teams, team] })),

    removeTeam: (id) =>
      set(s => ({ teams: s.teams.filter(t => t.id !== id) })),

    setMission: (id, patch) =>
      set(s => ({
        missions: s.missions.map(m => m.id === id ? { ...m, ...patch } : m),
      })),

    setBuilding: (id, patch) =>
      set(s => ({
        buildings: s.buildings.map(b => b.id === id ? { ...b, ...patch } : b),
      })),

    addInventoryItem: (item) =>
      set(s => ({ inventory: [...s.inventory, { ...item, inventoryId: item.inventoryId ?? uuidv4() }] })),

    removeInventoryItem: (inventoryId) =>
      set(s => {
        const idx = s.inventory.findIndex(i => i.inventoryId === inventoryId || i.id === inventoryId);
        if (idx === -1) return s;
        const next = [...s.inventory];
        next.splice(idx, 1);
        return { inventory: next };
      }),

    equipItem: (targetMaidenId, item, ownerMaidenId) =>
      set(s => {
        // Match helper — works whether or not inventoryId is set
        const sameItem = (a: Equipment, b: Equipment) =>
          a.inventoryId && b.inventoryId ? a.inventoryId === b.inventoryId : a.id === b.id;

        const target = s.maidens.find(m => m.id === targetMaidenId);
        if (!target) return s;

        const isWeapon = item.slot === 'weapon';

        // Target's current weapon that will be displaced (if any)
        const displaced = isWeapon ? target.equipment.find(e => e.slot === 'weapon') : undefined;

        // Weight capacity check
        const currentWeight = computeCarryWeight(target.equipment);
        const removedWeight = displaced ? (displaced.weight ?? 0) : 0;
        const newWeight = currentWeight - removedWeight + (item.weight ?? 0);
        // Effective strength after the swap: base + STR bonuses from remaining gear + new item's STR
        const strBonusFromCurrent = target.equipment.reduce((sum, e) =>
          sum + e.bonuses.filter(b => b.stat === 'strength').reduce((s, b) => s + b.value, 0), 0);
        const strBonusFromDisplaced = displaced
          ? displaced.bonuses.filter(b => b.stat === 'strength').reduce((s, b) => s + b.value, 0)
          : 0;
        const strBonusFromNew = item.bonuses.filter(b => b.stat === 'strength').reduce((s, b) => s + b.value, 0);
        const effectiveStrength = target.stats.strength + strBonusFromCurrent - strBonusFromDisplaced + strBonusFromNew;
        const maxWeight = computeMaxCarryWeight(effectiveStrength);
        if (newWeight > maxWeight) return s; // Block: over capacity

        let newMaidens = s.maidens.map(m => {
          if (m.id === ownerMaidenId) {
            // Remove item from owner. For weapon swaps give displaced weapon to owner instead.
            const withoutItem = m.equipment.filter(e => !sameItem(e, item));
            if (isWeapon && displaced) {
              return { ...m, equipment: [...withoutItem, displaced] };
            }
            return { ...m, equipment: withoutItem };
          }
          if (m.id === targetMaidenId) {
            const base = isWeapon ? m.equipment.filter(e => e.slot !== 'weapon') : m.equipment;
            // Compute HP delta: new item's HP bonuses minus any displaced weapon's HP bonuses
            const hpDelta = item.bonuses.filter(b => b.stat === 'hp' && !b.isPercent).reduce((s, b) => s + b.value, 0)
              - (displaced?.bonuses.filter(b => b.stat === 'hp' && !b.isPercent).reduce((s, b) => s + b.value, 0) ?? 0);
            const newMaxHp = m.maxHp + hpDelta;
            const newCurrentHp = Math.min(m.currentHp + Math.max(0, hpDelta), newMaxHp);
            return { ...m, equipment: [...base, item], maxHp: newMaxHp, currentHp: newCurrentHp };
          }
          return m;
        });

        // Inventory: remove the incoming item; return displaced weapon to stock if item came from inventory
        let newInventory = s.inventory;
        if (!ownerMaidenId) {
          // Item came from stock — remove it
          newInventory = newInventory.filter(i => !sameItem(i, item));
          // Return displaced weapon to stock (if there was one)
          if (displaced) {
            const alreadyInStock = newInventory.some(i => sameItem(i, displaced));
            if (!alreadyInStock) newInventory = [...newInventory, displaced];
          }
        }

        return { maidens: newMaidens, inventory: newInventory };
      }),

    unequipItem: (maidenId, item) =>
      set(s => {
        const sameItem = (a: Equipment, b: Equipment) =>
          a.inventoryId && b.inventoryId ? a.inventoryId === b.inventoryId : a.id === b.id;
        const hpDelta = item.bonuses.filter(b => b.stat === 'hp' && !b.isPercent).reduce((s, b) => s + b.value, 0);
        const newMaidens = s.maidens.map(m => {
          if (m.id !== maidenId) return m;
          const newMaxHp = m.maxHp - hpDelta;
          const newCurrentHp = Math.max(1, Math.min(m.currentHp, newMaxHp));
          return { ...m, equipment: m.equipment.filter(e => !sameItem(e, item)), maxHp: newMaxHp, currentHp: newCurrentHp };
        });
        // Always add the unequipped item back to inventory — the maiden and stockpile
        // can legitimately hold separate copies of the same item type.
        const newInventory = [...s.inventory, item];
        return { maidens: newMaidens, inventory: newInventory };
      }),

    decrementFreeRecruit: () =>
      set(s => ({ freeRecruitCount: Math.max(0, s.freeRecruitCount - 1) })),

    combatLocked: false,
    setCombatLocked: (locked) => set({ combatLocked: locked }),

    // ── Building effect actions ───────────────────────────────────────────────

    healInjuredMaidens: (fraction) =>
      set(s => ({
        maidens: s.maidens.map(m => {
          if (m.isFallen || m.currentHp <= 0 || m.currentHp >= m.maxHp) return m;
          const healed = Math.floor(m.maxHp * fraction);
          return { ...m, currentHp: Math.min(m.maxHp, m.currentHp + healed) };
        }),
      })),

    craftEquipment: (equipmentId) =>
      set(s => {
        const template = (equipmentData as Equipment[]).find(e => e.id === equipmentId);
        if (!template || !template.craftable || !template.craftCost) return s;
        const { money, wood, metal } = template.craftCost;
        if (s.mbase.money < money || s.mbase.wood < wood || s.mbase.metal < metal) return s;
        const newItem: Equipment = { ...template, inventoryId: uuidv4() };
        return {
          mbase: { ...s.mbase, money: s.mbase.money - money, wood: s.mbase.wood - wood, metal: s.mbase.metal - metal },
          inventory: [...s.inventory, newItem],
        };
      }),

    buyHQEquipment: (equipmentId) =>
      set(s => {
        const template = (equipmentData as Equipment[]).find(e => e.id === equipmentId);
        if (!template) return s;
        // Item must currently be in the shop listing
        if (!(s.hqShopItems ?? []).includes(equipmentId)) return s;
        const price = template.price ?? 0;
        const extraWood = template.hqExtraCost?.wood ?? 0;
        const extraMetal = template.hqExtraCost?.metal ?? 0;
        if (s.mbase.money < price || s.mbase.wood < extraWood || s.mbase.metal < extraMetal) return s;
        const newItem: Equipment = { ...template, inventoryId: uuidv4() };
        return {
          mbase: {
            ...s.mbase,
            money: s.mbase.money - price,
            wood: s.mbase.wood - extraWood,
            metal: s.mbase.metal - extraMetal,
          },
          inventory: [...s.inventory, newItem],
          hqShopItems: (s.hqShopItems ?? []).filter(id => id !== equipmentId),
        };
      }),

    sellEquipment: (inventoryId) =>
      set(s => {
        const idx = s.inventory.findIndex(i => i.inventoryId === inventoryId || i.id === inventoryId);
        if (idx === -1) return s;
        const item = s.inventory[idx];
        if (item.isLocked) return s; // blocked — locked items cannot be sold
        const sellPrice = Math.floor((item.price ?? 0) * 0.5);
        const next = [...s.inventory];
        next.splice(idx, 1);
        return { inventory: next, mbase: { ...s.mbase, money: s.mbase.money + sellPrice } };
      }),

    toggleItemLock: (inventoryId) =>
      set(s => {
        // Check inventory first
        const invIdx = s.inventory.findIndex(i => i.inventoryId === inventoryId || i.id === inventoryId);
        if (invIdx !== -1) {
          const next = [...s.inventory];
          next[invIdx] = { ...next[invIdx], isLocked: !next[invIdx].isLocked };
          return { inventory: next };
        }
        // Check equipped items on maidens
        return {
          maidens: s.maidens.map(m => {
            const eIdx = m.equipment.findIndex(e => e.inventoryId === inventoryId || e.id === inventoryId);
            if (eIdx === -1) return m;
            const newEq = [...m.equipment];
            newEq[eIdx] = { ...newEq[eIdx], isLocked: !newEq[eIdx].isLocked };
            return { ...m, equipment: newEq };
          }),
        };
      }),

    awardTrainingExp: (amount, excludeMaidenIds = []) =>
      set(s => ({
        maidens: s.maidens.map(m => {
          if (m.isFallen || m.isCaptured || excludeMaidenIds.includes(m.id)) return m;
          const exp = m.expData ?? { weapons: {}, scout: { theoryExp: 0, practicalExp: 0 }, sneak: { theoryExp: 0, practicalExp: 0 } };
          // Determine equipped weapon type
          const weaponType = m.equipment.find(e => e.slot === 'weapon')?.weaponType;
          const newWeapons = { ...exp.weapons };
          if (weaponType) {
            const prev = newWeapons[weaponType] ?? { theoryExp: 0, practicalExp: 0 };
            newWeapons[weaponType] = { ...prev, theoryExp: prev.theoryExp + amount };
          }
          return {
            ...m,
            expData: {
              weapons: newWeapons,
              scout: { ...exp.scout, theoryExp: exp.scout.theoryExp + amount },
              sneak: { ...exp.sneak, theoryExp: exp.sneak.theoryExp + amount },
            },
          };
        }),
      })),

    applyPracticalExpGains: (gains) =>
      set(s => {
        // Aggregate gains per maiden
        const gainMap = new Map<string, { weapon?: Record<string, number>; scout: number; sneak: number }>();
        for (const g of gains) {
          const entry = gainMap.get(g.maidenId) ?? { scout: 0, sneak: 0 };
          if (g.subject === 'weapon' && g.weaponType) {
            entry.weapon = entry.weapon ?? {};
            entry.weapon[g.weaponType] = (entry.weapon[g.weaponType] ?? 0) + 1;
          } else if (g.subject === 'scout') {
            entry.scout += 1;
          } else if (g.subject === 'sneak') {
            entry.sneak += 1;
          }
          gainMap.set(g.maidenId, entry);
        }
        return {
          maidens: s.maidens.map(m => {
            const gain = gainMap.get(m.id);
            if (!gain) return m;
            const exp = m.expData ?? { weapons: {}, scout: { theoryExp: 0, practicalExp: 0 }, sneak: { theoryExp: 0, practicalExp: 0 } };
            const newWeapons = { ...exp.weapons };
            if (gain.weapon) {
              for (const [wt, amt] of Object.entries(gain.weapon)) {
                const prev = newWeapons[wt as keyof typeof newWeapons] ?? { theoryExp: 0, practicalExp: 0 };
                newWeapons[wt as keyof typeof newWeapons] = { ...prev, practicalExp: prev.practicalExp + amt };
              }
            }
            return {
              ...m,
              expData: {
                weapons: newWeapons,
                scout: { ...exp.scout, practicalExp: exp.scout.practicalExp + gain.scout },
                sneak: { ...exp.sneak, practicalExp: exp.sneak.practicalExp + gain.sneak },
              },
            };
          }),
        };
      }),

    applyMoraleGains: (gains) =>
      set(s => ({
        maidens: s.maidens.map(m => {
          const delta = gains.get(m.id);
          if (delta === undefined || delta === 0) return m;
          return { ...m, moralePermanentBonus: Math.min(100, (m.moralePermanentBonus ?? 0) + delta) };
        }),
      })),

    applyMoraleQuitEvents: (escapedIds, capturedIds) =>
      set(s => ({
        maidens: s.maidens.map(m => {
          if (escapedIds.includes(m.id)) {
            // Escaped: remove from team, force morale to 20, add Coward tag.
            // moralePermanentBonus must go negative to achieve morale = 20
            // when base formula is: morale = 50 + charm + permanentBonus.
            // So permanentBonus = 20 - 50 - charm = -30 - charm.
            const alreadyCoward = m.tags.some(t => t.id === 'Coward');
            const escapePermanentBonus = 20 - 50 - getStat(m, 'charm'); // allows negative
            return { ...m, isDeployed: false, moraleQuitStatus: 'escaped' as const, moralePermanentBonus: escapePermanentBonus, tags: alreadyCoward ? m.tags : [...m.tags, { id: 'Coward' }] };
          }
          if (capturedIds.includes(m.id)) {
            // Captured: add Coward and Thrall tags
            const alreadyCoward = m.tags.some(t => t.id === 'Coward');
            const alreadyThrall = m.tags.some(t => t.id === 'Thrall');
            const newTags = [...m.tags, ...(!alreadyCoward ? [{ id: 'Coward' }] : []), ...(!alreadyThrall ? [{ id: 'Thrall' }] : [])];
            return { ...m, isCaptured: true, isDeployed: false, moraleQuitStatus: 'captured' as const, tags: newTags };
          }
          return m;
        }),
        // Remove captured (and escaped) maidens from all team rosters
        teams: capturedIds.length === 0 && escapedIds.length === 0
          ? s.teams
          : s.teams.map(t => {
              const removedIds = new Set([...capturedIds, ...escapedIds]);
              if (!t.memberIds.some(id => removedIds.has(id))) return t;
              const newMemberIds = t.memberIds.filter(id => !removedIds.has(id));
              const newLeaderId = t.leaderId && removedIds.has(t.leaderId)
                ? s.maidens.find(m => newMemberIds.includes(m.id) && !m.isFallen && !m.isCaptured && m.currentHp > 0)?.id ?? undefined
                : t.leaderId;
              return { ...t, memberIds: newMemberIds, leaderId: newLeaderId };
            }),
      })),

    rescueCapturedMaidens: (capturedIds, teamId) =>
      set(s => ({
        maidens: s.maidens.map(m => {
          if (!capturedIds.includes(m.id)) return m;
          // Un-capture and remove Thrall tag; add Rescued tag if not present
          const alreadyRescued = m.tags.some(t => t.id === 'Rescued');
          const newTags = [
            ...m.tags.filter(t => t.id !== 'Thrall'),
            ...(!alreadyRescued ? [{ id: 'Rescued' }] : []),
          ];
          return { ...m, isCaptured: false, moraleQuitStatus: null, isDeployed: true, tags: newTags };
        }),
        // Re-add rescued maidens to their team roster
        teams: s.teams.map(t => {
          if (t.id !== teamId) return t;
          const toAdd = capturedIds.filter(id => !t.memberIds.includes(id));
          if (toAdd.length === 0) return t;
          return { ...t, memberIds: [...t.memberIds, ...toAdd] };
        }),
      })),

    postMissionReset: () =>
      set(s => ({
        maidens: s.maidens.map(m => {
          if (m.isFallen) return m;
          // Non-captured maidens: clear escaped status and ensure morale floor of 20
          if (!m.isCaptured) {
            const permanent = m.moralePermanentBonus ?? 0;
            const currentMorale = 50 + getStat(m, 'charm') + permanent;
            const newPermanent = currentMorale < 20 ? (20 - 50 - getStat(m, 'charm')) : permanent;
            return { ...m, isDeployed: false, moraleQuitStatus: null, moralePermanentBonus: newPermanent, isStarved: false };
          }
          // Captured maidens: just ensure not deployed
          return { ...m, isDeployed: false, isStarved: false };
        }),
      })),

    refreshMissions: () => {
      const s = get();
      const capturedMaidens = s.maidens.filter(m => m.isCaptured && !m.isFallen);
      const newMissions = generateMissionSet(s.maidens, capturedMaidens);
      set({ missions: newMissions });
    },

    refreshHQShop: (cost = 0) => {
      const s = get();
      if (cost > 0 && s.mbase.money < cost) return;
      const radioCenter = s.buildings.find(b => b.id === 'radio_center');
      if (!radioCenter || !radioCenter.isConstructed) return;
      const tier = radioCenter.currentLevel;
      const items = generateHQShopItems(tier);
      set({
        hqShopItems: items,
        ...(cost > 0 ? { mbase: { ...s.mbase, money: s.mbase.money - cost } } : {}),
      });
    },

    recordMeridianMission: (record) =>
      set(s => {
        const stats = s.meridianStats ?? { recentMissions: [], totalMissionsDone: 0 };
        const updated = [...stats.recentMissions, record].slice(-10);
        return { meridianStats: { recentMissions: updated, totalMissionsDone: (stats.totalMissionsDone ?? 0) + 1 } };
      }),

    applyMeridianSupport: (tier) =>
      set(s => {
        const { fsi } = computeForceStrengthIndex(s.maidens);
        const allRecent = (s.meridianStats?.recentMissions ?? []).slice(-10);
        // Only count wins toward difficulty-weighted score; losses still affect death penalty
        const diffWeight = { easy: 0.6, normal: 1.0, hard: 1.5, extreme: 2.2 };
        const winRecords = allRecent.filter(r => r.isWin);
        const diffScore = winRecords.reduce((a, r) => a + (diffWeight[r.difficulty] ?? 1.0), 0);
        const recent = allRecent;
        const totalKills = recent.reduce((a, r) => a + r.kills, 0);
        // Kill bonus: +1% per 2.5 kills, capped at +40%
        const killMult = 1 + Math.min(totalKills / 100, 0.4);
        // Clean mission bonus: +3% for each winning mission with ≤10% death rate
        const cleanCount = winRecords.filter(r => r.deaths / Math.max(1, r.deployedCount) <= 0.1).length;
        const cleanBonus = 1 + cleanCount * 0.03;
        // Per-mission death penalty: exponent grows with death rate; stacks multiplicatively
        const perMissionDeathMult = recent.reduce((acc, r) => {
          const dr = r.deaths / Math.max(1, r.deployedCount);
          if (dr <= 0.1) return acc;
          const exp = 1.2 + dr * 1.3; // 1.2 at 10% → 2.5 at 100%
          return acc * Math.max(0.05, Math.pow(1 - dr, exp));
        }, 1.0);
        const deathMult = Math.max(0.05, cleanBonus * perMissionDeathMult);
        const finalMult = Math.min(Math.max(killMult * deathMult, 0.05), 3.0);
        // basePay scales with difficulty-weighted win score instead of raw mission count
        const basePay = Math.min(30 * tier * (1 + diffScore * 0.03) * (1 + fsi / 400), 500);
        const money = Math.floor(basePay * finalMult);
        const metal = Math.floor(basePay * 0.4 * finalMult);
        return { mbase: { ...s.mbase, money: s.mbase.money + money, metal: s.mbase.metal + metal } };
      }),

    importSave: (data) => {
      const migrated = migrateSaveData({ ...data });
      localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
      set({ ...migrated });
    },

    exportSave: () => {
      const s = get();
      const data: SaveData = {
        saveVersion: s.saveVersion,
        savedAt: new Date().toISOString(),
        mbase: s.mbase,
        maidens: s.maidens,
        teams: s.teams,
        missions: s.missions,
        buildings: s.buildings,
        inventory: s.inventory,
        freeRecruitCount: s.freeRecruitCount,
        hqShopItems: s.hqShopItems ?? [],
        meridianStats: s.meridianStats,
      };
      return data;
    },

    persistSave: () => {
      const data = get().exportSave();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    },

    resetSave: () => {
      const fresh = { ...INITIAL_SAVE, savedAt: new Date().toISOString() };
      set(fresh);
      localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
    },
  };
});
