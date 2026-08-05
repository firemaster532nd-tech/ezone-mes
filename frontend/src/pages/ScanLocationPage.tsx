import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface StockItem {
  lot_number?: string;
  item_name?: string;
  qty?: number | string;
  remaining_qty?: number | string;
  unit?: string;
  spec?: string;
  category?: string;
  status?: string;
  rack_code?: string;
  pallet_no?: number;
  location_code?: string;
}

interface ScanResult {
  loc: string;
  scannedAt: string;
  non_certified: StockItem[];
  lots: StockItem[];
  material_lots: StockItem[];
  total: number;
}

export default function ScanLocationPage() {
  const [params] = useSearchParams();
  const loc = params.get('loc') || '';
  const [data, setData] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loc) { setLoading(false); setError('위치 코드가 없습니다.'); return; }
    fetch(`/api/wms/location-scan?loc=${encodeURIComponent(loc)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('서버 연결 오류'); setLoading(false); });
  }, [loc]);

  const ts = data?.scannedAt ? new Date(data.scannedAt).toLocaleString('ko-KR') : '';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Malgun Gothic', 'Noto Sans KR', sans-serif" }}>

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)', padding: '20px 16px 16px', color: 'white' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4, letterSpacing: 1 }}>(주)이지원 · WMS 위치 조회</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>{loc || '—'}</div>
          {ts && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>조회: {ts}</div>}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <div style={{ fontWeight: 700 }}>재고 조회 중...</div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 20, textAlign: 'center', color: '#dc2626' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 700 }}>{error}</div>
          </div>
        )}

        {data && !loading && (
          <>
            {/* 요약 카드 */}
            <div style={{ background: data.total === 0 ? '#f1f5f9' : '#eff6ff', border: `1.5px solid ${data.total === 0 ? '#cbd5e1' : '#93c5fd'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 32 }}>{data.total === 0 ? '📭' : '📦'}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: data.total === 0 ? '#64748b' : '#1e40af' }}>
                  {data.total === 0 ? '공실' : `총 ${data.total}건 적재`}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {data.total === 0
                    ? '현재 이 위치에 재고가 없습니다.'
                    : `인정재고 ${data.lots.length}건 · 자재 ${data.material_lots.length}건 · 비인정 ${data.non_certified.length}건`}
                </div>
              </div>
            </div>

            {/* 인정재고 */}
            {data.lots.length > 0 && (
              <Section title="✅ 인정재고 (완제품 LOT)" color="#1d4ed8" bg="#eff6ff" border="#bfdbfe">
                {data.lots.map((item, i) => (
                  <ItemCard key={i} item={item} type="certified" />
                ))}
              </Section>
            )}

            {/* 자재 */}
            {data.material_lots.length > 0 && (
              <Section title="🧱 자재 LOT" color="#065f46" bg="#ecfdf5" border="#6ee7b7">
                {data.material_lots.map((item, i) => (
                  <ItemCard key={i} item={item} type="material" />
                ))}
              </Section>
            )}

            {/* 비인정재고 */}
            {data.non_certified.length > 0 && (
              <Section title="⚠️ 비인정재고" color="#92400e" bg="#fffbeb" border="#fcd34d">
                {data.non_certified.map((item, i) => (
                  <ItemCard key={i} item={item} type="non_certified" />
                ))}
              </Section>
            )}

            {/* 새로고침 버튼 */}
            <button
              onClick={() => window.location.reload()}
              style={{ width: '100%', marginTop: 16, padding: '14px', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              🔄 재고 새로고침
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, color, bg, border, children }: { title: string; color: string; bg: string; border: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color, marginBottom: 8 }}>{title}</div>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function ItemCard({ item, type }: { item: StockItem; type: string }) {
  const qty = item.remaining_qty ?? item.qty;
  const unit = item.unit || 'EA';
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 15, color: '#0f172a', wordBreak: 'break-all' }}>
            {item.lot_number || '—'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 2 }}>
            {item.item_name || '품목 미기재'}
          </div>
          {item.spec && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{item.spec}</div>
          )}
          {type === 'non_certified' && item.category && (
            <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>
              {item.category}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#1d4ed8' }}>
            {qty !== undefined ? Number(qty).toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{unit}</div>
        </div>
      </div>
    </div>
  );
}
