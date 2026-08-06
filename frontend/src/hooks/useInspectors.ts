import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const DEFAULT_INSPECTORS = [
  '김정용 책임',
  '최진영 책임',
  '임병용 파트장',
  '이동민 파트장',
  '김봉민 책임',
  '박민선 대표',
  '생산 작업자'
];

export function useInspectors() {
  const [inspectors, setInspectors] = useState<string[]>(DEFAULT_INSPECTORS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadInspectors() {
      setLoading(true);
      try {
        const res = await api.get<{ inspectors?: string[]; workers?: any[] }>('/inspectors');
        if (res.inspectors && res.inspectors.length > 0 && isMounted) {
          // 중복 제거 후 세팅
          const uniqueList = Array.from(new Set([...res.inspectors, ...DEFAULT_INSPECTORS]));
          setInspectors(uniqueList);
        }
      } catch (err) {
        console.warn('Failed to fetch company inspectors from master DB', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInspectors();

    return () => {
      isMounted = false;
    };
  }, []);

  return { inspectors, loading };
}
