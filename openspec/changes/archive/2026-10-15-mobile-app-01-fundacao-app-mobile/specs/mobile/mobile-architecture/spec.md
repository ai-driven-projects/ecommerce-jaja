## Purpose

Define o projeto do app mobile do cliente Jajá (Flutter, Android e iOS) e as regras de camadas que valem para todo o app, verificadas por uma barreira automatizada que roda junto com os testes, sem dispositivo nem backend.

## ADDED Requirements

### Requirement: Projeto do app mobile
O app SHALL existir em `apps/mobile` como um projeto Flutter com as plataformas Android e iOS apenas, identificador de organização `br.com.jaja` e nome exibido "Jajá". O projeto MUST passar em `flutter analyze` sem avisos com o conjunto de lints `flutter_lints`, e MUST compilar com uma UI mínima, sem telas de produto. Arquivos de build, de ferramenta e de IDE MUST ficar fora do versionamento.

#### Scenario: Plataformas do projeto
- **WHEN** a pasta `apps/mobile` é inspecionada
- **THEN** existem os projetos nativos `android/` e `ios/`, com o identificador iniciado por `br.com.jaja`, e não existem `web/`, `linux/`, `macos/` nem `windows/`

#### Scenario: Análise estática limpa
- **WHEN** `flutter analyze` roda em `apps/mobile`
- **THEN** o comando termina sem erros, avisos nem infos

### Requirement: Regras de arquitetura documentadas
O app SHALL ter um `apps/mobile/CLAUDE.md` com as regras de arquitetura do app: as camadas `core`, `modules`, `infra`, `ui` e `app` e o que cada uma pode importar, a stack e os pacotes permitidos, as regras de domínio (sessão, carrinho, loja, dados de entrega, acompanhamento do pedido), o padrão de estados de tela remota, as convenções de nome, idioma e testes, e os comandos de verificação. Etapas seguintes MUST poder acrescentar regras a esse arquivo, nunca afrouxá-las.

#### Scenario: Regras disponíveis para quem trabalha no app
- **WHEN** alguém abre `apps/mobile/CLAUDE.md`
- **THEN** encontra as camadas com suas restrições de import, a lista de pacotes permitidos, as regras de domínio do app e os três comandos de verificação (`build_runner`, `flutter analyze`, `flutter test`)

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
