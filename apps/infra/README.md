# @jaja/infra — ambiente efêmero do backend na AWS

Cria na AWS, com **AWS CDK (TypeScript)**, um ambiente com cara de produção para o backend do
Jaja e suas dependências. A ideia é usar por pouco tempo (demonstração, teste de carga) e
**destruir tudo** em seguida.

```
https://api.<APP_SUBDOMAIN>.<DOMAIN_NAME>        URL fixa (Route 53, alias)
        |
        v
ALB  HTTPS 443 (certificado ACM), 80 -> 443, idle timeout 120 s (streams ao vivo)
        |
        v
ECS Fargate (ARM64): backend Nest, 1..N tasks          sub-redes privadas
        |                       |
        v                       v
RDS PostgreSQL 16 (TLS)    Amazon MQ for RabbitMQ (amqps)
```

Tudo fica numa stack só (`<ENV_NAME>`). O frontend não faz parte do ambiente: rode-o localmente
apontando para a API (veja [Usar a vitrine local](#usar-a-vitrine-local)).

## Pré-requisitos

- Credenciais da AWS da conta do `.env` (`AWS_PROFILE` ou variáveis `AWS_*`), com permissão para
  CloudFormation, EC2/VPC, ECS, ECR, RDS, Amazon MQ, Secrets Manager, Route 53, ACM, ELB, IAM,
  Lambda, Step Functions e CloudWatch Logs.
- Uma **hosted zone já existente** no Route 53 dessa conta (`DOMAIN_NAME`).
- **Docker** rodando: o deploy constrói a imagem do backend (ARM64) a partir do monorepo.
- Uma vez por conta e região, o bootstrap do CDK:

  ```bash
  npx cdk bootstrap aws://<AWS_ACCOUNT_ID>/<AWS_REGION>
  ```

## Passo a passo

1. Copie o exemplo e preencha. Só `AWS_ACCOUNT_ID`, `AWS_REGION` e `DOMAIN_NAME` são obrigatórias:

   ```bash
   cp apps/infra/.env.example apps/infra/.env
   ```

   Para manter mais de uma configuração, crie outros arquivos (`apps/infra/.env.load`, ...) e
   indique qual usar em `INFRA_ENV_FILE`, relativo à raiz do repositório. Os `.env*` do infra,
   exceto o `.env.example`, ficam fora do git.

2. Crie o ambiente:

   ```bash
   npm run deploy --workspace=@jaja/infra
   ```

   O script valida o `.env` e lista todos os problemas de uma vez. Depois confere se as
   credenciais são da conta do `.env`, grava no Secrets Manager os segredos que vieram dele e roda
   o `cdk deploy`. Opções extras vão para o CDK, por exemplo
   `npm run deploy --workspace=@jaja/infra -- --require-approval never`. No fim aparecem a URL da
   API e o comando de destruição.

3. Teste: `curl https://api.<APP_SUBDOMAIN>.<DOMAIN_NAME>/health` responde `{"status":"ok"}`.

4. Ao terminar, **destrua**:

   ```bash
   npm run destroy --workspace=@jaja/infra
   ```

   O comando pede confirmação; para pular, passe `-- --force`. Ele roda o `cdk destroy` e, se der
   certo, apaga os segredos gravados pelo script.

Com outro arquivo: `INFRA_ENV_FILE=apps/infra/.env.load npm run deploy --workspace=@jaja/infra`
(e o mesmo no `destroy`).

Outros comandos: `synth` gera o template sem alterar a conta; `diff` compara com o que está no ar.

## Perfis (`ENV_SIZE`)

| | `demo` (padrão) | `load` |
|---|---|---|
| Tasks do backend | 1 | 2 a 6, auto scaling por CPU (60%) |
| CPU / memória da task | 512 / 1024 MiB | 1024 / 2048 MiB |
| RDS | `db.t4g.micro`, Single-AZ | `db.m7g.large`, Multi-AZ |
| Amazon MQ | `mq.m7g.medium`, instância única | `mq.m7g.large`, cluster de 3 nós |
| Filas do RabbitMQ | `classic` | `quorum` |
| Zonas da VPC | 2 | 3 |

Cada dimensão pode ser ajustada no `.env`; o `.env.example` explica cada variável. O RabbitMQ 4
do Amazon MQ só roda em `mq.m7g.*`.

## Tempo e custo

- **Criar** leva cerca de 20 a 30 minutos no `demo` e de 30 a 45 no `load`. O broker e o RDS são
  o caminho crítico. **Destruir** leva de 10 a 20 minutos.
- Os recursos são **cobrados por hora enquanto existirem**: NAT Gateway, ALB, broker, RDS e tasks.
  O `load` custa várias vezes o `demo`. Consulte a calculadora da AWS para a sua região e não
  esqueça o `destroy`.

## O que acontece no deploy

- **Imagem**: `apps/backend/Dockerfile`, com contexto na raiz do monorepo. O alvo `runtime` serve
  a API, e o alvo `migrate` roda as migrations e o seed.
- **Migração**: a cada deploy em que a imagem ou o `SEED_ON_DEPLOY` mudam, uma task avulsa roda
  `prisma migrate deploy` e, se `SEED_ON_DEPLOY="true"`, o seed. As tasks novas da API só entram
  depois disso. Se a migração falhar, o deploy falha, o CloudFormation desfaz as mudanças e as
  tasks antigas continuam no ar. A mensagem de erro indica o log group e o stream da migração.
- **Segredos**: as credenciais do banco e do broker são geradas pela stack. O `JWT_SECRET` vazio
  também é gerado. Os valores que vêm do `.env` (`JWT_SECRET`, `GOOGLE_MAPS_API_KEY`) são gravados
  pelo script em `<ENV_NAME>/app/*` e nunca passam pelo template. As tasks recebem tudo como
  segredos do ECS, e o entrypoint da imagem monta `DATABASE_URL` e `RABBITMQ_URL` com TLS.
- **Logs**: no CloudWatch, num log group com retenção de `LOG_RETENTION_DAYS` dias (padrão 3). O
  nome aparece na saída `LogGroup` do deploy.

## Usar a vitrine local

1. No `.env` do infra: `CORS_ORIGIN=http://localhost:3000`, e depois rode o deploy.
2. No `apps/frontend/.env`: `NEXT_PUBLIC_API_URL=https://api.<APP_SUBDOMAIN>.<DOMAIN_NAME>`.
3. `npm run dev --workspace=@jaja/frontend`.

Para ter dados na vitrine, use `SEED_ON_DEPLOY=true`. Atenção: os usuários do seed têm senhas
conhecidas e ficam acessíveis pela API pública enquanto o ambiente existir.

## O que sobra depois do destroy

O `destroy` remove a stack inteira, sem retenção nem snapshot: VPC, ALB, certificado, registro DNS
da API, RDS, broker, segredos, logs e tasks. A hosted zone e os registros que já existiam nela não
são tocados.

Ficam só os recursos do **bootstrap do CDK**, compartilhados pela conta e região: a stack
`CDKToolkit`, com o bucket S3 e o repositório ECR onde o deploy envia a imagem e os assets. Eles
servem a qualquer deploy de CDK. Para limpar as imagens antigas, apague-as no repositório
`cdk-hnb659fds-container-assets-<conta>-<região>` do ECR. Para remover o bootstrap por completo,
esvazie o bucket e o repositório e apague a stack `CDKToolkit` no CloudFormation, mas só se nada
mais na conta usar o CDK.

## Testes

`npm run test --workspace=@jaja/infra` valida a configuração, o template (recursos de cada perfil,
sem retenção, sem segredo no template) e os scripts, sem AWS, sem Docker e sem `.env`.
`npm run build` faz o type check.
