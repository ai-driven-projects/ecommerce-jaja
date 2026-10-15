import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/store/model/store_entity.dart';
import 'package:mobile/ui/modules/store/widgets/store_picker_sheet.dart';

import '../../../../modules/store/support/store_fixtures.dart';
import '../../../shared/support/themed.dart';

const _openLabel = 'Abrir';

/// Botão que abre o painel e guarda o slug devolvido em [result].
Widget _opener({
  required List<Store> stores,
  required String currentSlug,
  required void Function(String?) onResult,
}) => themed(
  Center(
    child: Builder(
      builder: (context) => TextButton(
        onPressed: () async {
          final slug = await showStorePickerSheet(
            context,
            stores: stores,
            currentSlug: currentSlug,
          );
          onResult(slug);
        },
        child: const Text(_openLabel),
      ),
    ),
  ),
);

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text(_openLabel));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('mostra "Comprar na loja" e as lojas na ordem recebida', (
    tester,
  ) async {
    await tester.pumpWidget(
      _opener(
        stores: const [rioBranco, paulista],
        currentSlug: 'loja-paulista',
        onResult: (_) {},
      ),
    );
    await _open(tester);

    expect(find.text('Comprar na loja'), findsOneWidget);
    expect(find.text('Loja Rio Branco'), findsOneWidget);
    expect(find.text('Rio de Janeiro/RJ'), findsOneWidget);
    expect(find.text('Loja Paulista'), findsOneWidget);
    expect(find.text('São Paulo/SP'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Loja Rio Branco')).dy,
      lessThan(tester.getTopLeft(find.text('Loja Paulista')).dy),
    );
  });

  testWidgets('só a loja atual leva o cheque e fica em laranja', (
    tester,
  ) async {
    await tester.pumpWidget(
      _opener(
        stores: const [paulista, rioBranco],
        currentSlug: 'loja-paulista',
        onResult: (_) {},
      ),
    );
    await _open(tester);

    expect(find.byIcon(Icons.check), findsOneWidget);
    expect(
      find.ancestor(
        of: find.byIcon(Icons.check),
        matching: find.widgetWithText(ListTile, 'Loja Paulista'),
      ),
      findsOneWidget,
    );
    expect(
      tester.widget<Text>(find.text('Loja Paulista')).style!.color!.toARGB32(),
      0xFFFF6B00,
    );
    expect(
      tester
          .widget<Text>(find.text('Loja Rio Branco'))
          .style!
          .color!
          .toARGB32(),
      0xFF1E1812,
    );
  });

  testWidgets('tocar numa loja fecha o painel e devolve o slug dela', (
    tester,
  ) async {
    String? result;
    var results = 0;
    await tester.pumpWidget(
      _opener(
        stores: const [paulista, rioBranco],
        currentSlug: 'loja-paulista',
        onResult: (slug) {
          result = slug;
          results++;
        },
      ),
    );
    await _open(tester);

    await tester.tap(find.text('Loja Rio Branco'));
    await tester.pumpAndSettle();

    expect(results, 1);
    expect(result, 'loja-rio-branco');
    expect(find.text('Comprar na loja'), findsNothing);
  });

  testWidgets('tocar na loja atual devolve o slug atual', (tester) async {
    String? result;
    await tester.pumpWidget(
      _opener(
        stores: const [paulista, rioBranco],
        currentSlug: 'loja-paulista',
        onResult: (slug) => result = slug,
      ),
    );
    await _open(tester);

    await tester.tap(find.text('Loja Paulista'));
    await tester.pumpAndSettle();

    expect(result, 'loja-paulista');
    expect(find.text('Comprar na loja'), findsNothing);
  });

  testWidgets('fechar sem escolher devolve null', (tester) async {
    String? result = 'nunca';
    await tester.pumpWidget(
      _opener(
        stores: const [paulista, rioBranco],
        currentSlug: 'loja-paulista',
        onResult: (slug) => result = slug,
      ),
    );
    await _open(tester);

    // Toque fora do painel (no topo da tela, sobre a barreira).
    await tester.tapAt(const Offset(20, 20));
    await tester.pumpAndSettle();

    expect(result, isNull);
    expect(find.text('Comprar na loja'), findsNothing);
  });
}
