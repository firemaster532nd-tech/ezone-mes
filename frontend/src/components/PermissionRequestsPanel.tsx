import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ShieldCheck, ShieldX, Clock, CheckCircle2, XCircle,
  Loader2, User, Calendar, MessageSquare, RefreshCw
} from 'lucide-react';

interface PermRequest {
  request_id: number;
  worker_id: number;
  worker_name: string;
  employee_no: string;
  menu_id?: number;
  menu_name?: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewer_name?: string;
  reviewed_at?: string;
  created_at: string;
}

interface Props {
  /** 외부에서 뱃지 갱신용 콜백 (선택) */
  onCountChange?: (count: number) => void;
}

export function PermissionRequestsPanel({ onCountChange }: Props) {
  const [requests, setRequests] = useState<PermRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [approving, setApproving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ requests: PermRequest[] }>('/permission-requests');
      setRequests(res.requests);
      const pending = res.requests.filter(r => r.status === 'PENDING').length;
      onCountChange?.(pending);
    } catch { toast.error('권한 요청 목록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [onCountChange]);

  useEffect(() => { load(); }, [load]);

  async function handleReview(
    requestId: number,
    status: 'APPROVED' | 'REJECTED',
  ) {
    setApproving(requestId);
    try {
      await api.patch(`/permission-requests/${requestId}`, {
        status,
        can_read: true,
        can_write: false,
        can_update: false,
        can_delete: false,
      });
      toast.success(status === 'APPROVED' ? '승인되었습니다.' : '거절되었습니다.');
      await load();
    } catch { toast.error('처리 중 오류가 발생했습니다.'); }
    finally { setApproving(null); }
  }

  const filtered = tab === 'PENDING'
    ? requests.filter(r => r.status === 'PENDING')
    : requests;

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="flex flex-col gap-3">
      {/* 탭 + 새로고침 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Clock className="h-3.5 w-3.5" />
            미처리
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500 text-white text-[9px] px-1.5 py-0.5 font-bold">{pendingCount}</span>
            )}
          </button>
          <button
            onClick={() => setTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'ALL' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            전체
          </button>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          {tab === 'PENDING' ? '미처리 요청이 없습니다.' : '권한 요청이 없습니다.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div
              key={r.request_id}
              className={`rounded-xl border p-4 transition-all ${
                r.status === 'PENDING'
                  ? 'border-amber-200 bg-amber-50'
                  : r.status === 'APPROVED'
                  ? 'border-green-100 bg-green-50/50'
                  : 'border-red-100 bg-red-50/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* 요청자 */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-slate-800">{r.worker_name}</span>
                    <span className="text-xs text-slate-400 font-mono">{r.employee_no}</span>
                  </div>

                  {/* 요청 메뉴 */}
                  {r.menu_name && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-slate-600">
                        <strong className="text-slate-800">{r.menu_name}</strong> 권한 요청
                      </span>
                    </div>
                  )}

                  {/* 사유 */}
                  {r.reason && (
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-500 italic">"{r.reason}"</p>
                    </div>
                  )}

                  {/* 시각 */}
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(r.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {r.status !== 'PENDING' && r.reviewer_name && (
                      <span className="ml-2">· {r.reviewer_name}이(가) {r.status === 'APPROVED' ? '승인' : '거절'}</span>
                    )}
                  </div>
                </div>

                {/* 상태 / 액션 버튼 */}
                <div className="flex-shrink-0">
                  {r.status === 'PENDING' ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => handleReview(r.request_id, 'APPROVED')}
                        disabled={approving === r.request_id}
                        className="flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-xs font-bold px-3 py-1.5 transition-colors"
                      >
                        {approving === r.request_id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <CheckCircle2 className="h-3 w-3" />
                        }
                        승인
                      </button>
                      <button
                        onClick={() => handleReview(r.request_id, 'REJECTED')}
                        disabled={approving === r.request_id}
                        className="flex items-center gap-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 transition-colors"
                      >
                        <XCircle className="h-3 w-3" />
                        거절
                      </button>
                    </div>
                  ) : (
                    <span className={`inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2 py-1 ${
                      r.status === 'APPROVED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {r.status === 'APPROVED'
                        ? <><CheckCircle2 className="h-3 w-3" />승인됨</>
                        : <><XCircle className="h-3 w-3" />거절됨</>
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
