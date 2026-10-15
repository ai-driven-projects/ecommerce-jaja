import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/app/bootstrap.dart';
import 'package:mobile/core/env/app_environment.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/modules/catalog/provider/catalog_repository.dart';
import 'package:mobile/modules/store/provider/store_repository.dart';
import 'package:mobile/ui/modules/catalog/pages/home_page.dart';
import 'package:mobile/ui/modules/store/widgets/store_selector.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../infra/http/support/fake_http_client_adapter.dart';

const _emptyProductPage = <String, Object?>{
  'items': <Object?>[],
  'total': 0,
  'page': 1,
  'pageSize': 12,
  'totalPages': 0,
  'brandFacets': <Object?>[],
};

void main() {
  tearDown(resetDependencies);

  testWidgets('com o endereço resolvido, registra as dependências e abre o app '
      'sem rede nem disco reais', (tester) async {
    SharedPreferences.setMockInitialValues({});
    // Sem sessão guardada: o `restore` termina sem pedir `/auth/me`.
    FlutterSecureStorage.setMockInitialValues({});

    final root = createRootWidget(Ok(Uri.parse('http://localhost:4000')));

    expect(root, isA<JajaApp>());
    expect(getIt.isRegistered<Dio>(), isTrue);
    expect(getIt.isRegistered<StoreRepository>(), isTrue);
    expect(getIt.isRegistered<CatalogRepository>(), isTrue);
    expect(getIt<Dio>().options.baseUrl, 'http://localhost:4000');

    // Antes do `pump`: a aba Início pede as lojas, as categorias e as duas
    // páginas de produtos ao montar. As respostas saem na ordem em que a
    // página dispara as buscas (lojas, categorias, destaques, ofertas).
    final adapter = FakeHttpClientAdapter()
      ..enqueueResponse(body: [])
      ..enqueueResponse(body: [])
      ..enqueueResponse(body: _emptyProductPage)
      ..enqueueResponse(body: _emptyProductPage);
    getIt<Dio>().httpClientAdapter = adapter;

    await tester.pumpWidget(root);
    await tester.pumpAndSettle();

    expect(find.byType(HomePage), findsOneWidget);
    // A ordem das cargas paralelas não é garantida: só o conjunto conta.
    expect(adapter.requests.map((request) => request.path).toList()..sort(), [
      '/storefront/categories',
      '/storefront/products',
      '/storefront/products',
      '/storefront/stores',
    ]);
    expect(find.text(StoreSelector.emptyTitle), findsOneWidget);
    // Abaixo da dobra do viewport de teste, por isso `skipOffstage: false`.
    expect(find.text(HomePage.emptyTitle, skipOffstage: false), findsOneWidget);
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
    expect(getIt.isRegistered<StoreRepository>(), isFalse);
    expect(getIt.isRegistered<CatalogRepository>(), isFalse);
  });
}
