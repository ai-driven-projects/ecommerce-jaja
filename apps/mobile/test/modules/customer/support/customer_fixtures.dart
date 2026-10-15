import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/customer/model/customer_rules.dart';

/// Ponto marcado no web para o endereço de Fortaleza.
const fortalezaLocation = CustomerLocation(
  latitude: -3.731862,
  longitude: -38.526669,
);

/// Cliente com cadastro em Fortaleza, com o ponto marcado no web.
const fortalezaCustomer = Customer(
  id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01',
  cpf: '52998224725',
  phone: '85999998888',
  address: CustomerAddress(
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

/// O mesmo cadastro, sem ponto e sem complemento.
final fortalezaCustomerWithoutLocation = fortalezaCustomer.copyWith(
  address: fortalezaCustomer.address.copyWith(complement: null, location: null),
);

/// O cadastro de Fortaleza como aparece no formulário, com as máscaras.
const fortalezaFields = CustomerFields(
  cpf: '529.982.247-25',
  phone: '(85) 99999-8888',
  zipCode: '60150-160',
  street: 'Avenida Santos Dumont',
  number: '1500',
  complement: 'Sala 3',
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'CE',
);

/// Id dado pelo fake ao cadastro criado por quem ainda não tinha um.
const newCustomerId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02';

/// Cadastro que a API devolveria ao gravar [draft] com o [id] dado.
Customer customerFromDraft(CustomerDraft draft, {required String id}) {
  return Customer(
    id: id,
    cpf: draft.cpf,
    phone: draft.phone,
    address: CustomerAddress(
      zipCode: draft.zipCode,
      street: draft.street,
      number: draft.number,
      complement: draft.complement,
      neighborhood: draft.neighborhood,
      city: draft.city,
      state: draft.state,
      location: draft.location,
    ),
  );
}
