import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight,
  RefreshCw, CheckCircle2, ClipboardCheck, FileWarning,
} from 'lucide-react';

interface CheckItem {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
  details: Array<Record<string, unknown>>;
}

interface Summary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  by_category: Record<string, number>;
}

const severityConfig = {
  critical: { label: '긴급', icon: AlertTriangle, bg: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  warning: { label: '주의', icon: AlertCircle, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  info: { label: '참고', icon: Info, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
};

const categoryOrder = ['작업지시', '중간검사', '인수검사', 'LOT 추적성', '자주검사', '재고', '출하'];

export function ComplianceChecklistPage() {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [lastChecked, setLastChecked] = useState<string>('');

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CheckItem[]; summary: Summary }>('/compliance/checklist');
      setChecks(res.data);
      setSummary(res.summary);
      setLastChecked(new Date().toLocaleString('ko-KR'));
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { fetchChecklist(); }, []);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = checks.filter(c => {
    if (filterSeverity && c.severity !== filterSeverity) return false;
    if (filterCategory && c.category !== filterCategory) return false;
    return true;
  });

  // Group by category
  const grouped = new Map<string, CheckItem[]>();
  for (const c of filtered) {
    const list = grouped.get(c.category) || [];
    list.push(c);
    grouped.set(c.category, list);
  }
  const sortedCategories = [...grouped.keys()].sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  const categories = [...new Set(checks.map(c => c.category))];

  return (
    <div>
      <PageHeader
        title="미비사항 점검"
        description="생산/검사/재고/출하 전 과정 기록 누락 자동 점검"
      >
        <button
          onClick={fetchChecklist}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? '점검 중...' : '재점검'}
        </button>
      </PageHeader>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border-2 border-gray-200 p-4 bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-500">전체 미비사항</span>
              <ClipboardCheck size={20} className="text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-xs text-gray-400 mt-1">최종 점검: {lastChecked || '-'}</div>
          </div>
          <div className={cn('rounded-lg border-2 p-4 cursor-pointer hover:shadow-md transition-shadow',
            filterSeverity === 'critical' ? 'border-red-500 bg-red-50' : 'border-red-200 bg-red-50/50')}
            onClick={() => setFilterSeverity(f => f === 'critical' ? '' : 'critical')}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-red-600 font-medium">긴급 (Critical)</span>
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div className="text-3xl font-bold text-red-700">{summary.critical}</div>
            <div className="text-xs text-red-400 mt-1">즉시 조치 필요</div>
          </div>
          <div className={cn('rounded-lg border-2 p-4 cursor-pointer hover:shadow-md transition-shadow',
            filterSeverity === 'warning' ? 'border-amber-500 bg-amber-50' : 'border-amber-200 bg-amber-50/50')}
            onClick={() => setFilterSeverity(f => f === 'warning' ? '' : 'warning')}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-amber-600 font-medium">주의 (Warning)</span>
              <AlertCircle size={20} className="text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-amber-700">{summary.warning}</div>
            <div className="text-xs text-amber-400 mt-1">보완 권장</div>
          </div>
          <div className={cn('rounded-lg border-2 p-4 cursor-pointer hover:shadow-md transition-shadow',
            filterSeverity === 'info' ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-blue-50/50')}
            onClick={() => setFilterSeverity(f => f === 'info' ? '' : 'info')}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-blue-600 font-medium">참고 (Info)</span>
              <Info size={20} className="text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-blue-700">{summary.info}</div>
            <div className="text-xs text-blue-400 mt-1">확인 사항</div>
          </div>
        </div>
      )}

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterCategory('')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              !filterCategory ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            )}
          >
            전체 영역
          </button>
          {categoryOrder.filter(cat => categories.includes(cat)).map(cat => {
            const cnt = summary?.by_category[cat] || 0;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(f => f === cat ? '' : cat)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  filterCategory === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                )}
              >
                {cat} {cnt > 0 && <span className="ml-1 text-red-500">({cnt})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Check Results */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <RefreshCw size={32} className="mx-auto mb-3 animate-spin" />
          <p>전 과정 미비사항을 점검하고 있습니다...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
          <p className="text-lg font-medium text-green-700">
            {checks.length === 0 ? '미비사항이 없습니다!' : '선택한 필터 조건에 해당하는 미비사항이 없습니다.'}
          </p>
          <p className="text-sm text-green-500 mt-1">
            {checks.length === 0 ? '모든 기록이 정상적으로 관리되고 있습니다.' : '필터를 변경하여 다른 항목을 확인하세요.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedCategories.map(category => {
            const items = grouped.get(category)!;
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <FileWarning size={16} className="text-gray-500" />
                  <h3 className="text-sm font-bold text-gray-700">{category}</h3>
                  <span className="text-xs text-gray-400">
                    ({items.reduce((s, c) => s + c.count, 0)}건)
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map(check => {
                    const sev = severityConfig[check.severity];
                    const Icon = sev.icon;
                    const isExpanded = expanded.has(check.id);
                    return (
                      <div key={check.id} className={cn('rounded-lg border', sev.bg)}>
                        <button
                          onClick={() => toggle(check.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left"
                        >
                          <div className={cn('flex-shrink-0 w-2 h-2 rounded-full', sev.dot)} />
                          <Icon size={18} className={sev.text} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn('text-sm font-semibold', sev.text)}>{check.title}</span>
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', sev.badge)}>
                                {check.count}건
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{check.description}</p>
                          </div>
                          <div className="flex-shrink-0 text-gray-400">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </div>
                        </button>

                        {isExpanded && check.details.length > 0 && (
                          <div className="px-4 pb-3">
                            <div className="bg-white rounded-md border overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b bg-gray-50">
                                    {Object.keys(check.details[0])
                                      .filter(k => !['m1', 'm2', 'm3'].includes(k))
                                      .map(key => (
                                        <th key={key} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">
                                          {columnLabel(key)}
                                        </th>
                                      ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {check.details.slice(0, 20).map((row, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                      {Object.entries(row)
                                        .filter(([k]) => !['m1', 'm2', 'm3'].includes(k))
                                        .map(([key, val], j) => (
                                          <td key={j} className="px-3 py-1.5 whitespace-nowrap">
                                            {formatValue(key, val)}
                                          </td>
                                        ))}
                                    </tr>
                                  ))}
                                  {check.details.length > 20 && (
                                    <tr>
                                      <td colSpan={99} className="px-3 py-2 text-center text-gray-400">
                                        ... 외 {check.details.length - 20}건 더 있음
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function columnLabel(key: string): string {
  const map: Record<string, string> = {
    wo_id: 'ID', wo_number: '지시번호', process_code: '공정', wo_date: '일자',
    planned_qty: '계획수량', actual_qty: '실적수량', status: '상태',
    lot_number: 'LOT번호', lot_id: 'LOT ID', lot_type: 'LOT유형', qty: '수량',
    item_name: '품목명', item_category: '구분', supplier_lot: '공급처LOT',
    insp_id: '검사ID', form_code: '양식', inspected_at: '검사일시',
    shipment_id: '출하ID', shipment_number: '출하번호', customer_name: '납품처',
    ship_date: '출하일', item_code: '품목코드', unit: '단위',
    safety_stock: '안전재고', balance: '현재고', missing: '누락항목',
    asm_structure: '구조', created_at: '생성일', period: '기간',
    closing_id: '마감ID', self_insp_id: '자주검사ID',
  };
  return map[key] || key;
}

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (key.includes('date') || key === 'inspected_at' || key === 'created_at') {
    return String(val).slice(0, 10);
  }
  if (key === 'process_code') {
    const m: Record<string, string> = { MIX: '배합', EXT: '압출', CUT: '재단', ASM: '조립', SHP: '출하' };
    return m[String(val)] || String(val);
  }
  if (key === 'status') {
    const m: Record<string, string> = { PLANNED: '계획', IN_PROGRESS: '진행', COMPLETED: '완료', HOLD: '보류' };
    return m[String(val)] || String(val);
  }
  if (key === 'severity') {
    const m: Record<string, string> = { critical: '긴급', warning: '주의', info: '참고' };
    return m[String(val)] || String(val);
  }
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}
