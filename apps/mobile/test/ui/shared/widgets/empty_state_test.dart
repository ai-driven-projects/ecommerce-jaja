import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/empty_state.dart';

import '../support/themed.dart';

void main() {
  testWidgets('emoji, título, explicação e um único botão que age', (
    tester,
  ) async {
    var actions = 0;
    await tester.pumpWidget(
      themed(
        EmptyState(
          title: 'Nada por aqui. Já já.',
          message: 'Seus pedidos aparecem aqui depois da primeira compra.',
          actionLabel: 'Ver catálogo',
          onAction: () => actions++,
        ),
      ),
    );

    expect(find.text('📦'), findsOneWidget);
    expect(find.text('Nada por aqui. Já já.'), findsOneWidget);
    expect(
      find.text('Seus pedidos aparecem aqui depois da primeira compra.'),
      findsOneWidget,
    );
    expect(find.byType(AppButton), findsOneWidget);
    expect(find.text('Ver catálogo'), findsOneWidget);

    await tester.tap(find.text('Ver catálogo'));
    expect(actions, 1);
  });
}
