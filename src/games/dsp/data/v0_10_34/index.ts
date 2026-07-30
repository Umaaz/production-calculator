// Typed access to the DSP 0.10.34 data set.
//
// The JSON files are the source of truth and are hand-maintained — nothing here
// rewrites, dedupes or reorders them. Entries are exposed as plain arrays in
// file order, because ids are still being verified and duplicates must stay
// visible rather than collapsing into a map.
//
// recipies.json is deliberately not imported yet: it still references items by
// the old string slugs, which no longer exist.

import itemsJson from './items.json';
import buildingsJson from './buildings.json';
import recipesJson from './recipies.json';
import modifiersJson from './modifiers.json';

/** Fuel value of an item, when it can be burned. */
export interface DataFuel {
  type: string;      // chemical | nuclear | mass_energy | …
  energy: number;    // MJ
  /**
   * Multiplier on the generator's output while burning this. A Strange
   * Annihilation Fuel Rod drives an Artificial Star at twice its rating.
   * Named to match the JSON key.
   */
  output_multiplier?: number;
}

export interface DataItem {
  id: number;
  name: string;
  type: string[];
  raw?: boolean;
  canBeRaw?: boolean;
  fuel?: DataFuel;
}

export interface DataBuilding {
  id: number;
  name: string;
  type: string[];
  /** Generation: what this building produces, in kW. `fuel` is the type burned. */
  power?: { fuel: string; power: number, efficiency?: number };
  /** Buildings can themselves be fuel — a charged Accumulator supplies 'storage'. */
  fuel?: DataFuel;
  /** Consumption: what this building draws, in kW. Named to match the JSON key. */
  power_usage?: number;
  /** Craft-speed multiplier, 1 = baseline. */
  production_speed?: number;
  /** Ore per minute, per vein covered. */
  mining_speed?: number;
  /** Fluid per minute. */
  water_speed?: number;
  /** Extraction-rate multiplier applied to the oil seep. */
  oil_speed?: number;
  belt?: { speed: number };
  sorter?: { speed: number };
}

// The whole module is asserted before any property is read, rather than
// asserting the arrays after `itemsJson.items`. Two reasons: a heterogeneous
// JSON array infers as a union of shapes that makes optional fields
// unreachable, and — more importantly while these files are hand-edited —
// reading a property directly makes the build depend on the shape TypeScript
// inferred from the file's contents, so a stale incremental cache fails the
// build with a shape that is no longer on disk.
const itemsData     = itemsJson     as unknown as { gameVersion: string; items: (DataItem | null)[] };
const buildingsData = buildingsJson as unknown as { items: (DataBuilding | null)[] };

// File order is the in-game icon-grid order, 14 to a row. A `null` entry is an
// empty cell in that grid — the game leaves gaps, so the array is a layout as
// well as a list.
export const itemGrid     = itemsData.items;
export const buildingGrid = buildingsData.items;

/** The same data as a plain list, with grid spacers removed. */
export const items     = itemGrid.filter(Boolean) as DataItem[];
export const buildings = buildingGrid.filter(Boolean) as DataBuilding[];

/** Columns per row in the game's icon picker. */
export const GRID_COLUMNS = 14;

export interface DataRecipeIO {
  item: number;
  qty: number;
}

export interface DataRecipe {
  /** DSP recipe proto id — null until a source is wired up. */
  id: number | null;
  /** Usually blank; fall back to the primary output's name. */
  name: string;
  /** Machine category, e.g. 'smelter', 'assembler'. */
  machine: string;
  /** Seconds for one craft at 1× speed. */
  time: number;
  inputs: DataRecipeIO[];
  outputs: DataRecipeIO[];
  /**
   * Modifier ids this recipe accepts. Absent means every modifier is allowed.
   * Named to match the JSON key.
   */
  modifiers_supported?: string[];
}

export interface DataModifier {
  id: string;
  name: string;
  /** Item proto id of the thing applied, for the icon. Absent for "none". */
  item?: number;
  /** Multiplier on craft speed. */
  speed: number;
  /** Multiplier on output quantity. */
  productivity: number;
  /** Multiplier on the machine's power draw. */
  power?: number;
  /** Modifier to use instead when a recipe does not permit this one. */
  fallback?: string;
  /** Items one unit of the applied thing coats. */
  sprays?: number;
}

const recipesData = recipesJson as unknown as { recipes: DataRecipe[] };
const modifiersData = modifiersJson as unknown as { modifiers: DataModifier[] };

export const recipes = recipesData.recipes;
export const modifiers = modifiersData.modifiers;

/** Every recipe that produces a given item, keyed by output proto id. */
export const recipesByOutput: Map<number, DataRecipe[]> = (() => {
  const m = new Map<number, DataRecipe[]>();
  recipes.forEach(r => r.outputs.forEach(o => {
    const list = m.get(o.item);
    if (list) list.push(r); else m.set(o.item, [r]);
  }));
  return m;
})();

export interface FuelSource {
  id: number;
  name: string;
  energy: number;   // MJ
  /** Multiplier on the burning generator's output. 1 when unstated. */
  outputMultiplier: number;
}

/**
 * Everything that can be burned, grouped by fuel type, richest first.
 *
 * Drawn from both files: most fuels are items, but a charged Accumulator is a
 * building and supplies the 'storage' type the Energy Exchanger consumes. A
 * facility's `power.fuel` is the key into this map.
 */
export const fuelsByType: Map<string, FuelSource[]> = (() => {
  const m = new Map<string, FuelSource[]>();
  const add = (e: { id: number; name: string; fuel?: DataFuel }) => {
    if (!e.fuel) return;
    const list = m.get(e.fuel.type);
    const src = {
      id: e.id,
      name: e.name,
      energy: e.fuel.energy,
      outputMultiplier: e.fuel.output_multiplier ?? 1,
    };
    if (list) list.push(src); else m.set(e.fuel.type, [src]);
  };
  items.forEach(add);
  buildings.forEach(add);
  m.forEach(list => list.sort((a, b) => b.energy - a.energy));
  return m;
})();

/** Display name for any proto id — items and buildings share one numbering. */
export const protoName: Map<number, string> = (() => {
  const m = new Map<number, string>();
  items.forEach(it => { if (!m.has(it.id)) m.set(it.id, it.name); });
  buildings.forEach(b => { if (!m.has(b.id)) m.set(b.id, b.name); });
  return m;
})();

/**
 * A representative building proto for each machine category, for showing which
 * machine a recipe runs in. Categories with no matching building `type` are
 * absent, and callers fall back to the category name.
 *
 * File order decides, so this picks the lowest tier — Arc Smelter over Plane,
 * Assembling Machine Mk.I over Mk.II.
 */
export const machineIcon: Map<string, number> = (() => {
  const m = new Map<string, number>();
  buildings.forEach(b => b.type.forEach(t => { if (!m.has(t)) m.set(t, b.id); }));
  return m;
})();

/**
 * Craft-speed multiplier per machine category, from the same lowest-tier
 * building. Categories whose buildings carry no `production_speed` are absent
 * and callers should treat them as ×1.
 */
export const machineSpeed: Map<string, number> = (() => {
  const m = new Map<string, number>();
  buildings.forEach(b => {
    if (b.production_speed === undefined) return;
    b.type.forEach(t => { if (!m.has(t)) m.set(t, b.production_speed!); });
  });
  return m;
})();

export const GAME_VERSION: string = itemsData.gameVersion;
