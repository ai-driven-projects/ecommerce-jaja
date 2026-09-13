'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { TableCard } from '@/shared/components/ui/table-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { STOREFRONT_ROUTE, productRoute } from '@/shared/navigation/storefront-routes';
import { formatPrice } from '@/shared/util/price.util';
import { CATEGORY_OPTIONS, PRODUCTS, categoryLabel } from '../data/storefront.mock';

const LOW_STOCK_THRESHOLD = 15;

function stockBadge(stock: number) {
  if (stock === 0) return <Badge variant="danger">Esgotado</Badge>;
  if (stock <= LOW_STOCK_THRESHOLD) return <Badge variant="warning">Baixo · {stock} un</Badge>;
  return <Badge variant="success">{stock} un</Badge>;
}

/** Produtos & estoque: lista do catálogo com preço, estoque e destaque na vitrine. */
export function CatalogDashboardComponent() {
  const lowStockCount = PRODUCTS.filter((product) => product.stock <= LOW_STOCK_THRESHOLD).length;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Produtos & estoque"
        subtitle={`${PRODUCTS.length} produtos em ${CATEGORY_OPTIONS.length - 1} categorias · ${lowStockCount} com estoque baixo`}
        aside={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={STOREFRONT_ROUTE}>Ver loja →</Link>
            </Button>
            <Button size="sm">
              <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
              Novo produto
            </Button>
          </>
        }
      />

      <TableCard title="Catálogo" subtitle="Dados locais de exemplo; a edição chega com a API.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Vitrine</TableHead>
              <TableHead align="right">Preço</TableHead>
              <TableHead align="right">Estoque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRODUCTS.map((product) => (
              <TableRow key={product.slug}>
                <TableCell>
                  <Link href={productRoute(product.slug)} className="flex items-center gap-3 transition-colors duration-150 hover:text-brand">
                    <ProductArt emoji={product.emoji} category={product.category} size="xs" />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{product.name}</span>
                      <span className="block truncate text-xs text-muted-ink">{product.unit}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-ink">{categoryLabel(product.category)}</TableCell>
                <TableCell>
                  {product.oldPriceCents ? (
                    <Badge variant="solid">Oferta</Badge>
                  ) : product.highlight === 'top' ? (
                    <Badge variant="brand">Mais pedido</Badge>
                  ) : product.highlight === 'restock' ? (
                    <Badge variant="muted">Repor agora</Badge>
                  ) : (
                    <span className="text-muted-ink">—</span>
                  )}
                </TableCell>
                <TableCell align="right">
                  {product.oldPriceCents ? (
                    <span className="mr-1.5 text-xs font-semibold text-placeholder line-through">{formatPrice(product.oldPriceCents)}</span>
                  ) : null}
                  {formatPrice(product.priceCents)}
                </TableCell>
                <TableCell align="right">{stockBadge(product.stock)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}
