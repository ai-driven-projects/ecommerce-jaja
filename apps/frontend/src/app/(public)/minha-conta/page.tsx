import { Suspense } from 'react';
import { MyAccountPage, MyAccountPageSkeleton } from '@/modules/customers/pages/my-account.page';

// A página lê a loja escolhida na vitrine com `useSearchParams`, que exige `<Suspense>` no build.
export default function Page() {
  return (
    <Suspense fallback={<MyAccountPageSkeleton />}>
      <MyAccountPage />
    </Suspense>
  );
}
