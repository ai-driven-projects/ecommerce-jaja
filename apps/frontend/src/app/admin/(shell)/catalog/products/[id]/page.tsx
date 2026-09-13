import { ProductFormPage } from '@/modules/catalog/pages/product-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type ProductRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RouteSearchParams>;
};

// Edição de produto: a rota resolve o `id` e a query da lista (retorno); a página carrega o produto no cliente.
export default async function Page({ params, searchParams }: ProductRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <ProductFormPage key={id} id={id} returnQuery={toQueryString(query)} />;
}
