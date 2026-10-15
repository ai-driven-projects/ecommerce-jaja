/// Campos do formulário de dados de entrega, na ordem da tela.
enum CustomerField {
  cpf,
  phone,
  zipCode,
  street,
  number,
  complement,
  neighborhood,
  city,
  state,
}

/// Recusas de `PUT /me/customer` que têm campo próprio, com os textos de
/// `apps/frontend/src/shared/i18n/messages.pt.ts` e o código do backend que
/// cada uma traduz ([backendCode]). Os outros códigos ficam como mensagem do
/// formulário.
enum CustomerErrorCode {
  cpfAlreadyExists(
    'CUSTOMER_CPF_ALREADY_EXISTS',
    'Este CPF já está cadastrado.',
    CustomerField.cpf,
  ),
  cpfInvalidFormat('CPF_INVALID_FORMAT', 'CPF inválido.', CustomerField.cpf),
  cpfInvalidLength('CPF_INVALID_LENGTH', 'CPF inválido.', CustomerField.cpf),
  cpfRepeatedSequence(
    'CPF_REPEATED_SEQUENCE',
    'CPF inválido.',
    CustomerField.cpf,
  ),
  cpfInvalidCheckDigit(
    'CPF_INVALID_CHECK_DIGIT',
    'CPF inválido.',
    CustomerField.cpf,
  ),
  phoneInvalidFormat(
    'PHONE_INVALID_FORMAT',
    'Telefone inválido.',
    CustomerField.phone,
  ),
  phoneInvalidLength(
    'PHONE_INVALID_LENGTH',
    'Telefone inválido.',
    CustomerField.phone,
  ),
  zipCodeInvalid(
    'CUSTOMER_ZIP_CODE_INVALID',
    'CEP inválido.',
    CustomerField.zipCode,
  ),
  stateInvalid('CUSTOMER_STATE_INVALID', 'UF inválida.', CustomerField.state);

  const CustomerErrorCode(this.backendCode, this.message, this.field);

  /// Código enviado pelo backend (`modules/customers/src/customer/errors.ts`
  /// e `packages/shared/src/vo/{cpf,phone}.vo.ts`).
  final String backendCode;

  final String message;

  final CustomerField field;
}

/// Mensagem de cada campo citado em [codes]: o primeiro código conhecido de
/// cada campo, na ordem recebida. Códigos desconhecidos ficam de fora.
Map<CustomerField, String> customerFieldErrorsFromCodes(List<String> codes) {
  final errors = <CustomerField, String>{};
  for (final code in codes) {
    for (final value in CustomerErrorCode.values) {
      if (value.backendCode == code) {
        errors.putIfAbsent(value.field, () => value.message);
      }
    }
  }
  return Map.unmodifiable(errors);
}
