import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductPage } from '@/modules/catalog/pages/product.page';
import { findProduct } from '@/modules/catalog/data/storefront.mock';

type ProductRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const product = findProduct(slug);
  return { title: product ? `${product.name} — já já` : 'Produto — já já' };
}

// Detalhe do produto: o servidor resolve o slug (404 quando não existe) e o
// cliente cuida de bairro/ETA/carrinho a partir da query string.
export default async function ProductRoute({ params }: ProductRouteProps) {
  const { slug } = await params;
  const product = findProduct(slug);

  if (!product) notFound();

  return <ProductPage product={product} />;
}
