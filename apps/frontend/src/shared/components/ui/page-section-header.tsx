import type { ReactNode } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/class-name.util';

type PageSectionHeaderProps = {
  badge?: ReactNode;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

/** Cabeçalho de página do admin: título em display à esquerda e ações à direita. */
export function PageSectionHeader({
  badge,
  title,
  subtitle,
  aside,
  className,
  contentClassName,
  titleClassName,
  subtitleClassName,
}: PageSectionHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      {badge ? <Badge variant="brand">{badge}</Badge> : null}

      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
          contentClassName,
        )}
      >
        <div className="flex flex-col gap-1">
          <h1 className={cn('font-display text-[26px] font-extrabold tracking-[-0.6px] text-ink', titleClassName)}>
            {title}
          </h1>
          {subtitle ? <p className={cn('text-[13.5px] text-muted-ink', subtitleClassName)}>{subtitle}</p> : null}
        </div>

        {aside ? <div className="flex shrink-0 items-center gap-2.5">{aside}</div> : null}
      </div>
    </header>
  );
}
