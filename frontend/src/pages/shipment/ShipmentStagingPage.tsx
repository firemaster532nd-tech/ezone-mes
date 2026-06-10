import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Scan, Truck, CheckCircle2, AlertTriangle, Package,
  RefreshCw, X, ShieldAlert, Clock, MapPin, FileText, Printer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LotInfo {
  lot_id: number;
  lot_number: string;
  lot_type: string;
  item_id: number | null;
  item_name: string | null;
  item_code: string | null;
  qty: number;
  remaining_qty: number;
  unit: string | null;
  item_unit: string | null;
  status: string;
  staging_status: string | null;
  staging_location: string | null;
  staged_at: string | null;
  created_at: string;
}

interface FifoCheckResult {
  fifo_ok: boolean;
  older_lots: Array<{ lot_id: number; lot_number: string; created_at: string; remaining_qty: number }>;
}

interface ShipmentOrder {
  so_id: number;
  so_number: string;
  customer_name: string | null;
  destination: string | null;
  so_date: string;
  status: string;
  item_count: number;
}

const STAGING_LOCATIONS = Array.from({length:10},(_,i)=>`S-${String(i+1).padStart(2,'0')}`);

// ─── LOT 카드 (출하대기 목록) ──────────────────────────────
function StagingLotCard({ lot, onShipOut, onRemove }: {
  lot: LotInfo;
  onShipOut: (lot: LotInfo) => void;
  onRemove: (lot: LotInfo) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Package className="h-4 w-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-bold text-blue-700">{lot.lot_number}</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{lot.item_name || '-'}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">수량: {lot.remaining_qty ?? lot.qty}</span>
          {lot.staging_location && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
              <MapPin className="h-2.5 w-2.5 inline" /> {lot.staging_location}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => onShipOut(lot)}
          className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg">
          출하
        </button>
        <button onClick={() => onRemove(lot)}
          className="p-1.5 border border-red-200 hover:bg-red-50 text-red-400 rounded-lg">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── FIFO 위반 차단 모달 ───────────────────────────────────
function FifoBlockModal({ olderLots, scanLot, onClose }: {
  olderLots: FifoCheckResult['older_lots'];
  scanLot: LotInfo;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-white" />
          <div>
            <h2 className="text-white font-bold text-base">🚨 FIFO 위반 — 투입 차단</h2>
            <p className="text-red-100 text-xs">GDL-C302-2026-PJT · 선입선출 강제 준수</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-red-800 mb-1">스캔된 LOT (투입 시도)</p>
            <p className="font-mono text-sm text-red-700">{scanLot.lot_number}</p>
            <p className="text-xs text-red-600">입고일: {scanLot.created_at?.slice(0,10)}</p>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-800 mb-2">
              ⚠ 더 오래된 LOT {olderLots.length}개가 남아있습니다
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {olderLots.map(ol => (
                <div key={ol.lot_id} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-800">{ol.lot_number}</span>
                    <span className="text-xs text-amber-600 font-semibold">잔량: {ol.remaining_qty}</span>
                  </div>
                  <p className="text-xs text-amber-600 mt-0.5">입고일: {ol.created_at?.slice(0,10)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
            <p className="font-semibold mb-1">📌 조치 방법</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>위의 선입 LOT를 먼저 투입·출하하세요</li>
              <li>선입 LOT 소진 후 본 LOT를 사용하세요</li>
              <li>해제 불가 — 관리자에게 문의하세요</li>
            </ol>
          </div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl">
            확인 (스캔 취소)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function ShipmentStagingPage() {
  const [activeTab, setActiveTab] = useState<'pack'|'ship'|'status'>('pack');

  // 공통
  const packScanRef = useRef<HTMLInputElement>(null);
  const shipScanRef = useRef<HTMLInputElement>(null);

  // 포장 탭
  const [packInput, setPackInput] = useState('');
  const [packLot, setPackLot] = useState<LotInfo | null>(null);
  const [packError, setPackError] = useState('');
  const [packLocation, setPackLocation] = useState('S-01');
  const [packLoading, setPackLoading] = useState(false);
  const [packProcessing, setPackProcessing] = useState(false);
  const [fifoBlock, setFifoBlock] = useState<FifoCheckResult | null>(null);

  // 출하 탭
  const [shipInput, setShipInput] = useState('');
  const [shipLot, setShipLot] = useState<LotInfo | null>(null);
  const [shipError, setShipError] = useState('');
  const [shipLoading, setShipLoading] = useState(false);
  const [shipProcessing, setShipProcessing] = useState(false);
  const [selectedSO, setSelectedSO] = useState<number | null>(null);
  const [shipmentOrders, setShipmentOrders] = useState<ShipmentOrder[]>([]);

  // 현황 탭
  const [stagingList, setStagingList] = useState<LotInfo[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);

  // 포커스
  useEffect(() => {
    if (activeTab === 'pack') packScanRef.current?.focus();
    if (activeTab === 'ship') shipScanRef.current?.focus();
  }, [activeTab]);

  // 출하지시서 목록 로드
  useEffect(() => {
    api.get<{ data: ShipmentOrder[] }>('/shipment-orders?status=DRAFT').then(res => {
      setShipmentOrders(res.data ?? []);
    }).catch(() => {});
  }, []);

  // 출하대기 목록 로드
  const loadStagingList = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await api.get<{ data: LotInfo[] }>('/lots/staging?staging_status=PACKING');
      setStagingList(res.data ?? []);
    } catch { toast.error('현황 로드 실패'); }
    finally { setStatusLoading(false); }
  }, []);

  useEffect(() => { loadStagingList(); }, [loadStagingList]);

  // ── 포장 스캔 ──────────────────────────────────────────
  const handlePackScan = async (value: string) => {
    const lotNum = value.trim();
    if (!lotNum) return;
    setPackError('');
    setPackLot(null);
    setFifoBlock(null);
    setPackLoading(true);
    try {
      const res = await api.get<{ data: LotInfo }>(`/lots/scan/${encodeURIComponent(lotNum)}`);
      const lot = res.data;

      // FIFO 체크 (완전 차단)
      if (lot.item_id) {
        const fifoRes = await api.post<{ data: FifoCheckResult }>('/lots/check-fifo', {
          item_id: lot.item_id,
          lot_id: lot.lot_id,
        });
        if (!fifoRes.data.fifo_ok) {
          setFifoBlock(fifoRes.data);
          setPackLoading(false);
          setPackInput('');
          packScanRef.current?.focus();
          return;
        }
      }

      if (lot.staging_status === 'PACKING') {
        setPackError('이미 출하대기 상태입니다.');
        setPackLot(null);
      } else {
        setPackLot(lot);
      }
    } catch (e: any) {
      setPackError(e?.response?.data?.message || `LOT '${lotNum}' 을(를) 찾을 수 없습니다.`);
    } finally {
      setPackLoading(false);
      setPackInput('');
      packScanRef.current?.focus();
    }
  };

  const handlePackConfirm = async () => {
    if (!packLot || !packLocation) return;
    setPackProcessing(true);
    try {
      await api.patch(`/lots/${packLot.lot_id}/stage`, {
        location: packLocation,
        staged_by: '작업자',
      });
      toast.success(`✅ ${packLot.lot_number} → 출하대기(${packLocation})`);
      setPackLot(null);
      setPackError('');
      await loadStagingList();
      packScanRef.current?.focus();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '처리 실패');
    } finally { setPackProcessing(false); }
  };

  // ── 출하 스캔 ──────────────────────────────────────────
  const handleShipScan = async (value: string) => {
    const lotNum = value.trim();
    if (!lotNum) return;
    setShipError('');
    setShipLot(null);
    setShipLoading(true);
    try {
      const res = await api.get<{ data: LotInfo }>(`/lots/scan/${encodeURIComponent(lotNum)}`);
      const lot = res.data;
      if (lot.staging_status !== 'PACKING') {
        setShipError(`출하대기(PACKING) 상태가 아닙니다. 현재 상태: ${lot.staging_status || lot.status}`);
      } else {
        setShipLot(lot);
      }
    } catch (e: any) {
      setShipError(e?.response?.data?.message || `LOT '${lotNum}' 을(를) 찾을 수 없습니다.`);
    } finally {
      setShipLoading(false);
      setShipInput('');
      shipScanRef.current?.focus();
    }
  };

  const handleShipConfirm = async () => {
    if (!shipLot) return;
    setShipProcessing(true);
    try {
      await api.patch(`/lots/${shipLot.lot_id}/ship-out`, {
        so_id: selectedSO || undefined,
        shipped_by: '작업자',
      });
      toast.success(`🚚 ${shipLot.lot_number} → 출하 완료!`);
      setShipLot(null);
      setShipError('');
      await loadStagingList();
      shipScanRef.current?.focus();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '출하 처리 실패');
    } finally { setShipProcessing(false); }
  };

  const packingCount = stagingList.length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="출하 스테이징"
        description="GDL-C302-2026-PJT · 출하 스캔 게이트 ④ — 포장→출하대기→출하 / FIFO 완전차단"
        count={packingCount}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-amber-700 bg-amber-100 px-3 py-1 rounded-full font-semibold">
            출하대기 {packingCount}건
          </span>
          <button onClick={loadStagingList} className="p-2 border rounded-xl hover:bg-white">
            <RefreshCw className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </PageHeader>

      {/* 탭 */}
      <div className="flex gap-1 px-4 pt-3">
        {([
          ['pack','📦 포장 / 출하대기'],
          ['ship','🚚 출하 처리'],
          ['status',`📋 대기 현황 (${packingCount})`],
        ] as const).map(([key,label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn('px-4 py-2 rounded-t-xl text-sm font-semibold transition-colors border-b-2',
              activeTab === key ? 'bg-white border-blue-600 text-blue-700' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200')}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-b-xl border border-t-0 mx-4 mb-4 p-4">

        {/* ── 포장 탭 ── */}
        {activeTab === 'pack' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>📦 포장 단계 — 출하대기 처리</strong>
              <ol className="mt-1.5 space-y-0.5 list-decimal list-inside">
                <li>포장 완료된 LOT QR 스캔</li>
                <li>FIFO 자동 검사 (위반 시 완전 차단)</li>
                <li>적재 위치(S존) 선택 후 확정</li>
                <li>재고 OUT 기록 + 출하대기 상태로 변경</li>
              </ol>
            </div>

            {/* 스캐너 입력 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <label className="block text-xs text-amber-400 font-mono mb-2">◉ LOT QR/바코드 스캔</label>
              <div className="flex gap-2">
                <input
                  ref={packScanRef}
                  type="text"
                  value={packInput}
                  onChange={e => setPackInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePackScan(packInput)}
                  placeholder="스캐너를 이 칸에 스캔하세요..."
                  className="flex-1 bg-black border border-amber-500 text-amber-400 font-mono text-sm px-3 py-2.5 rounded-lg outline-none focus:border-amber-300 placeholder:text-amber-900"
                  autoComplete="off"
                />
                <button onClick={() => handlePackScan(packInput)} disabled={packLoading || !packInput}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                  {packLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {packError && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{packError}</span>
              </div>
            )}

            {/* 스캔된 LOT */}
            {packLot && (
              <div className="bg-white border-2 border-amber-300 rounded-xl overflow-hidden">
                <div className="bg-amber-500 px-4 py-2 flex items-center justify-between">
                  <span className="text-white font-bold text-sm">✅ LOT 확인 — FIFO 통과</span>
                  <button onClick={() => { setPackLot(null); packScanRef.current?.focus(); }}>
                    <X className="h-4 w-4 text-amber-100 hover:text-white" />
                  </button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500">LOT 번호</p><p className="font-mono font-bold text-blue-700">{packLot.lot_number}</p></div>
                  <div><p className="text-xs text-gray-500">품목명</p><p className="font-semibold">{packLot.item_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">수량</p><p className="font-bold text-amber-600">{packLot.remaining_qty ?? packLot.qty} {packLot.item_unit || packLot.unit || 'EA'}</p></div>
                  <div><p className="text-xs text-gray-500">입고일</p><p className="text-xs">{packLot.created_at?.slice(0,10)}</p></div>
                </div>

                {/* 적재 위치 */}
                <div className="border-t px-4 py-3">
                  <p className="text-xs font-bold text-gray-600 mb-2">출하대기 적재 위치 (S존)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGING_LOCATIONS.map(loc => (
                      <button key={loc} onClick={() => setPackLocation(loc)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all',
                          packLocation === loc
                            ? 'border-purple-600 bg-purple-600 text-white'
                            : 'border-purple-200 bg-purple-50 text-purple-700 hover:border-purple-400'
                        )}>
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <button onClick={handlePackConfirm} disabled={packProcessing}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {packProcessing && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    <Package className="h-4 w-4" />
                    출하대기 확정 (재고 차감)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 출하 탭 ── */}
        {activeTab === 'ship' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800">
              <strong>🚚 출하 처리 — 거래명세서 발행 후 최종 출하</strong>
              <ol className="mt-1.5 space-y-0.5 list-decimal list-inside">
                <li>출하지시서 선택 (선택사항)</li>
                <li>출하대기(PACKING) 상태 LOT QR 스캔</li>
                <li>[출하 완료] → 상태: PACKING → SHIPPED</li>
              </ol>
            </div>

            {/* 출하지시서 선택 */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">출하지시서 선택 (선택)</label>
              <select value={selectedSO || ''} onChange={e => setSelectedSO(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300">
                <option value="">-- 출하지시서 없이 처리 --</option>
                {shipmentOrders.map(so => (
                  <option key={so.so_id} value={so.so_id}>
                    {so.so_number} | {so.customer_name || '-'} | {so.destination || '-'}
                  </option>
                ))}
              </select>
            </div>

            {/* 스캐너 입력 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <label className="block text-xs text-green-400 font-mono mb-2">◉ 출하대기 LOT 스캔</label>
              <div className="flex gap-2">
                <input
                  ref={shipScanRef}
                  type="text"
                  value={shipInput}
                  onChange={e => setShipInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleShipScan(shipInput)}
                  placeholder="출하대기 LOT QR 스캔..."
                  className="flex-1 bg-black border border-green-500 text-green-400 font-mono text-sm px-3 py-2.5 rounded-lg outline-none focus:border-green-300 placeholder:text-green-900"
                  autoComplete="off"
                />
                <button onClick={() => handleShipScan(shipInput)} disabled={shipLoading || !shipInput}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                  {shipLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {shipError && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{shipError}</span>
              </div>
            )}

            {shipLot && (
              <div className="bg-white border-2 border-green-400 rounded-xl overflow-hidden">
                <div className="bg-green-600 px-4 py-2 flex items-center justify-between">
                  <span className="text-white font-bold text-sm flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> 출하대기 LOT 확인
                  </span>
                  <button onClick={() => { setShipLot(null); shipScanRef.current?.focus(); }}>
                    <X className="h-4 w-4 text-green-100 hover:text-white" />
                  </button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500">LOT 번호</p><p className="font-mono font-bold text-blue-700">{shipLot.lot_number}</p></div>
                  <div><p className="text-xs text-gray-500">품목명</p><p className="font-semibold">{shipLot.item_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">수량</p><p className="font-bold text-green-600">{shipLot.remaining_qty ?? shipLot.qty} {shipLot.item_unit || shipLot.unit || 'EA'}</p></div>
                  <div>
                    <p className="text-xs text-gray-500">적재 위치</p>
                    <p className="font-bold text-purple-600">
                      <MapPin className="h-3 w-3 inline" /> {shipLot.staging_location || '-'}
                    </p>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <button onClick={handleShipConfirm} disabled={shipProcessing}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {shipProcessing && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    <Truck className="h-4 w-4" />
                    출하 완료 처리
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 현황 탭 ── */}
        {activeTab === 'status' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">출하대기 LOT 목록 ({packingCount}건)</h3>
              <button onClick={loadStagingList} disabled={statusLoading}
                className="p-1.5 border rounded-lg hover:bg-gray-100 disabled:opacity-50">
                <RefreshCw className={cn('h-4 w-4 text-gray-600', statusLoading && 'animate-spin')} />
              </button>
            </div>
            {stagingList.length === 0
              ? (
                <div className="text-center py-16 text-gray-400">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>출하대기 LOT가 없습니다</p>
                </div>
              )
              : stagingList.map(lot => (
                <StagingLotCard
                  key={lot.lot_id}
                  lot={lot}
                  onShipOut={(l) => { setShipLot(l); setActiveTab('ship'); }}
                  onRemove={() => { if(confirm('출하대기 취소하시겠습니까?')) { toast.info('취소 기능은 관리자에게 문의하세요.'); } }}
                />
              ))
            }
          </div>
        )}
      </div>

      {/* FIFO 차단 모달 */}
      {fifoBlock && packLot && (
        <FifoBlockModal
          olderLots={fifoBlock.older_lots}
          scanLot={packLot}
          onClose={() => { setFifoBlock(null); setPackLot(null); packScanRef.current?.focus(); }}
        />
      )}
      {fifoBlock && !packLot && (() => { setFifoBlock(null); return null; })()}
    </div>
  );
}
