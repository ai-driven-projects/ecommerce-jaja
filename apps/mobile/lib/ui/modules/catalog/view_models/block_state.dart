import '../../../../core/errors/app_failure.dart';

/// Estado de um bloco da tela que depende de uma busca remota, nos três
/// estados do padrão "skeleton / banner de erro / conteúdo": a tela faz
/// `switch` exaustivo e nunca mostra skeleton parado nem dado velho durante a
/// recarga.
sealed class BlockState<T> {
  const BlockState();
}

/// Busca em andamento (primeira carga, "Tentar de novo" ou puxar a tela).
final class BlockLoading<T> extends BlockState<T> {
  const BlockLoading();
}

/// A última busca falhou; a tela mostra o banner com [failure].
final class BlockFailed<T> extends BlockState<T> {
  const BlockFailed(this.failure);

  final AppFailure failure;
}

/// A última busca respondeu com [value] (que pode ser vazio).
final class BlockLoaded<T> extends BlockState<T> {
  const BlockLoaded(this.value);

  final T value;
}
