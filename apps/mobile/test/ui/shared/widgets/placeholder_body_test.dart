import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/placeholder_body.dart';

import '../support/themed.dart';

void main() {
  testWidgets('mostra o nome da aba e o aviso de que a tela ainda vem', (
    tester,
  ) async {
    await tester.pumpWidget(themed(const PlaceholderBody(title: 'Carrinho')));

    expect(find.text('Carrinho'), findsOneWidget);
    expect(find.text('Em breve por aqui.'), findsOneWidget);
  });
}
