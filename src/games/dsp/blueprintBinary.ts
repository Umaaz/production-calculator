// DSP blueprint payload — binary struct reader/writer.
//
// This layer is deliberately dependency-free and lossless: it maps the
// inflated payload bytes to plain objects and back, preserving every field
// verbatim (including ones whose meaning we don't know yet). Base64, gzip and
// the text header live one level up in blueprint.ts.
//
// Nothing here is interpreted — positions stay floats, yaw stays a float, and
// proto IDs stay numbers. Translating to the game-independent layout model is a
// separate concern; doing it here would bake in assumptions the format doesn't
// make.
//
// Layout verified byte-exact against resources/dsp/blueprints/simple_mall_pt1.dsp
// (game version 0.8.20.7996, payload version 1): the reader consumes all 3645
// bytes with nothing trailing.

export interface DspVec3 { x: number; y: number; z: number; }

export interface DspArea {
  index: number;
  parentIndex: number;         // -1 when the area has no parent
  tropicAnchor: number;
  areaSegments: number;        // planet latitude banding (200 on a standard planet)
  anchorLocalOffsetX: number;
  anchorLocalOffsetY: number;
  width: number;
  height: number;
}

export interface DspBuilding {
  index: number;               // referenced by other buildings' obj indices
  areaIndex: number;
  // Building position. For most buildings localOffset2 equals localOffset;
  // sorters use the pair as endpoints — localOffset is the pickup cell and
  // localOffset2 the drop cell. Both are floats and genuinely sub-tile: a
  // sorter's machine-side endpoint is inset from the footprint edge, and
  // sorters sharing a machine face are spread along it.
  localOffset: DspVec3;
  localOffset2: DspVec3;
  yaw: number;                 // degrees, float — real blueprints carry drift (179.9, 180.1)
  yaw2: number;
  itemId: number;              // item proto id of the building (2001 = belt Mk.I)
  modelIndex: number;          // independent of itemId (belt 35, sorter 41, assembler 65)
  outputObjIdx: number;        // building index this feeds, or -1
  inputObjIdx: number;         // building index feeding this, or -1
  outputToSlot: number;
  inputFromSlot: number;
  outputFromSlot: number;
  inputToSlot: number;
  outputOffset: number;
  inputOffset: number;
  recipeId: number;            // recipe proto id, 0 when not applicable
  filterId: number;            // sorter filter item proto id, 0 = unfiltered
  // Variable-length tail whose meaning depends on the building type:
  //   sorter  → [armLength] in grids (1..3)
  //   belt    → [iconItemId] when a signal icon is set on the belt
  //   storage → [slotCount]
  parameters: number[];
}

export interface DspBlueprintData {
  version: number;             // payload format version (1 as of 0.8.x)
  cursorOffsetX: number;
  cursorOffsetY: number;
  cursorTargetArea: number;
  dragBoxSizeX: number;
  dragBoxSizeY: number;
  primaryAreaIdx: number;
  areas: DspArea[];
  buildings: DspBuilding[];
}

/** Fixed portion of a building record; `parameters` adds 4 bytes each. */
const BUILDING_FIXED_BYTES = 61;

class Reader {
  private off = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get offset() { return this.off; }
  get remaining() { return this.bytes.byteLength - this.off; }

  i8()  { return this.view.getInt8(this.off++); }
  i16() { const v = this.view.getInt16(this.off, true);   this.off += 2; return v; }
  i32() { const v = this.view.getInt32(this.off, true);   this.off += 4; return v; }
  f32() { const v = this.view.getFloat32(this.off, true); this.off += 4; return v; }
  vec3(): DspVec3 { return { x: this.f32(), y: this.f32(), z: this.f32() }; }
}

class Writer {
  private buf: Uint8Array;
  private view: DataView;
  private off = 0;

  constructor(initial = 4096) {
    this.buf = new Uint8Array(initial);
    this.view = new DataView(this.buf.buffer);
  }

  private need(n: number) {
    if (this.off + n <= this.buf.byteLength) return;
    let cap = this.buf.byteLength * 2;
    while (cap < this.off + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf);
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  i8(v: number)  { this.need(1); this.view.setInt8(this.off++, v); }
  i16(v: number) { this.need(2); this.view.setInt16(this.off, v, true);   this.off += 2; }
  i32(v: number) { this.need(4); this.view.setInt32(this.off, v, true);   this.off += 4; }
  f32(v: number) { this.need(4); this.view.setFloat32(this.off, v, true); this.off += 4; }
  vec3(v: DspVec3) { this.f32(v.x); this.f32(v.y); this.f32(v.z); }

  result(): Uint8Array { return this.buf.slice(0, this.off); }
}

/**
 * Parse an inflated blueprint payload.
 *
 * Throws if the byte count doesn't match what the declared structure implies —
 * a silent short read would otherwise surface much later as a mis-positioned
 * building, so it is worth failing loudly here.
 */
export function readBlueprintPayload(bytes: Uint8Array): DspBlueprintData {
  const r = new Reader(bytes);

  const bp: DspBlueprintData = {
    version:          r.i32(),
    cursorOffsetX:    r.i32(),
    cursorOffsetY:    r.i32(),
    cursorTargetArea: r.i32(),
    dragBoxSizeX:     r.i32(),
    dragBoxSizeY:     r.i32(),
    primaryAreaIdx:   r.i32(),
    areas: [],
    buildings: [],
  };

  const numAreas = r.i8();
  for (let i = 0; i < numAreas; i++) {
    bp.areas.push({
      index:              r.i8(),
      parentIndex:        r.i8(),
      tropicAnchor:       r.i16(),
      areaSegments:       r.i16(),
      anchorLocalOffsetX: r.i16(),
      anchorLocalOffsetY: r.i16(),
      width:              r.i16(),
      height:             r.i16(),
    });
  }

  const numBuildings = r.i32();
  for (let i = 0; i < numBuildings; i++) {
    const b: DspBuilding = {
      index:          r.i32(),
      areaIndex:      r.i8(),
      localOffset:    r.vec3(),
      localOffset2:   r.vec3(),
      yaw:            r.f32(),
      yaw2:           r.f32(),
      itemId:         r.i16(),
      modelIndex:     r.i16(),
      outputObjIdx:   r.i32(),
      inputObjIdx:    r.i32(),
      outputToSlot:   r.i8(),
      inputFromSlot:  r.i8(),
      outputFromSlot: r.i8(),
      inputToSlot:    r.i8(),
      outputOffset:   r.i8(),
      inputOffset:    r.i8(),
      recipeId:       r.i16(),
      filterId:       r.i16(),
      parameters:     [],
    };
    const numParameters = r.i16();
    for (let p = 0; p < numParameters; p++) b.parameters.push(r.i32());
    bp.buildings.push(b);
  }

  if (r.remaining !== 0) {
    throw new Error(
      `blueprint payload: ${r.remaining} trailing byte(s) after ${numBuildings} buildings ` +
      `(read ${r.offset} of ${bytes.byteLength})`,
    );
  }
  return bp;
}

/** Serialise back to payload bytes. Inverse of readBlueprintPayload. */
export function writeBlueprintPayload(bp: DspBlueprintData): Uint8Array {
  const size =
    28 + 1 + bp.areas.length * 14 + 4 +
    bp.buildings.reduce((n, b) => n + BUILDING_FIXED_BYTES + b.parameters.length * 4, 0);
  const w = new Writer(size);

  w.i32(bp.version);
  w.i32(bp.cursorOffsetX);
  w.i32(bp.cursorOffsetY);
  w.i32(bp.cursorTargetArea);
  w.i32(bp.dragBoxSizeX);
  w.i32(bp.dragBoxSizeY);
  w.i32(bp.primaryAreaIdx);

  w.i8(bp.areas.length);
  bp.areas.forEach(a => {
    w.i8(a.index);
    w.i8(a.parentIndex);
    w.i16(a.tropicAnchor);
    w.i16(a.areaSegments);
    w.i16(a.anchorLocalOffsetX);
    w.i16(a.anchorLocalOffsetY);
    w.i16(a.width);
    w.i16(a.height);
  });

  w.i32(bp.buildings.length);
  bp.buildings.forEach(b => {
    w.i32(b.index);
    w.i8(b.areaIndex);
    w.vec3(b.localOffset);
    w.vec3(b.localOffset2);
    w.f32(b.yaw);
    w.f32(b.yaw2);
    w.i16(b.itemId);
    w.i16(b.modelIndex);
    w.i32(b.outputObjIdx);
    w.i32(b.inputObjIdx);
    w.i8(b.outputToSlot);
    w.i8(b.inputFromSlot);
    w.i8(b.outputFromSlot);
    w.i8(b.inputToSlot);
    w.i8(b.outputOffset);
    w.i8(b.inputOffset);
    w.i16(b.recipeId);
    w.i16(b.filterId);
    w.i16(b.parameters.length);
    b.parameters.forEach(p => w.i32(p));
  });

  return w.result();
}
