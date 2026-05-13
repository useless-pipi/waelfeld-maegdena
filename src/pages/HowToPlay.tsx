import { getMaidenPortrait, getMaidenIcon, getEnemyPortrait, getEnemyIcon } from '../utils/portraits';

// ── Small helpers ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, color: 'var(--color-accent)', borderBottom: '1px solid var(--color-border)', paddingBottom: 10, marginBottom: 20 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '16px 20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(200,149,74,0.08)',
      border: '1px solid var(--color-accent-dark)',
      borderLeft: '3px solid var(--color-accent)',
      borderRadius: 4,
      padding: '10px 14px',
      fontSize: 13,
      color: 'var(--color-text-muted)',
      marginTop: 10,
    }}>
      💡 {children}
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(180,50,50,0.08)',
      border: '1px solid rgba(180,80,80,0.4)',
      borderLeft: '3px solid #b44',
      borderRadius: 4,
      padding: '10px 14px',
      fontSize: 13,
      color: 'var(--color-text-muted)',
      marginTop: 10,
    }}>
      ⚠️ {children}
    </div>
  );
}

// ── Flowchart ─────────────────────────────────────────────────────────────────

function FlowNode({ icon, label, sub, accent }: { icon: string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      minWidth: 90,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 12,
        background: accent ? 'rgba(200,149,74,0.18)' : 'var(--color-surface)',
        border: `2px solid ${accent ? 'var(--color-accent)' : 'var(--color-border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        boxShadow: accent ? '0 0 18px rgba(200,149,74,0.25)' : 'none',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: accent ? 'var(--color-accent)' : 'var(--color-text)', textAlign: 'center' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: 80 }}>{sub}</div>}
    </div>
  );
}

function FlowArrow({ loop }: { loop?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 4px', marginTop: -12 }}>
      <div style={{ color: loop ? 'var(--color-accent)' : 'var(--color-text-muted)', fontSize: 20, lineHeight: 1 }}>→</div>
      {loop && <div style={{ fontSize: 9, color: 'var(--color-accent)', marginTop: 2 }}>repeat</div>}
    </div>
  );
}

// ── Combat phase diagram ───────────────────────────────────────────────────────

function PhaseStep({ icon, label, desc, dim }: { icon: string; label: string; desc: string; dim?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      opacity: dim ? 0.5 : 1,
      minWidth: 100,
      maxWidth: 130,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--color-surface)',
        border: '2px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-accent)', textAlign: 'center' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>{desc}</div>
    </div>
  );
}

function PhaseArrow({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, margin: '0 4px', marginTop: -20 }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 18 }}>→</div>
      {label && <div style={{ fontSize: 9, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{label}</div>}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ name, desc }: { name: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{
        background: 'rgba(200,149,74,0.15)',
        border: '1px solid var(--color-accent-dark)',
        color: 'var(--color-accent)',
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 11,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>{name}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{desc}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HowToPlay() {
  // A handful of example image IDs for illustration
  const exampleMaidens = [2, 7, 14, 22];
  const exampleEnemies = [1001, 1005, 1901, 1903];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 64 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, color: 'var(--color-accent)', marginBottom: 6 }}>📘 How to Play</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.7 }}>
          Waelfeld: Maegdena is a tactical management game. You command an all-female military unit — recruiting soldiers,
          upgrading your base, composing teams, and sending them on missions against enemy forces. This guide covers all
          the concepts you need to get started.
        </p>
      </div>

      {/* ── Game Loop ── */}
      <Section title="🔄 The Game Loop">
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.7 }}>
          Every session follows the same core cycle. There is no turn limit — progress at your own pace.
        </p>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: '8px 0' }}>
            <FlowNode icon="📋" label="Recruit" sub="Hire new maidens" />
            <FlowArrow />
            <FlowNode icon="⚙️" label="Equip" sub="Assign gear" />
            <FlowArrow />
            <FlowNode icon="🛡️" label="Compose" sub="Build your team" />
            <FlowArrow />
            <FlowNode icon="⚔️" label="Mission" sub="Fight enemies" accent />
            <FlowArrow />
            <FlowNode icon="💰" label="Rewards" sub="Gold, food, gear" />
            <FlowArrow loop />
            <FlowNode icon="🏗️" label="Upgrade" sub="Improve your base" />
          </div>
        </Card>
        <Tip>You can work through any of these steps in any order. The only hard gate is that missions require you to have a team composed first.</Tip>
      </Section>

      {/* ── Your Base ── */}
      <Section title="🏗️ Your Base">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card>
            <h3 style={{ color: 'var(--color-accent)', fontSize: 14, marginBottom: 10 }}>Resources</h3>
            <StatPill name="💰 Gold" desc="The main currency — used for recruiting, building, and buying equipment." />
            <StatPill name="🍞 Food" desc="Each maiden consumes (20 + Strength) food when deployed on a mission. If supplies run out, unfed maidens fight at −50% hit rate, dodge, scout and cover — keep your stocks topped up." />
            <StatPill name="🪵 Wood" desc="Construction material for base buildings." />
            <StatPill name="⚙️ Metal" desc="Advanced material for higher-tier upgrades." />
            <StatPill name="🛏️ Beds" desc="Limits how many maidens can stay at your base. Expand it to recruit more." />
          </Card>
          <Card>
            <h3 style={{ color: 'var(--color-accent)', fontSize: 14, marginBottom: 10 }}>Buildings</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
              Construct and upgrade buildings on the <strong>Buildings</strong> page. Each building unlocks or enhances a key aspect of the game:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: '🏕️', name: 'Tent Block', effect: 'Increases bed capacity (more maidens)' },
                { icon: '🏥', name: 'Field Hospital', effect: 'Restores HP to wounded maidens after missions' },
                { icon: '🏭', name: 'Factory', effect: 'Craft equipment from raw materials' },
                { icon: '📡', name: 'Radio Center', effect: 'Unlocks intel, improves mission access' },
                { icon: '🎓', name: 'Training Grounds', effect: 'Increases recruitment quality and options' },
              ].map(b => (
                <div key={b.name} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ fontSize: 18 }}>{b.icon}</span>
                  <div>
                    <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{b.name}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}> — {b.effect}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Tip>Prioritise the Tent Block early so you can recruit more maidens, then build the Field Hospital to keep them battle-ready.</Tip>
      </Section>

      {/* ── Maidens ── */}
      <Section title="👤 Maidens — Your Soldiers">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
          {/* Portrait showcase */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {exampleMaidens.map((id, i) => (
              <div key={id} style={{ position: 'relative', opacity: i === 0 ? 1 : 0.7 + i * 0.1 }}>
                <img
                  src={getMaidenPortrait(id)}
                  alt={`Maiden ${id}`}
                  style={{
                    height: i === 0 ? 160 : 120,
                    width: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
              Maidens are the core of your army. Each has a unique set of <strong>stats</strong>, <strong>qualifications</strong>,
              and an <strong>equipment loadout</strong>. You manage them all on the <strong>Members</strong> page.
            </p>
            <h3 style={{ fontSize: 13, color: 'var(--color-accent)', marginBottom: 10 }}>Core Stats</h3>
            <StatPill name="Strength" desc="Carries over to melee and equipment capacity." />
            <StatPill name="Dexterity" desc="Governs initiative and hit rate — the most combat-relevant stat." />
            <StatPill name="Constitution" desc="Determines maximum HP. Higher Con = tankier maiden." />
            <StatPill name="Strategy" desc="Affects decision-making and team-level bonuses." />
            <StatPill name="Awareness" desc="Used during the Spot phase before combat starts." />
            <StatPill name="Charm" desc="Influences morale — both personal and team-wide." />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 13, color: 'var(--color-accent)', marginBottom: 10 }}>Qualifications</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Qualifications are special designations that grant passive bonuses in combat — improved hit rate,
              dodge, morale resistance, and more. A maiden can hold multiple qualifications simultaneously.
              They are awarded through mission performance or training.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 13, color: 'var(--color-accent)', marginBottom: 10 }}>Equipment</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Each maiden has equipment slots for a <strong>weapon</strong>, <strong>armour</strong>, and
              <strong> accessories</strong>. Equipment affects damage output, hit rate, HP, and various bonuses.
              Assign gear from your inventory on the Members detail panel.
            </p>
          </Card>
        </div>
        <Tip>You can mark a maiden as your <strong>Favourite</strong> — she'll appear prominently on the Home screen. Maidens retain their HP and morale between missions.</Tip>
      </Section>

      {/* ── Recruiting ── */}
      <Section title="📋 Recruiting New Maidens">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Card style={{ flex: 1, minWidth: 260 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
              On the <strong>Recruits</strong> page you can roll a preview of a new maiden candidate and choose whether to enlist her.
              Stats are randomised — no two maidens are the same.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 22 }}>🎲</span>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}><strong>Roll Preview</strong> — See her stats before committing.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 22 }}>💰</span>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}><strong>Cost</strong> — Recruiting costs gold and requires a free bed.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 22 }}>🎁</span>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}><strong>Free Slots</strong> — Your first few recruits are free at game start.</span>
              </div>
            </div>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[901, 902, 903].map(id => (
                <img key={id} src={getMaidenIcon(id)} alt="" style={{ width: 56, height: 56, borderRadius: 6, border: '1px solid var(--color-border)', objectFit: 'cover' }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Common recruit types</span>
          </div>
        </div>
        <Warning>You cannot recruit beyond your bed capacity. Build more Tent Blocks first if the recruit button is disabled.</Warning>
      </Section>

      {/* ── Team Composition ── */}
      <Section title="🛡️ Team Composition">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          Before a mission, you must form a <strong>Team</strong> on the Composition page. A team consists of a
          <strong> lead maiden</strong> and several members. You also choose a <strong>composition type</strong> that
          defines how the team operates and what bonuses it receives.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { icon: '🔍', name: 'Scouting Team', desc: 'Favours spotting enemies early and striking first.' },
            { icon: '💣', name: 'Heavy Assault', desc: 'Maximises firepower at the cost of subtlety.' },
            { icon: '🛡️', name: 'Iron Fist', desc: 'Defensive formation that absorbs punishment.' },
            { icon: '💊', name: 'Medic Unit', desc: 'Keeps maidens alive with in-field healing.' },
            { icon: '🗡️', name: 'Standard Patrol', desc: 'A balanced all-rounder with no specific weakness.' },
          ].map(c => (
            <Card key={c.name} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 4 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.desc}</div>
            </Card>
          ))}
        </div>
        <Tip>The <strong>lead maiden's</strong> Charm anchors team morale. Choose someone with high Charm for the leadership role, even if she isn't your best fighter.</Tip>
      </Section>

      {/* ── Missions ── */}
      <Section title="⚔️ Missions">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
          Missions are the heart of the game. Each mission is divided into one or more <strong>stages</strong>. Your team
          fights through each stage in sequence — you cannot skip or retreat between stages without consequences.
          Completing a mission rewards you with gold, resources, and sometimes equipment.
        </p>

        {/* Enemy showcase */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              {exampleEnemies.map((id, i) => (
                <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <img
                    src={getEnemyPortrait(id)}
                    alt={`Enemy ${id}`}
                    style={{
                      height: i < 2 ? 130 : 100,
                      width: 'auto',
                      objectFit: 'contain',
                      filter: `drop-shadow(0 4px 14px rgba(180,50,50,${i < 2 ? 0.4 : 0.25}))`,
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{i < 2 ? 'Lyssa' : 'Zako'}</span>
                </div>
              ))}
            </div>
          </div>
          <Card style={{ flex: 1, minWidth: 240 }}>
            <h3 style={{ fontSize: 13, color: 'var(--color-accent)', marginBottom: 10 }}>Enemy Types</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <img src={getEnemyIcon(1001)} alt="Lyssa icon" style={{ width: 36, height: 36, borderRadius: 4, border: '1px solid var(--color-border)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#c44' }}>Lyssa</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Named enemy characters. High stats, capable of KO-ing maidens and can be stunned (pinned to 1 HP) instead of killed for morale bonuses.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <img src={getEnemyIcon(1901)} alt="Zako icon" style={{ width: 36, height: 36, borderRadius: 4, border: '1px solid var(--color-border)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-text-muted)' }}>Zako</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Generic enemy soldiers. Weaker individually but dangerous in numbers. Most stages are filled with them.</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Combat flow */}
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, color: 'var(--color-accent)', marginBottom: 16, textAlign: 'center' }}>Combat Flow (per stage)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            <PhaseStep
              icon="👁"
              label="Spot Phase"
              desc="Teams try to detect each other. The side that spots first gains an advantage."
            />
            <PhaseArrow label="spotted?" />
            <PhaseStep
              icon="🎯"
              label="Surprise Fire"
              desc="If your scouts spotted the enemy first, your team fires a free round before combat begins."
            />
            <PhaseArrow label="engage" />
            <PhaseStep
              icon="🔫"
              label="Encounter"
              desc="Alternating combat rounds. Each maiden fires in dexterity order, aiming to eliminate the enemy."
            />
            <PhaseArrow label="outcome?" />
            <PhaseStep
              icon="🏳"
              label="Retreat / Capture"
              desc="Either side may retreat if casualties are too heavy. Retreating maidens risk capture if outnumbered."
            />
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 13, color: 'var(--color-accent)', marginBottom: 8 }}>🏆 Victory</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Eliminate or rout all enemies in every stage. Collect the mission reward (gold, food, resources, gear) and any experience gained by survivors.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 13, color: '#c44', marginBottom: 8 }}>💀 Defeat & Capture</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              If your team retreats while heavily outnumbered, some maidens may be <strong>captured</strong>. Captured maidens are
              removed from your roster until you rescue them or complete objectives that free them.
            </p>
          </Card>
        </div>
        <Warning>Maidens who take damage carry wounds into future missions until healed at the Field Hospital. Send injured maidens on rest, not into danger.</Warning>
        <Warning>Each maiden consumes <strong>(20 + Strength)</strong> food when deployed. If your food supply is insufficient, maidens are fed in order — those who go hungry gain the <strong>Starved</strong> status and fight at <strong>−50%</strong> hit rate, dodge, scout, and cover for the entire mission. Check the ration cost in the mission panel before launching.</Warning>
      </Section>

      {/* ── Morale ── */}
      <Section title="💛 Morale — The Hidden Stat">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
              Morale affects how effectively your maidens fight. High morale improves accuracy; low morale causes misses
              and in the worst case, a full team rout or a maiden abandoning her weapon and fleeing.
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              Morale is influenced by two things:
            </p>
            <ul style={{ fontSize: 13, color: 'var(--color-text-muted)', paddingLeft: 20, lineHeight: 1.8, marginTop: 8 }}>
              <li><strong>Personal Morale</strong> — tied to a maiden's Charm and her personal battle experiences (kills, being hit, comrade deaths).</li>
              <li><strong>Team Morale</strong> — a shared score for the whole team, influenced by the leader's Charm, team cohesion, and how the battle is going.</li>
            </ul>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
            {[
              { label: 'Getting a kill', effect: '🟢 Boosts personal morale' },
              { label: 'Stunning a Lyssa', effect: '🟢 Large morale boost' },
              { label: 'Taking a hit', effect: '🔴 Hurts personal morale' },
              { label: 'A comrade falls', effect: '🔴 Hurts team morale' },
              { label: 'Outnumbering foes', effect: '🟢 Boosts team morale' },
              { label: 'Being outnumbered', effect: '🔴 Hurts team morale' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '6px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                <span style={{ color: 'var(--color-text)' }}>{r.label}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{r.effect}</span>
              </div>
            ))}
          </div>
        </div>
        <Tip>Morale changes are <strong>permanent</strong> between missions for the personal morale component. Keep maidens winning to maintain their spirit. A maiden who has suffered many wounds will fight poorly until you restore her morale through victories.</Tip>
      </Section>

      {/* ── Spot Phase detail ── */}
      <Section title="👁 Scouting & The Spot Phase">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Card style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
              Before every combat stage, both sides probe for each other. Your team's best scout — the maiden with the
              highest <strong>Awareness</strong> — competes against the enemy's ability to stay hidden.
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              The longer this phase lasts, the closer you get, and the easier enemies are to spot. If your scout wins,
              your team fires a <strong>free surprise volley</strong> before the enemy can react.
            </p>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 32 }}>
              <span title="Awareness">👁</span>
              <span style={{ color: 'var(--color-accent)' }}>vs</span>
              <span title="Enemy dexterity & approach">🌫️</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Scout's <strong>Awareness</strong><br />vs<br />Enemy stealth
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 6 }}>
              Win → free opening volley<br />
              Lose → enemy may strike first
            </div>
          </div>
        </div>
        <Tip>Include at least one maiden with high Awareness in every team. The free surprise round can be the difference between a clean sweep and a costly fight.</Tip>
      </Section>

      {/* ── Objective summary ── */}
      <Section title="🎯 Player Objectives">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          There is no single win condition — Waelfeld: Maegdena is an ongoing campaign. Your goals are to:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { icon: '⚔️', title: 'Complete Missions', desc: 'Work through the mission roster, from easy patrols to hard multi-stage sieges.' },
            { icon: '💪', title: 'Strengthen Your Team', desc: 'Recruit, equip, and develop your maidens into elite soldiers.' },
            { icon: '🏗️', title: 'Develop Your Base', desc: 'Expand infrastructure to unlock better recruits, healing, and crafting.' },
            { icon: '🏆', title: 'Rescue Captured Maidens', desc: 'If any maidens are taken prisoner, find missions that free them.' },
            { icon: '📈', title: 'Scale Difficulty', desc: 'Tackle harder missions for greater rewards and a bigger challenge.' },
          ].map(o => (
            <Card key={o.title}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{o.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 6 }}>{o.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{o.desc}</div>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Quick tips ── */}
      <Section title="✅ Quick Tips">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Start with easy missions (Ashwick Patrol) to get a feel for combat before tackling multi-stage challenges.',
            'Always assign a weapon to every maiden — unarmed fighters deal significantly less damage.',
            'Check a maiden\'s HP before sending her on a mission. Low-HP maidens are at high risk of capture.',
            'High Dexterity maidens act first in combat — they\'re your most reliable damage dealers.',
            'Keep at least one high-Awareness maiden in your active team at all times for reliable spotting.',
            'Save your game regularly on the Save page — export a JSON backup before risky missions.',
            'Read the 📖 Rules page for precise formulas if you want to optimise your builds.',
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
              <span style={{ color: 'var(--color-accent)', fontWeight: 'bold', flexShrink: 0, fontSize: 13 }}>{i + 1}.</span>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Rule Engine tips ── */}
      <Section title="🤖 Tips from the Rule Engine">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          The Rule Engine has simulated thousands of playthroughs. Here is what the data says about what actually works:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              icon: '🏗️',
              title: 'Buildings first — always',
              desc: 'Farm and Field Hospital pay back faster than any other investment. A well-fed, well-healed roster completes missions faster and loses fewer maidens. Build them before spending gold on gear.',
            },
            {
              icon: '🛡️',
              title: 'Keep 4 veterans at home every mission',
              desc: 'Sending your entire roster into every fight wears out experienced maidens faster than fresh recruits can replace them. Rotating a reserve of 4 home means veterans survive longer, accumulate stats, and push your FSI upward.',
            },
            {
              icon: '💀',
              title: 'KIA is your worst enemy — not the enemy',
              desc: 'Every dead veteran is replaced by a weak Level-1 recruit. In simulation, runs with average KIA above 150 never broke the hard-mission FSI gate. Runs with KIA below 50 reached it reliably. Protecting your best fighters matters more than difficulty.',
            },
            {
              icon: '⏸️',
              title: 'After a wipe, pull back completely',
              desc: 'If you lose 4 or more maidens in a single mission, run easy missions for the next 10 turns. The instinct is to push harder for better rewards, but a depleted roster sent into normal missions just produces more KIA. Let the Hospital do its job first.',
            },
            {
              icon: '⚙️',
              title: 'Do not let metal pile up — build The Meridian',
              desc: 'Metal has no use until the higher-tier buildings. If you have more than 3 000 metal sitting idle, prioritise building The Meridian. Its performance bonuses compound over time and the alternative is the resource just sitting there.',
            },
            {
              icon: '⚔️',
              title: 'Wait for FSI ≥ 100 before running hard missions',
              desc: 'Hard missions look tempting early, but enemy quality jumps sharply and a premature attempt typically costs 6–10 maidens in one fight. That wipe takes 30–40 missions to recover from. The safe gate is FSI 100 (roughly 13 trained maidens). Below that, stick to normal.',
            },
            {
              icon: '🍞',
              title: 'Check food before every mission launch',
              desc: 'Each maiden costs (20 + Strength) food when deployed. Maidens who go unfed gain Starved status and fight at −50% effectiveness for the entire mission. A 10-maiden team can cost 300+ food — always verify your stocks first.',
            },
            {
              icon: '🔄',
              title: 'Rescue missions are always top priority',
              desc: 'A captured maiden is a double loss: you lose her combat contribution and she may be held for many missions. When any maiden is captured, run rescue missions immediately — do not wait.',
            },
            {
              icon: '🎯',
              title: 'Dexterity and Awareness are the two most impactful stats',
              desc: 'Dexterity determines turn order and hit rate — high-DEX maidens act first and hit reliably. Awareness wins the Spot Phase, giving you a free opening volley. When choosing between two similar recruits, pick the one with better DEX or AWR.',
            },
            {
              icon: '📊',
              title: 'Use the Rule Engine to test before you commit',
              desc: 'Not sure whether to upgrade the Farm or the Tent Block first? Run the Rule Engine for 200 missions with each setting and compare the Avg FSI. The multi-run mode shows you the statistical spread across 100 attempts so single-run luck does not mislead you.',
            },
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
              <span style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{tip.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 4 }}>{tip.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{tip.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
        For exact numbers and formulas, see the <strong style={{ color: 'var(--color-accent)' }}>📖 Rules</strong> page.
      </div>
    </div>
  );
}
