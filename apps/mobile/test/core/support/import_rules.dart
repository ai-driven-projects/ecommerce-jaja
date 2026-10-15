import 'dart:io';

import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';

const selfPackage = 'mobile';

/// Regra A: o que `lib/core` e `lib/modules` podem importar. `core` só vê a
/// si mesma; `modules` vê `core` e `modules`.
const pureDartLibraries = {
  'core',
  'async',
  'collection',
  'convert',
  'math',
  'typed_data',
};

const purePackages = {
  'meta',
  'collection',
  'freezed_annotation',
  'json_annotation',
};

const allowedLayersByPureLayer = {
  'core': {'core'},
  'modules': {'core', 'modules'},
};

/// Regra B: pacotes de HTTP e de armazenamento local, confinados a `lib/infra`.
const infraPackages = {'dio', 'flutter_secure_storage', 'shared_preferences'};
const infraLayer = 'infra';

/// Regra D: o localizador de dependências, confinado à DI e à inicialização.
/// Decidida pelo caminho (não só pela camada): `lib/infra/http` é proibido.
const locatorPackage = 'get_it';
const locatorAllowedPrefixes = {'infra/di/', 'app/'};

/// Regra E: o pacote de ligação da UI aos ViewModels, confinado a `lib/ui` e
/// `lib/app`. Em `lib/ui` a diretiva precisa de `show` sem `hide`, e o `show`
/// não pode trazer o localizador que o pacote reexporta — caso contrário
/// `di`/`GetIt` entrariam nas telas sem importar `get_it` (regra D).
const bindingPackage = 'watch_it';
const bindingAllowedPrefixes = {'ui/', 'app/'};
const bindingShowRequiredPrefixes = {'ui/'};
const bindingForbiddenNames = {'di', 'sl', 'GetIt'};

enum ImportRule {
  purity,
  infraConfinement,
  locatorConfinement,
  bindingConfinement,
}

/// Combinadores (`show`/`hide`) de um `import` ou `export`.
final class DirectiveCombinators {
  const DirectiveCombinators({this.shownNames, this.hidesNames = false});

  static const none = DirectiveCombinators();

  /// Nomes listados no `show`, ou `null` quando a diretiva não tem `show`.
  final Set<String>? shownNames;

  /// Se a diretiva tem algum `hide`.
  final bool hidesNames;
}

class ImportViolation {
  const ImportViolation(
    this.rule,
    this.filePath,
    this.lineNumber,
    this.directive,
  );

  final ImportRule rule;
  final String filePath;
  final int lineNumber;
  final String directive;

  @override
  String toString() => '$filePath:$lineNumber → $directive';
}

/// Para onde aponta a URI de um `import` ou `export`.
sealed class ImportTarget {
  const ImportTarget();
}

final class DartLibraryTarget extends ImportTarget {
  const DartLibraryTarget(this.library);

  final String library;
}

final class PackageTarget extends ImportTarget {
  const PackageTarget(this.package);

  final String package;
}

/// Arquivo do próprio app; [layer] é a primeira pasta sob `lib/` (`core`,
/// `modules`, `infra`, `ui`, `app`) ou `null` para arquivos na raiz de `lib/`.
final class AppTarget extends ImportTarget {
  const AppTarget(this.layer);

  final String? layer;
}

/// Caminho relativo que sai de `lib/` ou URI de esquema desconhecido.
final class UnknownTarget extends ImportTarget {
  const UnknownTarget();
}

List<File> dartFilesIn(String path) {
  final directory = Directory(path);
  if (!directory.existsSync()) {
    throw StateError(
      'Diretório "$path" não existe: a barreira escanearia zero arquivos e '
      'passaria verde sem ter verificado nada.',
    );
  }

  return directory
      .listSync(recursive: true)
      .whereType<File>()
      .where((file) => file.path.endsWith('.dart'))
      .toList();
}

List<ImportViolation> scanDirectory(
  String path, {
  Set<ImportRule> rules = const {...ImportRule.values},
}) {
  return dartFilesIn(path)
      .expand(
        (file) => scanSource(
          filePath: file.path,
          source: file.readAsStringSync(),
          rules: rules,
        ),
      )
      .toList();
}

/// Lê as diretivas com o parser do `analyzer`: `import` comentado ou dentro de
/// string não é diretiva e não conta. Cada regra só se aplica aos arquivos da
/// sua camada (Regra A em `core`/`modules`, Regra B fora de `infra`, Regra D
/// fora de `infra/di` e `app`, Regra E fora de `ui` e `app` — e dentro de `ui`
/// olhando os combinadores).
List<ImportViolation> scanSource({
  required String filePath,
  required String source,
  Set<ImportRule> rules = const {...ImportRule.values},
}) {
  final parsed = parseString(
    content: source,
    path: filePath,
    throwIfDiagnostics: false,
  );
  final fromLib = _pathFromLib(filePath);
  final fromLayer = fromLib == null ? null : _layerOf(fromLib);
  final violations = <ImportViolation>[];

  for (final directive
      in parsed.unit.directives.whereType<NamespaceDirective>()) {
    final uris = [
      directive.uri.stringValue,
      ...directive.configurations.map((c) => c.uri.stringValue),
    ].nonNulls;
    final combinators = _combinatorsOf(directive);

    for (final uri in uris) {
      final target = resolveImportTarget(uri: uri, fromFile: filePath);
      final brokenRule = rules
          .where(
            (rule) => _breaks(
              rule,
              fromLib: fromLib,
              fromLayer: fromLayer,
              target: target,
              combinators: combinators,
            ),
          )
          .firstOrNull;
      if (brokenRule == null) continue;

      final start = directive.firstTokenAfterCommentAndMetadata.offset;
      violations.add(
        ImportViolation(
          brokenRule,
          filePath,
          parsed.lineInfo.getLocation(start).lineNumber,
          source.substring(start, directive.end),
        ),
      );
    }
  }

  return violations;
}

ImportTarget resolveImportTarget({
  required String uri,
  required String fromFile,
}) {
  if (uri.startsWith('dart:')) {
    return DartLibraryTarget(uri.substring('dart:'.length).split('/').first);
  }

  if (uri.startsWith('package:')) {
    final segments = uri.substring('package:'.length).split('/');
    if (segments.first == selfPackage && segments.length > 1) {
      return AppTarget(_layerOf(segments.sublist(1).join('/')));
    }
    return PackageTarget(segments.first);
  }

  if (uri.contains(':')) return const UnknownTarget();

  final fromLib = _pathFromLib(fromFile);
  if (fromLib == null) return const UnknownTarget();

  final resolved = _resolveRelative(fromFile: 'lib/$fromLib', imported: uri);
  if (!resolved.startsWith('lib/')) return const UnknownTarget();
  return AppTarget(_layerOf(resolved.substring('lib/'.length)));
}

DirectiveCombinators _combinatorsOf(NamespaceDirective directive) {
  Set<String>? shownNames;
  var hidesNames = false;
  for (final combinator in directive.combinators) {
    switch (combinator) {
      case ShowCombinator(shownNames: final names):
        (shownNames ??= {}).addAll(names.map((name) => name.name));
      case HideCombinator():
        hidesNames = true;
    }
  }
  return DirectiveCombinators(shownNames: shownNames, hidesNames: hidesNames);
}

bool _breaks(
  ImportRule rule, {
  required String? fromLib,
  required String? fromLayer,
  required ImportTarget target,
  DirectiveCombinators combinators = DirectiveCombinators.none,
}) {
  switch (rule) {
    case ImportRule.purity:
      final allowedLayers = allowedLayersByPureLayer[fromLayer];
      if (allowedLayers == null) return false;
      return switch (target) {
        DartLibraryTarget(:final library) => !pureDartLibraries.contains(
          library,
        ),
        PackageTarget(:final package) => !purePackages.contains(package),
        AppTarget(:final layer) => !allowedLayers.contains(layer),
        UnknownTarget() => true,
      };
    case ImportRule.infraConfinement:
      if (fromLayer == infraLayer) return false;
      return target is PackageTarget && infraPackages.contains(target.package);
    case ImportRule.locatorConfinement:
      if (fromLib != null && locatorAllowedPrefixes.any(fromLib.startsWith)) {
        return false;
      }
      return target is PackageTarget && target.package == locatorPackage;
    case ImportRule.bindingConfinement:
      if (target is! PackageTarget || target.package != bindingPackage) {
        return false;
      }
      if (fromLib == null || !bindingAllowedPrefixes.any(fromLib.startsWith)) {
        return true;
      }
      if (!bindingShowRequiredPrefixes.any(fromLib.startsWith)) return false;
      final shownNames = combinators.shownNames;
      if (shownNames == null || combinators.hidesNames) return true;
      return shownNames.any(bindingForbiddenNames.contains);
  }
}

/// Caminho a partir de `lib/` (sem o prefixo), aceitando o relativo
/// (`lib/core/x.dart`) e o absoluto que `dartFilesIn` devolve quando o teste
/// roda de outro diretório. `null` se o arquivo não está sob `lib/`.
String? _pathFromLib(String filePath) {
  final normalized = filePath.replaceAll(r'\', '/');
  if (normalized.startsWith('lib/')) return normalized.substring('lib/'.length);
  final index = normalized.lastIndexOf('/lib/');
  return index < 0 ? null : normalized.substring(index + '/lib/'.length);
}

String? _layerOf(String pathFromLib) {
  final segments = pathFromLib.split('/');
  return segments.length > 1 ? segments.first : null;
}

/// Resolve o import relativo contra a pasta do arquivo de origem, para saber
/// se o alvo continua dentro da camada ou escapa dela.
String _resolveRelative({required String fromFile, required String imported}) {
  final fromSegments = fromFile.split('/')..removeLast();
  final resolved = <String>[];
  for (final segment in [...fromSegments, ...imported.split('/')]) {
    if (segment.isEmpty || segment == '.') continue;
    if (segment == '..') {
      if (resolved.isEmpty) return '../$imported';
      resolved.removeLast();
      continue;
    }
    resolved.add(segment);
  }
  return resolved.join('/');
}
