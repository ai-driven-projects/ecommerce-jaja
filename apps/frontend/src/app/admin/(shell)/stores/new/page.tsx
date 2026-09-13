import { StoreFormPage } from '@/modules/stores/pages/store-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type NewStoreRouteProps = {
  searchParams: Promise<RouteSearchParams>;
};

// Criação de loja: a query (página e busca da lista) é repassada para o retorno ao salvar/cancelar.
export default async function Page({ searchParams }: NewStoreRouteProps) {
  const returnQuery = toQueryString(await searchParams);
  return <StoreFormPage returnQuery={returnQuery} />;
}
