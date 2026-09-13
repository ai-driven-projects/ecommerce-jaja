import { Clock } from 'lucide-react';
import { cn } from '@/shared/lib/class-name.util';

type EtaBadgeProps = {
  minutes: number;
  /** Prefixo antes do tempo ("Chega em" na página de produto). */
  prefix?: string;
  className?: string;
};

/** Selo branco com relógio verde: "⏱ 25 min". */
export function EtaBadge({ minutes, prefix, className }: EtaBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill bg-card px-2.5 py-[3px] text-[11.5px] font-extrabold text-success shadow-badge',
        className,
      )}
    >
      <Clock className="size-3" strokeWidth={2.5} aria-hidden="true" />
      {prefix ? `${prefix} ` : null}~{minutes} min
    </span>
  );
}
