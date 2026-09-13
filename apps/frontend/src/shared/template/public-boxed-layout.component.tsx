import { StorefrontLayout } from '@/shared/template/storefront-layout.component';

type PublicBoxedLayoutProps = {
  children: React.ReactNode;
};

/** Layout do grupo público sem cabeçalho: cada página injeta o seu. */
export function PublicBoxedLayout({ children }: PublicBoxedLayoutProps) {
  return <StorefrontLayout>{children}</StorefrontLayout>;
}
