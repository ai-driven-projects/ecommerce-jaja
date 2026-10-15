## Context

`apps/mobile` não existe; Flutter 3.44 estável está no PATH. O desenho segue o app modelo da plataforma (`/Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile`, só leitura): `CLAUDE.md`, `pubspec.yaml`, `analysis_options.yaml`, `lib/core/{result,command}.dart`, `lib/core/errors/app_failure.dart`, `lib/core/env/` e `test/core/architecture_test.dart` + `test/core/support/import_rules.dart`. Dele vêm o `Result` selado escrito à mão, os `Command0`/`Command1` e a barreira de imports; **não** vem nada de Firebase, Firestore, player, `url_launcher`, flavors nativos nem do domínio de cursos.

O backend responde erro no formato `ApiErrorResponse` (`apps/backend/src/shared/errors/api-error-response.type.ts`): `{ statusCode, error, message: string[], details? }`, com os **códigos** de negócio em `message` (ex.: `CART_ITEMS_LIMIT_EXCEEDED`). O web traduz esses códigos em `apps/frontend/src/shared/util/api-client.util.ts`. Isso molda a falha de recusa do backend desta etapa; o mapeamento HTTP → falha é da etapa 3.

## Goals / Non-Goals

**Goals:** projeto criado e limpo no `flutter analyze`; `CLAUDE.md` como fonte das regras; `lib/core` com `Result`, `Command`, `AppFailure`, `Money` e ambiente; barreira de imports com `analyzer`; testes de tudo isso.

**Non-Goals:** tema, fontes, componentes e a barreira de cor/estilo literal (etapa 2); `dio`, mapeador de falhas HTTP, DI, `main_dev.dart`/`main_prod.dart`, `go_router`, shell de abas, Makefile e README (etapa 3); qualquer domínio em `lib/modules` (etapas 4+); `docs/lacunas-da-api.md` (nasce na primeira lacuna; consolidado na etapa 15).

## Decisions

### 1. Projeto e lints
`flutter create --org br.com.jaja --platforms android,ios --project-name mobile apps/mobile`. O nome exibido vira "Jajá" (`android:label` no `AndroidManifest.xml` e `CFBundleDisplayName`/`CFBundleName` no `Info.plist`). `analysis_options.yaml` inclui `package:flutter_lints/flutter.yaml` e exclui `build/**`, como o modelo; sem regras extras (`flutter_lints` é o que o plano pede). O `test/widget_test.dart` do contador é apagado.

### 2. UI mínima
`lib/main.dart` fica só com `runApp` de um `MaterialApp` com `title: 'Jajá'` e um `home` vazio, sem tema, cor nem rota. Um teste de fumaça (`test/main_test.dart`) bomba o app e encontra o `MaterialApp`. A etapa 3 troca `main.dart` por `main_dev.dart`/`main_prod.dart` e o bootstrap.

### 3. `Result<T>` e `Command`
Cópia do desenho do modelo: `sealed class Result<T>` com `final class Ok<T>(value)` e `final class Failure<T>(failure)`, para `case Ok(:final value)` funcionar (motivo do modelo para não usar `result_dart`). `Command0<T>` e `Command1<T, A>` com `running`, `result`, `execute` e callback `onStateChange` (o ViewModel passa `notifyListeners`); o `Command` não depende de Flutter, por isso fica em `core`. O `catch` do `Command` é a única fronteira de exceção do app: transforma qualquer exceção em `UnexpectedFailure` com mensagem fixa.

### 4. Hierarquia `AppFailure`
`sealed class AppFailure { String message; Enum code; }` com subclasses `final`: `ValidationFailure`, `NetworkFailure`, `ConfigurationFailure`, `SessionFailure` (401 / sem sessão), `BackendRejectionFailure` (4xx com `statusCode` e `codes: List<String>` vindos de `message`), `NotFoundFailure`, `ServerFailure` (5xx) e `UnexpectedFailure`. Cada tipo tem seu enum de código em `app_failure.dart` (ex.: `GenericFailureCode.unspecified`, `MoneyCode.negativeCents`, `ConfigurationCode.missingApiUrl`/`invalidApiUrl`). A mensagem é sempre literal em português. Diferente do modelo, não há `CredentialFailure`, `FormValidationFailure` nem `ResourceUnavailableFailure`: entram quando a etapa que os consome (sessão, formulários) precisar, acrescentando ao `sealed`.
- Alternativa descartada: uma falha única com `statusCode` — perderia o `switch` exaustivo que obriga a tela a decidir o que mostrar.

### 5. `Money`
`lib/core/value_objects/money.dart`, escrito à mão (sem freezed). Molde "entrada inválida é erro" do modelo: construtor privado + `static Result<Money> fromCents(int)` (negativo → `ValidationFailure`), mais `static const zero`. Operações: `+`, `times(int quantity)`, `static sum(Iterable<Money>)`, `Comparable` com `<`, `<=`, `>`, `>=`, `==`/`hashCode` por centavos e getter `cents`. Quantidade negativa em `times` é erro de programação (`ArgumentError`), não falha de domínio — quantidade de carrinho já chega validada (1..99, `modules/orders/src/cart/errors.ts`). Sem subtração nem formatação: "Faltam X para a entrega grátis" é da etapa 9 e o `intl` pt-BR é da etapa 2, que acrescentam o que precisarem aqui.

### 6. Ambiente
`lib/core/env/app_environment.dart`: `enum AppEnvironment { dev, prod }` e uma função pura que recebe o ambiente e o texto definido (padrão `const String.fromEnvironment('API_URL')`) e devolve `Result<Uri>`. Regras na spec `mobile-core`. A função recebe o texto como parâmetro para ser testável sem `--dart-define`. Nada a consome ainda; os entrypoints da etapa 3 a usam.

### 7. Barreira de arquitetura com `analyzer`
`test/core/support/import_rules.dart` lê cada arquivo com `parseString` do `analyzer` e percorre as diretivas `import` e `export` (no lugar da regex do modelo: comentários e strings não confundem a leitura). Cada URI é resolvida para uma camada: `dart:<lib>`, `package:<pkg>/…`, `package:mobile/<camada>/…`, ou caminho relativo normalizado a partir do arquivo.
- **Regra A (pureza):** `lib/core` aceita `dart:core|async|collection|convert|math|typed_data`, os pacotes `meta`, `collection`, `freezed_annotation`, `json_annotation` e só a própria `core`; `lib/modules` aceita o mesmo mais `core` e `modules`. Mais estrito que o modelo, que tratava `core`+`modules` como um bloco e deixava `core` importar domínio.
- **Regra B (infra):** em `lib/**` fora de `lib/infra/**`, nenhum `dio`, `flutter_secure_storage` ou `shared_preferences`.
- `dartFilesIn` lança `StateError` se a pasta não existe; o teste exige ao menos um arquivo escaneado. Para `lib/modules` existir antes do primeiro domínio, a etapa cria `lib/modules/.gitkeep` (removido pela etapa que criar o primeiro domínio).
- Cada regra tem testes com fontes sintéticas via `scanSource(filePath:, source:)`, para provar a barreira mesmo com pouco código real.
- A regra de cor/estilo literal em `pages/` e `widgets/` fica para a etapa 2, que cria essas pastas.

### 8. Dependências
Só `flutter pub add --dev build_runner analyzer` (o `flutter_lints` já vem do `create`). O `build_runner` entra agora porque o comando de verificação do loop o chama; `freezed`, `json_serializable` e as anotações entram com a primeira entidade (etapa 4), pela regra "sem dependência sem consumidor". Nenhum `pub upgrade`.

### 9. `CLAUDE.md`
Adaptado do modelo, em português, com as seções: visão do app e estado atual; árvore de pastas; regras não negociáveis (as 8 do modelo, reescritas para este domínio, com o exemplo de contrato técnico em `infra/` sendo a sessão JWT); estado em três níveis (global de sessão e carrinho num repositório de `infra/`); estados de tela remota (skeleton, erro com "Tentar de novo" só no bloco, vazio com ação); convenções; design visual (fontes de valor: `apps/frontend/DESIGN.md`, `globals.css`, spec `shared/design-system`, mockups `openspec/extras/design/*.dc.html`; Manrope e Bricolage Grotesque; copiar valores, `color-mix` resolvido); stack e pacotes permitidos; regras de domínio (sessão, carrinho, loja, entrega, acompanhamento, ambiente) tal como no plano; verificação e limites (nunca `flutter run`/build/emulador; nada fora de `apps/mobile`; lacunas em `docs/lacunas-da-api.md`). Sem Firebase, flavors, player ou cursos.

## Decisões tomadas sem consulta

- Duas capacidades novas, `mobile/mobile-architecture` e `mobile/mobile-core`, num domínio `mobile/` novo em `openspec/specs/` (o plano pede prefixo `mobile-` e agrupamento por domínio).
- Nome exibido do app "Jajá" já nesta etapa (só rótulo nativo; ícone e splash nativos ficam como o `create` gera).
- `lib/main.dart` mínimo mantido até a etapa 3.
- `core` proibido de importar `modules` pela barreira (mais estrito que o modelo).
- `export` também é verificado pela barreira, além de `import`.
- Produção sem `API_URL` é falha de configuração: não há URL de produção da API no repositório para servir de padrão.
- `Money` sem subtração e sem formatação; `Email`/`Password` não entram (etapa 8).
- O grupo 1 das tarefas (projeto Flutter, rótulos, `main.dart` mínimo, `build_runner` e `analyzer`) foi feito na recuperação do passo "Verificar ponto de partida": sem `apps/mobile` as verificações do loop não tinham onde rodar (`spawn dart ENOENT`). O `build_runner` sem builders terminou com sucesso ("wrote 0 outputs"), então `json_serializable`/`json_annotation` não foram adicionados.
- Apenas `build_runner` e `analyzer` como dependências nesta etapa.
- `lib/modules/.gitkeep` para a barreira ter a pasta a verificar.
- `AppFailure` (lote 1): todos os tipos recebem `message` e `code` obrigatórios, sem mensagem padrão no construtor; `BackendRejectionFailure` acrescenta `statusCode` e `codes` (lista na ordem recebida). Os enums criados são só os citados na Decisão 4 — `GenericFailureCode { unspecified }`, `MoneyCode { negativeCents }` e `ConfigurationCode { missingApiUrl, invalidApiUrl }` —; `Money` (lote 2) usa `MoneyCode.negativeCents` com `ValidationFailure`, e o ambiente usa `ConfigurationCode` com `ConfigurationFailure`. Enums de rede, sessão, recusa e servidor ficam para a etapa 3, com o mapeador HTTP (até lá, `GenericFailureCode.unspecified`).
- `Command0`/`Command1` copiados do modelo sem mudança de comportamento; não são `Listenable` (o aviso é o callback `onStateChange`).
- `apps/mobile/CLAUDE.md` traz uma tabela de imports por camada que já reflete a Regra A/B da Decisão 7 (lote 3 implementa a barreira); o "estado atual" diz "fundação" e deve ser atualizado só pela última etapa do plano. Para o grep da tarefa 2.3 não pegar falso positivo, o texto evita palavras que contêm "curso" (ex.: "recurso").
- `Money` (lote 2): `final class` com construtor `const` privado, `implements Comparable<Money>`, operadores `<`, `<=`, `>`, `>=` e `toString` `Money(<cents>)` para mensagens de teste. Falha de negativo: `ValidationFailure` com `MoneyCode.negativeCents` e mensagem "O valor não pode ser negativo.". `times` negativo lança `ArgumentError.value`.
- Ambiente (lote 2): a função é `resolveApiBaseUrl(AppEnvironment, {String definedApiUrl})`, com padrão `const String.fromEnvironment('API_URL')`; a etapa 3 a chama nos entrypoints. O texto é aparado (`trim`); vazio em dev → `http://localhost:4000`; vazio em prod → `ConfigurationCode.missingApiUrl` ("Endereço da API não configurado."); esquema diferente de `http`/`https` ou host vazio → `ConfigurationCode.invalidApiUrl` ("Endereço da API inválido."). Todas as barras finais são descartadas; caminho, query e fragmento não são validados.
- Barreira (lote 3): `test/core/support/import_rules.dart` expõe `scanSource`/`scanDirectory` com o parâmetro opcional `rules` (`ImportRule.purity` = Regra A, `ImportRule.infraConfinement` = Regra B; padrão: as duas). Cada regra decide pela camada do próprio arquivo (primeira pasta sob `lib/`): a Regra A só vale em `core`/`modules`; a Regra B vale em todo `lib/` exceto `infra`. Por isso o teste real da Regra B escaneia `lib` inteiro e `lib/infra` é isento pela própria regra. As URIs de imports condicionais (`if (dart.library.io) ...`) também são verificadas. Caminho relativo que sai de `lib/` ou esquema desconhecido é violação da Regra A. Arquivos na raiz de `lib/` (ex.: `main.dart`) não pertencem a camada nenhuma, e `core`/`modules` não podem importá-los. Etapas que criarem pasta ou pacote restrito estendem as constantes desse arquivo (`allowedLayersByPureLayer`, `purePackages`, `infraPackages`).
- Barreira mordendo (tarefa 5.6): com `lib/core/tmp_barreira.dart` importando `package:flutter/foundation.dart`, `flutter test test/core/architecture_test.dart` falhou com `lib/core/tmp_barreira.dart:1 → import 'package:flutter/foundation.dart';`; o arquivo foi apagado em seguida.
- Verificação final (lote 3): `build_runner` terminou com sucesso ("wrote 0 outputs"; avisa que `--delete-conflicting-outputs` foi removido e ignorado, sem falhar), `flutter analyze` sem problemas e `flutter test` com 52 testes passando. No `git status`, além de `apps/mobile/` e desta change, apareciam `openspec/loops/mobile-app/loop.json` e `openspec/changes/mobile-app-02-tema-marca-mobile/`: já estavam no estado inicial da sessão, vêm do script do loop e não foram tocados pela change.

## Risks / Trade-offs

- [`build_runner` sem nenhum builder pode avisar ou falhar] → a tarefa de verificação roda o comando; se ele falhar só por falta de builder, adiciona-se `json_serializable` e `json_annotation` (permitidos, usados a partir da etapa 4) e registra-se aqui o motivo, sem criar entidade de mentira.
- [Versão do `analyzer` incompatível com o `meta`/`test_api` fixados pelo SDK] → `flutter pub add --dev analyzer` resolve a maior versão compatível; não fixar à mão a versão do modelo.
- [Barreira por camada de caminho é tão boa quanto a lista de pastas] → cada etapa que cria pasta ou pacote restrito estende a barreira (regra no `CLAUDE.md`).
- [`Info.plist`/`AndroidManifest.xml` editados à mão] → mudança só no rótulo; nenhuma build nativa roda no loop, então o risco fica registrado e não verificado em aparelho.
