## Why

A Jajá quer levar para o celular a experiência de compra da vitrine web, num app Flutter do cliente (`apps/mobile`) que fala só com o backend NestJS existente. `apps/mobile` ainda não existe. Esta é a etapa 1 de 15 do loop `mobile-app`: antes de qualquer tela, o projeto precisa existir com as regras de arquitetura escritas e **testadas**, e com a base Dart pura (`Result`, `Command`, falhas tipadas, `Money`, ambiente) de que todas as etapas seguintes dependem.

## What Changes

- Cria o projeto Flutter `apps/mobile` (`flutter create`, org `br.com.jaja`, só Android e iOS, pacote `mobile`), com `analysis_options.yaml` sobre `flutter_lints` e o `.gitignore` gerado.
- Cria `apps/mobile/CLAUDE.md`, adaptado do CLAUDE.md do app modelo da plataforma, com as camadas, a stack, os pacotes permitidos, as regras de domínio do app (sessão, carrinho, loja, entrega, acompanhamento), os estados de tela remota, as convenções e os limites de verificação do loop. Dali em diante ele é a fonte inegociável.
- Cria `lib/core` em Dart puro: `Result<T>` selado (`Ok`/`Failure`), `Command0`/`Command1`, hierarquia selada `AppFailure` (validação, rede, sessão, recusa do backend com os códigos, não encontrado, servidor, inesperado), o value object `Money` em centavos e a configuração de ambiente (`API_URL` por `--dart-define`, padrão de dev `http://localhost:4000`).
- Cria a barreira de arquitetura `test/core/architecture_test.dart`, lendo os imports com o `analyzer`: `core/` e `modules/` sem Flutter nem pacotes de infraestrutura; `dio`, `flutter_secure_storage` e `shared_preferences` só em `lib/infra/`.
- Testes de `Result`, `Command`, `Money`, do ambiente e das próprias regras da barreira.
- UI só o mínimo para compilar: um `main.dart` com um `MaterialApp` vazio da marca, sem tema, rotas nem telas.

## Capabilities

### New Capabilities
- `mobile/mobile-architecture`: projeto do app, regras de camadas e a barreira automatizada que impede imports proibidos entre camadas.
- `mobile/mobile-core`: base Dart pura do app — resultado de operação, comando de tela, falhas tipadas, dinheiro em centavos e configuração do endereço da API.

### Modified Capabilities
(nenhuma)

## Impact

- **Código novo:** só `apps/mobile/**` (projeto Flutter, `CLAUDE.md`, `lib/core`, `test/core`).
- **Dependências:** `build_runner` e `analyzer` como `dev_dependencies` (via `flutter pub add --dev`); `flutter_lints` já vem do `flutter create`. Nenhuma dependência de runtime além do SDK.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem nas specs existentes.
- Specs novas sob `openspec/specs/mobile/`, um domínio novo no agrupamento de specs.
