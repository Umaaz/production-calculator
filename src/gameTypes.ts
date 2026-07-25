// Shared types for the production calculator — game-independent.
// Each game module in src/games/<id>/index.ts must satisfy the GameModule interface.

export interface ProdItem {
  id: string;
  name: string;
  icon: string;      // emoji fallback when no sprite sheet is available
  spriteId?: number; // numeric ID into the game's sprite sheet
  raw?: boolean;     // mined/gathered — no recipe, bottoms out the tree
  canBeRaw?: boolean;// has a crafting recipe but can also be sourced from the environment
}

export interface RecipeIO { item: string; qty: number; }

export interface ProdRecipe {
  id: string;
  label?: string;           // short display name shown in alternate-recipe picker
  outputs: RecipeIO[];
  inputs: RecipeIO[];
  time: number;             // seconds at 1× machine speed
  machine: string;          // category id (e.g. 'smelter', 'assembler')
  noExtraProducts?: boolean; // true when the game forbids extra-products proliferators on this recipe
}

export interface MachineTier {
  id: string;
  label: string;
  speed: number;          // craft-speed multiplier (1.0 = baseline)
  spriteId?: number;
  speedDisplay?: string;  // overrides rendered speed badge (e.g. "90 / 45 / 30")
  workPowerKW?: number;   // power draw at full work load, in kW
}

// A machine category groups one building type across its upgrade tiers.
// Games export these as MachineTiers; assembleGameData splits them for GameData.
export interface MachineCategory {
  id: string;
  name: string;    // generic category label used in summary / fallback text
  icon: string;    // emoji fallback
  tiers: MachineTier[];
}

export interface MachineDef {
  id: string;
  name: string;
  icon: string;
}

export interface ModifierOption {
  id: string;
  label: string;
  detail?: string;          // short multiplier string shown in picker (e.g. "×1.25", "+12.5%")
  spriteId?: number;
  speedMult: number;        // multiplier on machine craft-speed (1 = no effect)
  productivityMult: number; // multiplier on output quantity per craft (1 = no effect)
  powerMult?: number;       // multiplier on machine power draw (1 = no change; >1 = more power)
  speedVariantId?: string;  // for extra-products options: ID of the speed-only equivalent at the same tier
}

export interface PowerFuel {
  id: string;        // may match an itemId for icon/name lookup; fall back to own fields
  name: string;
  icon: string;
  spriteId?: number;
  energyMJ: number;
}

export interface PowerPlant {
  id: string;
  name: string;
  icon: string;
  spriteId?: number;
  outputKW: number;         // rated output at 100 %
  variableOutput?: boolean; // true when actual output varies (wind, solar) — user sets a % override
  fuelIds?: string[];       // compatible PowerFuel ids; absent = no fuel needed
}

export interface PickerTab {
  label: string;
  rows: (string | null)[][];
}

// The assembled data bundle consumed by ProductionCalculator.
export interface GameData {
  iconNamespace: string;           // CSS data-icon prefix, e.g. 'item' → data-icon="item.1001"
  itemById: Record<string, ProdItem>;
  craftableItems: ProdItem[];
  recipesByOutput: Record<string, ProdRecipe[]>;
  recipeByOutput: Record<string, ProdRecipe>;
  machines: Record<string, MachineDef>;
  machineTiers: Record<string, MachineTier[]>;
  beltTiers: MachineTier[];
  sorterTiers: MachineTier[];
  modifierOptions: ModifierOption[];
  powerPlants: PowerPlant[];
  powerFuels: PowerFuel[];
  features: {
    oilOptimiser?: boolean;
    proliferatorTiers?: Array<{
      idPrefix: string;    // modifier IDs starting with this prefix belong to this tier
      label: string;
      spriteId: number;
      sprayCapacity: number;
    }>;
    pickerLayout?: PickerTab[];
    layoutMachines?: LayoutMachineSpec[];
  };
}

export interface LayoutMachineSpec {
  machineId: string; // matches recipe.machine category id
  tileW: number;     // footprint width in game tiles
  tileH: number;     // footprint height in game tiles
  // How items move between conveyor belts and this building.
  // 'sorter'   — belt runs alongside; sorter arm bridges to machine (DSP default)
  // 'inserter' — same spacing, different visual (Factorio)
  // 'direct'   — belt connects flush to a port on the building face
  beltAccess?: 'sorter' | 'inserter' | 'direct';
  // Belt lane layout: 'in2_out1', 'in3_out1', 'in6_out1', etc.
  // Determines how many horizontal belt lanes sit above (inputs) and below (outputs).
  layoutId?: string;
  // Explicit port positions for 'direct' buildings (omit to auto-infer from edges)
  ports?: LayoutPort[];
}

export interface LayoutPort {
  side: 'N' | 'S' | 'E' | 'W'; // which face the port is on
  offset: number;               // tiles along that face from the NW corner
  io: 'in' | 'out';
}

// The contract every game module (src/games/<id>/index.ts) must satisfy.
// Named exports are used so webpack can statically analyse and code-split each game.
export interface GameModule {
  readonly iconNamespace: string;
  readonly Items: ProdItem[];
  readonly ItemRecipes: ProdRecipe[];
  readonly BuildingRecipes: ProdRecipe[];
  readonly MachineTiers: MachineCategory[];
  readonly Belts: MachineTier[];
  readonly Sorters?: MachineTier[];
  readonly Modifiers: ModifierOption[];
  readonly PowerPlants?: PowerPlant[];
  readonly PowerFuels?: PowerFuel[];
  readonly features?: GameData['features'];
}
