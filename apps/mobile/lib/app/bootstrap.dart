import 'dart:async';

import 'package:flutter/widgets.dart';

import '../core/env/app_environment.dart';
import '../core/result.dart';
import '../infra/auth/session_repository.dart';
import '../infra/cart/guest_cart_repository.dart';
import '../infra/di/service_locator.dart';
import 'app.dart';
import 'configuration_error_app.dart';

void bootstrap(AppEnvironment environment) {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(createRootWidget(resolveApiBaseUrl(environment)));
}

/// Com o endereço resolvido, prepara as dependências e abre o app; sem ele,
/// abre a tela de erro de configuração sem registrar nada. A sessão guardada é
/// restaurada sem esperar: o app abre no splash e segue quando ela é conhecida.
/// O carrinho guardado também, logo depois.
Widget createRootWidget(Result<Uri> apiBaseUrl) {
  switch (apiBaseUrl) {
    case Ok(:final value):
      configureDependencies(apiBaseUrl: value);
      unawaited(getIt<SessionRepository>().restore());
      unawaited(getIt<GuestCartRepository>().restore());
      return const JajaApp();
    case Failure(:final failure):
      return ConfigurationErrorApp(failure: failure);
  }
}
