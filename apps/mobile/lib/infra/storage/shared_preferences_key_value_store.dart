import 'package:shared_preferences/shared_preferences.dart';

import 'key_value_store.dart';

/// [KeyValueStore] sobre o `shared_preferences`. A instância é obtida na
/// primeira chamada e guardada, para o bootstrap continuar síncrono; se a
/// obtenção falhar, a próxima chamada tenta de novo.
final class SharedPreferencesKeyValueStore implements KeyValueStore {
  Future<SharedPreferences>? _preferences;

  Future<SharedPreferences> _instance() async {
    try {
      return await (_preferences ??= SharedPreferences.getInstance());
    } catch (_) {
      _preferences = null;
      rethrow;
    }
  }

  /// Valor ausente, memória indisponível ou valor de outro tipo → `null`.
  @override
  Future<String?> readString(String key) async {
    try {
      return (await _instance()).getString(key);
    } catch (_) {
      return null;
    }
  }

  /// Falha ao gravar é ignorada: a escolha vale na sessão mesmo sem disco.
  @override
  Future<void> writeString(String key, String value) async {
    try {
      await (await _instance()).setString(key, value);
    } catch (_) {
      // Memória indisponível: a próxima abertura do app fica sem a lembrança.
    }
  }
}
