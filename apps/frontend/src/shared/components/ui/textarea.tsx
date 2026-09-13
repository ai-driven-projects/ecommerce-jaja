import * as React from 'react';
import { cn } from '@/shared/lib/class-name.util';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-xl border-[1.5px] border-line bg-card px-3.5 py-2.5 text-sm text-ink transition-colors duration-150 placeholder:text-placeholder focus-visible:border-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
