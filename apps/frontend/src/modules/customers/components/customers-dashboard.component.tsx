import { EmptyDashboardState } from '@/shared/components/ui/empty-dashboard-state';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';

export function CustomersDashboardComponent() {
  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader title="Clientes" subtitle="Escritórios, contas e faturamento mensal." />
      <EmptyDashboardState
        moduleName="Clientes"
        emoji="🏢"
        description="A lista de escritórios, contatos e o histórico de pedidos por conta aparecem aqui quando a API de clientes estiver disponível."
      />
    </div>
  );
}
