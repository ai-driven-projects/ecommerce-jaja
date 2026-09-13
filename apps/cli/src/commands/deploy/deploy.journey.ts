import type { JourneyArea, JourneyStep } from '../../core/command.js';
import { journey } from '../../core/journey.js';
import { placeholderJourneyStep } from '../placeholder.js';

export const deployAreas: JourneyArea[] = [
  { id: 'prep', label: 'Preparação' },
  { id: 'db', label: 'Banco de dados' },
  { id: 'backend', label: 'Backend' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'cicd', label: 'CI/CD' },
];

export const deploySteps: JourneyStep[] = [
  placeholderJourneyStep({ id: 'tools', area: 'prep', label: 'Ferramentas', description: 'Instala e autentica as CLIs de deploy', defaultSelected: false }),
  placeholderJourneyStep({ id: 'config', area: 'prep', label: 'Configuração', description: 'Arquivos de configuração do deploy', defaultSelected: false, requires: ['tools'] }),
  placeholderJourneyStep({ id: 'env', area: 'prep', label: 'Variáveis de produção', description: 'Cria os .env.production e envia os segredos', defaultSelected: false, requires: ['config'] }),
  placeholderJourneyStep({ id: 'database', area: 'db', label: 'Banco de produção', description: 'Provisiona o banco e grava a DATABASE_URL', defaultSelected: false, requires: ['env'] }),
  placeholderJourneyStep({ id: 'migrate', area: 'db', label: 'Migrations', description: 'prisma migrate deploy em produção', defaultSelected: false, requires: ['database'], publish: true }),
  placeholderJourneyStep({ id: 'backend', area: 'backend', label: 'Deploy do backend', description: 'Publica a nova revisão do backend', defaultSelected: false, requires: ['migrate'], publish: true }),
  placeholderJourneyStep({ id: 'frontend', area: 'frontend', label: 'Deploy do frontend', description: 'Publica o frontend', defaultSelected: false, requires: ['backend'] }),
  placeholderJourneyStep({ id: 'workflows', area: 'cicd', label: 'Workflows do GitHub', description: 'Gera os workflows de CI e deploy', defaultSelected: false }),
  placeholderJourneyStep({ id: 'secrets', area: 'cicd', label: 'Segredos do repositório', description: 'Cadastra os segredos usados pelos workflows', defaultSelected: false, requires: ['workflows'] }),
];

export const deployJourney = journey({
  id: 'deploy',
  title: 'Deploy',
  description: 'Prepara a infraestrutura, publica backend e frontend e configura o CI/CD',
  group: 'Produção',
  icon: '🚀',
  keywords: ['deploy', 'publicar', 'producao', 'cloud', 'ci', 'cd', 'github'],
  areas: deployAreas,
  steps: deploySteps,
});
