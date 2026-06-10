import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Plus, RotateCcw, Package, CheckCircle2, Clock, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReturnReceipt {
  rr_id: number;
  rr_number: string;
  rr_date: string;
  customer_name: string | null;
  reason: string | null;
  status: 'PENDING' | 'COMPLETED';
  item_count: number;
  remarks: string | null;
}

interface ReturnItem {
  rri_id: number;
  item_name: string;
  item_code: string | null;
  item_category: string | null;
  spec: string | null;
  unit: string;
  qty: number;
  original_lot_number: string | null;
  return_type: string;
  new_lot_number: string | null;
}

const RETURN_TYPE_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  DISPOSE:          { label: '폐기',        color: 'text-red-700 bg-red-100',    desc: '구조체·완제품 → 폐기 처리' },
  ASSEMBLY_STOCK:   { label: '조립재고 입고', color: 'text-blue-700 bg-blue-100',  desc: '부자재 조립 LOT → 재고 복원' },
  INSPECTION_STOCK: { label: '인수검사 재고', color: 'text-purple-700 bg-purple-100', desc: '그라스울/세라믹울/실리콘 → 인수검사 LOT로 재고' },
};

function RRCard({ rr, onRefresh }: { rr: ReturnReceipt; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadItems = async () => {
    if (expanded && items.length > 0) { setExpanded(false); return; }
    setLoading(true);
    try {
      const res = await api.get<{ data: { items: ReturnItem[] } }>(`/return-receipts/${rr.rr_id}`);
      setItems(res.data.items || []);
      setExpanded(true);
    } catch { toast.error('품목 로드 실패'); }
    finally { setLoading(false); }
  };

  const handleProcess = async () => {
    if (!confirm(`반품 ${rr.rr_number} 처리를 진행하시겠습니까?\n\n처리 후 LOT 분류 및 재고 복원이 실행됩니다.`)) return;
    setProcessing(true);
    try {
      const res = await api.patch<{ data: any }>(`/return-receipts/${rr.rr_id}/process`, {
        process_date: rr.rr_date,
      });
      toast.success(`반품 처리 완료! ${res.data.processed?.length || 0}건 처리됨`);
      onRefresh();
    } catch { toast.error('반품 처리 실패'); }
    finally { setProcessing(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`반품입고 ${rr.rr_number}을(를) 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/return-receipts/${rr.rr_id}`);
      toast.success('삭제되었습니다');
      onRefresh();
    } catch { toast.error('삭제 실패 (접수중 상태만 삭제 가능)'); }
  };

  return (
    <div className={cn('bg-white rounded-2xl border shadow-sm overflow-hidden',
      rr.status === 'COMPLETED' ? 'border-green-200' : 'border-amber-200')}>
      <div className="p-4 flex items-start gap-3">
        <div className={cn('flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
          rr.status === 'COMPLETED' ? 'bg-green-100' : 'bg-amber-100')}>
          {rr.status === 'COMPLETED'
            ? <CheckCircle2 className="h-5 w-5 text-green-600" />
            : <RotateCcw className="h-5 w-5 text-amber-600" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-sm">{rr.rr_number}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold',
              rr.status === 'COMPLETED' ? 'text-green-700 bg-green-100' : 'text-amber-700 bg-amber-100')}>
              {rr.status === 'COMPLETED' ? '처리완료' : '접수중'}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            {rr.customer_name && <span>🏢 {rr.customer_name}</span>}
            <span>📅 {new Date(rr.rr_date).toLocaleDateString('ko-KR')}</span>
            <span>📦 {rr.item_count}종</span>
            {rr.reason && <span className="text-red-600">사유: {rr.reason}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {rr.status === 'PENDING' && (
            <>
              <button onClick={handleProcess} disabled={processing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                {processing
                  ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <RotateCcw className="h-3 w-3" />
                }
                반품처리
              </button>
              <button onClick={handleDelete}
                className="p-1.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button onClick={loadItems} disabled={loading}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            {loading
              ? <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              : expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
            }
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['품목명', '규격', '수량', '원본 LOT', '처리방식', '신규 LOT'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => {
                const rtCfg = RETURN_TYPE_LABELS[item.return_type] || { label: item.return_type, color: 'text-gray-600 bg-gray-100', desc: '' };
                return (
                  <tr key={item.rri_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium">{item.item_name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{item.spec || '-'}</td>
                    <td className="px-4 py-2.5 text-sm font-mono">{item.qty} {item.unit}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-600">{item.original_lot_number || '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', rtCfg.color)}>
                        {rtCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-green-600">
                      {item.new_lot_number || (item.return_type === 'DISPOSE' ? '폐기됨' : '-')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 반품 등록 모달 ──────────────────────────────────────
function CreateRRModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [rrDate, setRrDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<Array<{
    item_name: string; item_code: string; item_category: string;
    spec: string; unit: string; qty: string;
    original_lot_number: string; return_type: string;
  }>>([{
    item_name: '', item_code: '', item_category: 'SM',
    spec: '', unit: 'EA', qty: '',
    original_lot_number: '', return_type: 'ASSEMBLY_STOCK'
  }]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => setItems(prev => [...prev, {
    item_name: '', item_code: '', item_category: 'SM',
    spec: '', unit: 'EA', qty: '',
    original_lot_number: '', return_type: 'ASSEMBLY_STOCK'
  }]);

  const updateItem = (idx: number, field: string, value: string) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // item_code 변경 시 return_type 자동 추론
      if (field === 'item_code') {
        const code = value.toUpperCase();
        if (code.startsWith('SM-GW') || code.startsWith('SM-CW') || code.startsWith('SM-SIL') || code.startsWith('SM-SL')) {
          next[idx].return_type = 'INSPECTION_STOCK';
        } else if (next[idx].item_category === 'SM' || next[idx].item_category === 'RM') {
          next[idx].return_type = 'ASSEMBLY_STOCK';
        } else {
          next[idx].return_type = 'DISPOSE';
        }
      }
      if (field === 'item_category') {
        if (value === 'FG') next[idx].return_type = 'DISPOSE';
        else if (value === 'SM') next[idx].return_type = 'ASSEMBLY_STOCK';
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const validItems = items.filter(i => i.item_name && parseFloat(i.qty) > 0);
    if (!rrDate) { toast.error('반품일자를 입력하세요'); return; }
    if (validItems.length === 0) { toast.error('반품 품목을 하나 이상 입력하세요'); return; }
    setSubmitting(true);
    try {
      await api.post('/return-receipts', {
        rr_date: rrDate,
        customer_name: customerName || null,
        reason: reason || null,
        remarks: remarks || null,
        items: validItems.map(it => ({
          item_name: it.item_name,
          item_code: it.item_code || null,
          item_category: it.item_category || null,
          spec: it.spec || null,
          unit: it.unit,
          qty: parseFloat(it.qty) || 0,
          original_lot_number: it.original_lot_number || null,
          return_type: it.return_type,
        })),
      });
      toast.success('반품입고가 등록되었습니다');
      onCreated();
    } catch { toast.error('등록 실패'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="h-4 w-4 text-purple-600" />
            </div>
            <h2 className="font-bold text-gray-900">반품입고 등록</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 안내 배너 */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800">
            <strong>📋 반품 LOT 처리 규칙</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li><strong>구조체·완제품(FG)</strong>: 폐기 처리 (재고 미반영)</li>
              <li><strong>일반 부자재(SM)</strong>: 조립 LOT로 재고 복원</li>
              <li><strong>그라스울/세라믹울/실리콘(SM-GW/SM-CW/SM-SIL)</strong>: 인수검사 LOT로 재고 입고</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">반품일자 *</label>
              <input type="date" value={rrDate} onChange={e => setRrDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">반품 거래처</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="거래처명" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">반품 사유</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="반품 사유" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
          </div>

          {/* 반품 품목 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-800">반품 품목</h3>
              <button onClick={addItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100">
                <Plus className="h-3 w-3" /> 품목 추가
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="border rounded-xl p-3 bg-gray-50 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">품목코드</label>
                      <input type="text" value={item.item_code} onChange={e => updateItem(idx, 'item_code', e.target.value)}
                        placeholder="SM-GW-001" className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white font-mono" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">품목명 *</label>
                      <input type="text" value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)}
                        placeholder="품목명" className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">카테고리</label>
                      <select value={item.item_category} onChange={e => updateItem(idx, 'item_category', e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white">
                        <option value="SM">부자재</option>
                        <option value="RM">원자재</option>
                        <option value="FG">완제품</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">원본 LOT번호</label>
                      <input type="text" value={item.original_lot_number} onChange={e => updateItem(idx, 'original_lot_number', e.target.value)}
                        placeholder="원래 출하 LOT" className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">수량 *</label>
                      <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">처리방식</label>
                      <select value={item.return_type} onChange={e => updateItem(idx, 'return_type', e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white">
                        <option value="DISPOSE">폐기</option>
                        <option value="ASSEMBLY_STOCK">조립재고</option>
                        <option value="INSPECTION_STOCK">인수검사재고</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <span className={cn('px-2 py-1 rounded-lg text-[10px] font-bold w-full text-center',
                        item.return_type === 'DISPOSE' ? 'bg-red-100 text-red-700' :
                        item.return_type === 'INSPECTION_STOCK' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700')}>
                        {RETURN_TYPE_LABELS[item.return_type]?.label || item.return_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                      disabled={items.length <= 1}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100">취소</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2">
            {submitting && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            반품 등록
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────
export default function ReturnReceiptPage() {
  const [list, setList] = useState<ReturnReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await api.get<{ data: ReturnReceipt[] }>(`/return-receipts?${params}`);
      setList(res.data ?? []);
    } catch { toast.error('목록 로드 실패'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const pendingCount   = list.filter(r => r.status === 'PENDING').length;
  const completedCount = list.filter(r => r.status === 'COMPLETED').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="반품입고"
        count={list.length}
        description="반품된 제품의 LOT 처리 — 구조체 폐기 / 부자재 재고 복원 / 그라스울·세라믹울·실리콘 인수검사 재고"
      >
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> 반품입고 등록
        </button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* 요약 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '접수중',   count: pendingCount,   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: <Clock className="h-5 w-5 text-amber-600" /> },
            { label: '처리완료', count: completedCount, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
            { label: '전체',     count: list.length,   color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: <RotateCcw className="h-5 w-5 text-purple-600" /> },
          ].map(({ label, count, color, bg, border, icon }) => (
            <div key={label} className={cn('rounded-2xl border p-4 flex items-center gap-3', bg, border)}>
              <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
              <div>
                <p className={cn('text-2xl font-bold', color)}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-3">
            {([['ALL','전체'], ['PENDING','접수중'], ['COMPLETED','처리완료']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setStatusFilter(key as any)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  statusFilter === key ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100')}>
                {label}
              </button>
            ))}
            <button onClick={fetchList} disabled={loading} className="ml-auto p-1.5 border rounded-lg hover:bg-gray-100 disabled:opacity-50">
              <RefreshCw className={cn('h-4 w-4 text-gray-600', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="h-6 w-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mr-3" />
            로드 중...
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <RotateCcw className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-base font-semibold">반품입고 내역이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map(rr => <RRCard key={rr.rr_id} rr={rr} onRefresh={fetchList} />)}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRRModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchList(); }} />
      )}
    </div>
  );
}
