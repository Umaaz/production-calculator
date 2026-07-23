// ─────────────────────────────────────────────────────────────────────────────
// Dyson Sphere Program — Game Module
//
// Exports the standard GameModule named exports so the production calculator
// can dynamically import this file and assemble game data via assembleGameData().
//
// Vanilla-approximate recipe data. Times are in SECONDS for one craft at 1×
// machine speed (as shown in-game). Quantities are per single craft.
// ─────────────────────────────────────────────────────────────────────────────

import './icons.css';
import type { GameModule, MachineCategory, MachineTier, ModifierOption, ProdItem, ProdRecipe } from '../../gameTypes';

export const iconNamespace = 'item';

// ── Items ────────────────────────────────────────────────────────────────────

export const Items: ProdItem[] = [
  // Raw resources
  { id: 'iron-ore',        name: 'Iron Ore',       icon: '🔩', spriteId: 1001, raw: true },
  { id: 'copper-ore',      name: 'Copper Ore',     icon: '🟠', spriteId: 1002, raw: true },
  { id: 'stone',           name: 'Stone',          icon: '🪨', spriteId: 1005, raw: true },
  { id: 'coal',            name: 'Coal',           icon: '⚫', spriteId: 1006, raw: true },
  { id: 'silicon-ore',     name: 'Silicon Ore',    icon: '🔘', spriteId: 1003, raw: true },
  { id: 'titanium-ore',    name: 'Titanium Ore',   icon: '⬜', spriteId: 1004, raw: true },
  { id: 'water',           name: 'Water',          icon: '💧', spriteId: 1000, raw: true },
  { id: 'crude-oil',       name: 'Crude Oil',      icon: '🛢', spriteId: 1007, raw: true },
  { id: 'deuterium',       name: 'Deuterium',      icon: '🔵', spriteId: 1121, raw: true },
  { id: 'critical-photon', name: 'Critical Photon',icon: '✨', spriteId: 1208, raw: true },
  // Exotic / rare vein items (used in alternate recipes)
  { id: 'fire-ice',                name: 'Fire Ice',                     icon: '🧊', spriteId: 1011, raw: true },
  { id: 'kimberlite',              name: 'Kimberlite Ore',               icon: '💎', spriteId: 1012, raw: true },
  { id: 'fractal-silicon',         name: 'Fractal Silicon',              icon: '🔷', spriteId: 1013, raw: true },
  { id: 'optical-grating-crystal', name: 'Optical Grating Crystal',      icon: '🔆', spriteId: 1014, raw: true },
  { id: 'spiniform-crystal',       name: 'Spiniform Stalagmite Crystal', icon: '🌵', spriteId: 1013, raw: true },
  { id: 'unipolar-magnet',         name: 'Unipolar Magnet',              icon: '🧲', spriteId: 1016, raw: true },
  { id: 'log',                     name: 'Log',                          icon: '🪵', spriteId: 1030, raw: true },
  { id: 'plant-fuel',              name: 'Plant Fuel',                   icon: '🌿', spriteId: 1031, raw: true },

  // Smelted
  { id: 'iron-ingot',          name: 'Iron Ingot',          icon: '⬛', spriteId: 1101 },
  { id: 'copper-ingot',        name: 'Copper Ingot',        icon: '🟧', spriteId: 1104 },
  { id: 'stone-brick',         name: 'Stone Brick',         icon: '🧱', spriteId: 1108 },
  { id: 'glass',               name: 'Glass',               icon: '🔷', spriteId: 1110 },
  { id: 'high-purity-silicon', name: 'High-Purity Silicon', icon: '🔲', spriteId: 1105 },
  { id: 'crystal-silicon',     name: 'Crystal Silicon',     icon: '💠', spriteId: 1113 },
  { id: 'magnet',              name: 'Magnet',              icon: '🧲', spriteId: 1102 },
  { id: 'steel',               name: 'Steel',               icon: '🔗', spriteId: 1103 },
  { id: 'titanium-ingot',      name: 'Titanium Ingot',      icon: '⚪', spriteId: 1106 },
  { id: 'energetic-graphite',  name: 'Energetic Graphite',  icon: '◼', spriteId: 1109 },
  { id: 'titanium-alloy',      name: 'Titanium Alloy',      icon: '🔘', spriteId: 1107 },
  { id: 'diamond',             name: 'Diamond',             icon: '💎', spriteId: 1112 },

  // Assembled components
  { id: 'gear',                    name: 'Gear',                    icon: '⚙',  spriteId: 1201 },
  { id: 'magnetic-coil',           name: 'Magnetic Coil',           icon: '🌀', spriteId: 1202 },
  { id: 'circuit-board',           name: 'Circuit Board',           icon: '🟩', spriteId: 1301 },
  { id: 'electric-motor',          name: 'Electric Motor',          icon: '🔧', spriteId: 1203 },
  { id: 'electromagnetic-turbine', name: 'Electromagnetic Turbine', icon: '🌪', spriteId: 1204 },
  { id: 'super-magnetic-ring',     name: 'Super-Magnetic Ring',     icon: '⭕', spriteId: 1205 },
  { id: 'prism',                   name: 'Prism',                   icon: '🔺', spriteId: 1111 },
  { id: 'plasma-exciter',          name: 'Plasma Exciter',          icon: '⚡', spriteId: 1401 },
  { id: 'photon-combiner',         name: 'Photon Combiner',         icon: '🔆', spriteId: 1404 },
  { id: 'microcrystalline-component', name: 'Microcrystalline Comp.', icon: '🔳', spriteId: 1302 },
  { id: 'processor',               name: 'Processor',               icon: '🟦', spriteId: 1303 },
  { id: 'particle-container',      name: 'Particle Container',      icon: '🥫', spriteId: 1206 },
  { id: 'titanium-crystal',        name: 'Titanium Crystal',        icon: '🔶', spriteId: 1118 },
  { id: 'casimir-crystal',         name: 'Casimir Crystal',         icon: '❇',  spriteId: 1126 },
  { id: 'titanium-glass',          name: 'Titanium Glass',          icon: '🪟', spriteId: 1119 },
  { id: 'plane-filter',            name: 'Plane Filter',            icon: '🔻', spriteId: 1304 },
  { id: 'quantum-chip',            name: 'Quantum Chip',            icon: '🟪', spriteId: 1305 },
  { id: 'graviton-lens',           name: 'Graviton Lens',           icon: '🔮', spriteId: 1209 },
  { id: 'particle-broadband',      name: 'Particle Broadband',      icon: '📶', spriteId: 1402 },

  // Chemical
  { id: 'refined-oil',     name: 'Refined Oil',     icon: '🟫', spriteId: 1114 },
  { id: 'hydrogen',        name: 'Hydrogen',        icon: '🎈', spriteId: 1120, canBeRaw: true },
  { id: 'plastic',         name: 'Plastic',         icon: '🟨', spriteId: 1115 },
  { id: 'sulfuric-acid',   name: 'Sulfuric Acid',   icon: '🧴', spriteId: 1116, canBeRaw: true },
  { id: 'organic-crystal', name: 'Organic Crystal', icon: '🟢', spriteId: 1117, canBeRaw: true },
  { id: 'graphene',        name: 'Graphene',        icon: '▪',  spriteId: 1123 },
  { id: 'carbon-nanotube', name: 'Carbon Nanotube', icon: '🧵', spriteId: 1124 },

  // Collider
  { id: 'strange-matter', name: 'Strange Matter', icon: '🌑', spriteId: 1127 },
  { id: 'antimatter',     name: 'Antimatter',     icon: '🌟', spriteId: 1122 },

  // Science matrices
  { id: 'electromagnetic-matrix', name: 'Electromagnetic Matrix', icon: '🟦', spriteId: 6001 },
  { id: 'energy-matrix',          name: 'Energy Matrix',          icon: '🟥', spriteId: 6002 },
  { id: 'structure-matrix',       name: 'Structure Matrix',       icon: '🟨', spriteId: 6003 },
  { id: 'information-matrix',     name: 'Information Matrix',     icon: '🟪', spriteId: 6004 },
  { id: 'gravity-matrix',         name: 'Gravity Matrix',         icon: '🟩', spriteId: 6005 },
  { id: 'universe-matrix',        name: 'Universe Matrix',        icon: '⬜', spriteId: 6006 },
];

// ── Item Recipes ─────────────────────────────────────────────────────────────

export const ItemRecipes: ProdRecipe[] = [
  // Smelting
  { id: 'r-iron-ingot',     machine: 'smelter', time: 1,   outputs: [{ item: 'iron-ingot',    qty: 1 }], inputs: [{ item: 'iron-ore',   qty: 1 }] },
  { id: 'r-copper-ingot',   machine: 'smelter', time: 1,   outputs: [{ item: 'copper-ingot',  qty: 1 }], inputs: [{ item: 'copper-ore', qty: 1 }] },
  { id: 'r-stone-brick',    machine: 'smelter', time: 1,   outputs: [{ item: 'stone-brick',   qty: 1 }], inputs: [{ item: 'stone',      qty: 1 }] },
  { id: 'r-glass',          machine: 'smelter', time: 2,   outputs: [{ item: 'glass',         qty: 1 }], inputs: [{ item: 'stone',      qty: 2 }] },
  { id: 'r-hp-silicon',     machine: 'smelter', time: 2,   outputs: [{ item: 'high-purity-silicon', qty: 1 }], inputs: [{ item: 'silicon-ore',  qty: 2 }] },
  { id: 'r-crystal-silicon',machine: 'smelter', time: 2,   label: 'Crystal Silicon',  outputs: [{ item: 'crystal-silicon',    qty: 1 }], inputs: [{ item: 'high-purity-silicon', qty: 1 }] },
  { id: 'r-magnet',         machine: 'smelter', time: 1.5, outputs: [{ item: 'magnet',        qty: 1 }], inputs: [{ item: 'iron-ore',   qty: 1 }] },
  { id: 'r-steel',          machine: 'smelter', time: 3,   outputs: [{ item: 'steel',         qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 3 }] },
  { id: 'r-titanium-ingot', machine: 'smelter', time: 2,   outputs: [{ item: 'titanium-ingot', qty: 1 }], inputs: [{ item: 'titanium-ore', qty: 2 }] },
  { id: 'r-graphite',       machine: 'smelter', time: 2,   outputs: [{ item: 'energetic-graphite', qty: 1 }], inputs: [{ item: 'coal', qty: 2 }] },
  { id: 'r-diamond',        machine: 'smelter', time: 2,   outputs: [{ item: 'diamond',       qty: 1 }], inputs: [{ item: 'energetic-graphite', qty: 1 }] },
  { id: 'r-titanium-alloy', machine: 'smelter', time: 12,  outputs: [{ item: 'titanium-alloy', qty: 4 }], inputs: [{ item: 'titanium-ingot', qty: 4 }, { item: 'steel', qty: 4 }, { item: 'sulfuric-acid', qty: 8 }] },

  // Assembling
  { id: 'r-gear',           machine: 'assembler', time: 1, outputs: [{ item: 'gear',          qty: 1 }], inputs: [{ item: 'iron-ingot',   qty: 1 }] },
  { id: 'r-magnetic-coil',  machine: 'assembler', time: 1, outputs: [{ item: 'magnetic-coil', qty: 2 }], inputs: [{ item: 'magnet', qty: 2 }, { item: 'copper-ingot', qty: 1 }] },
  { id: 'r-circuit-board',  machine: 'assembler', time: 1, outputs: [{ item: 'circuit-board', qty: 2 }], inputs: [{ item: 'iron-ingot', qty: 2 }, { item: 'copper-ingot', qty: 1 }] },
  { id: 'r-electric-motor', machine: 'assembler', time: 2, outputs: [{ item: 'electric-motor', qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 2 }, { item: 'gear', qty: 1 }, { item: 'magnetic-coil', qty: 1 }] },
  { id: 'r-em-turbine',     machine: 'assembler', time: 2, outputs: [{ item: 'electromagnetic-turbine', qty: 1 }], inputs: [{ item: 'electric-motor', qty: 2 }, { item: 'magnetic-coil', qty: 2 }] },
  { id: 'r-super-ring',     machine: 'assembler', time: 3, outputs: [{ item: 'super-magnetic-ring', qty: 1 }], inputs: [{ item: 'electromagnetic-turbine', qty: 2 }, { item: 'magnet', qty: 3 }, { item: 'energetic-graphite', qty: 1 }] },
  { id: 'r-prism',          machine: 'assembler', time: 2, outputs: [{ item: 'prism',          qty: 2 }], inputs: [{ item: 'glass', qty: 3 }] },
  { id: 'r-plasma-exciter', machine: 'assembler', time: 2, outputs: [{ item: 'plasma-exciter', qty: 1 }], inputs: [{ item: 'magnetic-coil', qty: 4 }, { item: 'prism', qty: 2 }] },
  { id: 'r-photon-combiner',machine: 'assembler', time: 3, outputs: [{ item: 'photon-combiner', qty: 1 }], inputs: [{ item: 'prism', qty: 2 }, { item: 'circuit-board', qty: 1 }] },
  { id: 'r-microcrystal',   machine: 'assembler', time: 2, outputs: [{ item: 'microcrystalline-component', qty: 1 }], inputs: [{ item: 'high-purity-silicon', qty: 2 }, { item: 'copper-ingot', qty: 1 }] },
  { id: 'r-processor',      machine: 'assembler', time: 3, outputs: [{ item: 'processor',      qty: 1 }], inputs: [{ item: 'circuit-board', qty: 2 }, { item: 'microcrystalline-component', qty: 2 }] },
  { id: 'r-particle-container', machine: 'assembler', time: 4, outputs: [{ item: 'particle-container', qty: 1 }], inputs: [{ item: 'electromagnetic-turbine', qty: 2 }, { item: 'copper-ingot', qty: 2 }, { item: 'graphene', qty: 2 }] },
  { id: 'r-titanium-crystal',   machine: 'assembler', time: 4, outputs: [{ item: 'titanium-crystal',   qty: 1 }], inputs: [{ item: 'organic-crystal', qty: 1 }, { item: 'titanium-ingot', qty: 3 }] },
  { id: 'r-casimir-crystal',    machine: 'assembler', time: 4, outputs: [{ item: 'casimir-crystal',    qty: 1 }], inputs: [{ item: 'titanium-crystal', qty: 1 }, { item: 'graphene', qty: 2 }, { item: 'hydrogen', qty: 12 }] },
  { id: 'r-titanium-glass',     machine: 'assembler', time: 5, outputs: [{ item: 'titanium-glass',     qty: 2 }], inputs: [{ item: 'glass', qty: 2 }, { item: 'titanium-ingot', qty: 2 }, { item: 'water', qty: 2 }] },
  { id: 'r-plane-filter',       machine: 'assembler', time: 12,outputs: [{ item: 'plane-filter',       qty: 1 }], inputs: [{ item: 'casimir-crystal', qty: 1 }, { item: 'titanium-glass', qty: 2 }] },
  { id: 'r-quantum-chip',       machine: 'assembler', time: 6, outputs: [{ item: 'quantum-chip',       qty: 1 }], inputs: [{ item: 'processor', qty: 2 }, { item: 'plane-filter', qty: 2 }] },
  { id: 'r-graviton-lens',      machine: 'assembler', time: 6, outputs: [{ item: 'graviton-lens',      qty: 1 }], inputs: [{ item: 'diamond', qty: 4 }, { item: 'strange-matter', qty: 1 }] },
  { id: 'r-particle-broadband', machine: 'assembler', time: 8, outputs: [{ item: 'particle-broadband', qty: 1 }], inputs: [{ item: 'carbon-nanotube', qty: 2 }, { item: 'crystal-silicon', qty: 2 }, { item: 'plastic', qty: 1 }] },

  // Refining (co-products / feedback loops)
  { id: 'r-plasma-refining', machine: 'refinery', time: 4, label: 'Plasma Refining',     outputs: [{ item: 'refined-oil', qty: 2 }, { item: 'hydrogen', qty: 1 }],          inputs: [{ item: 'crude-oil', qty: 2 }] },
  { id: 'r-xray-cracking',   machine: 'refinery', time: 4, label: 'X-Ray Cracking',      outputs: [{ item: 'energetic-graphite', qty: 1 }, { item: 'hydrogen', qty: 3 }],    inputs: [{ item: 'refined-oil', qty: 1 }, { item: 'hydrogen', qty: 2 }] },
  { id: 'r-reformed-refine', machine: 'refinery', time: 4, label: 'Reformed Refinement', outputs: [{ item: 'refined-oil', qty: 3 }],                                          inputs: [{ item: 'refined-oil', qty: 2 }, { item: 'hydrogen', qty: 1 }, { item: 'coal', qty: 1 }] },

  // Chemical
  { id: 'r-plastic',         machine: 'chemical', time: 3, outputs: [{ item: 'plastic',         qty: 1 }], inputs: [{ item: 'refined-oil', qty: 2 }, { item: 'energetic-graphite', qty: 1 }] },
  { id: 'r-sulfuric-acid',   machine: 'chemical', time: 6, outputs: [{ item: 'sulfuric-acid',   qty: 4 }], inputs: [{ item: 'refined-oil', qty: 6 }, { item: 'stone', qty: 8 }, { item: 'water', qty: 4 }] },
  { id: 'r-organic-crystal', machine: 'chemical', time: 6, outputs: [{ item: 'organic-crystal', qty: 1 }], inputs: [{ item: 'plastic', qty: 2 }, { item: 'refined-oil', qty: 1 }, { item: 'water', qty: 1 }] },
  { id: 'r-graphene',        machine: 'chemical', time: 3, outputs: [{ item: 'graphene',        qty: 2 }], inputs: [{ item: 'energetic-graphite', qty: 3 }, { item: 'sulfuric-acid', qty: 1 }] },
  { id: 'r-carbon-nanotube', machine: 'chemical', time: 4, outputs: [{ item: 'carbon-nanotube', qty: 2 }], inputs: [{ item: 'graphene', qty: 3 }, { item: 'titanium-ingot', qty: 1 }] },

  // Collider
  { id: 'r-strange-matter', machine: 'collider', time: 8, outputs: [{ item: 'strange-matter', qty: 1 }],                        inputs: [{ item: 'particle-container', qty: 2 }, { item: 'iron-ingot', qty: 2 }, { item: 'deuterium', qty: 10 }] },
  { id: 'r-antimatter',     machine: 'collider', time: 2, outputs: [{ item: 'antimatter', qty: 2 }, { item: 'hydrogen', qty: 2 }], inputs: [{ item: 'critical-photon', qty: 2 }] },

  // Alternate recipes
  { id: 'r-diamond-kim',           machine: 'smelter',   time: 1.5, label: 'Diamond (advanced)',           outputs: [{ item: 'diamond',           qty: 2 }], inputs: [{ item: 'kimberlite',            qty: 1 }] },
  { id: 'r-crystal-silicon-frac',  machine: 'assembler', time: 1.5, label: 'Crystal Silicon (advanced)',   outputs: [{ item: 'crystal-silicon',   qty: 2 }], inputs: [{ item: 'fractal-silicon',       qty: 1 }] },
  { id: 'r-graphene-fire',         machine: 'chemical',  time: 2,   label: 'Graphene (advanced)',          outputs: [{ item: 'graphene', qty: 2 }, { item: 'hydrogen', qty: 1 }], inputs: [{ item: 'fire-ice', qty: 2 }] },
  { id: 'r-nanotube-spin',         machine: 'chemical',  time: 4,   label: 'Carbon Nanotube (advanced)',   outputs: [{ item: 'carbon-nanotube',   qty: 2 }], inputs: [{ item: 'spiniform-crystal',     qty: 6 }] },
  { id: 'r-casimir-optical',       machine: 'assembler', time: 4,   label: 'Casimir Crystal (advanced)',   outputs: [{ item: 'casimir-crystal',   qty: 1 }], inputs: [{ item: 'optical-grating-crystal', qty: 8 }, { item: 'graphene', qty: 2 }, { item: 'hydrogen', qty: 12 }] },
  { id: 'r-particle-container-uni',machine: 'assembler', time: 4,   label: 'Particle Container (advanced)',outputs: [{ item: 'particle-container',qty: 1 }], inputs: [{ item: 'unipolar-magnet',       qty: 10 }, { item: 'copper-ingot', qty: 2 }] },
  { id: 'r-photon-optical',        machine: 'assembler', time: 3,   label: 'Photon Combiner (advanced)',   outputs: [{ item: 'photon-combiner',   qty: 1 }], inputs: [{ item: 'optical-grating-crystal', qty: 1 }, { item: 'circuit-board', qty: 1 }] },
  { id: 'r-organic-crystal-raw',   machine: 'assembler', time: 6,   label: 'Organic Crystal (original)',   outputs: [{ item: 'organic-crystal',   qty: 1 }], inputs: [{ item: 'log', qty: 20 }, { item: 'plant-fuel', qty: 30 }, { item: 'water', qty: 10 }] },

  // Science matrices (Matrix Lab)
  { id: 'r-em-matrix',        machine: 'lab', time: 3,  outputs: [{ item: 'electromagnetic-matrix', qty: 1 }], inputs: [{ item: 'magnetic-coil', qty: 1 }, { item: 'circuit-board', qty: 1 }] },
  { id: 'r-energy-matrix',    machine: 'lab', time: 6,  outputs: [{ item: 'energy-matrix',          qty: 1 }], inputs: [{ item: 'energetic-graphite', qty: 2 }, { item: 'hydrogen', qty: 2 }] },
  { id: 'r-structure-matrix', machine: 'lab', time: 8,  outputs: [{ item: 'structure-matrix',       qty: 1 }], inputs: [{ item: 'diamond', qty: 1 }, { item: 'titanium-crystal', qty: 1 }] },
  { id: 'r-information-matrix',machine:'lab', time: 10, outputs: [{ item: 'information-matrix',     qty: 1 }], inputs: [{ item: 'processor', qty: 2 }, { item: 'particle-broadband', qty: 1 }] },
  { id: 'r-gravity-matrix',   machine: 'lab', time: 24, outputs: [{ item: 'gravity-matrix',         qty: 2 }], inputs: [{ item: 'graviton-lens', qty: 1 }, { item: 'quantum-chip', qty: 1 }] },
  { id: 'r-universe-matrix',  machine: 'lab', time: 15, outputs: [{ item: 'universe-matrix',        qty: 1 }], inputs: [
    { item: 'electromagnetic-matrix', qty: 1 }, { item: 'energy-matrix',     qty: 1 },
    { item: 'structure-matrix',       qty: 1 }, { item: 'information-matrix', qty: 1 },
    { item: 'gravity-matrix',         qty: 1 }, { item: 'antimatter',         qty: 1 },
  ]},
];

// Building recipes are currently not modelled (assembler, smelter, etc. are
// assumed pre-built). Add them here when building-cost planning is needed.
export const BuildingRecipes: ProdRecipe[] = [];

// ── Machine Tiers ────────────────────────────────────────────────────────────
// Speeds sourced from game data (_AssemblerDesc.speed / 10000).

export const MachineTiers: MachineCategory[] = [
  {
    id: 'raw', name: 'Extraction', icon: '⛏',
    tiers: [
      { id: 'mining-mk1', label: 'Mining Machine',       speed: 1.0, spriteId: 2301 },
      { id: 'mining-mk2', label: 'Large Mining Machine', speed: 1.5, spriteId: 2316 },
    ],
  },
  {
    id: 'smelter', name: 'Smelter', icon: '🔥',
    tiers: [
      { id: 'arc',        label: 'Arc Smelter',       speed: 1.0, spriteId: 2302 },
      { id: 'plane',      label: 'Plane Smelter',      speed: 2.0, spriteId: 2315 },
      { id: 'negentropy', label: 'Negentropy Smelter', speed: 3.0, spriteId: 2319 },
    ],
  },
  {
    id: 'assembler', name: 'Assembler', icon: '⚙',
    tiers: [
      { id: 'mk1', label: 'Assembler Mk.I',   speed: 0.75, spriteId: 2303 },
      { id: 'mk2', label: 'Assembler Mk.II',  speed: 1.0,  spriteId: 2304 },
      { id: 'mk3', label: 'Assembler Mk.III', speed: 1.5,  spriteId: 2305 },
      { id: 'mk4', label: 'Assembler Mk.IV',  speed: 3.0,  spriteId: 2318 },
    ],
  },
  {
    id: 'chemical', name: 'Chemical Plant', icon: '🧪',
    tiers: [
      { id: 'chem',    label: 'Chemical Plant',         speed: 1.0, spriteId: 2309 },
      { id: 'quantum', label: 'Quantum Chemical Plant', speed: 2.0, spriteId: 2317 },
    ],
  },
  {
    id: 'refinery', name: 'Oil Refinery', icon: '🛢',
    tiers: [
      { id: 'refinery', label: 'Oil Refinery', speed: 1.0, spriteId: 2308 },
    ],
  },
  {
    id: 'lab', name: 'Matrix Lab', icon: '🔬',
    tiers: [
      { id: 'matrix',    label: 'Matrix Lab',        speed: 1.0, spriteId: 2901 },
      { id: 'evolution', label: 'Self-Evolution Lab', speed: 3.0, spriteId: 2902 },
    ],
  },
  {
    id: 'collider', name: 'Particle Collider', icon: '⚛',
    tiers: [
      { id: 'collider', label: 'Particle Collider', speed: 1.0, spriteId: 2310 },
    ],
  },
];

// ── Belts ────────────────────────────────────────────────────────────────────
// Speed in items/min.

export const Belts: MachineTier[] = [
  { id: 'belt-mk1', label: 'Belt Mk.I',   speed: 360,  spriteId: 2001 },
  { id: 'belt-mk2', label: 'Belt Mk.II',  speed: 720,  spriteId: 2002 },
  { id: 'belt-mk3', label: 'Belt Mk.III', speed: 1800, spriteId: 2003 },
];

// ── Sorters ──────────────────────────────────────────────────────────────────
// Speed is max throughput at 1 grid; speedDisplay shows all 3 distances (1/2/3 grids).

export const Sorters: MachineTier[] = [
  { id: 'sorter-mk1', label: 'Sorter Mk.I',   speed: 90,  speedDisplay: '90 / 45 / 30',    spriteId: 2011 },
  { id: 'sorter-mk2', label: 'Sorter Mk.II',  speed: 180, speedDisplay: '180 / 90 / 60',   spriteId: 2012 },
  { id: 'sorter-mk3', label: 'Sorter Mk.III', speed: 360, speedDisplay: '360 / 180 / 120', spriteId: 2013 },
];

// ── Modifiers (Proliferators) ────────────────────────────────────────────────

const _prolif: { id: string; label: string; extraProducts: number; speedup: number; spriteId?: number }[] = [
  { id: 'mk1', label: 'Mk.I',   extraProducts: 0.125, speedup: 0.25, spriteId: 1141 },
  { id: 'mk2', label: 'Mk.II',  extraProducts: 0.20,  speedup: 0.50, spriteId: 1142 },
  { id: 'mk3', label: 'Mk.III', extraProducts: 0.25,  speedup: 1.00, spriteId: 1143 },
];

export const Modifiers: ModifierOption[] = [
  { id: 'none', label: 'None', detail: '—', speedMult: 1, productivityMult: 1 },
  ..._prolif.flatMap(t => [
    { id: `${t.id}-speed`, label: `${t.label} Speed`, detail: `×${1 + t.speedup}`,
      spriteId: t.spriteId, speedMult: 1 + t.speedup, productivityMult: 1 },
    { id: `${t.id}-extra`, label: `${t.label} Extra`, detail: `+${t.extraProducts * 100}%`,
      spriteId: t.spriteId, speedMult: 1, productivityMult: 1 + t.extraProducts },
  ]),
];

export const features: GameModule['features'] = { oilOptimiser: true };
