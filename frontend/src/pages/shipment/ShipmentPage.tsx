import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, Truck, MoreHorizontal, Pencil, Trash2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Shipment {
  wo_id: number;
  wo_number: string;
  wo_date: string;
  status: string;
  cert_number: string | null;
  structure_code: string | null;
  structure_name: string | null;
  item_name: string | null;
  item_code: string | null;
  planned_qty: number | null;
  actual_qty: number | null;
  lot_number: string | null;
  purpose: string | null; // customer
  spec_detail: string | null; // destination
  inspector: string | null;
  remarks: string | null;
  completed_at: string | null;
}

const statusMap: Record<string, string> = {
  PLANNED: 'PENDING', IN_PROGRESS: 'INFO', COMPLETED: 'PASS', HOLD: 'HOLD',
};
const statusLabel: Record<string, string> = {
  PLANNED: '준비중', IN_PROGRESS: '출하중', COMPLETED: '출하완료', HOLD: '보류',
};

export function ShipmentPage() {
  const [data, setData] = useState<Shipment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const navigate = useNavigate();

  const fetchData = () => {
    api.get<{ data: Shipment[] }>('/shipments').then((r) => setData(r.data));
  };

  useEffect(() => { fetchData(); }, []);

  const handleStatusChange = async (wo: Shipment, newStatus: string) => {
    const payload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'COMPLETED' && !wo.actual_qty) {
      const qty = prompt('출하 실적수량을 입력하세요:', wo.planned_qty?.toString() || '');
      if (!qty) return;
      payload.actual_qty = parseFloat(qty);
    }
    try {
      await api.patch(`/shipments/${wo.wo_id}`, payload);
      fetchData();
    } catch { alert('상태 변경 실패'); }
    setMenuOpen(null);
  };

  const handleDelete = async (wo: Shipment) => {
    if (wo.status === 'COMPLETED') { alert('완료된 출하는 삭제할 수 없습니다.'); return; }
    if (!confirm(`출하 ${wo.wo_number}을(를) 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/shipments/${wo.wo_id}`);
      fetchData();
    } catch { alert('삭제 실패'); }
    setMenuOpen(null);
  };

  return (
    <div>
      <PageHeader title="출하관리" count={data.length} description="완제품 출하 및 품질관리서 관리">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-process-cut text-white rounded-md text-shop-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> 출하 등록
        </button>
      </PageHeader>

      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-3 text-left font-medium text-gray-500">출하번호</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">출하일</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">인정구조</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">품목</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">고객</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">납품처</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">계획</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">실적</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">LOT</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                  출하 내역이 없습니다. '출하 등록' 버튼을 눌러 추가하세요.
                </td>
              </tr>
            ) : (
              data.map((s) => (
                <tr key={s.wo_id} className="border-b hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs">{s.wo_number}</td>
                  <td className="px-3 py-3">{s.wo_date?.slice(0, 10)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={statusMap[s.status] || s.status} label={statusLabel[s.status] || s.status} />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{s.structure_code ?? '-'}</td>
                  <td className="px-3 py-3 max-w-[140px] truncate">{s.item_name ?? '-'}</td>
                  <td className="px-3 py-3">{s.purpose ?? '-'}</td>
                  <td className="px-3 py-3">{s.spec_detail ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{s.planned_qty ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{s.actual_qty ?? '-'}</td>
                  <td className="px-3 py-3 font-mono text-xs">{s.lot_number ?? '-'}</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (menuOpen === s.wo_id) { setMenuOpen(null); return; }
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        setMenuOpen(s.wo_id);
                      }}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <MoreHorizontal size={16} className="text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dropdown menu */}
      {menuOpen !== null && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div className="fixed z-50 w-40 bg-white border rounded-md shadow-lg py-1"
            style={{ top: menuPos.top, right: menuPos.right }}>
            {(() => {
              const s = data.find((d) => d.wo_id === menuOpen);
              if (!s) return null;
              return (
                <>
                  {s.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleStatusChange(s, s.status === 'PLANNED' ? 'IN_PROGRESS' : 'COMPLETED')}
                      className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Truck size={14} /> {s.status === 'PLANNED' ? '출하 시작' : '출하 완료'}
                    </button>
                  )}
                  <button
                    onClick={() => { navigate(`/shipment/quality-report/${s.wo_id}`); setMenuOpen(null); }}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileText size={14} /> 품질관리서
                  </button>
                  {s.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleDelete(s)}
                      className="w-full px-3 py-2 text-left text-shop-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}

      {showCreate && (
        <CreateShipmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function CreateShipmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [certs, setCerts] = useState<Array<{ cert_id: number; cert_number: string; structure_code: string }>>([]);
  const [items, setItems] = useState<Array<{ item_id: number; item_code: string; item_name: string; item_category: string }>>([]);
  const [form, setForm] = useState({
    ship_date: new Date().toISOString().slice(0, 10),
    cert_id: '', item_id: '', planned_qty: '',
    customer: '', destination: '', remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ data: any[] }>('/certifications').then((r) => setCerts(r.data));
    api.get<{ data: any[] }>('/items?category=FP').then((r) => setItems(r.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_id || !form.planned_qty) { alert('품목과 수량을 입력하세요'); return; }
    setSubmitting(true);
    try {
      await api.post('/shipments', {
        ship_date: form.ship_date,
        cert_id: form.cert_id ? parseInt(form.cert_id) : undefined,
        item_id: parseInt(form.item_id),
        planned_qty: parseFloat(form.planned_qty),
        customer: form.customer || undefined,
        destination: form.destination || undefined,
        remarks: form.remarks || undefined,
      });
      onCreated();
    } catch { alert('등록 실패'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-shop-lg font-bold">출하 등록</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">출하일</span>
              <input type="date" value={form.ship_date}
                onChange={(e) => setForm({ ...form, ship_date: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">인정구조</span>
              <select value={form.cert_id}
                onChange={(e) => setForm({ ...form, cert_id: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm">
                <option value="">선택 안함</option>
                {certs.map((c) => (
                  <option key={c.cert_id} value={c.cert_id}>{c.cert_number} ({c.structure_code})</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">출하 품목 (완제품)</span>
            <select value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm">
              <option value="">선택</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>{i.item_code} - {i.item_name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">수량</span>
              <input type="number" step="1" value={form.planned_qty}
                onChange={(e) => setForm({ ...form, planned_qty: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">고객</span>
              <input type="text" value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" placeholder="고객사명" />
            </label>
          </div>
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">납품처</span>
            <input type="text" value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" placeholder="현장/주소" />
          </label>
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">비고</span>
            <textarea value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" rows={2} />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-process-cut text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50">
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
