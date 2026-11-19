// Wanted — wanted level, police pursuit, busted state.

import { createVehicle } from './vehicles.js';
import { WORLD } from './city.js';

const MAX_STARS = 5;
const CRIME_COOLDOWN = 5;
const BUSTED_RADIUS = 40;
const BUSTED_TIME = 3;
const SIGHT_RANGE = 600;
const LOSE_TIME = 10;
const DECAY_TIME = 15;
const POLICE_COLOR = '#f8fafc';
const POLICE_MAX_SPEED = 280;

export function createWanted() {
  return {
    level: 0,
    maxLevelReached: 0,
    crimeCooldown: 0,
    police: [],
    bustedTimer: 0,
    busted: false,
    decayTimer: 0,
  };
}

/** A crime: steal a car, hit a car, hit a pedestrian. +1 star, shared cooldown. */
export function addCrime(wanted) {
  if (wanted.crimeCooldown > 0) return;
  wanted.crimeCooldown = CRIME_COOLDOWN;
  wanted.level = Math.min(MAX_STARS, wanted.level + 1);
  wanted.maxLevelReached = Math.max(wanted.maxLevelReached, wanted.level);
  wanted.decayTimer = 0;
}

function spawnPolice(wanted, city, player, camera) {
  // Spawn on a road just outside the camera view, driving toward the player.
  const viewW = camera.viewW ?? 1280;
  const viewH = camera.viewH ?? 720;
  const margin = 80;
  const candidates = [];
  for (const r of city.roads) {
    if (r.dir === 'h') {
      const y = r.y1;
      if (y > camera.y - margin && y < camera.y + viewH + margin) {
        // Spawn left or right of view
        candidates.push({ x: camera.x - margin, y, angle: 0 });
        candidates.push({ x: camera.x + viewW + margin, y, angle: Math.PI });
      }
    } else {
      const x = r.x1;
      if (x > camera.x - margin && x < camera.x + viewW + margin) {
        candidates.push({ x, y: camera.y - margin, angle: Math.PI / 2 });
        candidates.push({ x, y: camera.y + viewH + margin, angle: -Math.PI / 2 });
      }
    }
  }
  if (!candidates.length) return;
  const c = candidates[(wanted.level + wanted.police.length) % candidates.length];
  const v = createVehicle(c.x, c.y, POLICE_COLOR, c.angle, true);
  v.speed = 100;
  v.isPolice = true;
  v.siren = true;
  v.lostTimer = 0;
  v.stopped = false;
  wanted.police.push(v);
}

export function updateWanted(wanted, player, city, camera, dt, rng) {
  wanted.crimeCooldown = Math.max(0, wanted.crimeCooldown - dt);

  if (wanted.busted) return { busted: false };

  const result = { busted: false, decayed: false, policeGaveUp: false };

  // Spawn police while wanted
  const maxPolice = wanted.level > 0 ? wanted.level + 1 : 0;
  if (wanted.police.length < maxPolice) {
    spawnPolice(wanted, city, player, camera);
  }

  // Update each police car
  for (const cop of wanted.police) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (cop.stopped) {
      // Stopped cars stay stopped; they count as out of the chase.
      cop.speed *= 0.9;
      continue;
    }

    if (dist <= SIGHT_RANGE) {
      cop.lostTimer = 0;
      // Steer toward the player.
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += Math.max(-2.5 * dt, Math.min(2.5 * dt, diff));
      // Slightly faster than the player's car at low stars, slower at high.
      const targetSpeed = POLICE_MAX_SPEED;
      cop.speed += (targetSpeed - cop.speed) * 2 * dt;
    } else {
      cop.lostTimer += dt;
      // Keep driving in the last direction, looking for the player.
      cop.speed += (120 - cop.speed) * dt;
      if (cop.lostTimer > LOSE_TIME) {
        cop.gaveUp = true;
        result.policeGaveUp = true;
      }
    }

    // Move with building collision (simple: on hit, stop and reverse a bit).
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    let hit = false;
    for (const c of city.colliders) {
      if (nx + cop.w / 2 > c.x && nx - cop.w / 2 < c.x + c.w &&
          ny + cop.h / 2 > c.y && ny - cop.h / 2 < c.y + c.h) { hit = true; break; }
    }
    if (hit) {
      // Slowed to a stop counts as "knocked out" of the chase after a moment.
      cop.speed *= -0.2;
    } else {
      cop.x = Math.max(cop.w / 2, Math.min(WORLD.width - cop.w / 2, nx));
      cop.y = Math.max(cop.h / 2, Math.min(WORLD.height - cop.h / 2, ny));
    }
  }

  // Remove police that gave up, or when the level drops to 0.
  const before = wanted.police.length;
  wanted.police = wanted.police.filter(cop => !cop.gaveUp);
  if (wanted.level === 0) wanted.police.length = 0;
  if (wanted.police.length < before) result.policeGaveUp = true;

  // Busted: any active cop within radius, continuously.
  let inRange = false;
  for (const cop of wanted.police) {
    if (cop.stopped || cop.gaveUp) continue;
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    if (dx * dx + dy * dy <= BUSTED_RADIUS * BUSTED_RADIUS) { inRange = true; break; }
  }
  if (inRange && wanted.level > 0) {
    wanted.bustedTimer += dt;
    if (wanted.bustedTimer >= BUSTED_TIME) {
      wanted.busted = true;
      result.busted = true;
      return result;
    }
  } else {
    wanted.bustedTimer = 0;
  }

  // Decay: no active cop has the player in sight -> lose a star every DECAY_TIME.
  const seen = wanted.police.some(cop => {
    if (cop.stopped || cop.gaveUp) return false;
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    return dx * dx + dy * dy <= SIGHT_RANGE * SIGHT_RANGE;
  });
  if (wanted.level > 0 && !seen) {
    wanted.decayTimer += dt;
    if (wanted.decayTimer >= DECAY_TIME) {
      wanted.decayTimer = 0;
      wanted.level -= 1;
      result.decayed = true;
    }
  } else if (wanted.level > 0) {
    wanted.decayTimer = 0;
  }

  return result;
}

/** Called when the player's car rams a cop: knock the cop out of the chase. */
export function stopCop(cop) {
  if (!cop) return;
  cop.stopped = true;
  cop.speed = 0;
}

export function resetWanted(wanted) {
  wanted.level = 0;
  wanted.crimeCooldown = 0;
  wanted.police.length = 0;
  wanted.bustedTimer = 0;
  wanted.busted = false;
  wanted.decayTimer = 0;
}
