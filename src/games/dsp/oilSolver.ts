// Solver for DSP's oil chain.
//
// Refined oil, hydrogen and graphite are produced by recipes that feed each
// other, so a tree cannot express them — it must pick one route per item and
// expand downwards. Solved together they come out exactly, with no iteration.
//
// Working in crafts per minute:
//
//   p  Plasma Refining      2 crude          -> 2 oil + 1 hydrogen
//   x  X-ray Cracking       1 oil + 2 H      -> 1 graphite + 3 H   (net -1 oil, +1 H)
//   f  Reformed Refinement  2 oil + 1 H + 1 coal -> 3 oil          (net +1 oil, -1 H)
//   a  Energetic Graphite   2 coal           -> 1 graphite
//
// Balancing each item against demand:
//
//   oil:       2p - x + f = R
//   hydrogen:   p + x - f = H
//   graphite:       x + a = G
//
// Adding the first two gives 3p = R + H. Both x and f are one-for-one swaps
// between oil and hydrogen, so they cancel: crude oil consumption is fixed at
// 2(R+H)/3 no matter how the chain is arranged. Reformed Refinement does not
// save crude — it trades coal and hydrogen for oil.
//
// Subtracting gives x - f = (2H - R)/3, which fixes the difference but not the
// pair. Adding the same amount t to both leaves every balance untouched, so t
// is a free parameter — and it is not idle. Each unit of t cracks one more
// graphite, which lets the smelter make one less:
//
//   graphite via cracking   1 coal  (reforming replaces the oil it consumed)
//   graphite via smelting   2 coal
//
// so raising t saves coal, at 2 refinery crafts for every smelter craft
// dropped. That is the whole buildings-against-resources trade, and it is why
// the modes below exist.
//
// t is bounded: below by 0, and above by the point where cracking alone covers
// the graphite demand and the smelter is switched off entirely.
//
// Productivity. A proliferator in an extra-products mode raises a recipe's
// output without touching its inputs. Only Plasma Refining and Energetic
// Graphite accept it here — cracking and reforming are restricted to speed
// modes — so it enters as two multipliers, Pp on plasma and Pa on the smelter.
//
// It drops out of the structure cleanly. Adding the balances still collapses to
// 3·Pp·p = R + H, so plasma runs at p = (R+H)/(3·Pp) and burns crude in
// proportion: the same chain on less oil. The swing x − f is set by recipes
// that have no productivity, so it is untouched, and the modes are as before.
// The smelter alone changes: Pa graphite per craft means a = (G − x)/Pa, and
// its coal falls with it. Speed is not modelled here — it moves machine counts,
// not crafts — so the caller applies it after.

/**
 * Where to sit on the trade between machines and raw material.
 *
 * Expressed as how far to push t, the amount of graphite moved off the smelter
 * and onto the cracker.
 */
export type OilMode = 'buildings' | 'mixed' | 'resource';

export const OIL_MODES: Array<{ id: OilMode; label: string; detail: string }> = [
  { id: 'buildings', label: 'Fewest buildings', detail: 'smelt graphite from coal' },
  { id: 'mixed', label: 'Mixed', detail: 'half each way' },
  { id: 'resource', label: 'Fewest resources', detail: 'crack graphite from oil' },
];

const MODE_SHIFT: Record<OilMode, number> = {
  buildings: 0,
  mixed: 0.5,
  resource: 1,
};

export interface OilDemand {
  /** Refined oil per minute. */
  refinedOil: number;
  /** Hydrogen per minute. */
  hydrogen: number;
  /** Energetic graphite per minute. */
  graphite: number;
}

/**
 * Yield multipliers for the two recipes that accept extra-products modes.
 *
 * The other two are speed-only, so their productivity is always 1 and there is
 * nothing to pass. 1 means no proliferator, or a speed mode.
 */
export interface OilProductivity {
  /** Plasma Refining's output multiplier. */
  plasma: number;
  /** Energetic Graphite's output multiplier. */
  arc: number;
}

const NO_PRODUCTIVITY: OilProductivity = { plasma: 1, arc: 1 };

export interface OilSolution {
  /** Crafts per minute of each recipe. */
  plasma: number;
  xray: number;
  reformed: number;
  arcGraphite: number;
  /** Inputs the chain draws, per minute. */
  crudeOil: number;
  coal: number;
  /**
   * Graphite produced beyond what was asked for, per minute.
   *
   * X-ray Cracking makes graphite whether or not you want it, and how much it
   * has to run is set by the hydrogen balance. When that exceeds the graphite
   * demand the excess has nowhere to go — it is a real output of the plan, not
   * a rounding artefact.
   */
  surplusGraphite: number;
}

const ZERO: OilSolution = {
  plasma: 0, xray: 0, reformed: 0, arcGraphite: 0,
  crudeOil: 0, coal: 0, surplusGraphite: 0,
};

export function solveOilChain(
  { refinedOil: R, hydrogen: H, graphite: G }: OilDemand,
  mode: OilMode = 'buildings',
  prod: OilProductivity = NO_PRODUCTIVITY,
): OilSolution {
  if (R <= 0 && H <= 0 && G <= 0) return ZERO;

  // Plasma's extra products meet the same oil and hydrogen demand from fewer
  // crafts, and so from less crude — the only thing its productivity touches.
  const plasma = (R + H) / (3 * prod.plasma);

  // Positive means hydrogen is short and oil must be cracked into it; negative
  // means the reverse. This is the minimum either side has to run. Set by the
  // speed-only recipes, so productivity leaves it alone.
  const swing = (2 * H - R) / 3;
  const baseXray = Math.max(swing, 0);
  const baseReformed = Math.max(-swing, 0);

  // How much graphite the smelter is still making once cracking has covered
  // what it covers anyway. That is the room available to trade.
  const shiftable = Math.max(G - baseXray, 0);
  const shift = shiftable * MODE_SHIFT[mode];

  const xray = baseXray + shift;
  const reformed = baseReformed + shift;
  // The smelter makes Pa graphite per craft, so it needs fewer crafts — and
  // fewer, since coal is 2 per craft, less coal — for the same graphite.
  const arcGraphite = Math.max(G - xray, 0) / prod.arc;
  const surplusGraphite = Math.max(xray - G, 0);

  return {
    plasma,
    xray,
    reformed,
    arcGraphite,
    crudeOil: 2 * plasma,
    coal: reformed + 2 * arcGraphite,
    surplusGraphite,
  };
}

/** Where a quantity of one item moves between two points in the chain. */
export interface OilFlow {
  from: string;
  to: string;
  item: number;
  rate: number;
}

/**
 * The internal traffic of a solution — what moves from each step to each other.
 *
 * Refined oil and hydrogen are pools with more than one producer and more than
 * one consumer, so which producer feeds which consumer is not fixed by the
 * balances; physically it is one belt network and any attribution totalling
 * correctly is as true as another.
 *
 * Consumers are filled in order from producers in order, rather than every
 * consumer drawing a share of every producer. Both are valid, but proportional
 * shares mean each pool always draws producers × consumers arrows — four for
 * oil — where filling in order needs only as many as actually carry anything,
 * and puts the primary producer on the steps that consume before the surplus
 * goes out, which is how the chain is built.
 */
export function oilFlows(s: OilSolution, demand: OilDemand): OilFlow[] {
  const out: OilFlow[] = [];

  const split = (
    item: number,
    producers: Array<[string, number]>,
    consumers: Array<[string, number]>,
  ) => {
    const supply = producers.map(([id, amt]) => ({ id, left: amt })).filter(p => p.left > 1e-9);
    const wants = consumers.map(([id, amt]) => ({ id, left: amt })).filter(c => c.left > 1e-9);

    wants.forEach(c => {
      supply.forEach(p => {
        if (c.left <= 1e-9 || p.left <= 1e-9) return;
        const rate = Math.min(p.left, c.left);
        out.push({ from: p.id, to: c.id, item, rate });
        p.left -= rate;
        c.left -= rate;
      });
    });
  };

  if (s.crudeOil > 1e-9) out.push({ from: 'crude', to: 'plasma', item: OIL_CHAIN_ITEMS.crudeOil, rate: s.crudeOil });
  if (s.reformed > 1e-9) out.push({ from: 'coal', to: 'reformed', item: OIL_CHAIN_ITEMS.coal, rate: s.reformed });
  if (s.arcGraphite > 1e-9) out.push({ from: 'coal', to: 'arc', item: OIL_CHAIN_ITEMS.coal, rate: 2 * s.arcGraphite });

  // Gross figures, not net. X-ray Cracking takes 2 hydrogen per craft and
  // returns 3; Reformed Refinement takes 2 oil and returns 3. Netting those to
  // "+1 hydrogen" and "+1 oil" hides an input each step genuinely needs
  // belting to it — the whole point of a flow diagram.
  //
  // A step can therefore feed itself, and that self-loop is real: the recycled
  // portion goes round rather than being delivered. Producers are ordered with
  // the primary refinery first so external supply is used before a step falls
  // back on its own return, keeping those loops as small as they truly are.
  split(OIL_CHAIN_ITEMS.refinedOil,
    [['plasma', 2 * s.plasma], ['reformed', 3 * s.reformed]],
    [['xray', s.xray], ['reformed', 2 * s.reformed], ['out-oil', demand.refinedOil]]);

  split(OIL_CHAIN_ITEMS.hydrogen,
    [['plasma', s.plasma], ['xray', 3 * s.xray]],
    [['xray', 2 * s.xray], ['reformed', s.reformed], ['out-hydrogen', demand.hydrogen]]);

  split(OIL_CHAIN_ITEMS.graphite,
    [['xray', s.xray], ['arc', s.arcGraphite]],
    [['out-graphite', demand.graphite + s.surplusGraphite]]);

  return out;
}

/** Item ids the chain balances, for reading demand off a plan. */
export const OIL_CHAIN_ITEMS = {
  refinedOil: 1114,
  hydrogen: 1120,
  graphite: 1109,
  crudeOil: 1007,
  coal: 1006,
} as const;

/** Recipe timings, seconds per craft at ×1 — for turning crafts into machines. */
export const OIL_CRAFT_SECONDS = {
  refinery: 4,
  graphiteSmelter: 2,
} as const;
