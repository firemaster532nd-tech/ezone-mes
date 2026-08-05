import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Monitor, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { printHtmlViaQzTray } from '@/lib/qzTrayPrinter';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  printerName?: string;
}

export function PrintPreviewModal({ isOpen, onClose, htmlContent, printerName }: PrintPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [qzPrinting, setQzPrinting] = useState(false);

  useEffect(() => {
    if (isOpen && iframeRef.current && htmlContent) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    }
  }, [isOpen, htmlContent]);

  if (!isOpen) return null;

  // ① QZ Tray 전송 (고덱스 직접 전송) — 실패 시 toast만 표시
  const handleQzPrint = async () => {
    setQzPrinting(true);
    try {
      toast.info('고덱스 프린터로 전송 중...');
      await printHtmlViaQzTray(htmlContent, printerName);
      toast.success('✅ 인쇄 완료!');
      onClose();
    } catch (err: any) {
      toast.error(`QZ Tray 오류: ${err.message || 'QZ Tray가 실행 중인지 확인하세요.'}`);
    } finally {
      setQzPrinting(false);
    }
  };

  // ② 브라우저 기본 인쇄 — 새 창으로 열어서 @page / page-break 정상 적용
  const handleBrowserPrint = () => {
    const w = window.open('', '_blank', 'width=600,height=500');
    if (w) {
      w.document.open();
      w.document.write(htmlContent);
      w.document.close();
      setTimeout(() => {
        w.focus();
        w.print();
      }, 500);
    } else {
      // 팝업 차단 시 iframe fallback
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } else {
        toast.error('팝업이 차단되어 있습니다. 브라우저 팝업 허용 후 다시 시도하세요.');
      }
    }
  };


  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold flex items-center gap-2 text-slate-800">
            <Printer className="h-5 w-5 text-indigo-600" />
            라벨 인쇄 미리보기
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 미리보기 영역 */}
        <div className="p-8 bg-slate-200 flex flex-col items-center justify-center overflow-auto min-h-[300px] relative">
          <p className="absolute top-3 left-0 w-full text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-1">
            <AlertTriangle className="h-3 w-3" /> 실제 80×60mm 감열지 출력 레이아웃
          </p>

          <div
            className="bg-white shadow-lg overflow-hidden"
            style={{ width: '80mm', height: '60mm', border: '1px solid #ccc' }}
          >
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0 bg-white pointer-events-none"
              title="Print Preview Area"
            />
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="p-4 border-t bg-slate-50 space-y-2">
          {/* 두 인쇄 버튼 나란히 */}
          <div className="flex gap-2">
            {/* 브라우저 기본 인쇄 — 항상 동작 */}
            <button
              onClick={handleBrowserPrint}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Monitor className="h-4 w-4" />
              브라우저 인쇄
            </button>

            {/* QZ Tray 직접 전송 */}
            <button
              onClick={handleQzPrint}
              disabled={qzPrinting}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Printer className="h-4 w-4" />
              {qzPrinting ? '전송 중...' : '고덱스 직접 인쇄'}
            </button>
          </div>

          {/* QZ Tray 안내 */}
          <p className="text-[10px] text-slate-400 text-center">
            💡 고덱스 직접 인쇄가 안 되면 <b>브라우저 인쇄</b>를 사용하세요 (QZ Tray 실행 필요)
          </p>

          <button
            onClick={onClose}
            className="w-full py-1.5 text-slate-500 hover:text-slate-700 text-xs font-bold transition-colors"
          >
            취소 (닫기)
          </button>
        </div>
      </div>
    </div>
  );
}
