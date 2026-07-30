// The oil chain drawn as a flow: sources at the top, the recipes that run in
// the middle, what comes out at the bottom, with every movement of oil,
// hydrogen and graphite labelled on the arrow that carries it.
//
// The whole diagram is hand-placed. There are only ever these nine boxes and
// seventeen possible flows between them, so every path and label position is
// authored once below and simply shown or hidden according to what the solution
// actually uses. Computing anchors and nudging labels apart at runtime was
// solving a layout problem that does not exist, and it could never guarantee a
// clean result — this can, because each line was put where it fits.
//
// Lanes worth knowing about, since they constrain any change:
//   x ≈ 30        left bypass, used by X-ray's recycle loop
//   x ≈ 280, 312  the gap between columns 0 and 1, two vertical bypass lanes
//   y ≈ 258, 330  above and below the sideways traffic between X-ray and Reformed

import React from 'react';
import { Icon } from './treeSource';
import { protoName } from './data/v0_10_34';
import { oilFlows, OIL_CHAIN_ITEMS, OIL_CRAFT_SECONDS } from './oilSolver';
import type { OilSolution, OilDemand } from './oilSolver';
import type { ModifierOption } from '../../ProductionTreeView';

const { refinedOil, hydrogen, graphite, crudeOil, coal } = OIL_CHAIN_ITEMS;

const W = 168;   // box width
const H = 58;    // box height
const WIDTH = 812;
const HEIGHT = 454;

interface Box {
  id: string;
  x: number;
  y: number;
  kind: 'source' | 'step' | 'output';
  item?: number;
  title?: string;
  crafts?: number;
  seconds?: number;
  category?: string;
  rate?: number;
}

interface EdgeSpec {
  from: string;
  to: string;
  item: number;
  /** Hand-placed path. */
  d: string;
  /** Hand-placed label centre. */
  lx: number;
  ly: number;
}

/**
 * Every flow the chain can carry.
 *
 * Outputs are ordered hydrogen, oil, graphite so each sits under whichever step
 * mainly feeds it — X-ray to hydrogen, Reformed to oil, the smelter to graphite
 * — which turns three long diagonals into straight drops.
 */
const EDGES: EdgeSpec[] = [
  { from: 'crude', to: 'plasma', item: crudeOil, d: 'M160,58 L160,132', lx: 160, ly: 95 },
  { from: 'coal', to: 'reformed', item: coal, d: 'M424,58 L424,264', lx: 424, ly: 120 },
  { from: 'coal', to: 'arc', item: coal, d: 'M508,29 C592,29 688,110 688,264', lx: 624, ly: 84 },

  { from: 'plasma', to: 'xray', item: refinedOil, d: 'M130,190 L130,264', lx: 130, ly: 212 },
  { from: 'plasma', to: 'xray', item: hydrogen, d: 'M190,190 L190,264', lx: 190, ly: 246 },

  { from: 'plasma', to: 'reformed', item: refinedOil, d: 'M244,150 C312,150 352,196 366,264', lx: 300, ly: 156 },
  { from: 'plasma', to: 'reformed', item: hydrogen, d: 'M244,180 C320,214 356,224 390,264', lx: 340, ly: 224 },

  // Two bypass lanes down the gap between the first two columns.
  { from: 'plasma', to: 'out-hydrogen', item: hydrogen, d: 'M232,190 C280,244 280,342 160,396', lx: 238, ly: 364 },
  { from: 'plasma', to: 'out-oil', item: refinedOil, d: 'M244,166 C312,224 312,342 424,396', lx: 348, ly: 358 },

  // Recycle loops, hung off the face the neighbours are not using.
  { from: 'xray', to: 'xray', item: hydrogen, d: 'M76,293 C4,302 4,240 118,264', lx: 34, ly: 250 },
  { from: 'reformed', to: 'reformed', item: refinedOil, d: 'M508,293 C572,302 572,240 466,264', lx: 546, ly: 248 },

  // Sideways traffic, bowed apart so the two directions never share a line.
  { from: 'xray', to: 'reformed', item: hydrogen, d: 'M244,280 C292,254 292,254 340,280', lx: 292, ly: 254 },
  { from: 'reformed', to: 'xray', item: refinedOil, d: 'M340,306 C292,332 292,332 244,306', lx: 292, ly: 334 },

  { from: 'xray', to: 'out-hydrogen', item: hydrogen, d: 'M160,322 L160,396', lx: 160, ly: 352 },
  { from: 'xray', to: 'out-graphite', item: graphite, d: 'M204,322 C320,378 520,372 688,396', lx: 430, ly: 380 },

  { from: 'reformed', to: 'out-oil', item: refinedOil, d: 'M424,322 L424,396', lx: 424, ly: 352 },
  { from: 'arc', to: 'out-graphite', item: graphite, d: 'M688,322 L688,396', lx: 688, ly: 352 },
];

const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : Number(n.toFixed(2)).toString());

export function OilFlow({ solution, demand, machineFor, speedFor, modifierFor }: {
  solution: OilSolution;
  demand: OilDemand;
  machineFor: (category: string) => number | undefined;
  speedFor: (category: string) => number;
  /** The proliferator in force for a step, after its own restrictions. */
  modifierFor: (stepId: string) => ModifierOption | undefined;
}) {
  const boxes: Box[] = [
    { id: 'crude', x: 76, y: 0, kind: 'source', item: crudeOil, rate: solution.crudeOil },
    { id: 'coal', x: 340, y: 0, kind: 'source', item: coal, rate: solution.coal },

    { id: 'plasma', x: 76, y: 132, kind: 'step', title: 'Plasma Refining',
      crafts: solution.plasma, seconds: OIL_CRAFT_SECONDS.refinery, category: 'refinery' },

    { id: 'xray', x: 76, y: 264, kind: 'step', title: 'X-ray Cracking',
      crafts: solution.xray, seconds: OIL_CRAFT_SECONDS.refinery, category: 'refinery' },
    { id: 'reformed', x: 340, y: 264, kind: 'step', title: 'Reformed Refinement',
      crafts: solution.reformed, seconds: OIL_CRAFT_SECONDS.refinery, category: 'refinery' },
    { id: 'arc', x: 604, y: 264, kind: 'step', title: 'Energetic Graphite',
      crafts: solution.arcGraphite, seconds: OIL_CRAFT_SECONDS.graphiteSmelter, category: 'smelter' },

    { id: 'out-hydrogen', x: 76, y: 396, kind: 'output', item: hydrogen, rate: demand.hydrogen },
    { id: 'out-oil', x: 340, y: 396, kind: 'output', item: refinedOil, rate: demand.refinedOil },
    { id: 'out-graphite', x: 604, y: 396, kind: 'output', item: graphite,
      rate: demand.graphite + solution.surplusGraphite },
  ];

  // A step that isn't running is hidden, along with anything it would carry.
  const live = new Set(
    boxes.filter(b => b.kind !== 'step' || (b.crafts ?? 0) > 1e-9).map(b => b.id),
  );

  const flows = oilFlows(solution, demand);
  const rateOf = (e: EdgeSpec) =>
    flows.find(f => f.from === e.from && f.to === e.to && f.item === e.item)?.rate ?? 0;

  const edges = EDGES
    .map(e => ({ spec: e, rate: rateOf(e) }))
    .filter(({ spec, rate }) => rate > 1e-9 && live.has(spec.from) && live.has(spec.to));

  return (
    <div className="oflow" style={{ width: WIDTH, height: HEIGHT }}>
      <svg className="oflow-svg" width={WIDTH} height={HEIGHT} aria-hidden="true">
        <defs>
          <marker id="oflow-head" markerWidth="7" markerHeight="7" refX="6" refY="3"
            orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L7,3 L0,6 z" fill="#4d4d88" />
          </marker>
        </defs>
        {edges.map(({ spec }, i) => (
          <path key={i} d={spec.d} className="oflow-edge" markerEnd="url(#oflow-head)" />
        ))}
      </svg>

      {edges.map(({ spec, rate }, i) => (
        <span
          key={i}
          className="oflow-label"
          style={{ left: spec.lx, top: spec.ly }}
          title={`${fmt(rate)} ${protoName.get(spec.item)} / min`}
        >
          <Icon id={spec.item} size={13} />
          {fmt(rate)}
        </span>
      ))}

      {boxes.filter(b => live.has(b.id)).map(b => {
        const machineId = b.category ? machineFor(b.category) : undefined;
        const mod = b.kind === 'step' ? modifierFor(b.id) : undefined;
        // Speed from the proliferator only: fewer machines for the same crafts.
        // Any productivity is already in the crafts, folded into the solve
        // upstream, so applying it again here would double-count it.
        const machines = b.crafts !== undefined && b.seconds
          ? b.crafts / ((60 / b.seconds) * speedFor(b.category!) * (mod?.speed ?? 1))
          : 0;
        return (
          <div
            key={b.id}
            className={`oflow-box oflow-box--${b.kind}${(b.rate ?? 1) <= 0 ? ' is-idle' : ''}`}
            style={{ left: b.x, top: b.y, width: W, height: H }}
          >
            {b.kind === 'step' ? (
              <>
                <span className="oflow-title">{b.title}</span>
                <span className="oflow-sub">
                  {machineId !== undefined && <Icon id={machineId} size={14} />}
                  {Math.ceil(machines - 1e-9)}× <small>({fmt(machines)})</small>
                  {mod?.iconId && (
                    <span className="oflow-mod" title={mod.name}>
                      <Icon id={mod.iconId} size={13} />
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="oflow-title">
                  <Icon id={b.item!} size={18} />
                  {protoName.get(b.item!)}
                </span>
                <span className="oflow-sub oflow-sub--rate">
                  {fmt(b.rate ?? 0)}<small> /min</small>
                  {b.id === 'out-graphite' && solution.surplusGraphite > 0 && (
                    <em title="Cracking makes this whether the plan wants it or not">
                      {' '}incl. {fmt(solution.surplusGraphite)} spare
                    </em>
                  )}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
