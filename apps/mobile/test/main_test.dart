import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('o app sobe com um MaterialApp', (tester) async {
    await tester.pumpWidget(const JajaApp());

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
