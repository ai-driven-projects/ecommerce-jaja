-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- Full-text document of the product's own columns, kept by the database: name
-- and sku weigh A, description weighs C. The folding is the literal expression
-- of `folded()` (src/db/text-search.sql.ts), which is immutable. Brand and
-- category names are added by the storefront query (other tables).
ALTER TABLE "products" ADD COLUMN     "search_document" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', lower(translate(name, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'))), 'A')
    || setweight(to_tsvector('simple', lower(translate(coalesce(sku, ''), 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'))), 'A')
    || setweight(to_tsvector('simple', lower(translate(coalesce(description, ''), 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'))), 'C')
) STORED;

-- CreateIndex
CREATE INDEX "products_is_featured_idx" ON "products"("is_featured");

-- CreateIndex
CREATE INDEX "products_search_document_idx" ON "products" USING GIN ("search_document");
