import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CheckoutReturn } from '@/features/checkout/checkout-return';

export const metadata: Metadata = { title: 'تأكيد الطلب' };

export default function CheckoutReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-20">
          <div className="skeleton mx-auto h-80 max-w-lg rounded-2xl" />
        </div>
      }
    >
      <CheckoutReturn />
    </Suspense>
  );
}
