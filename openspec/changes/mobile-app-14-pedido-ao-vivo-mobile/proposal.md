## Why

A etapa 13 entregou a tela de acompanhamento em `/cart/orders/:id`, mas o pedido só muda na tela quando o cliente puxa para atualizar. No web, o acompanhamento avança sozinho: `use-my-order.hook.ts` abre o stream de avisos `GET /me/orders/:id/stream` (`event-stream.util.ts`) e relê o pedido a cada aviso. Esta é a etapa 14 de 15 do loop `mobile-app`: levar esse acompanhamento ao vivo para o app, com o cuidado de bateria e de rede que o celular pede.

## What Changes

- Leitura do stream SSE `GET /me/orders/:id/stream` pelo `dio`, em modo stream, com o Bearer no cabeçalho (o token nunca vai para a URL), e um leitor incremental do formato `text/event-stream` que espelha `createEventStreamParser`.
- Cada evento `order` dispara uma nova leitura de `GET /me/orders/:id`, a fonte da verdade, sem skeleton e com no máximo uma leitura em andamento e uma pendente. O `ping` é ignorado. Ao conectar (e ao reconectar), o pedido também é relido.
- Reconexão com espera crescente de 1 s, 2 s, 4 s, 8 s e 10 s daí em diante, que volta a 1 s depois de uma conexão bem-sucedida. `401`, `403` e `404` encerram o stream sem nova tentativa.
- Indicador "Ao vivo"/"Reconectando…" ao lado do selo do status, como o `LiveIndicator` do web, e destaque breve do passo concluído com a tela aberta.
- O stream para quando o pedido é entregue, ao sair da tela, ao trocar de aba e quando o app vai para segundo plano (`AppLifecycleListener`), e retoma (com nova leitura) ao voltar.
- Testes do leitor de eventos, da fonte de avisos com o `dio` fake, da reconexão com stream fake e relógio controlado, do ViewModel e da tela.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `mobile/mobile-order-tracking`: o pedido passa a ser atualizado ao vivo; entram os requisitos do stream de avisos, da reconexão, do indicador, da parada e retomada e do destaque do passo, e "Leitura do pedido" perde a frase de que a tela não se atualiza sozinha.

## Impact

- **Código:** só `apps/mobile/**`: `lib/modules/order/` (status ao vivo, contrato da fonte de avisos, `LiveOrderFeed`), `lib/infra/http/` (leitor de eventos), `lib/infra/order/` (fonte de avisos), `lib/infra/di/`, `lib/ui/modules/order/` (ViewModel, página, linha do tempo, indicador), `CLAUDE.md` e `test/**`.
- **Dependências:** nenhuma nova (`dart:async` e `dart:convert` bastam).
- **API:** `GET /me/orders/:id/stream` (novo no app), além do `GET /me/orders/:id` da etapa 13. O `401` do stream encerra a sessão pelo `AuthInterceptor`, como em toda rota.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
