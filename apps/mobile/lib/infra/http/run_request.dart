import 'package:dio/dio.dart';

import '../../core/errors/app_failure.dart';
import '../../core/result.dart';
import 'http_failure_mapper.dart';

/// Fronteira de exceção da infraestrutura: envia a requisição com [send] e
/// converte o corpo com [parse], devolvendo sempre um [Result].
///
/// `DioException` vira a falha de [mapHttpFailure]; qualquer outro erro,
/// inclusive `TypeError`/`FormatException` do [parse], vira falha inesperada.
/// Resposta sem corpo (`204`) entrega `null` ao [parse].
Future<Result<T>> runRequest<T>(
  Future<Response<Object?>> Function() send,
  T Function(Object? data) parse,
) async {
  try {
    final response = await send();
    return Ok(parse(response.data));
  } on DioException catch (exception) {
    return Failure(mapHttpFailure(exception));
  } catch (_) {
    return const Failure(
      UnexpectedFailure(
        message: unexpectedFailureMessage,
        code: HttpFailureCode.unexpected,
      ),
    );
  }
}
