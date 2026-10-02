import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { platformConfig } from '@/config/platform.config';

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
  allowScroll = false,
  showSiteChrome = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
  allowScroll?: boolean;
  showSiteChrome?: boolean;
}) {
  return (
    <section
      className={cn(
        'auth-page',
        allowScroll && 'auth-page--scrollable',
        showSiteChrome && 'auth-page--with-chrome',
      )}
      aria-labelledby="auth-page-title"
    >
      <Image
        src="/images/auth-museum-background.png"
        alt=""
        fill
        priority
        unoptimized
        quality={100}
        sizes="100vw"
        className="auth-page__background"
      />
      <div className="auth-page__shade" aria-hidden />
      <div className="auth-page__pattern" aria-hidden />

      {!showSiteChrome && (
        <Link href="/" className="auth-page__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>العودة للرئيسية</span>
        </Link>
      )}

      <div className="auth-page__content">
        <div className={cn('auth-card', wide && 'auth-card--wide')}>
          <div className="auth-card__brand" aria-label={platformConfig.brand.platformName}>
            <span className="auth-card__logo" aria-hidden>
              <Image
                src={platformConfig.brand.logoLight}
                alt=""
                width={52}
                height={38}
                className="block dark:hidden"
              />
              <Image
                src={platformConfig.brand.logoDark}
                alt=""
                width={52}
                height={38}
                className="hidden dark:block"
              />
            </span>
            <span>
              <strong>{platformConfig.brand.platformName}</strong>
              <small>رحلتك لفهم {platformConfig.subject.name} تبدأ من هنا</small>
            </span>
          </div>

          <header className="auth-card__header">
            <span className="auth-card__eyebrow">أهلًا بيك في منصتك</span>
            <h1 id="auth-page-title">{title}</h1>
            <p>{subtitle}</p>
          </header>

          {children}

          <div className="auth-card__secure-note">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>بياناتك محمية، وكلمة السر لا يمكن لأي شخص الاطلاع عليها.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
