import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'session_storage.dart';

/// Chave única da sessão no armazenamento seguro, no prefixo `jaja:` das
/// demais chaves do app.
const _sessionKey = 'jaja:sessao';

/// [SessionStorage] sobre o `flutter_secure_storage` (Keychain no iOS,
/// armazenamento cifrado no Android). Qualquer exceção do plugin é engolida.
final class SecureSessionStorage implements SessionStorage {
  SecureSessionStorage([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  /// Chave ausente ou armazenamento indisponível → `null`.
  @override
  Future<String?> read() async {
    try {
      return await _storage.read(key: _sessionKey);
    } catch (_) {
      return null;
    }
  }

  /// Falha ao gravar é ignorada: a sessão vale até o app fechar.
  @override
  Future<void> write(String value) async {
    try {
      await _storage.write(key: _sessionKey, value: value);
    } catch (_) {
      // Armazenamento indisponível: a próxima abertura começa sem sessão.
    }
  }

  @override
  Future<void> clear() async {
    try {
      await _storage.delete(key: _sessionKey);
    } catch (_) {
      // Armazenamento indisponível: nada a apagar que possa ser lido depois.
    }
  }
}
