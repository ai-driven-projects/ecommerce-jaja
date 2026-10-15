import 'dart:io';

/// Regra G: a estrutura de pastas de `lib/` e de `test/`. As listas são
/// fechadas: pasta nova entra aqui junto com a regra que a justifica, nunca
/// por conveniência. As funções trabalham sobre listas de caminhos (relativos à
/// raiz do app, como `lib/core/result.dart`), para os testes de exemplo não
/// tocarem o disco.
const libFolders = {'app', 'core', 'infra', 'modules', 'ui'};
const libRootFiles = {'main_dev.dart', 'main_prod.dart'};

const domains = {'auth', 'cart', 'catalog', 'customer', 'order', 'store'};
const domainFolders = {'model', 'provider', 'usecase', 'errors'};

const uiFolders = {'modules', 'shared'};
const uiDomainFolders = {'pages', 'widgets', 'view_models'};
const uiSharedFolders = {
  'theme',
  'widgets',
  'view_models',
  'formatters',
  'pages',
};

/// Pasta de apoio dos testes (fakes, fábricas): não espelha nada de `lib/`.
const testSupportFolder = 'support';

class StructureViolation {
  const StructureViolation(this.path, this.reason);

  final String path;

  /// O que está errado e o que é permitido — a mensagem precisa se explicar
  /// sozinha.
  final String reason;

  @override
  String toString() => '$path\n    $reason';
}

/// Arquivos sob [path], com o caminho relativo normalizado (`/`). Arquivos
/// ocultos (`.DS_Store`) ficam de fora.
List<String> filesIn(String path) {
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
      .map((file) => file.path.replaceAll(r'\', '/'))
      .where((filePath) => !filePath.split('/').last.startsWith('.'))
      .toList();
}

/// Confere cada arquivo de `lib/` contra as listas fechadas.
List<StructureViolation> checkLibStructure(Iterable<String> libFiles) {
  final violations = <StructureViolation>[];
  for (final filePath in libFiles) {
    final violation = _libViolationOf(filePath);
    if (violation != null) violations.add(violation);
  }
  return violations;
}

/// Confere que nenhum teste ficou em `lib/` e que toda pasta de `test/` com
/// `*_test.dart` tem a pasta equivalente em `lib/` (pastas `support/` à parte).
List<StructureViolation> checkTestStructure({
  required Iterable<String> libFiles,
  required Iterable<String> testFiles,
}) {
  final libDirectories = _directoriesOf(libFiles);
  final violations = <StructureViolation>[
    for (final filePath in libFiles)
      if (filePath.endsWith('_test.dart'))
        StructureViolation(
          filePath,
          'teste dentro de lib/: testes ficam em test/, espelhando lib/',
        ),
  ];

  for (final filePath in testFiles) {
    if (!filePath.endsWith('_test.dart')) continue;
    final segments = filePath.split('/')..removeLast();
    if (segments.isEmpty || segments.first != 'test') {
      throw ArgumentError.value(filePath, 'testFiles', 'fora de test/');
    }
    if (segments.contains(testSupportFolder)) continue;

    final mirror = ['lib', ...segments.skip(1)].join('/');
    if (!libDirectories.contains(mirror)) {
      violations.add(
        StructureViolation(
          filePath,
          'teste sem espelho: "$mirror/" não existe; a pasta do teste '
          'repete o caminho do código em lib/',
        ),
      );
    }
  }
  return violations;
}

StructureViolation? _libViolationOf(String filePath) {
  final segments = filePath.split('/');
  if (segments.first != 'lib') {
    throw ArgumentError.value(filePath, 'libFiles', 'fora de lib/');
  }
  final path = segments.sublist(1);
  final folders = path.sublist(0, path.length - 1);

  if (folders.isEmpty) {
    return libRootFiles.contains(path.single)
        ? null
        : _unknown(
            filePath,
            'lib/',
            libRootFiles,
            kind: 'arquivo desconhecido',
          );
  }

  final layer = folders.first;
  if (!libFolders.contains(layer)) {
    return _unknown(filePath, 'lib/', libFolders);
  }

  return switch (layer) {
    'modules' => _domainViolationOf(
      filePath,
      folders.sublist(1),
      parent: 'lib/modules',
      allowed: domainFolders,
    ),
    'ui' => _uiViolationOf(filePath, folders.sublist(1)),
    _ => null,
  };
}

StructureViolation? _uiViolationOf(String filePath, List<String> folders) {
  if (folders.isEmpty) {
    return _unknown(filePath, 'lib/ui/', uiFolders, kind: 'arquivo solto');
  }
  final folder = folders.first;
  if (!uiFolders.contains(folder)) {
    return _unknown(filePath, 'lib/ui/', uiFolders);
  }
  if (folder == 'modules') {
    return _domainViolationOf(
      filePath,
      folders.sublist(1),
      parent: 'lib/ui/modules',
      allowed: uiDomainFolders,
    );
  }
  if (folders.length == 1) {
    return _unknown(
      filePath,
      'lib/ui/shared/',
      uiSharedFolders,
      kind: 'arquivo solto',
    );
  }
  return uiSharedFolders.contains(folders[1])
      ? null
      : _unknown(filePath, 'lib/ui/shared/', uiSharedFolders);
}

/// [folders] começa no domínio: `['cart', 'model', …]`.
StructureViolation? _domainViolationOf(
  String filePath,
  List<String> folders, {
  required String parent,
  required Set<String> allowed,
}) {
  if (folders.isEmpty) {
    return _unknown(filePath, '$parent/', domains, kind: 'arquivo solto');
  }
  final domain = folders.first;
  if (!domains.contains(domain)) {
    return _unknown(
      filePath,
      '$parent/',
      domains,
      kind: 'domínio desconhecido',
    );
  }
  if (folders.length == 1) {
    return _unknown(
      filePath,
      '$parent/$domain/',
      allowed,
      kind: 'arquivo solto',
    );
  }
  return allowed.contains(folders[1])
      ? null
      : _unknown(filePath, '$parent/$domain/', allowed);
}

StructureViolation _unknown(
  String filePath,
  String parent,
  Set<String> allowed, {
  String kind = 'pasta desconhecida',
}) => StructureViolation(
  filePath,
  '$kind em $parent: permitido só ${allowed.join(', ')}',
);

/// Todas as pastas que contêm algum dos [files], inclusive as intermediárias.
Set<String> _directoriesOf(Iterable<String> files) {
  final directories = <String>{};
  for (final filePath in files) {
    final segments = filePath.split('/')..removeLast();
    for (var length = 1; length <= segments.length; length++) {
      directories.add(segments.sublist(0, length).join('/'));
    }
  }
  return directories;
}
