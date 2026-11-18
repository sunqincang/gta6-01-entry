// Vehicles — drivable cars, enter/exit, physics.

import { WORLD } from './city.js';

const MAX_SPEED = 320;
const ACCEL = 240;
const BRAKE = 360;
const FRICTION = 0.97;
const STEER_SPEED = 2.4;
const STEER_MAX = 1.0;
const CAR_W = 44;
const CAR_H = 22;

export function createVehicle(x, y, color, angle = 0, ai = false) {
  return {
    x, y, angle, speed: 0, color,
    w: CAR_W, h: CAR_H,
    ai, // true = AI traffic car
    aiTarget: null,
    aiTimer: 0,
    alive: true,
  };
}

export function updateVehicle(v, dt, colliders, input) {
  if (v.ai) {
    // AI: maintain speed, steer toward target
    if (v.speed < 120) v.speed += ACCEL * dt;
    v.aiTimer -= dt;
    return;
  }

  // Player-driven
  if (input.keys['w'] || input.keys['arrowup']) {
    v.speed += ACCEL * dt;
  }
  if (input.keys['s'] || input.keys['arrowdown']) {
    if (v.speed > 0) v.speed -= BRAKE * dt;
    else v.speed -= ACCEL * 0.5 * dt;
  }

  // Steering
  const steerInput = (input.keys['a'] || input.keys['arrowleft']) ? -1 : (input.keys['d'] || input.keys['arrowright']) ? 1 : 0;
  const steerAmt = steerInput * STEER_MAX * Math.min(1, Math.abs(v.speed) / 60);
  v.angle += steerInput * STEER_SPEED * dt * Math.min(1, Math.abs(v.speed) / 80);

  v.speed *= FRICTION;
  v.speed = Math.max(-MAX_SPEED * 0.3, Math.min(MAX_SPEED, v.speed));

  // Move
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;

  // Collision
  if (!collides(nx, ny, v.w, v.h, v.angle, colliders)) {
    v.x = nx; v.y = ny;
  } else {
    v.speed *= -0.3;
  }

  // World bounds
  v.x = Math.max(v.w / 2, Math.min(WORLD.width - v.w / 2, v.x));
  v.y = Math.max(v.h / 2, Math.min(WORLD.height - v.h / 2, v.y));
}

function collides(cx, cy, w, h, angle, colliders) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const hw = w / 2, hh = h / 2;
  // Simplified: check 4 corners against each collider rect
  const corners = [
    [cx + cos * hw - sin * hh, cy + sin * hw + cos * hh],
    [cx - cos * hw - sin * hh, cy - sin * hw + cos * hh],
    [cx - cos * hw + sin * hh, cy - sin * hw - cos * hh],
    [cx + cos * hw + sin * hh, cy + sin * hw - cos * hh],
  ];
  for (const [px, py] of corners) {
    for (const c of colliders) {
      if (px > c.x && px < c.x + c.w && py > c.y && py < c.y + c.h) return true;
    }
  }
  return false;
}

export function drawVehicle(ctx, v, camX, camY) {
  const sx = v.x - camX;
  const sy = v.y - camY;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(v.angle);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(-v.w / 2 + 3, -v.h / 2 + 3, v.w, v.h);

  // Body
  ctx.fillStyle = v.color;
  roundRect(ctx, -v.w / 2, -v.h / 2, v.w, v.h, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Windshield
  ctx.fillStyle = 'rgba(150,200,255,0.5)';
  ctx.fillRect(v.w / 2 - 14, -v.h / 2 + 3, 10, v.h - 6);

  // Rear window
  ctx.fillStyle = 'rgba(100,150,200,0.35)';
  ctx.fillRect(-v.w / 2 + 4, -v.h / 2 + 4, 8, v.h - 8);

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
