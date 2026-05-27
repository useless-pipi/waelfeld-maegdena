/**
 * DevAnalysis.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Developer-facing page documenting game mechanics, exploits, balance issues,
 * and winning strategies derived from a deep read of the engine source code.
 *
 * Route: /devanalysis  (dev-only, hidden from production nav)
 */

import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: 'exploit' | 'strategy' | 'mechanic' | 'economy' | 'balance';
  summary: string;
  detail: string;
  formula?: string;
  fix?: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const FINDINGS: Finding[] = [
  // ── CRITICAL EXPLOITS ──────────────────────────────────────────────────────
  {
    id: 'E01',
    title: 'FSI Tier-Lock: Keep Roster Small to Suppress Enemy Quality',
    severity: 'critical',
    category: 'exploit',
    summary: 'Enemy difficulty is calculated from FSI (Force Strength Index). Keeping fewer, weaker maidens deliberately locks the game into lower tiers with easy rewards.',
    detail: `FSI = Σ active maidens [ avg(STR,DEX,CON,AWR) × (currentHP / maxHP) ]

Tier thresholds:
  Rookie  FSI 0–89   → enemy quality 1–3  (Easy/Normal) [max Q3]
  Trained FSI 90–159 → enemy quality 2–5  (Easy/Normal) [max Q5]
  Seasoned FSI 160+  → harder enemies begin appearing

A player with exactly 10 average-stat maidens (avg power ≈ 8) sits at FSI ≈ 80 — permanently in Rookie tier.
They can run Tier-1 missions indefinitely. The reward multiplier at Easy quality = ×1, but with zero risk and no casualties.

CONSEQUENCE: There is no incentive to grow a large roster if a player discovers this mechanic. A 9-maiden squad stays Rookie forever and farms safe missions.`,
    formula: 'FSI = Σ mean(STR,DEX,CON,AWR) × HP/maxHP',
    fix: 'Add a minimum-tier floor that advances after N missions completed. Or make higher-tier missions give substantially better economy per turn, not just per mission.',
  },
  {
    id: 'E02',
    title: 'No Armor / Damage Reduction — Flat Damage Is Unchecked',
    severity: 'critical',
    category: 'exploit',
    summary: 'computeDamage() returns weapon.damage with no mitigation. There is no armor stat or damage-reduction mechanic anywhere in the engine.',
    detail: `export function computeDamage(attacker: Combatant): number {
  return getWeapon(attacker)?.damage ?? 4;
}

Every unit takes full flat weapon damage on every hit. High-damage weapons like the Annihilator Cannon
deal their listed damage to even the tankiest constitution-stacked maiden.

CONSEQUENCE:
- Late-game burst weapons (SMG, LMG, Annihilator Cannon) trivially one-shot low-CON maidens.
- There is no meaningful tradeoff between equipping armor vs weapons on the player side.
- Equipment like "Aegis Combat Plate" provides HP bonuses rather than mitigation, meaning it only extends the TTK linearly, not defensively.`,
    formula: 'dmg = weapon.damage (no mitigation)',
    fix: 'Introduce a constitution-based damage reduction (e.g. dmg = max(1, weapon.damage − floor(CON/4))). Or add equipment bonuses with an "armor" stat the engine reads.',
  },
  {
    id: 'E03',
    title: 'Hit Rate Floor is 5%: Burst Weapons Always Eventually Land',
    severity: 'high',
    category: 'exploit',
    summary: 'Hit rate is clamped to [5%, 95%]. A weapon firing 5 shots per round has 5× rolls at the floor, meaning a fully-dodging target is still hit ~23% of the time per burst turn.',
    detail: `computeHitRate clamps result to Math.max(5, Math.min(95, adjusted)).
Burst weapons (shotsPerRound > 1) make N independent 5%-minimum rolls.

P(at least one hit from 5 shots at 5%) = 1 − (0.95)^5 ≈ 22.6%

A SMG or LMG attacker facing a maxed-dodge defender still hits nearly 1-in-4 turns.
At 5 shots × e.g. 6 damage = 30 damage average on hit turns, this creates unblockable DPS.

If an enemy LMG fires at a 1-HP maiden on cover, the cover block (50–90%) is checked per shot,
so any single unblocked hit at the 5% floor kills her.`,
    formula: 'P(≥1 hit in N shots) = 1 − (1 − 0.05)^N',
    fix: 'Consider raising the floor dynamically with dodge bonuses, or capping burst shots vs a single high-dodge defender.',
  },
  {
    id: 'E04',
    title: 'Charm Stacking Eliminates Morale Collapse Risk',
    severity: 'high',
    category: 'exploit',
    summary: 'Personal morale base = 50 + charm + permanentBonus. A charm-20 maiden starts at morale 70 and can absorb far more hit-shock and damage penalties before reaching the zero-morale capture/escape threshold. Equipment charm bonuses are now counted, making this exploit significantly stronger than before.',
    detail: `personalMorale = clamp(50 + charm + sumBonuses(charm) + permanentBonus + tempBonus, 0, 100)
tempBonus: HP > 70% = +10, HP < 30% = −10
hitShock: −20 per hit this stage (stacks)
permanentBonus changes: +10 per kill, −damage per hit received

A charm-20 maiden: baseline morale = 70.
She needs 70 / 20 = 3.5 hits before morale-zero (ignoring kills that restore +10).

A charm-3 maiden: baseline = 53. Zero after 3 hits.

NOTE: Equipment charm bonuses now apply (U02 fix). This makes charm-stacking even more extreme:
  Medal of Bravery (+2 Charm) + Commanders Seal (+6 Charm) + Valkyrie Crown (+4 Charm) = +12 bonus charm.
  A charm-14 maiden with all three items has effective charm 26 → baseline morale 76.
  She would need ~3.8 hits to collapse — near-immune with good gear.

CONSEQUENCE:
- Stacking charm-high maidens with charm equipment makes your team near-immune to morale collapse.
- "Team morale base = 50 − stddev(charm) + leaderCharm" also rewards uniform charm values.
  A team where all maidens have charm=15 has stddev=0 → team morale = 65 before any bonuses.
- Combined: a high-charm, uniform team with charm gear will NEVER experience morale events.`,
    formula: 'morale = 50 + (charm + sumBonuses(charm)) + permBonus + tempBonus',
    fix: 'Add a diminishing returns curve to charm-based morale. Or weight morale collapse risk on actual battle damage ratios, not purely on accumulated hit-shock.',
  },
  {
    id: 'E05',
    title: 'Retreat Safety Valve: Player Can Always Escape if ≥ 1/3 Enemies Alive',
    severity: 'high',
    category: 'exploit',
    summary: 'Retreat succeeds unless surviving maidens ≤ surviving enemies / 3. This means a player with even 1 maiden alive vs 4 enemies can retreat safely.',
    detail: `On retreat (player-initiated or morale collapse):
  - Enemies fire one free round (Retreat Fire)
  - Then: if survivingMaidens <= survivingEnemies / 3 → captured
  - Otherwise: retreat success

With 1 maiden vs 4 enemies after retreat fire = 1 ≤ 4/3 = 1.33 → captured (borderline)
With 2 maidens vs 6 enemies = 2 ≤ 6/3 = 2 → CAPTURED (2 ≤ 2)
With 3 maidens vs 6 enemies = 3 > 2 → SAFE

EXPLOIT: A player can probe every mission with a single advance scout, take the retreat-fire round to gauge enemy damage,
then decide whether to commit the full team. The cost is zero if the scout survives the one fire round.

Also: morale collapse retreat is identical to voluntary retreat in terms of the capture check.
High-charm teams can afford to deliberately collapse into "morale retreat" to immediately trigger
an escape with the same capture math — effectively a free retreat on demand.`,
    fix: 'Differentiate morale-collapse retreat (harder capture threshold) from tactical retreat. Add a "committed" flag after the first exchange.',
  },

  // ── HIGH STRATEGIES ────────────────────────────────────────────────────────
  {
    id: 'S01',
    title: 'Optimal Strategy: DEX-Stacking for Hit Rate + Cover + Initiative',
    severity: 'info',
    category: 'strategy',
    summary: 'DEX governs hit rate (×5), initiative (attack order), cover chance (×2), and sneak index. It is the single most impactful offensive stat.',
    detail: `Hit rate:      base = DEX × 5   → DEX 15 = 75% base hit rate
Initiative:    higher DEX attacks first each round
Cover chance:  base + (DEX − 10) × 2%   → DEX 20 = +20% cover bonus
Sneak index:   1 + theoryLv×0.03 + practicalLv×0.10

A maiden with DEX 18 hits at 90% base, goes first in initiative, and has excellent cover uptake.
Compare CON-heavy build: more HP but attacks last and misses more.

OPTIMAL EARLY BUILD:
  Recruit for DEX 14+ maidens.
  Equip a rifle (enemy_rifle_mk2 hits 80 base vs standard 70).
  Fill support slots with scout/sneak training qualifications.
  Leader: highest STR (for strategy-based cover bonus on the whole team).`,
    formula: 'hitRate = (DEX×5 + bonuses − dodge) × weaponMult, clamped [5,95]',
  },
  {
    id: 'S02',
    title: 'Strategy-Leader Exploit: Leader STR Does Not Affect Combat, Only Strategy Does',
    severity: 'medium',
    category: 'strategy',
    summary: 'The leader\'s strategy stat gives +strategy×2% cover chance to ALL team members. This is a massive hidden multiplier. Leader should be picked for strategy, not strength.',
    detail: `leaderStratBonus = leader.stats.strategy × 2

This bonus is added to every maiden's cover chance check in applyCoverChecks().
A strategy-20 leader gives +40% to every maiden's cover roll each round.

Example: A maiden with DEX 10, coverLevel 5:
  Base cover chance = 5×5 + (10−10)×2 + (10−10)×4 = 25%
  With strategy-20 leader: 25% + 40% = 65% cover chance

This means a mediocre maiden essentially hides every other round with a strong leader.
Cover block rate at level 5 = 50 + 5×3 = 65% — so 65% chance to get in cover, then 65% block.

COMBINED: ~42% of all incoming shots to that maiden are blocked purely from the leader bonus.`,
    formula: 'coverChance = coverLevel×5 + (DEX−10)×2 + (STR−10)×4 + sneakExpBonus + leaderSTR×2',
    fix: 'Own strategy formula uses (strategy−10)×4 but leadStratBonus = (strategy + sumBonuses)×2 (no −10 offset). The leader bonus is still ~3× stronger than a maiden\'s own strategy contribution at equivalent stat values — consider adding the −10 offset to the leader formula for consistency.',
  },
  {
    id: 'B06',
    title: 'Leader Strategy Cover Bonus Ignores Equipment & Qualification Strategy Bonuses',
    severity: 'high',
    category: 'balance',
    summary: 'The leader strategy bonus to team cover chance uses leader.stats.strategy × 2 without sumBonuses(). Commanders Seal (+4 Strategy) equipped on the leader adds nothing to the team cover bonus, despite own-strategy cover being fixed in U02.',
    detail: `applyCoverChecks() in combat.ts:
  const leaderStratBonus = leader ? leader.stats.strategy * 2 : 0;

This bonus is added to every maiden's cover chance each round.
In contrast, calculateCoverChance() (own strategy) was fixed in U02 to use:
  stratBonus = (c.stats.strategy + sumBonuses(c, 'strategy') − 10) × 4

So a leader with Commanders Seal (+4 Strategy):
  Own cover bonus from personal stats: applies correctly via calculateCoverChance
  Team cover bonus from leadership: still raw stats.strategy × 2  (equipment seal ignored)

With a strategy-14 leader + Commanders Seal (+4):
  Expected: (14+4) × 2 = 36% team cover bonus
  Actual:    14 × 2    = 28% team cover bonus
  8% missing cover per round for every maiden on the team.

Qualification strategy bonuses also ignored: corporal (+1 STR), sergeant (+2 STR).`,
    formula: 'leaderStratBonus = (leader.stats.strategy + sumBonuses(leader, \'strategy\')) × 2',
    fix: '✅ FIXED — leaderStratBonus now uses (leader.stats.strategy + sumBonuses(leader, \'strategy\')) * 2. Equipment and qualification strategy bonuses on the leader are now counted toward the team cover bonus.',
  },
  {
    id: 'S03',
    title: 'EXP Acceleration: Repeated Low-Quality Missions Farm Practical EXP Fastest',
    severity: 'medium',
    category: 'strategy',
    summary: 'Practical EXP (from actual combat actions) levels twice as fast as theory EXP. Lower missions with more rounds grant more practical EXP per calendar turn.',
    detail: `theoryLv  = floor(theoryExp / 500)   — from training buildings
practicalLv = floor(practicalExp / 50)  — from combat actions

Practical EXP is gained once per qualifying hit/dodge/scout action.
Longer battles = more practical EXP events.

A Tier-1 mission might have 3 stages × 4–6 enemies × 2–3 rounds = ~36–54 EXP events.
A Tier-6 mission has the same number of events but far more risk.

EXPLOIT: Farm Tier-1 missions repeatedly. Practical weapon EXP maxes out hit rate bonuses:
  +1% per theoryLv, +2% per practicalLv
At practicalLv 10 (500 exp) that's +20% hit rate from XP alone, on top of DEX base.`,
    formula: 'wExpBonus = theoryLv(wExp)×1 + practicalLv(wExp)×2',
  },
  {
    id: 'S04',
    title: 'Heroine Advantage: 3% Recruit Roll with Pre-Levelled Weapons',
    severity: 'info',
    category: 'strategy',
    summary: 'Heroines arrive with 500–1499 theory EXP and 50–149 practical EXP in their weapon and scouting skills — equivalent to 1–2 theory levels already gained.',
    detail: `heroineExpData() generates:
  theoryExp:   Math.floor(Math.random() * 1000) + 500   → 500–1499
  practicalExp: Math.floor(Math.random() * 100) + 50    → 50–149

This means a freshly recruited heroine has theoryLv 1 (+1% hit) and practicalLv 1–2 (+2–4% hit)
compared to a fresh zako recruit at lv 0.

With 3% per recruit, expected recruits to get a heroine ≈ 33.
Heroines also have fixed high-tier tags (3 positive, 2 double-edged, 1 negative + 'lyssa' tag on enemies).

STRATEGY: Keep recruiting until heroines appear. They are permanently superior to zako in EXP gain speed.`,
  },

  // ── MECHANICS ──────────────────────────────────────────────────────────────
  {
    id: 'M02',
    title: 'Spot Phase Randomness Can Gift Enemy Surprise Fire on Good Squads',
    severity: 'medium',
    category: 'mechanic',
    summary: 'The spot phase uses a random Normal multiplier (mean=1, SD=0.25). Even a high-AWR squad has variance in whether they spot first, creating coinflip surprise rounds.',
    detail: `scoutRoll() returns N(mean=1, sd=0.25), clamped [0.25, 2.0].
maidenSpotScore = max(awareness + bonuses + scoutExp) × scoutRoll()
enemySneak = max(DEX × approachIndex × sneakIndex)

The scoutRoll can halve or double effective awareness in extreme cases.
approachIndex starts at 3.0 and decreases 0.3 per round — so scouts have multiple chances.

RESULT: A surprise attack by the enemy fires before any cover is established,
hitting naked maidens at full rate. This one round can cripple a low-CON squad.

BALANCE NOTE: The enemy sneak index grows with their DEX, meaning high-quality enemies at tier 5–6
(statBase 12–14) have DEX ~14 × 3.0 approach × 1.0+ sneakIndex = sneakScore 42+,
while a typical maiden awareness 10 × scoutRoll ~1.0 = ~10. Enemy consistently spots first.`,
    fix: 'Cap enemy sneak advantage or add a pre-mission scouting action that adjusts the approach starting index.',
  },
  {
    id: 'M03',
    title: 'Zero Morale Escape: 50/50 Escape vs Capture Is Unpredictable Punishment',
    severity: 'medium',
    category: 'mechanic',
    summary: 'When a maiden\'s permanent morale hits 0, she rolls 50% escape (leaves battle, gets Coward tag) or 50% capture (Coward + Thrall tags, isCaptured = true).',
    detail: `resolveMoraleEscapes():
  if (Math.random() < 0.5) → escaped: moraleQuitStatus = 'escaped', +Coward tag, morale set to 20 post-mission
  else → captured: isCaptured = true, +Coward + Thrall tags, added to rescue mission

Captured maidens are removed from teams. To get them back, player must complete a rescue mission.
The rescue mission appears in the next refreshMissions() call.

postMissionReset() enforces a morale floor of 20 for non-captured maidens:
  newPermanentBonus = 20 - 50 - charm

A charm-5 maiden gets permanentBonus = −35, meaning she is perpetually fragile (morale = 50+5−35 = 20).

BUG/DESIGN ISSUE: Once a maiden is repeatedly punished (hit many times, permanent morale goes very negative),
the postMissionReset floor of 20 doesn't restore her permanently — the floor is recalculated each reset
as the minimum needed to reach 20, which grows increasingly negative as charm is fixed.`,
    fix: 'Add a recovery mechanic (e.g. Hospital building gradually restores permanent morale bonus over turns). Currently there is no way to rehabilitate a battle-scarred maiden other than never deploying her.',
  },
  {
    id: 'M04',
    title: 'Starvation Penalty Stack: Deploying Without Food Halves Everything',
    severity: 'info',
    category: 'mechanic',
    summary: 'A starved maiden (isStarved = true) fires at 50% hit rate, dodges at 50%, scouts at 50%, and takes cover at 50%. This is applied as a final multiplier after all other modifiers.',
    detail: `All penalties applied as: × 0.5 if isStarved

starvedMultiplier = isMaiden(attacker) && attacker.isStarved ? 0.5 : 1
Applied to: hitRate (attacker), dodge (defender raw halved), spotScore, coverChance

A DEX-15 maiden normally hits at 75% base. Starved: 37.5%.
A DEX-15 maiden has 30% dodge bonus. Starved enemy sees only 15% dodge.

STRATEGY: Never deploy starved maidens if food is available.
EXPLOIT: If enemy encounters are scripted/known, a starved maiden can still provide bulk (HP) without
needing to hit — useful as a meat shield if the player doesn't mind the accuracy loss.`,
    formula: 'starvationMult = 0.5 for hit, dodge, scout, cover',
  },

  // ── ECONOMY ────────────────────────────────────────────────────────────────
  {
    id: 'EC01',
    title: 'Gold-Heavy Focus Gives 3× Money at 0.3× Supplies — Best Early Economy',
    severity: 'high',
    category: 'economy',
    summary: 'The gold_heavy reward focus triples money while only cutting food/wood/metal to 30%. Since early game is gold-gated (recruitment, buildings), this focus should always be targeted first.',
    detail: `buildReward() multipliers for gold_heavy:
  money  = baseMoney × 3
  food   = baseFood × 0.3
  wood   = baseWood × 0.3
  metal  = baseMetal × 0.3

At Easy difficulty (mult=1): baseMoney ≈ 80–120 → gold_heavy ≈ 240–360 gold per mission.
At Normal (mult=2): baseMoney ≈ 160–240 → gold_heavy ≈ 480–720 gold.

Compare balanced (all ×1): 80–120 gold.

ECONOMY LOOP:
1. Target gold_heavy missions until Radio Center Lv 3–4.
2. Buy high-tier weapons from HQ shop.
3. Sell old weapons at 50% price (sellEquipment = price × 0.5).
4. Reinvest in scout/sneak equipment to stay in Rookie-tier safely.`,
    formula: 'gold_heavy: money×3, food×0.3, wood×0.3, metal×0.3',
  },
  {
    id: 'EC02',
    title: 'Sell Price Is Always 50% of Buy Price — No Degradation or Market System',
    severity: 'info',
    category: 'economy',
    summary: 'Equipment sells for exactly floor(price × 0.5) regardless of condition or use. This enables a simple arbitrage loop with the HQ shop.',
    detail: `sellEquipment: sellPrice = Math.floor((item.price ?? 0) * 0.5)

The HQ shop sells items at their listed price. After purchase, the item can be immediately sold for 50%.
This means any HQ item the player doesn't want is still worth 50% of its sticker price in gold.

ARBITRAGE: Buy a Valkyrie War Crown (highest tier, ~price not seen but likely 2000+) and immediately sell.
Net: +price×0.5 gold. If the item pool contains expensive items the player can't use yet, they're free to
liquidate the entire stock.

CONSEQUENCE: The refresh cost (tier² × 50) partially mitigates this at high tiers (5000 gold at tier 10),
but sell-and-refresh is still profitable at tiers 1–5 where refresh costs are low vs item values.`,
    fix: 'Implement sell price degradation, or make item prices visible in the shop so the player can evaluate before purchase.',
  },
  {
    id: 'EC03',
    title: 'Training Reward Gives a Qualification — High Value If Pool Contains Sharpshooter/Iron Will',
    severity: 'medium',
    category: 'economy',
    summary: 'Training-focus missions award a random qualification from QUAL_POOL. Sharpshooter and Iron Will are extremely powerful. Farming training-focus extreme missions is the fastest qualification route.',
    detail: `QUAL_POOL = ['sharpshooter', 'primary_scout', 'sergeant', 'iron_will', 'field_medic', 'corporal', 'basic_rifle_training']
7 items, uniform random selection.

Training focus always gives one qual at any difficulty, plus 70% of base resources.
Balanced focus only gives a qual at Hard+ difficulty.

At extreme difficulty, training-focus baseMoney ≈ 640–960 × 0.7 = 448–672 gold + 1 qual.
The qualification is random, but the 1-in-7 chance of Iron Will (or Sharpshooter) is extremely high value.

EXPLOIT: If the player can reliably complete extreme training missions, they can obtain multiple
Sharpshooter qualifications and stack the hit-rate bonuses across multiple maidens.`,
    formula: 'training reward: resources×0.7 + 1 random qual from pool of 7',
  },

  // ── BALANCE ────────────────────────────────────────────────────────────────
  {
    id: 'B01',
    title: 'No Armor Stat Means Equipment "Depth" Is Just More HP',
    severity: 'high',
    category: 'balance',
    summary: 'All defensive equipment provides flat HP bonuses (constitution-equivalent). There is no mitigation, block, or resistance mechanic. High-CON builds and HP-boosting gear serve identical functions.',
    detail: `computeMaxHp(c) = c.stats.constitution + sumBonuses(c, 'hp')
computeDamage(attacker) = weapon.damage  (no reduction)

A "Tactical Plate Carrier" that gives +8 HP is mechanically equivalent to 4 constitution points.
This means late-game armor upgrades simply delay defeat linearly — no strategic depth.

In a system where burst weapons hit for 6 damage × 5 shots = 30 per round, adding 30 HP
extends survival by exactly 1 round, regardless of how good the armor "looks".

COMPARISON: The hit-rate/DEX system has multiplicative interactions (morale×weapon multiplier×EXP).
The defensive system has none — it's purely additive HP.`,
    fix: 'Introduce a CON-based DR formula: dmg = max(1, baseDmg − floor(CON / X)) or equipment with "armor" bonus that subtracts from incoming damage.',
  },
  {
    id: 'B02',
    title: 'Enemy Quality Is Deterministic on Spawn, Not Adaptive',
    severity: 'medium',
    category: 'balance',
    summary: 'Enemy stats are rolled once per stage initialization using statBase = round(3 + (q−1)×11/9). A quality-10 enemy has statBase 14 ± 2, always. There is no adaptation to player performance.',
    detail: `statBase = Math.round(3 + (q - 1) * (14 - 3) / 9)
  quality 1  → statBase 3   (DEX 3 → 15% hit rate)
  quality 5  → statBase 8   (DEX 8 → 40% hit rate)
  quality 10 → statBase 14  (DEX 14 → 70% hit rate)

With rollStat variance ± 2:
  quality-10 enemy DEX ranges 12–16, hit rate 60–80%.

A player with DEX-20 maiden (95% hit) vs quality-10 enemy (70% hit):
  Maiden attacks first (higher DEX initiative), has 95% chance to hit.
  Enemy hits back at 70%.

The player's DEX advantage is enormous at every tier. Quality-10 enemies are genuinely threatening
only when the surprise fire round bypasses the initiative advantage.`,
    formula: 'statBase = round(3 + (quality−1) × 1.22)',
  },
  {
    id: 'B03',
    title: 'Cover Block Rate Caps at 90%: High-Cover Terrain Approaches Invulnerability',
    severity: 'medium',
    category: 'balance',
    summary: 'calculateCoverBlockRate = 50 + coverLevel × 3, capped at 90%. At coverLevel 13+ (capped to 10 in practice) = 80%. Combined with high DEX cover-chance, maidens behind cover absorb almost nothing.',
    detail: `coverBlockRate = min(90, 50 + coverLevel × 3)
  coverLevel 5  → 65% block
  coverLevel 8  → 74% block
  coverLevel 10 → 80% block (effectively the practical max from terrain)

coverChance (maiden with DEX 15, STR 15, leader strategy 18):
  base = coverLevel×5 + (15−10)×2 + (15−10)×4 + leaderBonus
  At coverLevel 8: 40 + 10 + 20 + 18×2 = 106% → clamped to 95%

So a well-equipped team on medium terrain (coverLevel 8):
  95% chance to be in cover each round
  74% block rate while in cover
  Net: 95% × 74% = 70% of rounds no damage at all from a single enemy shot.

EXPLOIT: Send teams exclusively on high-coverLevel stages. The stage coverBase is random ± 1,
but challenge missions escalate cover per stage (coverBase = 3 + stageIndex×2).
Stage 2 of a challenge mission = coverBase 7 → maiden cover % approaches maximum.`,
    formula: 'blockRate = min(90, 50 + coverLevel×3)',
    fix: 'Cap cover effectiveness dynamically: at high cover levels, attackers should gain flanking or suppression bonuses to counteract. Or add "suppression" as a mechanic that reduces cover chance temporarily.',
  },
  // ── UNIMPLEMENTED ITEM / QUALIFICATION EFFECTS ────────────────────────────
  {
    id: 'U01',
    title: 'Consumables Have No Mechanic — Healing Potion & Field Rations Do Nothing',
    severity: 'high',
    category: 'mechanic',
    summary: 'Both consumable items sit in equipment slots and display descriptions, but no in-combat or between-mission system reads or consumes them.',
    detail: `Items affected:
  • healing_potion  — "Restores 10 HP when used in combat."
    There is no in-combat use action. The item occupies a slot and weight but provides zero benefit.

  • field_rations — "Keeps a maiden in fighting shape between engagements."
    Field rations are not checked anywhere in the post-mission flow (gameStore.ts) or combat engine.
    Food is tracked as a global mbase.food resource; this item is completely disconnected from it.

Both items are craftable/purchasable, which makes them a trap purchase for the player.`,
    fix: 'Implement a post-mission HP restore for healing_potion (e.g. +10 HP per stack, consumed after mission) and either make field_rations contribute to mbase.food on equip/mission, or remove them from the shop.',
  },
  {
    id: 'U03',
    title: 'Qualification Abilities Are Display-Only — None Are Implemented in the Engine',
    severity: 'medium',
    category: 'mechanic',
    summary: 'Five qualifications carry an "ability" field that is shown in the UI but never checked or triggered anywhere in combat.ts or gameStore.ts.',
    detail: `Ability keys defined in qualifications.json but with zero engine implementation:
  • scout_advance   (primary_scout)   — no scout phase modification
  • inspire         (sergeant)        — no team morale or combat effect triggered
  • headshot_trained (sharpshooter)   — no conditional damage / instakill on high-roll hits
  • last_stand      (iron_will)       — no survival-at-1HP mechanic
  • field_heal      (field_medic)     — no between-round or post-combat heal

The Members page renders them as italic flavour text (✦ ability_key) only.
No code path in combat.ts, simulateStage(), fireRound(), or any store action reads the ability field.`,
    fix: `Implement abilities in simulateStage() or fireRound() as special-case checks, e.g.:
  last_stand   — when maiden would reach 0 HP, clamp to 1 HP once per stage if she has this qualification.
  field_heal   — post-stage: restore 5 HP to most-injured maiden on the team.
  inspire      — sergeant gives +3 team morale at stage start.
  headshot_trained — when hit roll exceeds hitRate by 20+%, apply ×1.5 damage.
  scout_advance — +50% to this maiden's spot score in resolveSpot().`,
  },
  {
    id: 'B05',
    title: 'Emergency Recruit Is Strictly Worse: All Stats −2, Same Tag Pool',
    severity: 'low',
    category: 'balance',
    summary: 'Emergency recruits have all stats reduced by 2 (min 1) and carry only civilian gear. They draw from the same tag pool as normal recruits, meaning a bad emergency recruit is genuinely useless.',
    detail: `recruitEmergencyMaiden():
  stats = { STR: max(1, raw−2), DEX: max(1, raw−2), ... }
  equipment = [emergency_clothes, emergency_boots, basic_rifle]
  tags = [...rollZakoRecruitTags(), { id: 'untrained' }]

randomStat() range: not shown in read files, but typical RPG range = roughly 6–14.
After −2 penalty: 4–12.

maxHp = max(1, 7 + 2 × stats.constitution)
An emergency recruit with CON 4 (raw 6) has HP = max(1, 7 + 8) = 15. Borderline.
An emergency recruit with CON 1 (raw 3 → max(1, 1)) has HP = max(1, 7 + 2) = 9.

They are strictly temporary fill-ins. The 'untrained' tag likely has negative bonuses.
No current reason to ever invest in emergency recruits long-term.`,
    fix: 'Emergency recruits could have faster EXP gain (+training rate) or a unique "volunteer" tag with a special bonus to compensate for the stat penalty.',
  },
];

// ── UI Helpers ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICAL',  color: '#fff',    bg: '#b91c1c' },
  high:     { label: 'HIGH',      color: '#fff',    bg: '#c2410c' },
  medium:   { label: 'MEDIUM',    color: '#1c1917',  bg: '#ca8a04' },
  low:      { label: 'LOW',       color: '#fff',    bg: '#4d7c0f' },
  info:     { label: 'INFO',      color: '#fff',    bg: '#1d4ed8' },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  exploit:  { label: 'Exploit',   icon: '🔓' },
  strategy: { label: 'Strategy',  icon: '🧠' },
  mechanic: { label: 'Mechanic',  icon: '⚙️' },
  economy:  { label: 'Economy',   icon: '💰' },
  balance:  { label: 'Balance',   icon: '⚖️' },
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, fontWeight: 700,
      fontSize: 10, padding: '2px 7px', borderRadius: 4, letterSpacing: 1,
    }}>
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category] ?? { label: category, icon: '•' };
  return (
    <span style={{
      background: 'var(--color-surface-raised, #2a2a2a)',
      color: 'var(--color-text-muted)', fontSize: 11,
      padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border)',
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        marginBottom: 10,
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', minWidth: 34, fontFamily: 'monospace' }}>
          {finding.id}
        </span>
        <SeverityBadge severity={finding.severity} />
        <CategoryBadge category={finding.category} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
          {finding.title}
        </span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 18 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Summary always visible */}
      <div style={{ padding: '0 14px 10px 58px', fontSize: 13, color: 'var(--color-text-muted)' }}>
        {finding.summary}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: 14 }}>
          {/* Detail block */}
          <pre style={{
            background: 'var(--color-bg)', padding: 12, borderRadius: 6,
            fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            color: 'var(--color-text)', marginBottom: finding.formula || finding.fix ? 12 : 0,
          }}>
            {finding.detail}
          </pre>

          {finding.formula && (
            <div style={{
              background: '#0f172a', color: '#7dd3fc', padding: '8px 12px',
              borderRadius: 6, fontFamily: 'monospace', fontSize: 12, marginBottom: 8,
            }}>
              📐 <strong>Formula:</strong> {finding.formula}
            </div>
          )}

          {finding.fix && (
            <div style={{
              background: '#14532d22', border: '1px solid #166534',
              color: '#bbf7d0', padding: '8px 12px', borderRadius: 6, fontSize: 12,
            }}>
              🔧 <strong>Suggested Fix:</strong> {finding.fix}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['all', 'exploit', 'strategy', 'mechanic', 'economy', 'balance'] as const;
const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low', 'info'] as const;

export default function DevAnalysis() {
  const [catFilter, setCatFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = FINDINGS.filter(f => {
    if (catFilter !== 'all' && f.category !== catFilter) return false;
    if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return f.title.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q) || f.detail.toLowerCase().includes(q);
    }
    return true;
  });

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of FINDINGS) counts[f.severity]++;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          🔬 Developer Analysis: Balance, Exploits &amp; Strategies
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
          Internal developer reference. Findings derived from a full engine source read (combat.ts, missionGen.ts, recruit.ts, gameStore.ts).
          Not intended for players. Total findings: <strong>{FINDINGS.length}</strong>
        </p>

        {/* Severity summary */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {(Object.entries(counts) as [Severity, number][]).map(([sev, n]) => (
            <span key={sev} style={{
              background: SEVERITY_CONFIG[sev].bg, color: SEVERITY_CONFIG[sev].color,
              padding: '3px 10px', borderRadius: 5, fontSize: 12, fontWeight: 600,
            }}>
              {n} {SEVERITY_CONFIG[sev].label}
            </span>
          ))}
        </div>
      </div>

      {/* Quick Reference Box */}
      <details style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: 14, marginBottom: 20,
      }}>
        <summary style={{ fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          📋 Quick Reference — Key Formulas
        </summary>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['FSI (Tier)', 'Σ mean(STR,DEX,CON,AWR) × HP/maxHP'],
            ['HP', '7 + 2×CON + equipmentBonuses'],
            ['Hit Rate', '(DEX×5 + hitBonuses − dodge) × weaponMult, clamp[5,95]'],
            ['Damage', 'weapon.damage (no mitigation)'],
            ['Personal Morale', '50 + charm + permBonus + tempBonus, clamp[0,100]'],
            ['Team Morale Base', '50 − stddev(allCharm) + leaderCharm'],
            ['Cover Chance', 'coverLv×5 + (DEX−10)×2 + (STR−10)×4 + leaderSTR×2'],
            ['Cover Block', 'min(90, 50 + coverLevel×3)'],
            ['Theory Level', 'floor(theoryExp / 500)'],
            ['Practical Level', 'floor(practicalExp / 50)'],
            ['Hit EXP Bonus', 'theoryLv×1% + practicalLv×2%'],
            ['Sell Price', 'floor(buyPrice × 0.5)'],
            ['Enemy StatBase', 'round(3 + (quality−1) × 1.22)'],
            ['Retreat Safety', 'survivingMaidens > survivingEnemies / 3'],
          ].map(([label, formula]) => (
            <div key={label} style={{
              background: 'var(--color-bg)', borderRadius: 5, padding: '6px 10px', fontSize: 12,
            }}>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 2, fontWeight: 600 }}>{label}</div>
              <div style={{ fontFamily: 'monospace', color: '#7dd3fc' }}>{formula}</div>
            </div>
          ))}
        </div>
      </details>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: '4px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: catFilter === c ? 'var(--color-accent)' : 'var(--color-surface)',
              color: catFilter === c ? '#fff' : 'var(--color-text)',
              fontWeight: catFilter === c ? 700 : 400,
            }}>
              {c === 'all' ? 'All Categories' : (CATEGORY_CONFIG[c]?.icon + ' ' + CATEGORY_CONFIG[c]?.label)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SEVERITIES.map(s => (
            <button key={s} onClick={() => setSevFilter(s)} style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: sevFilter === s
                ? (s === 'all' ? 'var(--color-accent)' : SEVERITY_CONFIG[s as Severity].bg)
                : 'var(--color-surface)',
              color: sevFilter === s ? (s !== 'medium' ? '#fff' : '#1c1917') : 'var(--color-text)',
              fontWeight: sevFilter === s ? 700 : 400,
            }}>
              {s === 'all' ? 'All Severity' : SEVERITY_CONFIG[s as Severity].label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search findings…"
          style={{
            padding: '4px 10px', borderRadius: 5, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, minWidth: 160,
          }}
        />
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        Showing {filtered.length} of {FINDINGS.length} findings
      </div>

      {/* Finding cards */}
      {filtered.map(f => <FindingCard key={f.id} finding={f} />)}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40, fontSize: 14 }}>
          No findings match the current filters.
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        DevAnalysis — Engine version read: combat.ts (1198 lines), missionGen.ts (628 lines), recruit.ts (317 lines), gameStore.ts (516 lines)
      </div>
    </div>
  );
}
