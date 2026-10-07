## Purpose

Define o ambiente efêmero do backend do Jaja e de suas dependências na AWS: como ele é configurado por um `.env` fornecido na criação, os perfis de tamanho, os recursos e a rede, o domínio com HTTPS, os segredos, a migração do banco no deploy e a destruição completa, sem que o build e os testes do monorepo dependam da AWS.

## ADDED Requirements

### Requirement: Configuração do ambiente por arquivo .env
Toda configuração do ambiente SHALL vir de um arquivo `.env` fornecido no momento do deploy: `apps/infra/.env` por padrão, ou o arquivo indicado em `INFRA_ENV_FILE`. Nenhum valor específico de conta, domínio ou segredo MAY estar fixo no código ou versionado. `apps/infra/.env.example` SHALL documentar cada variável, com o efeito, o padrão e se é obrigatória, sem valores reais:
- obrigatórias: `AWS_ACCOUNT_ID`, `AWS_REGION` e `DOMAIN_NAME` (nome de uma hosted zone já existente no Route 53 dessa conta);
- identificação: `ENV_NAME` (padrão `jaja`, prefixo dos recursos) e `APP_SUBDOMAIN` (padrão `jaja`);
- perfil e dimensões: `ENV_SIZE` (`demo` ou `load`, padrão `demo`) e os ajustes individuais `BACKEND_DESIRED_COUNT`, `BACKEND_MAX_COUNT`, `BACKEND_CPU`, `BACKEND_MEMORY`, `DB_INSTANCE_CLASS`, `DB_MULTI_AZ`, `MQ_INSTANCE_TYPE`, `MQ_DEPLOYMENT_MODE`, `MQ_ENGINE_VERSION`, `RABBITMQ_QUEUE_TYPE` e `LOG_RETENTION_DAYS`;
- aplicação: `JWT_SECRET`, `GOOGLE_MAPS_API_KEY`, `CORS_ORIGIN` (vazia = qualquer origem), `ORDER_SIMULATION_DELAY_FACTOR` e `SEED_ON_DEPLOY` (padrão `false`).

Se o arquivo não existir, ou se faltar alguma variável obrigatória, ou se algum valor for inválido (perfil desconhecido, número fora do intervalo, conta com formato diferente de 12 dígitos), o deploy MUST parar antes de criar ou alterar qualquer recurso, com uma mensagem que lista todas as variáveis com problema. Se a conta das credenciais AWS em uso for diferente de `AWS_ACCOUNT_ID`, o deploy MUST parar sem alterar nada. Os arquivos `.env*` de `apps/infra`, exceto `.env.example`, MUST ser ignorados pelo git.

#### Scenario: Variáveis obrigatórias ausentes
- **WHEN** o deploy roda com um `.env` sem `DOMAIN_NAME` e com `ENV_SIZE="grande"`
- **THEN** o deploy termina com erro antes de qualquer recurso ser criado, e a mensagem cita `DOMAIN_NAME` (obrigatória) e `ENV_SIZE` (valores aceitos: `demo`, `load`)

#### Scenario: Arquivo indicado
- **WHEN** o deploy roda com `INFRA_ENV_FILE=apps/infra/.env.load`
- **THEN** a configuração é lida desse arquivo e não de `apps/infra/.env`

#### Scenario: Conta errada
- **WHEN** as credenciais em uso pertencem à conta `111111111111` e o `.env` informa `AWS_ACCOUNT_ID="222222222222"`
- **THEN** o deploy termina com erro informando a divergência, sem alterar nenhum recurso

#### Scenario: Arquivo de ambiente fora do git
- **WHEN** existe `apps/infra/.env.load` com valores reais
- **THEN** `git status` não lista o arquivo, e `apps/infra/.env.example` continua versionado

### Requirement: Perfis de tamanho
`ENV_SIZE` SHALL escolher os padrões das dimensões do ambiente, e cada variável de ajuste presente no `.env` MUST sobrepor só o padrão correspondente:

| Dimensão | `demo` | `load` |
|---|---|---|
| Tasks do backend (inicial / máximo) | 1 / 1 | 2 / 6, com auto scaling por CPU |
| Banco | instância pequena, Single-AZ | instância maior, Multi-AZ |
| Broker | instância única | cluster de 3 nós em várias AZs |
| Tipo das filas do broker | `classic` | `quorum` |

A combinação de broker em instância única com filas `quorum`, ou de cluster com filas `classic`, MUST ser aceita, mas o deploy MUST emitir um aviso explicando o risco.

#### Scenario: Perfil demo
- **WHEN** o deploy roda com `ENV_SIZE="demo"` e sem ajustes
- **THEN** o ambiente tem 1 task de backend, banco Single-AZ, broker em instância única e o backend recebe `RABBITMQ_QUEUE_TYPE=classic`

#### Scenario: Ajuste individual
- **WHEN** o deploy roda com `ENV_SIZE="load"` e `BACKEND_MAX_COUNT="10"`
- **THEN** o auto scaling do backend vai até 10 tasks, e as demais dimensões seguem o perfil `load`

### Requirement: API em domínio próprio com HTTPS
A API do backend SHALL responder em `https://api.<APP_SUBDOMAIN>.<DOMAIN_NAME>`, uma URL fixa entre deploys e entre destruições e recriações do ambiente, com certificado válido emitido e validado automaticamente pelo DNS da hosted zone existente. Requisições HTTP MUST ser redirecionadas para HTTPS. Um balanceador MUST distribuir as requisições entre as tasks do backend e tirar de circulação as que falham na verificação de saúde. A hosted zone MUST NOT ser criada nem removida pelo ambiente; só o registro da API é. No fim, o deploy MUST mostrar a URL da API.

#### Scenario: Acesso pelo domínio
- **WHEN** o deploy termina com `DOMAIN_NAME="exemplo.com.br"` e `APP_SUBDOMAIN="jaja"`
- **THEN** `https://api.jaja.exemplo.com.br/health` responde 200 com certificado válido

#### Scenario: Redirecionamento
- **WHEN** alguém acessa `http://api.jaja.exemplo.com.br/health`
- **THEN** recebe um redirecionamento permanente para `https://api.jaja.exemplo.com.br/health`

#### Scenario: Mesma URL depois de recriar
- **WHEN** o ambiente é destruído e criado de novo com o mesmo `.env`
- **THEN** a API volta a responder em `https://api.jaja.exemplo.com.br`

#### Scenario: Frontend local chamando a API
- **WHEN** o deploy roda com `CORS_ORIGIN="http://localhost:3000"` e o frontend local usa `NEXT_PUBLIC_API_URL="https://api.jaja.exemplo.com.br"`
- **THEN** a vitrine local carrega os dados da API na AWS

### Requirement: Serviços gerenciados em rede privada
O ambiente SHALL usar PostgreSQL gerenciado (RDS, versão 16) e RabbitMQ gerenciado (Amazon MQ for RabbitMQ). O banco, o broker e as tasks MUST ficar em sub-redes privadas, sem endereço público, e só o balanceador MAY receber tráfego da internet. O banco MUST aceitar conexões só das tasks do backend, e o broker só das tasks do backend, pela porta AMQP com TLS. As conexões do backend com o banco e com o broker MUST usar TLS.

#### Scenario: Banco inacessível de fora
- **WHEN** alguém tenta conectar ao endpoint do banco a partir da internet
- **THEN** a conexão não é estabelecida

#### Scenario: Backend fala com o broker gerenciado
- **WHEN** um pedido é criado pela API (`POST /me/orders`) no ambiente `demo`
- **THEN** os eventos do pedido são publicados no Amazon MQ por `amqps` e os consumidores simulados avançam o pedido até o fim

### Requirement: Segredos fora do código e do template
As credenciais do banco e do broker MUST ser geradas no deploy e guardadas no AWS Secrets Manager. `JWT_SECRET` e `GOOGLE_MAPS_API_KEY`, quando informados no `.env`, MUST ser guardados no Secrets Manager. `JWT_SECRET` vazio MUST ser gerado aleatoriamente. Os segredos MUST chegar às tasks como segredos do contêiner, e nenhum valor deles MAY aparecer no template sintetizado, em variáveis de ambiente em texto puro da task, na saída do deploy ou nos logs.

#### Scenario: Template sem segredo
- **WHEN** o template é sintetizado com `JWT_SECRET="s3gr3d0-de-teste"` no `.env`
- **THEN** o texto `s3gr3d0-de-teste` não aparece em nenhum arquivo do template sintetizado

#### Scenario: JWT gerado
- **WHEN** o deploy roda com `JWT_SECRET` vazio
- **THEN** o backend recebe um `JWT_SECRET` aleatório, guardado no Secrets Manager

### Requirement: Migração e seed no deploy
A cada deploy, as migrations do banco (`prisma migrate deploy`) MUST rodar uma única vez, com a imagem do backend sendo publicada, antes de as novas tasks do backend passarem a receber tráfego. Se a migração falhar, o deploy MUST falhar, e as tasks em execução antes do deploy continuam atendendo. Com `SEED_ON_DEPLOY="true"`, o seed do backend MUST rodar logo depois da migração, na mesma execução. O seed é idempotente, por isso repetir o deploy não duplica dados.

#### Scenario: Primeiro deploy com seed
- **WHEN** o primeiro deploy roda com `SEED_ON_DEPLOY="true"`
- **THEN** quando o deploy termina, `GET /storefront/categories` e `GET /storefront/products` já devolvem os dados do seed

#### Scenario: Migração com erro
- **WHEN** uma migration falha durante o deploy
- **THEN** o deploy termina com erro, e a saída indica onde ler o log da migração

### Requirement: Streams ao vivo e várias instâncias
Os streams ao vivo do backend (`text/event-stream`) MUST continuar abertos pelo balanceador enquanto o heartbeat estiver sendo enviado, sem corte por ociosidade. Com mais de uma task de backend, o aviso de um pedido MUST chegar ao cliente independentemente da task que segura a conexão. Uma task MUST receber o sinal de término e ter tempo para encerrar as mensagens em processamento antes de ser parada.

#### Scenario: Stream longo
- **WHEN** um cliente acompanha um pedido por 5 minutos no ambiente
- **THEN** a conexão do stream continua aberta durante todo o período

#### Scenario: Aviso em outra task
- **WHEN** no perfil `load` o consumidor que avança o pedido roda numa task e o stream do cliente está aberto em outra
- **THEN** o cliente recebe o aviso da mudança de status

### Requirement: Imagem construída a partir do monorepo
O deploy SHALL construir a imagem do backend a partir do código atual do monorepo, incluindo os pacotes do workspace de que dependem, sem exigir um registro de imagens prévio nem um pipeline de CI. A imagem MUST rodar com um usuário sem privilégios e conter só o necessário para executar o serviço.

#### Scenario: Deploy depois de uma mudança
- **WHEN** um arquivo do backend é alterado e o deploy roda de novo
- **THEN** uma nova imagem do backend é construída e as tasks do backend são substituídas por ela

### Requirement: Destruição completa
O comando de destruição do ambiente MUST remover todos os recursos criados pelo deploy, incluindo o banco, o broker, os segredos, os logs e o registro DNS da API. O ambiente MUST NOT criar proteção contra exclusão, snapshot final nem recurso retido. A hosted zone e o que existia nela antes do deploy MUST continuar intactos. Ficam fora da destruição só os recursos de bootstrap do CDK, compartilhados pela conta e região (bucket e repositório de imagens dos assets de deploy), que o `apps/infra/README.md` SHALL citar, junto com a forma de limpá-los.

#### Scenario: Ambiente destruído
- **WHEN** a destruição termina
- **THEN** nenhum recurso com o prefixo `ENV_NAME` continua na conta, e a hosted zone tem os mesmos registros que tinha antes do primeiro deploy

### Requirement: Build e testes do monorepo sem AWS
`npm run build` e `npm run test` na raiz MUST passar sem credenciais da AWS, sem `.env` do infra e sem Docker. Os testes do infra MUST verificar o template sintetizado com uma configuração de exemplo: recursos de cada perfil, ausência de proteção contra exclusão, sub-redes privadas para banco e broker e ausência de segredos em texto puro.

#### Scenario: Build sem credenciais
- **WHEN** `npm run build` e `npm run test` rodam numa máquina sem credenciais AWS nem Docker
- **THEN** os dois terminam com sucesso, incluindo o workspace do infra
