import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  Megaphone, MessageSquare, Plus, X, Users, User,
  Building2, Loader2, Clock, CheckCheck, Circle,
  Trash2, Send, Eye, ChevronLeft, Mail, MailOpen,
  Inbox, SendHorizontal
} from 'lucide-react';

// ── 타입 ────────────────────────────────────────────────────────────────────
interface Announcement {
  announcement_id: number;
  title: string;
  body: string;
  target_type: 'ALL' | 'DEPT' | 'INDIVIDUAL';
  target_ids: number[];
  author_name: string;
  created_at: string;
  msg_type?: 'NOTICE' | 'MESSAGE';
  is_read?: boolean;
  read_at?: string;
  total_recipients?: number;
  read_count?: number;
}

interface Message {
  message_id: number;
  title: string;
  body: string;
  target_type: 'DEPT' | 'INDIVIDUAL';
  target_ids: number[];
  author_name: string;
  created_at: string;
  is_read?: boolean;
  read_at?: string;
  total_recipients?: number;
  read_count?: number;
}

interface Dept { dept_id: number; dept_name: string; }
interface Worker { worker_id: number; worker_name: string; employee_no: string; dept_name?: string; position?: string; }
interface Receipt { worker_name: string; employee_no: string; is_read: boolean; read_at?: string; }

// ── 유틸 ────────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function AnnouncementsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const canWriteNotice = isAdmin || user?.role === 'manager';  // 공지 작성: manager+
  // 쪽지 작성: 누구나 가능

  // 탭: notice | message
  const [pageTab, setPageTab] = useState<'notice' | 'message'>('notice');
  // 쪽지 하위탭: inbox | sent
  const [msgTab, setMsgTab] = useState<'inbox' | 'sent'>('inbox');

  // 공지 상태
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [noticeLoading, setNoticeLoading] = useState(true);

  // 쪽지 상태
  const [messages, setMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  // 상세 보기
  const [detail, setDetail] = useState<Announcement | Message | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailType, setDetailType] = useState<'notice' | 'message'>('notice');

  // 공지 작성 모달
  const [composingNotice, setComposingNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeTargetType, setNoticeTargetType] = useState<'ALL' | 'DEPT' | 'INDIVIDUAL'>('ALL');
  const [noticeTargetIds, setNoticeTargetIds] = useState<number[]>([]);

  // 쪽지 작성 모달
  const [composingMsg, setComposingMsg] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgTargetType, setMsgTargetType] = useState<'DEPT' | 'INDIVIDUAL'>('INDIVIDUAL');
  const [msgTargetIds, setMsgTargetIds] = useState<number[]>([]);

  // 공통: 부서/직원 목록
  const [depts, setDepts] = useState<Dept[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sending, setSending] = useState(false);

  // ── 데이터 로드 ─────────────────────────────────────────────────────────────
  const loadNotices = useCallback(async () => {
    setNoticeLoading(true);
    try {
      const res = await api.get<{ announcements: Announcement[] }>('/announcements');
      setNotices(res.announcements || []);
    } catch { toast.error('공지 목록을 불러오지 못했습니다.'); }
    finally { setNoticeLoading(false); }
  }, []);

  const loadMessages = useCallback(async () => {
    setMsgLoading(true);
    try {
      const [inboxRes, sentRes] = await Promise.all([
        api.get<{ messages: Message[] }>('/messages'),
        api.get<{ messages: Message[] }>('/messages/sent'),
      ]);
      setMessages(inboxRes.messages || []);
      setSentMessages(sentRes.messages || []);
    } catch { toast.error('쪽지함을 불러오지 못했습니다.'); }
    finally { setMsgLoading(false); }
  }, []);

  useEffect(() => { loadNotices(); }, [loadNotices]);
  useEffect(() => { if (pageTab === 'message') loadMessages(); }, [pageTab, loadMessages]);

  useEffect(() => {
    if (id) {
      const numId = parseInt(id);
      if (pageTab === 'notice') openNoticeDetail(numId);
      else openMsgDetail(numId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── 부서/직원 목록 로드 (작성 모달용) ────────────────────────────────────
  // 공지 작성(manager+) → /auth/users (상세 정보 포함)
  // 쪽지 보내기(누구나) → /auth/worker-list (경량, 모든 인증 사용자 접근 가능)
  async function loadTargets(forNotice = false) {
    try {
      const workerEndpoint = forNotice ? '/auth/users' : '/auth/worker-list';
      const [deptRes, workerRes] = await Promise.all([
        api.get<{ data: Dept[] }>('/departments'),
        api.get<{ workers: Worker[] }>(workerEndpoint),
      ]);
      setDepts(deptRes.data || []);
      setWorkers(workerRes.workers || []);
    } catch { toast.error('대상 목록을 불러오지 못했습니다.'); }
  }

  // ── 공지 상세 ────────────────────────────────────────────────────────────
  async function openNoticeDetail(annId: number) {
    setDetailLoading(true);
    setDetailType('notice');
    try {
      const res = await api.get<{ announcement: Announcement; recipients: Receipt[] }>(`/announcements/${annId}`);
      setDetail(res.announcement);
      setReceipts(res.recipients);
      setNotices(prev => prev.map(a => a.announcement_id === annId ? { ...a, is_read: true } : a));
    } catch { toast.error('공지를 불러오지 못했습니다.'); }
    finally { setDetailLoading(false); }
  }

  // ── 쪽지 상세 ────────────────────────────────────────────────────────────
  async function openMsgDetail(msgId: number) {
    setDetailLoading(true);
    setDetailType('message');
    try {
      const res = await api.get<{ message: Message; recipients: Receipt[] }>(`/messages/${msgId}`);
      setDetail(res.message);
      setReceipts(res.recipients);
      setMessages(prev => prev.map(m => m.message_id === msgId ? { ...m, is_read: true } : m));
    } catch { toast.error('쪽지를 불러오지 못했습니다.'); }
    finally { setDetailLoading(false); }
  }

  function closeDetail() { setDetail(null); setReceipts([]); navigate('/announcements'); }

  // ── 공지 작성 ────────────────────────────────────────────────────────────
  async function openComposeNotice() {
    setComposingNotice(true);
    setNoticeTitle(''); setNoticeBody(''); setNoticeTargetType('ALL'); setNoticeTargetIds([]);
    await loadTargets(true);   // manager+ 전용 상세 목록
  }

  async function handleSendNotice() {
    if (!noticeTitle.trim() || !noticeBody.trim()) { toast.error('제목과 내용을 입력하세요.'); return; }
    setSending(true);
    try {
      const res = await api.post<{ ok: boolean; recipient_count: number }>('/announcements', {
        title: noticeTitle.trim(), body: noticeBody.trim(),
        target_type: noticeTargetType, target_ids: noticeTargetIds,
      });
      toast.success(`공지 발송 완료 (${res.recipient_count}명 수신)`);
      setComposingNotice(false);
      loadNotices();
    } catch { toast.error('발송에 실패했습니다.'); }
    finally { setSending(false); }
  }

  // ── 쪽지 작성 ────────────────────────────────────────────────────────────
  async function openComposeMsg() {
    setComposingMsg(true);
    setMsgTitle(''); setMsgBody(''); setMsgTargetType('INDIVIDUAL'); setMsgTargetIds([]);
    await loadTargets(false);  // 모든 인증 사용자 경량 목록
  }

  async function handleSendMsg() {
    if (!msgTitle.trim() || !msgBody.trim()) { toast.error('제목과 내용을 입력하세요.'); return; }
    if (msgTargetIds.length === 0) { toast.error('수신 대상을 선택하세요.'); return; }
    setSending(true);
    try {
      const res = await api.post<{ ok: boolean; recipient_count: number }>('/messages', {
        title: msgTitle.trim(), body: msgBody.trim(),
        target_type: msgTargetType, target_ids: msgTargetIds,
      });
      toast.success(`쪽지 발송 완료 (${res.recipient_count}명 수신)`);
      setComposingMsg(false);
      if (pageTab === 'message') loadMessages();
    } catch { toast.error('발송에 실패했습니다.'); }
    finally { setSending(false); }
  }

  // ── 삭제 ────────────────────────────────────────────────────────────────
  async function handleDeleteNotice(annId: number) {
    if (!confirm('공지를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/announcements/${annId}`);
      toast.success('삭제되었습니다.');
      closeDetail();
      loadNotices();
    } catch { toast.error('삭제에 실패했습니다.'); }
  }

  async function handleDeleteMsg(msgId: number) {
    if (!confirm('쪽지를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/messages/${msgId}`);
      toast.success('삭제되었습니다.');
      closeDetail();
      loadMessages();
    } catch { toast.error('삭제에 실패했습니다.'); }
  }

  // ── 체크박스 토글 ─────────────────────────────────────────────────────────
  function toggleId(id: number, ids: number[], setter: (v: number[]) => void) {
    setter(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }

  // ── 현재 목록 ─────────────────────────────────────────────────────────────
  const currentList = pageTab === 'notice' ? notices : (msgTab === 'inbox' ? messages : sentMessages);
  const unreadNotice = notices.filter(n => !n.is_read).length;
  const unreadMsg = messages.filter(m => !m.is_read).length;

  // ── 공통 작성 모달 렌더링 ────────────────────────────────────────────────
  function renderTargetSelector(
    targetType: 'ALL' | 'DEPT' | 'INDIVIDUAL',
    setTargetType: (v: any) => void,
    targetIds: number[],
    setTargetIds: (v: number[]) => void,
    allowAll: boolean,
  ) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">수신 대상</label>
        <div className="flex gap-2 flex-wrap">
          {allowAll && (
            <button onClick={() => { setTargetType('ALL'); setTargetIds([]); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${targetType === 'ALL' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Users className="h-3 w-3 inline mr-1" />전체
            </button>
          )}
          <button onClick={() => { setTargetType('DEPT'); setTargetIds([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${targetType === 'DEPT' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Building2 className="h-3 w-3 inline mr-1" />부서 지정
          </button>
          <button onClick={() => { setTargetType('INDIVIDUAL'); setTargetIds([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${targetType === 'INDIVIDUAL' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <User className="h-3 w-3 inline mr-1" />개인 지정
          </button>
        </div>

        {targetType === 'DEPT' && depts.length > 0 && (
          <div className="rounded-lg border bg-slate-50 p-2 max-h-40 overflow-y-auto">
            <p className="text-[10px] text-slate-400 mb-1">부서 선택 (다중 가능)</p>
            <div className="space-y-1">
              {depts.map(d => (
                <label key={d.dept_id} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-1 py-0.5">
                  <input type="checkbox" checked={targetIds.includes(d.dept_id)}
                    onChange={() => toggleId(d.dept_id, targetIds, setTargetIds)} className="h-3.5 w-3.5" />
                  <span className="text-xs text-slate-700">{d.dept_name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {targetType === 'INDIVIDUAL' && workers.length > 0 && (
          <div className="rounded-lg border bg-slate-50 p-2 max-h-48 overflow-y-auto">
            <p className="text-[10px] text-slate-400 mb-1">직원 선택 (다중 가능)</p>
            <div className="space-y-1">
              {workers.map(w => (
                <label key={w.worker_id} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-1 py-0.5">
                  <input type="checkbox" checked={targetIds.includes(w.worker_id)}
                    onChange={() => toggleId(w.worker_id, targetIds, setTargetIds)} className="h-3.5 w-3.5" />
                  <span className="text-xs text-slate-700">{w.worker_name}</span>
                  {w.dept_name && <span className="text-[10px] text-slate-400">{w.dept_name}</span>}
                  {w.position && <span className="text-[10px] text-slate-400">· {w.position}</span>}
                </label>
              ))}
            </div>
          </div>
        )}
        {(targetType !== 'ALL') && targetIds.length > 0 && (
          <p className="text-[10px] text-blue-600">{targetIds.length}개 선택됨</p>
        )}
      </div>
    );
  }

  // ── 상세 뷰 ─────────────────────────────────────────────────────────────
  if (detail) {
    const isNotice = detailType === 'notice';
    const ann = detail as any;
    const itemId = isNotice ? ann.announcement_id : ann.message_id;
    return (
      <div className="space-y-4 max-w-2xl">
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ChevronLeft className="h-4 w-4" /> 목록으로
        </button>

        {detailLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
        ) : (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className={`px-6 py-4 border-b ${isNotice ? 'bg-blue-50' : 'bg-purple-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isNotice
                      ? <Megaphone className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      : <MessageSquare className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    }
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isNotice ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {isNotice ? '공지' : '쪽지'}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-800 leading-snug">{ann.title}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {ann.author_name} · <Clock className="h-3 w-3 inline" /> {fmtDate(ann.created_at)}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => isNotice ? handleDeleteNotice(itemId) : handleDeleteMsg(itemId)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 본문 */}
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ann.body}</p>
            </div>

            {/* 수신 현황 */}
            {receipts.length > 0 && (
              <div className="border-t px-6 py-4 bg-slate-50">
                <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> 수신 현황 ({receipts.filter(r => r.is_read).length}/{receipts.length} 읽음)
                </p>
                <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                  {receipts.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${r.is_read ? 'text-slate-500' : 'font-semibold text-slate-800'}`}>
                      {r.is_read ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Circle className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />}
                      {r.worker_name}
                      {r.read_at && <span className="text-[10px] text-slate-400">{fmtDate(r.read_at)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 목록 뷰 ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <Megaphone className="h-5 w-5 text-blue-600" /> 공지 / 쪽지함
        </h1>
        <div className="flex gap-2">
          {/* 쪽지 보내기 — 누구나 */}
          <button onClick={openComposeMsg}
            className="flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors">
            <MessageSquare className="h-4 w-4" /> 쪽지 보내기
          </button>
          {/* 공지 작성 — manager+ */}
          {canWriteNotice && (
            <button onClick={openComposeNotice}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              <Plus className="h-4 w-4" /> 공지 작성
            </button>
          )}
        </div>
      </div>

      {/* 공지/쪽지 탭 */}
      <div className="flex border-b">
        <button onClick={() => setPageTab('notice')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${pageTab === 'notice' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Megaphone className="h-4 w-4" /> 공지함
          {unreadNotice > 0 && <span className="rounded-full bg-red-100 text-red-600 text-[9px] font-bold px-1.5">{unreadNotice}</span>}
        </button>
        <button onClick={() => setPageTab('message')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${pageTab === 'message' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <MessageSquare className="h-4 w-4" /> 쪽지함
          {unreadMsg > 0 && <span className="rounded-full bg-purple-100 text-purple-600 text-[9px] font-bold px-1.5">{unreadMsg}</span>}
        </button>
      </div>

      {/* 쪽지함 하위 탭 (받은쪽지 / 보낸쪽지) */}
      {pageTab === 'message' && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          <button onClick={() => setMsgTab('inbox')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${msgTab === 'inbox' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Inbox className="h-3.5 w-3.5" /> 받은 쪽지
            {unreadMsg > 0 && <span className="rounded-full bg-purple-500 text-white text-[9px] font-bold px-1">{unreadMsg}</span>}
          </button>
          <button onClick={() => setMsgTab('sent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${msgTab === 'sent' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <SendHorizontal className="h-3.5 w-3.5" /> 보낸 쪽지
          </button>
        </div>
      )}

      {/* 목록 */}
      {(pageTab === 'notice' ? noticeLoading : msgLoading) ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
      ) : currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          {pageTab === 'notice' ? <Megaphone className="h-10 w-10 mb-3 text-slate-200" /> : <MessageSquare className="h-10 w-10 mb-3 text-slate-200" />}
          <p className="text-sm">{pageTab === 'notice' ? '공지가 없습니다' : msgTab === 'inbox' ? '받은 쪽지가 없습니다' : '보낸 쪽지가 없습니다'}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {currentList.map((item: any, idx) => {
            const itemId = pageTab === 'notice' ? item.announcement_id : item.message_id;
            const isRead = msgTab === 'sent' ? true : !!item.is_read;
            return (
              <button key={itemId ?? idx}
                onClick={() => {
                  if (pageTab === 'notice') openNoticeDetail(itemId);
                  else openMsgDetail(itemId);
                }}
                className={`w-full text-left px-5 py-4 border-b last:border-0 hover:bg-slate-50 transition-colors ${!isRead ? (pageTab === 'notice' ? 'bg-blue-50/50' : 'bg-purple-50/50') : ''}`}>
                <div className="flex items-start gap-3">
                  {!isRead && <span className={`mt-2 h-1.5 w-1.5 rounded-full flex-shrink-0 ${pageTab === 'notice' ? 'bg-blue-500' : 'bg-purple-500'}`} />}
                  <div className={`flex-1 min-w-0 ${isRead ? 'pl-4' : ''}`}>
                    <div className="flex items-center gap-2 justify-between">
                      <p className={`text-sm truncate ${isRead ? 'text-slate-500' : 'font-semibold text-slate-800'}`}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {msgTab === 'sent' && item.total_recipients != null && (
                          <span className="text-[10px] text-slate-400">
                            {item.read_count}/{item.total_recipients} 읽음
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{fmtDate(item.created_at)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {msgTab === 'sent' ? `수신: ${item.total_recipients ?? 0}명` : item.author_name}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 공지 작성 모달 ──────────────────────────────────────────────── */}
      {composingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-blue-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-blue-600" /> 공지 작성
              </h2>
              <button onClick={() => setComposingNotice(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">제목</label>
                <input value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} placeholder="공지 제목을 입력하세요"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">내용</label>
                <textarea value={noticeBody} onChange={e => setNoticeBody(e.target.value)} rows={5} placeholder="공지 내용을 입력하세요"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
              {renderTargetSelector(noticeTargetType, setNoticeTargetType, noticeTargetIds, setNoticeTargetIds, true)}
            </div>
            <div className="flex gap-2 justify-end px-5 py-4 border-t bg-slate-50">
              <button onClick={() => setComposingNotice(false)} className="px-4 py-2 text-sm rounded-lg border text-slate-600 hover:bg-slate-100">취소</button>
              <button onClick={handleSendNotice} disabled={sending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} 발송
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 쪽지 작성 모달 ──────────────────────────────────────────────── */}
      {composingMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-purple-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-600" /> 쪽지 보내기
                <span className="text-[10px] font-normal text-slate-400 ml-1">누구나 발송 가능</span>
              </h2>
              <button onClick={() => setComposingMsg(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">제목</label>
                <input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="쪽지 제목을 입력하세요"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">내용</label>
                <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={5} placeholder="쪽지 내용을 입력하세요"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
              </div>
              {renderTargetSelector(msgTargetType, setMsgTargetType, msgTargetIds, setMsgTargetIds, false)}
            </div>
            <div className="flex gap-2 justify-end px-5 py-4 border-t bg-slate-50">
              <button onClick={() => setComposingMsg(false)} className="px-4 py-2 text-sm rounded-lg border text-slate-600 hover:bg-slate-100">취소</button>
              <button onClick={handleSendMsg} disabled={sending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-60">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} 보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
