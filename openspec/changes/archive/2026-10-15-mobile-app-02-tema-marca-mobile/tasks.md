> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` e as specs `mobile/mobile-design-system` e `mobile/mobile-architecture` desta change. Valores visuais: `apps/frontend/src/app/globals.css`, `apps/frontend/DESIGN.md` e os componentes do web citados no Context do design (só leitura).
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; dependências só por `flutter pub add` (nunca `pub upgrade`); nada de download, `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`.

## 1. Fontes e dependência

- [x] 1.1 Copiar as duas fontes e o OFL da Bricolage das origens locais da Decisão 1 para `apps/mobile/assets/fonts/` com os nomes do design; criar `OFL-Manrope.txt` (mesmo texto, primeira linha com o copyright da Manrope). Verificar com `ls -l` (arquivos não vazios).
- [x] 1.2 Declarar no `pubspec.yaml` as famílias `Manrope` (400, 600, 700, 800) e `Bricolage Grotesque` (700, 800) apontando para os `.ttf`, com um comentário curto sobre fonte variável.
- [x] 1.3 `cd apps/mobile && flutter pub add intl`; conferir no `pubspec.yaml` e rodar `flutter pub get` sem erro.
- [x] 1.4 Criar `lib/ui/shared/theme/app_fonts.dart` com as constantes de família idênticas ao `family:` do pubspec.
- [x] 1.5 Teste `test/ui/shared/theme/app_fonts_test.dart`: lê o `pubspec.yaml` como texto e confere que cada família de `app_fonts.dart` está declarada, que cada asset citado existe e não está vazio e que há `OFL-Manrope.txt` e `OFL-BricolageGrotesque.txt`.

## 2. Tokens e tema

- [x] 2.1 Criar `lib/ui/shared/theme/app_colors.dart` com as cores de `:root` do `globals.css` (lista e exclusões da Decisão 2), mais `dangerStrong` e `onBrand` com a origem comentada.
- [x] 2.2 Criar `lib/ui/shared/theme/app_radius.dart` (6, 8, 10, 12, 14, 18, 20, 24, 999) e `app_spacing.dart` (múltiplos de 4, mais 10, 14 e 18).
- [x] 2.3 Criar `lib/ui/shared/theme/brand_tokens.dart`: `BrandTokens extends ThemeExtension` com as cores e as sombras `card`, `brand`, `float`, `badge`, `copyWith`, `lerp`, a instância `light` e a extensão `context.tokens`.
- [x] 2.4 Criar `lib/ui/shared/theme/app_typography.dart` com o `TextTheme` da Decisão 3 (famílias, pesos com `fontVariations`, tamanhos, alturas, `letterSpacing` −0.3 nos títulos Bricolage).
- [x] 2.5 Criar `lib/ui/shared/theme/app_button_styles.dart` (`ButtonStyle` por variante e tamanho, Decisão 5) e `app_theme.dart` com `AppTheme.light()` (`ColorScheme` à mão, papel no scaffold, Manrope, extensão, `inputDecorationTheme`, temas de botão).
- [x] 2.6 Em `lib/main.dart`, passar `theme: AppTheme.light()` e `themeMode: ThemeMode.light` (sem `darkTheme`) com um `Scaffold` vazio; ajustar `test/main_test.dart` para conferir que o tema tem `BrandTokens`.
- [x] 2.7 Testes em `test/ui/shared/theme/`: tokens com os hex da spec (linha, sucesso, perigo, pêssego, laranja, papel, tinta) e os raios; `lerp` entre iguais devolve os mesmos valores; primária `#FF6B00` com `onPrimary` branco; scaffold `#FAF8F5`.
- [x] 2.8 Testes da tipografia e do modo escuro: corpo em Manrope e títulos (`displaySmall`, `headlineSmall`, `titleLarge`) em Bricolage 800 com `letterSpacing` negativo; com `platformBrightness` escuro, `Theme.of` continua claro e o fundo é `#FAF8F5`.

## 3. Preço

- [x] 3.1 Criar `lib/ui/shared/formatters/money_formatter.dart` com `formatMoney(Money)` (Decisão 4, troca do U+00A0 por espaço comum).
- [x] 3.2 Testes em `test/ui/shared/formatters/money_formatter_test.dart`: 1290 → `R$ 12,90`, 50 → `R$ 0,50`, 0 → `R$ 0,00`, 129090 → `R$ 1.290,90`, 10000000 → `R$ 100.000,00`; nenhum resultado contém U+00A0.
- [x] 3.3 Criar `lib/ui/shared/widgets/price_text.dart` (preço atual, anterior opcional riscado só quando maior, laranja em oferta, algarismos tabulares, estilo opcional do tema).
- [x] 3.4 Criar `test/ui/shared/support/themed.dart` (envolve um widget em `MaterialApp` com `AppTheme.light()` e `Scaffold`) e testes de `price_text`: oferta com riscado em `placeholder` e atual em laranja; anterior igual ou menor é ignorado; sem anterior, cor tinta.

## 4. Botão, campo e chip

- [x] 4.1 Criar `lib/ui/shared/widgets/app_button.dart` com variantes, tamanhos, ícone opcional, largura total, sombra da marca no primário e opacidade 0.5 quando indisponível (Decisão 5).
- [x] 4.2 Testes de `app_button`: primário com fundo `#FF6B00`, texto branco 800 e forma em pílula; cada tamanho com a altura certa; toque chama a ação; sem ação, o toque não faz nada e há `Opacity` 0.5.
- [x] 4.3 Criar `lib/ui/shared/widgets/app_text_field.dart` (rótulo acima, erro abaixo, parâmetros repassados da Decisão 5).
- [x] 4.4 Testes de `app_text_field`: rótulo visível; digitar chama `onChanged`; com erro, a mensagem aparece em `#C93A31` e a borda de erro do `InputDecorator` usa essa cor; `obscureText` repassado.
- [x] 4.5 Criar `lib/ui/shared/widgets/app_chip.dart` (ativo/inativo, emoji e contagem opcionais, tamanhos médio e pequeno, `Semantics` de selecionado).
- [x] 4.6 Testes de `app_chip`: ativo com fundo `#FFF1E6` e texto `#FF6B00`; inativo branco com borda `#EFE9E2`; toque chama `onSelected`; semântica anuncia selecionado; emoji e contagem aparecem.

## 5. Card de produto

- [x] 5.1 Criar o enum dos seis tons pastéis de reserva (mapeado para `BrandTokens`) em `lib/ui/shared/widgets/product_art.dart`, com a área de imagem: foto `Image.network` contida sobre branco ou emoji sobre o tom (padrão 🛒 + verde), `errorBuilder` para a reserva, e o selo como filho opcional.
- [x] 5.2 Criar `lib/ui/shared/widgets/product_card.dart` com as propriedades da Decisão 5: selo único (`−N%` ou "Destaque"), nome em até 3 linhas com `Semantics` do nome completo, unidade, `PriceText`, `action` opcional e `onTap`.
- [x] 5.3 Testes de `product_card`: desconto 19 + destaque mostra `−19%` e não "Destaque", com `R$ 12,90` e `R$ 15,90`; só destaque mostra "Destaque"; sem nenhum, nenhum selo.
- [x] 5.4 Testes de `product_card`: sem foto e sem emoji mostra 🛒; com emoji ☕ e tom pêssego mostra ☕; foto que falha (cliente HTTP do `flutter_test`, via `tester.runAsync`) cai na reserva; nome longo com `maxLines` 3; sem `action`, nada ao lado do preço; com `action`, ela aparece; toque chama `onTap`.

## 6. Estados de tela remota

- [x] 6.1 Criar `lib/ui/shared/widgets/skeleton_box.dart` (bloco estático `surface`, raio de token, `Semantics` "Carregando").
- [x] 6.2 Criar `lib/ui/shared/widgets/state_error_banner.dart` (`AppFailure`, `onRetry`, título padrão "Não foi possível carregar.", botão contorno "Tentar de novo").
- [x] 6.3 Criar `lib/ui/shared/widgets/empty_state.dart` (emoji padrão 📦, título, explicação, um único `AppButton` contorno com rótulo e ação obrigatórios).
- [x] 6.4 Testes do skeleton: cor `#F6F1EA`; depois de `pump(Duration(seconds: 2))`, `tester.hasRunningAnimations` é falso; semântica "Carregando".
- [x] 6.5 Testes do banner: com `NetworkFailure` de mensagem "Sem conexão com a internet." mostra título, mensagem e "Tentar de novo"; um toque chama `onRetry` exatamente uma vez; título substituível.
- [x] 6.6 Testes do estado vazio: mostra emoji, título "Nada por aqui. Já já.", explicação e um único botão "Ver catálogo" (`find.byType(AppButton)` encontra um) que chama a ação.

## 7. Barreira de estilo e CLAUDE.md

- [x] 7.1 Criar `test/core/support/inline_style_rules.dart` (Decisão 6): escopo `pages`/`widgets` sob `lib/ui`, fora de `lib/ui/shared/theme`; violação com arquivo, linha, trecho e remédio; `scanSourceForInlineStyle` e `scanDirectoryForInlineStyle`.
- [x] 7.2 Em `test/core/architecture_test.dart`, acrescentar o teste real da regra C sobre `lib/ui`, exigindo ao menos um arquivo escaneado.
- [x] 7.3 Testes sintéticos de violação: `Color(0x...)`, `const Color(0x...)`, `Color.fromARGB`, `Color.fromRGBO`, `Colors.red`, `TextStyle(...)`, `fontSize: 12`, `BorderRadius.circular(12)`, `Radius.circular(8.5)`, `FilledButton.styleFrom(...)`.
- [x] 7.4 Testes sintéticos aceitos: `Colors.transparent`, `BorderRadius.circular(AppRadius.xl)`, `Colors.red` em comentário e em string, `Color(0xFF...)` em `lib/ui/shared/theme/...`, arquivo de `lib/ui` fora de `pages`/`widgets`.
- [x] 7.5 Provar que a regra morde: acrescentar temporariamente `Colors.red` a um widget de `lib/ui/shared/widgets/`, ver `flutter test test/core/architecture_test.dart` falhar com arquivo e linha, e desfazer.
- [x] 7.6 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 7 pede (tokens, `context.tokens`, raios/espaços, `formatMoney`, regra C ativa, conflito com a spec do web, frase em "Estado atual"), sem apagar regra existente.

## 8. Verificação final

- [x] 8.1 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso.
- [x] 8.2 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 8.3 `cd apps/mobile && flutter test` com todos os testes passando.
- [x] 8.4 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
