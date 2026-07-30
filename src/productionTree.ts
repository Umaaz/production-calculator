// Production tree calculation.
//
// Pure and game-agnostic: items are numeric ids, recipes are plain data, and
// nothing here imports React or any game module.

export interface RecipeIO {
  item: number;
  qty: number;
}

export interface TreeRecipe {
  name: string;
  /** Machine category, e.g. 'smelter'. */
  machine: string;
  /** Seconds for one craft at speed ×1. */
  time: number;
  inputs: RecipeIO[];
  outputs: RecipeIO[];
  /**
   * Ids of the modifiers this recipe accepts. Absent means all of them —
   * restricting is the exception, so the common case needs no annotation.
   *
   * Lists only what may be applied; a modifier with no effect is always
   * available regardless, so "apply nothing" never has to be listed.
   */
  modifiersSupported?: string[];
  /**
   * A stand-in for production handled outside the tree — a solver for recipes
   * that feed each other, say.
   *
   * It takes no inputs, so the branch ends at it, but unlike a raw resource
   * something else in the plan does make this item. It therefore contributes no
   * machines and no raw demand; whatever accounts for it reports its own.
   */
  external?: boolean;
}

/** Effect of a modifier at one node. */
export interface ModifierEffect {
  /** Multiplier on craft speed. */
  speed: number;
  /** Multiplier on output quantity. */
  productivity: number;
}

const NO_MODIFIER: ModifierEffect = { speed: 1, productivity: 1 };

/** A recipe offered at a node, with its index in the item's full list. */
export interface NodeOption {
  /**
   * Position in `usableRecipes(item)` — the same list everywhere, so a stored
   * choice means the same thing at every node.
   */
  index: number;
  recipe: TreeRecipe;
}

export interface TreeNode {
  itemId: number;
  /** Items per minute required at this node. */
  rate: number;
  /** null when nothing produces this item — a raw input. */
  recipe: TreeRecipe | null;
  /** Fractional machines needed; 0 for raw. */
  machines: number;
  /**
   * Crafts completed per minute across all those machines. Gross input rates
   * are `recipe.inputs[n].qty * crafts`, which is what a consumer needs to
   * reason about anything applied to the items going in.
   */
  crafts: number;
  /** Net extra outputs from the same crafts. */
  byproducts: Array<{ item: number; rate: number }>;
  /** Expansion hit the depth cap — a self-feeding selection, most likely. */
  cyclic: boolean;
  /** Every recipe that could produce this item. */
  options: NodeOption[];
  /** How many of those there are. */
  alternatives: number;
  /** Index of the recipe used, in the item's full list. */
  recipeIndex: number;
  /** Stable identity for keys and per-node overrides. */
  path: string;
  children: TreeNode[];
}

export interface TreeTarget {
  itemId: number;
  /** Items per minute wanted. */
  rate: number;
}

export interface TreeConfig {
  recipesByOutput: Map<number, TreeRecipe[]>;
  /**
   * Which alternative recipe to use for an item, as an index into
   * usableRecipes(). Defaults to 0.
   *
   * Takes the node path as well as the item so a caller can override one
   * branch without changing every use of that item.
   */
  recipeChoice?: (item: number, path: string) => number;
  /** Modifier in force at a node. Defaults to no effect. */
  modifierOf?: (recipe: TreeRecipe, path: string) => ModifierEffect;
  /**
   * Craft-speed multiplier for a machine category. Defaults to ×1.
   *
   * Takes the node path as well so a caller can apply a per-node machine
   * override — the choice changes the machine count, so it has to be known
   * while the tree is built rather than patched on afterwards.
   */
  speedOf?: (machine: string, path: string) => number;
  /** Guard against pathological graphs. */
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 40;

/**
 * Net quantity of `item` per craft — outputs minus inputs.
 *
 * Several DSP recipes consume and produce the same item. Reformed Refinement
 * takes 2 refined oil and returns 3; X-ray Cracking takes 2 hydrogen and
 * returns 3. Using the gross output would understate the craft count and, worse,
 * make the recipe depend on its own product and recurse forever. Netting is
 * what makes those recipes terminate and come out right.
 */
function netQty(recipe: TreeRecipe, item: number): number {
  const out = recipe.outputs.reduce((s, o) => s + (o.item === item ? o.qty : 0), 0);
  const inp = recipe.inputs.reduce((s, i) => s + (i.item === item ? i.qty : 0), 0);
  return out - inp;
}

/** Recipes that produce a net positive amount of the item. */
export function usableRecipes(item: number, cfg: TreeConfig): TreeRecipe[] {
  return (cfg.recipesByOutput.get(item) ?? []).filter(r => netQty(r, item) > 0);
}

export function buildTree(
  itemId: number,
  ratePerMin: number,
  cfg: TreeConfig,
  path = '',
  depth = 0,
): TreeNode {
  const here = path === '' ? String(itemId) : `${path}/${itemId}`;
  const base: TreeNode = {
    itemId, rate: ratePerMin, recipe: null, machines: 0, crafts: 0,
    byproducts: [], cyclic: false, options: [], alternatives: 0, recipeIndex: 0,
    path: here, children: [],
  };

  const all = usableRecipes(itemId, cfg);

  // Raw: nothing makes it, so the branch ends here. Gathering is a recipe like
  // any other — one with no inputs — so there is no separate "sourced directly"
  // state to represent.
  if (all.length === 0) return base;

  // Every recipe is offered, everywhere. Nothing here is unavailable.
  const options: NodeOption[] = all.map((recipe, index) => ({ index, recipe }));
  base.options = options;
  base.alternatives = options.length;

  if (depth >= (cfg.maxDepth ?? DEFAULT_MAX_DEPTH)) return { ...base, cyclic: true };

  // Recipe order in the data is the preference order: index 0 is the default.
  // Refined Oil lists Plasma Refining before Reformed Refinement, so the
  // self-feeding pair is never the automatic choice — no rule in code needed.
  const wanted = cfg.recipeChoice?.(itemId, here) ?? 0;
  const chosen = options.find(o => o.index === wanted) ?? options[0];
  const { index, recipe } = chosen;
  const mod = cfg.modifierOf?.(recipe, here) ?? NO_MODIFIER;

  // Productivity raises the yield of a craft, so fewer crafts are needed.
  // Inputs are deliberately not scaled — that is the whole point of it.
  const perCraft = netQty(recipe, itemId) * mod.productivity;
  const crafts = ratePerMin / perCraft;          // crafts per minute

  const speed = cfg.speedOf?.(recipe.machine, here) ?? 1;
  // One machine completes 60/time crafts a minute at ×1.
  const craftsPerMachine = (60 / recipe.time) * speed * mod.speed;


  const children = recipe.inputs
    .map(input => ({ item: input.item, qty: -netQty(recipe, input.item) }))
    // A net-negative requirement means the recipe returns more than it takes;
    // that is a byproduct, not a dependency.
    .filter(need => need.qty > 0)
    .map(need => buildTree(need.item, need.qty * crafts, cfg, here, depth + 1));

  // Byproducts benefit from productivity too — it lifts every output.
  const byproducts = recipe.outputs
    .filter(o => o.item !== itemId)
    .map(o => ({ item: o.item, rate: netQty(recipe, o.item) * mod.productivity * crafts }))
    .filter(b => b.rate > 0);

  return {
    ...base,
    recipe,
    recipeIndex: index,
    // An external step has no machines of its own here — whatever solves it
    // reports them.
    machines: recipe.external ? 0 : crafts / craftsPerMachine,
    crafts,
    byproducts,
    children,
  };
}

export interface Totals {
  /** Raw item id → items per minute. */
  raw: Record<number, number>;
  /** Machine category → fractional machines. */
  machines: Record<string, number>;
  /** Item id → items per minute produced. */
  produced: Record<number, number>;
}

export function aggregate(node: TreeNode, into: Totals = { raw: {}, machines: {}, produced: {} }): Totals {
  if (!node.recipe) {
    into.raw[node.itemId] = (into.raw[node.itemId] ?? 0) + node.rate;
  } else if (node.recipe.external) {
    // Handled outside the tree. Counting its machines or calling its output raw
    // would double whatever does account for it.
    into.produced[node.itemId] = (into.produced[node.itemId] ?? 0) + node.rate;
  } else if (!node.cyclic) {
    into.produced[node.itemId] = (into.produced[node.itemId] ?? 0) + node.rate;
    into.machines[node.recipe.machine] = (into.machines[node.recipe.machine] ?? 0) + node.machines;
    // A recipe that consumes nothing is a source — mining, pumping, collecting.
    // Its output is a raw material entering the plan, and it still needs its
    // extractors counted, so it lands in both totals.
    if (node.recipe.inputs.length === 0) {
      into.raw[node.itemId] = (into.raw[node.itemId] ?? 0) + node.rate;
    }
  }
  node.children.forEach(c => aggregate(c, into));
  return into;
}

/** Every path in the tree, for expand-all style controls. */
export function collectPaths(node: TreeNode, out: string[] = []): string[] {
  out.push(node.path);
  node.children.forEach(c => collectPaths(c, out));
  return out;
}
