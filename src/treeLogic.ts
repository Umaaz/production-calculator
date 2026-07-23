import type { MachineTier, ModifierOption, ProdItem, ProdRecipe } from './gameTypes';

// ── Formatting ────────────────────────────────────────────────────────────────

export function fmt(n: number): string {
  if (n === 0) return '0';
  if (n < 0.01) return n.toExponential(1);
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

// ── Tier helpers ──────────────────────────────────────────────────────────────

// Per-path override wins (keyed by full tree path, so the same item can be configured
// differently when it appears under different parents); falls back to the category default.
export function getEffectiveTier(
  cat: string,
  path: string,
  defaultTierIds: Record<string, string>,
  itemTierIds: Record<string, string>,
  machineTiers: Record<string, MachineTier[]>,
): MachineTier {
  const tiers = machineTiers[cat] ?? [];
  const tierId = itemTierIds[path] ?? defaultTierIds[cat];
  return tiers.find(t => t.id === tierId) ?? tiers[0];
}

export function findTier(
  tierId: string,
  machineTiers: Record<string, MachineTier[]>,
): { tier: MachineTier; cat: string } | null {
  for (const [cat, tiers] of Object.entries(machineTiers)) {
    const tier = tiers.find(t => t.id === tierId);
    if (tier) return { tier, cat };
  }
  return null;
}

// ── Tree model ────────────────────────────────────────────────────────────────

export interface TreeNode {
  itemId: string;
  rate: number;
  recipe: ProdRecipe | null;
  machine: string | null;
  tierId: string | null;
  machines: number;
  byproducts: { itemId: string; rate: number }[];
  children: TreeNode[];
  path: string;
  cyclic: boolean;
  manuallyMined: boolean;
  recipeOverridden: boolean;
  modifierId: string;
}

export interface TreeBuildConfig {
  defaultTierIds: Record<string, string>;
  itemTierIds: Record<string, string>;
  selectedRecipes: Record<string, string>;
  defaultRecipeIds: Record<string, string>;
  defaultModifierId: string;
  itemModifierIds: Record<string, string>;
  itemById: Record<string, ProdItem>;
  recipesByOutput: Record<string, ProdRecipe[]>;
  machineTiers: Record<string, MachineTier[]>;
  modifierOptions: ModifierOption[];
}

export function buildTree(
  itemId: string,
  rate: number,
  cfg: TreeBuildConfig,
  ancestors: Set<string>,
  pathPrefix: string,
): TreeNode {
  const path = pathPrefix + '/' + itemId;
  const item = cfg.itemById[itemId];

  const recipeOverridden = path in cfg.selectedRecipes;
  const effectiveRecipeId = cfg.selectedRecipes[path] ?? cfg.defaultRecipeIds[itemId];
  const manuallyMined = !!(item?.canBeRaw && effectiveRecipeId === '__mine__');
  const candidates = item && !item.raw && !manuallyMined ? cfg.recipesByOutput[itemId] : undefined;
  const recipe = candidates
    ? (candidates.find(r => r.id === effectiveRecipeId) ?? candidates[0])
    : undefined;

  const modifierId = cfg.itemModifierIds[path] ?? cfg.defaultModifierId;

  const noRecipeNode = (cyclic: boolean): TreeNode => ({
    itemId, rate, recipe: null, machine: null, tierId: null, machines: 0,
    byproducts: [], children: [], path, cyclic, manuallyMined, recipeOverridden, modifierId,
  });

  if (!recipe || ancestors.has(itemId)) return noRecipeNode(!!recipe && ancestors.has(itemId));

  const tier = getEffectiveTier(recipe.machine, path, cfg.defaultTierIds, cfg.itemTierIds, cfg.machineTiers);
  const primaryOutput = recipe.outputs.find(o => o.item === itemId)!;

  // Some recipes feed output back as input (e.g. Reformed Refinement: 2 refined-oil → 3 refined-oil).
  const selfInput = recipe.inputs.find(inp => inp.item === itemId);
  const netQty = primaryOutput.qty - (selfInput?.qty ?? 0);
  if (netQty <= 0) return noRecipeNode(true);
  const effectiveInputs = selfInput ? recipe.inputs.filter(inp => inp.item !== itemId) : recipe.inputs;

  // Modifier multipliers:
  // • speedMult        → machine runs faster (more output/time per machine)
  // • productivityMult → each craft yields more output (fewer crafts needed per unit)
  // Some recipes (e.g. DSP x-ray cracking, collider) forbid extra-products proliferators.
  const mod = cfg.modifierOptions.find(m => m.id === modifierId) ?? cfg.modifierOptions[0];
  const speedMult        = mod?.speedMult        ?? 1;
  const productivityMult = (recipe.noExtraProducts ? 1 : mod?.productivityMult) ?? 1;

  const perMachine   = (netQty * productivityMult * tier.speed * speedMult / recipe.time) * 60;
  const machines     = rate / perMachine;
  const craftsPerMin = rate / (netQty * productivityMult);

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(itemId);

  const children = effectiveInputs.map(inp =>
    buildTree(inp.item, craftsPerMin * inp.qty, cfg, nextAncestors, path));

  // All outputs (including byproducts) scale with productivityMult — the extra-products
  // bonus applies to every output of the recipe, not just the primary one.
  const byproducts = recipe.outputs
    .filter(o => o.item !== itemId)
    .map(o => ({ itemId: o.item, rate: craftsPerMin * o.qty * productivityMult }));

  return {
    itemId, rate, recipe, machine: recipe.machine, tierId: tier.id,
    machines, byproducts, children, path, cyclic: false, manuallyMined: false, recipeOverridden, modifierId,
  };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export interface CraftedEntry {
  itemId: string; recipe: ProdRecipe; rate: number; machines: number;
  machine: string | null; tierId: string | null;
}

export interface Totals {
  raw: Record<string, number>;
  machines: Record<string, number>;      // tierId → fractional count
  crafted: Record<string, CraftedEntry>; // itemId::recipeId → totals
}

export function aggregate(node: TreeNode, totals: Totals) {
  if (!node.recipe) {
    totals.raw[node.itemId] = (totals.raw[node.itemId] ?? 0) + node.rate;
    return;
  }
  if (node.tierId) {
    totals.machines[node.tierId] = (totals.machines[node.tierId] ?? 0) + node.machines;
  }
  const key = `${node.itemId}::${node.recipe.id}`;
  const entry = totals.crafted[key];
  if (entry) {
    entry.rate += node.rate;
    entry.machines += node.machines;
  } else {
    totals.crafted[key] = {
      itemId: node.itemId, recipe: node.recipe,
      rate: node.rate, machines: node.machines,
      machine: node.machine, tierId: node.tierId,
    };
  }
  node.children.forEach(c => aggregate(c, totals));
}

// ── Path collector ────────────────────────────────────────────────────────────

export function collectPaths(node: TreeNode): Set<string> {
  const paths = new Set<string>();
  const walk = (n: TreeNode) => { paths.add(n.path); n.children.forEach(walk); };
  walk(node);
  return paths;
}
