// generate-logo-icons.mjs — 이지원 로고를 PWA 앱 아이콘으로 변환
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.join(__dirname, 'frontend', 'public', 'ezone-logo-src.png');
const outDir   = path.join(__dirname, 'frontend', 'public', 'icons');
const pubDir   = path.join(__dirname, 'frontend', 'public');

fs.mkdirSync(outDir, { recursive: true });

// 로고를 아이콘 사이즈에 맞게 배경 위에 합성
async function makeIcon(size, outPath) {
  const padding = Math.round(size * 0.12);      // 12% 여백
  const logoSize = size - padding * 2;          // 로고 크기

  // 1) 로고 투명 배경을 완전히 제거 후 리사이즈
  const logoResized = await sharp(logoPath)
    .flatten({ background: { r: 255, g: 255, b: 255 } })  // 투명 → 흰색으로 평탄화
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  // 2) 남색 배경 (#0f172a) + 흰색 배경 로고 합성
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }  // #0f172a 슬레이트 나이트
    }
  })
    .composite([{ input: logoResized, gravity: 'center' }])
    .png()
    .toFile(outPath);

  console.log(`✅ ${path.basename(outPath)} (${size}x${size})`);
}

async function run() {
  await makeIcon(512, path.join(outDir, 'icon-512x512.png'));
  await makeIcon(192, path.join(outDir, 'icon-192x192.png'));
  await makeIcon(180, path.join(pubDir, 'apple-touch-icon.png'));
  await makeIcon(32,  path.join(pubDir, 'favicon-32.png'));

  // favicon.ico는 32px PNG로 대체 (브라우저 호환)
  await sharp(logoPath)
    .resize(32, 32, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(path.join(pubDir, 'favicon.ico'));

  console.log('✅ favicon.ico');
  console.log('\n🎉 모든 아이콘 생성 완료!');
}

run().catch(console.error);
