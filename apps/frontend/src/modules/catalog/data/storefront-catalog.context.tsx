'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useStorefrontCategories } from './use-storefront-categories.hook';

type StorefrontCatalogValue = ReturnType<typeof useStorefrontCategories>;

const StorefrontCatalogContext = createContext<StorefrontCatalogValue | null>(null);

/**
 * Catálogo compartilhado da loja: a árvore de categorias, carregada uma vez
 * pelo `StorefrontShell` e lida pelos chips, títulos da listagem, "Categorias
 * em destaque" e trilha do detalhe, sem novas chamadas ao navegar.
 */
export function StorefrontCatalogProvider({ children }: { children: ReactNode }) {
  const value = useStorefrontCategories();
  return <StorefrontCatalogContext.Provider value={value}>{children}</StorefrontCatalogContext.Provider>;
}

export function useStorefrontCatalog(): StorefrontCatalogValue {
  const context = useContext(StorefrontCatalogContext);
  if (!context) {
    throw new Error('useStorefrontCatalog deve ser usado dentro de <StorefrontCatalogProvider>.');
  }
  return context;
}
