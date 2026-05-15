import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  FileCheck, Clock, CheckCircle, XCircle, RotateCcw, ChevronRight, ChevronDown,
  FileText, AlertCircle, Send, Trash2, Pencil, X, Save,
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
  PURCHASE_REQUEST: '자재발주서',
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

  const handleAction = async (approvalId: number, stage: 'review' | 'approve', action: 'approve' | 'reject' | 'return') => {
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
                  onAction={(action) => handleAction(ap.approval_id, 'review', action)}
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
                  onAction={(action) => handleAction(ap.approval_id, 'approve', action)}
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
  approvals, isAdmin, onEdit, onDelete, selectedId, onToggle, comment, onCommentChange, onAction,
}: {
  approvals: Approval[];
  isAdmin?: boolean;
  onEdit?: (ap: Approval) => void;
  onDelete?: (id: number) => void;
  selectedId: number | null;
  onToggle: (id: number) => void;
  comment: string;
  onCommentChange: (v: string) => void;
  onAction: (approvalId: number, stage: 'review' | 'approve', action: 'approve' | 'reject' | 'return') => void;
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
                      <span className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle className="h-4 w-4" /> 승인 완료
                        {ap.approved_at && ` (${new Date(ap.approved_at).toLocaleDateString('ko-KR')})`}
                      </span>
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
