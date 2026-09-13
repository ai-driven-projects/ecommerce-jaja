'use client';

import { Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { cn } from '@/shared/lib/class-name.util';
import { CustomerList } from '../components/customer-list.component';
import { useCustomers } from '../data/use-customers.hook';

const STATUS_FILTERS: { label: string; value: boolean | undefined }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Ativos', value: true },
  { label: 'Inativos', value: false },
];

// Estrutura estática da tabela (sem shimmer) enquanto a primeira busca responde.
function CustomerListSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={`customer-skeleton-${index}`} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-40 rounded-md bg-surface" />
            <div className="h-3 w-48 rounded-md bg-surface" />
          </div>
          <div className="h-4 w-28 rounded-md bg-surface" />
          <div className="h-4 w-28 rounded-md bg-surface" />
          <div className="h-4 w-24 rounded-md bg-surface" />
          <div className="ml-auto h-6 w-16 rounded-pill bg-surface" />
        </div>
      ))}
    </div>
  );
}

/** Estrutura da lista enquanto a página, a busca e o status da URL são resolvidos (fallback do `<Suspense>`). */
export function CustomersPageSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-32 rounded-md bg-surface" />
        <div className="h-4 w-48 rounded-md bg-surface" />
      </div>
      <div className="flex flex-col gap-2.5 lg:flex-row">
        <div className="h-[42px] w-full max-w-md rounded-pill bg-surface" />
        <div className="h-9 w-60 rounded-pill bg-surface" />
      </div>
      <CustomerListSkeleton />
    </div>
  );
}

function countLabel(total: number, filtered: boolean): string {
  const noun = total === 1 ? 'cliente' : 'clientes';
  if (filtered) return `${total} ${noun} ${total === 1 ? 'encontrado' : 'encontrados'}`;
  return `${total} ${noun} ${total === 1 ? 'cadastrado' : 'cadastrados'}`;
}

function emptySearchSubtitle(search: string, isActive: boolean | undefined): string {
  const status = isActive === undefined ? '' : isActive ? ' entre os ativos' : ' entre os inativos';
  if (search) return `Nenhum cliente corresponde a "${search}"${status}.`;
  return `Nenhum cliente${status}.`;
}

/**
 * Lista de clientes da administração: cabeçalho com a contagem (sem botão de
 * criação), busca por nome, email, CPF ou telefone, filtro de status, a tabela
 * e a paginação, com página, busca e status na URL. Precisa estar dentro de
 * `<Suspense>` (usa `useSearchParams`).
 */
export function CustomersPage() {
  const {
    customers,
    total,
    totalPages,
    page,
    loading,
    firstLoad,
    search,
    searchInput,
    setSearchInput,
    isActive,
    filtered,
    listQuery,
    setPage,
    setStatus,
  } = useCustomers();

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader title="Clientes" subtitle={firstLoad ? 'Carregando clientes…' : countLabel(total, filtered)} />

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div
          role="search"
          className="flex w-full max-w-md items-center gap-2.5 rounded-pill border border-line bg-surface px-[18px] transition-colors duration-150 focus-within:border-brand"
        >
          <Search className="size-[17px] shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Buscar clientes por nome, email, CPF ou telefone"
            placeholder="Buscar por nome, email, CPF ou telefone"
            autoComplete="off"
            className="h-[42px] w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-placeholder focus-visible:outline-none"
          />
        </div>

        <div role="group" aria-label="Filtrar por status" className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((option) => {
            const active = isActive === option.value;

            return (
              <Button
                key={option.label}
                type="button"
                size="sm"
                variant={active ? 'soft' : 'outline'}
                aria-pressed={active}
                className={cn(active && 'border border-brand-pale')}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {firstLoad ? (
        <CustomerListSkeleton />
      ) : (
        <div className={cn('flex flex-col gap-4', loading && 'opacity-60')} aria-busy={loading}>
          <CustomerList
            customers={customers}
            listQuery={listQuery}
            emptyTitle={filtered ? 'Nenhum cliente encontrado' : undefined}
            emptySubtitle={filtered ? emptySearchSubtitle(search, isActive) : undefined}
          />

          {total > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={total}
              totalLabel="clientes"
              onPageChange={setPage}
              disabled={loading}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
