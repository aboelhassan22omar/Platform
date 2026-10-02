import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SandboxCheckout } from '@/features/checkout/sandbox-checkout';

export const metadata: Metadata = { title: 'محاكاة الدفع (وضع التطوير)' };

/**
 * Stand-in for the payment provider's hosted page.
 *
 * Only reachable when PAYMENT_PROVIDER=dev. It exists so the full purchase
 * journey can be exercised without merchant credentials, and it says plainly
 * on screen that no real payment is taking place.
 */
export default function SandboxCheckoutPage() {
  return (
    <Suspense fallback={<div className="container-page py-20"><div className="skeleton mx-auto h-80 max-w-md rounded-2xl" /></div>}>
      <SandboxCheckout />
    </Suspense>
  );
}
