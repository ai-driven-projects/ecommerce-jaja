## ADDED Requirements

### Requirement: Estilo vindo do tema
Arquivos Dart em pastas `pages/` e `widgets/` sob `lib/ui` SHALL obter cor, tipografia e raio do tema da marca. Eles MUST NOT construir cor literal (`Color(...)`, `Color.fromARGB`, `Color.fromRGBO`, `Color.from`), usar `Colors.*` (exceto `Colors.transparent`), construir `TextStyle(...)`, passar `fontSize`, usar raio numérico literal (`Radius.circular` ou `BorderRadius.circular` com número) nem estilizar botão com `styleFrom`. A pasta de definição do tema fica fora da regra. Uma violação MUST fazer `flutter test` falhar apontando arquivo, linha e o trecho, e a regra MUST ignorar comentários e textos entre aspas. A barreira MUST falhar se não encontrar nenhum arquivo para verificar.

#### Scenario: Cor literal num widget
- **WHEN** um arquivo em `lib/ui/shared/widgets` contém `Container(color: Color(0xFFFF6B00))`
- **THEN** `flutter test` falha indicando o arquivo, a linha e o trecho

#### Scenario: Exceções legítimas
- **WHEN** um widget usa `Colors.transparent`, um raio vindo dos tokens ou cita `Colors.red` num comentário
- **THEN** a barreira aceita o arquivo

#### Scenario: Definição do tema
- **WHEN** um arquivo em `lib/ui/shared/theme` declara `Color(0xFFFF6B00)`
- **THEN** a barreira de estilo não aponta violação
