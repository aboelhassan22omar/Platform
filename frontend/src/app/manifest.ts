import type { MetadataRoute } from 'next';
import { platformConfig } from '@/config/platform.config';

/** Makes the site installable as an app (Android, desktop, iPhone "Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: platformConfig.brand.platformName,
    short_name: platformConfig.brand.shortPlatformName,
    description: platformConfig.brand.description,
    lang: 'ar',
    dir: 'rtl',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a1120',
    theme_color: '#0a1120',
    categories: ['education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'حصصي', url: '/dashboard/lessons' },
      { name: 'الامتحانات', url: '/dashboard/assessments' },
      { name: 'كارنيه الحضور', url: '/dashboard/attendance' },
    ],
  };
}
