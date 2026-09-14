'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import type { StorefrontBrandFacet } from '../data/storefront.api';
import {
  formatCentsAsReais,
  parseReaisToCents,
  type StorefrontParamChanges,
  type StorefrontParams,
} from '../data/storefront-query.util';

/** Marcas visíveis antes de "Ver todas". */
const VISIBLE_BRANDS = 8;

type FilterProps = {
  params: StorefrontParams;
  onChange: (changes: StorefrontParamChanges) => void;
  /** Prefixo dos ids: a coluna lateral e o painel podem existir ao mesmo tempo. */
  idPrefix: string;
};

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.04em] text-muted-ink">{title}</h3>
      {children}
    </section>
  );
}

function CheckOption({ id, label, count, checked, onCheckedChange }: {
  id: string;
  label: string;
  count?: number;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-2 text-[13.5px] font-semibold text-ink">
        <span className="truncate">{label}</span>
        {typeof count === 'number' ? <span className="shrink-0 text-xs tabular-nums text-muted-ink">{count}</span> : null}
      </label>
    </div>
  );
}

function BrandFilter({ params, facets, onChange, idPrefix }: FilterProps & { facets: StorefrontBrandFacet[] }) {
  const [expanded, setExpanded] = useState(false);

  // Marca da URL fora das facetas (ex.: link da página de produto) continua marcada no topo.
  const missing = params.brands
    .filter((slug) => !facets.some((facet) => facet.slug === slug))
    .map((slug) => ({ slug, name: slug, count: undefined }));
  const options: Array<{ slug: string; name: string; count?: number }> = [...missing, ...facets];
  const visible = expanded ? options : options.slice(0, VISIBLE_BRANDS);

  if (options.length === 0) return <p className="text-[13px] text-muted-ink">Nenhuma marca neste resultado.</p>;

  const toggle = (slug: string, checked: boolean) =>
    onChange({ brands: checked ? [...params.brands, slug] : params.brands.filter((brand) => brand !== slug) });

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {visible.map((brand) => (
          <CheckOption
            key={brand.slug}
            id={`${idPrefix}-marca-${brand.slug}`}
            label={brand.name}
            count={brand.count}
            checked={params.brands.includes(brand.slug)}
            onCheckedChange={(checked) => toggle(brand.slug, checked)}
          />
        ))}
      </div>
      {options.length > VISIBLE_BRANDS ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 text-[13px] font-bold text-brand transition-colors duration-150 hover:text-brand-link"
        >
          {expanded ? 'Ver menos' : `Ver todas (${options.length})`}
        </button>
      ) : null}
    </>
  );
}

function PriceFilter({ params, onChange, idPrefix }: FilterProps) {
  const [min, setMin] = useState(params.minPriceCents === null ? '' : formatCentsAsReais(params.minPriceCents));
  const [max, setMax] = useState(params.maxPriceCents === null ? '' : formatCentsAsReais(params.maxPriceCents));
  const [invalid, setInvalid] = useState(false);

  const minId = `${idPrefix}-preco-min`;
  const maxId = `${idPrefix}-preco-max`;

  return (
    <form
      noValidate
      className="flex flex-col gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        const minPriceCents = parseReaisToCents(min);
        const maxPriceCents = parseReaisToCents(max);

        if ((min.trim() && minPriceCents === null) || (max.trim() && maxPriceCents === null)) {
          setInvalid(true);
          return;
        }

        setInvalid(false);
        onChange({ minPriceCents, maxPriceCents });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={minId} className="mb-1 block text-xs font-bold text-ink-soft">
            Mínimo (R$)
          </label>
          <Input
            id={minId}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={min}
            aria-invalid={invalid && min.trim() !== '' && parseReaisToCents(min) === null ? true : undefined}
            onChange={(event) => setMin(event.target.value)}
            className="h-10 tabular-nums"
          />
        </div>
        <div>
          <label htmlFor={maxId} className="mb-1 block text-xs font-bold text-ink-soft">
            Máximo (R$)
          </label>
          <Input
            id={maxId}
            inputMode="decimal"
            autoComplete="off"
            placeholder="300"
            value={max}
            aria-invalid={invalid && max.trim() !== '' && parseReaisToCents(max) === null ? true : undefined}
            onChange={(event) => setMax(event.target.value)}
            className="h-10 tabular-nums"
          />
        </div>
      </div>
      {invalid ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          Use valores em reais, como 12,90.
        </p>
      ) : null}
      <Button type="submit" variant="outline" size="sm">
        Aplicar
      </Button>
    </form>
  );
}

type StorefrontFiltersProps = FilterProps & {
  /** Marcas do resultado com a contagem (calculadas sem o filtro de marca). */
  facets: StorefrontBrandFacet[];
  className?: string;
};

/**
 * Controles de filtro da listagem: marcas com contagem ("Ver todas" depois de
 * 8), faixa de preço em reais aplicada pelo botão, só ofertas e só destaques.
 * Cada mudança chama `onChange`, que atualiza a URL.
 */
export function StorefrontFilters({ params, facets, onChange, idPrefix, className }: StorefrontFiltersProps) {
  return (
    <div className={className}>
      <FilterGroup title="Marca">
        <BrandFilter params={params} facets={facets} onChange={onChange} idPrefix={idPrefix} />
      </FilterGroup>
      <FilterGroup title="Preço">
        {/* Remonta quando a URL muda (pílula removida, voltar), para os campos refletirem o filtro. */}
        <PriceFilter
          key={`${params.minPriceCents}-${params.maxPriceCents}`}
          params={params}
          onChange={onChange}
          idPrefix={idPrefix}
        />
      </FilterGroup>
      <FilterGroup title="Ofertas e destaques">
        <div className="flex flex-col gap-2.5">
          <CheckOption
            id={`${idPrefix}-ofertas`}
            label="Só ofertas"
            checked={params.onSale}
            onCheckedChange={(checked) => onChange({ onSale: checked })}
          />
          <CheckOption
            id={`${idPrefix}-destaques`}
            label="Só destaques"
            checked={params.featured}
            onCheckedChange={(checked) => onChange({ featured: checked })}
          />
        </div>
      </FilterGroup>
    </div>
  );
}
