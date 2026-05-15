import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { Search, ChevronRight, Package, ArrowRight } from 'lucide-react';

interface TraceNode {
  lot_id: number;
  lot_number: string;
  lot_type: string;
  item_name: string | null;
  item_code: string | null;
  qty: number;
  unit: string | null;
  status: string;
  inspection_result: string | null;
  depth: number;
}

interface TraceEdge {
  genealogy_id: number;
  parent_lot_id: number;
  child_lot_id: number;
  consumed_qty: number | null;
  component_position: string | null;
}

const lotTypeColors: Record<string, string> = {
  IN: 'bg-gray-100 text-gray-700',
  MIX: 'bg-process-mix/10 text-process-mix',
  EXT: 'bg-process-ext/10 text-process-ext',
  CUT: 'bg-process-cut/10 text-process-cut',
  ASM: 'bg-process-asm/10 text-process-asm',
  GI: 'bg-amber-100 text-amber-700',
  CW: 'bg-purple-100 text-purple-700',
  SS: 'bg-pink-100 text-pink-700',
  GW: 'bg-green-100 text-green-700',
  OUT: 'bg-orange-100 text-orange-700',
};

const lotTypeLabels: Record<string, string> = {
  IN: '입고', MIX: '배합', EXT: '압출', CUT: '재단', ASM: '조립',
  GI: '소켓', CW: '세라믹울', SS: '실란트', GW: '그라스울', OUT: '출하',
};

export function LotTracePage() {
  const [searchLotId, setSearchLotId] = useState('');
  const [nodes, setNodes] = useState<TraceNode[]>([]);
  const [edges, setEdges] = useState<TraceEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'backward' | 'forward'>('backward');

  // LOT 목록에서 선택하기 위한 상태
  const [lots, setLots] = useState<Array<{ lot_id: number; lot_number: string; lot_type: string; item_name: string | null }>>([]);
  const [showLotPicker, setShowLotPicker] = useState(false);

  const searchLots = async () => {
    const res = await api.get<{ data: any[] }>('/lots?status=ACTIVE');
    setLots(res.data);
    setShowLotPicker(true);
  };

  const doTrace = async (lotId: number) => {
    setLoading(true);
    try {
      if (mode === 'backward') {
        const res = await api.get<{ data: { nodes: TraceNode[]; edges: TraceEdge[] } }>(`/lots/${lotId}/trace`);
        setNodes(res.data.nodes);
        setEdges(res.data.edges);
      } else {
        const res = await api.get<{ data: TraceNode[] }>(`/lots/${lotId}/forward-trace`);
        setNodes(res.data);
        setEdges([]);
      }
    } catch {
      setNodes([]);
      setEdges([]);
    }
    setLoading(false);
    setShowLotPicker(false);
  };

  const handleSearch = () => {
    if (searchLotId) doTrace(parseInt(searchLotId));
  };

  const rootNode = nodes.find(n => n.depth === 0);
  const maxDepth = nodes.reduce((max, n) => Math.max(max, n.depth), 0);

  return (
    <div>
      <PageHeader title="LOT 추적" description="WITH RECURSIVE 역추적/정추적">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('backward')}
            className={cn('px-3 py-1.5 text-shop-sm rounded-md border',
              mode === 'backward' ? 'bg-process-mix text-white border-process-mix' : 'bg-white')}
          >
            역추적
          </button>
          <button
            onClick={() => setMode('forward')}
            className={cn('px-3 py-1.5 text-shop-sm rounded-md border',
              mode === 'forward' ? 'bg-process-asm text-white border-process-asm' : 'bg-white')}
          >
            정추적
          </button>
        </div>
      </PageHeader>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={searchLotId}
          onChange={(e) => setSearchLotId(e.target.value)}
          placeholder="LOT ID 입력"
          className="flex-1 max-w-xs rounded-md border px-3 py-2 text-shop-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}
          className="px-4 py-2 bg-gray-800 text-white rounded-md text-shop-sm flex items-center gap-1">
          <Search size={14} /> 추적
        </button>
        <button onClick={searchLots}
          className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">
          LOT 선택
        </button>
      </div>

      {/* LOT Picker Modal */}
      {showLotPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[70vh] overflow-auto">
            <div className="px-4 py-3 border-b font-medium flex justify-between items-center">
              <span>LOT 선택</span>
              <button onClick={() => setShowLotPicker(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="divide-y">
              {lots.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400">활성 LOT가 없습니다</div>
              ) : lots.map((lot) => (
                <button key={lot.lot_id} onClick={() => { setSearchLotId(String(lot.lot_id)); doTrace(lot.lot_id); }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3">
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', lotTypeColors[lot.lot_type] || 'bg-gray-100')}>
                    {lotTypeLabels[lot.lot_type] || lot.lot_type}
                  </span>
                  <span className="font-mono text-xs">{lot.lot_number}</span>
                  <span className="text-gray-500 text-xs truncate">{lot.item_name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trace Tree View */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">추적 중...</div>
      ) : nodes.length > 0 ? (
        <div className="space-y-2">
          {/* Depth 범례 */}
          <div className="flex gap-4 mb-4 text-xs text-gray-500">
            {Array.from({ length: maxDepth + 1 }, (_, d) => (
              <span key={d} className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded" style={{
                  backgroundColor: `hsl(${(d * 60) % 360}, 60%, 85%)`,
                }} />
                Depth {d}
              </span>
            ))}
          </div>

          {/* Tree nodes grouped by depth */}
          {Array.from({ length: maxDepth + 1 }, (_, depth) => {
            const depthNodes = nodes.filter((n) => n.depth === depth);
            if (depthNodes.length === 0) return null;
            return (
              <div key={depth} className="flex items-start gap-2">
                <div className="w-16 shrink-0 text-right pr-2 pt-3">
                  <span className="text-xs text-gray-400 font-mono">D{depth}</span>
                </div>
                <div className="flex-1 flex flex-wrap gap-2">
                  {depthNodes.map((node) => (
                    <div key={node.lot_id}
                      className={cn(
                        'rounded-lg border p-3 min-w-[200px]',
                        node.depth === 0 ? 'border-process-mix border-2 bg-blue-50' : 'bg-white'
                      )}
                      style={{ borderLeftColor: `hsl(${(depth * 60) % 360}, 60%, 50%)`, borderLeftWidth: '4px' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', lotTypeColors[node.lot_type])}>
                          {lotTypeLabels[node.lot_type] || node.lot_type}
                        </span>
                        {node.inspection_result && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded',
                            node.inspection_result === 'PASS' ? 'bg-status-pass-bg text-status-pass-text' :
                            node.inspection_result === 'FAIL' ? 'bg-status-fail-bg text-status-fail-text' :
                            'bg-status-pending-bg text-status-pending-text'
                          )}>
                            {node.inspection_result}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs font-medium">{node.lot_number}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{node.item_name ?? '(품목 미지정)'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {node.qty} {node.unit} · {node.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-60 text-gray-400">
          <Package size={48} strokeWidth={1} className="mb-3" />
          <p>LOT ID를 입력하거나 선택하여 추적을 시작하세요</p>
        </div>
      )}
    </div>
  );
}
