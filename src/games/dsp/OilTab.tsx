// Oil chain solver screen.
//
// Refined oil, hydrogen and graphite come out of recipes that feed each other,
// so a tree cannot express them: it has to pick one route per item and expand
// downwards, which either ignores the interplay or runs in circles. Solved as a
// system they come out exactly — see ./oilSolver for the working.

import React, { useMemo } from 'react';
import { usePersisted } from '../../usePersisted';
import { useTreeConfig, modifierDetail } from '../../useTreeConfig';
import { buildTree } from '../../productionTree';
import type { TreeNode, TreeTarget, TreeRecipe } from '../../productionTree';
import { OptionPicker } from '../../OptionPicker';
import { dspTreeSource, Icon } from './treeSource';
import { solveOilChain, OIL_CHAIN_ITEMS, OIL_MODES } from './oilSolver';
import { OilFlow } from './OilFlow';
import type { OilMode } from './oilSolver';

const { refinedOil, hydrogen, graphite } = OIL_CHAIN_ITEMS;

// Annotated as number[]: OIL_CHAIN_ITEMS is `as const`, so without this the
// array narrows to a union of the three literals and cannot be searched with an
// arbitrary item id.
const DEMAND_ITEMS: number[] = [refinedOil, hydrogen, graphite];

export function OilTab({ targets, storageKey }: { targets: TreeTarget[]; storageKey: string }) {
  const [mode, setMode] = usePersisted<OilMode>(`${storageKey}:oilMode`, 'buildings');

  // The same config the tree view builds from, so the demand this screen reads
  // matches the tree's exactly — proliferators and all. Resolving it any other
  // way is what once made the two disagree.
  const { config, machineDefaults, modifiers, modifierDefault, setModifierDefault, resolveModifier } =
    useTreeConfig(dspTreeSource, storageKey);

  // The build-wide default building for a category — the tier the diagram's
  // machine counts should use, matching what the tree's totals fold in.
  const chosenMachine = (category: string) =>
    (dspTreeSource.machinesFor?.(category) ?? [])[machineDefaults[category] ?? 0];
  const machineFor = (category: string) => chosenMachine(category)?.id;
  const speedFor = (category: string) => chosenMachine(category)?.speed ?? 1;

  // The recipe behind each step box, for narrowing the build-wide proliferator
  // to what that recipe accepts — cracking and reforming take only speed modes.
  const oilRecipe = (output: number, name: string): TreeRecipe | undefined =>
    dspTreeSource.recipesByOutput.get(output)?.find(r => r.name === name);
  const stepRecipe: Record<string, TreeRecipe | undefined> = {
    plasma: oilRecipe(refinedOil, 'Plasma Refining'),
    xray: oilRecipe(graphite, 'X-ray Cracking'),
    reformed: oilRecipe(refinedOil, 'Reformed Refinement'),
    arc: oilRecipe(graphite, 'Energetic Graphite'),
  };
  // A synthetic path with no override, so it resolves to the build-wide default
  // exactly as the folded totals do — the two must not disagree.
  const modifierFor = (stepId: string) => {
    const recipe = stepRecipe[stepId];
    return recipe ? resolveModifier(recipe, `oil:${stepId}`) : undefined;
  };

  const demand = useMemo(() => {
    const totals = new Map<number, number>();

    // Count only nodes that chose the stand-in recipe. Picking hydrogen off a
    // gas giant, or expanding Plasma Refining inline, means that demand is met
    // elsewhere — counting it here would have the chain build for it twice.
    const walk = (n: TreeNode) => {
      if (n.recipe?.external && DEMAND_ITEMS.includes(n.itemId)) {
        totals.set(n.itemId, (totals.get(n.itemId) ?? 0) + n.rate);
      }
      n.children.forEach(walk);
    };
    targets.forEach(t => walk(buildTree(t.itemId, t.rate, config)));

    return {
      refinedOil: totals.get(refinedOil) ?? 0,
      hydrogen: totals.get(hydrogen) ?? 0,
      graphite: totals.get(graphite) ?? 0,
    };
  }, [targets, config]);

  // Productivity feeds the solve — it lowers crude and coal. Only Plasma
  // Refining and Energetic Graphite accept an extra-products mode; the rest
  // resolve to speed, whose productivity is 1, so this reads their real effect.
  const prod = {
    plasma: modifierFor('plasma')?.productivity ?? 1,
    arc: modifierFor('arc')?.productivity ?? 1,
  };

  const solution = useMemo(
    () => solveOilChain(demand, mode, prod),
    [demand, mode, prod.plasma, prod.arc],
  );

  // Only worth offering when the modes would differ — they coincide unless the
  // plan wants graphite that cracking is not already making anyway.
  const modesMatter = demand.graphite > 0
    && solveOilChain(demand, 'buildings', prod).coal !== solveOilChain(demand, 'resource', prod).coal;

  const anything = demand.refinedOil > 0 || demand.hydrogen > 0 || demand.graphite > 0;

  if (!anything) {
    return (
      <div className="oil-tab">
        <h2 className="oil-title">Oil chain</h2>
        <p className="oil-note">
          Nothing in this plan needs refined oil, hydrogen or graphite.
        </p>
      </div>
    );
  }

  return (
    <div className="oil-tab">
      <h2 className="oil-title">Oil chain</h2>

      {modifiers.length > 1 && (
        <div className="oil-modifier">
          <h3 className="oil-subtitle">Proliferator</h3>
          {/* The tree's build-wide modifier, edited here too — same setting, so
              a change moves the demand on both screens at once. */}
          <OptionPicker
            Icon={Icon}
            value={modifierDefault}
            onChange={key => setModifierDefault(String(key))}
            options={modifiers.map(m => ({
              key: m.id,
              name: m.name,
              iconId: m.iconId,
              detail: modifierDetail(m),
            }))}
          />
        </div>
      )}

      {modesMatter && (
        <>
          <h3 className="oil-subtitle">Optimise for</h3>
          <div className="oil-modes">
            {OIL_MODES.map(m => (
              <button
                key={m.id}
                className={`oil-mode${mode === m.id ? ' is-active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <span className="oil-mode-label">{m.label}</span>
                <span className="oil-mode-detail">{m.detail}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="oil-flow-scroll">
        <OilFlow
          solution={solution}
          demand={demand}
          machineFor={machineFor}
          speedFor={speedFor}
          modifierFor={modifierFor}
        />
      </div>

      {solution.crudeOil <= 0 && (solution.xray > 0 || solution.reformed > 0) && (
        <p className="oil-note">
          No crude oil enters and none leaves: refined oil and hydrogen only
          circulate between the refineries, which between them turn 1 coal into
          1 graphite where the smelter needs 2. They are catalysts here, so the
          loop has to be primed with a stock of each before it will run.
        </p>
      )}

      <p className="oil-note">
        Crude oil comes to <code>2 × (oil + hydrogen) / 3</code> and holds however
        the chain is arranged — cracking and reforming only trade oil against
        hydrogen one for one, so the modes move coal and machines, never crude.
        {prod.plasma > 1 && ' Extra products on Plasma Refining are the one thing that lowers it, meeting the same demand from fewer crafts.'}
        {modesMatter && ' Graphite costs 1 coal cracked from oil against 2 coal smelted, but takes two refinery crafts in place of one smelter craft.'}
        {solution.surplusGraphite > 0 && ' Cracking has to run to meet the hydrogen demand, and it makes graphite whether or not the plan wants it.'}
      </p>

      <p className="oil-note">
        Demand tracks the tree and the crude, coal, refineries and smelter are
        folded into the plan's own totals. Each recipe shows the proliferator it
        accepts — cracking and reforming take only speed modes — with its speed in
        the machine counts and its extra products in the crude and coal.
      </p>
    </div>
  );
}
