// HUD — money, clock, wanted stars, mission info, banner, minimap.

import { WORLD } from './city.js';

const MINIMAP_SIZE = 160;
const MINIMAP_MARGIN = 16;
const MINIMAP_RADIUS = MINIMAP_SIZE / 2;

export function drawHUD(ctx, state, canvasW, canvasH) {
  // Money
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, 16, 16, 180, 44, 8);
  ctx.fill();
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#4ade80';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$ ${state.money.toLocaleString()}`, 32, 38);

  // Clock
  const hours = Math.floor(state.clock / 3600) % 24;
  const mins = Math.floor((state.clock % 3600) / 60);
  const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, canvasW - 380, 16, 104, 44, 8);
  ctx.fill();
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(timeStr, canvasW - 296, 38);
  ctx.textAlign = 'left';

  // Wanted stars (top right, next to the clock)
  if (state.wanted && state.wanted.level > 0) {
    const sx = canvasW - 260;
    const sy = 38;
    for (let i = 0; i < 5; i++) {
      drawStar(ctx, sx + i * 28, sy, 11, i < state.wanted.level ? '#fbbf24' : 'rgba(255,255,255,0.15)');
    }
  }

  // Mission panel (top center)
  if (state.mission && state.mission.status !== 'done') {
    const label = state.mission.status === 'active'
      ? state.mission.title
      : 'Courier job — reach the marker';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = Math.max(360, 380);
    roundRect(ctx, canvasW / 2 - w / 2, 16, w, 44, 8);
    ctx.fill();
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(label, canvasW / 2, 32);
    if (state.mission.status === 'active' && state.mission.timeLeft > 0) {
      const urgent = state.mission.timeLeft < 10;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = urgent ? '#f87171' : '#fbbf24';
      ctx.fillText(`${Math.ceil(state.mission.timeLeft)}s`, canvasW / 2, 50);
    }
    ctx.textAlign = 'left';
  }

  // Banner (center, below mission panel)
  if (state.banner) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = 'bold 26px system-ui, sans-serif';
    const bw = ctx.measureText(state.banner.text).width + 60;
    roundRect(ctx, canvasW / 2 - bw / 2, 90, bw, 48, 10);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner.text, canvasW / 2, 120);
    ctx.textAlign = 'left';
  }

  // Controls hint
  if (state.showControlsHint) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, canvasW / 2 - 200, canvasH - 60, 400, 40, 8);
    ctx.fill();
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText('WASD: Move | Shift: Sprint | E: Car | Esc: Pause', canvasW / 2, canvasH - 36);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function drawMinimap(ctx, state, canvasW, canvasH) {
  const cx = canvasW - MINIMAP_MARGIN - MINIMAP_RADIUS;
  const cy = canvasH - MINIMAP_MARGIN - MINIMAP_RADIUS;
  const scale = MINIMAP_SIZE / WORLD.width;
  const scaleY = MINIMAP_SIZE / WORLD.height;

  ctx.save();

  // Circular clip
  ctx.beginPath();
  ctx.arc(cx, cy, MINIMAP_RADIUS, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Background
  ctx.fillStyle = '#1a2332';
  ctx.fill();

  // Roads
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 2;
  for (const r of state.city.roads) {
    ctx.beginPath();
    if (r.dir === 'h') {
      ctx.moveTo(MINIMAP_MARGIN + r.x1 * scale, cy - MINIMAP_RADIUS + r.y1 * scaleY);
      ctx.lineTo(MINIMAP_MARGIN + r.x2 * scale, cy - MINIMAP_RADIUS + r.y2 * scaleY);
    } else {
      ctx.moveTo(MINIMAP_MARGIN + r.x1 * scale, cy - MINIMAP_RADIUS + r.y1 * scaleY);
      ctx.lineTo(MINIMAP_MARGIN + r.x2 * scale, cy - MINIMAP_RADIUS + r.y2 * scaleY);
    }
    ctx.stroke();
  }

  // Traffic blips
  ctx.fillStyle = '#f59e0b';
  for (const v of state.traffic) {
    const vx = MINIMAP_MARGIN + v.x * scale;
    const vy = cy - MINIMAP_RADIUS + v.y * scaleY;
    ctx.fillRect(vx - 2, vy - 2, 4, 4);
  }

  // Police blips (red-blue)
  if (state.wanted) {
    for (const cop of state.wanted.police) {
      const vx = MINIMAP_MARGIN + cop.x * scale;
      const vy = cy - MINIMAP_RADIUS + cop.y * scaleY;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(vx - 3, vy - 3, 3, 6);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(vx, vy - 3, 3, 6);
    }
  }

  // Mission marker blip (pulsing yellow)
  if (state.marker) {
    const mx = MINIMAP_MARGIN + state.marker.x * scale;
    const my = cy - MINIMAP_RADIUS + state.marker.y * scaleY;
    const pulse = 3 + Math.sin(Date.now() * 0.01) * 1.5;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(mx, my, pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player arrow
  const px = MINIMAP_MARGIN + state.player.x * scale;
  const py = cy - MINIMAP_RADIUS + state.player.y * scaleY;
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.angle);
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // Border
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, MINIMAP_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
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
