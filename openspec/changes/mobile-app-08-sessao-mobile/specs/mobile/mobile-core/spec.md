## ADDED Requirements

### Requirement: Validação de dados de conta
O núcleo SHALL validar os dados de conta com as regras dos value objects do pacote compartilhado usados pelo web, devolvendo o valor normalizado ou uma falha de validação com mensagem em português:
- e-mail: aparado e em minúsculas, no formato `algo@dominio.ext` sem espaços; senão "E-mail inválido.";
- nome: aparado, de 3 a 50 caracteres, com ao menos duas palavras, primeira e última com 2 ou mais letras, só letras (com acentos), espaço, apóstrofo e hífen; curto demais "O nome é curto demais.", longo demais "O nome é longo demais.", sem sobrenome ou com caractere inválido "Informe nome e sobrenome.";
- senha forte: ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo; senão "A senha precisa ter ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo.".

#### Scenario: E-mail normalizado
- **WHEN** o e-mail ` Ana@Exemplo.COM ` é validado
- **THEN** o resultado é sucesso com `ana@exemplo.com`

#### Scenario: Nome sem sobrenome
- **WHEN** o nome `Ana` é validado
- **THEN** o resultado é falha de validação com "Informe nome e sobrenome."

#### Scenario: Senha sem símbolo
- **WHEN** a senha `Senha1234` é validada
- **THEN** o resultado é falha de validação com a mensagem de senha forte
