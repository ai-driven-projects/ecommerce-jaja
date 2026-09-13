import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { categoryFromDetails, decodeEntities, htmlToText, parseDepartments, parseGroups, parseImages, parseListing, parsePagination, parsePrice, parseProductPage, slugFromUrl } from './parse.js';

describe('parsePrice', () => {
  it('lê valores em reais com milhar e centavos', () => {
    assert.equal(parsePrice('R$ 1.039,51'), 1039.51);
    assert.equal(parsePrice(' R$ 7,90 '), 7.9);
    assert.equal(parsePrice('De: R$ 1.195,08'), 1195.08);
    assert.equal(parsePrice('sem preço'), null);
    assert.equal(parsePrice(null), null);
  });
});

describe('decodeEntities / htmlToText', () => {
  it('decodifica entidades e remove tags', () => {
    assert.equal(decodeEntities('Artes &amp; Pintura &#34;x&#34; &eacute; &Eacute;'), 'Artes & Pintura "x" é É');
    assert.equal(htmlToText('<b>Características</b><p>Linha 1<br>Linha 2</p><ul><li>a</li><li>b</li></ul>'), 'Características\nLinha 1\nLinha 2\na\nb');
  });
});

describe('parseDepartments', () => {
  it('converte o JSON do menu em departamentos ordenados', () => {
    const json = [
      { Classificacao: 17, Descricao: 'Apresentação', DescricaoShort: 'Apresentação', Id: 43, LinkMenu: 'https://www.kalunga.com.br/depto/apresentacao/17', Ordem: 16 },
      { Classificacao: 2, Descricao: 'Escolar', DescricaoShort: 'Escolar', Id: 28, LinkMenu: 'https://www.kalunga.com.br/depto/escolar/2', Ordem: 6 },
      { Classificacao: 41, Descricao: 'Outlet', DescricaoShort: 'Outlet', Id: 41, LinkMenu: 'https://www.kalunga.com.br/outlet', Ordem: 99 },
    ];
    const departments = parseDepartments(json);
    assert.deepEqual(departments.map((department) => department.slug), ['escolar', 'apresentacao']);
    assert.equal(departments[0]?.id, 2);
    assert.equal(departments[0]?.menuId, 28);
    assert.equal(slugFromUrl('https://www.kalunga.com.br/depto/artes-pintura/9'), 'artes-pintura');
  });
});

describe('parseGroups', () => {
  it('lê grupos com o departamento real do link e marca destaques', () => {
    const json = {
      menu: [
        { Classificacao: 1, Codigo: 1979, FL_Destaque: false, Id: 54, LinkSubMenu: 'https://www.kalunga.com.br/depto/equipamentos-para-rede/adaptadores-bluetooth/25/1979', NM_Menu: 'Informática', Texto: 'Adaptadores Bluetooth' },
        { Classificacao: 2, Codigo: 8, FL_Destaque: false, Id: 28, LinkSubMenu: 'https://www.kalunga.com.br/depto/escolar/borrachas/2/8', NM_Menu: 'Escolar', Texto: 'Borrachas' },
      ],
      menu_destaque: [{ Classificacao: 2, Codigo: 8, FL_Destaque: true, Id: 28, LinkSubMenu: 'https://www.kalunga.com.br/depto/escolar/borrachas/2/8', Texto: 'Borrachas' }],
    };
    const groups = parseGroups(json);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0], { id: 1979, departmentId: 25, departmentSlug: 'equipamentos-para-rede', slug: 'adaptadores-bluetooth', name: 'Adaptadores Bluetooth', url: json.menu[0]?.LinkSubMenu, highlighted: false });
    assert.equal(groups[1]?.highlighted, true);
  });
});

const CARD = `<div class="blocoproduto   col-6"><div class="blocoproduto__row"><a class="blocoproduto__link h-100" href="/prod/borracha-tecnica-branca-hi-polymer-pentel-bt-1-un/068561" title="Borracha T&eacute;cnica" target="_self"><picture><img class="blocoproduto__image" src="data:image/png;base64,x" data-src="https://img.kalunga.com.br/fotosdeprodutos/068561.jpg"></picture></a><a class="blocoproduto__link" href="/prod/borracha-tecnica-branca-hi-polymer-pentel-bt-1-un/068561" title="x"><h2 class="blocoproduto__title mb-0">Borracha Técnica Branca Hi-Polymer, Pentel - BT 1 UN</h2></a><div class="stars"><i class="reviews__star_icon fa fa-star text-warning"></i><i class="reviews__star_icon fa fa-star text-warning"></i><i class="fa fa-star-half-alt text-warning"></i><span class="reviews__star_text ps-2">(30)</span></div><div class="blocoproduto__box"><span class="blocoproduto__text--bold">De: R$ 9,90</span><span class="blocoproduto__text blocoproduto__text--bold blocoproduto__price">R$ 7,90</span><button onclick="Comprar('068561')">Comprar</button></div></div></div>`;

describe('parseListing / parsePagination', () => {
  it('extrai id, nome, imagem, preços e avaliação de cada card, sem repetir', () => {
    const products = parseListing(CARD + CARD);
    assert.equal(products.length, 1);
    assert.deepEqual(products[0], {
      id: '068561',
      slug: 'borracha-tecnica-branca-hi-polymer-pentel-bt-1-un',
      url: 'https://www.kalunga.com.br/prod/borracha-tecnica-branca-hi-polymer-pentel-bt-1-un/068561',
      name: 'Borracha Técnica Branca Hi-Polymer, Pentel - BT 1 UN',
      image: 'https://img.kalunga.com.br/fotosdeprodutos/068561.jpg',
      price: 7.9,
      listPrice: 9.9,
      rating: { stars: 2.5, count: 30 },
    });
  });

  it('sem avaliações a nota fica nula', () => {
    const [product] = parseListing(CARD.replace('(30)', '(0)'));
    assert.equal(product?.rating, null);
  });

  it('lê total, tamanho e número de páginas', () => {
    const template = `<ul><li><a data-page='1'>1</a></li><li><a onclick="montarPaginacao(this, 552,60,6, false, &#34;ObterProdutosPorPagina&#34;)">...</a></li><li><a data-page="10">ultima</a></li></ul>`;
    assert.deepEqual(parsePagination(template), { total: 552, pageSize: 60, pages: 10 });
    assert.deepEqual(parsePagination(`<a data-page='1'>1</a><a data-page='3'>ultima</a>`), { total: null, pageSize: 60, pages: 3 });
    assert.deepEqual(parsePagination(''), { total: null, pageSize: 60, pages: 1 });
  });
});

const PRODUCT_HTML = `
<input id="hdnProduto" value="145877"><input id="txtSku" value="145877"><input id="txtDescSku" value="Caixa de som">
<input id="hdnDsDepartamento" value="Inform&aacute;tica"><input id="txtDePor" value="De: R$ 1.195,08"><input id="txtPrecoVista" value="R$ 1.039,51">
<input id="txtParcelamento" value="10x de R$ 112,99"><input id="txtTotalPrazo" value="R$ 1.129,90">
<a class="headerprodutosinfos__link marca-produto" href="/marca/jbl/88315379/0001" title="JBL">JBL</a>
<h1 class="headerprodutosinfos__title" id="h5produtoDescricao">Caixa de som bluetooth Charge 6, Jbl CX 1 UN</h1>
<img src="https://img.kalunga.com.br/fotosdeprodutos/145877d.jpg"><a href="https://img.kalunga.com.br/fotosdeprodutos/145877z.jpg"></a>
<img src="https://img.kalunga.com.br/fotosdeprodutos/145877d_2.jpg"><a href="https://img.kalunga.com.br/FotosdeProdutos/145877z_2.jpg"></a>
<img src="https://img.kalunga.com.br/fotosdeprodutos/145877d_1.jpg"><img src="https://img.kalunga.com.br/fotosdeprodutos/999999d.jpg">
<div class="descricaoproduto" id="descricao-produto"><div class="descricaoproduto__item" id="descricaoPadrao" itemprop="description"><b>Características</b><p onclick="x()" style="a">Som <strong>potente</strong>.</p><script>bad()</script></div></div>
<button class="btn btn-comprar" onclick="Comprar('145877')">Comprar</button>
<div id="datalayerGA4" class="d-none"> [{"event": "view_item", "ecommerce": {"currency": "BRL", "value": 1129.9, "items": [{"item_id": "145877", "item_name": "Caixa", "item_brand": "JBL", "item_category": "Inform\\u00e1tica/Caixas de Som Bluetooth/20 a 49 Watts", "price": 1129.9}]}}] </div>`;

describe('parseProductPage', () => {
  it('lê marca, nome, preços, parcelamento, imagens ordenadas, descrição e disponibilidade', () => {
    const page = parseProductPage(PRODUCT_HTML);
    assert.equal(page.id, '145877');
    assert.equal(page.name, 'Caixa de som bluetooth Charge 6, Jbl CX 1 UN');
    assert.deepEqual(page.brand, { id: '88315379', name: 'JBL', slug: 'jbl', url: 'https://www.kalunga.com.br/marca/jbl/88315379/0001' });
    assert.equal(page.department, 'Informática');
    assert.equal(page.categoryPath, 'Informática/Caixas de Som Bluetooth/20 a 49 Watts');
    assert.deepEqual(page.price, { current: 1039.51, list: 1195.08, installments: { count: 10, amount: 112.99, total: 1129.9 }, currency: 'BRL' });
    assert.deepEqual(page.images, [
      { thumb: 'https://img.kalunga.com.br/fotosdeprodutos/145877d.jpg', large: 'https://img.kalunga.com.br/fotosdeprodutos/145877z.jpg' },
      { thumb: 'https://img.kalunga.com.br/fotosdeprodutos/145877d_1.jpg', large: null },
      { thumb: 'https://img.kalunga.com.br/fotosdeprodutos/145877d_2.jpg', large: 'https://img.kalunga.com.br/fotosdeprodutos/145877z_2.jpg' },
    ]);
    assert.equal(page.description?.html, '<b>Características</b><p>Som <strong>potente</strong>.</p>');
    assert.equal(page.description?.text, 'Características\nSom potente.');
    assert.equal(page.available, true);
  });

  it('usa o preço único (#precovenda) quando não há desconto', () => {
    const page = parseProductPage(`<input id="txtSku" value="1"><p class="produtoinfos__price h3" id="precovenda"> R$ 7,90 </p>`);
    assert.deepEqual(page.price, { current: 7.9, list: null, installments: null, currency: 'BRL' });
    assert.equal(page.available, false);
    assert.deepEqual(parseImages('', null), []);
  });
});

describe('categoryFromDetails', () => {
  it('prefere o JSON de detalhes e cai no caminho do GA4', () => {
    assert.deepEqual(categoryFromDetails({ produto: { Classificacao: 'Escolar', Grupo: 'Borrachas', SubGrupo: 'Técnicas' } }, null), { department: 'Escolar', group: 'Borrachas', subgroup: 'Técnicas', path: 'Escolar/Borrachas/Técnicas' });
    assert.deepEqual(categoryFromDetails(null, 'Informática/Caixas'), { department: 'Informática', group: 'Caixas', subgroup: null, path: 'Informática/Caixas' });
  });
});
