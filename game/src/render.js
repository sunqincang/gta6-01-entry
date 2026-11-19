// Render — canvas renderer: city, shadows, vehicles, pedestrians, player, camera.

import { WORLD } from './city.js';
import { drawPlayer } from './player.js';
import { drawVehicle } from './vehicles.js';
import { drawPedestrians } from './pedestrians.js';
import { drawMarker } from './missions.js';

export function createCamera() {
  return { x: 0, y: 0, targetX: 0, targetY: 0 };
}

export function updateCamera(cam, targetX, targetY, viewW, viewH) {
  cam.viewW = viewW;
  cam.viewH = viewH;
  cam.targetX = targetX - viewW / 2;
  cam.targetY = targetY - viewH / 2;
  cam.x += (cam.targetX - cam.x) * 0.12;
  cam.y += (cam.targetY - cam.y) * 0.12;
  cam.x = Math.max(0, Math.min(WORLD.width - viewW, cam.x));
  cam.y = Math.max(0, Math.min(WORLD.height - viewH, cam.y));
}

export function renderWorld(ctx, state, viewW, viewH) {
  const camX = state.camera.x;
  const camY = state.camera.y;
  const city = state.city;

  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, '#6bb8e8');
  grad.addColorStop(1, '#a8d8f0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);

  // Ground (grass)
  ctx.fillStyle = '#7ab648';
  ctx.fillRect(-camX, -camY, WORLD.width, city.beachY);

  // Beach
  const beachGrad = ctx.createLinearGradient(0, city.beachY - camY - 60, 0, WORLD.height - camY);
  beachGrad.addColorStop(0, '#f5deb3');
  beachGrad.addColorStop(0.3, '#f0d8a0');
  beachGrad.addColorStop(1, '#e8c878');
  ctx.fillStyle = beachGrad;
  ctx.fillRect(-camX, city.beachY - camY, WORLD.width, WORLD.height - city.beachY);

  // Ocean
  ctx.fillStyle = '#3b9bd4';
  ctx.fillRect(-camX, WORLD.height - 120 - camY, WORLD.width + camX * 2, 120 + camY);
  // Wave lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const wy = WORLD.height - 100 + i * 25 - camY;
    ctx.beginPath();
    for (let wx = 0; wx < WORLD.width; wx += 20) {
      const y = wy + Math.sin((wx + state.clock * 40 + i * 50) * 0.02) * 4;
      if (wx === 0) ctx.moveTo(wx - camX, y);
      else ctx.lineTo(wx - camX, y);
    }
    ctx.stroke();
  }

  // Sidewalks
  ctx.fillStyle = '#c8bfa0';
  for (const r of city.roads) {
    if (r.dir === 'h') {
      const sy = r.y1 - 44 - camY;
      if (sy > viewH || sy + 88 < 0) continue;
      ctx.fillRect(-camX, sy, WORLD.width, 88);
    } else {
      const sx = r.x1 - 44 - camX;
      if (sx > viewW || sx + 88 < 0) continue;
      ctx.fillRect(sx, -camY, 88, city.beachY);
    }
  }

  // Roads
  ctx.fillStyle = '#555';
  for (const r of city.roads) {
    if (r.dir === 'h') {
      const sy = r.y1 - 40 - camY;
      if (sy > viewH || sy + 80 < 0) continue;
      ctx.fillRect(-camX, sy, WORLD.width, 80);
    } else {
      const sx = r.x1 - 40 - camX;
      if (sx > viewW || sx + 80 < 0) continue;
      ctx.fillRect(sx, -camY, 80, city.beachY);
    }
  }

  // Lane markings
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 15]);
  for (const r of city.roads) {
    if (r.dir === 'h') {
      const sy = r.y1 - camY;
      if (sy < -10 || sy > viewH + 10) continue;
      ctx.beginPath();
      ctx.moveTo(-camX, sy);
      ctx.lineTo(WORLD.width - camX, sy);
      ctx.stroke();
    } else {
      const sx = r.x1 - camX;
      if (sx < -10 || sx > viewW + 10) continue;
      ctx.beginPath();
      ctx.moveTo(sx, -camY);
      ctx.lineTo(sx, city.beachY - camY);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Building shadows
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (const b of city.buildings) {
    if (b.x + b.w + b.shadowLen < camX || b.x > camX + viewW) continue;
    if (b.y + b.h + b.shadowLen < camY || b.y > camY + viewH) continue;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w - camX, b.y + b.h - camY);
    ctx.lineTo(b.x + b.w + b.shadowLen - camX, b.y + b.h + b.shadowLen * 0.4 - camY);
    ctx.lineTo(b.x + b.shadowLen * 0.4 - camX, b.y + b.h + b.shadowLen - camY);
    ctx.lineTo(b.x - camX, b.y + b.h - camY);
    ctx.closePath();
    ctx.fill();
  }

  // Parked cars
  for (const car of city.parkedCars) {
    if (car.x + 60 < camX || car.x - 60 > camX + viewW) continue;
    if (car.y + 60 < camY || car.y - 60 > camY + viewH) continue;
    drawVehicle(ctx, car, camX, camY);
  }

  // Palm tree shadows
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (const p of city.palms) {
    if (p.x < camX - 80 || p.x > camX + viewW + 80) continue;
    if (p.y < camY - 80 || p.y > camY + viewH + 80) continue;
    ctx.beginPath();
    ctx.ellipse(p.x + 15 - camX, p.y + 10 - camY, 22, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Traffic
  for (const v of state.traffic) {
    if (v.x < camX - 60 || v.x > camX + viewW + 60) continue;
    if (v.y < camY - 60 || v.y > camY + viewH + 60) continue;
    drawVehicle(ctx, v, camX, camY);
  }

  // Police cars
  if (state.wanted) {
    for (const cop of state.wanted.police) {
      if (cop.stopped || cop.gaveUp) continue;
      if (cop.x < camX - 60 || cop.x > camX + viewW + 60) continue;
      if (cop.y < camY - 60 || cop.y > camY + viewH + 60) continue;
      drawVehicle(ctx, cop, camX, camY);
      // Siren lights
      const sx = cop.x - camX;
      const sy = cop.y - camY;
      const flash = Math.sin(state.clock * 20 + cop.x) > 0;
      ctx.fillStyle = flash ? '#ff3333' : '#3366ff';
      ctx.beginPath();
      ctx.arc(sx, sy - cop.h / 2 - 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Buildings
  for (const b of city.buildings) {
    if (b.x + b.w < camX - 10 || b.x > camX + viewW + 10) continue;
    if (b.y + b.h < camY - 10 || b.y > camY + viewH + 10) continue;
    drawBuilding(ctx, b, camX, camY);
  }

  // Pedestrians
  if (state.peds) {
    drawPedestrians(ctx, state.peds, camX, camY);
  }

  // Mission marker (light pillar)
  if (state.marker) {
    drawMarker(ctx, state.marker, camX, camY, state.clock);
  }

  // Palm trees
  for (const p of city.palms) {
    if (p.x < camX - 40 || p.x > camX + viewW + 40) continue;
    if (p.y < camY - 70 || p.y > camY + viewH + 40) continue;
    drawPalm(ctx, p, camX, camY, state.clock);
  }

  // Player
  if (!state.player.inVehicle) {
    drawPlayer(ctx, state.player, camX, camY);
  } else {
    drawVehicle(ctx, state.player.inVehicle, camX, camY);
  }

  // Enter/exit prompt
  if (state.nearCar && !state.player.inVehicle) {
    const sx = state.nearCar.x - camX;
    const sy = state.nearCar.y - camY - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press E', sx, sy);
    ctx.textAlign = 'left';
  }
}

function drawBuilding(ctx, b, camX, camY) {
  const x = b.x - camX;
  const y = b.y - camY;

  ctx.fillStyle = b.color;
  ctx.fillRect(x, y, b.w, b.h);

  // Roof
  ctx.fillStyle = b.roof;
  ctx.fillRect(x, y, b.w, 6);

  // Windows
  ctx.fillStyle = 'rgba(100,160,220,0.5)';
  const winW = 8, winH = 10, winGap = 14;
  for (let wy = y + 14; wy < y + b.h - 14; wy += winGap) {
    for (let wx = x + 8; wx < x + b.w - 8; wx += winGap) {
      ctx.fillRect(wx, wy, winW, winH);
    }
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, b.w, b.h);
}

function drawPalm(ctx, p, camX, camY, clock) {
  const x = p.x - camX;
  const y = p.y - camY;
  const sway = Math.sin(clock * 1.5 + p.x * 0.1) * 3;

  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + sway * 0.5, y - p.h * 0.5, x + sway, y - p.h);
  ctx.stroke();

  const topX = x + sway;
  const topY = y - p.h;
  ctx.fillStyle = '#2d8a2d';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + clock * 0.3;
    const fx = Math.cos(a) * 20;
    const fy = Math.sin(a) * 12 - 4;
    ctx.beginPath();
    ctx.ellipse(topX + fx * 0.5, topY + fy * 0.5, 14, 5, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3a9a3a';
  ctx.beginPath();
  ctx.arc(topX, topY, 5, 0, Math.PI * 2);
  ctx.fill();
}
