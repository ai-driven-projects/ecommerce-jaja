import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/catalog/model/product_page_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';
import 'package:mobile/ui/modules/catalog/view_models/search_view_model.dart';
import 'package:mobile/ui/modules/catalog/widgets/choice_row.dart';
import 'package:mobile/ui/modules/catalog/widgets/filters_sheet.dart';
import 'package:mobile/ui/shared/widgets/app_text_field.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';
import '../../../shared/support/themed.dart';

const _openLabel = 'Abrir';

const _networkFailure = NetworkFailure(
  message: 'Não foi possível falar com o servidor. Tente novamente.',
  code: HttpFailureCode.noConnection,
);

// Viewport alto: o painel (90% da tela) mostra todos os grupos sem rolar.
const _surface = Size(800, 2400);

/// Abre o painel sobre um [SearchViewModel] de verdade, já iniciado com
/// [query] sobre o repositório fake.
Future<FakeCatalogRepository> _openSheet(
  WidgetTester tester, {
  ProductQuery query = const ProductQuery(),
  void Function(FakeCatalogRepository repository)? prepare,
}) async {
  tester.view.physicalSize = _surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final repository = FakeCatalogRepository();
  prepare?.call(repository);
  final viewModel = SearchViewModel(repository);
  addTearDown(viewModel.dispose);
  await viewModel.start(query);

  await tester.pumpWidget(
    themed(
      Center(
        child: Builder(
          builder: (context) => TextButton(
            onPressed: () => showFiltersSheet(context, viewModel),
            child: const Text(_openLabel),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text(_openLabel));
  await tester.pumpAndSettle();
  return repository;
}

Map<String, String> _lastParams(FakeCatalogRepository repository) =>
    encodeProductQuery(repository.productQueries.last);

Finder _priceField(String label) => find.descendant(
  of: find.widgetWithText(AppTextField, label),
  matching: find.byType(TextField),
);

double _top(WidgetTester tester, String text) =>
    tester.getTopLeft(find.text(text)).dy;

void main() {
  group('grupos', () {
    testWidgets('cabeçalho e os quatro grupos na ordem da spec', (
      tester,
    ) async {
      await _openSheet(tester);

      expect(find.text('Filtros'), findsOneWidget);
      expect(find.byTooltip('Fechar'), findsOneWidget);
      final tops = [
        for (final title in [
          'Categoria',
          'Marca',
          'Preço',
          'Ofertas e destaques',
        ])
          _top(tester, title),
      ];
      expect(tops, orderedEquals([...tops]..sort()));
      expect(tops.toSet(), hasLength(4));
      expect(find.text('Só ofertas'), findsOneWidget);
      expect(find.text('Só destaques'), findsOneWidget);
    });

    testWidgets('categoria: "Todas as categorias" e a árvore em pré-ordem, '
        'recuada e com a contagem', (tester) async {
      await _openSheet(tester);

      expect(
        [
          for (final row in tester.widgetList<ChoiceRow>(
            find.byType(ChoiceRow),
          ))
            row.label,
        ],
        [
          'Todas as categorias',
          'Artes & Pintura',
          'Adesivos Stickers',
          'Pincéis e Trinchas',
          'Cartuchos & Toners',
          'Toners HP',
          'Escolar',
        ],
      );
      expect(
        tester
            .widget<ChoiceRow>(
              find.widgetWithText(ChoiceRow, 'Todas as categorias'),
            )
            .selected,
        isTrue,
      );
      expect(
        tester.getTopLeft(find.text('Toners HP')).dx,
        greaterThan(tester.getTopLeft(find.text('Cartuchos & Toners')).dx),
      );
      expect(find.text('12 produtos'), findsNWidgets(2));
    });

    testWidgets('escolher "Toners HP" pede category=toners-hp e a marca', (
      tester,
    ) async {
      final repository = await _openSheet(tester);

      await tester.tap(find.text('Toners HP'));
      await tester.pumpAndSettle();

      expect(_lastParams(repository), {
        'page': '1',
        'pageSize': '24',
        'category': 'toners-hp',
      });
      expect(
        tester
            .widget<ChoiceRow>(find.widgetWithText(ChoiceRow, 'Toners HP'))
            .selected,
        isTrue,
      );
      expect(
        tester
            .widget<ChoiceRow>(
              find.widgetWithText(ChoiceRow, 'Todas as categorias'),
            )
            .selected,
        isFalse,
      );
      expect(find.text('Filtros'), findsOneWidget);
    });

    testWidgets('marcar uma marca pede brand', (tester) async {
      final repository = await _openSheet(
        tester,
        query: const ProductQuery(search: 'toner'),
        prepare: (repository) => repository.enqueueProducts(
          Ok(pageOf(products, total: 12, brandFacets: const [hpFacet])),
        ),
      );

      expect(find.text('HP'), findsOneWidget);
      expect(find.text('12'), findsOneWidget);

      await tester.tap(find.text('HP'));
      await tester.pumpAndSettle();

      expect(_lastParams(repository), {
        'page': '1',
        'pageSize': '24',
        'search': 'toner',
        'brand': 'hp',
      });
    });

    testWidgets('sem marcas no resultado mostra o aviso', (tester) async {
      await _openSheet(tester);

      expect(find.text('Nenhuma marca neste resultado.'), findsOneWidget);
    });

    testWidgets('mais de oito marcas: "Ver todas (N)" e "Ver menos"', (
      tester,
    ) async {
      final facets = [
        for (var i = 1; i <= 9; i++)
          BrandFacet(slug: 'marca-$i', name: 'Marca $i', count: i),
      ];
      await _openSheet(
        tester,
        prepare: (repository) => repository.enqueueProducts(
          Ok(pageOf(products, brandFacets: facets)),
        ),
      );

      expect(find.text('Marca 8'), findsOneWidget);
      expect(find.text('Marca 9'), findsNothing);

      await tester.tap(find.text('Ver todas (9)'));
      await tester.pumpAndSettle();

      expect(find.text('Marca 9'), findsOneWidget);
      expect(find.text('Ver todas (9)'), findsNothing);

      await tester.tap(find.text('Ver menos'));
      await tester.pumpAndSettle();

      expect(find.text('Marca 9'), findsNothing);
    });

    testWidgets('marca escolhida fora das facetas aparece marcada no topo', (
      tester,
    ) async {
      await _openSheet(
        tester,
        query: const ProductQuery(brandSlugs: ['bic']),
        prepare: (repository) => repository.enqueueProducts(
          Ok(pageOf(products, brandFacets: const [hpFacet])),
        ),
      );

      expect(_top(tester, 'bic'), lessThan(_top(tester, 'HP')));
      expect(
        tester
            .widget<CheckboxListTile>(
              find.widgetWithText(CheckboxListTile, 'bic'),
            )
            .value,
        isTrue,
      );
      expect(
        tester
            .widget<CheckboxListTile>(
              find.widgetWithText(CheckboxListTile, 'HP'),
            )
            .value,
        isFalse,
      );
    });

    testWidgets('"Só ofertas" pede onSale', (tester) async {
      final repository = await _openSheet(tester);

      await tester.tap(find.text('Só ofertas'));
      await tester.pumpAndSettle();

      expect(_lastParams(repository)['onSale'], 'true');
      expect(
        tester
            .widget<CheckboxListTile>(
              find.widgetWithText(CheckboxListTile, 'Só ofertas'),
            )
            .value,
        isTrue,
      );
    });
  });

  group('preço e rodapé', () {
    testWidgets('máximo 300 e "Aplicar" pedem maxPriceCents=30000', (
      tester,
    ) async {
      final repository = await _openSheet(tester);

      await tester.enterText(_priceField('Máximo (R\$)'), '300');
      await tester.tap(find.text('Aplicar'));
      await tester.pumpAndSettle();

      expect(_lastParams(repository), {
        'page': '1',
        'pageSize': '24',
        'maxPriceCents': '30000',
      });
      expect(find.text('Use valores em reais, como 12,90.'), findsNothing);
    });

    testWidgets('os campos mostram o preço em vigor', (tester) async {
      await _openSheet(
        tester,
        query: const ProductQuery(minPriceCents: 1290, maxPriceCents: 30000),
      );

      String textOf(String label) =>
          tester.widget<TextField>(_priceField(label)).controller!.text;
      expect(textOf('Mínimo (R\$)'), '12,90');
      expect(textOf('Máximo (R\$)'), '300');
    });

    testWidgets('mínimo 12,999 mostra o aviso e não pede nada', (tester) async {
      final repository = await _openSheet(tester);
      final requests = repository.productQueries.length;

      await tester.enterText(_priceField('Mínimo (R\$)'), '12,999');
      await tester.tap(find.text('Aplicar'));
      await tester.pumpAndSettle();

      expect(find.text('Use valores em reais, como 12,90.'), findsOneWidget);
      expect(repository.productQueries, hasLength(requests));
    });

    testWidgets('rodapé "Ver 12 produtos" fecha o painel', (tester) async {
      await _openSheet(
        tester,
        prepare: (repository) =>
            repository.enqueueProducts(Ok(pageOf(products, total: 12))),
      );

      expect(find.text('Limpar filtros'), findsNothing);

      await tester.tap(find.text('Ver 12 produtos'));
      await tester.pumpAndSettle();

      expect(find.text('Filtros'), findsNothing);
    });

    testWidgets('"Ver produtos" enquanto carrega; "Limpar filtros" com '
        'filtro', (tester) async {
      final repository = await _openSheet(
        tester,
        query: const ProductQuery(onSale: true, search: 'caneta'),
      );
      final gate = repository.holdProducts();

      expect(find.text('Limpar filtros'), findsOneWidget);
      await tester.tap(find.text('Limpar filtros'));
      await tester.pump();

      expect(find.text('Ver produtos'), findsOneWidget);
      expect(_lastParams(repository), {
        'page': '1',
        'pageSize': '24',
        'search': 'caneta',
      });

      gate.complete(Ok(pageOf(products)));
      await tester.pumpAndSettle();

      expect(find.text('Ver 3 produtos'), findsOneWidget);
      expect(find.text('Limpar filtros'), findsNothing);
    });

    testWidgets('falha das categorias mostra o banner só no grupo Categoria', (
      tester,
    ) async {
      final repository = await _openSheet(
        tester,
        prepare: (repository) =>
            repository.enqueueCategories(const Failure(_networkFailure)),
      );

      const bannerTitle = 'Não foi possível carregar as categorias.';
      expect(find.text(bannerTitle), findsOneWidget);
      expect(find.text('Tentar de novo'), findsOneWidget);
      expect(find.text('Todas as categorias'), findsNothing);
      expect(_top(tester, bannerTitle), greaterThan(_top(tester, 'Categoria')));
      expect(_top(tester, bannerTitle), lessThan(_top(tester, 'Marca')));
      expect(find.text('Aplicar'), findsOneWidget);
      expect(find.text('Só ofertas'), findsOneWidget);

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(repository.categoryCalls, [false, false]);
      expect(find.text(bannerTitle), findsNothing);
      expect(find.text('Toners HP'), findsOneWidget);
    });
  });
}
