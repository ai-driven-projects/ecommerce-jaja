import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/source/line_info.dart';

import 'import_rules.dart';

/// Regra C: em `pages/` e `widgets/` de `lib/ui`, e em todo `lib/app`, cor,
/// tipografia e raio vêm do tema. Regra C2: cor literal só no arquivo de cores
/// do tema, em todo `lib/`. A barreira lê a árvore sintática, não o texto: string e comentário
/// não são expressões, e a quebra de linha do formatter não muda nada.
///
/// `Colors.transparent` é a única cor nomeada tolerada (ex.:
/// `Material(color: Colors.transparent)`).
const _allowedColorNames = {'transparent'};

/// O sem nome cobre `Color(0x…)`; os nomeados, as outras formas de escrever
/// cor literal.
const _colorConstructorNames = {'fromARGB', 'fromRGBO', 'from'};

const _radiusTypeNames = {'Radius', 'BorderRadius'};

/// Pastas cujo código é página ou widget; `lib/ui/shared/theme` é onde os
/// valores literais moram e nunca entra. `lib/app` entra inteiro.
const _scopedFolders = {'pages', 'widgets'};
const _themeFolder = 'ui/shared/theme/';
const _appFolder = 'app/';

/// O único arquivo de `lib/` que declara cor literal (regra C2).
const colorLiteralFile = 'ui/shared/theme/app_colors.dart';

const _colorRemedy =
    'cor literal na UI: use context.tokens (BrandTokens) ou o ColorScheme '
    'do tema, em ui/shared/theme/';
const _typographyRemedy =
    'tipografia literal na UI: use um estilo de Theme.of(context).textTheme '
    '(ou da extensão AppTextStyles em app_typography.dart) com copyWith(color:)';
const _colorConfinementRemedy =
    'cor literal fora de $colorLiteralFile: declare a cor em AppColors e use '
    'o token (AppColors no tema, context.tokens nas telas)';
const _radiusRemedy = 'raio literal na UI: use uma constante de AppRadius';
const _styleFromRemedy =
    'estilo de botão no call site: ele pertence a ui/shared/theme/ '
    '(AppButtonStyles ou o tema de botão em app_theme.dart)';

class InlineStyleViolation {
  const InlineStyleViolation({
    required this.filePath,
    required this.lineNumber,
    required this.line,
    required this.remedy,
  });

  final String filePath;
  final int lineNumber;
  final String line;

  /// O que fazer no lugar — a mensagem de falha precisa se explicar sozinha.
  final String remedy;

  @override
  String toString() => '$filePath:$lineNumber → $line\n    $remedy';
}

/// Se o arquivo está em `lib/app`, ou sob `lib/ui` dentro de uma pasta `pages`
/// ou `widgets` e fora de `lib/ui/shared/theme`.
bool isInlineStyleScoped(String filePath) {
  final fromLib = _pathFromLib(filePath);
  if (fromLib == null) return false;
  if (fromLib.startsWith(_appFolder)) return true;
  if (!fromLib.startsWith('ui/') || fromLib.startsWith(_themeFolder)) {
    return false;
  }

  final folders = fromLib.split('/')..removeLast();
  return folders.any(_scopedFolders.contains);
}

/// Se a regra C2 olha o arquivo: todo `lib/`, menos o arquivo de cores.
bool isColorLiteralScoped(String filePath) {
  final fromLib = _pathFromLib(filePath);
  return fromLib != null && fromLib != colorLiteralFile;
}

List<InlineStyleViolation> scanDirectoryForInlineStyle(String path) {
  return dartFilesIn(path)
      .expand(
        (file) => scanSourceForInlineStyle(
          filePath: file.path,
          source: file.readAsStringSync(),
        ),
      )
      .toList();
}

List<InlineStyleViolation> scanDirectoryForColorLiteral(String path) {
  return dartFilesIn(path)
      .expand(
        (file) => scanSourceForColorLiteral(
          filePath: file.path,
          source: file.readAsStringSync(),
        ),
      )
      .toList();
}

List<InlineStyleViolation> scanSourceForInlineStyle({
  required String filePath,
  required String source,
}) {
  if (!isInlineStyleScoped(filePath)) return const [];
  return _scan(filePath: filePath, source: source, colorOnly: false);
}

List<InlineStyleViolation> scanSourceForColorLiteral({
  required String filePath,
  required String source,
}) {
  if (!isColorLiteralScoped(filePath)) return const [];
  return _scan(filePath: filePath, source: source, colorOnly: true);
}

List<InlineStyleViolation> _scan({
  required String filePath,
  required String source,
  required bool colorOnly,
}) {
  final parsed = parseString(
    content: source,
    path: filePath,
    throwIfDiagnostics: false,
  );

  // Fonte que não parseia devolveria zero violações e a barreira passaria
  // verde sem ter olhado nada.
  if (parsed.errors.isNotEmpty) {
    throw StateError(
      'Não foi possível parsear "$filePath": a barreira não pode afirmar nada '
      'sobre este arquivo.\n${parsed.errors.first}',
    );
  }

  final visitor = _InlineStyleVisitor(
    filePath: filePath,
    lineInfo: parsed.lineInfo,
    lines: source.split('\n'),
    colorOnly: colorOnly,
  );
  parsed.unit.accept(visitor);

  return visitor.violations;
}

class _InlineStyleVisitor extends RecursiveAstVisitor<void> {
  _InlineStyleVisitor({
    required this.filePath,
    required this.lineInfo,
    required this.lines,
    required this.colorOnly,
  });

  final String filePath;
  final LineInfo lineInfo;
  final List<String> lines;

  /// Regra C2: só cor literal, com o remédio de confinamento.
  final bool colorOnly;
  final violations = <InlineStyleViolation>[];

  @override
  void visitInstanceCreationExpression(InstanceCreationExpression node) {
    _checkCall(node.argumentList, _calleeOf(node.constructorName), node.offset);
    super.visitInstanceCreationExpression(node);
  }

  @override
  void visitMethodInvocation(MethodInvocation node) {
    _checkCall(node.argumentList, _calleeOfInvocation(node), node.offset);
    super.visitMethodInvocation(node);
  }

  @override
  void visitPrefixedIdentifier(PrefixedIdentifier node) {
    if (node.prefix.name == 'Colors' &&
        !_allowedColorNames.contains(node.identifier.name)) {
      _add(node.offset, _colorRemedyForRule);
    }
    super.visitPrefixedIdentifier(node);
  }

  @override
  void visitNamedArgument(NamedArgument node) {
    if (!colorOnly && node.name.lexeme == 'fontSize') {
      _add(node.offset, _typographyRemedy);
    }
    super.visitNamedArgument(node);
  }

  void _checkCall(ArgumentList arguments, List<String> callee, int offset) {
    if (_isColorConstructor(callee)) _add(offset, _colorRemedyForRule);
    if (colorOnly) return;

    if (callee.length == 1 && callee.single == 'TextStyle') {
      _add(offset, _typographyRemedy);
    }

    if (callee.length == 2 &&
        _radiusTypeNames.contains(callee.first) &&
        callee.last == 'circular' &&
        arguments.arguments.any(_isNumericLiteral)) {
      _add(offset, _radiusRemedy);
    }

    if (callee.length == 2 && callee.last == 'styleFrom') {
      _add(offset, _styleFromRemedy);
    }
  }

  bool _isColorConstructor(List<String> callee) {
    if (callee.length == 1) return callee.single == 'Color';
    return callee.length == 2 &&
        callee.first == 'Color' &&
        _colorConstructorNames.contains(callee.last);
  }

  String get _colorRemedyForRule =>
      colorOnly ? _colorConfinementRemedy : _colorRemedy;

  bool _isNumericLiteral(Argument argument) {
    final expression = argument.argumentExpression;
    final value = expression is PrefixExpression
        ? expression.operand
        : expression;
    return value is IntegerLiteral || value is DoubleLiteral;
  }

  void _add(int offset, String remedy) {
    final lineNumber = lineInfo.getLocation(offset).lineNumber;
    violations.add(
      InlineStyleViolation(
        filePath: filePath,
        lineNumber: lineNumber,
        line: lines[lineNumber - 1].trim(),
        remedy: remedy,
      ),
    );
  }
}

/// Nome do que está sendo chamado, em segmentos: `Color(0x…)` → `['Color']`,
/// `Color.fromARGB(…)` → `['Color', 'fromARGB']`.
///
/// Sem resolução de tipos o parser não sabe se `Color` é classe ou prefixo de
/// import: sem `const`, `Color(…)` vira `MethodInvocation`; com `const`,
/// `Color.fromARGB(…)` vira `InstanceCreationExpression` cujo tipo é
/// `fromARGB` e cujo `importPrefix` é `Color`. Os segmentos apagam a diferença.
List<String> _calleeOf(ConstructorName constructorName) {
  return [
    ?constructorName.type.importPrefix?.name.lexeme,
    constructorName.type.name.lexeme,
    ?constructorName.name?.name,
  ];
}

List<String> _calleeOfInvocation(MethodInvocation node) {
  final target = node.target;
  return [if (target is SimpleIdentifier) target.name, node.methodName.name];
}

/// Caminho a partir de `lib/` (sem o prefixo), aceitando o relativo e o
/// absoluto; `null` se o arquivo não está sob `lib/`.
String? _pathFromLib(String filePath) {
  final normalized = filePath.replaceAll(r'\', '/');
  if (normalized.startsWith('lib/')) return normalized.substring('lib/'.length);
  final index = normalized.lastIndexOf('/lib/');
  return index < 0 ? null : normalized.substring(index + '/lib/'.length);
}
