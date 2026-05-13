import { useState, useEffect, useRef } from 'react';
import JSONEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.min.css';

// Minimal dark-mode patch for jsoneditor inside this panel
const jsoneditorDarkStyle = `
.jsoneditor { border-color: #444 !important; background: #1a1915 !important; }
.jsoneditor-menu { background: #2a2820 !important; border-bottom-color: #444 !important; }
.jsoneditor-tree, .jsoneditor-text { background: #1a1915 !important; color: #d4c9a8 !important; }
.jsoneditor-field, .jsoneditor-value { color: #d4c9a8 !important; }
.jsoneditor-value.jsoneditor-string { color: #a8d4a8 !important; }
.jsoneditor-value.jsoneditor-number { color: #d4a8a8 !important; }
.jsoneditor-value.jsoneditor-boolean { color: #a8c0d4 !important; }
.jsoneditor-separator { color: #888 !important; }
.jsoneditor-readonly { color: #888 !important; }
.ace-jsoneditor { background: #1a1915 !important; color: #d4c9a8 !important; }
.ace-jsoneditor .ace_gutter { background: #2a2820 !important; color: #888 !important; }
`;

import qualificationsData from '../data/qualifications.json';
import equipmentData from '../data/equipment.json';
import compositionsData from '../data/compositions.json';
import buildingsData from '../data/buildings.json';
import tagsData from '../data/tags.json';
import { HEROINE_DEFINITIONS } from '../data/heroines';
import { SEED_MAIDENS } from '../data/seed';

type AdminTab = 'tags' | 'qualifications' | 'equipment' | 'compositions' | 'buildings' | 'heroines' | 'seed';

const INITIAL_DATA: Record<AdminTab, any[]> = {
  tags: tagsData as any[],
  qualifications: qualificationsData as any[],
  equipment: equipmentData as any[],
  compositions: compositionsData as any[],
  buildings: buildingsData as any[],
  heroines: HEROINE_DEFINITIONS as any[],
  seed: SEED_MAIDENS as any[],
};

// ── Column definitions per tab ─────────────────────────────────────────────────
interface ColDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'readonly' | 'complex';
  options?: string[];
  width?: number;
  render?: (val: any, row: any) => React.ReactNode;
}

const TAB_COLUMNS: Record<AdminTab, ColDef[]> = {
  tags: [
    { key: 'id', label: 'ID', type: 'readonly', width: 160 },
    { key: 'name', label: 'Name', type: 'string', width: 160 },
    { key: 'category', label: 'Category', type: 'select', options: ['positive', 'double_edged', 'negative'], width: 110 },
    { key: 'isRecruit', label: 'Recruit?', type: 'boolean', width: 70 },
    { key: 'bonuses', label: 'Bonuses', type: 'complex', width: 80,
      render: (v: any[]) => v?.length ? <span style={{ color: '#6ab06a' }}>{v.length} bonus{v.length !== 1 ? 'es' : ''}</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'description', label: 'Description', type: 'string' },
  ],
  qualifications: [
    { key: 'id', label: 'ID', type: 'readonly', width: 180 },
    { key: 'name', label: 'Name', type: 'string', width: 180 },
    { key: 'ability', label: 'Ability', type: 'string', width: 130,
      render: (v: any) => v ? <span style={{ color: '#a8c0d4' }}>{v}</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'bonuses', label: 'Bonuses', type: 'complex', width: 80,
      render: (v: any[]) => v?.length ? <span style={{ color: '#6ab06a' }}>{v.length} bonus{v.length !== 1 ? 'es' : ''}</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'description', label: 'Description', type: 'string' },
  ],
  equipment: [
    { key: 'id', label: 'ID', type: 'readonly', width: 160 },
    { key: 'name', label: 'Name', type: 'string', width: 160 },
    { key: 'slot', label: 'Slot', type: 'select', options: ['weapon', 'head', 'body', 'legs', 'accessory', 'medal', 'consumable'], width: 90 },
    { key: 'weaponType', label: 'Weapon Type', type: 'select', options: ['', 'rifle', 'shotgun', 'machine_gun', 'smg', 'sniper_rifle', 'pistol'], width: 110,
      render: (v: any) => v || <span style={{ color: '#666' }}>—</span> },
    { key: 'damage', label: 'DMG', type: 'number', width: 55,
      render: (v: any) => v !== undefined && v !== null ? <span style={{ color: '#e8a85a' }}>{v}</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'hitRateBonus', label: 'Hit%', type: 'number', width: 55,
      render: (v: any) => v !== undefined && v !== null ? <span style={{ color: v >= 0 ? '#6ab06a' : '#c06060' }}>{v > 0 ? '+' : ''}{v}</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'price', label: 'Price', type: 'number', width: 60 },
    { key: 'weight', label: 'Wt', type: 'number', width: 50 },
    { key: 'isRare', label: 'Rare', type: 'boolean', width: 50 },
    { key: 'craftable', label: 'Craft', type: 'boolean', width: 50 },
    { key: 'craftTier', label: 'CTier', type: 'number', width: 55,
      render: (v: any) => v !== undefined && v !== null ? v : <span style={{ color: '#666' }}>—</span> },
    { key: 'bonuses', label: 'Bonuses', type: 'complex', width: 70,
      render: (v: any[]) => v?.length ? <span style={{ color: '#6ab06a' }}>{v.length}</span> : <span style={{ color: '#666' }}>0</span> },
    { key: 'description', label: 'Description', type: 'string' },
  ],
  compositions: [
    { key: 'id', label: 'ID', type: 'readonly', width: 160 },
    { key: 'name', label: 'Name', type: 'string', width: 160 },
    { key: 'requirements', label: 'Requirements', type: 'complex', width: 110,
      render: (v: any[]) => v?.length ? <span style={{ color: '#a8c0d4' }}>{v.length} req</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'bonuses', label: 'Bonuses', type: 'complex', width: 80,
      render: (v: any[]) => v?.length ? <span style={{ color: '#6ab06a' }}>{v.length} bonus{v.length !== 1 ? 'es' : ''}</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'description', label: 'Description', type: 'string' },
  ],
  buildings: [
    { key: 'id', label: 'ID', type: 'readonly', width: 160 },
    { key: 'name', label: 'Name', type: 'string', width: 180 },
    { key: 'currentLevel', label: 'Cur Lv', type: 'number', width: 65 },
    { key: 'maxLevel', label: 'Max Lv', type: 'number', width: 65 },
    { key: 'isConstructed', label: 'Built', type: 'boolean', width: 55 },
    { key: 'levels', label: 'Levels', type: 'complex', width: 70,
      render: (v: any[]) => v?.length ? <span style={{ color: '#a8c0d4' }}>{v.length} lv</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'description', label: 'Description', type: 'string' },
  ],
  heroines: [
    { key: 'id', label: 'ID', type: 'readonly', width: 140 },
    { key: 'name', label: 'Name', type: 'string', width: 160 },
    { key: 'nickname', label: 'Nickname', type: 'string', width: 120 },
    { key: 'heroineStatus', label: 'Status', type: 'select', options: ['recruit', 'story', 'event'], width: 90 },
    { key: 'imgId', label: 'ImgID', type: 'number', width: 60 },
    { key: 'maxHp', label: 'HP', type: 'number', width: 55 },
    { key: 'stats', label: 'Stats', type: 'complex', width: 80,
      render: (_v: any, row: any) => {
        const s = row.stats;
        if (!s) return '—';
        return <span style={{ fontSize: 10, color: '#a8c0d4' }}>STR{s.strength} DEX{s.dexterity} CON{s.constitution}</span>;
      } },
    { key: 'equipment', label: 'Equipment', type: 'complex', width: 80,
      render: (v: any[]) => v?.length ? <span style={{ color: '#d4a8a8' }}>{v.length} items</span> : <span style={{ color: '#666' }}>—</span> },
  ],
  seed: [
    { key: 'id', label: 'ID', type: 'readonly', width: 120 },
    { key: 'name', label: 'Name', type: 'string', width: 140 },
    { key: 'nickname', label: 'Nickname', type: 'string', width: 120,
      render: (v: any) => v || <span style={{ color: '#666' }}>—</span> },
    { key: 'type', label: 'Type', type: 'readonly', width: 70 },
    { key: 'maxHp', label: 'HP', type: 'number', width: 55 },
    { key: 'currentHp', label: 'CurHP', type: 'number', width: 55 },
    { key: 'stats', label: 'Stats', type: 'complex', width: 80,
      render: (_v: any, row: any) => {
        const s = row.stats;
        if (!s) return '—';
        return <span style={{ fontSize: 10, color: '#a8c0d4' }}>STR{s.strength} DEX{s.dexterity}</span>;
      } },
    { key: 'equipment', label: 'Equipment', type: 'complex', width: 80,
      render: (v: any[]) => v?.length ? <span style={{ color: '#d4a8a8' }}>{v.length} items</span> : <span style={{ color: '#666' }}>—</span> },
    { key: 'isFavourite', label: 'Fav', type: 'boolean', width: 45 },
  ],
};

// ── Root Component ─────────────────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTab] = useState<AdminTab>('tags');
  const [listView, setListView] = useState(true);

  if (import.meta.env.PROD) {
    return <div style={{ color: 'var(--color-danger)', fontSize: 16, fontWeight: 'bold', padding: 20 }}>Admin panel not available in production</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--color-danger)' }}>🔧 Admin Panel <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(Dev Only)</span></h2>
        {/* View toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 12, color: 'var(--color-text-muted)' }}>
          <span style={{ color: !listView ? 'var(--color-accent)' : 'inherit' }}>Detail</span>
          <div
            onClick={() => setListView(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11, position: 'relative',
              background: listView ? 'var(--color-accent-dark)' : '#333',
              border: '1px solid var(--color-border)',
              transition: 'background 0.2s', cursor: 'pointer',
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: listView ? 20 : 3,
              width: 14, height: 14, borderRadius: '50%',
              background: listView ? '#fff' : '#888',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ color: listView ? 'var(--color-accent)' : 'inherit' }}>List</span>
        </label>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {(['tags', 'qualifications', 'equipment', 'compositions', 'buildings', 'heroines', 'seed'] as AdminTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 14px',
              background: tab === t ? 'var(--color-accent-dark)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--color-text)',
              border: `1px solid ${tab === t ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
              textTransform: 'capitalize',
            }}
          >
            {t}
            <span style={{ marginLeft: 5, fontSize: 10, color: tab === t ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)', fontWeight: 'normal' }}>
              {INITIAL_DATA[t].length}
            </span>
          </button>
        ))}
      </div>

      <AdminTabContent tab={tab} listView={listView} />
    </div>
  );
}

// ── Tab Content ────────────────────────────────────────────────────────────────
function AdminTabContent({ tab, listView }: { tab: AdminTab; listView: boolean }) {
  const [datasets, setDatasets] = useState<Record<AdminTab, any[]>>({ ...INITIAL_DATA });
  const [editingItem, setEditingItem] = useState<{ item: any; idx: number } | null>(null);

  const data = datasets[tab];

  function updateItem(idx: number, updated: any) {
    setDatasets(prev => {
      const arr = [...prev[tab]];
      arr[idx] = updated;
      return { ...prev, [tab]: arr };
    });
  }

  function updateField(idx: number, key: string, value: any) {
    setDatasets(prev => {
      const arr = [...prev[tab]];
      arr[idx] = { ...arr[idx], [key]: value };
      return { ...prev, [tab]: arr };
    });
  }

  function copyAsJson() {
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).then(() => alert('Copied to clipboard!'));
  }

  return (
    <>
      {listView ? (
        <ListView
          data={data}
          columns={TAB_COLUMNS[tab]}
          onEditFull={(item, idx) => setEditingItem({ item, idx })}
          onUpdateField={updateField}
          onCopyJson={copyAsJson}
        />
      ) : (
        <DetailView
          data={data}
          onEditItem={(item, idx) => setEditingItem({ item, idx })}
          onCopyJson={copyAsJson}
        />
      )}

      {editingItem && (
        <ItemEditorModal
          item={editingItem.item}
          onSave={(updated) => { updateItem(editingItem.idx, updated); setEditingItem(null); }}
          onClose={() => setEditingItem(null)}
        />
      )}
    </>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({
  data,
  columns,
  onEditFull,
  onUpdateField,
  onCopyJson,
}: {
  data: any[];
  columns: ColDef[];
  onEditFull: (item: any, idx: number) => void;
  onUpdateField: (idx: number, key: string, value: any) => void;
  onCopyJson: () => void;
}) {
  const [sortKey, setSortKey] = useState<string>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const [editCell, setEditCell] = useState<{ idx: number; key: string } | null>(null);
  const [editValue, setEditValue] = useState<any>('');

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const lowerFilter = filterText.toLowerCase();
  const filtered = filterText
    ? data.filter(row => {
        const id = (row.id ?? '').toLowerCase();
        const name = (row.name ?? '').toLowerCase();
        return id.includes(lowerFilter) || name.includes(lowerFilter);
      })
    : data;

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    let cmp = 0;
    if (typeof av === 'boolean') cmp = (av === bv ? 0 : av ? -1 : 1);
    else if (typeof av === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function originalIdx(row: any) {
    return data.findIndex(r => r === row);
  }

  function startEdit(idx: number, key: string, val: any) {
    setEditCell({ idx, key });
    setEditValue(val ?? '');
  }

  function commitEdit() {
    if (!editCell) return;
    const col = columns.find(c => c.key === editCell.key);
    let val: any = editValue;
    if (col?.type === 'number') val = editValue === '' ? null : Number(editValue);
    onUpdateField(editCell.idx, editCell.key, val);
    setEditCell(null);
  }

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <span style={{ color: '#555', marginLeft: 3, fontSize: 9 }}>⇅</span>;
    return <span style={{ color: 'var(--color-accent)', marginLeft: 3, fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Filter by id / name…"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          style={{
            flex: '0 0 220px', padding: '4px 10px', fontSize: 12,
            background: 'var(--color-bg-card)', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 4,
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {sorted.length} / {data.length} rows
        </span>
        <button
          onClick={onCopyJson}
          style={{ marginLeft: 'auto', padding: '4px 14px', background: 'var(--color-accent-dark)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}
        >
          Copy JSON
        </button>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: '72vh', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#1a1813', position: 'sticky', top: 0, zIndex: 2 }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.type !== 'complex' && handleSort(col.key)}
                  style={{
                    padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 11,
                    color: sortKey === col.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)',
                    cursor: col.type !== 'complex' ? 'pointer' : 'default',
                    userSelect: 'none',
                    minWidth: col.width ?? 80,
                    letterSpacing: 0.5,
                  }}
                >
                  {col.label}<SortIcon k={col.key} />
                </th>
              ))}
              <th style={{ padding: '7px 10px', borderBottom: '2px solid var(--color-border)', minWidth: 60 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, si) => {
              const oi = originalIdx(row);
              return (
                <tr
                  key={oi}
                  style={{ background: si % 2 === 0 ? '#0e0d0b' : '#111009', borderBottom: '1px solid #1e1c17' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1a1814')}
                  onMouseLeave={e => (e.currentTarget.style.background = si % 2 === 0 ? '#0e0d0b' : '#111009')}
                >
                  {columns.map(col => {
                    const val = row[col.key];
                    const isEditing = editCell?.idx === oi && editCell?.key === col.key;

                    if (col.type === 'readonly') {
                      return (
                        <td key={col.key} style={{ padding: '5px 10px', color: '#888', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {val ?? '—'}
                        </td>
                      );
                    }

                    if (col.type === 'complex') {
                      return (
                        <td key={col.key} style={{ padding: '5px 10px' }}>
                          {col.render ? col.render(val, row) : <span style={{ color: '#666', fontSize: 11 }}>…</span>}
                        </td>
                      );
                    }

                    if (col.type === 'boolean') {
                      return (
                        <td key={col.key} style={{ padding: '5px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!val}
                            onChange={e => onUpdateField(oi, col.key, e.target.checked)}
                            style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                          />
                        </td>
                      );
                    }

                    if (col.type === 'select') {
                      return (
                        <td key={col.key} style={{ padding: '4px 6px' }}>
                          <select
                            value={val ?? ''}
                            onChange={e => onUpdateField(oi, col.key, e.target.value)}
                            style={{
                              background: '#0e0d0b', color: 'var(--color-text)', border: '1px solid var(--color-border)',
                              borderRadius: 3, padding: '2px 4px', fontSize: 11, cursor: 'pointer', width: '100%',
                            }}
                          >
                            {col.options!.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                          </select>
                        </td>
                      );
                    }

                    // string / number — inline edit on click
                    return (
                      <td
                        key={col.key}
                        style={{ padding: '4px 6px', maxWidth: col.key === 'description' ? 300 : (col.width ?? 200) }}
                        onClick={() => !isEditing && startEdit(oi, col.key, val)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            type={col.type === 'number' ? 'number' : 'text'}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditCell(null); }}
                            style={{
                              width: '100%', background: '#1e1c17', color: 'var(--color-text)',
                              border: '1px solid var(--color-accent)', borderRadius: 3,
                              padding: '2px 6px', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        ) : (
                          <span
                            title="Click to edit"
                            style={{
                              display: 'block', cursor: 'text', padding: '2px 4px',
                              borderRadius: 3, border: '1px solid transparent',
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: col.key === 'description' ? 'nowrap' : undefined,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                          >
                            {col.render ? col.render(val, row) : (val !== null && val !== undefined ? String(val) : <span style={{ color: '#555' }}>—</span>)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <button
                      onClick={() => onEditFull(row, oi)}
                      title="Edit full JSON"
                      style={{ background: '#1e1c17', border: '1px solid #333', borderRadius: 3, color: '#888', padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
                    >
                      { }
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Detail View (original card + JSON layout) ──────────────────────────────────
function DetailView({
  data,
  onEditItem,
  onCopyJson,
}: {
  data: any[];
  onEditItem: (item: any, idx: number) => void;
  onCopyJson: () => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: 12 }}>
          Data Items <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(click to edit)</span>
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '70vh', overflowY: 'auto' }}>
          {Array.isArray(data) && data.map((item: any, idx: number) => (
            <div
              key={idx}
              onClick={() => onEditItem(item, idx)}
              style={{
                padding: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 4, fontSize: 12, color: 'var(--color-text)',
                cursor: 'pointer', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{item.name || item.id}</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{item.id}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: 12 }}>Export as JSON</h3>
        <textarea
          readOnly
          value={JSON.stringify(data, null, 2)}
          style={{
            width: '100%', height: '70vh', background: '#0e0d0b', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 4, padding: 12,
            fontFamily: 'monospace', fontSize: 11, resize: 'none', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={onCopyJson}
          style={{
            marginTop: 12, width: '100%', padding: '8px', background: 'var(--color-accent-dark)',
            color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
          }}
        >
          Copy to Clipboard
        </button>
      </div>
    </div>
  );
}

// ── Item Editor Modal (JSON tree) ──────────────────────────────────────────────
function ItemEditorModal({ item, onSave, onClose }: { item: any; onSave: (v: any) => void; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JSONEditor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const editor = new JSONEditor(containerRef.current, {
      mode: 'tree',
      modes: ['tree', 'code'],
      onError: (err: Error) => setError(err.message),
    });
    editor.set(JSON.parse(JSON.stringify(item)));
    editorRef.current = editor;
    return () => { editor.destroy(); };
  }, []);

  function handleSave() {
    try {
      const updated = editorRef.current!.get();
      onSave(updated);
    } catch (e: any) {
      setError(e.message ?? 'Invalid JSON');
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{jsoneditorDarkStyle}</style>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, width: 640, maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--color-accent)', fontSize: 14 }}>✏️ Edit — {item.name || item.id}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div ref={containerRef} style={{ height: 420, border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }} />
        {error && (
          <div style={{ color: '#e88', fontSize: 12, background: 'rgba(184,64,64,0.15)', border: '1px solid var(--color-danger)', borderRadius: 4, padding: '6px 10px' }}>
            ⚠️ {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 18px', background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '7px 18px', background: 'var(--color-accent-dark)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
