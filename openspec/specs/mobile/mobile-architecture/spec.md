# Arquitetura do App Mobile (Mobile Architecture) Specification

## Purpose

Define o projeto do app mobile do cliente Jajá (Flutter, Android e iOS) e as regras de camadas que valem para todo o app, verificadas por uma barreira automatizada que roda junto com os testes, sem dispositivo nem backend.
## Requirements

### Requirement: Projeto do app mobile
O app SHALL existir em `apps/mobile` como um projeto Flutter com as plataformas Android e iOS apenas, identificador de organização `br.com.jaja` e nome exibido "Jajá". O projeto MUST passar em `flutter analyze` sem avisos com o conjunto de lints `flutter_lints`. O código MUST NOT conter página provisória, comentário que descreva o código pela etapa do plano em que ele nasceu nem declaração sem consumidor em `lib/`, salvo o que uma spec exige. Arquivos de build, de ferramenta e de IDE MUST ficar fora do versionamento.

#### Scenario: Plataformas do projeto
- **WHEN** a pasta `apps/mobile` é inspecionada
- **THEN** existem os projetos nativos `android/` e `ios/`, com o identificador iniciado por `br.com.jaja`, e não existem `web/`, `linux/`, `macos/` nem `windows/`

#### Scenario: Análise estática limpa
- **WHEN** `flutter analyze` roda em `apps/mobile`
- **THEN** o comando termina sem erros, avisos nem infos

#### Scenario: Sem marcas de construção
- **WHEN** os arquivos de `apps/mobile/lib` são inspecionados
- **THEN** nenhum deles cita "etapa" seguida de número nem mostra uma página provisória

### Requirement: Regras de arquitetura documentadas
O app SHALL ter um `apps/mobile/CLAUDE.md` que descreve o app no estado final: as camadas `core`, `modules`, `infra`, `ui` e `app` e o que cada uma pode importar, todas as regras da barreira, a stack e os pacotes permitidos, as regras de domínio (sessão, carrinho, loja, catálogo, dados de entrega, pedido e acompanhamento), o padrão de estados de tela remota, as convenções de nome, idioma, textos e testes, e os comandos de verificação, sem histórico por etapa. Mudanças futuras MUST poder acrescentar regras a esse arquivo, nunca afrouxá-las. O app SHALL ter um `apps/mobile/README.md` que ensina a rodar o app no emulador Android, no aparelho Android, no simulador iOS e no aparelho iOS, com o túnel `adb reverse`, o endereço por `API_URL` e os alvos do `Makefile`. O app SHALL ter um `apps/mobile/docs/lacunas-da-api.md` com cada lacuna do backend que o app contorna, conferida no controller, e o contorno adotado.

#### Scenario: Regras disponíveis para quem trabalha no app
- **WHEN** alguém abre `apps/mobile/CLAUDE.md`
- **THEN** encontra as camadas com suas restrições de import, as regras da barreira, a lista de pacotes permitidos, as regras de domínio do app e os três comandos de verificação (`build_runner`, `flutter analyze`, `flutter test`), sem parágrafos "Etapa N"

#### Scenario: Rodar no aparelho
- **WHEN** alguém segue o `apps/mobile/README.md` com um aparelho Android ligado por cabo
- **THEN** encontra o `adb reverse tcp:4000 tcp:4000`, o comando de execução com `-t lib/main_dev.dart` e o alvo do `Makefile` equivalente, e o que muda para outro endereço de API

#### Scenario: Lacunas registradas
- **WHEN** alguém abre `apps/mobile/docs/lacunas-da-api.md`
- **THEN** cada item diz o que falta no backend, onde isso foi conferido, o efeito no app e o contorno, e nenhum item propõe endpoint que o app chame

### Requirement: Núcleo e domínio independentes de framework
O código em `lib/core` e `lib/modules` SHALL ser Dart puro: MUST NOT importar Flutter, `dart:io`, `dart:ui` nem pacotes de infraestrutura (HTTP e armazenamento); só bibliotecas Dart sem plataforma e uma lista fechada de pacotes de anotação e utilitários. `lib/core` MUST NOT importar `lib/modules`. A regra MUST valer para imports e exports, por URI de pacote ou caminho relativo. Uma violação MUST fazer `flutter test` falhar, apontando arquivo, linha e o import proibido.

#### Scenario: Flutter importado no núcleo
- **WHEN** um arquivo em `lib/core` importa `package:flutter/foundation.dart`
- **THEN** `flutter test` falha indicando o arquivo, a linha e o import

#### Scenario: Import relativo que escapa da camada
- **WHEN** um arquivo em `lib/core` importa por caminho relativo algo de `lib/infra` ou de `lib/modules`
- **THEN** a barreira trata o import como violação

#### Scenario: Domínio importando o núcleo
- **WHEN** um arquivo em `lib/modules` importa `lib/core` por pacote ou por caminho relativo
- **THEN** a barreira aceita o import

### Requirement: Infraestrutura confinada
Os pacotes de HTTP e de armazenamento local (`dio`, `flutter_secure_storage`, `shared_preferences`) SHALL ser importados ou exportados só por arquivos em `lib/infra`. Um import desses pacotes em qualquer outra pasta de `lib/` MUST fazer `flutter test` falhar.

#### Scenario: Pacote HTTP fora da infraestrutura
- **WHEN** um arquivo em `lib/ui` importa `package:dio/dio.dart`
- **THEN** a barreira aponta a violação com arquivo e linha

#### Scenario: Pacote de armazenamento na infraestrutura
- **WHEN** um arquivo em `lib/infra` importa `package:shared_preferences/shared_preferences.dart`
- **THEN** a barreira aceita o import

### Requirement: Barreira que não passa vazia
A barreira de arquitetura SHALL falhar, em vez de passar, quando uma pasta que ela deve verificar não existe ou quando não encontra nenhum arquivo Dart para verificar. As próprias regras da barreira MUST ser cobertas por testes com fontes de exemplo, independentes do código existente no app.

#### Scenario: Pasta verificada ausente
- **WHEN** a barreira é apontada para uma pasta que não existe
- **THEN** ela falha com uma mensagem dizendo que nada teria sido verificado

### Requirement: Verificação sem dispositivo
A verificação do app SHALL consistir em `dart run build_runner build --delete-conflicting-outputs`, `flutter analyze` e `flutter test`, todos executáveis sem emulador, aparelho, rede de produção nem backend no ar.

#### Scenario: Verificação completa num ambiente sem dispositivo
- **WHEN** os três comandos rodam em `apps/mobile` numa máquina sem emulador e sem o backend
- **THEN** os três terminam com sucesso

### Requirement: Estilo vindo do tema
Arquivos Dart em pastas `pages/` e `widgets/` sob `lib/ui`, e todos os arquivos Dart de `lib/app`, SHALL obter cor, tipografia e raio do tema da marca. Eles MUST NOT construir cor literal (`Color(...)`, `Color.fromARGB`, `Color.fromRGBO`, `Color.from`), usar `Colors.*` (exceto `Colors.transparent`), construir `TextStyle(...)`, passar `fontSize`, usar raio numérico literal (`Radius.circular` ou `BorderRadius.circular` com número) nem estilizar botão com `styleFrom`. A pasta de definição do tema fica fora dessa regra. Além disso, cor literal (`Color(...)` e variantes, `Colors.*` exceto `Colors.transparent`) MUST aparecer em um único arquivo de `lib/`, o de cores do tema; em qualquer outro arquivo de `lib/`, inclusive os demais do tema, é violação. Uma violação MUST fazer `flutter test` falhar apontando arquivo, linha e o trecho, e as regras MUST ignorar comentários e textos entre aspas. A barreira MUST falhar se não encontrar nenhum arquivo para verificar.

#### Scenario: Cor literal num widget
- **WHEN** um arquivo em `lib/ui/shared/widgets` contém `Container(color: Color(0xFFFF6B00))`
- **THEN** `flutter test` falha indicando o arquivo, a linha e o trecho

#### Scenario: Exceções legítimas
- **WHEN** um widget usa `Colors.transparent`, um raio vindo dos tokens ou cita `Colors.red` num comentário
- **THEN** a barreira aceita o arquivo

#### Scenario: Definição do tema
- **WHEN** o arquivo de cores do tema, em `lib/ui/shared/theme`, declara `Color(0xFFFF6B00)`
- **THEN** a barreira de estilo não aponta violação

#### Scenario: Cor fora do arquivo de cores do tema
- **WHEN** outro arquivo da pasta do tema ou de `lib/app` declara `Color(0xFF000000)`
- **THEN** a barreira aponta a violação com arquivo e linha

### Requirement: Localizador de dependências confinado
O localizador de dependências (`get_it`) SHALL ser importado ou exportado só por arquivos em `lib/infra/di` e em `lib/app` (inicialização e construtores de rota). Páginas, widgets, ViewModels, domínio, núcleo e o restante da infraestrutura MUST receber dependências pelo construtor. Um import do pacote fora dessas pastas MUST fazer `flutter test` falhar apontando arquivo, linha e o import.

#### Scenario: Localizador numa página
- **WHEN** um arquivo em `lib/ui/modules/catalog/pages` importa `package:get_it/get_it.dart`
- **THEN** a barreira aponta a violação com arquivo e linha

#### Scenario: Localizador no roteador e na DI
- **WHEN** arquivos em `lib/app/router` e em `lib/infra/di` importam `package:get_it/get_it.dart`
- **THEN** a barreira aceita os imports

#### Scenario: Localizador no restante da infraestrutura
- **WHEN** um arquivo em `lib/infra/http` importa `package:get_it/get_it.dart`
- **THEN** a barreira aponta a violação

### Requirement: Ligação da UI confinada
O pacote de ligação da UI aos ViewModels (`watch_it`) SHALL ser importado só por arquivos em `lib/ui` e em `lib/app`. Em `lib/ui`, o import MUST listar explicitamente o que usa (`show`) e MUST NOT trazer o localizador que o pacote reexporta (`di`, `sl`, `GetIt`), para que telas e ViewModels continuem recebendo dependências pelo construtor. Qualquer outro uso MUST fazer `flutter test` falhar apontando arquivo, linha e o import.

#### Scenario: Ligação numa página
- **WHEN** um arquivo em `lib/ui/modules/store/pages` importa `package:watch_it/watch_it.dart` com `show WatchingWidget, watchPropertyValue`
- **THEN** a barreira aceita o import

#### Scenario: Ligação trazendo o localizador
- **WHEN** um arquivo em `lib/ui/modules/store/pages` importa `package:watch_it/watch_it.dart` sem `show`, ou com `show di`
- **THEN** a barreira aponta a violação com arquivo e linha

#### Scenario: Ligação fora da UI
- **WHEN** um arquivo em `lib/infra/store` importa `package:watch_it/watch_it.dart`
- **THEN** a barreira aponta a violação

### Requirement: Pacote de imagens de rede confinado
O pacote de imagens de rede com cache (`cached_network_image`) SHALL ser importado só por arquivos em `lib/ui`. Qualquer outro uso MUST fazer `flutter test` falhar apontando arquivo, linha e o import.

#### Scenario: Foto num widget
- **WHEN** um arquivo em `lib/ui/shared/widgets` importa `package:cached_network_image/cached_network_image.dart`
- **THEN** a barreira aceita o import

#### Scenario: Foto fora da UI
- **WHEN** um arquivo em `lib/infra/catalog` importa `package:cached_network_image/cached_network_image.dart`
- **THEN** a barreira aponta a violação com arquivo e linha

### Requirement: Estrutura de pastas verificada
A barreira SHALL verificar a estrutura de pastas do app: em `lib/`, só as pastas `app`, `core`, `infra`, `modules` e `ui` e os pontos de entrada `main_dev.dart` e `main_prod.dart`; em `lib/modules/`, só os domínios `auth`, `cart`, `catalog`, `customer`, `order` e `store`, cada um só com as subpastas `model`, `provider`, `usecase` e `errors`; em `lib/ui/modules/`, só esses domínios, cada um só com `pages`, `widgets` e `view_models`. Nenhum arquivo de teste MUST ficar em `lib/`, e toda pasta de `test/` com testes MUST espelhar uma pasta existente em `lib/` (pastas `support/` à parte). Uma violação MUST fazer `flutter test` falhar apontando o caminho.

#### Scenario: Pasta desconhecida num domínio
- **WHEN** existe `lib/modules/cart/services/cart_service.dart`
- **THEN** `flutter test` falha indicando o caminho e as subpastas permitidas

#### Scenario: Teste fora do espelho
- **WHEN** existe `test/ui/modules/cart/helpers/x_test.dart` sem `lib/ui/modules/cart/helpers/`
- **THEN** `flutter test` falha indicando o caminho do teste

#### Scenario: Estrutura atual
- **WHEN** a barreira roda sobre o código do app
- **THEN** nenhuma violação de estrutura é apontada

### Requirement: Texto de interface sem repetição
Um mesmo texto de interface SHALL ser escrito uma única vez em `lib/ui` e `lib/app`: um literal de texto exibível (começa com letra maiúscula, tem ao menos 12 caracteres e não tem interpolação) MUST NOT aparecer em mais de um arquivo. Quem precisa do mesmo texto MUST reusar a constante de quem o declara. Uma repetição MUST fazer `flutter test` falhar listando o texto e os arquivos.

#### Scenario: Texto copiado entre telas
- **WHEN** dois arquivos de `lib/ui` têm o literal `'Não foi possível carregar o carrinho.'`
- **THEN** `flutter test` falha listando o texto e os dois arquivos

#### Scenario: Texto reusado por constante
- **WHEN** um arquivo declara o texto numa constante e outro usa essa constante
- **THEN** a barreira de texto aceita os dois
