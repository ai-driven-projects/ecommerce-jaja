import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/pages/splash_page.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';

void main() {
  testWidgets('mostra a marca e o indicador anunciado como "Carregando"', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      MaterialApp(theme: AppTheme.light(), home: const SplashPage()),
    );

    final brand = AppTheme.light().extension<BrandTokens>()!.brand;
    final title = tester.widget<Text>(find.text('Jajá'));
    expect(title.style?.color, brand);
    final indicator = tester.widget<CircularProgressIndicator>(
      find.byType(CircularProgressIndicator),
    );
    expect(indicator.color, brand);
    expect(find.bySemanticsLabel('Carregando'), findsOneWidget);
    handle.dispose();
  });
}
