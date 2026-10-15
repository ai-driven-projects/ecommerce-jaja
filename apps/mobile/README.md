# Jajá — app mobile do cliente

App em Flutter (Android e iOS) para quem compra na Jajá: escolher a loja, navegar no catálogo, montar o
carrinho, fechar o pedido e acompanhá-lo. Fala só com o backend NestJS deste repositório (`apps/backend`).
Ainda está em construção: por enquanto, as quatro abas (Início, Buscar, Carrinho e Conta) mostram páginas
provisórias.

As regras do app (arquitetura, camadas, estilo e limites) estão no [`CLAUDE.md`](CLAUDE.md).

## Pré-requisitos

- Flutter estável com Dart 3 (`flutter doctor` sem pendências para Android).
- O backend de `apps/backend` rodando na porta 4000 (veja o README da raiz do repositório).
- Um emulador Android aberto (ou um aparelho conectado) visível no `adb devices`.

## Pontos de entrada

Não há `lib/main.dart`: todo `flutter run` precisa de `-t`.

| Arquivo | Ambiente | `API_URL` |
|---|---|---|
| `lib/main_dev.dart` | desenvolvimento | opcional; padrão `http://localhost:4000` |
| `lib/main_prod.dart` | produção | obrigatório; sem ele o app abre a tela "Endereço da API não configurado." |

O endereço da API é definido na compilação com `--dart-define=API_URL=...` (só `http`/`https`):

```bash
flutter run -t lib/main_dev.dart
flutter run -t lib/main_prod.dart --dart-define=API_URL=https://api.exemplo.com.br
```

## Rodar no emulador Android

O `localhost` do emulador é o próprio emulador. Para ele alcançar o backend da máquina, abra o túnel da
porta 4000 (refaça sempre que o emulador reiniciar):

```bash
adb reverse tcp:4000 tcp:4000
flutter run -t lib/main_dev.dart
```

Ou, pelo Makefile, `make run-dev-tunnel`, que faz os dois passos.

- **Aparelho físico Android:** o mesmo `adb reverse` com o cabo USB conectado.
- **Simulador iOS:** acessa o `localhost` da máquina direto; basta `flutter run -t lib/main_dev.dart`.

## Makefile

| Alvo | O que faz |
|---|---|
| `make tunnel` | `adb reverse tcp:4000 tcp:4000` (não falha se não houver aparelho) |
| `make run-dev` | roda `lib/main_dev.dart` com `API_URL` (padrão `http://localhost:4000`) |
| `make run-dev-tunnel` | `tunnel` e depois `run-dev` |
| `make run-prod API_URL=...` | roda `lib/main_prod.dart` com o endereço dado |
| `make codegen` | gera o código do `build_runner` |
| `make analyze` | `flutter analyze` |
| `make test` | `flutter test` |
| `make check` | `codegen`, `analyze` e `test`, nessa ordem |

Qualquer alvo aceita outro endereço: `make run-dev API_URL=http://10.0.2.2:4000`.

## Verificação

Os mesmos comandos de `make check`, sem aparelho e sem backend no ar:

```bash
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
```

`flutter test` inclui a barreira de arquitetura (`test/core/architecture_test.dart`), que falha quando uma
camada importa o que não pode.
