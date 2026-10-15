## Why

O app mobile já tem projeto, regras e `lib/core` (etapa 1), mas nenhuma tela pode nascer sem a marca: hoje o `MaterialApp` não tem tema, fontes nem componentes, e a regra "nenhuma cor ou estilo literal em `pages/` e `widgets/`" do `CLAUDE.md` ainda não é verificada. Esta é a etapa 2 de 15 do loop `mobile-app`: entrega o tema da marca Jajá e os componentes base que todas as telas do catálogo, do carrinho e do pedido vão compor, e liga a barreira que impede estilo fora do tema.

## What Changes

- Fontes **Manrope** e **Bricolage Grotesque** (variáveis, `.ttf`) em `apps/mobile/assets/fonts/`, com a licença OFL de cada uma, declaradas no `pubspec.yaml`. Os arquivos vêm de cópias locais já presentes na máquina; nada é baixado.
- Tema Material 3 claro e único (sem tema escuro, como o web) e um `ThemeExtension` de tokens da marca com os valores de `apps/frontend/src/app/globals.css` e `apps/frontend/DESIGN.md`: cores de superfície, texto, marca, estados, escuro e tons pastéis, sombras, raios e a escala tipográfica.
- Formatação de dinheiro na UI: `Money` → `R$ 1.290,90` com `intl` pt-BR, idêntico ao `formatPrice` do web.
- Componentes base em `lib/ui/shared/widgets/`: botão em pílula (primário, secundário, contorno, fantasma, perigo), campo de texto com rótulo e erro, preço (com preço "De:" riscado), chip de filtro, card de produto (área de imagem com reserva em emoji, selo único, nome, unidade, preço e espaço para ação), skeleton estático, banner de erro com "Tentar de novo" e estado vazio com uma ação.
- O `main.dart` mínimo passa a usar o tema da marca.
- A barreira de arquitetura ganha a regra de estilo: em `pages/` e `widgets/` de `lib/ui`, nenhuma cor literal (`Color(...)`, `Colors.*` exceto `transparent`), `TextStyle(...)`, `fontSize`, raio numérico literal nem `styleFrom`.
- Widget tests de cada componente, testes do tema, da formatação e das novas regras da barreira; o `CLAUDE.md` do app ganha as decisões desta etapa.

## Capabilities

### New Capabilities
- `mobile/mobile-design-system`: tema da marca no app (fontes, cores, raios, sombras, tipografia), formatação de preço e o comportamento visual dos componentes base compartilhados.

### Modified Capabilities
- `mobile/mobile-architecture`: acrescenta o requisito da barreira de estilo (cor, tipografia e raio só do tema em páginas e widgets); os requisitos existentes não mudam.

## Impact

- **Código:** só `apps/mobile/**` (`assets/fonts/`, `pubspec.yaml`, `lib/ui/shared/{theme,formatters,widgets}`, `lib/main.dart`, `CLAUDE.md`, `test/ui/shared/**`, `test/core/architecture_test.dart` e `test/core/support/`).
- **Dependências:** `intl` (via `flutter pub add intl`). Nenhuma outra; `cached_network_image` fica para a etapa 5.
- **Assets:** ~575 KB de fontes commitadas com as licenças OFL.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
