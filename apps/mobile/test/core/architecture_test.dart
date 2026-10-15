import 'package:flutter_test/flutter_test.dart';

import 'support/import_rules.dart';

List<ImportViolation> _scan(String filePath, String source, ImportRule rule) =>
    scanSource(filePath: filePath, source: source, rules: {rule});

void main() {
  group('barreira sobre o código real', () {
    test('core e modules só importam Dart puro e as camadas permitidas', () {
      final scanned = [
        ...dartFilesIn('lib/core'),
        ...dartFilesIn('lib/modules'),
      ];
      expect(
        scanned,
        isNotEmpty,
        reason: 'Nenhum arquivo .dart escaneado — a barreira não rodou.',
      );

      final violations = [
        ...scanDirectory('lib/core', rules: {ImportRule.purity}),
        ...scanDirectory('lib/modules', rules: {ImportRule.purity}),
      ];

      expect(
        violations,
        isEmpty,
        reason: 'Imports proibidos em core/modules:\n${violations.join('\n')}',
      );
    });

    test(
      'dio, flutter_secure_storage e shared_preferences só em lib/infra',
      () {
        final scanned = dartFilesIn('lib').where(
          (file) => !file.path.replaceAll(r'\', '/').contains('lib/infra/'),
        );
        expect(
          scanned,
          isNotEmpty,
          reason: 'Nenhum arquivo .dart escaneado — a barreira não rodou.',
        );

        final violations = scanDirectory(
          'lib',
          rules: {ImportRule.infraConfinement},
        );

        expect(
          violations,
          isEmpty,
          reason:
              'Pacotes de infraestrutura fora de lib/infra:\n'
              '${violations.join('\n')}',
        );
      },
    );
  });

  group('Regra A: pureza de core e modules', () {
    for (final uri in [
      'package:flutter/foundation.dart',
      'dart:io',
      'dart:ui',
    ]) {
      test("'$uri' em core é violação", () {
        final violations = _scan(
          'lib/core/fake.dart',
          "import 'dart:async';\nimport '$uri';\n",
          ImportRule.purity,
        );

        expect(violations, hasLength(1));
        expect(violations.single.filePath, 'lib/core/fake.dart');
        expect(violations.single.lineNumber, 2);
        expect(violations.single.directive, "import '$uri';");
      });
    }

    test('relativo de core para ../infra/ é violação', () {
      final violations = _scan(
        'lib/core/value_objects/fake.dart',
        "import '../../infra/http/api_client.dart';\n",
        ImportRule.purity,
      );

      expect(violations, hasLength(1));
    });

    test('relativo de core para ../modules/ é violação', () {
      final violations = _scan(
        'lib/core/fake.dart',
        "import '../modules/cart/model/cart.dart';\n",
        ImportRule.purity,
      );

      expect(violations, hasLength(1));
    });

    test('core para modules por pacote é violação', () {
      final violations = _scan(
        'lib/core/fake.dart',
        "import 'package:mobile/modules/cart/model/cart.dart';\n",
        ImportRule.purity,
      );

      expect(violations, hasLength(1));
    });

    test('relativo dentro de core é aceito', () {
      final violations = _scan(
        'lib/core/command.dart',
        "import 'result.dart';\nimport 'errors/app_failure.dart';\n",
        ImportRule.purity,
      );

      expect(violations, isEmpty);
    });

    test('modules para core por pacote e por relativo é aceito', () {
      final violations = _scan(
        'lib/modules/cart/model/cart.dart',
        "import 'package:mobile/core/result.dart';\n"
            "import '../../../core/value_objects/money.dart';\n"
            "import '../../catalog/model/product.dart';\n"
            "import 'package:meta/meta.dart';\n",
        ImportRule.purity,
      );

      expect(violations, isEmpty);
    });

    test('modules para ui é violação', () {
      final violations = _scan(
        'lib/modules/cart/model/cart.dart',
        "import '../../../ui/shared/theme.dart';\n",
        ImportRule.purity,
      );

      expect(violations, hasLength(1));
    });

    test('export proibido também é pego', () {
      final violations = _scan(
        'lib/core/fake.dart',
        "export 'package:flutter/widgets.dart';\n",
        ImportRule.purity,
      );

      expect(violations, hasLength(1));
      expect(
        violations.single.directive,
        "export 'package:flutter/widgets.dart';",
      );
    });

    test('import comentado ou dentro de string não conta', () {
      final violations = _scan(
        'lib/core/fake.dart',
        "// import 'package:flutter/foundation.dart';\n"
            "/* import 'dart:io'; */\n"
            "const exemplo = \"import 'dart:ui';\";\n"
            "const outro = '''\nimport 'package:dio/dio.dart';\n''';\n",
        ImportRule.purity,
      );

      expect(violations, isEmpty);
    });

    test('Regra A não se aplica fora de core e modules', () {
      final violations = _scan(
        'lib/ui/pages/home_page.dart',
        "import 'package:flutter/material.dart';\n",
        ImportRule.purity,
      );

      expect(violations, isEmpty);
    });
  });

  group('Regra B: infraestrutura confinada', () {
    test('package:dio/dio.dart em lib/ui é violação com arquivo e linha', () {
      final violations = _scan(
        'lib/ui/pages/home_page.dart',
        "import 'package:flutter/material.dart';\n"
            "import 'package:dio/dio.dart';\n",
        ImportRule.infraConfinement,
      );

      expect(violations, hasLength(1));
      expect(
        violations.single.toString(),
        "lib/ui/pages/home_page.dart:2 → import 'package:dio/dio.dart';",
      );
    });

    test('shared_preferences em lib/app é violação', () {
      final violations = _scan(
        'lib/app/app.dart',
        "import 'package:shared_preferences/shared_preferences.dart';\n",
        ImportRule.infraConfinement,
      );

      expect(violations, hasLength(1));
    });

    test('flutter_secure_storage exportado em core é violação', () {
      final violations = _scan(
        'lib/core/fake.dart',
        "export 'package:flutter_secure_storage/flutter_secure_storage.dart';\n",
        ImportRule.infraConfinement,
      );

      expect(violations, hasLength(1));
    });

    test('dio e shared_preferences em lib/infra são aceitos', () {
      final violations = _scan(
        'lib/infra/http/api_client.dart',
        "import 'package:dio/dio.dart';\n"
            "import 'package:shared_preferences/shared_preferences.dart';\n",
        ImportRule.infraConfinement,
      );

      expect(violations, isEmpty);
    });

    test('caminho absoluto em lib/infra também é aceito', () {
      final violations = _scan(
        '/projeto/apps/mobile/lib/infra/storage/local_store.dart',
        "import 'package:shared_preferences/shared_preferences.dart';\n",
        ImportRule.infraConfinement,
      );

      expect(violations, isEmpty);
    });
  });

  test('pasta inexistente lança StateError em vez de passar vazia', () {
    expect(() => dartFilesIn('lib/pasta-inexistente'), throwsStateError);
    expect(() => scanDirectory('lib/pasta-inexistente'), throwsStateError);
  });
}
