import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { ProdRecipe, ProdItem, GameData } from './gameTypes';
import {
  GameDataCtx, useGameData, useDropdown,
  SpriteIcon, TierPicker, ModifierPicker,
} from './calcShared';
import {
  collectPaths, findTier, buildTree, aggregate, fmt,
  type TreeNode, type TreeBuildConfig, type Totals,
} from './treeLogic';
import { OilOptimiser } from './games/dsp/OilOptimiser';

// ── Path-keyed state map ──────────────────────────────────────────────────────
// Shared pattern for tier, modifier, and recipe per-path overrides.

function usePathMap<T>(): [Record<string, T>, (path: string, val: T) => void, (path: string) => void] {
  const [map, setMap] = useState<Record<string, T>>({});
  const set   = useCallback((path: string, val: T) => setMap(prev => ({ ...prev, [path]: val })), []);
  const clear = useCallback((path: string) => setMap(prev => { const n = { ...prev }; delete n[path]; return n; }), []);
  return [map, set, clear];
}

// ── Tree actions context ──────────────────────────────────────────────────────
// Avoids prop-drilling callbacks and per-path overrides 12 levels through TreeRow.

interface TreeActions {
  itemTierIds: Record<string, string>;
  itemModifierIds: Record<string, string>;
  beltCapacity: number;
  setTier: (path: string, tierId: string) => void;
  clearTier: (path: string) => void;
  setModifier: (path: string, id: string) => void;
  clearModifier: (path: string) => void;
  setRecipe: (path: string, recipeId: string) => void;
  clearRecipe: (path: string) => void;
}
const TreeActionsCtx = React.createContext<TreeActions | null>(null);
const useTreeActions = (): TreeActions => {
  const ctx = useContext(TreeActionsCtx);
  if (!ctx) throw new Error('useTreeActions must be used inside <TreeActionsCtx.Provider>');
  return ctx;
};

// ── Item picker ──────────────────────────────────────────────────────────────

function ItemPicker({ items, selectedId, onSelect }: {
  items: ProdItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { open, close, toggle, panelPos, triggerRef, panelRef } = useDropdown();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = items.find(it => it.id === selectedId) ?? items[0];
  const filtered = useMemo(
    () => query.trim() === '' ? items : items.filter(it => it.name.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const panel = open ? ReactDOM.createPortal(
    <div ref={panelRef} className="recipe-panel item-picker-panel"
      style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}>
      <div className="item-picker-search">
        <input ref={searchRef} className="item-picker-input" placeholder="Search…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="item-picker-list">
        {filtered.map(it => (
          <button key={it.id}
            className={`item-picker-option${it.id === selected.id ? ' is-selected' : ''}`}
            onClick={() => { onSelect(it.id); close(); }}>
            <SpriteIcon spriteId={it.spriteId} fallback={it.icon} size={20} />
            <span className="item-picker-name">{it.name}</span>
          </button>
        ))}
        {filtered.length === 0 && <span className="item-picker-empty">No results</span>}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button ref={triggerRef} className="item-picker-trigger"
        onClick={() => toggle(Math.min(filtered.length, 8) * 36 + 44, 220)}>
        <SpriteIcon spriteId={selected.spriteId} fallback={selected.icon} size={20} />
        <span className="item-picker-trigger-name">{selected.name}</span>
        <span className="recipe-trigger-caret">▾</span>
      </button>
      {panel}
    </>
  );
}

// ── Recipe picker ────────────────────────────────────────────────────────────

function RecipeIoChips({ recipe, iconSize }: { recipe: ProdRecipe; iconSize: number }) {
  const { itemById } = useGameData();
  return (
    <>
      {recipe.inputs.map(inp => (
        <span key={inp.item} className="recipe-io-chip">
          <SpriteIcon spriteId={itemById[inp.item]?.spriteId} fallback={itemById[inp.item]?.icon ?? '?'} size={iconSize} />
          <span className="recipe-io-qty">{inp.qty}</span>
        </span>
      ))}
      <span className="recipe-io-arrow">→</span>
      {recipe.outputs.map(out => (
        <span key={out.item} className="recipe-io-chip">
          <SpriteIcon spriteId={itemById[out.item]?.spriteId} fallback={itemById[out.item]?.icon ?? '?'} size={iconSize} />
          <span className="recipe-io-qty">{out.qty}</span>
        </span>
      ))}
    </>
  );
}

function RecipePicker({ recipes, selectedId, onSelect }: {
  recipes: ProdRecipe[];
  selectedId: string;
  onSelect: (recipeId: string) => void;
}) {
  const { itemById, machineTiers, machines } = useGameData();
  const { open, close, toggle, panelPos, triggerRef, panelRef } = useDropdown();
  const selected = recipes.find(r => r.id === selectedId) ?? recipes[0];

  const panel = open ? ReactDOM.createPortal(
    <div ref={panelRef} className="recipe-panel" style={{ top: panelPos.top, left: panelPos.left }}>
      {recipes.map(r => (
        <button key={r.id}
          className={`recipe-option${r.id === selected.id ? ' is-selected' : ''}`}
          onClick={() => { onSelect(r.id); close(); }}>
          <SpriteIcon spriteId={machineTiers[r.machine]?.[0]?.spriteId} fallback={machines[r.machine]?.icon ?? '🏭'} size={24} />
          <span className="recipe-option-info">
            <span className="recipe-option-name">{r.label ?? itemById[r.outputs[0]?.item]?.name ?? 'Recipe'}</span>
            <span className="recipe-option-io">
              <RecipeIoChips recipe={r} iconSize={16} />
              <span className="recipe-io-time">{r.time}s</span>
            </span>
          </span>
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button ref={triggerRef} className="recipe-trigger" onClick={() => toggle(recipes.length * 68)}>
        <SpriteIcon spriteId={machineTiers[selected.machine]?.[0]?.spriteId} fallback={machines[selected.machine]?.icon ?? '🏭'} size={18} />
        <span className="recipe-trigger-info">
          <span className="recipe-trigger-name">{selected.label ?? itemById[selected.outputs[0]?.item]?.name ?? 'Recipe'}</span>
          <span className="recipe-trigger-io"><RecipeIoChips recipe={selected} iconSize={12} /></span>
        </span>
        <span className="recipe-trigger-caret">▾</span>
      </button>
      {panel}
    </>
  );
}

// ── Tree row ──────────────────────────────────────────────────────────────────

const MINE_PSEUDO_RECIPE = (itemId: string): ProdRecipe => ({
  id: '__mine__',
  label: 'Mine / Collect',
  machine: 'raw',
  time: 0,
  inputs: [],
  outputs: [{ item: itemId, qty: 1 }],
});

function TreeRow({ node, depth, expanded, toggle }: {
  node: TreeNode; depth: number;
  expanded: Set<string>; toggle: (p: string) => void;
}) {
  const { itemById, machineTiers: allMachineTiers, machines, recipesByOutput, modifierOptions } = useGameData();
  const { itemTierIds, itemModifierIds, beltCapacity, setTier, clearTier, setModifier, clearModifier, setRecipe, clearRecipe } = useTreeActions();

  const item = itemById[node.itemId];
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.path);

  const machineTiers = node.machine ? allMachineTiers[node.machine] : null;
  const catDef = node.machine ? machines[node.machine] : null;
  const currentTier = machineTiers?.find(t => t.id === node.tierId) ?? machineTiers?.[0] ?? null;
  const isTierOverridden     = node.path in itemTierIds;
  const isModifierOverridden = node.path in itemModifierIds;
  const currentModifierId    = itemModifierIds[node.path] ?? node.modifierId;

  // Recipes tagged noExtraProducts (e.g. DSP x-ray cracking, collider) only allow speed mode.
  const allowedModifiers = node.recipe?.noExtraProducts
    ? modifierOptions.filter(m => m.productivityMult <= 1)
    : modifierOptions;

  const realRecipes = recipesByOutput[node.itemId] ?? [];
  const pickerRecipes: ProdRecipe[] | null = item?.canBeRaw
    ? [...realRecipes, MINE_PSEUDO_RECIPE(node.itemId)]
    : realRecipes.length > 1 ? realRecipes : null;
  const pickerSelectedId = node.recipe?.id ?? (node.manuallyMined ? '__mine__' : (pickerRecipes?.[0]?.id ?? ''));

  const beltExact = node.rate / beltCapacity;
  const beltCount = Math.ceil(beltExact - 1e-9);

  return (
    <>
      <div className="tree-row">
        {/* Col 1: item */}
        <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 + depth * 22 }}>
          <button
            className={`tree-caret${hasChildren ? '' : ' leaf'}`}
            onClick={() => hasChildren && toggle(node.path)}
            aria-label={isOpen ? 'collapse' : 'expand'}
          >
            {hasChildren ? (isOpen ? '▾' : '▸') : '•'}
          </button>
          <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '❓'} size={22} className="tree-icon" />
          <span className="tree-name">{item?.name ?? node.itemId}</span>
        </span>

        {/* Col 2: rate */}
        <span className="tree-cell tree-cell-rate">{fmt(node.rate)}/min</span>

        {/* Col 3: recipe picker */}
        <span className="tree-cell tree-cell-recipe">
          {pickerRecipes && (
            <RecipePicker
              recipes={pickerRecipes}
              selectedId={pickerSelectedId}
              onSelect={recipeId => setRecipe(node.path, recipeId)}
            />
          )}
          {node.recipeOverridden && (
            <button className="tree-reset-btn" onClick={() => clearRecipe(node.path)} title="Reset to default recipe">↺</button>
          )}
        </span>

        {/* Col 4: machine tier */}
        <span className="tree-cell tree-cell-machine">
          {node.recipe && currentTier && catDef ? (
            <>
              {machineTiers!.length > 1 ? (
                <TierPicker
                  tiers={machineTiers!}
                  selectedId={node.tierId ?? ''}
                  onSelect={tierId => setTier(node.path, tierId)}
                  isOverridden={isTierOverridden}
                />
              ) : (
                <>
                  <SpriteIcon spriteId={currentTier.spriteId} fallback={catDef.icon} size={16} />
                  <span className="tree-machine-name">{currentTier.label}</span>
                </>
              )}
              {isTierOverridden && (
                <button className="tree-reset-btn" onClick={() => clearTier(node.path)} title="Reset to default tier">↺</button>
              )}
            </>
          ) : node.cyclic ? (
            <span className="tree-tag cyclic">↻ cyclic</span>
          ) : node.manuallyMined ? (
            <span className="tree-tag raw">⛏ mined</span>
          ) : !node.recipe ? (
            <span className="tree-tag raw">raw resource</span>
          ) : null}
        </span>

        {/* Col 5: modifier (hidden when game has no modifiers) */}
        <span className="tree-cell tree-cell-prolif">
          {node.recipe && modifierOptions.length > 1 && (
            <>
              <ModifierPicker modifierId={currentModifierId} onSelect={id => setModifier(node.path, id)} options={allowedModifiers} />
              {isModifierOverridden && (
                <button className="tree-reset-btn" onClick={() => clearModifier(node.path)} title="Reset to default modifier">↺</button>
              )}
            </>
          )}
        </span>

        {/* Col 6: machine count */}
        <span className="tree-cell tree-cell-count">
          {node.recipe && (
            <span className="tree-machine-count">
              {Math.ceil(node.machines - 1e-9)}×
              <span className="tree-machine-exact"> ({fmt(node.machines)})</span>
            </span>
          )}
        </span>

        {/* Col 7: belt count */}
        <span className="tree-cell tree-cell-belts">
          {node.rate > 0 && (
            <span className="tree-belt-count">
              {beltCount}×
              <span className="tree-machine-exact"> ({fmt(beltExact)})</span>
            </span>
          )}
        </span>

        {/* Col 8: byproducts */}
        <span className="tree-cell tree-cell-byproducts">
          {node.byproducts.length > 0 && (
            <span className="tree-byproducts">
              +{node.byproducts.map(b =>
                `${fmt(b.rate)} ${itemById[b.itemId]?.name ?? b.itemId}`).join(', ')}
            </span>
          )}
        </span>
      </div>

      {isOpen && node.children.map(c => (
        <TreeRow key={c.path} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} />
      ))}
    </>
  );
}

// ── Main calculator ───────────────────────────────────────────────────────────

export function ProductionCalculator({ gameData, gameLabel, gameIcon, onBack }: {
  gameData: GameData; gameLabel: string; gameIcon: string; onBack: () => void;
}) {
  const { itemById, craftableItems, recipesByOutput, recipeByOutput, machineTiers, machines, beltTiers, sorterTiers, modifierOptions, features } = gameData;

  const tierCats = Object.keys(machineTiers).filter(cat => cat !== 'raw' && machineTiers[cat].length > 1);

  const [targetId, setTargetId] = useState(craftableItems[0]?.id ?? '');
  const [rateStr, setRateStr]   = useState('60');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [defaultTierIds, setDefaultTierIds] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const cat of Object.keys(machineTiers)) d[cat] = machineTiers[cat][0].id;
    return d;
  });

  const [activeTab, setActiveTab] = useState<'tree' | 'oil'>('tree');

  const [selectedBeltId, setSelectedBeltId] = useState(beltTiers[0]?.id ?? '');
  // sorterTierId kept for future sorter-placement feature; not yet used in tree calculations
  const [selectedSorterId] = useState(sorterTiers[0]?.id ?? '');
  void selectedSorterId;

  const defaultModifierId = modifierOptions[0]?.id ?? 'none';
  const [itemTierIds,      setTier,      clearTier]      = usePathMap<string>();
  const [itemModifierIds,  setModifier,  clearModifier]  = usePathMap<string>();
  const [selectedRecipes,  setRecipe,    clearRecipe]    = usePathMap<string>();
  const [defaultRecipeIds, setDefaultRecipeIds] = useState<Record<string, string>>({});
  const [currentDefaultModifierId, setDefaultModifierId] = useState(defaultModifierId);

  const setDefaultTier   = (cat: string, tierId: string) =>
    setDefaultTierIds(prev => ({ ...prev, [cat]: tierId }));
  const setDefaultRecipe = (id: string, recipeId: string) =>
    setDefaultRecipeIds(prev => ({ ...prev, [id]: recipeId }));

  const beltTier     = beltTiers.find(t => t.id === selectedBeltId) ?? beltTiers[0];
  const beltCapacity = beltTier.speed;
  const rate = Math.max(0, parseFloat(rateStr) || 0);

  const tree = useMemo(() => {
    if (!recipeByOutput[targetId] || rate <= 0) return null;
    const cfg: TreeBuildConfig = {
      defaultTierIds, itemTierIds, selectedRecipes, defaultRecipeIds,
      defaultModifierId: currentDefaultModifierId, itemModifierIds,
      itemById, recipesByOutput, machineTiers, modifierOptions,
    };
    return buildTree(targetId, rate, cfg, new Set(), '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, rate, defaultTierIds, itemTierIds, selectedRecipes, defaultRecipeIds,
      currentDefaultModifierId, itemModifierIds, itemById, recipesByOutput, machineTiers, modifierOptions]);

  const itemsWithAltRecipes = useMemo(() => {
    if (!tree) return [];
    const seen = new Set<string>();
    const result: ProdItem[] = [];
    const walk = (node: TreeNode) => {
      if (!seen.has(node.itemId)) {
        seen.add(node.itemId);
        const item = itemById[node.itemId];
        const recs = recipesByOutput[node.itemId] ?? [];
        if (item && (recs.length > 1 || item.canBeRaw)) result.push(item);
      }
      node.children.forEach(walk);
    };
    walk(tree);
    return result;
  }, [tree, itemById, recipesByOutput]);

  const totals = useMemo(() => {
    if (!tree) return null;
    const t: Totals = { raw: {}, machines: {}, crafted: {} };
    aggregate(tree, t);
    return t;
  }, [tree]);

  const oilDemands = useMemo(() => {
    const sum = (id: string) => Object.values(totals?.crafted ?? {})
      .filter(e => e.itemId === id).reduce((s, e) => s + e.rate, 0);
    return { h: sum('hydrogen'), r: sum('refined-oil'), g: sum('energetic-graphite') };
  }, [totals]);

  // Expand all nodes whenever tree structure changes (not just tier/modifier tweaks).
  const structuralKey = `${targetId}:${rate}:${JSON.stringify(selectedRecipes)}:${JSON.stringify(defaultRecipeIds)}`;
  useEffect(() => {
    if (tree) setExpanded(collectPaths(tree));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey]);

  const toggleNode  = useCallback((p: string) => setExpanded(prev => {
    const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next;
  }), []);
  const collapseAll = useCallback(() => setExpanded(tree ? new Set([tree.path]) : new Set()), [tree]);
  const expandAll   = useCallback(() => { if (tree) setExpanded(collectPaths(tree)); }, [tree]);

  const treeActions: TreeActions = useMemo(() => ({
    itemTierIds, itemModifierIds, beltCapacity,
    setTier, clearTier, setModifier, clearModifier, setRecipe, clearRecipe,
  }), [itemTierIds, itemModifierIds, beltCapacity, setTier, clearTier, setModifier, clearModifier, setRecipe, clearRecipe]);

  return (
    <GameDataCtx.Provider value={gameData}>
    <div id="calc-app">
      <div id="calc-toolbar">
        <button className="game-badge-btn" onClick={onBack} title="Change game">
          {gameIcon} {gameLabel} ▾
        </button>
        <span className="calc-title">Production Calculator</span>
        <div className="spacer" />
      </div>

      <div id="calc-body">
        <div className="calc-tab-bar">
          <button className={`calc-tab${activeTab === 'tree' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('tree')}>Production Tree</button>
          {features.oilOptimiser && (
            <button className={`calc-tab${activeTab === 'oil' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('oil')}>DSP Oil Optimisation</button>
          )}
        </div>

        {activeTab === 'oil' && features.oilOptimiser ? (
          <OilOptimiser
            refinerySpeed={(machineTiers['refinery']?.find(t => t.id === defaultTierIds['refinery']) ?? machineTiers['refinery']?.[0])?.speed ?? 1}
            defaultSmelterTierId={defaultTierIds['smelter'] ?? ''}
            defaultModifierId={currentDefaultModifierId}
            treeDemands={oilDemands}
          />
        ) : (
        <><div id="calc-controls">
          <div className="calc-row">
            <div className="calc-field">
              <span className="calc-label">I want to produce</span>
              <ItemPicker items={craftableItems} selectedId={targetId} onSelect={setTargetId} />
            </div>
            <label className="calc-field">
              <span className="calc-label">Rate (per minute)</span>
              <input type="number" min={0} value={rateStr} onChange={e => setRateStr(e.target.value)} />
            </label>
          </div>

          <div className="calc-row calc-tiers-row">
            <span className="calc-tiers-label">Default tiers</span>
            {tierCats.map(cat => (
              <TierPicker key={cat} tiers={machineTiers[cat]} selectedId={defaultTierIds[cat]}
                onSelect={tierId => setDefaultTier(cat, tierId)} />
            ))}
            <span className="calc-tiers-sep" />
            <span className="calc-tiers-label">Belts</span>
            <TierPicker tiers={beltTiers} selectedId={selectedBeltId} onSelect={setSelectedBeltId} speedUnit="/m" />
            {modifierOptions.length > 1 && <>
              <span className="calc-tiers-sep" />
              <span className="calc-tiers-label">Modifier</span>
              <ModifierPicker modifierId={currentDefaultModifierId} onSelect={setDefaultModifierId} />
            </>}
          </div>

          {itemsWithAltRecipes.length > 0 && (
            <div className="calc-row calc-tiers-row">
              <span className="calc-tiers-label">Default recipes</span>
              {itemsWithAltRecipes.map(item => {
                const recs = recipesByOutput[item.id] ?? [];
                const pickerRecipes = item.canBeRaw ? [...recs, MINE_PSEUDO_RECIPE(item.id)] : recs;
                const selectedId = defaultRecipeIds[item.id] ?? pickerRecipes[0]?.id ?? '';
                return (
                  <div key={item.id} className="calc-default-recipe">
                    <span className="calc-default-recipe-label">
                      <SpriteIcon spriteId={item.spriteId} fallback={item.icon} size={14} />
                      {item.name}
                    </span>
                    <RecipePicker recipes={pickerRecipes} selectedId={selectedId}
                      onSelect={recipeId => setDefaultRecipe(item.id, recipeId)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {tree && totals ? (
          <div id="calc-results">
            <div id="calc-tree">
              <div className="tree-head">
                <span className="tree-head-title">Production Tree</span>
                <div className="tree-head-actions">
                  <button className="info-mini-btn" onClick={expandAll}>expand all</button>
                  <button className="info-mini-btn" onClick={collapseAll}>collapse all</button>
                </div>
              </div>
              <div className="tree-col-headers">
                <span className="tree-col-header">Item</span>
                <span className="tree-col-header tree-col-header-rate">Rate / min</span>
                <span className="tree-col-header">Recipe</span>
                <span className="tree-col-header">Machine</span>
                <span className="tree-col-header">{modifierOptions.length > 1 ? 'Modifier' : ''}</span>
                <span className="tree-col-header tree-col-header-count">Count</span>
                <span className="tree-col-header tree-col-header-belts">Belts</span>
                <span className="tree-col-header">Byproducts</span>
              </div>
              <TreeActionsCtx.Provider value={treeActions}>
              <div className="tree-scroll">
                <TreeRow node={tree} depth={0} expanded={expanded} toggle={toggleNode} />
              </div>
              </TreeActionsCtx.Provider>
            </div>

            <div id="calc-summary">
              <div className="summary-block">
                <div className="summary-title">Raw Resources / min</div>
                {Object.entries(totals.raw).sort((a, b) => b[1] - a[1]).map(([id, r]) => (
                  <div key={id} className="summary-row">
                    <SpriteIcon spriteId={itemById[id]?.spriteId} fallback={itemById[id]?.icon ?? '❓'} size={20} />
                    <span className="summary-name">{itemById[id]?.name ?? id}</span>
                    <span className="summary-val">{fmt(r)}</span>
                  </div>
                ))}
              </div>

              <div className="summary-block">
                <div className="summary-title">Machines (total)</div>
                {Object.entries(totals.machines).sort((a, b) => b[1] - a[1]).map(([tierId, n]) => {
                  const found = findTier(tierId, machineTiers);
                  if (!found) return null;
                  const { tier, cat } = found;
                  return (
                    <div key={tierId} className="summary-row">
                      <SpriteIcon spriteId={tier.spriteId} fallback={machines[cat]?.icon ?? '🏭'} size={20} />
                      <span className="summary-name">{tier.label}</span>
                      <span className="summary-val">
                        {Math.ceil(n - 1e-9)}
                        <span className="summary-exact"> ({fmt(n)})</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="summary-block">
                <div className="summary-title">Recipe Totals / min</div>
                {Object.values(totals.crafted).sort((a, b) => b.rate - a.rate)
                  .map(({ itemId, recipe, rate, machine, tierId }) => {
                    const item = itemById[itemId];
                    const hasAlt = (recipesByOutput[itemId]?.length ?? 0) > 1 || item?.canBeRaw;
                    const found = tierId ? findTier(tierId, machineTiers) : null;
                    const machineSprite = found?.tier.spriteId ?? (machine ? machineTiers[machine]?.[0]?.spriteId : undefined);
                    const machineName = found?.tier.label ?? (machine ? machines[machine]?.name : null);
                    return (
                      <div key={`${itemId}::${recipe.id}`} className="summary-row">
                        <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '❓'} size={20} />
                        <span className="summary-name">
                          {item?.name ?? itemId}
                          {hasAlt && <span className="summary-recipe-tag"> {recipe.label ?? 'Standard'}</span>}
                          {machineName && (
                            <span className="summary-machine-tag">
                              <SpriteIcon spriteId={machineSprite} fallback={machine ? machines[machine]?.icon : '🏭'} size={12} />
                              {machineName}
                            </span>
                          )}
                        </span>
                        <span className="summary-val">
                          {fmt(rate)}/m
                          <span className="summary-exact"> ({fmt(rate / beltCapacity)} belts)</span>
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          <div className="calc-empty">Enter a rate above to calculate the production tree.</div>
        )}
          </>)}
        </div>
    </div>
    </GameDataCtx.Provider>
  );
}
