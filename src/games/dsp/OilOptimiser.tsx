import React, { useEffect, useState } from 'react';
import { useGameData, SpriteIcon, TierPicker, ModifierPicker } from '../../calcShared';
import { fmt, fmtPower } from '../../treeLogic';

// Spray capacity: how many input items one unit of each proliferator tier covers.
const SPRAY_CAPS: Record<string, { label: string; spriteId: number; cap: number }> = {
  mk1: { label: 'Mk.I',   spriteId: 1141, cap: 12 },
  mk2: { label: 'Mk.II',  spriteId: 1142, cap: 24 },
  mk3: { label: 'Mk.III', spriteId: 1143, cap: 60 },
};
const TIER_ORDER = ['mk1', 'mk2', 'mk3'];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OilSolution {
  p: number; x: number; f: number; a: number; // plasma / x-ray / reformed / arc-smelter crafts/min
  crudeInput: number; coalInput: number;        // coalInput = f + 2*a (total coal)
  excessH: number; excessRefined: number;
}

export type OilMode = 'buildings' | 'balanced' | 'resources';

// Per-building modifier IDs — each process can be overridden individually.
// The resolved value is override ?? global default.
export interface OilModifiers {
  plasma: string;
  xray: string;
  reformed: string;
  arc: string;
}

// ── Solver ────────────────────────────────────────────────────────────────────

export function solveOilChain(h: number, r: number, g: number, mode: OilMode): OilSolution {
  if (mode === 'resources') {
    const fRaw = (r - 2 * h) / 3 + g;
    if (fRaw >= -1e-9) {
      const p = (h + r) / 3;
      const f = Math.max(0, fRaw);
      return { p, x: g, f, a: 0, crudeInput: 2 * p, coalInput: f, excessH: 0, excessRefined: 0 };
    }
    const p = h - g;
    return { p, x: g, f: 0, a: 0, crudeInput: 2 * p, coalInput: 0, excessH: 0, excessRefined: 2 * h - 3 * g - r };
  }

  if (mode === 'balanced' && r >= 2 * h) {
    const p = (r + h) / 3;
    const f = (r - 2 * h) / 3;
    return { p, x: 0, f, a: g, crudeInput: 2 * p, coalInput: f + 2 * g, excessH: 0, excessRefined: 0 };
  }

  if (r >= 2 * h) {
    const p = r / 2;
    return { p, x: 0, f: 0, a: g, crudeInput: 2 * p, coalInput: 2 * g, excessH: p - h, excessRefined: 0 };
  }

  const xMin = (2 * h - r) / 3;

  if (g >= xMin) {
    const p = (h + r) / 3;
    return { p, x: xMin, f: 0, a: g - xMin, crudeInput: 2 * p, coalInput: 2 * (g - xMin), excessH: 0, excessRefined: 0 };
  }

  const p = h - g;
  return { p, x: g, f: 0, a: 0, crudeInput: 2 * p, coalInput: 0, excessH: 0, excessRefined: 2 * h - 3 * g - r };
}

// ── Shared multiplier helpers ─────────────────────────────────────────────────

export function buildMults(modifierOptions: import('../../gameTypes').ModifierOption[], modifiers: OilModifiers) {
  const get = (id: string) => modifierOptions.find(m => m.id === id) ?? modifierOptions[0];
  const pm = get(modifiers.plasma);
  const rm = get(modifiers.reformed);
  const am = get(modifiers.arc);
  return {
    plasma:   { full: (pm?.speedMult ?? 1) * (pm?.productivityMult ?? 1), prod: pm?.productivityMult ?? 1, power: pm?.powerMult ?? 1 },
    xray:     { full: 1, power: 1 },
    reformed: { full: rm?.speedMult ?? 1, power: rm?.powerMult ?? 1 },
    arc:      { full: (am?.speedMult ?? 1) * (am?.productivityMult ?? 1), prod: am?.productivityMult ?? 1, power: am?.powerMult ?? 1 },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OilChip({ itemId, rate, excess, detail }: {
  itemId: string; rate: number; excess?: boolean; detail?: string;
}) {
  const { itemById } = useGameData();
  const item = itemById[itemId];
  return (
    <div className={`oil-chip${excess ? ' oil-chip-excess' : ''}`}>
      <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '?'} size={20} />
      <div className="oil-chip-text">
        <span className="oil-chip-rate">{fmt(rate)}/m</span>
        <span className="oil-chip-name">{excess ? 'excess ' : ''}{item?.name ?? itemId}</span>
        {detail && <span className="oil-chip-detail">{detail}</span>}
      </div>
    </div>
  );
}

function OilIoLine({ itemId, rate, sign }: { itemId: string; rate: number; sign: '+' | '−' }) {
  const { itemById } = useGameData();
  const item = itemById[itemId];
  return (
    <span className={`oil-io-line${sign === '+' ? ' oil-io-out' : ' oil-io-in'}`}>
      <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '?'} size={13} />
      {sign}{fmt(rate)}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OilOptimiser({
  refinerySpeed, treeDemands, beltCapacity,
  mode, onModeChange,
  smelterTierId, onSmelterTierChange,
  defaultModifierId, onDefaultModifierChange,
  modifiers, overrides, onModifierChange, onModifierClear,
}: {
  refinerySpeed: number;
  treeDemands: { h: number; r: number; g: number };
  beltCapacity?: number;
  mode: OilMode;
  onModeChange: (m: OilMode) => void;
  smelterTierId: string;
  onSmelterTierChange: (id: string) => void;
  defaultModifierId: string;
  onDefaultModifierChange: (id: string) => void;
  modifiers: OilModifiers;
  overrides: Partial<OilModifiers>;
  onModifierChange: (building: keyof OilModifiers, id: string) => void;
  onModifierClear: (building: keyof OilModifiers) => void;
}) {
  const toStr = (n: number) => n > 0 ? fmt(n) : '';
  const [hStr, setHStr] = useState(() => toStr(treeDemands.h));
  const [rStr, setRStr] = useState(() => toStr(treeDemands.r));
  const [gStr, setGStr] = useState(() => toStr(treeDemands.g));

  useEffect(() => { setHStr(toStr(treeDemands.h)); }, [treeDemands.h]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRStr(toStr(treeDemands.r)); }, [treeDemands.r]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGStr(toStr(treeDemands.g)); }, [treeDemands.g]); // eslint-disable-line react-hooks/exhaustive-deps

  const h = Math.max(0, parseFloat(hStr) || 0);
  const r = Math.max(0, parseFloat(rStr) || 0);
  const g = Math.max(0, parseFloat(gStr) || 0);

  const { itemById, machineTiers, modifierOptions } = useGameData();
  const smelterTiers = machineTiers['smelter'] ?? [];
  const smelterTier = smelterTiers.find(t => t.id === smelterTierId) ?? smelterTiers[0];
  const speedOnly = modifierOptions.filter(m => m.productivityMult <= 1);
  const showMods = modifierOptions.length > 1;

  const mults = buildMults(modifierOptions, modifiers);

  const sol = (h + r + g > 0) ? solveOilChain(h, r, g, mode) : null;

  const refsPlasma   = (c: number) => { const cpm = refinerySpeed * 15 * mults.plasma.full;   return { exact: c / cpm, ceil: Math.ceil(c / cpm - 1e-9) }; };
  const refsXray     = (c: number) => { const cpm = refinerySpeed * 15 * mults.xray.full;     return { exact: c / cpm, ceil: Math.ceil(c / cpm - 1e-9) }; };
  const refsReformed = (c: number) => { const cpm = refinerySpeed * 15 * mults.reformed.full; return { exact: c / cpm, ceil: Math.ceil(c / cpm - 1e-9) }; };
  const refsArc      = (c: number) => { const cpm = smelterTier.speed * 30 * mults.arc.full;  return { exact: c / cpm, ceil: Math.ceil(c / cpm - 1e-9) }; };

  const crudeDisplay        = sol ? sol.crudeInput / mults.plasma.prod : 0;
  const coalArcDisplay      = sol ? 2 * sol.a / mults.arc.prod : 0;
  const coalReformedDisplay = sol ? sol.f : 0;
  const coalDisplay         = coalArcDisplay + coalReformedDisplay;

  const isClosedLoop = sol ? (sol.crudeInput === 0 && sol.f > 0 && sol.x > 0) : false;

  // Proliferator consumption: group input-items/min by tier, divide by spray capacity.
  const prolifByTier: Record<string, { process: string; rate: number }[]> = {};
  if (sol && showMods) {
    const addProlif = (modId: string, process: string, itemsPerMin: number) => {
      const tier = modId.includes('-') ? modId.split('-')[0] : null;
      if (!tier || !SPRAY_CAPS[tier] || itemsPerMin <= 0) return;
      if (!prolifByTier[tier]) prolifByTier[tier] = [];
      prolifByTier[tier].push({ process, rate: itemsPerMin / SPRAY_CAPS[tier].cap });
    };
    if (sol.p > 0) addProlif(modifiers.plasma,   'Plasma',   crudeDisplay);
    if (sol.f > 0) addProlif(modifiers.reformed, 'Reformed', 4 * sol.f);
    if (sol.a > 0) addProlif(modifiers.arc,      'Arc',      coalArcDisplay);
  }

  const bc = beltCapacity ?? 0;
  const beltCount = (rate: number) => bc > 0 && rate > 0 ? Math.ceil(rate / bc - 1e-9) : 0;

  // One belt-connection row inside a flow card.
  // dir='loop' is used for the recycle belt; it always appears in BOTH the
  // inputs and outputs block of the same card so the player sees it as a
  // physical belt that exits the machines and immediately feeds back in.
  const FlowRow = ({ dir, itemId, rate, from, to }: {
    dir: 'in' | 'out' | 'loop-in' | 'loop-out';
    itemId: string;
    rate: number;
    from?: string;  // source label for 'in' rows
    to?: string;    // destination label for 'out' rows
  }) => {
    if (rate <= 0) return null;
    const itm = itemById[itemId];
    const n = beltCount(rate);
    const isLoop = dir === 'loop-in' || dir === 'loop-out';
    const sign = dir === 'in' ? '←' : dir === 'out' ? '→' : '↺';
    const dest = dir === 'in' ? from : dir === 'out' ? to
               : dir === 'loop-in' ? 'loop belt (from own output)'
               : 'loop belt (back to own input)';
    return (
      <div className={`oil-fr oil-fr-${isLoop ? 'loop' : dir}`}>
        <span className="oil-fr-sign">{sign}</span>
        <SpriteIcon spriteId={itm?.spriteId} fallback={itm?.icon ?? '?'} size={13} />
        <span className="oil-fr-name">{itm?.name ?? itemId}</span>
        <span className="oil-fr-rate">{fmt(rate)}/min</span>
        {n > 0 && <span className="oil-fr-belts">{n}×</span>}
        {dest && <span className={`oil-fr-label${isLoop ? ' oil-fr-label-loop' : ''}`}>{dest}</span>}
      </div>
    );
  };

  const FlowSection = ({ title }: { title: string }) => (
    <div className="oil-flow-section">{title}</div>
  );

  const demands = [
    { id: 'hydrogen',           label: 'Hydrogen',           val: hStr, set: setHStr },
    { id: 'refined-oil',        label: 'Refined Oil',        val: rStr, set: setRStr },
    { id: 'energetic-graphite', label: 'Energetic Graphite', val: gStr, set: setGStr },
  ];

  // Helper: modifier picker + optional reset button for a building.
  const ModPicker = ({ building, opts }: { building: keyof OilModifiers; opts?: typeof modifierOptions }) => (
    <>
      <ModifierPicker modifierId={modifiers[building]} onSelect={id => onModifierChange(building, id)} options={opts} />
      {overrides[building] !== undefined && (
        <button className="tree-reset-btn" onClick={() => onModifierClear(building)} title="Reset to default modifier">↺</button>
      )}
    </>
  );

  return (
    <div id="oil-optimiser">
      <div className="oil-demand-bar">
        <span className="oil-demand-bar-label">Required per minute</span>
        {demands.map(({ id, label, val, set }) => {
          const item = itemById[id];
          return (
            <label key={id} className="oil-demand-field">
              <span className="oil-demand-field-label">
                <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '?'} size={14} />
                {label}
              </span>
              <input type="number" min={0} value={val}
                onChange={e => set(e.target.value)} placeholder="0" />
            </label>
          );
        })}
        <span className="oil-demand-sep" />
        <span className="oil-demand-bar-label">Arc Smelter</span>
        <TierPicker tiers={smelterTiers} selectedId={smelterTierId} onSelect={onSmelterTierChange} />
        {showMods && <>
          <span className="oil-demand-sep" />
          <span className="oil-demand-bar-label">Modifier</span>
          <ModifierPicker modifierId={defaultModifierId} onSelect={onDefaultModifierChange} />
        </>}
        <span className="oil-demand-sep" />
        <div className="oil-mode-group">
          <span className="oil-demand-bar-label">Optimise for</span>
          <div className="oil-mode-btns">
            <button className={`oil-mode-btn${mode === 'buildings' ? ' is-active' : ''}`} onClick={() => onModeChange('buildings')}>Buildings</button>
            <button className={`oil-mode-btn${mode === 'balanced'  ? ' is-active' : ''}`} onClick={() => onModeChange('balanced')}>Balanced</button>
            <button className={`oil-mode-btn${mode === 'resources' ? ' is-active' : ''}`} onClick={() => onModeChange('resources')}>Resources</button>
          </div>
        </div>
      </div>

      {sol ? (
        <div className="oil-results">
          {sol.crudeInput === 0 && sol.f > 0 && sol.x > 0 && (
            <div className="oil-loop-note">
              ⚠ Reformed Refinement and X-Ray Cracking form a <strong>closed loop</strong>: refined
              oil and hydrogen circulate internally. Only coal is consumed externally. You will need a
              small initial supply of refined oil and hydrogen to prime the loop (e.g. a temporary
              plasma refinery).
            </div>
          )}
          <div className="oil-block">
            <div className="oil-block-title">Raw Inputs</div>
            <div className="oil-chip-row">
              {crudeDisplay > 0 && <OilChip itemId="crude-oil" rate={crudeDisplay} />}
              {coalDisplay > 0 && (
                <OilChip itemId="coal" rate={coalDisplay}
                  detail={sol.f > 0 && sol.a > 0
                    ? `${fmt(coalReformedDisplay)} reformed + ${fmt(coalArcDisplay)} arc`
                    : undefined} />
              )}
            </div>
          </div>

          <div className="oil-block">
            <div className="oil-block-title">Refineries</div>
            <div className="oil-process-row">
              {sol.p > 0 && (
                <div className="oil-process-card">
                  <div className="oil-process-name">
                    <SpriteIcon spriteId={2308} fallback="🛢" size={16} />
                    Plasma Refining
                  </div>
                  {showMods && <div className="oil-process-modifier"><ModPicker building="plasma" /></div>}
                  <div className="oil-process-count">
                    {refsPlasma(sol.p).ceil}×
                    <span className="oil-process-exact"> ({fmt(refsPlasma(sol.p).exact)})</span>
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="crude-oil"   rate={crudeDisplay} sign="−" />
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="hydrogen"    rate={sol.p / mults.plasma.prod}     sign="+" />
                    <OilIoLine itemId="refined-oil" rate={2 * sol.p / mults.plasma.prod} sign="+" />
                  </div>
                </div>
              )}
              {sol.x > 0 && (
                <div className="oil-process-card">
                  <div className="oil-process-name">
                    <SpriteIcon spriteId={2308} fallback="🛢" size={16} />
                    X-Ray Cracking
                  </div>
                  <div className="oil-process-count">
                    {refsXray(sol.x).ceil}×
                    <span className="oil-process-exact"> ({fmt(refsXray(sol.x).exact)})</span>
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="refined-oil" rate={sol.x}     sign="−" />
                    <OilIoLine itemId="hydrogen"    rate={2 * sol.x} sign="−" />
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="energetic-graphite" rate={sol.x}     sign="+" />
                    <OilIoLine itemId="hydrogen"           rate={3 * sol.x} sign="+" />
                  </div>
                </div>
              )}
              {sol.f > 0 && (
                <div className="oil-process-card">
                  <div className="oil-process-name">
                    <SpriteIcon spriteId={2308} fallback="🛢" size={16} />
                    Reformed Ref.
                  </div>
                  {showMods && <div className="oil-process-modifier"><ModPicker building="reformed" opts={speedOnly} /></div>}
                  <div className="oil-process-count">
                    {refsReformed(sol.f).ceil}×
                    <span className="oil-process-exact"> ({fmt(refsReformed(sol.f).exact)})</span>
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="refined-oil" rate={2 * sol.f} sign="−" />
                    <OilIoLine itemId="hydrogen"    rate={sol.f}     sign="−" />
                    <OilIoLine itemId="coal"        rate={sol.f}     sign="−" />
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="refined-oil" rate={3 * sol.f} sign="+" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {sol.a > 0 && (
            <div className="oil-block">
              <div className="oil-block-title">Arc Smelters</div>
              <div className="oil-process-row">
                <div className="oil-process-card">
                  <div className="oil-process-name">
                    <SpriteIcon spriteId={2302} fallback="🔥" size={16} />
                    Energetic Graphite
                  </div>
                  {showMods && <div className="oil-process-modifier"><ModPicker building="arc" /></div>}
                  <div className="oil-process-count">
                    {refsArc(sol.a).ceil}×
                    <span className="oil-process-exact"> ({fmt(refsArc(sol.a).exact)})</span>
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="coal"               rate={coalArcDisplay}          sign="−" />
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="energetic-graphite" rate={sol.a / mults.arc.prod}  sign="+" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Flow Analysis ─────────────────────────────────── */}
          <div className="oil-block">
            <div className="oil-block-title">Flow Analysis</div>
            <div className="oil-flow-cards">

              {/* Plasma */}
              {sol.p > 0 && (() => {
                const pp     = mults.plasma.prod;
                const pH     = sol.p / pp;
                const pR     = 2 * sol.p / pp;
                const hToRef = !isClosedLoop ? sol.f : 0;
                const rToX   = !isClosedLoop ? sol.x : 0;
                const hToBus = Math.max(0, pH - hToRef);
                const rToBus = Math.max(0, pR - rToX);
                return (
                  <div key="plasma" className="oil-flow-card">
                    <div className="oil-flow-card-hdr">
                      <span>Plasma Refining</span>
                      <span className="oil-flow-card-count">{refsPlasma(sol.p).ceil}×</span>
                    </div>
                    <FlowSection title="inputs" />
                    <FlowRow dir="in" itemId="crude-oil" rate={crudeDisplay} from="external" />
                    <FlowSection title="outputs" />
                    {hToRef > 0 && <FlowRow dir="out" itemId="hydrogen"    rate={hToRef} to="Reformed Ref." />}
                    {hToBus > 0 && <FlowRow dir="out" itemId="hydrogen"    rate={hToBus} to="H bus" />}
                    {rToX   > 0 && <FlowRow dir="out" itemId="refined-oil" rate={rToX}   to="X-Ray Cracking" />}
                    {rToBus > 0 && <FlowRow dir="out" itemId="refined-oil" rate={rToBus} to="R bus" />}
                  </div>
                );
              })()}

              {/* X-Ray */}
              {sol.x > 0 && (() => {
                const rFrom = isClosedLoop ? 'Reformed Ref.' : 'Plasma Refining';
                const hTo   = isClosedLoop ? 'Reformed Ref.' : 'H bus';
                return (
                  <div key="xray" className="oil-flow-card">
                    <div className="oil-flow-card-hdr">
                      <span>X-Ray Cracking</span>
                      <span className="oil-flow-card-count">{refsXray(sol.x).ceil}×</span>
                    </div>
                    <FlowSection title="inputs" />
                    <FlowRow dir="in"      itemId="refined-oil" rate={sol.x}     from={rFrom} />
                    <FlowRow dir="loop-in" itemId="hydrogen"    rate={2 * sol.x} />
                    <FlowSection title="outputs" />
                    <FlowRow dir="out"      itemId="energetic-graphite" rate={sol.x}     to="factory output" />
                    <FlowRow dir="loop-out" itemId="hydrogen"            rate={2 * sol.x} />
                    <FlowRow dir="out"      itemId="hydrogen"            rate={sol.x}     to={hTo} />
                  </div>
                );
              })()}

              {/* Reformed */}
              {sol.f > 0 && (() => {
                const hFrom = isClosedLoop ? 'X-Ray Cracking' : 'Plasma Refining';
                const rTo   = isClosedLoop ? 'X-Ray Cracking' : 'R bus';
                return (
                  <div key="reformed" className="oil-flow-card">
                    <div className="oil-flow-card-hdr">
                      <span>Reformed Ref.</span>
                      <span className="oil-flow-card-count">{refsReformed(sol.f).ceil}×</span>
                    </div>
                    <FlowSection title="inputs" />
                    <FlowRow dir="in"      itemId="hydrogen"    rate={sol.f} from={hFrom} />
                    <FlowRow dir="in"      itemId="coal"        rate={sol.f} from="external" />
                    <FlowRow dir="loop-in" itemId="refined-oil" rate={2 * sol.f} />
                    <FlowSection title="outputs" />
                    <FlowRow dir="loop-out" itemId="refined-oil" rate={2 * sol.f} />
                    <FlowRow dir="out"      itemId="refined-oil" rate={sol.f}     to={rTo} />
                  </div>
                );
              })()}

              {/* Arc */}
              {sol.a > 0 && (
                <div key="arc" className="oil-flow-card">
                  <div className="oil-flow-card-hdr">
                    <span>Arc Smelting</span>
                    <span className="oil-flow-card-count">{refsArc(sol.a).ceil}×</span>
                  </div>
                  <FlowSection title="inputs" />
                  <FlowRow dir="in"  itemId="coal"               rate={coalArcDisplay}         from="external" />
                  <FlowSection title="outputs" />
                  <FlowRow dir="out" itemId="energetic-graphite" rate={sol.a / mults.arc.prod} to="factory output" />
                </div>
              )}

            </div>
          </div>

          {TIER_ORDER.some(t => prolifByTier[t]) && (
            <div className="oil-block">
              <div className="oil-block-title">Proliferators / min</div>
              <div className="oil-chip-row">
                {TIER_ORDER.filter(t => prolifByTier[t]).map(tierId => {
                  const entries = prolifByTier[tierId];
                  const total = entries.reduce((s, e) => s + e.rate, 0);
                  const { label, spriteId } = SPRAY_CAPS[tierId];
                  const detail = entries.length > 1
                    ? entries.map(e => `${e.process} ${fmt(e.rate)}`).join(' · ')
                    : null;
                  return (
                    <div key={tierId} className="oil-chip">
                      <SpriteIcon spriteId={spriteId} fallback="🧪" size={22} />
                      <div className="oil-chip-text">
                        <span className="oil-chip-rate">{fmt(total)}/min</span>
                        <span className="oil-chip-name">{label} Proliferator</span>
                        {detail && <span className="oil-chip-detail">{detail}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="oil-block">
            <div className="oil-block-title">Net Outputs</div>
            <div className="oil-chip-row">
              {h > 0 && <OilChip itemId="hydrogen"           rate={h} />}
              {r > 0 && <OilChip itemId="refined-oil"        rate={r} />}
              {g > 0 && <OilChip itemId="energetic-graphite" rate={g} />}
              {sol.excessH       > 0 && <OilChip itemId="hydrogen"    rate={sol.excessH}       excess />}
              {sol.excessRefined > 0 && <OilChip itemId="refined-oil" rate={sol.excessRefined} excess />}
            </div>
          </div>
        </div>
      ) : (
        <div className="calc-empty">
          Enter required output rates above to calculate the oil processing setup.
        </div>
      )}
    </div>
  );
}

// ── Oil chain tree entry ──────────────────────────────────────────────────────
// Renders as a sibling root in the production tree.
// ProcessRow JSX is inlined (not an inner component) so ModifierPicker retains
// its dropdown state across parent re-renders.

export function OilChainTreeEntry({
  solution, refinerySpeed, smelterTierId, beltCapacity, demands,
  defaultModifierId, onDefaultModifierChange,
  modifiers, overrides, onModifierChange, onModifierClear,
}: {
  solution: OilSolution;
  refinerySpeed: number;
  smelterTierId: string;
  beltCapacity: number;
  demands: { h: number; r: number; g: number };
  defaultModifierId: string;
  onDefaultModifierChange: (id: string) => void;
  modifiers: OilModifiers;
  overrides: Partial<OilModifiers>;
  onModifierChange: (building: keyof OilModifiers, id: string) => void;
  onModifierClear: (building: keyof OilModifiers) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { itemById, machineTiers, machines, modifierOptions } = useGameData();

  const smelterTiers = machineTiers['smelter'] ?? [];
  const smelterTier = smelterTiers.find(t => t.id === smelterTierId) ?? smelterTiers[0];
  const speedOnly = modifierOptions.filter(m => m.productivityMult <= 1);
  const showMods = modifierOptions.length > 1;

  const mults = buildMults(modifierOptions, modifiers);

  const refsPlasma   = (c: number) => { const cpm = refinerySpeed * 15 * mults.plasma.full;   return { exact: c / cpm, ceil: Math.ceil(c / cpm - 1e-9) }; };
  const refsXray     = (c: number) => { const cpm = refinerySpeed * 15 * mults.xray.full;     return { exact: c / cpm, ceil: Math.ceil(c / cpm - 1e-9) }; };
  const refsReformed = (c: number) => { const cpm = refinerySpeed * 15 * mults.reformed.full; return { exact: c / cpm, ceil: Math.ceil(c / cpm - 1e-9) }; };
  const refsArc      = (c: number) => { const cpm = smelterTier.speed * 30 * mults.arc.full;  return { exact: c / cpm, ceil: Math.ceil(c / cpm - 1e-9) }; };

  const crudeDisplay    = solution.crudeInput / mults.plasma.prod;
  const coalArcDisplay  = 2 * solution.a / mults.arc.prod;
  const refSprite = machineTiers['refinery']?.[0]?.spriteId;
  const refLabel  = machines['refinery']?.name ?? 'Refinery';

  const refineryPowerKW = machineTiers['refinery']?.[0]?.workPowerKW ?? 0;
  const smelterPowerKW  = smelterTier?.workPowerKW ?? 0;
  const plasmaPowerKW   = solution.p > 0 ? refsPlasma(solution.p).exact   * refineryPowerKW * mults.plasma.power   : 0;
  const xrayPowerKW     = solution.x > 0 ? refsXray(solution.x).exact     * refineryPowerKW * mults.xray.power     : 0;
  const reformedPowerKW = solution.f > 0 ? refsReformed(solution.f).exact * refineryPowerKW * mults.reformed.power : 0;
  const arcPowerKW      = solution.a > 0 ? refsArc(solution.a).exact      * smelterPowerKW  * mults.arc.power      : 0;
  const totalOilPowerKW = plasmaPowerKW + xrayPowerKW + reformedPowerKW + arcPowerKW;

  const beltCell = (rate: number) => {
    if (rate <= 0 || beltCapacity <= 0) return <span className="tree-cell tree-cell-belts" />;
    const exact = rate / beltCapacity;
    const count = Math.ceil(exact - 1e-9);
    return (
      <span className="tree-cell tree-cell-belts">
        <span className="tree-belt-count">{count}×<span className="tree-machine-exact"> ({fmt(exact)})</span></span>
      </span>
    );
  };

  const ioRow = (id: string, rate: number, sign: '+' | '−', ctx: string) => {
    if (rate <= 0) return null;
    const item = itemById[id];
    return (
      <div key={`${ctx}${sign}${id}`} className="tree-row tree-row-io">
        <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 + 44 }}>
          <span className={`tree-io-sign${sign === '+' ? ' tree-io-sign-out' : ' tree-io-sign-in'}`}>{sign}</span>
          <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '❓'} size={16} className="tree-icon" />
          <span className="tree-name">{item?.name ?? id}</span>
        </span>
        <span className={`tree-cell tree-cell-rate${sign === '+' ? ' tree-io-rate-out' : ' tree-io-rate-in'}`}>
          {fmt(rate)}/min
        </span>
        <span className="tree-cell tree-cell-recipe" />
        <span className="tree-cell tree-cell-machine" />
        <span className="tree-cell tree-cell-prolif" />
        <span className="tree-cell tree-cell-count" />
        <span className="tree-cell tree-cell-power" />
        {beltCell(rate)}
        <span className="tree-cell tree-cell-byproducts" />
      </div>
    );
  };


  const outputRow = (id: string, rate: number, excess = false) => {
    if (rate <= 0) return null;
    const item = itemById[id];
    return (
      <div key={`${excess ? 'xs' : 'out'}-${id}`} className="tree-row">
        <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 + 22 }}>
          <span className={`tree-caret leaf${excess ? ' tree-io-sign-excess' : ' tree-io-sign-out'}`}>
            {excess ? '~' : '+'}
          </span>
          <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '❓'} size={22} className="tree-icon" />
          <span className="tree-name">{item?.name ?? id}</span>
        </span>
        <span className={`tree-cell tree-cell-rate${excess ? ' tree-io-rate-excess' : ' tree-io-rate-out'}`}>
          {fmt(rate)}/min
        </span>
        <span className="tree-cell tree-cell-recipe" />
        <span className="tree-cell tree-cell-machine">
          {excess && <span className="tree-tag oil-excess">excess</span>}
        </span>
        <span className="tree-cell tree-cell-prolif" />
        <span className="tree-cell tree-cell-count" />
        <span className="tree-cell tree-cell-power" />
        {beltCell(rate)}
        <span className="tree-cell tree-cell-byproducts" />
      </div>
    );
  };

  // Inline modifier cell — shows picker + ↺ when overridden.
  const modCell = (building: keyof OilModifiers, opts?: typeof modifierOptions) => (
    <span className="tree-cell tree-cell-prolif">
      {showMods && <>
        <ModifierPicker modifierId={modifiers[building]} onSelect={id => onModifierChange(building, id)} options={opts} />
        {overrides[building] !== undefined && (
          <button className="tree-reset-btn" onClick={() => onModifierClear(building)} title="Reset to default modifier">↺</button>
        )}
      </>}
    </span>
  );

  return (
    <>
      {/* Root row — modifier column shows the global oil default; power column shows chain total */}
      <div className="tree-row">
        <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 }}>
          <button className="tree-caret" onClick={() => setExpanded(e => !e)} aria-label={expanded ? 'collapse' : 'expand'}>
            {expanded ? '▾' : '▸'}
          </button>
          <SpriteIcon spriteId={refSprite} fallback="⚗" size={22} className="tree-icon" />
          <span className="tree-name">Oil Processing Chain</span>
        </span>
        <span className="tree-cell tree-cell-rate" />
        <span className="tree-cell tree-cell-recipe" />
        <span className="tree-cell tree-cell-machine"><span className="tree-tag oil">⚗ Oil Chain</span></span>
        <span className="tree-cell tree-cell-prolif">
          {showMods && <ModifierPicker modifierId={defaultModifierId} onSelect={onDefaultModifierChange} />}
        </span>
        <span className="tree-cell tree-cell-count" />
        <span className="tree-cell tree-cell-power">{totalOilPowerKW > 0 && fmtPower(totalOilPowerKW)}</span>
        <span className="tree-cell tree-cell-belts" />
        <span className="tree-cell tree-cell-byproducts" />
      </div>
      {expanded && <>
        {/* Net outputs — demanded first, then any excess */}
        {outputRow('refined-oil', demands.r)}
        {outputRow('energetic-graphite', demands.g)}
        {outputRow('hydrogen', demands.h)}
        {outputRow('hydrogen', solution.excessH, true)}
        {outputRow('refined-oil', solution.excessRefined, true)}

        {solution.p > 0 && (
          <>
            <div className="tree-row">
              <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 + 22 }}>
                <span className="tree-caret leaf">•</span>
                <SpriteIcon spriteId={refSprite} fallback="🏭" size={22} className="tree-icon" />
                <span className="tree-name">Plasma Refining</span>
              </span>
              <span className="tree-cell tree-cell-rate" />
              <span className="tree-cell tree-cell-recipe" />
              <span className="tree-cell tree-cell-machine"><span className="tree-machine-name">{refLabel}</span></span>
              {modCell('plasma')}
              <span className="tree-cell tree-cell-count">
                <span className="tree-machine-count">{refsPlasma(solution.p).ceil}×<span className="tree-machine-exact"> ({fmt(refsPlasma(solution.p).exact)})</span></span>
              </span>
              <span className="tree-cell tree-cell-power">{plasmaPowerKW > 0 && fmtPower(plasmaPowerKW)}</span>
              <span className="tree-cell tree-cell-belts" />
              <span className="tree-cell tree-cell-byproducts" />
            </div>
            {ioRow('crude-oil', crudeDisplay, '−', 'p')}
            {ioRow('hydrogen', solution.p / mults.plasma.prod, '+', 'p')}
            {ioRow('refined-oil', 2 * solution.p / mults.plasma.prod, '+', 'p')}
          </>
        )}

        {solution.x > 0 && (
          <>
            <div className="tree-row">
              <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 + 22 }}>
                <span className="tree-caret leaf">•</span>
                <SpriteIcon spriteId={refSprite} fallback="🏭" size={22} className="tree-icon" />
                <span className="tree-name">X-Ray Cracking</span>
              </span>
              <span className="tree-cell tree-cell-rate" />
              <span className="tree-cell tree-cell-recipe" />
              <span className="tree-cell tree-cell-machine"><span className="tree-machine-name">{refLabel}</span></span>
              <span className="tree-cell tree-cell-prolif" />
              <span className="tree-cell tree-cell-count">
                <span className="tree-machine-count">{refsXray(solution.x).ceil}×<span className="tree-machine-exact"> ({fmt(refsXray(solution.x).exact)})</span></span>
              </span>
              <span className="tree-cell tree-cell-power">{xrayPowerKW > 0 && fmtPower(xrayPowerKW)}</span>
              <span className="tree-cell tree-cell-belts" />
              <span className="tree-cell tree-cell-byproducts" />
            </div>
            {ioRow('refined-oil', solution.x, '−', 'x')}
            {ioRow('hydrogen', 2 * solution.x, '−', 'x')}
            {ioRow('energetic-graphite', solution.x, '+', 'x')}
            {ioRow('hydrogen', 3 * solution.x, '+', 'x')}
          </>
        )}

        {solution.f > 0 && (
          <>
            <div className="tree-row">
              <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 + 22 }}>
                <span className="tree-caret leaf">•</span>
                <SpriteIcon spriteId={refSprite} fallback="🏭" size={22} className="tree-icon" />
                <span className="tree-name">Reformed Ref.</span>
              </span>
              <span className="tree-cell tree-cell-rate" />
              <span className="tree-cell tree-cell-recipe" />
              <span className="tree-cell tree-cell-machine"><span className="tree-machine-name">{refLabel}</span></span>
              {modCell('reformed', speedOnly)}
              <span className="tree-cell tree-cell-count">
                <span className="tree-machine-count">{refsReformed(solution.f).ceil}×<span className="tree-machine-exact"> ({fmt(refsReformed(solution.f).exact)})</span></span>
              </span>
              <span className="tree-cell tree-cell-power">{reformedPowerKW > 0 && fmtPower(reformedPowerKW)}</span>
              <span className="tree-cell tree-cell-belts" />
              <span className="tree-cell tree-cell-byproducts" />
            </div>
            {ioRow('refined-oil', 2 * solution.f, '−', 'f')}
            {ioRow('hydrogen', solution.f, '−', 'f')}
            {ioRow('coal', solution.f, '−', 'f')}
            {ioRow('refined-oil', 3 * solution.f, '+', 'f')}
          </>
        )}

        {solution.a > 0 && (
          <>
            <div className="tree-row">
              <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 + 22 }}>
                <span className="tree-caret leaf">•</span>
                <SpriteIcon spriteId={smelterTier?.spriteId} fallback="🔥" size={22} className="tree-icon" />
                <span className="tree-name">Arc Smelting (Graphite)</span>
              </span>
              <span className="tree-cell tree-cell-rate" />
              <span className="tree-cell tree-cell-recipe" />
              <span className="tree-cell tree-cell-machine"><span className="tree-machine-name">{smelterTier?.label ?? 'Arc Smelter'}</span></span>
              {modCell('arc')}
              <span className="tree-cell tree-cell-count">
                <span className="tree-machine-count">{refsArc(solution.a).ceil}×<span className="tree-machine-exact"> ({fmt(refsArc(solution.a).exact)})</span></span>
              </span>
              <span className="tree-cell tree-cell-power">{arcPowerKW > 0 && fmtPower(arcPowerKW)}</span>
              <span className="tree-cell tree-cell-belts" />
              <span className="tree-cell tree-cell-byproducts" />
            </div>
            {ioRow('coal', coalArcDisplay, '−', 'a')}
            {ioRow('energetic-graphite', solution.a / mults.arc.prod, '+', 'a')}
          </>
        )}
      </>}
    </>
  );
}
