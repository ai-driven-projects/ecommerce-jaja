---
name: config-auth-core-basic
description: Criar/recriar o módulo de autenticação básico de forma determinística no padrão Genérico, refletindo o estado atual do pacote `auth` com foco em `user` e `password`, incluindo código e testes unitários. A skill cria o pacote de dominio auth diretamente em `modules/auth`. Usar quando o pedido envolver bootstrap/rebootstrap do auth core mínimo, sem perfil e sem permissões, com `Password` validando `HashPassword`, fluxo de criação de usuário transacional via `TransactionManager` e política de troca de senha centralizada em serviço de domínio.
---

# Config Auth Core Basic

## Overview

Criar ou recriar o pacote no caminho padrão detectado automaticamente com template versionado na própria skill.
O alvo padrao e sempre `modules/auth`, como pacote de dominio puro da arquitetura do projeto.

A geracao nao deve criar pacote auth dentro de `packages/*`; essa pasta fica reservada para infraestrutura compartilhada, como `packages/shared`.
Executar o script Node da skill para gerar estrutura mínima de autenticação com foco em usuário, senha e casos de uso de aplicação.
O namespace e diretórios padrão devem ser resolvidos por configuração global compartilhada em `skills.config.json` (na raiz do repositório consumidor ou em `.env/` do projeto).

A implementação gerada é determinística e inclui:

- `user` (entidade com `avatarUrl` opcional e `admin` com default `false`, providers e use cases básicos)
- `password` (entidade, providers e use case de troca de senha com política de reuso/força)
- `user` (inclui query `user-exists`, use case `create-user` com `avatarUrl` opcional, e demais fluxos de usuário)
- suíte de testes unitários dos fluxos principais
- criação de usuário com transação explícita (`TransactionManager.runInTransaction`) para persistir `User` + `Password`

Correção obrigatória do modelo:

- `Password` valida hash criptografado via `HashPassword` (somente hash).
- Não usar `StrongPassword` dentro de `Password`; validação de força ocorre em `PasswordChangePolicyService`.
- `ChangePasswordUseCase` depende de `UserExistsQuery`, `PasswordRepository.findRecentByUserId` e `PasswordCryptoProvider`.

## Workflow

1. Executar `node scripts/create-auth-core-basic.mjs`.
2. Namespace é resolvido por precedência: `--scope` > `PROJECT_NAMESPACE`/`SKILLS_NAMESPACE` > `skills.config.local.json` > `skills.config.json` > fallback do template.
3. Validar contrato mínimo do template antes de copiar arquivos para o destino.
4. Se o diretório já existir, usar `--force` para sobrescrever (com proteção para nunca apagar raiz do repositório/sistema).
5. Após gerar no alvo detectado (`modules/auth`), confirmar estrutura de `src/` e `test/` conforme contrato atual do módulo.
6. Sincronizar dependência do novo pacote auth no backend e frontend (`apps/backend/package.json` e `apps/frontend/package.json`), adicionando `<scope>/auth` em `dependencies` quando necessário.
7. Executar `npm install` no root para atualizar lockfile e resolução das workspaces.
8. Opcionalmente executar testes do pacote com `--run-tests` (somente no alvo padrão do workspace; em `--target` customizado os testes são ignorados com log explícito).
9. Antes dos testes do auth, materializar o pacote shared com build de workspace (`npm run build -w <scope>/shared`). `npm run build` na raiz também resolve quando o ambiente permitir.
10. Registrar execução em `.log/skills.log` com título da skill e lista simples dos comandos/ações relevantes (sem timestamps e sem status), garantindo `.log/` no `.gitignore`.

## Commands

Criar/recriar no alvo padrão detectado no namespace padrão:

```bash
node <SKILLS_DIR>/config-auth-core-basic/scripts/create-auth-core-basic.mjs
```

Definir namespace explícito:

```bash
node <SKILLS_DIR>/config-auth-core-basic/scripts/create-auth-core-basic.mjs --scope @namespace
```

Sobrescrever diretório existente:

```bash
node <SKILLS_DIR>/config-auth-core-basic/scripts/create-auth-core-basic.mjs --force
```

Criar e executar testes do pacote auth core:

```bash
node <SKILLS_DIR>/config-auth-core-basic/scripts/create-auth-core-basic.mjs --force --run-tests
```

Criar sem sincronizar apps e sem instalar dependências (modo avançado):

```bash
node <SKILLS_DIR>/config-auth-core-basic/scripts/create-auth-core-basic.mjs --force --skip-apps-sync --skip-install
```

Definir namespace por variável de ambiente:

```bash
PROJECT_NAMESPACE=@namespace node <SKILLS_DIR>/config-auth-core-basic/scripts/create-auth-core-basic.mjs --force
```

## Resources

- `scripts/create-auth-core-basic.mjs`: gerador determinístico cross-platform.
- `assets/auth-core-basic-template`: template completo do auth core básico no estado atual (código + testes + configs).
- `references/auth-core-basic-template-contract.md`: contrato dos artefatos gerados.
- sincronização automática de dependências em backend/frontend + `npm install` no root (desativável com flags de skip).
- quando `--run-tests` é usado no alvo padrão, a skill faz build prévio do pacote shared para garantir a resolução de `@<scope>/shared` nos testes do auth.
- Log local de execução: `.log/skills.log` (não versionado; `.log/` é adicionado ao `.gitignore` automaticamente, sem metadados extras).

## Shared Config

- Arquivo versionado: `skills.config.json` (na raiz do repositório consumidor ou em `.env/` do projeto)
- Override local (gitignored): `skills.config.local.json` no mesmo diretório da configuração principal
- Exemplo local: `skills.config.local.example.json` no mesmo diretório da configuração principal

## Output Contract

A skill deve gerar exatamente a estrutura descrita em `references/auth-core-basic-template-contract.md` (features com `dto/`, `model/`, `provider/`, `use-case/`), sem incluir `permission`, `role`, `audit`, `oauth` ou use cases de perfil.

## Risk Logging Guardrails

- Registrar fatos de execucao em `.log/skills.log` com marcador no inicio da linha.
- Marcadores minimos esperados: `[CMD]`, `[FILE_CREATE]`, `[FILE_UPDATE]`, `[FILE_DELETE]`, `[DIR_CREATE]`, `[RISK]`, `[FAIL]`, `[AI]`.
- Sempre registrar `[RISK]` quando houver sobrescrita, exclusao, rename/move, ou fallback forcado em arquivos/pastas.
- Toda falha inesperada deve gerar `[FAIL]` com descricao factual curta do evento.
- Operacoes de terminal e alteracoes de arquivos devem passar pelos utilitarios compartilhados em `../utils` para manter rastreabilidade consistente.

## Global Standards

- Consultar `../skills-standards.md` para padrões globais de nomenclatura e convenções gerais entre skills.
