import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { Shield, Plus, Printer, Check, X, UserPlus, Save, Edit2, CheckCircle, AlertTriangle, Clock, Trash2 } from 'lucide-react';

/* ── Types ── */
interface TbmAttendee {
  attendee_id: number;
  tbm_id: number;
  worker_name: string;
  department: string | null;
  is_present: boolean;
  sign_time: string | null;
  remarks: string | null;
}

interface TbmMeeting {
  tbm_id: number;
  meeting_date: string;
  session: string;
  conductor: string;
  safety_topics: string | null;
  work_topics: string | null;
  issue_topics: string | null;
  weather: string | null;
  temperature: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  attendees?: TbmAttendee[];
  attendee_total?: number;
  attendee_present?: number;
}

interface TbmIssue {
  issue_id: number;
  tbm_id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  due_date: string | null;
  meeting_date: string | null;
  session: string | null;
}

interface WorkerOption {
  worker_name: string;
  department: string | null;
}

const weatherOptions = [
  { value: '맑음', icon: '\u2600\uFE0F' },
  { value: '흐림', icon: '\u2601\uFE0F' },
  { value: '비', icon: '\uD83C\uDF27\uFE0F' },
  { value: '눈', icon: '\u2744\uFE0F' },
  { value: '기타', icon: '' },
];

function getWeatherIcon(w: string | null) {
  const found = weatherOptions.find((o) => o.value === w);
  return found ? found.icon : '';
}

/* ── Main Component ── */
export function TbmPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<'AM' | 'PM'>('AM');
  const [meeting, setMeeting] = useState<TbmMeeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Editable fields
  const [editData, setEditData] = useState({
    safety_topics: '', work_topics: '', issue_topics: '',
    weather: '', temperature: '', remarks: '', conductor: '',
  });

  // Attendance local state
  const [attendees, setAttendees] = useState<TbmAttendee[]>([]);
  const [attendeeRemarks, setAttendeeRemarks] = useState<Record<number, string>>({});

  // Add worker inline
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerDept, setNewWorkerDept] = useState('');

  // Issue tracking state
  const [openIssues, setOpenIssues] = useState<TbmIssue[]>([]);
  const [todayIssues, setTodayIssues] = useState<TbmIssue[]>([]);
  const [allIssueStats, setAllIssueStats] = useState({ total: 0, open: 0, inProgress: 0, delayed: 0, resolved: 0 });
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [newIssuePriority, setNewIssuePriority] = useState('보통');
  const [newIssueAssignee, setNewIssueAssignee] = useState('');
  const [newIssueDueDate, setNewIssueDueDate] = useState('');
  const [resolutionInputs, setResolutionInputs] = useState<Record<number, string>>({});

  const fetchIssues = useCallback(async (tbmId?: number) => {
    try {
      // Fetch open issues (carry-forward)
      const openRes = await api.get<{ data: TbmIssue[] }>('/tbm/issues/open');
      setOpenIssues(openRes.data);

      // Fetch today's issues for this TBM
      if (tbmId) {
        const todayRes = await api.get<{ data: TbmIssue[] }>(`/tbm/issues?tbm_id=${tbmId}&status=미해결,진행중,지연,해결`);
        setTodayIssues(todayRes.data);
      } else {
        setTodayIssues([]);
      }

      // Fetch all issues for stats
      const allRes = await api.get<{ data: TbmIssue[] }>('/tbm/issues?status=미해결,진행중,지연,해결');
      const all = allRes.data;
      setAllIssueStats({
        total: all.length,
        open: all.filter((i) => i.status === '미해결').length,
        inProgress: all.filter((i) => i.status === '진행중').length,
        delayed: all.filter((i) => i.status === '지연').length,
        resolved: all.filter((i) => i.status === '해결').length,
      });
    } catch {
      // Issues table may not exist yet
    }
  }, []);

  const fetchMeeting = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: TbmMeeting[] }>(`/tbm?date=${date}`);
      const found = res.data.find((m) => m.session === session);
      if (found) {
        const detail = await api.get<{ data: TbmMeeting }>(`/tbm/${found.tbm_id}`);
        setMeeting(detail.data);
        setAttendees(detail.data.attendees || []);
        setEditData({
          safety_topics: detail.data.safety_topics || '',
          work_topics: detail.data.work_topics || '',
          issue_topics: detail.data.issue_topics || '',
          weather: detail.data.weather || '',
          temperature: detail.data.temperature || '',
          remarks: detail.data.remarks || '',
          conductor: detail.data.conductor || '',
        });
        const rm: Record<number, string> = {};
        (detail.data.attendees || []).forEach((a) => { rm[a.attendee_id] = a.remarks || ''; });
        setAttendeeRemarks(rm);
        fetchIssues(detail.data.tbm_id);
      } else {
        setMeeting(null);
        setAttendees([]);
        fetchIssues();
      }
    } catch {
      setMeeting(null);
    } finally {
      setLoading(false);
    }
  }, [date, session, fetchIssues]);

  useEffect(() => { fetchMeeting(); }, [fetchMeeting]);

  const toggleAttendance = (id: number) => {
    setAttendees((prev) => prev.map((a) =>
      a.attendee_id === id ? { ...a, is_present: !a.is_present } : a
    ));
  };

  const selectAll = (val: boolean) => {
    setAttendees((prev) => prev.map((a) => ({ ...a, is_present: val })));
  };

  const saveAttendance = async () => {
    if (!meeting) return;
    const payload = attendees.map((a) => ({
      attendee_id: a.attendee_id,
      is_present: a.is_present,
      remarks: attendeeRemarks[a.attendee_id] || '',
    }));
    await api.post(`/tbm/${meeting.tbm_id}/attendance`, { attendees: payload });
    await fetchMeeting();
  };

  const saveMeetingEdit = async () => {
    if (!meeting) return;
    await api.patch(`/tbm/${meeting.tbm_id}`, editData);
    setEditMode(false);
    await fetchMeeting();
  };

  const completeMeeting = async () => {
    if (!meeting) return;
    if (!confirm('TBM을 완료 처리하시겠습니까? 완료 후 수정이 불가합니다.')) return;
    await api.patch(`/tbm/${meeting.tbm_id}`, { status: 'COMPLETED' });
    setEditMode(false);
    await fetchMeeting();
  };

  const deleteMeeting = async () => {
    if (!meeting) return;
    if (!confirm('이 TBM을 삭제하시겠습니까?')) return;
    await api.delete(`/tbm/${meeting.tbm_id}`);
    await fetchMeeting();
  };

  const addWorker = async () => {
    if (!meeting || !newWorkerName.trim()) return;
    await api.post(`/tbm/${meeting.tbm_id}/add-worker`, {
      worker_name: newWorkerName.trim(),
      department: newWorkerDept.trim() || undefined,
    });
    setNewWorkerName('');
    setNewWorkerDept('');
    setShowAddWorker(false);
    await fetchMeeting();
  };

  // Issue actions
  const createIssue = async () => {
    if (!meeting || !newIssueTitle.trim()) return;
    await api.post('/tbm/issues', {
      tbm_id: meeting.tbm_id,
      title: newIssueTitle.trim(),
      description: newIssueDesc.trim() || undefined,
      priority: newIssuePriority,
      assigned_to: newIssueAssignee.trim() || undefined,
      due_date: newIssueDueDate || undefined,
    });
    setNewIssueTitle('');
    setNewIssueDesc('');
    setNewIssuePriority('보통');
    setNewIssueAssignee('');
    setNewIssueDueDate('');
    fetchIssues(meeting.tbm_id);
  };

  const updateIssueStatus = async (issueId: number, newStatus: string) => {
    const payload: Record<string, string> = { status: newStatus };
    if (newStatus === '해결' && resolutionInputs[issueId]) {
      payload.resolution = resolutionInputs[issueId];
    }
    await api.patch(`/tbm/issues/${issueId}`, payload);
    if (meeting) fetchIssues(meeting.tbm_id);
  };

  const updateIssueResolution = async (issueId: number) => {
    if (!resolutionInputs[issueId]?.trim()) return;
    await api.patch(`/tbm/issues/${issueId}`, {
      status: '해결',
      resolution: resolutionInputs[issueId].trim(),
    });
    if (meeting) fetchIssues(meeting.tbm_id);
  };

  const deleteIssue = async (issueId: number) => {
    if (!confirm('이 이슈를 삭제하시겠습니까?')) return;
    await api.delete(`/tbm/issues/${issueId}`);
    if (meeting) fetchIssues(meeting.tbm_id);
  };

  const getDaysSince = (dateStr: string) => {
    const created = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Issues that are open but NOT from today's TBM (carried forward)
  const carriedIssues = meeting
    ? openIssues.filter((i) => i.tbm_id !== meeting.tbm_id)
    : openIssues;

  const presentCount = attendees.filter((a) => a.is_present).length;
  const totalCount = attendees.length;
  const isCompleted = meeting?.status === 'COMPLETED';

  return (
    <div>
      <PageHeader title="TBM (작업 전 안전회의)" description="일일 안전교육 및 참석자 관리">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border rounded-md text-shop-sm"
        />
        <div className="flex rounded-md overflow-hidden border">
          <button
            onClick={() => setSession('AM')}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium transition-colors',
              session === 'AM' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            AM (오전)
          </button>
          <button
            onClick={() => setSession('PM')}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium transition-colors',
              session === 'PM' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            PM (오후)
          </button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="text-center py-20 text-gray-400">불러오는 중...</div>
      ) : !meeting ? (
        /* Empty State */
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <Shield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">
            {date} {session} TBM이 아직 작성되지 않았습니다.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> 새 TBM 작성
          </button>
        </div>
      ) : (
        /* Main View */
        <div>
          {/* Status + Actions Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={cn(
                'inline-flex items-center gap-1 px-3 py-1 rounded-full text-shop-sm font-medium',
                session === 'AM' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
              )}>
                {session === 'AM' ? 'AM (오전)' : 'PM (오후)'}
              </span>
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-shop-sm font-medium bg-green-100 text-green-700">
                  <CheckCircle className="h-3.5 w-3.5" /> 완료
                  {meeting.completed_at && ` (${new Date(meeting.completed_at).toLocaleString('ko-KR')})`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-shop-sm font-medium bg-yellow-100 text-yellow-700">
                  작성중
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/production/tbm-print/${meeting.tbm_id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-shop-sm border rounded-md hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" /> 인쇄
              </button>
              {!isCompleted && (
                <>
                  <button
                    onClick={completeMeeting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-shop-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" /> 완료 처리
                  </button>
                  <button
                    onClick={deleteMeeting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-shop-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Meeting Content */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">회의 내용</h2>
                {!isCompleted && (
                  <button
                    onClick={() => { if (editMode) saveMeetingEdit(); else setEditMode(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-shop-sm border rounded-md hover:bg-gray-50"
                  >
                    {editMode ? <><Save className="h-4 w-4" /> 저장</> : <><Edit2 className="h-4 w-4" /> 수정</>}
                  </button>
                )}
              </div>

              {/* Conductor + Weather */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-shop-sm text-gray-500 block mb-1">진행자</label>
                  {editMode ? (
                    <input
                      value={editData.conductor}
                      onChange={(e) => setEditData({ ...editData, conductor: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-shop-sm"
                    />
                  ) : (
                    <p className="font-medium">{meeting.conductor}</p>
                  )}
                </div>
                <div>
                  <label className="text-shop-sm text-gray-500 block mb-1">날씨 / 기온</label>
                  {editMode ? (
                    <div className="flex gap-2">
                      <select
                        value={editData.weather}
                        onChange={(e) => setEditData({ ...editData, weather: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-md text-shop-sm"
                      >
                        <option value="">선택</option>
                        {weatherOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.icon} {o.value}</option>
                        ))}
                      </select>
                      <input
                        value={editData.temperature}
                        onChange={(e) => setEditData({ ...editData, temperature: e.target.value })}
                        placeholder="15℃"
                        className="w-20 px-3 py-2 border rounded-md text-shop-sm"
                      />
                    </div>
                  ) : (
                    <p className="font-medium">
                      {getWeatherIcon(meeting.weather)} {meeting.weather || '-'} / {meeting.temperature || '-'}
                    </p>
                  )}
                </div>
              </div>

              {/* Topics */}
              <TopicSection
                label="안전사항"
                value={editMode ? editData.safety_topics : meeting.safety_topics}
                editMode={editMode}
                onChange={(v) => setEditData({ ...editData, safety_topics: v })}
                color="text-red-600"
              />
              <TopicSection
                label="작업내용"
                value={editMode ? editData.work_topics : meeting.work_topics}
                editMode={editMode}
                onChange={(v) => setEditData({ ...editData, work_topics: v })}
                color="text-blue-600"
              />
              <TopicSection
                label="이슈사항 / 특이사항"
                value={editMode ? editData.issue_topics : meeting.issue_topics}
                editMode={editMode}
                onChange={(v) => setEditData({ ...editData, issue_topics: v })}
                color="text-amber-600"
              />
              <TopicSection
                label="비고"
                value={editMode ? editData.remarks : meeting.remarks}
                editMode={editMode}
                onChange={(v) => setEditData({ ...editData, remarks: v })}
                color="text-gray-600"
              />
            </div>

            {/* Right Column - Attendance */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">참석자 현황</h2>
                {!isCompleted && (
                  <button
                    onClick={() => setShowAddWorker(!showAddWorker)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-shop-sm border rounded-md hover:bg-gray-50"
                  >
                    <UserPlus className="h-4 w-4" /> 작업자 추가
                  </button>
                )}
              </div>

              {/* Summary bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-shop-sm text-gray-600">
                    출석 <span className="font-bold text-green-600">{presentCount}</span> / {totalCount}명
                  </span>
                  <span className="text-shop-sm text-gray-400">
                    {totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${totalCount > 0 ? (presentCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Select all / deselect */}
              {!isCompleted && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => selectAll(true)}
                    className="px-3 py-1 text-xs border rounded hover:bg-green-50 text-green-600 border-green-200"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={() => selectAll(false)}
                    className="px-3 py-1 text-xs border rounded hover:bg-gray-50 text-gray-500"
                  >
                    전체 해제
                  </button>
                </div>
              )}

              {/* Add Worker Inline */}
              {showAddWorker && (
                <div className="flex gap-2 mb-3 p-3 bg-gray-50 rounded-md">
                  <input
                    value={newWorkerName}
                    onChange={(e) => setNewWorkerName(e.target.value)}
                    placeholder="이름"
                    className="flex-1 px-3 py-1.5 border rounded text-shop-sm"
                  />
                  <input
                    value={newWorkerDept}
                    onChange={(e) => setNewWorkerDept(e.target.value)}
                    placeholder="부서"
                    className="w-24 px-3 py-1.5 border rounded text-shop-sm"
                  />
                  <button onClick={addWorker} className="px-3 py-1.5 bg-blue-600 text-white rounded text-shop-sm hover:bg-blue-700">
                    추가
                  </button>
                </div>
              )}

              {/* Attendee List */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {attendees.map((att) => (
                  <div
                    key={att.attendee_id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-md border transition-colors',
                      att.is_present ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    )}
                  >
                    <button
                      onClick={() => !isCompleted && toggleAttendance(att.attendee_id)}
                      disabled={isCompleted}
                      className={cn(
                        'flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
                        att.is_present
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400',
                        isCompleted && 'cursor-default'
                      )}
                    >
                      {att.is_present && <Check className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-shop-sm">{att.worker_name}</span>
                        {att.department && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                            {att.department}
                          </span>
                        )}
                      </div>
                      {att.sign_time && (
                        <span className="text-xs text-gray-400">
                          {new Date(att.sign_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {!isCompleted ? (
                      <input
                        value={attendeeRemarks[att.attendee_id] || ''}
                        onChange={(e) => setAttendeeRemarks({ ...attendeeRemarks, [att.attendee_id]: e.target.value })}
                        placeholder="비고"
                        className="w-28 px-2 py-1 border rounded text-xs"
                      />
                    ) : (
                      att.remarks && <span className="text-xs text-gray-500">{att.remarks}</span>
                    )}
                  </div>
                ))}
                {attendees.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-shop-sm">등록된 작업자가 없습니다.</p>
                )}
              </div>

              {/* Save attendance */}
              {!isCompleted && attendees.length > 0 && (
                <button
                  onClick={saveAttendance}
                  className="mt-4 w-full py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-shop-sm inline-flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" /> 참석 저장
                </button>
              )}
            </div>
          </div>

          {/* ── Issue Management Section ── */}
          <div className="mt-6 bg-white rounded-lg border p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold">이슈 관리</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  {openIssues.length}건
                </span>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-4 mb-4 px-3 py-2 bg-gray-50 rounded-md text-shop-sm">
              <span>전체 <strong>{allIssueStats.total}</strong>건</span>
              <span className="text-gray-300">|</span>
              <span className="text-red-600">미해결 <strong>{allIssueStats.open}</strong></span>
              <span className="text-gray-300">|</span>
              <span className="text-blue-600">진행중 <strong>{allIssueStats.inProgress}</strong></span>
              <span className="text-gray-300">|</span>
              <span className="text-orange-600">지연 <strong>{allIssueStats.delayed}</strong></span>
              <span className="text-gray-300">|</span>
              <span className="text-green-600">해결 <strong>{allIssueStats.resolved}</strong></span>
            </div>

            {/* Carried Forward Issues */}
            {carriedIssues.length > 0 && (
              <div className="mb-6">
                <h3 className="text-shop-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> 이전 TBM 이월 이슈
                </h3>
                <div className="space-y-2">
                  {carriedIssues.map((issue) => (
                    <IssueCard
                      key={issue.issue_id}
                      issue={issue}
                      onStatusChange={updateIssueStatus}
                      onDelete={deleteIssue}
                      onResolve={updateIssueResolution}
                      resolutionValue={resolutionInputs[issue.issue_id] || ''}
                      onResolutionChange={(v) => setResolutionInputs({ ...resolutionInputs, [issue.issue_id]: v })}
                      getDaysSince={getDaysSince}
                      disabled={isCompleted}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Today's Issues */}
            {todayIssues.length > 0 && (
              <div className="mb-6">
                <h3 className="text-shop-sm font-medium text-gray-500 mb-2">
                  오늘 등록된 이슈
                </h3>
                <div className="space-y-2">
                  {todayIssues.map((issue) => (
                    <IssueCard
                      key={issue.issue_id}
                      issue={issue}
                      onStatusChange={updateIssueStatus}
                      onDelete={deleteIssue}
                      onResolve={updateIssueResolution}
                      resolutionValue={resolutionInputs[issue.issue_id] || ''}
                      onResolutionChange={(v) => setResolutionInputs({ ...resolutionInputs, [issue.issue_id]: v })}
                      getDaysSince={getDaysSince}
                      disabled={isCompleted}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Add Issue */}
            {!isCompleted && (
              <div className="border-t pt-4">
                <h3 className="text-shop-sm font-medium text-gray-500 mb-3">이슈 등록</h3>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={newIssueTitle}
                      onChange={(e) => setNewIssueTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newIssueTitle.trim()) createIssue(); }}
                      placeholder="이슈 제목 (Enter로 빠른 등록)"
                      className="flex-1 px-3 py-2 border rounded-md text-shop-sm"
                    />
                    <select
                      value={newIssuePriority}
                      onChange={(e) => setNewIssuePriority(e.target.value)}
                      className="w-24 px-2 py-2 border rounded-md text-shop-sm"
                    >
                      <option value="높음">높음</option>
                      <option value="보통">보통</option>
                      <option value="낮음">낮음</option>
                    </select>
                    <button
                      onClick={createIssue}
                      disabled={!newIssueTitle.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-shop-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> 등록
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newIssueDesc}
                      onChange={(e) => setNewIssueDesc(e.target.value)}
                      placeholder="상세 설명 (선택)"
                      className="flex-1 px-3 py-2 border rounded-md text-shop-sm"
                    />
                    <input
                      value={newIssueAssignee}
                      onChange={(e) => setNewIssueAssignee(e.target.value)}
                      placeholder="담당자"
                      className="w-28 px-3 py-2 border rounded-md text-shop-sm"
                    />
                    <input
                      type="date"
                      value={newIssueDueDate}
                      onChange={(e) => setNewIssueDueDate(e.target.value)}
                      className="w-36 px-3 py-2 border rounded-md text-shop-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {carriedIssues.length === 0 && todayIssues.length === 0 && (
              <p className="text-center text-gray-400 py-4 text-shop-sm">등록된 이슈가 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTbmModal
          defaultDate={date}
          defaultSession={session}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchMeeting(); }}
        />
      )}
    </div>
  );
}

/* ── Topic Section ── */
function TopicSection({ label, value, editMode, onChange, color }: {
  label: string; value: string | null; editMode: boolean;
  onChange: (v: string) => void; color: string;
}) {
  return (
    <div className="mb-4">
      <label className={cn('text-shop-sm font-medium block mb-1', color)}>{label}</label>
      {editMode ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-md text-shop-sm resize-none"
        />
      ) : (
        <div className="text-shop-sm whitespace-pre-line bg-gray-50 rounded-md p-3 min-h-[40px]">
          {value || <span className="text-gray-300">-</span>}
        </div>
      )}
    </div>
  );
}

/* ── Issue Card ── */
const issueStatusColors: Record<string, string> = {
  '미해결': 'border-l-red-500 bg-red-50/50',
  '진행중': 'border-l-blue-500 bg-blue-50/50',
  '지연': 'border-l-orange-500 bg-orange-50/50',
  '해결': 'border-l-green-500 bg-green-50/50',
};

const priorityBadge: Record<string, string> = {
  '높음': 'bg-red-100 text-red-700',
  '보통': 'bg-yellow-100 text-yellow-700',
  '낮음': 'bg-gray-100 text-gray-500',
};

function IssueCard({ issue, onStatusChange, onDelete, onResolve, resolutionValue, onResolutionChange, getDaysSince, disabled }: {
  issue: TbmIssue;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  onResolve: (id: number) => void;
  resolutionValue: string;
  onResolutionChange: (v: string) => void;
  getDaysSince: (d: string) => number;
  disabled: boolean;
}) {
  const days = getDaysSince(issue.created_at);
  const [showResolution, setShowResolution] = useState(false);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === '해결') {
      setShowResolution(true);
    } else {
      onStatusChange(issue.issue_id, newStatus);
    }
  };

  return (
    <div className={cn(
      'border-l-4 border rounded-md p-3 transition-colors',
      issueStatusColors[issue.status] || 'border-l-gray-300'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', priorityBadge[issue.priority])}>
              {issue.priority}
            </span>
            <span className="font-medium text-shop-sm truncate">{issue.title}</span>
          </div>
          {issue.description && (
            <p className="text-xs text-gray-500 mb-1">{issue.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {issue.assigned_to && <span>담당: {issue.assigned_to}</span>}
            <span>{new Date(issue.created_at).toLocaleDateString('ko-KR')}</span>
            {days > 0 && <span className={cn('font-medium', days >= 3 ? 'text-red-500' : 'text-orange-500')}>D+{days}</span>}
            {issue.due_date && (
              <span>기한: {new Date(issue.due_date).toLocaleDateString('ko-KR')}</span>
            )}
          </div>
          {issue.status === '해결' && issue.resolution && (
            <p className="text-xs text-green-700 mt-1 bg-green-50 px-2 py-1 rounded">해결: {issue.resolution}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!disabled && (
            <>
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={cn(
                  'px-2 py-1 border rounded text-xs font-medium',
                  issue.status === '미해결' && 'text-red-600',
                  issue.status === '진행중' && 'text-blue-600',
                  issue.status === '지연' && 'text-orange-600',
                  issue.status === '해결' && 'text-green-600',
                )}
              >
                <option value="미해결">미해결</option>
                <option value="진행중">진행중</option>
                <option value="지연">지연</option>
                <option value="해결">해결</option>
              </select>
              <button
                onClick={() => onDelete(issue.issue_id)}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {disabled && (
            <span className={cn(
              'px-2 py-1 rounded text-xs font-medium',
              issue.status === '미해결' && 'text-red-600 bg-red-50',
              issue.status === '진행중' && 'text-blue-600 bg-blue-50',
              issue.status === '지연' && 'text-orange-600 bg-orange-50',
              issue.status === '해결' && 'text-green-600 bg-green-50',
            )}>
              {issue.status}
            </span>
          )}
        </div>
      </div>
      {showResolution && !disabled && (
        <div className="flex gap-2 mt-2 pt-2 border-t">
          <input
            value={resolutionValue}
            onChange={(e) => onResolutionChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { onResolve(issue.issue_id); setShowResolution(false); } }}
            placeholder="해결 내용을 입력하세요"
            className="flex-1 px-2 py-1 border rounded text-xs"
            autoFocus
          />
          <button
            onClick={() => { onResolve(issue.issue_id); setShowResolution(false); }}
            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
          >
            해결
          </button>
          <button
            onClick={() => setShowResolution(false)}
            className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Create Modal ── */
function CreateTbmModal({ defaultDate, defaultSession, onClose, onCreated }: {
  defaultDate: string; defaultSession: string;
  onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    meeting_date: defaultDate,
    session: defaultSession,
    conductor: '',
    weather: '',
    temperature: '',
    safety_topics: '안전모 착용 확인\n보호장갑 착용 확인\n작업장 정리정돈\n장비 점검 확인',
    work_topics: '',
    issue_topics: '',
  });
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ data: WorkerOption[] }>('/tbm/workers').then((res) => {
      setWorkers(res.data);
      setSelectedWorkers(new Set(res.data.map((w) => `${w.worker_name}|${w.department || ''}`)));
    }).catch(() => {});
  }, []);

  const toggleWorker = (key: string) => {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.conductor.trim()) { alert('진행자를 입력해주세요.'); return; }
    setSubmitting(true);
    try {
      const workerList = Array.from(selectedWorkers).map((key) => {
        const [name, dept] = key.split('|');
        return { worker_name: name, department: dept || undefined };
      });
      await api.post('/tbm', { ...form, workers: workerList });
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '생성 실패';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">새 TBM 작성</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Date + Session */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-shop-sm font-medium block mb-1">일자</label>
              <input
                type="date"
                value={form.meeting_date}
                onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-shop-sm"
              />
            </div>
            <div>
              <label className="text-shop-sm font-medium block mb-1">시간대</label>
              <div className="flex gap-2">
                {(['AM', 'PM'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, session: s })}
                    className={cn(
                      'flex-1 py-2 rounded-md text-shop-sm font-medium border transition-colors',
                      form.session === s
                        ? s === 'AM' ? 'bg-amber-500 text-white border-amber-500' : 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conductor + Weather */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-shop-sm font-medium block mb-1">진행자</label>
              <input
                value={form.conductor}
                onChange={(e) => setForm({ ...form, conductor: e.target.value })}
                placeholder="이름"
                className="w-full px-3 py-2 border rounded-md text-shop-sm"
              />
            </div>
            <div>
              <label className="text-shop-sm font-medium block mb-1">날씨</label>
              <select
                value={form.weather}
                onChange={(e) => setForm({ ...form, weather: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-shop-sm"
              >
                <option value="">선택</option>
                {weatherOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.icon} {o.value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-shop-sm font-medium block mb-1">기온</label>
              <input
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                placeholder="15℃"
                className="w-full px-3 py-2 border rounded-md text-shop-sm"
              />
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="text-shop-sm font-medium block mb-1">안전사항</label>
            <textarea
              value={form.safety_topics}
              onChange={(e) => setForm({ ...form, safety_topics: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md text-shop-sm resize-none"
            />
          </div>
          <div>
            <label className="text-shop-sm font-medium block mb-1">작업내용</label>
            <textarea
              value={form.work_topics}
              onChange={(e) => setForm({ ...form, work_topics: e.target.value })}
              rows={3}
              placeholder="오늘 작업 계획을 입력하세요"
              className="w-full px-3 py-2 border rounded-md text-shop-sm resize-none"
            />
          </div>
          <div>
            <label className="text-shop-sm font-medium block mb-1">이슈사항 / 특이사항</label>
            <textarea
              value={form.issue_topics}
              onChange={(e) => setForm({ ...form, issue_topics: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-md text-shop-sm resize-none"
            />
          </div>

          {/* Workers */}
          <div>
            <label className="text-shop-sm font-medium block mb-2">
              참석 대상자 ({selectedWorkers.size}명 선택)
            </label>
            {workers.length > 0 ? (
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
                {workers.map((w) => {
                  const key = `${w.worker_name}|${w.department || ''}`;
                  return (
                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedWorkers.has(key)}
                        onChange={() => toggleWorker(key)}
                        className="rounded"
                      />
                      <span className="text-shop-sm">{w.worker_name}</span>
                      {w.department && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{w.department}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-shop-sm text-gray-400">이전 TBM 기록이 없습니다. 생성 후 작업자를 추가하세요.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-shop-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '생성 중...' : '작성'}
          </button>
        </div>
      </div>
    </div>
  );
}
