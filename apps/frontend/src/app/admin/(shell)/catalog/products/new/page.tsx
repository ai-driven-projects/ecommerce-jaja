import { ProductFormPage } from '@/modules/catalog/pages/product-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type NewProductRouteProps = {
  searchParams: Promise<RouteSearchParams>;
};

// Criação de produto: a query (página e filtros da lista) é repassada para o retorno ao salvar/cancelar.
export default async function Page({ searchParams }: NewProductRouteProps) {
  const returnQuery = toQueryString(await searchParams);
  return <ProductFormPage returnQuery={returnQuery} />;
}
