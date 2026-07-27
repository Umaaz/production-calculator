// Tile-discrete entity model shared by the canvas renderer and, later, the
// blueprint exporter.
//
// Everything here is integer-tile and carries an explicit facing, so a consumer
// can emit real buildings without re-deriving geometry from draw calls. Nothing
// in this file knows about any specific game's proto IDs — that mapping belongs
// in the per-game module.

export const MAX_ARM_TILES = 3;   // sorter arm max length in tiles

export type Dir = 0 | 1 | 2 | 3;  // 0 = N, 1 = E, 2 = S, 3 = W

export type EntityKind = 'machine' | 'raw' | 'belt' | 'sorter' | 'splitter';

export interface PlacedEntity {
  id: number;              // stable index; connections reference this
  kind: EntityKind;
  x: number; y: number;    // NW corner, integer tiles
  z: number;               // belt elevation level; 0 = ground
  w: number; h: number;
  dir: Dir;                // direction items flow through this entity
  groupId: string;
  itemId?: string;
  machineId?: string;
  tierId?: string;
  // Sorters span two endpoints rather than occupying an exclusive footprint:
  // (x, y) is the belt-side cell and (x2, y2) the machine-side cell. This
  // mirrors how a sorter is actually described — DSP stores both a localOffset
  // and a localOffset2 per building for exactly this case. armLen is the
  // distance between them, which is also the sorter's "grid" rating and so
  // selects its throughput tier (Mk.I is 90/45/30 at 1/2/3 grids).
  x2?: number; y2?: number;
  armLen?: number;         // sorter only: endpoint distance (1..MAX_ARM_TILES)
  annotate?: 'in' | 'out'; // renderer hint: draw the item label on this tile
  outputTo?: number;       // entity id this one feeds
  inputFrom?: number;      // entity id feeding this one
}

/** A group expanded to a placed tile bounding box. */
export interface TileGroup {
  id: string;
  itemId: string;
  machineId: string;
  tierId: string;
  level: number;              // stage column (0 = raw inputs, max = root output)
  count: number;
  rate: number;
  capacityPerMachine: number; // items/min per machine at full speed (rate / exactCount)
  maxPerBelt: number;         // how many machines one belt lane can serve
  isRaw: boolean;
  mW: number;               // per-machine tile width
  mH: number;               // per-machine tile height
  cols: number;             // machines per row (horizontal)
  rows: number;             // machine rows (stacked vertically)
  tileX: number;
  tileY: number;
  totalW: number;           // bounding box in tiles
  totalH: number;
  // Belt lane breakdown (all ≤ MAX_ARM_TILES = 3 per side):
  topInputBelts: number;    // input belt lanes above machine  (= topPad)
  outputBelts: number;      // output belt lanes below machine, CLOSEST (depth 1..outputBelts)
  bottomInputBelts: number; // overflow input lanes below machine, OUTSIDE outputs (depth outputBelts+1..)
  topPad: number;           // = topInputBelts
  botPad: number;           // = outputBelts + bottomInputBelts
  innerGap: number;         // = topPad + botPad
  // Side margins hold the vertical split/merge spines when rows > 1. Each belt
  // lane needs its own spine column, so these scale with the lane counts rather
  // than being a fixed 1 tile — two spines in one cell is unbuildable.
  leftExt: number;          // = max(1, topInputBelts + bottomInputBelts)
  rightExt: number;         // = max(1, outputBelts)
  beltAccess: string;
  // Ordered input items: index 0 = top lane closest to machine (arm=1), index topInputBelts-1 = farthest top lane
  // then bottomInputBelts overflow items follow
  inputItems: string[];     // itemIds in belt-lane order (top lanes first, then bottom overflow)
  // Belt hook-up points (tile coords, vertical centre of belt on that edge)
  // Input enters from left of the topmost input belt; output exits from right of the bottommost output belt.
  outX: number; outY: number;
  inX: number;  inY: number;
}

/**
 * Orthogonal belt path connecting two groups.
 * Points are still fractional — inter-group routes are quantised to whole tiles
 * in a later pass, so these are not yet emitted as entities.
 */
export interface TileBelt {
  fromId: string;
  toId: string;
  itemId: string;
  rate: number;
  pts: Array<{ x: number; y: number }>;
}

/**
 * Expand placed groups into individual tile-discrete buildings.
 *
 * Covers everything inside a group's bounding box: machines, the horizontal
 * belt lanes feeding/draining each machine row, the sorter arms bridging lane
 * to machine, and the vertical splitter/merger spines in the side margins.
 *
 * Inter-group belt routes are NOT included — those still carry fractional
 * coordinates and are handled separately by the renderer until they are
 * quantised.
 */
export function buildEntities(tileGroups: TileGroup[]): PlacedEntity[] {
  const out: PlacedEntity[] = [];
  let nextId = 0;

  const add = (e: Omit<PlacedEntity, 'id' | 'z'> & { z?: number }): PlacedEntity => {
    const ent = { z: 0, ...e, id: nextId++ } as PlacedEntity;
    out.push(ent);
    return ent;
  };

  /** Emit a chained run of 1×1 belt tiles over the given cells. */
  const runBelts = (
    cells: Array<{ x: number; y: number }>,
    dir: Dir,
    groupId: string,
    itemId: string | undefined,
    annotateAt: number,          // index within cells to label, or -1
    annotateKind: 'in' | 'out',
  ) => {
    let prev: PlacedEntity | null = null;
    cells.forEach((c, i) => {
      const ent = add({
        kind: 'belt', x: c.x, y: c.y, w: 1, h: 1, dir,
        groupId, itemId,
        annotate: i === annotateAt ? annotateKind : undefined,
      });
      if (prev) { prev.outputTo = ent.id; ent.inputFrom = prev.id; }
      prev = ent;
    });
  };

  tileGroups.forEach(g => {
    if (g.isRaw) {
      add({
        kind: 'raw', x: g.tileX, y: g.tileY, w: g.totalW, h: g.totalH,
        dir: 1, groupId: g.id, itemId: g.itemId,
      });
      return;
    }

    const machLeft  = g.tileX + g.leftExt;
    const machRight = machLeft + g.cols * g.mW;   // exclusive

    // ── Machines ────────────────────────────────────────────────────────────
    for (let i = 0; i < g.count; i++) {
      const col = i % g.cols;
      const row = Math.floor(i / g.cols);
      add({
        kind: 'machine',
        x: machLeft + col * g.mW,
        y: g.tileY + g.topPad + row * (g.mH + g.innerGap),
        w: g.mW, h: g.mH, dir: 0, groupId: g.id,
        itemId: g.itemId, machineId: g.machineId, tierId: g.tierId,
      });
    }

    if (g.beltAccess === 'direct') return;
    const { topInputBelts: tib, outputBelts: ob, bottomInputBelts: bib } = g;
    if (tib === 0 && ob === 0 && bib === 0) return;

    // Spines only exist when a single incoming belt must be split across rows.
    const hasSpines = g.rows > 1;

    // Spine column for each lane. Inputs occupy the left margin (lane 1 closest
    // to the machines); outputs occupy the right margin.
    const inSpineX  = (k: number) => g.tileX + g.leftExt - k;                 // k = 1..tib
    const ovSpineX  = (j: number) => g.tileX + g.leftExt - tib - j;           // j = 1..bib
    const outSpineX = (m: number) => g.tileX + g.totalW - g.rightExt + m - 1; // m = 1..ob

    // ── Horizontal belt lanes + sorter arms, per machine row ────────────────
    for (let r = 0; r < g.rows; r++) {
      const blockTop = g.tileY + r * (g.mH + g.innerGap);
      const machTop  = blockTop + tib;
      const machBot  = machTop + g.mH;

      // A lane runs between its own spine and the machine block. Without
      // spines it spans the full bounding box, as before.
      const laneCells = (laneY: number, spineX: number, io: 'in' | 'out') => {
        let x0: number, x1: number;
        if (!hasSpines)       { x0 = g.tileX;    x1 = g.tileX + g.totalW - 1; }
        else if (io === 'in') { x0 = spineX + 1; x1 = machRight - 1; }
        else                  { x0 = machLeft;   x1 = spineX - 1; }
        const cells: Array<{ x: number; y: number }> = [];
        for (let x = x0; x <= x1; x++) cells.push({ x, y: laneY });
        return cells;
      };

      // Top input lanes — lane k=1 closest to the machine, k=tib farthest.
      for (let k = 1; k <= tib; k++) {
        const cells = laneCells(machTop - k, inSpineX(k), 'in');
        // Label once, on row 0 only, to avoid repeating it down the block.
        runBelts(cells, 1, g.id, g.inputItems[k - 1], r === 0 ? 0 : -1, 'in');
      }

      // Output lanes — closest to the machine, depth 1..ob.
      for (let m = 1; m <= ob; m++) {
        const cells = laneCells(machBot + m - 1, outSpineX(m), 'out');
        runBelts(cells, 1, g.id, g.itemId, r === g.rows - 1 ? cells.length - 1 : -1, 'out');
      }

      // Overflow input lanes — below the outputs, depth ob+1..
      for (let j = 1; j <= bib; j++) {
        const cells = laneCells(machBot + ob + j - 1, ovSpineX(j), 'in');
        runBelts(cells, 1, g.id, g.inputItems[tib + j - 1], r === 0 ? 0 : -1, 'in');
      }

      // ── Sorter arms ───────────────────────────────────────────────────────
      // Arms are spread evenly across the machine face so they don't stack.
      // Each entity sits on its belt-side tile and reaches armLen tiles toward
      // the machine, in the direction items travel.
      const machinesInRow = Math.min(g.cols, g.count - r * g.cols);
      for (let c = 0; c < machinesInRow; c++) {
        const mLeft = machLeft + c * g.mW;
        const armX  = (idx: number, of: number) =>
          mLeft + Math.floor((idx - 0.5) * g.mW / Math.max(of, 1));

        for (let k = 1; k <= tib; k++) {          // belt above → machine below
          const x = armX(k, tib);
          add({ kind: 'sorter', x, y: machTop - k, w: 1, h: 1,
                x2: x, y2: machTop, dir: 2, groupId: g.id,
                itemId: g.inputItems[k - 1], armLen: k });
        }
        for (let m = 1; m <= ob; m++) {           // machine above → belt below
          const x = armX(m, ob);
          add({ kind: 'sorter', x, y: machBot + m - 1, w: 1, h: 1,
                x2: x, y2: machBot - 1, dir: 2, groupId: g.id,
                itemId: g.itemId, armLen: m });
        }
        for (let j = 1; j <= bib; j++) {          // belt below → machine above
          const x = armX(j, bib);
          add({ kind: 'sorter', x, y: machBot + ob + j - 1, w: 1, h: 1,
                x2: x, y2: machBot - 1, dir: 0, groupId: g.id,
                itemId: g.inputItems[tib + j - 1], armLen: ob + j });
        }
      }
    }

    // ── Vertical split/merge spines ─────────────────────────────────────────
    if (!hasSpines) return;

    // Emit a spine down one column, with splitters at the row junctions.
    // Junction tiles become splitters rather than belts — a blueprint cannot
    // put both in the same cell.
    //
    // Spines sit one level up. A spine has to cross the horizontal feed lanes
    // of every lane outside it, and no purely flat arrangement avoids that:
    // a vertical run serving N rows necessarily passes through the rows of any
    // lane whose own run reaches its column. Elevating the spine is how the
    // game resolves it too.
    //
    // NOTE: the ramp tiles that carry a belt between levels are not emitted
    // yet — they belong with inter-group route quantisation, which is where
    // elevation changes get handled generally.
    const spine = (
      spineX: number, rowYs: number[], junctions: number[],
      itemId: string | undefined,
    ) => {
      const jset = new Set(junctions);
      const y0   = Math.min(...rowYs);
      const y1   = Math.max(...rowYs);
      let prev: PlacedEntity | null = null;
      for (let y = y0; y <= y1; y++) {
        const ent = add({
          kind: jset.has(y) ? 'splitter' : 'belt',
          x: spineX, y, z: 1, w: 1, h: 1, dir: 2, groupId: g.id, itemId,
        });
        if (prev) { prev.outputTo = ent.id; ent.inputFrom = prev.id; }
        prev = ent;
      }
    };

    const rowYsOf = (offset: number) =>
      Array.from({ length: g.rows }, (_, r) => g.tileY + r * (g.mH + g.innerGap) + offset);

    // Inputs fork at every row but the last.
    for (let k = 1; k <= tib; k++) {
      const rowYs = rowYsOf(tib - k);
      spine(inSpineX(k), rowYs, rowYs.slice(0, -1), g.inputItems[k - 1]);
    }
    for (let j = 1; j <= bib; j++) {
      const rowYs = rowYsOf(tib + g.mH + ob + j - 1);
      spine(ovSpineX(j), rowYs, rowYs.slice(0, -1), g.inputItems[tib + j - 1]);
    }
    // Outputs merge at every row but the first.
    for (let m = 1; m <= ob; m++) {
      const rowYs = rowYsOf(tib + g.mH + m - 1);
      spine(outSpineX(m), rowYs, rowYs.slice(1), g.itemId);
    }
  });

  return out;
}
