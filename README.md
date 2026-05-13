# Waelfeld Maegdena

> A dark-fantasy tactical RPG browser game — manage a company of maidens, equip them, send them on missions, and build your base.

**Live demo:** [https://useless-pipi.github.io/waelfeld-maegdena/](https://useless-pipi.github.io/waelfeld-maegdena/)

---

## About

*Waelfeld Maegdena* (Old English: "Battlefield Maidens") is a single-player strategy/RPG running entirely in the browser. You command a small military outfit of maidens in a low-fantasy medieval setting. Recruit soldiers, outfit them with weapons and gear, assign them to teams, and deploy them on increasingly dangerous missions — all while managing a growing base of operations.

The game is fully client-side with no server. Progress is saved to `localStorage` and can be exported/imported as JSON.

---

## Features

- **Recruit & Manage Maidens** — randomised stats via Box-Muller distribution, medieval name generator, equipment slots, qualifications, and a favourite system
- **Combat Engine** — multi-phase simulation: spot check → surprise fire → initiative-ordered encounter rounds → retreat/capture logic
- **Team Composition** — assemble teams and apply composition bonuses (Scouting, Heavy Assault, Medic Unit, and more)
- **Base Building** — construct and upgrade five facility types (barracks, hospital, factory, radio, training grounds)
- **Mission System** — multi-stage missions with pre-made enemy teams and escalating difficulty
- **Save System** — export/import JSON save files; auto-persists to localStorage
- **Admin Panel** — hidden dev page for editing all game data in-browser

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| State | Zustand 5 |
| Routing | React Router 7 (hash-based) |
| Canvas | Konva + react-konva |
| Drag & Drop | @dnd-kit |
| Styling | Tailwind CSS 4 + CSS variables |
| Deployment | GitHub Actions → GitHub Pages |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173/waelfeld-maegdena/

# Production build
npm run build

# Preview production build locally
npm run preview
```

---

## Project Structure

```
src/
├── data/         # Static JSON game data (names, equipment, missions, buildings…)
├── engine/       # Pure-function game logic (combat, recruitment, shop)
├── pages/        # Route-level page components (Home, Members, Missions…)
├── store/        # Zustand global state + localStorage persistence
├── types/        # TypeScript interfaces for all game entities
└── utils/        # Portrait mapping, name generation helpers
public/
└── imgs/
    ├── chars/    # Character portrait PNGs (not distributed in v0 branches)
    └── enemy/    # Enemy portrait PNGs (not distributed in v0 branches)
```

---

## Pages

| Page | Description |
|---|---|
| Home | Dashboard — favourite maiden portrait, currency HUD, nav shortcuts |
| Members | Maiden roster with stat viewer and equipment editor |
| Composition | Team builder with composition-bonus selector |
| Missions | Mission list, stage details, and combat launch |
| Recruits | Roll and hire new maidens |
| Buildings | Base construction and upgrade management |
| Save | Export / import save file |
| Credits | Licenses and attributions |

---

## Roadmap

- [ ] Battlefield canvas — animated combat playback (Konva Stage)
- [ ] Drag-and-drop team assembly on Composition page
- [ ] Building effects (bed capacity, healing, crafting)
- [ ] Qualification unlock conditions (kill counts, mission clears)
- [ ] Equipment crafting via Factory
- [ ] Save migration / corruption handling
- [ ] Mobile layout polish

---

## License

Game source code is released under **CC BY-NC-ND 4.0**.  
Character and enemy portrait images in `public/imgs/` are proprietary and are **not** included in public release branches.

See [LICENSE.md](LICENSE.md) for details.
