import type { GameData, GameModule, MachineDef, MachineTier, ProdItem, ProdRecipe } from './gameTypes';

export function assembleGameData(mod: GameModule): GameData {
  const allRecipes = [...mod.ItemRecipes, ...mod.BuildingRecipes];

  const itemById: Record<string, ProdItem> = {};
  mod.Items.forEach(it => { itemById[it.id] = it; });

  const recipesByOutput: Record<string, ProdRecipe[]> = {};
  allRecipes.forEach(r => {
    r.outputs.forEach(o => {
      if (!recipesByOutput[o.item]) recipesByOutput[o.item] = [];
      recipesByOutput[o.item].push(r);
    });
  });

  const recipeByOutput: Record<string, ProdRecipe> = {};
  Object.entries(recipesByOutput).forEach(([item, recipes]) => {
    recipeByOutput[item] = recipes[0];
  });

  const craftableItems = mod.Items.filter(it => !it.raw && recipeByOutput[it.id]);

  const machines: Record<string, MachineDef> = {};
  const machineTiers: Record<string, MachineTier[]> = {};
  mod.MachineTiers.forEach(cat => {
    machines[cat.id] = { id: cat.id, name: cat.name, icon: cat.icon };
    machineTiers[cat.id] = cat.tiers;
  });

  return {
    iconNamespace: mod.iconNamespace,
    itemById,
    craftableItems,
    recipesByOutput,
    recipeByOutput,
    machines,
    machineTiers,
    beltTiers: mod.Belts,
    sorterTiers: mod.Sorters ?? [],
    modifierOptions: mod.Modifiers,
    powerPlants: mod.PowerPlants ?? [],
    powerFuels: mod.PowerFuels ?? [],
    features: mod.features ?? {},
  };
}
