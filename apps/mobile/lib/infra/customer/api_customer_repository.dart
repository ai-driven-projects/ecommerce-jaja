import 'package:dio/dio.dart';

import '../../core/errors/app_failure.dart';
import '../../core/result.dart';
import '../../modules/customer/model/customer_entity.dart';
import '../../modules/customer/model/customer_rules.dart';
import '../../modules/customer/provider/customer_repository.dart';
import '../api/customer_dto.dart';
import '../http/run_request.dart';

/// [CustomerRepository] sobre `MyCustomerController` (`/me/customer`), no
/// papel de `apps/frontend/src/modules/customers/data/customer.api.ts`. O
/// token vai pelo `AuthInterceptor`. As recusas passam como vieram, com os
/// `codes`: quem as leva aos campos é a tela.
final class ApiCustomerRepository implements CustomerRepository {
  ApiCustomerRepository(this._dio);

  final Dio _dio;

  static const _path = '/me/customer';

  /// `GET /me/customer`. O `404` vira `Ok(null)`: nesse caminho ele só vem de
  /// `CUSTOMER_NOT_FOUND`/`CUSTOMER_USER_NOT_FOUND`, e o `mapHttpFailure`
  /// descarta os códigos do `404`.
  @override
  Future<Result<Customer?>> fetchMine() async {
    return switch (await runRequest(
      () => _dio.get<Object?>(_path),
      parseCustomer,
    )) {
      Ok(:final value) => Ok(value),
      Failure(failure: NotFoundFailure()) => const Ok(null),
      Failure(:final failure) => Failure(failure),
    };
  }

  /// `PUT /me/customer` com o corpo de [encodeCustomerDraft], que sempre leva
  /// `address.location`.
  @override
  Future<Result<Customer>> saveMine(CustomerDraft draft) => runRequest(
    () => _dio.put<Object?>(_path, data: encodeCustomerDraft(draft)),
    parseCustomer,
  );
}
