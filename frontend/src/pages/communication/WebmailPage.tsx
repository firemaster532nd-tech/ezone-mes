import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Mail, Send, RefreshCw, Inbox, CheckCircle2, Clock, User, AlertCircle, ArrowLeftRight } from 'lucide-react';

interface MailItem {
  mail_id: number;
  sender_name: string;
  sender_email: string;
  recipient_name?: string;
  recipient_email?: string;
  subject: string;
  body: string;
  is_read: boolean;
  received_at: string;
}

export function WebmailPage() {
  const [mails, setMails] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null);

  // 작성 모달 상태
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchMails();
  }, []);

  const fetchMails = async () => {
    try {
      setLoading(true);
      const res = await api.get<any>('/webmail');
      const list = res.data || res || [];
      if (Array.isArray(list)) {
        setMails(list);
      }
    } catch (e) {
      console.error('Failed to load webmail', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMail = async (m: MailItem) => {
    setSelectedMail(m);
    if (!m.is_read) {
      try {
        await api.patch(`/webmail/${m.mail_id}/read`, {});
        setMails(prev => prev.map(item => item.mail_id === m.mail_id ? { ...item, is_read: true } : item));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail) {
      alert('수신자 이메일 주소를 입력해주세요.');
      return;
    }
    setSending(true);
    try {
      const res = await api.post<any>('/webmail/send', {
        recipient_email: recipientEmail,
        subject: subject || '[이지원 MES] 업무 안내',
        body_text: bodyText,
      });

      alert(`✅ ${res.message || '구글 메일이 성공적으로 실시간 발송되었습니다!'}`);
      setIsComposeOpen(false);
      setRecipientEmail('');
      setSubject('');
      setBodyText('');
      fetchMails();
    } catch (e: any) {
      alert(`❌ 메일 발송 실패: ${e.message || '서버 오류'}`);
    } finally {
      setSending(false);
    }
  };

  const handleReply = (m: MailItem) => {
    setRecipientEmail(m.sender_email);
    setSubject(`Re: ${m.subject}`);
    setBodyText(`\n\n-------------------------\n원본 메일 내용 (${m.received_at?.slice(0, 10)})\n발신자: ${m.sender_name} <${m.sender_email}>\n\n${m.body}`);
    setSelectedMail(null);
    setIsComposeOpen(true);
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full w-fit mb-1 border border-emerald-200">
            Gmail IMAP / SMTP 실시간 연동 (firemaster532nd@gmail.com)
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Mail className="w-7 h-7 mr-2 text-emerald-600" />
            구글 웹메일 (Webmail)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            외부 고객사 및 파트너사 업무 이메일 실시간 수신 및 구글 메일 발송
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMails}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Send className="w-4 h-4" />
            ✉️ 메일 작성 및 발송
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-sm text-slate-800">수신함 (전체 {mails.length}건)</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">firemaster532nd@gmail.com</span>
        </div>

        {mails.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            수신된 이메일이 없습니다. [새로고침] 버튼을 눌러 메일을 확인해 보세요.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {mails.map(m => (
              <div
                key={m.mail_id}
                onClick={() => handleSelectMail(m)}
                className={`p-4 hover:bg-emerald-50/40 transition cursor-pointer flex flex-wrap items-center justify-between gap-4 ${
                  !m.is_read ? 'bg-emerald-50/20 font-bold' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-[200px]">
                  <span className={`w-2.5 h-2.5 rounded-full ${!m.is_read ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{m.sender_name}</div>
                    <div className="text-xs text-slate-400 font-mono">{m.sender_email}</div>
                  </div>
                </div>

                <div className="flex-1 min-w-[300px]">
                  <div className="text-sm font-semibold text-slate-800 truncate">{m.subject}</div>
                  <div className="text-xs text-slate-500 truncate mt-0.5 max-w-xl">{m.body?.slice(0, 100)}</div>
                </div>

                <div className="text-xs text-slate-400 font-mono text-right flex-shrink-0">
                  {m.received_at?.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 📖 메일 상세 읽기 모달 */}
      {selectedMail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-600" />
                이메일 상세 보기
              </h3>
              <button
                onClick={() => setSelectedMail(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">발신자:</span>
                <span className="font-bold text-slate-900">{selectedMail.sender_name} &lt;{selectedMail.sender_email}&gt;</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">수신일시:</span>
                <span className="font-mono text-slate-700">{selectedMail.received_at?.slice(0, 19).replace('T', ' ')}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <span className="text-slate-500 font-semibold block mb-1">제목:</span>
                <span className="text-sm font-bold text-blue-900">{selectedMail.subject}</span>
              </div>
            </div>

            <div className="border rounded-xl p-4 bg-white min-h-[160px] text-xs font-sans text-slate-800 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
              {selectedMail.body}
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedMail(null)}
                className="px-4 py-2 border rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => handleReply(selectedMail)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
              >
                <ArrowLeftRight className="w-4 h-4" />
                답장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✉️ 구글 메일 작성 모달 */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                구글 메일(Gmail) 실시간 작성 및 발송
              </h3>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendMail} className="space-y-3 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 font-medium">
                <p><strong>발신 계정:</strong> firemaster532nd@gmail.com (이지원 MES 통합계정)</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">수신자 이메일 주소</label>
                <input
                  type="email"
                  required
                  placeholder="client@company.com"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">메일 제목</label>
                <input
                  type="text"
                  required
                  placeholder="[이지원 MES] 내화채움구조 견적 및 납품 안내"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">메일 본문 내용</label>
                <textarea
                  required
                  rows={6}
                  placeholder="안녕하세요, (주)이지원 MES 업무 안내드립니다..."
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2 border rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sending ? '구글 메일 전송 중...' : '🚀 구글 메일 실시간 발송'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
