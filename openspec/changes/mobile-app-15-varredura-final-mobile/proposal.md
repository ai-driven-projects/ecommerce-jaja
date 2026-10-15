## Why

As etapas 1 a 14 entregaram o app inteiro (catálogo, sessão, carrinho, entrega, checkout e acompanhamento ao vivo), mas cada uma deixou para o fim a arrumação que só faz sentido com tudo pronto. Hoje há textos repetidos entre telas (a falha genérica "Algo deu errado. Tente novamente." está escrita em seis lugares, e textos de carrinho, catálogo, cadastro e pedido aparecem duplicados), a barreira de arquitetura não confere a estrutura de pastas nem a cor literal fora de `pages/`/`widgets/`, os testes de DI e de rotas não varrem tudo o que o router e o bootstrap pedem, o README ainda diz que as abas são provisórias, `docs/lacunas-da-api.md` não existe, e o `CLAUDE.md` e duas specs descrevem a fundação, não o app pronto. Esta é a etapa 15 de 15 do loop `mobile-app`, a varredura final.

## What Changes

- **Código morto e datado:** remove comentários que citam etapas ("nasce na etapa 5", "stepper da etapa 9") e o que a varredura achar sem consumidor; o que a spec exige (ex.: esvaziar o carrinho) fica.
- **Textos centralizados:** a mensagem da falha inesperada passa a existir uma vez só, no núcleo; textos de UI repetidos entre arquivos vão para constantes de apresentação do domínio dono, e um teste passa a barrar texto de UI duplicado.
- **Barreira completa:** novas regras para a estrutura de pastas de `lib/` e de `test/` (camadas, domínios e subpastas conhecidas; teste espelhando `lib/`) e para a cor literal, que passa a valer em todo `lib/` fora do arquivo de cores do tema; a regra de estilo literal passa a cobrir também `lib/app/`.
- **Testes de DI e de rotas completos:** todo tipo que o router e o bootstrap resolvem sai da DI real; todo ViewModel e caso de uso é instância nova por pedido; toda rota de `AppRoutes` abre a página certa, e toda rota com sessão leva a "Entrar" sem ela.
- **Documentação final:** README de como rodar no emulador e no aparelho (Android e iOS, `adb reverse`, `API_URL`, Makefile), `apps/mobile/docs/lacunas-da-api.md` com as lacunas conferidas nos controllers e os contornos do app, e o `apps/mobile/CLAUDE.md` reescrito com o estado final.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `mobile/mobile-architecture`: "Projeto do app mobile" e "Regras de arquitetura documentadas" descrevem o app pronto, com README e registro de lacunas; entram a barreira de estrutura de pastas, a cor literal confinada ao tema e a barreira de texto de UI repetido.
- `mobile/mobile-navigation`: "Shell de abas" perde a frase das páginas provisórias; entra o requisito de que toda rota declarada abre a sua página e toda rota com sessão exige sessão.
- `mobile/mobile-core`: "Falhas tipadas com mensagem para a pessoa" passa a exigir uma única mensagem para a falha inesperada.

## Impact

- **Código:** só `apps/mobile/**`: `lib/core/errors/`, `lib/core/command.dart`, `lib/infra/http/`, ViewModels e widgets que repetem textos em `lib/ui/modules/**`, `test/core/` (barreira), `test/infra/di/`, `test/app/router/`, `README.md`, `CLAUDE.md` e o novo `docs/lacunas-da-api.md`.
- **Dependências:** nenhuma nova.
- **API:** nenhuma chamada nova; nenhum comportamento de tela muda (textos idênticos aos atuais).
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
