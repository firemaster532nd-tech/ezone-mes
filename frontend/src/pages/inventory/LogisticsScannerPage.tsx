import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { LocationPicker } from '@/components/LocationPicker';
import {
  ScanLine, Package, MapPin, ArrowRightLeft, Truck,
  BarChart2, Printer, X, CheckCircle, Search, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GodexLabelPrinter } from '@/components/label/GodexLabelPrinter';

// 스캔 결과 타입
interface ScannedItem {
  id: number;
  lot_number: string;
  item_name: string;
  spec?: string;
  category?: string;
  unit?: string;
  qty_current: number;
  location?: string;
  location_name?: string;
  location_id?: number;
  wms_status?: string;
  source_table: string;
  po_number?: string;
  po_site_name?: string;
  // material_lots 전용
  density?: number;
  thickness?: number;
  width_mm?: number;
  length_mm?: number;
  received_date?: string;
}

type ActionType = null | 'IN' | 'OUT' | 'MOVE' | 'SHIPMENT_READY' | 'QTY_ADJUST' | 'PRINT';

const WMS_STATUS_LABEL: Record<string, string> = {
  NORMAL: '일반재고',
  SHIPMENT_READY: '출하대기',
  RESERVED: '예약됨',
};

export function LogisticsScannerPage() {
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [action, setAction] = useState<ActionType>(null);
  const [saving, setSaving] = useState(false);

  // 작업별 상태
  const [actionQty, setActionQty] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [moveLocationCode, setMoveLocationCode] = useState('');
  const [moveLocationId, setMoveLocationId] = useState<number | undefined>();

  // 출하대기 발주서 검색
  const [poSearchKeyword, setPoSearchKeyword] = useState('');
  const [poList, setPoList] = useState<any[]>([]);
  const [poSearching, setPoSearching] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any | null>(null);

  // 페이지 로드 시 스캔 입력창에 포커스
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // 작업 선택 후 입력창 포커스 복원
  const resetAction = () => {
    setAction(null);
    setActionQty('');
    setActionNote('');
    setMoveLocationCode('');
    setMoveLocationId(undefined);
    setSelectedPo(null);
    setPoSearchKeyword('');
    setPoList([]);
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  // 스캔 처리
  const handleScan = useCallback(async () => {
    const lot = scanValue.trim();
    if (!lot) return;
    setScanning(true);
    setScannedItem(null);
    setAction(null);
    try {
      const res = await api.get<{ data: ScannedItem }>(`/wms/scan/${encodeURIComponent(lot)}`);
      setScannedItem(res.data);
      setActionQty(String(res.data.qty_current || ''));
      setScanValue('');
      // 성공 사운드 (선택)
      new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA...').play().catch(() => {});
    } catch (err: any) {
      toast.error(err?.response?.data?.error || `'${lot}' LOT를 찾을 수 없습니다.`);
      setScanValue('');
    } finally {
      setScanning(false);
    }
  }, [scanValue]);

  // 발주서 검색
  const searchPo = async () => {
    if (!poSearchKeyword.trim()) return;
    setPoSearching(true);
    try {
      const res = await api.get<{ data: any[] }>(`/purchase-orders?search=${encodeURIComponent(poSearchKeyword)}&status=CONFIRMED&limit=20`);
      setPoList(res.data ?? []);
      if ((res.data ?? []).length === 0) toast.info('검색된 발주서가 없습니다.');
    } catch {
      toast.error('발주서 검색 실패');
    } finally {
      setPoSearching(false);
    }
  };

  // 저장 처리
  const handleSave = async () => {
    if (!scannedItem) return;
    setSaving(true);
    try {
      if (action === 'MOVE') {
        if (!moveLocationId) { toast.error('이동할 위치를 선택해주세요.'); return; }
        await api.put('/wms/change-location', {
          item_table: scannedItem.source_table,
          item_id: scannedItem.id,
          location_id: moveLocationId,
          memo: actionNote || '스캐너 위치이동',
        });
        toast.success(`${scannedItem.lot_number} → ${moveLocationCode} 이동 완료`);
        // 위치이동 후 아이템 업데이트
        setScannedItem(prev => prev ? { ...prev, location: moveLocationCode, location_name: moveLocationCode, location_id: moveLocationId } : null);
        resetAction();

      } else if (action === 'IN') {
        await api.post('/wms/inventory', {
          lot_number: scannedItem.lot_number,
          item_name: scannedItem.item_name,
          spec: scannedItem.spec || null,
          unit: scannedItem.unit || 'EA',
          qty: parseFloat(actionQty) || scannedItem.qty_current,
          category: scannedItem.category || '일반',
          location_code: scannedItem.location || null,
          location_id: scannedItem.location_id || null,
          source_type: scannedItem.source_table,
          notes: actionNote || '스캐너 입고',
        });
        toast.success('입고 처리 완료');
        resetAction();

      } else if (action === 'OUT') {
        await api.post('/wms/out', {
          lot_number: scannedItem.lot_number,
          qty: parseFloat(actionQty),
          notes: actionNote || '스캐너 출고',
        });
        toast.success('출고 처리 완료');
        setScannedItem(null);
        resetAction();

      } else if (action === 'SHIPMENT_READY') {
        if (!selectedPo) { toast.error('발주서를 선택해주세요.'); return; }
        await api.post('/wms/shipment-ready-register', {
          lot_number: scannedItem.lot_number,
          stock_id: scannedItem.id,
          po_id: selectedPo.po_id,
          po_date: selectedPo.order_date,
          po_number: selectedPo.po_number,
          site_name: selectedPo.site_name,
          qty: parseFloat(actionQty) || scannedItem.qty_current,
          notes: actionNote,
        });
        toast.success(`출하대기 등록 완료 — ${selectedPo.site_name}`);
        setScannedItem(null);
        resetAction();

      } else if (action === 'QTY_ADJUST') {
        await api.post('/wms/inventory', {
          lot_number: scannedItem.lot_number,
          item_name: scannedItem.item_name,
          qty: parseFloat(actionQty),
          category: scannedItem.category || '조정',
          source_type: scannedItem.source_table,
          notes: actionNote || '수량 조정',
        });
        toast.success('수량 조정 완료');
        resetAction();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50" onClick={() => scanInputRef.current?.focus()}>
      <PageHeader title="물류팀 재고관리" />

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-2xl mx-auto w-full">

        {/* ── 스캔 입력 ── */}
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
            <ScanLine className="inline h-3.5 w-3.5 mr-1" />
            바코드 스캔 / LOT 번호 입력
          </label>
          <div className="flex gap-2">
            <input
              ref={scanInputRef}
              type="text"
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleScan(); }}
              placeholder="LOT번호를 스캔하거나 입력하세요"
              className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-400 bg-slate-50"
              autoComplete="off"
              autoFocus
            />
            <button
              onClick={handleScan}
              disabled={!scanValue.trim() || scanning}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-blue-700"
            >
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : '조회'}
            </button>
          </div>
        </div>

        {/* ── 스캔 결과 ── */}
        {scannedItem && (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-300" />
                <span className="font-bold text-white text-sm font-mono">{scannedItem.lot_number}</span>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-bold',
                  scannedItem.wms_status === 'SHIPMENT_READY'
                    ? 'bg-amber-400 text-amber-900'
                    : 'bg-emerald-400 text-emerald-900'
                )}>
                  {WMS_STATUS_LABEL[scannedItem.wms_status || 'NORMAL'] || scannedItem.wms_status}
                </span>
              </div>
              <button onClick={() => { setScannedItem(null); resetAction(); }}
                className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-1 text-sm">
              <p className="font-bold text-gray-900">{scannedItem.item_name}</p>
              {scannedItem.spec && <p className="text-gray-500 text-xs">{scannedItem.spec}</p>}
              <div className="flex gap-4 mt-2">
                <div>
                  <span className="text-[10px] text-gray-400 block">수량</span>
                  <span className="font-bold text-blue-700">{Number(scannedItem.qty_current).toLocaleString()} {scannedItem.unit}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">현재 위치</span>
                  <span className="font-bold flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {scannedItem.location_name || scannedItem.location || '위치 미지정'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 작업 선택 버튼 ── */}
        {scannedItem && !action && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { type: 'IN'            as ActionType, icon: '📥', label: '입 고',    color: 'bg-emerald-500 hover:bg-emerald-600' },
              { type: 'OUT'           as ActionType, icon: '📤', label: '출 고',    color: 'bg-rose-500    hover:bg-rose-600'    },
              { type: 'MOVE'          as ActionType, icon: '🔀', label: '위치이동', color: 'bg-blue-500    hover:bg-blue-600'    },
              { type: 'SHIPMENT_READY'as ActionType, icon: '🚚', label: '출하대기', color: 'bg-amber-500   hover:bg-amber-600'   },
              { type: 'QTY_ADJUST'   as ActionType, icon: '📊', label: '수량조정', color: 'bg-violet-500  hover:bg-violet-600'  },
              { type: 'PRINT'         as ActionType, icon: '🖨',  label: '라벨출력', color: 'bg-slate-600   hover:bg-slate-700'   },
            ].map(btn => (
              <button
                key={btn.type}
                onClick={() => setAction(btn.type)}
                className={cn('rounded-2xl py-4 text-white font-bold text-sm flex flex-col items-center gap-1 transition-colors', btn.color)}
              >
                <span className="text-2xl">{btn.icon}</span>
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── 작업 패널 ── */}
        {scannedItem && action && action !== 'PRINT' && (
          <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">
                {action === 'IN'             && '📥 입고'}
                {action === 'OUT'            && '📤 출고'}
                {action === 'MOVE'           && '🔀 위치이동'}
                {action === 'SHIPMENT_READY' && '🚚 출하대기 등록'}
                {action === 'QTY_ADJUST'    && '📊 수량 조정'}
              </h3>
              <button onClick={resetAction} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>

            {/* 수량 입력 (SHIPMENT_READY 제외하고 모두) */}
            {action !== 'SHIPMENT_READY' && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">수량 ({scannedItem.unit})</label>
                <input type="number" value={actionQty} onChange={e => setActionQty(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            )}

            {/* 위치이동 전용 */}
            {action === 'MOVE' && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">이동할 위치 *</label>
                <LocationPicker
                  onChange={(code, id) => { setMoveLocationCode(code); setMoveLocationId(id); }}
                  placeholder="새 위치 선택"
                />
              </div>
            )}

            {/* 출하대기 발주서 검색 */}
            {action === 'SHIPMENT_READY' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">발주서 검색 (현장명) *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={poSearchKeyword}
                      onChange={e => setPoSearchKeyword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') searchPo(); }}
                      placeholder="현장명 입력"
                      className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <button onClick={searchPo} disabled={poSearching}
                      className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {poList.length > 0 && (
                  <div className="border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {poList.map(po => (
                      <button
                        key={po.po_id}
                        onClick={() => setSelectedPo(po)}
                        className={cn(
                          'w-full px-3 py-2.5 text-left text-xs border-b last:border-b-0 hover:bg-amber-50 transition-colors',
                          selectedPo?.po_id === po.po_id && 'bg-amber-100 font-bold'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800">{po.site_name || po.project_name || '-'}</span>
                          <span className="text-gray-400">{po.order_date?.slice(0,10)}</span>
                        </div>
                        <div className="text-gray-500 mt-0.5">{po.po_number} · {po.supplier_name || po.customer_name || ''}</div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPo && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <p className="text-xs font-bold text-amber-800">✅ 선택된 발주서</p>
                    <p className="text-sm font-semibold text-amber-900 mt-0.5">{selectedPo.site_name}</p>
                    <p className="text-xs text-amber-600">{selectedPo.po_number} · {selectedPo.order_date?.slice(0,10)}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">수량 ({scannedItem.unit})</label>
                  <input type="number" value={actionQty} onChange={e => setActionQty(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
            )}

            {/* 비고 */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">비고</label>
              <input type="text" value={actionNote} onChange={e => setActionNote(e.target.value)}
                placeholder="선택사항"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <button
              onClick={handleSave}
              disabled={saving ||
                (action === 'MOVE' && !moveLocationId) ||
                (action === 'SHIPMENT_READY' && !selectedPo)
              }
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-slate-800 transition-colors"
            >
              {saving ? '처리 중...' : '확인 저장'}
            </button>
          </div>
        )}

        {/* ── 라벨 출력 패널 ── */}
        {scannedItem && action === 'PRINT' && (
          <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">🖨 라벨 출력</h3>
              <button onClick={resetAction} className="text-gray-400"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-gray-500">
              Godex 프린터로 현재 위치 정보가 포함된 라벨을 출력합니다.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
              <p><span className="text-gray-400">LOT:</span> <span className="font-mono font-bold">{scannedItem.lot_number}</span></p>
              <p><span className="text-gray-400">품명:</span> {scannedItem.item_name}</p>
              <p><span className="text-gray-400">위치:</span> <span className="font-bold text-blue-700">{scannedItem.location_name || scannedItem.location || '미지정'}</span></p>
              <p><span className="text-gray-400">수량:</span> {scannedItem.qty_current} {scannedItem.unit}</p>
            </div>
            <p className="text-center text-xs text-gray-400 py-2">
              QZ Tray가 실행 중이면 아래 버튼으로 바로 출력됩니다.
            </p>
            <GodexLabelPrinterWrapper item={scannedItem} />
            <button onClick={resetAction}
              className="w-full border border-gray-300 text-gray-600 font-bold py-2 rounded-xl hover:bg-gray-50 text-sm">
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GodexLabelPrinterWrapper({ item }: { item: ScannedItem }) {
  return (
    <GodexLabelPrinter
      labelData={{
        lot_number: item.lot_number,
        item_name: item.item_name,
        category: item.category,
        density: item.density,
        thickness: item.thickness,
        width_mm: item.width_mm,
        length_mm: item.length_mm,
        unit: item.unit,
        qty_current: item.qty_current,
        received_date: item.received_date,
        location: item.location,
        location_name: item.location_name,
      }}
      onClose={() => {}}
    />
  );
}
