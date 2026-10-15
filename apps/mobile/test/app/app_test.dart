import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/ui/modules/catalog/pages/home_page.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';

import 'support/fake_dependencies.dart';

void main() {
  setUp(registerFakeDependencies);
  tearDown(resetDependencies);

  testWidgets('o app usa o tema da marca e se chama Jajá', (tester) async {
    await tester.pumpWidget(const JajaApp());
    await tester.pumpAndSettle();

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.title, 'Jajá');
    expect(app.theme?.extension<BrandTokens>(), isNotNull);

    final context = tester.element(find.byType(HomePage));
    expect(Theme.of(context).extension<BrandTokens>(), isNotNull);
  });

  testWidgets('o app abre na aba Início', (tester) async {
    await tester.pumpWidget(const JajaApp());
    await tester.pumpAndSettle();

    expect(find.byType(HomePage), findsOneWidget);
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.selectedIndex, 0);
  });
}
