import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/ui/shared/widgets/state_error_banner.dart';

import '../support/themed.dart';

const _failure = NetworkFailure(
  message: 'Sem conexão com a internet.',
  code: GenericFailureCode.unspecified,
);

void main() {
  testWidgets('mostra o título, a mensagem da falha e "Tentar de novo"', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(StateErrorBanner(failure: _failure, onRetry: () {})),
    );

    expect(find.text('Não foi possível carregar.'), findsOneWidget);
    expect(find.text('Sem conexão com a internet.'), findsOneWidget);
    expect(find.text('Tentar de novo'), findsOneWidget);
  });

  testWidgets('um toque chama onRetry exatamente uma vez', (tester) async {
    var retries = 0;
    await tester.pumpWidget(
      themed(StateErrorBanner(failure: _failure, onRetry: () => retries++)),
    );

    await tester.tap(find.text('Tentar de novo'));
    await tester.pump();
    expect(retries, 1);
  });

  testWidgets('o título pode ser substituído', (tester) async {
    await tester.pumpWidget(
      themed(
        StateErrorBanner(
          failure: _failure,
          onRetry: () {},
          title: 'Não foi possível carregar as ofertas.',
        ),
      ),
    );

    expect(find.text('Não foi possível carregar as ofertas.'), findsOneWidget);
    expect(find.text('Não foi possível carregar.'), findsNothing);
  });
}
