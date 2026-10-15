## ADDED Requirements

### Requirement: Pacote de imagens de rede confinado
O pacote de imagens de rede com cache (`cached_network_image`) SHALL ser importado só por arquivos em `lib/ui`. Qualquer outro uso MUST fazer `flutter test` falhar apontando arquivo, linha e o import.

#### Scenario: Foto num widget
- **WHEN** um arquivo em `lib/ui/shared/widgets` importa `package:cached_network_image/cached_network_image.dart`
- **THEN** a barreira aceita o import

#### Scenario: Foto fora da UI
- **WHEN** um arquivo em `lib/infra/catalog` importa `package:cached_network_image/cached_network_image.dart`
- **THEN** a barreira aponta a violação com arquivo e linha
