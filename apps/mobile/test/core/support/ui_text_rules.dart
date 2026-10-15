import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';

import 'import_rules.dart';

/// Regra H: um texto de interface é escrito uma vez só em `lib/ui` e
/// `lib/app`; quem precisa dele reusa a constante de quem o declara.
///
/// Texto de interface é o literal que começa com letra maiúscula, tem ao menos
/// [minUiTextLength] caracteres e não tem interpolação. O limiar deixa de fora
/// chaves, nomes de rota, formatos e rótulos curtos ("Sair", "Entrar").
const minUiTextLength = 12;

final _startsWithUppercase = RegExp(r'^\p{Lu}', unicode: true);

bool isUiText(String value) =>
    value.length >= minUiTextLength && _startsWithUppercase.hasMatch(value);

/// Onde um texto aparece: arquivo e linha da primeira ocorrência nele.
class UiTextOccurrence {
  const UiTextOccurrence(this.filePath, this.lineNumber);

  final String filePath;
  final int lineNumber;

  @override
  String toString() => '$filePath:$lineNumber';
}

class UiTextRepetition {
  const UiTextRepetition(this.text, this.occurrences);

  final String text;

  /// Uma por arquivo, sempre duas ou mais.
  final List<UiTextOccurrence> occurrences;

  @override
  String toString() =>
      "'$text' em ${occurrences.length} arquivos:\n"
      '${occurrences.map((occurrence) => '    $occurrence').join('\n')}\n'
      '    declare o texto numa constante do dono e reuse-a';
}

/// Lê os arquivos `.dart` de cada pasta em [paths] e acusa os textos repetidos
/// entre eles.
List<UiTextRepetition> scanDirectoriesForRepeatedUiTexts(List<String> paths) {
  return findRepeatedUiTexts({
    for (final path in paths)
      for (final file in dartFilesIn(path))
        file.path.replaceAll(r'\', '/'): file.readAsStringSync(),
  });
}

/// [sources] vai do caminho do arquivo ao seu conteúdo. Repetição dentro do
/// mesmo arquivo não é acusada.
List<UiTextRepetition> findRepeatedUiTexts(Map<String, String> sources) {
  final occurrencesByText = <String, List<UiTextOccurrence>>{};
  for (final MapEntry(key: filePath, value: source) in sources.entries) {
    for (final MapEntry(key: text, value: lineNumber) in collectUiTexts(
      filePath: filePath,
      source: source,
    ).entries) {
      occurrencesByText
          .putIfAbsent(text, () => [])
          .add(UiTextOccurrence(filePath, lineNumber));
    }
  }

  return [
    for (final MapEntry(key: text, value: occurrences)
        in occurrencesByText.entries)
      if (occurrences.length > 1) UiTextRepetition(text, occurrences),
  ];
}

/// Os textos de interface do arquivo, cada um com a linha da primeira
/// ocorrência. Diretivas (`import`, `export`, `part`) e anotações ficam de
/// fora; `'a' 'b'` conta como o texto juntado.
Map<String, int> collectUiTexts({
  required String filePath,
  required String source,
}) {
  final parsed = parseString(
    content: source,
    path: filePath,
    throwIfDiagnostics: false,
  );

  // Fonte que não parseia devolveria zero textos e a barreira passaria verde
  // sem ter olhado nada.
  if (parsed.errors.isNotEmpty) {
    throw StateError(
      'Não foi possível parsear "$filePath": a barreira não pode afirmar nada '
      'sobre este arquivo.\n${parsed.errors.first}',
    );
  }

  final texts = <String, int>{};
  void add(String? value, int offset) {
    if (value == null || !isUiText(value)) return;
    texts.putIfAbsent(
      value,
      () => parsed.lineInfo.getLocation(offset).lineNumber,
    );
  }

  parsed.unit.accept(_UiTextVisitor(add));
  return texts;
}

class _UiTextVisitor extends RecursiveAstVisitor<void> {
  _UiTextVisitor(this.add);

  final void Function(String? value, int offset) add;

  @override
  void visitImportDirective(ImportDirective node) {}

  @override
  void visitExportDirective(ExportDirective node) {}

  @override
  void visitPartDirective(PartDirective node) {}

  @override
  void visitPartOfDirective(PartOfDirective node) {}

  @override
  void visitAnnotation(Annotation node) {}

  /// As partes não são visitadas: só o texto juntado conta, e com uma parte
  /// interpolada o `stringValue` é `null`.
  @override
  void visitAdjacentStrings(AdjacentStrings node) {
    add(node.stringValue, node.offset);
  }

  @override
  void visitSimpleStringLiteral(SimpleStringLiteral node) {
    add(node.value, node.offset);
  }
}
