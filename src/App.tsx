import React, { useEffect, useState } from 'react';
import { GAMES } from './games/registry';
import { PlannerApp } from './PlannerApp';
import type { ProductionTreeComponent, PlannerTab } from './PlannerApp';
import type { ItemSelectorComponent } from './OutputSelector';
import './App.css';

/** The components a game supplies to the planner. */
interface GameParts {
  ItemSelector: ItemSelectorComponent;
  ProductionTree: ProductionTreeComponent;
  tabs: PlannerTab[];
}

const GAME_PARTS_IMPORTERS: Record<string, () => Promise<GameParts>> = {
  dsp: () => Promise.all([
    import('./games/dsp/ItemSelector'),
    import('./games/dsp/ProductionTree'),
    import('./games/dsp/OilTab'),
  ]).then(([sel, tree, oil]) => ({
    ItemSelector: sel.ItemSelector,
    ProductionTree: tree.ProductionTree,
    tabs: [{ id: 'oil', label: 'Oil chain', Component: oil.OilTab }],
  })),
};

const REPO_URL = 'https://github.com/Umaaz/production-calculator';

/**
 * Wipe every persisted key for a game and reload.
 *
 * Keyed off the same `planner:<gameId>:` prefix the planner writes under, so it
 * stays correct as more state is added without this needing to know the names.
 * Confirmed first: it discards the whole plan, not just the settings.
 */
function resetGame(gameId: string) {
  const prefix = `planner:${gameId}:`;
  const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
  if (keys.length === 0) return;
  if (!window.confirm(
    'Reset this plan?\n\nOutputs, machine, recipe and modifier choices, and build progress will all be discarded.',
  )) return;
  keys.forEach(k => localStorage.removeItem(k));
  window.location.reload();
}

function GamePicker({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="game-picker">
      <div className="game-picker-inner">
        <h1 className="game-picker-title">🏭 Production Calculator</h1>
        <p className="game-picker-subtitle">Select a game to get started</p>
        <div className="game-picker-grid">
          {GAMES.map(g => (
            <button key={g.id} className="game-card" style={{ borderColor: g.accent }}
              onClick={() => onSelect(g.id)}>
              {g.img
                ? <img src={`${process.env.PUBLIC_URL}/${g.img}`} alt={g.label} className="game-card-img" />
                : <span className="game-card-icon">{g.icon}</span>}
              <span className="game-card-label">{g.label}</span>
              <span className="game-card-count">
                {g.id in GAME_PARTS_IMPORTERS ? 'Supported' : 'Coming soon'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Planner({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  // Held in an object so React never mistakes a component for a state updater.
  const [parts, setParts] = useState<GameParts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const importer = GAME_PARTS_IMPORTERS[gameId];
    if (!importer) { setParts(null); setFailed(true); return; }
    let live = true;
    setFailed(false);
    importer()
      .then(p => { if (live) setParts(p); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [gameId]);

  const game = GAMES.find(g => g.id === gameId);

  return (
    <>
      <div className="planner-bar">
        <button className="planner-game-btn" onClick={onBack} title="Change game">
          {game?.icon ?? '🏭'} {game?.label ?? gameId} ▾
        </button>
        <span className="planner-bar-title">Production Planner</span>
        <span className="planner-bar-spacer" />
        <a
          className="planner-gh"
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        <button className="planner-reset" onClick={() => resetGame(gameId)}
          title="Discard outputs, machine and recipe choices, and build progress">
          Reset
        </button>
      </div>
      {failed
        ? <p className="planner-note">No planner components for “{gameId}”.</p>
        : !parts
          ? <p className="planner-note">Loading {gameId}…</p>
          : <PlannerApp {...parts} storageKey={`planner:${gameId}`} />}
    </>
  );
}

function App() {
  const [gameId, setGameId] = useState<string | null>(() => {
    const g = new URLSearchParams(window.location.search).get('game');
    return g && g in GAME_PARTS_IMPORTERS ? g : null;
  });

  if (!gameId) return <GamePicker onSelect={setGameId} />;

  return <Planner gameId={gameId} onBack={() => setGameId(null)} />;
}

export default App;
