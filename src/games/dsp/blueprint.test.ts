import * as fs from 'fs';
import * as path from 'path';
import { decodeBlueprint, inflatePayload } from './blueprint';
import { readBlueprintPayload, writeBlueprintPayload } from './blueprintBinary';

// Reference fixture: a small 9×10 mall section built in 0.8.20.7996. Small
// enough that every field can be asserted against what the game actually
// placed, which is the only way to be sure the struct layout is right.
const FIXTURE = path.join(__dirname, '../../../resources/dsp/blueprints/simple_mall_pt1.dsp');
const text = fs.readFileSync(FIXTURE, 'utf8');

const ITEM = { BELT_MK1: 2001, SORTER_MK1: 2011, STORAGE_MK1: 2101, TESLA_TOWER: 2201, ASSEMBLER_MK1: 2303 };

describe('blueprint header', () => {
  const { header, hash } = decodeBlueprint(text);

  it('parses the csv fields', () => {
    expect(header.headerVersion).toBe(0);
    expect(header.layout).toBe(20);
    expect(header.icons).toEqual([2011, 2001, 0, 0, 0]);
    expect(header.reserved).toBe(0);
    expect(header.gameVersion).toBe('0.8.20.7996');
    expect(header.shortDesc).toBe('Part 1');
    expect(header.desc).toBe('Place Part 1-5 next to each other with 1 belt overlap');
  });

  it('keeps the .NET tick timestamp as a string', () => {
    // 637647239078962124 > Number.MAX_SAFE_INTEGER — parsing it as a number
    // would round it and silently corrupt the value on re-encode.
    expect(header.timestamp).toBe('637647239078962124');
    expect(Number(header.timestamp)).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  });

  it('carries the hash through without verifying it', () => {
    expect(hash).toBe('B2E2D11E1608DB65830FBB85D79FFAB4');
  });
});

describe('blueprint payload', () => {
  const { data } = decodeBlueprint(text);

  it('reads the blueprint-level fields', () => {
    expect(data.version).toBe(1);
    expect([data.cursorOffsetX, data.cursorOffsetY]).toEqual([4, 5]);
    expect([data.dragBoxSizeX, data.dragBoxSizeY]).toEqual([9, 10]);
    expect(data.primaryAreaIdx).toBe(0);
  });

  it('reads the single area', () => {
    expect(data.areas).toHaveLength(1);
    expect(data.areas[0]).toEqual({
      index: 0, parentIndex: -1, tropicAnchor: 0, areaSegments: 200,
      anchorLocalOffsetX: 0, anchorLocalOffsetY: 0, width: 9, height: 10,
    });
  });

  it('reads every building', () => {
    expect(data.buildings).toHaveLength(58);
    const byItem = data.buildings.reduce<Record<number, number>>((acc, b) => {
      acc[b.itemId] = (acc[b.itemId] ?? 0) + 1;
      return acc;
    }, {});
    expect(byItem).toEqual({
      [ITEM.BELT_MK1]: 45,
      [ITEM.SORTER_MK1]: 8,
      [ITEM.STORAGE_MK1]: 2,
      [ITEM.TESLA_TOWER]: 1,
      [ITEM.ASSEMBLER_MK1]: 2,
    });
  });

  it('reads a belt record field for field', () => {
    const b = data.buildings[0];
    expect(b.index).toBe(0);
    expect(b.areaIndex).toBe(0);
    expect(b.localOffset.x).toBeCloseTo(4, 3);
    expect(b.localOffset.y).toBeCloseTo(9, 3);
    expect(b.localOffset.z).toBeCloseTo(0, 3);
    expect(b.localOffset2).toEqual(b.localOffset);
    expect(b.yaw).toBeCloseTo(270, 2);
    expect(b.yaw2).toBeCloseTo(270, 2);
    expect(b.itemId).toBe(ITEM.BELT_MK1);
    expect(b.modelIndex).toBe(35);
    expect(b.outputObjIdx).toBe(1);
    expect(b.inputObjIdx).toBe(-1);
    expect(b.recipeId).toBe(0);
    expect(b.filterId).toBe(0);
    expect(b.parameters).toEqual([]);
  });

  it('gives assemblers a recipe id', () => {
    const recipes = data.buildings
      .filter(b => b.itemId === ITEM.ASSEMBLER_MK1)
      .map(b => b.recipeId)
      .sort((a, z) => a - z);
    expect(recipes).toEqual([84, 85]);
  });

  it('stores the sorter arm length in parameters[0]', () => {
    const sorters = data.buildings.filter(b => b.itemId === ITEM.SORTER_MK1);
    expect(sorters).toHaveLength(8);
    sorters.forEach(s => {
      const dist = Math.hypot(
        s.localOffset2.x - s.localOffset.x,
        s.localOffset2.y - s.localOffset.y,
      );
      expect(s.parameters).toHaveLength(1);
      expect(s.parameters[0]).toBe(Math.round(dist));
      expect(s.parameters[0]).toBeGreaterThanOrEqual(1);
      expect(s.parameters[0]).toBeLessThanOrEqual(3);
    });
  });

  it('keeps sub-tile sorter endpoints', () => {
    // Sorters sharing a machine face are spread along it, and the machine-side
    // endpoint is inset from the footprint edge — neither lands on a tile
    // centre, so an integer-tile model cannot represent them losslessly.
    const fractional = data.buildings
      .filter(b => b.itemId === ITEM.SORTER_MK1)
      .filter(b => !Number.isInteger(Math.round(b.localOffset.x * 100) / 100));
    expect(fractional.length).toBeGreaterThan(0);
  });

  it('rejects trailing bytes', () => {
    const padded = new Uint8Array(inflatePayload(text).length + 1);
    padded.set(inflatePayload(text));
    expect(() => readBlueprintPayload(padded)).toThrow(/trailing/);
  });
});

describe('payload round trip', () => {
  // The gzip stream itself is not reproducible byte-for-byte (the game's
  // compressor is not ours), so the assertion that matters is on the inflated
  // payload: read it, write it back, expect identical bytes.
  it('re-encodes to identical bytes', () => {
    const original = inflatePayload(text);
    const rewritten = writeBlueprintPayload(readBlueprintPayload(original));
    expect(rewritten.length).toBe(original.length);
    expect(Array.from(rewritten)).toEqual(Array.from(original));
  });
});
