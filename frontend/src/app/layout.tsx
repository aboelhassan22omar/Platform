import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { AppProviders } from '@/components/providers/app-providers';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { platformConfig } from '@/config/platform.config';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:7300'),
  title: {
    default: platformConfig.brand.platformName,
    template: `%s | ${platformConfig.brand.shortPlatformName}`,
  },
  description: platformConfig.brand.description,
  keywords: [...platformConfig.seo.keywords],
  authors: [{ name: 'Aurexis', url: 'https://aurexis.cc/' }],
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    siteName: platformConfig.brand.platformName,
    title: platformConfig.brand.platformName,
    description: platformConfig.brand.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfbf7' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1120' },
  ],
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Tajawal:wght@500;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('amr_mahrous_theme')||'dark';document.documentElement.classList.add(t);document.documentElement.setAttribute('data-mode',t);document.documentElement.style.colorScheme=t;}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh flex flex-col antialiased transition-colors duration-300">
        <AppProviders>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:right-4 focus:z-[100] focus:rounded-lg focus:bg-midnight-900 focus:px-4 focus:py-2 focus:text-ivory-50"
          >
            تخطَّ إلى المحتوى
          </a>

          <SiteHeader />

          <main id="main" className="flex-1">
            {children}
          </main>

          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
