/// Os raios do `@theme` do `globals.css`, com o nome do web. Atenção: lá o
/// `@theme` sobrescreve o Tailwind, então `xl` = 14 e `xl2` (`rounded-2xl`) = 18.
/// Campo usa `xl`, card usa `xl2`, área de imagem do card usa `xl`.
class AppRadius {
  AppRadius._();

  static const double xs = 6;
  static const double sm = 8;
  static const double md = 10;
  static const double lg = 12;
  static const double xl = 14;
  static const double xl2 = 18;
  static const double xl3 = 20;
  static const double xl4 = 24;
  static const double pill = 999;
}
