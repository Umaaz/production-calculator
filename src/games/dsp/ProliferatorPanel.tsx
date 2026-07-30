// Proliferator consumption, as a side panel on the production tree.
//
// Lives in the game folder because the maths is DSP's, not the planner's: what
// counts as sprayable, how a spray is consumed, and the self-spray feedback are
// all rules of this game. The shared view supplies a resolved PlanEntry[] and
// stays out of it.

import React, { useMemo } from 'react';
import { usePersisted } from '../../usePersisted';
import type { PlanEntry } from '../../ProductionTreeView';
import { modifiers, protoName } from './data/v0_10_34';
import './icons.css';

/**
 * Spraying the proliferators themselves raises how far each one goes, because
 * a coated spray carries the extra-products bonus into its own application.
 * The gain is the Extra mode's productivity for that tier — Mk.III at ×1.25
 * turns 60 sprays into 75.
 */
function selfSprayCapacity(sprays: number, item: number): number {
  const extra = modifiers.find(m => m.item === item && m.productivity > 1);
  return sprays * (extra?.productivity ?? 1);
}

interface Row {
  item: number;
  /** Units of proliferator per minute. */
  count: number;
  /** Items coated per minute. */
  sprayed: number;
}

export function ProliferatorPanel({ plan, storageKey }: {
  plan: PlanEntry[];
  storageKey: string;
}) {
  const [selfSpray, setSelfSpray] = usePersisted<boolean>(`${storageKey}:selfSpray`, false);

  const rows = useMemo<Row[]>(() => {
    const acc = new Map<number, Row>();

    plan.forEach(entry => {
      const mod = entry.modifier;
      if (!mod?.iconId) return;

      const data = modifiers.find(m => m.id === mod.id);
      if (!data?.sprays) return;

      // Every item entering the machine gets coated, so the gross input rate is
      // what to divide by — not the netted child rates, which understate any
      // recipe that recycles one of its own inputs.
      const sprayed = entry.inputs.reduce((s, i) => s + i.rate, 0);
      if (sprayed <= 0) return;

      const capacity = selfSpray
        ? selfSprayCapacity(data.sprays, mod.iconId)
        : data.sprays;

      // Grouped by the proliferator item: a tier's speed and extra modes are
      // the same consumable drawn from one supply.
      const row = acc.get(mod.iconId) ?? { item: mod.iconId, count: 0, sprayed: 0 };
      row.count += sprayed / capacity;
      row.sprayed += sprayed;
      acc.set(mod.iconId, row);
    });

    return Array.from(acc.values())
      .sort((a, z) => (protoName.get(a.item) ?? '').localeCompare(protoName.get(z.item) ?? ''));
  }, [plan, selfSpray]);

  if (rows.length === 0) return null;

  const totalSprayed = rows.reduce((s, r) => s + r.sprayed, 0);

  return (
    <div className="pt-side-block">
      <div className="pt-side-title">
        Proliferators / min
        <button
          className={`pp-selfspray${selfSpray ? ' is-on' : ''}`}
          onClick={() => setSelfSpray(v => !v)}
          title={selfSpray
            ? 'Self-spray on: proliferators are themselves proliferated, so each goes further'
            : 'Self-spray off: click to assume proliferators are proliferated'}
        >
          ⊕ self-spray
        </button>
      </div>

      {rows.map(row => (
        <div key={row.item} className="pt-side-row">
          <span
            data-icon={`item.${row.item}`}
            style={{ width: 20, height: 20, display: 'inline-block', flexShrink: 0 }}
          />
          <span className="pt-side-name">{protoName.get(row.item) ?? `#${row.item}`}</span>
          <span className="pt-side-val">
            {Math.ceil(row.count - 1e-9)}
            <span className="pt-side-exact"> ({row.count.toFixed(2)})</span>
          </span>
        </div>
      ))}

      <div className="pt-side-note">
        Coating {totalSprayed.toFixed(0)} items / min. Not fed back into the tree —
        making these is not counted.
      </div>
    </div>
  );
}
