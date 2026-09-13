import type { ReactNode } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/class-name.util';

type SectionHeaderProps = {
  badge?: ReactNode;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  divider?: boolean;
  className?: string;
  dividerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

/** Cabeçalho de seção: título em display, subtítulo cinza e ação à direita. */
export function SectionHeader({
  badge,
  title,
  subtitle,
  aside,
  divider = false,
  className,
  dividerClassName,
  contentClassName,
  titleClassName,
  subtitleClassName,
}: SectionHeaderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {divider ? <div className={cn('h-px w-full bg-line', dividerClassName)} aria-hidden="true" /> : null}

      <header className="space-y-3">
        {badge ? <Badge variant="brand">{badge}</Badge> : null}

        <div
          className={cn(
            aside ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' : 'space-y-1',
            contentClassName,
          )}
        >
          <div className="flex flex-col gap-1">
            <h2 className={cn('font-display text-2xl font-extrabold tracking-[-0.5px] text-ink', titleClassName)}>
              {title}
            </h2>
            {subtitle ? <p className={cn('text-[13.5px] text-muted-ink', subtitleClassName)}>{subtitle}</p> : null}
          </div>

          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      </header>
    </div>
  );
}
