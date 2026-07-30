// The production tree, bound to DSP's data.
//
// Both the rendering and the data binding live elsewhere: ../../ProductionTreeView
// draws it, ./treeSource supplies it. This is only the join.

import React from 'react';
import { ProductionTreeView } from '../../ProductionTreeView';
import type { TreeTarget } from '../../productionTree';
import { dspTreeSource } from './treeSource';

export function ProductionTree({ targets, storageKey }: {
  targets: TreeTarget[];
  storageKey: string;
}) {
  return <ProductionTreeView targets={targets} source={dspTreeSource} storageKey={storageKey} />;
}
