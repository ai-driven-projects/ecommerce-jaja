## 1. Spike: Amazon MQ e RDS na região

- [x] 1.1 Na região de referência, listar as versões do motor RabbitMQ e os tipos de instância do Amazon MQ (`aws mq describe-broker-engine-types` / `describe-broker-instance-options`), definir os padrões `MQ_ENGINE_VERSION`/`MQ_INSTANCE_TYPE` de cada perfil e quantas sub-redes cada `deploymentMode` exige; registrar o resultado em design.md (Open Questions → Decisions) — feito pela documentação oficial (sem AWS CLI nesta máquina); padrões na decisão 15 do design; conferência na região fica para a 8.1
- [x] 1.2 Confirmar a classe padrão do RDS PostgreSQL 16 em cada perfil (ARM, disponível na região) e registrar em design.md — `t4g.micro` (demo) e `m7g.large` (load), na decisão 15

## 2. Backend: tipo de fila e TLS do broker

- [x] 2.1 Ler `RABBITMQ_QUEUE_TYPE` no `RabbitMqModule` (`classic` padrão, `quorum`; outro valor impede o início citando a variável e os valores aceitos), com teste unitário da leitura
- [x] 2.2 Aplicar `x-queue-type` nas filas `work`, `.wait` e `.dead` do consumer e na fila de inspeção do publisher, mantendo as filas `broadcast` classic exclusivas; verificar com os testes de `rabbitmq-message.consumer.spec.ts` e do publisher cobrindo os dois tipos
- [x] 2.3 Garantir `amqps://` com porta padrão 5671 e logs só com host:porta; verificar com testes em `rabbitmq-url.util`
- [x] 2.4 Rodar contra o RabbitMQ local (`rabbitmq:4`) o cenário de nova tentativa pela `.wait` com `RABBITMQ_QUEUE_TYPE=quorum` e verificar que a mensagem volta e é processada (registrar o roteiro manual na tarefa ou como teste de integração opcional) — feito com o adapter real contra `rabbitmq:4` local (exchange e fila `spike.*` temporárias, removidas depois): filas criadas como `quorum`, espera inicial de 500 ms cumprida, falha na 1ª tentativa, retorno pela `.wait` em 1 000 ms e sucesso na 2ª
- [x] 2.5 Documentar `RABBITMQ_QUEUE_TYPE="classic"` no `apps/backend/.env.example`, com quando usar `quorum` e a restrição de troca; verificar que o `doctor` do CLI não acusa pendência

## 3. Backend: saúde e CORS

- [x] 3.1 Criar `GET /health` público que responde `{ "status": "ok" }` sem consultar banco nem broker; verificar com teste do controller
- [x] 3.2 Ler `CORS_ORIGIN` (lista por vírgula; vazia = qualquer origem) em `main.ts`; verificar com teste dos cenários de origem permitida, recusada e vazia
- [x] 3.3 Documentar `CORS_ORIGIN=` no `apps/backend/.env.example` e verificar que `npm run build` e `npm run test` do backend passam

## 4. Imagem Docker do backend

- [x] 4.1 Criar `.dockerignore` na raiz (node_modules, .next, dist, .env*, .git, .claude, cdk.out) e verificar que o contexto enviado ao Docker não inclui esses caminhos
- [x] 4.2 Criar `apps/backend/docker/entrypoint.mjs`: compõe `DATABASE_URL` e `RABBITMQ_URL` a partir das partes quando vazias (com `encodeURIComponent` na senha e `sslmode=verify-full`) e executa `serve` ou `migrate` (migrate + seed opcional); verificar com teste unitário da composição das URLs
- [x] 4.3 Criar `apps/backend/Dockerfile` multi-stage com `turbo prune @jaja/backend --docker`, Prisma generate, build, bundle de CA do RDS, `NODE_EXTRA_CA_CERTS`, usuário `node` e ARM64; verificar com `docker build` na raiz e `docker run` apontando para o Postgres e o RabbitMQ locais (`/health` responde 200)

## 5. Workspace `apps/infra` e configuração

- [x] 5.1 Criar o workspace `@jaja/infra` (package.json, tsconfig, `cdk.json`, vitest) com `aws-cdk-lib`, `constructs`, `aws-cdk`, `dotenv`, `tsx` e `@aws-sdk/client-secrets-manager`; scripts `build`, `test`, `synth`, `diff`, `deploy` e `destroy`; verificar que `npm install` e `npm run build --workspace=@jaja/infra` passam
- [x] 5.2 Atualizar o `.gitignore` (`apps/infra/.env*`, `!apps/infra/.env.example`, `apps/infra/cdk.out/`) e verificar com `git check-ignore` que `.env.load` é ignorado e `.env.example` não
- [x] 5.3 Implementar `loadInfraConfig(raw)`: obrigatórias, validações, padrões por perfil, ajustes individuais, todos os erros numa mensagem e avisos de combinação de risco; verificar com testes unitários dos cenários do spec (variáveis ausentes, perfil inválido, conta inválida, ajuste individual, aviso de combinação)
- [x] 5.4 Implementar a resolução do arquivo (`INFRA_ENV_FILE` relativo à raiz, padrão `apps/infra/.env`, erro claro se não existir) e verificar com teste
- [x] 5.5 Escrever `apps/infra/.env.example` com todas as variáveis do spec (efeito, padrão, obrigatória ou não, aviso sobre o seed) e verificar com teste que toda variável lida por `loadInfraConfig` aparece no exemplo

## 6. Construtos da stack

- [x] 6.1 `Network`: VPC com 2 ou 3 AZs conforme o perfil, 1 NAT e security groups por papel; verificar com teste de assertions (sub-redes, regras de entrada)
- [x] 6.2 `Database`: RDS PostgreSQL 16 privado, credenciais geradas, Single/Multi-AZ conforme o perfil, sem deletion protection nem snapshot final; verificar com teste de assertions
- [x] 6.3 `RabbitMqBroker` sobre `CfnBroker`: privado, modo e tipo do perfil, senha por referência dinâmica do secret gerado, endpoint `amqps`; verificar com teste de assertions
- [x] 6.4 Secrets: JWT gerado quando vazio, referência por nome aos secrets gravados pelo script quando preenchidos; verificar com teste
- [x] 6.5 `Edge`: certificado ACM de `api.<sub>.<domínio>` validado por DNS na hosted zone existente (lookup), ALB com listener 443, redirecionamento 80→443, idle timeout de 120 s e registro alias da API; verificar com teste de assertions
- [x] 6.6 `BackendService`: Fargate ARM64, segredos do contêiner, variáveis do backend (`RABBITMQ_QUEUE_TYPE`, `CORS_ORIGIN` do `.env`, `ORDER_SIMULATION_DELAY_FACTOR`...), health check em `/health`, `stopTimeout`/deregistration de 30 s e auto scaling por CPU quando o máximo for maior que o inicial; verificar com teste de assertions nos dois perfis
- [x] 6.7 `DbMigration`: Provider com `onEvent` (RunTask `migrate`) e `isComplete` (DescribeTasks, falha com exit code ≠ 0 citando o log), disparado pelo hash da imagem e por `SEED_ON_DEPLOY`, com o `BackendService` dependendo dele; verificar com teste de assertions (dependência e propriedades)
- [x] 6.8 Logs com retenção `LOG_RETENTION_DAYS` e `RemovalPolicy.DESTROY` em todos os recursos com estado, inclusive os log groups das Lambdas; verificar com teste de assertions que nenhum recurso tem `DeletionPolicy: Retain`/`Snapshot`
- [x] 6.9 Teste de "template sem segredo": sintetizar com `JWT_SECRET` e `GOOGLE_MAPS_API_KEY` conhecidos e verificar que nenhum arquivo do `cdk.out` contém esses valores
- [x] 6.10 Verificar que `npm run build` e `npm run test` na raiz passam sem credenciais AWS, sem `.env` do infra e sem Docker

## 7. Scripts de deploy e destroy

- [x] 7.1 `scripts/deploy.ts`: valida o `.env` (mostra erros e avisos), grava ou atualiza os secrets vindos do `.env`, roda `cdk deploy` com a configuração e mostra a URL da API e o comando de destruição; verificar com teste unitário da orquestração (SDK e `cdk` simulados)
- [x] 7.2 `scripts/destroy.ts`: roda `cdk destroy` e apaga os secrets gravados pelo script com `ForceDeleteWithoutRecovery`; verificar com teste unitário da orquestração
- [x] 7.3 Escrever `apps/infra/README.md`: pré-requisitos (bootstrap, Docker, credenciais), passo a passo, perfis, estimativas de tempo, custo por hora e lembrete do `destroy`, o que fica do bootstrap do CDK e como limpar; verificar que os comandos citados existem no package.json

## 8. Validação na AWS

- [ ] 8.1 Deploy `demo` com `SEED_ON_DEPLOY=true` e `CORS_ORIGIN=http://localhost:3000`: verificar HTTPS em `api.<sub>.<domínio>`, redirecionamento 80→443, `GET /health` 200, `GET /storefront/products` com dados do seed, banco e broker inacessíveis da internet e a vitrine local carregando com `NEXT_PUBLIC_API_URL` apontando para a API
- [ ] 8.2 No `demo`, criar um pedido pela API (ou pela vitrine local) e acompanhar o stream por 5 minutos: verificar que o pedido avança até o fim pelos consumidores simulados e que a conexão não cai
- [ ] 8.3 Deploy `load` (cluster + quorum + 2 tasks): verificar as filas do tipo `quorum` no console do broker e que o aviso do pedido chega com o stream e o consumidor em tasks diferentes
- [ ] 8.4 Destroy e novo deploy: verificar que não sobra recurso com o prefixo `ENV_NAME`, que os secrets do script foram apagados, que a hosted zone tem os mesmos registros de antes e que, recriado, a API volta na mesma URL
- [x] 8.5 Rodar `openspec validate aws-ephemeral-environment --strict` e corrigir o que for apontado
