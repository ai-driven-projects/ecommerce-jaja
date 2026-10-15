import 'product_query.dart';

// Codificação única dos filtros de produtos, usada tanto na chamada da API
// quanto nas rotas internas do app (`/search?…`). Os nomes das chaves são os
// que o `StorefrontController` (`apps/backend/src/modules/catalog/
// storefront.controller.ts`) aceita; a ida espelha `listStorefrontProducts`
// em `apps/frontend/src/modules/catalog/data/storefront.api.ts` e a volta
// espelha a normalização do controller, que ignora valor inválido em silêncio.

final _digitsOnly = RegExp(r'^\d+$');

/// Só os filtros definidos: `search` sem espaços nas pontas e omitido quando
/// vazio; `onSale`/`featured` só quando verdadeiros; marcas separadas por
/// vírgula.
Map<String, String> encodeProductQuery(ProductQuery query) {
  final params = <String, String>{};
  final search = query.search?.trim() ?? '';
  final brands = query.brandSlugs.where((slug) => slug.isNotEmpty).toList();

  if (query.page != null) params['page'] = '${query.page}';
  if (query.pageSize != null) params['pageSize'] = '${query.pageSize}';
  if (search.isNotEmpty) params['search'] = search;
  if (query.categorySlug case final category? when category.isNotEmpty) {
    params['category'] = category;
  }
  if (brands.isNotEmpty) params['brand'] = brands.join(',');
  if (query.minPriceCents != null) {
    params['minPriceCents'] = '${query.minPriceCents}';
  }
  if (query.maxPriceCents != null) {
    params['maxPriceCents'] = '${query.maxPriceCents}';
  }
  if (query.onSale) params['onSale'] = 'true';
  if (query.featured) params['featured'] = 'true';
  if (query.sort case final sort?) params['sort'] = sort.apiValue;

  return params;
}

/// Inversa de [encodeProductQuery]. Chave desconhecida, `page`/`pageSize`
/// que não sejam inteiros ≥ 1, centavos negativos ou não inteiros, `sort`
/// desconhecido e `onSale`/`featured` diferentes de `true` são ignorados.
ProductQuery decodeProductQuery(Map<String, String> params) {
  return ProductQuery(
    page: _positiveInteger(params['page']),
    pageSize: _positiveInteger(params['pageSize']),
    search: _text(params['search']),
    categorySlug: _text(params['category']),
    brandSlugs: _slugs(params['brand']),
    minPriceCents: _cents(params['minPriceCents']),
    maxPriceCents: _cents(params['maxPriceCents']),
    onSale: params['onSale'] == 'true',
    featured: params['featured'] == 'true',
    sort: ProductSort.fromApiValue(params['sort']),
  );
}

String? _text(String? value) {
  final text = value?.trim() ?? '';
  return text.isEmpty ? null : text;
}

List<String> _slugs(String? value) {
  if (value == null) return const [];
  return List.unmodifiable(
    value
        .split(',')
        .map((slug) => slug.trim())
        .where((slug) => slug.isNotEmpty),
  );
}

/// Inteiro ≥ 0 escrito só com dígitos, como o `cents` do controller.
int? _cents(String? value) {
  final text = value?.trim() ?? '';
  if (!_digitsOnly.hasMatch(text)) return null;
  return int.tryParse(text);
}

/// Inteiro ≥ 1 escrito só com dígitos, como o `positiveInteger` do controller.
int? _positiveInteger(String? value) {
  final parsed = _cents(value);
  return parsed == null || parsed < 1 ? null : parsed;
}
