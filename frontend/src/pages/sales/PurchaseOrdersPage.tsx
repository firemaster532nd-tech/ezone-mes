import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, X, ChevronDown, ChevronRight,
  Building2, User, MapPin, Calendar, Package, Layers,
  CheckCircle2, Eye, Trash2, ExternalLink, Download, Wrench,
  FolderOpen, PlusCircle, MinusCircle, ClipboardList, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  project_id: number;
  project_code: string;
  project_name: string;
  status: string;
}

interface PurchaseOrder {
  po_id: number | null;
  project_id: number | null;
  project_code: string | null;
  project_name: string;
  file_name: string;
  order_date: string | null;
  delivery_date: string | null;
  // 발주처
  biz_name: string | null;
  biz_no: string | null;
  biz_ceo: string | null;
  biz_address: string | null;
  biz_manager: string | null;
  biz_contact: string | null;
  // 제출인 / 공사
  submitter: string | null;
  submitter_address: string | null;
  construction_site: string | null;
  contractor: string | null;
  contractor_address: string | null;
  supervisor: string | null;
  supervisor_office: string | null;
  supervisor_address: string | null;
  // 납품
  site_address: string | null;
  consignee: string | null;
  builder_name: string | null;
  special_notes: string | null;
  item_count: number;
  created_at: string;
  // ★ 연동 타입
  source_type: 'PO' | 'PROJECT_ONLY';
  customer_name: string | null;
  project_remarks: string | null;
  project_status: string | null;
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
  lot_number: string | null;
  construction_type: 'SINGLE' | 'DOUBLE' | null;
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
  projects, selectedProjectId, onProjectChange,
}: {
  preview: ParsedPreview;
  file: File;
  onConfirm: () => void;
  onClose: () => void;
  uploading: boolean;
  projects: Project[];
  selectedProjectId: number | null;
  onProjectChange: (id: number | null) => void;
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

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* ★ 프로젝트 선택 */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <h3 className="font-semibold text-indigo-800 flex items-center gap-2 text-sm mb-3">
              <FolderOpen className="h-4 w-4" />
              연결할 프로젝트 선택
            </h3>
            <select
              value={selectedProjectId ?? ''}
              onChange={e => onProjectChange(e.target.value === '' ? null : Number(e.target.value))}
              className={cn(
                'w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2',
                selectedProjectId
                  ? 'border-indigo-300 focus:ring-indigo-400'
                  : 'border-red-400 focus:ring-red-400 bg-red-50'
              )}
            >
              <option value="">❌ 프로젝트를 선택해주세요 (필수)</option>
              {projects.map(p => (
                <option key={p.project_id} value={p.project_id}>
                  [{p.project_code}] {p.project_name}
                </option>
              ))}
            </select>
            {selectedProjectId ? (
              <p className="text-xs text-indigo-600 mt-1.5 flex items-center gap-1">
                ✅ 선택된 프로젝트에 이 발주서를 연결합니다.
              </p>
            ) : (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-semibold">
                ⚠️ 프로젝트를 선택하지 않으면 등록이 차단됩니다. 반드시 선택하세요.
              </p>
            )}
          </div>
          {/* 발주처 정보 */}
          <div className="bg-orange-50 rounded-xl p-4 space-y-3 border border-orange-100">
            <h3 className="font-semibold text-orange-800 flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              발주처 정보
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="업체명" value={project.biz_name} highlight />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="사업자번호" value={project.biz_no} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="대표자" value={project.biz_ceo} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="담당자" value={project.biz_manager} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="주소" value={project.biz_address} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="연락처" value={project.biz_contact} />
            </div>
          </div>

          {/* 프로젝트·납품 정보 */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" />
              현장 및 납품 정보
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="현장명 (프로젝트명)" value={project.project_name} highlight />
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="납기 요청일" value={project.delivery_date} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="납품지 주소" value={project.site_address} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="인수자" value={project.consignee} />
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="건설사" value={project.builder_name} />
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="발주 일자" value={project.order_date} />
            </div>
          </div>

          {/* 제출인 / 시공사 / 감리 */}
          <div className="bg-green-50 rounded-xl p-4 space-y-3 border border-green-100">
            <h3 className="font-semibold text-green-800 flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              제출인 / 시공사 / 감리
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="제출인 (건축주)" value={project.submitter} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="제출인 주소" value={project.submitter_address} />
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="시공사" value={project.contractor} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="시공사 주소" value={project.contractor_address} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="감리" value={project.supervisor} />
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="감리 사무소" value={project.supervisor_office} />
            </div>
          </div>

          {/* 특기사항 */}
          {project.special_notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-800 mb-1">📌 특기사항</p>
              <p className="text-sm text-yellow-900">{project.special_notes}</p>
            </div>
          )}

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
            {selectedProjectId
              ? <><strong className="text-indigo-700">선택한 프로젝트</strong>에 발주 명세가 등록됩니다.</>
              : <span className="text-red-600 font-semibold">❌ 프로젝트를 먼저 선택하세요</span>
            }
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-white transition-colors">
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={uploading || !selectedProjectId}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                selectedProjectId
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              )}
              title={!selectedProjectId ? '프로젝트를 선택해야 등록 가능합니다' : ''}
            >
              {uploading ? (
                <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />등록 중...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />{selectedProjectId ? '등록 확정' : '프로젝트 선택 필수'}</>
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
  // 단면/양면 로컬 상태 (po_item_id → construction_type)
  const [ctypes, setCtypes] = useState<Record<number, 'SINGLE' | 'DOUBLE'>>(
    () => Object.fromEntries((po.items || []).map(i => [i.po_item_id, i.construction_type ?? 'DOUBLE']))
  );
  const [ctypeLoading, setCtypeLoading] = useState<Record<number, boolean>>({});

  const toggleCtype = async (itemId: number) => {
    const cur = ctypes[itemId] ?? 'DOUBLE';
    const next: 'SINGLE' | 'DOUBLE' = cur === 'DOUBLE' ? 'SINGLE' : 'DOUBLE';
    setCtypeLoading(p => ({ ...p, [itemId]: true }));
    try {
      await api.patch(`/purchase-orders/items/${itemId}/construction-type`, { construction_type: next });
      setCtypes(p => ({ ...p, [itemId]: next }));
    } catch { toast.error('변경 실패'); }
    finally { setCtypeLoading(p => ({ ...p, [itemId]: false })); }
  };

  const batchToggleSheet = async (poId: number | null, sheetName: string, next: 'SINGLE' | 'DOUBLE') => {
    if (!poId) return;
    try {
      await api.patch(`/purchase-orders/${poId}/sheet-construction-type`, { sheet_name: sheetName, construction_type: next });
      // 해당 차수 소켓 전체 업데이트
      setCtypes(prev => {
        const upd = { ...prev };
        (po.items || []).filter(i => i.sheet_name === sheetName && i.item_type === 'socket').forEach(i => { upd[i.po_item_id] = next; });
        return upd;
      });
      toast.success(`${sheetName} 전체 ${next === 'SINGLE' ? '단면' : '양면'}으로 변경`);
    } catch { toast.error('일괄 변경 실패'); }
  };

  // 정렬: ① 차수(sheet_name) → ② 구조체 종류 → ③ 가로(W) → ④ 세로(H)
  const PTYPE_ORDER: Record<string, number> = {
    'VT-049': 1, 'VT-064': 2, 'VT-01': 3, 'VA-064': 4,
    'VAG-1.69': 5, 'HTG-064': 6, 'HTG-064DC': 7, 'HTG-1.69': 8,
  };
  const sortedItems = [...(po.items || [])].sort((a, b) => {
    if (a.item_type === 'socket' && b.item_type === 'socket') {
      // ① 차수(sheet_name) 오름차순 (최우선)
      const sa = a.sheet_name || '';
      const sb = b.sheet_name || '';
      if (sa !== sb) return sa.localeCompare(sb);
      // ② 구조체 종류 그룹
      const pa = PTYPE_ORDER[a.product_type || ''] ?? 9;
      const pb = PTYPE_ORDER[b.product_type || ''] ?? 9;
      if (pa !== pb) return pa - pb;
      // ③ 관통재 가로 오름차순
      if ((a.pipe_width_mm ?? 0) !== (b.pipe_width_mm ?? 0))
        return (a.pipe_width_mm ?? 0) - (b.pipe_width_mm ?? 0);
      // ④ 관통재 세로 오름차순
      return (a.pipe_height_mm ?? 0) - (b.pipe_height_mm ?? 0);
    }
    return 0;
  });

  // 차수(sheet_name) 목록 — 정렬된 items에서 순서대로 추출 (중복 제거)
  const allSheets = [...new Set(sortedItems.map(i => i.sheet_name).filter(Boolean) as string[])];
  const bySheet = allSheets.reduce<Record<string, PoItem[]>>((acc, s) => {
    acc[s] = sortedItems.filter(i => i.sheet_name === s);
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
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 발주처 정보 */}
          {(po.biz_name || po.biz_no) && (
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
              <p className="text-xs font-bold text-orange-700 mb-2">📦 발주처 정보</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="업체명" value={po.biz_name || undefined} highlight />
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="사업자번호" value={po.biz_no || undefined} />
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="대표자" value={po.biz_ceo || undefined} />
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="담당자" value={po.biz_manager || undefined} />
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="연락처" value={po.biz_contact || undefined} />
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="주소" value={po.biz_address || undefined} />
              </div>
            </div>
          )}
          {/* 현장·납품 정보 */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs font-bold text-blue-700 mb-2">🏗️ 현장 및 납품 정보</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="현장명" value={po.project_name} highlight />
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="납기 요청일" value={po.delivery_date || undefined} />
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="발주일자" value={po.order_date || undefined} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="납품지 주소" value={po.site_address || undefined} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="인수자" value={po.consignee || undefined} />
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="건설사" value={po.builder_name || undefined} />
            </div>
          </div>
          {/* 제출인 / 시공사 / 감리 */}
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <p className="text-xs font-bold text-green-700 mb-2">👷 제출인 / 시공사 / 감리</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="제출인 (건축주)" value={po.submitter || undefined} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="제출인 주소" value={po.submitter_address || undefined} />
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="시공사" value={po.contractor || undefined} />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="시공사 주소" value={po.contractor_address || undefined} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="감리" value={po.supervisor || undefined} />
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="감리 사무소" value={po.supervisor_office || undefined} />
            </div>
          </div>
          {/* 특기사항 */}
          {po.special_notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-800 mb-1">📌 특기사항</p>
              <p className="text-sm text-yellow-900">{po.special_notes}</p>
            </div>
          )}
          <div className="space-y-2">
            {allSheets.map(sheet => (
              <div key={sheet} className="border rounded-xl overflow-hidden">
                <button onClick={() => toggleSheet(sheet)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100">
                  <span className="font-medium text-sm">{sheet}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{bySheet[sheet]?.length || 0}건</span>
                    {/* 차수별 단면/양면 일괄 변경 */}
                    {(() => {
                      const sockets = (bySheet[sheet] || []).filter(i => i.item_type === 'socket');
                      const allSingle = sockets.length > 0 && sockets.every(i => (ctypes[i.po_item_id] ?? 'DOUBLE') === 'SINGLE');
                      return sockets.length > 0 ? (
                        <button
                          onClick={e => { e.stopPropagation(); batchToggleSheet(po.po_id, sheet, allSingle ? 'DOUBLE' : 'SINGLE'); }}
                          className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold border transition-colors',
                            allSingle
                              ? 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200'
                              : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200')}
                        >
                          {allSingle ? '🟠 단면 전체' : '🔵 양면 전체'}
                        </button>
                      ) : null;
                    })()}
                    {expandedSheets.has(sheet) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </button>
                {expandedSheets.has(sheet) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-t">
                        <tr>
                          {['NO','유형','재질','규격(가로×세로)','수량','단면/양면','제품형식','LOT번호','비고'].map(h => (
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
                            <td className="px-3 py-1.5 font-mono">{item.pipe_width_mm ? `${item.pipe_width_mm}×${item.pipe_height_mm}` : '-'}</td>
                            <td className="px-3 py-1.5 font-bold text-center">{item.qty}</td>
                            {/* 단면/양면 토글 */}
                            <td className="px-2 py-1.5">
                              {item.item_type === 'socket' ? (
                                <button
                                  disabled={ctypeLoading[item.po_item_id]}
                                  onClick={() => toggleCtype(item.po_item_id)}
                                  className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-full font-semibold border transition-colors whitespace-nowrap',
                                    ctypeLoading[item.po_item_id] ? 'opacity-50 cursor-wait' :
                                    (ctypes[item.po_item_id] ?? 'DOUBLE') === 'SINGLE'
                                      ? 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200'
                                      : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                                  )}
                                >
                                  {(ctypes[item.po_item_id] ?? 'DOUBLE') === 'SINGLE' ? '🟠 단면' : '🔵 양면'}
                                </button>
                              ) : <span className="text-gray-300 text-[10px]">-</span>}
                            </td>
                            <td className="px-3 py-1.5">{item.product_type || '-'}</td>
                             <td className="px-3 py-1.5">
                               {item.lot_number ? (
                                 <span className="font-mono text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                                   {item.lot_number}
                                 </span>
                               ) : '-'}
                             </td>
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
// 수동 입력 모달
// ────────────────────────────────────────────────────────────────────────────
const PRODUCT_TYPES = [
  'VT-049', 'VT-064', 'VT-01', 'VA-064', 'VAG-1.69',
  'HTG-064', 'HTG-064DC', 'HTG-1.69',
];

const STRUCT_CALC_MANUAL: Partial<Record<string, (w: number, h: number, q: number) => { sw: number; sh: number; oq: number; depth: number }>> = {
  'VT-01':     (w, h, q) => ({ sw: w,                       sh: h, oq: q * 2, depth: 200 }),
  'VT-049':    (w, h, q) => ({ sw: w,                       sh: h, oq: q * 1, depth: 200 }),
  'VT-064':    (w, h, q) => ({ sw: w,                       sh: h, oq: q * 1, depth: 200 }),
  'VA-064':    (w, h, q) => ({ sw: w,                       sh: h, oq: q * 1, depth: 200 }),
  'VAG-1.69':  (w, h, q) => ({ sw: Math.round(w / 2 - 30),  sh: h, oq: q * 2, depth: 200 }),
  'HTG-064':   (w, h, q) => ({ sw: w,                       sh: h, oq: q * 1, depth: 300 }),
  'HTG-064DC': (w, h, q) => ({ sw: w,                       sh: h, oq: q * 1, depth: 300 }),
  'HTG-1.69':  (w, h, q) => ({ sw: Math.round(w / 2 - 30),  sh: h, oq: q * 2, depth: 300 }),
};

interface ManualItem {
  product_type: string;
  pipe_width_mm: string;
  pipe_height_mm: string;
  qty: string;
  construction_type: 'SINGLE' | 'DOUBLE';
  remark: string;
}

interface ManualSheet {
  name: string;
  items: ManualItem[];
}

function makeEmptyItem(): ManualItem {
  return { product_type: 'VT-049', pipe_width_mm: '', pipe_height_mm: '', qty: '1', construction_type: 'DOUBLE', remark: '' };
}

function ManualPoModal({ onClose, onSaved, projects }: {
  onClose: () => void;
  onSaved: () => void;
  projects: Project[];
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // 기본 정보
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [bizName, setBizName] = useState('');
  const [bizManager, setBizManager] = useState('');
  const [bizContact, setBizContact] = useState('');
  const [contractor, setContractor] = useState('');
  const [builderName, setBuilderName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  // 시트별 품목
  const [sheets, setSheets] = useState<ManualSheet[]>([{ name: 'A동', items: [makeEmptyItem()] }]);

  // 프로젝트 선택 시 이름 자동 채우기
  const handleProjectChange = (id: number | null) => {
    setProjectId(id);
    if (id) {
      const p = projects.find(p => p.project_id === id);
      if (p) setProjectName(p.project_name);
    }
  };

  // 시트 추가/삭제
  const addSheet = () => setSheets(s => [...s, { name: `${String.fromCharCode(65 + s.length)}동`, items: [makeEmptyItem()] }]);
  const removeSheet = (si: number) => setSheets(s => s.length > 1 ? s.filter((_, i) => i !== si) : s);
  const updateSheetName = (si: number, name: string) =>
    setSheets(s => s.map((sh, i) => i === si ? { ...sh, name } : sh));

  // 품목 CRUD
  const addItem = (si: number) =>
    setSheets(s => s.map((sh, i) => i === si ? { ...sh, items: [...sh.items, makeEmptyItem()] } : sh));
  const removeItem = (si: number, ii: number) =>
    setSheets(s => s.map((sh, i) => i === si ? { ...sh, items: sh.items.length > 1 ? sh.items.filter((_, j) => j !== ii) : sh.items } : sh));
  const updateItem = (si: number, ii: number, field: keyof ManualItem, value: string) =>
    setSheets(s => s.map((sh, i) => i === si ? {
      ...sh,
      items: sh.items.map((it, j) => j === ii ? { ...it, [field]: value } : it),
    } : sh));

  // ── 소켓 계산 (입력값 전체) ─────────────────────────────────────────────
  type CalcRow = { sheetName: string; product_type: string; w: number; h: number; qty: number; sw: number; sh: number; oq: number; depth: number; construction_type: 'SINGLE'|'DOUBLE' };
  const calcAllRows = (): CalcRow[] => {
    const rows: CalcRow[] = [];
    for (const sh of sheets) {
      for (const it of sh.items) {
        const w = Number(it.pipe_width_mm) || 0;
        const h = Number(it.pipe_height_mm) || 0;
        const q = Number(it.qty) || 1;
        const calc = STRUCT_CALC_MANUAL[it.product_type];
        if (calc && w > 0 && h > 0) {
          rows.push({ sheetName: sh.name, product_type: it.product_type, w, h, qty: q, ...calc(w, h, q), construction_type: it.construction_type });
        }
      }
    }
    return rows;
  };

  // 평철(브라켓) 계산 — PurchaseRequestPage calcBrackets 동일 로직
  type BracketRow = { label: string; t: number; bw: number; l: number; qty: number };
  const calcBrackets = (code: string, w: number, h: number, q: number): BracketRow[] => {
    const sw = Math.round(w / 2 - 30);
    switch (code) {
      case 'VT-049': case 'VT-064': case 'VA-064':
        return [
          { label: 'bracket-H', t: 1.6, bw: 60,  l: w - 1,  qty: q * 4 },
          { label: 'bracket-V', t: 1.6, bw: 60,  l: h - 30, qty: q * 4 },
        ];
      case 'VT-01':
        return [
          { label: 'bracket-H', t: 1.6, bw: 60,  l: Math.round(w/2 - 16), qty: q * 16 },
          { label: 'bracket-V', t: 1.6, bw: 60,  l: Math.round(h/2 - 20), qty: q * 32 },
          { label: 'support-C', t: 1.6, bw: 225, l: Math.round(w/2 - 16), qty: q * 8  },
          { label: 'reinforce', t: 1.6, bw: 237, l: h - 1,                    qty: q * 4  },
        ];
      case 'VAG-1.69':
        return [
          { label: 'bracket-HA',  t: 0.6, bw: 60,  l: sw - 5, qty: q * 4 },
          { label: 'bracket-HB',  t: 0.6, bw: 204, l: sw - 5, qty: q * 4 },
          { label: 'support-C1',  t: 0.6, bw: 235, l: sw,     qty: q * 2 },
          { label: 'support-C2',  t: 0.6, bw: 190, l: sw,     qty: q * 2 },
        ];
      case 'HTG-064': case 'HTG-064DC':
        return [
          { label: 'bracket-HA', t: 0.6, bw: 60,  l: w - 5,  qty: q * 2 },
          { label: 'bracket-HB', t: 0.6, bw: 274, l: w - 5,  qty: q * 2 },
          { label: 'bracket-V',  t: 1.6, bw: 60,  l: h - 35, qty: q * 4 },
          { label: 'reinforce',  t: 1.6, bw: 50,  l: h,      qty: q * 3 },
        ];
      case 'HTG-1.69':
        return [
          { label: 'bracket-HA',  t: 0.6, bw: 60,  l: sw,     qty: q * 4 },
          { label: 'bracket-HB',  t: 0.6, bw: 274, l: sw,     qty: q * 4 },
          { label: 'support-C1',  t: 0.6, bw: 318, l: sw + 5, qty: q * 8 },
          { label: 'support-C2',  t: 0.6, bw: 255, l: sw + 5, qty: q * 8 },
          { label: 'bracket-V',   t: 1.6, bw: 60,  l: h - 35, qty: q * 4 },
          { label: 'reinforce',   t: 1.6, bw: 50,  l: h,      qty: q * 6 },
        ];
      default: return [];
    }
  };

  const handleSave = async () => {
    // ★ 프로젝트 필수 선택 검증
    if (!projectId) { toast.error('프로젝트(현장)를 반드시 선택해야 합니다.\n기존 프로젝트를 선택하거나 새 프로젝트를 먼저 등록해주세요.', { duration: 5000 }); return; }
    if (!projectName.trim()) { toast.error('현장명을 입력해주세요'); return; }
    const hasItems = sheets.some(sh => sh.items.some(it => Number(it.pipe_width_mm) > 0 && Number(it.pipe_height_mm) > 0));
    if (!hasItems) { toast.error('최소 1개 이상의 품목을 입력해주세요 (가로/세로 필수)'); return; }


    setSaving(true);
    try {
      const body = {
        project_id: projectId || undefined,
        project_name: projectName.trim(),
        order_date: orderDate || undefined,
        delivery_date: deliveryDate || undefined,
        biz_name: bizName || undefined,
        biz_manager: bizManager || undefined,
        biz_contact: bizContact || undefined,
        contractor: contractor || undefined,
        builder_name: builderName || undefined,
        site_address: siteAddress || undefined,
        special_notes: specialNotes || undefined,
        sheets: sheets.map(sh => ({
          name: sh.name,
          items: sh.items
            .filter(it => it.product_type)
            .map(it => ({
              product_type: it.product_type,
              pipe_width_mm: Number(it.pipe_width_mm) || null,
              pipe_height_mm: Number(it.pipe_height_mm) || null,
              qty: Number(it.qty) || 1,
              construction_type: it.construction_type,
              remark: it.remark || undefined,
            })),
        })).filter(sh => sh.items.length > 0),
      };
      const res = await api.post<{ data: any }>('/purchase-orders/manual', body);
      toast.success(`발주서 등록 완료 — ${res.data.project_name} / ${res.data.item_count}건`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.body?.message || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 스텝 2에서 실시간 인라인 계산용
  const allRows = calcAllRows();
  const totalOrderQty = allRows.reduce((s, r) => s + r.oq, 0);

  // 스텝 3 전용: 구조체별 그룹
  const PTYPE_ORDER: Record<string, number> = {
    'VT-049': 1, 'VT-064': 2, 'VT-01': 3, 'VA-064': 4,
    'VAG-1.69': 5, 'HTG-064': 6, 'HTG-064DC': 7, 'HTG-1.69': 8,
  };
  const grouped = new Map<string, CalcRow[]>();
  for (const r of [...allRows].sort((a, b) => (PTYPE_ORDER[a.product_type] ?? 9) - (PTYPE_ORDER[b.product_type] ?? 9))) {
    if (!grouped.has(r.product_type)) grouped.set(r.product_type, []);
    grouped.get(r.product_type)!.push(r);
  }

  // 스텝 3 전용: 평철 집계
  const bracketAgg = new Map<string, { t: number; bw: number; l: number; qty: number; source: string }>();
  for (const r of allRows) {
    for (const b of calcBrackets(r.product_type, r.w, r.h, r.qty)) {
      const key = `${r.product_type}_${r.w}_${r.h}_${b.t}_${b.bw}_${b.l}`;
      const source = `${r.product_type} (${r.w}×${r.h})`;
      if (!bracketAgg.has(key)) bracketAgg.set(key, { t: b.t, bw: b.bw, l: b.l, qty: 0, source });
      bracketAgg.get(key)!.qty += b.qty;
    }
  }
  const bracketList = [...bracketAgg.values()].sort((a, b) => a.bw - b.bw || a.l - b.l);
  const bracketTotal = bracketList.reduce((s, r) => s + r.qty, 0);

  const PTYPE_COLORS: Record<string, string> = {
    'VT-049': 'bg-blue-100 text-blue-700', 'VT-064': 'bg-indigo-100 text-indigo-700',
    'VT-01': 'bg-purple-100 text-purple-700', 'VA-064': 'bg-cyan-100 text-cyan-700',
    'VAG-1.69': 'bg-teal-100 text-teal-700', 'HTG-064': 'bg-orange-100 text-orange-700',
    'HTG-064DC': 'bg-amber-100 text-amber-700', 'HTG-1.69': 'bg-rose-100 text-rose-700',
  };

  const STEP_LABELS = ['1. 기본 정보', '2. 품목 입력', '3. 미리보기·확정'] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-violet-50 to-blue-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-xl">
              <ClipboardList className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">수동 발주서 입력</h2>
              <p className="text-xs text-gray-500">엑셀 인식이 안 될 때 직접 입력하세요. 소켓발주서 자동 생성 가능합니다.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 스텝 탭 (3단계) */}
        <div className="flex border-b bg-gray-50">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => {
                // 앞 단계로만 자유 이동 허용 (뒤는 순차적으로)
                if (i + 1 <= step) setStep((i + 1) as 1 | 2 | 3);
              }}
              className={cn(
                'flex-1 py-3 text-sm font-semibold border-b-2 transition-colors',
                step === i + 1
                  ? 'border-violet-500 text-violet-700 bg-white'
                  : i + 1 < step
                    ? 'border-green-400 text-green-600 hover:bg-green-50 cursor-pointer'
                    : 'border-transparent text-gray-400 cursor-not-allowed'
              )}
            >
              {i + 1 < step ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {/* ── STEP 1: 기본 정보 ── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* 프로젝트 연결 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h3 className="font-semibold text-indigo-800 text-sm mb-3 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />연결할 프로젝트
                </h3>
                <select
                  value={projectId ?? ''}
                  onChange={e => handleProjectChange(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">🔄 현장명으로 자동 매칭 또는 신규 생성</option>
                  {projects.map(p => (
                    <option key={p.project_id} value={p.project_id}>[{p.project_code}] {p.project_name}</option>
                  ))}
                </select>
              </div>

              {/* 현장명 + 날짜 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">현장명 (프로젝트명) <span className="text-red-500">*</span></label>
                  <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
                    placeholder="예) 삼성 레이크뷰 APT" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1"><Calendar className="inline h-3 w-3 mr-1" />발주 일자</label>
                  <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1"><Calendar className="inline h-3 w-3 mr-1" />납기 요청일</label>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>

              {/* 발주처 */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                <h3 className="font-semibold text-orange-800 text-sm mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />발주처 정보
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">업체명</label>
                    <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
                      placeholder="발주처 업체명" className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">담당자</label>
                    <input type="text" value={bizManager} onChange={e => setBizManager(e.target.value)}
                      placeholder="담당자 이름" className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">연락처</label>
                    <input type="text" value={bizContact} onChange={e => setBizContact(e.target.value)}
                      placeholder="전화번호" className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                </div>
              </div>

              {/* 현장·납품 */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 text-sm mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />현장 및 납품 정보
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">시공사</label>
                    <input type="text" value={contractor} onChange={e => setContractor(e.target.value)}
                      placeholder="시공사명" className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">건설사</label>
                    <input type="text" value={builderName} onChange={e => setBuilderName(e.target.value)}
                      placeholder="건설사명" className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">납품지 주소</label>
                    <input type="text" value={siteAddress} onChange={e => setSiteAddress(e.target.value)}
                      placeholder="납품지 주소" className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>
              </div>

              {/* 특기사항 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">특기사항</label>
                <textarea value={specialNotes} onChange={e => setSpecialNotes(e.target.value)}
                  rows={2} placeholder="특이사항 메모..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
              </div>
            </div>
          )}

          {/* ── STEP 2: 소켓 품목 입력 ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* 실시간 요약 배너 */}
              {allRows.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-700">{allRows.length}</p>
                    <p className="text-[10px] text-green-600">입력 품목</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-700">{totalOrderQty}</p>
                    <p className="text-[10px] text-blue-600">총 발주수량</p>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {[...new Set(allRows.map(r => r.product_type))].map(pt => (
                      <span key={pt} className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', PTYPE_COLORS[pt] || 'bg-gray-100 text-gray-700')}>
                        {pt}: {allRows.filter(r => r.product_type === pt).reduce((s,r) => s+r.oq, 0)}ea
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 시트(동) 목록 */}
              {sheets.map((sheet, si) => (
                <div key={si} className="border rounded-xl overflow-hidden">
                  {/* 시트 헤더 */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b">
                    <span className="text-xs font-semibold text-gray-500">시트(동):</span>
                    <input
                      type="text"
                      value={sheet.name}
                      onChange={e => updateSheetName(si, e.target.value)}
                      className="border-b border-gray-300 bg-transparent text-sm font-semibold text-gray-800 focus:outline-none focus:border-violet-500 w-24 pb-0.5"
                    />
                    <span className="ml-auto text-xs text-gray-400">{sheet.items.length}개 품목</span>
                    {sheets.length > 1 && (
                      <button onClick={() => removeSheet(si)}
                        className="text-red-400 hover:text-red-600 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* 품목 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium w-8">No</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">제품형식</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">가로 W (mm)</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">세로 H (mm)</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">수량</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">단면/양면</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">→ 소켓 계산</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">비고</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sheet.items.map((item, ii) => {
                          const w = Number(item.pipe_width_mm) || 0;
                          const h = Number(item.pipe_height_mm) || 0;
                          const q = Number(item.qty) || 1;
                          const calc = STRUCT_CALC_MANUAL[item.product_type];
                          const result = (calc && w > 0 && h > 0) ? calc(w, h, q) : null;
                          return (
                            <tr key={ii} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5 text-gray-400">{ii + 1}</td>
                              <td className="px-2 py-1.5">
                                <select
                                  value={item.product_type}
                                  onChange={e => updateItem(si, ii, 'product_type', e.target.value)}
                                  className={cn('text-xs px-2 py-1 rounded-lg border font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300',
                                    PTYPE_COLORS[item.product_type] || 'bg-gray-100 text-gray-700')}
                                >
                                  {PRODUCT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={item.pipe_width_mm}
                                  onChange={e => updateItem(si, ii, 'pipe_width_mm', e.target.value)}
                                  placeholder="예) 400"
                                  className="w-20 text-center border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={item.pipe_height_mm}
                                  onChange={e => updateItem(si, ii, 'pipe_height_mm', e.target.value)}
                                  placeholder="예) 400"
                                  className="w-20 text-center border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={item.qty} min={1}
                                  onChange={e => updateItem(si, ii, 'qty', e.target.value)}
                                  className="w-14 text-center border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300" />
                              </td>
                              <td className="px-2 py-1.5">
                                <button
                                  onClick={() => updateItem(si, ii, 'construction_type', item.construction_type === 'SINGLE' ? 'DOUBLE' : 'SINGLE')}
                                  className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold border transition-colors whitespace-nowrap',
                                    item.construction_type === 'SINGLE'
                                      ? 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200'
                                      : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200')}
                                >
                                  {item.construction_type === 'SINGLE' ? '🟠 단면' : '🔵 양면'}
                                </button>
                              </td>
                              <td className="px-2 py-1.5">
                                {result ? (
                                  <span className="font-mono text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded whitespace-nowrap">
                                    {result.sw}×{result.sh}×{result.depth} → {result.oq}ea
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-[10px]">W·H 입력 시 자동계산</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={item.remark}
                                  onChange={e => updateItem(si, ii, 'remark', e.target.value)}
                                  placeholder="비고"
                                  className="w-24 border-b border-gray-200 bg-transparent text-xs focus:outline-none focus:border-violet-400 pb-0.5" />
                              </td>
                              <td className="px-2 py-1.5">
                                <button onClick={() => removeItem(si, ii)}
                                  className="text-gray-300 hover:text-red-500 transition-colors">
                                  <MinusCircle className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* 품목 추가 버튼 */}
                  <div className="px-4 py-2 border-t bg-gray-50">
                    <button onClick={() => addItem(si)}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors">
                      <PlusCircle className="h-3.5 w-3.5" />품목 추가
                    </button>
                  </div>
                </div>
              ))}

              {/* 시트(동) 추가 버튼 */}
              <button onClick={addSheet}
                className="w-full py-2.5 border-2 border-dashed border-violet-300 rounded-xl text-sm text-violet-600 hover:bg-violet-50 font-semibold flex items-center justify-center gap-2 transition-colors">
                <PlusCircle className="h-4 w-4" />시트(동) 추가
              </button>
            </div>
          )}

          {/* ── STEP 3: 미리보기·확정 ── */}
          {step === 3 && (
            <div className="space-y-5">
              {/* 헤더 요약 */}
              <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-4">
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500">현장명</p>
                    <p className="font-bold text-gray-900">{projectName}</p>
                  </div>
                  {orderDate && <div>
                    <p className="text-xs text-gray-500">발주일자</p>
                    <p className="font-semibold text-gray-800 font-mono">{orderDate}</p>
                  </div>}
                  {deliveryDate && <div>
                    <p className="text-xs text-gray-500">납기요청일</p>
                    <p className="font-semibold text-gray-800 font-mono">{deliveryDate}</p>
                  </div>}
                  {contractor && <div>
                    <p className="text-xs text-gray-500">시공사</p>
                    <p className="font-semibold text-gray-800">{contractor}</p>
                  </div>}
                  <div className="ml-auto flex gap-4">
                    <div className="text-center bg-white rounded-xl px-4 py-2 border">
                      <p className="text-2xl font-bold text-violet-700">{allRows.length}</p>
                      <p className="text-[10px] text-violet-500">총 품목 수</p>
                    </div>
                    <div className="text-center bg-white rounded-xl px-4 py-2 border">
                      <p className="text-2xl font-bold text-blue-700">{totalOrderQty}</p>
                      <p className="text-[10px] text-blue-500">총 발주수량</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 구조체별 소켓 집계표 */}
              <div>
                <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-violet-500" />소켓 발주 명세 (구조체별)
                </h3>
                <div className="space-y-3">
                  {[...grouped.entries()].map(([code, rows]) => {
                    const label = PTYPE_COLORS[code];
                    return (
                      <div key={code} className="border rounded-xl overflow-hidden">
                        <div className={cn('px-4 py-2 flex items-center gap-3', label?.includes('blue') ? 'bg-blue-50' : label?.includes('indigo') ? 'bg-indigo-50' : label?.includes('purple') ? 'bg-purple-50' : label?.includes('cyan') ? 'bg-cyan-50' : label?.includes('teal') ? 'bg-teal-50' : label?.includes('orange') ? 'bg-orange-50' : label?.includes('amber') ? 'bg-amber-50' : 'bg-rose-50')}>
                          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', PTYPE_COLORS[code] || 'bg-gray-100 text-gray-700')}>{code}</span>
                          <span className="text-xs text-gray-600">{rows.length}개 규격</span>
                          <span className="ml-auto text-xs font-bold text-gray-700">소켓 {rows.reduce((s, r) => s + r.oq, 0)}ea</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-3 py-1.5 text-left text-gray-500 font-medium">시트(동)</th>
                                <th className="px-3 py-1.5 text-left text-gray-500 font-medium">관통재 W×H</th>
                                <th className="px-3 py-1.5 text-left text-gray-500 font-medium">입력수량</th>
                                <th className="px-3 py-1.5 text-left text-gray-500 font-medium">소켓 W×H×깊이</th>
                                <th className="px-3 py-1.5 text-center text-gray-500 font-medium">발주수량</th>
                                <th className="px-3 py-1.5 text-left text-gray-500 font-medium">단면/양면</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {rows.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-3 py-1.5 text-gray-600 font-semibold">{r.sheetName}</td>
                                  <td className="px-3 py-1.5 font-mono text-gray-700">{r.w} × {r.h}</td>
                                  <td className="px-3 py-1.5 text-center text-gray-700">{r.qty}</td>
                                  <td className="px-3 py-1.5 font-mono text-green-700 font-semibold">{r.sw} × {r.sh} × {r.depth}</td>
                                  <td className="px-3 py-1.5 text-center font-bold text-violet-700">{r.oq}</td>
                                  <td className="px-3 py-1.5">
                                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                                      r.construction_type === 'SINGLE' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')}>
                                      {r.construction_type === 'SINGLE' ? '🟠 단면' : '🔵 양면'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t">
                              <tr>
                                <td colSpan={4} className="px-3 py-1.5 text-right text-xs font-semibold text-gray-600">{code} 소계</td>
                                <td className="px-3 py-1.5 text-center font-bold text-violet-700">{rows.reduce((s,r) => s+r.oq, 0)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 평철(브라켓) 집계 */}
              {bracketList.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-gray-500" />평철 소요량 집계
                    <span className="ml-auto text-xs font-normal text-gray-500">합계: {bracketTotal}개</span>
                  </h3>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-purple-700 font-semibold">구조체 (관통제 규격)</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">두께(t)</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">폭(bw, mm)</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">길이(L, mm)</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">수량</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bracketList.map((b, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 font-medium text-purple-700">{b.source}</td>
                            <td className="px-3 py-1.5 font-mono text-gray-700">{b.t}</td>
                            <td className="px-3 py-1.5 font-mono text-gray-700">{b.bw}</td>
                            <td className="px-3 py-1.5 font-mono text-gray-700">{b.l}</td>
                            <td className="px-3 py-1.5 text-center font-bold text-gray-800">{b.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">합계</td>
                          <td className="px-3 py-2 text-center font-bold text-gray-900">{bracketTotal}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}


              {/* 이상 없을 경우 등록 안내 */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  내용을 확인하셨으면 <strong>발주서 등록 확정</strong> 버튼을 눌러주세요.
                  저장 후 소켓발주서 탭에서 결재함 제출이 가능합니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 (3단계) */}
        <div className="flex items-center justify-between p-5 border-t bg-gray-50 rounded-b-2xl">
          <div>
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
                ← 이전
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-white transition-colors">
              취소
            </button>
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1) {
                    if (!projectName.trim()) { toast.error('현장명을 입력해주세요'); return; }
                    setStep(2);
                  } else if (step === 2) {
                    const hasItems = sheets.some(sh => sh.items.some(it => Number(it.pipe_width_mm) > 0 && Number(it.pipe_height_mm) > 0));
                    if (!hasItems) { toast.error('최소 1개 이상의 품목을 입력해주세요 (가로/세로 필수)'); return; }
                    setStep(3);
                  }
                }}
                className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 flex items-center gap-2 transition-colors"
              >
                {step === 1 ? '다음 → 품목 입력' : '다음 → 미리보기'}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
              >
                {saving ? (
                  <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />저장 중...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" />발주서 등록 확정</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────
// 소켓류발주 탭
// ────────────────────────────────────────────────────────────────────────────
const STRUCT_LABELS: Record<string, { color: string; bg: string }> = {
  'VT-01':    { color: 'text-purple-700', bg: 'bg-purple-100' },
  'VT-049':   { color: 'text-blue-700',   bg: 'bg-blue-100' },
  'VT-064':   { color: 'text-indigo-700', bg: 'bg-indigo-100' },
  'VA-064':   { color: 'text-cyan-700',   bg: 'bg-cyan-100' },
  'VAG-1.69': { color: 'text-teal-700',   bg: 'bg-teal-100' },
  'HTG-064':  { color: 'text-orange-700', bg: 'bg-orange-100' },
  'HTG-1.69': { color: 'text-rose-700',   bg: 'bg-rose-100' },
};

function SocketOrderTab({ list }: { list: PurchaseOrder[] }) {
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const selectedPo = list.find(p => p.po_id === selectedPoId);

  const handleSelect = async (po: PurchaseOrder) => {
    if (selectedPoId === po.po_id) { setSelectedPoId(null); setPreview(null); return; }
    setSelectedPoId(po.po_id);
    setLoading(true);
    try {
      const res = await api.get<{ data: any }>(`/purchase-orders/${po.po_id}`);
      const items: PoItem[] = res.data.items || [];
      // 구조체별 집계
      const structMap = new Map<string, { items: PoItem[]; totalQty: number }>();
      for (const item of items) {
        if (item.item_type !== 'socket' || !item.product_type) continue;
        const code = item.product_type.trim();
        if (!structMap.has(code)) structMap.set(code, { items: [], totalQty: 0 });
        structMap.get(code)!.items.push(item);
        structMap.get(code)!.totalQty += item.qty || 1;
      }
      setPreview({ po, structMap });
    } catch {
      toast.error('발주 명세 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedPoId) return;
    setDownloading(true);
    try {
      // Blob 방식으로 파일 다운로드
      const token = localStorage.getItem('ezone_mes_token');
      const apiBase = (import.meta as any).env?.VITE_API_BASE ?? '/api';
      const res = await fetch(`${apiBase}/purchase-orders/${selectedPoId}/socket-order`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename\*=UTF-8''(.+)/);

      const bizName = (selectedPo?.contractor || selectedPo?.biz_name || '').trim();
      let dateStr = '';
      if (selectedPo?.order_date) {
        const d = new Date(selectedPo.order_date);
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().slice(0, 10);
        }
      }
      if (!dateStr && selectedPo?.created_at) {
        const d = new Date(selectedPo.created_at);
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().slice(0, 10);
        }
      }
      if (!dateStr) {
        dateStr = new Date().toISOString().slice(0, 10);
      }
      const displayName = bizName ? `${bizName}_${dateStr}` : `소켓발주서_${selectedPo?.project_name || '미지정'}_${dateStr}`;

      a.download = match 
        ? decodeURIComponent(match[1]) 
        : `${displayName}.xlsx`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('소켓발주서 다운로드 완료!');
    } catch (e: any) {
      toast.error(`다운로드 실패: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const SOCK_CALC: Partial<Record<string, (w: number, h: number, qty: number) => { socketW: number; socketH: number; orderQty: number; depth: number }>> = {
    'VT-01':    (w, h, q) => ({ socketW: w, socketH: h, orderQty: q * 2, depth: 200 }),
    'VT-049':   (w, h, q) => ({ socketW: w, socketH: h, orderQty: q * 1, depth: 200 }),
    'VT-064':   (w, h, q) => ({ socketW: w, socketH: h, orderQty: q * 1, depth: 200 }),
    'VA-064':   (w, h, q) => ({ socketW: w, socketH: h, orderQty: q * 1, depth: 200 }),
    'VAG-1.69': (w, h, q) => ({ socketW: Math.round(w / 2 - 30), socketH: h, orderQty: q * 2, depth: 200 }),
    'HTG-064':  (w, h, q) => ({ socketW: w, socketH: h, orderQty: q * 1, depth: 300 }),
    'HTG-1.69': (w, h, q) => ({ socketW: Math.round(w / 2 - 30), socketH: h, orderQty: q * 2, depth: 300 }),
  };

  return (
    <div className="flex gap-6">
      {/* 왼쪽: 발주서 선택 목록 */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-500" />
              발주서 선택
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">클릭하면 소켓 계산 미리보기</p>
          </div>
          {list.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              등록된 발주서가 없습니다.
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {list.map(po => (
                <button
                  key={po.po_id}
                  onClick={() => handleSelect(po)}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors hover:bg-blue-50',
                    selectedPoId === po.po_id && 'bg-blue-50 border-l-4 border-l-blue-500'
                  )}
                >
                  <p className="text-sm font-semibold text-gray-800 truncate">{po.project_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{po.contractor || po.biz_name || '-'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                      {po.item_count}건
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(po.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 미리보기 + 다운로드 */}
      <div className="flex-1">
        {!selectedPoId ? (
          <div className="bg-white rounded-2xl border shadow-sm flex flex-col items-center justify-center py-20 text-gray-400">
            <Wrench className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">왼쪽에서 발주서를 선택하세요</p>
            <p className="text-xs mt-1">구조체별 소켓 발주 수량을 자동 계산합니다</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl border shadow-sm flex items-center justify-center py-20">
            <div className="h-6 w-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-3" />
            <span className="text-sm text-gray-500">계산 중...</span>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {/* 현장 정보 */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">{preview.po.project_name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{preview.po.contractor || preview.po.biz_name}</p>
                </div>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {downloading ? (
                    <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</>
                  ) : (
                    <><Download className="h-4 w-4" />소켓발주서 Excel 다운로드</>
                  )}
                </button>
              </div>
            </div>

            {/* 구조체별 소켓 계산 결과 */}
            {preview.structMap.size === 0 ? (
              <div className="bg-white rounded-2xl border shadow-sm p-8 text-center text-gray-400">
                <p className="text-sm">소켓 명세가 없거나 구조명이 인식되지 않습니다.</p>
                <p className="text-xs mt-1">발주서의 구조명(VT-01, VT-049 등)이 있는지 확인하세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...preview.structMap.entries()].map(([code, { items: sItems, totalQty }]: [string, any]) => {
                  const label = STRUCT_LABELS[code] || { color: 'text-gray-700', bg: 'bg-gray-100' };
                  const calc = SOCK_CALC[code];
                  return (
                    <div key={code} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className={cn('px-2.5 py-1 rounded-lg text-sm font-bold', label.bg, label.color)}>
                            {code}
                          </span>
                          <span className="text-sm text-gray-500">관통재 {sItems.length}종 / 합계 {totalQty}개소</span>
                        </div>
                        {calc && (
                          <span className="text-xs text-gray-400">
                            {code === 'VT-01' ? '동일크기 ×2 발주' :
                             code === 'VAG-1.69' || code === 'HTG-1.69' ? '가로/2-30 ×2 발주' : '규격 그대로 발주'}
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-t">
                            <tr>
                              <th className="px-4 py-2 text-left text-gray-500">관통재 가로×세로</th>
                              <th className="px-4 py-2 text-left text-gray-500">관통재 수량</th>
                              <th className="px-4 py-2 text-left text-blue-600 font-semibold">소켓 가로</th>
                              <th className="px-4 py-2 text-left text-blue-600 font-semibold">소켓 세로</th>
                              <th className="px-4 py-2 text-left text-blue-600 font-semibold">폭</th>
                              <th className="px-4 py-2 text-right text-green-600 font-semibold">발주수량</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {sItems.map((item: PoItem, idx: number) => {
                              const w = item.pipe_width_mm || 0;
                              const h = item.pipe_height_mm || 0;
                              const q = item.qty || 1;
                              const c = calc ? calc(w, h, q) : null;
                              return (
                                <tr key={idx} className="hover:bg-blue-50/30">
                                  <td className="px-4 py-2 font-mono text-gray-700">{w} × {h}</td>
                                  <td className="px-4 py-2 text-center text-gray-700">{q}</td>
                                  <td className="px-4 py-2 font-mono text-blue-700 font-semibold">{c?.socketW ?? '-'}</td>
                                  <td className="px-4 py-2 font-mono text-blue-700 font-semibold">{c?.socketH ?? '-'}</td>
                                  <td className="px-4 py-2 font-mono text-blue-700">{c?.depth ?? '-'}</td>
                                  <td className="px-4 py-2 font-mono text-green-700 font-bold text-right">{c?.orderQty ?? '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {sItems.length > 0 && calc && (
                            <tfoot className="bg-green-50 border-t">
                              <tr>
                                <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">
                                  {code} 소계
                                </td>
                                <td className="px-4 py-2 font-bold text-green-700 text-right">
                                  {sItems.reduce((s: number, item: PoItem) => {
                                    const c2 = calc(item.pipe_width_mm || 0, item.pipe_height_mm || 0, item.qty || 1);
                                    return s + c2.orderQty;
                                  }, 0)}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const [activeTab, setActiveTab] = useState<'manage' | 'socket'>('manage');
  const [list, setList] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detailPo, setDetailPo] = useState<(PurchaseOrder & { items?: PoItem[]; sheets?: string[] }) | null>(null);
  const [initialized, setInitialized] = useState(false);
  // ★ 프로젝트 선택
  const [projects, setProjects] = useState<Project[]>([]);
  const [previewProjectId, setPreviewProjectId] = useState<number | null>(null);
  // ★ 수동 입력 모달
  const [showManualModal, setShowManualModal] = useState(false);
  // ★ 삭제된 항목 복원
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedList, setDeletedList] = useState<PurchaseOrder[]>([]);

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
    } catch (e: any) {
      toast.error(`발주서 목록 로드 실패${e?.status ? ` (${e.status})` : ''}`);
      console.error('fetchList error:', e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchDeleted = useCallback(async () => {
    try {
      const res = await api.get<{ data: PurchaseOrder[] }>('/purchase-orders/deleted');
      setDeletedList(res.data ?? []);
    } catch { setDeletedList([]); }
  }, []);

  // 최초 1회 로드
  if (!initialized) {
    setInitialized(true);
    fetchList();
  }

  // 프로젝트 목록 로드
  useEffect(() => {
    api.get<{ data: Project[] }>('/projects')
      .then(r => setProjects(r.data ?? []))
      .catch(() => {});
  }, []);

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
      const parsed = res.data;
      setPreview(parsed);
      setPreviewFile(file);

      // ★ 현장명으로 프로젝트 자동 매칭
      const parsedName = parsed.project?.project_name || '';
      if (parsedName) {
        const matched = projects.find(p =>
          p.project_name === parsedName ||
          p.project_name.includes(parsedName) ||
          parsedName.includes(p.project_name)
        );
        setPreviewProjectId(matched ? matched.project_id : null);
      } else {
        setPreviewProjectId(null);
      }
    } catch (e: any) {
      toast.error(`파싱 실패: ${e?.body?.message || e.message}`);
    } finally {
      setParsing(false);
    }
  };

  // 확정 업로드 (base64 JSON)
  const handleConfirm = async () => {
    if (!previewFile) return;
    // ★ 프로젝트 필수 선택 검증
    if (!previewProjectId) {
      toast.error('프로젝트를 선택해야 발주서를 업로드할 수 있습니다.\n"연결할 프로젝트 선택" 드롭다운에서 현장(프로젝트)를 선택해주세요.', { duration: 5000 });
      return;
    }
    setUploading(true);

    try {
      const arrayBuffer = await previewFile.arrayBuffer();
      const base64 = toBase64(arrayBuffer);
      const body: Record<string, any> = {
        file_base64: base64,
        file_name: previewFile.name,
      };
      // ★ 명시적으로 선택된 프로젝트가 있으면 전달
      if (previewProjectId) body.project_id = previewProjectId;

      const res = await api.post<{ data: any }>('/purchase-orders/upload', body);
      const d = res.data;
      toast.success(`발주서 등록 완료 — 프로젝트: ${d.project_name} / 명세 ${d.item_count}건`);
      setPreview(null);
      setPreviewFile(null);
      setPreviewProjectId(null);
      fetchList();
    } catch (e: any) {
      toast.error(`업로드 실패: ${e?.body?.message || e.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 상세 보기 — PROJECT_ONLY는 /projects/:id 조회
  const handleDetail = async (po: PurchaseOrder) => {
    if (po.source_type === 'PROJECT_ONLY') {
      // 발주서 없는 프로젝트는 프로젝트 상세를 바로 표시
      setDetailPo({
        ...po,
        po_id: -1, // 더미값
        items: [],
        sheets: [],
      } as any);
      return;
    }
    try {
      const res = await api.get<{ data: any }>(`/purchase-orders/${po.po_id}`);
      setDetailPo(res.data);
    } catch {
      toast.error('상세 정보 로드 실패');
    }
  };

  // 삭제 — PO: 발주서 soft delete / PROJECT_ONLY: 프로젝트 삭제
  const handleDelete = async (po: PurchaseOrder) => {
    if (po.source_type === 'PROJECT_ONLY') {
      if (!confirm(`"${po.project_name}" 프로젝트를 삭제하시겠습니까?\n\n※ 연결된 작업지시 등 모든 하위 데이터가 함께 삭제됩니다.`)) return;
      try {
        await api.delete(`/projects/${po.project_id}`);
        toast.success('프로젝트가 삭제되었습니다.');
        fetchList();
      } catch (err: any) {
        const msg = err?.body?.message ?? err?.message ?? '삭제 실패';
        toast.error(msg);
      }
      return;
    }
    if (!confirm(`"${po.project_name}" 발주서를 삭제하시겠습니까?\n\n※ 연결된 소켓발주(대기)가 있으면 함께 취소됩니다.`)) return;
    try {
      await api.delete(`/purchase-orders/${po.po_id}`);
      toast.success('삭제되었습니다.');
      fetchList();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.message ?? '삭제 실패';
      toast.error(msg);
    }
  };

  // 복원 — 발주서 / 프로젝트
  const handleRestore = async (po: PurchaseOrder) => {
    try {
      if (po.source_type === 'PROJECT_ONLY') {
        await api.patch(`/projects/${po.project_id}/restore`, {});
        toast.success('프로젝트가 복원되었습니다.');
      } else {
        await api.patch(`/purchase-orders/${po.po_id}/restore`, {});
        toast.success('발주서가 복원되었습니다.');
      }
      fetchList();
      fetchDeleted();
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? '복원 실패');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader title="발주서 관리" description="Excel 발주서를 업로드하고, 소켓발주서를 자동 생성합니다" />

      {/* 탭 */}
      <div className="px-6 pt-4 flex gap-1 border-b bg-gray-50">
        <button
          onClick={() => setActiveTab('manage')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-xl border border-b-0 transition-colors',
            activeTab === 'manage'
              ? 'bg-white text-blue-600 border-gray-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border-transparent'
          )}
        >
          <FileSpreadsheet className="h-4 w-4" />
          배합원료발주
        </button>
        <button
          onClick={() => { setActiveTab('socket'); if (list.length === 0) fetchList(); }}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-xl border border-b-0 transition-colors',
            activeTab === 'socket'
              ? 'bg-white text-green-600 border-gray-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border-transparent'
          )}
        >
          <Wrench className="h-4 w-4" />
          소켓류발주
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {activeTab === 'socket' ? (
          <SocketOrderTab list={list} />
        ) : (
        <>
        {/* 업로드 영역 */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-500" />
              발주서 Excel 업로드
            </h2>
            <button
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
            >
              <ClipboardList className="h-4 w-4" />
              ✏️ 수동 입력
            </button>
          </div>
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
                    {['', '현장명 (프로젝트)', '시공사 / 발주자', '납기 요청일', '제출인', '명세 건수', '등록일', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map((po, idx) => (
                    <tr
                      key={`${po.source_type}-${po.po_id ?? po.project_id}-${idx}`}
                      className={cn(
                        'hover:bg-gray-50 transition-colors',
                        po.source_type === 'PROJECT_ONLY' && 'bg-amber-50/40 hover:bg-amber-50'
                      )}
                    >
                      {/* 소스 타입 배지 */}
                      <td className="px-3 py-3 w-24">
                        {po.source_type === 'PROJECT_ONLY' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                            불일치
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                            발주서
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">{po.project_name}</p>
                          {po.project_code && (
                            <p className="text-xs text-blue-600 font-mono">{po.project_code}</p>
                          )}
                          {po.source_type === 'PROJECT_ONLY' && (
                            <p className="text-[10px] text-amber-600 mt-0.5">발주서 미첨부 — 현장 프로젝트만 등록됨</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{po.contractor || po.customer_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">{po.delivery_date || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{po.submitter || '-'}</td>
                      <td className="px-4 py-3">
                        {po.source_type === 'PROJECT_ONLY' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                            발주서 없음
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            <Package className="h-3 w-3" />
                            {po.item_count}건
                          </span>
                        )}
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
                            title={po.source_type === 'PROJECT_ONLY' ? '프로젝트 삭제' : '삭제'}
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
        </>
        )}

        {/* 삭제된 발주서 복원 패널 */}
        {activeTab !== 'socket' && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100">
            <button
              onClick={() => {
                const next = !showDeleted;
                setShowDeleted(next);
                if (next) fetchDeleted();
              }}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                삭제된 발주서 / 프로젝트 {deletedList.length > 0 && <span className="bg-red-100 text-red-600 rounded-full px-2 py-0.5 text-xs">{deletedList.length}</span>}
              </span>
              <span className="text-xs text-gray-400">{showDeleted ? '▲ 접기' : '▼ 펼쳐서 복원하기'}</span>
            </button>

            {showDeleted && (
              <div className="border-t">
                {deletedList.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">삭제된 항목이 없습니다.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 border-b">
                      <tr>
                        {['현장명', '시공사 / 발주자', '납기일', '등록일', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deletedList.map((po, idx) => (
                        <tr key={`del-${po.po_id ?? po.project_id}-${idx}`} className="hover:bg-red-50/40">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-700 text-sm">{po.project_name ?? '(이름 없음)'}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {po.source_type === 'PROJECT_ONLY' ? '📁 프로젝트' : `📄 발주서 #${po.po_id}`}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{po.contractor ?? '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{po.delivery_date ?? '—'}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">
                            {po.created_at ? new Date(po.created_at).toLocaleDateString('ko') : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => handleRestore(po)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              복원
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 미리보기 모달 */}
      {preview && previewFile && (
        <PreviewModal
          preview={preview}
          file={previewFile}
          onConfirm={handleConfirm}
          onClose={() => { setPreview(null); setPreviewFile(null); setPreviewProjectId(null); }}
          uploading={uploading}
          projects={projects}
          selectedProjectId={previewProjectId}
          onProjectChange={setPreviewProjectId}
        />
      )}

      {/* 상세 모달 */}
      {detailPo && <DetailModal po={detailPo} onClose={() => setDetailPo(null)} />}

      {/* 수동 입력 모달 */}
      {showManualModal && (
        <ManualPoModal
          onClose={() => setShowManualModal(false)}
          onSaved={fetchList}
          projects={projects}
        />
      )}
    </div>
  );
}
