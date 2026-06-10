import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Scan, MapPin, AlertTriangle, CheckCircle2, Package,
  RefreshCw, X, ArrowRight, ShieldAlert, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 로케이션 코드 정의 (GDL-C302-2026-PJT 기준) ────────────
const LOCATIONS: Record<string, { label: string; zone: string; color: string; bg: string; border: string }> = {
  // A존: 재단 전 반제품
  ...Object.fromEntries(Array.from({length:10},(_,i)=>[`A-${String(i+1).padStart(2,'0')}`,{label:`A-${String(i+1).padStart(2,'0')}`,zone:'A',color:'text-blue-700',bg:'bg-blue-50',border:'border-blue-200'}])),
  // B존: 차열시트 (두께별)
  'B-1.5': {label:'B-1.5 (1.5T)',zone:'B',color:'text-red-700',bg:'bg-red-50',border:'border-red-300'},
  'B-2.0': {label:'B-2.0 (2.0T)',zone:'B',color:'text-red-700',bg:'bg-red-50',border:'border-red-300'},
  'B-3.0': {label:'B-3.0 (3.0T)',zone:'B',color:'text-red-700',bg:'bg-red-50',border:'border-red-300'},
  // C존: 조립 전 부품
  ...Object.fromEntries(Array.from({length:10},(_,i)=>[`C-${String(i+1).padStart(2,'0')}`,{label:`C-${String(i+1).padStart(2,'0')}`,zone:'C',color:'text-green-700',bg:'bg-green-50',border:'border-green-200'}])),
  // HOLD: 격리존
  ...Object.fromEntries(Array.from({length:5},(_,i)=>[`H-${String(i+1).padStart(2,'0')}`,{label:`H-${String(i+1).padStart(2,'0')} [HOLD]`,zone:'H',color:'text-orange-700',bg:'bg-orange-50',border:'border-orange-300'}])),
  // S존: 출하대기
  ...Object.fromEntries(Array.from({length:10},(_,i)=>[`S-${String(i+1).padStart(2,'0')}`,{label:`S-${String(i+1).padStart(2,'0')}`,zone:'S',color:'text-purple-700',bg:'bg-purple-50',border:'border-purple-200'}])),
};

const ZONE_INFO = {
  A: { label: 'A존 — 재단 전 반제품', color: 'bg-blue-600', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  B: { label: 'B존 — 차열시트 (두께별 분리!)', color: 'bg-red-600', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  C: { label: 'C존 — 조립 전 부품', color: 'bg-green-600', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  H: { label: 'HOLD 격리존 (주동선 분리)', color: 'bg-orange-600', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  S: { label: 'S존 — 출하대기', color: 'bg-purple-600', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
};

interface LotInfo {
  lot_id: number;
  lot_number: string;
  lot_type: string;
  item_id: number | null;
  item_name: string | null;
  item_code: string | null;
  item_category: string | null;
  qty: number;
  remaining_qty: number;
  unit: string | null;
  item_unit: string | null;
  status: string;
  staging_status: string | null;
  staging_location: string | null;
  inspection_result: string | null;
  created_at: string;
}

interface LocationStatus {
  location_code: string;
  lot_id: number | null;
  lot_number: string | null;
  item_name: string | null;
  qty: number | null;
}

// ─── 로케이션 현황 패널 ──────────────────────────────────────
function LocationGrid({ statusMap, onSelect }: {
  statusMap: Record<string, LocationStatus>;
  onSelect: (code: string) => void;
}) {
  const zones = ['A','B','C','H','S'] as const;
  return (
    <div className="space-y-4">
      {zones.map(zone => {
        const info = ZONE_INFO[zone];
        const zoneLocs = Object.entries(LOCATIONS).filter(([,v]) => v.zone === zone);
        return (
          <div key={zone} className={cn('rounded-xl border overflow-hidden', info.border)}>
            <div className={cn('px-4 py-2 font-bold text-sm text-white', info.color)}>
              {info.label}
              {zone === 'B' && <span className="ml-2 text-xs font-normal opacity-90">⚠ 두께 혼재 금지 (C-801)</span>}
            </div>
            <div className="grid grid-cols-5 gap-2 p-3 bg-white">
              {zoneLocs.map(([code, meta]) => {
                const st = statusMap[code];
                const occupied = !!st?.lot_number;
                return (
                  <button key={code} onClick={() => onSelect(code)}
                    className={cn(
                      'rounded-lg border-2 p-2 text-center transition-all hover:scale-105',
                      occupied
                        ? 'border-gray-400 bg-gray-100 cursor-pointer'
                        : cn('border-dashed cursor-pointer', meta.border, meta.bg, 'hover:brightness-95')
                    )}>
                    <div className={cn('text-xs font-bold', occupied ? 'text-gray-700' : meta.color)}>
                      {code}
                    </div>
                    {occupied && (
                      <div className="text-[9px] text-gray-500 mt-0.5 truncate" title={st.lot_number!}>
                        {st.lot_number?.slice(-8)}
                      </div>
                    )}
                    {!occupied && (
                      <div className="text-[9px] text-gray-400 mt-0.5">비어있음</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function LocationManagementPage() {
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState<LotInfo | null>(null);
  const [scanError, setScanError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationStatusMap, setLocationStatusMap] = useState<Record<string, LocationStatus>>({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [conflictLot, setConflictLot] = useState<LocationStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'map'>('scan');

  // 로케이션 현황 로드 (lot staging_location으로 집계)
  const loadLocationStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: LotInfo[] }>('/lots?status=ACTIVE');
      const lots = res.data ?? [];
      const map: Record<string, LocationStatus> = {};
      for (const lot of lots) {
        if (lot.staging_location) {
          map[lot.staging_location] = {
            location_code: lot.staging_location,
            lot_id: lot.lot_id,
            lot_number: lot.lot_number,
            item_name: lot.item_name,
            qty: lot.remaining_qty ?? lot.qty,
          };
        }
      }
      setLocationStatusMap(map);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadLocationStatus(); }, [loadLocationStatus]);

  // 페이지 진입 시 스캐너 포커스
  useEffect(() => { scanRef.current?.focus(); }, []);

  // LOT QR 스캔 처리
  const handleScan = async (value: string) => {
    const lotNum = value.trim();
    if (!lotNum) return;
    setScanError('');
    setScannedLot(null);
    setConflictLot(null);
    setSelectedLocation('');
    setLoading(true);
    try {
      const res = await api.get<{ data: LotInfo }>(`/lots/scan/${encodeURIComponent(lotNum)}`);
      const lot = res.data;
      setScannedLot(lot);
      // 이미 위치가 있으면 현재 위치 제안
      if (lot.staging_location) {
        setSelectedLocation(lot.staging_location);
      }
      // 인수검사 불합격 시 HOLD 자동 제안
      if (lot.inspection_result === 'FAIL') {
        setScanError('⚠ 인수검사 불합격 LOT입니다. HOLD존으로 이동하세요.');
        setSelectedLocation('H-01');
      }
    } catch (e: any) {
      setScanError(e?.response?.data?.message || `LOT '${lotNum}' 을(를) 찾을 수 없습니다.`);
    } finally {
      setLoading(false);
      setScanInput('');
      scanRef.current?.focus();
    }
  };

  // 로케이션 선택 (충돌 체크)
  const handleSelectLocation = (code: string) => {
    const existing = locationStatusMap[code];
    if (existing && existing.lot_id !== scannedLot?.lot_id) {
      // 1로케이션 1LOT 규칙 위반
      setConflictLot(existing);
      return;
    }
    setConflictLot(null);
    setSelectedLocation(code);
  };

  // 로케이션 확정
  const handleConfirm = async () => {
    if (!scannedLot || !selectedLocation) return;
    const zone = selectedLocation[0];
    // 차열시트 구역 혼재 체크 (B존)
    if (zone === 'B') {
      const locThickness = selectedLocation.split('-')[1];
      // 품목 코드에서 두께 확인 가능하면 체크
      const itemSpec = (scannedLot.item_code || '').toLowerCase();
      if (itemSpec && !itemSpec.includes(locThickness)) {
        const ok = confirm(`⚠ 차열시트 두께 불일치 경고!\n\n로케이션: ${selectedLocation} (${locThickness}T)\n품목: ${scannedLot.item_name}\n\n두께가 다를 수 있습니다. 계속하시겠습니까?`);
        if (!ok) return;
      }
    }

    setProcessing(true);
    try {
      await api.patch(`/lots/${scannedLot.lot_id}/stage`, {
        location: selectedLocation,
        staged_by: '작업자',
        ship_qty: 0, // 위치 등록만 (재고 차감 없음)
      });
      // 실제로는 staging 처리가 아닌 로케이션 업데이트만 필요
      // 백엔드에 별도 PATCH /api/lots/:id/location 추가 또는 stage에서 qty=0 처리
      await api.patch(`/lots/${scannedLot.lot_id}/location`, {
        location: selectedLocation,
      }).catch(() => {
        // /location 엔드포인트가 없을 경우 stage 처리
      });

      const isHold = selectedLocation.startsWith('H-');
      toast.success(
        isHold
          ? `⚠ ${scannedLot.lot_number} → HOLD존(${selectedLocation}) 격리 처리`
          : `✅ ${scannedLot.lot_number} → ${selectedLocation} 보관 확정`
      );
      await loadLocationStatus();
      setScannedLot(null);
      setSelectedLocation('');
      setConflictLot(null);
      scanRef.current?.focus();
    } catch {
      toast.error('로케이션 설정 실패');
    } finally { setProcessing(false); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="로케이션 관리"
        description="GDL-C302-2026-PJT · 보관 스캔 게이트 ③ — 1로케이션 1LOT · 차열시트 두께별 분리 · HOLD 격리"
        count={Object.keys(locationStatusMap).length}
      >
        <button onClick={loadLocationStatus} className="p-2 border rounded-xl hover:bg-white">
          <RefreshCw className="h-4 w-4 text-gray-600" />
        </button>
      </PageHeader>

      {/* 탭 */}
      <div className="flex gap-1 px-4 pt-3">
        {(['scan', 'map'] as const).map(key => (
          <button key={key}
            onClick={() => { setActiveTab(key); if (key === 'scan') setTimeout(() => scanRef.current?.focus(), 100); }}
            className={cn('px-4 py-2 rounded-t-xl text-sm font-semibold transition-colors border-b-2',
              activeTab === key ? 'bg-white border-blue-600 text-blue-700' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200')}>
            {key === 'scan' ? '📡 LOT 스캔·보관' : '🗺 로케이션 현황'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-b-xl border border-t-0 mx-4 mb-4 p-4">

        {activeTab === 'scan' && (
          <div className="max-w-2xl mx-auto space-y-4">

            {/* 안내 배너 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              <strong>📡 사용 방법</strong>
              <ol className="mt-1.5 space-y-0.5 list-decimal list-inside">
                <li>바코드 스캐너로 LOT QR 스캔 (아래 입력창 자동 포커스)</li>
                <li>보관 위치 선택 (A존·B존·C존·HOLD)</li>
                <li>[보관 확정] 클릭 → 1로케이션 1LOT 자동 검증</li>
              </ol>
              <div className="mt-1.5 font-semibold text-red-700">⚠ 차열시트: 두께별 구역 B-1.5 / B-2.0 / B-3.0 반드시 구분</div>
            </div>

            {/* 스캐너 입력 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <label className="block text-xs text-green-400 font-mono mb-2">◉ LOT QR/바코드 스캔</label>
              <div className="flex gap-2">
                <input
                  ref={scanRef}
                  type="text"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScan(scanInput)}
                  placeholder="스캐너를 이 칸에 스캔하세요..."
                  className="flex-1 bg-black border border-green-500 text-green-400 font-mono text-sm px-3 py-2.5 rounded-lg outline-none focus:border-green-300 placeholder:text-green-900"
                  autoComplete="off"
                />
                <button onClick={() => handleScan(scanInput)} disabled={loading || !scanInput}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 스캔 오류 */}
            {scanError && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{scanError}</span>
              </div>
            )}

            {/* 스캔된 LOT 정보 */}
            {scannedLot && (
              <div className="bg-white border-2 border-blue-300 rounded-xl overflow-hidden">
                <div className="bg-blue-600 px-4 py-2 flex items-center justify-between">
                  <span className="text-white font-bold text-sm">✅ LOT 확인됨</span>
                  <button onClick={() => { setScannedLot(null); setSelectedLocation(''); setConflictLot(null); scanRef.current?.focus(); }}>
                    <X className="h-4 w-4 text-blue-200 hover:text-white" />
                  </button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">LOT 번호</p>
                    <p className="font-mono font-bold text-blue-700">{scannedLot.lot_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">상태</p>
                    <p className={cn('font-bold', scannedLot.inspection_result === 'FAIL' ? 'text-red-600' : 'text-green-600')}>
                      {scannedLot.inspection_result || scannedLot.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">품목명</p>
                    <p className="font-semibold">{scannedLot.item_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">수량</p>
                    <p className="font-bold text-blue-700">{scannedLot.remaining_qty ?? scannedLot.qty} {scannedLot.item_unit || scannedLot.unit || 'EA'}</p>
                  </div>
                  {scannedLot.staging_location && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">현재 위치</p>
                      <p className="font-bold text-purple-600">📍 {scannedLot.staging_location}</p>
                    </div>
                  )}
                </div>

                {/* 로케이션 선택 */}
                <div className="border-t p-4">
                  <p className="text-xs font-bold text-gray-600 mb-3">보관 위치 선택</p>
                  <div className="space-y-2">
                    {Object.entries(ZONE_INFO).map(([zone, info]) => {
                      const zoneLocs = Object.entries(LOCATIONS).filter(([,v]) => v.zone === zone);
                      return (
                        <div key={zone}>
                          <p className={cn('text-[10px] font-bold mb-1', info.text)}>
                            {info.label}
                            {zone === 'B' && <span className="text-red-500 ml-1">⚠ 두께 혼재 금지</span>}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {zoneLocs.map(([code, meta]) => {
                              const occupied = locationStatusMap[code] && locationStatusMap[code].lot_id !== scannedLot.lot_id;
                              return (
                                <button key={code} onClick={() => handleSelectLocation(code)}
                                  disabled={occupied}
                                  className={cn(
                                    'px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all',
                                    occupied ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-300 text-gray-400 line-through' :
                                    selectedLocation === code ? 'border-blue-600 bg-blue-600 text-white scale-105 shadow-lg' :
                                    cn(meta.border, meta.bg, meta.color, 'hover:scale-105')
                                  )}>
                                  {code}
                                  {occupied && ' (사용중)'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 충돌 경고 */}
                {conflictLot && (
                  <div className="mx-4 mb-3 bg-red-50 border-2 border-red-400 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-1">
                      <ShieldAlert className="h-4 w-4" />
                      🚨 1로케이션 1LOT 규칙 위반 — 보관 차단
                    </div>
                    <p className="text-xs text-red-600">
                      이미 <strong>{conflictLot.lot_number}</strong> ({conflictLot.item_name})이
                      해당 위치에 보관 중입니다.
                    </p>
                    <p className="text-xs text-red-600 mt-1">빈 위치를 선택하거나 기존 LOT를 먼저 이동하세요.</p>
                  </div>
                )}

                {/* 확정 버튼 */}
                {selectedLocation && !conflictLot && (
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                      <Package className="h-4 w-4" />
                      <span>{scannedLot.lot_number}</span>
                      <ArrowRight className="h-4 w-4" />
                      <span className={cn('font-bold', selectedLocation.startsWith('H-') ? 'text-orange-600' : 'text-blue-700')}>
                        {selectedLocation}
                        {selectedLocation.startsWith('H-') && ' [HOLD 격리]'}
                      </span>
                    </div>
                    <button onClick={handleConfirm} disabled={processing}
                      className={cn(
                        'w-full py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50',
                        selectedLocation.startsWith('H-') ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
                      )}>
                      {processing && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {selectedLocation.startsWith('H-') ? '⚠ HOLD 격리 확정' : '✅ 보관 위치 확정'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'map' && (
          <div>
            <div className="mb-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              로케이션 클릭 시 보관 확정 화면으로 이동 · 회색=사용중
            </div>
            <LocationGrid
              statusMap={locationStatusMap}
              onSelect={(code) => {
                setSelectedLocation(code);
                setActiveTab('scan');
                setTimeout(() => scanRef.current?.focus(), 100);
              }}
            />

            {/* 로케이션 현황 테이블 */}
            {Object.keys(locationStatusMap).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-700 mb-2">현재 사용 중인 로케이션</h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      {['위치 코드','구역','LOT 번호','품목','수량'].map(h=>(
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(locationStatusMap).sort((a,b)=>a.location_code.localeCompare(b.location_code)).map(st => {
                      const meta = LOCATIONS[st.location_code];
                      return (
                        <tr key={st.location_code} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <span className={cn('px-2 py-0.5 rounded font-bold text-xs border', meta?.border, meta?.bg, meta?.color)}>
                              {st.location_code}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{meta?.zone || '-'}존</td>
                          <td className="px-3 py-2 font-mono text-xs text-blue-600">{st.lot_number}</td>
                          <td className="px-3 py-2 text-sm">{st.item_name || '-'}</td>
                          <td className="px-3 py-2 text-sm font-mono">{st.qty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
