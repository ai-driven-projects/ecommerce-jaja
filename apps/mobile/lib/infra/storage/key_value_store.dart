/// Armazenamento chave-valor local do app (regra 2 do `CLAUDE.md`: transporta
/// texto, não entidade, por isso mora em `infra/` e não em `provider/`).
///
/// Nenhuma das operações lança: memória indisponível ou ilegível é leitura
/// `null` e gravação ignorada. Quem precisa de erro de disco não existe neste
/// app — a loja escolhida e o carrinho anônimo tratam ausência como "sem valor".
abstract interface class KeyValueStore {
  Future<String?> readString(String key);

  Future<void> writeString(String key, String value);
}
