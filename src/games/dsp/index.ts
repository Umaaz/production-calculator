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
import type { GameModule, MachineCategory, MachineTier, ModifierOption, PowerFuel, PowerPlant, ProdItem, ProdRecipe } from '../../gameTypes';

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

  // Fuel rods
  { id: 'hydrogen-fuel-rod',   name: 'Hydrogen Fuel Rod',   icon: '⚡', spriteId: 1801 },
  { id: 'deuterium-fuel-rod',  name: 'Deuterium Fuel Rod',  icon: '⚡', spriteId: 1802 },
  { id: 'antimatter-fuel-rod', name: 'Antimatter Fuel Rod', icon: '⚡', spriteId: 1803 },

  // ── Buildings ────────────────────────────────────────────────────────────
  // Logistics
  { id: 'conveyor-belt-mk1',              name: 'Conveyor Belt Mk.I',              icon: '▶', spriteId: 2001 },
  { id: 'conveyor-belt-mk2',              name: 'Conveyor Belt Mk.II',             icon: '▶', spriteId: 2002 },
  { id: 'conveyor-belt-mk3',              name: 'Conveyor Belt Mk.III',            icon: '▶', spriteId: 2003 },
  { id: 'sorter-mk1',                     name: 'Sorter Mk.I',                     icon: '↕', spriteId: 2011 },
  { id: 'sorter-mk2',                     name: 'Sorter Mk.II',                    icon: '↕', spriteId: 2012 },
  { id: 'sorter-mk3',                     name: 'Sorter Mk.III',                   icon: '↕', spriteId: 2013 },
  { id: 'storage-mk1',                    name: 'Storage Mk.I',                    icon: '📦', spriteId: 2101 },
  { id: 'storage-mk2',                    name: 'Storage Mk.II',                   icon: '📦', spriteId: 2102 },
  { id: 'storage-tank',                   name: 'Storage Tank',                    icon: '🛢', spriteId: 2106 },
  { id: 'logistics-station',              name: 'Planetary Logistics Station',     icon: '🏭', spriteId: 2104 },
  { id: 'interstellar-logistics-station', name: 'Interstellar Logistics Station',  icon: '🚀', spriteId: 2105 },
  // Power
  { id: 'tesla-tower',                    name: 'Tesla Tower',                     icon: '🗼', spriteId: 2201 },
  { id: 'wireless-power-tower',           name: 'Wireless Power Tower',            icon: '📡', spriteId: 2202 },
  { id: 'wind-turbine',                   name: 'Wind Turbine',                    icon: '🌬', spriteId: 2203 },
  { id: 'thermal-power-plant',            name: 'Thermal Power Plant',             icon: '🔥', spriteId: 2204 },
  { id: 'solar-panel',                    name: 'Solar Panel',                     icon: '☀', spriteId: 2205 },
  { id: 'accumulator',                    name: 'Accumulator',                     icon: '🔋', spriteId: 2206 },
  { id: 'ray-receiver',                   name: 'Ray Receiver',                    icon: '📡', spriteId: 2208 },
  { id: 'mini-fusion-power-plant',        name: 'Mini Fusion Power Plant',         icon: '⚛', spriteId: 2211 },
  { id: 'satellite-substation',           name: 'Satellite Substation',            icon: '🛰', spriteId: 2212 },
  { id: 'artificial-star',               name: 'Artificial Star',                 icon: '⭐', spriteId: 2210 },
  // Mining & extraction
  { id: 'mining-machine',                 name: 'Mining Machine',                  icon: '⛏', spriteId: 2301 },
  { id: 'advanced-mining-machine',        name: 'Advanced Mining Machine',         icon: '⛏', spriteId: 2316 },
  { id: 'water-pump',                     name: 'Water Pump',                      icon: '💧', spriteId: 2306 },
  { id: 'oil-extractor',                  name: 'Oil Extractor',                   icon: '⛽', spriteId: 2307 },
  // Smelters
  { id: 'arc-smelter',                    name: 'Arc Smelter',                     icon: '🔥', spriteId: 2302 },
  { id: 'plane-smelter',                  name: 'Plane Smelter',                   icon: '🔥', spriteId: 2315 },
  // Assemblers
  { id: 'assembling-machine-mk1',         name: 'Assembling Machine Mk.I',         icon: '🏭', spriteId: 2303 },
  { id: 'assembling-machine-mk2',         name: 'Assembling Machine Mk.II',        icon: '🏭', spriteId: 2304 },
  { id: 'assembling-machine-mk3',         name: 'Assembling Machine Mk.III',       icon: '🏭', spriteId: 2305 },
  // Processing
  { id: 'oil-refinery',                   name: 'Oil Refinery',                    icon: '🏗', spriteId: 2308 },
  { id: 'chemical-plant',                 name: 'Chemical Plant',                  icon: '⚗', spriteId: 2309 },
  { id: 'miniature-particle-collider',    name: 'Miniature Particle Collider',     icon: '⚛', spriteId: 2310 },
  { id: 'spray-coater',                   name: 'Spray Coater',                    icon: '🖌', spriteId: 2313 },
  { id: 'fractionator',                   name: 'Fractionator',                    icon: '⚗', spriteId: 2314 },
  { id: 'matrix-lab',                     name: 'Matrix Lab',                      icon: '🔬', spriteId: 2901 },
  // Dyson sphere buildings
  { id: 'emrail-ejector',                 name: 'EM Rail Ejector',                 icon: '🚀', spriteId: 2311 },
  { id: 'vertical-launching-silo',        name: 'Vertical Launching Silo',         icon: '🚀', spriteId: 2312 },
  // Dyson sphere components
  { id: 'solar-sail',                     name: 'Solar Sail',                      icon: '🌞', spriteId: 1501 },
  { id: 'frame-material',                 name: 'Frame Material',                  icon: '🔲', spriteId: 1125 },
  { id: 'dyson-sphere-component',         name: 'Dyson Sphere Component',          icon: '🌐', spriteId: 1502 },
  { id: 'small-carrier-rocket',           name: 'Small Carrier Rocket',            icon: '🚀', spriteId: 1503 },
  // Intermediate building components
  { id: 'annihilation-constraint-sphere', name: 'Annihilation Constraint Sphere',  icon: '🔴', spriteId: 1403 },

  // ── Explosive components ──────────────────────────────────────────────────
  { id: 'combustible-unit',        name: 'Combustible Unit',        icon: '🔴', spriteId: 1128 },
  { id: 'explosive-unit',          name: 'Explosive Unit',          icon: '💣', spriteId: 1129 },
  { id: 'crystal-explosive-unit',  name: 'Crystal Explosive Unit',  icon: '💎', spriteId: 1130 },

  // ── Propulsion components ─────────────────────────────────────────────────
  { id: 'thruster',                name: 'Thruster',                icon: '🚀', spriteId: 1407 },
  { id: 'fuel-thruster',           name: 'Fuel Thruster',           icon: '🔥', spriteId: 1405 },
  { id: 'ion-thruster',            name: 'Ion Thruster',            icon: '⚡', spriteId: 1406 },

  // ── Ammunition ────────────────────────────────────────────────────────────
  { id: 'magnum-ammo-box',         name: 'Magnum Ammo Box',         icon: '🔫', spriteId: 1601 },
  { id: 'titanium-ammo-box',       name: 'Titanium Ammo Box',       icon: '🔫', spriteId: 1602 },
  { id: 'superalloy-ammo-box',     name: 'Superalloy Ammo Box',     icon: '🔫', spriteId: 1603 },
  { id: 'shell-set',               name: 'Shell Set',               icon: '💥', spriteId: 1604 },
  { id: 'high-explosive-shell-set',name: 'High-Explosive Shell Set',icon: '💥', spriteId: 1605 },
  { id: 'crystal-shell-set',       name: 'Crystal Shell Set',       icon: '💥', spriteId: 1606 },
  { id: 'plasma-capsule',          name: 'Plasma Capsule',          icon: '⚡', spriteId: 1607 },
  { id: 'antimatter-capsule',      name: 'Antimatter Capsule',      icon: '☢', spriteId: 1608 },
  { id: 'missile-set',             name: 'Missile Set',             icon: '🚀', spriteId: 1609 },
  { id: 'supersonic-missile-set',  name: 'Supersonic Missile Set',  icon: '🚀', spriteId: 1610 },
  { id: 'gravity-missile-set',     name: 'Gravity Missile Set',     icon: '🌌', spriteId: 1611 },
  { id: 'em-jamming-capsule',      name: 'EM Jamming Capsule',      icon: '📡', spriteId: 1612 },
  { id: 'em-suppression-capsule',  name: 'EM Suppression Capsule',  icon: '📡', spriteId: 1613 },

  // ── Defense buildings ─────────────────────────────────────────────────────
  { id: 'gauss-turret',                name: 'Gauss Turret',                icon: '🔫', spriteId: 3001 },
  { id: 'laser-turret',                name: 'Laser Turret',                icon: '🔴', spriteId: 3002 },
  { id: 'implosion-cannon',            name: 'Implosion Cannon',            icon: '💥', spriteId: 3003 },
  { id: 'magnetized-plasma-cannon',    name: 'Magnetized Plasma Cannon',    icon: '⚡', spriteId: 3004 },
  { id: 'missile-turret',              name: 'Missile Turret',              icon: '🚀', spriteId: 3005 },
  { id: 'jammer-tower',                name: 'Jammer Tower',                icon: '📡', spriteId: 3006 },
  { id: 'signal-tower',                name: 'Signal Tower',                icon: '🗼', spriteId: 3007 },
  { id: 'planetary-shield-generator',  name: 'Planetary Shield Generator',  icon: '🛡', spriteId: 3008 },
  { id: 'battlefield-analysis-base',   name: 'Battlefield Analysis Base',   icon: '📊', spriteId: 3009 },
  { id: 'ground-plasma-cannon',        name: 'Ground Plasma Cannon',        icon: '⚡', spriteId: 3010 },

  // ── Dark Fog loot (raw drops, no crafting recipe) ─────────────────────────
  { id: 'storage-unit',            name: 'Storage Unit',            icon: '💾', spriteId: 5201, raw: true },
  { id: 'silicon-based-neuron',    name: 'Silicon-Based Neuron',    icon: '🧠', spriteId: 5202, raw: true },
  { id: 'matter-recombinator',     name: 'Matter Recombinator',     icon: '♻', spriteId: 5203, raw: true },
  { id: 'negentropy-singularity',  name: 'Negentropy Singularity',  icon: '🌑', spriteId: 5204, raw: true },
  { id: 'virtual-particle',        name: 'Virtual Particle',        icon: '✨', spriteId: 5205, raw: true },
  { id: 'energy-shard',            name: 'Energy Shard',            icon: '💠', spriteId: 5206, raw: true },
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
  { id: 'r-xray-cracking',   machine: 'refinery', time: 4, label: 'X-Ray Cracking',      noExtraProducts: true, outputs: [{ item: 'energetic-graphite', qty: 1 }, { item: 'hydrogen', qty: 3 }],    inputs: [{ item: 'refined-oil', qty: 1 }, { item: 'hydrogen', qty: 2 }] },
  { id: 'r-reformed-refine', machine: 'refinery', time: 4, label: 'Reformed Refinement', noExtraProducts: true, outputs: [{ item: 'refined-oil', qty: 3 }],                                          inputs: [{ item: 'refined-oil', qty: 2 }, { item: 'hydrogen', qty: 1 }, { item: 'coal', qty: 1 }] },

  // Chemical
  { id: 'r-plastic',         machine: 'chemical', time: 3, outputs: [{ item: 'plastic',         qty: 1 }], inputs: [{ item: 'refined-oil', qty: 2 }, { item: 'energetic-graphite', qty: 1 }] },
  { id: 'r-sulfuric-acid',   machine: 'chemical', time: 6, outputs: [{ item: 'sulfuric-acid',   qty: 4 }], inputs: [{ item: 'refined-oil', qty: 6 }, { item: 'stone', qty: 8 }, { item: 'water', qty: 4 }] },
  { id: 'r-organic-crystal', machine: 'chemical', time: 6, outputs: [{ item: 'organic-crystal', qty: 1 }], inputs: [{ item: 'plastic', qty: 2 }, { item: 'refined-oil', qty: 1 }, { item: 'water', qty: 1 }] },
  { id: 'r-graphene',        machine: 'chemical', time: 3, outputs: [{ item: 'graphene',        qty: 2 }], inputs: [{ item: 'energetic-graphite', qty: 3 }, { item: 'sulfuric-acid', qty: 1 }] },
  { id: 'r-carbon-nanotube', machine: 'chemical', time: 4, outputs: [{ item: 'carbon-nanotube', qty: 2 }], inputs: [{ item: 'graphene', qty: 3 }, { item: 'titanium-ingot', qty: 1 }] },

  // Collider
  { id: 'r-strange-matter', machine: 'collider', time: 8, noExtraProducts: true, outputs: [{ item: 'strange-matter', qty: 1 }],                        inputs: [{ item: 'particle-container', qty: 2 }, { item: 'iron-ingot', qty: 2 }, { item: 'deuterium', qty: 10 }] },
  { id: 'r-antimatter',     machine: 'collider', time: 2, noExtraProducts: true, outputs: [{ item: 'antimatter', qty: 2 }, { item: 'hydrogen', qty: 2 }], inputs: [{ item: 'critical-photon', qty: 2 }] },

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

  // ── Fuel rods ─────────────────────────────────────────────────────────────
  { id: 'r-hydrogen-fuel-rod',   machine: 'assembler', time: 6,  outputs: [{ item: 'hydrogen-fuel-rod',   qty: 2 }], inputs: [{ item: 'titanium-ingot', qty: 1 }, { item: 'hydrogen', qty: 10 }] },
  { id: 'r-deuterium-fuel-rod',  machine: 'assembler', time: 12,  outputs: [{ item: 'deuterium-fuel-rod',  qty: 2 }], inputs: [{ item: 'titanium-alloy', qty: 1 }, { item: 'super-magnetic-ring', qty: 1 }, { item: 'deuterium', qty: 20 }] },
  { id: 'r-antimatter-fuel-rod', machine: 'assembler', time: 24, outputs: [{ item: 'antimatter-fuel-rod', qty: 2 }], inputs: [{ item: 'annihilation-constraint-sphere', qty: 1 }, { item: 'titanium-alloy', qty: 1 }, { item: 'hydrogen', qty: 12 }, { item: 'antimatter', qty: 12 }] },

  // ── Explosive components ──────────────────────────────────────────────────
  { id: 'r-combustible-unit',       machine: 'assembler', time: 3,  outputs: [{ item: 'combustible-unit',       qty: 1 }], inputs: [{ item: 'coal', qty: 3 }] },
  { id: 'r-explosive-unit',         machine: 'chemical',  time: 6,  outputs: [{ item: 'explosive-unit',         qty: 2 }], inputs: [{ item: 'combustible-unit', qty: 2 }, { item: 'plastic', qty: 2 }, { item: 'sulfuric-acid', qty: 1 }] },
  { id: 'r-crystal-explosive-unit', machine: 'chemical',  time: 24, outputs: [{ item: 'crystal-explosive-unit', qty: 8 }], inputs: [{ item: 'explosive-unit', qty: 8 }, { item: 'casimir-crystal', qty: 1 }, { item: 'crystal-silicon', qty: 8 }] },

  // ── Propulsion components ─────────────────────────────────────────────────
  { id: 'r-thruster',      machine: 'assembler', time: 3, outputs: [{ item: 'thruster',      qty: 1 }], inputs: [{ item: 'magnetic-coil', qty: 1 }, { item: 'copper-ingot', qty: 2 }] },
  { id: 'r-fuel-thruster', machine: 'assembler', time: 4, outputs: [{ item: 'fuel-thruster', qty: 1 }], inputs: [{ item: 'steel', qty: 2 }, { item: 'copper-ingot', qty: 3 }] },
  { id: 'r-ion-thruster',  machine: 'assembler', time: 6, outputs: [{ item: 'ion-thruster',  qty: 1 }], inputs: [{ item: 'titanium-alloy', qty: 5 }, { item: 'electromagnetic-turbine', qty: 5 }] },

  // ── Ammo boxes ────────────────────────────────────────────────────────────
  { id: 'r-magnum-ammo-box',     machine: 'assembler', time: 1, outputs: [{ item: 'magnum-ammo-box',     qty: 1 }], inputs: [{ item: 'copper-ingot', qty: 3 }] },
  { id: 'r-titanium-ammo-box',   machine: 'assembler', time: 2, outputs: [{ item: 'titanium-ammo-box',   qty: 1 }], inputs: [{ item: 'magnum-ammo-box', qty: 1 }, { item: 'titanium-ingot', qty: 2 }] },
  { id: 'r-superalloy-ammo-box', machine: 'assembler', time: 3, outputs: [{ item: 'superalloy-ammo-box', qty: 1 }], inputs: [{ item: 'titanium-ammo-box', qty: 1 }, { item: 'titanium-alloy', qty: 1 }] },

  // ── Shell sets ────────────────────────────────────────────────────────────
  { id: 'r-shell-set',              machine: 'assembler', time: 1.5, outputs: [{ item: 'shell-set',              qty: 1 }], inputs: [{ item: 'copper-ingot', qty: 9 }, { item: 'combustible-unit', qty: 2 }] },
  { id: 'r-high-explosive-shell',   machine: 'assembler', time: 3,   outputs: [{ item: 'high-explosive-shell-set', qty: 1 }], inputs: [{ item: 'shell-set', qty: 1 }, { item: 'titanium-ingot', qty: 6 }, { item: 'explosive-unit', qty: 2 }] },
  { id: 'r-crystal-shell',          machine: 'assembler', time: 6,   outputs: [{ item: 'crystal-shell-set',       qty: 1 }], inputs: [{ item: 'high-explosive-shell-set', qty: 1 }, { item: 'titanium-alloy', qty: 3 }, { item: 'crystal-explosive-unit', qty: 2 }] },

  // ── Capsules ──────────────────────────────────────────────────────────────
  { id: 'r-plasma-capsule',         machine: 'assembler', time: 2, outputs: [{ item: 'plasma-capsule',         qty: 1 }], inputs: [{ item: 'graphene', qty: 1 }, { item: 'magnet', qty: 2 }, { item: 'deuterium', qty: 10 }] },
  { id: 'r-antimatter-capsule',     machine: 'assembler', time: 2, outputs: [{ item: 'antimatter-capsule',     qty: 1 }], inputs: [{ item: 'plasma-capsule', qty: 1 }, { item: 'particle-container', qty: 1 }, { item: 'hydrogen', qty: 10 }, { item: 'antimatter', qty: 10 }] },
  { id: 'r-em-jamming-capsule',     machine: 'assembler', time: 2, outputs: [{ item: 'em-jamming-capsule',     qty: 1 }], inputs: [{ item: 'electromagnetic-turbine', qty: 1 }, { item: 'plasma-exciter', qty: 1 }, { item: 'hydrogen', qty: 3 }] },
  { id: 'r-em-suppression-capsule', machine: 'assembler', time: 8, outputs: [{ item: 'em-suppression-capsule', qty: 2 }], inputs: [{ item: 'em-jamming-capsule', qty: 2 }, { item: 'super-magnetic-ring', qty: 1 }, { item: 'titanium-glass', qty: 2 }] },

  // ── Missiles ──────────────────────────────────────────────────────────────
  { id: 'r-missile-set',            machine: 'assembler', time: 2, outputs: [{ item: 'missile-set',            qty: 1 }], inputs: [{ item: 'copper-ingot', qty: 6 }, { item: 'circuit-board', qty: 3 }, { item: 'combustible-unit', qty: 2 }, { item: 'thruster', qty: 1 }] },
  { id: 'r-supersonic-missile-set', machine: 'assembler', time: 4, outputs: [{ item: 'supersonic-missile-set', qty: 2 }], inputs: [{ item: 'missile-set', qty: 2 }, { item: 'processor', qty: 4 }, { item: 'explosive-unit', qty: 4 }, { item: 'fuel-thruster', qty: 2 }] },
  { id: 'r-gravity-missile-set',    machine: 'assembler', time: 6, outputs: [{ item: 'gravity-missile-set',    qty: 3 }], inputs: [{ item: 'supersonic-missile-set', qty: 3 }, { item: 'crystal-explosive-unit', qty: 6 }, { item: 'strange-matter', qty: 3 }] },
];

export const BuildingRecipes: ProdRecipe[] = [
  // ── Logistics ──────────────────────────────────────────────────────────────
  { id: 'rb-belt-mk1',    machine: 'assembler', time: 1,  outputs: [{ item: 'conveyor-belt-mk1', qty: 3 }], inputs: [{ item: 'iron-ingot', qty: 1 }, { item: 'gear', qty: 1 }] },
  { id: 'rb-belt-mk2',    machine: 'assembler', time: 1,  outputs: [{ item: 'conveyor-belt-mk2', qty: 3 }], inputs: [{ item: 'conveyor-belt-mk1', qty: 3 }, { item: 'electromagnetic-turbine', qty: 1 }] },
  { id: 'rb-belt-mk3',    machine: 'assembler', time: 1,  outputs: [{ item: 'conveyor-belt-mk3', qty: 3 }], inputs: [{ item: 'conveyor-belt-mk2', qty: 3 }, { item: 'super-magnetic-ring', qty: 1 }, { item: 'graphene', qty: 1 }] },
  { id: 'rb-sorter-mk1',  machine: 'assembler', time: 1,  outputs: [{ item: 'sorter-mk1',        qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 1 }, { item: 'circuit-board', qty: 1 }] },
  { id: 'rb-sorter-mk2',  machine: 'assembler', time: 1,  outputs: [{ item: 'sorter-mk2',        qty: 2 }], inputs: [{ item: 'sorter-mk1', qty: 2 }, { item: 'electric-motor', qty: 1 }] },
  { id: 'rb-sorter-mk3',  machine: 'assembler', time: 1,  outputs: [{ item: 'sorter-mk3',        qty: 2 }], inputs: [{ item: 'sorter-mk2', qty: 2 }, { item: 'electromagnetic-turbine', qty: 1 }] },
  { id: 'rb-storage-mk1', machine: 'assembler', time: 2,  outputs: [{ item: 'storage-mk1',       qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 4 }, { item: 'stone-brick', qty: 4 }] },
  { id: 'rb-storage-mk2', machine: 'assembler', time: 4,  outputs: [{ item: 'storage-mk2',       qty: 1 }], inputs: [{ item: 'steel', qty: 8 }, { item: 'stone-brick', qty: 8 }] },
  { id: 'rb-storage-tank',machine: 'assembler', time: 2,  outputs: [{ item: 'storage-tank',      qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 8 }, { item: 'stone-brick', qty: 4 }, { item: 'glass', qty: 4 }] },
  { id: 'rb-pls',         machine: 'assembler', time: 20, outputs: [{ item: 'logistics-station',              qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 40 }, { item: 'steel', qty: 40 }, { item: 'titanium-ingot', qty: 40 }, { item: 'processor', qty: 40 }] },
  { id: 'rb-ils',         machine: 'assembler', time: 30, outputs: [{ item: 'interstellar-logistics-station', qty: 1 }], inputs: [{ item: 'titanium-alloy', qty: 40 }, { item: 'particle-container', qty: 20 }, { item: 'processor', qty: 40 }, { item: 'particle-broadband', qty: 20 }] },

  // ── Power ──────────────────────────────────────────────────────────────────
  { id: 'rb-tesla-tower',     machine: 'assembler', time: 2,  outputs: [{ item: 'tesla-tower',             qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 2 }, { item: 'magnetic-coil', qty: 1 }] },
  { id: 'rb-wireless-tower',  machine: 'assembler', time: 3,  outputs: [{ item: 'wireless-power-tower',    qty: 1 }], inputs: [{ item: 'tesla-tower', qty: 5 }, { item: 'plasma-exciter', qty: 3 }] },
  { id: 'rb-wind-turbine',    machine: 'assembler', time: 4,  outputs: [{ item: 'wind-turbine',            qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 6 }, { item: 'gear', qty: 1 }, { item: 'magnetic-coil', qty: 1 }] },
  { id: 'rb-thermal-plant',   machine: 'assembler', time: 5,  outputs: [{ item: 'thermal-power-plant',     qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 10 }, { item: 'stone-brick', qty: 4 }, { item: 'gear', qty: 4 }, { item: 'magnetic-coil', qty: 2 }] },
  { id: 'rb-solar-panel',     machine: 'assembler', time: 5,  outputs: [{ item: 'solar-panel',             qty: 1 }], inputs: [{ item: 'copper-ingot', qty: 10 }, { item: 'high-purity-silicon', qty: 10 }, { item: 'circuit-board', qty: 1 }] },
  { id: 'rb-accumulator',     machine: 'assembler', time: 5,  outputs: [{ item: 'accumulator',             qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 6 }, { item: 'super-magnetic-ring', qty: 3 }, { item: 'crystal-silicon', qty: 2 }] },
  { id: 'rb-ray-receiver',    machine: 'assembler', time: 10, outputs: [{ item: 'ray-receiver',            qty: 1 }], inputs: [{ item: 'steel', qty: 20 }, { item: 'high-purity-silicon', qty: 20 }, { item: 'photon-combiner', qty: 6 }, { item: 'processor', qty: 6 }, { item: 'super-magnetic-ring', qty: 10 }] },
  { id: 'rb-mini-fusion',     machine: 'assembler', time: 10, outputs: [{ item: 'mini-fusion-power-plant', qty: 1 }], inputs: [{ item: 'titanium-alloy', qty: 12 }, { item: 'super-magnetic-ring', qty: 10 }, { item: 'carbon-nanotube', qty: 8 }, { item: 'particle-container', qty: 2 }, { item: 'processor', qty: 2 }] },
  { id: 'rb-satellite-sub',   machine: 'assembler', time: 5,  outputs: [{ item: 'satellite-substation',   qty: 1 }], inputs: [{ item: 'wireless-power-tower', qty: 1 }, { item: 'super-magnetic-ring', qty: 10 }, { item: 'graphene', qty: 10 }, { item: 'processor', qty: 2 }] },
  { id: 'rb-artificial-star', machine: 'assembler', time: 30, outputs: [{ item: 'artificial-star',        qty: 1 }], inputs: [{ item: 'titanium-alloy', qty: 20 }, { item: 'frame-material', qty: 20 }, { item: 'annihilation-constraint-sphere', qty: 10 }, { item: 'quantum-chip', qty: 10 }] },

  // ── Mining & Extraction ────────────────────────────────────────────────────
  { id: 'rb-mining-machine',  machine: 'assembler', time: 3,  outputs: [{ item: 'mining-machine',          qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 4 }, { item: 'circuit-board', qty: 2 }, { item: 'magnetic-coil', qty: 2 }, { item: 'gear', qty: 1 }] },
  { id: 'rb-adv-mining',      machine: 'assembler', time: 5,  outputs: [{ item: 'advanced-mining-machine', qty: 1 }], inputs: [{ item: 'mining-machine', qty: 4 }, { item: 'titanium-alloy', qty: 2 }, { item: 'microcrystalline-component', qty: 4 }, { item: 'quantum-chip', qty: 2 }] },
  { id: 'rb-water-pump',      machine: 'assembler', time: 4,  outputs: [{ item: 'water-pump',              qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 8 }, { item: 'stone-brick', qty: 4 }, { item: 'electric-motor', qty: 4 }, { item: 'circuit-board', qty: 2 }] },
  { id: 'rb-oil-extractor',   machine: 'assembler', time: 4,  outputs: [{ item: 'oil-extractor',           qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 12 }, { item: 'stone-brick', qty: 12 }, { item: 'electric-motor', qty: 4 }, { item: 'circuit-board', qty: 8 }] },

  // ── Smelters ───────────────────────────────────────────────────────────────
  { id: 'rb-arc-smelter',     machine: 'assembler', time: 5,  outputs: [{ item: 'arc-smelter',            qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 4 }, { item: 'magnetic-coil', qty: 2 }, { item: 'circuit-board', qty: 1 }, { item: 'gear', qty: 1 }] },
  { id: 'rb-plane-smelter',   machine: 'assembler', time: 5,  outputs: [{ item: 'plane-smelter',          qty: 1 }], inputs: [{ item: 'arc-smelter', qty: 2 }, { item: 'titanium-alloy', qty: 4 }, { item: 'microcrystalline-component', qty: 4 }, { item: 'plasma-exciter', qty: 2 }] },

  // ── Assemblers ─────────────────────────────────────────────────────────────
  { id: 'rb-assembler-mk1',   machine: 'assembler', time: 10, outputs: [{ item: 'assembling-machine-mk1', qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 4 }, { item: 'gear', qty: 8 }, { item: 'circuit-board', qty: 4 }] },
  { id: 'rb-assembler-mk2',   machine: 'assembler', time: 10, outputs: [{ item: 'assembling-machine-mk2', qty: 1 }], inputs: [{ item: 'assembling-machine-mk1', qty: 2 }, { item: 'gear', qty: 4 }, { item: 'electromagnetic-turbine', qty: 4 }] },
  { id: 'rb-assembler-mk3',   machine: 'assembler', time: 10, outputs: [{ item: 'assembling-machine-mk3', qty: 1 }], inputs: [{ item: 'assembling-machine-mk2', qty: 2 }, { item: 'particle-broadband', qty: 2 }, { item: 'processor', qty: 4 }] },

  // ── Processing ─────────────────────────────────────────────────────────────
  { id: 'rb-oil-refinery',    machine: 'assembler', time: 5,  outputs: [{ item: 'oil-refinery',              qty: 1 }], inputs: [{ item: 'steel', qty: 10 }, { item: 'stone-brick', qty: 10 }, { item: 'glass', qty: 6 }, { item: 'circuit-board', qty: 6 }] },
  { id: 'rb-chemical-plant',  machine: 'assembler', time: 5,  outputs: [{ item: 'chemical-plant',             qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 8 }, { item: 'stone-brick', qty: 8 }, { item: 'glass', qty: 2 }, { item: 'circuit-board', qty: 2 }] },
  { id: 'rb-collider',        machine: 'assembler', time: 20, outputs: [{ item: 'miniature-particle-collider', qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 8 }, { item: 'copper-ingot', qty: 8 }, { item: 'electromagnetic-turbine', qty: 4 }, { item: 'super-magnetic-ring', qty: 4 }, { item: 'strange-matter', qty: 4 }] },
  { id: 'rb-spray-coater',    machine: 'assembler', time: 3,  outputs: [{ item: 'spray-coater',               qty: 1 }], inputs: [{ item: 'steel', qty: 3 }, { item: 'circuit-board', qty: 3 }, { item: 'microcrystalline-component', qty: 2 }, { item: 'plasma-exciter', qty: 2 }] },
  { id: 'rb-fractionator',    machine: 'assembler', time: 3,  outputs: [{ item: 'fractionator',                qty: 1 }], inputs: [{ item: 'steel', qty: 8 }, { item: 'stone-brick', qty: 4 }, { item: 'glass', qty: 4 }, { item: 'processor', qty: 1 }] },
  { id: 'rb-matrix-lab',      machine: 'assembler', time: 10, outputs: [{ item: 'matrix-lab',                  qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 8 }, { item: 'glass', qty: 4 }, { item: 'circuit-board', qty: 4 }, { item: 'magnetic-coil', qty: 4 }] },

  // ── Dyson Sphere buildings ─────────────────────────────────────────────────
  { id: 'rb-emrail-ejector',  machine: 'assembler', time: 6,  outputs: [{ item: 'emrail-ejector',          qty: 1 }], inputs: [{ item: 'steel', qty: 20 }, { item: 'gear', qty: 20 }, { item: 'electromagnetic-turbine', qty: 5 }, { item: 'processor', qty: 5 }, { item: 'super-magnetic-ring', qty: 10 }] },
  { id: 'rb-launch-silo',     machine: 'assembler', time: 30, outputs: [{ item: 'vertical-launching-silo', qty: 1 }], inputs: [{ item: 'titanium-alloy', qty: 80 }, { item: 'high-purity-silicon', qty: 30 }, { item: 'super-magnetic-ring', qty: 20 }, { item: 'quantum-chip', qty: 10 }] },

  // ── Dyson Sphere components ────────────────────────────────────────────────
  { id: 'rb-solar-sail',      machine: 'assembler', time: 4,  outputs: [{ item: 'solar-sail',             qty: 2 }], inputs: [{ item: 'graphene', qty: 1 }, { item: 'photon-combiner', qty: 1 }] },
  { id: 'rb-frame-material',  machine: 'assembler', time: 6,  outputs: [{ item: 'frame-material',         qty: 1 }], inputs: [{ item: 'carbon-nanotube', qty: 4 }, { item: 'titanium-alloy', qty: 1 }, { item: 'high-purity-silicon', qty: 1 }] },
  { id: 'rb-dyson-component', machine: 'assembler', time: 8,  outputs: [{ item: 'dyson-sphere-component', qty: 1 }], inputs: [{ item: 'frame-material', qty: 3 }, { item: 'solar-sail', qty: 3 }, { item: 'processor', qty: 3 }] },
  { id: 'rb-carrier-rocket',  machine: 'assembler', time: 6,  outputs: [{ item: 'small-carrier-rocket',   qty: 2 }], inputs: [{ item: 'titanium-alloy', qty: 2 }, { item: 'deuterium', qty: 10 }, { item: 'electromagnetic-turbine', qty: 2 }, { item: 'dyson-sphere-component', qty: 2 }] },

  // ── Intermediate components ────────────────────────────────────────────────
  { id: 'rb-constraint-sphere', machine: 'collider', time: 20, outputs: [{ item: 'annihilation-constraint-sphere', qty: 1 }], inputs: [{ item: 'particle-container', qty: 1 }, { item: 'processor', qty: 1 }] },

  // ── Military defense buildings ────────────────────────────────────────────
  { id: 'rb-gauss-turret',               machine: 'assembler', time:  4, outputs: [{ item: 'gauss-turret',               qty: 1 }], inputs: [{ item: 'iron-ingot', qty: 8 }, { item: 'gear', qty: 8 }, { item: 'circuit-board', qty: 2 }, { item: 'magnetic-coil', qty: 4 }] },
  { id: 'rb-laser-turret',               machine: 'assembler', time:  6, outputs: [{ item: 'laser-turret',               qty: 1 }], inputs: [{ item: 'steel', qty: 9 }, { item: 'plasma-exciter', qty: 6 }, { item: 'circuit-board', qty: 6 }, { item: 'photon-combiner', qty: 9 }] },
  { id: 'rb-implosion-cannon',           machine: 'assembler', time:  5, outputs: [{ item: 'implosion-cannon',           qty: 1 }], inputs: [{ item: 'steel', qty: 10 }, { item: 'electric-motor', qty: 8 }, { item: 'circuit-board', qty: 10 }, { item: 'super-magnetic-ring', qty: 2 }] },
  { id: 'rb-magnetized-plasma-cannon',   machine: 'assembler', time: 10, outputs: [{ item: 'magnetized-plasma-cannon',   qty: 1 }], inputs: [{ item: 'titanium-alloy', qty: 20 }, { item: 'titanium-glass', qty: 10 }, { item: 'super-magnetic-ring', qty: 10 }, { item: 'plasma-exciter', qty: 5 }, { item: 'processor', qty: 5 }] },
  { id: 'rb-missile-turret',             machine: 'assembler', time:  6, outputs: [{ item: 'missile-turret',             qty: 1 }], inputs: [{ item: 'steel', qty: 8 }, { item: 'electric-motor', qty: 6 }, { item: 'circuit-board', qty: 12 }, { item: 'thruster', qty: 6 }] },
  { id: 'rb-jammer-tower',               machine: 'assembler', time:  5, outputs: [{ item: 'jammer-tower',               qty: 1 }], inputs: [{ item: 'copper-ingot', qty: 12 }, { item: 'plasma-exciter', qty: 9 }, { item: 'diamond', qty: 6 }, { item: 'processor', qty: 3 }] },
  { id: 'rb-signal-tower',               machine: 'assembler', time:  6, outputs: [{ item: 'signal-tower',               qty: 1 }], inputs: [{ item: 'wireless-power-tower', qty: 2 }, { item: 'steel', qty: 12 }, { item: 'crystal-silicon', qty: 6 }] },
  { id: 'rb-planetary-shield-generator', machine: 'assembler', time: 10, outputs: [{ item: 'planetary-shield-generator', qty: 1 }], inputs: [{ item: 'steel', qty: 20 }, { item: 'electromagnetic-turbine', qty: 20 }, { item: 'super-magnetic-ring', qty: 5 }, { item: 'particle-container', qty: 5 }] },
  { id: 'rb-battlefield-analysis-base',  machine: 'assembler', time:  6, outputs: [{ item: 'battlefield-analysis-base',  qty: 1 }], inputs: [{ item: 'steel', qty: 12 }, { item: 'circuit-board', qty: 18 }, { item: 'microcrystalline-component', qty: 6 }, { item: 'thruster', qty: 12 }] },
  { id: 'rb-ground-plasma-cannon',       machine: 'assembler', time:  8, outputs: [{ item: 'ground-plasma-cannon',       qty: 1 }], inputs: [{ item: 'steel', qty: 15 }, { item: 'super-magnetic-ring', qty: 5 }, { item: 'plasma-exciter', qty: 5 }, { item: 'processor', qty: 5 }] },
];

// ── Machine Tiers ────────────────────────────────────────────────────────────
// Speeds sourced from game data (_AssemblerDesc.speed / 10000).

export const MachineTiers: MachineCategory[] = [
  {
    id: 'raw', name: 'Extraction', icon: '⛏',
    tiers: [
      { id: 'mining-mk1', label: 'Mining Machine',       speed: 1.0, spriteId: 2301, workPowerKW:  270 },
      { id: 'mining-mk2', label: 'Large Mining Machine', speed: 1.5, spriteId: 2316, workPowerKW: 2160 },
    ],
  },
  {
    id: 'smelter', name: 'Smelter', icon: '🔥',
    tiers: [
      { id: 'arc',        label: 'Arc Smelter',       speed: 1.0, spriteId: 2302, workPowerKW:  360 },
      { id: 'plane',      label: 'Plane Smelter',      speed: 2.0, spriteId: 2315, workPowerKW: 1080 },
      { id: 'negentropy', label: 'Negentropy Smelter', speed: 3.0, spriteId: 2319, workPowerKW: 1440 },
    ],
  },
  {
    id: 'assembler', name: 'Assembler', icon: '⚙',
    tiers: [
      { id: 'mk1', label: 'Assembler Mk.I',   speed: 0.75, spriteId: 2303, workPowerKW:  270 },
      { id: 'mk2', label: 'Assembler Mk.II',  speed: 1.0,  spriteId: 2304, workPowerKW:  540 },
      { id: 'mk3', label: 'Assembler Mk.III', speed: 1.5,  spriteId: 2305, workPowerKW: 1080 },
      { id: 'mk4', label: 'Assembler Mk.IV',  speed: 3.0,  spriteId: 2318, workPowerKW: 1440 },
    ],
  },
  {
    id: 'chemical', name: 'Chemical Plant', icon: '🧪',
    tiers: [
      { id: 'chem',    label: 'Chemical Plant',         speed: 1.0, spriteId: 2309, workPowerKW:  720 },
      { id: 'quantum', label: 'Quantum Chemical Plant', speed: 2.0, spriteId: 2317, workPowerKW: 1440 },
    ],
  },
  {
    id: 'refinery', name: 'Oil Refinery', icon: '🛢',
    tiers: [
      { id: 'refinery', label: 'Oil Refinery', speed: 1.0, spriteId: 2308, workPowerKW: 960 },
    ],
  },
  {
    id: 'lab', name: 'Matrix Lab', icon: '🔬',
    tiers: [
      { id: 'matrix',    label: 'Matrix Lab',        speed: 1.0, spriteId: 2901, workPowerKW:  480 },
      { id: 'evolution', label: 'Self-Evolution Lab', speed: 3.0, spriteId: 2902, workPowerKW: 1440 },
    ],
  },
  {
    id: 'collider', name: 'Particle Collider', icon: '⚛',
    tiers: [
      { id: 'collider', label: 'Particle Collider', speed: 1.0, spriteId: 2310, workPowerKW: 12000 },
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

const _prolif: { id: string; label: string; extraProducts: number; speedup: number; powerSpeedMult: number; powerExtraMult: number; spriteId?: number }[] = [
  { id: 'mk1', label: 'Mk.I',   extraProducts: 0.125, speedup: 0.25, powerSpeedMult: 1.3, powerExtraMult: 1.7, spriteId: 1141 },
  { id: 'mk2', label: 'Mk.II',  extraProducts: 0.20,  speedup: 0.50, powerSpeedMult: 1.7, powerExtraMult: 2.4, spriteId: 1142 },
  { id: 'mk3', label: 'Mk.III', extraProducts: 0.25,  speedup: 1.00, powerSpeedMult: 2.0, powerExtraMult: 2.5, spriteId: 1143 },
];

export const Modifiers: ModifierOption[] = [
  { id: 'none', label: 'None', detail: '—', speedMult: 1, productivityMult: 1, powerMult: 1 },
  ..._prolif.flatMap(t => [
    { id: `${t.id}-speed`, label: `${t.label} Speed`, detail: `×${1 + t.speedup}`,
      spriteId: t.spriteId, speedMult: 1 + t.speedup, productivityMult: 1, powerMult: t.powerSpeedMult },
    { id: `${t.id}-extra`, label: `${t.label} Extra`, detail: `+${t.extraProducts * 100}%`,
      spriteId: t.spriteId, speedMult: 1, productivityMult: 1 + t.extraProducts, powerMult: t.powerExtraMult,
      speedVariantId: `${t.id}-speed` },
  ]),
];

export const PowerFuels: PowerFuel[] = [
  { id: 'log',                  name: 'Log',                   icon: '🪵', spriteId: 1030, energyMJ: 1.5 },
  { id: 'plant-fuel',           name: 'Plant Fuel',            icon: '🌿', spriteId: 1031, energyMJ: 1.5 },
  { id: 'coal',                 name: 'Coal',                  icon: '⚫', spriteId: 1006, energyMJ: 6.3 },
  { id: 'fire-ice',             name: 'Fire Ice',              icon: '🧊', spriteId: 1011, energyMJ: 12 },
  { id: 'energetic-graphite',   name: 'Energetic Graphite',    icon: '◼',  spriteId: 1109, energyMJ: 12 },
  { id: 'organic-crystal',      name: 'Organic Crystal',       icon: '🟢', spriteId: 1117, energyMJ: 12 },
  { id: 'hydrogen',             name: 'Hydrogen',              icon: '🎈', spriteId: 1120, energyMJ: 9 },
  { id: 'refined-oil',          name: 'Refined Oil',           icon: '🟫', spriteId: 1114, energyMJ: 12.6 },
  { id: 'hydrogen-fuel-rod',    name: 'Hydrogen Fuel Rod',     icon: '⚡', spriteId: 1801, energyMJ: 40 },
  { id: 'deuterium-fuel-rod',   name: 'Deuterium Fuel Rod',    icon: '⚡', spriteId: 1802, energyMJ: 500 },
  { id: 'antimatter-fuel-rod',  name: 'Antimatter Fuel Rod',   icon: '⚡', spriteId: 1803, energyMJ: 7500 },
  { id: 'accumulator-charged',  name: 'Full Accumulator',      icon: '🔋', spriteId: 2207, energyMJ: 180 },
];

const _thermalFuels  = ['log','plant-fuel','coal','fire-ice','energetic-graphite','organic-crystal','hydrogen','refined-oil','hydrogen-fuel-rod','deuterium-fuel-rod','antimatter-fuel-rod'];
const _fusionFuels   = ['hydrogen-fuel-rod','deuterium-fuel-rod','antimatter-fuel-rod'];
const _starFuels     = ['deuterium-fuel-rod','antimatter-fuel-rod'];
const _exchangerFuels= ['accumulator-charged'];

export const PowerPlants: PowerPlant[] = [
  { id: 'thermal',    name: 'Thermal Power Plant',       icon: '🔥', spriteId: 2204, outputKW:   2160, fuelIds: _thermalFuels },
  { id: 'fusion',     name: 'Mini Fusion Power Station', icon: '⚛️', spriteId: 2211, outputKW: 15000, fuelIds: _fusionFuels },
  { id: 'star',       name: 'Artificial Star',           icon: '🌟', spriteId: 2210, outputKW: 72000, fuelIds: _starFuels },
  { id: 'exchanger',  name: 'Energy Exchanger',          icon: '🔋', spriteId: 2209, outputKW: 54000, fuelIds: _exchangerFuels },
  { id: 'wind',       name: 'Wind Turbine',              icon: '💨', spriteId: 2203, outputKW:   300, variableOutput: true },
  { id: 'solar',      name: 'Solar Panel',               icon: '☀️', spriteId: 2205, outputKW:   360, variableOutput: true },
  { id: 'geothermal', name: 'Geothermal Station',        icon: '🌋', spriteId: 2213, outputKW:  4800 },
];

export const features: GameModule['features'] = {
  oilOptimiser: true,
  proliferatorTiers: [
    { idPrefix: 'mk1', label: 'Mk.I Proliferator',   spriteId: 1141, sprayCapacity: 12 },
    { idPrefix: 'mk2', label: 'Mk.II Proliferator',  spriteId: 1142, sprayCapacity: 24 },
    { idPrefix: 'mk3', label: 'Mk.III Proliferator', spriteId: 1143, sprayCapacity: 60 },
  ],
  pickerLayout: [
    {
      label: 'Items',
      rows: [
          ['iron-ore', 'copper-ore', 'stone', 'coal', 'silicon-ore', 'titanium-ore', 'water', 'crude-oil', 'hydrogen', 'deuterium', 'antimatter', 'core-element', 'critical-photon', 'kimberlite'],
        ['iron-ingot','copper-ingot','high-purity-silicon','titanium-ingot','stone-brick','energetic-graphite',null,'graphene','plastic',null, null,null, null, null],
        ['magnet','magnetic-coil', 'crystal-silicon', 'titanium-alloy', 'glass','diamond', null, null, null, null, null, null, null, null],
        ['steel','electric-motor', null, 'titanium-glass', 'prism', null, null, 'titanium-crystal', null, null,null,null,null,null],
        ['refined-oil','hydrogen','sulfuric-acid','organic-crystal','carbon-nanotube','strange-matter','antimatter',null,null,null,null,null],
        ['electromagnetic-matrix','energy-matrix','structure-matrix','information-matrix','gravity-matrix','universe-matrix',null,null,null,null,null,null,null,null],
        // VII — fuel
        ['log','plant-fuel','coal','fire-ice','energetic-graphite','organic-crystal',null,'hydrogen','refined-oil',null,'hydrogen-fuel-rod','deuterium-fuel-rod','antimatter-fuel-rod',null],
        // VIII — military components & ammo
        ['combustible-unit','explosive-unit','crystal-explosive-unit','thruster','fuel-thruster','ion-thruster','magnum-ammo-box','titanium-ammo-box','superalloy-ammo-box','shell-set','high-explosive-shell-set','crystal-shell-set',null,null],
        // VIII — capsules, missiles & Dark Fog loot
        ['plasma-capsule','antimatter-capsule','em-jamming-capsule','em-suppression-capsule','missile-set','supersonic-missile-set','gravity-missile-set',null,'storage-unit','silicon-based-neuron','matter-recombinator','negentropy-singularity','virtual-particle','energy-shard'],
      ],
    },
    {
      label: 'Buildings',
      rows: [
        // I — power
        ['tesla-tower','wireless-power-tower','wind-turbine','thermal-power-plant','solar-panel','accumulator','ray-receiver','mini-fusion-power-plant','satellite-substation','artificial-star',null,null,null,null],
        // II — logistics & storage
        ['conveyor-belt-mk1','conveyor-belt-mk2','conveyor-belt-mk3','sorter-mk1','sorter-mk2','sorter-mk3','storage-mk1','storage-mk2','storage-tank','logistics-station','interstellar-logistics-station',null,null,null],
        // III — production & processing
        ['mining-machine','advanced-mining-machine','water-pump','oil-extractor','arc-smelter','plane-smelter','assembling-machine-mk1','assembling-machine-mk2','assembling-machine-mk3','oil-refinery','chemical-plant','miniature-particle-collider','spray-coater','fractionator'],
        // IV — research & Dyson
        ['matrix-lab','emrail-ejector','vertical-launching-silo','solar-sail','frame-material','dyson-sphere-component','small-carrier-rocket','annihilation-constraint-sphere',null,null,null,null,null,null],
        // V — military defense buildings
        ['gauss-turret','laser-turret','implosion-cannon','magnetized-plasma-cannon','missile-turret','jammer-tower','signal-tower','planetary-shield-generator','battlefield-analysis-base','ground-plasma-cannon',null,null,null,null],
        // VI — Dark Fog loot
        ['storage-unit','silicon-based-neuron','matter-recombinator','negentropy-singularity','virtual-particle','energy-shard',null,null,null,null,null,null,null,null],
        // VII — reserved
        [null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      ],
    },
  ],
};
