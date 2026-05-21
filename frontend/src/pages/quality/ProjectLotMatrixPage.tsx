import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { 
  FolderGit2, FileSpreadsheet, Search, ShieldCheck, HelpCircle 
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Project {
  project_id: number;
  project_code: string;
  project_name: string;
}

interface LotMatrixRow {
  no: number;
  ship_date: string;
  quality_no: string;
  customer_name: string;
  project_name: string;
  order_date: string;
  spec: string;
  completion_date_structure: string;
  structure_lot: string;
  product_no: string;
  
  // 배합
  completion_date_mix: string;
  mix_lot: string;
  raw_mb_lot: string;
  raw_eg_lot: string;
  raw_ea_lot: string;
  raw_ep_lot: string;
  
  // 압출
  completion_date_ext: string;
  ext_lot: string;
  
  // 재단
  completion_date_cut: string;
  cut_lot: string;
  
  // 조립
  completion_date_asm: string;
  asm_lot: string;
  part_socket_lot: string;
  part_sheet_lot: string;
  part_ceramic_lot: string;
  part_sealant_lot: string;
  
  // 틈새복합시트
  gapsheet_date: string;
  gapsheet_asm_lot: string;
  gapsheet_ceramic_lot: string;
  gapsheet_socket_lot: string;
  gapsheet_mix_lot: string;
  gapsheet_ext_lot: string;
  gapsheet_cut_lot: string;
  
  // 플래싱
  flashing_date: string;
  flashing_asm_lot: string;
  flashing_socket_lot: string;
  flashing_mix_lot: string;
  flashing_ext_lot: string;
  flashing_cut_lot: string;
  
  // 그라스울
  gw_lot: string;
  gw_lot_2: string;
}

export function ProjectLotMatrixPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [matrix, setMatrix] = useState<LotMatrixRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. 프로젝트 리스트 조회
  useEffect(() => {
    api.get<{ data: Project[] }>('/projects').then(res => {
      setProjects(res.data);
      if (res.data.length > 0) {
        setSelectedProjectId(res.data[0].project_id);
        setSelectedProjectName(res.data[0].project_name);
      }
    });
  }, []);

  // 2. 프로젝트 변경 시 통합 LOT 매트릭스 로딩
  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    api.get<{ data: LotMatrixRow[] }>(`/projects/${selectedProjectId}/lot-matrix`)
      .then(res => {
        setMatrix(res.data);
      })
      .catch(e => {
        toast.error('통합 LOT 매트릭스 데이터를 가져오지 못했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedProjectId]);

  const handleProjectChange = (id: number) => {
    setSelectedProjectId(id);
    const proj = projects.find(p => p.project_id === id);
    if (proj) setSelectedProjectName(proj.project_name);
  };

  // 고품격 Excel 다운로드 구현
  const handleExportExcel = () => {
    if (matrix.length === 0) {
      toast.error('다운로드할 데이터가 존재하지 않습니다.');
      return;
    }

    // 1. 엑셀 워크시트 생성용 구조화 배열 빌드
    const excelRows: any[] = [];

    // 최상단 타이틀 헤더 추가
    excelRows.push(['현장별 품질관리 세부내역 통합 LOT 추적 대장']);
    excelRows.push([`현장명: ${selectedProjectName}`, '', '', `출력일시: ${new Date().toLocaleString()}`]);
    excelRows.push([]); // 공백

    // 테이블 헤더 (병합을 염두에 둔 2줄 헤더)
    excelRows.push([
      'No', '출하일자', '품질번호', '거래처', '현장명', '규격', 
      '구조 LOT', '제품번호',
      '배합완료일', '배합 LOT', '투입 MB', '투입 EG', '투입 EA', '투입 EP',
      '압출완료일', '압출 LOT',
      '재단완료일', '재단 LOT',
      '조립완료일', '조립 LOT', '소켓부자재', '시트부자재', '세라믹부자재', '실란트부자재',
      '플래싱 Z형 일자', '플래싱 ASM LOT', '플래싱 소켓', '플래싱 배합', '플래싱 압출', '플래싱 재단',
      '그라스울 LOT 1', '그라스울 LOT 2'
    ]);

    // 데이터 적재
    matrix.forEach((r, idx) => {
      excelRows.push([
        idx + 1,
        r.ship_date || 'N/A',
        r.quality_no || 'N/A',
        r.customer_name || 'N/A',
        r.project_name || 'N/A',
        r.spec || 'N/A',
        r.structure_lot || 'N/A',
        r.product_no || 'N/A',
        // 배합
        r.completion_date_mix || 'N/A',
        r.mix_lot || 'N/A',
        r.raw_mb_lot || 'N/A',
        r.raw_eg_lot || 'N/A',
        r.raw_ea_lot || 'N/A',
        r.raw_ep_lot || 'N/A',
        // 압출
        r.completion_date_ext || 'N/A',
        r.ext_lot || 'N/A',
        // 재단
        r.completion_date_cut || 'N/A',
        r.cut_lot || 'N/A',
        // 조립
        r.completion_date_asm || 'N/A',
        r.asm_lot || 'N/A',
        r.part_socket_lot || 'N/A',
        r.part_sheet_lot || 'N/A',
        r.part_ceramic_lot || 'N/A',
        r.part_sealant_lot || 'N/A',
        // 플래싱
        r.flashing_date || 'N/A',
        r.flashing_asm_lot || 'N/A',
        r.flashing_socket_lot || 'N/A',
        r.flashing_mix_lot || 'N/A',
        r.flashing_ext_lot || 'N/A',
        r.flashing_cut_lot || 'N/A',
        // 그라스울
        r.gw_lot || 'N/A',
        r.gw_lot_2 || 'N/A'
      ]);
    });

    // 2. 워크북 및 시트 바인딩
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelRows);

    // 3. 타이틀 병합 적용 (A1 ~ H1 병합)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'LOT 통합 추적대장');
    
    // 파일명 제너레이션
    const sanitizeName = selectedProjectName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    XLSX.writeFile(wb, `EZONE_품질관리서_세부내역_LOT통합_${sanitizeName}.xlsx`);
    toast.success('품질관리대장 고품격 엑셀 파일이 다운로드되었습니다.');
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="품질관리서 세부내역 통합 (LOT Matrix)" 
        count={matrix.length} 
        description="완제품 조립 공정 LOT부터 배합/압출/재단 가공 공정 및 투입 최초 원자재/부자재 LOT까지 일괄 매트릭스 실시간 정밀 추적" 
      />

      {/* 필터 및 엑셀 다운로드 */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FolderGit2 className="h-5 w-5 text-blue-600" />
          <label className="text-sm font-bold text-slate-700">추적 현장 선택:</label>
          <select
            value={selectedProjectId || ''}
            onChange={(e) => handleProjectChange(Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white"
          >
            {projects.map(p => (
              <option key={p.project_id} value={p.project_id}>{p.project_name} ({p.project_code})</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
            disabled={matrix.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            통합 LOT 엑셀 다운로드 (Excel)
          </button>
        </div>
      </div>

      {/* 가로 메가 그리드 판넬 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
          <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
            현장명: {selectedProjectName} - 다차원 LOT 크로스탭 추적 행렬
          </span>
          <span className="ml-auto text-[10px] text-slate-400 font-sans flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-slate-300" />
            데이터가 미등록된 공정은 안전하게 N/A로 표출됩니다.
          </span>
        </div>

        {/* 횡스크롤 메가 테이블 */}
        <div className="overflow-x-auto">
          <table className="table-fixed text-xs text-left border-collapse border border-slate-200 font-mono min-w-[2800px]">
            <thead>
              {/* 공정 대분류 헤더 */}
              <tr className="bg-slate-100/80 text-center font-bold text-slate-700 border-b border-slate-300 uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 border border-slate-200 w-16" rowSpan={2}>No</th>
                <th className="px-3 py-2 border border-slate-200 w-24" rowSpan={2}>출하일자</th>
                <th className="px-3 py-2 border border-slate-200 w-28" rowSpan={2}>품질번호</th>
                <th className="px-3 py-2 border border-slate-200 w-32" rowSpan={2}>거래처</th>
                <th className="px-3 py-2 border border-slate-200 w-44" rowSpan={2}>현장명</th>
                <th className="px-3 py-2 border border-slate-200 w-28" rowSpan={2}>규격</th>
                <th className="px-3 py-2 border border-slate-200 w-36" rowSpan={2}>구조 LOT</th>
                <th className="px-3 py-2 border border-slate-200 w-24" rowSpan={2}>제품번호</th>
                
                {/* 배합 */}
                <th className="px-3 py-1.5 border border-slate-200 w-[640px] bg-blue-50 text-blue-700">배합 공정 (Mixing & Raw Materials LOT)</th>
                {/* 압출 */}
                <th className="px-3 py-1.5 border border-slate-200 w-[200px] bg-teal-50 text-teal-700">압출 공정</th>
                {/* 재단 */}
                <th className="px-3 py-1.5 border border-slate-200 w-[200px] bg-indigo-50 text-indigo-700">재단 공정</th>
                {/* 조립 */}
                <th className="px-3 py-1.5 border border-slate-200 w-[540px] bg-purple-50 text-purple-700">조립 공정 및 투입 부자재 LOT</th>
                {/* 플래싱 Z형 */}
                <th className="px-3 py-1.5 border border-slate-200 w-[640px] bg-amber-50 text-amber-700">플래싱 Z형 공정 및 원자재 LOT</th>
                {/* 그라스울 */}
                <th className="px-3 py-1.5 border border-slate-200 w-[280px] bg-rose-50 text-rose-700">그라스울 차열재 원단</th>
              </tr>
              {/* 상세 컬럼 헤더 */}
              <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] text-center border-b border-slate-200">
                {/* 배합 세부 */}
                <th className="px-2 py-1.5 border border-slate-200 bg-blue-50/20 text-blue-600">완료일자</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-blue-50/20 text-blue-600">배합 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-blue-50/20 text-blue-600">투입 MB</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-blue-50/20 text-blue-600">투입 EG</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-blue-50/20 text-blue-600">투입 EA</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-blue-50/20 text-blue-600">투입 EP</th>
                
                {/* 압출 세부 */}
                <th className="px-2 py-1.5 border border-slate-200 bg-teal-50/20 text-teal-600">완료일자</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-teal-50/20 text-teal-600">압출 LOT</th>

                {/* 재단 세부 */}
                <th className="px-2 py-1.5 border border-slate-200 bg-indigo-50/20 text-indigo-600">완료일자</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-indigo-50/20 text-indigo-600">재단 LOT</th>

                {/* 조립 세부 */}
                <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/20 text-purple-600">완료일자</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/20 text-purple-600">조립 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/20 text-purple-600">소켓 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/20 text-purple-600">시트 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/20 text-purple-600">세라믹 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/20 text-purple-600">실란트 LOT</th>

                {/* 플래싱 Z형 세부 */}
                <th className="px-2 py-1.5 border border-slate-200 bg-amber-50/20 text-amber-600">완료일자</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-amber-50/20 text-amber-600">플래싱 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-amber-50/20 text-amber-600">소켓 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-amber-50/20 text-amber-600">배합 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-amber-50/20 text-amber-600">압출 LOT</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-amber-50/20 text-amber-600">재단 LOT</th>

                {/* 그라스울 세부 */}
                <th className="px-2 py-1.5 border border-slate-200 bg-rose-50/20 text-rose-600">그라스울 LOT 1</th>
                <th className="px-2 py-1.5 border border-slate-200 bg-rose-50/20 text-rose-600">그라스울 LOT 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={32} className="py-20 text-center font-sans text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    다차원 LOT 계보를 조인하여 생성하는 중입니다...
                  </td>
                </tr>
              ) : matrix.map((row) => (
                <tr key={row.no} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-3 py-2 border border-slate-200 text-slate-400 font-bold">{row.no}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-500 font-sans">{row.ship_date}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-500">{row.quality_no}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-800 font-sans font-bold text-left pl-2">{row.customer_name}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-800 font-sans text-left pl-2">{row.project_name}</td>
                  <td className="px-3 py-2 border border-slate-200 font-bold text-slate-900 font-mono">{row.spec}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-900 font-bold bg-slate-50/50">{row.structure_lot}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600 font-bold">{row.product_no}</td>

                  {/* 배합 */}
                  <td className="px-2 py-2 border border-slate-200 text-slate-500">{row.completion_date_mix}</td>
                  <td className="px-2 py-2 border border-slate-200 font-bold text-blue-600 bg-blue-50/5">{row.mix_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.raw_mb_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.raw_eg_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.raw_ea_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.raw_ep_lot}</td>

                  {/* 압출 */}
                  <td className="px-2 py-2 border border-slate-200 text-slate-500">{row.completion_date_ext}</td>
                  <td className="px-2 py-2 border border-slate-200 font-bold text-teal-600 bg-teal-50/5">{row.ext_lot}</td>

                  {/* 재단 */}
                  <td className="px-2 py-2 border border-slate-200 text-slate-500">{row.completion_date_cut}</td>
                  <td className="px-2 py-2 border border-slate-200 font-bold text-indigo-600 bg-indigo-50/5">{row.cut_lot}</td>

                  {/* 조립 */}
                  <td className="px-2 py-2 border border-slate-200 text-slate-500">{row.completion_date_asm}</td>
                  <td className="px-2 py-2 border border-slate-200 font-bold text-purple-600 bg-purple-50/5">{row.asm_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.part_socket_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.part_sheet_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.part_ceramic_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.part_sealant_lot}</td>

                  {/* 플래싱 */}
                  <td className="px-2 py-2 border border-slate-200 text-slate-500">{row.flashing_date}</td>
                  <td className="px-2 py-2 border border-slate-200 font-bold text-amber-600 bg-amber-50/5">{row.flashing_asm_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.flashing_socket_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.flashing_mix_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.flashing_ext_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.flashing_cut_lot}</td>

                  {/* 그라스울 */}
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.gw_lot}</td>
                  <td className="px-2 py-2 border border-slate-200 text-slate-500 font-mono text-[10px]">{row.gw_lot_2}</td>
                </tr>
              ))}
              {matrix.length === 0 && !loading && (
                <tr>
                  <td colSpan={32} className="py-12 text-center text-slate-400 font-sans">
                    해당 프로젝트에 매핑된 수주/생산 LOT 추적 결과가 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
