---
name: config-shared-core
description: Inicializar o módulo `packages/shared` como submódulo Git (`https://github.com/mentoria-360/shared.git`), validar o contrato mínimo do pacote (base, db, dto, error, vo, testes) e sincronizar dependências do workspace. Usar quando o pedido envolver bootstrap do pacote shared, vincular o submódulo shared ao projeto, reset da base compartilhada ou provisionamento do core compartilhado no monorepo.
---

# Config Shared Core

## Overview

Provisionar o pacote em `sharedModulePath` (padrão: `packages/shared`) como **submódulo Git**, apontando para o repositório canônico do shared.

Configuração padrão do submódulo:

```gitconfig
[submodule "packages/shared"]
  path = packages/shared
  url = https://github.com/mentoria-360/shared.git
```

O script `create-shared.mjs`:

1. Adiciona ou inicializa o submódulo em `<sharedModulePath>`.
2. Valida o contrato mínimo do conteúdo clonado (sem copiar template local).
3. Valida que o `name` do `package.json` do shared é `@mentoria-360/shared` (nome fixo; o shared não segue o namespace do projeto).
4. Registra `"@mentoria-360/shared": "*"` no frontend/backend e executa `npm install` na raiz.

Caminhos e URL do submódulo são resolvidos por `skills.config.json` (na raiz do repositório consumidor ou em `.env/` do projeto).

Contrato mínimo esperado no submódulo:

- `ResultValidator` em `src/base/result-validator.ts`
- `TransactionManager` em `src/db/transaction.manager.ts`
- `Password` em `src/vo/password.vo.ts`
- erros de validação em `src/errors/validation-error.ts`
- paginação em `src/query/pagination.dto.ts`
- testes base/vo/db alinhados ao repositório canônico `mentoria-360/shared`

## Pré-requisitos

- Repositório destino deve ser um repositório Git (`.git` na raiz do monorepo).
- Acesso de leitura ao repositório remoto do shared (público ou credenciais Git configuradas).

## Workflow

1. Executar `node scripts/create-shared.mjs`.
2. O nome do pacote shared é fixo (`@mentoria-360/shared`); `--scope`/`PROJECT_NAMESPACE` não o alteram.
3. URL do submódulo resolvida por: `skills.config.local.json` > `skills.config.json` > default `https://github.com/mentoria-360/shared.git`.
4. Se `<sharedModulePath>` existir sem ser submódulo, ou se a URL registrada divergir, usar `--force` para substituir.
5. Validar contrato mínimo do submódulo após `git submodule add` ou `git submodule update --init --recursive`.
6. Atualizar `"@mentoria-360/shared": "*"` em frontend/backend (sem remover outras dependências).
7. Executar `npm install` na raiz do workspace.
8. Opcionalmente executar testes com `--run-tests`: `npm run test -w @mentoria-360/shared`.
9. Registrar execução em `.log/skills.log`.
10. Formatar o projeto com `npm run format` na raiz, quando aplicável.

## Commands

Provisionar o submódulo shared no caminho padrão:

```bash
node <SKILLS_DIR>/config-shared-core/scripts/create-shared.mjs
```

> Executa `npm install` na raiz após vincular o submódulo.

> `<SKILLS_DIR>` é o diretório onde este repositório de skills está montado no projeto (ex.: `.Codex/skills` ou `.agents/skills`).

Recriar o submódulo (remove checkout legado ou submódulo existente):

```bash
node <SKILLS_DIR>/config-shared-core/scripts/create-shared.mjs --force
```

Provisionar e executar testes:

```bash
node <SKILLS_DIR>/config-shared-core/scripts/create-shared.mjs --force --run-tests
```

## Resources

- `scripts/create-shared.mjs`: provisionamento determinístico via git submodule.
- `references/shared-template-contract.md`: contrato mínimo validado no submódulo clonado.
- Log local: `.log/skills.log`.

## Shared Config

- Arquivo versionado no repositório consumidor: `skills.config.json` (raiz do projeto)
- Override local (gitignored): `skills.config.local.json` no mesmo diretório
- Campos relevantes:
  - `sharedModulePath` (default: `packages/shared`)
  - `sharedSubmoduleUrl` (default: `https://github.com/mentoria-360/shared.git`)

## Risk Logging Guardrails

- Registrar fatos de execucao em `.log/skills.log` com marcador no inicio da linha.
- Marcadores minimos esperados: `[CMD]`, `[FILE_CREATE]`, `[FILE_UPDATE]`, `[FILE_DELETE]`, `[DIR_CREATE]`, `[RISK]`, `[FAIL]`, `[AI]`.
- Sempre registrar `[RISK]` quando houver sobrescrita, exclusao, deinit/remove de submodulo, ou fallback forcado.
- Toda falha inesperada deve gerar `[FAIL]` com descricao factual curta do evento.
- Operacoes de terminal e alteracoes de arquivos devem passar pelos utilitarios compartilhados em `../utils`.

## Global Standards

- Consultar `../skills-standards.md` para padroes globais de nomenclatura e convencoes gerais entre skills.
