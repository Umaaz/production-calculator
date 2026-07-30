// Tree configuration, extracted from the view that renders it.
//
// The production tree is built in two places from the same choices: the tree
// view draws it, and a game screen — the DSP oil chain, for one — reads it to
// work out what the plan demands. If each resolved the persisted machine,
// recipe and modifier choices its own way they could disagree, and did: the oil
// tab once ignored proliferators and so built for a demand the tree never had.
//
// So the resolution lives here, once. Both callers get the same TreeConfig from
// the same localStorage keys, and cannot drift. The view additionally takes the
// state and setters for its choice controls; a read-only consumer takes only
// `config`.

import { useCallback, useMemo } from 'react';
import { usePersisted } from './usePersisted';
import type { TreeConfig, TreeRecipe } from './productionTree';
import type { ModifierOption, TreeDataSource } from './ProductionTreeView';

/** A modifier that changes nothing — applying it is the same as not applying one. */
export const isNeutral = (m: ModifierOption) => m.speed === 1 && m.productivity === 1;

/**
 * Modifiers a given recipe accepts — all of them unless it says otherwise.
 *
 * A neutral modifier survives any restriction. `modifiersSupported` lists what
 * may be *applied*, and choosing to apply nothing is not an application — so a
 * recipe listing only the speed modes must not thereby make proliferating
 * compulsory. It also means the common case never has to remember to include
 * "none" in the list.
 */
export function allowedModifiers(recipe: TreeRecipe, all: ModifierOption[]): ModifierOption[] {
  if (!recipe.modifiersSupported) return all;
  const ok = new Set(recipe.modifiersSupported);
  return all.filter(m => ok.has(m.id) || isNeutral(m));
}

/** One line summarising what a modifier does, for a picker's detail row. */
export function modifierDetail(m: ModifierOption): string {
  const parts: string[] = [];
  if (m.speed !== 1) parts.push(`speed ×${m.speed}`);
  if (m.productivity !== 1) parts.push(`yield ×${m.productivity}`);
  if (m.power !== undefined && m.power !== 1) parts.push(`power ×${m.power}`);
  return parts.join(' · ') || 'no effect';
}

export interface TreeConfigState {
  /** The resolved config, ready to hand to buildTree. */
  config: TreeConfig;

  // Machine choice, as an index into machinesFor(category).
  machineDefaults: Record<string, number>;
  machineOverrides: Record<string, number>;
  resolveMachine: (category: string, path: string) => number;
  setMachineDefault: (category: string, index: number) => void;
  setMachineOverride: (path: string, index: number) => void;
  clearMachineOverride: (path: string) => void;

  // Recipe choice, as an index into usableRecipes(item).
  recipeDefaults: Record<string, number>;
  recipeOverrides: Record<string, number>;
  resolveRecipe: (item: number, path: string) => number;
  setRecipeDefault: (item: number, index: number) => void;
  setRecipeOverride: (path: string, index: number) => void;
  clearRecipeOverride: (path: string) => void;

  // Modifiers. One global default with per-node overrides.
  modifiers: ModifierOption[];
  modifierDefault: string;
  modifierOverrides: Record<string, string>;
  resolveModifier: (recipe: TreeRecipe, path: string) => ModifierOption | undefined;
  setModifierDefault: (id: string) => void;
  setModifierOverride: (path: string, id: string) => void;
  clearModifierOverride: (path: string) => void;

  /** Return every choice to its default. */
  resetAll: () => void;
  /** How many per-node overrides are set, across all three kinds. */
  overrideCount: number;
  /** Whether any choice at all has been made away from the built-in defaults. */
  anyChoice: boolean;
}

export function useTreeConfig(source: TreeDataSource, storageKey: string): TreeConfigState {
  // Plain records rather than Maps so they survive a round trip through
  // localStorage. Defaults are keyed by category/item, overrides by node path.
  const [machineDefaults, setMachineDefaults] = usePersisted<Record<string, number>>(
    `${storageKey}:machineDefaults`, {});
  const [machineOverrides, setMachineOverrides] = usePersisted<Record<string, number>>(
    `${storageKey}:machineOverrides`, {});

  const resolveMachine = useCallback(
    (machine: string, path: string) => machineOverrides[path] ?? machineDefaults[machine] ?? 0,
    [machineOverrides, machineDefaults],
  );

  const [recipeDefaults, setRecipeDefaults] = usePersisted<Record<string, number>>(
    `${storageKey}:recipeDefaults`, {});
  const [recipeOverrides, setRecipeOverrides] = usePersisted<Record<string, number>>(
    `${storageKey}:recipeOverrides`, {});

  const resolveRecipe = useCallback(
    (item: number, path: string) => recipeOverrides[path] ?? recipeDefaults[item] ?? 0,
    [recipeOverrides, recipeDefaults],
  );

  // One global default rather than per-item: a proliferator tier is normally a
  // factory-wide decision, with exceptions set per row.
  const modifiers = useMemo(() => source.modifiersFor?.() ?? [], [source]);
  const [modifierDefault, setModifierDefault] = usePersisted<string>(
    `${storageKey}:modifier`, modifiers[0]?.id ?? 'none');
  const [modifierOverrides, setModifierOverrides] = usePersisted<Record<string, string>>(
    `${storageKey}:modifierOverrides`, {});

  /**
   * The modifier actually in force at a node.
   *
   * When the wanted one is not permitted, walk its `fallback` chain — Mk.III
   * Extra degrades to Mk.III Speedup rather than to nothing, keeping the
   * proliferator you asked for. Only if the chain runs out does it settle on
   * the first permitted option.
   */
  const resolveModifier = useCallback((recipe: TreeRecipe, path: string) => {
    const allowed = allowedModifiers(recipe, modifiers);
    if (allowed.length === 0) return undefined;

    const wanted = modifierOverrides[path] ?? modifierDefault;
    const seen = new Set<string>();
    let id: string | undefined = wanted;
    while (id && !seen.has(id)) {
      seen.add(id);
      const hit = allowed.find(m => m.id === id);
      if (hit) return hit;
      id = modifiers.find(m => m.id === id)?.fallback;
    }
    return allowed[0];
  }, [modifiers, modifierOverrides, modifierDefault]);

  const config = useMemo<TreeConfig>(() => ({
    recipesByOutput: source.recipesByOutput,
    modifierOf: (recipe, path) => resolveModifier(recipe, path) ?? { speed: 1, productivity: 1 },
    // The chosen building's multiplier decides the machine count, so the
    // resolution has to happen here rather than after the tree is built.
    speedOf: (machine, path) => {
      const options = source.machinesFor?.(machine) ?? [];
      return options[resolveMachine(machine, path)]?.speed ?? 1;
    },
    recipeChoice: resolveRecipe,
  }), [source, resolveMachine, resolveRecipe, resolveModifier]);

  const setMachineDefault = useCallback((machine: string, index: number) =>
    setMachineDefaults(prev => ({ ...prev, [machine]: index })), [setMachineDefaults]);
  const setMachineOverride = useCallback((path: string, index: number) =>
    setMachineOverrides(prev => ({ ...prev, [path]: index })), [setMachineOverrides]);

  // A per-row choice outranks the default and survives a default change — it
  // was set deliberately, so a change elsewhere should not silently undo it.
  // Reset is explicit instead, per row or for all of them.
  const clearMachineOverride = useCallback((path: string) => setMachineOverrides(prev => {
    const next = { ...prev };
    delete next[path];
    return next;
  }), [setMachineOverrides]);

  const setRecipeDefault = useCallback((item: number, index: number) =>
    setRecipeDefaults(prev => ({ ...prev, [item]: index })), [setRecipeDefaults]);
  const setRecipeOverride = useCallback((path: string, index: number) =>
    setRecipeOverrides(prev => ({ ...prev, [path]: index })), [setRecipeOverrides]);
  const clearRecipeOverride = useCallback((path: string) => setRecipeOverrides(prev => {
    const next = { ...prev };
    delete next[path];
    return next;
  }), [setRecipeOverrides]);

  const setModifierOverride = useCallback((path: string, id: string) =>
    setModifierOverrides(prev => ({ ...prev, [path]: id })), [setModifierOverrides]);
  const clearModifierOverride = useCallback((path: string) => setModifierOverrides(prev => {
    const next = { ...prev };
    delete next[path];
    return next;
  }), [setModifierOverrides]);

  const resetAll = useCallback(() => {
    setMachineDefaults({});
    setMachineOverrides({});
    setRecipeDefaults({});
    setRecipeOverrides({});
    setModifierDefault(modifiers[0]?.id ?? 'none');
    setModifierOverrides({});
  }, [setMachineDefaults, setMachineOverrides, setRecipeDefaults, setRecipeOverrides,
      setModifierDefault, setModifierOverrides, modifiers]);

  const overrideCount = Object.keys(machineOverrides).length
    + Object.keys(recipeOverrides).length
    + Object.keys(modifierOverrides).length;
  const anyChoice = overrideCount > 0
    || Object.keys(machineDefaults).length > 0
    || Object.keys(recipeDefaults).length > 0;

  return {
    config,
    machineDefaults, machineOverrides, resolveMachine,
    setMachineDefault, setMachineOverride, clearMachineOverride,
    recipeDefaults, recipeOverrides, resolveRecipe,
    setRecipeDefault, setRecipeOverride, clearRecipeOverride,
    modifiers, modifierDefault, modifierOverrides, resolveModifier,
    setModifierDefault, setModifierOverride, clearModifierOverride,
    resetAll, overrideCount, anyChoice,
  };
}
