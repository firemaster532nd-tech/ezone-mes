// generate-icons.mjs — sharp 없이 HTML Canvas 방식으로 아이콘 생성
// 실행: node generate-icons.mjs
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function drawEzoneIcon(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Hexagon
  const r = w * 0.38;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#1e3a5f';
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = w * 0.016;
  ctx.stroke();

  // Letter E
  const ew = w * 0.32;
  const eh = w * 0.34;
  const ex = cx - ew / 2;
  const ey = cy - eh / 2;
  const bar = w * 0.055;
  const rr = w * 0.012;

  ctx.fillStyle = '#f59e0b';

  // Top bar
  roundRect(ctx, ex, ey, ew, bar, rr);
  // Middle bar (shorter)
  roundRect(ctx, ex, cy - bar / 2, ew * 0.8, bar, rr);
  // Bottom bar
  roundRect(ctx, ex, ey + eh - bar, ew, bar, rr);
  // Left vertical
  roundRect(ctx, ex, ey, bar, eh, rr);

  // Bottom label
  ctx.fillStyle = '#94a3b8';
  ctx.font = `bold ${w * 0.075}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('이지원 MES', cx, h * 0.91);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

const sizes = [192, 512];
const outDir = path.join(__dirname, 'frontend', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  drawEzoneIcon(canvas);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, `icon-${size}x${size}.png`), buffer);
  console.log(`✅ Created icon-${size}x${size}.png`);
}

// Also apple-touch-icon
const canvas180 = createCanvas(180, 180);
drawEzoneIcon(canvas180);
fs.writeFileSync(path.join(__dirname, 'frontend', 'public', 'apple-touch-icon.png'), canvas180.toBuffer('image/png'));
console.log('✅ Created apple-touch-icon.png');
