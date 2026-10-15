## Why

O app mobile já tem `lib/core` (etapa 1) e o tema da marca com os componentes base (etapa 2), mas ainda não fala com o backend nem tem navegação: o `lib/main.dart` mínimo abre um `Scaffold` vazio. Esta é a etapa 3 de 15 do loop `mobile-app` e fecha a fase Fundamentos: cliente HTTP com falhas tipadas, injeção de dependências, os dois pontos de entrada (dev e prod) e o shell de abas sobre o qual as etapas do catálogo, da conta e do pedido vão montar suas telas.

## What Changes

- Cliente HTTP (`dio`) em `lib/infra/http` apontado para o endereço resolvido de `API_URL`, com tempos limite, e um mapeador que transforma qualquer falha de requisição em `AppFailure`: rede (sem conexão ou tempo esgotado), sessão (401), não encontrado (404), recusa do backend (demais 4xx, com status e códigos de `message` do `ApiErrorResponse`), servidor (5xx) e inesperado. Um auxiliar devolve `Result` para as chamadas dos repositórios das próximas etapas, sem exceção atravessando camadas.
- Injeção de dependências com `get_it` em `lib/infra/di` (por ora, o endereço da API e o cliente HTTP), e a barreira de arquitetura estendida para que `get_it` só seja importado em `lib/infra/di` e `lib/app`.
- `lib/main_dev.dart` e `lib/main_prod.dart` no lugar de `lib/main.dart`, chamando um bootstrap em `lib/app` que resolve o endereço, configura as dependências e sobe o app; endereço inválido ou ausente em produção abre uma tela de erro de configuração em vez de quebrar.
- `go_router` com shell de quatro abas — Início, Buscar, Carrinho, Conta — cada uma com página provisória, pilha própria preservada ao trocar de aba e uma página "não encontrada" para rotas desconhecidas. Tema da barra de abas com os tokens da marca.
- `Makefile` e `README.md` do app com `adb reverse tcp:4000 tcp:4000`, `--dart-define=API_URL` e os comandos de verificação; permissão de internet no manifesto Android principal.
- Testes do mapeador com adapter fake do `dio`, do cliente, do registro de DI, do bootstrap e das rotas/abas; `CLAUDE.md` do app ganha as decisões desta etapa.

## Capabilities

### New Capabilities
- `mobile/mobile-http`: como o app chama a API e como cada tipo de erro de requisição vira uma falha tipada com mensagem para a pessoa.
- `mobile/mobile-navigation`: pontos de entrada por ambiente, inicialização do app e o shell de abas com rotas provisórias.

### Modified Capabilities
- `mobile/mobile-architecture`: acrescenta o requisito de confinamento do localizador de dependências; os requisitos existentes não mudam.

## Impact

- **Código:** só `apps/mobile/**` (`lib/infra/{http,di}`, `lib/app/`, `lib/main_dev.dart`, `lib/main_prod.dart`, remoção de `lib/main.dart`, páginas provisórias em `lib/ui/modules/`, barra de abas em `lib/ui/shared/`, `lib/core/errors/app_failure.dart`, `Makefile`, `README.md`, `CLAUDE.md`, `android/app/src/main/AndroidManifest.xml`, `test/**`).
- **Dependências:** `dio`, `get_it` e `go_router` (via `flutter pub add`). `watch_it` fica para a primeira etapa com ViewModel (etapa 4).
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
