// Player — on-foot movement, collision, sprint.

import { WORLD } from './city.js';

const WALK_SPEED = 160;
const SPRINT_SPEED = 280;
const PLAYER_SIZE = 14;

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    speed: WALK_SPEED,
    angle: -Math.PI / 2, // facing up
    inVehicle: null, // vehicle object when driving
    color: '#2266dd',
  };
}

export function updatePlayer(player, input, dt, colliders) {
  if (player.inVehicle) return; // vehicle handles movement

  const sprint = input.shift;
  const spd = sprint ? SPRINT_SPEED : WALK_SPEED;
  let dx = 0, dy = 0;
  if (input.keys['w'] || input.keys['arrowup']) dy -= 1;
  if (input.keys['s'] || input.keys['arrowdown']) dy += 1;
  if (input.keys['a'] || input.keys['arrowleft']) dx -= 1;
  if (input.keys['d'] || input.keys['arrowright']) dx += 1;

  if (dx === 0 && dy === 0) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  const len = Math.sqrt(dx * dx + dy * dy);
  dx /= len; dy /= len;
  player.angle = Math.atan2(dy, dx);
  player.vx = dx * spd;
  player.vy = dy * spd;

  // Proposed new position
  let nx = player.x + player.vx * dt;
  let ny = player.y + player.vy * dt;

  // World bounds
  nx = Math.max(PLAYER_SIZE, Math.min(WORLD.width - PLAYER_SIZE, nx));
  ny = Math.max(PLAYER_SIZE, Math.min(WORLD.height - PLAYER_SIZE, ny));

  // Building collision (try each axis independently for sliding)
  const half = PLAYER_SIZE / 2;
  // X axis
  let canX = true;
  for (const c of colliders) {
    if (nx + half > c.x && nx - half < c.x + c.w && ny + half > c.y && ny - half < c.y + c.h) {
      canX = false; break;
    }
  }
  if (!canX) nx = player.x;

  // Y axis
  let canY = true;
  for (const c of colliders) {
    if (nx + half > c.x && nx - half < c.x + c.w && ny + half > c.y && ny - half < c.y + c.h) {
      canY = false; break;
    }
  }
  if (!canY) ny = player.y;

  player.x = nx;
  player.y = ny;
}

export function playerRadius() { return PLAYER_SIZE / 2; }

export function drawPlayer(ctx, player, camX, camY) {
  const sx = player.x - camX;
  const sy = player.y - camY;
  const r = PLAYER_SIZE / 2;

  // Body
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(player.angle + Math.PI / 2);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(3, 3, r + 1, r + 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a4499';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Head
  ctx.fillStyle = '#e8b87a';
  ctx.beginPath();
  ctx.arc(0, -r * 0.4, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
