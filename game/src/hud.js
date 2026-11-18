// HUD — money, clock, minimap.

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
  roundRect(ctx, canvasW - 120, 16, 104, 44, 8);
  ctx.fill();
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(timeStr, canvasW - 32, 38);
  ctx.textAlign = 'left';

  // Controls hint
  if (state.showControlsHint) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, canvasW / 2 - 160, canvasH - 60, 320, 40, 8);
    ctx.fill();
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText('WASD: Move | Shift: Sprint | E: Enter/Exit Car | Esc: Pause', canvasW / 2, canvasH - 36);
    ctx.textAlign = 'left';
  }

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
