/// Onde a sessão (texto de `StoredSession.encode`) fica guardada no aparelho.
///
/// Como o `KeyValueStore`, nenhuma operação lança: armazenamento indisponível
/// é leitura `null` e gravação ou limpeza ignoradas.
abstract interface class SessionStorage {
  Future<String?> read();

  Future<void> write(String value);

  Future<void> clear();
}
