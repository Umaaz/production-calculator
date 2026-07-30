// One output: an item and a rate.
//
// Game-agnostic. The item picker itself is passed in — the game owns how its
// items look and how one is chosen; this only pairs that choice with a rate.

import React from 'react';
import type { ComponentType } from 'react';

/** Props a game's item selector must accept. */
export interface ItemSelectorProps {
  value: number | null;
  onChange: (id: number) => void;
}

export type ItemSelectorComponent = ComponentType<ItemSelectorProps>;

export interface Output {
  itemId: number | null;
  /** Kept as a string so the input can be empty or mid-edit. */
  rate: string;
}

export function OutputSelector({ ItemSelector, value, onChange, onRemove, label }: {
  ItemSelector: ItemSelectorComponent;
  value: Output;
  onChange: (next: Output) => void;
  onRemove?: () => void;
  label?: string;
}) {
  return (
    <div className="output-row">
      <span className="output-label">{label}</span>
      <ItemSelector value={value.itemId} onChange={id => onChange({ ...value, itemId: id })} />
      <input
        className="output-rate"
        type="number"
        min={0}
        value={value.rate}
        onChange={e => onChange({ ...value, rate: e.target.value })}
      />
      <span className="output-unit">/ min</span>
      {onRemove && (
        <button className="output-remove" onClick={onRemove} title="Remove output">×</button>
      )}
    </div>
  );
}
