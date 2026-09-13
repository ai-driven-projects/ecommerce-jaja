import { StoreFormPage } from '@/modules/stores/pages/store-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type StoreRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RouteSearchParams>;
};

// Edição de loja: a rota resolve o `id` e a query da lista (retorno); a página carrega a loja no cliente.
export default async function Page({ params, searchParams }: StoreRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <StoreFormPage key={id} id={id} returnQuery={toQueryString(query)} />;
}
