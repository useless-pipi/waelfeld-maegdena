import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { simulateStage, computePersonalMoraleBase, getStat, type StageOutcome, type CombatEvent, type ExpGain } from '../engine/combat';
import { computeForceStrengthIndex, TIER_CONFIGS } from '../engine/missionGen';
import type { Maiden } from '../types/maiden';
import { getUnitIcon, getMaidenIcon } from '../utils/portraits';
import { HEROINE_DEFINITIONS } from '../data/heroines';
import { heroineDefToMaiden } from '../engine/recruit';
import { initializeStageEnemies, enrichEnemyGear } from '../engine/missionGen';

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
    healInjuredMaidens, awardTrainingExp, applyPracticalExpGains, applyMoraleGains, applyMoraleQuitEvents, postMissionReset, rescueCapturedMaidens, refreshMissions,
    recordMeridianMission, applyMeridianSupport } = useGameStore();
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [combatSpeed, setCombatSpeed] = useState<1 | 2 | 4 | 8>(() => readSpeedCookie());
  // Accumulate enemy kills across stages for Meridian reporting
  const missionKillsRef = useRef(0);

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

  function startMission(teamId: string, autoTradeFood = false) {
    if (!selectedMission || !teamId) return;
    const maidenTeam = teams.find(t => t.id === teamId);
    if (!maidenTeam) return;

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

  function applyPostMissionEffects(deployedMaidenIds: string[], missionKills: number) {
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
        isWin: missionKills > 0 || missionDeaths < deployedMaidenIds.length,
      });
      applyMeridianSupport(tier);
    }
  }

  function handleReturnToMissions() {
    // Reset escape flags, deployed state, and apply morale floor
    postMissionReset();
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
            // if the team leader died, promote the survivor with the highest strategy stat.
            teams.forEach(team => {
              const hadDead = team.memberIds.some(id => deadIds.has(id));
              if (!hadDead) return;
              const newMemberIds = team.memberIds.filter(id => !deadIds.has(id));
              let newLeaderId = team.leaderId;
              if (team.leaderId && deadIds.has(team.leaderId)) {
                // Pick highest-strategy living member from the updated list
                const survivors = updatedMaidens.filter(
                  m => newMemberIds.includes(m.id) && m.currentHp > 0
                );
                // Also consider maidens already in store that aren't in updatedMaidens
                const storeMembers = maidens.filter(
                  m => newMemberIds.includes(m.id) && !deadIds.has(m.id) && m.currentHp > 0 && !m.isFallen
                );
                const candidates = survivors.length > 0 ? survivors : storeMembers;
                const best = candidates.reduce<Maiden | null>(
                  (top, m) => (!top || getStat(m, 'strategy') > getStat(top, 'strategy') ? m : top),
                  null
                );
                newLeaderId = best?.id ?? undefined;
              }
              setTeam(team.id, { memberIds: newMemberIds, leaderId: newLeaderId });
            });
          }
        }}
        onAbortMission={handleReturnToMissions}
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

          // Rescue any maidens captured during this stage if the team won
          if (isWin && moraleCapturedIds.length > 0 && missionState.selectedTeamId) {
            const actualCapturedIds = moraleCapturedIds.filter(id => !moraleEscapedIds.includes(id));
            if (actualCapturedIds.length > 0) {
              rescueCapturedMaidens(actualCapturedIds, missionState.selectedTeamId);
              // Remove them from mission's capturedMaidenIds since they were rescued
              const existing = activeMission.capturedMaidenIds ?? [];
              const remaining = existing.filter(id => !actualCapturedIds.includes(id));
              setMission(activeMission.id, { capturedMaidenIds: remaining });
            }
          }
          if (nextStageIdx >= activeMission.stages.length || !isWin) {
            // Mission complete or failed — apply post-mission building effects
            const deployedIds = missionState.stageMaidens.map(m => m.id);
            applyPostMissionEffects(deployedIds, missionKillsRef.current);

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
            handleReturnToMissions();
            return;
          }

          // Advance to next stage (only with survivors — exclude captured and escaped)
          const outIds = new Set([...moraleCapturedIds, ...moraleEscapedIds]);
          const survivors = updatedMaidens.filter(m => m.currentHp > 0 && !outIds.has(m.id));
          const nextStage = activeMission.stages[nextStageIdx];
          setMissionState(s => ({
            ...s,
            currentStageIdx: nextStageIdx,
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

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>⚔️ Missions</h2>

      {/* ── Mission list (shown first) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {unlockedMissions.map(m => (
          <MissionListItem
            key={m.id}
            mission={m}
            selected={selectedMissionId === m.id}
            onSelect={() => setSelectedMissionId(m.id)}
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
              onStartMission={(teamId: string, autoTrade: boolean) => { setSelectedMissionId(null); startMission(teamId, autoTrade); }}
              onClose={() => setSelectedMissionId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MissionListItem({ mission, selected, onSelect }: any) {
  const diffColor = mission.difficulty === 'easy' ? '#4a8c4a' : mission.difficulty === 'normal' ? '#c8954a' : mission.difficulty === 'hard' ? '#c84a4a' : '#b84040';
  const rescueDefs = (mission.reward?.rescuedHeroineIds ?? []).map((id: string) => HEROINE_DEFINITIONS.find(h => h.id === id)).filter(Boolean);
  const FOCUS_BADGE: Record<string, { icon: string; label: string; color: string }> = {
    gold_heavy: { icon: '💰', label: 'Gold-heavy',  color: '#c8a84b' },
    supply_run: { icon: '🍖', label: 'Supply run',  color: '#6ab06a' },
    salvage:    { icon: '🔩', label: 'Salvage',     color: '#8ab0c8' },
    training:   { icon: '📚', label: 'Training',    color: '#a08ac8' },
    medal:      { icon: '🏅', label: 'Medal',       color: '#d4a84b' },
    balanced:   { icon: '⚖️', label: 'Balanced',    color: '#888'   },
    rescue:     { icon: '⛓️', label: 'Rescue',      color: '#e08080' },
  };
  const focus = mission.rewardFocus ? FOCUS_BADGE[mission.rewardFocus] : null;
  return (
    <div
      onClick={onSelect}
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
          <span style={{ fontSize: 10, color: diffColor }}>{mission.difficulty.toUpperCase()} · {mission.stages.length} stages</span>
          {focus && (
            <span title={focus.label} style={{
              fontSize: 10, color: focus.color,
              background: `${focus.color}18`, border: `1px solid ${focus.color}55`,
              borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap',
            }}>
              {focus.icon} {focus.label}
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
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [autoTradeFood, setAutoTradeFood] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoTradeFood');
    return saved === null ? true : saved === 'true';
  });
  const setAndSaveAutoTradeFood = (val: boolean) => {
    setAutoTradeFood(val);
    localStorage.setItem('autoTradeFood', String(val));
  };
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
        <select
          value={selectedTeamId || ''}
          onChange={(e) => setSelectedTeamId(e.target.value || null)}
          style={{
            width: '100%', padding: '8px', background: '#0e0d0b', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 4, marginBottom: 10, fontSize: 13,
          }}
        >
          <option value="">Choose a team...</option>
          {maidenTeams.map((t: any) => {
            const deployable = teamDeployable(t);
            const aliveCount = maidens.filter((m: Maiden) => t.memberIds.includes(m.id) && m.currentHp > 0 && !m.isFallen).length;
            return (
              <option key={t.id} value={t.id}>
                {t.name} ({aliveCount}/{t.memberIds.length} alive){!deployable ? ' ✕' : ''}
              </option>
            );
          })}
        </select>

        {selectedTeam && (
          <div style={{ padding: 10, background: '#0e0d0b', borderRadius: 4, marginBottom: 10, fontSize: 12 }}>
            <div style={{ color: 'var(--color-accent)', fontWeight: 'bold', marginBottom: 6 }}>{selectedTeam.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {teamMembers.map((m: Maiden) => {
                const isOut = m.isFallen || m.currentHp <= 0;
                const isCap = m.isCaptured;
                return (
                  <span key={m.id} style={{
                    background: isCap ? 'rgba(120,0,180,0.15)' : isOut ? 'rgba(184,64,64,0.12)' : 'rgba(200,149,74,0.15)',
                    padding: '3px 8px', borderRadius: 3,
                    border: `1px solid ${isCap ? '#a040e0' : isOut ? 'var(--color-danger)' : 'var(--color-accent-dark)'}`,
                    color: isCap ? '#c080ff' : isOut ? '#e88' : 'var(--color-text-muted)',
                    fontSize: 11,
                  }}>
                    {m.nickname ?? m.name.split(' ')[0]} {isOut ? '💀' : isCap ? '⛓️ Captured' : `(HP: ${m.currentHp}/${m.maxHp})`}
                  </span>
                );
              })}
            </div>
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

      <button
        onClick={() => canStart && onStartMission(selectedTeamId, autoTradeFood)}
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
  useEffect(() => {
    if (battleComplete && !hpSyncedRef.current) {
      hpSyncedRef.current = true;
      onSyncHP(maidenStatesRef.current);
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
      : event.type === 'attack' || event.type === 'retreat_fire'  ? 1800
      : event.type === 'miss'                                      ? 1400
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
        const m = ev.message.match(/(.+?)\s+hits\s+(.+?)\s+for\s+(\d+)\s+damage/);
        if (m) {
          const target = m[2]; const dmg = parseInt(m[3]);
          nextMaidens = nextMaidens.map(x =>
            (x.nickname ?? x.name.split(' ')[0]) === target || x.name === target
              ? { ...x, currentHp: Math.max(0, x.currentHp - dmg) } : x);
          nextEnemies = nextEnemies.map(x =>
            x.name === target ? { ...x, currentHp: (x as any).type === 'lyssa' ? Math.max(1, x.currentHp - dmg) : Math.max(0, x.currentHp - dmg) } : x);
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
    <div style={{ minHeight: '100vh', padding: 24 }}>
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
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>{currentStage.description}</div>

      {/* Stage result — shown at the top as soon as battle concludes */}
      {battleComplete && (() => {
        const alive     = maidenStates.filter(m => m.currentHp > 0 && !m.isFallen && !m.isCaptured);
        const dead      = maidenStates.filter(m => m.isFallen || m.currentHp <= 0);
        const captured  = maidenStates.filter(m => m.isCaptured);
        const belowHalf = alive.filter(m => m.currentHp < (m.maxHp ?? 1) * 0.5);
        const lowMorale = alive.filter(m => (personalMoraleState[m.id] ?? 50) < 30);
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
                { icon: '🟢', label: 'Alive',        count: alive.length,     color: '#4a9c5a', always: true },
                { icon: '💀', label: 'KIA',           count: dead.length,      color: '#b84040', always: false },
                { icon: '⛓️', label: 'Captured',     count: captured.length,  color: '#c8a84b', always: false },
                { icon: '🩸', label: 'Below 50% HP', count: belowHalf.length, color: '#c87040', always: false },
                { icon: '😰', label: 'Low Morale',   count: lowMorale.length, color: '#8b5fc4', always: false },
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
            {captured.length > 0 && (
              <div style={{ fontSize: 11, color: '#c8a84b', marginBottom: 6 }}>
                <strong>Captured:</strong> {captured.map(m => m.nickname ?? m.name.split(' ')[0]).join(', ')}
              </div>
            )}
            {belowHalf.length > 0 && (
              <div style={{ fontSize: 11, color: '#c87040', marginBottom: 6 }}>
                <strong>Wounded (&lt;50% HP):</strong> {belowHalf.map(m => `${m.nickname ?? m.name.split(' ')[0]} (${m.currentHp}/${m.maxHp})`).join(', ')}
              </div>
            )}
            {lowMorale.length > 0 && (
              <div style={{ fontSize: 11, color: '#8b5fc4', marginBottom: 12 }}>
                <strong>Shaken (morale&lt;30):</strong> {lowMorale.map(m => `${m.nickname ?? m.name.split(' ')[0]} (${Math.round(personalMoraleState[m.id] ?? 0)})`).join(', ')}
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
                  onClick={() => onAbortMission()}
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

      {/* Event animation strip — always visible, scrolls independently of the team columns */}
      <ActionStage
        event={stageEvent}
        visible={stageVisible}
        allCombatants={allCombatants}
        battleComplete={battleComplete}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(320px, 1fr) 200px', gap: 16, marginBottom: 8 }}>
        {/* Maiden team morale */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>
            Team Morale: <strong style={{ color: maidenTeamMorale >= 70 ? '#4a8c4a' : maidenTeamMorale >= 30 ? '#c8a84b' : '#b84040' }}>{Math.round(maidenTeamMorale)}</strong>
          </div>
          <div style={{ height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${maidenTeamMorale}%`, background: maidenTeamMorale >= 70 ? '#4a8c4a' : maidenTeamMorale >= 30 ? '#c8a84b' : '#b84040', transition: 'width 0.4s' }} />
          </div>
        </div>
        <div />
        {/* Enemy team morale */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>
            Team Morale: <strong style={{ color: enemyTeamMorale >= 70 ? '#4a8c4a' : enemyTeamMorale >= 30 ? '#c8a84b' : '#b84040' }}>{Math.round(enemyTeamMorale)}</strong>
          </div>
          <div style={{ height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${enemyTeamMorale}%`, background: enemyTeamMorale >= 70 ? '#4a8c4a' : enemyTeamMorale >= 30 ? '#c8a84b' : '#b84040', transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(320px, 1fr) 200px', gap: 16, marginBottom: 16 }}>
        {/* Maiden team */}
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
        />

        {/* centre spacer — ActionStage is now rendered above the morale bars */}
        <div />

        {/* Enemy team */}
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
function CombatantPanel({ label, combatants, coverList, stunnedList = [], hpBarAlive, borderAlive, borderDead, isEnemy, coverLevel, retreating, personalMoraleState = {}, escapingNames = [], escapedNames = [], capturedNames = [], displayedEvents = [], stageMoraleGains = [] }: any) {
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
      {combatants.map((c: any) => {
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
            style={{ marginBottom: 12, fontSize: 11, display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}
            onMouseEnter={e => {
              if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
              setHoveredId(c.id);
              setTooltipPos({ x: e.clientX, y: e.clientY });
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
                  border: hasCover ? '2px solid #4a9eff' : `2px solid ${alive ? (isEnemy ? '#8b2020' : borderAlive) : borderDead}`,
                  boxShadow: hasCover ? '0 0 6px #4a9eff88' : 'none',
                  opacity: alive ? 1 : 0.45,
                  transition: 'border-color 0.3s, box-shadow 0.3s, opacity 0.4s',
                }}
              />
              {hasCover && (
                <span style={{ position: 'absolute', top: -5, right: -5, fontSize: 11, filter: 'drop-shadow(0 0 3px #4a9eff)' }}>🛡</span>
              )}
              {isStunned && (
                <span style={{ position: 'absolute', bottom: -5, right: -5, fontSize: 11, filter: 'drop-shadow(0 0 4px #e0c040)' }}>💫</span>
              )}
              {!isEnemy && (c as any).isStarved && (
                <span title="Starved — HP halved, −50% hit/dodge/scout/cover" style={{ position: 'absolute', bottom: -5, left: -5, fontSize: 11, filter: 'drop-shadow(0 0 4px #e07030)' }}>🥀</span>
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
    | { kind: 'idle' };

  let view: StageView = { kind: 'idle' };

  if (event) {
    if (event.type === 'log') {
      const roundMatch = event.message.match(/[-=]+\s*Round\s*(\d+)/i) || event.message.match(/Round\s*(\d+)/i);
      if (roundMatch) view = { kind: 'round', round: parseInt(roundMatch[1]) };
      else view = { kind: 'idle' };
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
