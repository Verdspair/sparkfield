<div align="center">

# SparkField · 灵光之野

**Spark curiosity through tactical play and adaptive spaced-repetition learning.**

[简体中文](README.md) · [English](README.en.md)

</div>

---

**SparkField** is an open-source strategy auto-battler integrated with an adaptive spaced-repetition learning engine. Each match alternates focused five-step learning nodes (`material → practice → check → remediation → verification`) with deterministic tactical preparation and 3D hexagonal combat, converting verified mastery into integer tactical gold orbs while tracking long-term memory retention via `FSRS-6`.

Season 1 (**Beyond the Light Cone**) features 36 original sci-fi units, asymmetric faction and role synergies, procedural Three.js PBR arenas, authoritative Colyseus multiplayer rooms, PostgreSQL persistence, offline IndexedDB practice, and Tauri 2 native host support.

---

## Key Highlights

- **Play-and-Learn Dual Loop with Exact Integer Economy**
  - Scores each learning node via exact BigInt rationals and settles integer gold orbs via `(g, c_next) = divmod(c_prev + floor(B × S), 100)`, carrying remainders in a science charge ring without decimal shop clutter.
  - Dynamically schedules overdue reviews and new concepts with `ts-fsrs` (`FSRS-6`), supporting 6 objective question types with `KaTeX` math rendering.

- **Deterministic Auto-Battler Engine (`@pkg/game-core`)**
  - **748-card shared pool**: 36 units across tiers 1–5, Lv3–Lv10 shop odds with empty-tier renormalization, and an 8-seat non-elimination round-robin schedule with tie-preserving `OpenSkill` rating updates.
  - **Tactical depth**: 8 components crafting 36 completed items, faction emblems, anvils, rechargeable magnetic removers, 24 three-tier augments, full-bench chain star-ups, lock-after-cast mana accounting, and in-flight projectile resolution allowing mutual draws.

- **Full-Viewport Three.js PBR Stage & Refined UI**
  - Decoupled `BoardStageEngine` (`Three.js` + `postprocessing` `SelectiveBloom` / `SMAA` + `@tweenjs/tween.js`) with procedural 4-map PBR materials, 3 switchable space arenas, star-up convergence beams, segmented HP bars, and automatic render-loop suspension during study overlays.

- **Isomorphic Course Pack Compiler (`@pkg/pack-compiler`)**
  - Zero server/FS runtime dependencies; compiles and round-trips `.csv` and `.md` (YAML frontmatter) into validated `CoursePack` artifacts with line-accurate diagnostics, knowledge-graph cycle checks, and `KaTeX` delimiter validation.

- **Authoritative Server, Offline Practice & Multi-Platform Delivery**
  - Fastify HTTP + Colyseus + Kysely + PostgreSQL (`scrypt` auth with optional email, atomic `session_epoch` takeover, reconnection protection, and single-transaction reward redemptions) alongside browser `Dexie` offline sandbox practice.
  - Shared React frontend published directly to the web and packaged natively via Tauri 2.

---

## Match Presets

| Mode | Total Duration | Learning Nodes | Battle Rounds | Prep Window |
|---|---:|---:|---:|---:|
| **Quick** | 15 min | 4 nodes (6 min) | 6 PVP | 50 s |
| **Standard** | 30 min | 6 nodes (15 min) | 7 PVP + 1 PVE | 50 s |
| **Deep** | 60 min | 8 nodes (32 min) | 10 PVP + 2 PVE | 50 s |

---

## Architecture

```text
.
├── apps/
│   ├── client/          # React UI, Three.js PBR stage engine, offline IndexedDB mode & Tauri 2 host
│   └── server/          # Fastify HTTP API, Colyseus authoritative rooms & Kysely/PostgreSQL services
├── packages/
│   ├── contracts/       # Shared Zod schemas, anti-spoiler projections & typed content loaders
│   ├── game-core/       # Deterministic auto-battler engine, AI bots & conservation checks
│   ├── learning-core/   # Objective grading, exact rational settlement & FSRS-6 scheduling
│   ├── learning-ui/     # Reusable KaTeX markdown, step cards, lore reader & craft tree components
│   └── pack-compiler/   # Isomorphic CSV / Markdown+YAML course pack compiler & validator
└── content/
    ├── courses/         # Authoring templates and compiled starter course packs
    ├── game/            # Units, traits, items & augments data
    ├── lore/            # Era chronicles & unit dialogue archives
    └── modes/           # Timeline schedules, pool configurations & shop odds
```

---

## Prerequisites & Quick Start

- **Node.js** `>= 22` & **pnpm** `>= 10`
- **PostgreSQL** `>= 16`
- **Rust** stable toolchain *(optional, required only for Tauri 2 native builds)*

```bash
pnpm install
cp .env.example .env
createdb beyond_light_cone
pnpm dev
```

Visit `http://127.0.0.1:5173` in your browser (or launch offline practice directly from the initial entry flow).

---

## Verification & Build

```bash
pnpm typecheck
pnpm test
pnpm test:ui
pnpm test:e2e
pnpm --filter @app/client build
cd apps/client/src-tauri && cargo test --locked
pnpm --filter @app/client exec tauri build
```

---

## License

Released under the [MIT License](LICENSE).
