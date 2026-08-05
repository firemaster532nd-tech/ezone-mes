import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { LocationPicker } from '@/components/LocationPicker';
import {
  ArrowRight, RefreshCw, X, CheckCircle2,
  AlertTriangle, ArrowLeftRight, Package, Box, Layers
} from 'lucide-react';
import { toast } from 'sonner';

interface RackTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialFromLocation?: string;
}

export function RackTransferModal({
  isOpen,
  onClose,
  onSuccess,
  initialFromLocation = '',
}: RackTransferModalProps) {
  const [fromLoc, setFromLoc] = useState(initialFromLocation);
  const [toLoc, setToLoc]     = useState('');

  // 출발지 재고 정보
  const [sourceInfo, setSourceInfo] = useState<{
    item_name: string;
    lot_number: string;
    qty: number;
    category?: string;
  } | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);

  // 도착지 재고 정보 (빈 공간인지, 동일/다른 재고인지)
  const [destInfo, setDestInfo] = useState<{
    item_name: string;
    lot_number: string;
    qty: number;
    isEmpty: boolean;
    isSameLot: boolean;
  } | null>(null);
  const [loadingDest, setLoadingDest] = useState(false);

  // 이동 수량 선택
  const [transferMode, setTransferMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [transferQty, setTransferQty]   = useState<number>(0);
  const [notes, setNotes]               = useState('');
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    if (initialFromLocation) setFromLoc(initialFromLocation);
  }, [initialFromLocation]);

  // 출발지 정보 조회 - rack-map에서 해당 위치 재고 필터링
  const fetchSourceStock = useCallback(async (code: string) => {
    if (!code) { setSourceInfo(null); return; }
    setLoadingSource(true);
    try {
      const res = await api.get<any>('/wms/rack-map');
      const payload = res.data?.data ?? res.data ?? {};
      const ncs: any[] = payload.non_certified ?? [];
      const lots: any[] = payload.lots ?? [];
      const mats: any[] = payload.material_lots ?? [];

      // location_code가 정확히 일치하는 항목 찾기
      const allItems = [
        ...ncs.map(r => ({ ...r, _qty: Number(r.qty ?? 0), _name: r.item_name, _lot: r.lot_number, _cat: '비인정재고' })),
        ...lots.map(r => ({ ...r, _qty: Number(r.remaining_qty ?? r.qty ?? 0), _name: r.item_name, _lot: r.lot_number, _cat: '인정재고' })),
        ...mats.map(r => ({ ...r, _qty: Number(r.qty_current ?? 0), _name: r.item_name, _lot: r.lot_number, _cat: r.category || '자재' })),
      ].filter(r => r.location_code === code);

      if (allItems.length > 0) {
        const item = allItems[0];
        setSourceInfo({
          item_name: item._name || '품목명 없음',
          lot_number: item._lot || 'LOT 없음',
          qty: item._qty,
          category: item._cat,
        });
        setTransferQty(item._qty);
      } else {
        setSourceInfo(null);
      }
    } catch {
      setSourceInfo(null);
    } finally {
      setLoadingSource(false);
    }
  }, []);

  // 도착지 정보 조회
  const fetchDestStock = useCallback(async (code: string, currentSourceLot?: string) => {
    if (!code) { setDestInfo(null); return; }
    setLoadingDest(true);
    try {
      const res = await api.get<any>('/wms/rack-map');
      const payload = res.data?.data ?? res.data ?? {};
      const ncs: any[] = payload.non_certified ?? [];
      const lots: any[] = payload.lots ?? [];
      const mats: any[] = payload.material_lots ?? [];

      const allItems = [
        ...ncs.map(r => ({ ...r, _qty: Number(r.qty ?? 0), _name: r.item_name, _lot: r.lot_number })),
        ...lots.map(r => ({ ...r, _qty: Number(r.remaining_qty ?? r.qty ?? 0), _name: r.item_name, _lot: r.lot_number })),
        ...mats.map(r => ({ ...r, _qty: Number(r.qty_current ?? 0), _name: r.item_name, _lot: r.lot_number })),
      ].filter(r => r.location_code === code);

      if (allItems.length > 0) {
        const item = allItems[0];
        const isSame = !!currentSourceLot && item._lot === currentSourceLot;
        setDestInfo({ item_name: item._name || '재고 존재', lot_number: item._lot || '', qty: item._qty, isEmpty: false, isSameLot: isSame });
      } else {
        setDestInfo({ item_name: '', lot_number: '', qty: 0, isEmpty: true, isSameLot: false });
      }
    } catch {
      setDestInfo({ item_name: '', lot_number: '', qty: 0, isEmpty: true, isSameLot: false });
    } finally {
      setLoadingDest(false);
    }
  }, []);




  useEffect(() => {
    fetchSourceStock(fromLoc);
  }, [fromLoc, fetchSourceStock]);

  useEffect(() => {
    fetchDestStock(toLoc, sourceInfo?.lot_number);
  }, [toLoc, sourceInfo?.lot_number, fetchDestStock]);

  if (!isOpen) return null;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromLoc) { toast.error('출발 위치를 선택하세요.'); return; }
    if (!toLoc) { toast.error('도착 위치를 선택하세요.'); return; }
    if (!sourceInfo) { toast.error('출발 위치에 재고가 없습니다.'); return; }
    if (fromLoc === toLoc) { toast.error('출발 위치와 도착 위치가 동일합니다.'); return; }

    const finalQty = transferMode === 'FULL' ? sourceInfo.qty : transferQty;
    if (finalQty <= 0) { toast.error('이동할 수량을 1개 이상 입력하세요.'); return; }
    if (finalQty > sourceInfo.qty) { toast.error('출발 위치의 현재고보다 많은 수량을 이동할 수 없습니다.'); return; }

    setSubmitting(true);
    try {
      const res = await api.post<any>('/wms/transfer', {
        from_location_code: fromLoc,
        to_location_code: toLoc,
        transfer_mode: transferMode,
        transfer_qty: finalQty,
        notes: notes,
      });

      toast.success(res.message || `✅ 렉 이동 성공: [${fromLoc}] ➔ [${toLoc}]`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`렉 이동 실패: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* 모달 헤더 */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">렉 / 로케이션 재고 이동 (수량 합침)</h2>
              <p className="text-[11px] text-slate-300">출발 렉 ➔ 도착 렉 재고 이동 및 합합 재고 처리</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleTransfer} className="p-6 space-y-5">
          {/* 출발 vs 도착 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            {/* 가운데 이동 화살표 (데스크탑) */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-indigo-600 text-white items-center justify-center shadow-md border-2 border-white">
              <ArrowRight className="h-4 w-4" />
            </div>

            {/* 출발 위치 (FROM) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Box className="h-4 w-4 text-blue-600" />
                  1. 출발 위치 (FROM)
                </span>
                {loadingSource && <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />}
              </div>

              <LocationPicker
                value={fromLoc}
                onChange={code => setFromLoc(code)}
                placeholder="출발 렉/파레트 선택"
              />

              {/* 출발지 재고 정보 카드 */}
              {sourceInfo ? (
                <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-1 text-xs shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 truncate max-w-[140px]">{sourceInfo.item_name}</span>
                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">
                      {sourceInfo.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">LOT: {sourceInfo.lot_number}</div>
                  <div className="text-xs font-black text-blue-700 pt-1 border-t flex justify-between">
                    <span>현재고:</span>
                    <span>{sourceInfo.qty.toLocaleString()} EA</span>
                  </div>
                </div>
              ) : fromLoc ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-xs font-bold text-amber-800 flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    선택한 위치에 재고가 없습니다
                  </p>
                </div>
              ) : null}
            </div>

            {/* 도착 위치 (TO) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-emerald-600" />
                  2. 도착 위치 (TO)
                </span>
                {loadingDest && <RefreshCw className="h-3 w-3 animate-spin text-emerald-600" />}
              </div>

              <LocationPicker
                value={toLoc}
                onChange={code => setToLoc(code)}
                placeholder="도착 렉/파레트 선택"
              />

              {/* 도착지 상태 카드 */}
              {destInfo ? (
                destInfo.isEmpty ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                    <p className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      🟢 빈 공간 (즉시 이동 가능)
                    </p>
                  </div>
                ) : destInfo.isSameLot ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1 text-xs">
                    <p className="text-xs font-bold text-blue-900 flex items-center gap-1">
                      🔵 동일 LOT 적재 중 (수량 합침)
                    </p>
                    <p className="text-[11px] text-blue-700">기존: {destInfo.qty} EA + 이동분 ➔ 수량이 합쳐집니다.</p>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1 text-xs">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                      🟧 다른 품목 적재 중 ({destInfo.item_name})
                    </p>
                    <p className="text-[11px] text-amber-700">기존 재고: {destInfo.qty} EA (LOT: {destInfo.lot_number})</p>
                  </div>
                )
              ) : null}
            </div>
          </div>

          {/* 이동 수량 방식 선택 */}
          {sourceInfo && (
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-3">
              <label className="block text-xs font-bold text-indigo-900">
                📦 이동 수량 선택
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTransferMode('FULL');
                    setTransferQty(sourceInfo.qty);
                  }}
                  className={`p-3 rounded-lg border text-left transition ${
                    transferMode === 'FULL'
                      ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs">● 전체 수량 이동</div>
                  <div className="text-sm font-black mt-1">{sourceInfo.qty.toLocaleString()} EA (전체)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferMode('PARTIAL')}
                  className={`p-3 rounded-lg border text-left transition ${
                    transferMode === 'PARTIAL'
                      ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs">○ 일부 수량 이동</div>
                  <div className="text-sm font-black mt-1">수량 직접 입력</div>
                </button>
              </div>

              {/* 일부 이동 수량 입력창 */}
              {transferMode === 'PARTIAL' && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs font-bold text-indigo-950 shrink-0">이동할 수량:</label>
                  <input
                    type="number"
                    min={1}
                    max={sourceInfo.qty}
                    value={transferQty}
                    onChange={e => setTransferQty(Number(e.target.value))}
                    className="w-32 border-2 border-indigo-300 rounded-lg px-3 py-1.5 font-bold text-indigo-900 text-sm focus:outline-none focus:border-indigo-600"
                  />
                  <span className="text-xs text-slate-500 font-semibold">
                    EA (보유 {sourceInfo.qty} EA 중)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 이동 메모 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">이동 사유 / 메모</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="예: 2공장 출하 준비를 위한 랙 재배치"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 버튼 */}
          <div className="flex items-center justify-between pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              취소
            </button>

            <button
              type="submit"
              disabled={submitting || !fromLoc || !toLoc || !sourceInfo}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white transition flex items-center gap-2 shadow-md ${
                submitting || !fromLoc || !toLoc || !sourceInfo
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  이동 처리 중...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  🚀 렉 이동 실행
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
