import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { ArrowLeft, Printer } from 'lucide-react';

interface TbmAttendee {
  attendee_id: number;
  worker_name: string;
  department: string | null;
  is_present: boolean;
  sign_time: string | null;
  remarks: string | null;
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
  completed_at: string | null;
  attendees: TbmAttendee[];
}

export function TbmPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<TbmMeeting | null>(null);
  const [issues, setIssues] = useState<TbmIssue[]>([]);

  useEffect(() => {
    if (id) {
      api.get<{ data: TbmMeeting }>(`/tbm/${id}`).then((res) => setMeeting(res.data));
      // Fetch open issues at the time of this TBM + issues from this TBM
      api.get<{ data: TbmIssue[] }>('/tbm/issues/open').then((res) => {
        setIssues(res.data);
      }).catch(() => {});
    }
  }, [id]);

  if (!meeting) {
    return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;
  }

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일`;
  };

  return (
    <div>
      {/* Navigation - hidden on print */}
      <div className="print:hidden flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" /> 돌아가기
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium shadow-sm transition-colors"
        >
          📄 PDF 변환 및 출력
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 bg-white text-gray-700"
        >
          <Printer className="h-4 w-4" /> 인쇄
        </button>
      </div>

      {/* Print Content */}
      <div className="max-w-[800px] mx-auto bg-white p-8 print:p-0 print:max-w-none">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold mb-1">(주) 이지원</h1>
          <h2 className="text-lg font-semibold">TBM 일일안전교육 기록</h2>
        </div>

        {/* Approval Stamps */}
        <div className="flex justify-end mb-4">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-4 py-1 bg-gray-50 font-medium">작성자</th>
                <th className="border px-4 py-1 bg-gray-50 font-medium">검토자</th>
                <th className="border px-4 py-1 bg-gray-50 font-medium">승인자</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-4 py-4 h-12 w-20"></td>
                <td className="border px-4 py-4 h-12 w-20"></td>
                <td className="border px-4 py-4 h-12 w-20"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Meeting Info Table */}
        <table className="w-full border-collapse text-sm mb-4">
          <tbody>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-medium w-24">일시</td>
              <td className="border px-3 py-2 w-1/3">
                {formatDate(meeting.meeting_date)} {meeting.session === 'AM' ? '오전' : '오후'}
              </td>
              <td className="border px-3 py-2 bg-gray-50 font-medium w-24">진행자</td>
              <td className="border px-3 py-2">{meeting.conductor}</td>
            </tr>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-medium">날씨</td>
              <td className="border px-3 py-2">{meeting.weather || '-'}</td>
              <td className="border px-3 py-2 bg-gray-50 font-medium">기온</td>
              <td className="border px-3 py-2">{meeting.temperature || '-'}</td>
            </tr>
          </tbody>
        </table>

        {/* Safety Topics */}
        <table className="w-full border-collapse text-sm mb-4">
          <tbody>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-medium w-24 align-top">안전사항</td>
              <td className="border px-3 py-2 whitespace-pre-line min-h-[60px]">
                {meeting.safety_topics || '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Work Topics */}
        <table className="w-full border-collapse text-sm mb-4">
          <tbody>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-medium w-24 align-top">작업내용</td>
              <td className="border px-3 py-2 whitespace-pre-line min-h-[60px]">
                {meeting.work_topics || '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Issue Topics */}
        <table className="w-full border-collapse text-sm mb-4">
          <tbody>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-medium w-24 align-top">이슈사항</td>
              <td className="border px-3 py-2 whitespace-pre-line min-h-[60px]">
                {meeting.issue_topics || '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Remarks */}
        {meeting.remarks && (
          <table className="w-full border-collapse text-sm mb-4">
            <tbody>
              <tr>
                <td className="border px-3 py-2 bg-gray-50 font-medium w-24 align-top">비고</td>
                <td className="border px-3 py-2 whitespace-pre-line">{meeting.remarks}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Attendance Table */}
        <h3 className="text-sm font-semibold mb-2 mt-6">참석자 명단</h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-3 py-2 w-12">No</th>
              <th className="border px-3 py-2">성명</th>
              <th className="border px-3 py-2 w-24">부서</th>
              <th className="border px-3 py-2 w-20">참석여부</th>
              <th className="border px-3 py-2 w-28">서명시간</th>
              <th className="border px-3 py-2">비고</th>
            </tr>
          </thead>
          <tbody>
            {meeting.attendees.map((att, idx) => (
              <tr key={att.attendee_id}>
                <td className="border px-3 py-2 text-center">{idx + 1}</td>
                <td className="border px-3 py-2">{att.worker_name}</td>
                <td className="border px-3 py-2 text-center">{att.department || '-'}</td>
                <td className="border px-3 py-2 text-center">
                  {att.is_present ? 'O' : 'X'}
                </td>
                <td className="border px-3 py-2 text-center">
                  {att.sign_time
                    ? new Date(att.sign_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                    : '-'}
                </td>
                <td className="border px-3 py-2">{att.remarks || ''}</td>
              </tr>
            ))}
            {meeting.attendees.length === 0 && (
              <tr>
                <td colSpan={6} className="border px-3 py-4 text-center text-gray-400">
                  등록된 참석자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Issues Table */}
        {issues.length > 0 && (
          <>
            <h3 className="text-sm font-semibold mb-2 mt-6">이슈 현황</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-3 py-2 w-12">No</th>
                  <th className="border px-3 py-2">이슈</th>
                  <th className="border px-3 py-2 w-20">우선순위</th>
                  <th className="border px-3 py-2 w-20">상태</th>
                  <th className="border px-3 py-2 w-20">담당자</th>
                  <th className="border px-3 py-2 w-24">등록일</th>
                  <th className="border px-3 py-2 w-16">경과일</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue, idx) => {
                  const days = Math.floor((new Date().getTime() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={issue.issue_id}>
                      <td className="border px-3 py-2 text-center">{idx + 1}</td>
                      <td className="border px-3 py-2">
                        {issue.title}
                        {issue.description && <span className="text-gray-400 text-xs ml-1">- {issue.description}</span>}
                      </td>
                      <td className="border px-3 py-2 text-center">{issue.priority}</td>
                      <td className="border px-3 py-2 text-center">{issue.status}</td>
                      <td className="border px-3 py-2 text-center">{issue.assigned_to || '-'}</td>
                      <td className="border px-3 py-2 text-center">
                        {new Date(issue.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="border px-3 py-2 text-center">
                        {days > 0 ? `D+${days}` : 'D-Day'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400 print:text-gray-600">
          {meeting.status === 'COMPLETED' && meeting.completed_at && (
            <p>완료일시: {new Date(meeting.completed_at).toLocaleString('ko-KR')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
