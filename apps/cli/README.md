# @jaja/cli

CLI de manutenção do projeto: setup local, banco, qualidade, limpeza, deploy e monitoramento.
Interface no estilo paleta de comandos, construída com [Ink](https://github.com/vadimdemedes/ink).

> **Estado atual.** Implementados: **Doctor**, **Setup**, **Banco de dados**, **Mensageria local**, o
> **Scraper da Kalunga** e os **Loops de desenvolvimento**. Qualidade, Limpeza, Deploy e Produção ainda são placeholders que apenas registram o
> que farão e terminam com o aviso "Ainda não implementado".

## Uso

```bash
# paleta interativa (na raiz do monorepo)
npm run cli

# modo headless, para scripts e CI
npm run cli -- doctor
npm run cli -- setup --steps env,install
npm run cli -- --list
npm run cli -- --help
```

Depois de `npm run build -w @jaja/cli`, o binário `jaja` fica disponível em
`apps/cli/bin/jaja.js` (ou via `npx jaja` dentro do workspace).

Flags: `--yes/-y` assume a resposta padrão nas confirmações e perguntas, `--dry-run` mostra o
que seria feito sem alterar nada, `--steps a,b` / `--all` / `--pending` escolhem etapas, `--list`,
`--help`, `--version`. Qualquer outra `--opção=valor` é repassada ao comando (ex.: `--categorias=escolar`),
tanto no headless quanto na paleta. O código de saída é `1` quando o comando termina com erro e `2`
para uso inválido.

## Menu inicial

| id        | entrada               | tipo    | o que fará                                                            |
| --------- | --------------------- | ------- | --------------------------------------------------------------------- |
| `doctor`  | 🔎 Doctor             | ação    | Verifica Node, npm, git, Docker, gh, dependências, submódulos, `.env`, banco, RabbitMQ e Prisma Client |
| `setup`   | 🧰 Setup              | wizard  | .env, Docker, submódulos, dependências, banco, RabbitMQ, Prisma Client, build, reset*, migrations, seed |
| `db`      | 🐘 Banco de dados     | menu    | `db:status`, `db:start`, `db:stop`, `db:logs`, `db:generate`, `db:migrate`, `db:seed`, `db:reset`, `db:clear-orders`, `db:studio` |
| `broker`  | 🐇 Mensageria local   | menu    | `broker:status`, `broker:start`, `broker:stop`, `broker:logs`, `broker:queues` (RabbitMQ do `docker-compose.yml`) |
| `scrape`  | 🕷️ Scraper da Kalunga | menu    | `scrape:products`, `scrape:seed`, `scrape:categories`, `scrape:status` |
| `loops`   | 🔁 Loops de desenvolvimento | tela | entregam um objetivo em etapas, uma change OpenSpec por etapa, com o Claude em segundo plano (`loops:new`, `loops:status`, `loops:start`, `loops:pause`, `loops:stop`, `loops:approve`, `loops:discard`, `loops:log`) |
| `quality` | 🧪 Qualidade          | wizard  | lint, tipos, testes e build                                           |
| `clean`   | 🧹 Limpeza            | wizard  | builds, caches, node_modules, lockfile e volumes locais (banco e RabbitMQ) |
| `deploy`  | 🚀 Deploy             | jornada | passos por área (`@prep`, `@db`, `@backend`, `@frontend`, `@cicd`) com estado detectado |
| `monitor` | 📡 Produção           | ação    | verificação somente leitura do ambiente publicado                     |

- **Wizard**: checklist das etapas; Espaço marca, `A` tudo/nada, Enter executa. Dependências (`requires`)
  entram automaticamente e o painel de progresso acompanha cada etapa.
- **Menu**: lista de ações diretas.
- **Tela**: uma interface própria (os loops); os filhos continuam acessíveis pelo id e pela busca.
- **Jornada**: passos com estado detectado (feito, pendente, atenção, não verificado). Nada abre selecionado;
  `P` marca os pendentes, `R` detecta de novo. Em headless: `--steps <ids ou @área>`, `--pending`, `--all`.

## Setup do ambiente local

`setup` abre a checklist das etapas; você marca o que quer e Enter executa em ordem, com o painel de
progresso. Dependências entre etapas entram sozinhas (ex.: marcar Migrations inclui Banco local e
Prisma Client). Em headless: `npm run cli -- setup --yes` (etapas padrão), `--steps env,db`, `--all`
ou `--dry-run` para ver o que seria feito.

| etapa        | padrão | o que faz                                                                                   |
| ------------ | ------ | ------------------------------------------------------------------------------------------- |
| `env`        | sim    | Cria `apps/backend/.env` e `apps/frontend/.env` a partir dos `.env.example` e avisa chaves faltando ou não preenchidas (ex.: `JWT_SECRET`) |
| `docker`     | sim    | Verifica se o daemon do Docker responde; no macOS abre o Docker Desktop e espera até 90 s     |
| `submodules` | sim    | `git submodule sync/update`, testando HTTPS e caindo para SSH se preciso                     |
| `install`    | sim    | `npm install` na raiz                                                                        |
| `db`         | sim    | Lê a `DATABASE_URL`; se a porta não responder, `docker compose up -d postgres` no backend e valida as credenciais com `prisma db execute` |
| `broker`     | sim    | Lê `RABBITMQ_PORT` (padrão 5672); se a porta não responder, `docker compose up -d --wait rabbitmq` e espera o healthcheck. Falha vira aviso (o backend sobe sem o broker), com a dica `jaja broker:start` |
| `generate`   | sim    | `npx prisma generate`                                                                        |
| `build`      | sim    | `npm run build` (turbo)                                                                      |
| `reset`      | não    | `npx prisma migrate reset --force` (apaga os dados)                                          |
| `migrate`    | sim    | `npx prisma migrate dev`, com `--name init` quando ainda não existe migration                |
| `seed`       | sim    | `npx prisma db seed`                                                                         |

O Postgres local publica a porta `DB_PORT` do `apps/backend/.env` (padrão **5433**, porque a 5432
costuma estar ocupada pelo container de outro projeto). Se a porta estiver aberta mas as credenciais
falharem, o setup avisa que outra instância está usando a porta.

`doctor` faz as mesmas verificações sem alterar nada (o RabbitMQ parado aparece como aviso, nunca como
erro). O menu `db` expõe cada ação do banco separadamente (`db:start` sobe o container se preciso;
`db:migrate` e `db:seed` garantem o banco antes). `db:stop` para só o PostgreSQL
(`docker compose stop postgres`), sem derrubar o RabbitMQ.

### Limpar pedidos (`db:clear-orders`)

Zera os pedidos antes de uma demonstração, sem mexer no resto dos dados:

```bash
npm run cli -- db:clear-orders --dry-run   # mostra a SQL e as filas que seriam esvaziadas, sem apagar nada
npm run cli -- db:clear-orders --yes       # apaga sem perguntar
```

1. Pede confirmação ("Isso apaga TODOS os pedidos, os eventos deles e as mensagens nas filas. Continuar?"). Sem
   `--yes` a resposta padrão é "não" (e sem terminal, também).
2. Roda, com `docker compose exec -T postgres psql -U <usuário> -d <banco> -At -v ON_ERROR_STOP=1` (usuário e banco
   da `DATABASE_URL`, nunca a senha), **uma única instrução SQL** com CTEs, atômica, que apaga as marcas de
   processamento (`processed_messages`) das mensagens de eventos de pedido, os eventos `aggregate_type = 'Order'` do
   outbox e todos os pedidos (os itens saem em cascata), devolvendo as três contagens. Clientes, carrinhos, catálogo,
   usuários e eventos de outros agregados continuam iguais. Só funciona com o PostgreSQL local do Docker Compose; com
   o serviço fora do ar termina com erro, sem apagar nada.
3. Com o RabbitMQ no ar, esvazia pela API do painel (`DELETE /api/queues/%2F/<fila>/contents`, credencial da
   `RABBITMQ_URL` só no cabeçalho, nunca exibida) as filas `jaja.*` — consumidores, `.wait`, `.dead` e a fila de
   inspeção `jaja.events.all` —, exceto as `jaja.live.*` das instâncias do backend. Broker fora do ar termina com
   aviso: os dados do banco já foram apagados, e basta rodar de novo com o broker no ar para esvaziar as filas.
4. Resume: `N pedido(s), M evento(s) e K marca(s) apagados · Q fila(s) esvaziada(s)`.

> **Rode com o backend parado ou sem pedidos em andamento.** Um consumidor que processa um pedido durante a limpeza
> pode gravar um evento de um pedido já apagado; as mensagens restantes caem em `ORDER_NOT_FOUND` e vão para a
> `.dead`, que o próprio comando esvazia se rodado de novo.

## Mensageria local

O menu `broker` cuida só do serviço `rabbitmq` do `apps/backend/docker-compose.yml`, usado pelo backend
para publicar e consumir os eventos de domínio. As portas vêm de `RABBITMQ_PORT` e `RABBITMQ_MANAGEMENT_PORT` do
`apps/backend/.env` (padrões 5672 e 15672). O CLI nunca exibe a `RABBITMQ_URL`, que carrega usuário e senha:
os endereços aparecem só com host e porta.

| ação            | o que faz                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------- |
| `broker:status` | Estado do serviço (`docker compose ps`), `amqp://localhost:<porta>` e `http://localhost:<porta>` do painel; parado termina com aviso |
| `broker:start`  | Se a porta AMQP não responder, `docker compose up -d --wait rabbitmq` (espera o healthcheck; no `docker-compose` legado, `up -d` + espera da porta) |
| `broker:stop`   | `docker compose stop rabbitmq` (o PostgreSQL continua rodando)                               |
| `broker:logs`   | `docker compose logs --tail 100 -f rabbitmq` (Esc encerra)                                  |
| `broker:queues` | Consulta `GET /api/queues/%2F` do painel com o usuário e a senha da `RABBITMQ_URL` (padrão `jaja`/`jaja`, só no cabeçalho `Authorization`, nunca exibidos) e mostra, por consumidor, mensagens prontas, em processamento, na espera e descartadas e os consumidores conectados, com a fila de inspeção `jaja.events.all` à parte. Painel sem resposta ou credencial recusada termina com aviso e a dica `jaja broker:start`; mensagens em alguma `.dead` terminam com o aviso `N mensagem(ns) descartada(s) em <fila>` |

Cada consumidor do backend tem três filas duráveis, que `broker:queues` agrupa numa linha:

- `jaja.<consumidor>`: ligada ao exchange `jaja.events` pelo tipo do evento; é de onde o backend consome;
- `jaja.<consumidor>.wait`: fila de espera, sem consumidores. Recebe a mensagem que falhou (nova tentativa com espera
  crescente) ou que aguarda a espera inicial do consumidor; ao expirar, ela volta direto para `jaja.<consumidor>`;
- `jaja.<consumidor>.dead`: fila de descarte, sem consumidores. Guarda as mensagens que esgotaram as tentativas ou
  que não são válidas (cabeçalho `x-jaja-dead-reason`), para inspeção e reprocessamento manual pelo painel.

> A limpeza de volume (`clean`, etapa `db`: `docker compose down -v`) apaga os dados do PostgreSQL **e
> também os do RabbitMQ** (filas e mensagens não consumidas). Os eventos pendentes ficam no outbox do
> Postgres, não no broker.

## Scraper da Kalunga

Coleta o catálogo público de [kalunga.com.br](https://www.kalunga.com.br) para JSON e, a partir
dele, gera o seed do catálogo no backend (`scrape:seed`). Fluxo de `scrape:products`:

1. Busca os **departamentos** (categorias principais) e pede para escolher quais raspar
   (checklist na paleta; no headless `--categorias=escolar,informatica`, por slug ou id).
2. Pede a **quantidade de produtos por categoria** (até 25, até 50, 50–100, 100–200, 200–500;
   no headless `--produtos=50-100` ou um número fixo).
3. Para cada categoria, lê os grupos do menu do departamento e amostra os **mais vendidos de vários
   grupos espalhados pela lista** (`--por-grupo=5` por padrão), destaques primeiro, para ter um
   intervalo variado de produtos. Completa com a listagem geral do departamento se faltar.
4. Visita a página de cada produto para obter marca, caminho de categoria, preço à vista/"De:",
   parcelamento, todas as imagens (miniatura e zoom), descrição e disponibilidade
   (`--sem-detalhes` pula essa etapa e grava só o que a listagem mostra).
5. Grava `data/kalunga/categories/<slug>.json` e reconstrói `data/kalunga/brands.json` e
   `data/kalunga/index.json` (veja `data/kalunga/README.md`).
6. Regenera o seed do backend a partir de tudo que está em `data/kalunga` (veja "Seed do backend").

```bash
npm run cli -- scrape:categories                      # departamentos (com --grupos lista os grupos)
npm run cli -- scrape:products                        # interativo (perguntas no terminal)
npm run cli -- scrape:products --categorias=escolar,gamers --produtos=50-100 --yes
npm run cli -- scrape:products --categorias=2 --produtos=30 --dry-run    # só mostra o plano
npm run cli -- scrape:status                          # o que já existe em data/kalunga
```

### Seed do backend

O backend não conhece o CLI. Os seeds de catálogo (`apps/backend/prisma/seed/tasks/catalog-*.seed.ts`)
leem só `apps/backend/prisma/seed/data/{brands,categories,products}.json`, já no formato do banco, e
quem se adapta é o CLI: `scrape:seed` converte o que está em `data/kalunga` nesses arquivos
(`scrape:products` faz o mesmo ao terminar).

| arquivo           | conteúdo                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `brands.json`     | marcas com o slug normalizado pela regra do domínio, uma por slug                                  |
| `categories.json` | árvore departamento → grupo → subgrupo com slugs únicos; as pais vêm antes das filhas (`parentSlug`) |
| `products.json`   | produtos únicos por código (`sku`), preços em centavos, unidade, até 10 imagens, `brandSlug`, `categorySlug` e `isFeatured` (os 24 disponíveis com mais avaliações, 4 estrelas ou mais e 10 avaliações ou mais; desempate por estrelas e sku) |

Com os arquivos gerados, o seed roda do jeito que preferir, com o mesmo resultado:

```bash
npm run cli -- scrape:seed                            # gera os JSON e pergunta se popula o banco
npm run cli -- scrape:seed --popular --yes            # gera e roda só o seed de catálogo
npm run cli -- scrape:seed --dry-run                  # mostra o que seria gerado, sem gravar
npm run cli -- db:seed                                # seed completo (usuários + catálogo) pelo CLI
npx prisma db seed                                    # dentro de apps/backend, sem o CLI
npx prisma db seed -- --only=catalog                  # só marcas, categorias e produtos
```

Rodar o seed de novo é seguro (idempotente): marcas só são inseridas; categorias (por slug) e
produtos (por sku) são atualizados, então edições feitas no admin nesses registros são sobrescritas.

Outras opções: `--paralelo=4` (requisições simultâneas) e `--intervalo-ms=150` (pausa mínima entre
requisições). Fontes usadas no site: `GET /apimenu/submenuTodasCategorias` (departamentos),
`GET /apimenu/submenu/<id>` (grupos), `POST /api/obterDepartamentoFiltros` (listagem paginada, a
mesma chamada que a página faz), a página `/prod/<slug>/<id>` e `GET /api/obterProdutoDetalhes/<id>`.

## Loops de desenvolvimento

Um loop entrega um objetivo grande em etapas, **uma change OpenSpec por etapa**, do início ao fim sem participação
humana: em cada iteração o Claude estuda a etapa e propõe a change (a da etapa seguinte já vai sendo escrita em paralelo
enquanto esta é implementada), implementa, o script verifica (build, lint, tipos, testes), o Claude corrige o que
quebrar, arquiva, e o script commita. Precisa de `claude`, `openspec` e `git` no `PATH` (e dos comandos extras que o
loop declarar).

```bash
npm run cli -- loops                                    # lista (na paleta: a tela dos loops)
npm run cli -- loops:new --nome=pedidos-cancelamento --objetivo="Permitir cancelar pedidos não enviados"
npm run cli -- loops:new --nome=entregas --specs=change-a,change-b   # de specs já criadas, nesta ordem
npm run cli -- loops:approve --loop=pedidos-cancelamento
npm run cli -- loops:start --loop=pedidos-cancelamento  # sobe o vigia em segundo plano
npm run cli -- loops:status --loop=pedidos-cancelamento
npm run cli -- loops:log --loop=pedidos-cancelamento --seguir
npm run cli -- loops:pause --loop=pedidos-cancelamento  # ao fim do passo atual (--cancelar desfaz)
npm run cli -- loops:stop --loop=pedidos-cancelamento --yes
```

Sem `--loop`, os comandos perguntam qual (ou usam o único possível). `loops:new` aceita `--modelo=<id>`.

### A pasta do loop

```
openspec/loops/<nome>/
  plano.md      o arquivo mestre: objetivo, regras do loop, fases e etapas, fora do escopo
  loop.json     configuração, etapas aprovadas e progresso, iteração em andamento e totais
  .execucao/    fora do git: eventos.jsonl, streams do Claude, logs das verificações, travas, relatórios
```

Só `plano.md` e `loop.json` são versionados. O `loop.json` entra no commit de cada entrega, então o progresso e os
**totais acumulados** (tempo, custo, execuções, iterações, sessões do Claude, turnos, verificações, correções,
recuperações, falhas, reinícios e commits) acompanham o repositório.

No `plano.md`, cada fase é `## Fase N · nome` e cada etapa ``N. **Título** · `<loop>-NN-<assunto>` — descrição``
(numeração contínua, uma change por etapa). Uma etapa ``N. **Título** · `<change>` · spec pronta — descrição`` aplica
uma change que já existe, com qualquer nome: o loop não a propõe, só confere (`openspec validate`), commita e vai ao
apply. A seção `## Regras` vai para o prompt de sistema de todas as sessões do loop.

### Criar e aprovar

`loops:new` (ou `n` na tela dos loops) pede o nome (kebab-case, vira o prefixo das changes) e a origem das etapas:
**um objetivo** (várias linhas; `ctrl+d` envia) ou **specs já criadas** em `openspec/changes/` (digitar filtra, espaço
marca na ordem, enter confirma; specs que já são etapa de outro loop não podem ser marcadas). Uma sessão do Claude, só
de leitura, devolve as fases, as etapas e a configuração sugerida (pastas do commit, prefixo do commit, comandos de
verificação). O loop nasce como **rascunho**: `a` aprova, `e` abre o `plano.md` no `$EDITOR` e `D` descarta. Editar o
`plano.md` depois de aprovado bloqueia o loop até aprovar de novo (as etapas já entregues não podem ser removidas nem
renomeadas).

### Status e telas

`rascunho` → `pendente` → `executando` → `aguardando` / `pausado` / `falhou` / `interrompido` → … → `concluído`.
`aguardando` quer dizer que o loop precisa de uma pessoa: a tela mostra a causa e **o que fazer**, e `i` continua do
passo em que parou. `executando` só vale com o vigia vivo: sem vigia (computador desligou) aparece como `interrompido`.
Uma etapa conta como entregue quando a change dela está em `openspec/changes/archive/`, mesmo que arquivada fora do loop.

- **Lista**: todos os loops com status, etapas, tempo, custo, execuções e quando rodaram; atualiza sozinha.
  `enter` abre, `n` cria.
- **Tela do loop**: barra com os totais; à esquerda as fases e etapas (`✔` entregue, `▶` em andamento, `✖` falhou,
  `·` falta; abaixo de 100 colunas vira um resumo por fase); na área principal o progresso geral, a iteração atual e os
  passos dela (`↻N` = recuperações), e o que o Claude está fazendo agora.
- **Detalhes** (`d`, `esc` volta): log com filtro (`f`), sessões e ações do Claude, histórico com médias por passo,
  falhas e recuperações com o relatório, e a configuração.

| Tecla | Quando | O que faz |
|-------|--------|-----------|
| `i` | pendente, aguardando, pausado, interrompido, falhou | inicia ou continua (confere plano, `PATH`, trava e escopo limpo) |
| `p` | executando | pausa ao fim do passo atual (de novo: cancela a pausa) |
| `x` | executando | para agora, com confirmação; o passo interrompido é retomado ao continuar |
| `a` / `e` / `D` | rascunho ou plano alterado | aprova, edita o plano, descarta o rascunho |

### Execução e robustez

- **Segundo plano:** iniciar sobe um **vigia** destacado do CLI. Fechar a tela, o CLI ou o terminal não para o loop; a
  tela só lê os arquivos que ele grava (a cada 1 s). No macOS o vigia mantém o Mac acordado (`caffeinate -w`).
- **PATH:** se um comando exigido não está no PATH do CLI, ele é procurado no do seu shell (`$SHELL -ilc`), e o vigia
  sobe com esse PATH.
- **Um processo por iteração** e **uma sessão nova do Claude por passo** (e por lote de tarefas do apply): nada acumula
  memória nem contexto. O que passa de uma sessão para outra fica em arquivo (change, código, `loop.json`).
- **Recuperação por agente:** quando um passo falha, o erro vai para uma sessão nova do Claude com o relatório da falha,
  o `git status`/`diff` e o que o passo precisa entregar. Quem decide se resolveu é a **pós-condição** do passo,
  conferida pelo motor (tarefas todas marcadas, change arquivada, verificações passando…): cumprida, o fluxo segue;
  senão, o passo roda de novo (até `attemptsPerStep`). Erro de autenticação ou que depende de uma pessoa vai direto para
  `aguardando`; bug do motor segue como crash. O mesmo erro depois de uma recuperação encerra as tentativas, e cada
  iteração tem no máximo `recoveriesPerIteration` recuperações.
- **Proteção:** uma correção ou recuperação que pula ou apaga testes ou silencia o analisador/lint (`skip`, `only`,
  `eslint-disable`, `@ts-ignore`, `@ts-expect-error`…) é recusada e o loop fica `aguardando` com os arquivos e linhas.
- **Crash** (falta de memória, processo morto): o vigia mata os filhos órfãos, espera 10 s, 1 min, 3 min, 5 min e
  retoma o passo; desiste depois de `restarts` crashes seguidos sem entrega.
- **Retomada exata:** o `loop.json` é gravado de forma atômica antes e depois de cada passo.
- **Limites:** sessão do Claude 60 min, mas uma sessão 10 min sem nenhum sinal (fora de ferramenta em execução) é
  encerrada e tentada de novo; verificação 15 min; limite de uso da API espera 10 min; o tempo é gravado a cada 60 s.
- **Proposta antecipada:** quando o apply da etapa N começa, uma sessão em paralelo escreve a change da etapa N+1, só na
  pasta OpenSpec dela. O commit da entrega de N a commita; na iteração dela, o propose só a revisa contra o que N
  entregou. Se a sessão falhar ou o processo cair, a sobra não versionada é apagada e N+1 é proposta normalmente.
- **Commits restritos:** só as pastas do escopo, os arquivos OpenSpec da change e a pasta do loop. O Claude não pode
  commitar, instalar pacotes nem editar o motor (`apps/cli/src/loops`, `apps/cli/dist/loops`) ou o `loop.json`.

Os limites mudam no `loop.json` (`config.limits`: `iterationsPerRun`, `fixes`, `continuations`, `attemptsPerStep`,
`recoveriesPerIteration`, `tasksPerSession`, `restarts`, `sessionMin`, `sessionIdleMin`, `commandMin`); o modelo em
`config.model`; ferramentas proibidas extras em `config.forbiddenTools`. Os passos (`config.steps`: `propose`,
`baseline`, `commitProposal`, `apply`, `verifyChange`, `archive`, `commitDelivery`, e o opcional `briefing` antes do
`propose`) ficam num registro em `src/loops/steps/registry.ts`, que aceita passos novos; cada passo declara a sua
pós-condição. Os prompts ficam em `src/loops/prompts/*.md` (o build os copia para `dist/`).

## Estrutura

```
src/
  main.tsx            entrada: flags, modo headless e paleta Ink
  cli/args.ts         parser de argumentos
  core/               contratos e motor (sem Ink)
    command.ts        Command, CommandContext, WizardStep, JourneyStep, Reporter, Prompter
    registry.ts       árvore de comandos e busca (ids únicos, breadcrumb)
    runner.ts         monta o contexto e executa um comando
    reporter.ts       níveis de log e reporter de console
    prompt.ts         prompter de console (confirm/ask)
    exec.ts           spawn com streaming, timeout, abort e findOnPath
    dry.ts            execOrDry: respeita --dry-run
    wizard.ts         wizard()/menu(), resolveSelection e runSteps
    journey.ts        journey(), detecção de estado e seleções @pending/@publish/@área
    net.ts            isPortOpen, waitForPort, httpProbe
    project.ts        detecta raiz do monorepo, backend e frontend
  loops/              motor dos loops de desenvolvimento (sem Ink)
    loops.ts, plan.ts pasta do loop, plano mestre, aprovação e status
    watcher.ts        vigia em segundo plano: uma iteração por processo, recuperação de crash
    iteration.ts      uma iteração: passos, tentativas, retomada, relatório de falha
    steps/            os passos da iteração e o registro deles
    prompts/          o que o Claude recebe em cada passo
    control.ts        conferir, iniciar, pausar, parar, aprovar, descartar
    planner.ts        planejamento de um loop novo
    recovery.ts       classificação do erro, assinatura e a sessão de recuperação
    guard.ts          recusa correções que desligam verificações
  ui/                 telas Ink: App, Header, Palette, WizardScreen, JourneyScreen, RunScreen, prompts
    loops/            lista, tela do loop, detalhes e novo loop (registradas em ui/screens.tsx)
  commands/
    index.ts          menu inicial
    placeholder.ts    etapas/ações "não implementado" usadas por todos os comandos
    doctor/           checks.ts (verificações) + env.ts (parse de .env, DATABASE_URL, submódulos)
    setup/            setup.wizard.ts + lib.ts (env, submódulos, install, build) + docker.ts + git.ts
    db/               db.commands.ts + lib.ts (docker compose, prisma, validação de credenciais)
    broker/           broker.commands.ts + lib.ts (portas e URLs sem senha, estado do serviço rabbitmq, ensureBrokerUp, credencial do painel e resumo das filas)
    quality/ clean/ deploy/ monitor/   placeholders
    loops/            loops.commands.ts: loops (tela) e loops:new/status/start/pause/stop/approve/discard/log
    scrape/           scraper da Kalunga (scrape.commands.ts + kalunga/{api,client,parse,sampler,store,types}.ts)
                      e conversão para o seed do backend (kalunga/seed/{brands,categories,products}.ts)
data/kalunga/         JSON gerado pelo scraper (categorias, marcas e índice)
```

Para implementar um comando, substitua o `notImplemented`/`placeholderStep` pelo código real; os
contratos em `core/command.ts` já preveem `ctx.exec`, `ctx.confirm`, `ctx.ask`, `ctx.report` e `ctx.dryRun`.

## Scripts

```bash
npm run cli -w @jaja/cli          # tsx src/main.tsx
npm run build -w @jaja/cli        # tsc → dist/
npm run check-types -w @jaja/cli
npm run lint -w @jaja/cli
npm run test -w @jaja/cli         # node --test via tsx (src/**/*.test.ts e test/**/*.test.ts; o motor dos loops roda com claude e openspec falsos)
```
