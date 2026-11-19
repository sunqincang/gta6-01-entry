// Pedestrians — walk the sidewalks, flee from cars, get knocked down.

const PED_SIZE = 10;
const WALK_SPEED = 40;
const FLEE_SPEED = 130;
const FLEE_RADIUS = 90;
const FLEE_TIME = 3;
const DOWN_TIME = 10;
const PED_COLORS = ['#e8b87a', '#c9a0dc', '#7ec8e3', '#f4a460', '#98fb98', '#f0c060', '#d0a0a0', '#a0c0e0'];
const DOWN_COLOR = '#9a8a7a';

export function spawnPedestrians(city, rng, count = 12) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const road = rng.pick(city.roads);
    let x, y;
    if (road.dir === 'h') {
      x = rng.range(100, 4700);
      y = road.y1 + (rng.chance(0.5) ? -34 : 34);
    } else {
      x = road.x1 + (rng.chance(0.5) ? -34 : 34);
      y = rng.range(100, city.beachY - 100);
    }
    peds.push({
      x, y,
      dir: rng.chance(0.5) ? 1 : -1,
      road,
      side: road.dir === 'h' ? (y < road.y1 ? -1 : 1) : (x < road.x1 ? -1 : 1),
      color: rng.pick(PED_COLORS),
      state: 'walk', // walk | flee | down
      fleeTimer: 0,
      downTimer: 0,
      fleeAngle: 0,
      angle: 0,
    });
  }
  return peds;
}

export function updatePedestrians(peds, player, dt) {
  const inCar = !!player.inVehicle;
  const px = player.x, py = player.y;
  const moving = inCar ? Math.abs(player.inVehicle.speed) > 40 : true;

  for (const p of peds) {
    if (p.state === 'down') {
      p.downTimer -= dt;
      if (p.downTimer <= 0) p.state = 'walk';
      continue;
    }

    // Flee trigger: player car close and moving.
    const dx = px - p.x;
    const dy = py - p.y;
    const dist2 = dx * dx + dy * dy;
    if (inCar && moving && p.state !== 'flee' && dist2 < FLEE_RADIUS * FLEE_RADIUS) {
      p.state = 'flee';
      p.fleeTimer = FLEE_TIME;
      p.fleeAngle = Math.atan2(p.y - py, p.x - px); // away from the car
    }

    if (p.state === 'flee') {
      p.fleeTimer -= dt;
      p.angle = p.fleeAngle;
      p.x += Math.cos(p.fleeAngle) * FLEE_SPEED * dt;
      p.y += Math.sin(p.fleeAngle) * FLEE_SPEED * dt;
      if (p.fleeTimer <= 0) p.state = 'walk';
      clampToWorld(p);
      continue;
    }

    // Walk along the sidewalk of their road.
    const road = p.road;
    if (road.dir === 'h') {
      p.x += p.dir * WALK_SPEED * dt;
      p.y += (road.y1 + p.side * 34 - p.y) * 0.1;
      p.angle = p.dir > 0 ? 0 : Math.PI;
      if (p.x < 40) { p.x = 40; p.dir = 1; }
      if (p.x > 4760) { p.x = 4760; p.dir = -1; }
    } else {
      p.y += p.dir * WALK_SPEED * dt;
      p.x += (road.x1 + p.side * 34 - p.x) * 0.1;
      p.angle = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (p.y < 40) { p.y = 40; p.dir = 1; }
      if (p.y > road.y2 - 40) { p.y = road.y2 - 40; p.dir = -1; }
    }
  }
}

/** Hit by a car: knock down (no gore), report true if it was a fresh knock-down. */
export function knockDown(p) {
  if (p.state === 'down') return false;
  p.state = 'down';
  p.downTimer = DOWN_TIME;
  return true;
}

export function drawPedestrians(ctx, peds, camX, camY) {
  for (const p of peds) {
    const sx = p.x - camX;
    const sy = p.y - camY;
    if (sx < -20 || sy < -20) continue;

    ctx.save();
    ctx.translate(sx, sy);

    if (p.state === 'down') {
      // Lying down: ellipse body, slightly angled.
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(2, 2, PED_SIZE * 0.9, PED_SIZE * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = DOWN_COLOR;
      ctx.beginPath();
      ctx.ellipse(0, 0, PED_SIZE * 0.9, PED_SIZE * 0.5, p.angle + 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(p.angle + Math.PI / 2);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(2, 2, PED_SIZE * 0.6, PED_SIZE * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, PED_SIZE * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#e8b87a';
      ctx.beginPath();
      ctx.arc(0, -PED_SIZE * 0.35, PED_SIZE * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function clampToWorld(p) {
  p.x = Math.max(20, Math.min(4780, p.x));
  p.y = Math.max(20, Math.min(3580, p.y));
}
