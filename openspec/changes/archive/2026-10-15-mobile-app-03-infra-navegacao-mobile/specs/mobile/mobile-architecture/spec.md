## ADDED Requirements

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
