// Main — game loop, input, screen states, shot/seed params.

import { generateCity, WORLD } from './city.js';
import { createPlayer, updatePlayer } from './player.js';
import { createVehicle, updateVehicle } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { createRng } from './rng.js';
import { createCamera, updateCamera, renderWorld } from './render.js';
import { drawHUD, drawMinimap } from './hud.js';
import { saveGame, loadGame } from './save.js';
import { createWanted, addCrime, updateWanted, stopCop, resetWanted } from './wanted.js';
import { spawnPedestrians, updatePedestrians, knockDown } from './pedestrians.js';
import { createMissions, startMission, updateMissions, activeMarker, missionInfo } from './missions.js';
import { initAudio, playPickup, playDeliver, playBusted, playButton, playWantedUp } from './audio.js';

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
  initAudio();
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
let screen = 'title';
let city, player, traffic, camera, state;
let money = 0;
let clock = 8 * 3600;
let showControlsHint = true;
let hintTimer = 5;
let endStats = null;

function makeState() {
  return { city, player, traffic, camera, clock, money, nearCar: null, showControlsHint,
    rng: null, wanted: null, missions: null, peds: null,
    banner: null, marker: null, mission: null };
}

function initGame() {
  city = generateCity(seed);
  const rng = createRng(seed + 100);
  traffic = spawnTraffic(city, rng, 15);
  camera = createCamera();

  const saved = loadGame();
  let startX = 500, startY = 500;
  if (saved && saved.seed === seed) {
    money = saved.money || 0;
    startX = saved.playerX || 500;
    startY = saved.playerY || 500;
  }

  player = createPlayer(startX, startY);
  state = makeState();
  state.rng = rng;
  state.wanted = createWanted();
  state.missions = createMissions();
  state.peds = spawnPedestrians(city, rng, 12);
}

function findNearCar() {
  if (player.inVehicle) return null;
  let nearest = null, minDist = 60;
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
    const v = player.inVehicle;
    player.x = v.x + Math.cos(v.angle + Math.PI / 2) * 30;
    player.y = v.y + Math.sin(v.angle + Math.PI / 2) * 30;
    player.inVehicle = null;
    playButton();
  } else {
    const car = findNearCar();
    if (car) {
      const idx = city.parkedCars.indexOf(car);
      if (idx >= 0) city.parkedCars.splice(idx, 1);
      const v = createVehicle(car.x, car.y, car.color, car.angle);
      player.inVehicle = v;
      addCrime(state.wanted);
      playButton();
    }
  }
}

function update(dt) {
  if (screen !== 'playing') return;

  clock += dt * 60;
  if (clock >= 24 * 3600) clock -= 24 * 3600;

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

  // Traffic (with seeded RNG)
  updateTraffic(traffic, city, dt, state.rng);

  // Pedestrians
  updatePedestrians(state.peds, player, dt);

  // Pedestrian hits by car
  if (player.inVehicle) {
    for (const p of state.peds) {
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      if (dx * dx + dy * dy < 1600) {
        if (knockDown(p)) addCrime(state.wanted);
      }
    }
  }

  // Traffic car collisions
  if (player.inVehicle) {
    for (const v of traffic) {
      const dx = v.x - player.x;
      const dy = v.y - player.y;
      if (dx * dx + dy * dy < 900) addCrime(state.wanted);
    }
  }

  // Ramming police cars
  if (player.inVehicle && state.wanted) {
    for (const cop of state.wanted.police) {
      if (cop.stopped || cop.gaveUp) continue;
      const dx = cop.x - player.x;
      const dy = cop.y - player.y;
      if (dx * dx + dy * dy < 900 && Math.abs(player.inVehicle.speed) > 60) {
        stopCop(cop);
        addCrime(state.wanted);
      }
    }
  }

  // Wanted system
  const wev = updateWanted(state.wanted, player, city, camera, dt, state.rng);
  if (wev.busted) {
    playBusted();
    state.wanted.busted = false;
    resetWanted(state.wanted);
    money = Math.max(0, money - 200);
  }

  // Missions — auto-start when near the marker
  const ms = state.missions;
  if (ms.status === 'ready' && ms.index < 3) {
    const marker = activeMarker(ms);
    if (marker) {
      const dx = player.x - marker.x;
      const dy = player.y - marker.y;
      const needCar = ms.index > 0;
      if (dx * dx + dy * dy < 2500) {
        if (!needCar || player.inVehicle) {
          startMission(ms, city, state.rng, player);
        }
      }
    }
  }

  const mev = updateMissions(ms, player, city, state.rng, dt);
  if (mev.arrived) {
    money += mev.reward;
    if (ms.index === 1) playPickup();
    else playDeliver();
  }
  if (mev.expired) {
    playBusted();
  }
  if (mev.allDone) {
    endStats = {
      earned: ms.totalEarned,
      elapsed: ms.stats.elapsed,
      completed: ms.index,
    };
    screen = 'end';
    return;
  }

  // Camera
  updateCamera(camera, player.x, player.y, canvas.width, canvas.height);

  // Reflect into state for HUD/render
  state.nearCar = findNearCar();
  state.clock = clock;
  state.money = money;
  state.showControlsHint = showControlsHint;
  state.banner = ms.banner;
  state.marker = activeMarker(ms);
  state.mission = missionInfo(ms);
}

function drawTitleScreen() {
  ctx.fillStyle = '#1a2332';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2a3a52';
  for (let i = 0; i < 20; i++) {
    const bx = i * 80 - 20;
    const bh = 100 + Math.sin(i * 0.7) * 60;
    ctx.fillRect(bx, canvas.height - 200 - bh, 60, bh + 200);
  }

  ctx.fillStyle = '#f0d8a0';
  ctx.fillRect(0, canvas.height - 200, canvas.width, 100);
  ctx.fillStyle = '#3b9bd4';
  ctx.fillRect(0, canvas.height - 100, canvas.width, 100);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SUNFALL SHORES', canvas.width / 2, 180);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('An open-world coastal city', canvas.width / 2, 230);

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
  ctx.fillText('MISSION COMPLETE', canvas.width / 2, 140);

  if (endStats) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText(`Jobs Completed: ${endStats.completed}/${endStats.completed}`, canvas.width / 2, 200);

    const mins = Math.floor(endStats.elapsed / 60);
    const secs = Math.floor(endStats.elapsed % 60);
    ctx.fillText(`Time: ${mins}:${secs.toString().padStart(2, '0')}`, canvas.width / 2, 235);
  }

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 40px system-ui, sans-serif';
  const displayMoney = endStats ? endStats.earned : money;
  ctx.fillText(`$ ${displayMoney.toLocaleString()}`, canvas.width / 2, 310);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Sunfall Shores — Seed ' + seed, canvas.width / 2, 380);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Click or Press Enter to Play Again', canvas.width / 2, canvas.height - 150);
  ctx.textAlign = 'left';
}

function render() {
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

  renderWorld(ctx, state, canvas.width, canvas.height);

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
    // Player driving a car, pedestrians visible, mission pillar, 2-star wanted
    player.x = 800;
    player.y = 400;
    // Put player in a car
    const car = city.parkedCars.find(c => c.x > 700 && c.x < 900);
    if (car) {
      const v = createVehicle(car.x, car.y, car.color, car.angle);
      player.inVehicle = v;
      const idx = city.parkedCars.indexOf(car);
      if (idx >= 0) city.parkedCars.splice(idx, 1);
    }
    // 2-star wanted with police
    state.wanted.level = 2;
    state.wanted.maxLevelReached = 2;
    // Start a mission for the marker pillar
    state.missions.status = 'active';
    state.missions.index = 0;
    state.missions.marker = { x: 1600, y: 600 };
    state.missions.timeLeft = 0;
    // Move camera
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    showControlsHint = false;
    // Tick wanted to spawn police
    updateWanted(state.wanted, player, city, camera, 0.5, state.rng);
  } else if (name === 'chase') {
    screen = 'playing';
    // Player in car being chased by police
    player.x = 1200;
    player.y = 600;
    const car = city.parkedCars.find(c => c.x > 1100 && c.x < 1300);
    if (car) {
      const v = createVehicle(car.x, car.y, car.color, car.angle);
      player.inVehicle = v;
      const idx = city.parkedCars.indexOf(car);
      if (idx >= 0) city.parkedCars.splice(idx, 1);
    }
    if (player.inVehicle) {
      player.inVehicle.speed = 200;
      player.inVehicle.angle = 0.3;
    }
    // 3-star wanted
    state.wanted.level = 3;
    state.wanted.maxLevelReached = 3;
    // Spawn police behind the player
    updateWanted(state.wanted, player, city, camera, 0.5, state.rng);
    // Position police behind
    for (const cop of state.wanted.police) {
      cop.x = player.x - 120 + Math.random() * 200;
      cop.y = player.y - 80;
      cop.angle = 0.3;
      cop.speed = 220;
    }
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    showControlsHint = false;
  } else if (name === 'end') {
    screen = 'end';
    endStats = { earned: 2500, elapsed: 185, completed: 3 };
    money = 2500;
  }
  // Render a few frames to settle
  let frames = 0;
  function paintShot() {
    // Update pedestrians for the shot
    if (screen === 'playing') {
      state.banner = state.missions.banner;
      state.marker = activeMarker(state.missions);
      state.mission = missionInfo(state.missions);
      state.clock = clock;
      state.money = money;
      state.showControlsHint = false;
    }
    render();
    frames++;
    if (frames < 4) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
}

// Main loop
let lastTime = 0;
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (screen === 'title' && (input.enterPressed || input.ePressed)) {
    initGame();
    screen = 'playing';
    endStats = null;
    money = 0;
    clock = 8 * 3600;
    showControlsHint = true;
    hintTimer = 5;
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
    initGame();
    screen = 'playing';
    endStats = null;
    money = 0;
    clock = 8 * 3600;
    showControlsHint = true;
    hintTimer = 5;
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
  initAudio();
  if (screen === 'title') {
    initGame();
    screen = 'playing';
    endStats = null;
    money = 0;
  } else if (screen === 'end') {
    initGame();
    screen = 'playing';
    endStats = null;
    money = 0;
  }
});

// Start
if (shotParam) {
  stageShot(shotParam);
} else {
  initGame();
  screen = 'title';
  requestAnimationFrame(gameLoop);
}