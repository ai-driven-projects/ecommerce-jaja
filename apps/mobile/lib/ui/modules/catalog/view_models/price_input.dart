// Preço digitado no painel de filtros, copiado de `parseReaisToCents` e
// `formatCentsAsReais` em
// `apps/frontend/src/modules/catalog/data/storefront-query.util.ts`.

final _spaces = RegExp(r'\s');
final _currencyPrefix = RegExp(r'^R\$', caseSensitive: false);
final _decimal = RegExp(r'^\d+(\.\d{1,2})?$');
const _maxSafeInteger = 9007199254740991;

/// Texto em reais → centavos inteiros. Aceita `R$`, espaços, `12,90`,
/// `12.90`, `1.290,90` e `300`; vazio, negativo ou com mais de duas casas
/// vira `null`.
int? parseReaisToCents(String text) {
  final normalized = text
      .replaceAll(_spaces, '')
      .replaceFirst(_currencyPrefix, '');
  if (normalized.isEmpty) return null;

  final decimal = normalized.contains(',')
      ? normalized.replaceAll('.', '').replaceFirst(',', '.')
      : normalized;
  if (!_decimal.hasMatch(decimal)) return null;

  final cents = double.parse(decimal) * 100;
  // O `Number.isSafeInteger` do web: número enorme vira `null`.
  return cents <= _maxSafeInteger ? cents.round() : null;
}

/// Centavos → reais para os campos: `30000` → `300`, `1290` → `12,90`.
String formatCentsAsReais(int cents) {
  final reais = cents ~/ 100;
  final rest = cents % 100;
  return rest == 0 ? '$reais' : '$reais,${'$rest'.padLeft(2, '0')}';
}
