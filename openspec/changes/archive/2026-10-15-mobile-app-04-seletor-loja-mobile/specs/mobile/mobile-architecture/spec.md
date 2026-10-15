## ADDED Requirements

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
