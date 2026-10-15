## Context

A etapa 1 deixou `apps/mobile` com `CLAUDE.md`, `lib/core` (`Result`, `Command`, `AppFailure`, `Money`, ambiente), um `lib/main.dart` com `MaterialApp` sem tema e a barreira de imports (`test/core/architecture_test.dart` + `test/core/support/import_rules.dart`, regras A e B). Não existe `lib/ui` nem `assets/`. Dependências: só `build_runner` e `analyzer` (dev).

Fontes de valor visual (só leitura): `apps/frontend/src/app/globals.css` (tokens), `apps/frontend/DESIGN.md` (uso dos tokens) e os componentes do web em `apps/frontend/src/shared/components/{ui/button,ui/badge,ui/input,ui/empty-list-state,store/price,store/product-card,store/product-art,store/category-chips}.tsx`, além de `shared/util/price.util.ts`. O app modelo da plataforma (`/Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile`, só leitura) serve de desenho para `lib/ui/shared/theme/` (`app_fonts`, `app_radius`, `brand_tokens`, `app_typography`, `app_button_styles`, `app_theme`) e para a barreira anti-inline (`test/core/support/inline_style_rules.dart`); valores e nomes de cor vêm do Jajá, não de lá.

**Conflito encontrado:** a spec `openspec/specs/shared/design-system` descreve um visual antigo (vermelho `#ec3013`, Archivo, IBM Plex Mono, cantos retos, sem sombra) que o web não usa mais; `globals.css`, `DESIGN.md` e os componentes descrevem o visual atual (laranja, Manrope, pílulas, raio 18). O app segue o código do web; a spec do web não é alterada (outro domínio).

## Goals / Non-Goals

**Goals:** fontes empacotadas; tema claro único com tokens copiados; formatação de preço; os oito componentes base; regra de estilo na barreira; testes de tudo.

**Non-Goals (ficam para outras etapas):**
- `cached_network_image` e o mapa slug da categoria raiz → emoji/tom (`category-art.ts`) — etapa 5 (home), que troca o `Image.network` do card.
- Botão "+" e stepper de quantidade do card — etapa 9 (carrinho); aqui o card só tem o espaço da ação.
- Tema da barra de abas, de `AppBar`, de bottom sheet e regra da barreira sobre `AppBar` — etapas 3, 4 e 6, quando esses elementos nascerem.
- Preço grande do detalhe (Bricolage 34) — etapa 7. Busca em pílula — etapa 6.
- Logo/wordmark e ícone nativo — fora desta etapa (o plano não os lista).

## Decisions

### 1. Fontes a partir de cópias locais
Não há download permitido. Os arquivos já existem na máquina e são OFL:
- Manrope variável (v4.504): `/Applications/Wispr Flow.app/Contents/Resources/assets/fonts/Manrope/Manrope-VariableFont_wght.ttf` → `assets/fonts/Manrope[wght].ttf`.
- Bricolage Grotesque variável (v1.001): `/Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile/assets/fonts/BricolageGrotesque[opsz,wdth,wght].ttf` → mesmo nome em `assets/fonts/`.
- Licenças: `/Users/leonardomleitao/Desktop/1-projetos/git/ai-driven-projects/zen-loop/src/ZenLoop.App/Assets/Fonts/OFL-bricolagegrotesque.txt` → `assets/fonts/OFL-BricolageGrotesque.txt`; `assets/fonts/OFL-Manrope.txt` é o mesmo texto com a primeira linha trocada pelo copyright gravado na própria fonte: `Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope)`.

Se algum arquivo de origem não existir no apply, a tarefa para e registra aqui (não há alternativa sem download).

No `pubspec.yaml`, cada família declara o mesmo `.ttf` para cada peso usado (Manrope 400/600/700/800; Bricolage 700/800), como o modelo: sem a entrada, o peso cai no vizinho e vira negrito sintético. Os estilos do tema passam também `fontVariations: [FontVariation('wght', peso)]`, que é quem move o eixo da fonte variável. Os nomes de família ficam em constantes iguais ao `family:` do pubspec (nome errado cai na fonte do sistema sem erro).

### 2. Tokens: `ThemeExtension` para cor e sombra, constantes para raio e espaço
- As cores de `:root` do `globals.css` viram constantes com o nome do token (`paper`, `card`, `surface`, `surfaceStrong`, `line`, `ink`, `inkSoft`, `mutedInk`, `placeholder`, `brand`, `brandStrong`, `brandLink`, `brandLight`, `brandSoft`, `brandPale`, `success*`, `warning*`, `danger*`, `dark`, `darkMuted`, `darkLine`, `darkSurface`, `tint*`), e um `BrandTokens extends ThemeExtension` as expõe com `copyWith`/`lerp`, junto com as sombras `card`, `brand`, `float` e `badge` (`List<BoxShadow>`, valores do `globals.css`). Fica de fora o que o app não usa: `--map` (sem mapa), `--shadow-drawer` (sem gaveta), `--shadow-deep` e os aliases semânticos/`chart-*`. `rgba(255,255,255,0.08)` e `0.1` viram `Color` com alfa; nenhuma cor do web usa `color-mix`, então nada precisou ser resolvido.
- Duas cores literais de componentes do web entram como token com a origem no comentário: `dangerStrong #B02F27` (pressionado do botão de perigo, `button.tsx`) e branco `onBrand #FFFFFF` (`--primary-foreground`).
- Acesso nas telas por uma extensão `context.tokens` (lê `Theme.of(context).extension<BrandTokens>()!`).
- Raios em constantes estáticas com os valores do `@theme`: 6, 8, 10, 12, 14, 18, 20, 24, 999. **Atenção:** no web, `rounded-xl` = 14 e `rounded-2xl` = 18 (o `@theme` sobrescreve o Tailwind). Campo usa 14 (como `input.tsx`, embora o `DESIGN.md` diga 12), card 18, área de imagem 14.
- Espaçamento em constantes múltiplas de 4 (o `--spacing` padrão do Tailwind 4), mais 10, 14 e 18, que os componentes do web usam. A barreira não proíbe espaçamento literal (o plano fala de cor e estilo).

### 3. Tema
`AppTheme.light()` devolve `ThemeData(useMaterial3: true)` com `ColorScheme` claro montado à mão (não `fromSeed`, que inventaria tons): `primary` laranja/`onPrimary` branco, `surface` cartão/`onSurface` tinta, `onSurfaceVariant` cinza, `outline`/`outlineVariant` linha, `error` perigo/`onError` branco, `surfaceContainer*` superfície; `scaffoldBackgroundColor` papel; `fontFamily` Manrope; `extensions: [BrandTokens.light]`; `inputDecorationTheme` e os temas de botão. O `MaterialApp` recebe só `theme` e `themeMode: ThemeMode.light`, sem `darkTheme`.

Escala (de `DESIGN.md` e das classes Tailwind dos componentes): `displaySmall` Bricolage 800/30 (título de página), `headlineSmall` Bricolage 800/24 (seção), `titleLarge` Bricolage 800/20 (vazio), todos com `letterSpacing` −0.3; `titleMedium` Manrope 800/16 (preço do card); `titleSmall` Manrope 700/14, altura 1.35 (nome no card); `bodyLarge` 400/15; `bodyMedium` 400/14, altura 1.45 (corpo); `bodySmall` 400/12.5 (unidade, legendas); `labelLarge` 800/14 (botão); `labelMedium` 700/13.5 (chip, rótulo de campo em 13 via `copyWith`); `labelSmall` 800/11.5 (selo). Preço com `FontFeature.tabularFigures()`.

### 4. Preço
`formatMoney(Money)` em `lib/ui/shared/formatters/` usa `NumberFormat.currency(locale: 'pt_BR', symbol: 'R$', decimalDigits: 2)` e troca o espaço não separável (U+00A0) que o `intl` coloca depois de `R$` por espaço comum, para o texto ser idêntico ao `formatPrice` do web (e aos testes, que comparam strings). `NumberFormat` não exige inicialização de locale. Formatação fica na UI (regra do `CLAUDE.md`); `core` não ganha `intl`. O widget de preço segue `price.component.tsx`: anterior riscado (600, 12.5, placeholder) antes do atual (800, tabular; laranja quando há anterior maior), e aceita um estilo do tema para o preço atual.

### 5. Componentes
Seguem os componentes do web, adaptados ao toque (sem hover):
- **Botão:** variantes `primary`/`secondary`/`outline`/`ghost`/`danger` e tamanhos 36/40/48/52 (`sm`/`default`/`lg`/`xl` do `button.tsx`), pílula, texto `labelLarge`, ícone opcional à esquerda e opção de largura total. Os `ButtonStyle` de cada variante vivem em `ui/shared/theme/` (a barreira proíbe `styleFrom` em widgets); o pressionado usa a cor de hover do web (`brandStrong`, `surfaceStrong`, `surface`, `dangerStrong`). A sombra da marca do primário vem de um `DecoratedBox` em pílula, porque `ButtonStyle` não aceita `BoxShadow`. Indisponível = opacidade 0.5 (`disabled:opacity-50`) e sem sombra. Sem spinner: estado "enviando" é o rótulo que a tela troca ("Confirmando…").
- **Campo:** rótulo acima (13/700, `inkSoft`, como o checkout), `TextField` com o `inputDecorationTheme` (fundo branco, borda 1.5 linha, foco laranja, erro perigo, raio 14, altura 44, padding horizontal 14, placeholder `#B8AFA4`), mensagem de erro abaixo. Repassa `controller`, `onChanged`, `keyboardType`, `textInputAction`, `obscureText`, `maxLength`, `enabled`, `autofillHints`.
- **Chip:** feito à mão (não `FilterChip`, que impõe forma e cheque) segundo `category-chips.component.tsx`: pílula com borda, `labelMedium`, emoji e contagem opcionais, tamanhos médio e pequeno; `Semantics(selected:, button: true)`.
- **Card de produto:** recebe valores de apresentação, não entidade (o domínio `catalog` nasce na etapa 5): nome, unidade, preço, preço anterior, `discountPercent` (a API já manda, `storefront-product.dto.ts`; o card não calcula), destaque, URL da foto, emoji e tom de reserva (enum dos seis tons pastéis, padrão 🛒 + verde), `onTap` e `action` opcional. Foto com `Image.network` (`BoxFit.contain`, respiro de 8 sobre branco) e `errorBuilder` para a reserva. Selo único no canto: `−N%` (laranja sólido, texto branco) ou "Destaque" (texto laranja sobre branco, sombra `badge`). Nome `titleSmall` em até 3 linhas com reticências e `Semantics(label: nome completo)`.
- **Skeleton:** `Container` estático em `surface` com raio de token; `Semantics(label: 'Carregando')`. Sem `AnimationController`.
- **Banner de erro:** recebe `AppFailure` e `onRetry`; fundo `dangerSoft`, raio 18, título padrão "Não foi possível carregar." (substituível), a `failure.message` em `inkSoft` e o botão contorno pequeno "Tentar de novo".
- **Estado vazio:** emoji (padrão 📦, como `empty-list-state.tsx`) em 40, título `titleLarge`, explicação `bodyMedium` em cinza e um único botão contorno com rótulo e ação obrigatórios; cartão branco, raio 18.

### 6. Barreira de estilo (regra C)
Novo `test/core/support/inline_style_rules.dart`, no molde do modelo: `parseString` do `analyzer` e um visitor na árvore (string e comentário não são expressão, quebra de linha não importa). Escopo: arquivos `.dart` sob `lib/ui` cujo caminho tenha um segmento `pages` ou `widgets`; `lib/ui/shared/theme` nunca entra. Violações, cada uma com remédio na mensagem:
- `Color(...)`/`Color.fromARGB|fromRGBO|from` — sem `const` o parser sem resolução gera `MethodInvocation`, com `const` gera `InstanceCreationExpression`: tratar os dois;
- `Colors.<x>` com `x != transparent`;
- `TextStyle(...)` e o argumento nomeado `fontSize:`;
- `Radius.circular` e `BorderRadius.circular` com literal numérico (inteiro ou decimal) como argumento;
- `<Qualquer>.styleFrom(...)`.

O teste real escaneia `lib/ui` e exige ao menos um arquivo; testes sintéticos via `scanSourceForInlineStyle(filePath:, source:)`. Reaproveita `dartFilesIn` de `import_rules.dart`.

### 7. `main.dart` e `CLAUDE.md`
`main.dart` continua mínimo (a etapa 3 o troca), agora com `theme: AppTheme.light()` e um `Scaffold` vazio. No `CLAUDE.md`, só acréscimos: na seção "Design visual", onde ficam tokens, `context.tokens`, raios/espaços e `formatMoney`, a regra C ativa e o conflito com a spec do web; em "Estado atual", uma frase dizendo que o tema e os componentes base existem.

## Decisões tomadas sem consulta

- Fontes copiadas de cópias locais (Decisão 1), incluindo a Manrope de dentro de um app instalado (OFL permite redistribuição); o texto OFL da Manrope é montado a partir do OFL da Bricolage com o copyright lido da própria fonte.
- O visual atual do web (`globals.css`, `DESIGN.md`, componentes) prevalece sobre a spec `shared/design-system` desatualizada; a spec do web não é tocada.
- Nova capacidade `mobile/mobile-design-system`; a regra de estilo entra como requisito novo em `mobile/mobile-architecture`.
- Raio do campo 14 (código do web), não 12 (texto do `DESIGN.md`).
- Estado vazio com borda contínua, não tracejada (`border-dashed` do web): Flutter não tem borda tracejada nativa e pintar uma seria código sem ganho nesta etapa.
- Card com `Image.network` até a etapa 5 trazer `cached_network_image`; card recebe valores de apresentação e `discountPercent` pronto.
- `formatMoney` em `lib/ui/shared/formatters/` (pasta nova em `ui/shared`, fora de `pages/`/`widgets/`).
- Título padrão do banner de erro "Não foi possível carregar.".
- Barreira de estilo também proíbe `fontSize:` e `styleFrom` (tamanhos vêm da escala; estilo de botão, do tema); espaçamento literal continua permitido.
- Sem regra de "token sem leitor" (o modelo tem): muitos tokens só ganham consumidor nas etapas seguintes.

## Risks / Trade-offs

- [`Image.network` em widget test depende do cliente HTTP falso do `flutter_test`, que responde 400] → o teste de foto que falha usa `tester.runAsync` + `pump`; se ainda assim for instável, o teste chama a reserva com `imageUrl` nulo e verifica só a presença do `Image` com a URL, registrando aqui.
- [Fonte variável sem `fontVariations` renderiza no peso padrão] → a escala sempre passa o eixo `wght`; teste do tema confere família e peso de cada estilo.
- [Widget tests não usam as fontes reais (o `flutter_test` usa fonte de teste)] → a presença das fontes é verificada pelo teste do `pubspec.yaml` e dos arquivos; a aparência real fica fora do escopo (sem dispositivo).
- [`intl` pode pedir versão compatível com o SDK] → `flutter pub add intl` resolve sozinho; nunca `pub upgrade`.
- [Regra C por segmento de caminho depende da convenção de pastas] → é a convenção do `CLAUDE.md`; páginas e widgets fora de `pages/`/`widgets/` já violam a regra de organização.
