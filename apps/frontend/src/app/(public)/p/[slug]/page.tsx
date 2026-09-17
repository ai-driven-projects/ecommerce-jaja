import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStorefrontProduct } from '@/modules/catalog/data/storefront.api';
import { ProductPage } from '@/modules/catalog/pages/product.page';

const DESCRIPTION_LENGTH = 160;

// Uma chamada à API por requisição, compartilhada entre `generateMetadata` e a página.
const loadProduct = cache(getStorefrontProduct);

type ProductRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);

  if (!product) notFound();

  const title = `${product.name} — já já`;
  const description = product.description?.replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_LENGTH) || undefined;
  const image = product.images[0]?.largeUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

// Detalhe do produto: o servidor busca o produto visível pelo slug (404 quando
// não existe ou está inativo) e o cliente cuida da loja escolhida, galeria e
// quantidade a partir da query string.
export default async function ProductRoute({ params }: ProductRouteProps) {
  const { slug } = await params;
  const product = await loadProduct(slug);

  if (!product) notFound();

  return <ProductPage product={product} />;
}
