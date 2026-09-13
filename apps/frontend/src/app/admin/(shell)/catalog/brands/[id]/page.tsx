import { BrandFormPage } from '@/modules/catalog/pages/brand-form.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type BrandRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RouteSearchParams>;
};

// Edição de marca: a rota resolve o `id` e a query da lista (retorno); a página carrega a marca no cliente.
export default async function Page({ params, searchParams }: BrandRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <BrandFormPage key={id} id={id} returnQuery={toQueryString(query)} />;
}
