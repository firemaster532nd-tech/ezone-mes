import { useState } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldX, SendHorizonal, Loader2, CheckCircle, Lock } from 'lucide-react';

// 권한 체크 없이 항상 허용할 경로 prefix
const ALWAYS_ALLOWED = [
  '/dashboard',
  '/announcements',
  '/approval/inbox',
  '/approval/lines',
  '/production/tbm-print',
  '/print/',
];

export function RoutePermissionGuard() {
  const { pathname } = useLocation();
  const { permissions, isAdmin, user } = useAuth();

  // 관리자는 무조건 통과
  if (isAdmin) return <Outlet />;

  // 항상 허용 경로
  if (ALWAYS_ALLOWED.some(prefix => pathname.startsWith(prefix))) return <Outlet />;

  // 권한 DB에서 현재 경로 조회
  const found = permissions.find(p => p.path && pathname.startsWith(p.path));

  // DB에 없는 경로는 기본 허용 (신규 메뉴 자동 노출)
  if (!found) return <Outlet />;

  // can_read 있으면 통과
  if (found.can_read) return <Outlet />;

  // 권한 없음 — 요청 화면 표시
  return (
    <NoPermissionScreen
      menuId={found.menu_id}
      menuName={found.menu_code}
      path={pathname}
    />
  );
}

// ── 권한 없음 화면 ────────────────────────────────────────────────────────────
function NoPermissionScreen({
  menuId,
  menuName,
  path,
}: {
  menuId: number;
  menuName: string;
  path: string;
}) {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRequest() {
    setSending(true);
    try {
      await api.post('/permission-requests', {
        menu_id: menuId,
        menu_name: menuName,
        reason: reason.trim() || undefined,
      });
      setDone(true);
      toast.success('권한 요청이 전송되었습니다. 관리자 승인 후 사용 가능합니다.');
    } catch (e: any) {
      toast.error('권한 요청 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 p-6 text-center">
      {/* 아이콘 */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 border border-red-100">
        <ShieldX className="h-10 w-10 text-red-400" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-800">접근 권한이 없습니다</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          이 페이지를 보려면 <strong className="text-slate-700">{menuName}</strong> 메뉴의 읽기 권한이 필요합니다.
          <br />관리자에게 권한을 요청하거나, 아래 버튼을 눌러 바로 요청할 수 있습니다.
        </p>
      </div>

      {!done ? (
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-3 shadow-lg transition-colors"
        >
          <Lock className="h-4 w-4" />
          권한 요청하기
        </button>
      ) : (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm font-semibold">
          <CheckCircle className="h-4 w-4" />
          요청이 전송되었습니다. 관리자 승인을 기다려 주세요.
        </div>
      )}

      {/* 권한 요청 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-blue-600" />
              <h3 className="font-bold text-slate-800">권한 요청</h3>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">요청자</span>
                <span className="font-semibold text-slate-700">{user?.worker_name} ({user?.employee_no})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">요청 메뉴</span>
                <span className="font-semibold text-slate-700">{menuName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">경로</span>
                <span className="font-mono text-slate-500 text-[10px]">{path}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                요청 사유 <span className="text-slate-400 font-normal">(선택)</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="이 메뉴가 필요한 이유를 간단히 입력해 주세요..."
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleRequest}
                disabled={sending}
                className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 shadow transition-colors"
              >
                {sending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> 전송 중...</>
                  : <><SendHorizonal className="h-4 w-4" /> 요청 전송</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
