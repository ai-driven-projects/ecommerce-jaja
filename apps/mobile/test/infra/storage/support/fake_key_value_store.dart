import 'package:mobile/infra/storage/key_value_store.dart';

/// [KeyValueStore] em memória para os testes. [failOnRead] faz a leitura
/// devolver `null` e [failOnWrite] faz a gravação e a remoção não mudarem
/// nada, os dois sem lançar — o contrato real engole falhas do disco do mesmo jeito.
class FakeKeyValueStore implements KeyValueStore {
  FakeKeyValueStore({
    Map<String, String> initialValues = const {},
    this.failOnRead = false,
    this.failOnWrite = false,
  }) : values = Map.of(initialValues);

  final Map<String, String> values;
  bool failOnRead;
  bool failOnWrite;

  @override
  Future<String?> readString(String key) async {
    if (failOnRead) return null;
    return values[key];
  }

  @override
  Future<void> writeString(String key, String value) async {
    if (failOnWrite) return;
    values[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    if (failOnWrite) return;
    values.remove(key);
  }
}
