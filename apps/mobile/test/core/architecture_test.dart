import 'package:flutter_test/flutter_test.dart';

import 'support/import_rules.dart';
import 'support/inline_style_rules.dart';

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

    test('get_it só em lib/infra/di e lib/app', () {
      final scanned = dartFilesIn('lib');
      expect(
        scanned,
        isNotEmpty,
        reason: 'Nenhum arquivo .dart escaneado — a barreira não rodou.',
      );

      final violations = scanDirectory(
        'lib',
        rules: {ImportRule.locatorConfinement},
      );

      expect(
        violations,
        isEmpty,
        reason:
            'Localizador de dependências fora de lib/infra/di e lib/app:\n'
            '${violations.join('\n')}',
      );
    });

    test('pages e widgets de lib/ui tiram cor, tipografia e raio do tema', () {
      final scanned = dartFilesIn(
        'lib/ui',
      ).where((file) => isInlineStyleScoped(file.path));
      expect(
        scanned,
        isNotEmpty,
        reason: 'Nenhum arquivo .dart escaneado — a barreira não rodou.',
      );

      final violations = scanDirectoryForInlineStyle('lib/ui');

      expect(
        violations,
        isEmpty,
        reason:
            'Estilo literal em pages/widgets (deveria vir do tema):\n'
            '${violations.join('\n')}',
      );
    });
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

  group('Regra D: localizador de dependências confinado', () {
    const getItImport = "import 'package:get_it/get_it.dart';";

    test('get_it numa página é violação com arquivo e linha', () {
      final violations = _scan(
        'lib/ui/modules/catalog/pages/x.dart',
        "import 'package:flutter/material.dart';\n$getItImport\n",
        ImportRule.locatorConfinement,
      );

      expect(violations, hasLength(1));
      expect(
        violations.single.toString(),
        'lib/ui/modules/catalog/pages/x.dart:2 → $getItImport',
      );
    });

    for (final filePath in [
      'lib/modules/cart/x.dart',
      'lib/infra/http/x.dart',
    ]) {
      test('get_it em $filePath é violação', () {
        final violations = _scan(
          filePath,
          '$getItImport\n',
          ImportRule.locatorConfinement,
        );

        expect(violations, hasLength(1));
        expect(violations.single.rule, ImportRule.locatorConfinement);
      });
    }

    for (final filePath in [
      'lib/infra/di/x.dart',
      'lib/app/router/x.dart',
      '/projeto/apps/mobile/lib/infra/di/x.dart',
    ]) {
      test('get_it em $filePath é aceito', () {
        final violations = _scan(
          filePath,
          '$getItImport\n',
          ImportRule.locatorConfinement,
        );

        expect(violations, isEmpty);
      });
    }

    test('a regra D está no conjunto padrão', () {
      final violations = scanSource(
        filePath: 'lib/infra/http/x.dart',
        source: '$getItImport\n',
      );

      expect(violations.map((v) => v.rule), [ImportRule.locatorConfinement]);
    });
  });

  group('Regra C: estilo vindo do tema', () {
    const widgetPath = 'lib/ui/shared/widgets/fake.dart';

    List<InlineStyleViolation> scan(
      String expression, {
      String filePath = widgetPath,
    }) => scanSourceForInlineStyle(
      filePath: filePath,
      source:
          "import 'package:flutter/material.dart';\n"
          'final value = $expression;\n',
    );

    for (final expression in [
      'Color(0xFFFF6B00)',
      'const Color(0xFFFF6B00)',
      'Color.fromARGB(255, 255, 107, 0)',
      'Color.fromRGBO(255, 107, 0, 1)',
      'Colors.red',
      'TextStyle(fontWeight: FontWeight.w800)',
      'Theme.of(context).textTheme.bodySmall!.copyWith(fontSize: 12)',
      'BorderRadius.circular(12)',
      'const Radius.circular(8.5)',
      'FilledButton.styleFrom(backgroundColor: color)',
    ]) {
      test('$expression é violação com arquivo, linha e trecho', () {
        final violations = scan(expression);

        expect(violations, hasLength(1));
        expect(violations.single.filePath, widgetPath);
        expect(violations.single.lineNumber, 2);
        expect(violations.single.line, 'final value = $expression;');
        expect(violations.single.remedy, isNotEmpty);
        expect(
          violations.single.toString(),
          startsWith('$widgetPath:2 → final value = $expression;'),
        );
      });
    }

    test('cor literal numa página de módulo é violação', () {
      final violations = scan(
        'Container(color: Color(0xFFFF6B00))',
        filePath: 'lib/ui/modules/catalog/pages/home_page.dart',
      );

      expect(violations, hasLength(1));
    });

    test('Colors.transparent e raio de token são aceitos', () {
      expect(scan('Colors.transparent'), isEmpty);
      expect(scan('BorderRadius.circular(AppRadius.xl)'), isEmpty);
      expect(scan('Radius.circular(radius)'), isEmpty);
    });

    test('Colors.red em comentário ou em string não conta', () {
      final violations = scanSourceForInlineStyle(
        filePath: widgetPath,
        source:
            '// Colors.red\n'
            '/* Color(0xFFFF0000) */\n'
            "const exemplo = 'Colors.red';\n"
            "const outro = '''\nTextStyle(fontSize: 12)\n''';\n",
      );

      expect(violations, isEmpty);
    });

    test('a pasta do tema fica fora da regra', () {
      expect(
        scan(
          'Color(0xFFFF6B00)',
          filePath: 'lib/ui/shared/theme/app_colors.dart',
        ),
        isEmpty,
      );
      expect(
        scan(
          'Color(0xFFFF6B00)',
          filePath:
              '/projeto/apps/mobile/lib/ui/shared/theme/brand_tokens.dart',
        ),
        isEmpty,
      );
    });

    test('arquivo de lib/ui fora de pages e widgets fica fora da regra', () {
      expect(
        scan(
          'Colors.red',
          filePath: 'lib/ui/shared/formatters/money_formatter.dart',
        ),
        isEmpty,
      );
      expect(
        scan(
          'Colors.red',
          filePath: 'lib/ui/modules/catalog/view_models/home_view_model.dart',
        ),
        isEmpty,
      );
    });

    test('caminho absoluto de widget também é verificado', () {
      expect(
        scan(
          'Colors.red',
          filePath: '/projeto/apps/mobile/lib/ui/shared/widgets/fake.dart',
        ),
        hasLength(1),
      );
    });

    test('fonte que não parseia lança StateError em vez de passar vazia', () {
      expect(
        () => scanSourceForInlineStyle(
          filePath: widgetPath,
          source: 'final value = Container(;\n',
        ),
        throwsStateError,
      );
    });
  });

  test('pasta inexistente lança StateError em vez de passar vazia', () {
    expect(() => dartFilesIn('lib/pasta-inexistente'), throwsStateError);
    expect(() => scanDirectory('lib/pasta-inexistente'), throwsStateError);
    expect(
      () => scanDirectoryForInlineStyle('lib/pasta-inexistente'),
      throwsStateError,
    );
  });
}
