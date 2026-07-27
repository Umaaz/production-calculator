import { buildEntities, MAX_ARM_TILES } from './layoutEntities';
import type { PlacedEntity, TileGroup } from './layoutEntities';

// Build a TileGroup the way computeLayout does, so the derived margins and
// bounding box stay consistent with the real pipeline.
function mkGroup(o: {
  tib: number; ob: number; bib?: number;
  cols: number; rows: number; count: number;
  mW?: number; mH?: number;
  tileX?: number; tileY?: number;
  isRaw?: boolean;
}): TileGroup {
  const bib = o.bib ?? 0;
  const mW  = o.mW ?? 3;
  const mH  = o.mH ?? 3;
  const tp  = o.tib;
  const bp  = o.ob + bib;
  const ig  = tp + bp;
  const leftExt  = Math.max(1, o.tib + bib);
  const rightExt = Math.max(1, o.ob);
  return {
    id: 'g', itemId: 'iron-ingot', machineId: 'assembler', tierId: 'mk1',
    level: 0, count: o.count, rate: 60, capacityPerMachine: 30, maxPerBelt: 4,
    isRaw: o.isRaw ?? false,
    mW, mH, cols: o.cols, rows: o.rows,
    tileX: o.tileX ?? 0, tileY: o.tileY ?? 0,
    totalW: leftExt + o.cols * mW + rightExt,
    totalH: tp + o.rows * mH + Math.max(0, o.rows - 1) * ig + bp,
    topInputBelts: o.tib, outputBelts: o.ob, bottomInputBelts: bib,
    topPad: tp, botPad: bp, innerGap: ig,
    leftExt, rightExt, beltAccess: 'sorter',
    inputItems: Array.from({ length: o.tib + bib }, (_, i) => `in-${i}`),
    outX: 0, outY: 0, inX: 0, inY: 0,
  };
}

/**
 * Cells claimed exclusively, keyed per elevation level — belts at different
 * levels are allowed to cross. Sorters are excluded on purpose: they are
 * stored as a pair of endpoints (belt cell → machine cell) and overlay the
 * boundary rather than owning a footprint.
 */
function occupancy(entities: PlacedEntity[]): Map<string, PlacedEntity[]> {
  const cells = new Map<string, PlacedEntity[]>();
  entities.forEach(e => {
    if (e.kind === 'sorter') return;
    for (let dx = 0; dx < e.w; dx++) {
      for (let dy = 0; dy < e.h; dy++) {
        const k = `${e.x + dx},${e.y + dy}@${e.z}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k)!.push(e);
      }
    }
  });
  return cells;
}

function collisions(entities: PlacedEntity[]): string[] {
  return Array.from(occupancy(entities).entries())
    .filter(([, es]) => es.length > 1)
    .map(([cell, es]) => `${cell}: ${es.map(e => e.kind).join(' + ')}`);
}

describe('buildEntities placement', () => {
  // The case that motivated widening the side margins: a multi-row assembler
  // (in3_out1) needs three input spines, which a 1-tile margin cannot hold.
  it('gives every belt lane its own spine column on a multi-row assembler', () => {
    const g = mkGroup({ tib: 3, ob: 1, cols: 2, rows: 3, count: 6 });
    expect(collisions(buildEntities([g]))).toEqual([]);
  });

  it('places no two buildings in one cell across representative layouts', () => {
    const cases: TileGroup[] = [
      mkGroup({ tib: 1, ob: 1, cols: 1, rows: 1, count: 1 }), // smallest
      mkGroup({ tib: 2, ob: 1, cols: 4, rows: 1, count: 4 }), // smelter, single row
      mkGroup({ tib: 3, ob: 1, cols: 2, rows: 2, count: 4 }), // assembler, 2 rows
      mkGroup({ tib: 3, ob: 2, cols: 3, rows: 3, count: 9 }), // chemical, 3 rows
      mkGroup({ tib: 3, ob: 1, bib: 2, cols: 2, rows: 2, count: 4 }), // lab w/ overflow
      mkGroup({ tib: 2, ob: 1, cols: 2, rows: 2, count: 3, mW: 5, mH: 5 }), // collider, ragged last row
    ];
    cases.forEach(g => expect(collisions(buildEntities([g]))).toEqual([]));
  });

  it('keeps every entity inside the group bounding box', () => {
    const g = mkGroup({ tib: 3, ob: 2, cols: 3, rows: 3, count: 9, tileX: 7, tileY: 4 });
    buildEntities([g]).forEach(e => {
      expect(e.x).toBeGreaterThanOrEqual(g.tileX);
      expect(e.y).toBeGreaterThanOrEqual(g.tileY);
      expect(e.x + e.w).toBeLessThanOrEqual(g.tileX + g.totalW);
      expect(e.y + e.h).toBeLessThanOrEqual(g.tileY + g.totalH);
    });
  });

  it('emits exactly `count` machines, including a ragged final row', () => {
    const g = mkGroup({ tib: 3, ob: 1, cols: 4, rows: 2, count: 7 });
    const machines = buildEntities([g]).filter(e => e.kind === 'machine');
    expect(machines).toHaveLength(7);
  });

  it('never exceeds the maximum sorter reach', () => {
    const g = mkGroup({ tib: 3, ob: 2, bib: 1, cols: 2, rows: 2, count: 4 });
    buildEntities([g])
      .filter(e => e.kind === 'sorter')
      .forEach(e => {
        expect(e.armLen).toBeGreaterThanOrEqual(1);
        expect(e.armLen).toBeLessThanOrEqual(MAX_ARM_TILES);
      });
  });

  it('links belt runs into a chain', () => {
    const g = mkGroup({ tib: 1, ob: 1, cols: 3, rows: 1, count: 3 });
    const belts = buildEntities([g]).filter(e => e.kind === 'belt');
    const byId  = new Map(belts.map(e => [e.id, e]));
    // Every declared successor exists and points back at its predecessor.
    belts.forEach(e => {
      if (e.outputTo === undefined) return;
      const next = byId.get(e.outputTo);
      expect(next).toBeDefined();
      expect(next!.inputFrom).toBe(e.id);
    });
    // At least one run of more than one tile was actually chained.
    expect(belts.some(e => e.outputTo !== undefined)).toBe(true);
  });

  it('represents a raw node as a single box with no belt furniture', () => {
    const g = mkGroup({ tib: 0, ob: 0, cols: 1, rows: 1, count: 1, isRaw: true });
    const ents = buildEntities([g]);
    expect(ents).toHaveLength(1);
    expect(ents[0].kind).toBe('raw');
  });
});
