import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { GameData, MachineTier, PowerFuel, PowerPlant } from './gameTypes';
import { fmt } from './treeLogic';

// ── Game data context ─────────────────────────────────────────────────────────

export const GameDataCtx = React.createContext<GameData | null>(null);
export const useGameData = (): GameData => {
  const ctx = useContext(GameDataCtx);
  if (!ctx) throw new Error('useGameData must be called inside <GameDataCtx.Provider>');
  return ctx;
};

// ── Shared dropdown hook ──────────────────────────────────────────────────────

export function useDropdown() {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = useCallback((panelH: number, minWidth = 0) => {
    if (open) { setOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const top = rect.bottom + 4 + panelH > window.innerHeight
      ? rect.top - panelH - 4
      : rect.bottom + 4;
    setPanelPos({ top, left: rect.left, width: Math.max(rect.width, minWidth) });
    setOpen(true);
  }, [open]);

  return { open, close: () => setOpen(false), toggle, panelPos, triggerRef, panelRef };
}

// ── Sprite icon ───────────────────────────────────────────────────────────────
// Uses iconNamespace from context to build data-icon attributes that the
// game's CSS sprite sheet targets (e.g. [data-icon="item.1001"] for DSP).

export function SpriteIcon({ spriteId, fallback, size = 24, className }: {
  spriteId?: number; fallback: string; size?: number; className?: string;
}) {
  const { iconNamespace } = useGameData();
  if (spriteId !== undefined) {
    return (
      <span
        data-icon={`${iconNamespace}.${spriteId}`}
        className={className}
        style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }}
        aria-label={fallback}
      />
    );
  }
  return <span className={className} style={{ fontSize: size * 0.75, lineHeight: 1 }}>{fallback}</span>;
}

// ── Tier picker ───────────────────────────────────────────────────────────────

export function TierPicker({ tiers, selectedId, onSelect, isOverridden, speedUnit }: {
  tiers: MachineTier[];
  selectedId: string;
  onSelect: (tierId: string) => void;
  isOverridden?: boolean;
  speedUnit?: string;
}) {
  const { open, close, toggle, panelPos, triggerRef, panelRef } = useDropdown();
  const selected = tiers.find(t => t.id === selectedId) ?? tiers[0];

  const panel = open ? ReactDOM.createPortal(
    <div ref={panelRef} className="recipe-panel" style={{ top: panelPos.top, left: panelPos.left }}>
      {tiers.map(t => (
        <button key={t.id}
          className={`recipe-option tier-option${t.id === selected.id ? ' is-selected' : ''}`}
          onClick={() => { onSelect(t.id); close(); }}>
          <SpriteIcon spriteId={t.spriteId} fallback="🏭" size={24} />
          <span className="tier-option-info">
            <span className="recipe-option-name">{t.label}</span>
            <span className="tier-option-speed">×{t.speedDisplay ?? t.speed}{speedUnit ?? ' speed'}</span>
          </span>
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button ref={triggerRef}
        className={`recipe-trigger tier-trigger${isOverridden ? ' is-overridden' : ''}`}
        onClick={() => toggle(tiers.length * 52)}>
        <SpriteIcon spriteId={selected.spriteId} fallback="🏭" size={20} />
        <span className="tier-trigger-info">
          <span className="tier-trigger-label">{selected.label}</span>
          <span className="tier-trigger-speed">×{selected.speedDisplay ?? selected.speed}{speedUnit}</span>
        </span>
        <span className="recipe-trigger-caret">▾</span>
      </button>
      {panel}
    </>
  );
}

// ── Power plant picker ────────────────────────────────────────────────────────

export function PowerPlantPicker({ plants, selectedId, onSelect }: {
  plants: PowerPlant[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { open, close, toggle, panelPos, triggerRef, panelRef } = useDropdown();
  const selected = plants.find(p => p.id === selectedId) ?? plants[0];

  const panel = open ? ReactDOM.createPortal(
    <div ref={panelRef} className="recipe-panel" style={{ top: panelPos.top, left: panelPos.left, minWidth: panelPos.width }}>
      {plants.map(p => (
        <button key={p.id}
          className={`recipe-option tier-option${p.id === selected?.id ? ' is-selected' : ''}`}
          onClick={() => { onSelect(p.id); close(); }}>
          <SpriteIcon spriteId={p.spriteId} fallback={p.icon} size={24} />
          <span className="tier-option-info">
            <span className="recipe-option-name">{p.name}</span>
            <span className="tier-option-speed">{fmt(p.outputKW / 1000)} MW</span>
          </span>
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button ref={triggerRef} className="recipe-trigger tier-trigger power-plant-trigger"
        onClick={() => toggle(plants.length * 44, 200)}>
        <SpriteIcon spriteId={selected?.spriteId} fallback={selected?.icon ?? '🏭'} size={20} />
        <span className="tier-trigger-info">
          <span className="tier-trigger-label">{selected?.name ?? '—'}</span>
          <span className="tier-trigger-speed">{selected ? `${fmt(selected.outputKW / 1000)} MW` : ''}</span>
        </span>
        <span className="recipe-trigger-caret">▾</span>
      </button>
      {panel}
    </>
  );
}

// ── Power fuel picker ─────────────────────────────────────────────────────────

export function PowerFuelPicker({ fuels, selectedId, onSelect }: {
  fuels: PowerFuel[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { itemById } = useGameData();
  const { open, close, toggle, panelPos, triggerRef, panelRef } = useDropdown();
  const selected = fuels.find(f => f.id === selectedId) ?? fuels[0];

  const resolveIcon = (f: PowerFuel) => {
    const item = itemById[f.id];
    return { spriteId: item?.spriteId ?? f.spriteId, fallback: item?.icon ?? f.icon, name: item?.name ?? f.name };
  };

  const panel = open ? ReactDOM.createPortal(
    <div ref={panelRef} className="recipe-panel" style={{ top: panelPos.top, left: panelPos.left, minWidth: panelPos.width }}>
      {fuels.map(f => {
        const { spriteId, fallback, name } = resolveIcon(f);
        return (
          <button key={f.id}
            className={`recipe-option tier-option${f.id === selected?.id ? ' is-selected' : ''}`}
            onClick={() => { onSelect(f.id); close(); }}>
            <SpriteIcon spriteId={spriteId} fallback={fallback} size={24} />
            <span className="tier-option-info">
              <span className="recipe-option-name">{name}</span>
              <span className="tier-option-speed">{f.energyMJ} MJ</span>
            </span>
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  const { spriteId, fallback, name } = selected ? resolveIcon(selected) : { spriteId: undefined, fallback: '⛽', name: '—' };

  return (
    <>
      <button ref={triggerRef} className="recipe-trigger tier-trigger power-fuel-trigger"
        onClick={() => toggle(fuels.length * 44, 200)}>
        <SpriteIcon spriteId={spriteId} fallback={fallback} size={20} />
        <span className="tier-trigger-info">
          <span className="tier-trigger-label">{name}</span>
          <span className="tier-trigger-speed">{selected ? `${selected.energyMJ} MJ` : ''}</span>
        </span>
        <span className="recipe-trigger-caret">▾</span>
      </button>
      {panel}
    </>
  );
}

// ── Modifier picker ───────────────────────────────────────────────────────────
// Renders options from gameData.modifierOptions — works for any game that has
// production modifiers (DSP proliferators, Factorio modules/beacons, etc.).

export function ModifierPicker({ modifierId, onSelect, options }: {
  modifierId: string;
  onSelect: (id: string) => void;
  options?: import('./gameTypes').ModifierOption[]; // restricted recipes pass a filtered list
}) {
  const { modifierOptions } = useGameData();
  const opts = options ?? modifierOptions;
  const { open, close, toggle, panelPos, triggerRef, panelRef } = useDropdown();

  // When a restricted recipe has an extra-products modifier selected, resolve to its speed twin.
  const effectiveId = opts.find(o => o.id === modifierId)
    ? modifierId
    : (modifierOptions.find(o => o.id === modifierId)?.speedVariantId ?? modifierId);
  useEffect(() => {
    if (effectiveId !== modifierId) onSelect(effectiveId);
  }, [effectiveId, modifierId, onSelect]);

  const selected = opts.find(o => o.id === effectiveId) ?? opts[0];

  const panel = open ? ReactDOM.createPortal(
    <div ref={panelRef} className="recipe-panel" style={{ top: panelPos.top, left: panelPos.left }}>
      {opts.map(opt => (
        <button key={opt.id}
          className={`recipe-option tier-option${opt.id === selected?.id ? ' is-selected' : ''}`}
          onClick={() => { onSelect(opt.id); close(); }}>
          {opt.spriteId
            ? <SpriteIcon spriteId={opt.spriteId} fallback="⚗" size={24} />
            : <span style={{ width: 24, display: 'inline-block' }} />}
          <span className="tier-option-info">
            <span className="recipe-option-name">{opt.label}</span>
            {opt.detail && <span className="tier-option-speed">{opt.detail}</span>}
          </span>
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button ref={triggerRef} className="recipe-trigger tier-trigger"
        onClick={() => toggle(opts.length * 44)}>
        {selected?.spriteId
          ? <SpriteIcon spriteId={selected.spriteId} fallback="⚗" size={20} />
          : <span style={{ width: 20, display: 'inline-block' }} />}
        <span className="tier-trigger-info">
          <span className="tier-trigger-label">{selected?.label ?? '—'}</span>
          {selected?.detail && <span className="tier-trigger-speed">{selected.detail}</span>}
        </span>
        <span className="recipe-trigger-caret">▾</span>
      </button>
      {panel}
    </>
  );
}
