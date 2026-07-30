// Power supply, as a side panel on the production tree.
//
// Totals the plan's draw, then works back from a chosen generator and fuel to
// how many of each you need. Lives in the game folder: what generates power,
// what burns, and the energy accounting are all DSP's.

import React, { useMemo } from 'react';
import { usePersisted } from '../../usePersisted';
import { OptionPicker } from '../../OptionPicker';
import type { PlanEntry } from '../../ProductionTreeView';
import { buildings, fuelsByType, protoName } from './data/v0_10_34';
import './icons.css';

function Icon({ id, size = 20 }: { id: number; size?: number }) {
  return (
    <span
      data-icon={`item.${id}`}
      style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }}
    />
  );
}

const fmtPower = (kW: number) =>
  kW >= 1000 ? `${(kW / 1000).toFixed(kW >= 10000 ? 0 : 1)} MW` : `${Math.round(kW)} kW`;

const fmt = (n: number) => (n >= 100 ? n.toFixed(1) : Number(n.toFixed(2)).toString());

/** Anything with a `power` block generates; file order puts the basics first. */
const generators = buildings.filter(b => b.power !== undefined);

/**
 * How long one unit of fuel lasts in a generator running at full load, seconds.
 *
 *     (energy × efficiency) / rate
 *
 * The formula wants joules over watts. This data holds megajoules and kilowatts,
 * so energy needs ×1e6 and rate ×1e3 — a net ×1e3 on the numerator.
 *
 * Checks out against the wiki's worked example: Energetic Graphite at 6.3 MJ in
 * a Thermal Power Station (2160 kW, 80 %) gives (6.3 × 0.8 × 1000) / 2160 =
 * 2.333 s.
 *
 * Efficiency is absent on generators that burn nothing, where the figure is
 * meaningless anyway; treating it as 1 keeps the arithmetic total.
 */
function burnSeconds(energyMJ: number, outputKW: number, efficiency = 1): number {
  return (energyMJ * efficiency * 1000) / outputKW;
}

export function PowerPanel({ plan, storageKey }: { plan: PlanEntry[]; storageKey: string }) {
  const [generatorId, setGeneratorId] = usePersisted<number>(
    `${storageKey}:powerGenerator`, generators[0]?.id ?? 0);
  const [fuelId, setFuelId] = usePersisted<number>(`${storageKey}:powerFuel`, 0);

  // Draw is the fractional machine count, not the rounded-up build count: this
  // is the load the plan actually pulls.
  const demandKW = useMemo(() => plan.reduce((sum, e) => {
    if (e.machine?.powerKW === undefined) return sum;
    return sum + e.machine.powerKW * e.machines * (e.modifier?.power ?? 1);
  }, 0), [plan]);

  const generator = generators.find(g => g.id === generatorId) ?? generators[0];
  const fuels = generator ? fuelsByType.get(generator.power!.fuel) ?? [] : [];
  const fuel = fuels.find(f => f.id === fuelId) ?? fuels[0];

  if (demandKW <= 0 || !generator) return null;

  const ratedKW = generator.power!.power;
  const efficiency = generator.power!.efficiency;

  // Some fuels drive the generator past its rating — a Strange Annihilation
  // Fuel Rod doubles an Artificial Star. That changes both how many generators
  // the demand needs and how fast each one gets through a unit, so everything
  // below works from the boosted figure rather than the plate rating.
  const boost = fuel?.outputMultiplier ?? 1;
  const outputKW = ratedKW * boost;

  const needed = demandKW / outputKW;
  const built = Math.ceil(needed - 1e-9);

  // One unit lasts `burn` seconds at full output, so a generator eats 60/burn a
  // minute. Counted against the generators built rather than the fractional
  // demand: every plant is assumed to run at 100 %, so the last one burns a
  // full share even when the plan only needs part of its output.
  const burn = fuel ? burnSeconds(fuel.energy, outputKW, efficiency) : 0;
  const fuelPerMin = burn > 0 ? (60 / burn) * built : 0;

  return (
    <div className="pt-side-block">
      <div className="pt-side-title">Power</div>

      <div className="pt-side-row">
        <span style={{ width: 20 }} />
        <span className="pt-side-name">Total demand</span>
        <span className="pt-side-val pw-demand">{fmtPower(demandKW)}</span>
      </div>

      <div className="pw-pickers">
        <OptionPicker
          Icon={Icon}
          value={generator.id}
          onChange={key => { setGeneratorId(Number(key)); setFuelId(0); }}
          options={generators.map(g => ({
            key: g.id,
            name: g.name,
            iconId: g.id,
            detail: `${fmtPower(g.power!.power)} · ${g.power!.fuel}`,
          }))}
          label="Power generator"
        />

        {fuels.length > 0 && (
          <OptionPicker
            Icon={Icon}
            value={fuel?.id ?? fuels[0].id}
            onChange={key => setFuelId(Number(key))}
            options={fuels.map(f => ({
              key: f.id,
              name: f.name,
              iconId: f.id,
              // Each fuel is timed against the output *it* produces, since a
              // boosting fuel is burnt at the higher rate it enables.
              detail: `${f.energy} MJ · ${
                fmt(burnSeconds(f.energy, ratedKW * f.outputMultiplier, efficiency))}s${
                f.outputMultiplier !== 1 ? ` · ×${f.outputMultiplier} output` : ''}`,
            }))}
          />
        )}
      </div>

      <div className="pt-side-row">
        <Icon id={generator.id} />
        <span className="pt-side-name">
          {generator.name}
          {boost !== 1 && <span className="pt-side-unit"> · ×{boost} output</span>}
        </span>
        <span className="pt-side-val">
          {built}
          <span className="pt-side-exact"> ({fmt(needed)})</span>
        </span>
      </div>

      {fuel ? (
        <>
          <div className="pt-side-row">
            <Icon id={fuel.id} />
            <span className="pt-side-name">{protoName.get(fuel.id) ?? fuel.name}</span>
            <span className="pt-side-val">{fmt(fuelPerMin)}<span className="pt-side-exact"> /min</span></span>
          </div>
          <div className="pt-side-subrow">
            <span style={{ width: 14 }} />
            <span className="pt-side-name">Burn time, at full load</span>
            <span className="pt-side-val">{fmt(burn)}<span className="pt-side-exact"> s</span></span>
          </div>
        </>
      ) : (
        <div className="pt-side-note">
          {generator.power!.fuel} is environmental — no fuel to supply.
        </div>
      )}

      <div className="pt-side-note">
        Demand is the load drawn, from fractional machine counts. Fuel assumes
        every generator built runs at 100 %. Powering the fuel chain itself is
        not included.
      </div>
    </div>
  );
}
