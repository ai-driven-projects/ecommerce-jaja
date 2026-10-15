import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/ui/modules/customer/view_models/delivery_address_line.dart';

import '../../../../modules/customer/support/customer_fixtures.dart';

const _aracati = CustomerAddress(
  zipCode: '60115080',
  street: 'Rua Barão de Aracati',
  number: '1200',
  complement: 'apto 302',
  neighborhood: 'Meireles',
  city: 'Fortaleza',
  state: 'CE',
  location: null,
);

void main() {
  group('formatDeliveryAddress', () {
    test('junta as partes com " · ", com o complemento e o CEP mascarado', () {
      expect(
        formatDeliveryAddress(_aracati),
        'Rua Barão de Aracati, 1200 · apto 302 · Meireles · Fortaleza/CE · '
        '60115-080',
      );
    });

    test('sem complemento, a parte some', () {
      expect(
        formatDeliveryAddress(fortalezaCustomerWithoutLocation.address),
        'Avenida Santos Dumont, 1500 · Aldeota · Fortaleza/CE · 60150-160',
      );
    });

    test('complemento só com espaços também some', () {
      expect(
        formatDeliveryAddress(_aracati.copyWith(complement: '   ')),
        'Rua Barão de Aracati, 1200 · Meireles · Fortaleza/CE · 60115-080',
      );
    });

    test('o complemento sai aparado', () {
      expect(
        formatDeliveryAddress(
          fortalezaCustomer.address.copyWith(complement: ' Sala 3 '),
        ),
        'Avenida Santos Dumont, 1500 · Sala 3 · Aldeota · Fortaleza/CE · '
        '60150-160',
      );
    });
  });
}
