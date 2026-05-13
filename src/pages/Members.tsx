import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group } from 'react-konva';
import { useGameStore } from '../store/gameStore';
import { getMaidenIcon, getMaidenPortrait } from '../utils/portraits';
import { theoryLv, practicalLv } from '../engine/combat';
import { computeMaxCarryWeight, computeCarryWeight } from '../engine/recruit';
import type { Maiden } from '../types/maiden';
import type { Equipment } from '../types/equipment';
import tagsData from '../data/tags.json';
import type { TagDef } from '../types/stats';

const TAG_DEFS: Record<string, TagDef> = Object.fromEntries(
  (tagsData as TagDef[]).map(td => [td.id, td])
);

// ---------------------------------------------------------------------------
// TagTooltip
// ---------------------------------------------------------------------------
const TAG_CATEGORY_STYLE: Record<string, { color: string; border: string; bg: string }> = {
  positive:     { color: '#7ecb7e', border: 'rgba(126,203,126,0.5)',  bg: 'rgba(126,203,126,0.10)' },
  double_edged: { color: '#d4a84b', border: 'rgba(212,168,75,0.5)',   bg: 'rgba(212,168,75,0.10)'  },
  negative:     { color: '#d46b6b', border: 'rgba(212,107,107,0.5)',  bg: 'rgba(212,107,107,0.10)' },
};

function TagTooltip({ tagId }: { tagId: string }) {
  const def = TAG_DEFS[tagId];
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const categoryStyle = def?.category ? (TAG_CATEGORY_STYLE[def.category] ?? null) : null;

  function handleMouseEnter(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left, y: rect.bottom + 6 });
    setVisible(true);
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        style={{
          background: categoryStyle ? categoryStyle.bg : 'rgba(200,149,74,0.12)',
          border: `1px solid ${categoryStyle ? categoryStyle.border : 'var(--color-border)'}`,
          padding: '1px 6px', borderRadius: 3, fontSize: 10,
          color: categoryStyle ? categoryStyle.color : 'var(--color-text-muted)',
          cursor: def ? 'help' : 'default', userSelect: 'none',
        }}
      >
        {def?.name ?? tagId}
      </span>
      {visible && def && (
        <div
          style={{
            position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
            background: '#1e1c17', border: '1px solid var(--color-accent)',
            borderRadius: 6, padding: '10px 12px', maxWidth: 260,
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: 12, color: categoryStyle?.color ?? 'var(--color-accent)', marginBottom: 4 }}>
            {def.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5, marginBottom: def.bonuses.length || def.ability ? 8 : 0 }}>
            {def.description}
          </div>
          {def.bonuses.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: def.ability ? 6 : 0 }}>
              {def.bonuses.map((b, i) => {
                const positive = b.value > 0;
                const valColor = positive ? '#7ecb7e' : '#d46b6b';
                const sign = positive ? '+' : '';
                return (
                  <div key={i} style={{ fontSize: 10, color: valColor }}>
                    {positive ? '＋' : '－'} {b.label}:{' '}
                    <span style={{ fontWeight: 'bold' }}>{sign}{b.value}{b.isPercent ? '%' : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
          {def.ability && (
            <div style={{ fontSize: 10, color: '#c8a85a', fontStyle: 'italic' }}>✦ {def.ability}</div>
          )}
        </div>
      )}
    </>
  );
}
const CARD_W = 110;
const CARD_H = 148;
const GRID_GAP = 12;
const COLS = 5;

const SLOT_LABEL: Record<string, string> = {
  weapon: 'Weapon',
  head: 'Head',
  body: 'Body',
  legs: 'Legs',
  accessory: 'Accessory',
  consumable: 'Consumable',
  medal: 'Medal',
};

// ---------------------------------------------------------------------------
// useImage hook
// ---------------------------------------------------------------------------
function useImage(src: string): [HTMLImageElement | null] {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);
  return [img];
}

// ---------------------------------------------------------------------------
// Konva cards
// ---------------------------------------------------------------------------
function MaidenCard({
  maiden, x, y, selected, onSelect,
}: {
  maiden: Maiden; x: number; y: number; selected: boolean; onSelect: () => void;
}) {
  const src = getMaidenIcon(maiden.imgId);
  const [img] = useImage(src);
  const highlight = selected ? '#c8954a' : maiden.isFavourite ? '#ffd700' : '#3a3328';
  return (
    <Group x={x} y={y} onClick={onSelect} onTap={onSelect}>
      <Rect width={CARD_W} height={CARD_H} fill="#1a1713" stroke={highlight} strokeWidth={selected ? 2 : 1} cornerRadius={6} />
      {img && <KonvaImage image={img} x={5} y={5} width={CARD_W - 10} height={100} cornerRadius={4} />}
      {maiden.isFavourite && <Text text="*" x={CARD_W - 20} y={6} fontSize={14} fill="#ffd700" />}
      {maiden.isCaptured && <Rect width={CARD_W - 10} height={100} x={5} y={5} fill="rgba(180,0,0,0.4)" cornerRadius={4} />}
      {/* Name */}
      <Text text={maiden.nickname ?? maiden.name.split(' ')[0]} x={4} y={111} width={CARD_W - 8} fontSize={11} fill="#e8dcc8" align="center" wrap="none" ellipsis />
      {/* HP number — right-aligned, small */}
      <Text text={`${maiden.currentHp}/${maiden.maxHp}`} x={4} y={126} width={CARD_W - 8} fontSize={8} fill={maiden.currentHp < maiden.maxHp * 0.4 ? '#e07070' : '#8a7a62'} align="right" />
      {/* HP bar track */}
      <Rect x={5} y={137} width={CARD_W - 10} height={6} fill="#1e1b16" cornerRadius={3} />
      {/* HP bar fill */}
      <Rect
        x={5} y={137}
        width={Math.max(0, (CARD_W - 10) * (maiden.currentHp / maiden.maxHp))}
        height={6}
        fill={maiden.currentHp < maiden.maxHp * 0.4 ? '#b84040' : maiden.currentHp < maiden.maxHp * 0.7 ? '#c8954a' : '#4a8c4a'}
        cornerRadius={3}
      />
    </Group>
  );
}

function FallenMaidenCard({
  maiden, x, y, selected, onSelect,
}: {
  maiden: Maiden; x: number; y: number; selected: boolean; onSelect: () => void;
}) {
  const src = getMaidenIcon(maiden.imgId);
  const [img] = useImage(src);
  const highlight = selected ? '#c8954a' : '#2a2520';
  return (
    <Group x={x} y={y} onClick={onSelect} onTap={onSelect}>
      <Rect width={CARD_W} height={CARD_H} fill="#0a0907" stroke={highlight} strokeWidth={selected ? 2 : 1} cornerRadius={6} />
      {img && <KonvaImage image={img} x={5} y={5} width={CARD_W - 10} height={100} cornerRadius={4} opacity={0.3} />}
      <Rect width={CARD_W - 10} height={100} x={5} y={5} fill="rgba(0,0,0,0.6)" cornerRadius={4} />
      <Text text="X" x={CARD_W / 2 - 6} y={45} fontSize={20} fill="#666" />
      <Text text={maiden.nickname ?? maiden.name.split(' ')[0]} x={4} y={111} width={CARD_W - 8} fontSize={11} fill="#555" align="center" wrap="none" ellipsis />
      <Text text="KIA" x={4} y={128} width={CARD_W - 8} fontSize={9} fill="#666" align="center" />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: 24, maxWidth: 340, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: 14, color: 'var(--color-text)', marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: 'transparent', border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            background: 'var(--color-danger)', border: 'none', color: '#fff',
            borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
          }}>Proceed</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipment card
// ---------------------------------------------------------------------------
interface EquipCardProps {
  eq: Equipment;
  ownerMaiden?: Maiden | null;
  equipped?: boolean;
  draggable?: boolean;
  dim?: boolean;
  stackCount?: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
}
function EquipCard({ eq, ownerMaiden, equipped, draggable, dim, locked, stackCount, onDragStart, onDragEnd, onClick }: EquipCardProps & { locked?: boolean }) {
  const ownerSrc = ownerMaiden ? getMaidenIcon(ownerMaiden.imgId) : null;
  return (
    <div
      draggable={locked ? false : draggable}
      onDragStart={locked ? undefined : onDragStart}
      onDragEnd={locked ? undefined : onDragEnd}
      onClick={locked ? undefined : onClick}
      title={locked
        ? `${eq.name} — held by captured maiden ${ownerMaiden?.nickname ?? ownerMaiden?.name ?? ''}. Cannot be accessed while she is captive.`
        : `${eq.name}${eq.weight !== undefined ? ` [${eq.weight} lb]` : ''} — ${eq.description}${ownerMaiden ? `\nEquipped by: ${ownerMaiden.nickname ?? ownerMaiden.name}` : ''}`}
      style={{
        position: 'relative',
        width: 90,
        flexShrink: 0,
        background: locked ? '#0a0907' : equipped ? 'rgba(200,149,74,0.15)' : '#0e0d0b',
        border: `1px solid ${locked ? '#3a2a2a' : eq.isRare ? '#c84a4a' : equipped ? 'var(--color-accent)' : 'var(--color-border)'}`,
        boxShadow: (!locked && eq.isRare) ? '0 0 8px rgba(200,74,74,0.3)' : 'none',
        borderRadius: 6,
        padding: '8px 6px 6px',
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.35 : dim ? 0.4 : 1,
        userSelect: 'none',
        transition: 'opacity 0.15s, border-color 0.15s',
        filter: locked ? 'grayscale(80%)' : 'none',
      }}
    >
      {locked && (
        <div style={{
          position: 'absolute', top: 2, left: 2,
          fontSize: 10, lineHeight: 1,
        }} title="Held by captured maiden">⛓️</div>
      )}
      {ownerSrc && (
        <img src={ownerSrc} alt="" style={{
          position: 'absolute', top: 2, right: 2,
          width: 18, height: 18, borderRadius: '50%',
          border: '1px solid var(--color-border)',
          objectFit: 'cover', background: '#1a1713',
        }} />
      )}
      {stackCount !== undefined && stackCount > 1 && (
        <div style={{
          position: 'absolute', bottom: 4, right: 5,
          background: 'rgba(200,149,74,0.85)', color: '#1a1713',
          fontWeight: 'bold', fontSize: 10, borderRadius: 3,
          padding: '1px 5px', lineHeight: 1.4,
        }}>
          ×{stackCount}
        </div>
      )}
      <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {SLOT_LABEL[eq.slot] ?? eq.slot}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text)', fontWeight: 'bold', lineHeight: 1.3, wordBreak: 'break-word' }}>
        {eq.name}
      </div>
      {eq.damage !== undefined && (
        <div style={{ fontSize: 10, color: '#e8a85a', marginTop: 2 }}>DMG {eq.damage}</div>
      )}
      {eq.bonuses.map((b, i) => (
        <div key={i} style={{ fontSize: 10, color: b.value >= 0 ? '#6ab06a' : '#c06060' }}>
          {b.label}: {b.value > 0 ? '+' : ''}{b.value}{b.isPercent ? '%' : ''}
        </div>
      ))}
      {eq.weight !== undefined && (
        <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 3 }}>
          ⚖️ {eq.weight} lb
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipment panel (inside modal)
// ---------------------------------------------------------------------------
interface EquipPanelProps {
  maiden: Maiden;
  allMaidens: Maiden[];
  inventory: Equipment[];
}
function EquipmentPanel({ maiden, allMaidens, inventory }: EquipPanelProps) {
  const { equipItem, unequipItem, toggleItemLock } = useGameStore();
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [dragEqId, setDragEqId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<'equipped' | 'available' | null>(null);
  const dragSourceRef = useRef<{ eq: Equipment; ownerMaiden: Maiden | null; fromEquipped: boolean } | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);

  // Weight capacity
  const carryMax = computeMaxCarryWeight(maiden.stats.strength);
  const carryUsed = computeCarryWeight(maiden.equipment);
  const carryPct = Math.min(100, (carryUsed / carryMax) * 100);
  const carryColor = carryUsed > carryMax ? '#c84a4a' : carryPct >= 85 ? '#e8a85a' : '#6ab06a';

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filterSlot, setFilterSlot] = useState<string>('all');
  const [filterName, setFilterName] = useState<string>('');
  const [hideEquipped, setHideEquipped] = useState<boolean>(false);

  // Build available pool: everything not equipped on THIS maiden (exclude enemy-faction items)
  const availablePool: { eq: Equipment; ownerMaiden: Maiden | null }[] = [
    ...inventory.filter(eq => eq.faction !== 'enemy').map(eq => ({ eq, ownerMaiden: null as Maiden | null })),
    ...allMaidens
      .filter(m => m.id !== maiden.id)
      .flatMap(m => m.equipment.filter(eq => eq.faction !== 'enemy').map(eq => ({ eq, ownerMaiden: m as Maiden | null }))),
  ];

  function doEquip(eq: Equipment, ownerMaiden: Maiden | null) {
    const isWeapon = eq.slot === 'weapon';
    const displaced = isWeapon ? maiden.equipment.find(e => e.slot === 'weapon') : undefined;
    const removedWeight = displaced ? (displaced.weight ?? 0) : 0;
    const newCarry = carryUsed - removedWeight + (eq.weight ?? 0);
    if (newCarry > carryMax) {
      setWeightError(`Cannot equip "${eq.name}" — carry weight would be ${newCarry} lb (max ${carryMax} lb for STR ${maiden.stats.strength})`);
      setTimeout(() => setWeightError(null), 4000);
      return;
    }
    setWeightError(null);
    equipItem(maiden.id, eq, ownerMaiden?.id ?? null);
  }

  function doUnequip(eq: Equipment) {
    unequipItem(maiden.id, eq);
  }

  function handleClickAvailable(eq: Equipment, ownerMaiden: Maiden | null) {
    if (ownerMaiden?.isCaptured) return; // locked — cannot take from captive
    if (ownerMaiden) {
      const prefix = ownerMaiden.isFallen ? '☠️ ' : '';
      const ownerLabel = ownerMaiden.nickname ?? ownerMaiden.name;
      setConfirm({
        message: `"${eq.name}" is ${ownerMaiden.isFallen ? 'on the body of fallen ' : 'currently equipped by '}${prefix}${ownerLabel}. Proceed to take it?`,
        onConfirm: () => { doEquip(eq, ownerMaiden); setConfirm(null); },
      });
    } else {
      doEquip(eq, null);
    }
  }

  function handleDropOnEquipped(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const src = dragSourceRef.current;
    if (!src || src.fromEquipped) return;
    if (src.ownerMaiden?.isCaptured) { dragSourceRef.current = null; setDragEqId(null); return; } // locked
    const { eq, ownerMaiden } = src;
    if (ownerMaiden) {
      const prefix = ownerMaiden.isFallen ? '☠️ ' : '';
      const ownerLabel = ownerMaiden.nickname ?? ownerMaiden.name;
      setConfirm({
        message: `"${eq.name}" is ${ownerMaiden.isFallen ? 'on the body of fallen ' : 'currently equipped by '}${prefix}${ownerLabel}. Proceed to take it?`,
        onConfirm: () => { doEquip(eq, ownerMaiden); setConfirm(null); },
      });
    } else {
      doEquip(eq, null);
    }
    dragSourceRef.current = null;
    setDragEqId(null);
  }

  function handleDropOnAvailable(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const src = dragSourceRef.current;
    if (!src || !src.fromEquipped) return;
    doUnequip(src.eq);
    dragSourceRef.current = null;
    setDragEqId(null);
  }

  const dropZone = (zone: 'equipped' | 'available'): React.CSSProperties => ({
    minHeight: 90,
    border: `2px dashed ${dragOver === zone ? 'var(--color-accent)' : 'var(--color-border)'}`,
    borderRadius: 6,
    padding: 8,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    background: dragOver === zone ? 'rgba(200,149,74,0.05)' : 'transparent',
    transition: 'border-color 0.15s',
  });

  if (maiden.isCaptured) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: 32, textAlign: 'center',
        background: 'rgba(180,0,0,0.07)', border: '1px solid rgba(180,0,0,0.3)',
        borderRadius: 8,
      }}>
        <span style={{ fontSize: 28 }}>⛓️</span>
        <div style={{ color: '#e08080', fontWeight: 'bold', fontSize: 13 }}>Equipment Unavailable</div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12, maxWidth: 280 }}>
          This maiden is currently held captive. Her equipment cannot be managed until she is freed.
        </div>
        {maiden.equipment.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#b06060' }}>
            {maiden.equipment.length} item{maiden.equipment.length !== 1 ? 's' : ''} held with captive
          </div>
        )}
      </div>
    );
  }

  if (maiden.isFallen) {
    return (
      <div>
        {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

        {/* Equipped — still unequippable from KIA body */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
            Equipped ({maiden.equipment.length}) — click or drag to unequip
          </div>
          <div
            style={dropZone('equipped')}
            onDragOver={e => { e.preventDefault(); setDragOver('equipped'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={handleDropOnAvailable}
          >
            {maiden.equipment.length === 0 ? (
              <span style={{ color: 'var(--color-text-muted)', fontSize: 12, alignSelf: 'center', padding: '4px 8px' }}>
                No items on body
              </span>
            ) : maiden.equipment.map(eq => (
              <EquipCard
                key={eq.id}
                eq={eq}
                equipped
                draggable
                dim={dragEqId === eq.id}
                onDragStart={e => {
                  dragSourceRef.current = { eq, ownerMaiden: null, fromEquipped: true };
                  setDragEqId(eq.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => { setDragEqId(null); setDragOver(null); dragSourceRef.current = null; }}
                onClick={() => doUnequip(eq)}
              />
            ))}
          </div>
        </div>

        {/* KIA notice — no new equipment allowed */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: 20, textAlign: 'center',
          background: 'rgba(80,80,80,0.1)', border: '1px dashed rgba(120,120,120,0.4)',
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 22 }}>✝️</span>
          <div style={{ color: '#888', fontWeight: 'bold', fontSize: 12 }}>Cannot Equip New Items</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 11, maxWidth: 280 }}>
            This maiden has fallen in battle. Items from the stockpile cannot be assigned to her.
            Items on her body can be retrieved above, or taken by other maidens via their equipment panels.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      {/* Carry weight bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>⚖️ Carry Weight</span>
          <span style={{ fontSize: 11, color: carryColor, fontWeight: 'bold' }}>{carryUsed} / {carryMax} lb</span>
        </div>
        <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${carryPct}%`, background: carryColor, borderRadius: 3, transition: 'width 0.3s, background 0.3s' }} />
        </div>
        {weightError && (
          <div style={{ marginTop: 6, padding: '5px 8px', background: 'rgba(200,74,74,0.12)', border: '1px solid rgba(200,74,74,0.4)', borderRadius: 4, fontSize: 11, color: '#e08080' }}>
            ⚠️ {weightError}
          </div>
        )}
      </div>

      {/* Equipped */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
          Equipped ({maiden.equipment.length}) — click or drag to unequip
        </div>
        <div
          style={dropZone('equipped')}
          onDragOver={e => { e.preventDefault(); setDragOver('equipped'); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={handleDropOnEquipped}
        >
          {maiden.equipment.length === 0 ? (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 12, alignSelf: 'center', padding: '4px 8px' }}>
              Nothing equipped — drag or click items below
            </span>
          ) : maiden.equipment.map(eq => (
            <div key={eq.id} style={{ position: 'relative', display: 'inline-block' }}>
              <EquipCard
                eq={eq}
                equipped
                draggable
                dim={dragEqId === eq.id}
                onDragStart={e => {
                  dragSourceRef.current = { eq, ownerMaiden: null, fromEquipped: true };
                  setDragEqId(eq.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => { setDragEqId(null); setDragOver(null); dragSourceRef.current = null; }}
                onClick={() => doUnequip(eq)}
              />
              <button
                onClick={e => { e.stopPropagation(); toggleItemLock(eq.inventoryId ?? eq.id); }}
                title={eq.isLocked ? 'Unlock (allow selling)' : 'Lock (prevent selling)'}
                style={{ position: 'absolute', top: 3, right: 3, background: eq.isLocked ? 'rgba(200,149,74,0.85)' : 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 3, padding: '1px 4px', cursor: 'pointer', fontSize: 10, lineHeight: 1.4, color: eq.isLocked ? '#1a1713' : '#888', zIndex: 2 }}
              >{eq.isLocked ? '🔒' : '🔓'}</button>
            </div>
          ))}
        </div>
      </div>

      {/* Available */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
          Available
          <span style={{ fontWeight: 'normal', marginLeft: 8, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
            — portrait badge = equipped by another maiden &nbsp;|&nbsp; 1 weapon max per maiden
          </span>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <select
            value={filterSlot}
            onChange={e => setFilterSlot(e.target.value)}
            style={{
              background: 'var(--color-bg-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)',
              borderRadius: 4, padding: '3px 6px', fontSize: 11, cursor: 'pointer',
            }}
          >
            <option value="all">All types</option>
            <option value="weapon">🔫 Weapon</option>
            <option value="head">🪖 Head</option>
            <option value="body">🧥 Body</option>
            <option value="legs">👢 Legs</option>
            <option value="accessory">🔭 Accessory</option>
            <option value="medal">🎖️ Medal</option>
            <option value="consumable">🧪 Consumable</option>
          </select>
          <input
            type="text"
            placeholder="Search name…"
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            style={{
              background: 'var(--color-bg-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)',
              borderRadius: 4, padding: '3px 8px', fontSize: 11, flex: '1 1 120px', minWidth: 100,
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={hideEquipped}
              onChange={e => setHideEquipped(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Hide equipped
          </label>
          {(filterSlot !== 'all' || filterName || hideEquipped) && (
            <button
              onClick={() => { setFilterSlot('all'); setFilterName(''); setHideEquipped(false); }}
              style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Filtered pool */}
        {(() => {
          const nameLower = filterName.trim().toLowerCase();
          const filteredPool = availablePool.filter(({ eq, ownerMaiden }) => {
            if (filterSlot !== 'all' && eq.slot !== filterSlot) return false;
            if (nameLower && !eq.name.toLowerCase().includes(nameLower)) return false;
            if (hideEquipped && ownerMaiden !== null) return false;
            return true;
          });
          return (
            <div
              style={dropZone('available')}
              onDragOver={e => { e.preventDefault(); setDragOver('available'); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={handleDropOnAvailable}
            >
              {filteredPool.length === 0 ? (
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12, alignSelf: 'center', padding: '4px 8px' }}>
                  {availablePool.length === 0 ? 'No equipment available' : 'No items match the filter'}
                </span>
              ) : (() => {
                // Stack inventory items (ownerMaiden === null) by template id; keep per-maiden items individual
                type StackEntry = { eq: Equipment; ownerMaiden: Maiden | null; count: number };
                const stackMap = new Map<string, StackEntry>();
                const individualEntries: StackEntry[] = [];
                for (const entry of filteredPool) {
                  if (entry.ownerMaiden === null) {
                    const key = entry.eq.id;
                    const existing = stackMap.get(key);
                    if (existing) { existing.count += 1; }
                    else { stackMap.set(key, { eq: entry.eq, ownerMaiden: null, count: 1 }); }
                  } else {
                    individualEntries.push({ eq: entry.eq, ownerMaiden: entry.ownerMaiden, count: 1 });
                  }
                }
                const displayEntries: StackEntry[] = [...stackMap.values(), ...individualEntries];
                return displayEntries.map(({ eq, ownerMaiden, count }) => {
                  const isLockedByCaptive = !!ownerMaiden?.isCaptured;
                  const isItemLocked = !ownerMaiden && !!eq.isLocked;
                  return (
                    <div key={`${eq.id}_${ownerMaiden?.id ?? 'inv'}`} style={{ position: 'relative', display: 'inline-block' }}>
                      <EquipCard
                        eq={eq}
                        ownerMaiden={ownerMaiden}
                        draggable={!isLockedByCaptive}
                        locked={isLockedByCaptive}
                        stackCount={count}
                        dim={dragEqId === eq.id}
                        onDragStart={e => {
                          dragSourceRef.current = { eq, ownerMaiden, fromEquipped: false };
                          setDragEqId(eq.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => { setDragEqId(null); setDragOver(null); dragSourceRef.current = null; }}
                        onClick={() => handleClickAvailable(eq, ownerMaiden)}
                      />
                      {isItemLocked && (
                        <div
                          title="Locked — cannot be sold at Radio Center"
                          style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 10, lineHeight: 1, pointerEvents: 'none' }}
                        >🔒</div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EXP & Skills tab
// ---------------------------------------------------------------------------
function ExpRow({ label, exp }: { label: string; exp: { theoryExp: number; practicalExp: number } }) {
  const tLv = theoryLv(exp.theoryExp);
  const pLv = practicalLv(exp.practicalExp);
  const tNext = (tLv + 1) * 500;
  const pNext = (pLv + 1) * 50;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text)', marginBottom: 4 }}>
        <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          Theory Lv{tLv} · Practical Lv{pLv}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>Theory ({exp.theoryExp}/{tNext})</div>
          <div style={{ width: '100%', height: 5, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (exp.theoryExp % 500) / 500 * 100)}%`, height: '100%', background: 'var(--color-accent)' }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>Practical ({exp.practicalExp}/{pNext})</div>
          <div style={{ width: '100%', height: 5, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (exp.practicalExp % 50) / 50 * 100)}%`, height: '100%', background: '#6ab06a' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpTab({ maiden }: { maiden: Maiden }) {
  const exp = maiden.expData ?? { weapons: {}, scout: { theoryExp: 0, practicalExp: 0 }, sneak: { theoryExp: 0, practicalExp: 0 } };
  const weaponEntries = Object.entries(exp.weapons);
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 0 }}>
        Theory EXP is gained from Training Grounds after missions. Practical EXP is earned during combat.
      </p>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Combat Skills</div>
      <ExpRow label="Scout" exp={exp.scout} />
      <ExpRow label="Sneak" exp={exp.sneak} />
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 }}>Weapon Proficiencies</div>
      {weaponEntries.length === 0 ? (
        <div style={{ fontSize: 12, color: '#555' }}>No weapon EXP recorded yet. Use weapons in combat to gain proficiency.</div>
      ) : weaponEntries.map(([wt, wexp]: any) => (
        <ExpRow key={wt} label={wt.replace(/_/g, ' ')} exp={wexp} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info tab
// ---------------------------------------------------------------------------
function InfoTab({ maiden, nickname, onNicknameChange, onSaveNickname, onToggleFavourite }: {
  maiden: Maiden;
  nickname: string;
  onNicknameChange: (v: string) => void;
  onSaveNickname: () => void;
  onToggleFavourite: () => void;
}) {
  return (
    <>
      <Section title="Nickname">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={nickname}
            onChange={e => onNicknameChange(e.target.value)}
            placeholder="Set a nickname..."
            style={{ flex: 1, background: '#0e0d0b', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 10px', color: 'var(--color-text)', fontSize: 13 }}
          />
          <Btn onClick={onSaveNickname}>Save</Btn>
        </div>
        <button
          onClick={onToggleFavourite}
          style={{
            marginTop: 8, background: maiden.isFavourite ? 'rgba(255,215,0,0.15)' : 'transparent',
            border: `1px solid ${maiden.isFavourite ? '#ffd700' : 'var(--color-border)'}`,
            color: maiden.isFavourite ? '#ffd700' : 'var(--color-text-muted)',
            borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12,
          }}
        >
          {maiden.isFavourite ? '★ Remove Favourite' : '☆ Set as Favourite'}
        </button>
      </Section>

      <Section title="Base Stats">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {(Object.entries(maiden.stats) as [string, number][]).map(([k, v]) => (
            <BonusStatRow key={k} maiden={maiden} statKey={k} base={v} />
          ))}
          <BonusStatRow
            key="maxHp"
            maiden={maiden}
            statKey="hp"
            label="Max HP"
            base={7 + 2 * maiden.stats.constitution}
            baseFormula={`7 + 2 × CON (${maiden.stats.constitution}) = ${7 + 2 * maiden.stats.constitution}`}
          />
          <StatRow label="Current HP" value={maiden.currentHp} danger={maiden.currentHp < maiden.maxHp * 0.4} />
          <StatRow label="Kills" value={maiden.killCount} />
          <StatRow label="Missions" value={maiden.missionCount} />
        </div>
      </Section>

      <Section title="Morale">
        <MoraleDisplay maiden={maiden} />
      </Section>

      <Section title="Qualifications">
        {maiden.qualifications.length === 0
          ? <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>None</div>
          : maiden.qualifications.map(q => (
            <div key={q.id} style={{ marginBottom: 6, padding: '6px 10px', background: '#0e0d0b', borderRadius: 4, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 'bold' }}>{q.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{q.description}</div>
            </div>
          ))
        }
      </Section>

      {maiden.skills.length > 0 && (
        <Section title="Skills">
          {maiden.skills.map(sk => (
            <div key={sk.id} style={{ marginBottom: 4, fontSize: 12, color: 'var(--color-text)' }}>
              <span style={{ color: 'var(--color-accent)' }}>{sk.name}</span>: {sk.description}
            </div>
          ))}
        </Section>
      )}

      {maiden.isCaptured && (
        <div style={{ marginTop: 12, padding: 10, background: 'rgba(184,64,64,0.15)', border: '1px solid var(--color-danger)', borderRadius: 6, fontSize: 13, color: '#e88' }}>
          This maiden has been captured by the enemy.
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Maiden detail modal
// ---------------------------------------------------------------------------
interface ModalProps {
  maiden: Maiden;
  allMaidens: Maiden[];
  inventory: Equipment[];
  onClose: () => void;
  onSaveNickname: (id: string, nick: string) => void;
  onToggleFavourite: (id: string) => void;
}
function MaidenModal({ maiden, allMaidens, inventory, onClose, onSaveNickname, onToggleFavourite }: ModalProps) {
  const iconSrc = getMaidenIcon(maiden.imgId);
  const portraitSrc = getMaidenPortrait(maiden.imgId);
  const [nickname, setNickname] = useState(maiden.nickname ?? '');
  const [tab, setTab] = useState<'info' | 'equip' | 'exp'>('info');

  useEffect(() => { setNickname(maiden.nickname ?? ''); }, [maiden.id, maiden.nickname]);

  function handleBackdrop(e: React.MouseEvent) {
    if ((e.target as HTMLElement).dataset.backdrop === 'true') onClose();
  }

  return (
    <div
      data-backdrop="true"
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        width: '100%', maxWidth: 920,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'row',
        boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}>
        {/* Portrait panel */}
        <div style={{
          width: 200, flexShrink: 0,
          background: '#0c0b09',
          borderRight: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <img
            src={portraitSrc}
            alt={maiden.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              filter: maiden.isFallen ? 'grayscale(100%)' : maiden.isCaptured ? 'saturate(0.5) brightness(0.8)' : 'none',
              opacity: maiden.isFallen ? 0.45 : 1,
              display: 'block',
            }}
            onError={e => {
              // Fallback to icon if portrait not found
              (e.currentTarget as HTMLImageElement).src = iconSrc;
              (e.currentTarget as HTMLImageElement).style.objectFit = 'contain';
              (e.currentTarget as HTMLImageElement).style.padding = '16px';
            }}
          />
          {maiden.isCaptured && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(180,0,0,0.35)',
              pointerEvents: 'none',
            }} />
          )}
          {maiden.isCaptured && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(120,0,0,0.75)',
              textAlign: 'center', padding: '6px 0', fontSize: 12,
              color: '#ff9999', letterSpacing: 1, fontWeight: 'bold',
            }}>⛓️ CAPTURED</div>
          )}
          {maiden.isFallen && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.65)',
              textAlign: 'center', padding: '6px 0', fontSize: 12,
              color: '#888', letterSpacing: 1,
            }}>KIA</div>
          )}
        </div>

        {/* Right panel: header + tabs + content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}>
          <img
            src={iconSrc}
            alt={maiden.name}
            style={{
              width: 52, height: 52, borderRadius: 5,
              border: `1px solid ${maiden.isCaptured ? '#b84040' : 'var(--color-border)'}`,
              objectFit: 'cover',
              filter: maiden.isFallen ? 'grayscale(100%)' : maiden.isCaptured ? 'saturate(0.5) brightness(0.8)' : 'none',
              opacity: maiden.isFallen ? 0.5 : 1,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: maiden.isFallen ? '#666' : maiden.isCaptured ? '#e08080' : 'var(--color-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {maiden.nickname ?? maiden.name}
              {maiden.isFallen && <span style={{ marginLeft: 6, color: '#666' }}>[KIA]</span>}
              {maiden.isCaptured && !maiden.isFallen && <span style={{ marginLeft: 6, color: '#e08080' }}>⛓️ [Captured]</span>}
              {maiden.isFavourite && !maiden.isFallen && !maiden.isCaptured && <span style={{ marginLeft: 6, color: '#ffd700' }}>[★]</span>}
            </div>
            {maiden.nickname && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{maiden.name}</div>
            )}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
              {maiden.tags.map(tag => (
                <TagTooltip key={tag.id} tagId={tag.id} />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: 20, cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: 4 }}
          >x</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          {(['info', 'equip', 'exp'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 13,
                background: tab === t ? 'rgba(200,149,74,0.1)' : 'transparent',
                color: tab === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
                borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
                fontWeight: tab === t ? 'bold' : 'normal',
              }}
            >
              {t === 'info' ? 'Info' : t === 'equip' ? 'Equipment' : 'EXP & Skills'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {tab === 'info' ? (
            <InfoTab
              maiden={maiden}
              nickname={nickname}
              onNicknameChange={setNickname}
              onSaveNickname={() => onSaveNickname(maiden.id, nickname)}
              onToggleFavourite={() => onToggleFavourite(maiden.id)}
            />
          ) : tab === 'equip' ? (
            <EquipmentPanel maiden={maiden} allMaidens={allMaidens} inventory={inventory} />
          ) : (
            <ExpTab maiden={maiden} />
          )}
        </div>
        </div>{/* end right panel */}
      </div>{/* end modal box */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List view row
// ---------------------------------------------------------------------------
type SortKey = 'name' | 'status' | 'hp' | 'morale' | 'str' | 'dex' | 'con' | 'stg' | 'awr' | 'cha' | 'kills' | 'missions' | 'weapon';

function getStatBonus(m: Maiden, stat: string): number {
  let total = 0;
  for (const eq of m.equipment)
    for (const b of eq.bonuses) if (b.stat === stat && !b.isPercent) total += b.value;
  for (const q of m.qualifications)
    for (const b of q.bonuses) if (b.stat === stat && !b.isPercent) total += b.value;
  for (const tag of m.tags) {
    const def = TAG_DEFS[tag.id];
    if (def) for (const b of def.bonuses) if (b.stat === stat && !b.isPercent) total += b.value;
  }
  return total;
}

function getEffectiveStat(m: Maiden, statField: keyof Maiden['stats'], statKey: string): number {
  return (m.stats[statField] as number) + getStatBonus(m, statKey);
}

function getMaidenSortValue(m: Maiden, key: SortKey): number | string {
  const morale = Math.max(0, Math.min(100, 50 + m.stats.charm + (m.moralePermanentBonus ?? 0)));
  const weapon = m.equipment.find(e => e.slot === 'weapon');
  switch (key) {
    case 'name':     return (m.nickname ?? m.name).toLowerCase();
    case 'status':   return m.isFallen ? 2 : m.isCaptured ? 1 : 0;
    case 'hp':       return m.currentHp / Math.max(1, m.maxHp);
    case 'morale':   return morale;
    case 'str':      return getEffectiveStat(m, 'strength', 'strength');
    case 'dex':      return getEffectiveStat(m, 'dexterity', 'dexterity');
    case 'con':      return getEffectiveStat(m, 'constitution', 'constitution');
    case 'stg':      return getEffectiveStat(m, 'strategy', 'strategy');
    case 'awr':      return getEffectiveStat(m, 'awareness', 'awareness');
    case 'cha':      return getEffectiveStat(m, 'charm', 'charm');
    case 'kills':    return m.killCount;
    case 'missions': return m.missionCount;
    case 'weapon':   return (weapon?.name ?? '').toLowerCase();
  }
}

function MemberListView({ maidens, onSelect }: { maidens: Maiden[]; onSelect: (id: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); } // default desc for numbers, asc for name/weapon
  }

  const sorted = [...maidens].sort((a, b) => {
    const av = getMaidenSortValue(a, sortKey);
    const bv = getMaidenSortValue(b, sortKey);
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  const colHdr = (_label: string, key: SortKey, minW = 36): React.CSSProperties => ({
    padding: '6px 8px', fontSize: 10, color: sortKey === key ? 'var(--color-accent)' : 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap', minWidth: minW, background: 'var(--color-surface)',
    borderBottom: `2px solid ${sortKey === key ? 'var(--color-accent)' : 'var(--color-border)'}`,
    textAlign: 'center',
  });

  const SortArrow = ({ k }: { k: SortKey }) => sortKey !== k ? null : (
    <span style={{ marginLeft: 2, fontSize: 8 }}>{sortAsc ? '▲' : '▼'}</span>
  );

  const statColor = (v: number) => v >= 14 ? '#6ab06a' : v >= 8 ? 'var(--color-text)' : '#e08080';

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--color-border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...colHdr('', 'name', 28), textAlign: 'left', paddingLeft: 10 }} />
            <th style={{ ...colHdr('Name', 'name', 100), textAlign: 'left' }} onClick={() => handleSort('name')}>Name <SortArrow k="name" /></th>
            <th style={colHdr('Status', 'status', 60)} onClick={() => handleSort('status')}>Status <SortArrow k="status" /></th>
            <th style={colHdr('HP', 'hp')} onClick={() => handleSort('hp')}>HP <SortArrow k="hp" /></th>
            <th style={colHdr('Morale', 'morale')} onClick={() => handleSort('morale')}>Morale <SortArrow k="morale" /></th>
            <th style={colHdr('STR', 'str')} onClick={() => handleSort('str')}>STR <SortArrow k="str" /></th>
            <th style={colHdr('DEX', 'dex')} onClick={() => handleSort('dex')}>DEX <SortArrow k="dex" /></th>
            <th style={colHdr('CON', 'con')} onClick={() => handleSort('con')}>CON <SortArrow k="con" /></th>
            <th style={colHdr('STG', 'stg')} onClick={() => handleSort('stg')}>STG <SortArrow k="stg" /></th>
            <th style={colHdr('AWR', 'awr')} onClick={() => handleSort('awr')}>AWR <SortArrow k="awr" /></th>
            <th style={colHdr('CHA', 'cha')} onClick={() => handleSort('cha')}>CHA <SortArrow k="cha" /></th>
            <th style={colHdr('Kills', 'kills')} onClick={() => handleSort('kills')}>Kills <SortArrow k="kills" /></th>
            <th style={colHdr('Msn', 'missions')} onClick={() => handleSort('missions')}>Msn <SortArrow k="missions" /></th>
            <th style={{ ...colHdr('Weapon', 'weapon', 110), textAlign: 'left' }} onClick={() => handleSort('weapon')}>Weapon <SortArrow k="weapon" /></th>
            <th style={{ ...colHdr('Tags', 'name', 80), cursor: 'default', textAlign: 'left' }}>Tags</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m, i) => {
            const morale = Math.max(0, Math.min(100, 50 + m.stats.charm + (m.moralePermanentBonus ?? 0)));
            const moraleColor = morale >= 70 ? '#4a8c4a' : morale >= 30 ? '#c8a84b' : '#b84040';
            const hpPct = m.maxHp > 0 ? m.currentHp / m.maxHp : 0;
            const hpColor = hpPct < 0.4 ? '#b84040' : hpPct < 0.7 ? '#c8954a' : '#4a8c4a';
            const weapon = m.equipment.find(e => e.slot === 'weapon');
            const isEven = i % 2 === 0;
            const rowBg = m.isFallen ? '#0a0907' : m.isCaptured ? 'rgba(120,0,0,0.07)' : isEven ? 'transparent' : 'rgba(255,255,255,0.02)';
            return (
              <tr
                key={m.id}
                onClick={() => onSelect(m.id)}
                style={{ background: rowBg, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,149,74,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
              >
                {/* Icon */}
                <td style={{ padding: '4px 4px 4px 8px', width: 32 }}>
                  <img src={getMaidenIcon(m.imgId)} alt={m.name}
                    style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3, display: 'block',
                      opacity: m.isFallen ? 0.35 : 1,
                      filter: m.isCaptured ? 'saturate(0.4)' : m.isFallen ? 'grayscale(1)' : 'none',
                    }} />
                </td>
                {/* Name */}
                <td style={{ padding: '4px 8px', color: m.isFallen ? '#555' : m.isCaptured ? '#e08080' : 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {m.isFavourite && <span style={{ color: '#ffd700', marginRight: 3 }}>★</span>}
                  {m.nickname ?? m.name.split(' ')[0]}
                  {m.nickname && <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 400 }}>{m.name}</div>}
                </td>
                {/* Status */}
                <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: 11 }}>
                  {m.isFallen ? <span style={{ color: '#666' }}>💀 KIA</span>
                    : m.isCaptured ? <span style={{ color: '#e08080' }}>⛓️ Cap.</span>
                    : <span style={{ color: '#6ab06a' }}>✓ Active</span>}
                </td>
                {/* HP */}
                <td style={{ padding: '4px 8px', textAlign: 'center', minWidth: 72 }}>
                  <div style={{ fontSize: 10, color: hpColor, fontWeight: 700 }}>{m.currentHp}/{m.maxHp}</div>
                  <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                    <div style={{ height: '100%', width: `${hpPct * 100}%`, background: hpColor, borderRadius: 2 }} />
                  </div>
                </td>
                {/* Morale */}
                <td style={{ padding: '4px 8px', textAlign: 'center', minWidth: 64 }}>
                  <div style={{ fontSize: 10, color: moraleColor, fontWeight: 700 }}>{Math.round(morale)}</div>
                  <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                    <div style={{ height: '100%', width: `${morale}%`, background: moraleColor, borderRadius: 2 }} />
                  </div>
                </td>
                {/* Stats */}
                {([
                  ['strength','strength'],
                  ['dexterity','dexterity'],
                  ['constitution','constitution'],
                  ['strategy','strategy'],
                  ['awareness','awareness'],
                  ['charm','charm'],
                ] as const).map(([field, key]) => {
                  const eff = (m.stats[field] as number) + getStatBonus(m, key);
                  return (
                    <td key={field} style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, color: statColor(eff), fontSize: 12 }}>
                      {eff}
                    </td>
                  );
                })}
                {/* Kills / Missions */}
                <td style={{ padding: '4px 8px', textAlign: 'center', color: m.killCount > 0 ? '#c8954a' : 'var(--color-text-muted)', fontSize: 12 }}>{m.killCount}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>{m.missionCount}</td>
                {/* Weapon */}
                <td style={{ padding: '4px 8px', color: weapon ? 'var(--color-text)' : '#444', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {weapon ? weapon.name : <span style={{ fontStyle: 'italic' }}>—</span>}
                </td>
                {/* Tags */}
                <td style={{ padding: '4px 8px' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {m.tags.slice(0, 4).map(t => {
                      const def = TAG_DEFS[t.id];
                      const cat = def?.category;
                      const c = cat === 'positive' ? '#7ecb7e' : cat === 'negative' ? '#d46b6b' : cat === 'double_edged' ? '#d4a84b' : 'var(--color-text-muted)';
                      return (
                        <span key={t.id} title={def?.name ?? t.id} style={{ fontSize: 9, color: c, background: `${c}18`, border: `1px solid ${c}55`, borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap' }}>
                          {def?.name ?? t.id}
                        </span>
                      );
                    })}
                    {m.tags.length > 4 && <span style={{ fontSize: 9, color: '#555' }}>+{m.tags.length - 4}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {maidens.length === 0 && (
        <div style={{ padding: 32, color: 'var(--color-text-muted)', textAlign: 'center' }}>No maidens to display.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Members page
// ---------------------------------------------------------------------------
export default function Members() {
  const { maidens, inventory, setMaiden, unequipItem } = useGameStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('members_viewMode') as 'grid' | 'list') ?? 'grid'
  );
  const [showAlive, setShowAlive] = useState<boolean>(
    () => localStorage.getItem('members_showAlive') !== 'false'
  );
  const [showCaptured, setShowCaptured] = useState<boolean>(
    () => localStorage.getItem('members_showCaptured') !== 'false'
  );
  const [showDead, setShowDead] = useState<boolean>(
    () => localStorage.getItem('members_showDead') !== 'false'
  );
  const [heroineOnly, setHeroineOnly] = useState<boolean>(
    () => localStorage.getItem('members_heroineOnly') === 'true'
  );

  function setViewModePersist(v: 'grid' | 'list') { localStorage.setItem('members_viewMode', v); setViewMode(v); }
  function setShowAlivePersist(v: boolean) { localStorage.setItem('members_showAlive', String(v)); setShowAlive(v); }
  function setShowCapturedPersist(v: boolean) { localStorage.setItem('members_showCaptured', String(v)); setShowCaptured(v); }
  function setShowDeadPersist(v: boolean) { localStorage.setItem('members_showDead', String(v)); setShowDead(v); }
  function setHeroineOnlyPersist(v: boolean) { localStorage.setItem('members_heroineOnly', String(v)); setHeroineOnly(v); }

  const livingMaidens = maidens.filter(m => !m.isFallen && !m.isCaptured);
  const capturedMaidens = maidens.filter(m => m.isCaptured);
  const fallenMaidens = maidens.filter(m => m.isFallen);
  const selectedMaiden = maidens.find(m => m.id === selected) ?? null;

  // Status-filtered subsets used by grid & list views
  const gridLiving   = showAlive   ? livingMaidens.filter(m => !heroineOnly || m.type === 'heroine')   : [];
  const gridCaptured = showCaptured ? capturedMaidens.filter(m => !heroineOnly || m.type === 'heroine') : [];
  const gridFallen   = showDead     ? fallenMaidens.filter(m => !heroineOnly || m.type === 'heroine')   : [];
  const listMaidens  = [
    ...(showAlive   ? livingMaidens.filter(m => !heroineOnly || m.type === 'heroine')   : []),
    ...(showCaptured ? capturedMaidens.filter(m => !heroineOnly || m.type === 'heroine') : []),
    ...(showDead     ? fallenMaidens.filter(m => !heroineOnly || m.type === 'heroine')   : []),
  ];

  const stageW = COLS * (CARD_W + GRID_GAP) + GRID_GAP;
  const rows = Math.ceil((gridLiving.length + gridCaptured.length) / COLS);
  const stageH = rows * (CARD_H + GRID_GAP) + GRID_GAP;
  const graveRows = Math.ceil(gridFallen.length / COLS);
  const graveH = graveRows * (CARD_H + GRID_GAP) + GRID_GAP;

  function saveNickname(id: string, nick: string) {
    setMaiden(id, { nickname: nick.trim() || undefined });
  }

  function toggleFavourite(id: string) {
    maidens.forEach(m => { if (m.isFavourite) setMaiden(m.id, { isFavourite: false }); });
    setMaiden(id, { isFavourite: true });
  }

  const viewToggle = (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['grid', 'list'] as const).map(v => (
        <button
          key={v}
          onClick={() => setViewModePersist(v)}
          title={v === 'grid' ? 'Grid view' : 'List view'}
          style={{
            padding: '5px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
            background: viewMode === v ? 'rgba(200,149,74,0.2)' : 'transparent',
            color: viewMode === v ? 'var(--color-accent)' : 'var(--color-text-muted)',
            border: `1px solid ${viewMode === v ? 'var(--color-accent-dark)' : 'var(--color-border)'}`,
            fontWeight: viewMode === v ? 'bold' : 'normal',
          }}
        >
          {v === 'grid' ? '⊞ Grid' : '☰ List'}
        </button>
      ))}
    </div>
  );

  const statusFilters = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {([
        { label: '🟢 Alive',    value: showAlive,    set: setShowAlivePersist,    count: livingMaidens.length },
        { label: '⛓️ Captive',  value: showCaptured, set: setShowCapturedPersist, count: capturedMaidens.length },
        { label: '☠️ KIA',      value: showDead,     set: setShowDeadPersist,     count: fallenMaidens.length },
      ] as const).map(({ label, value, set, count }) => (
        <label
          key={label}
          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            fontSize: 12, color: value ? 'var(--color-text)' : 'var(--color-text-muted)',
            userSelect: 'none' }}
        >
          <input
            type="checkbox"
            checked={value}
            onChange={e => set(e.target.checked)}
            style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
          />
          {label}
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 1 }}>({count})</span>
        </label>
      ))}
      <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
          fontSize: 12, color: heroineOnly ? 'var(--color-accent)' : 'var(--color-text-muted)',
          userSelect: 'none' }}
      >
        <input
          type="checkbox"
          checked={heroineOnly}
          onChange={e => setHeroineOnlyPersist(e.target.checked)}
          style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
        />
        ⭐ Heroines only
      </label>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Members</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {statusFilters}
          {viewToggle}
        </div>
      </div>

      {viewMode === 'grid' ? (
        <>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <Stage width={stageW} height={Math.max(stageH, 160)}>
              <Layer>
                {[...gridLiving, ...gridCaptured].map((m, idx) => {
                  const col = idx % COLS;
                  const row = Math.floor(idx / COLS);
                  return (
                    <MaidenCard
                      key={m.id} maiden={m}
                      x={GRID_GAP + col * (CARD_W + GRID_GAP)}
                      y={GRID_GAP + row * (CARD_H + GRID_GAP)}
                      selected={selected === m.id}
                      onSelect={() => setSelected(m.id)}
                    />
                  );
                })}
              </Layer>
            </Stage>
            {gridLiving.length === 0 && gridCaptured.length === 0 && (
              <div style={{ padding: 32, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                No maidens in the base. Go recruit some!
              </div>
            )}
          </div>

          {gridFallen.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, color: 'var(--color-text-muted)', margin: 0 }}>
                  Memorial — Fallen in Battle
                </h3>
                <button
                  onClick={() => {
                    for (const m of fallenMaidens) {
                      for (const eq of [...m.equipment]) {
                        if (eq.faction !== 'enemy') unequipItem(m.id, eq);
                      }
                    }
                  }}
                  disabled={fallenMaidens.every(m => m.equipment.filter(e => e.faction !== 'enemy').length === 0)}
                  style={{
                    padding: '6px 14px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)',
                    background: 'rgba(200,149,74,0.12)', color: 'var(--color-accent)', cursor: 'pointer',
                    opacity: fallenMaidens.every(m => m.equipment.filter(e => e.faction !== 'enemy').length === 0) ? 0.4 : 1,
                  }}
                >
                  ☠️ Strip All KIA Gear
                </button>
              </div>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', padding: 16 }}>
                <Stage width={stageW} height={Math.max(graveH, 100)}>
                  <Layer>
                    {gridFallen.map((m, idx) => {
                      const col = idx % COLS;
                      const row = Math.floor(idx / COLS);
                      return (
                        <FallenMaidenCard
                          key={m.id} maiden={m}
                          x={GRID_GAP + col * (CARD_W + GRID_GAP)}
                          y={GRID_GAP + row * (CARD_H + GRID_GAP)}
                          selected={selected === m.id}
                          onSelect={() => setSelected(m.id)}
                        />
                      );
                    })}
                  </Layer>
                </Stage>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {listMaidens.length > 0 && <MemberListView maidens={listMaidens} onSelect={setSelected} />}
          {listMaidens.length === 0 && (
            <div style={{ padding: 32, color: 'var(--color-text-muted)', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              No maidens in the base. Go recruit some!
            </div>
          )}
        </>
      )}

      {selectedMaiden && (
        <MaidenModal
          maiden={selectedMaiden}
          allMaidens={maidens}
          inventory={inventory}
          onClose={() => setSelected(null)}
          onSaveNickname={saveNickname}
          onToggleFavourite={toggleFavourite}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, borderBottom: '1px solid var(--color-border)', paddingBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MoraleDisplay — breakdown bar with tooltip
// ---------------------------------------------------------------------------
function MoraleDisplay({ maiden }: { maiden: Maiden }) {
  const [tipVisible, setTipVisible] = useState(false);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  const base = 50;
  const charm = maiden.stats.charm;
  const permanent = maiden.moralePermanentBonus ?? 0;
  const morale = Math.max(0, Math.min(100, base + charm + permanent));
  const moraleColor = morale >= 70 ? '#4a8c4a' : morale >= 30 ? '#c8a84b' : '#b84040';

  function handleMouseEnter(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 230);
    setTipPos({ x, y: rect.bottom + 8 });
    setTipVisible(true);
  }

  return (
    <div>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTipVisible(false)}
        style={{ cursor: 'help' }}
      >
        {/* Label row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Personal Morale</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <strong style={{ color: moraleColor }}>{Math.round(morale)}</strong>
          </span>
        </div>
        {/* Bar */}
        <div style={{ background: '#0e0d0b', borderRadius: 4, height: 10, overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative' }}>
          <div style={{ height: '100%', width: `${morale}%`, background: moraleColor, transition: 'width 0.4s' }} />
          {/* Inline value label on bar */}
          <span style={{ position: 'absolute', left: 6, top: 0, lineHeight: '10px', fontSize: 9, color: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}>
            {Math.round(morale)} / 100
          </span>
        </div>
      </div>
      {/* Always-visible breakdown row */}
      <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <span>Base: <span style={{ color: 'var(--color-text)' }}>50</span></span>
        <span>Charm: <span style={{ color: '#6db86d' }}>+{charm}</span></span>
        <span>Perm: <span style={{ color: permanent > 0 ? '#6db86d' : permanent < 0 ? '#cc6060' : 'var(--color-text-muted)' }}>
          {permanent >= 0 ? '+' : ''}{permanent}
        </span></span>
      </div>
      {/* Tooltip */}
      {tipVisible && (
        <div style={{
          position: 'fixed', left: tipPos.x, top: tipPos.y, zIndex: 9999,
          background: '#1e1c17', border: '1px solid var(--color-accent)',
          borderRadius: 6, padding: '10px 14px', minWidth: 210,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 'bold', marginBottom: 6 }}>Morale breakdown</div>
          {[
            { label: 'Base', value: base, showSign: false },
            { label: 'Charm', value: charm, showSign: true },
            { label: 'Permanent bonus', value: permanent, showSign: true },
          ].map(({ label, value, showSign }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
              <span style={{ color: value > 0 ? '#6db86d' : value < 0 ? '#cc6060' : 'var(--color-text)', fontWeight: 'bold' }}>
                {showSign && value >= 0 ? '+' : ''}{value}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #333', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total</span>
            <strong style={{ color: moraleColor }}>{morale}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BonusStatRow — base stat + colour-coded bonuses with breakdown tooltip
// ---------------------------------------------------------------------------
interface BonusBreakdown { source: string; value: number; isPercent: boolean; }

function collectStatBonuses(maiden: Maiden, stat: string): BonusBreakdown[] {
  const result: BonusBreakdown[] = [];
  for (const eq of maiden.equipment) {
    for (const b of eq.bonuses) {
      if (b.stat === stat) result.push({ source: eq.name, value: b.value, isPercent: b.isPercent });
    }
  }
  for (const q of maiden.qualifications) {
    for (const b of q.bonuses) {
      if (b.stat === stat) result.push({ source: q.name, value: b.value, isPercent: b.isPercent });
    }
  }
  for (const tag of maiden.tags) {
    const def = TAG_DEFS[tag.id];
    if (def) {
      for (const b of def.bonuses) {
        if (b.stat === stat) result.push({ source: `[${def.name}]`, value: b.value, isPercent: b.isPercent });
      }
    }
  }
  return result;
}

function BonusStatRow({ maiden, statKey, base, label: labelOverride, baseFormula }: {
  maiden: Maiden;
  statKey: string;
  base: number;
  /** Override the display label (defaults to capitalised statKey) */
  label?: string;
  /** Optional formula string shown in tooltip under the base value, e.g. "7 + 2 × CON" */
  baseFormula?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const breakdowns = collectStatBonuses(maiden, statKey);
  const totalBonus = breakdowns.reduce((s, b) => s + b.value, 0);
  const displayLabel = labelOverride ?? statKey;

  function handleMouseEnter(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Try to place tooltip to the right; fall back left if near edge
    const rightEdge = rect.right + 8;
    const x = rightEdge + 220 > window.innerWidth ? rect.left - 228 : rightEdge;
    setPos({ x, y: rect.top });
    setVisible(true);
  }

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        style={{
          display: 'flex', justifyContent: 'space-between', padding: '3px 8px',
          background: 'rgba(200,149,74,0.04)', borderRadius: 3,
          cursor: breakdowns.length > 0 ? 'help' : 'default',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{displayLabel}</span>
        <span style={{ fontSize: 12, fontWeight: 'bold', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text)' }}>{base}</span>
          {totalBonus !== 0 && (
            <span style={{ color: totalBonus > 0 ? '#6db86d' : '#cc6060', fontSize: 11, fontWeight: 'bold' }}>
              {totalBonus > 0 ? '+' : ''}{totalBonus}
            </span>
          )}
        </span>
      </div>
      {visible && breakdowns.length > 0 && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
          background: '#1e1c17', border: '1px solid var(--color-accent)',
          borderRadius: 6, padding: '10px 12px', minWidth: 200,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 'bold', marginBottom: 6, textTransform: 'capitalize' }}>
            {displayLabel} breakdown
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: baseFormula ? 2 : 4, paddingBottom: baseFormula ? 0 : 4, borderBottom: baseFormula ? 'none' : '1px solid #333' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Base</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{base}</span>
          </div>
          {baseFormula && (
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #333', textAlign: 'right', fontStyle: 'italic' }}>
              {baseFormula}
            </div>
          )}
          {breakdowns.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 2 }}>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.source}</span>
              <span style={{ color: b.value > 0 ? '#6db86d' : '#cc6060', fontWeight: 'bold', flexShrink: 0 }}>
                {b.value > 0 ? '+' : ''}{b.value}{b.isPercent ? '%' : ''}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #333', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total</span>
            <span style={{ color: totalBonus > 0 ? '#6db86d' : totalBonus < 0 ? '#cc6060' : 'var(--color-text)', fontWeight: 'bold' }}>
              {base + totalBonus} {totalBonus !== 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>({base}{totalBonus > 0 ? '+' : ''}{totalBonus})</span>}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function StatRow({ label, value, danger = false }: { label: string; value: number | string; danger?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', background: 'rgba(200,149,74,0.04)', borderRadius: 3 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 'bold', color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}>{value}</span>
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--color-accent-dark)', border: 'none', color: '#fff',
      borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
    }}>{children}</button>
  );
}
