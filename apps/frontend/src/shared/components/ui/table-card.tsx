import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/class-name.util';

type TableCardTone = 'default' | 'critical';

type TableCardProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAside?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: TableCardTone;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  children: React.ReactNode;
};

const toneClasses: Record<TableCardTone, { card: string; title: string; footer: string }> = {
  default: { card: '', title: '', footer: 'border-line bg-paper' },
  critical: { card: 'border-danger/40', title: 'text-danger', footer: 'border-danger/40 bg-danger-soft' },
};

/** Cartão que envolve uma tabela: cabeçalho com título/ação e conteúdo sem padding. */
export function TableCard({
  title,
  subtitle,
  headerAside,
  footer,
  tone = 'default',
  className,
  headerClassName,
  contentClassName,
  footerClassName,
  children,
}: TableCardProps) {
  const hasHeaderContent = Boolean(title || subtitle || headerAside);

  return (
    <Card className={cn('overflow-hidden', toneClasses[tone].card, className)}>
      {hasHeaderContent ? (
        <CardHeader className={cn('pb-4', headerClassName)}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              {title ? <CardTitle className={toneClasses[tone].title}>{title}</CardTitle> : null}
              {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
            </div>
            {headerAside ? <div className="text-[13px] font-bold">{headerAside}</div> : null}
          </div>
        </CardHeader>
      ) : (
        <div className="h-2" />
      )}

      <CardContent className={cn('px-2 pb-2 md:px-2 md:pb-2', contentClassName)}>{children}</CardContent>

      {footer ? (
        <div className={cn('border-t px-5 py-4 md:px-6', toneClasses[tone].footer, footerClassName)}>{footer}</div>
      ) : null}
    </Card>
  );
}

export { TableCard as MiniTableCard };
