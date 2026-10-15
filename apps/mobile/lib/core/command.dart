import 'errors/app_failure.dart';
import 'result.dart';

// Padrão Command do guia de arquitetura do Flutter: Command0 sem argumento,
// Command1 com um argumento. O ViewModel passa `notifyListeners` como
// `onStateChange`, por isso não depende de Flutter.

class Command0<T> {
  Command0(this._action, {required this.onStateChange});

  final Future<Result<T>> Function() _action;
  final void Function() onStateChange;

  bool running = false;
  Result<T>? result;

  Future<void> execute() async {
    if (running) return;

    running = true;
    result = null;
    onStateChange();

    try {
      result = await _action();
    } catch (_) {
      result = const Failure(unspecifiedFailure);
    } finally {
      running = false;
      onStateChange();
    }
  }
}

class Command1<T, A> {
  Command1(this._action, {required this.onStateChange});

  final Future<Result<T>> Function(A arg) _action;
  final void Function() onStateChange;

  bool running = false;
  Result<T>? result;

  Future<void> execute(A arg) async {
    if (running) return;

    running = true;
    result = null;
    onStateChange();

    try {
      result = await _action(arg);
    } catch (_) {
      result = const Failure(unspecifiedFailure);
    } finally {
      running = false;
      onStateChange();
    }
  }
}
