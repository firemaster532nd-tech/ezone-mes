// PNG 흰색 배경 제거 스크립트 (순수 Node.js, 외부 패키지 없음)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const inputPath = path.join(__dirname, 'frontend/public/ezone-logo-src.png');
const outputPath = path.join(__dirname, 'frontend/public/ezone-logo-v4.png');

// PNG 파일 읽기
const buf = fs.readFileSync(inputPath);

// PNG 구조 파싱
function parsePNG(buf) {
  // PNG 시그니처 확인
  const sig = buf.slice(0, 8);
  
  let offset = 8;
  const chunks = [];
  
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    const data = buf.slice(offset + 8, offset + 8 + length);
    chunks.push({ type, data, length });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  
  return chunks;
}

const chunks = parsePNG(buf);
const ihdr = chunks.find(c => c.type === 'IHDR');
const width = ihdr.data.readUInt32BE(0);
const height = ihdr.data.readUInt32BE(4);
const bitDepth = ihdr.data[8];
const colorType = ihdr.data[9];

console.log(`이미지 크기: ${width}x${height}, bitDepth: ${bitDepth}, colorType: ${colorType}`);
// colorType 6 = RGBA

// IDAT 청크들의 데이터 합치기
const idatData = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));

// zlib 압축 해제
const raw = zlib.inflateSync(idatData);

// 픽셀 데이터 처리 (scanline 기반)
// 각 scanline은 1 필터 바이트 + width*4 바이트 (RGBA)
const bytesPerPixel = 4;
const stride = width * bytesPerPixel;

// 필터 복원 함수
function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// 재구성된 픽셀 데이터
const pixels = Buffer.alloc(height * stride);

for (let y = 0; y < height; y++) {
  const filterType = raw[y * (stride + 1)];
  const srcRow = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  const dstRow = pixels.slice(y * stride, y * stride + stride);
  const prevRow = y > 0 ? pixels.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);

  for (let x = 0; x < stride; x++) {
    const left = x >= bytesPerPixel ? dstRow[x - bytesPerPixel] : 0;
    const up = prevRow[x];
    const upLeft = (x >= bytesPerPixel && y > 0) ? prevRow[x - bytesPerPixel] : 0;

    let val;
    switch (filterType) {
      case 0: val = srcRow[x]; break;
      case 1: val = (srcRow[x] + left) & 0xFF; break;
      case 2: val = (srcRow[x] + up) & 0xFF; break;
      case 3: val = (srcRow[x] + Math.floor((left + up) / 2)) & 0xFF; break;
      case 4: val = (srcRow[x] + paethPredictor(left, up, upLeft)) & 0xFF; break;
      default: val = srcRow[x];
    }
    dstRow[x] = val;
  }
}

// 플러드필 방식으로 배경 제거 (4방향 BFS)
const THRESHOLD = 200;
const visited = new Uint8Array(width * height);

function isBackground(idx) {
  const base = idx * 4;
  return pixels[base] >= THRESHOLD && pixels[base+1] >= THRESHOLD && pixels[base+2] >= THRESHOLD;
}

const queue = [];
const corners = [0, width-1, (height-1)*width, height*width-1];
for (const idx of corners) {
  if (!visited[idx] && isBackground(idx)) { queue.push(idx); visited[idx] = 1; }
}

let removedCount = 0;
while (queue.length > 0) {
  const idx = queue.pop();
  pixels[idx * 4 + 3] = 0;
  removedCount++;
  const x = idx % width, y = Math.floor(idx / width);
  for (const n of [x>0?idx-1:-1, x<width-1?idx+1:-1, y>0?idx-width:-1, y<height-1?idx+width:-1]) {
    if (n >= 0 && !visited[n] && isBackground(n)) { visited[n] = 1; queue.push(n); }
  }
}


console.log(`투명화된 픽셀: ${removedCount} / ${width * height}`);

// 필터 없이(타입0) PNG로 재인코딩
const rawWithFilters = Buffer.alloc(height * (stride + 1));
for (let y = 0; y < height; y++) {
  rawWithFilters[y * (stride + 1)] = 0; // filter type 0 (None)
  pixels.copy(rawWithFilters, y * (stride + 1) + 1, y * stride, y * stride + stride);
}

const compressed = zlib.deflateSync(rawWithFilters, { level: 9 });

// PNG 재조립
function makePNG(width, height, rgbaData) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  
  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', rgbaData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC32 계산
function crc32(buf) {
  const table = makeCRCTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const pngOut = makePNG(width, height, compressed);
fs.writeFileSync(outputPath, pngOut);
console.log(`저장 완료: ${outputPath} (${pngOut.length} bytes)`);
