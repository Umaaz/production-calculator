// Production tree view.
//
// Game-agnostic. It declares the data it needs as TreeDataSource and knows
// nothing about any game: items are numeric ids, icons are rendered by a
// component the caller supplies, and names come from a lookup function.
//
// Calculation lives in ./productionTree.

import React, { useCallback, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { usePersisted } from './usePersisted';
import { OptionPicker } from './OptionPicker';
import type { PickerOption } from './OptionPicker';
import { buildTree, aggregate, collectPaths, usableRecipes } from './productionTree';
import type { TreeNode, TreeRecipe, TreeTarget, Totals, NodeOption } from './productionTree';
import { useTreeConfig, allowedModifiers, modifierDetail } from './useTreeConfig';

export interface TreeIconProps {
  id: number;
  size?: number;
}

/** One building that can run a machine category. */
export interface MachineOption {
  /** Proto id, used for the icon. */
  id: number;
  name: string;
  /** Craft-speed multiplier, 1 = baseline. */
  speed: number;
  /** Power draw of one of these, in kW. Absent hides the power column. */
  powerKW?: number;
  /**
   * Game-specific extra shown after the speed in the picker — power draw, for
   * instance. The view supplies the speed itself so it stays consistently
   * formatted; anything with units belongs to the game.
   */
  detail?: string;
}

/** A transport tier, for expressing a rate as a number of lanes. */
export interface TransportOption {
  /** Proto id, used for the icon. */
  id: number;
  name: string;
  /** Items per minute one lane carries. */
  ratePerMin: number;
}

/** Something applied to a recipe that changes its speed or yield. */
export interface ModifierOption {
  /** Stable id, matched against a recipe's `modifiersSupported`. */
  id: string;
  name: string;
  /** Proto id for the icon; absent for a "none" entry. */
  iconId?: number;
  speed: number;
  productivity: number;
  /** Multiplier on machine power draw, shown as detail. */
  power?: number;
  /**
   * Which modifier to use when a recipe forbids this one. Lets an
   * extra-products mode degrade to the speed mode of the same tier rather than
   * to nothing, so the proliferator is still applied.
   */
  fallback?: string;
}

/** Everything the view needs from a game. */
export interface TreeDataSource {
  /** Recipes that can produce each item, keyed by output id. */
  recipesByOutput: Map<number, TreeRecipe[]>;
  /** Display name for an item or building id. */
  nameOf: (id: number) => string;
  /** Renders the game's icon for an id. */
  Icon: ComponentType<TreeIconProps>;
  /**
   * Buildings that can run a machine category, in tier order.
   *
   * The first entry is the default. An empty or missing result means the game
   * has no choice to offer, and the category renders as plain text at ×1.
   */
  machinesFor?: (machine: string) => MachineOption[];
  /**
   * What one unit of a machine category is called, plural. Extraction is not
   * always counted in buildings — a miner covers several veins, so the useful
   * figure there is veins. Defaults to "machines".
   */
  unitOf?: (machine: string) => string | undefined;
  /**
   * Belt tiers, slowest first. Supplied means every rate can also be shown as
   * a number of lanes; omitted hides the belt column entirely.
   */
  beltsFor?: () => TransportOption[];
  /**
   * Every modifier the game has, best-first. A recipe narrows this with
   * `modifiersSupported`; omitting the member entirely hides the column.
   */
  modifiersFor?: () => ModifierOption[];
  /**
   * Extra summary panels for the side column, given the fully resolved plan.
   *
   * Anything whose maths is game-specific belongs here rather than in the view
   * — proliferator consumption, power draw, logistics. Everything needed is on
   * PlanEntry, so the game can compute without re-deriving the tree.
   *
   * `storageKey` is passed through so a panel can persist its own settings
   * under the same namespace as the rest of the plan.
   */
  Panels?: ComponentType<{ plan: PlanEntry[]; storageKey: string }>;
  /**
   * Raw materials and machines a game computes for itself, folded into the
   * view's own totals.
   *
   * Some production can't be expressed as a tree — recipes that feed each other
   * have to be solved as a system, which the game does off to the side (the DSP
   * oil chain, for one). The tree carries those as `external` stand-ins that
   * report nothing, so their crude, coal, refineries and smelters would go
   * missing from the totals. This is where the game hands them back: the result
   * is merged into the Raw materials and Machines panels exactly as if the tree
   * had produced it, machines grouped into the same building rows.
   *
   * Given the resolved plan — the stand-ins are on it, carrying the demand — and
   * a resolver for the build-wide default building of a category, so the game's
   * machine counts honour the same tier choice the rest of the plan does.
   */
  extraTotals?: (plan: PlanEntry[], ctx: ExtraTotalsCtx) => ExtraTotals;
}

/** Context handed to `extraTotals`. */
export interface ExtraTotalsCtx {
  /** The build-wide default building for a category, or undefined if none. */
  machineFor: (category: string) => MachineOption | undefined;
  /**
   * The modifier in force for a recipe run off-tree — the build-wide default,
   * narrowed by the recipe's own restrictions the same way the tree narrows it.
   * A recipe that only accepts speed modes degrades an extra-products choice to
   * the matching speed mode, so machine counts still reflect the proliferator.
   */
  modifierFor: (recipe: TreeRecipe) => ModifierOption | undefined;
  /** The plan's namespace, for reading a game screen's own persisted settings. */
  storageKey: string;
}

/** One machine group a game contributes, in the shape the Machines panel uses. */
export interface ExtraMachine {
  category: string;
  /** The chosen building; omitted renders as the bare category, like the tree. */
  option?: MachineOption;
  /** Fractional machine count. */
  count: number;
  /** What those machines run, when it is worth breaking out more than one. */
  jobs?: Array<{ key: string; name: string; itemId: number; count: number }>;
}

/** What a game adds to the view's totals. */
export interface ExtraTotals {
  /** Raw items drawn, per minute, merged by item id. */
  raw?: Array<{ item: number; rate: number }>;
  /** Machines run, merged into the panel by building. */
  machines?: ExtraMachine[];
}

/**
 * One producing node, with every choice already resolved.
 *
 * Flat rather than nested: a summary panel wants to total across the plan, not
 * walk it. Cyclic and raw nodes are excluded — nothing is being made at those.
 */
export interface PlanEntry {
  path: string;
  /** Item being produced here. */
  itemId: number;
  /** Items per minute produced. */
  rate: number;
  recipe: TreeRecipe;
  /** Crafts per minute across all the machines. */
  crafts: number;
  /** Machine category from the recipe. */
  machineCategory: string;
  /** The chosen building, when the game offers any for that category. */
  machine?: MachineOption;
  /** Fractional machine count. */
  machines: number;
  /** The modifier actually in force, after any fallback. */
  modifier?: ModifierOption;
  /**
   * Gross items per minute entering this node — `qty * crafts`, before any
   * netting. This is what physically moves along the input belts, which is what
   * something applied to the inputs has to be measured against.
   */
  inputs: Array<{ item: number; rate: number }>;
}

/** Stands in for a recipe whose data has no machine, so it stays sortable. */
const UNKNOWN_MACHINE = '—';

const fmtPower = (kW: number) =>
  kW >= 1000 ? `${(kW / 1000).toFixed(kW >= 10000 ? 0 : 1)} MW` : `${Math.round(kW)} kW`;

const fmt = (n: number) =>
  n >= 1000 ? n.toFixed(0)
    : n >= 100 ? n.toFixed(1)
      : Number(n.toFixed(2)).toString();

/** Picks one of a category's buildings. Renders nothing when there is no choice. */
function MachinePicker({ options, value, onChange, Icon, compact }: {
  options: MachineOption[];
  value: number;
  onChange: (index: number) => void;
  Icon: ComponentType<TreeIconProps>;
  compact?: boolean;
}) {
  const chosen = options[value] ?? options[0];
  if (!chosen) return null;

  // A single building is not a choice — show it as plain text rather than a
  // dropdown that can only be reopened onto the same option.
  if (options.length === 1) {
    return (
      <span className="pt-picker-static">
        <Icon id={chosen.id} size={compact ? 16 : 20} />
        <span>{chosen.name}</span>
      </span>
    );
  }

  const detailOf = (o: MachineOption) =>
    o.detail ? `×${o.speed} · ${o.detail}` : `×${o.speed}`;

  return (
    <OptionPicker
      compact={compact}
      Icon={Icon}
      value={value}
      onChange={key => onChange(Number(key))}
      options={options.map((o, i) => ({
        key: i,
        name: o.name,
        iconId: o.id,
        detail: detailOf(o),
      }))}
    />
  );
}

/** "2× Iron Ore + 1× Copper Ingot · 1.5s" — enough to tell alternatives apart. */
function recipeSummary(r: TreeRecipe, nameOf: (id: number) => string): string {
  const ins = r.inputs.map(i => `${i.qty}× ${nameOf(i.item)}`).join(' + ');
  return ins ? `${ins} · ${r.time}s` : `${r.time}s`;
}

/**
 * Ways to obtain an item — every one of them a recipe. Gathering is modelled as
 * a recipe with no inputs, so mining, pumping and crafting all list the same way.
 *
 * Built in one place so the per-row picker and the defaults row agree on the
 * option keys, which are the recipe indices.
 */
function obtainOptions(
  item: number,
  options: NodeOption[],
  source: TreeDataSource,
): PickerOption[] {
  const { nameOf, machinesFor } = source;
  // Keyed by the recipe's index in the item's full list, not its position here:
  // a stored choice has to mean the same thing at every node.
  return options.map(({ index, recipe }) => ({
    key: index,
    name: recipe.name || nameOf(item),
    // Recipes have no icon of their own here, so the machine stands in.
    iconId: (machinesFor?.(recipe.machine) ?? [])[0]?.id,
    detail: recipeSummary(recipe, nameOf),
  }));
}

/** Small reset affordance shared by the machine and recipe cells. */
function OverrideTag({ onClear, title }: { onClear: () => void; title: string }) {
  return (
    <button className="pt-tag pt-tag--alt pt-tag-reset" onClick={onClear} title={title}>
      set ↺
    </button>
  );
}

function RecipeCell({ node, options, value, onOverride, onClear, overridden, source }: {
  node: TreeNode;
  options: NodeOption[];
  value: number;
  onOverride: (path: string, index: number) => void;
  onClear: (path: string) => void;
  overridden: boolean;
  source: TreeDataSource;
}) {
  const { Icon } = source;
  const picks = obtainOptions(node.itemId, options, source);

  // One route and no alternatives to explain — show the name and no control.
  if (picks.length <= 1) {
    return <span className="pt-recipe-static">{node.recipe?.name ?? ''}</span>;
  }

  return (
    <span className="pt-recipe">
      <OptionPicker
        compact
        Icon={Icon}
        value={value}
        onChange={key => onOverride(node.path, Number(key))}
        options={picks}
      />
      {overridden && (
        <OverrideTag onClear={() => onClear(node.path)} title="Use the default recipe for this item" />
      )}
    </span>
  );
}

function MachineCell({ node, resolve, options, onOverride, onClear, overridden, Icon, unitOf }: {
  node: TreeNode;
  resolve: (machine: string, path: string) => number;
  options: MachineOption[];
  onOverride: (path: string, index: number) => void;
  onClear: (path: string) => void;
  overridden: boolean;
  Icon: ComponentType<TreeIconProps>;
  unitOf?: (machine: string) => string | undefined;
}) {
  // A recipe can arrive without a machine if the data is incomplete; show the
  // gap rather than crashing on it.
  const category = node.recipe?.machine ?? UNKNOWN_MACHINE;
  const unit = unitOf?.(category);

  return (
    <span className="pt-machine">
      {options.length > 0 ? (
        <MachinePicker
          compact
          options={options}
          value={resolve(category, node.path)}
          onChange={i => onOverride(node.path, i)}
          Icon={Icon}
        />
      ) : (
        <span className="pt-machine-name">{category}</span>
      )}
      {overridden && (
        <OverrideTag onClear={() => onClear(node.path)} title="Use the default for this machine" />
      )}
      {/* Numerics grouped so they right-align as a block, keeping the whole
          column readable down the page regardless of machine-name length. */}
      <span className="pt-machine-num">
        <span className="pt-machine-count" title={unit}>
          {Math.ceil(node.machines - 1e-9)}{unit ? ` ${unit}` : '×'}
        </span>
        <span className="pt-machine-exact">({fmt(node.machines)})</span>
      </span>
    </span>
  );
}

interface RowCtx {
  source: TreeDataSource;
  open: Set<string>;
  toggle: (path: string) => void;
  /** Chosen machine index for a category at a path. */
  resolve: (machine: string, path: string) => number;
  setOverride: (path: string, index: number) => void;
  clearOverride: (path: string) => void;
  overrides: Record<string, number>;
  /** Chosen recipe index for an item at a path. */
  resolveRecipe: (item: number, path: string) => number;
  recipesFor: (item: number) => NodeOption[];
  setRecipeOverride: (path: string, index: number) => void;
  clearRecipeOverride: (path: string) => void;
  recipeOverrides: Record<string, number>;
  /** Items per minute one belt carries, or 0 when the game has no belts. */
  beltRate: number;
  /** Modifier id in force at a path, and the setters for it. */
  modifiers: ModifierOption[];
  resolveModifier: (recipe: TreeRecipe, path: string) => ModifierOption | undefined;
  setModifierOverride: (path: string, id: string) => void;
  clearModifierOverride: (path: string) => void;
  modifierDefault: string;
  modifierOverrides: Record<string, string>;
  done: Record<string, boolean>;
  /** `cascade` applies the new state to the node's whole subtree. */
  toggleDone: (node: TreeNode, cascade: boolean) => void;
  /** Built once from which optional columns are live; shared by head and rows. */
  template: string;
  showPower: boolean;
}

function Row({ node, depth, ctx }: { node: TreeNode; depth: number; ctx: RowCtx }) {
  const {
    source, open, toggle,
    resolve, setOverride, clearOverride, overrides,
    resolveRecipe, recipesFor, setRecipeOverride, clearRecipeOverride, recipeOverrides,
    beltRate, done, toggleDone, template, showPower,
    modifiers, modifierDefault, resolveModifier, setModifierOverride, clearModifierOverride, modifierOverrides,
  } = ctx;
  const isDone = !!done[node.path];

  // Draw at this node: one machine's rating, scaled by how many are running and
  // by whatever the modifier does to consumption. Uses the fractional machine
  // count, so this is the load being drawn rather than the rating of the
  // machines you would build.
  const power = (() => {
    if (!node.recipe || node.cyclic || !showPower) return null;
    const options = source.machinesFor?.(node.recipe.machine) ?? [];
    const chosen = options[resolve(node.recipe.machine, node.path)];
    if (chosen?.powerKW === undefined) return null;
    const mult = resolveModifier(node.recipe, node.path)?.power ?? 1;
    return { base: chosen.powerKW, mult, total: chosen.powerKW * node.machines * mult };
  })();
  const { Icon, nameOf } = source;
  const hasChildren = node.children.length > 0;
  const isOpen = open.has(node.path);

  return (
    <>
      <div
        className={`pt-row${node.recipe ? '' : ' is-raw'}${isDone ? ' is-done' : ''}`}
        style={{ gridTemplateColumns: template }}
      >
        <span className="pt-cell pt-cell-item" style={{ paddingLeft: 6 + depth * 20 }}>
          <button
            className={`pt-caret${hasChildren ? '' : ' is-leaf'}`}
            onClick={() => hasChildren && toggle(node.path)}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {hasChildren ? (isOpen ? '▾' : '▸') : '•'}
          </button>
          <Icon id={node.itemId} size={22} />
          <span className="pt-name">{nameOf(node.itemId)}</span>
          {node.recipe?.external && (
            <span className="pt-tag pt-tag--external" title="Solved on its own screen">
              ↗ external
            </span>
          )}
          {!node.recipe && (
            <span
              className="pt-tag pt-tag--raw"
              title={node.cyclic
                ? `Every recipe for ${nameOf(node.itemId)} needs something already `
                  + 'being made above it, so none of them can be used here. Its '
                  + `${fmt(node.rate)}/min has to be sourced separately.`
                : undefined}
            >
              raw
            </span>
          )}
        </span>

        <span className="pt-cell pt-cell-rate">{fmt(node.rate)}/min</span>

        {beltRate > 0 && (
          <span className="pt-cell pt-cell-belts">
            <span className="pt-belt-count">{Math.ceil(node.rate / beltRate - 1e-9)}×</span>
            <span className="pt-belt-exact">({fmt(node.rate / beltRate)})</span>
          </span>
        )}

        <span className="pt-cell pt-cell-recipe">
          {node.recipe && !node.cyclic && (
            <RecipeCell
              node={node}
              options={node.options}
              value={resolveRecipe(node.itemId, node.path)}
              onOverride={setRecipeOverride}
              onClear={clearRecipeOverride}
              overridden={node.path in recipeOverrides}
              source={source}
            />
          )}
        </span>

        <span className="pt-cell pt-cell-machine">
          {node.recipe && !node.cyclic && (
            <MachineCell
              node={node}
              resolve={resolve}
              options={source.machinesFor?.(node.recipe.machine) ?? []}
              onOverride={setOverride}
              onClear={clearOverride}
              overridden={node.path in overrides}
              Icon={Icon}
              unitOf={source.unitOf}
            />
          )}
        </span>

        {modifiers.length > 0 && (
          <span className="pt-cell pt-cell-mod">
            {node.recipe && !node.cyclic && (() => {
              const allowed = allowedModifiers(node.recipe, modifiers);
              if (allowed.length <= 1) return null;
              const current = resolveModifier(node.recipe, node.path);
              // The recipe would not take what was asked for, so a fallback is
              // in force. Say so, or the row looks like it ignored the setting.
              const asked = modifierOverrides[node.path] ?? modifierDefault;
              const substituted = current !== undefined && current.id !== asked;
              return (
                <>
                  <OptionPicker
                    compact
                    Icon={Icon}
                    value={current?.id ?? allowed[0].id}
                    onChange={key => setModifierOverride(node.path, String(key))}
                    options={allowed.map(m => ({
                      key: m.id,
                      name: m.name,
                      iconId: m.iconId,
                      detail: modifierDetail(m),
                    }))}
                  />
                  {substituted && (
                    <span
                      className="pt-tag pt-tag--sub"
                      title={`This recipe does not accept ${
                        modifiers.find(m => m.id === asked)?.name ?? asked}`}
                    >
                      ↓
                    </span>
                  )}
                  {node.path in modifierOverrides && (
                    <OverrideTag
                      onClear={() => clearModifierOverride(node.path)}
                      title="Use the default modifier"
                    />
                  )}
                </>
              );
            })()}
          </span>
        )}

        {showPower && (
          <span className="pt-cell pt-cell-power">
            {power && (
              <span
                className="pt-power"
                title={`${fmtPower(power.base)} each × ${fmt(node.machines)}${
                  power.mult !== 1 ? ` × ${power.mult} modifier` : ''}`}
              >
                {fmtPower(power.total)}
                {power.mult !== 1 && <span className="pt-power-mult">×{power.mult}</span>}
              </span>
            )}
          </span>
        )}

        <span className="pt-cell pt-cell-by">
          {node.byproducts.map(b => (
            <span key={b.item} className="pt-by" title={nameOf(b.item)}>
              <Icon id={b.item} size={15} />
              <span>+{fmt(b.rate)}</span>
            </span>
          ))}
        </span>

        <span className="pt-cell pt-cell-check">
          {/* Only a hint where it does something — leaf rows have no subtree. */}
          {node.children.length > 0 && <span className="pt-check-hint">shift</span>}
          <button
            className={`pt-check${isDone ? ' is-done' : ''}`}
            onClick={e => toggleDone(node, e.shiftKey)}
            aria-pressed={isDone}
            title={
              (isDone ? 'Mark as not built' : 'Mark as built')
              + (node.children.length > 0
                ? `\nShift-click to ${isDone ? 'clear' : 'mark'} this and everything below it`
                : '')
            }
          >
            ✓
          </button>
        </span>
      </div>

      {isOpen && node.children.map(c => (
        <Row key={c.path} node={c} depth={depth + 1} ctx={ctx} />
      ))}
    </>
  );
}

/** Machine categories appearing anywhere in the trees, in first-seen order. */
function categoriesIn(nodes: TreeNode[]): string[] {
  const seen: string[] = [];
  const walk = (n: TreeNode) => {
    const c = n.recipe?.machine;
    if (c && !n.cyclic && !seen.includes(c)) seen.push(c);
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return seen;
}

export function ProductionTreeView({ targets, source, storageKey }: {
  targets: TreeTarget[];
  /** Namespaces the persisted machine choices. */
  storageKey: string;
  source: TreeDataSource;
}) {
  const { Icon, nameOf } = source;

  // Every machine, recipe and modifier choice is resolved in one place, shared
  // with any other screen that builds this tree — see ./useTreeConfig. Aliased
  // back to the short local names the rest of this view already uses.
  const {
    config,
    machineDefaults: defaults, machineOverrides: overrides, resolveMachine: resolve,
    setMachineDefault: setDefault, setMachineOverride: setOverride, clearMachineOverride: clearOverride,
    recipeDefaults, recipeOverrides, resolveRecipe,
    setRecipeDefault, setRecipeOverride, clearRecipeOverride,
    modifiers, modifierDefault, modifierOverrides, resolveModifier,
    setModifierDefault, setModifierOverride, clearModifierOverride,
    resetAll, overrideCount, anyChoice,
  } = useTreeConfig(source, storageKey);

  /**
   * Every route to an item, for the defaults row — which is not tied to a node
   * and so cannot know which of them would loop. A default that doesn't apply
   * somewhere falls back per node inside buildTree.
   */
  const recipesFor = useCallback(
    (item: number): NodeOption[] =>
      usableRecipes(item, config).map((recipe, index) => ({ index, recipe })),
    [config],
  );

  // Build progress. Keyed by node path like the overrides, so ticks survive a
  // rate change and reattach to the same place in the chain.
  const [done, setDone] = usePersisted<Record<string, boolean>>(`${storageKey}:done`, {});

  /**
   * Toggle a node, optionally carrying the new state down its whole subtree.
   *
   * The clicked node decides the direction, so shift-clicking a ticked parent
   * clears the branch and shift-clicking an unticked one fills it — rather than
   * each descendant flipping independently.
   */
  const toggleDone = useCallback((node: TreeNode, cascade: boolean) => setDone(prev => {
    const next = { ...prev };
    const value = !prev[node.path];
    const paths = cascade ? collectPaths(node) : [node.path];
    // Deleted rather than set false, so cleared ticks don't accumulate.
    paths.forEach(p => { if (value) next[p] = true; else delete next[p]; });
    return next;
  }), [setDone]);

  // Belt tier is a single build-wide decision, so there is no per-node override.
  const belts = useMemo(() => source.beltsFor?.() ?? [], [source]);
  const [beltIndex, setBeltIndex] = usePersisted<number>(`${storageKey}:belt`, 0);
  const beltRate = belts[beltIndex]?.ratePerMin ?? belts[0]?.ratePerMin ?? 0;

  // Rooted at the item id rather than the target's position, so machine
  // overrides stay attached to the right nodes when outputs are reordered or
  // removed. Two targets for the same item produce identical paths and share
  // their overrides, which is the sensible reading of that case.
  const targetTrees = useMemo(
    () => targets.map(t => buildTree(t.itemId, t.rate, config)),
    [targets, config],
  );

  const trees = targetTrees;

  /** Items in the trees with more than one way to obtain them. */
  const choosableItems = useMemo(() => {
    const seen: number[] = [];
    const walk = (n: TreeNode) => {
      if (n.alternatives > 1 && !seen.includes(n.itemId)) seen.push(n.itemId);
      n.children.forEach(walk);
    };
    trees.forEach(walk);
    return seen;
  }, [trees]);

  // Totals span every target — shared intermediates add up across outputs.
  const totals = useMemo(() => {
    const acc: Totals = { raw: {}, machines: {}, produced: {} };
    trees.forEach(t => aggregate(t, acc));
    return acc;
  }, [trees]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Expanded by default: the tree is the answer, so hiding it behind clicks is
  // the wrong default. Collapsed paths are tracked rather than open ones, so a
  // rate change doesn't reset the view.
  const open = useMemo(() => {
    const all = new Set<string>();
    trees.forEach(t => collectPaths(t).forEach(p => all.add(p)));
    collapsed.forEach(p => all.delete(p));
    return all;
  }, [trees, collapsed]);

  const toggle = (path: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });

  /** The plan handed to game-supplied panels and to the game's own totals. */
  const plan = useMemo<PlanEntry[]>(() => {
    const out: PlanEntry[] = [];
    const walk = (n: TreeNode) => {
      if (n.recipe && !n.cyclic) {
        const category = n.recipe.machine ?? UNKNOWN_MACHINE;
        out.push({
          path: n.path,
          itemId: n.itemId,
          rate: n.rate,
          recipe: n.recipe,
          crafts: n.crafts,
          machineCategory: category,
          machine: (source.machinesFor?.(category) ?? [])[resolve(category, n.path)],
          machines: n.machines,
          modifier: resolveModifier(n.recipe, n.path),
          inputs: n.recipe.inputs.map(i => ({ item: i.item, rate: i.qty * n.crafts })),
        });
      }
      n.children.forEach(walk);
    };
    trees.forEach(walk);
    return out;
  }, [trees, source, resolve, resolveModifier]);

  // The build-wide default building for a category. No node path: a game's
  // off-tree totals belong to no node, so only the factory-wide default applies.
  const machineFor = useCallback(
    (category: string) => (source.machinesFor?.(category) ?? [])[defaults[category] ?? 0],
    [source, defaults],
  );

  // Raw materials and machines the game solves off the tree — the oil chain's
  // crude, coal, refineries and smelter — folded into the totals below.
  const extra = useMemo(
    // Empty path so the modifier resolves to the build-wide default: an off-tree
    // recipe has no node, so no per-row override can apply to it.
    () => source.extraTotals?.(plan, {
      machineFor,
      modifierFor: recipe => resolveModifier(recipe, ''),
      storageKey,
    }),
    [source, plan, machineFor, resolveModifier, storageKey],
  );

  // Both panels sort by name: the contents shift as choices change, and a
  // stable alphabetical order is easier to re-find an entry in than one that
  // reorders whenever a quantity does.
  const rawRows = useMemo(() => {
    const merged: Record<number, number> = { ...totals.raw };
    extra?.raw?.forEach(({ item, rate }) => {
      merged[item] = (merged[item] ?? 0) + rate;
    });
    return Object.entries(merged)
      .sort((a, z) => nameOf(Number(a[0])).localeCompare(nameOf(Number(z[0]))));
  }, [totals.raw, extra, nameOf]);

  // Counted per chosen building, not per category: with per-row overrides a
  // single category can be running two different tiers, and totalling those
  // together would be meaningless.
  const machineRows = useMemo(() => {
    interface Job { key: string; name: string; itemId: number; count: number }
    interface Row {
      option?: MachineOption;
      category: string;
      count: number;
      jobs: Map<string, Job>;
    }

    const acc = new Map<string, Row>();

    const addJob = (row: Row, key: string, name: string, itemId: number, count: number) => {
      const job = row.jobs.get(key) ?? { key, name, itemId, count: 0 };
      job.count += count;
      row.jobs.set(key, job);
    };
    const rowFor = (key: string, option: MachineOption | undefined, category: string) => {
      const row = acc.get(key) ?? { option, category, count: 0, jobs: new Map() };
      acc.set(key, row);
      return row;
    };

    const walk = (n: TreeNode) => {
      // External stand-ins report no machines of their own — whatever solves
      // them contributes through extraTotals below, so counting them here would
      // add a phantom zero row. Same exclusion aggregate() makes.
      if (n.recipe && !n.cyclic && !n.recipe.external) {
        // A recipe can arrive with no machine if the data is incomplete. Group
        // those under a visible placeholder rather than letting an undefined
        // key reach the comparator below and take the whole view down.
        const category = n.recipe.machine ?? UNKNOWN_MACHINE;
        const option = (source.machinesFor?.(category) ?? [])[resolve(category, n.path)];
        const key = option ? `${category}#${option.id}` : category;
        const row = rowFor(key, option, category);
        row.count += n.machines;
        // Keyed on recipe and output: two recipes can share a name, and the
        // same recipe can appear in several branches.
        addJob(row, `${n.recipe.name}#${n.itemId}`,
          n.recipe.name || nameOf(n.itemId), n.itemId, n.machines);
      }
      n.children.forEach(walk);
    };
    trees.forEach(walk);

    // Machines the game solved off-tree, merged into the same building rows so
    // the oil chain's smelter lands with the rest of the smelting.
    extra?.machines?.forEach(m => {
      const key = m.option ? `${m.category}#${m.option.id}` : m.category;
      const row = rowFor(key, m.option, m.category);
      row.count += m.count;
      m.jobs?.forEach(j => addJob(row, j.key, j.name, j.itemId, j.count));
    });

    return Array.from(acc.values())
      .map(row => ({
        ...row,
        jobs: Array.from(row.jobs.values()).sort((a, z) => a.name.localeCompare(z.name)),
      }))
      .sort((a, z) =>
        (a.option?.name ?? a.category ?? '').localeCompare(z.option?.name ?? z.category ?? ''));
  }, [trees, source, resolve, nameOf, extra]);

  // Only categories with something to pick between. A category with a single
  // building has no decision in it, so it is noise in a defaults bar.
  const choosableCategories = useMemo(
    () => categoriesIn(trees).filter(c => (source.machinesFor?.(c) ?? []).length > 1),
    [trees, source],
  );

  // Power is only meaningful where the game rates its buildings.
  const showPower = useMemo(
    () => plan.some(e => e.machine?.powerKW !== undefined),
    [plan],
  );

  /**
   * Grid template, composed from the live columns.
   *
   * Three optional columns would otherwise mean eight CSS variants to keep in
   * step; building the string once here keeps head and rows in agreement by
   * construction.
   */
  const template = useMemo(() => [
    'minmax(220px, 2fr)',                              // item
    '86px',                                            // rate
    beltRate > 0 ? '90px' : null,                      // belts
    'minmax(125px, 0.9fr)',                            // recipe
    'minmax(175px, 1.2fr)',                            // machine
    modifiers.length > 0 ? 'minmax(130px, 0.9fr)' : null,
    showPower ? '96px' : null,
    'minmax(78px, 0.5fr)',                             // byproducts
    '28px',                                            // done
  ].filter(Boolean).join(' '), [beltRate, modifiers.length, showPower]);

  const ctx: RowCtx = {
    source, open, toggle,
    resolve, setOverride, clearOverride, overrides,
    resolveRecipe, recipesFor, setRecipeOverride, clearRecipeOverride, recipeOverrides,
    beltRate, done, toggleDone, template, showPower,
    modifiers, modifierDefault, resolveModifier, setModifierOverride, clearModifierOverride, modifierOverrides,
  };

  if (!trees.length) return null;

  return (
    <div className="pt-layout">
      <div className="pt">
        {/* One bar rather than a row per kind, so hiding an empty group cannot
            strand the reset button. */}
        {(choosableCategories.length > 0 || choosableItems.length > 0 || belts.length > 1 || anyChoice) && (
          <div className="pt-defaults">
            {/* Machines and belts share a line — both are build-wide equipment
                choices. Recipes get their own, since the list is open-ended. */}
            <div className="pt-defaults-row">
              {choosableCategories.length > 0 && (
                <>
                  <span className="pt-defaults-label">Machines</span>
                  {choosableCategories.map(cat => (
                    <MachinePicker
                      key={cat}
                      options={source.machinesFor?.(cat) ?? []}
                      value={defaults[cat] ?? 0}
                      onChange={i => setDefault(cat, i)}
                      Icon={Icon}
                    />
                  ))}
                </>
              )}

              {choosableCategories.length > 0 && (belts.length > 1 || modifiers.length > 1) && (
                <span className="pt-defaults-sep" />
              )}

              {modifiers.length > 1 && (
                <>
                  <span className="pt-defaults-label">Modifier</span>
                  <OptionPicker
                    Icon={Icon}
                    value={modifierDefault}
                    onChange={key => setModifierDefault(String(key))}
                    options={modifiers.map(m => ({
                      key: m.id,
                      name: m.name,
                      iconId: m.iconId,
                      detail: modifierDetail(m),
                    }))}
                  />
                  {belts.length > 1 && <span className="pt-defaults-sep" />}
                </>
              )}

              {belts.length > 1 && (
                <>
                  <span className="pt-defaults-label">Belts</span>
                  <OptionPicker
                    Icon={Icon}
                    value={beltIndex}
                    onChange={key => setBeltIndex(Number(key))}
                    options={belts.map((b, i) => ({
                      key: i,
                      name: b.name,
                      iconId: b.id,
                      detail: `${fmt(b.ratePerMin)} / min`,
                    }))}
                  />
                </>
              )}

              {anyChoice && (
                <button
                  className="pt-defaults-reset"
                  onClick={resetAll}
                  title="Return every machine and recipe to its default"
                >
                  Reset
                  {overrideCount > 0 && ` (${overrideCount} override${overrideCount === 1 ? '' : 's'})`}
                </button>
              )}
            </div>

            {choosableItems.length > 0 && (
              <div className="pt-defaults-row">
                <span className="pt-defaults-label">Recipes</span>
                {choosableItems.map(item => (
                  <OptionPicker
                    key={item}
                    Icon={Icon}
                    value={recipeDefaults[item] ?? 0}
                    onChange={key => setRecipeDefault(item, Number(key))}
                    options={obtainOptions(item, recipesFor(item), source)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-head" style={{ gridTemplateColumns: template }}>
          <span className="pt-col">Item</span>
          <span className="pt-col pt-cell-rate">Rate</span>
          {beltRate > 0 && <span className="pt-col pt-cell-belts">Belts</span>}
          <span className="pt-col">Recipe</span>
          <span className="pt-col">Machine</span>
          {modifiers.length > 0 && <span className="pt-col">Modifier</span>}
          {showPower && <span className="pt-col pt-cell-power">Power</span>}
          <span className="pt-col">Byproducts</span>
          <span className="pt-col pt-cell-check">
            {Object.keys(done).length > 0 && (
              <button
                className="pt-check-clear"
                onClick={() => setDone({})}
                title={`Clear ${Object.keys(done).length} mark(s)`}
              >
                ↺
              </button>
            )}
          </span>
        </div>

        <div className="pt-body">
          {trees.map((tree, i) => (
            // Keyed by position, not path: two targets for the same item share
            // a root path by design.
            <React.Fragment key={`${i}:${tree.path}`}>
              {trees.length > 1 && (
                <div className="pt-divider">
                  <Icon id={tree.itemId} size={16} />
                  <span>{nameOf(tree.itemId)}</span>
                  {/* From the node, not targets[i]: the appended solver trees
                      have no matching target. */}
                  <span className="pt-divider-rate">{fmt(tree.rate)}/min</span>
                </div>
              )}
              <Row node={tree} depth={0} ctx={ctx} />
            </React.Fragment>
          ))}
        </div>
      </div>

      <aside className="pt-side">
        <div className="pt-side-block">
          <div className="pt-side-title">Raw materials / min</div>
          {rawRows.length === 0 && <div className="pt-side-empty">None.</div>}
          {rawRows.map(([id, r]) => (
            <div key={id} className="pt-side-row">
              <Icon id={Number(id)} size={20} />
              <span className="pt-side-name">{nameOf(Number(id))}</span>
              <span className="pt-side-val">{fmt(r)}</span>
            </div>
          ))}
        </div>

        {source.Panels && <source.Panels plan={plan} storageKey={storageKey} />}

        <div className="pt-side-block">
          <div className="pt-side-title">Machines</div>
          {machineRows.length === 0 && <div className="pt-side-empty">None.</div>}
          {machineRows.map(({ option, category, count, jobs }) => {
            const unit = source.unitOf?.(category);
            return (
              <div key={option ? `${category}#${option.id}` : category} className="pt-side-group">
                <div className="pt-side-row">
                  {option ? <Icon id={option.id} size={20} /> : <span style={{ width: 20 }} />}
                  <span className="pt-side-name">
                    {option ? option.name : category}
                    {unit && <span className="pt-side-unit"> · {unit}</span>}
                  </span>
                  <span className="pt-side-val">
                    {Math.ceil(count - 1e-9)}
                    <span className="pt-side-exact"> ({fmt(count)})</span>
                  </span>
                </div>

                {/* What this machine is actually running. Only worth listing
                    when there is more than one job on it. */}
                {jobs.length > 1 && jobs.map(job => (
                  <div key={job.key} className="pt-side-subrow">
                    <Icon id={job.itemId} size={14} />
                    <span className="pt-side-name">{job.name}</span>
                    <span className="pt-side-val">
                      {Math.ceil(job.count - 1e-9)}
                      <span className="pt-side-exact"> ({fmt(job.count)})</span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
