import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';

void main() {
  testWidgets('o app sobe com um MaterialApp', (tester) async {
    await tester.pumpWidget(const JajaApp());

    expect(find.byType(MaterialApp), findsOneWidget);
  });

  testWidgets('o app usa o tema da marca, com os BrandTokens', (tester) async {
    await tester.pumpWidget(const JajaApp());

    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).extension<BrandTokens>(), isNotNull);
  });
}
