/// "1 produto" / "24 produtos", como `formatProductCount` de
/// `storefront-product-grid.component.tsx` no web.
String formatProductCount(int count) =>
    '$count ${count == 1 ? 'produto' : 'produtos'}';
