import '../../modules/customer/model/customer_entity.dart';
import '../../modules/customer/model/customer_rules.dart';

/// Converte o corpo de `GET /me/customer` (`CustomerDetailDTO`) ou de
/// `PUT /me/customer` (`CustomerDTO`), de
/// `modules/customers/src/customer/dto/customer.dto.ts`, num [Customer].
///
/// Os casts são estritos: campo ausente ou de outro tipo lança
/// `FormatException` com o nome do campo, e o `runRequest` converte em falha
/// inesperada. `name`, `email`, `userId`, `isActive` e as datas são
/// ignorados; `complement` e `location` podem ser `null`, mas não ausentes.
Customer parseCustomer(Object? data) {
  final json = _map(data, 'cadastro');
  final address = _map(json['address'], 'address');
  final location = _nullable<Object>(address, 'location');
  return Customer(
    id: _required<String>(json, 'id'),
    cpf: _required<String>(json, 'cpf'),
    phone: _required<String>(json, 'phone'),
    address: CustomerAddress(
      zipCode: _required<String>(address, 'zipCode'),
      street: _required<String>(address, 'street'),
      number: _required<String>(address, 'number'),
      complement: _nullable<String>(address, 'complement'),
      neighborhood: _required<String>(address, 'neighborhood'),
      city: _required<String>(address, 'city'),
      state: _required<String>(address, 'state'),
      location: location == null ? null : _location(location),
    ),
  );
}

/// Corpo de `PUT /me/customer`. A chave `address.location` vai **sempre**: o
/// ponto do rascunho (o do cadastro carregado) ou `null`. Ausente, a API
/// manteria o ponto atual; o app nunca omite nem calcula o ponto.
Map<String, Object?> encodeCustomerDraft(CustomerDraft draft) {
  final location = draft.location;
  return {
    'cpf': draft.cpf,
    'phone': draft.phone,
    'address': {
      'zipCode': draft.zipCode,
      'street': draft.street,
      'number': draft.number,
      'complement': draft.complement,
      'neighborhood': draft.neighborhood,
      'city': draft.city,
      'state': draft.state,
      'location': location == null
          ? null
          : {'latitude': location.latitude, 'longitude': location.longitude},
    },
  };
}

CustomerLocation _location(Object data) {
  final json = _map(data, 'location');
  return CustomerLocation(
    latitude: _required<num>(json, 'latitude').toDouble(),
    longitude: _required<num>(json, 'longitude').toDouble(),
  );
}

Map<String, Object?> _map(Object? data, String field) {
  if (data is Map<String, Object?>) return data;
  throw FormatException('$field fora do formato');
}

T _required<T extends Object>(Map<String, Object?> json, String field) {
  final value = json[field];
  if (value is T) return value;
  throw FormatException('$field ausente ou fora do formato ($value)');
}

T? _nullable<T extends Object>(Map<String, Object?> json, String field) {
  if (!json.containsKey(field)) {
    throw FormatException('$field ausente');
  }
  final value = json[field];
  if (value == null || value is T) return value as T?;
  throw FormatException('$field fora do formato ($value)');
}
