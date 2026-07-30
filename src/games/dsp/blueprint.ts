// DSP blueprint string ⇄ structured data.
//
// String form:  BLUEPRINT:<csv header>"<base64 of gzipped payload>"<MD5F hash>
//
// The payload struct lives in blueprintBinary.ts; this module handles the text
// header, base64 and gzip only.

// Named imports, not a default import: pako 3 ships a real ESM build with no
// default export, so `import pako from 'pako'` resolves to undefined under
// webpack even though it type-checks and works under jest's CJS resolution.
import { gzip, ungzip } from 'pako';
import { readBlueprintPayload, writeBlueprintPayload } from './blueprintBinary';
import type { DspBlueprintData } from './blueprintBinary';

export type { DspBlueprintData, DspBuilding, DspArea, DspVec3 } from './blueprintBinary';

const PREFIX = 'BLUEPRINT:';

export interface DspBlueprintHeader {
  headerVersion: number;   // field 0 — 0 in every blueprint seen so far
  layout: number;          // field 1
  icons: number[];         // fields 2..6 — item/tech proto ids shown on the blueprint card
  reserved: number;        // field 7 — always 0; meaning unknown, preserved verbatim
  // .NET tick count. 637647239078962124 exceeds Number.MAX_SAFE_INTEGER, so this
  // stays a string — parsing it as a number would silently corrupt it.
  timestamp: string;       // field 8
  gameVersion: string;     // field 9
  shortDesc: string;       // field 10, decoded
  desc: string;            // field 11.., decoded (may itself contain commas)
}

export interface DspBlueprint {
  header: DspBlueprintHeader;
  data: DspBlueprintData;
  /**
   * The hash exactly as it appeared in the source string. NOT verified: DSP
   * signs blueprints with "MD5F", a modified MD5 whose constants differ from
   * the standard algorithm, and we don't implement it yet. Decoding doesn't
   * need it; emitting a blueprint the game will accept does.
   */
  hash: string;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  return Buffer.from(bytes).toString('base64');
}

/** Split a blueprint string into its three segments. */
function segments(text: string): { header: string; b64: string; hash: string } {
  const s = text.trim();
  if (!s.startsWith(PREFIX)) throw new Error('not a blueprint string: missing BLUEPRINT: prefix');
  const parts = s.split('"');
  if (parts.length !== 3) {
    throw new Error(`blueprint string: expected 3 quote-delimited segments, got ${parts.length}`);
  }
  return { header: parts[0], b64: parts[1], hash: parts[2] };
}

export function parseHeader(header: string): DspBlueprintHeader {
  const f = header.slice(PREFIX.length).split(',');
  if (f.length < 12) throw new Error(`blueprint header: expected ≥12 fields, got ${f.length}`);
  return {
    headerVersion: Number(f[0]),
    layout:        Number(f[1]),
    icons:         f.slice(2, 7).map(Number),
    reserved:      Number(f[7]),
    timestamp:     f[8],
    gameVersion:   f[9],
    shortDesc:     decodeURIComponent(f[10]),
    // Anything past field 10 belongs to the description — rejoin so a comma in
    // the user's text survives the round trip.
    desc:          decodeURIComponent(f.slice(11).join(',')),
  };
}

export function formatHeader(h: DspBlueprintHeader): string {
  return PREFIX + [
    h.headerVersion, h.layout, ...h.icons, h.reserved,
    h.timestamp, h.gameVersion,
    encodeURIComponent(h.shortDesc), encodeURIComponent(h.desc),
  ].join(',');
}

/** Inflated payload bytes, before struct parsing. Useful for round-trip tests. */
export function inflatePayload(text: string): Uint8Array {
  return ungzip(base64ToBytes(segments(text).b64));
}

export function decodeBlueprint(text: string): DspBlueprint {
  const { header, b64, hash } = segments(text);
  return {
    header: parseHeader(header),
    data:   readBlueprintPayload(ungzip(base64ToBytes(b64))),
    hash,
  };
}

/**
 * Everything a blueprint string contains except the trailing hash — i.e.
 * `BLUEPRINT:<header>"<base64>"`, which is exactly the substring MD5F is
 * computed over.
 *
 * This is deliberately not `encodeBlueprint`: appending a wrong hash would
 * produce a string the game rejects, which is worse than producing none. Once
 * MD5F is implemented, the full encoder is `encodeBlueprintBody(bp) + md5f(...)`.
 *
 * Note the gzip stream is not guaranteed to be byte-identical to the one the
 * game emitted, so a decode/encode cycle need not reproduce the original
 * string even when every field is correct. Assert round-trips on the inflated
 * payload instead.
 */
export function encodeBlueprintBody(bp: DspBlueprint): string {
  const gz = gzip(writeBlueprintPayload(bp.data));
  return `${formatHeader(bp.header)}"${bytesToBase64(gz)}"`;
}
