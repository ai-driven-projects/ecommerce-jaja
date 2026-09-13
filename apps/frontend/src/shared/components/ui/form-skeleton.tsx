import { cn } from '@/shared/lib/class-name.util';

type FormSkeletonProps = {
  sections?: number;
  rowsPerSection?: number;
  className?: string;
};

// Estado de carregamento: a estrutura do formulário com blocos creme
// estáticos. Sem shimmer, sem pulsação.
export function FormSkeleton({ sections = 1, rowsPerSection = 4, className }: FormSkeletonProps) {
  return (
    <div className={cn('space-y-10', className)}>
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <section
          key={`form-skeleton-section-${sectionIndex}`}
          className="grid grid-cols-1 gap-x-8 gap-y-8 border-b border-line pb-10 md:grid-cols-3"
          aria-hidden="true"
        >
          <div className="hidden space-y-3 md:block">
            <div className="h-5 w-36 rounded-md bg-surface" />
            <div className="h-4 w-52 rounded-md bg-surface" />
            <div className="h-4 w-40 rounded-md bg-surface" />
          </div>

          <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-6 md:col-span-2">
            {Array.from({ length: rowsPerSection }).map((_, rowIndex) => (
              <div key={`form-skeleton-row-${sectionIndex}-${rowIndex}`} className="space-y-2">
                <div className="h-3 w-24 rounded-md bg-surface" />
                <div className="h-11 w-full rounded-xl bg-surface" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
