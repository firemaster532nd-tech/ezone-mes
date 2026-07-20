import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, MessageSquare, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

interface AnnouncementPreview {
  announcement_id: number;
  title: string;
  author_name: string;
  created_at: string;
  is_read: boolean;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<AnnouncementPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 미읽음 카운트 — 30초 폴링
  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, []);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function fetchCount() {
    try {
      // 공지+쪽지 합산 미읽음 (백엔드가 통합 카운트 반환)
      const res = await api.get<{ count: number }>('/announcements/unread-count');
      setUnread(res.count);
    } catch { /* 무시 */ }
  }

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      // 공지 최신 5건 + 쪽지 최신 3건 병렬 조회
      const [noticeRes, msgRes] = await Promise.all([
        api.get<{ announcements: AnnouncementPreview[] }>('/announcements'),
        api.get<{ messages: AnnouncementPreview[] }>('/messages').catch(() => ({ messages: [] })),
      ]);
      const noticeItems = (noticeRes.announcements || []).slice(0, 4).map(a => ({ ...a, _type: 'notice' as const }));
      const msgItems = ((msgRes as any).messages || []).slice(0, 3).map((m: any) => ({
        announcement_id: m.message_id,
        title: m.title,
        author_name: m.author_name,
        created_at: m.created_at,
        is_read: m.is_read,
        _type: 'message' as const,
      }));
      setRecent([...msgItems, ...noticeItems].slice(0, 5));
      await fetchCount();
    } catch { /* 무시 */ } finally {
      setLoading(false);
    }
  }

  function goToAnnouncements() {
    setOpen(false);
    navigate('/announcements');
  }

  return (
    <div className="relative" ref={ref}>
      {/* 벨 버튼 */}
      <button
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
        title="공지/쪽지함"
      >
        <Bell className="h-4.5 w-4.5 text-slate-500" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm animate-in zoom-in-50 duration-150">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-700">공지 / 쪽지함</span>
              {unread > 0 && (
                <span className="rounded-full bg-red-100 text-red-600 text-[9px] font-bold px-1.5 py-0.5">
                  미읽음 {unread}
                </span>
              )}
            </div>
          </div>

          {/* 목록 */}
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">불러오는 중...</div>
            ) : recent.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Bell className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                받은 공지가 없습니다
              </div>
            ) : (
              recent.map(ann => (
                <button
                  key={`${(ann as any)._type}-${ann.announcement_id}`}
                  onClick={() => { setOpen(false); navigate(`/announcements/${ann.announcement_id}`); }}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${!ann.is_read ? ((ann as any)._type === 'message' ? 'bg-purple-50/40' : 'bg-blue-50/40') : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {(ann as any)._type === 'message'
                      ? <MessageSquare className="mt-0.5 h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                      : <Megaphone className="mt-0.5 h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    }
                    {!ann.is_read && (
                      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${(ann as any)._type === 'message' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                    )}
                    <div className={`flex-1 min-w-0 ${ann.is_read ? '' : ''}`}>
                      <p className={`text-xs truncate ${ann.is_read ? 'text-slate-500' : 'font-semibold text-slate-800'}`}>
                        {ann.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {ann.author_name} · {new Date(ann.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 전체보기 버튼 */}
          <button
            onClick={goToAnnouncements}
            className="w-full flex items-center justify-center gap-1 py-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-100"
          >
            전체 공지/쪽지 보기 <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
