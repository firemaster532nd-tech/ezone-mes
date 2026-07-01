import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Calendar, User, FileText, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

interface SWO {
  swo_id: number;
  swo_number: string;
  project_name?: string;
  po_project_name?: string;
  sheet_name?: string;
  wo_date?: string;
  delivery_date?: string;
  worker?: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  warnings?: string;
}

const statusConfig = {
  PLANNED: { label: '대기', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  IN_PROGRESS: { label: '진행', bg: 'bg-blue-50', text: 'text-blue-700' },
  COMPLETED: { label: '완료', bg: 'bg-green-50', text: 'text-green-700' },
};

const SOCKET_TYPE_MAP: Record<string, 'VM' | 'VT'> = {
  'V-03':         'VM',
  'VS-01':        'VM',
  'VT-049':       'VM',
  'VA-064':       'VM',
  'VT-064':       'VM',
  'HTG-064':      'VM',
  'HTG-064DC':    'VM',
  'HTG(DC)-064':  'VM',
  'BDCV-1S':      'VM',
  'BDRV-3S':      'VM',

  'VT-01':        'VT',
  'VAG-1.69':     'VT',
  'VAG-169':      'VT',
  'VTI-064':      'VT',
  'HAG-1.69':     'VT',
  'HAG-169':      'VT',
  'HTG-1.69':     'VT',
  'HTG-169':      'VT',
};

export function getSocketType(productType: string): 'VM' | 'VT' {
  const pt = (productType || '').trim();
  if (SOCKET_TYPE_MAP[pt]) {
    return SOCKET_TYPE_MAP[pt];
  }
  const upper = pt.toUpperCase();
  if (upper.includes('VT') || upper.includes('HT') || upper.includes('VTI') || upper.includes('VAG')) {
    return 'VT';
  }
  return 'VM';
}

export default function DetailSwoModal({ swo, onClose, onRefresh }: { swo: any; onClose: () => void; onRefresh: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [editStatus, setEditStatus] = useState(swo.status);
  const [actuals, setActuals] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('1. 소켓인수검사');

  useEffect(() => {
    api.get<{ data: any }>(`/socket-work-orders/${swo.swo_id}`)
      .then(r => {
        setDetail(r.data);
        const a: Record<number, number> = {};
        r.data.items?.forEach((it: any) => { a[it.swi_id] = it.actual_qty ?? 0; });
        setActuals(a);
      })
      .catch(() => {});
  }, [swo.swo_id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const item_actuals = Object.entries(actuals).map(([swi_id, actual_qty]) => ({
        swi_id: parseInt(swi_id), actual_qty,
      }));
      await api.patch(`/socket-work-orders/${swo.swo_id}`, { status: editStatus, item_actuals });
      onRefresh();
      onClose();
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await fetch(`/api/socket-work-orders/${swo.swo_id}/excel`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      if (!response.ok) throw new Error('다운로드 실패');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const disposition = response.headers.get('Content-Disposition');
      let filename = `${swo.project_name || '소켓'}_작업지시서_${swo.swo_number}.xlsx`;
      if (disposition && disposition.indexOf('filename*=') !== -1) {
        const parts = disposition.split("filename*=UTF-8''");
        if (parts.length > 1) filename = decodeURIComponent(parts[1]);
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      alert('엑셀 다운로드 중 오류가 발생했습니다: ' + e.message);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const d = detail;
  const projectTitle = swo.project_name || '소켓 작업지시서';
  const vmItems = d?.items?.filter((it: any) => getSocketType(it.product_type) === 'VM') || [];
  const vtItems = d?.items?.filter((it: any) => getSocketType(it.product_type) === 'VT') || [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .page-break {
            page-break-after: always;
          }
          .no-print {
            display: none !important;
          }
        }
      ` }} />

      {/* A4 인쇄 미리보기용 hidden 프린트 영역 */}
      <div id="print-area" className="hidden print:block font-sans text-xs bg-white text-black p-4">
        {/* 1. 소켓인수검사 */}
        <div className="page-break p-8">
          <div className="print-header-title text-base font-bold text-center mb-4">방화소켓 인수검사표</div>
          <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
          <table className="print-table w-full border border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1">No.</th>
                <th className="border p-1">구조</th>
                <th className="border p-1">가로(mm)</th>
                <th className="border p-1">세로(mm)</th>
                <th className="border p-1">수량(EA)</th>
                <th className="border p-1">검토/확인사항 (소켓 LOT)</th>
                <th className="border p-1">비고</th>
              </tr>
            </thead>
            <tbody>
              {d?.items?.map((item: any, idx: number) => (
                <tr key={item.swi_id} className="text-center">
                  <td className="border p-1">{String(idx + 1).padStart(2, '0')}</td>
                  <td className="border p-1 font-semibold">{item.product_type || item.structure || '-'}</td>
                  <td className="border p-1 font-mono">{item.pipe_width_mm || '-'}</td>
                  <td className="border p-1 font-mono">{item.pipe_height_mm || '-'}</td>
                  <td className="border p-1">1</td>
                  <td className="border p-1 font-mono text-blue-700 font-bold">{item.insp_lot_no || '-'}</td>
                  <td className="border p-1">{item.remark || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 2. 재단(VM) */}
        {vmItems.length > 0 && (
          <div className="page-break p-8">
            <div className="print-header-title text-base font-bold text-center mb-4">재단작업일지 (VM)</div>
            <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
            <table className="print-table w-full border border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1" rowSpan={2}>No.</th>
                  <th className="border p-1" rowSpan={2}>구조</th>
                  <th className="border p-1" colSpan={2}>소켓 규격</th>
                  <th className="border p-1" colSpan={2}>내부재단 (4EA)</th>
                  <th className="border p-1" colSpan={2}>외부재단 (2EA)</th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border p-1">가로</th>
                  <th className="border p-1">세로</th>
                  <th className="border p-1">가로 (W-5)</th>
                  <th className="border p-1">세로 (H-30)</th>
                  <th className="border p-1">상하 (W+60)</th>
                  <th className="border p-1">좌우 (H)</th>
                </tr>
              </thead>
              <tbody>
                {vmItems.map((item: any, idx: number) => {
                  const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                  const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                  return (
                    <tr key={item.swi_id} className="text-center">
                      <td className="border p-1 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="border p-1 font-semibold">{item.product_type}</td>
                      <td className="border p-1 font-mono">{w}</td>
                      <td className="border p-1 font-mono">{h}</td>
                      <td className="border p-1 font-semibold text-blue-700">{w > 0 ? w - 5 : '-'}</td>
                      <td className="border p-1 font-semibold text-blue-700">{h > 0 ? h - 30 : '-'}</td>
                      <td className="border p-1 font-semibold text-indigo-700">{w > 0 ? w + 60 : '-'}</td>
                      <td className="border p-1 font-semibold text-indigo-700">{h > 0 ? h : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 2.1 재단작업(VT) */}
        {vtItems.length > 0 && (
          <div className="page-break p-8">
            <div className="print-header-title text-base font-bold text-center mb-4">재단작업일지 (VT)</div>
            <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
            <table className="print-table w-full border border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1" rowSpan={2}>No.</th>
                  <th className="border p-1" rowSpan={2}>구조</th>
                  <th className="border p-1" colSpan={2}>소켓 규격</th>
                  <th className="border p-1" colSpan={2}>내부재단 (16EA)</th>
                  <th className="border p-1" colSpan={2}>외부재단 (4EA)</th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border p-1">가로</th>
                  <th className="border p-1">세로</th>
                  <th className="border p-1">가로 (W-40)/2</th>
                  <th className="border p-1">세로 (H-40)/2</th>
                  <th className="border p-1">상하 (W+60)</th>
                  <th className="border p-1">좌우 (H)</th>
                </tr>
              </thead>
              <tbody>
                {vtItems.map((item: any, idx: number) => {
                  const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                  const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                  return (
                    <tr key={item.swi_id} className="text-center">
                      <td className="border p-1 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="border p-1 font-bold text-blue-800">{item.product_type}</td>
                      <td className="border p-1 font-mono">{w}</td>
                      <td className="border p-1 font-mono">{h}</td>
                      <td className="border p-1 font-semibold text-blue-700">{w > 0 ? (w - 40) / 2 : '-'}</td>
                      <td className="border p-1 font-semibold text-blue-700">{h > 0 ? (h - 40) / 2 : '-'}</td>
                      <td className="border p-1 font-semibold text-indigo-700">{w > 0 ? w + 60 : '-'}</td>
                      <td className="border p-1 font-semibold text-indigo-700">{h > 0 ? h : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 차열재 재단 */}
        <div className="page-break p-8">
          <div className="print-header-title text-base font-bold text-center mb-4">차열재 재단작업일지 (VM,VT)</div>
          <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
          <table className="print-table w-full border border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1" rowSpan={2}>No.</th>
                <th className="border p-1" rowSpan={2}>구조</th>
                <th className="border p-1" colSpan={2}>소켓 규격</th>
                <th className="border p-1" colSpan={2}>외부 차열재 상하</th>
                <th className="border p-1" colSpan={2}>외부 차열재 좌우</th>
              </tr>
              <tr>
                <th className="border p-1">가로</th>
                <th className="border p-1">세로</th>
                <th className="border p-1">규격 (W+60)</th>
                <th className="border p-1">수량</th>
                <th className="border p-1">규격 (H)</th>
                <th className="border p-1">수량</th>
              </tr>
            </thead>
            <tbody>
              {d?.items?.map((item: any, idx: number) => {
                const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                const isVm = getSocketType(item.product_type) === 'VM';
                const qty = isVm ? 2 : 4;
                return (
                  <tr key={item.swi_id} className="text-center">
                    <td className="border p-1 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="border p-1 font-semibold">{item.product_type}</td>
                    <td className="border p-1 font-mono">{w}</td>
                    <td className="border p-1 font-mono">{h}</td>
                    <td className="border p-1 font-semibold text-rose-700">{w > 0 ? w + 60 : '-'}</td>
                    <td className="border p-1 font-bold">{qty}</td>
                    <td className="border p-1 font-semibold text-rose-700">{h > 0 ? h : '-'}</td>
                    <td className="border p-1 font-bold">{qty}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3. 1절곡(VM) */}
        {vmItems.length > 0 && (
          <div className="page-break p-8">
            <div className="print-header-title text-base font-bold text-center mb-4">절곡생산일지 (VM)</div>
            <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
            <table className="print-table w-full border border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1" rowSpan={2}>No.</th>
                  <th className="border p-1" colSpan={2}>소켓 규격</th>
                  <th className="border p-1" rowSpan={2}>수량(EA)</th>
                  <th className="border p-1" rowSpan={2}>소켓 Lot</th>
                  <th className="border p-1" rowSpan={2}>두께</th>
                  <th className="border p-1" colSpan={3}>평철 절곡 규격 (VM)</th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border p-1">가로</th>
                  <th className="border p-1">세로</th>
                  <th className="border p-1">평철 가로 (W-1)</th>
                  <th className="border p-1">평철 세로 (H-30)</th>
                  <th className="border p-1">수량</th>
                </tr>
              </thead>
              <tbody>
                {vmItems.map((item: any, idx: number) => {
                  const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                  const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                  return (
                    <tr key={item.swi_id} className="text-center">
                      <td className="border p-1 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="border p-1 font-mono">{w}</td>
                      <td className="border p-1 font-mono">{h}</td>
                      <td className="border p-1">1</td>
                      <td className="border p-1 font-mono">{item.insp_lot_no || '-'}</td>
                      <td className="border p-1">1.6</td>
                      <td className="border p-1 font-bold text-orange-700">{w > 0 ? w - 1 : '-'}</td>
                      <td className="border p-1 font-bold text-orange-700">{h > 0 ? h - 30 : '-'}</td>
                      <td className="border p-1">각 4EA</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3.2 절곡(VT) */}
        {vtItems.length > 0 && (
          <div className="page-break p-8">
            <div className="print-header-title text-base font-bold text-center mb-4">절곡생산일지 (VT)</div>
            <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
            <table className="print-table w-full border border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1" rowSpan={2}>No.</th>
                  <th className="border p-1" colSpan={2}>소켓 규격</th>
                  <th className="border p-1" rowSpan={2}>수량(EA)</th>
                  <th className="border p-1" rowSpan={2}>소켓 Lot</th>
                  <th className="border p-1" rowSpan={2}>평철폭</th>
                  <th className="border p-1" colSpan={3}>평철 절곡 규격 (VT 브라켓)</th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border p-1">가로</th>
                  <th className="border p-1">세로</th>
                  <th className="border p-1">평철 가로 (W-40)/2+4</th>
                  <th className="border p-1">평철 세로 (H-40)/2-1</th>
                  <th className="border p-1">수량합계</th>
                </tr>
              </thead>
              <tbody>
                {vtItems.map((item: any, idx: number) => {
                  const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                  const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                  return (
                    <tr key={item.swi_id} className="text-center">
                      <td className="border p-1 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="border p-1 font-mono">{w}</td>
                      <td className="border p-1 font-mono">{h}</td>
                      <td className="border p-1">1</td>
                      <td className="border p-1 font-mono">{item.insp_lot_no || '-'}</td>
                      <td className="border p-1">60mm</td>
                      <td className="border p-1 font-bold text-orange-700">{w > 0 ? (w - 40) / 2 + 4 : '-'} (16EA)</td>
                      <td className="border p-1 font-bold text-orange-700">{h > 0 ? (h - 40) / 2 - 1 : '-'} (32EA)</td>
                      <td className="border p-1 font-bold">32EA</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3.3 절곡(VT-보강대) */}
        {vtItems.length > 0 && (
          <div className="page-break p-8">
            <div className="print-header-title text-base font-bold text-center mb-4">절곡생산일지 (VT_보강대)</div>
            <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
            <table className="print-table w-full border border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100 border">
                  <th className="border p-1" rowSpan={3}>No.</th>
                  <th className="border p-1" colSpan={2} rowSpan={2}>규격</th>
                  <th className="border p-1" rowSpan={3}>수량(EA)</th>
                  <th className="border p-1" rowSpan={3}>소켓 Lot</th>
                  <th className="border p-1" rowSpan={3}>두께</th>
                  <th className="border p-1" colSpan={3}>평철 가로(받침대)</th>
                  <th className="border p-1" colSpan={3}>평철 세로(보강대)</th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border p-1" rowSpan={2}>폭</th>
                  <th className="border p-1" colSpan={2}>가로 규격 및 수량</th>
                  <th className="border p-1" rowSpan={2}>폭</th>
                  <th className="border p-1" colSpan={2}>세로 규격 및 수량</th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border p-1">가로</th>
                  <th className="border p-1">세로</th>
                  <th className="border p-1">규격</th>
                  <th className="border p-1">수량</th>
                  <th className="border p-1">규격</th>
                  <th className="border p-1">수량</th>
                </tr>
              </thead>
              <tbody>
                {vtItems.map((item: any, idx: number) => {
                  const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                  const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                  return (
                    <tr key={item.swi_id} className="text-center">
                      <td className="border p-1 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="border p-1 font-mono">{w}</td>
                      <td className="border p-1 font-mono">{h}</td>
                      <td className="border p-1">1</td>
                      <td className="border p-1 font-mono">{item.insp_lot_no || '-'}</td>
                      <td className="border p-1">1.6이상</td>
                      <td className="border p-1">225</td>
                      <td className="border p-1 text-amber-700 font-bold">{w > 0 ? (w - 40) / 2 + 4 : '-'}</td>
                      <td className="border p-1">8EA</td>
                      <td className="border p-1">237</td>
                      <td className="border p-1 text-amber-700 font-bold">{h > 0 ? h : '-'}</td>
                      <td className="border p-1">4EA</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. 차열재 출하용 */}
        <div className="page-break p-8">
          <div className="print-header-title text-base font-bold text-center mb-4">차열재 출하용 집계표</div>
          <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
          <table className="print-table w-full border border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1" rowSpan={2}>No.</th>
                <th className="border p-1" colSpan={2}>소켓 규격</th>
                <th className="border p-1" rowSpan={2}>구조</th>
                <th className="border p-1" rowSpan={2}>면적(㎡)</th>
                <th className="border p-1" rowSpan={2}>둘레(m)</th>
                <th className="border p-1" colSpan={2}>글라스울 25*1400</th>
                <th className="border p-1" colSpan={2}>차열재 50*400(VT)</th>
                <th className="border p-1" colSpan={2}>차열재 25*200(VM)</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border p-1">가로</th>
                <th className="border p-1">세로</th>
                <th className="border p-1">소요 (둘레+0.5)</th>
                <th className="border p-1">수량</th>
                <th className="border p-1">소요 (둘레+0.5)</th>
                <th className="border p-1">수량</th>
                <th className="border p-1">소요 (둘레+0.5)x4</th>
                <th className="border p-1">수량</th>
              </tr>
            </thead>
            <tbody>
              {d?.items?.map((item: any, idx: number) => {
                const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                const area = w > 0 && h > 0 ? ((w * h) / 1000000).toFixed(4) : '0';
                const perimeter = w > 0 && h > 0 ? (((w + h) * 2) / 1000).toFixed(1) : '0';
                const pVal = Number(perimeter);
                const isVm = getSocketType(item.product_type) === 'VM';
                return (
                  <tr key={item.swi_id} className="text-center">
                    <td className="border p-1 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="border p-1 font-mono">{w}</td>
                    <td className="border p-1 font-mono">{h}</td>
                    <td className="border p-1 font-bold">{item.product_type || '-'}</td>
                    <td className="border p-1 font-mono text-gray-700">{area}</td>
                    <td className="border p-1 font-mono text-gray-700">{perimeter}</td>
                    {!isVm ? (
                      <>
                        <td className="border p-1 text-teal-700 font-bold">{pVal > 0 ? (pVal + 0.5).toFixed(1) : ''}</td>
                        <td className="border p-1">1</td>
                        <td className="border p-1 text-teal-700 font-bold">{pVal > 0 ? (pVal + 0.5).toFixed(1) : ''}</td>
                        <td className="border p-1">4</td>
                        <td className="border p-1 text-gray-300">-</td>
                        <td className="border p-1 text-gray-300">-</td>
                      </>
                    ) : (
                      <>
                        <td className="border p-1 text-gray-300">-</td>
                        <td className="border p-1 text-gray-300">-</td>
                        <td className="border p-1 text-gray-300">-</td>
                        <td className="border p-1 text-gray-300">-</td>
                        <td className="border p-1 text-teal-700 font-bold">{pVal > 0 ? ((pVal + 0.5) * 4).toFixed(1) : ''}</td>
                        <td className="border p-1">4</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 6. 라벨소요량 */}
        <div className="page-break p-8">
          <div className="print-header-title text-base font-bold text-center mb-4">라벨소요량 집계표</div>
          <div className="print-header-meta text-right mb-2">현장명: {projectTitle}</div>
          <table className="print-table w-full border border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1">No</th>
                <th className="border p-1">제품번호</th>
                <th className="border p-1">가로</th>
                <th className="border p-1">세로</th>
                <th className="border p-1">소켓 Lot</th>
                <th className="border p-1">면적(㎡)</th>
                <th className="border p-1">둘레(m)</th>
                <th className="border p-1">방화소켓(EA)</th>
                <th className="border p-1">글라스울(1EA)</th>
                <th className="border p-1">차열재 25*200 (VM)</th>
                <th className="border p-1">차열재 50*400 (VT)</th>
              </tr>
            </thead>
            <tbody>
              {d?.items?.map((item: any, idx: number) => {
                const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                const area = w > 0 && h > 0 ? ((w * h) / 1000000).toFixed(4) : '0';
                const perimeter = w > 0 && h > 0 ? (((w + h) * 2) / 1000).toFixed(1) : '0';
                const pVal = Number(perimeter);
                const type = getSocketType(item.product_type);
                return (
                  <tr key={item.swi_id} className="text-center">
                    <td className="border p-1 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="border p-1 font-semibold text-gray-700">{item.seq_no}</td>
                    <td className="border p-1 font-mono">{w}</td>
                    <td className="border p-1 font-mono">{h}</td>
                    <td className="border p-1 font-mono text-blue-700 font-bold">{item.insp_lot_no || '-'}</td>
                    <td className="border p-1 font-mono text-gray-600">{area}</td>
                    <td className="border p-1 font-mono text-gray-600">{perimeter}</td>
                    <td className="border p-1">2</td>
                    <td className="border p-1 text-emerald-700 font-semibold">{type === 'VT' && pVal > 0 ? (pVal + 0.5).toFixed(1) : '-'}</td>
                    <td className="border p-1 text-emerald-700 font-semibold">{type === 'VM' && pVal > 0 ? (pVal + 0.5).toFixed(1) : '-'}</td>
                    <td className="border p-1 text-emerald-700 font-semibold">{type === 'VT' && pVal > 0 ? (pVal + 0.5).toFixed(1) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 화면상 상세 모달 창 */}
      <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto no-print">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>
          {/* 헤더 */}
          <div className="flex items-center justify-between p-5 border-b">
            <div>
              <p className="font-mono text-xs text-indigo-600">{swo.swo_number}</p>
              <h2 className="text-base font-bold text-gray-900">{swo.project_name}</h2>
              {swo.warnings && (
                <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />{swo.warnings}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 기본 정보 */}
            <div className="grid grid-cols-4 gap-3 text-sm">
              {[
                { icon: <Building2 className="h-3.5 w-3.5" />, label: '발주처', val: d?.biz_name },
                { icon: <MapPin className="h-3.5 w-3.5" />, label: '시트(동)', val: swo.sheet_name },
                { icon: <Calendar className="h-3.5 w-3.5" />, label: '작업일', val: swo.wo_date?.slice(0,10) },
                { icon: <Calendar className="h-3.5 w-3.5" />, label: '납기일', val: swo.delivery_date?.slice(0,10) },
                { icon: <User className="h-3.5 w-3.5" />, label: '작업자', val: swo.worker },
                { icon: <MapPin className="h-3.5 w-3.5" />, label: '납품지', val: d?.site_address },
                { icon: <User className="h-3.5 w-3.5" />, label: '인수자', val: d?.consignee },
                { icon: <FileText className="h-3.5 w-3.5" />, label: '특기사항', val: d?.po_special_notes },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                    {f.icon}{f.label}
                  </div>
                  <p className="text-xs font-medium text-gray-800 truncate">{f.val || '-'}</p>
                </div>
              ))}
            </div>

            {/* 상태 변경 */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <span className="text-xs font-medium text-gray-600">상태 변경:</span>
              {(['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setEditStatus(s)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                    editStatus === s
                      ? statusConfig[s].bg + ' ' + statusConfig[s].text + ' font-bold ring-2 ring-indigo-300'
                      : 'bg-white border text-gray-500 hover:border-indigo-300',
                  )}
                >
                  {statusConfig[s].label}
                </button>
              ))}
            </div>

            {/* 9개 시트별 분리 탭 네비게이션 및 전용 테이블 */}
            <div className="space-y-3">
              <div className="flex border-b overflow-x-auto gap-1 pb-1 scrollbar-thin">
                {(() => {
                  const getSocketCategoryLocal = (pt: string, st: string): 'RISER' | 'WALL' | 'BUSDUCT' => {
                    const p = (pt || '').toUpperCase();
                    const s = (st || '').toUpperCase();
                    if (p.startsWith('BD') || s.startsWith('BD')) return 'BUSDUCT';
                    if (s.startsWith('H') || p.startsWith('H') || p.includes('HAG') || p.includes('HTG')) return 'RISER';
                    return 'WALL';
                  };

                  let cat: 'RISER' | 'WALL' | 'BUSDUCT' = 'WALL';
                  if (d?.items?.some((it: any) => getSocketCategoryLocal(it.product_type, it.structure) === 'BUSDUCT')) {
                    cat = 'BUSDUCT';
                  } else if (d?.items?.some((it: any) => getSocketCategoryLocal(it.product_type, it.structure) === 'RISER')) {
                    cat = 'RISER';
                  }

                  let tabsList: string[] = [];
                  if (cat === 'RISER') {
                    tabsList = [
                      '1. 소켓인수검사',
                      '2.1 재단(1.69,064)',
                      '3.1 절곡(HTG1.69)(브라켓,보강대,받침대)',
                      '4. 차열재 소켓용 (수정)',
                      '5. 차열재 출하용',
                      '라벨소요량'
                    ];
                  } else if (cat === 'BUSDUCT') {
                    tabsList = [
                      '1. 소켓인수검사',
                      '2.1 방화플래싱 재단 및 가공',
                      '3.1 틈새복합시트(차열재) 재단',
                      '4. 단열재 시공(세라믹 블랭킷)',
                      '5. 라벨소요량'
                    ];
                  } else {
                    tabsList = [
                      '1. 소켓인수검사',
                      '2.재단(VM)작업',
                      '2.1 재단작업(VT)',
                      '차열재 재단(VM,VT)',
                      '3. 1절곡(VM)',
                      '3.2 절곡(VT)',
                      '3.3 절곡(VT-보강대)',
                      '5. 차열재 출하용(VM,VT,VAG)',
                      '6. 라벨소요량'
                    ];
                  }

                  if (tabsList.length > 0 && !tabsList.includes(activeTab)) {
                    setTimeout(() => setActiveTab(tabsList[0]), 0);
                  }

                  return tabsList.map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap rounded-t-lg border-t border-x transition-colors',
                        activeTab === tab
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 bg-gray-50 border-gray-200'
                      )}
                    >
                      {tab}
                    </button>
                  ));
                })()}
              </div>

              <div className="pt-1">
                {activeTab === '1. 소켓인수검사' && (() => {
                  if (!d?.items?.length) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">항목 없음</div>;

                  const STRUCT_COLORS: Record<string, { header: string; border: string; row: string; rowAlt: string; }> = {
                    'V-03':       { header:'bg-slate-700 text-white', border:'border-slate-300', row:'bg-slate-50', rowAlt:'bg-white' },
                    'VS-01':      { header:'bg-stone-600 text-white', border:'border-stone-300', row:'bg-stone-50', rowAlt:'bg-white' },
                    'VT-01':      { header:'bg-blue-700 text-white', border:'border-blue-300', row:'bg-blue-50/60', rowAlt:'bg-blue-50/20' },
                    'VT-049':     { header:'bg-indigo-700 text-white', border:'border-indigo-300', row:'bg-indigo-50/60', rowAlt:'bg-indigo-50/20' },
                    'VT-064':     { header:'bg-violet-700 text-white', border:'border-violet-300', row:'bg-violet-50/60', rowAlt:'bg-violet-50/20' },
                    'VA-064':     { header:'bg-purple-700 text-white', border:'border-purple-300', row:'bg-purple-50/60', rowAlt:'bg-purple-50/20' },
                    'VAG-1.69':   { header:'bg-fuchsia-700 text-white', border:'border-fuchsia-300', row:'bg-fuchsia-50/60', rowAlt:'bg-fuchsia-50/20' },
                    'HAG-1.69':   { header:'bg-pink-700 text-white', border:'border-pink-300', row:'bg-pink-50/60', rowAlt:'bg-pink-50/20' },
                    'HTG(DC)-064':{ header:'bg-rose-700 text-white', border:'border-rose-300', row:'bg-rose-50/60', rowAlt:'bg-rose-50/20' },
                    'HTG-064DC':  { header:'bg-rose-700 text-white', border:'border-rose-300', row:'bg-rose-50/60', rowAlt:'bg-rose-50/20' },
                    'HTG-1.69':   { header:'bg-orange-700 text-white', border:'border-orange-300', row:'bg-orange-50/60', rowAlt:'bg-orange-50/20' },
                    'HTG-064':    { header:'bg-amber-700 text-white', border:'border-amber-300', row:'bg-amber-50/60', rowAlt:'bg-amber-50/20' },
                    'VTI-064':    { header:'bg-yellow-700 text-white', border:'border-yellow-300', row:'bg-yellow-50/60', rowAlt:'bg-yellow-50/20' },
                    'BDCV-1S':    { header:'bg-teal-700 text-white', border:'border-teal-300', row:'bg-teal-50/60', rowAlt:'bg-teal-50/20' },
                    'BDRV-3S':    { header:'bg-cyan-700 text-white', border:'border-cyan-300', row:'bg-cyan-50/60', rowAlt:'bg-cyan-50/20' },
                  };
                  const DEFAULT_COLOR = { header:'bg-gray-600 text-white', border:'border-gray-300', row:'bg-gray-50/60', rowAlt:'bg-white' };

                  const getGroupKey = (item: any) => `${item.construction_seq ?? 1}__${item.product_type || item.structure || '미지정'}`;
                  const groupOrder: string[] = [];
                  const groups: Record<string, any[]> = {};
                  for (const item of d.items) {
                    const key = getGroupKey(item);
                    if (!groups[key]) { groupOrder.push(key); groups[key] = []; }
                    groups[key].push(item);
                  }

                  return (
                    <div className="space-y-3">
                      {groupOrder.map(key => {
                        const [cSeq, ptRaw] = key.split('__');
                        const pt = ptRaw || '미지정';
                        const col = STRUCT_COLORS[pt] || DEFAULT_COLOR;
                        const groupItems = groups[key];
                        const groupTotal = groupItems.length;
                        const groupDone = groupItems.filter((it: any) => (actuals[it.swi_id] ?? 0) >= it.planned_qty).length;

                        return (
                          <div key={key} className={cn('rounded-xl border overflow-hidden', col.border)}>
                            <div className={cn('flex items-center justify-between px-3 py-1.5', col.header)}>
                              <span className="font-bold text-xs">{pt} (소켓인수검사)</span>
                              <span className="text-[10px] opacity-90">{groupDone}/{groupTotal} 완료</span>
                            </div>

                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="bg-gray-50 border-b">
                                  <th className="px-2 py-1 text-left w-10">No</th>
                                  <th className="px-2 py-1 text-center">규격 W×H (mm)</th>
                                  <th className="px-2 py-1 text-center">LOT 번호</th>
                                  <th className="px-2 py-1 text-center w-12">지시</th>
                                  <th className="px-2 py-1 text-center w-16">실적</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupItems.map((item: any, idx: number) => {
                                  const actual = actuals[item.swi_id] ?? 0;
                                  return (
                                    <tr key={item.swi_id} className={idx % 2 === 0 ? col.row : col.rowAlt}>
                                      <td className="px-2 py-1 font-mono text-gray-400">{item.seq_no}</td>
                                      <td className="px-2 py-1 text-center font-mono font-semibold text-gray-800">
                                        {item.pipe_width_mm} × {item.pipe_height_mm}
                                      </td>
                                      <td className="px-2 py-1 text-center font-mono text-xs text-blue-700 font-bold">{item.insp_lot_no || '미부여'}</td>
                                      <td className="px-2 py-1 text-center font-bold text-gray-700">{item.planned_qty}</td>
                                      <td className="px-2 py-1 text-center">
                                        <input
                                          type="number"
                                          min={0}
                                          value={actual}
                                          onChange={e => setActuals(prev => ({ ...prev, [item.swi_id]: parseInt(e.target.value) || 0 }))}
                                          className="w-12 text-center border rounded px-1 text-xs bg-white font-semibold"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {activeTab === '2.재단(VM)작업' && (() => {
                  if (vmItems.length === 0) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">VM 소켓 품목이 없습니다.</div>;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>No</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>구조</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>소켓규격</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>내부재단 (4EA)</th>
                            <th className="px-2 py-1.5" colSpan={2}>외부재단 (2EA)</th>
                          </tr>
                          <tr className="border-t">
                            <th className="px-2 py-1 border-r">가로</th>
                            <th className="px-2 py-1 border-r">세로</th>
                            <th className="px-2 py-1 border-r">가로(-5)</th>
                            <th className="px-2 py-1 border-r">세로(-30)</th>
                            <th className="px-2 py-1 border-r">상하(+60)</th>
                            <th className="px-2 py-1">좌우(세로)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {vmItems.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-bold">{item.product_type}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r text-blue-700 font-semibold">{w > 0 ? w - 5 : '-'}</td>
                                <td className="px-2 py-1.5 border-r text-blue-700 font-semibold">{h > 0 ? h - 30 : '-'}</td>
                                <td className="px-2 py-1.5 border-r text-indigo-700 font-semibold">{w > 0 ? w + 60 : '-'}</td>
                                <td className="px-2 py-1.5 text-indigo-700 font-semibold">{h > 0 ? h : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '2.1 재단작업(VT)' && (() => {
                  if (vtItems.length === 0) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">VT 소켓 품목이 없습니다.</div>;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>No</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>구조</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>소켓규격</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>내부재단 (16EA)</th>
                            <th className="px-2 py-1.5" colSpan={2}>외부재단 (4EA)</th>
                          </tr>
                          <tr className="border-t">
                            <th className="px-2 py-1 border-r">가로</th>
                            <th className="px-2 py-1 border-r">세로</th>
                            <th className="px-2 py-1 border-r">(가로-40)/2</th>
                            <th className="px-2 py-1 border-r">(세로-40)/2</th>
                            <th className="px-2 py-1 border-r">상하(+60)</th>
                            <th className="px-2 py-1">좌우(세로)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {vtItems.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-blue-50/10' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-blue-800">{item.product_type}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r text-blue-700 font-semibold">{w > 0 ? (w - 40) / 2 : '-'}</td>
                                <td className="px-2 py-1.5 border-r text-blue-700 font-semibold">{h > 0 ? (h - 40) / 2 : '-'}</td>
                                <td className="px-2 py-1.5 border-r text-indigo-700 font-semibold">{w > 0 ? w + 60 : '-'}</td>
                                <td className="px-2 py-1.5 text-indigo-700 font-semibold">{h > 0 ? h : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '차열재 재단(VM,VT)' && (() => {
                  if (!d?.items?.length) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">항목 없음</div>;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>No</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>구조</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>소켓규격</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>외부 차열재 상하</th>
                            <th className="px-2 py-1" colSpan={2}>외부 차열재 좌우</th>
                          </tr>
                          <tr className="border-t">
                            <th className="px-2 py-1 border-r">가로</th>
                            <th className="px-2 py-1 border-r">세로</th>
                            <th className="px-2 py-1 border-r">상하(+60)</th>
                            <th className="px-2 py-1 border-r">수량</th>
                            <th className="px-2 py-1 border-r">좌우(세로)</th>
                            <th className="px-2 py-1">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            const isVm = getSocketType(item.product_type) === 'VM';
                            const qty = isVm ? 2 : 4;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-bold">{item.product_type}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r text-rose-700 font-semibold">{w > 0 ? w + 60 : '-'}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-gray-700">{qty}</td>
                                <td className="px-2 py-1.5 border-r text-rose-700 font-semibold">{h > 0 ? h : '-'}</td>
                                <td className="px-2 py-1.5 font-bold text-gray-700">{qty}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* ─── RISER 입상 재단 및 절곡 탭 ─── */}
                {activeTab === '2.1 재단(1.69,064)' && (() => {
                  if (!d?.items?.length) return null;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r">No</th>
                            <th className="px-2 py-1.5 border-r">구조/모델</th>
                            <th className="px-2 py-1.5 border-r">가로(W)</th>
                            <th className="px-2 py-1.5 border-r">세로(H)</th>
                            <th className="px-2 py-1.5 border-r">검사 LOT</th>
                            <th className="px-2 py-1.5 border-r text-blue-700">A부재 가로재단(W-5)</th>
                            <th className="px-2 py-1.5 border-r">A부재 수량(6개)</th>
                            <th className="px-2 py-1.5 border-r text-teal-700">B부재 세로재단(H-35)</th>
                            <th className="px-2 py-1.5 border-r">B부재 수량(6개)</th>
                            <th className="px-2 py-1">높이</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-medium">{item.product_type || item.structure}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r">{item.insp_lot_no || '-'}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-blue-700">{w > 0 ? w - 5 : '-'}</td>
                                <td className="px-2 py-1.5 border-r font-semibold">6</td>
                                <td className="px-2 py-1.5 border-r font-bold text-teal-700">{h > 0 ? h - 35 : '-'}</td>
                                <td className="px-2 py-1.5 border-r font-semibold">6</td>
                                <td className="px-2 py-1.5 font-mono">255</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '3.1 절곡(HTG1.69)(브라켓,보강대,받침대)' && (() => {
                  if (!d?.items?.length) return null;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r">No</th>
                            <th className="px-2 py-1.5 border-r">가로(W)</th>
                            <th className="px-2 py-1.5 border-r">세로(H)</th>
                            <th className="px-2 py-1.5 border-r">검사 LOT</th>
                            <th className="px-2 py-1.5 border-r text-indigo-700">받침대/브라켓 가로(W-5)</th>
                            <th className="px-2 py-1.5 border-r">절곡규격(mm)</th>
                            <th className="px-2 py-1">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r">{item.insp_lot_no || '-'}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-indigo-700">{w > 0 ? w - 5 : '-'}</td>
                                <td className="px-2 py-1.5 border-r">23 - 23</td>
                                <td className="px-2 py-1 font-semibold">2</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '4. 차열재 소켓용 (수정)' && (() => {
                  if (!d?.items?.length) return null;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r">No</th>
                            <th className="px-2 py-1.5 border-r">구조/모델</th>
                            <th className="px-2 py-1.5 border-r">가로(W)</th>
                            <th className="px-2 py-1.5 border-r">세로(H)</th>
                            <th className="px-2 py-1.5 border-r text-blue-700">가로재단(W+60)</th>
                            <th className="px-2 py-1.5 border-r">수량</th>
                            <th className="px-2 py-1.5 border-r text-teal-700">세로재단(H)</th>
                            <th className="px-2 py-1">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-medium">{item.product_type || item.structure}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-blue-700">{w > 0 ? w + 60 : '-'}</td>
                                <td className="px-2 py-1.5 border-r font-semibold">2</td>
                                <td className="px-2 py-1.5 border-r font-bold text-teal-700">{h > 0 ? h : '-'}</td>
                                <td className="px-2 py-1 font-semibold">2</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* ─── BUSDUCT 부스덕트 전용 탭 ─── */}
                {activeTab === '2.1 방화플래싱 재단 및 가공' && (() => {
                  if (!d?.items?.length) return null;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r">No</th>
                            <th className="px-2 py-1.5 border-r">모델/유형</th>
                            <th className="px-2 py-1.5 border-r">재질</th>
                            <th className="px-2 py-1.5 border-r">가로재단 길이</th>
                            <th className="px-2 py-1.5 border-r">세로재단 너비</th>
                            <th className="px-2 py-1.5 border-r">두께 기준</th>
                            <th className="px-2 py-1">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => {
                            const pt = (item.product_type || '').toUpperCase();
                            const isCv = pt.includes('CV');
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-medium">{item.product_type || item.structure}</td>
                                <td className="px-2 py-1.5 border-r">{isCv ? 'SUS (스테인리스)' : 'GI (아연도금강판)'}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-indigo-700">{isCv ? '380 mm' : '1,000 mm'}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-indigo-700">{isCv ? '190 mm' : '175 mm'}</td>
                                <td className="px-2 py-1.5 border-r text-gray-500">{isCv ? '0.5T 이상' : '1.0T 이상'}</td>
                                <td className="px-2 py-1 font-semibold">1</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '3.1 틈새복합시트(차열재) 재단' && (() => {
                  if (!d?.items?.length) return null;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r">No</th>
                            <th className="px-2 py-1.5 border-r">모델/유형</th>
                            <th className="px-2 py-1.5 border-r">차열시트 가로</th>
                            <th className="px-2 py-1.5 border-r">차열시트 세로</th>
                            <th className="px-2 py-1.5 border-r">두께(mm)</th>
                            <th className="px-2 py-1.5 border-r">수량(개)</th>
                            <th className="px-2 py-1">비고</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => {
                            const pt = (item.product_type || '').toUpperCase();
                            const isCv = pt.includes('CV');
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-medium">{item.product_type || item.structure}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-teal-700">{isCv ? '150H 복합' : '1,000 mm'}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-teal-700">{isCv ? '외경비례' : '125 mm'}</td>
                                <td className="px-2 py-1.5 border-r">{isCv ? '5.5' : '5.0'}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-indigo-600">{isCv ? '1' : '2'}</td>
                                <td className="px-2 py-1 text-gray-500 text-left text-xs">{isCv ? '외경 200파이 이하용' : '상/하부 밀도 1.2g/㎤ 이상'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '4. 단열재 시공(세라믹 블랭킷)' && (() => {
                  if (!d?.items?.length) return null;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r">No</th>
                            <th className="px-2 py-1.5 border-r">모델/유형</th>
                            <th className="px-2 py-1.5 border-r">단열재 종류</th>
                            <th className="px-2 py-1.5 border-r">밀도 기준</th>
                            <th className="px-2 py-1.5 border-r">너비 기준</th>
                            <th className="px-2 py-1.5 border-r">두께 기준</th>
                            <th className="px-2 py-1">고정 방식</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => (
                            <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                              <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                              <td className="px-2 py-1.5 border-r font-medium">{item.product_type || item.structure}</td>
                              <td className="px-2 py-1.5 border-r">세라믹 섬유 블랭킷</td>
                              <td className="px-2 py-1.5 border-r">96 kg/㎥ 이상</td>
                              <td className="px-2 py-1.5 border-r font-bold text-indigo-700">600 mm</td>
                              <td className="px-2 py-1.5 border-r font-bold text-indigo-700">25 ㎜ 이상</td>
                              <td className="px-2 py-1">양면 대칭 철사 고정</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '3. 1절곡(VM)' && (() => {
                  if (vmItems.length === 0) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">VM 소켓 품목이 없습니다.</div>;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>No</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>소켓규격</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>수량</th>
                            <th className="px-2 py-1.5" colSpan={3}>평철 절곡 규격 (VM)</th>
                          </tr>
                          <tr className="border-t">
                            <th className="px-2 py-1 border-r">가로</th>
                            <th className="px-2 py-1 border-r">세로</th>
                            <th className="px-2 py-1 border-r">평철가로(가로-1)</th>
                            <th className="px-2 py-1 border-r">평철세로(세로-30)</th>
                            <th className="px-2 py-1">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {vmItems.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r font-bold">1</td>
                                <td className="px-2 py-1.5 border-r text-orange-700 font-bold">{w > 0 ? w - 1 : '-'}</td>
                                <td className="px-2 py-1.5 border-r text-orange-700 font-bold">{h > 0 ? h - 30 : '-'}</td>
                                <td className="px-2 py-1.5 text-gray-700">각 4EA</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '3.2 절곡(VT)' && (() => {
                  if (vtItems.length === 0) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">VT 소켓 품목이 없습니다.</div>;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>No</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>소켓규격</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>수량</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>평철폭</th>
                            <th className="px-2 py-1.5" colSpan={3}>평철 절곡 규격 (VT 브라켓)</th>
                          </tr>
                          <tr className="border-t">
                            <th className="px-2 py-1 border-r">가로</th>
                            <th className="px-2 py-1 border-r">세로</th>
                            <th className="px-2 py-1 border-r">가로 (가로-40)/2 + 4</th>
                            <th className="px-2 py-1 border-r">세로 (세로-40)/2 - 1</th>
                            <th className="px-2 py-1">수량합계</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {vtItems.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-blue-50/10' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r font-bold">1</td>
                                <td className="px-2 py-1.5 border-r text-gray-600">60mm</td>
                                <td className="px-2 py-1.5 border-r text-orange-700 font-bold">{w > 0 ? (w - 40) / 2 + 4 : '-'} (16EA)</td>
                                <td className="px-2 py-1.5 border-r text-orange-700 font-bold">{h > 0 ? (h - 40) / 2 - 1 : '-'} (32EA)</td>
                                <td className="px-2 py-1.5 text-gray-800 font-bold">32EA</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '3.3 절곡(VT-보강대)' && (() => {
                  if (vtItems.length === 0) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">VT 소켓 품목이 없습니다.</div>;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>No</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>소켓규격</th>
                            <th className="px-2 py-1.5 border-r" colSpan={3}>평철 가로 (받침대)</th>
                            <th className="px-2 py-1" colSpan={3}>평철 세로 (보강대)</th>
                          </tr>
                          <tr className="border-t">
                            <th className="px-2 py-1 border-r">가로</th>
                            <th className="px-2 py-1 border-r">세로</th>
                            <th className="px-2 py-1 border-r">폭</th>
                            <th className="px-2 py-1 border-r">규격 (가로-40)/2 + 4</th>
                            <th className="px-2 py-1 border-r">수량</th>
                            <th className="px-2 py-1 border-r">폭</th>
                            <th className="px-2 py-1 border-r">규격 (세로)</th>
                            <th className="px-2 py-1">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {vtItems.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-blue-50/10' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r text-gray-500">225</td>
                                <td className="px-2 py-1.5 border-r text-amber-700 font-bold">{w > 0 ? (w - 40) / 2 + 4 : '-'}</td>
                                <td className="px-2 py-1.5 border-r text-gray-700 font-semibold">8EA</td>
                                <td className="px-2 py-1.5 border-r text-gray-500">237</td>
                                <td className="px-2 py-1.5 border-r text-amber-700 font-bold">{h > 0 ? h : '-'}</td>
                                <td className="px-2 py-1.5 text-gray-700 font-semibold">4EA</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '5. 차열재 출하용(VM,VT,VAG)' && (() => {
                  if (!d?.items?.length) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">항목 없음</div>;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>No</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>소켓규격</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>구조</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>면적(㎡)</th>
                            <th className="px-2 py-1.5 border-r" rowSpan={2}>둘레(m)</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>글라스울 25*1400</th>
                            <th className="px-2 py-1.5 border-r" colSpan={2}>차열재 50*400(VT)</th>
                            <th className="px-2 py-1" colSpan={2}>차열재 25*200(VM)</th>
                          </tr>
                          <tr className="border-t">
                            <th className="px-2 py-1 border-r">가로</th>
                            <th className="px-2 py-1 border-r">세로</th>
                            <th className="px-2 py-1 border-r">소요 (둘레+0.5)</th>
                            <th className="px-2 py-1 border-r">수량</th>
                            <th className="px-2 py-1 border-r">소요 (둘레+0.5)</th>
                            <th className="px-2 py-1 border-r">수량</th>
                            <th className="px-2 py-1 border-r">소요 (둘레+0.5)x4</th>
                            <th className="px-2 py-1">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            const area = w > 0 && h > 0 ? ((w * h) / 1000000).toFixed(4) : '0';
                            const perimeter = w > 0 && h > 0 ? (((w + h) * 2) / 1000).toFixed(1) : '0';
                            const pVal = Number(perimeter);
                            const type = getSocketType(item.product_type);
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r font-bold">{item.product_type}</td>
                                <td className="px-2 py-1.5 border-r font-mono text-gray-700">{area}</td>
                                <td className="px-2 py-1.5 border-r font-mono text-gray-700">{perimeter}</td>
                                {type === 'VT' ? (
                                  <>
                                    <td className="px-2 py-1.5 border-r text-teal-700 font-bold">{pVal > 0 ? (pVal + 0.5).toFixed(1) : '-'}</td>
                                    <td className="px-2 py-1.5 border-r">1</td>
                                    <td className="px-2 py-1.5 border-r text-teal-700 font-bold">{pVal > 0 ? (pVal + 0.5).toFixed(1) : '-'}</td>
                                    <td className="px-2 py-1.5 border-r">4</td>
                                    <td className="px-2 py-1.5 border-r text-gray-300">-</td>
                                    <td className="px-2 py-1 text-gray-300">-</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-2 py-1.5 border-r text-gray-300">-</td>
                                    <td className="px-2 py-1.5 border-r text-gray-300">-</td>
                                    <td className="px-2 py-1.5 border-r text-gray-300">-</td>
                                    <td className="px-2 py-1.5 border-r text-gray-300">-</td>
                                    <td className="px-2 py-1.5 border-r text-teal-700 font-bold">{pVal > 0 ? ((pVal + 0.5) * 4).toFixed(1) : '-'}</td>
                                    <td className="px-2 py-1">4</td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {activeTab === '6. 라벨소요량' && (() => {
                  if (!d?.items?.length) return <div className="text-center py-6 text-gray-400 text-xs border rounded-xl">項目 없음</div>;
                  return (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 border-r">No</th>
                            <th className="px-2 py-1.5 border-r">제품번호</th>
                            <th className="px-2 py-1.5 border-r">가로</th>
                            <th className="px-2 py-1.5 border-r">세로</th>
                            <th className="px-2 py-1.5 border-r">소켓 Lot</th>
                            <th className="px-2 py-1.5 border-r">면적(㎡)</th>
                            <th className="px-2 py-1.5 border-r">둘레(m)</th>
                            <th className="px-2 py-1.5 border-r">방화소켓</th>
                            <th className="px-2 py-1 border-r">글라스울(1EA)</th>
                            <th className="px-2 py-1 border-r">차열재(4EA) VM</th>
                            <th className="px-2 py-1">차열재(4EA) VT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {d.items.map((item: any, idx: number) => {
                            const w = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
                            const h = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
                            const area = w > 0 && h > 0 ? ((w * h) / 1000000).toFixed(4) : '0';
                            const perimeter = w > 0 && h > 0 ? (((w + h) * 2) / 1000).toFixed(1) : '0';
                            const pVal = Number(perimeter);
                            const type = getSocketType(item.product_type);
                            return (
                              <tr key={item.swi_id} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="px-2 py-1.5 border-r font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 border-r font-semibold text-gray-700">{item.seq_no}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{w}</td>
                                <td className="px-2 py-1.5 border-r font-mono">{h}</td>
                                <td className="px-2 py-1.5 border-r font-mono text-blue-700 font-bold">{item.insp_lot_no || '-'}</td>
                                <td className="px-2 py-1.5 border-r font-mono text-gray-600">{area}</td>
                                <td className="px-2 py-1.5 border-r font-mono text-gray-600">{perimeter}</td>
                                <td className="px-2 py-1.5 border-r font-bold text-indigo-600">2</td>
                                <td className="px-2 py-1.5 border-r text-emerald-700 font-medium">{type === 'VT' && pVal > 0 ? (pVal + 0.5).toFixed(1) : '-'}</td>
                                <td className="px-2 py-1.5 border-r text-emerald-700 font-medium">{type === 'VM' && pVal > 0 ? (pVal + 0.5).toFixed(1) : '-'}</td>
                                <td className="px-2 py-1.5 text-emerald-700 font-medium">{type === 'VT' && pVal > 0 ? (pVal + 0.5).toFixed(1) : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-2xl no-print">
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-xs border rounded-lg text-gray-500 hover:bg-gray-100 bg-white">
                닫기
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="px-4 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-1.5 shadow-sm"
              >
                📥 엑셀 다운로드
              </button>
              <button
                type="button"
                onClick={handlePrintPDF}
                className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-1.5 shadow-sm"
              >
                🖨️ PDF 인쇄
              </button>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold disabled:opacity-50"
            >
              {saving ? '저장 중...' : '실적 저장'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
