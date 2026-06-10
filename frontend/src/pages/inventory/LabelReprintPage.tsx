import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Scan, Printer, Search, RefreshCw, X, Package,
  Calendar, Tag, Barcode, AlertTriangle, CheckCircle2
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
  item_category: string | null;
  qty: number;
  remaining_qty: number;
  unit: string | null;
  item_unit: string | null;
  spec_thickness_mm: number | null;
  spec_width_mm: number | null;
  spec_length_mm: number | null;
  spec_density: string | null;
  status: string;
  staging_status: string | null;
  staging_location: string | null;
  inspection_result: string | null;
  created_at: string;
  lot_date: string | null;
}

// ─── 라벨 수량 조절 컴포넌트 ─────────────────────────────────
function LabelQtySelector({
  defaultQty, unit, onPrint,
}: {
  defaultQty: number;
  unit: string;
  onPrint: (qty: number) => void;
}) {
  const [labelQty, setLabelQty] = useState(defaultQty);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-600 w-14">라벨 수량</span>
        <button onClick={() => setLabelQty(q => Math.max(1, q - 1))}
          className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-base flex items-center justify-center">
          −
        </button>
        <input
          type="number" min={1} max={9999}
          value={labelQty}
          onChange={e => setLabelQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-20 border-2 border-blue-300 rounded-lg px-2 py-1.5 text-base font-bold text-center text-blue-700 focus:outline-none focus:border-blue-500"
        />
        <button onClick={() => setLabelQty(q => Math.min(9999, q + 1))}
          className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-base flex items-center justify-center">
          +
        </button>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>

      {/* 빠른 선택 */}
      <div className="flex gap-1.5 flex-wrap">
        {[1, 5, 10, 20, 50].map(n => (
          <button key={n} onClick={() => setLabelQty(n)}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-bold border transition-all',
              labelQty === n
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            )}>
            {n}장
          </button>
        ))}
        <button onClick={() => setLabelQty(defaultQty)}
          className="px-3 py-1 rounded-lg text-xs font-bold border border-blue-200 text-blue-600 hover:bg-blue-50">
          입고수량 ({defaultQty})
        </button>
      </div>

      <button onClick={() => onPrint(labelQty)}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
        <Printer className="h-4 w-4" />
        QR 라벨 {labelQty}장 출력 (Godex ZA120U · 80×60mm)
      </button>
    </div>
  );
}

// ─── LOT 카드 ────────────────────────────────────────────────
function LotCard({ lot, onPrint, onClear }: {
  lot: LotInfo;
  onPrint: (qty: number) => void;
  onClear: () => void;
}) {
  const thickness = lot.spec_thickness_mm ? String(lot.spec_thickness_mm) : '';
  const specParts = [
    thickness ? `${thickness}T` : '',
    lot.spec_width_mm  ? `${lot.spec_width_mm}mm`  : '',
    lot.spec_length_mm ? `× ${lot.spec_length_mm}mm` : '',
    lot.spec_density   ? `${lot.spec_density}kg/m³` : '',
  ].filter(Boolean).join(' × ').replace(' × ×', ' ×');

  const statusColor = lot.inspection_result === 'PASS'  ? 'text-green-600 bg-green-50'
                    : lot.inspection_result === 'FAIL'  ? 'text-red-600 bg-red-50'
                    : 'text-gray-600 bg-gray-50';
  const statusLabel = lot.inspection_result === 'PASS'  ? '합격'
                    : lot.inspection_result === 'FAIL'  ? '불합격'
                    : lot.status;

  return (
    <div className="bg-white rounded-2xl border-2 border-blue-200 overflow-hidden shadow-sm">
      {/* LOT 헤더 */}
      <div className="bg-blue-600 px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-blue-200 text-xs font-semibold">LOT 번호</p>
          <p className="text-white font-mono font-bold text-lg tracking-wide">{lot.lot_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold px-2 py-1 rounded-lg', statusColor)}>
            {statusLabel}
          </span>
          <button onClick={onClear} className="text-blue-200 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 라벨 출력 정보 */}
      <div className="p-5 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">라벨 출력 정보</p>

        {/* 필드 목록 */}
        <div className="space-y-2">
          {/* 로트번호 */}
          <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <span className="text-xs font-bold text-blue-400 w-14">로트번호</span>
            <span className="font-mono font-bold text-blue-700 text-sm">{lot.lot_number}</span>
          </div>
          {/* 품목명 */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs font-bold text-gray-400 w-14">품목명</span>
            <span className="font-semibold text-gray-800 text-sm flex-1">{lot.item_name || '-'}</span>
            {lot.item_code && (
              <span className="text-xs font-mono text-gray-400">{lot.item_code}</span>
            )}
          </div>
          {/* 규격 */}
          {(specParts || thickness) && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-gray-400 w-14">규격</span>
              <span className="text-gray-700 text-sm flex-1">{specParts || '-'}</span>
              {thickness && (
                <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">
                  {thickness}T
                </span>
              )}
            </div>
          )}
          {/* 수량 / 위치 / 날짜 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[10px] text-gray-400 font-bold">수량</p>
              <p className="font-bold text-blue-700 text-sm">{lot.remaining_qty ?? lot.qty} {lot.item_unit || lot.unit || 'EA'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[10px] text-gray-400 font-bold">위치</p>
              <p className="font-bold text-green-700 text-xs">{lot.staging_location || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[10px] text-gray-400 font-bold">입고일</p>
              <p className="text-gray-600 text-xs">{(lot.lot_date || lot.created_at)?.slice(0,10)}</p>
            </div>
          </div>
        </div>

        {/* 라벨 수량 선택 + 출력 */}
        <div className="border-t pt-3 mt-2">
          <LabelQtySelector
            defaultQty={lot.remaining_qty ?? lot.qty ?? 1}
            unit={lot.item_unit || lot.unit || 'EA'}
            onPrint={onPrint}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function LabelReprintPage() {
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanInput, setScanInput]   = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [foundLot, setFoundLot]     = useState<LotInfo | null>(null);
  const [recentLots, setRecentLots] = useState<LotInfo[]>([]);
  const [searchMode, setSearchMode] = useState<'scan' | 'list'>('scan');

  // 최근 LOT 목록 (재고 있는 것)
  const loadRecentLots = useCallback(async () => {
    try {
      const res = await api.get<{ data: LotInfo[] }>('/lots?status=ACTIVE&limit=50');
      setRecentLots(res.data ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadRecentLots();
    setTimeout(() => scanRef.current?.focus(), 100);
  }, [loadRecentLots]);

  // LOT 스캔/검색
  const handleSearch = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setError('');
    setFoundLot(null);
    setLoading(true);
    try {
      const res = await api.get<{ data: LotInfo }>(`/lots/scan/${encodeURIComponent(v)}`);
      setFoundLot(res.data);
    } catch {
      setError(`LOT '${v}' 을(를) 찾을 수 없습니다.`);
    } finally {
      setLoading(false);
      setScanInput('');
      setSearchInput('');
      scanRef.current?.focus();
    }
  };

  // LOT 목록에서 선택
  const handleSelectLot = (lot: LotInfo) => {
    setFoundLot(lot);
    setError('');
    setSearchMode('scan');
  };

  // 라벨 출력 팝업
  const handlePrint = (lot: LotInfo, labelQty: number) => {
    const thickness = lot.spec_thickness_mm ? String(lot.spec_thickness_mm) : '';
    const specStr = [
      thickness          ? `${thickness}T`             : '',
      lot.spec_width_mm  ? `${lot.spec_width_mm}mm`    : '',
      lot.spec_length_mm ? `× ${lot.spec_length_mm}mm` : '',
      lot.spec_density   ? `${lot.spec_density}kg/m³`  : '',
    ].filter(Boolean).join(' × ').replace(' × ×', ' ×');

    const params = new URLSearchParams({
      lotNumber: lot.lot_number,
      itemName:  lot.item_name  ?? '',
      itemCode:  lot.item_code  ?? '',
      spec:      specStr,
      qty:       String(labelQty),
      unit:      lot.item_unit || lot.unit || 'EA',
      lotDate:   (lot.lot_date || lot.created_at)?.slice(0,10) ?? '',
      category:  lot.item_category ?? '',
      thickness: thickness,
      location:  lot.staging_location ?? '',
      lotType:   lot.lot_type === 'ASSEMBLY' ? 'ASM' : lot.lot_type === 'STRUCT' ? 'STR' : 'IN',
    });
    window.open(
      `/lot-label.html?${params.toString()}`,
      '_blank',
      'width=960,height=800,menubar=no,toolbar=no,scrollbars=yes'
    );
    toast.success(`라벨 출력창 열림 (${labelQty}장)`);
  };

  // 검색 필터
  const filteredLots = recentLots.filter(l =>
    !searchInput ||
    l.lot_number.toLowerCase().includes(searchInput.toLowerCase()) ||
    (l.item_name || '').toLowerCase().includes(searchInput.toLowerCase()) ||
    (l.item_code || '').toLowerCase().includes(searchInput.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="LOT 라벨 재출력"
        description="LOT 번호 스캔 또는 목록에서 선택 → QR 라벨 수량 지정 → Godex ZA120U 출력"
      />

      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="max-w-2xl mx-auto space-y-4 mt-4">

          {/* 탭 */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([['scan','📡 LOT 스캔'], ['list','📋 LOT 목록 선택']] as const).map(([key, label]) => (
              <button key={key} onClick={() => { setSearchMode(key); if(key==='scan') setTimeout(()=>scanRef.current?.focus(),100); }}
                className={cn('flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                  searchMode === key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700')}>
                {label}
              </button>
            ))}
          </div>

          {/* ── 스캔 모드 ── */}
          {searchMode === 'scan' && (
            <div className="space-y-3">
              {/* 안내 */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <strong>📡 사용 방법</strong>
                <ol className="mt-1 space-y-0.5 list-decimal list-inside">
                  <li>바코드 스캐너로 기존 LOT 라벨의 QR 스캔 (또는 LOT 번호 직접 입력)</li>
                  <li>LOT 정보 확인 — 품목명 · 규격 · 로트번호 표시</li>
                  <li>라벨 수량 지정 → [출력] 버튼</li>
                </ol>
              </div>

              {/* 스캐너 입력창 */}
              <div className="bg-gray-900 rounded-xl p-4">
                <label className="block text-xs text-green-400 font-mono mb-2">◉ LOT QR / 번호 입력</label>
                <div className="flex gap-2">
                  <input
                    ref={scanRef}
                    type="text"
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch(scanInput)}
                    placeholder="스캐너 스캔 또는 LOT 번호 직접 입력..."
                    className="flex-1 bg-black border border-green-500 text-green-400 font-mono text-sm px-3 py-2.5 rounded-lg outline-none focus:border-green-300 placeholder:text-green-900"
                    autoComplete="off"
                  />
                  <button
                    onClick={() => handleSearch(scanInput)}
                    disabled={loading || !scanInput}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 오류 */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}
            </div>
          )}

          {/* ── 목록 모드 ── */}
          {searchMode === 'list' && !foundLot && (
            <div className="space-y-3">
              {/* 검색 */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="LOT 번호 또는 품목명 검색..."
                  className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />
              </div>

              {/* LOT 목록 */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {filteredLots.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">재고 LOT가 없습니다</p>
                  </div>
                ) : filteredLots.map(lot => {
                  const specStr = [
                    lot.spec_thickness_mm ? `${lot.spec_thickness_mm}T` : '',
                    lot.spec_width_mm     ? `${lot.spec_width_mm}mm`    : '',
                    lot.spec_length_mm    ? `× ${lot.spec_length_mm}mm` : '',
                  ].filter(Boolean).join(' × ').replace(' × ×', ' ×');

                  return (
                    <button key={lot.lot_id} onClick={() => handleSelectLot(lot)}
                      className="w-full text-left bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl p-3 flex items-center gap-3 transition-all group">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200">
                        <Tag className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-bold text-blue-700">{lot.lot_number}</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{lot.item_name || '-'}</p>
                        {specStr && <p className="text-xs text-gray-400">{specStr}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-blue-600">{lot.remaining_qty ?? lot.qty} {lot.item_unit || lot.unit || 'EA'}</p>
                        <p className="text-[10px] text-gray-400">{(lot.lot_date || lot.created_at)?.slice(0,10)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 결과: LOT 카드 + 출력 ── */}
          {foundLot && (
            <LotCard
              lot={foundLot}
              onPrint={(qty) => handlePrint(foundLot, qty)}
              onClear={() => { setFoundLot(null); setError(''); setTimeout(()=>scanRef.current?.focus(),100); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
