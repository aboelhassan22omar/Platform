import type { Metadata } from 'next';
import { ProfileSettings } from '@/features/dashboard/profile-settings';

export const metadata: Metadata = { title: 'بياناتي' };

export default function ProfilePage() {
  return <ProfileSettings />;
}
