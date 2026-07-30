// DSP's data bound to the shared tree contract.
//
// Kept separate from the tree component so other views — the oil solver, for
// one — can build trees from the same data without pulling in the renderer.

import React from 'react';
import type {
  TreeDataSource, TreeIconProps, MachineOption, TransportOption, ModifierOption,
  PlanEntry, ExtraTotals, ExtraTotalsCtx, ExtraMachine,
} from '../../ProductionTreeView';
import type { TreeRecipe } from "../../productionTree";
import { recipesByOutput, protoName, buildings, modifiers } from './data/v0_10_34';
import { Panels } from './Panels';
import { OIL_CHAIN_ITEMS as OIL_IDS, OIL_CRAFT_SECONDS, solveOilChain } from './oilSolver';
import type { OilMode } from './oilSolver';
import type { DataRecipe } from './data/v0_10_34';
import './icons.css';

export function Icon({ id, size = 22 }: TreeIconProps) {
  return (
    <span
      data-icon={`item.${id}`}
      style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }}
    />
  );
}

/**
 * What one of this building is worth, as a multiplier on its recipe's base rate.
 *
 * Crafting buildings carry `production_speed`, a plain multiplier on craft time.
 * Extraction buildings carry an absolute output instead, which only lines up if
 * the gathering recipe is authored as one unit per minute (time: 60, qty: 1).
 *
 * `mining_speed` and `water_speed` are absolute per-minute figures, so they have
 * to be expressed relative to the recipe's own base rate. The extraction recipes
 * are authored as one unit per craft at `time: 1` — 60/min at ×1 — so an
 * absolute rate becomes a multiplier by dividing by 60. A Mining Machine at
 * 63/min per vein is therefore ×1.05, and the machine count reads as veins.
 *
 * This constant is the one place the code depends on how those recipes are
 * written; change `time` in recipies.json and it has to change with it.
 *
 * `oil_speed` is deliberately not used: it is a multiplier on a seep's own rate,
 * and the seep rate is a property of the planet, not of the building.
 */
const EXTRACTION_BASE_PER_MIN = 60;

function rateOf(b: { production_speed?: number; mining_speed?: number; water_speed?: number }): number {
  if (b.production_speed !== undefined) return b.production_speed;
  if (b.mining_speed !== undefined) return b.mining_speed / EXTRACTION_BASE_PER_MIN;
  if (b.water_speed !== undefined) return b.water_speed / EXTRACTION_BASE_PER_MIN;
  return 1;
}

// Belt tiers, in file order (slowest first). `belt.speed` is items per second,
// so it is scaled to the per-minute figure the tree works in.
const beltTiers: TransportOption[] = buildings
  .filter(b => b.belt !== undefined)
  .map(b => ({ id: b.id, name: b.name, ratePerMin: b.belt!.speed * 60 }));

/** Extraction counted in something other than buildings. */
const UNITS: Record<string, string> = {
  mining: 'veins',
};

// Buildings that can run each machine category, in file order — which is tier
// order, so the first entry is the sensible default. Built once: buildings.json
// does not change at runtime.
const machinesByCategory = (() => {
  const m = new Map<string, MachineOption[]>();
  buildings.forEach(b => b.type.forEach(t => {
    const list = m.get(t) ?? [];
    list.push({
      id: b.id,
      name: b.name,
      speed: rateOf(b),
      powerKW: b.power_usage,
      detail: b.power_usage !== undefined ? `${b.power_usage} kW` : undefined,
    });
    m.set(t, list);
  }));
  return m;
})();

/** The three items the chain balances between them. */
const OIL_CHAIN_ITEMS: number[] = [OIL_IDS.refinedOil, OIL_IDS.hydrogen, OIL_IDS.graphite];

/**
 * Stand-in recipe for an item the oil chain makes.
 *
 * Refined oil, hydrogen and graphite come out of recipes that feed each other,
 * which a tree cannot expand — so the tree offers this instead: no inputs, so
 * the branch ends, and `external` so it claims no machines and its output is
 * not mistaken for a raw resource. The Oil chain tab is where it is solved.
 *
 * It is a recipe rather than a special case in the tree, which means it appears
 * in the picker as one option among the real ones — you can still choose to
 * expand Plasma Refining here if you would rather see it inline.
 */
const oilChainRecipe = (item: number): TreeRecipe => ({
  name: 'Oil chain',
  machine: 'oil_chain',
  time: 1,
  inputs: [],
  outputs: [{ item, qty: 1 }],
  external: true,
});

// Mapped rather than cast: the JSON uses `modifiers_supported` while the view's
// contract uses `modifiersSupported`, and a cast would silently drop it.
const treeRecipesByOutput: Map<number, TreeRecipe[]> = (() => {
  const m = new Map<number, TreeRecipe[]>();
  const seen = new Map<DataRecipe, TreeRecipe>();
  recipesByOutput.forEach((list, itemId) => {
    const mapped = list.map(r => {
      const existing = seen.get(r);
      if (existing) return existing;
      const next: TreeRecipe = {
        name: r.name,
        machine: r.machine,
        time: r.time,
        inputs: r.inputs,
        outputs: r.outputs,
        modifiersSupported: r.modifiers_supported,
      };
      seen.set(r, next);
      return next;
    });
    // Prepended, so it is index 0 and therefore the default for these three.
    m.set(itemId, OIL_CHAIN_ITEMS.includes(itemId)
      ? [oilChainRecipe(itemId), ...mapped]
      : mapped);
  });
  return m;
})();

const modifierOptions: ModifierOption[] = modifiers.map(m => ({
  id: m.id,
  name: m.name,
  iconId: m.item,
  speed: m.speed,
  productivity: m.productivity,
  power: m.power,
  fallback: m.fallback,
}));

/** The oil mode a plan last chose, read the way usePersisted stores it. */
function readOilMode(storageKey: string): OilMode {
  try {
    const raw = localStorage.getItem(`${storageKey}:oilMode`);
    if (raw !== null) return JSON.parse(raw) as OilMode;
  } catch {}
  return 'buildings';
}

// Which item's icon stands for each oil recipe in the machine breakdown — its
// headline product, since a refinery running three different recipes is easier
// to read by what each makes than by the recipe name alone.
const OIL_JOB_ICON: Record<string, number> = {
  'Plasma Refining': OIL_IDS.refinedOil,
  'X-ray Cracking': OIL_IDS.graphite,
  'Reformed Refinement': OIL_IDS.refinedOil,
  'Energetic Graphite': OIL_IDS.graphite,
};

/** The oil recipe of a given name, for reading its modifier restrictions. */
function oilRecipe(output: number, name: string): TreeRecipe | undefined {
  return treeRecipesByOutput.get(output)?.find(r => r.name === name);
}

/**
 * The oil chain's crude, coal, refineries and smelter, folded into the tree's
 * own totals.
 *
 * Demand is read straight off the external stand-ins the tree left on the plan
 * — already modifier-adjusted, since each carries the rate its consumers ask of
 * it — and the chain is then solved exactly (see ./oilSolver). Machine counts
 * honour the build-wide refinery and smelter tier through `ctx.machineFor`, and
 * each recipe's own proliferator speed through `ctx.modifierFor`, which the
 * recipe's restrictions narrow — cracking and reforming take only speed modes.
 * Productivity is the one part still missing: it would change what the chain
 * yields, so it belongs in the solve rather than here, and is not folded in yet.
 */
function oilExtraTotals(plan: PlanEntry[], ctx: ExtraTotalsCtx): ExtraTotals {
  let refinedOil = 0, hydrogen = 0, graphite = 0;
  plan.forEach(e => {
    if (!e.recipe.external) return;
    if (e.itemId === OIL_IDS.refinedOil) refinedOil += e.rate;
    else if (e.itemId === OIL_IDS.hydrogen) hydrogen += e.rate;
    else if (e.itemId === OIL_IDS.graphite) graphite += e.rate;
  });
  if (refinedOil <= 0 && hydrogen <= 0 && graphite <= 0) return {};

  // The modifier each recipe actually runs, its restrictions already applied.
  const modOf = (output: number, name: string) => {
    const recipe = oilRecipe(output, name);
    return recipe ? ctx.modifierFor(recipe) : undefined;
  };
  // Productivity goes into the solve — it changes crude and coal; speed stays
  // out of it, and is applied to the machine counts below.
  const prod = {
    plasma: modOf(OIL_IDS.refinedOil, 'Plasma Refining')?.productivity ?? 1,
    arc: modOf(OIL_IDS.graphite, 'Energetic Graphite')?.productivity ?? 1,
  };
  const s = solveOilChain({ refinedOil, hydrogen, graphite }, readOilMode(ctx.storageKey), prod);

  const raw = [
    { item: OIL_IDS.crudeOil, rate: s.crudeOil },
    { item: OIL_IDS.coal, rate: s.coal },
  ].filter(r => r.rate > 1e-9);

  // Crafts a machine of a category completes per minute, before the recipe's
  // own modifier: 60/time at ×1, times the building's speed.
  const perMinute = (category: string, seconds: number) =>
    (60 / seconds) * (ctx.machineFor(category)?.speed ?? 1);
  const modSpeed = (output: number, name: string) => modOf(output, name)?.speed ?? 1;

  const machines: ExtraMachine[] = [];

  // All three refinery recipes share one building, so they are one row with a
  // job apiece; each job's speed is its own, since the modifier each accepts
  // differs. The smelter is its own row.
  const refinery = ctx.machineFor('refinery');
  const refineryBase = perMinute('refinery', OIL_CRAFT_SECONDS.refinery);
  const refineryJobs = ([
    ['Plasma Refining', OIL_IDS.refinedOil, s.plasma],
    ['X-ray Cracking', OIL_IDS.graphite, s.xray],
    ['Reformed Refinement', OIL_IDS.refinedOil, s.reformed],
  ] as const)
    .filter(([, , crafts]) => crafts > 1e-9)
    .map(([name, output, crafts]) => ({
      key: name, name, itemId: OIL_JOB_ICON[name],
      count: crafts / (refineryBase * modSpeed(output, name)),
    }));
  if (refineryJobs.length > 0) {
    machines.push({
      category: 'refinery',
      option: refinery,
      count: refineryJobs.reduce((sum, j) => sum + j.count, 0),
      jobs: refineryJobs,
    });
  }

  if (s.arcGraphite > 1e-9) {
    const smelter = ctx.machineFor('smelter');
    const base = perMinute('smelter', OIL_CRAFT_SECONDS.graphiteSmelter);
    const count = s.arcGraphite / (base * modSpeed(OIL_IDS.graphite, 'Energetic Graphite'));
    machines.push({
      category: 'smelter',
      option: smelter,
      count,
      jobs: [{ key: 'Energetic Graphite', name: 'Energetic Graphite', itemId: OIL_IDS.graphite, count }],
    });
  }

  return { raw, machines };
}

export const dspTreeSource: TreeDataSource = {
  recipesByOutput: treeRecipesByOutput,
  nameOf: id => protoName.get(id) ?? `#${id}`,
  Icon,
  machinesFor: category => machinesByCategory.get(category) ?? [],
  unitOf: category => UNITS[category],
  beltsFor: () => beltTiers,
  modifiersFor: () => modifierOptions,
  Panels,
  extraTotals: oilExtraTotals,
};
