import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { 
  FileSpreadsheet, Upload, Link2, AlertTriangle, 
  CheckCircle2, RefreshCw, ChevronRight, HelpCircle, Save,
  Layers, Package, Check, Database
} from 'lucide-react';
import { toast } from 'sonner';

interface ItemMaster {
  item_id: number;
  item_code: string;
  item_name: string;
  item_category: 'RM' | 'SM' | 'SA' | 'FP';
  spec: string | null;
  unit: string;
}

interface ColumnMapping {
  txn_date: string;
  txn_type: string;
  qty: string;
  lot_number: string;
  source_lot: string;
  linked_lot: string;
  purpose: string;
  issuer_name: string;
  verifier_name: string;
  remarks: string;
}

export function InventoryImportPage() {
  const { isAdmin } = useAuth();
  
  // 탭 상태: 'file' (엑셀 업로드), 'google' (구글 시트)
  const [activeTab, setActiveTab] = useState<'file' | 'google'>('file');
  
  // 수불 모드: 'assembly_log' (조립 수불표), 'finished_ledger' (완제품 수불현황)
  const [importMode, setImportMode] = useState<'assembly_log' | 'finished_ledger'>('finished_ledger');
  
  // Google Sheets URL
  const [googleUrl, setGoogleUrl] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  
  // XLSX Workbook 및 데이터 상태
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[][]>([]);
  
  // 아이템 리스트 (품목 코드 자동 매핑용)
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [defaultItemCode, setDefaultItemCode] = useState<string>('');
  
  // 컬럼 매핑 상태
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    txn_date: '',
    txn_type: '',
    qty: '',
    lot_number: '',
    source_lot: '',
    linked_lot: '',
    purpose: '',
    issuer_name: '',
    verifier_name: '',
    remarks: '',
  });

  // 최종 변환 데이터 및 로딩 상태
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 1. 품목 마스터 조회
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ data: ItemMaster[] }>('/items');
        setItems(res.data || []);
      } catch {
        toast.error('품목 마스터 목록을 불러오지 못했습니다.');
      }
    })();
  }, []);

  // 2. 엑셀 파일 로컬 파싱 (Tab 1)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        if (wb.SheetNames.length > 0) {
          // 'Sheet' 대시보드 탭 제외하고 첫 데이터 탭 자동 선택
          const firstDataSheet = wb.SheetNames.find(name => name !== 'Sheet') || wb.SheetNames[0];
          setActiveSheet(firstDataSheet);
        }
        toast.success(`엑셀 파일 파싱 성공! (시트 수: ${wb.SheetNames.length})`);
      } catch (err) {
        toast.error('엑셀 파일 분석 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // 3. 구글 시트 연동 프록시 호출 (Tab 2)
  const handleLoadGoogleSheet = async () => {
    if (!googleUrl) {
      toast.error('Google Sheet 공유 URL을 입력하세요.');
      return;
    }
    setLoadingGoogle(true);
    try {
      // 프록시 API 호출하여 xlsx 파일 바이너리 다운로드
      const res = await fetch(`/api/inventory/google-sheet-proxy?url=${encodeURIComponent(googleUrl)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ezone_mes_token')}`
        }
      });
      if (!res.ok) throw new Error('구글 시트 프록시 호출 실패');
      
      const buffer = await res.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      if (wb.SheetNames.length > 0) {
        const firstDataSheet = wb.SheetNames.find(name => name !== 'Sheet') || wb.SheetNames[0];
        setActiveSheet(firstDataSheet);
      }
      toast.success('구글 스프레드시트 연동 완료!');
    } catch (err: any) {
      toast.error(err.message || '구글 시트 연동에 실패했습니다. 공유 설정을 확인해주세요.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  // Drag & Drop 처리
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  // 4. 활성 시트 변경 시 데이터 읽기 & 헤더 자동 추출
  useEffect(() => {
    if (!workbook || !activeSheet) return;
    const sheet = workbook.Sheets[activeSheet];
    if (!sheet) return;

    // 시트를 이중 배열(행-열)로 변환
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const rows: any[][] = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row: any[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        row.push(cell ? cell.v : '');
      }
      rows.push(row);
    }

    setRawRows(rows);

    // 헤더 행 자동 감지 (No., No, 일자, 작업일지 일자 등이 있는 행을 헤더로 사용)
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(rows.length, 12); r++) {
      const row = rows[r];
      if (row.some(val => {
        const str = String(val).trim();
        return str === 'No.' || str === 'No' || str === '일자' || str === '작업일지 일자' || str === 'No.';
      })) {
        headerRowIdx = r;
        break;
      }
    }

    const detectedHeaders = rows[headerRowIdx]?.map(h => String(h).trim()).filter(h => h !== '') || [];
    setHeaders(detectedHeaders);

    // 자동 컬럼 매핑 추측
    const defaultMapping: ColumnMapping = {
      txn_date: '', txn_type: '', qty: '', lot_number: '',
      source_lot: '', linked_lot: '', purpose: '', issuer_name: '', verifier_name: '', remarks: ''
    };

    detectedHeaders.forEach(h => {
      const clean = h.replace(/\s+/g, '');
      if (clean.includes('일자') || clean.includes('날짜')) defaultMapping.txn_date = h;
      else if (clean === '구분' || clean.includes('입출고')) defaultMapping.txn_type = h;
      else if (clean.includes('수량')) defaultMapping.qty = h;
      else if (clean.includes('조립LOT') || clean === '조립LOT번호') defaultMapping.lot_number = h;
      else if (clean.includes('소켓LOT') || clean.includes('소켓/플래싱LOT') || clean.includes('시트LOT')) defaultMapping.source_lot = h;
      else if (clean.includes('출하LOT')) defaultMapping.linked_lot = h;
      else if (clean.includes('출하처') || clean.includes('용도') || clean.includes('현장명')) defaultMapping.purpose = h;
      else if (clean === '작업자') defaultMapping.issuer_name = h;
      else if (clean === '담당자' || clean === '검증자' || clean === '확인자') defaultMapping.verifier_name = h;
      else if (clean === '비고') defaultMapping.remarks = h;
    });

    setMapping(defaultMapping);

    // 스마트 품목 자동 해결: 시트 이름에서 매칭
    const cleanSheet = activeSheet.replace(/\s+/g, '');
    let matchedItem = '';
    
    // 예: 소켓(VT-01) -> 'VT-01' 매칭
    const vtMatch = cleanSheet.match(/VT-[0-9]+/i);
    const vaMatch = cleanSheet.match(/VA-[0-9]+/i);
    const htgMatch = cleanSheet.match(/HTG-[0-9.]+/i);
    const flMatch = cleanSheet.match(/플래싱/);

    if (vtMatch) matchedItem = vtMatch[0];
    else if (vaMatch) matchedItem = vaMatch[0];
    else if (htgMatch) matchedItem = htgMatch[0];
    
    const matched = items.find(it => 
      it.item_code.toUpperCase().includes(matchedItem.toUpperCase()) ||
      it.item_name.toUpperCase().includes(cleanSheet.toUpperCase())
    );

    if (matched) {
      setDefaultItemCode(matched.item_code);
    } else {
      // 매칭 안될 경우 완제품 카테고리 첫 제품
      const fp = items.find(it => it.item_category === 'FP');
      if (fp) setDefaultItemCode(fp.item_code);
    }

  }, [workbook, activeSheet, items]);

  // 5. 파싱한 데이터 행 추출 및 매핑 적용
  const getMappedRecords = useCallback(() => {
    if (rawRows.length === 0) return [];
    
    // 헤더 인덱스 찾기
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
      const row = rawRows[r];
      if (row.some(val => {
        const str = String(val).trim();
        return str === 'No.' || str === 'No' || str === '일자' || str === '작업일지 일자';
      })) {
        headerRowIdx = r;
        break;
      }
    }

    const headerRow = rawRows[headerRowIdx];
    const dataRows = rawRows.slice(headerRowIdx + 1);

    // 컬럼명 → 인덱스 맵 생성
    const colIdx: Record<string, number> = {};
    headerRow.forEach((h, idx) => {
      colIdx[String(h).trim()] = idx;
    });

    const getVal = (row: any[], field: keyof ColumnMapping): string => {
      const colName = mapping[field];
      if (!colName) return '';
      const idx = colIdx[colName];
      if (idx === undefined) return '';
      return String(row[idx] ?? '').trim();
    };

    return dataRows
      .filter(row => {
        // 일자가 없거나 'YY.MM.DD' 등 가이드 행은 제외
        const dateVal = getVal(row, 'txn_date');
        if (!dateVal || dateVal.includes('YY') || dateVal.includes('일자')) return false;
        
        // 수량도 숫자로 포맷되지 않은 가이드 행 제외
        const qtyVal = getVal(row, 'qty');
        if (qtyVal === '' || isNaN(Number(qtyVal))) return false;

        return true;
      })
      .map((row, idx) => {
        // 1. 날짜 처리 (엑셀 날짜 일련번호 vs YY.MM.DD 등 처리)
        let parsedDate = getVal(row, 'txn_date');
        if (!isNaN(Number(parsedDate))) {
          // Excel Date Serial
          const date = new Date(Math.round((Number(parsedDate) - 25569) * 86400 * 1000));
          parsedDate = date.toISOString().split('T')[0];
        } else {
          // '26.05.11' 혹은 '260511' 처리
          const cleanDate = parsedDate.replace(/[^0-9]/g, '');
          if (cleanDate.length === 6) {
            parsedDate = `20${cleanDate.substring(0, 2)}-${cleanDate.substring(2, 4)}-${cleanDate.substring(4, 6)}`;
          } else if (cleanDate.length === 8) {
            parsedDate = `${cleanDate.substring(0, 4)}-${cleanDate.substring(4, 6)}-${cleanDate.substring(6, 8)}`;
          }
        }

        // 2. 구분 처리 (구분이 없으면 기본 'IN' 조립, 출고/출하 글자 감지)
        let txnType: 'IN' | 'OUT' = 'IN';
        const typeStr = getVal(row, 'txn_type');
        if (typeStr.includes('출고') || typeStr.includes('출하') || typeStr.includes('OUT')) {
          txnType = 'OUT';
        }

        // 3. 품목 코드 찾기
        // 조립 수불대장인 경우, 규격컬럼이 있으면 규격을 통해 반제품(SA) 매칭 시도
        let resolvedItemCode = defaultItemCode;
        if (importMode === 'assembly_log') {
          // 조립은 기본적으로 반제품(SA) 카테고리
          const specVal = row[colIdx['규격'] ?? -1] || '';
          const matchBySpec = items.find(it => it.item_category === 'SA' && it.spec === specVal);
          if (matchBySpec) {
            resolvedItemCode = matchBySpec.item_code;
          }
        }

        return {
          id: idx,
          txn_date: parsedDate,
          item_code: resolvedItemCode,
          txn_type: txnType,
          qty: Number(getVal(row, 'qty')),
          lot_number: getVal(row, 'lot_number') || getVal(row, 'source_lot'), // 조립은 소켓LOT가 LOT번호
          source_lot: getVal(row, 'source_lot'),
          linked_lot: getVal(row, 'linked_lot'),
          purpose: getVal(row, 'purpose'),
          issuer_name: getVal(row, 'issuer_name'),
          verifier_name: getVal(row, 'verifier_name'),
          remarks: getVal(row, 'remarks'),
        };
      });
  }, [rawRows, mapping, defaultItemCode, importMode, items]);

  const mappedRecords = getMappedRecords();

  // 6. DB 일괄 저장 반영
  const handleImportToDatabase = async () => {
    if (mappedRecords.length === 0) {
      toast.error('반영할 데이터 레코드가 없습니다.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api.post<{ success: boolean; count: number }>('/inventory/import-excel', {
        importType: importMode,
        records: mappedRecords.map(r => ({
          txn_date: r.txn_date,
          item_code: r.item_code,
          txn_type: r.txn_type,
          qty: r.qty,
          lot_number: r.lot_number,
          source_lot: r.source_lot,
          linked_lot: r.linked_lot,
          purpose: r.purpose,
          issuer_name: r.issuer_name,
          verifier_name: r.verifier_name,
          remarks: r.remarks,
        }))
      });
      
      if (res.success) {
        toast.success(`ERP 반영 완료! (수불 거래 ${res.count}건이 완벽히 입력되었습니다.)`);
        // 상태 초기화
        setWorkbook(null);
        setRawRows([]);
      }
    } catch (err: any) {
      toast.error(err?.body?.message || '데이터베이스 반영에 실패했습니다. 데이터를 다시 확인해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">관리자 계정만 수불대장 엑셀 연동이 가능합니다.</div>;
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" /> 수불대장 연동 (엑셀 / 구글 시트)
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            이카운트 ERP 스타일의 대량 데이터 수불 반영기입니다. 조립 생산 수불표 또는 완제품 수불대장을 데이터베이스에 원자적(Transaction)으로 통합합니다.
          </p>
        </div>
      </div>

      {/* 2-Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('file'); setWorkbook(null); }}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'file' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Upload className="h-4 w-4" /> 엑셀 파일 업로드
        </button>
        <button
          onClick={() => { setActiveTab('google'); setWorkbook(null); }}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'google' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Link2 className="h-4 w-4" /> 구글 시트 연동
        </button>
      </div>

      {/* Tab Contents */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        {activeTab === 'file' ? (
          /* Tab 1: Excel File Selector Drag & Drop */
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50 hover:bg-blue-50/20 transition-colors cursor-pointer relative"
          >
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileSpreadsheet className="h-12 w-12 text-gray-400 mb-3" />
            <span className="text-sm font-medium text-gray-700">엑셀 파일을 끌어다 놓거나 클릭하여 선택하세요</span>
            <span className="text-xs text-gray-400 mt-1">xls, xlsx 포맷 지원 (최대 50MB)</span>
          </div>
        ) : (
          /* Tab 2: Google Sheets URL Sync */
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">구글 스프레드시트 공유 URL *</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={googleUrl}
                  onChange={(e) => setGoogleUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleLoadGoogleSheet}
                  disabled={loadingGoogle}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-1.5"
                >
                  {loadingGoogle ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  시트 불러오기
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <div>
                <strong>필독:</strong> 스프레드시트 공유 권한이 <strong>"링크가 있는 모든 사용자에게 조회 허용"</strong>으로 설정되어 있어야 원활히 파싱할 수 있습니다.
              </div>
            </div>
          </div>
        )}
      </div>

      {workbook && (
        <>
          {/* Sheet Selector & Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            <aside className="rounded-xl border bg-white p-4 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">1. 데이터 시트 선택</h3>
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                  {sheetNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => setActiveSheet(name)}
                      className={`flex w-full items-center justify-between rounded px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors ${
                        activeSheet === name 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'text-gray-700'
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      {activeSheet === name && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">2. 수불 포맷 선택</h3>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-gray-50 text-xs">
                    <input 
                      type="radio" 
                      name="importMode" 
                      checked={importMode === 'finished_ledger'}
                      onChange={() => setImportMode('finished_ledger')}
                      className="h-3.5 w-3.5"
                    />
                    <div>
                      <span className="font-semibold text-gray-800 block">완제품 수불현황</span>
                      <span className="text-[10px] text-gray-400">입고 및 출하 완제품 로그</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-gray-50 text-xs">
                    <input 
                      type="radio" 
                      name="importMode"
                      checked={importMode === 'assembly_log'}
                      onChange={() => setImportMode('assembly_log')}
                      className="h-3.5 w-3.5"
                    />
                    <div>
                      <span className="font-semibold text-gray-800 block">조립 수불표 (일지)</span>
                      <span className="text-[10px] text-gray-400">조립 생산 / 원부자재 투입 로그</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">3. 기준 품목 지정</h3>
                <p className="text-[10px] text-gray-400 mb-2">시트 데이터를 일치시킬 품목 코드입니다.</p>
                <select
                  value={defaultItemCode}
                  onChange={(e) => setDefaultItemCode(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                >
                  {items.map(it => (
                    <option key={it.item_id} value={it.item_code}>
                      [{it.item_category}] {it.item_name} ({it.item_code})
                    </option>
                  ))}
                </select>
              </div>
            </aside>

            {/* Column Mapping Panel */}
            <main className="rounded-xl border bg-white p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-2">
                  <Database className="h-4.5 w-4.5 text-blue-600" /> E-Count ERP 컬럼 매핑 구조화
                </h3>
                <p className="text-xs text-gray-500">
                  데이터베이스 필드에 해당하는 엑셀 스프레드시트의 열 머리글을 지정해주세요. 가장 근사한 컬럼이 자동 추천됩니다.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <MappingField 
                  label="수불 일자 (필수)" 
                  value={mapping.txn_date} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, txn_date: val })} 
                />
                <MappingField 
                  label="수불 구분 (선택)" 
                  value={mapping.txn_type} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, txn_type: val })} 
                />
                <MappingField 
                  label="수량 (필수)" 
                  value={mapping.qty} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, qty: val })} 
                />
                <MappingField 
                  label="조립 LOT 번호" 
                  value={mapping.lot_number} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, lot_number: val })} 
                />
                <MappingField 
                  label="소켓/시트 LOT 번호" 
                  value={mapping.source_lot} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, source_lot: val })} 
                />
                <MappingField 
                  label="출하 LOT 번호" 
                  value={mapping.linked_lot} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, linked_lot: val })} 
                />
                <MappingField 
                  label="출하처 / 용도" 
                  value={mapping.purpose} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, purpose: val })} 
                />
                <MappingField 
                  label="작업자 성명" 
                  value={mapping.issuer_name} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, issuer_name: val })} 
                />
                <MappingField 
                  label="담당자 성명" 
                  value={mapping.verifier_name} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, verifier_name: val })} 
                />
                <MappingField 
                  label="비고 / 특이사항" 
                  value={mapping.remarks} 
                  headers={headers} 
                  onChange={(val) => setMapping({ ...mapping, remarks: val })} 
                />
              </div>
            </main>
          </div>

          {/* Parsed Record Preview Grid */}
          <div className="rounded-xl border bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">ERP 수불 업로드 데이터 검증 미리보기</h3>
                <p className="text-xs text-gray-500 mt-1">
                  데이터베이스 반영 전 최종 검증 결과입니다. 실시간 파싱 결과를 점검하세요. (총 {mappedRecords.length}행 검증됨)
                </p>
              </div>

              <button
                onClick={handleImportToDatabase}
                disabled={mappedRecords.length === 0 || isProcessing}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:bg-gray-300 disabled:shadow-none transition-colors"
              >
                {isProcessing ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
                {isProcessing ? 'ERP 반영 중...' : 'ERP 데이터 반영'}
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border max-h-[480px]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 border-b z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left w-12">No.</th>
                    <th className="px-3 py-2.5 text-left w-28">수불일자</th>
                    <th className="px-3 py-2.5 text-left w-24">품목코드</th>
                    <th className="px-3 py-2.5 text-center w-20">구분</th>
                    <th className="px-3 py-2.5 text-right w-20">수량</th>
                    <th className="px-3 py-2.5 text-left w-36">조립 LOT</th>
                    <th className="px-3 py-2.5 text-left w-36">소켓/시트 LOT</th>
                    <th className="px-3 py-2.5 text-left w-48">출하처 / 용도</th>
                    <th className="px-3 py-2.5 text-left w-24">작업자</th>
                    <th className="px-3 py-2.5 text-left w-24">담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400">
                        지정된 컬럼 매핑에 매칭되는 적절한 데이터 행이 감지되지 않았습니다.
                      </td>
                    </tr>
                  ) : (
                    mappedRecords.slice(0, 50).map((r, idx) => (
                      <tr key={r.id} className="border-t hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-800">{r.txn_date}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{r.item_code}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            r.txn_type === 'IN' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {r.txn_type === 'IN' ? '입고/조립' : '출고/출하'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{r.qty.toLocaleString()}</td>
                        <td className="px-3 py-2 font-mono text-gray-600 truncate max-w-[120px]" title={r.lot_number}>{r.lot_number || '-'}</td>
                        <td className="px-3 py-2 font-mono text-gray-600 truncate max-w-[120px]" title={r.source_lot}>{r.source_lot || '-'}</td>
                        <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]" title={r.purpose}>{r.purpose || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{r.issuer_name || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{r.verifier_name || '-'}</td>
                      </tr>
                    ))
                  )}
                  {mappedRecords.length > 50 && (
                    <tr className="bg-gray-50">
                      <td colSpan={10} className="py-2.5 text-center text-[10px] font-medium text-gray-400 border-t">
                        외 대용량 레코드 {mappedRecords.length - 50}건이 추가 파싱되어 대기 중입니다...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MappingField({ 
  label, value, headers, onChange 
}: { 
  label: string; value: string; headers: string[]; onChange: (val: string) => void 
}) {
  return (
    <div className="space-y-1">
      <span className="block text-[11px] font-bold text-gray-600 tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-white"
      >
        <option value="">-- 매핑 없음 --</option>
        {headers.map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}
