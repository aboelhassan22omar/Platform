import type { Metadata } from 'next';
import { MySubscriptions } from '@/features/dashboard/my-subscriptions';

export const metadata: Metadata = { title: 'اشتراكاتي' };

export default function SubscriptionsPage() {
  return <MySubscriptions />;
}
