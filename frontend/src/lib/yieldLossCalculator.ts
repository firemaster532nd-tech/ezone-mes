/**
 * EZONE MES 수율 & 재단 로스(Loss) 자동 계산 유틸리티
 */

export interface CuttingCalculationInput {
  totalInputLengthMm: number;  // 원 시트 총 길이 (mm)
  targetSpecLengthMm: number;  // 재단 타겟 길이 (mm)
  producedQty: number;          // 실측 생산 개수
  sawBladeLossMmPerCut?: number;// 톱날 당 소모되는 길이 (기본값: 2mm)
  density?: number;             // 비중 (g/cm³)
  widthMm?: number;             // 폭 (mm)
  thicknessMm?: number;         // 두께 (mm)
}

export interface CuttingCalculationResult {
  pureUsedLengthMm: number;     // 정량 소요 길이 (mm)
  totalSawBladeLossMm: number;  // 총 톱날 로스 길이 (mm)
  scrapLossMm: number;          // 잔여 자투리 로스 길이 (mm)
  totalLossMm: number;          // 총 산출 로스 (mm)
  lossPercentage: number;       // 로스율 (%)
  calculatedWeightKg?: number;  // 계산된 중량 (kg)
}

/**
 * 재단 시트 길이별 / 로스 자동 계산식
 */
export function calculateCuttingLoss(input: CuttingCalculationInput): CuttingCalculationResult {
  const {
    totalInputLengthMm,
    targetSpecLengthMm,
    producedQty,
    sawBladeLossMmPerCut = 2,
    density = 1.25,
    widthMm = 125,
    thicknessMm = 5
  } = input;

  // 1. 정량 소요 길이 (mm)
  const pureUsedLengthMm = targetSpecLengthMm * producedQty;

  // 2. 톱날 로스 (mm)
  const totalSawBladeLossMm = sawBladeLossMmPerCut * producedQty;

  // 3. 총 소요 길이
  const totalUsedLengthMm = pureUsedLengthMm + totalSawBladeLossMm;

  // 4. 잔여 자투리 로스 (mm)
  const scrapLossMm = Math.max(0, totalInputLengthMm - totalUsedLengthMm);

  // 5. 총 로스 (mm)
  const totalLossMm = totalSawBladeLossMm + scrapLossMm;

  // 6. 로스율 (%)
  const lossPercentage = totalInputLengthMm > 0 
    ? Number(((totalLossMm / totalInputLengthMm) * 100).toFixed(2)) 
    : 0;

  // 7. 중량 환산 (kg)
  // 중량(g) = 부피(cm³) x 비중(g/cm³) = (길이mm * 폭mm * 두께mm / 1000) * 비중
  const volumeCm3 = (pureUsedLengthMm * widthMm * thicknessMm) / 1000;
  const calculatedWeightKg = Number(((volumeCm3 * density) / 1000).toFixed(2));

  return {
    pureUsedLengthMm,
    totalSawBladeLossMm,
    scrapLossMm,
    totalLossMm,
    lossPercentage,
    calculatedWeightKg
  };
}
