import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/customer/errors/customer_errors.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/customer/model/customer_rules.dart';

import '../support/customer_fixtures.dart';

CustomerDraft _valid(
  CustomerFields fields, {
  CustomerLocation? location = fortalezaLocation,
}) {
  return switch (CustomerDraft.validate(fields, location: location)) {
    ValidCustomerDraft(:final draft) => draft,
    InvalidCustomerDraft(:final errors) => fail('Esperava válido: $errors'),
  };
}

Map<CustomerField, String> _errors(CustomerFields fields) {
  return switch (CustomerDraft.validate(fields, location: null)) {
    ValidCustomerDraft(:final draft) => fail('Esperava inválido: $draft'),
    InvalidCustomerDraft(:final errors) => errors,
  };
}

const _tooShort = 'O texto não atingiu o tamanho mínimo permitido.';
const _tooLong = 'O texto passou do tamanho máximo permitido.';

void main() {
  group('CustomerDraft.validate com campos válidos', () {
    test('normaliza CPF, telefone e CEP em dígitos e repassa a location', () {
      expect(
        _valid(fortalezaFields),
        const CustomerDraft(
          cpf: '52998224725',
          phone: '85999998888',
          zipCode: '60150160',
          street: 'Avenida Santos Dumont',
          number: '1500',
          complement: 'Sala 3',
          neighborhood: 'Aldeota',
          city: 'Fortaleza',
          state: 'CE',
          location: fortalezaLocation,
        ),
      );
    });

    test('UF em maiúsculas e textos aparados', () {
      final draft = _valid(
        fortalezaFields
            .withValue(CustomerField.state, ' ce ')
            .withValue(CustomerField.street, '  Avenida Santos Dumont  ')
            .withValue(CustomerField.city, ' Fortaleza'),
      );

      expect(draft.state, 'CE');
      expect(draft.street, 'Avenida Santos Dumont');
      expect(draft.city, 'Fortaleza');
    });

    test('complemento vazio ou só com espaços vira null', () {
      for (final complement in ['', '   ']) {
        final draft = _valid(
          fortalezaFields.withValue(CustomerField.complement, complement),
        );

        expect(draft.complement, isNull);
      }
    });

    test('location null (cliente novo) é repassada como null', () {
      expect(_valid(fortalezaFields, location: null).location, isNull);
    });

    test('aceita os limites exatos dos textos', () {
      final draft = _valid(
        fortalezaFields
            .withValue(CustomerField.street, 'a' * 120)
            .withValue(CustomerField.number, '1')
            .withValue(CustomerField.complement, 'c' * 80)
            .withValue(CustomerField.neighborhood, 'b' * 60)
            .withValue(CustomerField.city, 'Ce'),
      );

      expect(draft.street, hasLength(120));
      expect(draft.complement, hasLength(80));
    });
  });

  group('CustomerDraft.validate com campos inválidos', () {
    test('formulário vazio: um erro por campo obrigatório', () {
      expect(_errors(const CustomerFields()), {
        CustomerField.cpf: 'CPF inválido.',
        CustomerField.phone: 'Telefone inválido.',
        CustomerField.zipCode: 'CEP inválido.',
        CustomerField.street: _tooShort,
        CustomerField.number: _tooShort,
        CustomerField.neighborhood: _tooShort,
        CustomerField.city: _tooShort,
        CustomerField.state: 'UF inválida.',
      });
    });

    test('cada campo inválido tem a mensagem do seu value object', () {
      expect(
        _errors(
          CustomerFields(
            cpf: '529.982.247-24',
            phone: '1234567',
            zipCode: '6015-0160',
            street: 'A',
            number: '12345678901',
            complement: '',
            neighborhood: 'b' * 61,
            city: 'c' * 61,
            state: 'XX',
          ),
        ),
        {
          CustomerField.cpf: 'CPF inválido.',
          CustomerField.phone: 'Telefone inválido.',
          CustomerField.zipCode: 'CEP inválido.',
          CustomerField.street: _tooShort,
          CustomerField.number: _tooLong,
          CustomerField.neighborhood: _tooLong,
          CustomerField.city: _tooLong,
          CustomerField.state: 'UF inválida.',
        },
      );
    });

    test('complemento longo é o único erro', () {
      expect(
        _errors(fortalezaFields.withValue(CustomerField.complement, 'c' * 81)),
        {CustomerField.complement: _tooLong},
      );
    });
  });

  group('CustomerFields', () {
    test('withValue troca só o campo pedido', () {
      final changed = fortalezaFields.withValue(CustomerField.number, '20');

      expect(changed.number, '20');
      for (final field in CustomerField.values) {
        if (field == CustomerField.number) continue;
        expect(changed.valueOf(field), fortalezaFields.valueOf(field));
      }
    });

    test('igualdade por valor', () {
      expect(
        fortalezaFields.withValue(CustomerField.number, '1500'),
        fortalezaFields,
      );
      expect(
        fortalezaFields.withValue(CustomerField.number, '20'),
        isNot(fortalezaFields),
      );
    });
  });
}
