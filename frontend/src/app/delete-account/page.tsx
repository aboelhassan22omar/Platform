import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/page-hero';
import { AccountDeletionGuide } from '@/features/legal/account-deletion-guide';
import { platformConfig } from '@/config/platform.config';

export const metadata: Metadata = {
  title: 'حذف الحساب',
  description: `إزاي تحذف حسابك على ${platformConfig.brand.platformName} وتطبيقاتها، والبيانات اللي بتتمسح.`,
};

/** Public on purpose: Google Play links here from the app's store listing. */
export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const { done } = await searchParams;
  return (
    <div className="bg-ivory-50 transition-colors duration-300 dark:bg-midnight-950">
      <PageHero
        title="حذف الحساب"
        subtitle={`إزاي تحذف حسابك على ${platformConfig.brand.shortPlatformName} وإيه اللي بيحصل لبياناتك.`}
      />
      <AccountDeletionGuide done={done === '1'} />
    </div>
  );
}
