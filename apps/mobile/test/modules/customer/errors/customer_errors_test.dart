import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/customer/errors/customer_errors.dart';

void main() {
  group('customerFieldErrorsFromCodes', () {
    const expected = {
      'CUSTOMER_CPF_ALREADY_EXISTS': (
        CustomerField.cpf,
        'Este CPF já está cadastrado.',
      ),
      'CPF_INVALID_FORMAT': (CustomerField.cpf, 'CPF inválido.'),
      'CPF_INVALID_LENGTH': (CustomerField.cpf, 'CPF inválido.'),
      'CPF_REPEATED_SEQUENCE': (CustomerField.cpf, 'CPF inválido.'),
      'CPF_INVALID_CHECK_DIGIT': (CustomerField.cpf, 'CPF inválido.'),
      'PHONE_INVALID_FORMAT': (CustomerField.phone, 'Telefone inválido.'),
      'PHONE_INVALID_LENGTH': (CustomerField.phone, 'Telefone inválido.'),
      'CUSTOMER_ZIP_CODE_INVALID': (CustomerField.zipCode, 'CEP inválido.'),
      'CUSTOMER_STATE_INVALID': (CustomerField.state, 'UF inválida.'),
    };

    for (final MapEntry(key: code, value: (field, message))
        in expected.entries) {
      test('$code vai para ${field.name} com "$message"', () {
        expect(customerFieldErrorsFromCodes([code]), {field: message});
      });
    }

    test('cada código do backend tem um valor no enum', () {
      expect(
        CustomerErrorCode.values.map((value) => value.backendCode).toSet(),
        expected.keys.toSet(),
      );
    });

    test('dois códigos do CPF ficam com o primeiro, na ordem recebida', () {
      expect(
        customerFieldErrorsFromCodes([
          'CPF_INVALID_CHECK_DIGIT',
          'CUSTOMER_CPF_ALREADY_EXISTS',
        ]),
        {CustomerField.cpf: 'CPF inválido.'},
      );
      expect(
        customerFieldErrorsFromCodes([
          'CUSTOMER_CPF_ALREADY_EXISTS',
          'CPF_INVALID_CHECK_DIGIT',
        ]),
        {CustomerField.cpf: 'Este CPF já está cadastrado.'},
      );
    });

    test('códigos de campos diferentes vão cada um ao seu campo', () {
      expect(
        customerFieldErrorsFromCodes([
          'CPF_INVALID_CHECK_DIGIT',
          'PHONE_INVALID_LENGTH',
        ]),
        {
          CustomerField.cpf: 'CPF inválido.',
          CustomerField.phone: 'Telefone inválido.',
        },
      );
    });

    test('código desconhecido fica de fora', () {
      expect(
        customerFieldErrorsFromCodes([
          'CUSTOMER_ALREADY_EXISTS',
          'PHONE_INVALID_FORMAT',
          'ALGO_NOVO',
        ]),
        {CustomerField.phone: 'Telefone inválido.'},
      );
      expect(customerFieldErrorsFromCodes(['ALGO_NOVO']), isEmpty);
      expect(customerFieldErrorsFromCodes(const []), isEmpty);
    });
  });
}
