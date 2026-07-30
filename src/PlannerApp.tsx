// The planner app.
//
// Owns the list of outputs and nothing else. The game supplies one component —
// its item selector — and everything else here is game-agnostic. No GameData,
// no recipes, no context.

import React, { useCallback, useMemo } from 'react';
import type { ComponentType } from 'react';
import { usePersisted } from './usePersisted';
import { OutputSelector } from './OutputSelector';
import type { ItemSelectorComponent, Output } from './OutputSelector';
import type { TreeTarget } from './productionTree';

/** The game's production tree view, given every output target at once. */
export type ProductionTreeComponent = ComponentType<{
  targets: TreeTarget[];
  storageKey: string;
}>;

/**
 * An extra screen a game can add alongside the plan.
 *
 * It receives the same targets the tree is built from, so it can work out what
 * the plan actually demands. Anything a game needs beyond a production tree —
 * solving a recycling chain, laying out a blueprint — goes here rather than
 * into the planner.
 */
export interface PlannerTab {
  id: string;
  label: string;
  Component: ComponentType<{ targets: TreeTarget[]; storageKey: string }>;
}

const NEW_OUTPUT: Output = { itemId: null, rate: '60' };

export function PlannerApp({ ItemSelector, ProductionTree, tabs = [], storageKey }: {
  ItemSelector: ItemSelectorComponent;
  ProductionTree: ProductionTreeComponent;
  /** Extra screens supplied by the game. */
  tabs?: PlannerTab[];
  /** Namespaces persisted state so switching games doesn't bleed outputs. */
  storageKey: string;
}) {
  const [activeTab, setActiveTab] = usePersisted<string>(`${storageKey}:tab`, '');
  const [outputs, setOutputs] = usePersisted<Output[]>(`${storageKey}:outputs`, [NEW_OUTPUT]);

  const update = useCallback((i: number, next: Output) =>
    setOutputs(os => os.map((o, j) => (j === i ? next : o))), [setOutputs]);

  const add = useCallback(() =>
    setOutputs(os => [...os, NEW_OUTPUT]), [setOutputs]);

  const remove = useCallback((i: number) =>
    setOutputs(os => os.filter((_, j) => j !== i)), [setOutputs]);

  // Only fully specified outputs reach the tree; a half-filled row is not an
  // error, it just isn't a target yet.
  const targets = useMemo<TreeTarget[]>(() =>
    outputs
      .filter(o => o.itemId !== null && parseFloat(o.rate) > 0)
      .map(o => ({ itemId: o.itemId as number, rate: parseFloat(o.rate) })),
    [outputs]);

  return (
    <div className="planner-app">
      <h1 className="planner-title">Production Planner</h1>

      <div className="planner-outputs">
        {outputs.map((o, i) => (
          <OutputSelector
            key={i}
            ItemSelector={ItemSelector}
            value={o}
            onChange={next => update(i, next)}
            onRemove={outputs.length > 1 ? () => remove(i) : undefined}
            label={i === 0 ? 'I want to produce' : 'and'}
          />
        ))}
      </div>

      <button className="planner-add" onClick={add}>+ Add output</button>

      {/* Outputs stay above the tabs: they are the input to every screen, not
          just the tree. */}
      {tabs.length > 0 && (
        <div className="planner-tabs">
          <button
            className={`planner-tab${activeTab === '' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('')}
          >
            Tree
          </button>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`planner-tab${activeTab === t.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {targets.length > 0 && (() => {
        const tab = tabs.find(t => t.id === activeTab);
        if (tab) return <tab.Component targets={targets} storageKey={storageKey} />;
        return <ProductionTree targets={targets} storageKey={storageKey} />;
      })()}
    </div>
  );
}
