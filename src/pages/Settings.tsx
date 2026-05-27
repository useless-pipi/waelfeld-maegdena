import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import {
  UI_SCALE_OPTIONS, readUiScale, writeUiScale,
  BATTLE_SPEED_OPTIONS, readBattleSpeed, writeBattleSpeed,
  AUTO_EQUIP_SLOTS, AUTO_EQUIP_SLOT_LABELS, readAutoEquipConfig, writeAutoEquipConfig,
  readAutoTradeFood, writeAutoTradeFood,
  readMembersViewMode, writeMembersViewMode,
  readMembersShowAlive, writeMembersShowAlive,
  readMembersShowCaptured, writeMembersShowCaptured,
  readMembersShowDead, writeMembersShowDead,
  readMembersHeroineOnly, writeMembersHeroineOnly,
  readAutoRecruit, writeAutoRecruit,
  type AutoEquipConfig, type AutoEquipSlot,
} from '../utils/settings';

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: 20, marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ── Chip toggle group ─────────────────────────────────────────────────────────
function ChipGroup<T extends string | number>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          style={{
            padding: '4px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
            border: '1px solid var(--color-border)',
            background: value === o.value ? 'var(--color-accent)' : 'var(--color-bg)',
            color: value === o.value ? '#1a1713' : 'var(--color-text)',
            fontWeight: value === o.value ? 700 : 400,
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--color-text)' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, position: 'relative',
          background: checked ? 'var(--color-accent)' : 'var(--color-border)',
          transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 18 : 3,
          width: 14, height: 14, borderRadius: '50%',
          background: checked ? '#1a1713' : 'var(--color-text-muted)',
          transition: 'left 0.2s',
        }} />
      </div>
      {label}
    </label>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────
export default function Settings() {
  // ── UI Scale
  const [uiScale, setUiScaleState] = useState(readUiScale);
  function setUiScale(v: number) { setUiScaleState(v); writeUiScale(v); }

  // ── Battle speed
  const [battleSpeed, setBattleSpeedState] = useState(readBattleSpeed);
  function setBattleSpeed(v: 1 | 2 | 4 | 8) { setBattleSpeedState(v); writeBattleSpeed(v); }

  // ── Auto equip
  const [autoEquip, setAutoEquipState] = useState<AutoEquipConfig>(readAutoEquipConfig);
  function setAutoEquipSlot(slot: AutoEquipSlot, val: boolean) {
    const next = { ...autoEquip, [slot]: val };
    setAutoEquipState(next);
    writeAutoEquipConfig(next);
  }
  const setAllAutoEquip = (val: boolean) => {
    const next = Object.fromEntries(AUTO_EQUIP_SLOTS.map(s => [s, val])) as AutoEquipConfig;
    setAutoEquipState(next);
    writeAutoEquipConfig(next);
  };

  // ── Auto trade food
  const [autoTradeFood, setAutoTradeFoodState] = useState(readAutoTradeFood);
  function setAutoTradeFood(v: boolean) { setAutoTradeFoodState(v); writeAutoTradeFood(v); }

  // ── Auto recruit
  const { setAutoRecruit } = useGameStore();
  const [autoRecruit, setAutoRecruitState] = useState(readAutoRecruit);
  function setAutoRecruitLocal(v: boolean) { setAutoRecruitState(v); writeAutoRecruit(v); setAutoRecruit(v); }

  // ── Members preferences
  const [membersView, setMembersViewState] = useState(readMembersViewMode);
  function setMembersView(v: 'grid' | 'list') { setMembersViewState(v); writeMembersViewMode(v); }

  const [showAlive, setShowAliveState] = useState(readMembersShowAlive);
  function setShowAlive(v: boolean) { setShowAliveState(v); writeMembersShowAlive(v); }

  const [showCaptured, setShowCapturedState] = useState(readMembersShowCaptured);
  function setShowCaptured(v: boolean) { setShowCapturedState(v); writeMembersShowCaptured(v); }

  const [showDead, setShowDeadState] = useState(readMembersShowDead);
  function setShowDead(v: boolean) { setShowDeadState(v); writeMembersShowDead(v); }

  const [heroineOnly, setHeroineOnlyState] = useState(readMembersHeroineOnly);
  function setHeroineOnly(v: boolean) { setHeroineOnlyState(v); writeMembersHeroineOnly(v); }

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginBottom: 6 }}>⚙️ Settings</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 24 }}>
        All preferences are saved automatically to your browser and persist across sessions.
      </p>

      {/* ── Display ── */}
      <Section title="Display" icon="🖥️">
        <Row
          label="UI Scale"
          hint="Zoom the entire interface. Useful on high-DPI screens or for accessibility."
        >
          <ChipGroup
            options={UI_SCALE_OPTIONS.map(o => ({ value: o.value, label: o.label.split(' — ')[0] }))}
            value={uiScale}
            onChange={v => setUiScale(v)}
          />
        </Row>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -6, marginBottom: 4 }}>
          Current: <strong style={{ color: 'var(--color-accent)' }}>{UI_SCALE_OPTIONS.find(o => o.value === uiScale)?.label ?? `${Math.round(uiScale * 100)}%`}</strong>
          {uiScale !== 1.0 && (
            <button
              onClick={() => setUiScale(1.0)}
              style={{ marginLeft: 10, fontSize: 10, background: 'none', border: '1px solid var(--color-border)', borderRadius: 3, padding: '1px 7px', cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >Reset to 100%</button>
          )}
        </div>
      </Section>

      {/* ── Combat ── */}
      <Section title="Combat" icon="⚔️">
        <Row
          label="Default Battle Speed"
          hint="Animation playback speed during missions. Can also be changed mid-combat."
        >
          <ChipGroup
            options={BATTLE_SPEED_OPTIONS.map(o => ({ value: o.value, label: o.label.split(' — ')[0] }))}
            value={battleSpeed}
            onChange={v => setBattleSpeed(v as 1 | 2 | 4 | 8)}
          />
        </Row>
      </Section>

      {/* ── Missions ── */}
      <Section title="Missions" icon="🗺️">
        <Row
          label="Auto Trade Food"
          hint="Automatically spend excess food on gold before departing on a mission."
        >
          <Toggle checked={autoTradeFood} onChange={setAutoTradeFood} label={autoTradeFood ? 'Enabled' : 'Disabled'} />
        </Row>
        <Row
          label="Auto Recruit"
          hint="Automatically recruit new maidens after a mission to fill empty roster slots."
        >
          <Toggle checked={autoRecruit} onChange={setAutoRecruitLocal} label={autoRecruit ? 'Enabled' : 'Disabled'} />
        </Row>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 600, marginBottom: 4 }}>
            Auto-Equip Slots
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Automatically fill these equipment slots on all maidens before a mission departs.
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => setAllAutoEquip(true)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer' }}>All on</button>
            <button onClick={() => setAllAutoEquip(false)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer' }}>All off</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {(AUTO_EQUIP_SLOTS.filter(s => !['potion','ration','grenade'].includes(s)) as AutoEquipSlot[]).map(slot => (
              <label
                key={slot}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                  padding: '5px 8px', borderRadius: 5, fontSize: 12,
                  background: autoEquip[slot] ? 'rgba(200,149,74,0.12)' : '#0e0d0b',
                  border: `1px solid ${autoEquip[slot] ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={autoEquip[slot]}
                  onChange={e => setAutoEquipSlot(slot, e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                />
                {AUTO_EQUIP_SLOT_LABELS[slot]}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>Consumables</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {(['potion','ration','grenade'] as AutoEquipSlot[]).map(slot => (
                <label
                  key={slot}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                    padding: '5px 8px', borderRadius: 5, fontSize: 12,
                    background: autoEquip[slot] ? 'rgba(200,149,74,0.12)' : '#0e0d0b',
                    border: `1px solid ${autoEquip[slot] ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoEquip[slot]}
                    onChange={e => setAutoEquipSlot(slot, e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                  />
                  {AUTO_EQUIP_SLOT_LABELS[slot]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Members page ── */}
      <Section title="Members Page" icon="👤">
        <Row label="Default View" hint="Whether the members roster shows as a card grid or a compact list.">
          <ChipGroup
            options={[{ value: 'grid' as const, label: '⊞ Grid' }, { value: 'list' as const, label: '☰ List' }]}
            value={membersView}
            onChange={setMembersView}
          />
        </Row>
        <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 600, marginBottom: 8 }}>Default Visibility Filters</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle checked={showAlive} onChange={setShowAlive} label="Show active maidens" />
          <Toggle checked={showCaptured} onChange={setShowCaptured} label="Show captured maidens" />
          <Toggle checked={showDead} onChange={setShowDead} label="Show fallen maidens (KIA)" />
          <Toggle checked={heroineOnly} onChange={setHeroineOnly} label="Heroines only (hide zakos by default)" />
        </div>
      </Section>

      {/* ── Info ── */}
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '0 4px' }}>
        ℹ️ All settings are stored in your browser's localStorage / cookies and are not part of the game save file. They will not be wiped by a game reset, but will be lost if you clear browser data.
      </div>
    </div>
  );
}
