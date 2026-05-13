import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import compositionsData from '../data/compositions.json';
import { getMaidenIcon } from '../utils/portraits';
import { computePersonalMoraleBase } from '../engine/combat';
import type { Maiden } from '../types/maiden';
import { v4 as uuidv4 } from 'uuid';

export default function Composition() {
  const { teams, maidens, setTeam, addTeam, removeTeam, defaultTeamId, setDefaultTeamId } = useGameStore();
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [draggedMaidenId, setDraggedMaidenId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const maidenTeams = teams.filter(t => t.type === 'maiden');
  // Exclude dead/fallen/captured maidens from the available pool
  const unassignedMaidens = maidens.filter(
    m => !m.isFallen && m.currentHp > 0 && !m.isCaptured && !teams.some(t => t.memberIds.includes(m.id))
  );

  const editTeam = editTeamId ? maidenTeams.find(t => t.id === editTeamId) : null;
  const teamMembers = editTeam ? maidens.filter(m => editTeam.memberIds.includes(m.id)) : [];

  const handleDragStart = (maidenId: string) => {
    setDraggedMaidenId(maidenId);
  };

  const handleDragEnd = () => {
    setDraggedMaidenId(null);
  };

  const handleDropToTeam = () => {
    if (!draggedMaidenId || !editTeam) return;
    if (editTeam.memberIds.includes(draggedMaidenId)) return; // Already in team
    const newMemberIds = [...editTeam.memberIds, draggedMaidenId];
    setTeam(editTeam.id, {
      memberIds: newMemberIds,
      leaderId: editTeam.leaderId ?? draggedMaidenId,
    });
    setDraggedMaidenId(null);
  };

  const handleDropToUnassigned = () => {
    if (!draggedMaidenId || !editTeam) return;
    if (!editTeam.memberIds.includes(draggedMaidenId)) return; // Not in team
    
    setTeam(editTeam.id, {
      memberIds: editTeam.memberIds.filter(id => id !== draggedMaidenId)
    });
    setDraggedMaidenId(null);
  };

  const handleCreateTeam = (name: string, memberIds: string[], compositionChoiceId: string | undefined, leaderId: string | undefined) => {
    const newTeam = {
      id: uuidv4(),
      name,
      type: 'maiden' as const,
      memberIds,
      leaderId: leaderId || undefined,
      compositionChoiceId: compositionChoiceId || undefined,
    };
    addTeam(newTeam);
    setShowCreateModal(false);
    setEditTeamId(newTeam.id);
  };

  const handleDeleteTeam = (teamId: string) => {
    removeTeam(teamId);
    if (editTeamId === teamId) setEditTeamId(null);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>🛡️ Team Composition</h2>

      {showCreateModal && (
        <CreateTeamModal
          maidens={unassignedMaidens}
          allMaidens={maidens.filter(m => !m.isFallen && m.currentHp > 0 && !m.isCaptured)}
          teams={maidenTeams}
          compositions={compositionsData}
          onConfirm={handleCreateTeam}
          onCancel={() => setShowCreateModal(false)}
        />
      )}

      {/* Team editor popup */}
      {editTeam && (
        <div
          onClick={() => setEditTeamId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-bg)', border: '1px solid var(--color-accent)', borderRadius: 10,
              padding: 24, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--color-accent)', fontSize: 16 }}>⚔️ {editTeam.name}</h3>
              <button
                onClick={() => setEditTeamId(null)}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Team members drop area */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Team Members</div>
              {teamMembers.length > 0 && (() => {
                const totalFood = teamMembers.reduce((s, m) => s + 20 + m.stats.strength, 0);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Total ration cost:</span>
                    <span style={{ color: '#c8a84b', fontWeight: 'bold', fontFamily: 'monospace' }}>🍞 {totalFood}</span>
                  </div>
                );
              })()}
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToTeam}
              style={{
                minHeight: 100,
                padding: 12,
                background: 'var(--color-surface)',
                border: `2px dashed ${draggedMaidenId && !editTeam.memberIds.includes(draggedMaidenId) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: 8,
                marginBottom: 16,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignContent: 'flex-start',
              }}
            >
              {[...teamMembers].sort((a, b) =>
                a.id === editTeam.leaderId ? -1 : b.id === editTeam.leaderId ? 1 : 0
              ).map(m => (
                <MaidenCard
                  key={m.id}
                  maiden={m}
                  isLeader={editTeam.leaderId === m.id}
                  onSetLeader={() => setTeam(editTeam.id, { leaderId: editTeam.leaderId === m.id ? undefined : m.id })}
                  onDragStart={() => handleDragStart(m.id)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedMaidenId === m.id}
                  onRemove={() => {
                    const newMemberIds = editTeam.memberIds.filter(id => id !== m.id);
                    let newLeaderId = editTeam.leaderId === m.id ? undefined : editTeam.leaderId;
                    if (editTeam.leaderId === m.id) {
                      const remaining = teamMembers.filter(tm => tm.id !== m.id);
                      const best = remaining.reduce<Maiden | null>(
                        (top, tm) => (!top || tm.stats.strategy > top.stats.strategy ? tm : top),
                        null
                      );
                      newLeaderId = best?.id ?? undefined;
                    }
                    setTeam(editTeam.id, { memberIds: newMemberIds, leaderId: newLeaderId });
                  }}
                />
              ))}
              {teamMembers.length === 0 && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12, width: '100%', textAlign: 'center', padding: 16 }}>
                  Drag maidens here or click an available maiden below to add
                </div>
              )}
            </div>

            {/* Composition choice */}
            <TeamEditor team={editTeam} onUpdate={(patch: any) => setTeam(editTeam.id, patch)} compositions={compositionsData} />

            {/* Available maidens */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 6px' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Available Maidens <span style={{ color: '#666' }}>(click or drag to add)</span></div>
              {unassignedMaidens.length > 0 && (
                <button
                  onClick={() => {
                    const allIds = [...editTeam.memberIds, ...unassignedMaidens.map(m => m.id)];
                    // Pick best-strategy maiden as leader if none set
                    let newLeaderId = editTeam.leaderId;
                    if (!newLeaderId && allIds.length > 0) {
                      const all = maidens.filter(m => allIds.includes(m.id));
                      newLeaderId = [...all].sort((a, b) => b.stats.strategy - a.stats.strategy)[0]?.id;
                    }
                    setTeam(editTeam.id, { memberIds: allIds, leaderId: newLeaderId });
                  }}
                  style={{
                    padding: '3px 10px', fontSize: 11, background: 'rgba(200,149,74,0.15)',
                    color: 'var(--color-accent)', border: '1px solid var(--color-accent-dark)',
                    borderRadius: 4, cursor: 'pointer', fontWeight: 'bold',
                  }}
                >+ Add All</button>
              )}
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToUnassigned}
              style={{
                minHeight: 80,
                padding: 12,
                background: 'var(--color-surface)',
                border: `2px dashed ${draggedMaidenId && editTeam.memberIds.includes(draggedMaidenId) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: 8,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignContent: 'flex-start',
              }}
            >
              {unassignedMaidens.map(m => (
                <MaidenCard
                  key={m.id}
                  maiden={m}
                  isLeader={false}
                  onDragStart={() => handleDragStart(m.id)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedMaidenId === m.id}
                  onAdd={() => setTeam(editTeam.id, {
                    memberIds: [...editTeam.memberIds, m.id],
                    leaderId: editTeam.leaderId ?? m.id,
                  })}
                />
              ))}
              {unassignedMaidens.length === 0 && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12, width: '100%', textAlign: 'center', padding: 16 }}>
                  No available maidens.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Teams list */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: 'var(--color-accent)', margin: 0 }}>Maiden Teams</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '5px 10px', fontSize: 12, background: 'var(--color-accent)', color: '#0e0d0b',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold',
          }}
        >
          + New Team
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
        {maidenTeams.map(t => (
          <TeamCard
            key={t.id} team={t} maidens={maidens}
            selected={editTeamId === t.id}
            isDefault={defaultTeamId === t.id}
            onSelect={() => setEditTeamId(t.id)}
            onDelete={() => handleDeleteTeam(t.id)}
            onToggleDefault={() => setDefaultTeamId(defaultTeamId === t.id ? undefined : t.id)}
          />
        ))}
        {maidenTeams.length === 0 && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            No teams yet. Click <strong>+ New Team</strong> to create one.
          </div>
        )}
      </div>
    </div>
  );
}

function MaidenCard({ maiden, isLeader, onSetLeader, onDragStart, onDragEnd, isDragging, onAdd, onRemove }: { maiden: Maiden; isLeader?: boolean; onSetLeader?: () => void; onDragStart: () => void; onDragEnd: () => void; isDragging: boolean; onAdd?: () => void; onRemove?: () => void; }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onAdd ?? onRemove}
      title={onAdd ? 'Click to add to team' : onRemove ? 'Click to remove from team' : undefined}
      style={{
        width: 100,
        padding: 8,
        background: isLeader ? 'rgba(255,215,0,0.12)' : isDragging ? 'rgba(200,149,74,0.2)' : 'rgba(200,149,74,0.05)',
        border: `2px solid ${isLeader ? '#ffd700' : isDragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 6,
        cursor: 'pointer',
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        position: 'relative',
        boxShadow: isLeader ? '0 0 10px rgba(255,215,0,0.35)' : 'none',
      }}
    >
      {isLeader && (
        <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', fontSize: 14, lineHeight: 1, zIndex: 1 }} title="Team Leader">👑</div>
      )}
      <img
        src={getMaidenIcon(maiden.imgId)}
        alt={maiden.name}
        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: isLeader ? '2px solid #ffd700' : '1px solid var(--color-border)', marginTop: isLeader ? 6 : 0 }}
      />
      <div style={{ fontSize: 11, color: isLeader ? '#ffd700' : 'var(--color-text)', textAlign: 'center', lineHeight: 1.2, fontWeight: isLeader ? 'bold' : 'normal', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {maiden.nickname ?? maiden.name.split(' ')[0]}
      </div>
      <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
        HP: {maiden.currentHp}/{maiden.maxHp}
      </div>
      <div style={{ fontSize: 9, color: '#c8a84b', display: 'flex', alignItems: 'center', gap: 2 }}>
        <span>🍞</span><span>{20 + maiden.stats.strength}</span>
      </div>
      {(() => {
        const hpPct = Math.min(100, (maiden.currentHp / maiden.maxHp) * 100);
        const hpColor = hpPct >= 60 ? '#4a9c5a' : hpPct >= 30 ? '#c8a84b' : '#b84040';
        const morale = computePersonalMoraleBase(maiden);
        const moraleColor = morale >= 70 ? '#4a7cb8' : morale >= 30 ? '#8b5fc4' : '#8b3a3a';
        return (
          <div style={{ width: '100%', marginTop: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* HP bar */}
            <div>
              <div style={{ background: '#0e0d0b', borderRadius: 2, height: 4, overflow: 'hidden', border: '1px solid #1e3a1e' }}>
                <div style={{ height: '100%', width: `${hpPct}%`, background: hpColor, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 8, color: hpColor, textAlign: 'center' }}>HP {Math.round(hpPct)}%</div>
            </div>
            {/* Morale bar */}
            <div>
              <div style={{ background: '#0e0d0b', borderRadius: 2, height: 4, overflow: 'hidden', border: '1px solid #1e1a3a' }}>
                <div style={{ height: '100%', width: `${morale}%`, background: moraleColor, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 8, color: moraleColor, textAlign: 'center' }}>M {Math.round(morale)}</div>
            </div>
          </div>
        );
      })()}
      {onSetLeader && (
        <button
          onClick={(e) => { e.stopPropagation(); onSetLeader(); }}
          title={isLeader ? 'Remove as leader' : 'Set as team leader'}
          style={{
            fontSize: 9, padding: '2px 4px', borderRadius: 3, border: 'none', cursor: 'pointer',
            background: isLeader ? '#ffd700' : 'rgba(255,215,0,0.15)',
            color: isLeader ? '#0e0d0b' : '#ffd700',
            fontWeight: 'bold',
          }}
        >
          {isLeader ? '★ Leader' : '☆ Lead'}
        </button>
      )}
    </div>
  );
}

function TeamCard({ team, maidens, selected, isDefault, onSelect, onDelete, onToggleDefault }: any) {
  const members = maidens.filter((m: any) => team.memberIds.includes(m.id));
  const leader = maidens.find((m: any) => m.id === team.leaderId);
  return (
    <div
      onClick={onSelect}
      style={{
        padding: 12, background: 'var(--color-surface)', border: `1px solid ${selected ? 'var(--color-accent)' : isDefault ? 'rgba(255,215,0,0.5)' : 'var(--color-border)'}`,
        borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
        boxShadow: isDefault ? '0 0 8px rgba(255,215,0,0.15)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingRight: 24 }}>
        <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--color-accent)' }}>{team.name}</span>
        {isDefault && (
          <span title="Default team — new recruits auto-join here" style={{ fontSize: 10, color: '#ffd700', fontWeight: 'bold', background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.4)', borderRadius: 3, padding: '1px 5px' }}>⭐ DEFAULT</span>
        )}
      </div>
      {leader && (
        <div style={{ fontSize: 10, color: '#ffd700', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👑 {leader.nickname ?? leader.name.split(' ')[0]}</div>
      )}
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {members.map((m: any) => m.nickname ?? m.name.split(' ')[0]).join(', ') || 'No members'}
      </div>
      {/* Default toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleDefault(); }}
        title={isDefault ? 'Remove as default team' : 'Set as default team (new recruits auto-join)'}
        style={{
          position: 'absolute', top: 8, right: 30, background: 'transparent', border: 'none',
          color: isDefault ? '#ffd700' : '#555', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 2,
          transition: 'color 0.15s',
        }}
      >{isDefault ? '⭐' : '☆'}</button>
      <button
        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete team "${team.name}"?`)) onDelete(); }}
        title="Delete team"
        style={{
          position: 'absolute', top: 8, right: 8, background: 'transparent', border: 'none',
          color: '#884444', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 2,
        }}
      >✕</button>
    </div>
  );
}

function TeamEditor({ team, onUpdate, compositions }: any) {
  const composition = compositions.find((c: any) => c.id === team.compositionChoiceId);
  return (
    <div style={{ padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Composition Choice</div>
      <select
        value={team.compositionChoiceId || ''}
        onChange={(e) => onUpdate({ compositionChoiceId: e.target.value || undefined })}
        style={{
          width: '100%', padding: '6px', background: '#0e0d0b', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 4, marginBottom: 8,
        }}
      >
        <option value="">None</option>
        {compositions.map((c: any) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {composition && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'rgba(200,149,74,0.05)', padding: 8, borderRadius: 4 }}>
          <strong>{composition.name}</strong><br />{composition.description}
        </div>
      )}
    </div>
  );
}

function CreateTeamModal({ allMaidens, teams, compositions, onConfirm, onCancel }: {
  maidens?: Maiden[];
  allMaidens: Maiden[];
  teams: any[];
  compositions: any[];
  onConfirm: (name: string, memberIds: string[], compositionChoiceId: string | undefined, leaderId: string | undefined) => void;
  onCancel: () => void;
}) {
  const [teamName, setTeamName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [compositionChoiceId, setCompositionChoiceId] = useState('');
  const [leaderId, setLeaderId] = useState<string>('');
  const [nameError, setNameError] = useState('');

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // If leader was deselected, clear leader
      if (!next.includes(leaderId)) setLeaderId('');
      return next;
    });
  };

  const handleConfirm = () => {
    // Auto-assign leader: pick highest-strategy selected member if none chosen
    const resolvedLeaderId = leaderId
      || (selectedMembers.length > 0
        ? [...selectedMembers].sort((a, b) => b.stats.strategy - a.stats.strategy)[0].id
        : undefined);

    // Auto-name: use leader's display name if team name left blank
    const resolvedLeader = resolvedLeaderId ? allMaidens.find(m => m.id === resolvedLeaderId) : undefined;
    const trimmed = teamName.trim()
      || (resolvedLeader ? (resolvedLeader.nickname ?? resolvedLeader.name.split(' ')[0]) + "'s Team" : '');
    if (!trimmed) { setNameError('Team name is required.'); return; }
    if (teams.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('A team with that name already exists.'); return;
    }
    onConfirm(trimmed, selectedMemberIds, compositionChoiceId || undefined, resolvedLeaderId || undefined);
  };

  const selectedComposition = compositions.find((c: any) => c.id === compositionChoiceId);
  const selectedMembers = allMaidens.filter(m => selectedMemberIds.includes(m.id));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--color-bg)', border: '1px solid var(--color-accent)', borderRadius: 10,
        padding: 28, width: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      }}>
        <h3 style={{ marginTop: 0, marginBottom: 20, color: 'var(--color-accent)' }}>⚔️ Create New Team</h3>

        {/* Team name */}
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Team Name <span style={{ color: '#666' }}>(leave blank to use leader's name)</span></label>
        <input
          autoFocus
          value={teamName}
          onChange={e => { setTeamName(e.target.value); setNameError(''); }}
          placeholder="e.g. Alpha Squad — or leave blank"
          style={{
            width: '100%', padding: '7px 10px', background: '#0e0d0b', color: 'var(--color-text)',
            border: `1px solid ${nameError ? 'var(--color-danger)' : 'var(--color-border)'}`,
            borderRadius: 4, fontSize: 13, boxSizing: 'border-box', marginBottom: nameError ? 4 : 16,
          }}
        />
        {nameError && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginBottom: 12 }}>{nameError}</div>}

        {/* Member selection */}
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 8 }}>
          Select Initial Members <span style={{ color: '#666' }}>({selectedMemberIds.length} selected)</span>
        </label>
        {allMaidens.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>No maidens available to recruit.</div>
        ) : (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, marginBottom: 16,
          }}>
            {allMaidens.map(m => {
              const alreadyInTeam = teams.some(t => t.memberIds.includes(m.id));
              const selected = selectedMemberIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => !alreadyInTeam && toggleMember(m.id)}
                  title={alreadyInTeam ? 'Already in another team' : undefined}
                  style={{
                    width: 80, padding: 6, borderRadius: 5, textAlign: 'center',
                    cursor: alreadyInTeam ? 'not-allowed' : 'pointer',
                    opacity: alreadyInTeam ? 0.4 : 1,
                    background: selected ? 'rgba(200,149,74,0.2)' : 'rgba(200,149,74,0.04)',
                    border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    transition: 'all 0.12s',
                  }}
                >
                  <img
                    src={getMaidenIcon(m.imgId)}
                    alt={m.name}
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 3, display: 'block', margin: '0 auto 4px' }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--color-text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.nickname ?? m.name.split(' ')[0]}
                  </div>
                  {alreadyInTeam && <div style={{ fontSize: 9, color: '#666' }}>assigned</div>}
                  {selected && !alreadyInTeam && <div style={{ fontSize: 9, color: 'var(--color-accent)' }}>✔</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Leader selection */}
        {selectedMembers.length > 0 && (
          <>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
              Team Leader <span style={{ color: '#666' }}>(optional — highest strategy auto-assigned if skipped)</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 16 }}>
              {selectedMembers.map(m => {
                const isL = leaderId === m.id;
                const wouldAutoLead = !leaderId && [...selectedMembers].sort((a, b) => b.stats.strategy - a.stats.strategy)[0]?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setLeaderId(isL ? '' : m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                      borderRadius: 5, cursor: 'pointer',
                      background: isL ? 'rgba(255,215,0,0.15)' : wouldAutoLead ? 'rgba(255,215,0,0.06)' : 'rgba(200,149,74,0.04)',
                      border: `1px solid ${isL ? '#ffd700' : wouldAutoLead ? 'rgba(255,215,0,0.4)' : 'var(--color-border)'}`,
                      boxShadow: isL ? '0 0 8px rgba(255,215,0,0.3)' : 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    <img src={getMaidenIcon(m.imgId)} alt={m.name} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3 }} />
                    <span style={{ fontSize: 11, color: isL ? '#ffd700' : wouldAutoLead ? 'rgba(255,215,0,0.8)' : 'var(--color-text)', fontWeight: isL || wouldAutoLead ? 'bold' : 'normal' }}>
                      {isL ? '👑 ' : wouldAutoLead ? '⭐ ' : ''}{m.nickname ?? m.name.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Composition choice */}
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
          Composition (optional)
        </label>
        <select
          value={compositionChoiceId}
          onChange={e => setCompositionChoiceId(e.target.value)}
          style={{
            width: '100%', padding: '7px 10px', background: '#0e0d0b', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13,
            boxSizing: 'border-box', marginBottom: selectedComposition ? 8 : 20,
          }}
        >
          <option value="">— None —</option>
          {compositions.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selectedComposition && (
          <div style={{
            fontSize: 11, color: 'var(--color-text-muted)', background: 'rgba(200,149,74,0.06)',
            border: '1px solid var(--color-accent-dark)', borderRadius: 4, padding: '8px 10px', marginBottom: 20,
          }}>
            <strong style={{ color: 'var(--color-text)' }}>{selectedComposition.name}</strong>
            <br />{selectedComposition.description}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 18px', background: 'transparent', color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >Cancel</button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '7px 18px', background: 'var(--color-accent)', color: '#0e0d0b',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
            }}
          >Create Team</button>
        </div>
      </div>
    </div>
  );
}
