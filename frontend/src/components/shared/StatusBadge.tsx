import { cn } from '@/lib/utils';

const variants: Record<string, string> = {
  PASS: 'bg-[#E1F5EE] text-[#0F6E56] border-[#5DCAA5]',
  FAIL: 'bg-[#FCEBEB] text-[#A32D2D] border-[#F09595]',
  PENDING: 'bg-[#FAEEDA] text-[#854F0B] border-[#FAC775]',
  HOLD: 'bg-[#FAECE7] text-[#993C1D] border-[#F0997B]',
  INFO: 'bg-[#E6F1FB] text-[#185FA5] border-[#93C5FD]',
};

const labels: Record<string, string> = {
  PASS: '합격', FAIL: '불합격', PENDING: '대기', HOLD: '보류', INFO: '정보',
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const variant = variants[status] ?? variants.INFO;
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', variant, className)}>
      {label ?? labels[status] ?? status}
    </span>
  );
}
