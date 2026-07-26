# Production Calculator

A production-chain calculator for factory games, currently supporting **Dyson Sphere Program**.

## Features

### Production Tree
- Set **multiple output targets** simultaneously — e.g. 10 Quantum Chips/min *and* 10 Diamonds/min — and get a combined ingredient tree with aggregated totals.
- Per-node overrides for machine tier, recipe variant, and proliferator modifier.
- Mark nodes complete with checkmarks to track build progress.
- Open any sub-tree in a new tab via the ↗ button (or the `?game=dsp&item=<id>&rate=<n>` URL params directly).

### Recipe Tooltips
Hover any item name or icon — in the production tree *or* the item picker modal — to see a DSP-styled tooltip showing the recipe inputs, outputs, machine type, and craft time.

### Summary Panel
The right-hand panel aggregates across all active targets:
- **Raw resources / min** — total mined inputs
- **Machines (total)** — fractional and ceiling count per tier
- **Recipe totals / min** — per-item throughput, belt count, and power
- **Proliferators / min** — spray consumption per tier, with an optional *self-spray* toggle that accounts for the extra-products bonus when proliferators are themselves proliferated (Mk.III: ×1.25 effective capacity)
- **Power supply** — plants and fuel needed to cover production power draw

### Belt Utilisation
The belt tier picker in the Layout and production tree includes a **utilisation selector** (100% / 75% / 60%). Lower settings reserve headroom to prevent machines at the end of long tap lines from starving.

### Layout Planner
Visual tile-based layout for machine groups:
- Auto-arranges machines into rows based on belt throughput and utilisation
- Draws belt lanes, splitters/mergers, and sorter arms
- Pan and zoom canvas; select groups to inspect

### DSP Oil Optimisation
Dedicated tab for solving the crude-oil cracking chain (plasma refining, X-ray cracking, reformed hydrogen, arc-smelted graphite) with configurable modifier overrides.

## URL Parameters

| Param  | Description                                      |
|--------|--------------------------------------------------|
| `game` | Game ID to load without the picker (`dsp`)       |
| `item` | Item ID to pre-select as the first target        |
| `rate` | Rate (per minute) for the first target           |

Example: `http://localhost:3000?game=dsp&item=quantum-chip&rate=60`

## Development

```bash
npm start      # dev server at http://localhost:3000
npm test       # run tests
npm run build  # production build → build/
```

## Adding a Game

Each game lives in `src/games/<id>/index.ts` and must export the `GameModule` interface from `src/gameTypes.ts`. Register it in `src/App.tsx` in the `GAME_IMPORTERS` map.
