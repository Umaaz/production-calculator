import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePersisted, usePersistedPathMap } from './usePersisted';
import ReactDOM from 'react-dom';
import type { ProdRecipe, ProdItem, GameData, PickerTab } from './gameTypes';
import {
  GameDataCtx, useGameData, useDropdown,
  SpriteIcon, TierPicker, ModifierPicker, PowerPlantPicker, PowerFuelPicker, RecipeTooltip,
} from './calcShared';
import {
  collectPaths, findTier, buildTree, aggregate, fmt, fmtPower,
  type TreeNode, type TreeBuildConfig, type Totals,
} from './treeLogic';
import { OilOptimiser, OilChainTreeEntry, solveOilChain, buildMults } from './games/dsp/OilOptimiser';
import type { OilMode, OilModifiers } from './games/dsp/OilOptimiser';
import { LayoutPlanner } from './LayoutPlanner';

// ── Path-keyed state map ──────────────────────────────────────────────────────
// Shared pattern for tier, modifier, and recipe per-path overrides.


// ── Tree actions context ──────────────────────────────────────────────────────
// Avoids prop-drilling callbacks and per-path overrides 12 levels through TreeRow.

interface TreeActions {
  gameId: string;
  itemTierIds: Record<string, string>;
  itemModifierIds: Record<string, string>;
  beltCapacity: number;
  setTier: (path: string, tierId: string) => void;
  clearTier: (path: string) => void;
  setModifier: (path: string, id: string) => void;
  clearModifier: (path: string) => void;
  setRecipe: (path: string, recipeId: string) => void;
  clearRecipe: (path: string) => void;
  checked: Set<string>;
  toggleCheck: (path: string) => void;
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

// ── Layout-based (DSP-style) grid picker ─────────────────────────────────────

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

function LayoutItemPicker({ items, selectedId, onSelect, layout, itemById }: {
  items: ProdItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  layout: PickerTab[];
  itemById: Record<string, ProdItem>;
}) {
  const { recipeByOutput } = useGameData();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [tip, setTip] = useState<{ item: ProdItem; x: number; y: number } | null>(null);

  const selected = items.find(it => it.id === selectedId) ?? items[0];
  const craftableSet = useMemo(() => new Set(items.map(it => it.id)), [items]);

  useEffect(() => {
    if (!open) { setTip(null); return; }
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const panel = open ? ReactDOM.createPortal(
    <>
      <div className="dsp-picker-backdrop" onClick={() => setOpen(false)} />
      <div className="dsp-picker-panel" onMouseLeave={() => setTip(null)}>
        <div className="dsp-picker-tabs">
          {layout.map((tab, i) => (
            <button key={i}
              className={`dsp-picker-tab${i === activeTab ? ' is-active' : ''}`}
              onClick={() => setActiveTab(i)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="dsp-picker-grid">
          {layout[activeTab].rows.map((row, ri) => (
            <div key={ri} className="dsp-picker-row">
              <span className="dsp-picker-row-label">{ROMAN[ri]}</span>
              {row.map((itemId, ci) => {
                const item = itemId ? itemById[itemId] : null;
                if (!item) {
                  return <span key={ci} className="dsp-picker-cell dsp-picker-cell--empty" />;
                }
                const craftable = craftableSet.has(item.id);
                return (
                  <button key={ci} disabled={!craftable}
                    className={`dsp-picker-cell${!craftable ? ' dsp-picker-cell--raw' : ''}${craftable && item.id === selected?.id ? ' is-selected' : ''}`}
                    onClick={craftable ? () => { onSelect(item.id); setOpen(false); } : undefined}
                    onMouseEnter={e => setTip({ item, x: e.clientX + 14, y: e.clientY + 14 })}
                    onMouseMove={e => setTip({ item, x: e.clientX + 14, y: e.clientY + 14 })}
                    onMouseLeave={() => setTip(null)}>
                    <SpriteIcon spriteId={item.spriteId} fallback={item.icon} size={46} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {tip && recipeByOutput[tip.item.id] && (
        <RecipeTooltip recipe={recipeByOutput[tip.item.id]} itemId={tip.item.id} x={tip.x} y={tip.y} />
      )}
    </>,
    document.body
  ) : null;

  return (
    <>
      <button className="item-picker-trigger" onClick={() => setOpen(o => !o)}>
        <SpriteIcon spriteId={selected?.spriteId} fallback={selected?.icon ?? '?'} size={20} />
        <span className="item-picker-trigger-name">{selected?.name}</span>
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
  const { gameId, itemTierIds, itemModifierIds, beltCapacity, setTier, clearTier, setModifier, clearModifier, setRecipe, clearRecipe, checked, toggleCheck } = useTreeActions();

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
  const pickerRecipes: ProdRecipe[] | null = node.oilOptimised ? null : (
    item?.canBeRaw
      ? [...realRecipes, MINE_PSEUDO_RECIPE(node.itemId)]
      : realRecipes.length > 1 ? realRecipes : null
  );
  const pickerSelectedId = node.recipe?.id ?? (node.manuallyMined ? '__mine__' : (pickerRecipes?.[0]?.id ?? ''));

  const beltExact = node.rate / beltCapacity;
  const beltCount = Math.ceil(beltExact - 1e-9);
  const isChecked = checked.has(node.path);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const showTip = node.recipe && !node.oilOptimised && !node.manuallyMined;

  return (
    <>
      <div className={`tree-row${isChecked ? ' is-checked' : ''}`}>
        {/* Col 1: item */}
        <span className="tree-cell tree-cell-item" style={{ paddingLeft: 8 + depth * 22 }}>
          <button
            className={`tree-caret${hasChildren ? '' : ' leaf'}`}
            onClick={() => hasChildren && toggle(node.path)}
            aria-label={isOpen ? 'collapse' : 'expand'}
          >
            {hasChildren ? (isOpen ? '▾' : '▸') : '•'}
          </button>
          <span
            className="tree-item-label"
            onMouseEnter={e => showTip && setTipPos({ x: e.clientX + 14, y: e.clientY + 14 })}
            onMouseMove={e => showTip && setTipPos({ x: e.clientX + 14, y: e.clientY + 14 })}
            onMouseLeave={() => setTipPos(null)}
          >
            <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '❓'} size={22} className="tree-icon" />
            <span className="tree-name">{item?.name ?? node.itemId}</span>
          </span>
          {tipPos && node.recipe && (
            <RecipeTooltip recipe={node.recipe} itemId={node.itemId} x={tipPos.x} y={tipPos.y} />
          )}
          {depth > 0 && node.recipe && !node.oilOptimised && (
            <button
              className="tree-open-btn"
              title={`Open ${item?.name ?? node.itemId} subtree in new tab`}
              onClick={e => {
                e.stopPropagation();
                const base = window.location.href.split('?')[0];
                const p = new URLSearchParams({ game: gameId, item: node.itemId, rate: String(node.rate) });
                window.open(`${base}?${p}`, '_blank');
              }}
            >↗</button>
          )}
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
          ) : node.oilOptimised ? (
            <span className="tree-tag oil">⚗ Oil Chain</span>
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

        {/* Col 7: power */}
        <span className="tree-cell tree-cell-power">
          {node.powerKW > 0 && fmtPower(node.powerKW)}
        </span>

        {/* Col 8: belt count */}
        <span className="tree-cell tree-cell-belts">
          {node.rate > 0 && (
            <span className="tree-belt-count">
              {beltCount}×
              <span className="tree-machine-exact"> ({fmt(beltExact)})</span>
            </span>
          )}
        </span>

        {/* Col 9: byproducts */}
        <span className="tree-cell tree-cell-byproducts">
          {node.byproducts.length > 0 && (
            <span className="tree-byproducts">
              +{node.byproducts.map(b =>
                `${fmt(b.rate)} ${itemById[b.itemId]?.name ?? b.itemId}`).join(', ')}
            </span>
          )}
        </span>

        {/* Col 10: done checkmark */}
        <span className="tree-cell tree-cell-check">
          <button
            className={`tree-check-btn${isChecked ? ' is-checked' : ''}`}
            onClick={() => toggleCheck(node.path)}
            title={isChecked ? 'Mark incomplete' : 'Mark complete'}
          >✓</button>
        </span>
      </div>

      {isOpen && node.children.map(c => (
        <TreeRow key={c.path} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} />
      ))}
    </>
  );
}

// ── Main calculator ───────────────────────────────────────────────────────────

const OIL_CHAIN_ITEM_IDS = new Set(['hydrogen', 'refined-oil', 'energetic-graphite']);

export function ProductionCalculator({ gameId, gameData, gameLabel, gameIcon, gameImg, onBack }: {
  gameId: string; gameData: GameData; gameLabel: string; gameIcon: string; gameImg?: string; onBack: () => void;
}) {
  const { itemById, craftableItems, recipesByOutput, recipeByOutput, machineTiers, machines, beltTiers, sorterTiers, modifierOptions, powerPlants, powerFuels, features } = gameData;

  const tierCats = Object.keys(machineTiers).filter(cat => cat !== 'raw' && machineTiers[cat].length > 1);

  // Namespace every persisted key by game so switching games doesn't bleed state.
  const K = (suffix: string) => `pcalc:${gameId}:${suffix}`;

  type Target = { itemId: string; rateStr: string };
  const [targets, setTargets] = usePersisted<Target[]>(K('targets'), [
    { itemId: craftableItems[0]?.id ?? '', rateStr: '60' },
  ]);

  const updateTarget = useCallback((i: number, patch: Partial<Target>) =>
    setTargets(ts => ts.map((t, j) => j === i ? { ...t, ...patch } : t)), [setTargets]);
  const removeTarget = useCallback((i: number) =>
    setTargets(ts => ts.length > 1 ? ts.filter((_, j) => j !== i) : ts), [setTargets]);
  const addTarget = useCallback(() =>
    setTargets(ts => [...ts, { itemId: craftableItems[0]?.id ?? '', rateStr: '60' }]),
    [setTargets, craftableItems]);

  // Apply ?item= and ?rate= query params on first load (e.g. when opening a subtree link).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const qi = p.get('item'); const qr = p.get('rate');
    if (qi && craftableItems.some(c => c.id === qi)) {
      setTargets(ts => {
        const next = [...ts];
        next[0] = { itemId: qi, rateStr: qr && isFinite(parseFloat(qr)) ? qr : (next[0]?.rateStr ?? '60') };
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selfSprayProlif, setSelfSprayProlif] = usePersisted(K('selfSprayProlif'), false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [defaultTierIds, setDefaultTierIds] = usePersisted<Record<string, string>>(K('defaultTierIds'), () => {
    const d: Record<string, string> = {};
    for (const cat of Object.keys(machineTiers)) d[cat] = machineTiers[cat][0].id;
    return d;
  });

  const [activeTab, setActiveTab] = usePersisted<'tree' | 'oil' | 'layout'>(K('activeTab'), 'tree');

  const [selectedBeltId, setSelectedBeltId] = usePersisted(K('selectedBeltId'), beltTiers[0]?.id ?? '');
  // sorterTierId kept for future sorter-placement feature; not yet used in tree calculations
  const [selectedSorterId] = useState(sorterTiers[0]?.id ?? '');
  void selectedSorterId;

  const defaultModifierId = modifierOptions[0]?.id ?? 'none';
  const [itemTierIds,      setTier,      clearTier]      = usePersistedPathMap<string>(K('itemTierIds'));
  const [itemModifierIds,  setModifier,  clearModifier]  = usePersistedPathMap<string>(K('itemModifierIds'));
  const [selectedRecipes,  setRecipe,    clearRecipe]    = usePersistedPathMap<string>(K('selectedRecipes'));
  const [defaultRecipeIds, setDefaultRecipeIds] = usePersisted<Record<string, string>>(K('defaultRecipeIds'), {});
  const [currentDefaultModifierId, setDefaultModifierId] = usePersisted(K('defaultModifierId'), defaultModifierId);

  // Oil chain config — shared between the oil tab and the tree's oil chain entry.
  const [oilMode, setOilMode] = usePersisted<OilMode>(K('oilMode'), 'buildings');
  const [oilSmelterTierId, setOilSmelterTierId] = usePersisted(K('oilSmelterTierId'), machineTiers['smelter']?.[0]?.id ?? '');
  const [oilDefaultModifierId, setOilDefaultModifierId] = usePersisted(K('oilDefaultModifierId'), defaultModifierId);
  const [oilModifierOverrides, setOilModifierOverrides] = usePersisted<Partial<OilModifiers>>(K('oilModifierOverrides'), {});
  const oilModifiers = useMemo<OilModifiers>(() => ({
    plasma:   oilModifierOverrides.plasma   ?? oilDefaultModifierId,
    xray:     oilModifierOverrides.xray     ?? oilDefaultModifierId,
    reformed: oilModifierOverrides.reformed ?? oilDefaultModifierId,
    arc:      oilModifierOverrides.arc      ?? oilDefaultModifierId,
  }), [oilDefaultModifierId, oilModifierOverrides]);
  const setOilModifier = useCallback((b: keyof OilModifiers, id: string) =>
    setOilModifierOverrides(prev => ({ ...prev, [b]: id })), [setOilModifierOverrides]);
  const clearOilModifier = useCallback((b: keyof OilModifiers) =>
    setOilModifierOverrides(prev => { const n = { ...prev }; delete n[b]; return n; }), [setOilModifierOverrides]);

  const setDefaultTier   = (cat: string, tierId: string) =>
    setDefaultTierIds(prev => ({ ...prev, [cat]: tierId }));
  const setDefaultRecipe = (id: string, recipeId: string) =>
    setDefaultRecipeIds(prev => ({ ...prev, [id]: recipeId }));

  const beltTier     = beltTiers.find(t => t.id === selectedBeltId) ?? beltTiers[0];
  const beltCapacity = beltTier.speed;

  const cfg = useMemo<TreeBuildConfig>(() => ({
    defaultTierIds, itemTierIds, selectedRecipes, defaultRecipeIds,
    defaultModifierId: currentDefaultModifierId, itemModifierIds,
    itemById, recipesByOutput, machineTiers, modifierOptions,
    oilChainItemIds: features.oilOptimiser ? OIL_CHAIN_ITEM_IDS : undefined,
    oilChainExcludedRecipeIds: features.oilOptimiser ? new Set(['r-graphite']) : undefined,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [defaultTierIds, itemTierIds, selectedRecipes, defaultRecipeIds,
      currentDefaultModifierId, itemModifierIds, itemById, recipesByOutput, machineTiers, modifierOptions, features.oilOptimiser]);

  const trees = useMemo(() =>
    targets.map(t => {
      const rate = Math.max(0, parseFloat(t.rateStr) || 0);
      if (!recipeByOutput[t.itemId] || rate <= 0) return null;
      return buildTree(t.itemId, rate, cfg, new Set(), '');
    }),
  [targets, cfg, recipeByOutput]);

  const itemsWithAltRecipes = useMemo(() => {
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
    trees.forEach(tree => { if (tree) walk(tree); });
    return result;
  }, [trees, itemById, recipesByOutput]);

  const totals = useMemo(() => {
    const valid = trees.filter(Boolean) as TreeNode[];
    if (!valid.length) return null;
    const t: Totals = { raw: {}, machines: {}, crafted: {} };
    valid.forEach(tree => aggregate(tree, t));
    return t;
  }, [trees]);

  const oilDemands = useMemo(() => {
    const demands = { h: 0, r: 0, g: 0 };
    if (!features.oilOptimiser) return demands;
    const walk = (node: TreeNode) => {
      if (node.oilOptimised) {
        if (node.itemId === 'hydrogen')            demands.h += node.rate;
        else if (node.itemId === 'refined-oil')    demands.r += node.rate;
        else if (node.itemId === 'energetic-graphite') demands.g += node.rate;
      }
      node.children.forEach(walk);
    };
    trees.forEach(tree => { if (tree) walk(tree); });
    return demands;
  }, [trees, features.oilOptimiser]);

  const treeOilSolution = useMemo(() => {
    if (!features.oilOptimiser) return null;
    const { h, r, g } = oilDemands;
    if (h + r + g === 0) return null;
    return solveOilChain(h, r, g, oilMode);
  }, [features.oilOptimiser, oilDemands, oilMode]);

  const oilPowerKW = useMemo(() => {
    if (!treeOilSolution) return 0;
    const sol = treeOilSolution;
    const mults = buildMults(modifierOptions, oilModifiers);
    const refTier     = machineTiers['refinery']?.find(t => t.id === defaultTierIds['refinery']) ?? machineTiers['refinery']?.[0];
    const smelterTier = machineTiers['smelter']?.find(t => t.id === oilSmelterTierId) ?? machineTiers['smelter']?.[0];
    const refPow     = refTier?.workPowerKW     ?? 0;
    const smelterPow = smelterTier?.workPowerKW ?? 0;
    const refSpeed   = refTier?.speed ?? 1;
    const smSpeed    = smelterTier?.speed ?? 1;
    return (sol.p > 0 ? (sol.p / (refSpeed * 15 * mults.plasma.full))   * refPow     * mults.plasma.power   : 0)
         + (sol.x > 0 ? (sol.x / (refSpeed * 15 * mults.xray.full))     * refPow     * mults.xray.power     : 0)
         + (sol.f > 0 ? (sol.f / (refSpeed * 15 * mults.reformed.full)) * refPow     * mults.reformed.power : 0)
         + (sol.a > 0 ? (sol.a / (smSpeed  * 30 * mults.arc.full))      * smelterPow * mults.arc.power      : 0);
  }, [treeOilSolution, modifierOptions, oilModifiers, machineTiers, defaultTierIds, oilSmelterTierId]);

  const totalPowerKW = useMemo(() =>
    (totals ? Object.values(totals.crafted).reduce((s, e) => s + e.powerKW, 0) : 0) + oilPowerKW,
  [totals, oilPowerKW]);

  const prolifTotals = useMemo<Record<string, number> | null>(() => {
    const tiers = features.proliferatorTiers;
    if (!tiers?.length || !trees.some(Boolean)) return null;
    const result: Record<string, number> = {};
    const cap = (tier: typeof tiers[number]) =>
      selfSprayProlif ? (tier.selfSprayCapacity ?? tier.sprayCapacity) : tier.sprayCapacity;

    const walk = (node: TreeNode) => {
      if (!node.manuallyMined && !node.cyclic && !node.oilOptimised && node.recipe) {
        const tier = tiers.find(t => node.modifierId.startsWith(t.idPrefix + '-'));
        if (tier) {
          const inputPerMin = node.children.reduce((s, c) => s + c.rate, 0);
          if (inputPerMin > 0)
            result[tier.idPrefix] = (result[tier.idPrefix] ?? 0) + inputPerMin / cap(tier);
        }
      }
      node.children.forEach(walk);
    };
    trees.forEach(tree => { if (tree) walk(tree); });

    if (treeOilSolution) {
      const sol = treeOilSolution;
      const mults = buildMults(modifierOptions, oilModifiers);
      const addOil = (modId: string, itemsPerMin: number) => {
        const tier = tiers.find(t => modId.startsWith(t.idPrefix + '-'));
        if (tier && itemsPerMin > 0)
          result[tier.idPrefix] = (result[tier.idPrefix] ?? 0) + itemsPerMin / cap(tier);
      };
      if (sol.p > 0) addOil(oilModifiers.plasma,   sol.crudeInput / mults.plasma.prod);
      if (sol.f > 0) addOil(oilModifiers.reformed, 4 * sol.f);
      if (sol.a > 0) addOil(oilModifiers.arc,      2 * sol.a / mults.arc.prod);
    }

    return Object.keys(result).length > 0 ? result : null;
  }, [trees, features.proliferatorTiers, treeOilSolution, modifierOptions, oilModifiers, selfSprayProlif]);

  const [selectedPowerPlantId, setSelectedPowerPlantId] = usePersisted(K('powerPlantId'), powerPlants[0]?.id ?? '');
  const [selectedPowerFuelId,  setSelectedPowerFuelId]  = usePersisted(K('powerFuelId'),  powerFuels[0]?.id ?? '');
  const [powerPlantPcts, setPowerPlantPcts] = usePersisted<Record<string, number>>(K('powerPlantPcts'), {});

  const selectedPlant       = powerPlants.find(p => p.id === selectedPowerPlantId) ?? powerPlants[0];
  const compatibleFuels     = selectedPlant?.fuelIds ? powerFuels.filter(f => selectedPlant.fuelIds!.includes(f.id)) : [];
  const selectedFuel        = compatibleFuels.find(f => f.id === selectedPowerFuelId) ?? compatibleFuels[0];
  const selectedPlantPct    = selectedPlant?.variableOutput ? (powerPlantPcts[selectedPlant.id] ?? 100) : 100;
  const effectivePlantKW    = selectedPlant ? selectedPlant.outputKW * selectedPlantPct / 100 : 0;
  const powerPlantsNeeded   = (selectedPlant && totalPowerKW > 0 && effectivePlantKW > 0) ? Math.ceil(totalPowerKW / effectivePlantKW - 1e-9) : 0;
  const powerFuelPerMin     = (selectedFuel && totalPowerKW > 0) ? (totalPowerKW * 60) / (selectedFuel.energyMJ * 1000) : 0;
  const setSelectedPlantPct = (pct: number) => setPowerPlantPcts(prev => ({ ...prev, [selectedPlant!.id]: Math.min(200, Math.max(0, pct)) }));

  // Expand all nodes whenever tree structure changes (not just tier/modifier tweaks).
  const structuralKey = `${JSON.stringify(targets.map(t => t.itemId + ':' + t.rateStr))}:${JSON.stringify(selectedRecipes)}:${JSON.stringify(defaultRecipeIds)}`;
  useEffect(() => {
    const allPaths = new Set<string>();
    trees.forEach(tree => { if (tree) collectPaths(tree).forEach(p => allPaths.add(p)); });
    if (allPaths.size) setExpanded(allPaths);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey]);

  const toggleNode  = useCallback((p: string) => setExpanded(prev => {
    const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next;
  }), []);
  const collapseAll = useCallback(() =>
    setExpanded(new Set(trees.filter(Boolean).map(t => t!.path))), [trees]);
  const expandAll   = useCallback(() => {
    const allPaths = new Set<string>();
    trees.forEach(tree => { if (tree) collectPaths(tree).forEach(p => allPaths.add(p)); });
    setExpanded(allPaths);
  }, [trees]);

  const [checkedPaths, setCheckedPaths] = usePersisted<string[]>(K('checkedPaths'), []);
  const checked = useMemo(() => new Set(checkedPaths), [checkedPaths]);
  const toggleCheck  = useCallback((p: string) => setCheckedPaths(prev => {
    if (prev.includes(p)) return prev.filter(x => x !== p); else return [...prev, p];
  }), [setCheckedPaths]);
  const clearChecked = useCallback(() => setCheckedPaths([]), [setCheckedPaths]);
  const resetAll = useCallback(() => {
    const prefix = `pcalc:${gameId}:`;
    Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
    window.location.reload();
  }, [gameId]);

  const treeActions: TreeActions = useMemo(() => ({
    gameId, itemTierIds, itemModifierIds, beltCapacity,
    setTier, clearTier, setModifier, clearModifier, setRecipe, clearRecipe,
    checked, toggleCheck,
  }), [gameId, itemTierIds, itemModifierIds, beltCapacity, setTier, clearTier, setModifier, clearModifier, setRecipe, clearRecipe, checked, toggleCheck]);

  return (
    <GameDataCtx.Provider value={gameData}>
    <div id="calc-app">
      <div id="calc-toolbar">
        <button className="game-badge-btn" onClick={onBack} title="Change game">
          {gameImg && <img src={`${process.env.PUBLIC_URL}/${gameImg}`} alt="" className="game-badge-bg" />}
          <span className="game-badge-label">
            {!gameImg && gameIcon} {gameLabel} ▾
          </span>
        </button>
        <span className="calc-title">Production Calculator</span>
        <div className="spacer" />
        <a className="toolbar-github-link" href="https://github.com/Umaaz/production-calculator" target="_blank" rel="noopener noreferrer" title="View on GitHub">
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        </a>
        <button className="toolbar-reset-btn" onClick={resetAll} title="Reset all settings to defaults">Reset</button>
      </div>

      <div id="calc-body">
        <div className="calc-tab-bar">
          <button className={`calc-tab${activeTab === 'tree' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('tree')}>Production Tree</button>
          {features.oilOptimiser && (
            <button className={`calc-tab${activeTab === 'oil' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('oil')}>DSP Oil Optimisation</button>
          )}
          {trees[0] && (
            <button className={`calc-tab${activeTab === 'layout' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('layout')}>Layout</button>
          )}
        </div>

        {activeTab === 'layout' && trees[0] ? (
          <LayoutPlanner tree={trees[0]} gameData={gameData} />
        ) : activeTab === 'oil' && features.oilOptimiser ? (
          <OilOptimiser
            refinerySpeed={(machineTiers['refinery']?.find(t => t.id === defaultTierIds['refinery']) ?? machineTiers['refinery']?.[0])?.speed ?? 1}
            treeDemands={oilDemands}
            beltCapacity={beltCapacity}
            mode={oilMode}
            onModeChange={setOilMode}
            smelterTierId={oilSmelterTierId}
            onSmelterTierChange={setOilSmelterTierId}
            defaultModifierId={oilDefaultModifierId}
            onDefaultModifierChange={setOilDefaultModifierId}
            modifiers={oilModifiers}
            overrides={oilModifierOverrides}
            onModifierChange={setOilModifier}
            onModifierClear={clearOilModifier}
          />
        ) : (
        <><div id="calc-controls">
          <div className="calc-row calc-targets-row">
            <span className="calc-label">I want to produce</span>
            <div className="calc-targets-list">
              {targets.map((t, i) => (
                <div key={i} className="calc-target-entry">
                  {features.pickerLayout
                    ? <LayoutItemPicker items={craftableItems} selectedId={t.itemId}
                        onSelect={id => updateTarget(i, { itemId: id })}
                        layout={features.pickerLayout} itemById={itemById} />
                    : <ItemPicker items={craftableItems} selectedId={t.itemId}
                        onSelect={id => updateTarget(i, { itemId: id })} />
                  }
                  <input className="calc-target-rate" type="number" min={0} value={t.rateStr}
                    onChange={e => updateTarget(i, { rateStr: e.target.value })} />
                  <span className="calc-target-unit">/min</span>
                  {targets.length > 1 && (
                    <button className="calc-target-remove" onClick={() => removeTarget(i)} title="Remove">×</button>
                  )}
                </div>
              ))}
              <button className="calc-target-add" onClick={addTarget}>+ Add item</button>
            </div>
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

        {trees.some(Boolean) && totals ? (
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
                <span className="tree-col-header tree-col-header-power">Power</span>
                <span className="tree-col-header tree-col-header-belts">Belts</span>
                <span className="tree-col-header">Byproducts</span>
                <span className="tree-col-header tree-col-header-check">
                  {checkedPaths.length > 0 && (
                    <button className="tree-check-reset" onClick={clearChecked} title="Reset all marks">↺</button>
                  )}
                </span>
              </div>
              <TreeActionsCtx.Provider value={treeActions}>
              <div className="tree-scroll">
                {trees.map((tree, i) => tree && (
                  <React.Fragment key={i}>
                    {trees.length > 1 && (
                      <div className="tree-section-divider">
                        <SpriteIcon spriteId={itemById[targets[i].itemId]?.spriteId} fallback={itemById[targets[i].itemId]?.icon ?? '❓'} size={14} />
                        {itemById[targets[i].itemId]?.name ?? targets[i].itemId}
                        <span className="tree-section-rate">{fmt(Math.max(0, parseFloat(targets[i].rateStr) || 0))}/min</span>
                      </div>
                    )}
                    <TreeRow node={tree} depth={0} expanded={expanded} toggle={toggleNode} />
                  </React.Fragment>
                ))}
                {treeOilSolution && (
                  <OilChainTreeEntry
                    solution={treeOilSolution}
                    refinerySpeed={(machineTiers['refinery']?.find(t => t.id === defaultTierIds['refinery']) ?? machineTiers['refinery']?.[0])?.speed ?? 1}
                    smelterTierId={oilSmelterTierId}
                    beltCapacity={beltCapacity}
                    demands={oilDemands}
                    defaultModifierId={oilDefaultModifierId}
                    onDefaultModifierChange={setOilDefaultModifierId}
                    modifiers={oilModifiers}
                    overrides={oilModifierOverrides}
                    onModifierChange={setOilModifier}
                    onModifierClear={clearOilModifier}
                  />
                )}
              </div>
              </TreeActionsCtx.Provider>
            </div>

            <div id="calc-summary">
              {prolifTotals && features.proliferatorTiers && (
                <div className="summary-block">
                  <div className="summary-title">
                    Proliferators / min
                    <button
                      className={`prolif-selfspray-btn${selfSprayProlif ? ' active' : ''}`}
                      onClick={() => setSelfSprayProlif((v: boolean) => !v)}
                      title={selfSprayProlif ? 'Self-spray ON: using boosted spray capacity' : 'Self-spray OFF: click to account for proliferators sprayed with Extra Products'}
                    >⊕ self-spray</button>
                  </div>
                  {features.proliferatorTiers.filter(t => prolifTotals[t.idPrefix] != null).map(t => (
                    <div key={t.idPrefix} className="summary-row">
                      <SpriteIcon spriteId={t.spriteId} fallback="🧪" size={20} />
                      <span className="summary-name">{t.label}</span>
                      <span className="summary-val">{fmt(prolifTotals[t.idPrefix])}</span>
                    </div>
                  ))}
                </div>
              )}
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
                {(() => {
                    const entries = Object.values(totals.crafted).sort((a, b) => b.rate - a.rate);
                    return (<>
                      {totalPowerKW > 0 && (
                        <div className="summary-row summary-power-total">
                          <span className="summary-name summary-power-label">⚡ Total Power</span>
                          <span className="summary-val summary-power-val">{fmtPower(totalPowerKW)}</span>
                        </div>
                      )}
                      {entries.map(({ itemId, recipe, rate, machines: machineCount, powerKW, machine, tierId }) => {
                        const item = itemById[itemId];
                        const hasAlt = (recipesByOutput[itemId]?.length ?? 0) > 1 || item?.canBeRaw;
                        const found = tierId ? findTier(tierId, machineTiers) : null;
                        const machineSprite = found?.tier.spriteId ?? (machine ? machineTiers[machine]?.[0]?.spriteId : undefined);
                        const machineName = found?.tier.label ?? (machine ? machines[machine]?.name : null);
                        return (
                          <div key={`${itemId}::${recipe.id}`} className="summary-row summary-row-recipe">
                            <SpriteIcon spriteId={item?.spriteId} fallback={item?.icon ?? '❓'} size={30} className="summary-icon-recipe" />
                            <div className="summary-row-lines">
                              <div className="summary-line">
                                <span className="summary-name">
                                  {item?.name ?? itemId}
                                  {hasAlt && <span className="summary-recipe-tag"> {recipe.label ?? 'Standard'}</span>}
                                </span>
                                <span className="summary-val">
                                  {fmt(rate)}/m
                                  <span className="summary-exact"> ({fmt(rate / beltCapacity)} belts)</span>
                                </span>
                                <button
                                  className="tree-open-btn summary-open-btn"
                                  title={`Open ${item?.name ?? itemId} subtree in new tab`}
                                  onClick={() => {
                                    const base = window.location.href.split('?')[0];
                                    const p = new URLSearchParams({ game: gameId, item: itemId, rate: String(rate) });
                                    window.open(`${base}?${p}`, '_blank');
                                  }}
                                >↗</button>
                              </div>
                              {machineName && (
                                <div className="summary-line summary-line-machine">
                                  <span className="summary-name summary-name-machine">
                                    <SpriteIcon spriteId={machineSprite} fallback={machine ? machines[machine]?.icon : '🏭'} size={14} />
                                    {machineName}
                                  </span>
                                  <span className="summary-val summary-val-machine">
                                    {Math.ceil(machineCount - 1e-9)}×
                                    <span className="summary-exact"> ({fmt(machineCount)})</span>
                                    {powerKW > 0 && <span className="summary-power"> · {fmtPower(powerKW)}</span>}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>);
                  })()}
              </div>

              {powerPlants.length > 0 && (
                <div className="summary-block">
                  <div className="summary-title">Power Supply</div>
                  <div className="power-pickers">
                    <PowerPlantPicker
                      plants={powerPlants}
                      selectedId={selectedPowerPlantId}
                      onSelect={setSelectedPowerPlantId}
                    />
                    {compatibleFuels.length > 0 && (
                      <PowerFuelPicker
                        fuels={compatibleFuels}
                        selectedId={selectedFuel?.id ?? ''}
                        onSelect={setSelectedPowerFuelId}
                      />
                    )}
                    {selectedPlant?.variableOutput && (
                      <label className="power-pct-label">
                        <input
                          type="number" min={0} max={200} step={1}
                          className="power-pct-input"
                          value={selectedPlantPct}
                          onChange={e => setSelectedPlantPct(Number(e.target.value))}
                        />
                        <span className="power-pct-unit">%</span>
                      </label>
                    )}
                  </div>
                  {selectedPlant && totalPowerKW > 0 && (
                    <div className="power-result">
                      <div className="power-result-row">
                        <SpriteIcon spriteId={selectedPlant.spriteId} fallback={selectedPlant.icon} size={20} />
                        <span className="power-result-count">{powerPlantsNeeded}×</span>
                        <span className="power-result-name">{selectedPlant.name}</span>
                        <span className="power-result-cap">{fmtPower(effectivePlantKW)} each</span>
                      </div>
                      {selectedFuel && powerFuelPerMin > 0 && (
                        <div className="power-result-row power-result-fuel">
                          <SpriteIcon spriteId={itemById[selectedFuel.id]?.spriteId ?? selectedFuel.spriteId} fallback={itemById[selectedFuel.id]?.icon ?? selectedFuel.icon} size={20} />
                          <span className="power-result-count">{fmt(powerFuelPerMin)}/m</span>
                          <span className="power-result-name">{itemById[selectedFuel.id]?.name ?? selectedFuel.name}</span>
                          <span className="power-result-cap">{selectedFuel.energyMJ} MJ each</span>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedPlant && totalPowerKW === 0 && (
                    <div className="power-result-empty">No power demand calculated yet.</div>
                  )}
                </div>
              )}
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
