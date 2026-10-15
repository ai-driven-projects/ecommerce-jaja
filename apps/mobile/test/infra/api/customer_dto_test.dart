import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/customer_dto.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/customer/model/customer_rules.dart';

import '../../modules/customer/support/customer_fixtures.dart';
import 'support/customer_json.dart';

Matcher throwsFormatExceptionNaming(String field) => throwsA(
  isA<FormatException>().having(
    (error) => error.message,
    'message',
    contains(field),
  ),
);

CustomerDraft _draft({required CustomerLocation? location}) => CustomerDraft(
  cpf: '52998224725',
  phone: '85999998888',
  zipCode: '60150160',
  street: 'Avenida Santos Dumont',
  number: '1500',
  complement: null,
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'CE',
  location: location,
);

void main() {
  group('parseCustomer', () {
    test('lê o cadastro com o ponto e ignora nome, e-mail e datas', () {
      final decoded = jsonDecode(jsonEncode(fortalezaCustomerJson));

      expect(parseCustomer(decoded), fortalezaCustomer);
    });

    test('lê o cadastro sem ponto e sem complemento', () {
      final decoded = jsonDecode(
        jsonEncode(fortalezaCustomerWithoutLocationJson),
      );

      final customer = parseCustomer(decoded);

      expect(customer, fortalezaCustomerWithoutLocation);
      expect(customer.address.location, isNull);
      expect(customer.address.complement, isNull);
    });

    test('lê a resposta do PUT, sem nome nem e-mail', () {
      expect(parseCustomer(savedFortalezaCustomerJson), fortalezaCustomer);
    });

    test('coordenadas inteiras viram double', () {
      final customer = parseCustomer(
        customerWithAddressField('location', {
          'latitude': -3,
          'longitude': -38,
        }),
      );

      expect(
        customer.address.location,
        const CustomerLocation(latitude: -3.0, longitude: -38.0),
      );
    });

    test('cadastro sem cpf lança FormatException com o campo', () {
      expect(
        () => parseCustomer(customerWithout('cpf')),
        throwsFormatExceptionNaming('cpf'),
      );
    });

    test('cadastro sem address lança FormatException com o campo', () {
      expect(
        () => parseCustomer(customerWithout('address')),
        throwsFormatExceptionNaming('address'),
      );
    });

    test('endereço sem zipCode lança FormatException com o campo', () {
      expect(
        () => parseCustomer(customerWithoutAddressField('zipCode')),
        throwsFormatExceptionNaming('zipCode'),
      );
    });

    test('endereço sem a chave location lança FormatException', () {
      expect(
        () => parseCustomer(customerWithoutAddressField('location')),
        throwsFormatExceptionNaming('location'),
      );
    });

    test('endereço sem a chave complement lança FormatException', () {
      expect(
        () => parseCustomer(customerWithoutAddressField('complement')),
        throwsFormatExceptionNaming('complement'),
      );
    });

    test('ponto sem latitude lança FormatException com o campo', () {
      expect(
        () => parseCustomer(
          customerWithAddressField('location', {'longitude': -38.5}),
        ),
        throwsFormatExceptionNaming('latitude'),
      );
    });

    test('campo de outro tipo lança FormatException com o campo', () {
      expect(
        () => parseCustomer(customerWithAddressField('number', 1500)),
        throwsFormatExceptionNaming('number'),
      );
    });

    test('corpo que não é objeto lança FormatException', () {
      expect(() => parseCustomer(null), throwsFormatException);
      expect(() => parseCustomer(const <Object?>[]), throwsFormatException);
    });
  });

  group('encodeCustomerDraft', () {
    test('monta o corpo com o ponto do rascunho', () {
      expect(encodeCustomerDraft(_draft(location: fortalezaLocation)), {
        'cpf': '52998224725',
        'phone': '85999998888',
        'address': {
          'zipCode': '60150160',
          'street': 'Avenida Santos Dumont',
          'number': '1500',
          'complement': null,
          'neighborhood': 'Aldeota',
          'city': 'Fortaleza',
          'state': 'CE',
          'location': {'latitude': -3.731862, 'longitude': -38.526669},
        },
      });
    });

    test('sem ponto, a chave location vai com null', () {
      final address =
          encodeCustomerDraft(_draft(location: null))['address']
              as Map<String, Object?>;

      expect(address.containsKey('location'), isTrue);
      expect(address['location'], isNull);
      expect(address.containsKey('complement'), isTrue);
    });

    test('o corpo sobrevive ao JSON com a chave location', () {
      final decoded =
          jsonDecode(jsonEncode(encodeCustomerDraft(_draft(location: null))))
              as Map<String, Object?>;

      expect((decoded['address'] as Map).containsKey('location'), isTrue);
    });
  });
}
