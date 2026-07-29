import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  BookOpen, HelpCircle, MessageSquare, Upload, Plus, Trash2,
  ChevronDown, ChevronUp, Mail, MailOpen, Loader2,
  FileText, Calendar, Tag, Search, AlertCircle, CheckCircle2,
  RefreshCw, Eye
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Faq {
  id: number;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
}

interface ManualDoc {
  id: number;
  category: string;
  title: string;
  description: string;
  file_url?: string;
  created_at: string;
}

interface PublicInquiry {
  id: number;
  sender_name: string;
  sender_contact: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ── 카테고리 레이블 ────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  general: '일반',
  production: '생산관리',
  quality: '품질관리',
  inventory: '재고관리',
  shipment: '출하관리',
  system: '시스템',
};

const CATEGORY_COLORS: Record<string, string> = {
  general: '#64748b',
  production: '#2563eb',
  quality: '#16a34a',
  inventory: '#9333ea',
  shipment: '#ea580c',
  system: '#0891b2',
};

// ── 날짜 포맷 ──────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── ManualTab ────────────────────────────────────────────────────────────────
const SAMPLE_MANUALS: ManualDoc[] = [
  { id: 1, category: 'system', title: 'EZONE MES 사용자 가이드', description: '전체 시스템 개요 및 기본 사용법 안내', created_at: '2026-01-10T09:00:00Z' },
  { id: 2, category: 'production', title: '생산관리 운영 매뉴얼', description: '작업지시 생성부터 공정 실행까지 상세 가이드', created_at: '2026-02-15T09:00:00Z' },
  { id: 3, category: 'quality', title: '품질 검사 절차서', description: '인수검사 · 중간검사 · 자주검사 입력 방법', created_at: '2026-03-01T09:00:00Z' },
  { id: 4, category: 'inventory', title: '재고수불대장 가이드', description: 'LOT 추적 및 재고 현황 조회 방법', created_at: '2026-03-20T09:00:00Z' },
  { id: 5, category: 'shipment', title: '출하처리 매뉴얼', description: '출하지시서 작성 · 품질관리서 발행 절차', created_at: '2026-04-05T09:00:00Z' },
  { id: 6, category: 'system', title: '권한 및 사용자 관리', description: '부서별 권한 설정 및 계정 관리 방법', created_at: '2026-04-20T09:00:00Z' },
];

function ManualTab({ isAdmin }: { isAdmin: boolean }) {
  const [searchQ, setSearchQ] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');

  const filtered = SAMPLE_MANUALS.filter(m => {
    const matchCat = selectedCat === 'all' || m.category === selectedCat;
    const q = searchQ.toLowerCase();
    const matchQ = !q || m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 툴바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            style={{
              width: '100%', padding: '8px 12px 8px 36px', borderRadius: 10,
              border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 13,
              color: '#334155', outline: 'none', boxSizing: 'border-box',
              transition: 'border 0.2s',
            }}
            placeholder="문서 검색..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        <select
          value={selectedCat}
          onChange={e => setSelectedCat(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
            background: '#f8fafc', fontSize: 13, color: '#334155', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">전체 카테고리</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {isAdmin && (
          <button
            onClick={() => toast.info('파일 업로드 기능은 준비 중입니다.')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
          >
            <Upload size={14} /> 문서 업로드
          </button>
        )}
      </div>

      {/* 카드 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map(doc => (
          <div
            key={doc.id}
            style={{
              background: '#fff', borderRadius: 14, padding: 20,
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            }}
            onClick={() => toast.info('문서 뷰어는 준비 중입니다.')}
          >
            {/* 카테고리 뱃지 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: `${CATEGORY_COLORS[doc.category]}18`,
                color: CATEGORY_COLORS[doc.category],
              }}>
                <Tag size={10} />
                {CATEGORY_LABELS[doc.category] ?? doc.category}
              </span>
              <FileText size={16} style={{ color: '#94a3b8' }} />
            </div>
            {/* 제목 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6, lineHeight: 1.4 }}>
              {doc.title}
            </div>
            {/* 설명 */}
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: 14, minHeight: 36 }}>
              {doc.description}
            </div>
            {/* 날짜 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
              <Calendar size={11} />
              {fmtDate(doc.created_at)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// ── FaqTab ────────────────────────────────────────────────────────────────────
function FaqTab({ isAdmin }: { isAdmin: boolean }) {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ category: 'general', question: '', answer: '' });
  const [submitting, setSubmitting] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Faq[] }>('/support/faqs');
      setFaqs(res.data ?? []);
    } catch {
      toast.error('FAQ를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFaqs(); }, [loadFaqs]);

  const handleAdd = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('질문과 답변을 모두 입력하세요.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/support/faqs', form);
      toast.success('FAQ가 추가되었습니다.');
      setForm({ category: 'general', question: '', answer: '' });
      setShowAddForm(false);
      loadFaqs();
    } catch {
      toast.error('FAQ 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 FAQ를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/support/faqs/${id}`);
      toast.success('삭제되었습니다.');
      setFaqs(prev => prev.filter(f => f.id !== id));
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  };

  const filtered = faqs.filter(f => {
    const matchCat = selectedCat === 'all' || f.category === selectedCat;
    const q = searchQ.toLowerCase();
    const matchQ = !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 툴바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            style={{
              width: '100%', padding: '8px 12px 8px 36px', borderRadius: 10,
              border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 13,
              color: '#334155', outline: 'none', boxSizing: 'border-box',
            }}
            placeholder="질문 검색..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        <select
          value={selectedCat}
          onChange={e => setSelectedCat(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
            background: '#f8fafc', fontSize: 13, color: '#334155', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">전체</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
          >
            <Plus size={14} /> FAQ 추가
          </button>
        )}
      </div>

      {/* 추가 폼 */}
      {isAdmin && showAddForm && (
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed, #fff)',
          borderRadius: 14, border: '1.5px solid #fed7aa',
          padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', marginBottom: 4 }}>새 FAQ 추가</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1.5px solid #fed7aa',
                background: '#fff', fontSize: 13, color: '#334155', outline: 'none',
              }}
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <input
            style={{
              padding: '10px 14px', borderRadius: 8, border: '1.5px solid #fed7aa',
              background: '#fff', fontSize: 13, color: '#334155', outline: 'none',
            }}
            placeholder="질문을 입력하세요..."
            value={form.question}
            onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
          />
          <textarea
            style={{
              padding: '10px 14px', borderRadius: 8, border: '1.5px solid #fed7aa',
              background: '#fff', fontSize: 13, color: '#334155', outline: 'none',
              minHeight: 80, resize: 'vertical', fontFamily: 'inherit',
            }}
            placeholder="답변을 입력하세요..."
            value={form.answer}
            onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowAddForm(false)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748b',
              }}
            >취소</button>
            <button
              onClick={handleAdd}
              disabled={submitting}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 아코디언 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>불러오는 중...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', color: '#94a3b8',
          background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #e2e8f0',
        }}>
          <HelpCircle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontSize: 14 }}>
            {faqs.length === 0 ? '등록된 FAQ가 없습니다.' : '검색 결과가 없습니다.'}
          </div>
          {faqs.length === 0 && isAdmin && (
            <div style={{ fontSize: 12, marginTop: 4, color: '#cbd5e1' }}>
              위 "FAQ 추가" 버튼으로 첫 번째 FAQ를 등록하세요.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(faq => (
            <div
              key={faq.id}
              style={{
                background: '#fff', borderRadius: 12,
                border: openId === faq.id ? '1.5px solid #93c5fd' : '1.5px solid #e2e8f0',
                overflow: 'hidden', transition: 'border 0.2s',
                boxShadow: openId === faq.id ? '0 4px 16px rgba(37,99,235,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              {/* 질문 헤더 */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', cursor: 'pointer',
                  background: openId === faq.id ? 'linear-gradient(135deg, #eff6ff, #fff)' : '#fff',
                  transition: 'background 0.2s',
                }}
                onClick={() => setOpenId(prev => prev === faq.id ? null : faq.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
                    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                    background: `${CATEGORY_COLORS[faq.category] ?? '#64748b'}18`,
                    color: CATEGORY_COLORS[faq.category] ?? '#64748b',
                  }}>
                    {CATEGORY_LABELS[faq.category] ?? faq.category}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {faq.question}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(faq.id); }}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '4px 8px',
                        borderRadius: 6, border: '1px solid #fecaca',
                        background: '#fff5f5', cursor: 'pointer', color: '#ef4444',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff5f5'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  {openId === faq.id
                    ? <ChevronUp size={16} style={{ color: '#2563eb' }} />
                    : <ChevronDown size={16} style={{ color: '#94a3b8' }} />
                  }
                </div>
              </div>
              {/* 답변 */}
              {openId === faq.id && (
                <div style={{
                  padding: '0 18px 16px 18px',
                  borderTop: '1px solid #e2e8f0',
                  background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
                }}>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8, paddingTop: 14, whiteSpace: 'pre-wrap' }}>
                    {faq.answer}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
                    등록일: {fmtDate(faq.created_at)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── InquiriesTab ──────────────────────────────────────────────────────────────
function InquiriesTab({ isAdmin }: { isAdmin: boolean }) {
  const [inquiries, setInquiries] = useState<PublicInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const loadInquiries = useCallback(async () => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get<{ data: PublicInquiry[] }>('/announcements/public-inquiries');
      setInquiries(res.data ?? []);
    } catch {
      toast.error('문의 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadInquiries(); }, [loadInquiries]);

  const handleMarkRead = async (id: number) => {
    try {
      await api.patch(`/announcements/public-inquiries/${id}/read`, {});
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
      toast.success('읽음 처리되었습니다.');
    } catch {
      toast.error('처리에 실패했습니다.');
    }
  };

  if (!isAdmin) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 24px', color: '#94a3b8',
        background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #e2e8f0',
      }}>
        <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 4 }}>접근 권한 없음</div>
        <div style={{ fontSize: 13 }}>관리자만 외부 문의 내역을 확인할 수 있습니다.</div>
      </div>
    );
  }

  const filtered = inquiries.filter(i => {
    if (filter === 'unread') return !i.is_read;
    if (filter === 'read') return i.is_read;
    return true;
  });

  const unreadCount = inquiries.filter(i => !i.is_read).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 헤더 통계 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: '전체', value: inquiries.length, color: '#2563eb', bg: '#eff6ff', filterVal: 'all' as const },
          { label: '미확인', value: unreadCount, color: '#ea580c', bg: '#fff7ed', filterVal: 'unread' as const },
          { label: '확인 완료', value: inquiries.length - unreadCount, color: '#16a34a', bg: '#f0fdf4', filterVal: 'read' as const },
        ].map(s => (
          <button
            key={s.filterVal}
            onClick={() => setFilter(s.filterVal)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 10, border: `1.5px solid ${filter === s.filterVal ? s.color : '#e2e8f0'}`,
              background: filter === s.filterVal ? s.bg : '#fff',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 11, color: '#64748b' }}>{s.label}</span>
            <span style={{
              fontSize: 16, fontWeight: 800, color: s.color,
              minWidth: 24, textAlign: 'center',
            }}>{s.value}</span>
          </button>
        ))}
        <button
          onClick={loadInquiries}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0',
            background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b',
          }}
        >
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>불러오는 중...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', color: '#94a3b8',
          background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #e2e8f0',
        }}>
          <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontSize: 14 }}>문의 내역이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(inq => (
            <div
              key={inq.id}
              style={{
                background: '#fff', borderRadius: 12,
                border: inq.is_read ? '1.5px solid #e2e8f0' : '1.5px solid #fed7aa',
                overflow: 'hidden', transition: 'all 0.2s',
                boxShadow: inq.is_read ? '0 1px 4px rgba(0,0,0,0.04)' : '0 2px 8px rgba(249,115,22,0.1)',
              }}
            >
              {/* 문의 헤더 */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                  cursor: 'pointer',
                  background: expandedId === inq.id
                    ? inq.is_read ? '#f8fafc' : '#fff7ed'
                    : '#fff',
                }}
                onClick={() => setExpandedId(prev => prev === inq.id ? null : inq.id)}
              >
                <div style={{ flexShrink: 0 }}>
                  {inq.is_read
                    ? <MailOpen size={18} style={{ color: '#94a3b8' }} />
                    : <Mail size={18} style={{ color: '#ea580c' }} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                      {inq.sender_name}
                    </span>
                    {!inq.is_read && (
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa',
                      }}>NEW</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inq.message.slice(0, 60)}{inq.message.length > 60 ? '…' : ''}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{fmtDate(inq.created_at)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{inq.sender_contact}</div>
                </div>
                {expandedId === inq.id
                  ? <ChevronUp size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  : <ChevronDown size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                }
              </div>

              {/* 확장 내용 */}
              {expandedId === inq.id && (
                <div style={{
                  padding: '0 18px 18px 18px',
                  borderTop: '1px solid #e2e8f0',
                  background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
                }}>
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.8, paddingTop: 14, whiteSpace: 'pre-wrap' }}>
                    {inq.message}
                  </div>
                  {!inq.is_read && (
                    <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleMarkRead(inq.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 16px', borderRadius: 8, border: 'none',
                          background: 'linear-gradient(135deg, #16a34a, #15803d)',
                          color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
                        }}
                      >
                        <CheckCircle2 size={13} /> 읽음 처리
                      </button>
                    </div>
                  )}
                  {inq.is_read && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16a34a' }}>
                      <CheckCircle2 size={12} /> 확인 완료
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────
interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

function TabBtn({ active, onClick, icon, label, badge }: TabBtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px',
        borderRadius: 10, border: 'none',
        background: active ? 'linear-gradient(135deg, #1e40af, #2563eb)' : 'transparent',
        color: active ? '#fff' : '#64748b',
        fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        boxShadow: active ? '0 4px 12px rgba(37,99,235,0.3)' : 'none',
        transition: 'all 0.2s',
        position: 'relative',
      }}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          background: '#ea580c', color: '#fff',
          fontSize: 9, fontWeight: 800,
          padding: '1px 5px', borderRadius: 20, lineHeight: 1.4,
          minWidth: 14, textAlign: 'center',
        }}>{badge}</span>
      )}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type Tab = 'manual' | 'faq' | 'inquiries';

export function SupportPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [unreadCount, setUnreadCount] = useState(0);

  // 미확인 문의 배지용 (관리자만)
  useEffect(() => {
    if (!isAdmin) return;
    api.get<{ data: PublicInquiry[] }>('/announcements/public-inquiries')
      .then(res => setUnreadCount((res.data ?? []).filter(i => !i.is_read).length))
      .catch(() => {});
  }, [isAdmin]);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Inter', 'Pretendard', sans-serif" }}>
      {/* CSS animation */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .support-content { animation: slideIn 0.25s ease-out; }
      `}</style>

      {/* 상단 히어로 배너 */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
        padding: '32px 32px 48px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 장식 원 */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 200, width: 120, height: 120, borderRadius: '50%', background: 'rgba(249,115,22,0.12)' }} />

        <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(249,115,22,0.4)',
            }}>
              <HelpCircle size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                고객센터
              </div>
              <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 1 }}>
                Support Center
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#bfdbfe', marginTop: 4, maxWidth: 500 }}>
            매뉴얼·FAQ·문의내역을 한 곳에서 관리하세요.
            {isAdmin && (
              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: 'rgba(249,115,22,0.25)', color: '#fdba74', fontSize: 11, fontWeight: 700 }}>
                관리자 모드
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 탭 바 */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 32px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 4, paddingTop: 12, paddingBottom: 12 }}>
          <TabBtn
            active={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
            icon={<BookOpen size={15} />}
            label="매뉴얼"
          />
          <TabBtn
            active={activeTab === 'faq'}
            onClick={() => setActiveTab('faq')}
            icon={<HelpCircle size={15} />}
            label="QnA / FAQ"
          />
          {isAdmin && (
            <TabBtn
              active={activeTab === 'inquiries'}
              onClick={() => setActiveTab('inquiries')}
              icon={<MessageSquare size={15} />}
              label="문의내역"
              badge={unreadCount}
            />
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>
        <div className="support-content" key={activeTab}>
          {activeTab === 'manual' && <ManualTab isAdmin={isAdmin} />}
          {activeTab === 'faq' && <FaqTab isAdmin={isAdmin} />}
          {activeTab === 'inquiries' && <InquiriesTab isAdmin={isAdmin} />}
        </div>
      </div>
    </div>
  );
}
