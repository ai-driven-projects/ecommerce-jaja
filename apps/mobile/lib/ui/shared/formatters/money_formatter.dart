import 'package:intl/intl.dart';

import '../../../core/value_objects/money.dart';

final _currency = NumberFormat.currency(
  locale: 'pt_BR',
  symbol: r'R$',
  decimalDigits: 2,
);

/// Formata no padrão da vitrine web (`formatPrice` de `price.util.ts`):
/// `R$ 1.290,90`. O `intl` põe um espaço não separável (U+00A0) depois do
/// símbolo; ele vira espaço comum para o texto ser idêntico ao do web.
String formatMoney(Money value) =>
    _currency.format(value.cents / 100).replaceAll(' ', ' ');
