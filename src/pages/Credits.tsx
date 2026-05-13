export default function Credits() {
  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginBottom: 16 }}>📜 Credits</h2>

      <CreditSection title="Development">
        <CreditItem name="useless-pipi" role="Creator & Designer" />
      </CreditSection>

      <CreditSection title="Open Source Libraries">
        <CreditItem name="React" url="https://react.dev" role="UI Framework" />
        <CreditItem name="Vite" url="https://vite.dev" role="Build Tool" />
        <CreditItem name="React Router" url="https://reactrouter.com" role="Routing" />
        <CreditItem name="Zustand" url="https://github.com/pmndrs/zustand" role="State Management" />
        <CreditItem name="Konva" url="https://konva.js.org" role="Canvas Rendering" />
        <CreditItem name="react-konva" url="https://github.com/react-kova/react-konva" role="React Konva Bindings" />
        <CreditItem name="Tailwind CSS" url="https://tailwindcss.com" role="Styling" />
        <CreditItem name="uuid" url="https://github.com/uuidjs/uuid" role="ID Generation" />
        <CreditItem name="dnd-kit" url="https://docs.dndkit.com" role="Drag & Drop" />
      </CreditSection>

      <CreditSection title="Data & Assets">
        <CreditItem name="Medieval Names" role="Name Generation — sourced from public domain fantasy name lists" />
        <CreditItem name="Game Design Inspiration" role="Influenced by tactical RPGs, XCOM, and Fire Emblem" />
      </CreditSection>

      <CreditSection title="License">
        <p style={{ color: 'var(--color-text)', fontSize: 13, lineHeight: 1.6 }}>
          This project is licensed under the <strong>Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International</strong> (CC BY-NC-ND 4.0).
          <br />
          <br />
          You are free to share the game, but you must give appropriate credit and may not use it for commercial purposes or distribute modified versions.
          <br />
          <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
            Read the full license →
          </a>
        </p>
      </CreditSection>

      <div style={{ marginTop: 24, padding: 16, background: 'rgba(200,149,74,0.05)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 8 }}>
          <strong>Waelfeld Maegdena</strong>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          "Battlefield of Maidens" — A fantasy tactical game where player-recruited and trained maidens fight against dangerous enemies.<br />
          Developed with passion for strategy game enthusiasts.
        </div>
      </div>
    </div>
  );
}

function CreditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, color: 'var(--color-accent)', marginBottom: 12 }}>{title}</h3>
      <div style={{ paddingLeft: 0 }}>
        {children}
      </div>
    </div>
  );
}

function CreditItem({ name, role, url }: { name: string; role: string; url?: string }) {
  const content = (
    <>
      <strong style={{ color: 'var(--color-text)' }}>{name}</strong>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{role}</div>
    </>
  );

  return (
    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}
