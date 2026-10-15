# Jajá — app mobile do cliente

App em Flutter (Android e iOS) para quem compra na Jajá. Leva para o celular a vitrine web: escolher a loja,
navegar e buscar no catálogo, ver o produto, montar o carrinho (como visitante ou com conta), entrar ou
criar conta, informar os dados de entrega, fechar o pedido e acompanhá-lo ao vivo. Fala só com o backend
NestJS deste repositório (`apps/backend`); não há admin no app.

Quatro abas: **Início** (loja, destaques, ofertas e categorias), **Buscar** (busca, filtros e ordenação),
**Carrinho** (carrinho, checkout e pedido) e **Conta** (acesso e dados de entrega).

- As regras do app (arquitetura, camadas, barreira, estilo e domínio) estão no [`CLAUDE.md`](CLAUDE.md).
- O que falta no backend e como o app contorna está em [`docs/lacunas-da-api.md`](docs/lacunas-da-api.md).

## Pré-requisitos

- Flutter estável com Dart 3 (`flutter doctor` sem pendências para a plataforma que vai usar).
- O backend de `apps/backend` rodando na porta 4000 (veja o README da raiz do repositório).
- Android: Android SDK com o `adb` no `PATH` e um emulador ou aparelho visível em `adb devices`.
- iOS: macOS com Xcode e um simulador (ou aparelho) visível em `flutter devices`.

## Pontos de entrada e `API_URL`

Não há `lib/main.dart`: todo `flutter run` precisa de `-t`.

| Arquivo | Ambiente | `API_URL` |
|---|---|---|
| `lib/main_dev.dart` | desenvolvimento | opcional; padrão `http://localhost:4000` |
| `lib/main_prod.dart` | produção | obrigatório; sem ele o app abre a tela "Endereço da API não configurado." |

O endereço da API entra na compilação com `--dart-define=API_URL=...` (só `http`/`https`, com host; endereço
inválido abre a tela "Endereço da API inválido."). Trocar o endereço exige rodar o app de novo: o _hot
reload_ não relê o `--dart-define`.

```bash
flutter run -t lib/main_dev.dart
flutter run -t lib/main_dev.dart --dart-define=API_URL=http://192.168.0.10:4000
flutter run -t lib/main_prod.dart --dart-define=API_URL=https://api.exemplo.com.br
```

## Rodar no emulador Android

O `localhost` do emulador é o próprio emulador. Para ele alcançar o backend da máquina, abra o túnel da
porta 4000 e rode o app:

```bash
adb reverse tcp:4000 tcp:4000
flutter run -t lib/main_dev.dart
```

Pelo Makefile, `make run-dev-tunnel` faz os dois passos. O túnel cai quando o emulador reinicia: refaça com
`make tunnel` (ou rode `make run-dev-tunnel` de novo).

## Rodar no aparelho Android

1. Ative as opções do desenvolvedor e a depuração USB no aparelho e ligue o cabo.
2. Confira que ele aparece como `device` (não `unauthorized`) em `adb devices`; se houver mais de um
   aparelho, escolha com `flutter run -d <id>`.
3. Abra o túnel e rode, como no emulador:

```bash
adb reverse tcp:4000 tcp:4000
flutter run -t lib/main_dev.dart
```

Ou `make run-dev-tunnel`. Sem cabo (ou sem `adb reverse`), use a rede: aparelho e máquina na mesma rede
Wi-Fi e o endereço da máquina no `API_URL`, sem túnel:

```bash
make run-dev API_URL=http://<IP da máquina>:4000
```

## Rodar no simulador iOS

O simulador usa a rede da máquina: `localhost` já alcança o backend, sem túnel.

```bash
open -a Simulator
flutter run -t lib/main_dev.dart
```

Ou `make run-dev`.

## Rodar no aparelho iOS

Não existe `adb` nem túnel no iPhone: o aparelho alcança o backend pela rede. Aparelho e máquina na mesma
rede Wi-Fi e o endereço da máquina no `API_URL`:

```bash
make run-dev API_URL=http://<IP da máquina>:4000
```

O aparelho precisa estar registrado e o projeto assinado com uma conta de desenvolvedor Apple
(`ios/Runner.xcworkspace` no Xcode, aba _Signing & Capabilities_). Essa configuração depende da conta de cada
pessoa e não fica no repositório.

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

Qualquer alvo de execução aceita outro endereço: `make run-dev API_URL=http://<IP da máquina>:4000`.

## Verificação

Os mesmos comandos de `make check`, sem aparelho e sem backend no ar:

```bash
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
```

`flutter test` inclui a barreira de arquitetura (`test/core/architecture_test.dart`): imports por camada,
estilo e cor só pelo tema, estrutura de pastas e texto de interface sem repetição.

## Problemas comuns

- **"Não foi possível falar com o servidor." no Android depois de reiniciar o emulador ou religar o cabo:**
  o `adb reverse` caiu. Rode `make tunnel` e toque em "Tentar de novo".
- **O mesmo erro num aparelho pela rede:** confira o IP da máquina, se aparelho e máquina estão na mesma
  rede e se o firewall da máquina libera a porta 4000. `localhost` no `API_URL` só funciona com túnel
  (Android) ou no simulador iOS.
- **"Endereço da API não configurado." ao rodar `main_prod.dart`:** faltou o `API_URL` (`make run-prod
  API_URL=https://...`).
- **`http` em produção:** o app aceita `http` em qualquer ambiente, mas fora da máquina de desenvolvimento
  use `https`: o token da sessão vai no cabeçalho de cada requisição.
- **Mudou o `API_URL` e nada mudou:** pare o app e rode de novo; o _hot reload_ não troca o endereço.
