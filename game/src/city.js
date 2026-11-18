// City generator — road grid, buildings, palms, beach, props.

import { createRng } from './rng.js';

// World dimensions (logical units, same as canvas world coords)
export const WORLD = { width: 4800, height: 3600 };
const ROAD_WIDTH = 80;
const BLOCK_SIZE = 400; // center-to-center road spacing
const SIDEWALK = 12;
const BUILDING_COLORS = ['#d4956b', '#c97b53', '#b8865a', '#e0a87c', '#a67050', '#d1a17a', '#c48e6a', '#e8c09a'];
const ROOF_COLORS = ['#8b5e3c', '#7a4f32', '#6b4226', '#9a6b4a', '#a07050'];

function roadColor(rng) {
  return rng.pick(['#555555', '#505050', '#585858', '#4d4d4d']);
}

export function generateCity(seed) {
  const rng = createRng(seed);
  const city = {
    roads: [],
    buildings: [],
    colliders: [],
    palms: [],
    parkedCars: [],
    beachY: WORLD.height - 400,
    skyColor: '#87CEEB',
    sunColor: '#fff4d6',
  };

  // Road grid
  const hRoads = [];
  const vRoads = [];
  for (let y = 100; y < WORLD.height - 450; y += BLOCK_SIZE) {
    hRoads.push(y);
  }
  for (let x = 100; x < WORLD.width - 100; x += BLOCK_SIZE) {
    vRoads.push(x);
  }

  // Horizontal roads
  for (const y of hRoads) {
    city.roads.push({ x1: 0, y1: y, x2: WORLD.width, y2: y, dir: 'h' });
  }
  // Vertical roads
  for (const x of vRoads) {
    city.roads.push({ x1: x, y1: 0, x2: x, y2: city.beachY, dir: 'v' });
  }

  // Buildings in blocks between roads
  for (let ri = 0; ri < hRoads.length - 1; ri++) {
    const roadTop = hRoads[ri];
    const roadBot = hRoads[ri + 1];
    const blockTop = roadTop + ROAD_WIDTH / 2 + SIDEWALK;
    const blockBot = roadBot - ROAD_WIDTH / 2 - SIDEWALK;
    const blockH = blockBot - blockTop;
    if (blockH < 60) continue;

    for (let ci = 0; ci < vRoads.length - 1; ci++) {
      const roadL = vRoads[ci];
      const roadR = vRoads[ci + 1];
      const blockL = roadL + ROAD_WIDTH / 2 + SIDEWALK;
      const blockR = roadR - ROAD_WIDTH / 2 - SIDEWALK;
      const blockW = blockR - blockL;
      if (blockW < 60) continue;

      // 1-3 buildings per block
      const count = rng.int(1, 3);
      let bx = blockL + 8;
      for (let i = 0; i < count && bx < blockR - 30; i++) {
        const bw = rng.range(50, Math.min(140, blockR - bx - 16));
        const bh = rng.range(40, Math.min(100, blockH - 16));
        const by = blockTop + rng.range(4, Math.max(5, blockH - bh - 4));
        const color = rng.pick(BUILDING_COLORS);
        const roof = rng.pick(ROOF_COLORS);
        const b = {
          x: bx, y: by, w: bw, h: bh, color, roof,
          floors: rng.int(1, 4),
          shadowLen: rng.range(30, 70),
        };
        city.buildings.push(b);
        city.colliders.push({ x: b.x, y: b.y, w: b.w, h: b.h });
        bx += bw + rng.range(8, 20);
      }
    }
  }

  // Palm trees along sidewalks
  for (const road of city.roads) {
    if (road.dir === 'h') {
      for (let x = 60; x < WORLD.width - 60; x += rng.range(80, 140)) {
        city.palms.push({ x, y: road.y - ROAD_WIDTH / 2 - 4, h: 50 + rng.range(0, 20) });
        city.palms.push({ x: x + 40, y: road.y + ROAD_WIDTH / 2 + 4, h: 45 + rng.range(0, 25) });
      }
    } else {
      for (let y = 60; y < city.beachY - 60; y += rng.range(80, 140)) {
        if (!rng.chance(0.4)) continue; // fewer on vertical roads
        city.palms.push({ x: road.x - ROAD_WIDTH / 2 - 4, y, h: 50 + rng.range(0, 20) });
      }
    }
  }

  // Parked cars along horizontal roads
  for (const y of hRoads) {
    for (let x = 80; x < WORLD.width - 80; x += rng.range(120, 200)) {
      city.parkedCars.push({
        x: x, y: y - ROAD_WIDTH / 2 - 14,
        angle: 0, color: rng.pick(['#cc3333', '#3366cc', '#e8c833', '#33aa55', '#8844cc', '#dd8833', '#2299aa', '#aaa']),
        w: 44, h: 22,
      });
    }
  }

  return city;
}

// Get nearest road direction and center for a position
export function nearestRoad(city, px, py) {
  let best = null, bestDist = Infinity;
  for (const r of city.roads) {
    const d = r.dir === 'h' ? Math.abs(r.y1 - py) : Math.abs(r.x1 - px);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best;
}

export function isOnRoad(city, px, py, margin = ROAD_WIDTH / 2) {
  for (const r of city.roads) {
    if (r.dir === 'h' && Math.abs(r.y1 - py) < margin && px >= 0 && px <= WORLD.width) return true;
    if (r.dir === 'v' && Math.abs(r.x1 - px) < margin && py >= 0 && py <= city.beachY) return true;
  }
  return false;
}
