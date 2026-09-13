/**
 * TEMPLATE — app/page.tsx (root redirect)
 *
 * Redireciona a rota raiz para o módulo padrão do app.
 * Substitua '/module-a' pela rota base do primeiro módulo real.
 */

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/module-a');
}
