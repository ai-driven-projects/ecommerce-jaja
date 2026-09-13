import * as React from 'react';
import { cn } from '@/shared/lib/class-name.util';

// Tabela leve: cabeçalho em caixa alta pequena e cinza, linhas separadas por
// réguas de 1px em `line`; sem bordas externas (o cartão as fornece).
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-[13.5px]', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b [&_tr]:border-line [&_tr:hover]:bg-transparent', className)} {...props} />
  ),
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-line transition-colors duration-150 hover:bg-paper data-[state=selected]:bg-brand-soft',
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, align, ...props }, ref) => (
    <th
      ref={ref}
      align={align}
      className={cn(
        'h-10 px-3 text-left align-middle text-[12px] font-extrabold uppercase tracking-[0.04em] text-muted-ink',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, align, ...props }, ref) => (
    <td
      ref={ref}
      align={align}
      className={cn('px-3 py-3 align-middle', align === 'right' && 'text-right font-extrabold', className)}
      {...props}
    />
  ),
);
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
