import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/class-name.util';

type NavigationLinkCardProps = {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  className?: string;
};

export function NavigationLinkCard({ href, title, description, icon, className }: NavigationLinkCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group block h-full rounded-2xl border border-line bg-card p-5 text-ink transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-card',
        className,
      )}
    >
      <div className="flex h-full flex-col items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand [&_svg]:size-5">{icon}</div>

        <div className="space-y-1">
          <h3 className="text-base font-extrabold">{title}</h3>
          <p className="text-[13px] text-muted-ink">{description}</p>
        </div>
      </div>
    </Link>
  );
}
