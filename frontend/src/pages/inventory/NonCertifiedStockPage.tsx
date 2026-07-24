import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { HelpCircle, Plus, Package, MapPin, AlertTriangle, CheckCircle, Trash2, Download, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// 구글시트에서 읽어온 비인정재고(LOT 없음) 원시 데이터
const GOOGLE_SHEET_NON_CERT_DATA = [
  // LOT 없는 항목만 (인정심사용, 소켓반품, 미출하 등)
  { rack_code: 'J3', pallet_no: 1, item_name: '그라스울보드', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'K3', pallet_no: 2, item_name: '인정심사용_세라믹울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'K3', pallet_no: 1, item_name: '인정심사용_세라믹울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'L3', pallet_no: 1, item_name: '인정심사용_강판', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'M3', pallet_no: 1, item_name: '인정심사용_미네랄울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'N3', pallet_no: 1, item_name: '인정심사용_미네랄울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'O3', pallet_no: 1, item_name: '인정심사용_미네랄울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'N1', pallet_no: 1, item_name: '인정심사용_시트', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'P3', pallet_no: 1, item_name: '인정심사용_세라믹울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'P3', pallet_no: 2, item_name: '인정심사용_그라스울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'P2', pallet_no: 1, item_name: '인정심사용_미네랄울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'Q3', pallet_no: 2, item_name: '인정심사용_세라믹울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'Q3', pallet_no: 1, item_name: '인정심사용_세라믹울', spec: '251022CW001(미확인됨)', lot_number: '251022CW001(미확인)', qty: 0, notes: '미확인 LOT 기재됨' },
  { rack_code: 'Q2', pallet_no: 1, item_name: '인정심사용_그라스울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'Q2', pallet_no: 2, item_name: '인정심사용_그라스울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'P1', pallet_no: 1, item_name: '소켓_반품', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'P1', pallet_no: 2, item_name: '소켓_반품', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'Q1', pallet_no: 1, item_name: '소켓_반품', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'Q1', pallet_no: 2, item_name: '소켓_반품', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'R1', pallet_no: 2, item_name: '인정심사용_플래싱2T', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'R3', pallet_no: 1, item_name: '인정심사용_그라스울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'R3', pallet_no: 2, item_name: '인정심사용_그라스울', spec: '', lot_number: '', qty: 0, notes: '구글시트 2026-07-24' },
  { rack_code: 'D3', pallet_no: 1, item_name: '미출하_소켓 및 부자재', spec: '', lot_number: '', qty: 0, notes: '송도캠퍼스_소켓 및 부자재' },
  { rack_code: 'D3', pallet_no: 2, item_name: '미출하_소켓 및 부자재', spec: '', lot_number: '', qty: 0, notes: '김앤드이_검단신도시_부자재' },
];

// 구글시트 LOT 있는 재고 데이터 (material_lots 등록용)
const GOOGLE_SHEET_LOT_DATA = [
  { rack_code: 'A1', pallet_no: 1, item_name: '세라믹울', spec: '96K 50T 400W 3600L', lot_number: '260610CW002', qty: 16 },
  { rack_code: 'A1', pallet_no: 2, item_name: '세라믹울', spec: '96K 50T 400W 3600L', lot_number: '260610CW002', qty: 15 },
  { rack_code: 'B1', pallet_no: 1, item_name: '세라믹울', spec: '96K 50T 400W 3600L', lot_number: '260203CW007', qty: 7 },
  { rack_code: 'B1', pallet_no: 2, item_name: '세라믹울', spec: '96K 50T 400W 3600L', lot_number: '260610CW002', qty: 13 },
  { rack_code: 'B2', pallet_no: 2, item_name: '세라믹울', spec: '96K 50T 400W 3600L', lot_number: '260610CW002', qty: 16 },
  { rack_code: 'C1', pallet_no: 2, item_name: '세라믹울', spec: '100K 38T 600W 4800L', lot_number: '260203CW004', qty: 6 },
  { rack_code: 'C1', pallet_no: 1, item_name: '세라믹울', spec: '100K 38T 600W 4800L', lot_number: '260203CW004', qty: 16 },
  { rack_code: 'D1', pallet_no: 2, item_name: '세라믹울', spec: '104K 50T 600W 3800L', lot_number: '260630CW001', qty: 3 },
  { rack_code: 'D2', pallet_no: 2, item_name: '세라믹울', spec: '100K 38T 600W 4800L', lot_number: '260203CW004', qty: 16 },
  { rack_code: 'D2', pallet_no: 1, item_name: '세라믹울', spec: '100K 38T 600W 4800L', lot_number: '260203CW004', qty: 16 },
  { rack_code: 'E2', pallet_no: 2, item_name: '세라믹울', spec: '104K 50T 600W 3800L', lot_number: '260630CW001', qty: 16 },
  { rack_code: 'E2', pallet_no: 1, item_name: '세라믹울', spec: '104K 50T 600W 3800L', lot_number: '260630CW001', qty: 16 },
  { rack_code: 'E1', pallet_no: 1, item_name: '세라믹울', spec: '104K 50T 600W 3800L', lot_number: '260630CW001', qty: 16 },
  { rack_code: 'E1', pallet_no: 2, item_name: '세라믹울', spec: '104K 50T 600W 3800L', lot_number: '260630CW001', qty: 16 },
  { rack_code: 'F1', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260630CW003', qty: 16 },
  { rack_code: 'F1', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260630CW003', qty: 16 },
  { rack_code: 'F2', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260630CW003', qty: 16 },
  { rack_code: 'F2', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260630CW003', qty: 16 },
  { rack_code: 'F3', pallet_no: 2, item_name: '세라믹울', spec: '104K 50T 600W 3800L', lot_number: '260630CW001', qty: 16 },
  { rack_code: 'F3', pallet_no: 1, item_name: '세라믹울', spec: '104K 50T 600W 3800L', lot_number: '260630CW001', qty: 16 },
  { rack_code: 'G2', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260630CW003', qty: 16 },
  { rack_code: 'G2', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260630CW003', qty: 16 },
  { rack_code: 'G3', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 8 },
  { rack_code: 'H3', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'H3', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'H2', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'H2', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'H1', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'H1', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'I1', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'I1', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'I2', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'I2', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'I3', pallet_no: 1, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'I3', pallet_no: 2, item_name: '세라믹울', spec: '104K 25T 200W 7400L', lot_number: '260722CW001', qty: 16 },
  { rack_code: 'J2', pallet_no: 1, item_name: '세라믹울', spec: '96K 50T 600W 3600L', lot_number: '260722CW003', qty: 2 },
  { rack_code: 'J2', pallet_no: 2, item_name: '세라믹울', spec: '96K 50T 600W 3600L', lot_number: '260722CW003', qty: 16 },
  { rack_code: 'J1', pallet_no: 1, item_name: '세라믹울', spec: '96K 50T 600W 3600L', lot_number: '260722CW003', qty: 16 },
  { rack_code: 'J1', pallet_no: 2, item_name: '세라믹울', spec: '96K 50T 600W 3600L', lot_number: '260722CW003', qty: 16 },
  { rack_code: 'K2', pallet_no: 1, item_name: '세라믹울', spec: '100K 25T 300W 7400L', lot_number: '260227CW003', qty: 18, notes: '2롤*9box' },
  { rack_code: 'K1', pallet_no: 1, item_name: '세라믹울', spec: '100K 25T 300W 7400L', lot_number: '260227CW003', qty: 80, notes: '2롤*40box' },
  { rack_code: 'L2', pallet_no: 1, item_name: '세라믹울', spec: '100K 25T 150W 7400L', lot_number: '260227CW005', qty: 104, notes: '4롤*26box' },
  { rack_code: 'L1', pallet_no: 1, item_name: '세라믹울', spec: '100K 38T 600W 4800L', lot_number: '260203CW004', qty: 40 },
  { rack_code: 'M2', pallet_no: 1, item_name: '세라믹울', spec: '100K 25T 300W 7400L', lot_number: '260203CW001', qty: 52, notes: '인정심사용' },
  { rack_code: 'M1', pallet_no: 1, item_name: '세라믹울', spec: '100K 38T 600W 4800L', lot_number: '260203CW004', qty: 40, notes: '인정심사용' },
  { rack_code: 'N2', pallet_no: 1, item_name: '세라믹울', spec: '100K 25T 300W 7400L', lot_number: '260203CW001', qty: 58, notes: '인정심사용' },
  { rack_code: 'N1', pallet_no: 2, item_name: '세라믹울', spec: '100K 25T 300W 7400L', lot_number: '260203CW001', qty: 10, notes: '인정심사용' },
  { rack_code: 'O2', pallet_no: 1, item_name: '세라믹울', spec: '96K 50T 1000W 3600L', lot_number: '260203CW006', qty: 10, notes: '인정심사용' },
  { rack_code: 'O1', pallet_no: 1, item_name: '세라믹울', spec: '100K 25T 300W 7400L', lot_number: '260203CW001', qty: 80, notes: '인정심사용' },
  { rack_code: 'R1', pallet_no: 1, item_name: '세라믹울', spec: '96K 50T 150W 3600L', lot_number: '260203CW008', qty: 90, notes: '15롤*6box' },
  { rack_code: 'R2', pallet_no: 1, item_name: '세라믹울', spec: '96K 38T 150W 4800L', lot_number: '260203CW005', qty: 40, notes: '4롤*10box' },
  { rack_code: 'R2', pallet_no: 2, item_name: '세라믹울', spec: '96K 25T 150W 7400L', lot_number: '260203CW003', qty: 40, notes: '4롤*10box' },
  { rack_code: 'P2', pallet_no: 2, item_name: '그라스울', spec: '', lot_number: '260402GW002', qty: 0, notes: '인정심사용' },
];

const ZONE_1_COLS = ['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'];
const ZONE_2_COLS = ['P','Q','R'];
const RACK_TIERS = [3, 2, 1];

interface NonCertItem {
  id: number;
  rack_code: string;
  pallet_no: number;
  item_name: string;
  spec?: string;
  lot_number?: string;
  qty: number;
  unit: string;
  reason: string;
  status: 'ACTIVE' | 'DISPOSED' | 'APPROVED_CONVERTED';
  notes?: string;
  registered_at: string;
}

export function NonCertifiedStockPage() {
  const [items, setItems] = useState<NonCertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');

  // 폼 상태
  const [rackCode, setRackCode] = useState('K3');
  const [palletNo, setPalletNo] = useState<1 | 2>(1);
  const [itemName, setItemName] = useState('');
  const [spec, setSpec] = useState('');
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState('로트미확인');
  const [notes, setNotes] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: NonCertItem[] }>('/non-certified-stock?status=ACTIVE');
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleGoogleSheetImport = async () => {
    if (!confirm(`구글시트(2026-07-24 현황)의 데이터를 로케이션 및 비인정재고에 등록합니다.\n\n• LOT 있는 재고: ${GOOGLE_SHEET_LOT_DATA.length}건 → 전체재고(material_lots) + 로케이션 반영\n• LOT 없는 재고: ${GOOGLE_SHEET_NON_CERT_DATA.length}건 → 비인정재고(non_certified_stock) 등록\n\n계속하시겠습니까?`)) return;

    setImporting(true);
    try {
      const allRows = [
        ...GOOGLE_SHEET_LOT_DATA.map(r => ({ ...r, lot_number: r.lot_number || '' })),
        ...GOOGLE_SHEET_NON_CERT_DATA.map(r => ({ ...r, lot_number: '' }))
      ];

      const res = await api.post<{ data: any; message: string }>('/non-certified-stock/google-sheet-import', {
        rows: allRows
      });

      const d = res.data;
      toast.success(
        `구글시트 업로드 완료!\n인정재고 ${d.certified?.total || 0}건 (신규: ${d.certified?.created || 0}, 갱신: ${d.certified?.updated || 0})\n비인정재고 ${d.non_certified?.total || 0}건 등록`
      );
      fetchItems();
    } catch (err: any) {
      toast.error(`업로드 오류: ${err.message || '서버 오류'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) { toast.error('품목명을 입력해 주세요.'); return; }

    try {
      await api.post('/non-certified-stock', {
        rack_code: rackCode,
        pallet_no: palletNo,
        item_name: itemName.trim(),
        spec: spec.trim() || null,
        qty,
        reason,
        notes: notes.trim() || null
      });
      toast.success(`[${rackCode}-P${palletNo}]에 비인정재고가 등록되었습니다.`);
      setShowModal(false);
      setItemName(''); setSpec(''); setNotes('');
      fetchItems();
    } catch {
      toast.error('등록 중 오류가 발생했습니다.');
    }
  };

  const handleDispose = async (id: number) => {
    if (!confirm('해당 항목을 폐기/소진 처리하시겠습니까?')) return;
    try {
      await api.delete(`/non-certified-stock/${id}`);
      toast.success('폐기처리 완료');
      fetchItems();
    } catch {
      toast.error('처리 중 오류 발생');
    }
  };

  const filteredItems = locationFilter
    ? items.filter(i => i.rack_code === locationFilter)
    : items;
  const activeCount = items.filter(i => i.status === 'ACTIVE').length;

  const allCols = [...ZONE_2_COLS, ...ZONE_1_COLS];
  const allRackCells = allCols.flatMap(col => RACK_TIERS.map(tier => `${col}${tier}`));

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="❓ 비인정 재고 현황 & 랙 적재 관리"
        description="정식 LOT 없는 재고(인정심사용, 소켓반품, 미출하 등) 및 규격외/시험용 항목 랙 적재 현황 관리"
      >
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleGoogleSheetImport}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-all shadow"
          >
            {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {importing ? '업로드 중...' : '구글시트 데이터 가져오기'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all shadow"
          >
            <Plus className="h-4 w-4" />
            신규 비인정 재고 등록
          </button>
        </div>
      </PageHeader>

      {/* 구글시트 안내 배너 */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <Download className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <h4 className="font-bold text-emerald-900 text-sm">📊 구글시트 → 로케이션 & 비인정재고 일괄 등록</h4>
          <p className="text-emerald-700 text-xs mt-0.5">
            <strong>구글시트 데이터 가져오기</strong> 버튼을 누르면 2026-07-24 기준 랙 현황이 자동으로 등록됩니다.<br />
            ✅ LOT 있는 재고({GOOGLE_SHEET_LOT_DATA.length}건) → 전체재고(material_lots) + 로케이션 위치 자동 반영<br />
            ⚠️ LOT 없는 재고({GOOGLE_SHEET_NON_CERT_DATA.length}건) → 비인정재고(non_certified_stock) 등록
          </p>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-600 text-white rounded-xl">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">비인정 재고 (LOT 없음)</p>
            <p className="text-xl font-black text-purple-900 mt-0.5">{activeCount}건</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500 text-white rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">관리 필요 항목</p>
            <p className="text-xl font-black text-amber-900 mt-0.5">{items.filter(i => i.lot_number?.includes('미확인')).length}건</p>
            <p className="text-[10px] text-amber-600">LOT 미확인 포함</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-xl">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">점유 랙 셀</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">
              {new Set(items.map(i => `${i.rack_code}-${i.pallet_no}`)).size}슬롯
            </p>
          </div>
        </div>
      </div>

      {/* 랙 위치 필터 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
            📍 랙 위치 필터 (클릭하여 필터 설정)
          </h4>
          {locationFilter && (
            <button onClick={() => setLocationFilter('')} className="text-xs text-purple-700 font-bold hover:underline">
              필터 해제 ✕
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allRackCells.map(loc => {
            const code = loc.slice(0, -1);
            const hasItem = items.some(i => i.rack_code === code);
            return (
              <button
                key={loc}
                onClick={() => setLocationFilter(locationFilter === code ? '' : code)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-mono font-bold border transition-all',
                  locationFilter === code
                    ? 'bg-purple-700 text-white border-purple-800'
                    : hasItem
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                )}
              >
                {loc}
              </button>
            );
          })}
        </div>
      </div>

      {/* 비인정재고 목록 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">
            비인정 재고 목록 (LOT 없음)
            {locationFilter && <span className="ml-2 text-purple-700">— {locationFilter}칸 필터 중</span>}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">총 {filteredItems.length}건</span>
            <button onClick={fetchItems} className="text-slate-400 hover:text-slate-600">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">랙 위치</th>
                <th className="px-4 py-3">파레트</th>
                <th className="px-4 py-3">품목명</th>
                <th className="px-4 py-3">규격 / LOT</th>
                <th className="px-4 py-3 text-right">수량</th>
                <th className="px-4 py-3">사유</th>
                <th className="px-4 py-3">비고</th>
                <th className="px-4 py-3">등록일</th>
                <th className="px-4 py-3 text-center">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">데이터 로딩 중...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">등록된 비인정 재고가 없습니다.</p>
                    <p className="text-xs mt-1">위의 <strong>구글시트 데이터 가져오기</strong> 버튼을 눌러 초기 데이터를 등록하세요.</p>
                  </td>
                </tr>
              ) : filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <span className="bg-slate-900 text-white text-xs font-black font-mono px-2 py-0.5 rounded">
                      {item.rack_code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded font-mono',
                      item.pallet_no === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                    )}>
                      P{item.pallet_no}{item.pallet_no === 1 ? '(우)' : '(좌)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {item.item_name}
                    {item.item_name?.startsWith('인정심사용') && (
                      <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">인정심사용</span>
                    )}
                    {item.item_name?.startsWith('소켓_반품') && (
                      <span className="ml-2 text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold">반품</span>
                    )}
                    {item.item_name?.startsWith('미출하') && (
                      <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">미출하</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                    {item.spec && <span className="block">{item.spec}</span>}
                    {item.lot_number && (
                      <span className={cn('block font-bold', item.lot_number.includes('미확인') ? 'text-amber-600' : 'text-slate-600')}>
                        LOT: {item.lot_number}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                    {Number(item.qty || 0).toLocaleString()}
                    <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.reason}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-32 truncate" title={item.notes || ''}>{item.notes || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{item.registered_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDispose(item.id)}
                      className="text-rose-500 hover:text-rose-700 transition-colors"
                      title="폐기/소진 처리"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">신규 비인정 재고 등록</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">랙 위치 (Bay)</label>
                  <select value={rackCode} onChange={e => setRackCode(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold bg-white">
                    {allRackCells.map(c => <option key={c} value={c.slice(0, -1)}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">파레트 번호</label>
                  <select value={palletNo} onChange={e => setPalletNo(Number(e.target.value) as 1 | 2)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold bg-white">
                    <option value={2}>P2 (왼쪽)</option>
                    <option value={1}>P1 (오른쪽)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">품목명 *</label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
                  placeholder="예: 인정심사용_세라믹울"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">규격 (선택)</label>
                  <input type="text" value={spec} onChange={e => setSpec(e.target.value)}
                    placeholder="예: 100K 38T 600W 4800L"
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">수량 (선택)</label>
                  <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold" min={0} />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">관리 사유</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
                  <option value="로트미확인">로트미확인</option>
                  <option value="인정심사용 시험재">인정심사용 시험재</option>
                  <option value="소켓/부자재 반품">소켓/부자재 반품</option>
                  <option value="미출하 보관">미출하 보관</option>
                  <option value="시험용 (R&D)">시험용 (R&D)</option>
                  <option value="규격외 임시재고">규격외 임시재고</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="특이사항 기재"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold">취소</button>
                <button type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow">
                  비인정재고 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
