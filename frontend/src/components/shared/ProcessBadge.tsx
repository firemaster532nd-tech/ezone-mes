import { cn } from '@/lib/utils';

const processColors: Record<string, string> = {
  MIX: 'bg-[#185FA5] text-white',
  EXT: 'bg-[#534AB7] text-white',
  CUT: 'bg-[#0F6E56] text-white',
  ASM: 'bg-[#D85A30] text-white',
  SHP: 'bg-[#5F5E5A] text-white',
};

const processLabels: Record<string, string> = {
  MIX: '배합', EXT: '압출', CUT: '재단', ASM: '조립', SHP: '출하',
};

interface ProcessBadgeProps {
  process: string;
  className?: string;
}

export function ProcessBadge({ process, className }: ProcessBadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', processColors[process] ?? 'bg-gray-500 text-white', className)}>
      {processLabels[process] ?? process}
    </span>
  );
}
