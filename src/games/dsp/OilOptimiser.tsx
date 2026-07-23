import React, { useEffect, useState } from 'react';
import { useGameData, SpriteIcon, TierPicker, ModifierPicker } from '../../calcShared';
import { fmt } from '../../treeLogic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OilSolution {
  p: number; x: number; f: number; a: number; // plasma / x-ray / reformed / arc-smelter crafts/min
  crudeInput: number; coalInput: number;        // coalInput = f + 2*a (total coal)
  excessH: number; excessRefined: number;
}

type OilMode = 'buildings' | 'balanced' | 'resources';

// ── Solver ────────────────────────────────────────────────────────────────────

function solveOilChain(h: number, r: number, g: number, mode: OilMode): OilSolution {
  if (mode === 'resources') {
    // Minimize crude oil + coal. Always use x-ray for graphite and exact balance.
    // X-ray + reformed uses 1 coal/craft vs arc smelters' 2 coal/graphite, so
    // this is more resource-efficient even though it needs more buildings.
    const fRaw = (r - 2 * h) / 3 + g;
    if (fRaw >= -1e-9) {
      const p = (h + r) / 3;
      const f = Math.max(0, fRaw);
      return { p, x: g, f, a: 0, crudeInput: 2 * p, coalInput: f, excessH: 0, excessRefined: 0 };
    }
    // Can't balance exactly (H demand too high relative to R + G): accept excess.
    const p = h - g;
    return { p, x: g, f: 0, a: 0, crudeInput: 2 * p, coalInput: 0, excessH: 0, excessRefined: 2 * h - 3 * g - r };
  }

  // 'balanced' mode: use reformed to absorb excess H from plasma (no waste), arc smelters
  // for graphite. Trades extra coal (reformed) for less crude vs buildings. Falls through
  // to buildings logic when r < 2h (no plasma surplus to feed reformed).
  if (mode === 'balanced' && r >= 2 * h) {
    const p = (r + h) / 3;
    const f = (r - 2 * h) / 3;
    return { p, x: 0, f, a: g, crudeInput: 2 * p, coalInput: f + 2 * g, excessH: 0, excessRefined: 0 };
  }

  // 'buildings' mode (and 'balanced' fallback when r < 2h): minimize total machine count.
  // Arc smelters are always cheaper per graphite than x-ray across all DSP speeds,
  // so x-ray is used only when the H/R balance forces it.

  if (r >= 2 * h) {
    // R-heavy: run plasma to meet refined demand, accept excess hydrogen.
    // Reformed refinement here would cost MORE buildings than accepting the excess.
    const p = r / 2;
    return { p, x: 0, f: 0, a: g, crudeInput: 2 * p, coalInput: 2 * g, excessH: p - h, excessRefined: 0 };
  }

  const xMin = (2 * h - r) / 3; // minimum x-ray to keep H/R balanced without reformed

  if (g >= xMin) {
    // Excess refined absorbed by x-ray; arc smelters cover remaining graphite.
    const p = (h + r) / 3;
    return { p, x: xMin, f: 0, a: g - xMin, crudeInput: 2 * p, coalInput: 2 * (g - xMin), excessH: 0, excessRefined: 0 };
  }

  // Graphite too small to absorb all excess refined: reduce plasma, x-ray handles all graphite.
  const p = h - g;
  return { p, x: g, f: 0, a: 0, crudeInput: 2 * p, coalInput: 0, excessH: 0, excessRefined: 2 * h - 3 * g - r };
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

export function OilOptimiser({ refinerySpeed, defaultSmelterTierId, defaultModifierId, treeDemands }: {
  refinerySpeed: number;
  defaultSmelterTierId: string;
  defaultModifierId: string;
  treeDemands: { h: number; r: number; g: number };
}) {
  const toStr = (n: number) => n > 0 ? fmt(n) : '';
  const [hStr, setHStr] = useState(() => toStr(treeDemands.h));
  const [rStr, setRStr] = useState(() => toStr(treeDemands.r));
  const [gStr, setGStr] = useState(() => toStr(treeDemands.g));
  const [smelterTierId, setSmelterTierId] = useState(defaultSmelterTierId);
  const [modifierId, setModifierId] = useState(defaultModifierId);
  const [mode, setMode] = useState<OilMode>('buildings');

  useEffect(() => { setHStr(toStr(treeDemands.h)); }, [treeDemands.h]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRStr(toStr(treeDemands.r)); }, [treeDemands.r]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGStr(toStr(treeDemands.g)); }, [treeDemands.g]); // eslint-disable-line react-hooks/exhaustive-deps

  const h = Math.max(0, parseFloat(hStr) || 0);
  const r = Math.max(0, parseFloat(rStr) || 0);
  const g = Math.max(0, parseFloat(gStr) || 0);

  const { itemById, machineTiers, modifierOptions } = useGameData();
  const smelterTiers = machineTiers['smelter'] ?? [];
  const smelterTier = smelterTiers.find(t => t.id === smelterTierId) ?? smelterTiers[0];

  const modifier = modifierOptions.find(m => m.id === modifierId) ?? modifierOptions[0];
  // speedMult → machine runs faster (fewer machines for same output, inputs unchanged)
  // productivityMult → more output per craft (fewer crafts needed, raw inputs also reduced)
  const totalMult      = (modifier?.speedMult ?? 1) * (modifier?.productivityMult ?? 1);
  const isProductivity = (modifier?.productivityMult ?? 1) > 1;

  const sol = (h + r + g > 0) ? solveOilChain(h, r, g, mode) : null;
  const craftsPerRef     = refinerySpeed * 15 * totalMult;
  const craftsPerSmelter = smelterTier.speed * 30 * totalMult;
  const refs = (crafts: number) => ({
    exact: crafts / craftsPerRef,
    ceil: Math.ceil(crafts / craftsPerRef - 1e-9),
  });
  const smelterRefs = (crafts: number) => ({
    exact: crafts / craftsPerSmelter,
    ceil: Math.ceil(crafts / craftsPerSmelter - 1e-9),
  });

  const demands = [
    { id: 'hydrogen',           label: 'Hydrogen',           val: hStr, set: setHStr },
    { id: 'refined-oil',        label: 'Refined Oil',        val: rStr, set: setRStr },
    { id: 'energetic-graphite', label: 'Energetic Graphite', val: gStr, set: setGStr },
  ];

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
        <TierPicker tiers={smelterTiers} selectedId={smelterTierId} onSelect={setSmelterTierId} />
        {modifierOptions.length > 1 && <>
          <span className="oil-demand-sep" />
          <span className="oil-demand-bar-label">Modifier</span>
          <ModifierPicker modifierId={modifierId} onSelect={setModifierId} />
        </>}
        <span className="oil-demand-sep" />
        <div className="oil-mode-group">
          <span className="oil-demand-bar-label">Optimise for</span>
          <div className="oil-mode-btns">
            <button
              className={`oil-mode-btn${mode === 'buildings' ? ' is-active' : ''}`}
              onClick={() => setMode('buildings')}
            >Buildings</button>
            <button
              className={`oil-mode-btn${mode === 'balanced' ? ' is-active' : ''}`}
              onClick={() => setMode('balanced')}
            >Balanced</button>
            <button
              className={`oil-mode-btn${mode === 'resources' ? ' is-active' : ''}`}
              onClick={() => setMode('resources')}
            >Resources</button>
          </div>
        </div>
      </div>

      {sol ? (
        <div className="oil-results">
          {/* Reformed + X-Ray can form a self-sustaining loop: reformed net-produces refined oil
              from coal, which x-ray consumes to make graphite — no crude needed at steady state.
              Flag this so players know the loop needs priming, not an ongoing crude supply. */}
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
              {sol.crudeInput > 0 && (
                <OilChip itemId="crude-oil" rate={isProductivity ? sol.crudeInput / (modifier?.productivityMult ?? 1) : sol.crudeInput} />
              )}
              {sol.coalInput > 0 && (
                <OilChip itemId="coal" rate={isProductivity ? sol.coalInput / (modifier?.productivityMult ?? 1) : sol.coalInput}
                  detail={sol.f > 0 && sol.a > 0
                    ? `${fmt(sol.f)} reformed + ${fmt(2 * sol.a)} arc`
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
                  <div className="oil-process-count">
                    {refs(sol.p).ceil}×
                    <span className="oil-process-exact"> ({fmt(refs(sol.p).exact)})</span>
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="crude-oil"   rate={sol.crudeInput} sign="−" />
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="hydrogen"    rate={sol.p}       sign="+" />
                    <OilIoLine itemId="refined-oil" rate={2 * sol.p}   sign="+" />
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
                    {refs(sol.x).ceil}×
                    <span className="oil-process-exact"> ({fmt(refs(sol.x).exact)})</span>
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="refined-oil" rate={sol.x}       sign="−" />
                    <OilIoLine itemId="hydrogen"    rate={2 * sol.x}   sign="−" />
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
                  <div className="oil-process-count">
                    {refs(sol.f).ceil}×
                    <span className="oil-process-exact"> ({fmt(refs(sol.f).exact)})</span>
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
                  <div className="oil-process-count">
                    {smelterRefs(sol.a).ceil}×
                    <span className="oil-process-exact"> ({fmt(smelterRefs(sol.a).exact)})</span>
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="coal"               rate={2 * sol.a} sign="−" />
                  </div>
                  <div className="oil-process-io">
                    <OilIoLine itemId="energetic-graphite" rate={sol.a}     sign="+" />
                  </div>
                </div>
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
