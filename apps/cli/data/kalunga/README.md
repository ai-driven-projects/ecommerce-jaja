# Dados raspados da Kalunga

Gerados pelo CLI (`npm run cli -- scrape:products`). Não edite à mão: cada execução regrava os
arquivos das categorias escolhidas e reconstrói `brands.json` e `index.json`.

```
data/kalunga/
  index.json              resumo: categorias gravadas, quantidade de produtos e de marcas
  brands.json             marcas consolidadas de todas as categorias (id = CNPJ do fornecedor no site)
  categories/<slug>.json  uma categoria (departamento do site) com seus grupos e produtos
```

Cada produto traz: id/slug/url, nome, marca, caminho de categoria (departamento/grupo/subgrupo),
preços (à vista, "De:", parcelamento), imagens (miniatura e zoom), descrição (HTML sanitizado e
texto), avaliação, disponibilidade e data da coleta.

Estes arquivos são a matéria-prima do scraper; o backend não os lê. `npm run cli -- scrape:seed` (e o
próprio `scrape:products`, ao terminar) os converte em `apps/backend/prisma/seed/data/brands.json`,
`categories.json` e `products.json`, já no formato do banco.
