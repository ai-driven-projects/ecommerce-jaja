import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/theme/app_fonts.dart';

void main() {
  final pubspec = File('pubspec.yaml').readAsStringSync();

  final families = RegExp(
    r'^\s*- family:\s*(.+?)\s*$',
    multiLine: true,
  ).allMatches(pubspec).map((m) => m.group(1)!).toSet();

  final assets = RegExp(
    r'^\s*- asset:\s*"?(.+?)"?\s*$',
    multiLine: true,
  ).allMatches(pubspec).map((m) => m.group(1)!).toSet();

  test('cada família de AppFonts está declarada no pubspec.yaml', () {
    for (final family in [AppFonts.sans, AppFonts.display]) {
      expect(
        families,
        contains(family),
        reason: 'A família "$family" não tem `family:` no pubspec.yaml.',
      );
    }
  });

  test('cada asset de fonte citado existe e não está vazio', () {
    expect(assets, isNotEmpty, reason: 'Nenhum asset de fonte declarado.');
    for (final path in assets) {
      final file = File(path);
      expect(file.existsSync(), isTrue, reason: 'Asset ausente: $path');
      expect(file.lengthSync(), greaterThan(0), reason: 'Asset vazio: $path');
    }
  });

  test('as licenças OFL das duas fontes acompanham os arquivos', () {
    for (final path in [
      'assets/fonts/OFL-Manrope.txt',
      'assets/fonts/OFL-BricolageGrotesque.txt',
    ]) {
      final file = File(path);
      expect(file.existsSync(), isTrue, reason: 'Licença ausente: $path');
      expect(file.lengthSync(), greaterThan(0), reason: 'Licença vazia: $path');
    }
  });
}
