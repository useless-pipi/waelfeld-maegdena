import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function Save() {
  const { exportSave, importSave, resetSave } = useGameStore();
  const [confirmReset, setConfirmReset] = useState(false);

  function handleExport() {
    const data = exportSave();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waelfeld-save-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        importSave(data);
        alert('Save imported successfully!');
      } catch (err) {
        alert('Error importing save: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  }

  function handleReset() {
    if (confirmReset) {
      resetSave();
      setConfirmReset(false);
      alert('Game has been reset to a fresh start.');
    } else {
      setConfirmReset(true);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>💾 Save & Load</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 600 }}>
        {/* Export */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20 }}>
          <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: 12 }}>Export Save</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
            Download your game progress as a JSON file. Keep it safe!
          </p>
          <button
            onClick={handleExport}
            style={{
              width: '100%', padding: '10px', background: 'var(--color-accent-dark)',
              color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 13, fontWeight: 'bold',
            }}
          >
            📥 Export Save
          </button>
        </div>

        {/* Import */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20 }}>
          <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: 12 }}>Import Save</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
            Load a previously exported save file. This will overwrite current progress!
          </p>
          <label style={{
            width: '100%', display: 'block', padding: '10px', background: 'var(--color-accent-dark)',
            color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
            fontSize: 13, fontWeight: 'bold', textAlign: 'center', boxSizing: 'border-box',
          }}>
            📤 Import Save
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Reset */}
      <div style={{ marginTop: 20, maxWidth: 600 }}>
        <div style={{
          background: 'var(--color-surface)', border: '1px solid #7a2020',
          borderRadius: 8, padding: 20,
        }}>
          <h3 style={{ color: '#e05555', marginTop: 0, marginBottom: 12 }}>⚠️ Reset Game</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
            Wipe all progress and start over from scratch. <strong style={{ color: '#e05555' }}>This cannot be undone.</strong> Consider exporting a backup first.
          </p>
          {confirmReset ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleReset}
                style={{
                  flex: 1, padding: '10px', background: '#7a2020',
                  color: '#fff', border: '1px solid #e05555', borderRadius: 6,
                  cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
                }}
              >
                ✔ Yes, reset everything
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                style={{
                  flex: 1, padding: '10px', background: 'transparent',
                  color: 'var(--color-text-muted)', border: '1px solid var(--color-border)',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                }}
              >
                ✖ Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleReset}
              style={{
                width: '100%', padding: '10px', background: 'transparent',
                color: '#e05555', border: '1px solid #7a2020', borderRadius: 6,
                cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
              }}
            >
              🗑 Reset All Data
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, padding: 16, background: 'rgba(200,149,74,0.05)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>ℹ️ How it works</div>
        <ul style={{ fontSize: 13, color: 'var(--color-text)', margin: 0, paddingLeft: 20 }}>
          <li>Your save data is automatically stored in your browser's local storage.</li>
          <li>Use <strong>Export Save</strong> to create a backup you can download.</li>
          <li>Use <strong>Import Save</strong> to restore from a backup or transfer to another device.</li>
          <li>Always keep backup files safe in case your browser data is cleared!</li>
        </ul>
      </div>
    </div>
  );
}
