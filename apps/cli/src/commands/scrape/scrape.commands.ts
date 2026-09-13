import path from 'node:path';
import type { Command, CommandContext, CommandResult } from '../../core/command.js';
import { menu } from '../../core/wizard.js';
import { ensureDatabaseUp, prisma, requireBackend } from '../db/lib.js';
import { fetchDepartments, fetchGroups, fetchListingPage, fetchProduct, productFromListing } from './kalunga/api.js';
import { createClient, mapLimit, type HttpClient } from './kalunga/client.js';
import { parseRange, planSampling, PRODUCT_RANGES, takeRound, type ProductRange } from './kalunga/sampler.js';
import { buildSeedData, seedDataDir, writeSeedData } from './kalunga/seed/index.js';
import { countProducts, dataDir, readCategories, rebuildSummaries, writeCategory } from './kalunga/store.js';
import type { CategoryFile, KalungaDepartment, KalungaGroup, ListedProduct, ScrapedProduct } from './kalunga/types.js';

const GROUP = 'Catálogo';

function optionNumber(ctx: CommandContext, name: string, fallback: number): number {
  const value = Number(ctx.options[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function newClient(ctx: CommandContext): HttpClient {
  return createClient({ signal: ctx.signal, concurrency: optionNumber(ctx, 'paralelo', 4), minIntervalMs: optionNumber(ctx, 'intervalo-ms', 150) });
}

/** Departamentos escolhidos: `--categorias=escolar,1,informatica` (slug ou id) ou lista interativa. */
async function chooseDepartments(ctx: CommandContext, departments: KalungaDepartment[]): Promise<KalungaDepartment[]> {
  const option = ctx.options.categorias ?? ctx.options.categories;
  if (option) {
    const wanted = option.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    const chosen = departments.filter((department) => wanted.includes(department.slug) || wanted.includes(String(department.id)));
    const unknown = wanted.filter((item) => !chosen.some((department) => department.slug === item || String(department.id) === item));
    if (unknown.length > 0) ctx.report.warn(`Categorias não encontradas: ${unknown.join(', ')}`);
    return chosen;
  }
  const ids = await ctx.pick(
    'Quais categorias raspar?',
    departments.map((department) => ({ id: department.slug, label: department.name, description: `${department.url.replace(/^https?:\/\/[^/]+/, '')} · id ${department.id}` })),
    { multi: true, required: true },
  );
  return departments.filter((department) => ids.includes(department.slug));
}

/** Faixa de produtos por categoria: `--produtos=50-100` (ou um número) ou escolha na lista. */
async function chooseRange(ctx: CommandContext): Promise<ProductRange | null> {
  const option = ctx.options.produtos ?? ctx.options.products;
  if (option) {
    const range = parseRange(option);
    if (!range) ctx.report.error(`Faixa inválida: "${option}". Use um número (80) ou um intervalo (50-100).`);
    return range;
  }
  const [id] = await ctx.pick(
    'Quantos produtos por categoria?',
    PRODUCT_RANGES.map((range) => ({ id: range.id, label: range.label, description: `alvo ${range.max}, aceita a partir de ${range.min}` })),
    { defaults: ['50-100'], required: true },
  );
  return PRODUCT_RANGES.find((range) => range.id === id) ?? null;
}

interface Collected {
  products: ListedProduct[];
  groupOf: Map<string, KalungaGroup | null>;
  groupsSampled: number;
  perGroup: number;
}

/** Amostra os mais vendidos de vários grupos até o alvo; completa com a listagem geral do departamento. */
async function collectProducts(ctx: CommandContext, client: HttpClient, department: KalungaDepartment, groups: KalungaGroup[], range: ProductRange): Promise<Collected> {
  const perGroup = optionNumber(ctx, 'por-grupo', 5);
  const plan = planSampling(groups, range.max, perGroup);
  const collected = new Map<string, ListedProduct>();
  const groupOf = new Map<string, KalungaGroup | null>();
  let groupsUsed = 0;

  for (const group of plan.groups) {
    if (collected.size >= range.max || ctx.signal.aborted) break;
    let page;
    try {
      page = await fetchListingPage(client, { departmentId: group.departmentId, departmentSlug: group.departmentSlug, groupId: group.id });
    } catch (error) {
      ctx.report.detail(`grupo ${group.name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const added = takeRound(collected, page.products, perGroup, range.max);
    for (const product of added) groupOf.set(product.id, group);
    if (added.length > 0) groupsUsed += 1;
    ctx.report.detail(`${group.name}: +${added.length} (${collected.size}/${range.max})`);
  }

  // Reserva: páginas dos mais vendidos do departamento inteiro.
  for (let pageNumber = 1; collected.size < range.max && !ctx.signal.aborted && pageNumber <= 20; pageNumber += 1) {
    const page = await fetchListingPage(client, { departmentId: department.id, departmentSlug: department.slug, page: pageNumber });
    const added = takeRound(collected, page.products, Number.MAX_SAFE_INTEGER, range.max);
    for (const product of added) groupOf.set(product.id, null);
    ctx.report.detail(`departamento página ${pageNumber}: +${added.length} (${collected.size}/${range.max})`);
    if (page.products.length === 0 || pageNumber >= page.pages) break;
  }

  return { products: [...collected.values()], groupOf, groupsSampled: groupsUsed, perGroup };
}

async function scrapeDepartment(ctx: CommandContext, client: HttpClient, department: KalungaDepartment, range: ProductRange, withDetails: boolean): Promise<CategoryFile> {
  const groups = await fetchGroups(client, department);
  ctx.report.info(`${department.name}: ${groups.length} grupo(s) no menu`);
  const { products, groupOf, groupsSampled, perGroup } = await collectProducts(ctx, client, department, groups, range);
  if (products.length < range.min) ctx.report.warn(`${department.name}: só ${products.length} produto(s) encontrados (mínimo pedido: ${range.min})`);

  let scraped: ScrapedProduct[];
  if (withDetails) {
    let done = 0;
    scraped = await mapLimit(products, optionNumber(ctx, 'paralelo', 4), async (listed) => {
      try {
        return await fetchProduct(client, listed);
      } catch (error) {
        ctx.report.warn(`${listed.id} ${listed.name}: ${error instanceof Error ? error.message : String(error)}; mantendo dados da listagem`);
        return productFromListing(listed, department, groupOf.get(listed.id) ?? null);
      } finally {
        done += 1;
        if (done % 10 === 0 || done === products.length) ctx.report.detail(`detalhes ${done}/${products.length}`);
      }
    });
  } else {
    scraped = products.map((listed) => productFromListing(listed, department, groupOf.get(listed.id) ?? null));
  }

  return {
    source: 'kalunga',
    scrapedAt: new Date().toISOString(),
    category: { ...department, groups },
    sampling: { requested: range.id, target: range.max, groupsSampled, perGroup },
    products: scraped,
  };
}

export const scrapeCategories: Command = {
  id: 'scrape:categories',
  title: 'Listar categorias da Kalunga',
  description: 'Mostra os departamentos do site e, com --grupos, os grupos de cada um',
  group: GROUP,
  keywords: ['categorias', 'departamentos', 'kalunga', 'listar'],
  async run(ctx) {
    const client = newClient(ctx);
    const departments = await fetchDepartments(client);
    const showGroups = ctx.options.grupos === 'true' || ctx.options.groups === 'true';
    for (const department of departments) {
      if (ctx.signal.aborted) break;
      ctx.report.info(`${String(department.id).padStart(3)}  ${department.slug.padEnd(34)} ${department.name}`);
      if (!showGroups) continue;
      const groups = await fetchGroups(client, department);
      for (const group of groups) ctx.report.detail(`${String(group.id).padStart(6)}  ${group.name}${group.highlighted ? ' ★' : ''}`);
    }
    return { status: 'ok', summary: `${departments.length} departamento(s)` };
  },
};

export const scrapeProducts: Command = {
  id: 'scrape:products',
  title: 'Raspar produtos por categoria',
  description: 'Escolhe categorias e quantidade, coleta produtos (com marca, preço, imagens e descrição) e grava JSON em data/kalunga',
  group: GROUP,
  keywords: ['scraper', 'raspar', 'produtos', 'kalunga', 'importar', 'json', 'catalogo'],
  async run(ctx): Promise<CommandResult> {
    const client = newClient(ctx);
    ctx.report.info('Buscando departamentos da Kalunga...');
    const departments = await fetchDepartments(client);
    if (departments.length === 0) return { status: 'error', summary: 'Nenhum departamento encontrado no site' };

    const chosen = await chooseDepartments(ctx, departments);
    if (chosen.length === 0) return { status: 'error', summary: 'Nenhuma categoria escolhida (use --categorias=escolar,informatica)' };
    const range = await chooseRange(ctx);
    if (!range) return { status: 'error', summary: 'Faixa de produtos inválida' };
    const withDetails = !(ctx.options['sem-detalhes'] === 'true' || ctx.options['no-details'] === 'true');
    const root = dataDir();

    ctx.report.info(`${chosen.length} categoria(s), ${range.label.toLowerCase()} cada, ${withDetails ? 'com' : 'sem'} página de detalhes → ${path.relative(ctx.project.rootDir, root)}`);
    if (ctx.dryRun) {
      for (const department of chosen) {
        const groups = await fetchGroups(client, department);
        const plan = planSampling(groups, range.max, optionNumber(ctx, 'por-grupo', 5));
        ctx.report.info(`[dry-run] ${department.name}: ${groups.length} grupo(s), amostraria ${plan.sampledGroups} com ${plan.perGroup} produto(s) cada`);
      }
      return { status: 'ok', summary: 'Dry-run: nada foi gravado' };
    }

    for (const department of chosen) ctx.report.step(department.slug, department.name, 'pending');
    const failures: string[] = [];
    let total = 0;
    for (const department of chosen) {
      if (ctx.signal.aborted) {
        ctx.report.step(department.slug, department.name, 'skipped');
        continue;
      }
      ctx.report.step(department.slug, department.name, 'running');
      ctx.report.title(department.name);
      try {
        const file = await scrapeDepartment(ctx, client, department, range, withDetails);
        const target = writeCategory(root, file);
        const counts = countProducts(file.products);
        total += file.products.length;
        ctx.report.success(`${file.products.length} produto(s) gravados em ${path.relative(ctx.project.rootDir, target)} (marca: ${counts.withBrand}, descrição: ${counts.withDescription}, imagens: ${counts.withImages})`);
        ctx.report.step(department.slug, department.name, file.products.length >= range.min ? 'ok' : 'warn');
      } catch (error) {
        if (ctx.signal.aborted) {
          ctx.report.step(department.slug, department.name, 'skipped');
          break;
        }
        failures.push(department.name);
        ctx.report.error(`${department.name}: ${error instanceof Error ? error.message : String(error)}`);
        ctx.report.step(department.slug, department.name, 'error');
      }
    }

    const { index, brands } = rebuildSummaries(root);
    ctx.report.info(`index.json: ${index.categories.length} categoria(s) · brands.json: ${brands.brands.length} marca(s) · ${client.requests} requisição(ões)`);
    try {
      generateSeed(ctx, readCategories(root));
    } catch (error) {
      failures.push('seed do backend');
      ctx.report.error(`Seed do backend não gerado: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (ctx.signal.aborted) return { status: 'warn', summary: `Interrompido após ${total} produto(s)` };
    if (failures.length > 0) return { status: 'error', summary: `Falhou em: ${failures.join(', ')}` };
    return { status: 'ok', summary: `${total} produto(s) em ${chosen.length} categoria(s)` };
  },
};

export const scrapeStatus: Command = {
  id: 'scrape:status',
  title: 'Dados já raspados',
  description: 'Mostra as categorias, produtos e marcas gravados em data/kalunga',
  group: GROUP,
  keywords: ['status', 'dados', 'json', 'kalunga'],
  async run(ctx) {
    const root = dataDir();
    const categories = readCategories(root);
    if (categories.length === 0) return { status: 'warn', summary: `Nada raspado ainda em ${path.relative(ctx.project.rootDir, root)}` };
    const { brands } = rebuildSummaries(root);
    for (const file of categories) {
      const counts = countProducts(file.products);
      ctx.report.info(`${file.category.name.padEnd(28)} ${String(file.products.length).padStart(4)} produto(s) · marca ${counts.withBrand} · descrição ${counts.withDescription} · ${file.scrapedAt.slice(0, 16).replace('T', ' ')}`);
    }
    ctx.report.info(`${brands.brands.length} marca(s); top: ${brands.brands.slice(0, 5).map((brand) => `${brand.name} (${brand.products})`).join(', ')}`);
    const total = categories.reduce((sum, file) => sum + file.products.length, 0);
    return { status: 'ok', summary: `${total} produto(s) em ${categories.length} categoria(s)` };
  },
};

/**
 * Converte as categorias raspadas nos JSON do seed do backend (`prisma/seed/data`), já no formato do banco.
 * O backend não conhece o CLI: é o CLI que se adapta aos arquivos que o seed lê. Devolve o resumo gerado.
 */
function generateSeed(ctx: CommandContext, categories: CategoryFile[]): string {
  const dir = seedDataDir(requireBackend(ctx));
  const where = path.relative(ctx.project.rootDir, dir);
  const { data, categoryCounts, productStats, warnings } = buildSeedData(categories);
  for (const warning of warnings) ctx.report.detail(warning);

  const groups = categoryCounts.listedGroups + categoryCounts.createdGroups;
  const summary = `${data.brands.length} marca(s), ${data.categories.length} categoria(s) (${categoryCounts.roots} departamentos, ${groups} grupos, ${categoryCounts.subgroups} subgrupos), ${data.products.length} produto(s)`;
  if (ctx.dryRun) {
    ctx.report.info(`[dry-run] gravaria em ${where}: ${summary}`);
    return summary;
  }
  writeSeedData(dir, data);
  ctx.report.success(`Seed gravado em ${where}: ${summary}`);
  ctx.report.detail(
    `produtos: ${productStats.entries} entradas raspadas, ${productStats.withoutBrand} sem marca, ${productStats.suffixedSlugs} slug(s) com sufixo, ` +
      `${productStats.fallbacks} no departamento, ${productStats.truncatedImages} com imagens cortadas, ${productStats.skipped} ignorado(s)`,
  );
  return summary;
}

export const scrapeSeed: Command = {
  id: 'scrape:seed',
  title: 'Gerar seed do catálogo',
  description: 'Converte data/kalunga nos JSON do seed do backend (marcas, categorias e produtos) e, se quiser, popula o banco',
  group: GROUP,
  keywords: ['seed', 'importar', 'carregar', 'banco', 'database', 'prisma', 'json', 'kalunga', 'catalogo', 'backend'],
  async run(ctx): Promise<CommandResult> {
    const categories = readCategories(dataDir());
    if (categories.length === 0) return { status: 'error', summary: 'Nada raspado em data/kalunga; rode scrape:products antes' };

    const summary = generateSeed(ctx, categories);
    if (ctx.dryRun) return { status: 'ok', summary: 'Dry-run: nada foi gravado' };

    const args = ['db', 'seed', '--', '--only=catalog'];
    const populate =
      ctx.options.popular === 'true' ||
      (await ctx.confirm('Popular o banco agora com o catálogo? Categorias e produtos que já existem são atualizados (edições feitas no admin neles são sobrescritas).', false));
    if (!populate) {
      ctx.report.info('Para popular o banco depois: db:seed no CLI ou `npx prisma db seed` no apps/backend.');
      return { status: 'ok', summary: `Seed gerado: ${summary}` };
    }

    if (!(await ensureDatabaseUp(ctx))) return { status: 'error', summary: 'Seed gerado, mas o banco de dados está indisponível' };
    ctx.report.info(`npx prisma ${args.join(' ')}`);
    const result = await prisma(ctx, args);
    if (ctx.signal.aborted) return { status: 'warn', summary: 'Interrompido' };
    if (!result.ok) return { status: 'error', summary: `Seed gerado, mas a carga falhou (código ${result.code}); confira se as migrations foram aplicadas (db:migrate)` };
    return { status: 'ok', summary: 'Seed gerado e catálogo carregado no banco' };
  },
};

export const scrapeMenu: Command = menu({
  id: 'scrape',
  title: 'Scraper da Kalunga',
  description: 'Coleta categorias, produtos e marcas do site da Kalunga e gera o seed do catálogo no backend',
  group: 'Catálogo',
  icon: '🕷️',
  keywords: ['scraper', 'kalunga', 'calunga', 'catalogo', 'produtos', 'categorias', 'marcas', 'seed'],
  children: [scrapeProducts, scrapeSeed, scrapeCategories, scrapeStatus],
});
