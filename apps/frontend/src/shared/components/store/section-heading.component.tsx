import Link from 'next/link';
import { cn } from '@/shared/lib/class-name.util';

type SectionHeadingProps = {
  title: string;
  /** Link "Ver tudo →" à direita. */
  action?: { label: string; href: string };
  className?: string;
};

/** Título de seção da vitrine em display, com ação laranja à direita. */
export function SectionHeading({ title, action, className }: SectionHeadingProps) {
  return (
    <div className={cn('mb-3.5 flex items-baseline justify-between gap-3', className)}>
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.5px]">{title}</h2>
      {action ? (
        <Link href={action.href} className="text-sm font-bold text-brand transition-colors duration-150 hover:text-brand-link">
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}
