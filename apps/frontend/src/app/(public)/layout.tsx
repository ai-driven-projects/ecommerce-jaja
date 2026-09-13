import { StorefrontShell } from '@/modules/catalog/components/storefront-shell.component';

/** Tudo que é público vive dentro do shell da loja; a área administrativa fica em `/admin`. */
export default function PublicGroupLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
