import React from 'react';

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
          {[['Lv 1', '30 beds', '(free)'], ['Lv 2', '50 beds', '200💰 50🪵'], ['Lv 3', '70 beds', '500💰 120🪵']].map(([lv, effect, cost]) => (
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, margin: '8px 0', fontSize: 12 }}>
          {[['Lv 1', '200 food', '(free)'], ['Lv 2', '300 food', '300💰 100🪵'], ['Lv 3', '400 food', '700💰 200🪵'], ['Lv 4', '500 food', '1500💰 400🪵 50⚙️'], ['Lv 5', '600 food', '2800💰 600🪵 100⚙️'], ['Lv 6', '700 food', '5000💰 900🪵 200⚙️']].map(([lv, effect, cost]) => (
            <div key={lv} style={{ padding: '6px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{lv}</div>
              <div style={{ color: 'var(--color-text)' }}>{effect}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{cost}</div>
            </div>
          ))}
        </div>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>🏭 Factory — Production <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(starts at Lv 1)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Unlocks equipment crafting tiers and is a prerequisite for the Radio Center. Upgrade to access better crafting recipes. After every mission the factory also runs an automatic pipeline — producing a batch of consumables that scales with level: <strong>Lv 1</strong> outputs Healing Potions, Field Rations &amp; Frag Grenades; <strong>Lv 2–3</strong> upgrades to Field Potions, Improved Rations &amp; Concussion Grenades; <strong>Lv 4–5</strong> delivers Advanced Potions, High-Grade Rations &amp; Incendiary Grenades.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, margin: '8px 0', fontSize: 12 }}>
          {[['Lv 1', 'Craft Tier 1 (common)', '(free)'], ['Lv 2', 'Craft Tier 2 (uncommon)', '600💰 100🪵 80⚙️'], ['Lv 3', 'Craft Tier 3 (rare)', '1500💰 200🪵 200⚙️'], ['Lv 4', 'Craft Tier 4 (advanced)', '3000💰 350🪵 350⚙️'], ['Lv 5', 'Craft Tier 5 (elite)', '5500💰 500🪵 600⚙️']].map(([lv, effect, cost]) => (
            <div key={lv} style={{ padding: '6px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{lv}</div>
              <div style={{ color: 'var(--color-text)' }}>{effect}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{cost}</div>
            </div>
          ))}
        </div>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>📡 Radio Center — Support <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(starts at Lv 1 · requires Factory)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Controls what rarity of equipment is available in the HQ Shop, and how many items appear each refresh. Has <strong>10 upgrade levels</strong>. Every 2 levels a new rarity tier unlocks; the shop also grows in size at Lv 4, 6 and 8. Higher-rarity items are weighted more likely to appear — outdated common gear fades out as the shop levels up.</p>
        <div style={{ margin: '8px 0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Radio Lv', 'Max Rarity', 'Rarity Name', 'Shop Size', 'Suitable vs'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { lv: '1–2', rv: 1, name: 'Common',    color: '#aaaaaa', shop: '1W + 2 items', vs: 'Q1–Q2 enemies' },
                { lv: '3',   rv: 2, name: 'Uncommon',  color: '#5aac44', shop: '1W + 2 items', vs: 'Q3–Q5 enemies' },
                { lv: '4–5', rv: 2, name: 'Uncommon',  color: '#5aac44', shop: '2W + 3 items', vs: 'Q3–Q5 enemies' },
                { lv: '5–6', rv: 3, name: 'Rare',      color: '#4a90d9', shop: '2–3W + 3–4 items', vs: 'Q5–Q7 enemies' },
                { lv: '6–7', rv: 3, name: 'Rare',      color: '#4a90d9', shop: '3W + 4 items', vs: 'Q5–Q7 enemies' },
                { lv: '7–8', rv: 4, name: 'Very Rare', color: '#c84ad9', shop: '3–4W + 4–5 items', vs: 'Q7–Q9 enemies' },
                { lv: '9–10', rv: 5, name: 'Legendary', color: '#e8a840', shop: '4W + 5 items', vs: 'Q9–Q10 enemies' },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '4px 8px', color: 'var(--color-text)' }}>{row.lv}</td>
                  <td style={{ padding: '4px 8px', color: row.color, fontWeight: 'bold' }}>{row.rv}</td>
                  <td style={{ padding: '4px 8px', color: row.color }}>{row.name}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--color-text)' }}>{row.shop}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--color-text-muted)' }}>{row.vs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 8 }}>
          The Radio Center also provides access to <strong>HQ Logistics Trading</strong>: spend gold to purchase food or wood directly from Headquarters.
        </p>
        <div style={{ margin: '8px 0', padding: '8px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)' }}>
          <strong style={{ color: 'var(--color-accent)' }}>Trade Rate</strong> — 2 💰 = 1 🍖 food &nbsp;|&nbsp; 4 💰 = 1 🪵 wood
        </div>
        <Note>The Radio Center is your most important long-term investment. HQ shop gear at Lv 7+ (Very Rare) makes a massive difference in combat outcomes. Match your gear rarity to the enemies you face — using Rare (3) items against Q7+ enemies is a losing battle.</Note>

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
            <div>📊 <strong style={{ color: 'var(--color-text)' }}>Win score</strong> — difficulty-weighted win record across your last 10 missions (Easy ×1 / Normal ×2 / Hard ×10 / Extreme ×40 / <strong style={{ color: '#ff6666' }}>Hell ×100</strong>, wins only)</div>
            <div>💀 <strong style={{ color: 'var(--color-text)' }}>Kill bonus</strong> — +1% per kill across your last 10 missions, capped at +300% (×4.0 multiplier at 300 kills)</div>
            <div>🫀 <strong style={{ color: 'var(--color-text)' }}>Force Strength</strong> — your current FSI raises the base pay (uncapped; scales as 70 × tier × (1 + FSI/100); difficulty score uses a −20 baseline)</div>
            <div>✅ <strong style={{ color: 'var(--color-text)' }}>Clean mission bonus</strong> — missions completed with ≤10% losses earn a stacking multiplier (up to ×3.0)</div>
            <div>☠️ <strong style={{ color: 'var(--color-text)' }}>High-casualty penalty</strong> — missions where over 40% of deployed maidens are lost apply an exponential stacking penalty (floor ×0.2 per mission; overall minimum payout ×0.2)</div>
          </div>
        </div>
        <Note>The Meridian is your primary source of money and metal. Build it as soon as the Radio Center is up. A clean, consistent win record dramatically increases payouts — losing many maidens per mission will compound into severe income penalties.</Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>🌸 Rosarium Vocis — Recruitment <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(must be built · requires Tent Block)</span></h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          The Rosarium Vocis is a sacred recruitment hall. After each <strong>victorious</strong> mission, it rolls a chance to award a free recruit token.
          Tokens are spent first during auto-recruit — you pay 0 gold while tokens remain.
          Higher levels raise the trigger chance, lower the per-recruit gold cost, and dress arriving volunteers in better gear.
          Heroines always receive gear one rarity tier higher than normal volunteers.
        </p>
        <div style={{ overflowX: 'auto', marginBottom: 8 }}>
          <table style={{ fontSize: 11, color: 'var(--color-text-muted)', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Level', 'Victory Trigger', 'Recruit Cost', 'Gear (Zako)', 'Gear (Heroine)'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'bold', color: 'var(--color-text)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { lv: 1, chance: '20%', cost: 150, zako: 'Standard (R1)',    hero: 'Uncommon (R2)' },
                { lv: 2, chance: '40%', cost: 250, zako: 'Uncommon (R2)',    hero: 'Rare (R3)' },
                { lv: 3, chance: '60%', cost: 400, zako: 'Rare (R3)',        hero: 'Very Rare (R4)' },
                { lv: 4, chance: '80%', cost: 700, zako: 'Very Rare (R4)',   hero: 'Legendary (R5)' },
              ].map(row => (
                <tr key={row.lv} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '3px 8px', color: 'var(--color-accent)', fontWeight: 'bold' }}>Lv {row.lv}</td>
                  <td style={{ padding: '3px 8px' }}>{row.chance}</td>
                  <td style={{ padding: '3px 8px' }}>{row.cost} Gold</td>
                  <td style={{ padding: '3px 8px' }}>{row.zako}</td>
                  <td style={{ padding: '3px 8px' }}>{row.hero}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── LYSSA WAVES ── */}
      <Section title="🚨 Lyssa Waves">
        <p>
          Every <strong>N missions</strong> (where N scales with your FSI Tier), a special mandatory event triggers: a <strong>Lyssa Wave</strong>.
          The entire normal mission pool is replaced by a single base-defence mission. You cannot skip it or choose something else — deploy and fight.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Lore</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          A massive enemy war party, personally led by one or more Lyssa officers, launches a direct assault on Fort Waelfeld.
          The stage takes place at the base perimeter with enemy numbers at <strong>twice the normal count</strong>.
          Every unit available must stand and repel the assault.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Wave Configuration by FSI Tier</h4>
        <div style={{ overflowX: 'auto', marginBottom: 8 }}>
          <table style={{ fontSize: 11, color: 'var(--color-text-muted)', borderCollapse: 'collapse', minWidth: 420 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['FSI Tier', 'N (missions between waves)', 'Difficulty', 'Lyssa Count'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 'bold', color: 'var(--color-text)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { tier: 'Tier 1 (Rookie)',   n: 20, diff: 'Normal',  lyssas: 1 },
                { tier: 'Tier 2 (Trained)',  n: 15, diff: 'Normal',  lyssas: 1 },
                { tier: 'Tier 3 (Seasoned)', n: 10, diff: 'Hard',    lyssas: 2 },
                { tier: 'Tier 4 (Veteran)',  n: 10, diff: 'Extreme', lyssas: 3 },
                { tier: 'Tier 5 (Elite)',    n:  7, diff: 'Extreme', lyssas: 4 },
                { tier: 'Tier 6 (Legend)',   n:  5, diff: 'Hell',    lyssas: 5 },
              ].map(row => (
                <tr key={row.tier} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '3px 8px', color: 'var(--color-accent)' }}>{row.tier}</td>
                  <td style={{ padding: '3px 8px' }}>{row.n}</td>
                  <td style={{ padding: '3px 8px', color: row.diff === 'Hell' ? '#ff4444' : row.diff === 'Extreme' ? '#b84040' : row.diff === 'Hard' ? '#c84a4a' : '#c8954a' }}>{row.diff}</td>
                  <td style={{ padding: '3px 8px' }}>{row.lyssas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4 style={{ color: '#ff4444', marginTop: 16, marginBottom: 8 }}>Hell Difficulty</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Hell is a new difficulty exclusive to Tier 6 Lyssa Waves, harder than Extreme.
          It fields <strong>5 Lyssa officers</strong> plus a fully doubled zako force at maximum quality (Q10).
          Winning a Hell-tier wave scores <strong>×100</strong> in The Meridian's win score calculation.
        </p>
        <h4 style={{ color: '#ff4444', marginTop: 12, marginBottom: 8 }}>Defeat Consequences</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          If the wave is defeated or aborted, enemy forces sack the base:
          <strong style={{ color: '#ff6666' }}> 25–75% of all gold, food, wood, and metal</strong> is lost immediately.
          The wave timer <strong>resets</strong> — regardless of the outcome, the countdown restarts and a new wave arrives after N missions.
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          When the deployed maidens fail to stop the incoming Lyssas, those who stayed behind in the base are caught in the chaos.
          Each of them faces a desperate escape attempt: a <strong style={{ color: '#ff6666' }}>50% chance of being captured</strong> by the Lyssa forces,
          and a <strong style={{ color: '#c8954a' }}>50% chance of barely slipping away</strong> — fleeing into the wilderness, surviving on instinct alone,
          and eventually finding their way back to the base to fight again. Some reunite swiftly; others take longer to return.
          Plan accordingly — a failed wave can hollow out your entire roster in one blow.
        </p>
        <Note>Prepare for waves by stockpiling consumables via the factory pipeline and running a weapon-gear mission just before N runs out. The wave counter decrements by 1 for each concluded mission (win or lose). Both winning and losing reset the wave countdown.</Note>
      </Section>
      <Section title="👥 Teams & Composition">
        <p>
          Teams are created and managed in the <strong>Composition</strong> page. Each team has a name, an optional list of members, and optionally a designated <strong>Leader</strong>.
          Teams may be created empty and populated later. Only teams with at least one deployable maiden can start a mission.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Team Leader</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          The leader anchors the team's morale through her <strong>Charm</strong> stat and provides a cover bonus to all teammates through her <strong>Strategy</strong> stat.
          Choose leaders with high Charm for stable morale and high Strategy for better battlefield survivability.
          If no leader is manually chosen when creating a team, one is auto-assigned: the highest-Charm <em>heroine</em> in the roster takes priority; if no heroines are present, the highest-Charm maiden is chosen instead.
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
          FSI also shifts the <strong>mission type distribution</strong> — harder mission types (Medal, Strike Force) appear more frequently at higher tiers.
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
          <li>If the leader is killed during a stage, a new leader is automatically chosen from the survivors before the next stage begins — <strong>heroines take priority</strong>, then the maiden with the highest <strong>Charm</strong>.</li>
        </ul>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Post-Mission Effects</h4>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4 }}>
          <li>🏥 <strong>Field Hospital</strong> heals all injured maidens by a fraction of their max HP.</li>
          <li>🏋️ <strong>Training Grounds</strong> grants theory EXP to all off-mission maidens.</li>
          <li>🌾 <strong>Farm</strong> produces food (regardless of mission outcome).</li>
          <li>🔭 <strong>The Meridian</strong> pays money and metal based on the performance review.</li>
          <li>🌸 <strong>Rosarium Vocis</strong> — on <em>victory</em> only, rolls a chance to award a free recruit token. Tokens are used before paying gold during auto-recruit.</li>
        </ul>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 12, marginBottom: 8 }}>Mission Speed Controls</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          During battle, use the <strong>speed button</strong> (1× / 2× / 4× / 8×) to accelerate event playback, or <strong>Skip</strong> to instantly resolve all remaining events. Speed is remembered between sessions.
        </p>
      </Section>

      {/* ── MISSION TYPES ── */}
      <Section title="🎯 Mission Types">
        <p>
          Every generated mission has a <strong>reward focus</strong> — a coloured tag shown in the mission list. Hover over any tag in the Missions page for a quick summary.
          Mission types are drawn from a <strong>tier-weighted pool</strong> — at low FSI tiers, Gold-Heavy and Supply Run dominate; at high tiers, Medal and Strike Force appear far more often.
        </p>
        <div style={{ overflowX: 'auto', marginBottom: 8 }}>
          <table style={{ fontSize: 11, color: 'var(--color-text-muted)', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['FSI Tier','💰 Gold','🍖 Supply','🏅 Medal','⚔️ Gear','💊 Cons.','⚖️ Balanced','🛡️ Strike'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', color: 'var(--color-text)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Tier 1–2', vals: [3,3,1,2,2,2,1] },
                { label: 'Tier 3–4', vals: [2,2,1,2,2,1,1] },
                { label: 'Tier 5–6', vals: [2,1,2,1,1,3,3] },
              ].map(row => (
                <tr key={row.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '3px 8px', fontWeight: 'bold', color: 'var(--color-accent)' }}>{row.label}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} style={{ padding: '3px 8px', textAlign: 'center' }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          {([
            { icon: '💰', label: 'Gold-heavy',   color: '#c8a84b',
              title: 'Attack enemy gold reserves or mine',
              desc: 'Payout: 3× money, 0.5× food/wood/metal. Best raw-cash income per mission.' },
            { icon: '🍖', label: 'Supply Run',   color: '#6ab06a',
              title: 'Strike enemy supply lines or storage',
              desc: 'Payout: 2× money, 2× food, 2× wood, 2× metal. Best for stocking up on all resources at once.' },
            { icon: '🏅', label: 'Medal',        color: '#d4a84b',
              title: 'Capture a critical HQ-designated strategic point',
              desc: '⚠️ Harder: enemies gain +2 quality, +1 extra stage, and the final stage spawns an extra Lyssa. Payout: 0.3× resources + prestige medal (Charm/Strategy/Awareness bonuses).' },
            { icon: '⚔️', label: 'Weapon/Gear', color: '#8ab0c8',
              title: 'Raid enemy arms caches',
              desc: 'Payout: 0.5× resources + 1–4 non-consumable equipment items. Difficulty determines tier: Hard/Extreme may yield rare weapons and armour.' },
            { icon: '💊', label: 'Consumable',  color: '#80c8a0',
              title: 'Hit enemy supply depots for consumables',
              desc: 'Payout: 1× resources + 2–8 consumable items (rations, potions, grenades). Quantity and tier scale with difficulty.' },
            { icon: '⚖️', label: 'Balanced',    color: '#888888',
              title: 'Wipe out a normal enemy force',
              desc: 'Payout: 1× money, 1× food, 1× wood, 1× metal. No equipment. Reliable, straightforward operation.' },
            { icon: '🛡️', label: 'Strike Force',color: '#c87040',
              title: 'Counter an enemy invasion advancing on HQ',
              desc: '⚠️ Harder: enemies gain +2 quality, +1 extra stage, and the final stage spawns an extra Lyssa. Payout: 0.5× resources + prestige medal. Deploy your strongest team.' },
            { icon: '⛓️', label: 'Rescue',      color: '#e08080',
              title: 'Recover captured maidens',
              desc: 'Generated automatically when maidens are in enemy hands. Completing it frees all associated captives, removes the Thrall tag, and grants the Rescued tag.' },
            { icon: '🚨', label: 'Lyssa Wave',   color: '#ff4444',
              title: 'Defend Fort Waelfeld from a mass assault',
              desc: '⚠️ MANDATORY: Every N missions a Lyssa-led war party storms the base. All other missions are suspended. Stage has doubled zako counts and multiple Lyssa officers. Difficulty scales from Normal (Tier 1–2) up to Hell (Tier 6). Reward: Weapon/Gear level loot. Defeat = 25–75% of all base resources looted. The wave persists until repelled.' },
          ] as const).map(({ icon, label, color, title, desc }) => (
            <div key={label} style={{ padding: '10px 12px', background: '#0e0d0b', borderRadius: 6, border: `1px solid ${color}44` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontWeight: 'bold', color, fontSize: 13 }}>{label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text)', fontStyle: 'italic', marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
        <Note>Medal and Strike Force missions are noticeably harder than their listed difficulty badge suggests — the +2 quality bonus places enemies in the next tier. Always send your strongest available team to these.</Note>
      </Section>

      {/* ── HQ SHOP ── */}
      <Section title="🏪 HQ Shop">
        <p>
          The HQ Shop (accessible from the <strong>Members</strong> page equipment panel) offers a rotating stock of equipment available for purchase with <strong>money</strong>.
          Items are grouped into <strong>5 rarity tiers</strong> — the rarity available depends entirely on your Radio Center level.
        </p>
        <div style={{ margin: '8px 0', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
          {[
            { rv: 1, name: 'Common',    color: '#aaaaaa', lv: 'Lv 1–2', note: 'starter weapons &amp; basic field gear' },
            { rv: 2, name: 'Uncommon',  color: '#5aac44', lv: 'Lv 3–4', note: 'improved issue, better armour &amp; accuracy' },
            { rv: 3, name: 'Rare',      color: '#4a90d9', lv: 'Lv 5–6', note: 'solid mid-tier tactical gear' },
            { rv: 4, name: 'Very Rare', color: '#c84ad9', lv: 'Lv 7–8', note: 'extraordinary HQ-grade equipment' },
            { rv: 5, name: 'Legendary', color: '#e8a840', lv: 'Lv 9–10', note: 'game-changing — limited supply' },
          ].map(r => (
            <React.Fragment key={r.rv}>
              <span style={{ color: r.color, fontWeight: 'bold' }}>{r.name}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{r.lv}</span>
              <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }} dangerouslySetInnerHTML={{ __html: r.note }} />
            </React.Fragment>
          ))}
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 8 }}>
          The shop stock refreshes after each purchase (or can be manually refreshed for a cost). Equipment bought goes directly into your inventory and can be equipped to any maiden from the Members page.
        </p>
        <Note>Match gear rarity to enemy quality — Rare (3) gear is well-suited for Q5–Q7 opponents. Upgrading the Radio Center to Lv 5+ before Hard missions gives a meaningful advantage.</Note>
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
            ['Cloth Mask', '0.5 lb'], ['Void Mask', '1 lb'],
            ['Leather Vest', '6 lb'], ['Reinforced Vest', '10 lb'], ['Void Armor', '20 lb'],
            ['Field Gloves', '1 lb'], ['Titan Arms', '2 lb'],
            ['Combat Boots', '3 lb'], ['Shadowveil Cloak', '2 lb'],
            ['Medals', '0.1 lb'], ['Accessories', '1–2 lb'], ['Consumables', '1–2 lb'],
          ].map(([name, wt]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span>{name}</span><span style={{ color: 'var(--color-text)' }}>{wt}</span>
            </div>
          ))}
        </div>
        <Note>Equipping an item that would exceed the carry limit is blocked. The carry weight bar in the equipment panel shows current load vs. capacity — turning orange near 85% and red when at the limit.</Note>
      </Section>

      <Section title="🏅 Medals">
        <p>
          Medals are awarded as mission rewards from <strong>medal-focus missions</strong>. They occupy the <em>medal</em> slot and weigh only <strong>0.1 lb</strong>.
          Each medal carries stat bonuses to Charm, Strategy, and/or Awareness — and higher-difficulty missions award rarer, more powerful medals.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Rarity by Mission Difficulty</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 8 }}>
          When a medal-reward mission is generated, the medal's rarity is rolled within the range for that difficulty:
        </p>
        <div style={{ margin: '8px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '5px 16px', alignItems: 'center' }}>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Difficulty</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Rarity Range</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Possible Medals</span>
            {[
              ['Easy',    'R1–R2',  'Campaign Ribbon, Service Cross'],
              ['Normal',  'R3–R5',  'Valor Badge, Distinguished Cross, Silver Star'],
              ['Hard',    'R5–R7',  'Silver Star, Commander\'s Cross, Legion of Honour ★'],
              ['Extreme', 'R7–R10', 'Legion of Honour ★, Hero\'s Medallion ★, Grand Cross ★, Supreme Valour ★'],
            ].map(([diff, range, names]) => (
              <React.Fragment key={diff}>
                <span style={{ color: 'var(--color-text-muted)' }}>{diff}</span>
                <span style={{ color: '#e8d8a0', fontWeight: 'bold' }}>{range}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{names}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Medal Table</h4>
        <div style={{ margin: '8px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '5px 14px', alignItems: 'center' }}>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Rarity</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Name</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Bonuses</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Value</span>
            {[
              [1,  'Campaign Ribbon',       '+1 CHM',                      '30¥'],
              [2,  'Service Cross',         '+1 CHM, +1 AWR',              '60¥'],
              [3,  'Valor Badge',           '+2 CHM',                      '90¥'],
              [4,  'Distinguished Cross',   '+2 CHM, +1 STG',              '130¥'],
              [5,  'Silver Star',           '+3 CHM, +1 AWR',              '180¥'],
              [6,  "Commander's Cross",     '+3 CHM, +2 STG',              '250¥'],
              [7,  'Legion of Honour ★',    '+4 CHM, +2 STG',              '350¥'],
              [8,  "Hero's Medallion ★",    '+4 CHM, +3 STG, +1 AWR',     '500¥'],
              [9,  'Grand Cross of Valour ★', '+5 CHM, +3 STG, +2 AWR',   '700¥'],
              [10, 'Supreme Valour Medal ★', '+6 CHM, +4 STG, +3 AWR',    '1000¥'],
            ].map(([r, name, bonuses, price]) => (
              <React.Fragment key={String(r)}>
                <span style={{ color: Number(r) >= 7 ? '#e8a020' : 'var(--color-text-muted)', fontWeight: Number(r) >= 7 ? 'bold' : 'normal' }}>R{r}</span>
                <span style={{ color: Number(r) >= 7 ? '#e8a020' : 'var(--color-text-muted)' }}>{name}</span>
                <span style={{ color: '#6ab06a' }}>{bonuses}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{price}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <Note>★ marks rare medals (Rarity 7+). All medals weigh 0.1 lb. Only one medal can be worn at a time (the medal slot). Medals can be sold but not crafted.</Note>
      </Section>

      <Section title="🎒 Auto-Equip">
        <p>
          The <strong>Auto-Equip</strong> panel in the mission start pop-up automatically moves gear from the base inventory onto deploying maidens before the march begins.
          Each equipment category has its own toggle — settings are saved and remembered across sessions.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Category Rules</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
          {[
            ['⚔️ Exclusive slots (Weapon, Head, Mask, Body, Arms, Legs)',
              'Each slot accepts at most one item. Auto-equip finds the highest-rated item of that type in the base inventory. It is only swapped in if it scores higher than the item the maiden is already wearing. The displaced item is returned to the inventory pool so other maidens can pick it up.'],
            ['🔍 Accessories',
              'Multiple accessories may be worn simultaneously. Auto-equip takes all available accessory items from the base inventory, sorted by rating (highest first), until the maiden\'s carry weight limit is reached.'],
            ['🏅 Medals',
              'Multiple medals may be carried simultaneously. Auto-equip takes all available medals sorted by rarity (highest first) until the carry limit is reached.'],
            ['💊 Consumables',
              'Auto-equip takes up to one item per consumable category (Healing Potion, Field Rations, Grenade) per stage in the mission. A 3-stage mission grants up to 3 potions, 3 rations, and 3 grenades. The best available tier of each category is picked first. Consumables the maiden already carries count toward the per-stage quota.'],
          ].map(([title, desc]) => (
            <div key={title as string} style={{ background: '#0e0d0b', border: '1px solid var(--color-border)', borderRadius: 5, padding: '8px 12px' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 4 }}>{title}</div>
              <div style={{ color: 'var(--color-text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Item Rating Formula</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          When deciding which exclusive-slot item is "better", auto-equip computes a score for each item:
        </p>
        <div style={{ margin: '6px 0', padding: '8px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
          <span style={{ color: 'var(--color-text)' }}>+2.0</span> per point of STR / DEX / CON &nbsp;|&nbsp;
          <span style={{ color: 'var(--color-text)' }}>+1.5</span> per point of AWR / STG &nbsp;|&nbsp;
          <span style={{ color: 'var(--color-text)' }}>+1.0</span> per point of CHM or flat HP &nbsp;|&nbsp;
          <span style={{ color: 'var(--color-text)' }}>+1.5</span> per % hit rate / dodge &nbsp;|&nbsp;
          <span style={{ color: 'var(--color-text)' }}>×0.5</span> scaling for percent bonuses<br />
          For weapons additionally: <span style={{ color: 'var(--color-text)' }}>+2</span> per damage point &nbsp;|&nbsp;
          <span style={{ color: 'var(--color-text)' }}>+5</span> per extra shot per round &nbsp;|&nbsp;
          <span style={{ color: 'var(--color-text)' }}>+0.5</span> per % hit rate bonus
        </div>
        <Note>Carry weight is always respected — an item that would push a maiden over her carry limit is skipped entirely. Items are assigned per maiden independently. <strong>Priority order:</strong> all heroines in the team are equipped first (in any order), then zako maidens in descending Charm order — higher Charm gets gear sooner. This matters most when the base stock is scarce, particularly for consumables.</Note>
      </Section>

      <Section title="❤️ Hit Points">
        <p>A maiden's maximum HP is calculated at recruit time from her <strong>Constitution</strong> score, and can be further increased by equipment, qualifications, or tags that grant HP or Constitution bonuses.</p>
        <FormulaBox label="Base Max HP" formula="7 + 2 × Constitution" />
        <FormulaBox label="Total Max HP" formula="(7 + 2 × Constitution + flat HP bonuses) × (1 + HP% bonuses ÷ 100)" />
        <Note>Example: Constitution 10 → base 27 HP. A Tactical Vest with +4 HP gives a subtotal of 31. A Heroine tag with +25% HP then multiplies that subtotal: 31 × 1.25 = 39. Flat bonuses from equipment, qualifications, and tags are summed first; percentage multipliers are applied last.</Note>
      </Section>

      <Section title="💥 Damage">
        <p>Damage is determined solely by the attacker's equipped weapon. Stats do not scale damage.</p>
        <FormulaBox label="Damage" formula="Weapon damage (flat value)" />
        <Note>Standard Rifle: 8 damage. Marksman Rifle: 12 damage. If no weapon is equipped, damage defaults to 4.</Note>
      </Section>

      <Section title="👁 Spot Phase">
        <p>Before combat begins, both sides attempt to spot each other. An <strong>approach index</strong> starts at <strong>3.0</strong> and decreases by <strong>0.3</strong> each spotting round. Two independent checks are resolved every round simultaneously.</p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 6 }}>Concealment (per combatant)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 6 }}>
          Each combatant has their own individual concealment score. The team is only as hidden as its <strong>most exposed member</strong> — the one with the <strong>lowest concealment</strong> is what the opposing spotter sees.
        </p>
        <FormulaBox label="Individual Concealment" formula="Dexterity × Approach Index × Sneak EXP factor" />
        <FormulaBox label="Sneak EXP factor" formula="1 + (Sneak Theory Lv × 0.03) + (Sneak Practical Lv × 0.10)" />
        <FormulaBox label="Team Concealment (used in check)" formula="min(all members' Individual Concealment) × Mass Factor" />

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 6 }}>Mass Factor</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 6 }}>
          Larger groups are easier to detect. Teams of 10 or fewer suffer no penalty. Each additional member beyond 10 reduces the team's concealment by <strong>1%</strong>.
        </p>
        <FormulaBox label="Mass Factor" formula="1 − max(0, teamSize − 10) × 0.01" />
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4 }}>
          <li>10 members → ×1.00 (no penalty)</li>
          <li>15 members → ×0.95 (−5%)</li>
          <li>20 members → ×0.90 (−10%)</li>
          <li>30 members → ×0.80 (−20%)</li>
        </ul>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 6 }}>Check 1 — Can your team spot the enemy?</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 6 }}>
          The maiden with the <strong>highest Scout Score</strong> (Awareness + Scout EXP bonus) acts as the active spotter — she alone determines whether the team detects the enemy.
          Her score is multiplied by a random factor and compared against the enemy team's <strong>lowest</strong> Individual Concealment (after mass factor).
        </p>
        <FormulaBox label="Maiden Scout Score" formula="max over all maidens [ (Awareness + Scout EXP bonus) × starved×0.5 ] × Random Factor" />
        <FormulaBox label="Enemy Team Concealment" formula="min(all enemies' Individual Concealment) × Enemy Mass Factor" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>If <strong>Maiden Scout Score &gt; Enemy Team Concealment</strong> → <span style={{ color: '#4a8c4a' }}>Maidens spot first</span> this round.</p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 6 }}>Check 2 — Can the enemy spot your team?</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 6 }}>
          The enemy with the <strong>highest Scout Score</strong> acts as the enemy spotter.
          Her score is compared against your team's <strong>lowest</strong> Individual Concealment (after mass factor).
        </p>
        <FormulaBox label="Enemy Scout Score" formula="max over all enemies [ (Awareness + Scout EXP bonus) ] × Random Factor" />
        <FormulaBox label="Maiden Team Concealment" formula="min(all maidens' Individual Concealment) × Maiden Mass Factor" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>If <strong>Enemy Scout Score &gt; Maiden Team Concealment</strong> → <span style={{ color: '#c84a4a' }}>Enemy spots first</span> this round.</p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 6 }}>Round Result</h4>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4 }}>
          <li>Only Check 1 succeeds → <span style={{ color: '#4a8c4a' }}>Maidens spot first</span> → surprise fire advantage, sneak EXP for all maidens</li>
          <li>Only Check 2 succeeds → <span style={{ color: '#c84a4a' }}>Enemy spots first</span> → enemy gets surprise fire</li>
          <li>Both succeed simultaneously → no surprise advantage for either side</li>
          <li>Neither succeeds → approach index drops by 0.3, next round begins</li>
          <li>If approach index reaches 0 without a clear result → treated as simultaneous</li>
        </ul>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Scout Random Factor</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Both scout scores (maiden and enemy) are each multiplied by an <em>independent</em> random factor drawn from a normal distribution before comparison.
        </p>
        <FormulaBox label="Random Factor" formula="Normal(mean = 1.0, SD = 0.25)  — clamped to [0.25, 2.0]" />

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Scout EXP Bonus (spotter only)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Scout EXP adds to the spotter's base score before the random multiplier. Only the maiden (or enemy) with the highest resulting Scout Score matters — the rest of the team does not contribute to spotting.
          A starved maiden scouts at half effectiveness.
        </p>
        <FormulaBox label="Scout EXP bonus" formula="+0.5 per Scout Theory Lv  +  +1.0 per Scout Practical Lv" />
        <Note>Scout EXP is earned by the best-awareness maiden when the team spots first <em>or</em> simultaneously. Sneak EXP is earned by <em>all</em> living maidens only when the team fully sneaks past detection (maiden spots first, enemy does not).</Note>
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

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Leader Succession (KIA)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          If the team leader falls in battle, a new leader is automatically promoted from the surviving members after the stage concludes.
          Maidens instinctively rally around the most <em>reliable</em> person — and <strong>Charm</strong> reflects a maiden's reputation, composure, and presence under pressure.
        </p>
        <div style={{ margin: '10px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ color: '#c8954a', fontWeight: 'bold', marginBottom: 8 }}>Succession Priority</div>
          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
            <li><strong style={{ color: 'var(--color-text)' }}>Heroines first</strong> — named heroines are trusted figures whose record speaks for itself.</li>
            <li><strong style={{ color: 'var(--color-text)' }}>Highest Charm</strong> among remaining alive survivors — the maiden whose presence steadies the group.</li>
          </ol>
        </div>
        <Note>
          The new leader takes effect immediately for the next stage. Her <strong>Charm</strong> anchors team morale and her <strong>Strategy</strong> continues to grant the cover bonus to all teammates.
        </Note>
      </Section>
      <Section title="🎓 EXP & Skills">
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
          When Lyssa's <strong>personal morale drops to 0</strong>, she faces an escalating flee check before her attack turn.
          Each consecutive failed check raises the flee chance by +10%, so she cannot stall indefinitely by repeatedly rallying:
        </p>
        <FormulaBox label="Flee chance" formula="25% on the 1st check · 35% on the 2nd · 45% on the 3rd · … capped at 95%" />
        <FormulaBox label="Flee outcome" formula="Lyssa escapes the battlefield permanently. Counts toward the 70% retreat threshold." />
        <FormulaBox label="Rally outcome" formula="Lyssa steels herself: +50 + Charm personal morale (capped at 100). She then fires normally." />
        <Note>The flee-check counter resets if Lyssa's morale rises above 0 again. Rally morale gain is shown in the Morale Log per individual Lyssa. Multiple Lyssas make their checks independently each round.</Note>
      </Section>

      <Section title="💊 Healing Potions">
        <p>
          Healing potions are <strong>consumable items</strong> that automatically restore a fraction of a maiden's maximum HP
          when she is badly hurt during an encounter round. Using a potion does <em>not</em> cost her attack turn.
        </p>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Consumable Action Order (per maiden, per round)</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 6 }}>
          Before the attack phase each round, each maiden resolves her consumables in a fixed priority order:
        </p>
        <ol style={{ color: 'var(--color-text-muted)', fontSize: 13, paddingLeft: 20, marginTop: 4, lineHeight: 1.8 }}>
          <li>
            <span style={{ color: '#6ab06a', fontWeight: 'bold' }}>Step 1 — Healing Potion check</span>{' '}
            (if HP &lt; 50%): roll to use one potion. <em>Does <strong>not</strong> consume her attack.</em>
          </li>
          <li>
            <span style={{ color: '#e8a020', fontWeight: 'bold' }}>Step 2 — Grenade check</span>{' '}
            (if she carries grenades): roll to throw one. <em>Replaces her normal attack this round.</em>
          </li>
          <li>
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 'bold' }}>Step 3 — Normal attack</span>{' '}
            (skipped if a grenade was thrown in Step 2).
          </li>
        </ol>
        <Note>
          A maiden can <strong>both use a potion and throw a grenade in the same round</strong> — the potion does not cost her attack, so the grenade throw simply replaces what would have been her rifle fire.
          She cannot throw two grenades in one round regardless of how many she carries.
        </Note>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Trigger Condition</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          A maiden considers using a potion when her HP falls below <strong>50% of her maximum</strong>. Whether she actually uses it depends on urgency and personality.
        </p>
        <FormulaBox label="Use chance" formula="(1 − HP ratio) × clamp(Charm ÷ 10, 0.3, ∞)" />
        <Note>
          A maiden at 20% HP (urgency 0.80) with Charm 8 (factor 0.80) has a 64% chance to use her potion.
          At 45% HP (urgency 0.55) with low Charm 3 (factor 0.30) the chance is only 17%.
          High-Charm maidens are more self-aware and act faster.
        </Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>HP Restoration</h4>
        <FormulaBox label="HP restored" formula="floor(Max HP × healPercent), capped at missing HP" />
        <div style={{ margin: '10px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '5px 16px', alignItems: 'center' }}>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Item</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Heal %</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Shop Tier</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Price</span>
            {[
              ['Healing Potion', '15%', 1, 30],
              ['Field Healing Potion', '30%', 3, 70],
              ['Advanced Healing Potion', '50%', 5, 140],
              ['Premium Healing Potion ★', '75%', 7, 280],
            ].map(([name, pct, tier, price]) => (
              <>
                <span key={String(name)} style={{ color: 'var(--color-text-muted)' }}>{name}</span>
                <span style={{ color: '#6ab06a', fontWeight: 'bold' }}>{pct}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Tier {tier}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{price}¥</span>
              </>
            ))}
          </div>
        </div>
        <Note>Only the first available potion in the maiden's inventory is used per healing event. Potions are consumed one at a time.</Note>
      </Section>

      <Section title="🍖 Field Rations">
        <p>
          Rations are <strong>pre-stage consumables</strong> eaten automatically before the spot phase.
          They recover HP and boost morale — and are critical for starved maidens.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Trigger Condition</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          A combatant will eat rations before a stage if she is <strong>Starved</strong> (certain) or if her personal morale is below 50.
        </p>
        <FormulaBox label="Eat chance (non-starved)" formula="max(0, (50 − personal morale) / 50) × 60%" />
        <Note>
          A maiden at morale 30 has a (50−30)/50 × 60% = 24% chance to eat. A maiden at morale 10 has a 48% chance.
          Starved maidens always eat if rations are available — they cannot refuse.
        </Note>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Starvation Cure</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          When a Starved maiden eats rations, her <strong>Starved</strong> status is lifted for that stage.
          All starvation penalties (halved hit rate, dodge, scout, cover) are removed. The −3 permanent morale penalty from starvation still applies.
        </p>
        <div style={{ margin: '10px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto auto 1fr', gap: '5px 12px', alignItems: 'center' }}>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Item</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>+Morale</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>+HP</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Shop Tier</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Price</span>
            {[
              ['Field Rations', 10, 3, 1, 20],
              ['Improved Field Rations', 20, 6, 3, 45],
              ['High-Grade Rations', 32, 10, 5, 90],
              ['Elite Combat Rations ★', 50, 15, 7, 180],
            ].map(([name, morale, hp, tier, price]) => (
              <>
                <span key={String(name)} style={{ color: 'var(--color-text-muted)' }}>{name}</span>
                <span style={{ color: '#4a9eff', fontWeight: 'bold' }}>+{morale}</span>
                <span style={{ color: '#6ab06a', fontWeight: 'bold' }}>+{hp}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Tier {tier}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{price}¥</span>
              </>
            ))}
          </div>
        </div>
        <Note>HP restored by rations is capped at the maiden's missing HP. Morale is applied as a temporary personal bonus for that stage.</Note>
      </Section>

      <Section title="💣 Grenades">
        <p>
          Grenades are <strong>area-effect consumables</strong> that <em>replace</em> a maiden's normal attack for that round.
          They can hit multiple enemies simultaneously, but are unreliable without training.
        </p>
        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>When a Maiden Throws</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Before the attack phase each round, a maiden with grenades rolls to decide whether to throw one.
        </p>
        <FormulaBox label="Throw decision chance" formula="60% if outnumbered  |  20% otherwise" />

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Throw Accuracy</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Grenade EXP (tracked separately from other weapon types) dramatically improves throw accuracy.
        </p>
        <div style={{ margin: '8px 0', padding: '8px 12px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)' }}>
          <div><span style={{ color: '#e8d8a0' }}>Untrained:</span> 20% base throw accuracy</div>
          <div style={{ marginTop: 4 }}><span style={{ color: '#e8d8a0' }}>Trained (any grenade EXP):</span> 60% base + Theory Lv × 5% + Practical Lv × 10%, capped at 90%</div>
        </div>

        <h4 style={{ color: 'var(--color-accent)', marginTop: 16, marginBottom: 8 }}>Blast Mechanics</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          On a successful throw, the grenade hits a <strong>primary target</strong> (1.5× damage) and a number of <strong>burst targets</strong> (1× damage).
        </p>
        <FormulaBox label="Burst targets" formula="ceil(burstPercent × alive enemies) − 1  additional random targets" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 6 }}>
          Each target (including the primary) rolls a <strong>dodge check</strong>. Higher DEX makes enemies harder to catch in the blast.
        </p>
        <FormulaBox label="Dodge chance" formula="clamp(30% − (DEX − 10) × 2%, 5%, 50%)" />

        <h4 style={{ color: 'var(--color-danger)', marginTop: 16, marginBottom: 8 }}>⚠️ Critical Error</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          There is always a small chance the grenade detonates prematurely, hitting a random friendly instead.
        </p>
        <FormulaBox label="Critical error chance" formula="5% if untrained  |  2% if trained" />

        <div style={{ margin: '10px 0', padding: '10px 14px', background: '#0e0d0b', borderRadius: 5, border: '1px solid var(--color-border)', fontSize: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto auto 1fr', gap: '5px 12px', alignItems: 'center' }}>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Item</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Damage</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Burst %</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Shop Tier</span>
            <span style={{ color: '#c8954a', fontWeight: 'bold' }}>Price</span>
            {[
              ['Fragmentation Grenade', 22, '15%', 2, 55],
              ['Concussion Grenade', 36, '22%', 4, 110],
              ['Incendiary Grenade', 50, '28%', 6, 200],
              ['Void Grenade ★', 65, '35%', 8, 400],
            ].map(([name, dmg, burst, tier, price]) => (
              <>
                <span key={String(name)} style={{ color: 'var(--color-text-muted)' }}>{name}</span>
                <span style={{ color: '#c84a4a', fontWeight: 'bold' }}>{dmg}</span>
                <span style={{ color: '#e8d8a0', fontWeight: 'bold' }}>{burst}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Tier {tier}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{price}¥</span>
              </>
            ))}
          </div>
        </div>
        <Note>Primary target takes 1.5× listed damage. Grenade practical EXP is earned on successful hits. Grenades are purchased from the HQ Shop when the Radio Center reaches the required tier.</Note>
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
