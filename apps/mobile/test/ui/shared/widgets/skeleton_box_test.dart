import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';

import '../support/themed.dart';

void main() {
  testWidgets('bloco na cor #F6F1EA', (tester) async {
    await tester.pumpWidget(
      themed(const Center(child: SkeletonBox(width: 120, height: 16))),
    );

    final decoration =
        tester
                .widget<DecoratedBox>(
                  find.descendant(
                    of: find.byType(SkeletonBox),
                    matching: find.byType(DecoratedBox),
                  ),
                )
                .decoration
            as BoxDecoration;
    expect(decoration.color!.toARGB32(), 0xFFF6F1EA);
  });

  testWidgets('fica estático: nenhuma animação depois de 2 s', (tester) async {
    await tester.pumpWidget(
      themed(const Center(child: SkeletonBox(width: 120, height: 16))),
    );

    await tester.pump(const Duration(seconds: 2));
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('é anunciado como "Carregando"', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      themed(const Center(child: SkeletonBox(width: 120, height: 16))),
    );

    expect(find.bySemanticsLabel('Carregando'), findsOneWidget);
    handle.dispose();
  });
}
