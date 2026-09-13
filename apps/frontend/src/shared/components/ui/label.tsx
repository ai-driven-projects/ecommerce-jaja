import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/shared/lib/class-name.util';

// Rótulo pequeno e forte em `ink-soft`, com respiro para o campo logo abaixo.
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'block text-[13px] font-bold leading-none text-ink-soft peer-disabled:cursor-not-allowed peer-disabled:opacity-70 [&+button]:mt-1.5 [&+div]:mt-1.5 [&+input]:mt-1.5 [&+select]:mt-1.5 [&+textarea]:mt-1.5',
      className,
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
