import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/class-name.util';

export function FormErrorMessage({
  children,
  size = 'xs',
  className,
}: {
  children: ReactNode;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  return (
    <p role="alert" className={cn(size === 'xs' ? 'text-xs' : 'text-sm', 'font-semibold text-danger', className)}>
      {children}
    </p>
  );
}
