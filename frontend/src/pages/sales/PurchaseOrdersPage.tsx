import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, X, ChevronDown, ChevronRight,
  Building2, User, MapPin, Calendar, Package, Layers,
  CheckCircle2, AlertCircle, Eye, Trash2, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PurchaseOrder {
  po_id: number;
  project_id: number | null;
  project_code: string | null;
  project_name: string;
  file_name: string;
  order_date: string | null;
  delivery_date: string | null;
  submitter: string | null;
  construction_site: string | null;
  contractor: string | null;
  supervisor: string | null;
  site_address: string | null;
  special_notes: string | null;
  item_count: number;
  created_at: string;
}

interface PoItem {
  po_item_id: number;
  sheet_name: string;
  seq_no: number;
  item_type: 'socket' | 'extra';
  material: string | null;
  structure: string | null;
  pipe_width_mm: number | null;
  pipe_height_mm: number | null;
  opening_width_mm: number | null;
  opening_height_mm: number | null;
  qty: number;
  product_type: string | null;
  item_name: string | null;
  spec: string | null;
  remark: string | null;
}

interface ParsedPreview {
  project: Record<string, string>;
  items: PoItem[];
  raw_sheets: string[];
}

// 드래그앤드롭 업로드 영역
function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      onFile(file);
    } else {
      toast.error('Excel 파일(.xlsx, .xls)만 업로드 가능합니다.');
    }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200',
        dragging
          ? 'border-blue-500 bg-blue-50 scale-[1.01]'
          : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <Upload className={cn('h-12 w-12 mx-auto mb-3 transition-colors', dragging ? 'text-blue-500' : 'text-gray-400')} />
      <p className="text-base font-semibold text-gray-700">발주서 Excel 파일을 여기에 드래그하거나</p>
      <p className="text-sm text-gray-500 mt-1">클릭하여 파일을 선택하세요</p>
      <p className="text-xs text-gray-400 mt-2">.xlsx / .xls 형식 지원 • 이지원 발주서 양식</p>
    </div>
  );
}

// 미리보기 모달
function PreviewModal({
  preview, file, onConfirm, onClose, uploading,
}: {
  preview: ParsedPreview;
  file: File;
  onConfirm: () => void;
  onClose: () => void;
  uploading: boolean;
}) {
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set(preview.raw_sheets));
  const { project, items, raw_sheets } = preview;

  const socketItems = items.filter(i => i.item_type === 'socket');
  const extraItems = items.filter(i => i.item_type === 'extra');

  const bySheet = raw_sheets.reduce<Record<string, PoItem[]>>((acc, s) => {
    acc[s] = items.filter(i => i.sheet_name === s);
    return acc;
  }, {});

  const toggleSheet = (s: string) =>
    setExpandedSheets(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">발주서 업로드 확인</h2>
              <p className="text-sm text-gray-500">{file.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* 프로젝트 정보 */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              자동 추출된 프로젝트 정보
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="현장명 (프로젝트명)" value={project.project_name} highlight />
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="납기 요청일" value={project.delivery_date} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="제출인 (건축주)" value={project.submitter} />
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="시공사" value={project.contractor} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="납품지 주소" value={project.site_address} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="감리" value={project.supervisor} />
            </div>
            {project.special_notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
                <span className="font-semibold">특기사항:</span> {project.special_notes}
              </div>
            )}
          </div>

          {/* 발주 명세 요약 */}
          <div className="flex gap-3">
            <div className="flex-1 bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">{raw_sheets.length}</p>
              <p className="text-xs text-purple-600">시트(동) 수</p>
            </div>
            <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{socketItems.length}</p>
              <p className="text-xs text-green-600">방화소켓 발주</p>
            </div>
            <div className="flex-1 bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-700">{extraItems.length}</p>
              <p className="text-xs text-orange-600">추가 품목</p>
            </div>
            <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{items.reduce((s, i) => s + (i.qty || 1), 0)}</p>
              <p className="text-xs text-blue-600">총 수량 합계</p>
            </div>
          </div>

          {/* 시트별 명세 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              발주 명세 ({items.length}건)
            </h3>
            {raw_sheets.map(sheet => (
              <div key={sheet} className="border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSheet(sheet)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-sm text-gray-800">{sheet}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {bySheet[sheet]?.length || 0}건
                    </span>
                    {expandedSheets.has(sheet)
                      ? <ChevronDown className="h-4 w-4 text-gray-500" />
                      : <ChevronRight className="h-4 w-4 text-gray-500" />}
                  </div>
                </button>
                {expandedSheets.has(sheet) && bySheet[sheet] && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-t">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">NO</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">유형</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">재질</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">구조</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">규격 (가로×세로)</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">수량</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">제품형식</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bySheet[sheet].map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-600">{item.seq_no}</td>
                            <td className="px-3 py-1.5">
                              <span className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                item.item_type === 'socket'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-orange-100 text-orange-700'
                              )}>
                                {item.item_type === 'socket' ? '소켓' : '추가'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-gray-700">{item.material || item.item_name || '-'}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.structure || item.spec || '-'}</td>
                            <td className="px-3 py-1.5 font-mono text-gray-700">
                              {item.pipe_width_mm
                                ? `${item.pipe_width_mm} × ${item.pipe_height_mm}`
                                : '-'}
                            </td>
                            <td className="px-3 py-1.5 font-bold text-center text-gray-800">{item.qty}</td>
                            <td className="px-3 py-1.5 text-gray-600">{item.product_type || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-2xl">
          <p className="text-sm text-gray-600">
            위 내용으로 <strong>프로젝트 자동 생성</strong> 및 발주 명세가 등록됩니다.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-white transition-colors">
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={uploading}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {uploading ? (
                <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />등록 중...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />등록 확정</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value?: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-500 flex items-center gap-1">{icon}{label}</span>
      <span className={cn('text-sm font-medium truncate', highlight ? 'text-blue-700' : 'text-gray-800')}>
        {value || '-'}
      </span>
    </div>
  );
}

// 상세 모달
function DetailModal({ po, onClose }: { po: PurchaseOrder & { items?: PoItem[]; sheets?: string[] }; onClose: () => void }) {
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set(po.sheets || []));
  const bySheet = (po.sheets || []).reduce<Record<string, PoItem[]>>((acc, s) => {
    acc[s] = (po.items || []).filter(i => i.sheet_name === s);
    return acc;
  }, {});
  const toggleSheet = (s: string) =>
    setExpandedSheets(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">{po.project_name}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <InfoRow icon={<User className="h-3.5 w-3.5" />} label="제출인" value={po.submitter || undefined} />
            <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="시공사" value={po.contractor || undefined} />
            <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="납기 요청일" value={po.delivery_date || undefined} />
            <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="납품지" value={po.site_address || undefined} />
            <InfoRow icon={<User className="h-3.5 w-3.5" />} label="감리" value={po.supervisor || undefined} />
            <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="파일명" value={po.file_name} />
          </div>
          {po.special_notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <span className="font-semibold">특기사항:</span> {po.special_notes}
            </div>
          )}
          <div className="space-y-2">
            {(po.sheets || []).map(sheet => (
              <div key={sheet} className="border rounded-xl overflow-hidden">
                <button onClick={() => toggleSheet(sheet)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100">
                  <span className="font-medium text-sm">{sheet}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{bySheet[sheet]?.length || 0}건</span>
                    {expandedSheets.has(sheet) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </button>
                {expandedSheets.has(sheet) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-t">
                        <tr>
                          {['NO','유형','재질','구조','규격(가로×세로)','수량','제품형식','비고'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bySheet[sheet]?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5">{item.seq_no}</td>
                            <td className="px-3 py-1.5">
                              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium',
                                item.item_type === 'socket' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700')}>
                                {item.item_type === 'socket' ? '소켓' : '추가'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 font-mono">{item.material || item.item_name || '-'}</td>
                            <td className="px-3 py-1.5">{item.structure || item.spec || '-'}</td>
                            <td className="px-3 py-1.5 font-mono">{item.pipe_width_mm ? `${item.pipe_width_mm}×${item.pipe_height_mm}` : '-'}</td>
                            <td className="px-3 py-1.5 font-bold text-center">{item.qty}</td>
                            <td className="px-3 py-1.5">{item.product_type || '-'}</td>
                            <td className="px-3 py-1.5 text-gray-500">{item.remark || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const [list, setList] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detailPo, setDetailPo] = useState<(PurchaseOrder & { items?: PoItem[]; sheets?: string[] }) | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 비동기 base64 인코딩 (큰 파일 스택 오버플로우 방지)
  const toBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PurchaseOrder[] }>(`/purchase-orders${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setList(res.data ?? []);
    } catch {
      toast.error('발주서 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [search]);

  // 최초 1회 로드
  if (!initialized) {
    setInitialized(true);
    fetchList();
  }

  // 파일 선택 → 미리보기 파싱 (base64 JSON)
  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = toBase64(arrayBuffer);
      const res = await api.post<{ data: ParsedPreview }>('/purchase-orders/parse', {
        file_base64: base64,
        file_name: file.name,
      });
      setPreview(res.data);
      setPreviewFile(file);
    } catch (e: any) {
      toast.error(`파싱 실패: ${e?.body?.message || e.message}`);
    } finally {
      setParsing(false);
    }
  };

  // 확정 업로드 (base64 JSON)
  const handleConfirm = async () => {
    if (!previewFile) return;
    setUploading(true);
    try {
      const arrayBuffer = await previewFile.arrayBuffer();
      const base64 = toBase64(arrayBuffer);
      const res = await api.post<{ data: any }>('/purchase-orders/upload', {
        file_base64: base64,
        file_name: previewFile.name,
      });
      const d = res.data;
      toast.success(`발주서 등록 완료 — 프로젝트: ${d.project_name} / 명세 ${d.item_count}건`);
      setPreview(null);
      setPreviewFile(null);
      fetchList();
    } catch (e: any) {
      toast.error(`업로드 실패: ${e?.body?.message || e.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 상세 보기
  const handleDetail = async (po: PurchaseOrder) => {
    try {
      const res = await api.get<{ data: any }>(`/purchase-orders/${po.po_id}`);
      setDetailPo(res.data);
    } catch {
      toast.error('상세 정보 로드 실패');
    }
  };

  // 삭제
  const handleDelete = async (po: PurchaseOrder) => {
    if (!confirm(`"${po.project_name}" 발주서를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/purchase-orders/${po.po_id}`);
      toast.success('삭제되었습니다.');
      fetchList();
    } catch {
      toast.error('삭제 실패');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader title="발주서 관리" subtitle="Excel 발주서를 업로드하여 프로젝트 및 발주 명세를 자동 등록합니다" />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* 업로드 영역 */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-500" />
            발주서 Excel 업로드
          </h2>
          <DropZone onFile={handleFile} />
          {parsing && (
            <div className="flex items-center justify-center gap-2 py-3 text-blue-600 text-sm">
              <div className="h-4 w-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              발주서 읽는 중...
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">
            이지원 발주서 양식 자동 인식 • 현장명, 시공사, 감리자, 발주 명세 자동 추출
          </p>
        </div>

        {/* 발주서 목록 */}
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-500" />
              등록된 발주서 ({list.length}건)
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchList()}
                placeholder="현장명, 시공사 검색..."
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-48"
              />
              <button onClick={fetchList} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                검색
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="h-6 w-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-3" />
              로드 중...
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileSpreadsheet className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-sm">등록된 발주서가 없습니다.</p>
              <p className="text-xs mt-1">위 영역에 Excel 파일을 업로드하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['현장명 (프로젝트)', '시공사', '납기 요청일', '제출인', '명세 건수', '등록일', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map(po => (
                    <tr key={po.po_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">{po.project_name}</p>
                          {po.project_code && (
                            <p className="text-xs text-blue-600 font-mono">{po.project_code}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{po.contractor || '-'}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">{po.delivery_date || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{po.submitter || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          <Package className="h-3 w-3" />
                          {po.item_count}건
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(po.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDetail(po)}
                            className="p-1.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                            title="상세 보기"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {po.project_id && (
                            <button
                              onClick={() => window.open(`/projects?id=${po.project_id}`, '_blank')}
                              className="p-1.5 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                              title="프로젝트 보기"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(po)}
                            className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 미리보기 모달 */}
      {preview && previewFile && (
        <PreviewModal
          preview={preview}
          file={previewFile}
          onConfirm={handleConfirm}
          onClose={() => { setPreview(null); setPreviewFile(null); }}
          uploading={uploading}
        />
      )}

      {/* 상세 모달 */}
      {detailPo && <DetailModal po={detailPo} onClose={() => setDetailPo(null)} />}
    </div>
  );
}
