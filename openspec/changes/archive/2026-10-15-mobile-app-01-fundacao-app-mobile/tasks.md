> **Leitura prévia:** `proposal.md`, `design.md` e as specs `mobile/mobile-architecture` e `mobile/mobile-core` desta change; para o desenho, o app modelo em `/Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile` (só leitura). A partir do grupo 2, leia também `apps/mobile/CLAUDE.md`.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; dependências só por `flutter pub add` (nunca `pub upgrade`); nada de `flutter run`, build de APK/IPA ou emulador; sem commits.

## 1. Projeto Flutter

- [x] 1.1 Na raiz do repositório, rodar `flutter create --org br.com.jaja --platforms android,ios --project-name mobile apps/mobile`. Verificar que existem `apps/mobile/android` e `apps/mobile/ios` e que não há `web/`, `linux/`, `macos/` nem `windows/`.
- [x] 1.2 Trocar o nome exibido para "Jajá" em `android/app/src/main/AndroidManifest.xml` (`android:label`) e em `ios/Runner/Info.plist` (`CFBundleDisplayName` e `CFBundleName`); `description` do `pubspec.yaml` para "App do cliente Jajá". Verificar com `grep -rn "Jajá"` nos três arquivos.
- [x] 1.3 Reescrever `analysis_options.yaml`: `include: package:flutter_lints/flutter.yaml` e `analyzer.exclude: [build/**]`, sem regras extras (design, Decisão 1).
- [x] 1.4 Reduzir `lib/main.dart` a um `runApp` de `MaterialApp(title: 'Jajá', home: ...)` vazio, sem tema nem cor; apagar `test/widget_test.dart` e criar `test/main_test.dart` que bombeia o app e encontra um `MaterialApp`.
- [x] 1.5 `cd apps/mobile && flutter pub add --dev build_runner analyzer`. Verificar no `pubspec.yaml` e confirmar que o `.gitignore` gerado cobre `build/` e `.dart_tool/`.
- [x] 1.6 Rodar `flutter analyze` e `flutter test` em `apps/mobile`; os dois passam.

## 2. CLAUDE.md do app

- [x] 2.1 Criar `apps/mobile/CLAUDE.md` adaptado do `CLAUDE.md` do modelo, com as seções da Decisão 9 do design: visão e estado atual, árvore de `lib/`, regras não negociáveis, estado, estados de tela remota, convenções.
- [x] 2.2 Completar o `CLAUDE.md` com design visual (fontes de valor do Jajá), stack e pacotes permitidos (lista do plano), regras de domínio do app (sessão, carrinho, loja, entrega, acompanhamento, ambiente) e verificação e limites (três comandos, nada de emulador, lacunas em `docs/lacunas-da-api.md`).
- [x] 2.3 Conferir que o `CLAUDE.md` não cita Firebase, Firestore, player, `url_launcher`, flavors nativos nem cursos: `grep -niE "firebase|firestore|player|url_launcher|flavor|curso|aula" apps/mobile/CLAUDE.md` sem resultados (exceto a frase que proíbe flavors/Firebase, se houver).

## 3. Result, falhas e Command

- [x] 3.1 Criar `lib/core/errors/app_failure.dart` com a hierarquia selada e os enums de código da Decisão 4 (`BackendRejectionFailure` com `statusCode` e `codes`).
- [x] 3.2 Criar `lib/core/result.dart` com `sealed class Result<T>`, `Ok<T>` e `Failure<T>` (Decisão 3).
- [x] 3.3 Criar `lib/core/command.dart` com `Command0<T>` e `Command1<T, A>` (execução única, limpa o resultado, avisa no início e no fim, exceção → `UnexpectedFailure` "Algo deu errado. Tente novamente.").
- [x] 3.4 Testes em `test/core/result_test.dart` e `test/core/errors/app_failure_test.dart`: desestruturação de `Ok`/`Failure`, `switch` exaustivo sobre `AppFailure` cobrindo todos os tipos, `BackendRejectionFailure` preservando status e ordem dos códigos.
- [x] 3.5 Testes em `test/core/command_test.dart` para `Command0` e `Command1`: ciclo com dois avisos, execução concorrente ignorada, exceção vira falha inesperada, argumento repassado à ação.
- [x] 3.6 `flutter test test/core` passa.

## 4. Money e ambiente

- [x] 4.1 Criar `lib/core/value_objects/money.dart` conforme a Decisão 5 (`fromCents` → `Result`, `zero`, `+`, `times`, `sum`, comparação, igualdade, `cents`), com comentário curto citando `modules/orders/src/cart/errors.ts` como origem dos valores em centavos.
- [x] 4.2 Testes em `test/core/value_objects/money_test.dart`: `1290 × 2 + 490 = 3070`, negativo → `ValidationFailure`, `sum` vazio é zero, igualdade/`hashCode`, ordem, `times(0)` é zero e `times(-1)` lança `ArgumentError`.
- [x] 4.3 Criar `lib/core/env/app_environment.dart` com `AppEnvironment` e a resolução de `API_URL` → `Result<Uri>` (Decisão 6).
- [x] 4.4 Testes em `test/core/env/app_environment_test.dart`: padrão dev `http://localhost:4000`; `http://10.0.2.2:4000/` vira `http://10.0.2.2:4000`; prod vazio, `ftp://x`, `localhost:4000` e texto sem host → `ConfigurationFailure`.
- [x] 4.5 `flutter test test/core` passa.

## 5. Barreira de arquitetura

- [x] 5.1 Criar `lib/modules/.gitkeep` e `test/core/support/import_rules.dart` com `dartFilesIn` (lança `StateError` se a pasta não existe), `scanSource`/`scanDirectory` lendo `import` e `export` por `parseString` do `analyzer`, e a resolução de URI para camada (Decisão 7).
- [x] 5.2 Implementar no mesmo arquivo a Regra A (pureza de `core` e `modules`, `core` sem `modules`) e a Regra B (`dio`, `flutter_secure_storage`, `shared_preferences` só em `lib/infra`); violação com arquivo, linha e diretiva.
- [x] 5.3 Criar `test/core/architecture_test.dart` aplicando a Regra A a `lib/core` + `lib/modules` e a Regra B a todo `lib/` fora de `lib/infra`, exigindo ao menos um arquivo escaneado.
- [x] 5.4 Testes sintéticos da Regra A no mesmo arquivo: `package:flutter/...`, `dart:io` e `dart:ui` em core são violação; relativo de core para `../infra/...` e para `../modules/...` é violação; modules → core (pacote e relativo) é aceito; `export` proibido também é pego; import comentado ou dentro de string não conta.
- [x] 5.5 Testes sintéticos da Regra B e da robustez: `package:dio/dio.dart` em `lib/ui/...` e `shared_preferences` em `lib/app/...` são violação; os mesmos em `lib/infra/...` são aceitos; pasta inexistente lança `StateError`.
- [x] 5.6 Provar que a barreira morde: criar temporariamente em `lib/core/` um arquivo com `import 'package:flutter/foundation.dart';`, ver `flutter test test/core/architecture_test.dart` falhar apontando arquivo e linha, e apagar o arquivo.

## 6. Verificação final

- [x] 6.1 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso (se falhar só por falta de builder, seguir o risco registrado no design e anotar lá).
- [x] 6.2 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 6.3 `cd apps/mobile && flutter test` com todos os testes passando.
- [x] 6.4 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`.
