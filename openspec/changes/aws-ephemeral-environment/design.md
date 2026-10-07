## Context

A motivação está em proposal.md, e os requisitos estão em `specs/infra/aws-environment`, `specs/infra/backend-runtime` e `specs/messaging/message-broker`. O estado atual que molda a abordagem:

- **Backend (NestJS, Node 24, ESM)**: lê `DATABASE_URL` (Prisma 7 com `@prisma/adapter-pg`) e `RABBITMQ_URL`. Os dois são strings únicas com credenciais embutidas. Tem `enableShutdownHooks()` e `enableCors()` aberto. Não tem guard global nem rota de saúde.
- **Mensageria**: tudo que é RabbitMQ está em `src/messaging/rabbitmq/`. O adapter usa só AMQP 0-9-1 padrão (exchange topic, TTL por mensagem, DLX, filas exclusivas), sem plugins, e já trata `amqps:` em `rabbitmq-url.util.ts`. As filas são declaradas sem `x-queue-type`, ou seja, classic.
- **Várias instâncias**: o outbox usa `FOR UPDATE SKIP LOCKED`, as filas `work` dividem as mensagens e o live feed tem uma fila por instância. O heartbeat dos streams é de 20 s (`ORDER_STREAM_HEARTBEAT_MS`).
- **Frontend (Next)**: fica fora desta change. Ele continua rodando localmente e pode apontar para a API na AWS (`NEXT_PUBLIC_API_URL`), o que exige CORS liberado para a origem dele.
- **Seed**: todas as tasks fazem `upsert`, então o seed é idempotente. Os usuários do seed têm senhas conhecidas.
- **Monorepo**: npm workspaces + turbo. O backend depende de `modules/*` e de `packages/shared` (submódulo). Não há Dockerfile.

## Goals / Non-Goals

**Goals:**
- Um comando cria o ambiente inteiro a partir de um `.env`, e outro destrói tudo.
- Os mesmos construtos servem aos perfis `demo` e `load`, que diferem só em valores.
- Mudanças mínimas e opcionais na aplicação, com o comportamento local inalterado quando as variáveis novas estão vazias.
- A lógica de configuração e o template ficam testáveis sem AWS.

**Non-Goals:**
- Frontend na AWS (change futura, com ECS + CloudFront ou Amplify). Teste de carga, CI/CD, múltiplos ambientes simultâneos na mesma conta com o mesmo `ENV_NAME`, observabilidade além de logs e métricas padrão (dashboards e alarmes ficam para a change de carga).
- Alta disponibilidade do NAT, WAF e CDN.
- Integração com o CLI (`apps/cli`). Se vier, será o CLI se adaptando ao infra, nunca o contrário.

## Decisions

### 1. AWS CDK em TypeScript, num workspace `apps/infra`
- **Por quê**: a linguagem é a mesma do monorepo, a configuração é tipada, e o template pode ser testado com `aws-cdk-lib/assertions` dentro do `npm run test`. O estado fica no CloudFormation, sem bucket de state para cuidar. Construtos de alto nível cobrem ALB, ECS e RDS.
- **Alternativas**: Terraform/OpenTofu (padrão de mercado e `aws_mq_broker` completo, mas é outra linguagem e exige gerenciar state); Pulumi (TS também, mas o state precisa do Pulumi Cloud ou de um backend próprio); SST (ótimo para Next, mas é uma camada a mais e opinativa).
- **Custo da escolha**: o Amazon MQ só tem o construto L1 (`CfnBroker`). Ele fica encapsulado num construto próprio, `RabbitMqBroker`.

### 2. Configuração: `.env` → parser puro → objeto tipado
- `bin/infra.ts` resolve o arquivo (`INFRA_ENV_FILE`, relativo à raiz do repositório; padrão `apps/infra/.env`), carrega com `dotenv` **sem** misturar com `process.env`, exceto `AWS_PROFILE`, e passa o mapa para `loadInfraConfig(raw)`.
- `loadInfraConfig` é uma função pura, sem I/O: valida tudo, acumula **todos** os erros numa mensagem só, aplica os padrões do perfil e depois os ajustes individuais, e devolve um `InfraConfig` imutável. Ela também produz os avisos de combinação de risco (broker em instância única com filas quorum, cluster com filas classic). Tem testes unitários.
- A guarda de conta usa o mecanismo do próprio CDK: a stack recebe `env: { account: AWS_ACCOUNT_ID, region: AWS_REGION }`, e o CDK recusa operar com credenciais de outra conta. Um teste documenta esse comportamento.
- **Alternativa rejeitada**: `-c chave=valor` no `cdk.json`. Espalha a configuração e não deixa segredos fora do histórico do shell.

### 3. Uma stack por ambiente, organizada em construtos
A stack se chama `<ENV_NAME>` (por exemplo, `jaja`) e contém os construtos `Network`, `Database`, `RabbitMqBroker`, `Secrets`, `BackendService`, `DbMigration` e `Edge` (ALB, certificado, DNS). Com uma stack só, o deploy e a destruição são atômicos.
- **Alternativa rejeitada**: dividir em stacks de rede, dados e app. Ajuda a reaproveitar a rede, mas complica a destruição (ordem, exports entre stacks) sem ganho num ambiente efêmero.

### 4. Rede
- VPC com sub-redes públicas (ALB, NAT) e privadas com egress (tasks, RDS, MQ), com **1 NAT Gateway** em qualquer perfil. As tasks precisam de saída para o ECR, o Secrets Manager e a Google Geocoding API.
- Número de AZs: 2 no `demo` e 3 no `load`, porque o cluster do Amazon MQ distribui os nós entre AZs. O número exato de sub-redes que o `CfnBroker` exige em cada modo é confirmado na tarefa de spike.
- Security groups por papel: o ALB aceita 80/443 da internet; o backend aceita só do ALB na porta 4000; o RDS aceita 5432 só do backend e da task de migração; o MQ aceita 5671 só do backend.

### 5. Computação: ECS Fargate em ARM64 atrás de um ALB
- Um `FargateService` do backend atrás de um ALB público, com listener 443 usando o certificado do ACM para `api.<sub>.<domínio>`. O listener 80 só redireciona. O registro alias no Route 53 aponta o nome fixo para o ALB, que é recriado a cada ambiente; por isso a URL não muda entre recriações. Um frontend na AWS, no futuro, entraria como outra regra por host no mesmo ALB.
- **ARM64 (Graviton)**: é mais barato e coincide com o build local em Macs Apple Silicon. Com o Prisma 7 e o `adapter-pg` não há binário nativo de query engine, então nada impede o ARM.
- Idle timeout do ALB em 120 s, acima do heartbeat de 20 s dos streams. Deregistration delay e `stopTimeout` de 30 s, para os hooks de shutdown do Nest terminarem.
- Health check do target group em `GET /health` (spec `backend-runtime`). A rota não consulta o banco nem o broker, para que uma oscilação do broker não tire todas as tasks de circulação.
- Auto scaling do backend por CPU (alvo de 60%) entre `BACKEND_DESIRED_COUNT` e `BACKEND_MAX_COUNT`, só quando o máximo for maior que o inicial.

### 6. Imagem a partir do monorepo
- O `Dockerfile` fica em `apps/backend`, com contexto na raiz do repositório (`DockerImageAsset` com `directory` = raiz e `file` = `apps/backend/Dockerfile`). Multi-stage com `turbo prune @jaja/backend --docker`, que copia só os workspaces de que o pacote depende, incluindo `packages/shared` e `modules/*`. Depois vêm `npm ci`, build e a imagem final `node:24-alpine` (ou `-slim`) com usuário `node`.
- Um `.dockerignore` na raiz exclui `node_modules`, `.next`, `dist`, `.env*`, `.git` e `.claude`.
- **Alternativa rejeitada**: um pipeline que publica no ECR. Para o uso efêmero, o próprio `cdk deploy` construir e enviar a imagem basta.

### 7. Credenciais compostas no contêiner, não na aplicação
O backend continua lendo `DATABASE_URL` e `RABBITMQ_URL`. A imagem tem um entrypoint (`apps/backend/docker/entrypoint.mjs`, fora de `src/`) que, se essas variáveis estiverem vazias, monta cada uma a partir das partes injetadas pelo ECS, com a senha passando por `encodeURIComponent`:
- `DATABASE_URL`: `DB_HOST`, `DB_PORT` e `DB_NAME` em texto, `DB_USER` e `DB_PASSWORD` como segredos (campos do secret do RDS), mais `sslmode` para TLS;
- `RABBITMQ_URL`: `RABBITMQ_ENDPOINT` (o `amqps://host:5671` do broker) em texto, `RABBITMQ_USER` e `RABBITMQ_PASSWORD` como segredos.

Em seguida, o entrypoint executa o comando pedido: `serve` importa `dist/main.js` no mesmo processo; `migrate` roda `prisma migrate deploy` e, com `SEED_ON_DEPLOY=true`, `prisma db seed`.
- **Por quê**: o ECS injeta campos de um secret, mas não compõe strings. O código da aplicação não fica sabendo de AWS.
- **Alternativa rejeitada**: um secret com a URL completa, montado por um recurso customizado. Seria mais uma Lambda, e a senha passaria por ela.

### 8. TLS do banco e do broker
- O RDS PostgreSQL 16 exige TLS por padrão (`rds.force_ssl`). O `pg` verifica o certificado, e a CA do RDS não está no bundle do Node. A imagem do backend inclui o bundle global oficial da AWS (baixado no build de `truststore.pki.rds.amazonaws.com`), e a task define `NODE_EXTRA_CA_CERTS` apontando para ele. A URL usa `sslmode=verify-full`.
- O Amazon MQ usa certificado público, então o `amqps` funciona sem configuração extra. O requisito "Conexão com TLS" do broker só formaliza e testa esse comportamento, incluindo a porta padrão 5671.

### 9. Amazon MQ: construto `RabbitMqBroker` sobre `CfnBroker`
- `engineType: RABBITMQ`, `deploymentMode` `SINGLE_INSTANCE` ou `CLUSTER_MULTI_AZ`, `publiclyAccessible: false`, sub-redes privadas e o security group do MQ.
- O usuário e a senha vêm de um secret gerado. A senha chega ao `CfnBroker` como referência dinâmica do Secrets Manager, então o template guarda a referência, não o valor.
- O endpoint vem de `Fn.select(0, broker.attrAmqpEndpoints)`. No cluster, esse é o endpoint único do NLB do serviço.
- Versão do motor e tipo de instância vêm do `.env`. Os padrões de cada perfil são fixados no spike (tarefa 1), conforme o que a região oferece.

### 10. Filas quorum no adapter
Com `RABBITMQ_QUEUE_TYPE`, o `RabbitMqModule` passa a configuração ao consumer e ao publisher, que declaram `x-queue-type` nas filas `work`/`.wait`/`.dead` e na fila de inspeção. O tipo é **sempre explícito**, inclusive `classic` e inclusive nas filas `broadcast` (`durable: false, exclusive: true, x-queue-type: classic`). O motivo é que, no Amazon MQ for RabbitMQ 4.2+, o tipo padrão é `quorum`: sem o argumento, uma fila "classic" viraria quorum, e a exclusiva falharia. Testado localmente: o RabbitMQ 4 grava `x-queue-type` nas filas antigas, então redeclarar com `classic` explícito não quebra o broker local. O TTL por mensagem e o dead-letter funcionam em filas quorum nas versões atuais do RabbitMQ. O teste de integração com Docker (a imagem `rabbitmq:4` local) roda o mesmo cenário de nova tentativa nos dois tipos.

### 11. Migração e seed: tarefa única por deploy, via recurso customizado
- O construto `DbMigration` usa um `custom_resources.Provider` com `onEvent` (chama `ecs:RunTask` com a imagem do backend e o comando `migrate`) e `isComplete` (consulta `ecs:DescribeTasks` até `STOPPED` e falha se o exit code não for 0, indicando na mensagem o log group e o stream do log).
- As propriedades do recurso incluem o hash da imagem do backend e `SEED_ON_DEPLOY`, para que ele rode de novo quando um deles muda. O `BackendService` depende do recurso, então as tasks novas só entram depois da migração. Se ela falhar, o CloudFormation faz rollback e as tasks antigas continuam.
- **Alternativas rejeitadas**: container de init em cada task (N migrações e seeds concorrentes no scale-out); rodar no `CMD` antes de subir (mesmo problema, além de atrasar o health check); rodar à mão depois do deploy (deixa o ambiente inconsistente).

### 12. Segredos
- **Gerados pela stack** (o valor nunca passa pelo `.env` nem pelo template): credenciais do banco (geradas pelo RDS), credenciais do broker e, quando `JWT_SECRET` está vazio, o JWT (`generateSecretString`). Os nomes são gerados pelo CDK, então um novo deploy logo depois de um `destroy` não esbarra na janela de recuperação do Secrets Manager.
- **Vindos do `.env`** (`JWT_SECRET` preenchido, `GOOGLE_MAPS_API_KEY`): qualquer forma de passá-los pelo CloudFormation, seja `secretStringValue` ou parâmetros de `AwsCustomResource`, grava o valor no template. Por isso o script `deploy` do infra (`scripts/deploy.ts`) grava esses valores **antes** do `cdk deploy`, pelo SDK (`CreateSecret`/`PutSecretValue`), com os nomes fixos `<ENV_NAME>/app/jwt-secret` e `<ENV_NAME>/app/google-maps-api-key`. A stack só os referencia por nome (`Secret.fromSecretNameV2`). O script `destroy` apaga esses secrets com `ForceDeleteWithoutRecovery` depois do `cdk destroy`.
- **Alternativa rejeitada**: parâmetros `NoEcho` do CloudFormation. Eles escondem o valor no console, mas a passagem pela linha de comando e o histórico do deploy continuam expondo.
- O teste de "template sem segredo" sintetiza com valores conhecidos no `.env` e procura esses valores em todo o `cdk.out`.

### 13. Destruição
- Todos os recursos com estado têm `RemovalPolicy.DESTROY`. O RDS tem `deletionProtection: false` e não faz snapshot final. Os log groups explícitos têm retenção `LOG_RETENTION_DAYS` (padrão 3) e são destruídos com a stack, inclusive os das Lambdas do recurso customizado. Os secrets da stack são removidos com ela, e os gravados pelo script são apagados pelo `destroy` (decisão 12).
- Os assets do CDK (bucket e repositório ECR do bootstrap) são compartilhados e ficam. O README do infra explica isso e mostra como limpá-los.

### 14. Scripts e integração com o monorepo
- `apps/infra/package.json`: `build` (`tsc --noEmit`), `test` (vitest, como o backend), e `deploy`, `destroy`, `diff` e `synth`. `deploy` e `destroy` são scripts TS (`scripts/deploy.ts`, `scripts/destroy.ts`) que validam o `.env`, cuidam dos secrets vindos dele (decisão 12) e chamam o `cdk`. Nenhum deles entra no turbo.
- Os testes sintetizam a stack com uma configuração de exemplo e `DockerImageAsset` substituído por uma imagem fictícia (via flag no construtor), sem Docker nem rede.
- `.gitignore`: `apps/infra/.env*` com exceção de `!apps/infra/.env.example`, além de `apps/infra/cdk.out/`.

### 15. Padrões dos perfis (spike)
Fonte: documentação do Amazon MQ e do CloudFormation, consultada em 07/10/2026. A conferência pela AWS CLI na região fica para o primeiro deploy (tarefa 8.1). O `.env` sobrepõe qualquer valor.

| | `demo` | `load` |
|---|---|---|
| `MQ_ENGINE_VERSION` | `4.2` | `4.2` |
| `MQ_INSTANCE_TYPE` | `mq.m7g.medium` | `mq.m7g.large` |
| `MQ_DEPLOYMENT_MODE` | `SINGLE_INSTANCE` | `CLUSTER_MULTI_AZ` |
| `DB_INSTANCE_CLASS` | `t4g.micro` | `m7g.large` |
| `DB_MULTI_AZ` | `false` | `true` |
| AZs da VPC | 2 | 3 |

- O RabbitMQ 4 (4.2 e 4.3) só roda em `mq.m7g.*`. O `mq.t3.micro` está descontinuado para brokers novos, por isso o `demo` usa `mq.m7g.medium`, o menor tipo disponível. A versão 4.3 também existe; ficou 4.2 por ser a mais difundida entre as regiões, e dá para trocar pelo `.env`.
- **Tipo padrão de fila no Amazon MQ 4.2+ é `quorum`**: por isso o adapter declara o tipo sempre de forma explícita (decisão 10). A AWS recomenda filas quorum no RabbitMQ 4 por durabilidade. O perfil `demo` mantém `classic` (instância única) e o `load` usa `quorum`.
- Sub-redes: `SINGLE_INSTANCE` recebe exatamente uma sub-rede privada; `CLUSTER_MULTI_AZ` privado exige ao menos uma, e recebe todas as sub-redes privadas (uma por AZ).
- `AutoMinorVersionUpgrade` precisa ser `true` para RabbitMQ 3.13+. O broker aceita um único usuário administrativo, criado no provisionamento.
- `AmqpEndpoints` devolve `amqp+ssl://<host>:5671`; o entrypoint da imagem converte para `amqps://`.
- Métricas por fila do RabbitMQ 4 não vão para o CloudWatch, só as do broker. As filas se consultam pela API de gerenciamento, o que interessa à change de carga.

## Risks / Trade-offs

- [Criar o ambiente leva de 30 a 45 min, por causa do Amazon MQ em cluster e do RDS Multi-AZ] → aceito; o README dá a estimativa, e o perfil `demo` encurta.
- [Quorum + TTL por mensagem + dead-letter se comportar diferente na versão do Amazon MQ] → spike na tarefa 1 e teste de integração local nos dois tipos; se houver diferença, o padrão do `load` volta a `classic` com aviso.
- [Seed com senhas conhecidas num endereço público] → `SEED_ON_DEPLOY` vem `false` por padrão, o `.env.example` avisa, e a vida do ambiente é curta.
- [Custo esquecido ligado (NAT, MQ, RDS são cobrados por hora)] → o README destaca o `destroy`, e a saída do deploy repete o comando.
- [Download do bundle de CA do RDS no build da imagem] → URL oficial da AWS; falha de rede quebra o build com uma mensagem clara.
- [NAT único é ponto único de falha no `load`] → aceito para o objetivo atual; se necessário, a change de carga troca por NAT por AZ ou VPC endpoints.
- [Trocar `RABBITMQ_QUEUE_TYPE` num broker existente falha na declaração] → num ambiente efêmero o broker nasce com o tipo certo; o `.env.example` explica a restrição.
- [Recurso customizado de migração travado (task não sobe por falta de imagem ou rede)] → `isComplete` com timeout total de 20 min e mensagem apontando o log.

## Migration Plan

1. Uma vez por conta e região: `npx cdk bootstrap aws://<conta>/<região>` (documentado no README).
2. Copiar `apps/infra/.env.example` para `apps/infra/.env` (ou `.env.<nome>`) e preencher.
3. `npm run deploy --workspace=@jaja/infra`, que mostra no fim a URL da API e o comando de destruição. Para usar a vitrine, rode o frontend local com `NEXT_PUBLIC_API_URL` apontando para essa URL e `CORS_ORIGIN` incluindo `http://localhost:3000` no `.env` do infra.
4. Usar e, ao terminar, rodar `npm run destroy --workspace=@jaja/infra`.

**Rollback**: um deploy com falha volta sozinho pelo CloudFormation. Um ambiente quebrado se resolve com `destroy` e um novo `deploy`. As mudanças na aplicação são compatíveis com o ambiente local, porque as variáveis novas vazias mantêm o comportamento de hoje.
