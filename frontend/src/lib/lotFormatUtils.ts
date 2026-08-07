/**
 * EZONE MES 사규 C302 LOT 번호 및 랙 로케이션 위치 분리 유틸리티
 */

export interface FormattedLotLocation {
  pureLotNumber: string; // 순수 사규 LOT (예: 260805GI001)
  locationText: string;  // 분리된 랙 위치 (예: A1P1)
}

/**
 * 260805GI001-A1P1 형태의 문자열에서 순수 사규 LOT과 보관 위치(A1P1)를 분리합니다.
 */
export function parsePureLotAndLocation(lotNumber: string, originalLocation?: string): FormattedLotLocation {
  if (!lotNumber) {
    return { pureLotNumber: '-', locationText: originalLocation || '-' };
  }

  const trimmed = lotNumber.trim();
  // 정규식: 260805GI001-A1P1 또는 251025MB001-B2P3 패턴 매칭
  const match = trimmed.match(/^([A-Za-z0-9]+)-([A-Za-z0-9]+)$/);

  if (match) {
    const pure = match[1];
    const locSuffix = match[2];
    
    // suffix가 A1P1, R2P1, P1P2 같은 로케이션 형태이면 분리
    if (/^[A-Z][0-9]+[A-Z0-9]*$/i.test(locSuffix)) {
      return {
        pureLotNumber: pure,
        locationText: originalLocation && originalLocation !== '-' ? `${originalLocation} (${locSuffix})` : locSuffix
      };
    }
  }

  return {
    pureLotNumber: trimmed,
    locationText: originalLocation || '-'
  };
}
