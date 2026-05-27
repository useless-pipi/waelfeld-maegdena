import { useState } from 'react';
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

// ── Combat phase step ─────────────────────────────────────────────────────────

function PhaseStep({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 96, maxWidth: 120 }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--color-surface)', border: '2px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--color-accent)', textAlign: 'center' }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center' }}>{desc}</div>
    </div>
  );
}

function PhaseArrow({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, margin: '0 2px', marginTop: -20 }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>→</div>
      {label && <div style={{ fontSize: 9, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{label}</div>}
    </div>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────────

function StatRow({ name, icon, desc, highlight }: { name: string; icon: string; desc: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 9 }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <span style={{ fontWeight: 'bold', color: highlight ? 'var(--color-accent)' : 'var(--color-text)', fontSize: 13 }}>{name}</span>
        {highlight && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(200,149,74,0.2)', color: 'var(--color-accent)', padding: '1px 5px', borderRadius: 3 }}>KEY</span>}
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

// ── Q&A accordion ─────────────────────────────────────────────────────────────

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '12px 16px',
          background: open ? 'rgba(200,149,74,0.08)' : 'var(--color-surface)',
          border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: 'var(--color-text)', fontSize: 13, fontWeight: 'bold',
        }}
      >
        <span>❓ {q}</span>
        <span style={{ color: 'var(--color-accent)', fontSize: 16, flexShrink: 0, marginLeft: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 16px', background: '#0e0d0b', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HowToPlay() {
  const exampleMaidens = [2, 7, 14, 22];
  const exampleEnemies = [1001, 1005, 1901, 1903];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 64 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, color: 'var(--color-accent)', marginBottom: 8 }}>📘 How to Play</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.8 }}>
          You command an all-female military unit in a war-torn land. Recruit soldiers, build your base, form teams,
          and send them into battle — then use your rewards to grow stronger. There is no turn limit and no single
          win condition; the campaign unfolds at your pace.
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['📋 Recruit', '⚙️ Equip', '🛡️ Compose', '⚔️ Fight', '💰 Earn', '🏗️ Build'].map((s, i, arr) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: i === 3 ? 'var(--color-accent)' : 'var(--color-text)', fontWeight: i === 3 ? 'bold' : 'normal' }}>{s}</span>
              {i < arr.length - 1 && <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>→</span>}
            </div>
          )))}
          <span style={{ color: 'var(--color-accent)', fontSize: 12 }}>↺ repeat</span>
        </div>
      </div>

      {/* ── First Steps ── */}
      <Section title="🚀 Your First 10 Minutes">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          If you're brand new, do these steps in order and you'll be ready for your first mission:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { n: 1, icon: '🛏️', title: 'Check your beds', desc: 'Your Tent Block limits how many maidens you can have. You start with 30 beds — enough for now.' },
            { n: 2, icon: '📋', title: 'Recruit your first team', desc: 'Go to the Recruits page. Roll candidates and hire a few. Aim for 5–7 maidens to start. Higher Dexterity and Awareness are good signs.' },
            { n: 3, icon: '⚔️', title: 'Give them weapons', desc: 'Open the Members page, select each maiden, and assign a weapon. An unarmed maiden deals almost no damage.' },
            { n: 4, icon: '🛡️', title: 'Build your team', desc: 'Go to Composition. Create a team, drag maidens in, and pick a leader (high Charm preferred). You need at least one team before missions unlock.' },
            { n: 5, icon: '🗺️', title: 'Run your first mission', desc: 'Go to Missions and pick Ashwick Patrol on Easy. It\'s the gentlest introduction — one stage, light enemies, small reward.' },
            { n: 6, icon: '🏗️', title: 'Spend your first rewards', desc: 'After the mission, build the Field Hospital if you haven\'t. Wounded maidens heal between missions only if it\'s built.' },
          ].map(({ n, icon, title, desc }, i) => (
            <div key={n} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: 'var(--color-surface)', borderBottom: i < 5 ? '1px solid var(--color-border)' : 'none', borderRadius: i === 0 ? '8px 8px 0 0' : i === 5 ? '0 0 8px 8px' : 0, border: '1px solid var(--color-border)', marginTop: i === 0 ? 0 : -1 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(200,149,74,0.18)', border: '1px solid var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', flexShrink: 0, marginTop: 2 }}>{n}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 3 }}>{icon} {title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <Tip>You don't need to optimise anything yet. Just get your first mission done — you'll learn the rhythm quickly.</Tip>
      </Section>

      {/* ── Your Base ── */}
      <Section title="🏗️ Your Base & Resources">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          The <strong>Buildings</strong> page is where you invest your mission rewards to grow stronger.
          Resources are collected over time — and spent on construction, recruiting, and buying gear.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { icon: '💰', name: 'Gold', desc: 'Main currency. Used for recruiting, building, and buying gear from the HQ Shop.' },
            { icon: '🍞', name: 'Food', desc: 'Consumed every mission. If you run out, unfed maidens fight at half effectiveness all mission.' },
            { icon: '🪵', name: 'Wood', desc: 'Construction material for most buildings.' },
            { icon: '⚙️', name: 'Metal', desc: 'For advanced upgrades. Produced by the Meridian post-mission.' },
            { icon: '🛏️', name: 'Beds', desc: 'Your roster cap. Expand the Tent Block to house more maidens.' },
          ].map(r => (
            <div key={r.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 10 }}>Key Buildings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { icon: '🏕️', name: 'Tent Block', eff: 'More beds → bigger roster', priority: 'Early' },
              { icon: '🏥', name: 'Field Hospital', eff: 'Heals wounded maidens after each mission', priority: 'Early' },
              { icon: '🌾', name: 'Farm', eff: 'Produces food passively after each mission — prevents starvation', priority: 'Early' },
              { icon: '🎖️', name: 'Rosarium Vocis', eff: 'Chance to attract a free volunteer after each victory', priority: 'Mid' },
              { icon: '📡', name: 'Radio Center', eff: 'Unlocks the HQ Shop — buy rare weapons and gear', priority: 'Mid' },
              { icon: '🏭', name: 'Factory', eff: 'Craft equipment and consumables from materials', priority: 'Mid' },
              { icon: '🎓', name: 'Training Grounds', eff: 'Grants theory EXP to off-mission maidens after each fight', priority: 'Late' },
              { icon: '📊', name: 'The Meridian', eff: 'HQ performance review — pays out gold and metal based on your win record', priority: 'Late' },
            ].map((b, i, arr) => (
              <div key={b.name} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: i === 0 ? '6px 6px 0 0' : i === arr.length - 1 ? '0 0 6px 6px' : 0, marginTop: i === 0 ? 0 : -1 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{b.icon}</span>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>{b.name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}> — {b.eff}</span>
                </div>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, flexShrink: 0, background: b.priority === 'Early' ? 'rgba(74,160,74,0.15)' : b.priority === 'Mid' ? 'rgba(200,149,74,0.15)' : 'rgba(100,100,100,0.15)', color: b.priority === 'Early' ? '#6ab06a' : b.priority === 'Mid' ? 'var(--color-accent)' : 'var(--color-text-muted)', border: `1px solid ${b.priority === 'Early' ? '#3a703a' : b.priority === 'Mid' ? 'var(--color-accent-dark)' : 'var(--color-border)'}` }}>{b.priority}</span>
              </div>
            ))}
          </div>
        </div>
        <Tip>Farm → Field Hospital → Tent Block. This is the most reliable early order. Being able to feed, heal, and recruit freely is more valuable than any piece of gear.</Tip>
      </Section>

      {/* ── Maidens ── */}
      <Section title="👤 Your Soldiers">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            {exampleMaidens.map((id, i) => (
              <img key={id} src={getMaidenPortrait(id)} alt="" style={{ height: i === 0 ? 150 : 110, width: 'auto', objectFit: 'contain', opacity: 0.7 + i * 0.08, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }} />
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 230 }}>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
              Every maiden has her own stats, personality tags, and equipment slots. No two are identical.
              They carry their wounds, morale, and experience <strong>between missions</strong> — so how you treat them matters.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, color: 'var(--color-text-muted)', flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>🌟</div>
                <div style={{ fontWeight: 'bold', color: '#ffd700', marginBottom: 3 }}>Heroines</div>
                <div>Named characters with superior stats. Rare but powerful — worth protecting.</div>
              </div>
              <div style={{ padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, color: 'var(--color-text-muted)', flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>👥</div>
                <div style={{ fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 3 }}>Zako Maidens</div>
                <div>Regular recruits. Varied stats, weaker individually — but numbers add up.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 10 }}>Stats at a Glance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0 24px' }}>
          <div>
            <StatRow icon="🎯" name="Dexterity" desc="Who shoots first and how often they hit. The single most important combat stat." highlight />
            <StatRow icon="👁" name="Awareness" desc="Determines how well your team spots enemies before they're spotted. Wins you free opening shots." highlight />
            <StatRow icon="💛" name="Charm" desc="Anchors morale — both the maiden's own fighting spirit and the whole team's when she's the leader." />
          </div>
          <div>
            <StatRow icon="❤️" name="Constitution" desc="Sets maximum HP. Tougher maidens survive more hits." />
            <StatRow icon="💪" name="Strength" desc="Raw physical power. Also determines how much food she consumes per mission." />
            <StatRow icon="🧠" name="Strategy" desc="A high-Strategy leader helps teammates take cover more effectively in battle." />
          </div>
        </div>
        <Tip>When picking recruits, <strong>Dexterity</strong> and <strong>Awareness</strong> are the first things to look at. A maiden who can't hit enemies or fails to spot them first is a liability regardless of HP.</Tip>
      </Section>

      {/* ── Recruiting ── */}
      <Section title="📋 Recruiting">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Card style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
              On the <strong>Recruits</strong> page you roll a batch of candidates and choose who to enlist.
              Each recruit costs gold and takes up one bed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '🎲', text: 'Roll a new batch of candidates anytime — no penalty for re-rolling.' },
                { icon: '⚡', text: 'Use Fast Recruit to auto-hire the best available candidates at once.' },
                { icon: '🎟️', text: 'Free recruit tokens (from the Rosarium) let you hire without spending gold.' },
                { icon: '🌟', text: 'Heroines appear rarely but are always worth recruiting when they show up.' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                  <span style={{ flexShrink: 0, fontSize: 16 }}>{icon}</span>
                  <span style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', minWidth: 120 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[2, 7, 14].map(id => (
                <img key={id} src={getMaidenIcon(id)} alt="" style={{ width: 52, height: 52, borderRadius: 6, border: '1px solid var(--color-border)', objectFit: 'cover' }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>Sample candidates</span>
          </div>
        </div>
        <Warning>You cannot recruit if your beds are full. Always keep a few open slots — you never know when a great candidate or a rare heroine appears.</Warning>
      </Section>

      {/* ── Composition ── */}
      <Section title="🛡️ Building a Team">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          On the <strong>Composition</strong> page you assemble teams and assign them to missions.
          A team needs a <strong>leader</strong> and at least one other member.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 8 }}>👑 The Leader</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              The leader's <strong>Charm</strong> stat sets the baseline morale for the whole team.
              Her <strong>Strategy</strong> helps teammates get into cover during battle.
              If she falls, the highest-Charm survivor takes over automatically.
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 8 }}>🧩 Composition Type</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Each team uses a composition type (Scouting, Assault, Defensive, etc.) that shapes bonuses and
              playstyle. <strong>Standard Patrol</strong> is the safest all-round choice while you're learning.
            </div>
          </Card>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { icon: '🔍', name: 'Scouting', desc: 'Spot first, shoot first.' },
            { icon: '💣', name: 'Heavy Assault', desc: 'Maximum firepower.' },
            { icon: '🛡️', name: 'Iron Fist', desc: 'Take punishment, hold lines.' },
            { icon: '💊', name: 'Medic Unit', desc: 'In-field healing focus.' },
            { icon: '🗡️', name: 'Standard Patrol', desc: 'Balanced all-rounder.' },
          ].map(c => (
            <div key={c.name} style={{ padding: '10px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 3 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.desc}</div>
            </div>
          ))}
        </div>
        <Tip>Keep the team reasonably sized — smaller teams are harder to overrun, but too few maidens and a string of misses can end you. 4–6 maidens per team is a comfortable start.</Tip>
      </Section>

      {/* ── Missions ── */}
      <Section title="⚔️ Missions & Combat">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          Each mission has one or more stages. Your team fights through them in order.
          Win a stage by eliminating or routing all enemies. Fail, and your team retreats — possibly with casualties.
        </p>

        {/* Combat flow diagram */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 14, textAlign: 'center' }}>What happens each stage:</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            <PhaseStep icon="🍖" label="Rations" desc="Maidens eat before the fight if they're hungry or starved." />
            <PhaseArrow />
            <PhaseStep icon="👁" label="Spot Phase" desc="Your scouts try to detect enemies before they see you." />
            <PhaseArrow label="spotted?" />
            <PhaseStep icon="🎯" label="Surprise Fire" desc="If your team spotted first, you get a free opening volley." />
            <PhaseArrow />
            <PhaseStep icon="🔫" label="Combat Rounds" desc="Maidens fire in order of speed (Dexterity). Enemies fire back." />
            <PhaseArrow label="outcome" />
            <PhaseStep icon="✅" label="Stage End" desc="Victory or retreat. Survivors carry over to the next stage." />
          </div>
        </Card>

        {/* Enemy types */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {exampleEnemies.map((id, i) => (
              <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <img src={getEnemyPortrait(id)} alt="" style={{ height: i < 2 ? 120 : 90, width: 'auto', objectFit: 'contain', filter: `drop-shadow(0 4px 12px rgba(180,50,50,${i < 2 ? 0.4 : 0.2}))` }} />
                <span style={{ fontSize: 10, color: i < 2 ? '#c84a4a' : 'var(--color-text-muted)' }}>{i < 2 ? 'Lyssa' : 'Zako'}</span>
              </div>
            ))}
          </div>
          <Card style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 10 }}>Enemy Types</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
              <img src={getEnemyIcon(1001)} alt="" style={{ width: 34, height: 34, borderRadius: 4, border: '2px solid #c84a4a', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#c84a4a' }}>Lyssa</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Named enemies that <strong>cannot die</strong> — they're pinned to 1 HP and stunned instead. Stunning a Lyssa gives a big morale boost. Watch out: her morale also lets her rally and fight on.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <img src={getEnemyIcon(1901)} alt="" style={{ width: 34, height: 34, borderRadius: 4, border: '1px solid var(--color-border)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-text-muted)' }}>Zako</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Standard enemies. Weaker individually but appear in large numbers. A swarm can overwhelm an unprepared team fast.</div>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#6ab06a', marginBottom: 6 }}>🏆 Victory</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>All enemies eliminated or routed. You collect gold, food, resources, and gear. Survivors gain EXP and morale from the win.</div>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#c84a4a', marginBottom: 6 }}>💀 Retreat & Capture</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>If your team retreats while badly outnumbered, some maidens may be <strong>captured</strong>. Captured maidens are lost until you rescue them on a rescue mission.</div>
          </Card>
        </div>
        <Warning>Wounded maidens carry their reduced HP into future missions until the Field Hospital heals them. Never send a maiden in at low HP if you can avoid it.</Warning>
        <Warning>Before launching, check the food cost in the mission panel. Maidens who go hungry fight at <strong>half effectiveness</strong> for the whole mission. Always keep your Farm producing.</Warning>
      </Section>

      {/* ── Morale ── */}
      <Section title="💛 Morale — The Hidden Stat">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
          Morale quietly decides how well your maidens fight. High morale = better accuracy and steadier nerves.
          Low morale = misses, routs, and at worst — a maiden dropping her weapon and fleeing mid-battle.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 8 }}>💛 Personal Morale</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Tied to a maiden's own <strong>Charm</strong> stat. Rises when she gets kills or stuns a Lyssa.
              Falls when she takes damage, sees allies fall, or goes hungry.
              Personal morale <strong>persists between missions</strong> — a beaten-up maiden may still be demoralized days later.
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 8 }}>🛡️ Team Morale</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Shared across the team. Set by the <strong>leader's Charm</strong> and how cohesive the team is.
              Drops when maidens fall or the team is outnumbered. Rises when enemies flee or are destroyed.
              Hits zero = full rout — everyone retreats at once.
            </div>
          </Card>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {[
            { ev: 'Getting a kill', eff: '+', color: '#6ab06a' },
            { ev: 'Stunning a Lyssa', eff: '++ boost', color: '#6ab06a' },
            { ev: 'Outnumbering enemies', eff: '+', color: '#6ab06a' },
            { ev: 'Taking a hit', eff: '−', color: '#c84a4a' },
            { ev: 'A comrade falls', eff: '−', color: '#c84a4a' },
            { ev: 'Being outnumbered', eff: '−', color: '#c84a4a' },
            { ev: 'Going starved', eff: '−3 permanent', color: '#c84a4a' },
            { ev: 'Eating rations', eff: '+ temporary', color: '#6ab06a' },
          ].map(r => (
            <div key={r.ev} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 5, fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{r.ev}</span>
              <span style={{ color: r.color, fontWeight: 'bold', flexShrink: 0 }}>{r.eff}</span>
            </div>
          ))}
        </div>
        <Tip>The fastest way to restore a demoralized maiden is to send her on easy missions she can win. Victories heal morale better than anything else.</Tip>
      </Section>

      {/* ── EXP & Growth ── */}
      <Section title="🎓 Growth & Experience">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
          Maidens improve over time through two kinds of experience — and this is why protecting veterans matters.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 6 }}>⚗️ Practical EXP</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Earned by <em>doing</em>: land hits for weapon EXP, dodge attacks for sneak EXP, spot the enemy first for scout EXP.
              Practical gains are immediate and stack with every battle. A seasoned fighter hits harder, hides better, and scouts more reliably.
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: 6 }}>📚 Theory EXP</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Granted by the <strong>Training Grounds</strong> after each mission — but only to maidens who <em>stayed home</em>.
              This is why rotating your roster (keeping some maidens back each mission) pays off over time.
            </div>
          </Card>
        </div>
        <div style={{ padding: '10px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
          EXP improves <span style={{ color: '#e8d8a0' }}>hit rate</span>, <span style={{ color: '#e8d8a0' }}>dodge</span>, <span style={{ color: '#e8d8a0' }}>scout score</span>, and <span style={{ color: '#e8d8a0' }}>cover gain chance</span> directly.
          A heroine with years of battles behind her is dramatically more effective than a fresh recruit — even if their base stats look similar.
        </div>
        <Tip>Don't always send the same 5 maidens. Rotate so everyone builds Theory EXP at the Training Grounds, while combat veterans earn Practical EXP in the field.</Tip>
      </Section>

      {/* ── Survival Tips ── */}
      <Section title="🧠 Survival Tips from the Battlefield">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
          These aren't just suggestions — they're lessons from simulated campaigns. The runs that succeeded followed these patterns consistently.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: '🏗️', title: 'Build Farm and Hospital before anything else', desc: "Hunger and wounds silently destroy your effectiveness. A well-fed, well-healed team clears missions cleanly. Without these two buildings, you'll bleed maidens faster than you can replace them." },
            { icon: '💀', title: 'Protect your veterans — KIA is the real threat', desc: 'Every lost veteran is replaced by an untrained rookie. Campaigns that kept KIA low always outperformed those that didn\'t, regardless of how aggressively they played. Don\'t throw experienced maidens away.' },
            { icon: '🔄', title: 'After losing several maidens, take it slow', desc: 'It\'s tempting to push harder for rewards after a bad mission. Don\'t. Run easy missions for a while, let the Hospital heal, and rebuild strength. Rushing into the next fight with a half-strength roster just makes things worse.' },
            { icon: '🎯', title: 'Always have someone with high Awareness', desc: 'Spotting the enemy first gives your entire team a free opening volley before combat starts. That advantage compounds — enemies can be half-dead before they fire a shot. Never leave camp without a scout.' },
            { icon: '🌟', title: 'Rescue captured maidens immediately', desc: 'A captured maiden is a double loss: she\'s gone from your roster AND still occupies a bed. When someone is captured, prioritise her rescue mission above all else.' },
            { icon: '⚔️', title: 'Don\'t rush hard missions', desc: 'Hard missions have significantly tougher enemies. Going in underprepared can wipe your team entirely — a loss that takes many missions to recover from. Stick to Normal difficulty until your squad is experienced and well-equipped.' },
            { icon: '🍞', title: 'Check food before every launch', desc: 'Starved maidens fight at half effectiveness for the entire mission. This is not a minor penalty — it\'s ruinous. Glance at the food cost in the mission panel every time.' },
            { icon: '💾', title: 'Save regularly', desc: 'Export a save backup on the Save page before taking on tough missions. One bad run shouldn\'t erase hours of progress.' },
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 7 }}>
              <span style={{ fontSize: 24, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 4 }}>{t.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Q&A ── */}
      <Section title="❓ Common Questions">
        <QA q="My maiden isn't doing any damage — what's wrong?">
          She probably has no weapon equipped. Open the <strong>Members</strong> page, click on her, and assign a weapon from your inventory.
          An unarmed maiden deals almost nothing and is a wasted slot.
        </QA>
        <QA q="Why is the recruit button greyed out?">
          Your beds are full. Go to the <strong>Buildings</strong> page and upgrade the <strong>Tent Block</strong> to unlock more capacity.
          Alternatively, you can dismiss a maiden you no longer need.
        </QA>
        <QA q="What happens when a maiden is captured?">
          She's removed from your active roster and cannot be deployed — but she still occupies a bed.
          Look for a <em>Rescue</em> mission type in the mission list. Completing it returns your captured maidens.
          Don't leave her there long.
        </QA>
        <QA q="Can I lose a heroine permanently?">
          Yes. Heroines can be killed in action (KIA) just like regular maidens. KIA is permanent.
          However, there's a rare item — the <strong>Revenant Bloom</strong> — that can recall a fallen heroine's spirit if you collect enough of them.
          Treat your heroines carefully.
        </QA>
        <QA q="My team keeps getting routed — what am I doing wrong?">
          Several possible causes: <strong>(1)</strong> Team morale is too low — check that your leader has decent Charm.
          <strong> (2)</strong> The enemy outnumbers you heavily — consider a larger team or easier mission.
          <strong> (3)</strong> Maidens are starved — check food before deploying.
          <strong> (4)</strong> You're fighting above your level — try Normal difficulty instead of Hard.
        </QA>
        <QA q="What is the Spot Phase and why does it matter?">
          Before each stage, both sides try to detect each other. If your team spots the enemy first, you fire a
          <strong> free surprise volley</strong> before combat even starts — sometimes eliminating an enemy or two for free.
          If the enemy spots <em>you</em> first, they get that advantage instead. Keep a high-Awareness maiden in every team.
        </QA>
        <QA q="What is FSI?">
          Force Strength Index — a number that reflects the overall combat capability of your entire roster.
          It factors in how many maidens you have, their stats, gear, and EXP. The Missions page shows your current FSI.
          Higher FSI unlocks harder, higher-reward missions. Think of it as your unit's power level.
        </QA>
        <QA q="What does the Rosarium Vocis do?">
          After each <em>victorious</em> mission, the Rosarium rolls a chance to attract a free volunteer — a new maiden
          that joins without costing gold. Higher building levels improve the chance and the quality of gear she arrives with.
          It's one of the best passive income buildings for roster growth.
        </QA>
        <QA q="What is Lyssa and can I kill her?">
          Lyssa is a special enemy type that <strong>cannot be killed</strong>. She's pinned to 1 HP instead of dying.
          When you pin her, she becomes Stunned and loses her next attack turn — which gives you a big morale boost.
          If her morale collapses, she may eventually flee the battlefield. You win the stage when all enemies are either
          eliminated (Zako) or have fled (Lyssa).
        </QA>
        <QA q="How do I make my maidens stronger over time?">
          Three main ways: <strong>(1)</strong> Let them fight — practical EXP improves hit rate, dodge, and scouting with every battle.
          <strong> (2)</strong> Build the Training Grounds — maidens who stay home earn theory EXP passively.
          <strong> (3)</strong> Equip better gear from the HQ Shop or Factory. Experienced, well-equipped maidens are dramatically stronger than fresh recruits.
        </QA>
        <QA q="What should I build first?">
          In order: <strong>Farm → Field Hospital → Tent Block</strong>. The Farm prevents starvation penalties which cripple missions.
          The Hospital heals wounds so you aren't sending crippled maidens into danger. Tent Block lets you recruit more.
          After those three are established, the <strong>Rosarium Vocis</strong> and <strong>Radio Center</strong> are your next priorities.
        </QA>
        <QA q="What's the difference between a saved game and a backup export?">
          The game auto-saves to your browser's local storage whenever you make a change. The <strong>Save page</strong> lets you
          export this as a JSON file you keep on your computer. Local storage can be cleared by browser updates or settings —
          always export a backup before risky missions or major decisions.
        </QA>
      </Section>

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
        For exact mechanics and formulas, see the <strong style={{ color: 'var(--color-accent)' }}>📖 Rules</strong> page.
        For AI-driven strategic advice, try the <strong style={{ color: 'var(--color-accent)' }}>🤖 Rule Engine</strong>.
      </div>
    </div>
  );
}
