import '../errors/app_failure.dart';
import '../result.dart';

/// Nome com sobrenome, aparado. Regras de `PersonName` em
/// `packages/shared/src/vo/person-name.vo.ts`, na mesma ordem; mensagens
/// `PERSON_NAME_*` de `apps/frontend/src/shared/i18n/messages.pt.ts`.
final class PersonName {
  const PersonName._(this.value);

  static const minLength = 3;

  /// Limite também aplicado ao campo do formulário.
  static const maxLength = 50;

  static final _words = RegExp(r'\s+');
  static final _allowed = RegExp(r"^[A-Za-zÀ-ÖØ-öø-ÿ'`´^~\- ]+$");

  final String value;

  static Result<PersonName> create(String input) {
    final name = input.trim();

    if (name.length < minLength) return _tooShort;
    if (name.length > maxLength) {
      return const Failure(
        ValidationFailure(
          message: 'O nome é longo demais.',
          code: PersonNameCode.tooLong,
        ),
      );
    }

    final words = name.split(_words).where((word) => word.isNotEmpty).toList();
    if (words.length < 2) return _surnameMissing;
    if (words.first.length < 2 || words.last.length < 2) return _tooShort;

    // Caractere fora da lista cai em "sem sobrenome", como no TS.
    if (!_allowed.hasMatch(name)) return _surnameMissing;

    return Ok(PersonName._(name));
  }

  static const _tooShort = Failure<PersonName>(
    ValidationFailure(
      message: 'O nome é curto demais.',
      code: PersonNameCode.tooShort,
    ),
  );

  static const _surnameMissing = Failure<PersonName>(
    ValidationFailure(
      message: 'Informe nome e sobrenome.',
      code: PersonNameCode.surnameMissing,
    ),
  );

  @override
  bool operator ==(Object other) => other is PersonName && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'PersonName($value)';
}
