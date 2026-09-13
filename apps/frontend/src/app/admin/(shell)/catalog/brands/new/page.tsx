import { BrandFormPage } from '@/modules/catalog/pages/brand-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type NewBrandRouteProps = {
  searchParams: Promise<RouteSearchParams>;
};

// Criação de marca: a query (página e busca da lista) é repassada para o retorno ao salvar/cancelar.
export default async function Page({ searchParams }: NewBrandRouteProps) {
  const returnQuery = toQueryString(await searchParams);
  return <BrandFormPage returnQuery={returnQuery} />;
}
