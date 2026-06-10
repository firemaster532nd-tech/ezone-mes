import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';

interface ExitPassData {
  so_id: number;
  so_number: string;
  so_date: string;
  customer_name: string | null;
  destination: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  remarks: string | null;
  items: Array<{
    soi_id: number;
    item_name: string;
    spec: string | null;
    unit: string;
    qty: number;
    lot_number: string | null;
    remarks: string | null;
  }>;
}

export default function ExitPassPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ExitPassData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get<{ data: ExitPassData }>(`/shipment-orders/${id}/exit-pass`)
      .then(res => { setData(res.data); setTimeout(() => window.print(), 500); })
      .catch(() => setError('출차증 데이터를 불러올 수 없습니다.'));
  }, [id]);

  if (error) return <div className="flex items-center justify-center h-screen text-red-600">{error}</div>;
  if (!data) return <div className="flex items-center justify-center h-screen text-gray-500">로딩중...</div>;

  const printDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const shipDate = new Date(data.so_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalQty = data.items.reduce((s, i) => s + Number(i.qty||0), 0);

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 15mm; }
        }
        body { font-family: 'Noto Sans KR', '맑은 고딕', sans-serif; background: white; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-10">
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          🖨️ 인쇄
        </button>
        <button onClick={() => window.close()}
          className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-100">
          닫기
        </button>
      </div>

      <div style={{ maxWidth: '210mm', margin: '0 auto', padding: '15mm', color: '#000' }}>
        {/* 제목 */}
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '3px solid #000', paddingBottom: '10px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, letterSpacing: '4px' }}>출 차 증</h1>
          <p style={{ fontSize: '12px', color: '#555', margin: '4px 0 0 0' }}>VEHICLE EXIT PASS</p>
        </div>

        {/* 기본 정보 테이블 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ width: '100px', padding: '5px 8px', fontWeight: 'bold', background: '#f5f5f5', border: '1px solid #ccc' }}>출하번호</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ccc', fontWeight: 'bold', color: '#1a56db' }}>{data.so_number}</td>
              <td style={{ width: '100px', padding: '5px 8px', fontWeight: 'bold', background: '#f5f5f5', border: '1px solid #ccc' }}>출하일자</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ccc' }}>{shipDate}</td>
            </tr>
            <tr>
              <td style={{ padding: '5px 8px', fontWeight: 'bold', background: '#f5f5f5', border: '1px solid #ccc' }}>납품처</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ccc' }}>{data.customer_name || '-'}</td>
              <td style={{ padding: '5px 8px', fontWeight: 'bold', background: '#f5f5f5', border: '1px solid #ccc' }}>납품현장</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ccc' }}>{data.destination || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '5px 8px', fontWeight: 'bold', background: '#f5f5f5', border: '1px solid #ccc' }}>차량번호</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ccc', fontWeight: 'bold', fontSize: '15px' }}>
                {data.vehicle_number || '                    '}
              </td>
              <td style={{ padding: '5px 8px', fontWeight: 'bold', background: '#f5f5f5', border: '1px solid #ccc' }}>운전기사</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ccc' }}>{data.driver_name || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '5px 8px', fontWeight: 'bold', background: '#f5f5f5', border: '1px solid #ccc' }}>담당자</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ccc' }}>{data.contact_person || '-'}</td>
              <td style={{ padding: '5px 8px', fontWeight: 'bold', background: '#f5f5f5', border: '1px solid #ccc' }}>연락처</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ccc' }}>{data.contact_phone || '-'}</td>
            </tr>
          </tbody>
        </table>

        {/* 품목 목록 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
          <thead>
            <tr style={{ background: '#1a56db', color: 'white' }}>
              <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #1a56db', width: '36px' }}>No.</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #1a56db' }}>품목명</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #1a56db' }}>규격</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #1a56db', width: '60px' }}>수량</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #1a56db', width: '40px' }}>단위</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #1a56db', width: '120px' }}>LOT번호</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #1a56db', width: '100px' }}>비고</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={item.soi_id} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ddd' }}>{idx + 1}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', fontWeight: '500' }}>{item.item_name}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', color: '#555' }}>{item.spec || '-'}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 'bold' }}>{Number(item.qty).toLocaleString()}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ddd' }}>{item.unit}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: '11px', color: '#1a56db' }}>
                  {item.lot_number || '-'}
                </td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', color: '#555' }}>{item.remarks || ''}</td>
              </tr>
            ))}
            {/* 합계 행 */}
            <tr style={{ background: '#f0f4ff', fontWeight: 'bold' }}>
              <td colSpan={3} style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #ddd' }}>합 계</td>
              <td style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ddd', fontSize: '14px' }}>
                {totalQty.toLocaleString()}
              </td>
              <td colSpan={3} style={{ padding: '6px 8px', border: '1px solid #ddd' }}></td>
            </tr>
          </tbody>
        </table>

        {/* 비고 */}
        {data.remarks && (
          <div style={{ border: '1px solid #ccc', padding: '8px 12px', marginBottom: '16px', fontSize: '12px' }}>
            <strong>비고:</strong> {data.remarks}
          </div>
        )}

        {/* 서명란 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #ccc' }}>출하담당</th>
              <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #ccc' }}>운전기사 (서명)</th>
              <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #ccc' }}>현장수령 (서명)</th>
              <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #ccc' }}>관리자 확인</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '24px 8px', textAlign: 'center', border: '1px solid #ccc' }}></td>
              <td style={{ padding: '24px 8px', textAlign: 'center', border: '1px solid #ccc' }}></td>
              <td style={{ padding: '24px 8px', textAlign: 'center', border: '1px solid #ccc' }}></td>
              <td style={{ padding: '24px 8px', textAlign: 'center', border: '1px solid #ccc' }}></td>
            </tr>
          </tbody>
        </table>

        {/* 발행 정보 */}
        <div style={{ borderTop: '2px solid #000', paddingTop: '10px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <strong>(주)이지원</strong> | 경기도 화성시 장안면 장안로227번길 166-18 | TEL: 070-8870-0300
          </div>
          <div style={{ color: '#666' }}>
            발행일: {printDate}
          </div>
        </div>
      </div>
    </>
  );
}
