export default function Rules() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>📖 How to Play — Waelfeld: Maegdena</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 24 }}>
        A complete guide to all game systems, building mechanics, and combat formulas. New players should read the overview sections first; veterans can jump straight to the combat reference.
      </p>

      {/* ── GAME OVERVIEW ── */}
      <Section title="🌍 Game Overview">
        <p>
          Waelfeld: Maegdena is a base-management and tactical combat game. You command a company of maidens stationed at <strong>Fort Waelfeld</strong>.
          Your goals are to complete missions, grow your roster, upgrade your base, and keep your maidens alive and well-supplied.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          {[
            ['👥 Members', 'Recruit, equip, and view all maidens in your company. Check stats, tags, skills and morale.'],
            ['🗂 Composition', 'Organise maidens into teams and assign a leader. Team composition directly affects combat morale.'],
            ['⚔️ Missions', 'Deploy a team on a multi-stage mission. Win to earn resources, equipment, and rescued maidens.'],
            ['🏛️ Buildings', 'Upgrade Fort Waelfeld facilities. Buildings are the engine of long-term progression — neglect them and your company will fall behind.'],
            ['🏪 HQ Shop', 'Buy equipment from Headquarters using money. Higher Radio Center level unlocks better gear tiers.'],
            ['💾 Save & Load', 'Export your game to a JSON file and import it at any time. The game auto-saves to your browser after every action.'],
          ].map(([title, desc]) => (
            <div key={String(title)} style={{ padding: '10px 12px', background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 12 }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 4 }}>{title}</div>
              <div style={{ color: 'var(--color-text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── RESOURCES ── */}
      <Section title="📦 Resources">
        <p>Four resources underpin everything — equipping maidens, upgrading buildings, and keeping your team fed on the march.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          {[
            ['💰 Money', 'Used to buy equipment from the HQ Shop and to pay construction/upgrade costs. Earned primarily through The Meridian building\'s performance reviews.'],
            ['🪵 Wood', 'Building material for upgrades. Earned as mission rewards and occasionally from The Meridian.'],
            ['⚙️ Metal', 'Building material and crafting input. Also paid out by The Meridian alongside money.'],
            ['🍖 Food', 'Consumed at mission start — each maiden eats 20 + her Strength score. Running low forces maidens to march starved, halving their combat effectiveness. Replenished by the Farm after every mission.'],
          ].map(([res, desc]) => (
            <div key={String(res)} style={{ padding: '10px 12px', background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 12 }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 4 }}>{res}</div>
              <div style={{ color: 'var(--color-text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
        <Note>Food is the most time-critical resource. A single high-Strength maiden costs up to 40 food per mission. If your Farm can't keep up with deployment frequency, rotate rosters or upgrade early.</Note>
      </Section>

      {/* ── BUILDING SYSTEM ── */}
      <Section title="🏛️ Building System">
        <p>
          Buildings are upgraded in the <strong>Buildings</strong> page using money, wood, and metal. Some must be constructed from scratch (they start at level 0); others are provided at level 1 from day one.
          Upgrading buildings is the single most impactful investment you can make — it compounds across every mission you run.
        </p>
        <Note>Some buildings have <strong>prerequisites</strong> — you must have a specific other building constructed before you can build or upgrade them.</Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>🏕️ Tent Block — Housing <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(starts at Lv 1)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Determines how many maidens your base can house. Fallen maidens free their beds; captured maidens do not until rescued or dismissed.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '8px 0', fontSize: 12 }}>
          {[['Lv 1', '20 beds', '(free)'], ['Lv 2', '40 beds', '200💰 50🪵'], ['Lv 3', '60 beds', '500💰 120🪵']].map(([lv, effect, cost]) => (
            <div key={lv} style={{ padding: '6px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{lv}</div>
              <div style={{ color: 'var(--color-text)' }}>{effect}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{cost}</div>
            </div>
          ))}
        </div>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>🏥 Field Hospital — Medical <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(starts at Lv 1)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Automatically heals all injured maidens after every mission concludes. Higher levels mean faster recovery and less downtime between deployments.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '8px 0', fontSize: 12 }}>
          {[['Lv 1', 'Heal 25% max HP', '(free)'], ['Lv 2', 'Heal 33% max HP', '400💰 80🪵 20⚙️'], ['Lv 3', 'Heal 50% max HP', '900💰 150🪵 60⚙️']].map(([lv, effect, cost]) => (
            <div key={lv} style={{ padding: '6px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{lv}</div>
              <div style={{ color: 'var(--color-text)' }}>{effect}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{cost}</div>
            </div>
          ))}
        </div>
        <Note>Healing is proportional to max HP. A maiden with 40 max HP recovers 20 HP at Lv 3 hospital. Without upgrades, high-HP maidens will frequently deploy at reduced strength.</Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>🌾 Farm — Supply <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(starts at Lv 1)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Produces food after every concluded mission, regardless of outcome. A primary lifeline against starvation penalties.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '8px 0', fontSize: 12 }}>
          {[['Lv 1', '150 food', '(free)'], ['Lv 2', '200 food', '300💰 100🪵'], ['Lv 3', '300 food', '700💰 200🪵'], ['Lv 4', '400 food', '1500💰 400🪵 50⚙️']].map(([lv, effect, cost]) => (
            <div key={lv} style={{ padding: '6px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{lv}</div>
              <div style={{ color: 'var(--color-text)' }}>{effect}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{cost}</div>
            </div>
          ))}
        </div>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>🏭 Factory — Production <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(starts at Lv 1)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Unlocks equipment crafting tiers and is a prerequisite for the Radio Center. Upgrade to access better crafting recipes.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '8px 0', fontSize: 12 }}>
          {[['Lv 1', 'Craft Tier 1 (common)', '(free)'], ['Lv 2', 'Craft Tier 2 (uncommon)', '600💰 100🪵 80⚙️'], ['Lv 3', 'Craft Tier 3 (rare)', '1500💰 200🪵 200⚙️']].map(([lv, effect, cost]) => (
            <div key={lv} style={{ padding: '6px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{lv}</div>
              <div style={{ color: 'var(--color-text)' }}>{effect}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{cost}</div>
            </div>
          ))}
        </div>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>📡 Radio Center — Support <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(starts at Lv 1 · requires Factory)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Controls the tier of equipment available in the HQ Shop. Has <strong>10 upgrade levels</strong> — the most upgradeable building in the base. Each tier unlocks progressively better gear including rare and legendary equipment.</p>
        <FormulaBox label="HQ shop tier" formula="= Radio Center level (1–10)" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 8 }}>
          The Radio Center also provides access to <strong>HQ Logistics Trading</strong>: spend gold to purchase food or wood directly from Headquarters.
        </p>
        <div style={{ margin: '8px 0', padding: '8px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)' }}>
          <strong style={{ color: 'var(--color-accent)' }}>Trade Rate</strong> — 2 💰 = 1 🍖 food &nbsp;|&nbsp; 4 💰 = 1 🪵 wood
        </div>
        <Note>The Radio Center is your most important long-term investment. HQ shop gear at Tier 7+ includes advanced tactical equipment that makes a massive difference in combat outcomes. The trade system is a safety valve — use it to top up food before a large mission or wood before a critical building upgrade.</Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>🏋️ Training Grounds — Research <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(must be built · requires Tent Block)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>After each mission, grants theory EXP in all subjects (Weapon, Scout, Sneak) to every maiden who was <em>not</em> deployed. Maidens on the mission earn practical EXP in combat instead.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '8px 0', fontSize: 12 }}>
          {[['Lv 1', '+10 theory EXP', '300💰 80🪵'], ['Lv 2', '+20 theory EXP', '700💰 140🪵 30⚙️'], ['Lv 3', '+50 theory EXP', '1400💰 240🪵 80⚙️']].map(([lv, effect, cost]) => (
            <div key={lv} style={{ padding: '6px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{lv}</div>
              <div style={{ color: 'var(--color-text)' }}>{effect}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{cost}</div>
            </div>
          ))}
        </div>
        <Note>Theory EXP levels up at 500 EXP per level. Lv 3 Training Grounds fills a theory level every 10 missions. Rotate your roster so all maidens benefit — those always on missions earn practical EXP, while bench maidens gain theory EXP.</Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>🔭 The Meridian — Support <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(must be built · requires Radio Center)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          A formal HQ review post. After each mission, your unit's performance is evaluated and Headquarters pays out <strong>money and metal</strong> based on a complex formula weighing your recent mission history.
        </p>
        <div style={{ margin: '10px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ color: '#c8954a', fontWeight: 'bold', marginBottom: 6 }}>Meridian Payout Factors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--color-text-muted)' }}>
            <div>📊 <strong style={{ color: 'var(--color-text)' }}>Win score</strong> — difficulty-weighted win record across your last 10 missions (Easy ×0.6 / Normal ×1.0 / Hard ×1.5 / Extreme ×2.2, wins only)</div>
            <div>💀 <strong style={{ color: 'var(--color-text)' }}>Kill bonus</strong> — more enemy kills per mission scales the payout multiplicatively</div>
            <div>🫀 <strong style={{ color: 'var(--color-text)' }}>Force Strength</strong> — your current FSI (see Missions) raises the base pay ceiling (up to 500 base)</div>
            <div>✅ <strong style={{ color: 'var(--color-text)' }}>Clean mission bonus</strong> — missions completed with ≤10% losses earn a stacking multiplier (up to ×3.0)</div>
            <div>☠️ <strong style={{ color: 'var(--color-text)' }}>High-casualty penalty</strong> — missions with heavy losses apply an exponential multiplier penalty (floor ×0.05)</div>
          </div>
        </div>
        <Note>The Meridian is your primary source of money and metal. Build it as soon as the Radio Center is up. A clean, consistent win record dramatically increases payouts — losing many maidens per mission will compound into severe income penalties.</Note>
      </Section>

      {/* ── TEAMS & COMPOSITION ── */}
      <Section title="👥 Teams & Composition">
        <p>
          Teams are created and managed in the <strong>Composition</strong> page. Each team has a name, a list of members, and optionally a designated <strong>Leader</strong>.
          Only teams with at least one deployable maiden can start a mission.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Team Leader</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          The leader anchors the team's morale through her <strong>Charm</strong> stat and provides a cover bonus to all teammates through her <strong>Strategy</strong> stat.
          Choose leaders with high Charm for stable morale and high Strategy for better battlefield survivability.
        </p>
        <FormulaBox label="Team morale contribution" formula="Leader Charm added to the team morale base" />
        <FormulaBox label="Cover chance bonus" formula="Leader Strategy × 2% added to each teammate's cover chance" />
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Team Cohesion</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Teams whose members have very different Charm values suffer lower base morale. A balanced, cohesive team outfights a mixed squad even if the raw stats are similar.
        </p>
        <FormulaBox label="Morale penalty" formula="Standard deviation of team Charm values subtracted from base" />
        <Note>A maiden with a Coward tag cannot be deployed — she will show as unavailable in the mission screen. Resolve this by managing her morale through resting missions and equipment.</Note>
      </Section>

      {/* ── MISSIONS OVERVIEW ── */}
      <Section title="⚔️ Mission Overview">
        <p>
          Missions are displayed on the <strong>Missions</strong> page. Each mission has one or more <strong>stages</strong> — your team fights through each stage consecutively, carrying their HP into the next.
          Completing all stages wins the mission and grants rewards.
        </p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Force Strength Index (FSI)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Missions have a difficulty tier. Your company's FSI is used to generate appropriately-scaled enemy forces and affects Meridian payouts.
        </p>
        <FormulaBox label="FSI" formula="Sum of avg(STR, DEX, CON, AWR) × (currentHP / maxHP) per active maiden" />
        <Note>Wounded or fallen maidens drag down your FSI. Keep your roster healthy to see accurate enemy scaling.</Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Captive Maidens & Rescue</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          If a maiden's morale reaches 0 during a mission and she is <strong>captured</strong>, she is removed from all teams and cannot be deployed.
          She will appear in the "Captives" panel on any mission that is flagged as her rescue mission.
          <strong> Completing that mission rescues all captive maidens associated with it</strong> — freeing them, removing the Thrall tag, and granting the Rescued tag.
        </p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Between Stages</h4>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4 }}>
          <li>Maiden HP carries over exactly — there is no inter-stage healing.</li>
          <li>Maidens who were killed, captured, or escaped in a previous stage do <strong>not</strong> participate in subsequent stages.</li>
          <li>The leader for each stage is automatically re-selected as the highest-Strategy surviving maiden if the original leader is gone.</li>
        </ul>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Post-Mission Effects</h4>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4 }}>
          <li>🏥 <strong>Field Hospital</strong> heals all injured maidens by a fraction of their max HP.</li>
          <li>🏋️ <strong>Training Grounds</strong> grants theory EXP to all off-mission maidens.</li>
          <li>🌾 <strong>Farm</strong> produces food (regardless of mission outcome).</li>
          <li>🔭 <strong>The Meridian</strong> pays money and metal based on the performance review.</li>
        </ul>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Mission Speed Controls</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          During battle, use the <strong>speed button</strong> (1× / 2× / 4× / 8×) to accelerate event playback, or <strong>Skip</strong> to instantly resolve all remaining events. Speed is remembered between sessions.
        </p>
      </Section>

      {/* ── HQ SHOP ── */}
      <Section title="🏪 HQ Shop">
        <p>
          The HQ Shop (accessible from the <strong>Members</strong> page equipment panel) offers a rotating stock of equipment available for purchase with <strong>money</strong>.
          The available tier is determined entirely by your Radio Center level — a Tier 1 shop sells basic field gear; a Tier 10 shop offers epic, game-changing items.
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 8 }}>
          The shop stock refreshes after each purchase (or can be manually refreshed for a cost). Equipment bought goes directly into your inventory and can be equipped to any maiden from the Members page.
        </p>
        <Note>Upgrading the Radio Center is the fastest way to power up your team. Even Lv 3–4 unlocks mid-tier gear with meaningful stat bonuses. Aim for Lv 5+ before tackling Hard missions.</Note>
      </Section>

      {/* ── SEPARATOR ── */}
      <div style={{ margin: '28px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        <span style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, whiteSpace: 'nowrap' }}>⚔️ Combat Reference</span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      </div>

      <Section title="⚡ Initiative & Turn Order">
        <p>Within each round, combatants act in order of <strong>Dexterity</strong> (highest first). Ties are broken randomly.</p>
        <FormulaBox label="Action order" formula="Sort by Dexterity DESC → fire in that order" />
      </Section>

      <Section title="🎯 Hit Rate">
        <p>The chance (0–95%) that an attack lands on a target. Calculation is <strong>two-stage</strong>: all additive modifiers are summed first, then the weapon's multiplier is applied on top.</p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Step 1 — Additive Subtotal</h4>
        <FormulaBox
          label="Subtotal"
          formula="(Attacker Dexterity × 5) + Equipment/Qualification bonuses + Weapon EXP bonus − Defender dodge − Sneak dodge + Morale bonus"
        />
        <Note>Equipment bonuses (e.g. Sharpshooter +10%) and all EXP/morale modifiers stack additively here.</Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Step 2 — Weapon Multiplier (applied last)</h4>
        <FormulaBox
          label="Final Hit Rate"
          formula="clamp(5, 95,  Subtotal × (1 + Weapon hitRateBonus / 100))"
        />
        <Note>A weapon with hitRateBonus +20 multiplies the subtotal by 1.20 (+20% boost). A machine gun with −50 multiplies by 0.50 (halves the subtotal). This means the weapon bonus scales with the attacker's skill — the better the shooter, the more she benefits or suffers.</Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Weapon EXP Bonus (attacker)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          A maiden's proficiency with her equipped weapon type (rifle, shotgun, SMG, etc.) adds a flat bonus to the additive subtotal before the weapon multiplier.
        </p>
        <FormulaBox label="Weapon EXP hit bonus" formula="+1% per Weapon Theory Lv  +  +2% per Weapon Practical Lv" />
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Sneak EXP Dodge (defender)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          A defender's Sneak skill reduces the attacker's effective hit rate — she is harder to pin down.
        </p>
        <FormulaBox label="Sneak dodge penalty (vs attacker)" formula="−0.5% per Sneak Theory Lv  −  −1% per Sneak Practical Lv" />
        <Note>These are part of the additive subtotal, so they are also scaled by the weapon multiplier.</Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Morale Modifier (attacker)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Both personal and team morale shift the additive subtotal before the weapon multiplier is applied.</p>
        <FormulaBox label="Personal morale bonus" formula="(Personal Morale − 50) × 0.2% added to subtotal" />
        <FormulaBox label="Team morale bonus" formula="(Team Morale − 50) × 0.1% added to subtotal" />
        <Note>A maiden with 100 personal morale gains +10% to the subtotal; one with 0 morale loses −10%. Team morale adds up to ±5%.</Note>
      </Section>

      <Section title="💛 Morale System">
        <p>Every combatant and team has a morale score (0–100). Low morale reduces accuracy; morale at zero has severe consequences.</p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Team Morale</h4>
        <FormulaBox label="Team Morale Base" formula="clamp(50 − stddev(effective Charm) + Leader effective Charm + temp bonuses, 0, 100)" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>A team with varied charm values is less cohesive. The leader's charm anchors morale upward. All Charm values here are effective (including equipment / qualification / tag bonuses).</p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Team Morale Temp Bonuses (per stage)</h4>
        <FormulaBox label="Outnumber bonus" formula="+2 if outnumbering enemy; −2 if outnumbered" />
        <FormulaBox label="HP ratio bonus" formula="+(avgHP/maxHP − 0.5) × 20 — healthy teams have higher morale" />
        <FormulaBox label="Death ratio penalty" formula="−(fallen / total) × 30 — losses hurt team morale" />
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Personal Morale</h4>
        <FormulaBox label="Personal Morale" formula="clamp(50 + effective Charm + Permanent Bonus + HP Temp Bonus + Hit Shock Penalty, 0, 100)" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}><strong>Effective Charm</strong> = base Charm + equipment bonuses + qualification bonuses + tag bonuses. Permanent Bonus persists across stages and missions. HP Temp Bonus and Hit Shock Penalty are stage-only and reset each stage.</p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Permanent Morale Gains/Losses (carry between missions)</h4>
        <FormulaBox label="Kill" formula="+1 team morale (temporary) / +10 personal morale (permanent)" />
        <FormulaBox label="Stun (Lyssa)" formula="+2 team morale (temporary) / +10 personal morale (permanent)" />
        <Note>Stun morale is only awarded when the Lyssa had more than 1 HP before the shot. Shooting an already-pinned Lyssa at 1 HP grants no morale bonus.</Note>
        <FormulaBox label="Friendly KIA" formula="−2 team morale (temporary)" />
        <FormulaBox label="Taking damage (hit)" formula="−damage personal morale (permanent) — e.g. hit for 8 dmg → −8 permanent morale" />
        <FormulaBox label="Starvation" formula="−3 personal morale (permanent) — applied once at mission start for each maiden who could not be fully fed" />
        <Note>The starvation penalty is permanent and carries over after the mission, compounding over time if food supplies are not maintained.</Note>
        <Note>The permanent morale bonus is <strong>capped at +100</strong>. No matter how many kills or stuns a maiden accumulates, her stored bonus cannot exceed this value.</Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Stage-Only Temporary Modifiers (Personal)</h4>
        <FormulaBox label="HP high bonus" formula="+10 personal morale (temp) when own HP &gt; 70% of max" />
        <FormulaBox label="HP critical penalty" formula="−10 personal morale (temp) when own HP &lt; 30% of max" />
        <FormulaBox label="Hit shock (taking a hit)" formula="−20 personal morale (temporary, per hit, resets next stage)" />
        <Note>Hit shock stacks per hit received this stage — two hits means −40 total. Both hit shock and the permanent damage penalty apply simultaneously. These temporary modifiers apply to maidens and enemies alike.</Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Zero Morale Consequences</h4>
        <Note>When a maiden's personal morale reaches 0: she loses her weapon and either <strong>escapes</strong> (50%) or is <strong>captured</strong> (50%). Either outcome adds the <em>Coward</em> tag permanently.</Note>
        <FormulaBox label="Escaped" formula="Removed from team roster. Morale reset to 20 (permanent bonus adjusted to: 20 − 50 − Charm). Any kill/stun morale earned before fleeing is discarded." />
        <FormulaBox label="Captured" formula="Marked as captured; removed from all teams. Gains Coward + Thrall tags." />
        <Note>A team whose morale drops to 0 forces an immediate retreat.</Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Enemy Morale — Escape</h4>
        <FormulaBox label="Zako (at morale 0)" formula="100% chance to flee the battlefield immediately. Does not get captured." />
        <Note>A fleeing zako counts toward the 70% casualty threshold that triggers a full enemy retreat.</Note>
      </Section>

      <Section title="⚖️ Carry Weight">
        <p>Every combatant has a maximum carry weight determined by their <strong>Strength</strong> score. A maiden or enemy cannot equip items that would push their total carried weight beyond this limit.</p>
        <FormulaBox label="Max Carry Weight (lb)" formula="20 + 5 × Strength" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Example: Strength 10 → 20 + 50 = 70 lb carry capacity.</p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Item Weights (approximate)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {[
            ['Standard Rifle', '9 lb'], ['Marksman Rifle', '12 lb'], ['Shotgun', '8 lb'],
            ['Long Rifle', '11 lb'], ['Combat SMG', '6 lb'], ['Machine Gun', '25 lb'],
            ['Light Machine Gun', '18 lb'], ['Heavy Machine Gun', '30 lb'],
            ['Iron Helmet', '4 lb'], ['Steel Helmet', '6 lb'],
            ['Leather Vest', '6 lb'], ['Reinforced Vest', '10 lb'], ['Void Armor', '20 lb'],
            ['Combat Boots', '3 lb'], ['Shadowveil Cloak', '2 lb'],
            ['Medals / Accessories', '0–1 lb'], ['Consumables', '1–2 lb'],
          ].map(([name, wt]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>{name}</span><span style={{ color: 'var(--color-text)' }}>{wt}</span>
            </div>
          ))}
        </div>
        <Note>Equipping an item that would exceed the carry limit is blocked. The carry weight bar in the equipment panel shows current load vs. capacity — turning orange near 85% and red when at the limit.</Note>
      </Section>

      <Section title="❤️ Hit Points">
        <p>A maiden's maximum HP is calculated at recruit time from her <strong>Constitution</strong> score, and can be further increased by equipment, qualifications, or tags that grant HP or Constitution bonuses.</p>
        <FormulaBox label="Base Max HP" formula="7 + 2 × Constitution" />
        <FormulaBox label="Total Max HP" formula="7 + 2 × Constitution + flat HP bonuses + Constitution bonuses × 2" />
        <Note>Example: Constitution 10 → 7 + 20 = 27 base HP. A Tactical Vest with +4 HP bonus gives 31 total. A qualification granting +2 CON would add another +4 HP. All bonuses from equipment, qualifications, and tags are summed.</Note>
      </Section>

      <Section title="💥 Damage">
        <p>Damage is determined solely by the attacker's equipped weapon. Stats do not scale damage.</p>
        <FormulaBox label="Damage" formula="Weapon damage (flat value)" />
        <Note>Standard Rifle: 8 damage. Marksman Rifle: 12 damage. If no weapon is equipped, damage defaults to 4.</Note>
      </Section>

      <Section title="👁 Spot Phase">
        <p>Before combat begins, both sides attempt to spot each other. An approach index starts at <strong>3.0</strong> and decreases by 0.3 each spotting round.</p>
        <FormulaBox label="Enemy Sneak Index" formula="Enemy Dexterity × Approach Index × Sneak EXP factor" />
        <FormulaBox label="Maiden Scout Score" formula="(Best Maiden Awareness + awareness bonuses + Scout EXP bonus) × Random Factor" />
        <FormulaBox label="Maiden Sneak Index" formula="Maiden Dexterity × Approach Index × Sneak EXP factor" />
        <FormulaBox label="Enemy Scout Score" formula="(Best Enemy Awareness + awareness bonuses + Scout EXP bonus) × Random Factor" />
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 8 }}>
          <li>If Maiden Scout Score &gt; Enemy Sneak Index → <span style={{ color: '#4a8c4a' }}>Maidens spot first</span> (surprise fire advantage)</li>
          <li>If Enemy Scout Score &gt; Maiden Sneak Index → <span style={{ color: '#c84a4a' }}>Enemy spots first</span> (enemy gets surprise fire)</li>
          <li>Both trigger simultaneously → no surprise fire</li>
        </ul>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Scout Random Factor</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Each spotting round, both team scout scores are multiplied by an independent random factor drawn from a normal distribution.
          This means even a well-trained scout team can occasionally fail to detect the enemy, and vice versa.
        </p>
        <FormulaBox label="Random Factor" formula="Normal(mean = 1.0, SD = 0.25)  — clamped to [0.25, 2.0]" />
        <Note>The random factor is applied independently to the maiden team and the enemy team each round. A high-awareness team will spot first <em>most</em> of the time, but the outcome is never guaranteed.</Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Scout EXP Bonus</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          The maiden with the highest Awareness acts as the scout. Her Scout skill adds directly to the base score before the random multiplier is applied.
        </p>
        <FormulaBox label="Scout EXP bonus" formula="+0.5 per Scout Theory Lv  +  +1.0 per Scout Practical Lv" />
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Sneak EXP Bonus</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          The maiden with the highest effective Sneak Index shields the team from being detected. Higher Sneak skill increases that index, making the team harder to spot.
        </p>
        <FormulaBox label="Sneak EXP multiplier" formula="Sneak Index × (1 + Theory Lv × 0.03 + Practical Lv × 0.10)" />
        <Note>Scout EXP is earned by the best-awareness maiden when the team spots first <em>or</em> simultaneously. Sneak EXP is earned by <em>all</em> living maidens when the team sneaks past enemy detection (maiden spots first).</Note>
      </Section>

      <Section title="🔥 Surprise Fire">
        <p>The team that spots first fires a free round before the main encounter begins. The other team cannot fire back during this phase.</p>
      </Section>

      <Section title="⚔️ Encounter Rounds">
        <p>After the spot phase, both sides fight in alternating rounds:</p>
        <ol style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 8 }}>
          <li>Cover checks for all alive combatants (if terrain has cover)</li>
          <li>Maidens fire at enemies (by Dexterity order)</li>
          <li>If all enemies defeated → <span style={{ color: '#4a8c4a' }}>Victory</span></li>
          <li>Enemies fire back at maidens (counter)</li>
          <li>If all maidens defeated → <span style={{ color: '#c84a4a' }}>Defeat / Captured</span></li>
          <li>Check for enemy retreat (70% casualties threshold)</li>
        </ol>
      </Section>

      <Section title="🏳️ Retreat">
        <p>The player can set a retreat round. When that round is reached:</p>
        <ol style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 8 }}>
          <li>Retreating team breaks all cover (they are moving)</li>
          <li>Enemies get a free <em>Retreat Fire</em> round</li>
          <li>If surviving maidens ≤ ⅓ of surviving enemies → <span style={{ color: '#c84a4a' }}>Captured</span></li>
          <li>Otherwise → <span style={{ color: '#c8954a' }}>Retreat Success</span> (mission failed but maidens survive)</li>
        </ol>
      </Section>

      <Section title="🚩 Enemy Retreat">
        <p>Enemies automatically attempt to retreat when they suffer heavy casualties.</p>
        <FormulaBox label="Enemy Retreat Trigger" formula="Dead enemies / Total enemies ≥ 70%" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 4 }}>
          Maidens fire one final <em>Retreat Fire on Enemy</em> round as the enemies flee.
        </p>
      </Section>

      <Section title="🛡 Cover System">
        <p>
          Each mission stage has a <strong>Cover Level</strong> (0–10) representing the terrain's natural cover density.
          Higher cover levels mean easier concealment and stronger protection.
        </p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Gaining Cover</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          At the start of combat (after spotting) and at the beginning of each encounter round, every alive combatant without cover rolls a cover check.
        </p>
        <FormulaBox
          label="Cover Chance %"
          formula="(Cover Level × 5%) + ((Dexterity − 10) × 2%) + ((Strategy − 10) × 4%)"
        />
        <Note>
          Clamped to 0–95%. A combatant with Dex 10 and Strategy 10 on a Level 5 stage has a base 25% cover chance per round.
          High-Strategy commanders excel at finding and using cover.
        </Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Sneak EXP Cover Bonus</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          A maiden's Sneak skill also improves her ability to slip into concealment — she reads the terrain and moves more quietly.
        </p>
        <FormulaBox label="Sneak EXP cover bonus" formula="+1% per Sneak Theory Lv  +  +2% per Sneak Practical Lv" />
        <Note>This bonus stacks additively with the base cover chance formula and the leader's strategy bonus, subject to the 95% cap.</Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Losing Cover</h4>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4 }}>
          <li><strong>Firing:</strong> A combatant <em>always</em> breaks cover when they shoot — you must expose yourself to fire.</li>
          <li><strong>Retreating:</strong> The entire retreating team loses cover when they begin movement.</li>
        </ul>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Cover Block</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          When a combatant with cover is hit, they roll a <em>cover block</em> check. A successful block means the shot is absorbed entirely — no damage is dealt and the defender keeps their cover.
        </p>
        <FormulaBox
          label="Cover Block Rate %"
          formula="50% + (Cover Level × 3%)"
        />
        <Note>Clamped to 0–90%. On a Level 8 fortress stage, cover blocks 74% of incoming hits — making covered defenders extremely resilient.</Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Cover Indicators</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Combatants behind cover are shown with a <span style={{ color: '#4a9eff' }}>blue glowing border</span> and a 🛡 shield icon. Cover events appear in the combat log in blue.
        </p>

        <div style={{ marginTop: 12, padding: 12, background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ color: '#c8954a', fontWeight: 'bold', marginBottom: 8 }}>Stage Cover Levels</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              ['Ashwick Patrol — Forest Edge', 5],
              ['Moorgate Ambush — Muddy Road', 3],
              ['Moorgate Ambush — Raider Camp', 6],
              ['Ironwood Siege — Outer Wall', 4],
              ['Ironwood Siege — Inner Courtyard', 7],
              ["Ironwood Siege — Commander's Post", 5],
              ['Black Ridge — Fortress Breach', 8],
              ['Crimson Vale — Killing Ground', 2],
            ].map(([name, level]) => (
              <div key={String(name)} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{name}</span>
                <span style={{ color: coverColor(Number(level)), fontWeight: 'bold' }}>{level}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <Section title="👑 Team Leader">
        <p>
          Each team can designate one member as its <strong>Team Leader</strong>. The leader is shown with a gold crown 👑 highlight in the Composition page.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Strategic Sense (Cover Bonus)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          When the combat stage has a Cover Level greater than 0, the leader's <strong>Strategy</strong> stat grants a flat cover chance bonus to <em>all</em> teammates (additive, not multiplicative).
        </p>
        <FormulaBox
          label="Leader Cover Bonus"
          formula="Leader Strategy × 2% added to each maiden's cover chance"
        />
        <Note>
          This bonus stacks directly on top of each maiden's individual cover chance. A leader with Strategy 8 grants +16% cover chance to every teammate.
          The bonus is shown in the combat log's cover check header.
        </Note>
        <FormulaBox
          label="Effective Cover Chance (with leader)"
          formula="(Cover Level × 5%) + ((Dex − 10) × 2%) + ((Strategy − 10) × 4%) + (Leader Strategy × 2%)"
        />
        <Note>Still clamped to 0–95% per combatant.</Note>
      </Section>
      <Section title="� EXP & Skills">
        <p>
          Every maiden has two parallel EXP tracks for each of three subjects: <strong>Weapons</strong> (per weapon type), <strong>Scout</strong>, and <strong>Sneak</strong>.
          Higher levels in each subject provide direct, stackable bonuses to related combat calculations.
        </p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Theory EXP</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Awarded by the <strong>Training Grounds</strong> building after each mission concludes, to all maidens who were <em>not</em> on that mission.
          Levels up every <strong>500 EXP</strong>.
        </p>
        <FormulaBox label="Theory Level" formula="floor(theoryExp / 500)" />

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Practical EXP</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Earned during combat by performing the skill. Levels up every <strong>50 EXP</strong> (10× faster than theory).
        </p>
        <FormulaBox label="Practical Level" formula="floor(practicalExp / 50)" />
        <div style={{ margin: '10px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ color: '#c8954a', fontWeight: 'bold', marginBottom: 6 }}>How Practical EXP is earned (+1 per event)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', color: 'var(--color-text-muted)' }}>
            <span>⚔️ Land a hit on an enemy</span><span style={{ color: '#e8d8a0' }}>+1 Weapon Practical EXP</span>
            <span>🌀 Dodge an incoming attack</span><span style={{ color: '#e8d8a0' }}>+1 Sneak Practical EXP</span>
            <span>👁 Successfully spot the enemy first</span><span style={{ color: '#e8d8a0' }}>+1 Scout Practical EXP</span>
            <span>🌑 Keep team concealed from enemy</span><span style={{ color: '#e8d8a0' }}>+1 Sneak Practical EXP</span>
          </div>
        </div>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Weapon Type Buckets</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Weapon EXP is shared across all weapons of the same type. Switching between two rifles costs no proficiency — but switching from a rifle to an SMG starts a new bucket from zero.
        </p>
        <div style={{ margin: '8px 0', padding: '8px 12px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)' }}>
          Weapon types: <span style={{ color: '#e8d8a0' }}>Rifle · Shotgun · Machine Gun · SMG · Sniper Rifle · Pistol</span>
        </div>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Bonus Summary</h4>
        <div style={{ margin: '8px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '5px 16px', alignItems: 'center' }}>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Subject</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Theory Lv bonus</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Practical Lv bonus</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Weapon (equipped type)</span>
            <span style={{ color: '#e8d8a0' }}>+1% Hit Rate per Lv</span>
            <span style={{ color: '#6ab06a' }}>+2% Hit Rate per Lv</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Scout</span>
            <span style={{ color: '#e8d8a0' }}>+0.5 Scout Score per Lv</span>
            <span style={{ color: '#6ab06a' }}>+1.0 Scout Score per Lv</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Sneak (hit dodge)</span>
            <span style={{ color: '#e8d8a0' }}>−0.5% enemy Hit Rate per Lv</span>
            <span style={{ color: '#6ab06a' }}>−1% enemy Hit Rate per Lv</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Sneak (cover gain)</span>
            <span style={{ color: '#e8d8a0' }}>+1% Cover Chance per Lv</span>
            <span style={{ color: '#6ab06a' }}>+2% Cover Chance per Lv</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Sneak (concealment)</span>
            <span style={{ color: '#e8d8a0' }}>×1.03 Sneak Index per Lv</span>
            <span style={{ color: '#6ab06a' }}>×1.10 Sneak Index per Lv</span>
          </div>
        </div>
        <Note>All bonuses stack. A maiden at Weapon Theory Lv 3 and Practical Lv 5 gains +3% + 10% = +13% to her hit rate from EXP alone.</Note>
      </Section>

      <Section title="�📋 Recruitment Rates">
        <p>Each time you roll candidates, <strong>3 independent draws</strong> are made. Each draw follows the same probability table:</p>
        <div style={{ margin: '12px 0', padding: 12, background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4px 16px', alignItems: 'center' }}>
            <span style={{ color: '#ffd700', fontWeight: 'bold' }}>★ Heroine</span>
            <div style={{ background: 'var(--color-surface)', borderRadius: 3, height: 8, overflow: 'hidden' }}>
              <div style={{ width: '3%', height: '100%', background: '#ffd700' }} />
            </div>
            <span style={{ color: '#ffd700', fontWeight: 'bold' }}>3%</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Zako</span>
            <div style={{ background: 'var(--color-surface)', borderRadius: 3, height: 8, overflow: 'hidden' }}>
              <div style={{ width: '97%', height: '100%', background: 'var(--color-accent-dark)' }} />
            </div>
            <span style={{ color: 'var(--color-text-muted)' }}>97%</span>
          </div>
        </div>
        <Note>
          A Heroine draw only produces a heroine if at least one recruitable heroine is not yet in your party.
          If none are available, the draw falls back to a normal Zako maiden.
        </Note>
        <FormulaBox label="At least 1 Heroine in 3 draws" formula="1 − 0.97³ ≈ 8.7% per roll session" />
      </Section>
      <Section title="🏷️ Tag System">
        <p>
          Every maiden carries <strong>tags</strong> that reflect her personality, background and skills.
          Tags grant stat bonuses or penalties and are assigned automatically at recruitment.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Tag Categories</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: '#4caf50', minWidth: 90, fontWeight: 'bold' }}>🟢 Positive</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Pure stat bonuses. e.g. <em>marksman</em> (+Hit Rate), <em>tough</em> (+CON), <em>alert</em> (+Awareness)</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: '#ff9800', minWidth: 90, fontWeight: 'bold' }}>⚡ Double-edged</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>A bonus AND a penalty. e.g. <em>angry</em> (STR +2, Hit Rate −5%), <em>impulsive</em> (STR +2, Strategy −1), <em>reckless</em> (DEX +1, HP −2)</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: '#f44336', minWidth: 90, fontWeight: 'bold' }}>🔴 Negative</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Pure stat penalties. e.g. <em>timid</em> (Hit Rate −5%), <em>frail</em> (HP −2), <em>stubborn</em> (Strategy −1)</span>
          </div>
        </div>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Starting Tag Composition at Recruitment</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '10px 0' }}>
          <div style={{ padding: '10px 12px', background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Zako maiden</div>
            <div>🟢 Positive ×2</div>
            <div>⚡ Double-edged ×1</div>
            <div>🔴 Negative ×1</div>
          </div>
          <div style={{ padding: '10px 12px', background: '#0e0d0b', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#ffd700' }}>★ Heroine</div>
            <div>🟢 Positive ×3</div>
            <div>⚡ Double-edged ×2</div>
            <div>🔴 Negative ×1</div>
          </div>
        </div>
        <Note>Tags assigned at recruitment are drawn from <em>personality</em>, <em>skill</em> and <em>background</em> pools (isRecruit tags). The heroine tag is always added on top. Combat events can later add <em>Coward</em>, <em>Thrall</em>, or <em>Rescued</em> tags.</Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Enemy Tags</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Enemies also receive tags from enemy-specific pools at mission start. Zako enemies follow the same 2+1+1 pattern; Lyssa follows the 3+2+1 pattern. These include tags like <em>berserk</em> (STR +3, Hit Rate −15%) or <em>sloppy</em> (Hit Rate −8%).</p>
      </Section>
      <Section title="⚰️ Fallen Maidens">
        <p>A maiden whose HP reaches 0 in battle is permanently marked as <strong>Fallen (KIA)</strong>.</p>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4 }}>
          <li>Fallen maidens are removed from all team rosters automatically.</li>
          <li>They appear in the <em>Memorial</em> section of the Members page in grayscale.</li>
          <li>Their final HP (0) is recorded permanently.</li>
          <li><strong>Fallen maidens do not occupy a bed.</strong> Their loss immediately frees up a bed slot.</li>
        </ul>
        <Note>Captured maidens (⛓️) are still alive and <strong>continue to occupy a bed</strong> even though they cannot be deployed. Rescuing or dismissing a captured maiden is the only way to free her bed.</Note>
      </Section>

      <Section title="🍖 Food & Starvation">
        <p>
          Each deployed maiden consumes <strong>(20 + her Strength score)</strong> food rations at the start of a mission.
          Stronger maidens eat more — they carry more gear and exert more on the march.
        </p>
        <FormulaBox label="Food cost per maiden" formula="20 + Strength" />
        <p style={{ marginTop: 12 }}>
          Food is distributed in team order. If the base's food supply runs out before all maidens are fed,
          the remaining maidens receive nothing and march on an empty stomach.
        </p>
        <h4 style={{ color: 'var(--color-danger)', marginTop: 16, marginBottom: 8 }}>🥀 Starved Status</h4>
        <p>
          A maiden who could not be fully fed gains the <strong>Starved</strong> status for the entire mission.
          Hunger impairs every aspect of her combat performance:
        </p>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4, marginBottom: 10 }}>
          <li><strong>Current HP:</strong> halved at mission start (minimum 1).</li>
          <li><strong>Permanent Morale:</strong> −3 applied once at mission start — carries over after the mission.</li>
          <li><strong>Hit Rate:</strong> ×0.5 — her aim shakes from weakness.</li>
          <li><strong>Dodge:</strong> ×0.5 — she is too sluggish to evade incoming fire.</li>
          <li><strong>Scout Score:</strong> ×0.5 — exhaustion dulls her senses.</li>
          <li><strong>Cover Chance:</strong> ×0.5 — she struggles to move and position quickly.</li>
        </ul>
        <Note>
          All four penalties are multiplicative and applied <em>after</em> all other bonuses and modifiers —
          including equipment, qualifications, EXP, and morale. No matter how skilled a maiden is,
          starvation halves her effective battlefield capability.
        </Note>
        <p style={{ color: '#e88', fontSize: 13, marginTop: 10 }}>
          The mission panel warns you before launch which maidens will go starved based on current food reserves.
          Keep your supply stocked — especially before deploying high-Strength maidens.
        </p>
      </Section>

      <Section title="⚡ Lyssa — Undying Foe">
        <p>
          <strong>Lyssa</strong> is a special enemy type that <strong>cannot be killed</strong>.
          She will never drop below <strong>1 HP</strong>, no matter how much damage she takes.
        </p>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4, marginBottom: 12 }}>
          <li>
            Whenever an attack would reduce Lyssa to <strong>0 HP</strong>, her HP is pinned to <strong>1 HP</strong> instead and she becomes <strong>Stunned</strong>.
          </li>
          <li>
            A <strong>Stunned</strong> Lyssa <strong>cannot attack</strong> on her next attack turn. The stun is removed after she loses that turn.
          </li>
          <li>
            If Lyssa is hit again while she is <strong>already at 1 HP</strong> (whether stunned or not), she becomes <strong>Stunned again</strong>.
          </li>
          <li>
            A stunned Lyssa is marked with a <span style={{ fontSize: 14 }}>💫</span> icon on her portrait during battle.
          </li>
        </ul>
        <Note>
          Lyssa can be permanently incapacitated only by keeping her stunned continuously — each time stun clears,
          your team must immediately strike her again before she can act.
        </Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Lyssa Morale — Escape or Rally</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Before each of Lyssa's attack turns, she makes a morale check:
        </p>
        <FormulaBox label="25% — Flee" formula="Lyssa panics and escapes the battlefield permanently. Counts toward the 70% retreat threshold." />
        <FormulaBox label="75% — Rally" formula="Lyssa steels herself: +50 + Charm personal morale (capped at 100). She then fires normally." />
        <Note>Rally morale is shown in the Morale Log per individual Lyssa. Multiple Lyssas make their checks independently each round.</Note>
      </Section>
    </div>
  );
}

function coverColor(level: number): string {
  if (level <= 2) return '#c84a4a';
  if (level <= 4) return '#c8954a';
  if (level <= 6) return '#c8c04a';
  if (level <= 8) return '#4a8c4a';
  return '#4a9eff';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 28, padding: 20,
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 8,
    }}>
      <h3 style={{ marginTop: 0, marginBottom: 12, color: 'var(--color-accent)', fontSize: 15 }}>{title}</h3>
      <div style={{ color: 'var(--color-text)', fontSize: 13, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function FormulaBox({ label, formula }: { label: string; formula: string }) {
  return (
    <div style={{ margin: '10px 0', padding: '8px 12px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}: </span>
      <span style={{ color: '#e8d8a0', fontFamily: 'monospace', fontSize: 12 }}>{formula}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(200,149,74,0.08)', borderLeft: '3px solid var(--color-accent-dark)', borderRadius: '0 4px 4px 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
      ℹ️ {children}
    </div>
  );
}
