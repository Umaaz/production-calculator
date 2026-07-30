// Dropdown whose options carry an icon, a name and a line of detail.
//
// Game-agnostic: options are plain data and the icon renderer is injected, so
// this works for machines, belts, recipes — anything with a sprite and a label.
//
// The panel is portalled and fixed-positioned rather than absolutely placed
// inside the trigger, so it is never clipped by an ancestor's overflow.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { ComponentType, ReactNode } from 'react';

export interface PickerIconProps {
  id: number;
  size?: number;
}

export type PickerKey = string | number;

export interface PickerOption {
  /** Stable identity, returned by onChange. */
  key: PickerKey;
  name: string;
  /** Sprite id passed to the injected Icon. Omit for a text-only option. */
  iconId?: number;
  /** Secondary line — speed, power draw, throughput. */
  detail?: ReactNode;
  disabled?: boolean;
}

interface Anchor {
  top: number;
  left: number;
  width: number;
}

const PANEL_MIN_WIDTH = 240;
const PANEL_MAX_HEIGHT = 320;

export function OptionPicker({
  options, value, onChange, Icon, compact, placeholder = 'Select…', label,
}: {
  options: PickerOption[];
  value: PickerKey | null;
  onChange: (key: PickerKey) => void;
  Icon?: ComponentType<PickerIconProps>;
  /** Tighter trigger for use inside table rows. */
  compact?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.key === value) ?? null;
  const open = anchor !== null;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, PANEL_MIN_WIDTH);
    const below = window.innerHeight - r.bottom;
    // Flip above when the panel would not fit below and there is more room up.
    const top = below < PANEL_MAX_HEIGHT && r.top > below
      ? Math.max(4, r.top - Math.min(PANEL_MAX_HEIGHT, r.top - 4))
      : r.bottom + 4;
    setAnchor({
      top,
      left: Math.min(r.left, window.innerWidth - width - 8),
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setAnchor(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAnchor(null); };
    // A fixed panel does not travel with a scrolling ancestor, so close rather
    // than let it drift away from its trigger. Capture catches inner scrollers.
    const onScroll = () => setAnchor(null);

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const panel = open && anchor ? ReactDOM.createPortal(
    <div
      ref={panelRef}
      className="op-panel"
      role="listbox"
      style={{
        top: anchor.top,
        left: anchor.left,
        width: anchor.width,
        maxHeight: PANEL_MAX_HEIGHT,
      }}
    >
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          role="option"
          aria-selected={o.key === value}
          disabled={o.disabled}
          className={`op-option${o.key === value ? ' is-selected' : ''}`}
          onClick={() => { onChange(o.key); setAnchor(null); }}
        >
          {Icon && o.iconId !== undefined && <Icon id={o.iconId} size={26} />}
          <span className="op-option-text">
            <span className="op-option-name">{o.name}</span>
            {o.detail && <span className="op-option-detail">{o.detail}</span>}
          </span>
        </button>
      ))}
      {options.length === 0 && <div className="op-empty">Nothing to choose.</div>}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        className={`op-trigger${compact ? ' is-compact' : ''}`}
        onClick={() => (open ? setAnchor(null) : place())}
      >
        {Icon && selected?.iconId !== undefined && (
          <Icon id={selected.iconId} size={compact ? 18 : 22} />
        )}
        <span className="op-trigger-text">
          <span className="op-trigger-name">{selected?.name ?? placeholder}</span>
          {!compact && selected?.detail && (
            <span className="op-trigger-detail">{selected.detail}</span>
          )}
        </span>
        <span className="op-caret">▾</span>
      </button>
      {panel}
    </>
  );
}
