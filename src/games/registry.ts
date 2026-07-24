export interface GameEntry {
  id: string;
  label: string;
  icon: string;   // emoji fallback
  img?: string;   // banner image path (relative to public/)
  accent: string;
}

export const GAMES: GameEntry[] = [
  { id: 'dsp',          label: 'Dyson Sphere Program', icon: '🌟', img: 'game-icons/dsp.jpg',          accent: '#00aaff' },
  { id: 'factorio',     label: 'Factorio',              icon: '🏭', img: 'game-icons/factorio.jpg',     accent: '#e76d00' },
  { id: 'satisfactory', label: 'Satisfactory',          icon: '🔩', img: 'game-icons/satisfactory.jpg', accent: '#ff9900' },
];
