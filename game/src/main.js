// Main — game loop, input, screen states, shot/seed params.

import { generateCity, WORLD } from './city.js';
import { createPlayer, updatePlayer } from './player.js';
import { createVehicle, updateVehicle } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { createRng } from './rng.js';
import { createCamera, updateCamera, renderWorld } from './render.js';
import { drawHUD, drawMinimap } from './hud.js';
import { saveGame, loadGame } from './save.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = parseInt(params.get('seed') ?? '1', 10);
const seed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : 1;

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud-canvas');
const ctx = canvas.getContext('2d');
const hudCtx = hudCanvas.getContext('2d');

// Input state
const input = {
  keys: {},
  shift: false,
  ePressed: false,
  escPressed: false,
  enterPressed: false,
};

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  input.keys[key] = true;
  if (key === 'shift') input.shift = true;
  if (key === 'e') input.ePressed = true;
  if (key === 'escape') input.escPressed = true;
  if (key === 'enter') input.enterPressed = true;
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  input.keys[key] = false;
  if (key === 'shift') input.shift = false;
});

// Game state
let screen = 'title'; // title, playing, paused, end
let city, player, traffic, camera, state;
let money = 0;
let clock = 8 * 3600; // Start at 8:00 AM
let showControlsHint = true;
let hintTimer = 5;

function initGame() {
  city = generateCity(seed);
  const rng = createRng(seed + 100);
  traffic = spawnTraffic(city, rng, 15);
  camera = createCamera();

  // Try loading saved position
  const saved = loadGame();
  let startX = 500, startY = 500;
  if (saved && saved.seed === seed) {
    money = saved.money || 0;
    startX = saved.playerX || 500;
    startY = saved.playerY || 500;
  }

  player = createPlayer(startX, startY);
  state = { city, player, traffic, camera, clock, money, nearCar: null, showControlsHint };
}

function findNearCar() {
  if (player.inVehicle) return null;
  let nearest = null, minDist = 60;
  // Check parked cars
  for (const car of city.parkedCars) {
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) { minDist = dist; nearest = car; }
  }
  return nearest;
}

function enterExitCar() {
  if (player.inVehicle) {
    // Exit
    const v = player.inVehicle;
    player.x = v.x + Math.cos(v.angle + Math.PI / 2) * 30;
    player.y = v.y + Math.sin(v.angle + Math.PI / 2) * 30;
    player.inVehicle = null;
  } else {
    const car = findNearCar();
    if (car) {
      // Remove from parked list if it's there
      const idx = city.parkedCars.indexOf(car);
      if (idx >= 0) city.parkedCars.splice(idx, 1);
      // Create a drivable vehicle
      const v = createVehicle(car.x, car.y, car.color, car.angle);
      player.inVehicle = v;
    }
  }
}

function update(dt) {
  if (screen !== 'playing') return;

  clock += dt * 60; // 1 real second = 1 game minute
  if (clock >= 24 * 3600) clock -= 24 * 3600;

  // Controls hint fade
  if (showControlsHint) {
    hintTimer -= dt;
    if (hintTimer <= 0) showControlsHint = false;
  }

  // Enter/exit vehicle
  if (input.ePressed) {
    enterExitCar();
    input.ePressed = false;
  }

  if (player.inVehicle) {
    updateVehicle(player.inVehicle, dt, city.colliders, input);
    player.x = player.inVehicle.x;
    player.y = player.inVehicle.y;
    player.angle = player.inVehicle.angle;
  } else {
    updatePlayer(player, input, dt, city.colliders);
  }

  // Traffic
  updateTraffic(traffic, city, dt);

  // Camera
  updateCamera(camera, player.x, player.y, canvas.width, canvas.height);

  // Near car detection
  state.nearCar = findNearCar();
  state.clock = clock;
  state.money = money;
  state.showControlsHint = showControlsHint;
}

function drawTitleScreen() {
  ctx.fillStyle = '#1a2332';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Background city silhouette
  ctx.fillStyle = '#2a3a52';
  for (let i = 0; i < 20; i++) {
    const bx = i * 80 - 20;
    const bh = 100 + Math.sin(i * 0.7) * 60;
    ctx.fillRect(bx, canvas.height - 200 - bh, 60, bh + 200);
  }

  // Beach and ocean
  ctx.fillStyle = '#f0d8a0';
  ctx.fillRect(0, canvas.height - 200, canvas.width, 100);
  ctx.fillStyle = '#3b9bd4';
  ctx.fillRect(0, canvas.height - 100, canvas.width, 100);

  // Title
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SUNFALL SHORES', canvas.width / 2, 180);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('An open-world coastal city', canvas.width / 2, 230);

  // Controls
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px system-ui, sans-serif';
  const controls = [
    'WASD / Arrow Keys — Move',
    'Shift — Sprint',
    'E — Enter / Exit Vehicle',
    'Esc — Pause',
  ];
  controls.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, 320 + i * 32);
  });

  // Prompt
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('Click or Press Enter to Play', canvas.width / 2, canvas.height - 280);

  ctx.textAlign = 'left';
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 30);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Press Esc to Resume', canvas.width / 2, canvas.height / 2 + 20);
  ctx.textAlign = 'left';
}

function drawEndScreen() {
  ctx.fillStyle = '#1a2332';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION COMPLETE', canvas.width / 2, 200);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText(`$ ${money.toLocaleString()}`, canvas.width / 2, 300);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Sunfall Shores — Seed ' + seed, canvas.width / 2, 380);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Click or Press Enter to Play Again', canvas.width / 2, canvas.height - 150);
  ctx.textAlign = 'left';
}

function render() {
  // Resize canvases
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
  }

  if (screen === 'title') {
    drawTitleScreen();
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    return;
  }

  if (screen === 'end') {
    drawEndScreen();
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    return;
  }

  // Playing or paused — draw world
  renderWorld(ctx, state, canvas.width, canvas.height);

  // HUD on separate canvas
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  drawHUD(hudCtx, state, hudCanvas.width, hudCanvas.height);
  drawMinimap(hudCtx, state, hudCanvas.width, hudCanvas.height);

  if (screen === 'paused') {
    drawPauseOverlay();
  }
}

// Screenshot staging
function stageShot(name) {
  initGame();
  if (name === 'start') {
    screen = 'title';
  } else if (name === 'play') {
    screen = 'playing';
    // Position player on a road with traffic visible
    player.x = 500;
    player.y = 100;
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    showControlsHint = false;
  } else if (name === 'end') {
    screen = 'end';
    money = 12500;
  }
  // Render a few frames to settle
  let frames = 0;
  function paintShot() {
    render();
    frames++;
    if (frames < 3) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
}

// Main loop
let lastTime = 0;
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  // Handle screen transitions
  if (screen === 'title' && (input.enterPressed || input.ePressed)) {
    screen = 'playing';
    input.enterPressed = false;
    input.ePressed = false;
  }
  if (screen === 'paused' && input.escPressed) {
    screen = 'playing';
    input.escPressed = false;
  }
  if (screen === 'playing' && input.escPressed) {
    screen = 'paused';
    input.escPressed = false;
    saveGame({ money, player, seed });
  }
  if (screen === 'end' && (input.enterPressed || input.ePressed)) {
    screen = 'title';
    input.enterPressed = false;
    input.ePressed = false;
  }

  update(dt);
  render();

  input.enterPressed = false;
  input.escPressed = false;

  requestAnimationFrame(gameLoop);
}

// Click to start
canvas.addEventListener('click', () => {
  if (screen === 'title') screen = 'playing';
  else if (screen === 'end') screen = 'title';
});

// Start
if (shotParam) {
  stageShot(shotParam);
} else {
  initGame();
  screen = 'title';
  requestAnimationFrame(gameLoop);
}
