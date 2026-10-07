## Why

O backend do Jaja só roda localmente (Docker Compose com Postgres e RabbitMQ). Falta um ambiente na AWS com cara de produção para ele — API em domínio próprio com HTTPS, banco e broker gerenciados, várias instâncias do backend — que possa ser criado do zero, usado por poucos minutos (demonstração e, num segundo momento, teste de carga) e destruído sem deixar recursos cobrando. A refatoração recente da mensageria (`BROKER_SUBSCRIBER`, RabbitMQ isolado em `rabbitmq/`) deixou o backend pronto para isso: o mesmo adapter fala com o Amazon MQ for RabbitMQ.

## What Changes

- Novo workspace `apps/infra` com a infraestrutura como código em **AWS CDK (TypeScript)** para o **backend e suas dependências**: VPC, ALB com HTTPS (ACM), ECS Fargate (backend), RDS PostgreSQL, **Amazon MQ for RabbitMQ**, Secrets Manager, registros no Route 53 e logs no CloudWatch.
- **Toda configuração do ambiente vem de um `.env` fornecido no momento da criação** (`apps/infra/.env`, ou outro arquivo indicado), documentado por `apps/infra/.env.example`: conta/região, domínio e subdomínio, perfil de tamanho (`demo` ou `load`), dimensões de banco/broker/tasks, chave do Google e parâmetros do backend (inclusive a origem do CORS). Variáveis obrigatórias ausentes interrompem o deploy com a lista do que falta; segredos vão para o Secrets Manager, nunca para variáveis em texto puro da task.
- Dois perfis com o mesmo código: `demo` (broker single-instance, RDS Single-AZ, 1 task) e `load` (broker em cluster de 3 nós, RDS Multi-AZ, N tasks com auto scaling).
- Ciclo de vida efêmero: `deploy` cria tudo (incluindo `prisma migrate deploy` e seed opcional) e `destroy` remove tudo, sem proteção contra exclusão, snapshot final nem dados retidos.
- Imagem Docker do backend (novo `Dockerfile`), construída pelo próprio deploy a partir do monorepo.
- Backend:
  - tipo de fila do RabbitMQ configurável (`RABBITMQ_QUEUE_TYPE` = `classic` | `quorum`) para as filas `work`, `.wait` e `.dead`; as filas `broadcast` continuam classic exclusivas;
  - origem do CORS configurável (`CORS_ORIGIN`), aberta quando vazia (comportamento atual), para que um frontend rodando em outro lugar (por exemplo, o local) possa chamar a API na AWS;
  - rota pública `GET /health` para a verificação de saúde do balanceador.
- Fora do escopo: o **frontend** na AWS (change futura, com ECS + CloudFront ou Amplify; até lá ele roda localmente apontando para a API), teste de carga (change futura), pipeline de CI/CD, alteração do CLI.

## Capabilities

### New Capabilities
- `infra/aws-environment`: ambiente efêmero do Jaja na AWS — configuração por `.env`, perfis `demo`/`load`, recursos criados, domínio/HTTPS, segredos, migração/seed no deploy e destruição completa.
- `infra/backend-runtime`: o que o backend oferece para rodar atrás de um balanceador em outro domínio — verificação de saúde pública e origem do CORS configurável.

### Modified Capabilities
- `messaging/message-broker`: o tipo das filas `work`/`.wait`/`.dead` passa a ser configurável (`classic` ou `quorum`), e a conexão com broker que exige TLS (`amqps`) passa a ser parte do contrato.

## Impact

- **Novo**: `apps/infra/` (CDK app, testes de assertions, `.env.example`), `apps/backend/Dockerfile`, `apps/backend/docker/entrypoint.mjs`, `.dockerignore` na raiz.
- **Backend**: `src/messaging/rabbitmq/` (tipo de fila), `src/main.ts` (CORS), novo controller de saúde; `.env.example` documenta `RABBITMQ_QUEUE_TYPE` e `CORS_ORIGIN`.
- **Frontend**: sem alteração.
- **Monorepo**: novo workspace no npm/turbo (`build` e `test` do infra não acessam a AWS); `.gitignore` cobre os `.env*` do infra.
- **Dependências novas** (só no infra): `aws-cdk-lib`, `constructs`, `aws-cdk` (CLI), `dotenv`, `tsx` e `@aws-sdk/client-secrets-manager`.
- **Custo**: recursos cobrados por hora enquanto o ambiente existe; o `destroy` é parte do fluxo normal.
