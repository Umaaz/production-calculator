// DSP's side panels for the production tree.
//
// The view takes a single Panels component, so this is where the game's panels
// are ordered and composed. Each returns null when it has nothing to report, so
// the column stays quiet on a plan that doesn't need them.

import React from 'react';
import type { PlanEntry } from '../../ProductionTreeView';
import { PowerPanel } from './PowerPanel';
import { ProliferatorPanel } from './ProliferatorPanel';

export function Panels({ plan, storageKey }: { plan: PlanEntry[]; storageKey: string }) {
  return (
    <>
      <PowerPanel plan={plan} storageKey={storageKey} />
      <ProliferatorPanel plan={plan} storageKey={storageKey} />
    </>
  );
}
