# @jaja/cli

CLI de manutenção do projeto: setup local, banco, qualidade, limpeza, deploy e monitoramento.
Interface no estilo paleta de comandos, construída com [Ink](https://github.com/vadimdemedes/ink).

> **Estado atual.** Implementados: **Doctor**, **Setup**, **Banco de dados** e o **Scraper da
> Kalunga**. Qualidade, Limpeza, Deploy e Produção ainda são placeholders que apenas registram o
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
| `doctor`  | 🔎 Doctor             | ação    | Verifica Node, npm, git, Docker, gh, dependências, submódulos, `.env`, banco e Prisma Client |
| `setup`   | 🧰 Setup              | wizard  | .env, Docker, submódulos, dependências, banco, Prisma Client, build, reset*, migrations, seed |
| `db`      | 🐘 Banco de dados     | menu    | `db:status`, `db:start`, `db:stop`, `db:logs`, `db:generate`, `db:migrate`, `db:seed`, `db:reset`, `db:studio` |
| `scrape`  | 🕷️ Scraper da Kalunga | menu    | `scrape:products`, `scrape:categories`, `scrape:status` |
| `quality` | 🧪 Qualidade          | wizard  | lint, tipos, testes e build                                           |
| `clean`   | 🧹 Limpeza            | wizard  | builds, caches, node_modules, lockfile e volume do banco              |
| `deploy`  | 🚀 Deploy             | jornada | passos por área (`@prep`, `@db`, `@backend`, `@frontend`, `@cicd`) com estado detectado |
| `monitor` | 📡 Produção           | ação    | verificação somente leitura do ambiente publicado                     |

- **Wizard**: checklist das etapas; Espaço marca, `A` tudo/nada, Enter executa. Dependências (`requires`)
  entram automaticamente e o painel de progresso acompanha cada etapa.
- **Menu**: lista de ações diretas.
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
| `generate`   | sim    | `npx prisma generate`                                                                        |
| `build`      | sim    | `npm run build` (turbo)                                                                      |
| `reset`      | não    | `npx prisma migrate reset --force` (apaga os dados)                                          |
| `migrate`    | sim    | `npx prisma migrate dev`, com `--name init` quando ainda não existe migration                |
| `seed`       | sim    | `npx prisma db seed`                                                                         |

O Postgres local publica a porta `DB_PORT` do `apps/backend/.env` (padrão **5433**, porque a 5432
costuma estar ocupada pelo container de outro projeto). Se a porta estiver aberta mas as credenciais
falharem, o setup avisa que outra instância está usando a porta.

`doctor` faz as mesmas verificações sem alterar nada. O menu `db` expõe cada ação do banco
separadamente (`db:start` sobe o container se preciso; `db:migrate` e `db:seed` garantem o banco antes).

## Scraper da Kalunga

Coleta o catálogo público de [kalunga.com.br](https://www.kalunga.com.br) para JSON, que depois
será importado no banco. Fluxo de `scrape:products`:

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

```bash
npm run cli -- scrape:categories                      # departamentos (com --grupos lista os grupos)
npm run cli -- scrape:products                        # interativo (perguntas no terminal)
npm run cli -- scrape:products --categorias=escolar,gamers --produtos=50-100 --yes
npm run cli -- scrape:products --categorias=2 --produtos=30 --dry-run    # só mostra o plano
npm run cli -- scrape:status                          # o que já existe em data/kalunga
```

Outras opções: `--paralelo=4` (requisições simultâneas) e `--intervalo-ms=150` (pausa mínima entre
requisições). Fontes usadas no site: `GET /apimenu/submenuTodasCategorias` (departamentos),
`GET /apimenu/submenu/<id>` (grupos), `POST /api/obterDepartamentoFiltros` (listagem paginada, a
mesma chamada que a página faz), a página `/prod/<slug>/<id>` e `GET /api/obterProdutoDetalhes/<id>`.

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
  ui/                 telas Ink: App, Header, Palette, WizardScreen, JourneyScreen, RunScreen, prompts
  commands/
    index.ts          menu inicial
    placeholder.ts    etapas/ações "não implementado" usadas por todos os comandos
    doctor/           checks.ts (verificações) + env.ts (parse de .env, DATABASE_URL, submódulos)
    setup/            setup.wizard.ts + lib.ts (env, submódulos, install, build) + docker.ts + git.ts
    db/               db.commands.ts + lib.ts (docker compose, prisma, validação de credenciais)
    quality/ clean/ deploy/ monitor/   placeholders
    scrape/           scraper da Kalunga (scrape.commands.ts + kalunga/{api,client,parse,sampler,store,types}.ts)
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
npm run test -w @jaja/cli         # node --test via tsx
```
