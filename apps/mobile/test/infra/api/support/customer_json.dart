// JSON de `GET /me/customer` (`CustomerDetailDTO` em
// `modules/customers/src/customer/dto/customer.dto.ts`): o cadastro de
// Fortaleza dos fixtures de `test/modules/customer/support/`, com e sem o
// ponto marcado no web. `name`, `email`, `userId`, `isActive` e as datas vêm
// a mais e o app os ignora. As variantes inválidas partem destes mapas.

const fortalezaLocationJson = <String, Object?>{
  'latitude': -3.731862,
  'longitude': -38.526669,
};

const fortalezaAddressJson = <String, Object?>{
  'zipCode': '60150160',
  'street': 'Avenida Santos Dumont',
  'number': '1500',
  'complement': 'Sala 3',
  'neighborhood': 'Aldeota',
  'city': 'Fortaleza',
  'state': 'CE',
  'location': fortalezaLocationJson,
};

const fortalezaCustomerJson = <String, Object?>{
  'id': '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01',
  'userId': '1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a50',
  'cpf': '52998224725',
  'phone': '85999998888',
  'address': fortalezaAddressJson,
  'isActive': true,
  'createdAt': '2026-09-01T12:00:00.000Z',
  'updatedAt': '2026-09-10T08:30:00.000Z',
  'name': 'Maria Souza',
  'email': 'maria@example.com',
};

/// O mesmo cadastro, sem ponto e sem complemento.
final fortalezaCustomerWithoutLocationJson = <String, Object?>{
  ...fortalezaCustomerJson,
  'address': <String, Object?>{
    ...fortalezaAddressJson,
    'complement': null,
    'location': null,
  },
};

/// Resposta do `PUT /me/customer` (`CustomerDTO`, sem `name`/`email`) para o
/// cadastro de Fortaleza com o ponto.
final savedFortalezaCustomerJson = Map<String, Object?>.of(
  fortalezaCustomerJson,
)..removeWhere((key, _) => key == 'name' || key == 'email');

/// Cadastro válido sem o [field] do topo.
Map<String, Object?> customerWithout(String field) =>
    Map.of(fortalezaCustomerJson)..remove(field);

/// Cadastro válido cujo endereço não tem o [field].
Map<String, Object?> customerWithoutAddressField(String field) => {
  ...fortalezaCustomerJson,
  'address': Map.of(fortalezaAddressJson)..remove(field),
};

/// Cadastro válido cujo endereço tem o [field] trocado por [value].
Map<String, Object?> customerWithAddressField(String field, Object? value) => {
  ...fortalezaCustomerJson,
  'address': {...fortalezaAddressJson, field: value},
};

// Recusas de `/me/customer` (`throwFailure` em
// `apps/backend/src/modules/customers/customer-http.ts`): `ApiErrorResponse`
// com os códigos em `message`. `CUSTOMER_*_NOT_FOUND` vem com `404`,
// `CUSTOMER_CPF_ALREADY_EXISTS` com `409` e o resto com `400`.

/// Corpo de uma recusa com o [statusCode] e os [codes].
Map<String, Object?> customerRejectionJson(
  int statusCode,
  List<String> codes,
) => {
  'statusCode': statusCode,
  'error': switch (statusCode) {
    404 => 'Not Found',
    409 => 'Conflict',
    _ => 'Bad Request',
  },
  'message': codes,
};

final cpfAlreadyExistsJson = customerRejectionJson(409, [
  'CUSTOMER_CPF_ALREADY_EXISTS',
]);

final invalidCpfAndPhoneJson = customerRejectionJson(400, [
  'CPF_INVALID_CHECK_DIGIT',
  'PHONE_INVALID_LENGTH',
]);

final customerNotFoundJson = customerRejectionJson(404, ['CUSTOMER_NOT_FOUND']);
