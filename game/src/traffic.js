// Traffic — AI cars following the road grid.

import { createVehicle, updateVehicle } from './vehicles.js';
import { nearestRoad, WORLD } from './city.js';

const TRAFFIC_COLORS = ['#cc3333', '#3366cc', '#e8c833', '#33aa55', '#8844cc', '#dd8833', '#2299aa', '#ffffff', '#333333'];

export function spawnTraffic(city, rng, count = 12) {
  const traffic = [];
  for (let i = 0; i < count; i++) {
    const road = rng.pick(city.roads);
    let x, y, angle;
    if (road.dir === 'h') {
      x = rng.range(100, WORLD.width - 100);
      y = road.y1 + (rng.chance(0.5) ? -15 : 15);
      angle = y < road.y1 ? 0 : Math.PI;
    } else {
      x = road.x1 + (rng.chance(0.5) ? -15 : 15);
      y = rng.range(100, city.beachY - 100);
      angle = x < road.x1 ? Math.PI / 2 : -Math.PI / 2;
    }
    const v = createVehicle(x, y, rng.pick(TRAFFIC_COLORS), angle, true);
    v.speed = 60 + rng.range(0, 60);
    v.road = road;
    traffic.push(v);
  }
  return traffic;
}

export function updateTraffic(traffic, city, dt, rng) {
  for (const v of traffic) {
    // Simple AI: follow road, turn at intersections
    v.aiTimer -= dt;

    const road = v.road;
    if (road.dir === 'h') {
      // Stay on horizontal road
      const targetY = road.y1 + (v.y < road.y1 ? -15 : 15);
      v.y += (targetY - v.y) * 0.1;
      v.x += Math.cos(v.angle) * v.speed * dt;
      // Wrap around
      if (v.x > WORLD.width + 50) v.x = -50;
      if (v.x < -50) v.x = WORLD.width + 50;
    } else {
      // Stay on vertical road
      const targetX = road.x1 + (v.x < road.x1 ? -15 : 15);
      v.x += (targetX - v.x) * 0.1;
      v.y += Math.sin(v.angle) * v.speed * dt;
      // Wrap around
      if (v.y > city.beachY + 50) v.y = -50;
      if (v.y < -50) v.y = city.beachY + 50;
    }

    // Occasionally turn at intersections
    if (v.aiTimer <= 0) {
      v.aiTimer = 2 + rng.range(0, 3);
      // Check if near an intersection
      for (const r of city.roads) {
        if (r === road) continue;
        const dist = r.dir === 'h' ? Math.abs(r.y1 - v.y) : Math.abs(r.x1 - v.x);
        if (dist < 30 && rng.chance(0.3)) {
          // Turn onto this road
          v.road = r;
          if (r.dir === 'h') {
            v.angle = rng.chance(0.5) ? 0 : Math.PI;
          } else {
            v.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          }
          break;
        }
      }
    }
  }
}
