import 'dart:async';

/// Relógio controlado das esperas do `LiveOrderFeed`: [call] registra a
/// duração pedida em [requested] e só completa quando o teste chama
/// [elapse].
class FakeDelay {
  final List<Duration> requested = [];

  final List<Completer<void>> _pending = [];

  /// Esperas pedidas e ainda não completadas.
  int get pendingCount => _pending.length;

  Future<void> call(Duration duration) {
    requested.add(duration);
    final completer = Completer<void>();
    _pending.add(completer);
    return completer.future;
  }

  /// Completa a espera mais antiga ainda pendente.
  void elapse() => _pending.removeAt(0).complete();
}
