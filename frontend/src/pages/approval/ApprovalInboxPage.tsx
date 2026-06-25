import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  FileCheck, Clock, CheckCircle, XCircle, RotateCcw, ChevronRight, ChevronDown,
  FileText, AlertCircle, Send, Trash2, Pencil, X, Save, Package, ArrowRight,
} from 'lucide-react';

interface Approval {
  approval_id: number;
  doc_type: string;
  doc_id: number;
  doc_title: string;
  doc_summary: string;
  status: string;
  writer_id: number;
  writer_name: string;
  writer_position: string;
  reviewer_id: number;
  reviewer_name: string;
  reviewer_position: string;
  approver_id: number;
  approver_name: string;
  approver_position: string;
  created_at: string;
  reviewed_at: string;
  approved_at: string;
  review_comment: string;
  approve_comment: string;
}

interface Worker {
  worker_id: number;
  worker_name: string;
  position: string;
  role: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  INCOMING_INSP: '인수검사', PROCESS_INSP: '중간검사', SELF_INSP: '자주검사',
  SHIPMENT: '출하', WORK_ORDER: '작업지시', DAILY_LOG: '공정일지', TBM: 'TBM', INVENTORY: '재고',
  PURCHASE_REQUEST: '자재발주서', SOCKET_ORDER: '소켓발주서',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: '작성', color: 'bg-gray-100 text-gray-600', icon: FileText },
  REVIEW: { label: '검토대기', color: 'bg-yellow-50 text-yellow-700', icon: Clock },
  PENDING_APPROVE: { label: '승인대기', color: 'bg-blue-50 text-blue-700', icon: Send },
  APPROVED: { label: '승인완료', color: 'bg-green-50 text-green-700', icon: CheckCircle },
  REJECTED: { label: '반려', color: 'bg-red-50 text-red-600', icon: XCircle },
  RETURNED: { label: '재작성', color: 'bg-orange-50 text-orange-600', icon: RotateCcw },
};

type TabType = 'pending' | 'my_requests' | 'all';

export function ApprovalInboxPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>('pending');
  const [pendingReview, setPendingReview] = useState<Approval[]>([]);
  const [pendingApprove, setPendingApprove] = useState<Approval[]>([]);
  const [myRequests, setMyRequests] = useState<Approval[]>([]);
  const [allApprovals, setAllApprovals] = useState<Approval[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ reviewer_id: string; approver_id: string; doc_title: string }>({
    reviewer_id: '', approver_id: '', doc_title: '',
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const navigate = useNavigate();

  const fetchData = async () => {
    if (!user) return;
    try {
      const [pending, mine, all, wk] = await Promise.all([
        api.get<{ data: { review: Approval[]; approve: Approval[] } }>(
          `/approvals/pending?worker_id=${user.worker_id}&role=${user.role}`
        ),
        api.get<{ data: Approval[] }>(`/approvals?writer_id=${user.worker_id}`),
        isAdmin
          ? api.get<{ data: Approval[] }>('/approvals')
          : Promise.resolve({ data: [] as Approval[] }),
        api.get<{ data: Worker[] }>('/workers'),
      ]);
      setPendingReview(pending.data.review);
      setPendingApprove(pending.data.approve);
      setMyRequests(mine.data);
      setAllApprovals(all.data);
      setWorkers(wk.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleAction = async (
    approvalId: number,
    stage: 'review' | 'approve',
    action: 'approve' | 'reject' | 'return',
    docType?: string,
  ) => {
    if (!user) return;
    try {
      await api.post(`/approvals/${approvalId}/${stage}`, {
        action,
        comment: comment || undefined,
        worker_id: user.worker_id,
        role: user.role,
      });
      setComment('');
      setSelectedId(null);
      fetchData();
      // 소켓발주서 최종 승인 완료 → 자재발주대기로 이동 안내
      if (action === 'approve' && stage === 'approve' && docType === 'SOCKET_ORDER') {
        const go = window.confirm(
          '✅ 소켓발주서 승인이 완료되었습니다!\n\n자재발주대기 페이지로 이동하시겠습니까?'
        );
        if (go) navigate('/orders/socket-order-wait');
      }
    } catch (err: any) {
      alert(err?.body?.error || '처리 실패');
    }
  };

  const handleDelete = async (approvalId: number) => {
    if (!confirm('이 결재를 삭제하시겠습니까?\n연동된 발주서는 DRAFT 상태로 복원됩니다.')) return;
    try {
      await api.delete(`/approvals/${approvalId}`);
      fetchData();
    } catch (err: any) {
      alert(err?.body?.error || '삭제 실패');
    }
  };

  const startEdit = (ap: Approval) => {
    setEditingId(ap.approval_id);
    setEditForm({
      reviewer_id: String(ap.reviewer_id || ''),
      approver_id: String(ap.approver_id || ''),
      doc_title: ap.doc_title || '',
    });
  };

  const handleEdit = async () => {
    if (!editingId) return;
    try {
      const body: Record<string, any> = {};
      if (editForm.doc_title) body.doc_title = editForm.doc_title;
      if (editForm.reviewer_id) body.reviewer_id = parseInt(editForm.reviewer_id);
      if (editForm.approver_id) body.approver_id = parseInt(editForm.approver_id);
      await api.patch(`/approvals/${editingId}`, body);
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      alert(err?.body?.error || '수정 실패');
    }
  };

  const totalPending = pendingReview.length + pendingApprove.length;

  const tabs = [
    { key: 'pending' as TabType, label: '결재 대기', count: totalPending },
    { key: 'my_requests' as TabType, label: '내 요청', count: myRequests.length },
    ...(isAdmin
      ? [{ key: 'all' as TabType, label: '전체', count: allApprovals.length }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">결재함</h1>
        <p className="mt-1 text-sm text-gray-500">
          대기 중 결재: 검토 {pendingReview.length}건, 승인 {pendingApprove.length}건
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedId(null); setComment(''); }}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                'ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-bold',
                tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 수정 모달 */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">결재 수정</h3>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">제목</label>
                <input
                  type="text"
                  value={editForm.doc_title}
                  onChange={(e) => setEditForm({ ...editForm, doc_title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">검토자</label>
                <select
                  value={editForm.reviewer_id}
                  onChange={(e) => setEditForm({ ...editForm, reviewer_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  {workers.map((w) => (
                    <option key={w.worker_id} value={w.worker_id}>
                      {w.worker_name} ({w.position})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">승인자</label>
                <select
                  value={editForm.approver_id}
                  onChange={(e) => setEditForm({ ...editForm, approver_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  {workers.map((w) => (
                    <option key={w.worker_id} value={w.worker_id}>
                      {w.worker_name} ({w.position})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Save className="h-4 w-4" /> 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">로딩 중...</div>
      ) : tab === 'pending' ? (
        <div className="space-y-4">
          {/* 검토 대기 */}
          {pendingReview.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-yellow-700 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> 검토 대기 ({pendingReview.length}건)
              </h3>
              {pendingReview.map((ap) => (
                <ApprovalCard
                  key={ap.approval_id}
                  approval={ap}
                  stage="review"
                  isExpanded={selectedId === ap.approval_id}
                  onToggle={() => setSelectedId(selectedId === ap.approval_id ? null : ap.approval_id)}
                  comment={comment}
                  onCommentChange={setComment}
                  onAction={(action) => handleAction(ap.approval_id, 'review', action, ap.doc_type)}
                  isAdmin={isAdmin}
                  onEdit={() => startEdit(ap)}
                  onDelete={() => handleDelete(ap.approval_id)}
                />
              ))}
            </div>
          )}

          {/* 승인 대기 */}
          {pendingApprove.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-blue-700 flex items-center gap-1.5">
                <Send className="h-4 w-4" /> 승인 대기 ({pendingApprove.length}건)
              </h3>
              {pendingApprove.map((ap) => (
                <ApprovalCard
                  key={ap.approval_id}
                  approval={ap}
                  stage="approve"
                  isExpanded={selectedId === ap.approval_id}
                  onToggle={() => setSelectedId(selectedId === ap.approval_id ? null : ap.approval_id)}
                  comment={comment}
                  onCommentChange={setComment}
                  onAction={(action) => handleAction(ap.approval_id, 'approve', action, ap.doc_type)}
                  isAdmin={isAdmin}
                  onEdit={() => startEdit(ap)}
                  onDelete={() => handleDelete(ap.approval_id)}
                />
              ))}
            </div>
          )}

          {totalPending === 0 && (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <CheckCircle className="h-12 w-12 mb-3 text-green-300" />
              <p className="text-lg font-medium">대기 중인 결재가 없습니다</p>
            </div>
          )}
        </div>
      ) : tab === 'my_requests' ? (
        <ApprovalList
          approvals={myRequests}
          isAdmin={isAdmin}
          onEdit={startEdit}
          onDelete={handleDelete}
          selectedId={selectedId}
          onToggle={(id) => { setSelectedId(selectedId === id ? null : id); setComment(''); }}
          comment={comment}
          onCommentChange={setComment}
          onAction={handleAction}
          navigate={navigate}
        />
      ) : (
        <ApprovalList
          approvals={allApprovals}
          isAdmin={isAdmin}
          onEdit={startEdit}
          onDelete={handleDelete}
          selectedId={selectedId}
          onToggle={(id) => { setSelectedId(selectedId === id ? null : id); setComment(''); }}
          comment={comment}
          onCommentChange={setComment}
          onAction={handleAction}
          navigate={navigate}
        />
      )}
    </div>
  );
}

/* ─── 결재 대기 카드 (pending 탭용) ─── */
function ApprovalCard({
  approval, stage, isExpanded, onToggle, comment, onCommentChange, onAction, isAdmin, onEdit, onDelete,
}: {
  approval: Approval;
  stage: 'review' | 'approve';
  isExpanded: boolean;
  onToggle: () => void;
  comment: string;
  onCommentChange: (v: string) => void;
  onAction: (action: 'approve' | 'reject' | 'return') => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const st = STATUS_CONFIG[approval.status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="mb-2 rounded-xl border bg-white overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {DOC_TYPE_LABELS[approval.doc_type] || approval.doc_type}
            </span>
            <span className="text-sm font-medium text-gray-900">{approval.doc_title || `문서 #${approval.doc_id}`}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>작성: {approval.writer_name}</span>
            <span>{new Date(approval.created_at).toLocaleDateString('ko-KR')}</span>
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', st.color)}>{st.label}</span>
        <ChevronRight className={cn('h-4 w-4 text-gray-400 transition-transform', isExpanded && 'rotate-90')} />
      </button>

      {isExpanded && (
        <div className="border-t bg-gray-50 px-4 py-3">
          {approval.doc_summary && (
            <p className="mb-3 text-sm text-gray-600">{approval.doc_summary}</p>
          )}

          {/* 발주 품목 상세 */}
          {approval.doc_type === 'PURCHASE_REQUEST' && (
            <PrItemsPreview prId={approval.doc_id} />
          )}
          {approval.doc_type === 'SOCKET_ORDER' && (
            <SocketOrderPreview soId={approval.doc_id} />
          )}

          {/* 결재 이력 */}
          <div className="mb-3 flex items-center gap-2 text-xs flex-wrap">
            <span className="rounded bg-white border px-2 py-1">
              작성: {approval.writer_name}
            </span>
            <ChevronRight className="h-3 w-3 text-gray-300" />
            <span className={cn('rounded border px-2 py-1', approval.status === 'REVIEW' ? 'bg-yellow-50 border-yellow-200 font-bold' : 'bg-white')}>
              검토: {approval.reviewer_name || '-'}
            </span>
            <ChevronRight className="h-3 w-3 text-gray-300" />
            <span className={cn('rounded border px-2 py-1', approval.status === 'PENDING_APPROVE' ? 'bg-blue-50 border-blue-200 font-bold' : 'bg-white')}>
              승인: {approval.approver_name || '-'}
            </span>
          </div>

          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="의견을 입력하세요 (선택)"
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
          />

          <div className="flex gap-2 justify-between flex-wrap">
            {/* 좌측: 수정/삭제 */}
            <div className="flex gap-2">
              {isAdmin && onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  <Pencil className="h-3.5 w-3.5" /> 수정
                </button>
              )}
              {isAdmin && onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 삭제
                </button>
              )}
            </div>

            {/* 우측: 결재 액션 */}
            <div className="flex gap-2">
              <button
                onClick={() => onAction('return')}
                className="flex items-center gap-1 rounded-lg border border-orange-300 px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> 반려
              </button>
              <button
                onClick={() => onAction('reject')}
                className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" /> 거부
              </button>
              <button
                onClick={() => onAction('approve')}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {stage === 'review' ? '검토 승인' : '최종 승인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 결재 목록 테이블 (내 요청 / 전체 탭) - 행 클릭으로 상세 & 액션 ─── */
function ApprovalList({
  approvals, isAdmin, onEdit, onDelete, selectedId, onToggle, comment, onCommentChange, onAction, navigate,
}: {
  approvals: Approval[];
  isAdmin?: boolean;
  onEdit?: (ap: Approval) => void;
  onDelete?: (id: number) => void;
  selectedId: number | null;
  onToggle: (id: number) => void;
  comment: string;
  onCommentChange: (v: string) => void;
  onAction: (approvalId: number, stage: 'review' | 'approve', action: 'approve' | 'reject' | 'return', docType?: string) => void;
  navigate?: (path: string) => void;
}) {
  if (approvals.length === 0) {
    return <div className="py-12 text-center text-gray-400">결재 내역이 없습니다.</div>;
  }

  return (
    <div className="space-y-2">
      {/* 테이블 헤더 */}
      <div className="hidden md:grid md:grid-cols-[80px_1fr_80px_80px_80px_80px_100px_70px] gap-2 px-4 py-2 text-xs font-semibold text-gray-500 border-b">
        <span>유형</span>
        <span>제목</span>
        <span>작성자</span>
        <span>검토자</span>
        <span>승인자</span>
        <span className="text-center">상태</span>
        <span>요청일</span>
        {isAdmin && <span className="text-center">관리</span>}
      </div>

      {approvals.map((ap) => {
        const st = STATUS_CONFIG[ap.status] || STATUS_CONFIG.DRAFT;
        const isOpen = selectedId === ap.approval_id;
        const canReview = ap.status === 'REVIEW';
        const canApprove = ap.status === 'PENDING_APPROVE';
        const canAct = canReview || canApprove;

        return (
          <div key={ap.approval_id} className="rounded-xl border bg-white overflow-hidden">
            {/* 행 */}
            <button
              onClick={() => onToggle(ap.approval_id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 whitespace-nowrap">
                    {DOC_TYPE_LABELS[ap.doc_type] || ap.doc_type}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {ap.doc_title || `#${ap.doc_id}`}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  <span>작성: {ap.writer_name || '-'}</span>
                  <span>검토: {ap.reviewer_name || '-'}</span>
                  <span>승인: {ap.approver_name || '-'}</span>
                  <span>{new Date(ap.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>

              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', st.color)}>
                {st.label}
              </span>

              {/* 관리 버튼 */}
              {isAdmin && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onEdit?.(ap)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                    title="수정"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete?.(ap.approval_id)}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {canAct ? (
                <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform shrink-0', isOpen && 'rotate-180')} />
              ) : (
                <div className="w-4" />
              )}
            </button>

            {/* 펼쳐진 상세 + 액션 영역 */}
            {isOpen && (
              <div className="border-t bg-gray-50 px-4 py-3">
                {ap.doc_summary && (
                  <p className="mb-3 text-sm text-gray-600">{ap.doc_summary}</p>
                )}

                {/* 발주 품목 상세 */}
                {ap.doc_type === 'PURCHASE_REQUEST' && (
                  <PrItemsPreview prId={ap.doc_id} />
                )}
                {ap.doc_type === 'SOCKET_ORDER' && (
                  <SocketOrderPreview soId={ap.doc_id} />
                )}

                {/* 결재 흐름 */}
                <div className="mb-3 flex items-center gap-2 text-xs flex-wrap">
                  <span className="rounded bg-white border px-2 py-1">
                    작성: {ap.writer_name || '-'}
                  </span>
                  <ChevronRight className="h-3 w-3 text-gray-300" />
                  <span className={cn('rounded border px-2 py-1',
                    ap.status === 'REVIEW' ? 'bg-yellow-50 border-yellow-200 font-bold' : 'bg-white'
                  )}>
                    검토: {ap.reviewer_name || '-'}
                    {ap.review_comment && <span className="ml-1 text-gray-400">"{ap.review_comment}"</span>}
                  </span>
                  <ChevronRight className="h-3 w-3 text-gray-300" />
                  <span className={cn('rounded border px-2 py-1',
                    ap.status === 'PENDING_APPROVE' ? 'bg-blue-50 border-blue-200 font-bold' :
                    ap.status === 'APPROVED' ? 'bg-green-50 border-green-200 font-bold' : 'bg-white'
                  )}>
                    승인: {ap.approver_name || '-'}
                    {ap.approve_comment && <span className="ml-1 text-gray-400">"{ap.approve_comment}"</span>}
                  </span>
                </div>

                {/* 처리 완료된 건 */}
                {!canAct && (
                  <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-500">
                    {ap.status === 'APPROVED' && (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle className="h-4 w-4" /> 승인 완료
                          {ap.approved_at && ` (${new Date(ap.approved_at).toLocaleDateString('ko-KR')})`}
                        </span>
                        {ap.doc_type === 'SOCKET_ORDER' && navigate && (
                          <button
                            onClick={() => navigate('/orders/socket-order-wait')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            <Package className="h-3.5 w-3.5" />
                            자재발주대기 바로가기
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                    {ap.status === 'REJECTED' && (
                      <span className="flex items-center gap-1.5 text-red-600">
                        <XCircle className="h-4 w-4" /> 반려됨
                      </span>
                    )}
                    {ap.status === 'RETURNED' && (
                      <span className="flex items-center gap-1.5 text-orange-600">
                        <RotateCcw className="h-4 w-4" /> 재작성 요청됨
                      </span>
                    )}
                    {ap.status === 'DRAFT' && (
                      <span className="text-gray-400">작성 중</span>
                    )}
                  </div>
                )}

                {/* 검토/승인 액션 */}
                {canAct && (
                  <>
                    <textarea
                      value={comment}
                      onChange={(e) => onCommentChange(e.target.value)}
                      placeholder="의견을 입력하세요 (선택)"
                      className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button
                        onClick={() => onAction(ap.approval_id, canReview ? 'review' : 'approve', 'return')}
                        className="flex items-center gap-1 rounded-lg border border-orange-300 px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> 반려
                      </button>
                      <button
                        onClick={() => onAction(ap.approval_id, canReview ? 'review' : 'approve', 'reject')}
                        className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> 거부
                      </button>
                      <button
                        onClick={() => onAction(ap.approval_id, canReview ? 'review' : 'approve', 'approve')}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {canReview ? '검토 승인' : '최종 승인'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════ 발주서 품목 미리보기 ═══════ */
function PrItemsPreview({ prId }: { prId: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/purchase-requests/${prId}`)
      .then((res: any) => setItems(res.data?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [prId]);

  if (loading) return <div className="text-xs text-gray-400 mb-3">품목 로딩중...</div>;
  if (items.length === 0) return null;

  // 카테고리별 그룹핑
  const rmItems = items.filter((i: any) => i.item_code?.startsWith('RM-'));
  const smItems = items.filter((i: any) => !i.item_code?.startsWith('RM-'));

  return (
    <div className="mb-3 border rounded-lg overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gray-100 text-xs font-bold text-gray-700">
        발주 품목 ({items.length}건)
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-gray-500">
              <th className="px-3 py-1.5 text-left">품목코드</th>
              <th className="px-3 py-1.5 text-left">품목명</th>
              <th className="px-3 py-1.5 text-right">발주수량</th>
              <th className="px-3 py-1.5 text-left">단위</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rmItems.length > 0 && (
              <tr className="bg-amber-50">
                <td colSpan={4} className="px-3 py-1 text-[10px] font-bold text-amber-700">배합원료 ({rmItems.length}건)</td>
              </tr>
            )}
            {rmItems.map((item: any, idx: number) => (
              <tr key={`rm-${idx}`} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 font-mono text-amber-700">{item.item_code}</td>
                <td className="px-3 py-1.5">{item.item_name}</td>
                <td className="px-3 py-1.5 text-right font-mono font-medium">{Number(item.order_qty).toLocaleString()}</td>
                <td className="px-3 py-1.5 text-gray-500">{item.unit}</td>
              </tr>
            ))}
            {smItems.length > 0 && (
              <tr className="bg-blue-50">
                <td colSpan={4} className="px-3 py-1 text-[10px] font-bold text-blue-700">부자재 ({smItems.length}건)</td>
              </tr>
            )}
            {smItems.slice(0, 20).map((item: any, idx: number) => (
              <tr key={`sm-${idx}`} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 font-mono">{item.item_code}</td>
                <td className="px-3 py-1.5">{item.item_name}</td>
                <td className="px-3 py-1.5 text-right font-mono font-medium">{Number(item.order_qty).toLocaleString()}</td>
                <td className="px-3 py-1.5 text-gray-500">{item.unit}</td>
              </tr>
            ))}
            {smItems.length > 20 && (
              <tr><td colSpan={4} className="px-3 py-1.5 text-center text-gray-400 text-[10px]">... 외 {smItems.length - 20}건</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════ 소켓발주서 전체 미리보기 (결재함용) ═══════ */
function SocketOrderPreview({ soId }: { soId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/socket-orders/${soId}`)
      .then((res: any) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [soId]);

  if (loading) return <div className="text-xs text-gray-400 mb-3 py-2">소켓발주서 로딩중...</div>;
  if (!data) return null;

  const items: any[] = data.items_json || [];
  if (items.length === 0) return null;

  // ── 소켓 계산 설정 ──
  const STRUCT_CALC: Record<string, (w: number, h: number, q: number) => { sw: number; sh: number; oq: number; depth: number }> = {
    'VT-01':     (w, h, q) => ({ sw: w,                      sh: h, oq: q * 2, depth: 200 }),
    'VT-049':    (w, h, q) => ({ sw: w,                      sh: h, oq: q * 1, depth: 200 }),
    'VT-064':    (w, h, q) => ({ sw: w,                      sh: h, oq: q * 1, depth: 200 }),
    'VA-064':    (w, h, q) => ({ sw: w,                      sh: h, oq: q * 1, depth: 200 }),
    'VAG-1.69':  (w, h, q) => ({ sw: Math.round(w/2-30),     sh: h, oq: q * 2, depth: 200 }),
    'HTG-064':   (w, h, q) => ({ sw: w,                      sh: h, oq: q * 1, depth: 300 }),
    'HTG-064DC': (w, h, q) => ({ sw: w,                      sh: h, oq: q * 1, depth: 300 }),
    'HTG-1.69':  (w, h, q) => ({ sw: Math.round(w/2-30),     sh: h, oq: q * 2, depth: 300 }),
  };
  const STRUCT_COLORS: Record<string, string> = {
    'VT-01': 'bg-purple-100 text-purple-700', 'VT-049': 'bg-blue-100 text-blue-700',
    'VT-064': 'bg-indigo-100 text-indigo-700', 'VA-064': 'bg-cyan-100 text-cyan-700',
    'VAG-1.69': 'bg-teal-100 text-teal-700', 'HTG-064': 'bg-orange-100 text-orange-700',
    'HTG-064DC': 'bg-amber-100 text-amber-700', 'HTG-1.69': 'bg-rose-100 text-rose-700',
  };

  // ── 구조체별 그룹핑 ──
  const grouped = new Map<string, any[]>();
  for (const item of items) {
    const code = (item.product_type || '').trim();
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code)!.push(item);
  }

  // ── 평철 계산 ──
  function calcBrackets(code: string, w: number, h: number, q: number) {
    const sw = Math.round(w / 2 - 30);
    const rows: { t: number; bw: number; l: number; qty: number }[] = [];
    const add = (t: number, bw: number, l: number, qty: number) => {
      if (qty > 0 && l > 0) rows.push({ t, bw, l: Math.round(l), qty });
    };
    switch (code) {
      case 'VT-049': case 'VT-064': case 'VA-064':
        add(1.6, 60, w-1, q*4); add(1.6, 60, h-30, q*4); break;
      case 'VT-01':
        add(1.6, 60, Math.round(w/2-16), q*16); add(1.6, 60, Math.round(h/2-20), q*32);
        add(1.6, 225, Math.round(w/2-16), q*8); add(1.6, 237, h-1, q*4); break;
      case 'VAG-1.69':
        add(1.6, 60, sw-1, q*4); add(1.6, 60, h-30, q*4); break;
      case 'HTG-064': case 'HTG-064DC':
        add(1.6, 60, w-5, q*2); add(1.6, 274, w-5, q*2);
        add(1.6, 60, h-35, q*4); add(1.6, 50, h, q*3); break;
      case 'HTG-1.69':
        add(1.6, 60, sw-5, q*4); add(1.6, 274, sw-5, q*4);
        add(1.6, 60, h-35, q*4); add(1.6, 50, h, q*6); break;
    }
    return rows;
  }

  const bracketAgg = new Map<string, { t: number; bw: number; l: number; qty: number }>();
  for (const item of items) {
    const c = (item.product_type || '').trim();
    for (const b of calcBrackets(c, item.pipe_width_mm||0, item.pipe_height_mm||0, item.qty||1)) {
      const key = `${b.t}_${b.bw}_${b.l}`;
      const e = bracketAgg.get(key);
      if (e) e.qty += b.qty;
      else bracketAgg.set(key, { ...b });
    }
  }
  const bracketList = [...bracketAgg.values()].sort((a, b) => a.bw - b.bw || a.l - b.l);
  const bracketTotal = bracketList.reduce((s, r) => s + r.qty, 0);

  const socketTotal = items.reduce((s, item) => {
    const calc = STRUCT_CALC[(item.product_type||'').trim()];
    const c = calc ? calc(item.pipe_width_mm||0, item.pipe_height_mm||0, item.qty||1) : null;
    return s + (c?.oq ?? 0);
  }, 0);

  return (
    <div className="mb-4 border-2 border-blue-200 rounded-xl overflow-hidden bg-white">
      {/* 발주서 헤더 */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">소켓/평철 발주서 원본</h4>
          <p className="text-xs text-blue-200 mt-0.5">{data.project_name}</p>
        </div>
        <div className="flex gap-3 text-right">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{socketTotal}<span className="text-xs font-normal text-blue-200">ea</span></p>
            <p className="text-[10px] text-blue-200">소켓 합계</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-orange-300">{bracketTotal}<span className="text-xs font-normal text-orange-200">개</span></p>
            <p className="text-[10px] text-blue-200">평철 합계</p>
          </div>
        </div>
      </div>

      {/* ── 소켓 섹션 ── */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
        <h5 className="text-xs font-bold text-blue-700">🔌 소켓 발주 명세</h5>
      </div>
      <div className="divide-y divide-gray-50">
        {[...grouped.entries()].map(([code, codeItems]) => {
          const clr = STRUCT_COLORS[code] || 'bg-gray-100 text-gray-700';
          const calc = STRUCT_CALC[code];
          const total = codeItems.reduce((s, item) => {
            const c = calc ? calc(item.pipe_width_mm||0, item.pipe_height_mm||0, item.qty||1) : null;
            return s + (c?.oq ?? 0);
          }, 0);
          return (
            <div key={code}>
              {/* 구조체 소제목 */}
              <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/80">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${clr}`}>{code}</span>
                <span className="text-xs font-semibold text-blue-600">{total}ea</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-400 text-[10px]">
                    <th className="px-3 py-1 text-left">관통재(가로×세로)</th>
                    <th className="px-3 py-1 text-center">수량</th>
                    <th className="px-3 py-1 text-center text-blue-500">소켓 가로</th>
                    <th className="px-3 py-1 text-center text-blue-500">소켓 세로</th>
                    <th className="px-3 py-1 text-center text-blue-500">폭(mm)</th>
                    <th className="px-3 py-1 text-right text-green-600 font-semibold">발주수량</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {codeItems.map((item: any, idx: number) => {
                    const w = item.pipe_width_mm||0, h = item.pipe_height_mm||0, q = item.qty||1;
                    const c = calc ? calc(w, h, q) : null;
                    return (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="px-3 py-1.5 font-mono text-gray-700">{w}×{h}</td>
                        <td className="px-3 py-1.5 text-center text-gray-600">{q}</td>
                        <td className="px-3 py-1.5 text-center font-mono font-semibold text-blue-600">{c?.sw??'-'}</td>
                        <td className="px-3 py-1.5 text-center font-mono font-semibold text-blue-600">{c?.sh??'-'}</td>
                        <td className="px-3 py-1.5 text-center font-mono text-blue-500">{c?.depth??'-'}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-green-700">{c?.oq??'-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      {/* 소켓 합계 행 */}
      <div className="flex justify-end px-4 py-2 bg-blue-50 border-t border-blue-100">
        <span className="text-xs font-bold text-blue-700">소켓 총합계: {socketTotal}ea</span>
      </div>

      {/* ── 평철(브라켓) 섹션 ── */}
      {bracketList.length > 0 && (
        <>
          <div className="px-4 py-2 bg-orange-50 border-t-2 border-orange-200 border-b border-orange-100 flex items-center justify-between">
            <h5 className="text-xs font-bold text-orange-700">🔩 평철(브라켓) 발주 명세</h5>
            <span className="text-xs font-semibold text-orange-600">총 {bracketTotal}개</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-orange-50/60">
              <tr className="text-gray-400 text-[10px]">
                <th className="px-3 py-1.5 text-center w-7">No</th>
                <th className="px-3 py-1.5 text-center">재질</th>
                <th className="px-3 py-1.5 text-center text-orange-600 font-semibold">두께(T)</th>
                <th className="px-3 py-1.5 text-center text-orange-600 font-semibold">폭(mm)</th>
                <th className="px-3 py-1.5 text-center text-orange-600 font-semibold">길이(mm)</th>
                <th className="px-3 py-1.5 text-right text-green-600 font-semibold">수량(개)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bracketList.map((b, idx) => (
                <tr key={idx} className={`hover:bg-orange-50/30 ${b.bw >= 200 ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-3 py-1.5 text-center text-gray-400">{idx+1}</td>
                  <td className="px-3 py-1.5 text-center text-gray-600">GI</td>
                  <td className="px-3 py-1.5 text-center font-mono text-orange-600">{b.t}</td>
                  <td className="px-3 py-1.5 text-center font-mono font-bold text-orange-700">{b.bw}</td>
                  <td className="px-3 py-1.5 text-center font-mono font-bold text-orange-700">{b.l}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold text-green-700">{b.qty}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-orange-100 border-t-2 border-orange-200">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right font-bold text-orange-800 text-xs">총 합계</td>
                <td className="px-3 py-2 text-right font-bold text-green-700">{bracketTotal}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}
