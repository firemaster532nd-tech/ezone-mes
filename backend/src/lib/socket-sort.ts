/**
 * C302 규정 기반 소켓 정렬 및 1EA 분리 유틸리티
 *
 * 정렬 기준 (C302 6.7 + 작업 기준):
 *   1. 차수(construction_seq) 오름차순
 *   2. 구조체(product_type) – C302 표5 순서
 *   3. 가로길이(pipe_width_mm) 오름차순
 *   4. 세로길이(pipe_height_mm) 오름차순
 *
 * 수량 원칙:
 *   qty N개 → N개 행으로 분리 (각각 qty=1, planned_qty=1)
 *   → 소켓 1EA마다 개별 LOT 부여 가능
 */

// C302 표5 구조체 코드 정렬 우선순위
const PRODUCT_TYPE_ORDER: Record<string, number> = {
  'V-03':       1,
  'VS-01':      2,
  'VT-01':      3,
  'VT-049':     4,
  'VT-064':     5,
  'VA-064':     6,
  'VAG-1.69':   7,
  'VAG-169':    7,
  'HAG-1.69':   8,
  'HAG-169':    8,
  'HTG(DC)-064': 9,
  'HTG-064DC':  9,
  'HTG-1.69':   10,
  'HTG-169':    10,
  'HTG-064':    11,
  'VTI-064':    12,
  'BDCV-1S':    13,
  'BDRV-3S':    14,
};

function productTypeOrder(pt: string): number {
  const clean = (pt || '').trim();
  return PRODUCT_TYPE_ORDER[clean] ?? 99;
}

/**
 * 소켓 아이템 배열을 정렬 후 qty만큼 1개씩 분리하여 반환.
 * 반환된 배열의 각 항목은 qty=1, planned_qty=1.
 *
 * @param items  원본 아이템 배열 (qty > 1 가능)
 * @returns 1EA씩 분리·정렬된 배열
 */
export function expandAndSortSocketItems(items: any[]): any[] {
  // 먼저 정렬 (qty 분리 전에 정렬해야 그룹 내 순서가 유지됨)
  const sorted = [...items].sort((a, b) => {
    // 1. 차수
    const ca = parseInt(String(a.construction_seq ?? 1)) || 1;
    const cb = parseInt(String(b.construction_seq ?? 1)) || 1;
    if (ca !== cb) return ca - cb;

    // 2. 구조체 (C302 표5 순서)
    const pa = productTypeOrder(a.product_type || '');
    const pb = productTypeOrder(b.product_type || '');
    if (pa !== pb) return pa - pb;

    // 3. 가로길이 오름차순
    const wa = Number(a.pipe_width_mm) || 0;
    const wb = Number(b.pipe_width_mm) || 0;
    if (wa !== wb) return wa - wb;

    // 4. 세로길이 오름차순
    const ha = Number(a.pipe_height_mm) || 0;
    const hb = Number(b.pipe_height_mm) || 0;
    return ha - hb;
  });

  // qty만큼 1개씩 분리
  const result: any[] = [];
  let seqNo = 1;
  for (const item of sorted) {
    const qty = Math.max(1, parseInt(String(item.qty ?? item.planned_qty ?? 1)) || 1);
    for (let i = 0; i < qty; i++) {
      result.push({
        ...item,
        qty: 1,
        planned_qty: 1,
        seq_no: seqNo++,
      });
    }
  }
  return result;
}
