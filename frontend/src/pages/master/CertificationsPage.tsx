import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { Search } from 'lucide-react';

interface Certification {
  cert_id: number;
  cert_number: string;
  product_group: string;
  structure_name: string;
  structure_code: string;
  install_position: string;
  socket_name: string | null;
  opening_w_mm: number | null;
  opening_h_mm: number | null;
  gap_limit_mm: number | null;
  cert_version: string | null;
  is_active: boolean;
}

const tabs = [
  { key: '', label: '전체' },
  { key: 'MP', label: '덕트(MP)' },
  { key: 'BD', label: '버스덕트(BD)' },
  { key: 'NP', label: '비금속배관(NP)' },
];

export function CertificationsPage() {
  const [data, setData] = useState<Certification[]>([]);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = filter ? `?product_group=${filter}` : '';
    api.get<{ data: Certification[] }>(`/certifications${params}`).then((res) => setData(res.data));
  }, [filter]);

  return (
    <div>
      <PageHeader title="인정구조 관리" count={data.length} description="품질인정 13종 구조물 마스터" />

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
              filter === tab.key
                ? 'border-process-mix text-process-mix'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">인정번호</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">구조명</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">사용부위</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">방화소켓</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">개구부(mm)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">틈새(mm)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">버전</th>
            </tr>
          </thead>
          <tbody>
            {data.map((cert, idx) => (
              <tr
                key={cert.cert_id}
                onClick={() => navigate(`/master/certifications/${cert.cert_id}`)}
                className="border-b cursor-pointer hover:bg-blue-50 transition-colors"
              >
                <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                <td className="px-4 py-3 font-mono text-xs">{cert.cert_number}</td>
                <td className="px-4 py-3 font-medium">{cert.structure_name}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                    cert.install_position === '수직벽체'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-teal-50 text-teal-700'
                  )}>
                    {cert.install_position}
                  </span>
                </td>
                <td className="px-4 py-3">{cert.socket_name ?? '-'}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {cert.opening_w_mm && cert.opening_h_mm
                    ? `${cert.opening_w_mm.toLocaleString()}×${cert.opening_h_mm}`
                    : '-'}
                </td>
                <td className="px-4 py-3">
                  {cert.gap_limit_mm !== null ? `${cert.gap_limit_mm}` : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono">
                    {cert.cert_version}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
