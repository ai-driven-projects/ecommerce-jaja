import { COURIERS_ONLINE } from '@/modules/admin/data/dashboard.mock';
import { EmptyDashboardState } from '@/shared/components/ui/empty-dashboard-state';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';

export default function Page() {
  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader title="Entregadores" subtitle={`${COURIERS_ONLINE} online agora · bike e a pé`} />
      <EmptyDashboardState
        moduleName="Entregadores"
        emoji="🚴"
        description="Escala, entregas por pessoa e avaliação aparecem aqui quando a API de entregadores estiver disponível."
      />
    </div>
  );
}
