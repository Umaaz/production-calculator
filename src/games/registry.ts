export interface GameEntry {
  id: string;
  label: string;
  icon: string;
  accent: string;
}

export const GAMES: GameEntry[] = [
  { id: 'dsp',          label: 'Dyson Sphere Program', icon: '🌟', accent: '#00aaff' },
  { id: 'factorio',     label: 'Factorio',              icon: '🏭', accent: '#e76d00' },
  { id: 'satisfactory', label: 'Satisfactory',          icon: '🔩', accent: '#ff9900' },
];
