// Missions — three chained courier jobs with marker pillars and rewards.

const MISSIONS = [
  {
    title: 'Pick up the package',
    kind: 'pickup',
    reward: 500,
  },
  {
    title: 'Deliver downtown — 60s',
    kind: 'deliver',
    reward: 800,
    timeLimit: 60,
  },
  {
    title: 'One more run, across town — 75s',
    kind: 'deliver',
    reward: 1200,
    timeLimit: 75,
  },
];
const MARKER_RADIUS = 45;
const BANNER_TIME = 3.5;

export function createMissions() {
  return {
    index: 0,              // next mission to run (0..3); 3 = all done
    status: 'ready',       // ready | active | done
    marker: null,          // { x, y }
    timeLeft: 0,
    earned: 0,
    totalEarned: 0,
    banner: null,          // { text, timer }
    stats: { startTime: 0, elapsed: 0 },
  };
}

function randomRoadPoint(city, rng, awayFrom, minDist) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const road = rng.pick(city.roads);
    let x, y;
    if (road.dir === 'h') {
      x = rng.range(200, 4600);
      y = road.y1 + (rng.chance(0.5) ? -18 : 18);
    } else {
      x = road.x1 + (rng.chance(0.5) ? -18 : 18);
      y = rng.range(200, city.beachY - 200);
    }
    if (!awayFrom) return { x, y };
    const dx = x - awayFrom.x, dy = y - awayFrom.y;
    if (dx * dx + dy * dy >= minDist * minDist) return { x, y };
  }
  return { x: rng.range(400, 4400), y: rng.range(400, 3000) };
}

/** Begin the next mission (call when the player reaches the marker or from UI). */
export function startMission(missions, city, rng, player) {
  if (missions.index >= MISSIONS.length || missions.status === 'active') return null;
  const m = MISSIONS[missions.index];
  missions.status = 'active';
  missions.timeLeft = m.timeLimit ?? 0;
  if (missions.index === 0) missions.stats.startTime = 0;
  // First marker is near the player for a quick start.
  const near = missions.index === 0 ? randomNearPoint(city, rng, player) : randomRoadPoint(city, rng, null, 0);
  missions.marker = near;
  showBanner(missions, m.title);
  return m;
}

function randomNearPoint(city, rng, player) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const road = rng.pick(city.roads);
    let x, y;
    if (road.dir === 'h') {
      x = rng.range(200, 4600);
      y = road.y1 + (rng.chance(0.5) ? -18 : 18);
    } else {
      x = road.x1 + (rng.chance(0.5) ? -18 : 18);
      y = rng.range(200, city.beachY - 200);
    }
    const dx = x - player.x, dy = y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 300 * 300 && d2 < 900 * 900) return { x, y };
  }
  return { x: player.x + 500, y: player.y + 300 };
}

/**
 * Advance missions: check marker arrival and the time limit.
 * Returns events: { arrived, delivered, expired, allDone, reward }
 */
export function updateMissions(missions, player, city, rng, dt) {
  const events = { arrived: false, delivered: false, expired: false, allDone: false, reward: 0 };

  if (missions.banner) {
    missions.banner.timer -= dt;
    if (missions.banner.timer <= 0) missions.banner = null;
  }

  if (missions.status !== 'active') {
    // Not running: wait at the mission start marker.
    if (missions.status === 'ready' && !missions.marker) return events;
    return events;
  }

  const m = MISSIONS[missions.index];
  missions.stats.elapsed += dt;

  if (m.timeLimit) {
    missions.timeLeft -= dt;
    if (missions.timeLeft <= 0) {
      events.expired = true;
      missions.status = 'ready';
      missions.timeLeft = 0;
      missions.marker = randomRoadPoint(city, rng, player, 600);
      showBanner(missions, 'Too slow — job lost. Try again at the marker.');
      return events;
    }
  }

  // Arrival check.
  if (missions.marker) {
    const dx = player.x - missions.marker.x;
    const dy = player.y - missions.marker.y;
    if (dx * dx + dy * dy <= MARKER_RADIUS * MARKER_RADIUS) {
      events.arrived = true;
      events.reward = m.reward;
      events.delivered = true;
      missions.earned += m.reward;
      missions.totalEarned += m.reward;
      missions.index += 1;
      if (missions.index >= MISSIONS.length) {
        missions.status = 'done';
        missions.marker = null;
        events.allDone = true;
        showBanner(missions, 'All jobs done!');
      } else {
        missions.status = 'ready';
        missions.marker = randomRoadPoint(city, rng, player, 800);
        showBanner(missions, `+$${m.reward} — head to the next marker`);
      }
    }
  }

  return events;
}

/** The marker the player should head to right now (start marker or active target). */
export function activeMarker(missions) {
  return missions.marker;
}

export function showBanner(missions, text) {
  missions.banner = { text, timer: BANNER_TIME };
}

export function drawMarker(ctx, marker, camX, camY, clock) {
  if (!marker) return;
  const sx = marker.x - camX;
  const sy = marker.y - camY;
  if (sx < -100 || sy < -600) return;

  // Light pillar: a beam rising from the ground.
  const pulse = 0.75 + 0.25 * Math.sin(clock * 3);
  const beamH = 260;
  const grad = ctx.createLinearGradient(0, sy, 0, sy - beamH);
  grad.addColorStop(0, `rgba(250,204,21,${0.55 * pulse})`);
  grad.addColorStop(1, 'rgba(250,204,21,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(sx - 14, sy);
  ctx.lineTo(sx + 14, sy);
  ctx.lineTo(sx + 7, sy - beamH);
  ctx.lineTo(sx - 7, sy - beamH);
  ctx.closePath();
  ctx.fill();

  // Ground ring.
  ctx.strokeStyle = `rgba(250,204,21,${0.9 * pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx, sy, MARKER_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(250,204,21,0.4)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(sx, sy, MARKER_RADIUS * 0.6, 0, Math.PI * 2);
  ctx.stroke();
}

export function missionInfo(missions) {
  const m = MISSIONS[Math.min(missions.index, MISSIONS.length - 1)];
  return {
    title: m.title,
    timeLeft: missions.timeLeft,
    index: missions.index,
    total: MISSIONS.length,
    status: missions.status,
  };
}
