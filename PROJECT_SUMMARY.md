# Waelfeld Maegdena — Project Implementation Summary

## Project Status: ✅ Initial Build Complete

A full-stack React + Vite + TypeScript front-end game has been scaffolded and deployed to GitHub Pages. All core systems are functional with placeholder/stub implementations for combat, recruitment, and game progression.

---

## Architecture Overview

### Tech Stack
- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8 (configured for GitHub Pages at `/waelfeld-maegdena/`)
- **State Management**: Zustand (lightweight, no boilerplate)
- **Routing**: React Router (hash-based for static hosting)
- **Canvas/Graphics**: Konva + react-konva (for maiden/enemy portraits and battlefield)
- **Drag & Drop**: @dnd-kit (composition page team assembly)
- **Styling**: Tailwind CSS + custom CSS variables (dark fantasy theme)
- **UI Colors**: Dark medieval palette (#0e0d0b bg, #c8954a accent)

### Deployment
- GitHub Actions workflow in `.github/workflows/deploy.yml` auto-builds and deploys to `gh-pages` branch on push to `main`
- Live at: `https://useless-pipi.github.io/waelfeld-maegdena/`

---

## Project Structure

```
src/
├── types/                       # TypeScript interfaces
│   ├── stats.ts                # Core stats, bonuses, status effects
│   ├── equipment.ts            # Equipment, skills, slots
│   ├── qualification.ts        # Qualifications with bonuses
│   ├── maiden.ts               # Maiden data model
│   ├── enemy.ts                # Enemy data model
│   ├── team.ts                 # Team composition
│   ├── mission.ts              # Mission structure
│   ├── building.ts             # Building/base construction
│   ├── mbase.ts                # Military base state
│   └── save.ts                 # Save file structure

├── data/                        # Static game data (JSON)
│   ├── names.json              # Medieval first/surnames for random generation
│   ├── qualifications.json     # Predefined qualifications & ranks
│   ├── compositions.json       # Team composition bonuses
│   ├── equipment.json          # Weapons, armor, consumables
│   ├── missions.json           # Campaign missions with enemy teams
│   ├── buildings.json          # Base construction & upgrades
│   └── seed.ts                 # Initial save state (5 starter maidens)

├── engine/                      # Game logic modules
│   ├── nameGen.ts              # Random medieval name generation (Box-Muller stats)
│   ├── recruit.ts              # Maiden recruitment with stat randomization
│   ├── combat.ts               # Full combat simulation (spot → surprise fire → encounter → retreat)
│   └── base.ts                 # Placeholder for base resource management

├── store/                       # Zustand store
│   └── gameStore.ts            # Global game state, save/load, persistence to localStorage

├── utils/
│   ├── portraits.ts            # Portrait image mapping & keys
│   └── nameGen.ts              # (see engine/)

├── components/
│   └── Layout.tsx              # Sidebar nav + main content layout

├── pages/                       # 9 main pages
│   ├── Home.tsx                # Dashboard: favourite maiden portrait + currency HUD + nav shortcuts
│   ├── Members.tsx             # Maiden grid (Konva cards) + detail panel with stats/equipment editor
│   ├── Composition.tsx         # Team builder with composition choice selector
│   ├── Missions.tsx            # Mission list + details (combat not yet playable)
│   ├── Recruits.tsx            # Maiden recruitment UI with stat preview
│   ├── Buildings.tsx           # Base building construction & upgrades
│   ├── Save.tsx                # Export/import save functionality
│   ├── Credits.tsx             # OSS credits & license info
│   └── Admin.tsx               # Dev-only predefined data editor (hidden in production)

├── assets/
│   └── portraits/              # Placeholder SVG maiden/enemy portraits
│       ├── maiden_01.svg → maiden_05.svg
│       ├── enemy_grunt.svg
│       ├── enemy_raider.svg
│       └── enemy_captain.svg

├── App.tsx                      # Router setup
├── main.tsx                     # React entry point
├── index.css                    # Global styles (dark theme vars)
└── App.css                      # (minimal)
```

---

## Key Systems

### 1. **State Management** (`src/store/gameStore.ts`)
- Zustand store with full game state: maidens, teams, missions, buildings, inventory
- Auto-save to `localStorage` under key `wm_save_v1`
- `exportSave()` / `importSave()` for file-based backups
- Save versioning for future migrations

### 2. **Combat Engine** (`src/engine/combat.ts`)
- ✅ **Spot Phase**: Awareness vs. Dexterity × approach index (decays 3.0 → 0 by 0.3/round)
- ✅ **Surprise Fire**: If spotter wins, they get 1 free attack round
- ✅ **Encounter Rounds**: Dex-ordered initiative, hit-rate formula (Dex × 5% + bonuses − dodge)
- ✅ **Retreat Logic**: Enemy retreats at 70% casualties; maiden retreat takes 1 fire round then succeeds/captures based on ratio
- ✅ **Capture Logic**: If maidens ≤ 1/3 enemy count after retreat fire, they're captured

### 3. **Recruitment** (`src/engine/recruit.ts`)
- Random stat generation via Box-Muller transform: μ=7, σ=3, clamped [1, 20]
- Medieval name generation from curated lists (no external dependency)
- Starting equipment: basic rifle
- 5 free recruits at game start, then costs 150g + 1 bed

### 4. **Game Data**
- **Qualifications**: 8 predefined (Basic Rifle Training, Primary Scout, Ranks, Sharpshooter, Iron Will, Field Medic)
- **Compositions**: 5 team bonus configurations (Scouting Team, Heavy Assault, Iron Fist, Medic Unit, Standard Patrol)
- **Equipment**: 10 items (rifle, marksman rifle, shotgun, helmet, vest, boots, potions, rations, medals, spyglass)
- **Missions**: 3 starter missions (Ashwick Patrol easy, Moorgate Ambush normal 2-stage, Ironwood Siege hard 3-stage) with pre-made enemy teams
- **Buildings**: 5 (Tent Block, Field Hospital, Factory, Radio Center, Training Grounds) with 2–3 upgrade levels each

### 5. **UI Pages**
| Page | Status | Features |
|------|--------|----------|
| Home | ✅ | Favourite maiden portrait (60% width), currency HUD, team summary, nav shortcuts |
| Members | ✅ | Konva grid of maiden cards (110×130px), detail panel with stats/equipment editor, nickname editor, favourite toggle |
| Composition | ✅ | Team list + maiden pool, composition choice selector with requirement validation |
| Missions | ✅ | Mission list + details card; "Start Mission" button (no combat playback yet) |
| Recruits | ✅ | Roll preview UI, stat display, recruitment gating (beds + funds) |
| Buildings | ✅ | Grid of building cards, level progress bars, upgrade cost display & gating |
| Save | ✅ | Export JSON download, import file picker → restore |
| Credits | ✅ | OSS library list, name data credits, CC BY-NC-ND 4.0 license info |
| Admin | ✅ | (Dev only, hidden in production) Tabbed editor for all predefined data with "Copy JSON" buttons |

---

## Current Limitations & TODO

### Completed ✅
- [x] Full TypeScript type definitions
- [x] Zustand store with save/load
- [x] Combat engine (spot, surprise fire, encounter, retreat, capture)
- [x] Recruitment with randomised stats & names
- [x] All 9 UI pages with working state management
- [x] GitHub Actions auto-deploy
- [x] Konva canvas for maiden/enemy portraits (Members page)
- [x] Placeholder SVG avatars

### To Implement (Phase 2+)
- [ ] **Battlefield Canvas** (Missions page): Konva Stage showing maiden/enemy sprites with HP bars, damage numbers, animation
- [ ] **Combat Playback**: Step through combat events in the UI, show round log, allow pause/speed control
- [ ] **Drag & Drop Integration**: @dnd-kit on Composition page for drag-maiden-into-team
- [ ] **Building Effects**: Implement bed capacity, heal amounts, factory crafting
- [ ] **Qualification Unlocks**: Track kill counts, mission clears, award qualifications
- [ ] **Equipment Crafting**: Factory UI to craft equipment from resources
- [ ] **Team Strategy AI**: Default enemy retreat logic, player-definable maiden retreat/focus targets
- [ ] **Persistence Refinement**: Handle corrupted saves gracefully, version migrations
- [ ] **Sound & Music**: Placeholder for audio system
- [ ] **Mobile Responsiveness**: Sidebar layout needs tweaks for phones
- [ ] **Accessibility**: Keyboard navigation, screen reader support

---

## How to Run Locally

```bash
# Install dependencies (already done)
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Visit `http://localhost:5173/waelfeld-maegdena/` (or `http://localhost:5173` + hash routing).

---

## Save Data Structure

```typescript
{
  "saveVersion": 1,
  "savedAt": "2026-05-06T...",
  "mbase": { money, food, beds, wood, metal, maidenCount, name },
  "maidens": [ { id, name, nickname, isFavourite, stats, maxHp, currentHp, equipment[], qualifications[], ... } ],
  "teams": [ { id, name, type, memberIds, leaderId, compositionChoiceId } ],
  "missions": [ { id, name, stages, reward, capturedMaidenIds, isCompleted, isLocked } ],
  "buildings": [ { id, name, currentLevel, isConstructed, ... } ],
  "inventory": [ { ...equipment } ],
  "freeRecruitCount": 0
}
```

Automatically saved to `localStorage` every time the store is updated. Export/import as JSON file for backup or cross-device play.

---

## Design Decisions

1. **Konva for Canvas**: Used selectively (Members, Teams, future Battlefield) for special effects potential (glow, shake, greyscale on KO) without refactoring later.
2. **Inline Styles**: Pages use inline React styles for quick iteration; can extract to CSS modules or Tailwind utilities later.
3. **Pure JSON Names**: No external package dependency; curated medieval name lists loaded as JSON with lightweight random selection.
4. **Hash Routing**: Enables static hosting on GitHub Pages without server-side rewrites.
5. **Zustand over Redux**: Simpler boilerplate, auto-persistence, familiar API.
6. **Modular Engine**: `combat.ts`, `recruit.ts` are pure functions—easy to test and extend.

---

## Next Steps

1. **Integrate Combat Playback**: Consume `simulateStage()` output in Missions page, animate on canvas
2. **Polish UI**: Responsive layout, accessibility, keyboard shortcuts
3. **Balancing**: Tweak combat formulas, equipment stats, mission difficulty, resource costs
4. **Content**: Add more missions, equipment variants, special abilities
5. **Testing**: Unit tests for engine, E2E tests for critical user flows
6. **Analytics**: Track player progression, engagement metrics (optional)

---

**Project initialized May 6, 2026. Ready for Phase 2 implementation!**
