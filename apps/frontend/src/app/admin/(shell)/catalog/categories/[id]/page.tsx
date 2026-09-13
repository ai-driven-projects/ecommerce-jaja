import { CategoryFormPage } from '@/modules/catalog/pages/category-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type CategoryRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RouteSearchParams>;
};

// Edição de categoria: a rota resolve o `id` e a query da lista (retorno); a página carrega a categoria no cliente.
export default async function Page({ params, searchParams }: CategoryRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <CategoryFormPage key={id} id={id} returnQuery={toQueryString(query)} />;
}
