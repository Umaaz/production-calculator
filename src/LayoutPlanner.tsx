export {}
// import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
// import type { GameData, LayoutMachineSpec } from './gameTypes';
// import type { TreeNode } from './treeLogic';
// import { buildEntities, MAX_ARM_TILES } from './layoutEntities';
// import type { PlacedEntity, TileGroup, TileBelt } from './layoutEntities';
//
// // ── Sprite sheet rendering ────────────────────────────────────────────────────
// // Sprites are CSS-driven via data-icon="${ns}.${id}". We read background-position
// // from a hidden element to find the cell in the sprite sheet, then drawImage.
//
// interface SpriteCell { url: string; col: number; row: number; cols: number; }
//
// const _cellCache: Map<string, SpriteCell | null> = new Map();
// const _imgCache:  Map<string, HTMLImageElement>   = new Map();
// const _pending:   Set<string>                     = new Set();
//
// function getSpriteCell(iconNs: string, spriteId: number): SpriteCell | null {
//   const key = `${iconNs}.${spriteId}`;
//   if (_cellCache.has(key)) return _cellCache.get(key) ?? null;
//   const el = document.createElement('span');
//   el.setAttribute('data-icon', key);
//   el.style.cssText = 'position:fixed;width:80px;height:80px;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
//   document.body.appendChild(el);
//   const cs  = window.getComputedStyle(el);
//   const img = cs.backgroundImage;   // url("...")
//   const sz  = cs.backgroundSize;    // "1400% auto"
//   const pos = cs.backgroundPosition;// "7.69% 0%"
//   document.body.removeChild(el);
//   if (!img || img === 'none') { _cellCache.set(key, null); return null; }
//   const urlM = img.match(/url\(["']?([^"')]+)["']?\)/);
//   if (!urlM)  { _cellCache.set(key, null); return null; }
//   const cols   = parseFloat(sz) / 100; // "1400%" → 14
//   const [xStr, yStr = '0'] = pos.split(' ');
//   const col = Math.round(parseFloat(xStr) * (cols - 1) / 100);
//   const row = Math.round(parseFloat(yStr) * (cols - 1) / 100);
//   const cell: SpriteCell = { url: urlM[1], col, row, cols };
//   _cellCache.set(key, cell);
//   return cell;
// }
//
// function loadSpriteImage(url: string, onLoad: () => void) {
//   if (_imgCache.has(url) || _pending.has(url)) return;
//   _pending.add(url);
//   const el = new Image();
//   el.onload = () => { _imgCache.set(url, el); _pending.delete(url); onLoad(); };
//   el.src = url;
// }
//
// /** Draw a sprite on canvas; returns false if image not ready (triggers async load). */
// function tryDrawSprite(
//   ctx: CanvasRenderingContext2D,
//   iconNs: string, spriteId: number,
//   dx: number, dy: number, dw: number, dh: number,
//   onNeedLoad: (url: string) => void,
// ): boolean {
//   const cell = getSpriteCell(iconNs, spriteId);
//   if (!cell) return false;
//   const img = _imgCache.get(cell.url);
//   if (!img || !img.complete || img.naturalWidth === 0) { onNeedLoad(cell.url); return false; }
//   const cw = img.naturalWidth  / cell.cols;
//   const ch = img.naturalHeight / cell.cols; // assume square cells
//   ctx.drawImage(img, cell.col * cw, cell.row * ch, cw, ch, dx, dy, dw, dh);
//   return true;
// }
//
// // ── Constants ─────────────────────────────────────────────────────────────────
//
// const DEFAULT_TILE_SIZE = 20;   // px per game tile (zoom base)
// const STAGE_GAP         = 8;    // tiles between production stages (horizontal)
// const GROUP_GAP         = 4;    // tiles between groups within the same stage
// const BELT_W_FRAC       = 0.35; // belt line width as fraction of tile size
//
// // Given a group's machine count, per-machine capacity rate (items/min at full speed),
// // and belt throughput, compute cols/rows that keep each row within belt capacity
// // and balance rows evenly (e.g. 2×2 not 3×1 for 4 machines).
// // No hard cap on columns — belt throughput is the sole constraint.
// function calcColsRows(
//   count: number,
//   capacityPerMachine: number,
//   beltThroughput: number,
// ): { cols: number; rows: number; maxPerBelt: number } {
//   // How many machines one belt can serve before saturation
//   const maxPerBelt  = capacityPerMachine > 0 ? Math.floor(beltThroughput / capacityPerMachine) : count;
//   const perRow      = Math.max(1, maxPerBelt);
//   const minRows     = Math.ceil(count / perRow);
//   const cols        = Math.ceil(count / minRows);
//   const rows        = Math.ceil(count / cols);
//   return { cols, rows, maxPerBelt };
// }
//
// // ── Belt layout templates ─────────────────────────────────────────────────────
// //
// // Each template defines how many horizontal belt lanes sit above the machine
// // (inputs) and below (outputs).  topPad = inputs, botPad = outputs, so that
// // each arm length equals its lane number from the machine: arm 1 = 1 tile,
// // arm 2 = 2 tiles, arm 3 = 3 tiles (maximum).
// // innerGap = inputs + outputs so consecutive machine rows share the belt space.
//
// interface BeltLayout { inputs: number; outputs: number; }
//
// const BELT_LAYOUTS: Record<string, BeltLayout> = {
//   in1_out1: { inputs: 1, outputs: 1 },
//   in2_out1: { inputs: 2, outputs: 1 },
//   in3_out1: { inputs: 3, outputs: 1 },
//   in4_out1: { inputs: 4, outputs: 1 },
//   in5_out1: { inputs: 5, outputs: 1 },
//   in6_out1: { inputs: 6, outputs: 1 },
//   in1_out2: { inputs: 1, outputs: 2 },
//   in2_out2: { inputs: 2, outputs: 2 },
//   in3_out2: { inputs: 3, outputs: 2 },
//   in4_out2: { inputs: 4, outputs: 2 },
//   in5_out2: { inputs: 5, outputs: 2 },
//   in6_out2: { inputs: 6, outputs: 2 },
// };
//
// const DEFAULT_LAYOUT: BeltLayout = BELT_LAYOUTS.in1_out1;
//
// // ── Data model ────────────────────────────────────────────────────────────────
//
// interface LGroup {
//   id: string;
//   itemId: string;
//   machineId: string;
//   tierId: string;
//   count: number;
//   exactCount: number;
//   rate: number;
//   level: number;
//   isRaw: boolean;
// }
//
// interface LEdge {
//   fromId: string;
//   toId: string;
//   itemId: string;
//   rate: number;
// }
//
// // ── Machine colours ───────────────────────────────────────────────────────────
//
// const MACHINE_BG: Record<string, string> = {
//   assembler: '#0b1f3a', smelter: '#331007', chemical: '#082a13',
//   refinery: '#281c07',  lab: '#160830',     collider: '#330823',
//   mining: '#0d1a0d',    raw: '#0a120a',
// };
// const MACHINE_BORDER: Record<string, string> = {
//   assembler: '#1d5490', smelter: '#903015',  chemical: '#0d9438',
//   refinery: '#94681a',  lab: '#4818c0',      collider: '#b41c62',
//   mining: '#2c4c28',    raw: '#1c401c',
// };
//
// // ── Tree → groups + edges ─────────────────────────────────────────────────────
//
// function buildFromTree(tree: TreeNode): { groups: LGroup[]; edges: LEdge[] } {
//   const groups: LGroup[] = [];
//   const edges: LEdge[]   = [];
//
//   function walk(node: TreeNode, parentId: string | null) {
//     if (node.oilOptimised || node.cyclic) return;
//     const isRaw = !node.recipe;
//     groups.push({
//       id: node.path,
//       itemId: node.itemId,
//       machineId: isRaw ? 'raw' : (node.machine ?? ''),
//       tierId: node.tierId ?? '',
//       count: isRaw ? 1 : Math.max(1, Math.ceil(node.machines - 1e-9)),
//       exactCount: node.machines,
//       rate: node.rate,
//       level: 0,
//       isRaw,
//     });
//     if (parentId)
//       edges.push({ fromId: node.path, toId: parentId, itemId: node.itemId, rate: node.rate });
//     node.children.forEach(c => walk(c, node.path));
//   }
//
//   walk(tree, null);
//
//   // Topological level = longest path from leaves (raw = 0, root = max)
//   const ids   = new Set(groups.map(g => g.id));
//   const cache = new Map<string, number>();
//   function level(id: string): number {
//     if (cache.has(id)) return cache.get(id)!;
//     const preds = edges.filter(e => e.toId === id && ids.has(e.fromId)).map(e => e.fromId);
//     const lv    = preds.length === 0 ? 0 : Math.max(...preds.map(level)) + 1;
//     cache.set(id, lv);
//     return lv;
//   }
//   groups.forEach(g => { g.level = level(g.id); });
//   return { groups, edges };
// }
//
// // ── Group merging ─────────────────────────────────────────────────────────────
//
// /**
//  * Merge groups that produce the same item with the same machine tier.
//  * Summed count/rate; edges are remapped and deduplicated (rates summed).
//  * Self-loops produced by the remapping are dropped.
//  */
// function mergeGroups(
//   groups: LGroup[],
//   edges:  LEdge[],
// ): { groups: LGroup[]; edges: LEdge[] } {
//   const keyOf  = (g: LGroup) => `${g.itemId}|${g.machineId}|${g.tierId}`;
//   const repMap = new Map<string, LGroup>();
//
//   groups.forEach(g => {
//     const k = keyOf(g);
//     if (!repMap.has(k)) {
//       repMap.set(k, { ...g });
//     } else {
//       const r = repMap.get(k)!;
//       r.count      += g.count;
//       r.exactCount += g.exactCount;
//       r.rate       += g.rate;
//     }
//   });
//
//   // Map every old id → representative id
//   const idRemap = new Map<string, string>();
//   groups.forEach(g => idRemap.set(g.id, repMap.get(keyOf(g))!.id));
//
//   // Remap and deduplicate edges (merge parallel edges by summing rate)
//   const edgeMap = new Map<string, LEdge>();
//   edges.forEach(e => {
//     const from = idRemap.get(e.fromId) ?? e.fromId;
//     const to   = idRemap.get(e.toId)   ?? e.toId;
//     if (from === to) return; // drop self-loops
//     const k = `${from}|${to}|${e.itemId}`;
//     if (edgeMap.has(k)) {
//       edgeMap.get(k)!.rate += e.rate;
//     } else {
//       edgeMap.set(k, { fromId: from, toId: to, itemId: e.itemId, rate: e.rate });
//     }
//   });
//
//   return { groups: Array.from(repMap.values()), edges: Array.from(edgeMap.values()) };
// }
//
// // ── Layout computation ────────────────────────────────────────────────────────
//
// function computeLayout(
//   groups: LGroup[],
//   edges: LEdge[],
//   specs: Map<string, LayoutMachineSpec>,
//   overrides: Record<string, { tileX: number; tileY: number }>,
//   beltThroughput: number,
// ): { tileGroups: TileGroup[]; belts: TileBelt[] } {
//
//   const byLevel = new Map<number, LGroup[]>();
//   groups.forEach(g => {
//     if (!byLevel.has(g.level)) byLevel.set(g.level, []);
//     byLevel.get(g.level)!.push(g);
//   });
//   const maxLevel = groups.reduce((m, g) => Math.max(m, g.level), 0);
//
//   // Collect actual input items per group in edge order (recipe-specific)
//   const actualInItems = new Map<string, string[]>();
//   edges.forEach(e => {
//     if (!actualInItems.has(e.toId)) actualInItems.set(e.toId, []);
//     actualInItems.get(e.toId)!.push(e.itemId);
//   });
//
//   // ── Pass 1: per-group footprint metrics ──────────────────────────────────
//   // Column widths and final placement must agree on the same margins, so the
//   // sizing maths lives here once rather than being repeated per call site.
//   interface Metrics {
//     mW: number; mH: number; ba: string;
//     cols: number; rows: number; maxPerBelt: number; capacityPerMachine: number;
//     topIb: number; botIb: number; ob: number;
//     tp: number; bp: number; ig: number;
//     leftExt: number; rightExt: number;
//     totalW: number; totalH: number;
//     count: number;
//     inputItems: string[];
//   }
//
//   const metrics = new Map<string, Metrics>();
//   groups.forEach(g => {
//     const spec   = specs.get(g.machineId);
//     const mW     = spec?.tileW ?? 3;
//     const mH     = spec?.tileH ?? 3;
//     const ba     = spec?.beltAccess ?? 'sorter';
//     const layout = spec?.layoutId ? (BELT_LAYOUTS[spec.layoutId] ?? DEFAULT_LAYOUT) : DEFAULT_LAYOUT;
//     // Use actual recipe inputs, capped by machine's layout capacity
//     const allInputItems = actualInItems.get(g.id) ?? [];
//     const totalIn = ba === 'direct' ? 0 : Math.min(allInputItems.length, layout.inputs);
//     const ob      = ba === 'direct' ? 0 : layout.outputs;
//     // Split inputs across top and bottom so no arm exceeds MAX_ARM_TILES (3).
//     // Outputs sit closest to machine on the bottom (depth 1..ob).
//     // Overflow inputs go below outputs (depth ob+1..), capped so botPad ≤ MAX_ARM_TILES.
//     const topIb  = Math.min(totalIn, MAX_ARM_TILES);
//     const botIb  = Math.min(Math.max(0, totalIn - MAX_ARM_TILES), Math.max(0, MAX_ARM_TILES - ob));
//     const tp     = topIb;
//     const bp     = ob + botIb;
//     const ig     = tp + bp;
//     const count  = Math.max(1, g.count);
//     const capacityPerMachine = g.exactCount > 0 ? g.rate / g.exactCount : 0;
//     const { cols, rows, maxPerBelt } = calcColsRows(count, capacityPerMachine, beltThroughput);
//     // Each belt lane needs its own spine column in the side margin when the
//     // group spans multiple rows — sharing a column would put two buildings in
//     // one tile. Inputs (including bottom overflow) split left, outputs right.
//     const leftExt  = Math.max(1, topIb + botIb);
//     const rightExt = Math.max(1, ob);
//     const totalW = leftExt + cols * mW + rightExt;
//     const totalH = tp + rows * mH + Math.max(0, rows - 1) * ig + bp;
//
//     metrics.set(g.id, {
//       mW, mH, ba, cols, rows, maxPerBelt, capacityPerMachine,
//       topIb, botIb, ob, tp, bp, ig, leftExt, rightExt, totalW, totalH, count,
//       inputItems: allInputItems.slice(0, topIb + botIb),
//     });
//   });
//
//   // Column widths (widest group in each level)
//   const colW: number[] = [];
//   for (let l = 0; l <= maxLevel; l++) {
//     let maxW = 0;
//     (byLevel.get(l) ?? []).forEach(g => {
//       const w = metrics.get(g.id)!.totalW;
//       if (w > maxW) maxW = w;
//     });
//     colW[l] = maxW;
//   }
//
//   // Column x starts
//   const colX: number[] = [];
//   let cx = 3;
//   for (let l = 0; l <= maxLevel; l++) {
//     colX[l] = cx;
//     cx += colW[l] + STAGE_GAP;
//   }
//
//   // ── Pass 2: placement ────────────────────────────────────────────────────
//   const tileGroups: TileGroup[] = [];
//   const levelY = new Map<number, number>();
//   for (let l = 0; l <= maxLevel; l++) levelY.set(l, 3);
//
//   groups.forEach(g => {
//     const m = metrics.get(g.id)!;
//
//     const autoX = colX[g.level];
//     const autoY = levelY.get(g.level) ?? 3;
//     levelY.set(g.level, autoY + m.totalH + GROUP_GAP);
//
//     const ov    = overrides[g.id];
//     const tileX = ov?.tileX ?? autoX;
//     const tileY = ov?.tileY ?? autoY;
//
//     // Input enters from left of the topmost input belt (tileY + 0)
//     // Output exits from right of the bottommost output belt (tileY + totalH - 1)
//     const inX  = tileX;
//     const inY  = tileY + 0.5;
//     const outX = tileX + m.totalW;
//     const outY = tileY + m.totalH - 0.5;
//
//     tileGroups.push({
//       id: g.id, itemId: g.itemId, machineId: g.machineId, tierId: g.tierId,
//       level: g.level, count: m.count, rate: g.rate,
//       capacityPerMachine: m.capacityPerMachine, maxPerBelt: m.maxPerBelt, isRaw: g.isRaw,
//       mW: m.mW, mH: m.mH, cols: m.cols, rows: m.rows,
//       tileX, tileY, totalW: m.totalW, totalH: m.totalH,
//       topInputBelts: m.topIb, outputBelts: m.ob, bottomInputBelts: m.botIb,
//       topPad: m.tp, botPad: m.bp, innerGap: m.ig,
//       leftExt: m.leftExt, rightExt: m.rightExt, beltAccess: m.ba,
//       inputItems: m.inputItems,
//       outX, outY, inX, inY,
//     });
//   });
//
//   const byId = new Map(tileGroups.map(g => [g.id, g]));
//
//   // Belt paths between groups.
//   //
//   // Adjacent-level routes (from.level + 1 === to.level): simple L-shape with the
//   // vertical leg in the stage gap between those two columns. Routes are spread
//   // evenly so no two vertical legs share the same X.
//   //
//   // Level-skipping routes (to.level > from.level + 1): routing the vertical leg
//   // across the full span would land it inside an intermediate column. Instead these
//   // routes exit through the source's own stage gap (same pool as adjacent routes from
//   // that level) and then run along a dedicated horizontal "highway" lane above all
//   // tile content (y < 3) to reach the destination column, where they drop to the
//   // correct input lane. Each long-range route gets its own highway Y to avoid
//   // horizontal overlap.
//
//   // Count all routes that leave each level so we can allocate unique X slots in
//   // the source level's stage gap.
//   const fromLevelCount = new Map<number, number>();
//   const fromLevelIdx   = new Map<number, number>();
//   let   hwLaneCount    = 0;                         // sequential index for highway lanes
//   const hwLaneOf       = new Map<string, number>(); // edge key → highway lane index
//
//   edges.forEach(e => {
//     const f = byId.get(e.fromId); const t = byId.get(e.toId);
//     if (!f || !t) return;
//     fromLevelCount.set(f.level, (fromLevelCount.get(f.level) ?? 0) + 1);
//     if (t.level > f.level + 1) {
//       hwLaneOf.set(`${e.fromId}|${e.toId}|${e.itemId}`, hwLaneCount++);
//     }
//   });
//
//   const belts: TileBelt[] = edges.flatMap(e => {
//     const from = byId.get(e.fromId);
//     const to   = byId.get(e.toId);
//     if (!from || !to) return [];
//
//     const x1 = from.outX;  const y1 = from.outY;
//
//     // Determine the Y of the specific input lane this item feeds
//     const laneIdx = to.inputItems.indexOf(e.itemId);
//     let y4: number;
//     if (laneIdx >= 0 && laneIdx < to.topInputBelts) {
//       y4 = to.tileY + to.topInputBelts - laneIdx - 1 + 0.5;
//     } else if (laneIdx >= to.topInputBelts) {
//       const k2 = laneIdx - to.topInputBelts;
//       y4 = to.tileY + to.topPad + to.mH + to.outputBelts + k2 + 0.5;
//     } else {
//       y4 = to.inY;
//     }
//     const x4 = to.inX;
//
//     // Vertical leg is always placed in the stage gap immediately after the source column.
//     // All routes leaving the same level share this gap and get unique X slots.
//     const gapLeft = colX[from.level] + colW[from.level];
//     const idx = fromLevelIdx.get(from.level) ?? 0;
//     fromLevelIdx.set(from.level, idx + 1);
//     const cnt  = fromLevelCount.get(from.level) ?? 1;
//     const midX = gapLeft + ((idx + 0.5) / cnt) * STAGE_GAP;
//
//     if (to.level === from.level + 1) {
//       // Adjacent-level: simple L-shape
//       return [{
//         fromId: e.fromId, toId: e.toId, itemId: e.itemId, rate: e.rate,
//         pts: [{ x: x1, y: y1 }, { x: midX, y: y1 }, { x: midX, y: y4 }, { x: x4, y: y4 }],
//       }];
//     }
//
//     // Level-skipping: Z-shape via a highway lane above all tile content.
//     // All groups start at tileY ≥ 3, so y = 0..2.5 is always free.
//     // Each long-range route gets its own Y lane spaced 0.5 tiles apart.
//     const hwIdx = hwLaneOf.get(`${e.fromId}|${e.toId}|${e.itemId}`) ?? 0;
//     const hwy   = 2.5 - hwIdx * 0.5;
//     return [{
//       fromId: e.fromId, toId: e.toId, itemId: e.itemId, rate: e.rate,
//       pts: [
//         { x: x1,   y: y1  },   // source output
//         { x: midX, y: y1  },   // into source's stage gap
//         { x: midX, y: hwy },   // up to highway lane
//         { x: x4,   y: hwy },   // across to destination column
//         { x: x4,   y: y4  },   // down to destination input lane
//       ],
//     }];
//   });
//
//   return { tileGroups, belts };
// }
//
// // ── Belt lane annotation helpers ─────────────────────────────────────────────
//
// /** Icon in the left sideExt tile + item name right-aligned just outside the left belt edge. */
// function annotateInputBelt(
//   ctx: CanvasRenderingContext2D,
//   gameData: GameData,
//   itemId: string | undefined,
//   beltLeft: number, beltTop: number,
//   ts: number,
//   onNeedLoad: (url: string) => void,
// ) {
//   if (!itemId || ts < 10) return;
//   const item = gameData.itemById[itemId];
//   if (!item) return;
//
//   const iconSz = ts * 0.72;
//   const iOff   = (ts - iconSz) / 2;
//
//   // Icon in left sideExt tile
//   if (item.spriteId !== undefined) {
//     tryDrawSprite(ctx, gameData.iconNamespace, item.spriteId,
//       beltLeft + iOff, beltTop + iOff, iconSz, iconSz, onNeedLoad);
//   } else {
//     ctx.font         = `${iconSz * 0.85}px system-ui,sans-serif`;
//     ctx.fillStyle    = 'rgba(200,220,255,0.9)';
//     ctx.textAlign    = 'center';
//     ctx.textBaseline = 'middle';
//     ctx.fillText(item.icon ?? '?', beltLeft + ts / 2, beltTop + ts / 2);
//   }
//
//   // Item name right-aligned just to the LEFT of the belt lane
//   if (ts >= 12) {
//     const fs = Math.max(8, Math.min(11, ts * 0.48));
//     ctx.font         = `${fs}px system-ui,sans-serif`;
//     ctx.fillStyle    = 'rgba(160,190,230,0.88)';
//     ctx.textAlign    = 'right';
//     ctx.textBaseline = 'middle';
//     ctx.fillText(item.name ?? itemId, beltLeft - 3, beltTop + ts / 2);
//   }
//
//   ctx.textAlign    = 'left';
//   ctx.textBaseline = 'alphabetic';
// }
//
// /** Icon drawn in the last tile of an output belt lane (items exit right). */
// function annotateOutputBelt(
//   ctx: CanvasRenderingContext2D,
//   gameData: GameData,
//   itemId: string | undefined,
//   beltLeft: number, beltTop: number,
//   ts: number,
//   onNeedLoad: (url: string) => void,
// ) {
//   if (!itemId || ts < 10) return;
//   const item = gameData.itemById[itemId];
//   if (!item) return;
//
//   const iconSz = ts * 0.72;
//   const iOff   = (ts - iconSz) / 2;
//
//   if (item.spriteId !== undefined) {
//     tryDrawSprite(ctx, gameData.iconNamespace, item.spriteId,
//       beltLeft + iOff, beltTop + iOff, iconSz, iconSz, onNeedLoad);
//   } else {
//     ctx.font         = `${iconSz * 0.85}px system-ui,sans-serif`;
//     ctx.fillStyle    = 'rgba(200,220,255,0.9)';
//     ctx.textAlign    = 'center';
//     ctx.textBaseline = 'middle';
//     ctx.fillText(item.icon ?? '?', beltLeft + ts / 2, beltTop + ts / 2);
//   }
//
//   ctx.textAlign    = 'left';
//   ctx.textBaseline = 'alphabetic';
// }
//
// // ── Entity rendering ──────────────────────────────────────────────────────────
//
// /**
//  * Draw the tile-discrete entities inside every group: belt lanes, sorter arms,
//  * and the vertical split/merge spines.
//  *
//  * All geometry comes from buildEntities() so the canvas and the blueprint
//  * exporter cannot disagree about where anything sits. This function only knows
//  * how to paint a cell.
//  */
// function drawEntities(
//   ctx: CanvasRenderingContext2D,
//   entities: PlacedEntity[],
//   gameData: GameData,
//   vx: number, vy: number, ts: number,
//   onNeedLoad: (url: string) => void,
// ) {
//   const laneFill    = 'rgba(20, 40, 90, 0.72)';
//   const laneStroke  = 'rgba(50, 90, 180, 0.5)';
//   const armFill     = 'rgba(10, 50, 20, 0.7)';
//   const armStroke   = '#2fb34a';
//   const spineFill   = 'rgba(15, 55, 120, 0.96)';
//   const spineStroke = 'rgba(50, 180, 220, 0.85)';
//   const iconFill    = 'rgba(10, 45, 100, 1)';
//   const iconStroke  = '#38d4f0';
//
//   // Belt tiles first so arms and splitters paint over them.
//   ctx.fillStyle = laneFill; ctx.strokeStyle = laneStroke; ctx.lineWidth = 1;
//   entities.forEach(e => {
//     if (e.kind !== 'belt') return;
//     const px = tp(e.x, vx, ts);
//     const py = tp(e.y, vy, ts);
//     ctx.fillRect(px, py, ts, ts);
//     ctx.strokeRect(px, py, ts, ts);
//   });
//
//   // Spine tiles use a brighter border so they read as vertical distribution.
//   ctx.fillStyle = spineFill; ctx.strokeStyle = spineStroke; ctx.lineWidth = 1.5;
//   entities.forEach(e => {
//     if (e.kind !== 'splitter') return;
//     const px = tp(e.x, vx, ts);
//     const py = tp(e.y, vy, ts);
//     ctx.fillRect(px, py, ts, ts);
//     ctx.strokeRect(px, py, ts, ts);
//   });
//
//   if (ts >= 10) {
//     // Sorter arms — drawn from the belt tile toward the machine.
//     ctx.fillStyle = armFill; ctx.strokeStyle = armStroke; ctx.lineWidth = 1.5;
//     entities.forEach(e => {
//       if (e.kind !== 'sorter') return;
//       const len  = e.armLen ?? 1;
//       const px   = tp(e.x, vx, ts);
//       // dir 2 (S) reaches downward from this tile; dir 0 (N) reaches upward.
//       const py   = e.dir === 0
//         ? tp(e.y - len + 1, vy, ts)
//         : tp(e.y, vy, ts);
//       rRect(ctx, px, py, ts, len * ts, ts * 0.25);
//       ctx.fill(); ctx.stroke();
//     });
//
//     // Splitter/merger markers.
//     entities.forEach(e => {
//       if (e.kind !== 'splitter') return;
//       const px  = tp(e.x, vx, ts);
//       const py  = tp(e.y, vy, ts);
//       const pad = ts * 0.1;
//       ctx.fillStyle   = iconFill;
//       ctx.strokeStyle = iconStroke;
//       ctx.lineWidth   = 1.5;
//       rRect(ctx, px + pad, py + pad, ts - 2 * pad, ts - 2 * pad, ts * 0.28);
//       ctx.fill(); ctx.stroke();
//       if (ts >= 12) {
//         ctx.font         = `bold ${Math.max(8, Math.floor(ts * 0.52))}px system-ui,sans-serif`;
//         ctx.fillStyle    = '#a0e8ff';
//         ctx.textAlign    = 'center';
//         ctx.textBaseline = 'middle';
//         ctx.fillText('⊕', px + ts / 2, py + ts / 2);
//         ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
//       }
//     });
//   }
//
//   // Lane labels last so nothing paints over them.
//   entities.forEach(e => {
//     if (e.kind !== 'belt' || !e.annotate) return;
//     const px = tp(e.x, vx, ts);
//     const py = tp(e.y, vy, ts);
//     if (e.annotate === 'in') annotateInputBelt(ctx, gameData, e.itemId, px, py, ts, onNeedLoad);
//     else                     annotateOutputBelt(ctx, gameData, e.itemId, px, py, ts, onNeedLoad);
//   });
// }
//
// // ── Canvas drawing ─────────────────────────────────────────────────────────────
//
// function tp(tile: number, vOff: number, ts: number) { return tile * ts + vOff; }
//
// function rRect(
//   ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
// ) {
//   const cr = Math.min(r, w / 2, h / 2);
//   ctx.beginPath();
//   ctx.moveTo(x + cr, y);
//   ctx.arcTo(x + w, y,     x + w, y + h, cr);
//   ctx.arcTo(x + w, y + h, x,     y + h, cr);
//   ctx.arcTo(x,     y + h, x,     y,     cr);
//   ctx.arcTo(x,     y,     x + w, y,     cr);
//   ctx.closePath();
// }
//
// function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, vx: number, vy: number, ts: number) {
//   ctx.strokeStyle = 'rgba(255,255,255,0.03)';
//   ctx.lineWidth   = 1;
//   const ox = ((vx % ts) + ts) % ts;
//   const oy = ((vy % ts) + ts) % ts;
//   for (let x = ox; x < w; x += ts) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
//   for (let y = oy; y < h; y += ts) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
// }
//
// function drawBelts(ctx: CanvasRenderingContext2D, belts: TileBelt[], vx: number, vy: number, ts: number) {
//   const bw = Math.max(2, ts * BELT_W_FRAC);
//   ctx.lineCap   = 'round';
//   ctx.lineJoin  = 'round';
//
//   belts.forEach(b => {
//     if (b.pts.length < 2) return;
//     ctx.strokeStyle = 'rgba(70,130,210,0.55)';
//     ctx.lineWidth   = bw;
//     ctx.beginPath();
//     ctx.moveTo(tp(b.pts[0].x, vx, ts), tp(b.pts[0].y, vy, ts));
//     for (let i = 1; i < b.pts.length; i++)
//       ctx.lineTo(tp(b.pts[i].x, vx, ts), tp(b.pts[i].y, vy, ts));
//     ctx.stroke();
//
//     // Arrowhead
//     const L = b.pts[b.pts.length - 1];
//     const P = b.pts[b.pts.length - 2];
//     const ang = Math.atan2(L.y - P.y, L.x - P.x);
//     const lx = tp(L.x, vx, ts); const ly = tp(L.y, vy, ts);
//     const as = Math.max(5, ts * 0.55);
//     ctx.fillStyle = 'rgba(70,130,210,0.9)';
//     ctx.beginPath();
//     ctx.moveTo(lx, ly);
//     ctx.lineTo(lx - as * Math.cos(ang - 0.42), ly - as * Math.sin(ang - 0.42));
//     ctx.lineTo(lx - as * Math.cos(ang + 0.42), ly - as * Math.sin(ang + 0.42));
//     ctx.closePath();
//     ctx.fill();
//   });
//   ctx.lineCap  = 'butt';
//   ctx.lineJoin = 'miter';
// }
//
// function drawMachines(
//   ctx: CanvasRenderingContext2D,
//   entities: PlacedEntity[],
//   gameData: GameData,
//   selectedGroupId: string | null,
//   vx: number, vy: number, ts: number,
//   onNeedLoad: (url: string) => void,
// ) {
//   entities.forEach(m => {
//     if (m.kind !== 'machine') return;
//     const g = { machineId: m.machineId ?? '', itemId: m.itemId ?? '' };
//     const px = tp(m.x, vx, ts);
//     const py = tp(m.y, vy, ts);
//     const pw = m.w * ts;
//     const ph = m.h * ts;
//     const sel = m.groupId === selectedGroupId;
//
//     ctx.fillStyle   = MACHINE_BG[g.machineId]     ?? '#111828';
//     ctx.strokeStyle = sel ? '#80b8ff' : (MACHINE_BORDER[g.machineId] ?? '#304066');
//     ctx.lineWidth   = sel ? 2 : 1;
//     rRect(ctx, px, py, pw, ph, Math.min(4, ts * 0.18));
//     ctx.fill(); ctx.stroke();
//
//     // Connection nubs on left and right edges
//     ctx.fillStyle = MACHINE_BORDER[g.machineId] ?? '#304066';
//     ctx.beginPath(); ctx.arc(px,      py + ph / 2, Math.max(2, ts * 0.18), 0, Math.PI * 2); ctx.fill();
//     ctx.beginPath(); ctx.arc(px + pw, py + ph / 2, Math.max(2, ts * 0.18), 0, Math.PI * 2); ctx.fill();
//
//     if (ts >= 12) {
//       const item    = gameData.itemById[g.itemId];
//       const iconSz  = Math.min(pw, ph) * 0.72;
//       const iconX   = px + (pw - iconSz) / 2;
//       const iconY   = py + (ph - iconSz) / 2;
//       const drawn   = item?.spriteId !== undefined
//         && tryDrawSprite(ctx, gameData.iconNamespace, item.spriteId, iconX, iconY, iconSz, iconSz, onNeedLoad);
//       if (!drawn) {
//         ctx.font         = `${iconSz * 0.55}px system-ui,sans-serif`;
//         ctx.fillStyle    = 'rgba(190,210,240,0.75)';
//         ctx.textAlign    = 'center';
//         ctx.textBaseline = 'middle';
//         ctx.fillText(item?.icon ?? '?', px + pw / 2, py + ph / 2);
//         ctx.textAlign    = 'left';
//         ctx.textBaseline = 'alphabetic';
//       }
//     }
//   });
// }
//
// function drawRawNodes(
//   ctx: CanvasRenderingContext2D,
//   entities: PlacedEntity[],
//   gameData: GameData,
//   selectedGroupId: string | null,
//   vx: number, vy: number, ts: number,
//   onNeedLoad: (url: string) => void,
// ) {
//   entities.forEach(g => {
//     if (g.kind !== 'raw') return;
//     const px = tp(g.x, vx, ts);
//     const py = tp(g.y, vy, ts);
//     const pw = g.w * ts;
//     const ph = g.h * ts;
//     const sel = g.groupId === selectedGroupId;
//
//     ctx.fillStyle   = '#090e09';
//     ctx.strokeStyle = sel ? '#80b8ff' : '#1a3a1a';
//     ctx.lineWidth   = sel ? 2 : 1;
//     ctx.setLineDash([Math.max(3, ts * 0.25), Math.max(3, ts * 0.25)]);
//     rRect(ctx, px, py, pw, ph, 4); ctx.fill(); ctx.stroke();
//     ctx.setLineDash([]);
//
//     // Nub on right (output only)
//     ctx.fillStyle = '#1a3a1a';
//     ctx.beginPath(); ctx.arc(px + pw, py + ph / 2, Math.max(2, ts * 0.18), 0, Math.PI * 2); ctx.fill();
//
//     if (ts >= 12) {
//       const item   = gameData.itemById[g.itemId ?? ''];
//       const iconSz = Math.min(pw, ph) * 0.55;
//       const iconX  = px + (pw - iconSz) / 2;
//       const iconY  = py + (ph - iconSz) / 2;
//       const drawn  = item?.spriteId !== undefined
//         && tryDrawSprite(ctx, gameData.iconNamespace, item.spriteId, iconX, iconY, iconSz, iconSz, onNeedLoad);
//       if (!drawn) {
//         const fs = Math.max(9, Math.min(pw * 0.28, 13));
//         ctx.font         = `${fs}px system-ui,sans-serif`;
//         ctx.fillStyle    = '#2a5a2a';
//         ctx.textAlign    = 'center';
//         ctx.textBaseline = 'middle';
//         ctx.fillText(`${item?.icon ?? '?'} ${item?.name ?? g.itemId}`, px + pw / 2, py + ph / 2, pw - 6);
//         ctx.textAlign    = 'left';
//         ctx.textBaseline = 'alphabetic';
//       }
//     }
//   });
// }
//
// function drawLabels(
//   ctx: CanvasRenderingContext2D,
//   tileGroups: TileGroup[],
//   gameData: GameData,
//   vx: number, vy: number, ts: number,
// ) {
//   if (ts < 10) return;
//   ctx.textAlign    = 'center';
//   ctx.textBaseline = 'bottom';
//   tileGroups.filter(g => !g.isRaw).forEach(g => {
//     const px  = tp(g.tileX, vx, ts);
//     const py  = tp(g.tileY, vy, ts);
//     const pw  = g.totalW * ts;
//     const fs  = Math.min(11, ts * 0.52);
//     const item  = gameData.itemById[g.itemId];
//     const tier  = gameData.machineTiers[g.machineId]?.find(t => t.id === g.tierId);
//     const mName = tier?.label ?? gameData.machines[g.machineId]?.name ?? g.machineId;
//
//     ctx.font      = `bold ${fs}px system-ui,sans-serif`;
//     ctx.fillStyle = 'rgba(180,200,235,0.88)';
//     ctx.fillText(`${item?.name ?? g.itemId}`, px + pw / 2, py - fs - 2, pw);
//
//     ctx.font      = `${fs * 0.88}px system-ui,sans-serif`;
//     ctx.fillStyle = 'rgba(100,130,170,0.75)';
//     ctx.fillText(`×${g.count} ${mName} · ${g.rate.toFixed(2)}/min`, px + pw / 2, py - 2, pw);
//   });
//   ctx.textAlign    = 'left';
//   ctx.textBaseline = 'alphabetic';
// }
//
// // ── Component ─────────────────────────────────────────────────────────────────
//
// interface Props { trees: TreeNode[]; gameData: GameData; }
//
// type Drag =
//   | { kind: 'group'; id: string; sx: number; sy: number; ox: number; oy: number }
//   | { kind: 'pan';   sx: number; sy: number; ovx: number; ovy: number };
//
// export function LayoutPlanner({ trees, gameData }: Props) {
//   const canvasRef    = useRef<HTMLCanvasElement>(null);
//   const containerRef = useRef<HTMLDivElement>(null);
//
//   const [size,       setSize]       = useState({ w: 800, h: 600 });
//   const [viewport,   setViewport]   = useState({ x: 0, y: 0 });
//   const [tileSize,   setTileSize]   = useState(DEFAULT_TILE_SIZE);
//   const [beltTierId, setBeltTierId] = useState(() => gameData.beltTiers[0]?.id ?? '');
//   const [beltUtil,   setBeltUtil]   = useState(1.0);
//   const [selectedId, setSelectedId] = useState<string | null>(null);
//   const [overrides,  setOverrides]  = useState<Record<string, { tileX: number; tileY: number }>>({});
//   const [drag,       setDrag]       = useState<Drag | null>(null);
//   const [, setImgTick]              = useState(0);
//
//   // Called when a sprite image is needed but not yet loaded; triggers load + re-render on completion.
//   const onNeedLoad = useCallback((url: string) => {
//     loadSpriteImage(url, () => setImgTick(t => t + 1));
//   }, []);
//
//   const specs = useMemo(() => {
//     const m = new Map<string, LayoutMachineSpec>();
//     gameData.features.layoutMachines?.forEach(s => m.set(s.machineId, s));
//     return m;
//   }, [gameData]);
//
//   const beltThroughput = useMemo(
//     () => (gameData.beltTiers.find(b => b.id === beltTierId)?.speed
//         ?? gameData.beltTiers[0]?.speed
//         ?? Infinity) * beltUtil,
//     [gameData, beltTierId, beltUtil],
//   );
//
//   const { groups, edges }       = useMemo(() => {
//     const allGroups: LGroup[] = [];
//     const allEdges:  LEdge[]  = [];
//     trees.forEach(tree => {
//       const raw = buildFromTree(tree);
//       allGroups.push(...raw.groups);
//       allEdges.push(...raw.edges);
//     });
//     return mergeGroups(allGroups, allEdges);
//   }, [trees]);
//   const { tileGroups, belts }   = useMemo(
//     () => computeLayout(groups, edges, specs, overrides, beltThroughput),
//     [groups, edges, specs, overrides, beltThroughput],
//   );
//   const entities = useMemo(() => buildEntities(tileGroups), [tileGroups]);
//   const machineCount = useMemo(
//     () => entities.reduce((n, e) => n + (e.kind === 'machine' ? 1 : 0), 0),
//     [entities],
//   );
//
//   // Resize
//   useEffect(() => {
//     const el = containerRef.current;
//     if (!el) return;
//     const ro = new ResizeObserver(([e]) => {
//       const { width, height } = e.contentRect;
//       setSize({ w: Math.max(1, Math.floor(width)), h: Math.max(1, Math.floor(height)) });
//     });
//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);
//
//   // Render
//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;
//     const { w, h } = size;
//     canvas.width = w; canvas.height = h;
//     ctx.fillStyle = '#090912'; ctx.fillRect(0, 0, w, h);
//     const { x: vx, y: vy } = viewport;
//     drawGrid(ctx, w, h, vx, vy, tileSize);
//     drawEntities(ctx, entities, gameData, vx, vy, tileSize, onNeedLoad);
//     drawBelts(ctx, belts, vx, vy, tileSize);
//     drawMachines(ctx, entities, gameData, selectedId, vx, vy, tileSize, onNeedLoad);
//     drawRawNodes(ctx, entities, gameData, selectedId, vx, vy, tileSize, onNeedLoad);
//     drawLabels(ctx, tileGroups, gameData, vx, vy, tileSize);
//   }, [tileGroups, entities, belts, selectedId, viewport, tileSize, gameData, size, onNeedLoad]);
//
//   // Pointer down
//   const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const rect = canvas.getBoundingClientRect();
//     const cx   = e.clientX - rect.left;
//     const cy   = e.clientY - rect.top;
//
//     let hit: TileGroup | null = null;
//     for (let i = tileGroups.length - 1; i >= 0; i--) {
//       const g  = tileGroups[i];
//       const gx = g.tileX * tileSize + viewport.x;
//       const gy = g.tileY * tileSize + viewport.y;
//       if (cx >= gx && cx <= gx + g.totalW * tileSize &&
//           cy >= gy && cy <= gy + g.totalH * tileSize) { hit = g; break; }
//     }
//
//     if (hit) {
//       setSelectedId(hit.id);
//       setDrag({ kind: 'group', id: hit.id, sx: cx, sy: cy, ox: hit.tileX, oy: hit.tileY });
//     } else {
//       setSelectedId(null);
//       setDrag({ kind: 'pan', sx: cx, sy: cy, ovx: viewport.x, ovy: viewport.y });
//     }
//     canvas.setPointerCapture(e.pointerId);
//   }, [tileGroups, viewport, tileSize]);
//
//   const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
//     if (!drag) return;
//     const rect = canvasRef.current?.getBoundingClientRect();
//     if (!rect) return;
//     const cx = e.clientX - rect.left;
//     const cy = e.clientY - rect.top;
//     const dx = cx - drag.sx;
//     const dy = cy - drag.sy;
//
//     if (drag.kind === 'pan') {
//       setViewport({ x: drag.ovx + dx, y: drag.ovy + dy });
//     } else {
//       // Snap to tile grid
//       const nx = drag.ox + Math.round(dx / tileSize);
//       const ny = drag.oy + Math.round(dy / tileSize);
//       setOverrides(p => ({ ...p, [drag.id]: { tileX: nx, tileY: ny } }));
//     }
//   }, [drag, tileSize]);
//
//   const onPointerUp   = useCallback(() => setDrag(null), []);
//
//   const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
//     e.preventDefault();
//     setTileSize(prev => {
//       const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
//       return Math.max(8, Math.min(48, Math.round(prev * f)));
//     });
//   }, []);
//
//   const resetLayout = useCallback(() => {
//     setOverrides({});
//     setViewport({ x: 0, y: 0 });
//     setTileSize(DEFAULT_TILE_SIZE);
//   }, []);
//
//   const sel      = selectedId ? tileGroups.find(g => g.id === selectedId) : null;
//   const selItem  = sel ? gameData.itemById[sel.itemId] : null;
//   const selTier  = sel ? gameData.machineTiers[sel.machineId]?.find(t => t.id === sel.tierId) : null;
//   const selSpec  = sel ? specs.get(sel.machineId) : null;
//
//   return (
//     <div className="layout-planner">
//       <div className="layout-toolbar">
//         <button className="layout-btn" onClick={resetLayout}>↺ Auto Layout</button>
//         {gameData.beltTiers.length > 0 && (
//           <select
//             className="layout-select"
//             value={beltTierId}
//             onChange={e => setBeltTierId(e.target.value)}
//           >
//             {gameData.beltTiers.map(b => (
//               <option key={b.id} value={b.id}>{b.label} ({b.speed}/min)</option>
//             ))}
//           </select>
//         )}
//         {(() => {
//           const rawSpeed = gameData.beltTiers.find(b => b.id === beltTierId)?.speed ?? gameData.beltTiers[0]?.speed ?? 0;
//           return (
//             <select
//               className="layout-select"
//               value={beltUtil}
//               onChange={e => setBeltUtil(Number(e.target.value))}
//               title="Belt utilisation — lower values leave headroom to prevent starvation of machines at the end of a belt run"
//             >
//               {([1.0, 0.75, 0.6] as const).map(u => (
//                 <option key={u} value={u}>
//                   {Math.round(u * 100)}% util ({Math.round(rawSpeed * u)}/min effective)
//                 </option>
//               ))}
//             </select>
//           );
//         })()}
//         <span className="layout-stat">{machineCount} machines · {belts.length} belts · {tileSize}px/tile</span>
//         <div className="spacer" />
//         {sel && (
//           <div className="layout-selection-info">
//             <span className="layout-selection-name">{selItem?.icon} {selItem?.name}</span>
//             <span className="layout-selection-detail">
//               ×{sel.count} {selTier?.label ?? gameData.machines[sel.machineId]?.name}
//               {selSpec ? ` · ${selSpec.tileW}×${selSpec.tileH} tiles` : ''}
//               {' · '}{sel.rate.toFixed(1)}/min
//               {sel.capacityPerMachine > 0 && (
//                 ` · ${sel.capacityPerMachine.toFixed(1)}/min per machine · max ${sel.maxPerBelt} per row`
//               )}
//             </span>
//           </div>
//         )}
//       </div>
//       <div className="layout-canvas-wrap" ref={containerRef}>
//         <canvas
//           ref={canvasRef}
//           className="layout-canvas"
//           style={{ cursor: drag?.kind === 'pan' ? 'grabbing' : drag?.kind === 'group' ? 'move' : 'default' }}
//           onPointerDown={onPointerDown}
//           onPointerMove={onPointerMove}
//           onPointerUp={onPointerUp}
//           onPointerLeave={onPointerUp}
//           onWheel={onWheel}
//         />
//       </div>
//       <div className="layout-hint">Scroll to zoom · drag empty space to pan · click a group to select · drag group to move</div>
//     </div>
//   );
// }
