import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/pages/not_found_page.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';

void main() {
  testWidgets('avisa que a página não existe e volta ao início uma vez', (
    tester,
  ) async {
    var backHome = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: NotFoundPage(onBackHome: () => backHome++),
      ),
    );

    expect(find.text('🧭'), findsOneWidget);
    expect(find.text('Página não encontrada'), findsOneWidget);
    expect(find.text('Esse endereço não existe no app.'), findsOneWidget);
    expect(find.byType(AppButton), findsOneWidget);

    await tester.tap(find.text('Voltar ao início'));
    expect(backHome, 1);
  });
}
