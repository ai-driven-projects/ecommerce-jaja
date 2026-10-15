import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/store/model/store_entity.dart';
import 'package:mobile/ui/modules/catalog/pages/home_page.dart';
import 'package:mobile/ui/modules/store/view_models/store_selector_view_model.dart';
import 'package:mobile/ui/modules/store/widgets/store_pill.dart';
import 'package:mobile/ui/modules/store/widgets/store_selector.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';

import '../../../../modules/store/support/fake_store_repository.dart';
import '../../../../modules/store/support/store_fixtures.dart';

const _networkFailure = NetworkFailure(
  message: 'Não foi possível falar com o servidor. Tente novamente.',
  code: HttpFailureCode.noConnection,
);

const _sheetTitle = 'Comprar na loja';

/// Monta a página como a rota faz: a fábrica cria o ViewModel de verdade
/// sobre o repositório fake. A página já traz o próprio `Scaffold`.
Future<FakeStoreRepository> _pumpHome(
  WidgetTester tester, {
  List<Store> stores = const [paulista, rioBranco],
  String? rememberedSlug,
  void Function(FakeStoreRepository repository)? prepare,
}) async {
  final repository = FakeStoreRepository(
    stores: stores,
    rememberedSlug: rememberedSlug,
  );
  prepare?.call(repository);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: HomePage(
        storeSelectorViewModelFactory: () => StoreSelectorViewModel(repository),
      ),
    ),
  );
  return repository;
}

void main() {
  group('estados do seletor', () {
    testWidgets('mostra o skeleton enquanto a API não responde e a pílula '
        'depois', (tester) async {
      late Completer<Result<List<Store>>> gate;
      await _pumpHome(
        tester,
        prepare: (repository) => gate = repository.hold(),
      );
      await tester.pump();

      expect(find.byType(SkeletonBox), findsOneWidget);
      expect(find.byType(StorePill), findsNothing);
      expect(find.text('Loja Paulista'), findsNothing);
      expect(find.text('Início'), findsOneWidget);

      gate.complete(const Ok([paulista, rioBranco]));
      await tester.pumpAndSettle();

      expect(find.byType(SkeletonBox), findsNothing);
      expect(find.byType(StorePill), findsOneWidget);
      expect(find.text('Loja Paulista'), findsOneWidget);
      expect(find.text('São Paulo/SP'), findsOneWidget);
    });

    testWidgets('em falha de rede mostra o banner e "Tentar de novo" leva à '
        'pílula', (tester) async {
      final repository = await _pumpHome(
        tester,
        prepare: (repository) => repository.enqueue(Failure(_networkFailure)),
      );
      await tester.pumpAndSettle();

      expect(find.text(StoreSelector.errorTitle), findsOneWidget);
      expect(find.text(_networkFailure.message), findsOneWidget);
      expect(find.byType(StorePill), findsNothing);

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(repository.fetchCalls, [false, true]);
      expect(find.text(StoreSelector.errorTitle), findsNothing);
      expect(find.byType(StorePill), findsOneWidget);
      expect(find.text('Loja Paulista'), findsOneWidget);
    });

    testWidgets('sem loja ativa mostra o vazio e "Atualizar" busca de novo sem '
        'reaproveitar', (tester) async {
      final repository = await _pumpHome(tester, stores: const []);
      await tester.pumpAndSettle();

      expect(find.text(StoreSelector.emptyTitle), findsOneWidget);
      expect(find.text(StoreSelector.emptyMessage), findsOneWidget);
      expect(find.byType(StorePill), findsNothing);

      await tester.tap(find.text(StoreSelector.emptyAction));
      await tester.pumpAndSettle();

      expect(repository.fetchCalls, [false, true]);
      expect(find.text(StoreSelector.emptyTitle), findsOneWidget);
    });
  });

  group('troca de loja', () {
    testWidgets('tocar na pílula e escolher Rio Branco fecha o painel, troca a '
        'pílula e lembra o slug', (tester) async {
      final repository = await _pumpHome(tester);
      await tester.pumpAndSettle();
      expect(find.text('Loja Paulista'), findsOneWidget);

      await tester.tap(find.byType(StorePill));
      await tester.pumpAndSettle();

      expect(find.text(_sheetTitle), findsOneWidget);
      expect(
        find.ancestor(
          of: find.byIcon(Icons.check),
          matching: find.widgetWithText(ListTile, 'Loja Paulista'),
        ),
        findsOneWidget,
      );

      await tester.tap(find.widgetWithText(ListTile, 'Loja Rio Branco'));
      await tester.pumpAndSettle();

      expect(find.text(_sheetTitle), findsNothing);
      expect(find.byType(StorePill), findsOneWidget);
      expect(find.text('Loja Rio Branco'), findsOneWidget);
      expect(find.text('Rio de Janeiro/RJ'), findsOneWidget);
      expect(find.text('Loja Paulista'), findsNothing);
      expect(repository.rememberCalls, ['loja-rio-branco']);
      expect(repository.rememberedSlug, 'loja-rio-branco');
      // A troca não vai à API: nenhuma requisição além da carga inicial.
      expect(repository.fetchCalls, [false]);
    });

    testWidgets('com uma loja só, tocar na pílula não abre o painel', (
      tester,
    ) async {
      final repository = await _pumpHome(tester, stores: const [paulista]);
      await tester.pumpAndSettle();

      expect(find.text('Loja Paulista'), findsOneWidget);
      expect(find.byIcon(Icons.expand_more), findsNothing);

      await tester.tap(find.byType(StorePill));
      await tester.pumpAndSettle();

      expect(find.text(_sheetTitle), findsNothing);
      expect(find.byType(ListTile), findsNothing);
      expect(repository.rememberCalls, isEmpty);
    });

    testWidgets('com a lembrança loja-rio-branco abre já em Rio Branco', (
      tester,
    ) async {
      final repository = await _pumpHome(
        tester,
        rememberedSlug: 'loja-rio-branco',
      );
      await tester.pumpAndSettle();

      expect(find.text('Loja Rio Branco'), findsOneWidget);
      expect(find.text('Rio de Janeiro/RJ'), findsOneWidget);
      expect(find.text('Loja Paulista'), findsNothing);
      // Abrir com a lembrança não grava nada de novo.
      expect(repository.rememberCalls, isEmpty);
    });
  });
}
