import * as React from 'react';
import { cn } from '@/shared/lib/class-name.util';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

// Campo branco com borda de 1.5px e raio 12; a borda vira laranja no foco.
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-xl border-[1.5px] border-line bg-card px-3.5 py-2 text-sm text-ink transition-colors duration-150 placeholder:text-placeholder focus-visible:border-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
