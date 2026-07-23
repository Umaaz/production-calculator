import React, { useEffect, useState } from 'react';
import { ProductionCalculator } from './ProductionCalculator';
import { GAMES } from './games/registry';
import { assembleGameData } from './assembleGameData';
import type { GameData, GameModule } from './gameTypes';
import './App.css';

const GAME_IMPORTERS: Record<string, () => Promise<GameModule>> = {
  dsp: () => import('./games/dsp/index'),
};

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
              <span className="game-card-icon">{g.icon}</span>
              <span className="game-card-label">{g.label}</span>
              <span className="game-card-count">{g.id in GAME_IMPORTERS ? 'Supported' : 'Coming soon'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId) { setGameData(null); return; }
    const importer = GAME_IMPORTERS[gameId];
    if (!importer) { setGameData(null); return; }
    setLoading(true);
    importer()
      .then(mod => { setGameData(assembleGameData(mod)); setLoading(false); })
      .catch(() => { setGameData(null); setLoading(false); });
  }, [gameId]);

  if (!gameId) return <GamePicker onSelect={setGameId} />;

  const game = GAMES.find(g => g.id === gameId);

  const toolbar = (
    <div id="calc-toolbar">
      <button className="game-badge-btn" onClick={() => setGameId(null)} title="Change game">
        {game?.icon ?? '🏭'} {game?.label ?? gameId} ▾
      </button>
      <span className="calc-title">Production Calculator</span>
      <div className="spacer" />
    </div>
  );

  if (loading) {
    return (
      <div id="calc-app">
        {toolbar}
        <div className="calc-empty">Loading…</div>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div id="calc-app">
        {toolbar}
        <div className="calc-unsupported">
          <div className="calc-unsupported-icon">🚧</div>
          <p>Recipe data for <strong>{game?.label ?? gameId}</strong> isn't available yet.</p>
          <p className="calc-unsupported-sub">Dyson Sphere Program is fully supported — pick it from the game menu.</p>
        </div>
      </div>
    );
  }

  return (
    <ProductionCalculator
      gameId={gameId}
      gameData={gameData}
      gameLabel={game?.label ?? gameId ?? ''}
      gameIcon={game?.icon ?? '🏭'}
      onBack={() => setGameId(null)}
    />
  );
}

export default App;
