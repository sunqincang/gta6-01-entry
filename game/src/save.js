// Save/Load — localStorage persistence for money and position.

const SAVE_KEY = 'sunfall-shores.save';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      playerX: state.player.x,
      playerY: state.player.y,
      seed: state.seed,
      timestamp: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage may be unavailable; silently fail
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // ignore
  }
}
