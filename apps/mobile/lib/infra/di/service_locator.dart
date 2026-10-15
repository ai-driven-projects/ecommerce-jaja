import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';

import '../http/api_client.dart';

/// Localizador único do app. Só `lib/infra/di` e `lib/app` o importam (regra D
/// da barreira); o resto recebe dependências pelo construtor.
final getIt = GetIt.instance;

/// Registra as dependências do app; o bootstrap chama uma vez só (registro
/// duplicado lança). ViewModels entram com `registerFactory`; estado global
/// (sessão, carrinho) como singleton em `infra/`.
void configureDependencies({required Uri apiBaseUrl}) {
  getIt.registerLazySingleton<Dio>(() => createApiClient(apiBaseUrl));
}

/// Limpa todos os registros; usado no `tearDown` dos testes.
Future<void> resetDependencies() => getIt.reset();
