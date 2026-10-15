/// Cidade e UF, como os formulários de entrega as pedem.
final class CityState {
  const CityState({required this.city, required this.state});

  final String city;
  final String state;

  // Copiada de `PLACE_PATTERN` em
  // `apps/frontend/src/modules/stores/data/store-address.util.ts`. Paliativo
  // do web: a loja guarda o endereço em texto livre e o seed o termina em
  // `<Cidade>/<UF>`; sai quando a API trouxer cidade e UF como campos próprios.
  static final _addressTail = RegExp(
    r'(?:^|[,–\-|])\s*([^,–\-|/]+?)\s*\/\s*([A-Za-z]{2})\s*$',
  );

  /// Lê `<Cidade>/<UF>` do fim do endereço; `null` quando o endereço é nulo,
  /// vazio ou fora desse formato (nunca um valor chutado).
  static CityState? fromAddressTail(String? address) {
    final match = _addressTail.firstMatch((address ?? '').trim());
    if (match == null) return null;

    final city = match.group(1)!.trim();
    if (city.isEmpty) return null;

    return CityState(city: city, state: match.group(2)!.toUpperCase());
  }

  /// `"São Paulo/SP"`.
  String get label => '$city/$state';

  @override
  bool operator ==(Object other) =>
      other is CityState && other.city == city && other.state == state;

  @override
  int get hashCode => Object.hash(city, state);

  @override
  String toString() => 'CityState($label)';
}
