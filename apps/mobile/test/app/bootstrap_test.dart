import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/app/bootstrap.dart';
import 'package:mobile/core/env/app_environment.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/di/service_locator.dart';

void main() {
  tearDown(resetDependencies);

  testWidgets('com o endereço resolvido, registra o Dio e abre o app', (
    tester,
  ) async {
    final root = createRootWidget(Ok(Uri.parse('http://localhost:4000')));

    expect(root, isA<JajaApp>());
    expect(getIt.isRegistered<Dio>(), isTrue);
    expect(getIt<Dio>().options.baseUrl, 'http://localhost:4000');
  });

  testWidgets('sem endereço em produção, abre a tela de erro de configuração '
      'sem abas nem dependências', (tester) async {
    final root = createRootWidget(
      resolveApiBaseUrl(AppEnvironment.prod, definedApiUrl: ''),
    );

    await tester.pumpWidget(root);
    await tester.pumpAndSettle();

    expect(find.text('Não foi possível iniciar o app.'), findsOneWidget);
    expect(find.text('Endereço da API não configurado.'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(getIt.isRegistered<Dio>(), isFalse);
  });
}
