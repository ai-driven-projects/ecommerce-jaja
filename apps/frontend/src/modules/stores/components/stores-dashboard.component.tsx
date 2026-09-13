import { COVERAGE_ROWS } from '@/modules/admin/data/dashboard.mock';
import { EmptyDashboardState } from '@/shared/components/ui/empty-dashboard-state';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { Badge } from '@/shared/components/ui/badge';

export function StoresDashboardComponent() {
  const hubs = [...new Set(COVERAGE_ROWS.map((row) => row.hub))];

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Hubs & cobertura"
        subtitle={`${hubs.length} hubs · ${COVERAGE_ROWS.length} bairros atendidos`}
      />

      <div className="grid gap-3.5 sm:grid-cols-2">
        {hubs.map((hub) => {
          const rows = COVERAGE_ROWS.filter((row) => row.hub === hub);
          return (
            <section key={hub} className="rounded-2xl border border-line bg-card px-[22px] py-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-xl" aria-hidden="true">
                  🏬
                </span>
                <div>
                  <h2 className="font-display text-[17px] font-extrabold">{hub}</h2>
                  <p className="text-[12.5px] text-muted-ink">{rows.length} bairros · raio 2,5 km</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {rows.map((row) => (
                  <Badge key={row.neighborhood} variant="outline" className="gap-2 px-3 py-1.5 text-[12.5px]">
                    {row.neighborhood}
                    <span className={row.etaMinutes > 25 ? 'text-warning' : 'text-success'}>~{row.etaMinutes} min</span>
                  </Badge>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <EmptyDashboardState
        moduleName="Editar cobertura"
        emoji="🗺️"
        description="O editor de raio e bairros por hub chega com a API de lojas. Por enquanto os dados são locais de exemplo."
      />
    </div>
  );
}
