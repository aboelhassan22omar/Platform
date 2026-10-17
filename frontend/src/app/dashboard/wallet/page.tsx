import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MyWallet } from '@/features/wallet/my-wallet';

export const metadata: Metadata = { title: 'محفظتي' };

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="skeleton h-80 rounded-2xl" />}>
      <MyWallet />
    </Suspense>
  );
}
