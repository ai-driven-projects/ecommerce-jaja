import 'package:flutter/widgets.dart';

import '../core/env/app_environment.dart';
import '../core/result.dart';
import '../infra/di/service_locator.dart';
import 'app.dart';
import 'configuration_error_app.dart';

void bootstrap(AppEnvironment environment) {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(createRootWidget(resolveApiBaseUrl(environment)));
}

/// Com o endereço resolvido, prepara as dependências e abre o app; sem ele,
/// abre a tela de erro de configuração sem registrar nada.
Widget createRootWidget(Result<Uri> apiBaseUrl) {
  switch (apiBaseUrl) {
    case Ok(:final value):
      configureDependencies(apiBaseUrl: value);
      return const JajaApp();
    case Failure(:final failure):
      return ConfigurationErrorApp(failure: failure);
  }
}
