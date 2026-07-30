// DSP's item selector: a trigger showing the chosen item, and the icon-grid
// modal it opens — modelled on the game's own "Select an Icon" dialog.
//
// Reads the data JSON directly. No GameData, no assembleGameData, no context.
//
// Layout comes from file order: 14 icons to a row, with `null` entries marking
// the empty cells the game leaves in its grid.

import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import type { ItemSelectorProps } from '../../OutputSelector';
import {
  itemGrid, buildingGrid, items, GRID_COLUMNS,
  recipesByOutput, protoName, machineIcon, fuelsByType,
} from './data/v0_10_34';
import type { DataItem, DataBuilding, DataRecipe } from './data/v0_10_34';

// Imported here, not from the game data module: this is the component that
// renders data-icon spans, so it is what the sprite sheet belongs to.
import './icons.css';

// DSP's sprite sheet is addressed as data-icon="item.<protoId>" (see icons.css).
const NS = 'item';
const MIN_ROWS = 10;   // the dialog keeps empty rows below the content

type Entry = DataItem | DataBuilding;

// Omit `size` to fill the parent. The sprite sheet is 14 square cells wide and
// sized with `background-size: 1400% auto`, so the element must stay square for
// the percentage background-position to land on the right cell.
function Icon({ id, size }: { id: number; size?: number }) {
  return (
    <span
      data-icon={`${NS}.${id}`}
      style={size === undefined
        ? { width: '100%', height: '100%', display: 'block' }
        : { width: size, height: size, display: 'inline-block', flexShrink: 0 }}
    />
  );
}

// Ids are still being filled in, so several rows can share one. Keep the first
// match for name lookup rather than assuming uniqueness.
const firstById = new Map<number, DataItem>();
items.forEach(it => { if (!firstById.has(it.id)) firstById.set(it.id, it); });

const TABS: Array<{ key: string; label: string; icon: number; grid: (Entry | null)[] }> = [
  { key: 'items',     label: 'Items',     icon: 1101, grid: itemGrid },
  { key: 'buildings', label: 'Buildings', icon: 2303, grid: buildingGrid },
];

/** Chunk a flat grid array into rows, padded out to MIN_ROWS. */
function toRows(grid: (Entry | null)[]): (Entry | null)[][] {
  const rows: (Entry | null)[][] = [];
  for (let i = 0; i < grid.length; i += GRID_COLUMNS) {
    const row = grid.slice(i, i + GRID_COLUMNS);
    while (row.length < GRID_COLUMNS) row.push(null);
    rows.push(row);
  }
  while (rows.length < MIN_ROWS) rows.push(new Array(GRID_COLUMNS).fill(null));
  return rows;
}

/**
 * Display labels for `type` keys. Presentation only — the JSON keeps its
 * snake_case keys. Anything not listed here is title-cased mechanically, which
 * already reads correctly for most of them (dark_fog → "Dark Fog").
 */
const TYPE_LABELS: Record<string, string> = {
  nat_resource: 'Natural Resource',
};

function typeLabel(key: string): string {
  return TYPE_LABELS[key]
    ?? key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** A tagged stat line: what it is, an optional qualifier, and a value. */
function StatRow({ tag, label, value, tone }: {
  tag: string;
  label?: string;
  value: string;
  tone: 'energy' | 'draw' | 'speed' | 'flow';
}) {
  return (
    <div className="dspui-stat">
      <span className={`dspui-stat-tag dspui-stat-tag--${tone}`}>{tag}</span>
      {label && <span>{label}</span>}
      <span className={`dspui-stat-value dspui-stat-value--${tone}`}>{value}</span>
    </div>
  );
}

interface Tip {
  entry: Entry;
  x: number;
  y: number;
  /** Flipped below the cell when there is no room above. */
  below: boolean;
}

/** One input/output stack: icon plus quantity. */
function IoChip({ item, qty }: { item: number; qty: number }) {
  // An unresolved id still renders — as a blank cell with the raw value — so a
  // bad reference is visible rather than silently dropped.
  const name = protoName.get(item);
  return (
    <span className="dspui-io" title={name ?? String(item)}>
      <Icon id={item} size={22} />
      <span className="dspui-io-qty">{qty}</span>
      {!name && <span className="dspui-io-bad">{String(item)}</span>}
    </span>
  );
}

function RecipeLine({ recipe }: { recipe: DataRecipe }) {
  const machine = machineIcon.get(recipe.machine);
  return (
    <div className="dspui-recipe">
      <div className="dspui-recipe-head">
        {/* Both are still blank across the whole data set, so show the gap
            rather than substituting the output's name — the point is to see
            what is left to fill in. */}
        {recipe.name
          ? <span className="dspui-recipe-name">{recipe.name}</span>
          : <span className="dspui-recipe-name dspui-missing">unnamed</span>}
        {recipe.id !== null
          ? <span className="dspui-recipe-id">{recipe.id}</span>
          : <span className="dspui-recipe-id dspui-missing">no id</span>}
      </div>
      <div className="dspui-recipe-io">
        {recipe.inputs.map((i, n) => <IoChip key={n} item={i.item} qty={i.qty} />)}
        <span className="dspui-recipe-arrow">→</span>
        {recipe.outputs.map((o, n) => <IoChip key={n} item={o.item} qty={o.qty} />)}
      </div>
      <div className="dspui-recipe-meta">
        {machine !== undefined
          ? <Icon id={machine} size={16} />
          : null}
        <span>{protoName.get(machine ?? -1) ?? recipe.machine}</span>
        <span className="dspui-recipe-time">{recipe.time}s</span>
      </div>
    </div>
  );
}

/**
 * What a power facility can burn, found by matching its `power.fuel` against
 * everything carrying a `fuel` block of that type.
 *
 * An empty result is not a data gap: wind, solar, geothermal and ray receivers
 * consume an environmental source, so the absence is stated rather than hidden.
 */
function FuelList({ type }: { type: string }) {
  const sources = fuelsByType.get(type) ?? [];

  if (!sources.length) {
    return (
      <div className="dspui-tip-none">
        {typeLabel(type)} is environmental — no fuel to supply.
      </div>
    );
  }

  return (
    <>
      <div className="dspui-tip-label">
        Burns {sources.length} {typeLabel(type).toLowerCase()} fuel{sources.length === 1 ? '' : 's'}
      </div>
      <div className="dspui-fuels">
        {sources.map(s => (
          <span key={s.id} className="dspui-fuel" title={`${s.name} · ${s.energy} MJ`}>
            <Icon id={s.id} size={20} />
            <span className="dspui-fuel-mj">{s.energy}</span>
          </span>
        ))}
      </div>
    </>
  );
}

function TipCard({ tip }: { tip: Tip }) {
  const { entry } = tip;
  const made = recipesByOutput.get(entry.id) ?? [];
  // Items carry stored energy (fuel); buildings carry generation (power) and,
  // for transport, throughput.
  const fuel = (entry as DataItem).fuel;
  const {
    power, power_usage, production_speed,
    mining_speed, water_speed, oil_speed,
    belt, sorter,
  } = entry as DataBuilding;
  return (
    <div
      className={`dspui-tip${tip.below ? ' is-below' : ''}`}
      style={{ left: tip.x, top: tip.y }}
    >
      <div className="dspui-tip-head">
        <span className="dspui-tip-name">{entry.name}</span>
        <span className="dspui-tip-id">{entry.id}</span>
      </div>
      <div className="dspui-tip-type">
        {entry.type.length
          ? entry.type.map(typeLabel).join(' · ')
          : <span className="dspui-missing">no type</span>}
      </div>

      {fuel   && <StatRow tone="energy" tag="Fuel"  label={typeLabel(fuel.type)}  value={`${fuel.energy} MJ`} />}
      {power  && <StatRow tone="energy" tag="Power" label={typeLabel(power.fuel)} value={`${power.power} kW`} />}
      {/* Explicit undefined check: a 0 kW draw is meaningful, not "absent". */}
      {power_usage !== undefined && <StatRow tone="draw" tag="Usage" value={`${power_usage} kW`} />}
      {production_speed !== undefined && <StatRow tone="speed" tag="Speed"  value={`×${production_speed}`} />}
      {oil_speed        !== undefined && <StatRow tone="speed" tag="Oil"    value={`×${oil_speed}`} />}
      {mining_speed     !== undefined && <StatRow tone="flow"  tag="Mining" value={`${mining_speed} / min per vein`} />}
      {water_speed      !== undefined && <StatRow tone="flow"  tag="Water"  value={`${water_speed} / min`} />}
      {belt   && <StatRow tone="flow" tag="Belt"   value={`${belt.speed} / s`} />}
      {sorter && <StatRow tone="flow" tag="Sorter" value={`${sorter.speed} / s`} />}

      {power && <FuelList type={power.fuel} />}
      {made.length === 0
        ? <div className="dspui-tip-none">No recipe produces this.</div>
        : <>
            <div className="dspui-tip-label">
              {made.length === 1 ? 'Produced by' : `Produced by ${made.length} recipes`}
            </div>
            {made.map((r, i) => <RecipeLine key={i} recipe={r} />)}
          </>}
    </div>
  );
}

function Modal({ selectedId, onSelect, onClose }: {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = useMemo(() => {
    const grid = TABS[tab].grid;
    const q = query.trim().toLowerCase();
    if (!q) return toRows(grid);
    // Searching abandons the grid positions and packs the matches, otherwise
    // results would be scattered across mostly-empty rows.
    const hits = grid.filter((e): e is Entry =>
      !!e && (e.name.toLowerCase().includes(q) || String(e.id).includes(q)));
    return toRows(hits);
  }, [tab, query]);

  return ReactDOM.createPortal(
    <>
      <div className="dspui-backdrop" onClick={onClose} />
      <div className="dspui-modal" role="dialog" aria-label="Select an icon">
        <span className="dspui-corner dspui-corner--tl" />
        <span className="dspui-corner dspui-corner--tr" />
        <span className="dspui-corner dspui-corner--bl" />
        <span className="dspui-corner dspui-corner--br" />

        <div className="dspui-head">
          <h2 className="dspui-heading">Select an Icon</h2>
          <input
            className="dspui-search"
            spellCheck={false}
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="dspui-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="dspui-tabs">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              className={`dspui-tab${i === tab ? ' is-active' : ''}`}
              onClick={() => setTab(i)}
            >
              <Icon id={t.icon} size={34} />
              <span className="dspui-tab-label">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="dspui-gridbox">
          <div className="dspui-grid" onMouseLeave={() => setTip(null)}>
            {rows.map((row, r) => row.map((entry, c) => (
              <div key={`${r}-${c}`} className="dspui-cellwrap">
                {entry && (
                  <button
                    // aria-disabled rather than the `disabled` attribute: a
                    // disabled button fires no mouse events, which would drop
                    // the tooltip on exactly the cells whose tooltip is worth
                    // reading ("No recipe produces this").
                    aria-disabled={!recipesByOutput.has(entry.id)}
                    className={`dspui-cell${entry.id === selectedId ? ' is-selected' : ''}${
                      recipesByOutput.has(entry.id) ? '' : ' is-unproducible'}`}
                    onClick={() => { if (recipesByOutput.has(entry.id)) onSelect(entry.id); }}
                    onMouseEnter={e => {
                      const r = e.currentTarget.getBoundingClientRect();
                      // Cells in the top half of the screen get the card below
                      // them; recipe lists are tall enough to run off the top.
                      const below = r.top < window.innerHeight / 2;
                      setTip({
                        entry,
                        x: r.left + r.width / 2,
                        y: below ? r.bottom + 8 : r.top - 8,
                        below,
                      });
                    }}
                  >
                    <Icon id={entry.id} />
                  </button>
                )}
              </div>
            )))}
          </div>
        </div>
      </div>

      {tip && <TipCard tip={tip} />}
    </>,
    document.body,
  );
}

export function ItemSelector({ value, onChange }: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const item = value === null ? null : firstById.get(value);

  return (
    <>
      <button className="dspui-trigger" onClick={() => setOpen(true)}>
        {value === null
          ? <span className="dspui-trigger-empty">Select an item…</span>
          : <>
              <Icon id={value} size={26} />
              <span className="dspui-trigger-name">{item?.name ?? `#${value}`}</span>
            </>}
        <span className="dspui-trigger-caret">▾</span>
      </button>

      {open && (
        <Modal
          selectedId={value}
          onSelect={id => { onChange(id); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
