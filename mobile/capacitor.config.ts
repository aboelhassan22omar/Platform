import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync, readFileSync } from 'node:fs';

/**
 * The store apps are the live platform in a native shell: the site is loaded
 * from production, so every deploy reaches the apps at once with no store
 * update. What the shell adds is native: push notifications, a splash screen,
 * lessons downloaded to the phone and a library to watch them with no
 * connection (www/), the camera for the attendance scanner, the back button.
 *
 * The site recognises the app by the "AmrMahrousApp" marker in the user agent
 * and hides everything to do with buying (see frontend/src/lib/native-app.ts):
 * the apps sell nothing, which keeps them inside both stores' payment rules.
 */
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const site = process.env.APP_SITE_URL || 'https://amr.aurexis.cc';
// Android push needs Firebase; the site only offers it when the build has it.
const androidPush = existsSync('android/app/google-services.json');

const config: CapacitorConfig = {
  appId: 'com.amrmahrous.app',
  appName: 'عمرو محروس',
  webDir: 'www',
  backgroundColor: '#0a1120',
  server: {
    url: site,
    errorPath: 'offline.html',
    androidScheme: 'https',
    // The bundled offline screen and downloads library live on the app's own origin.
    allowNavigation: ['localhost'],
  },
  android: {
    appendUserAgent: `AmrMahrousApp/${version} (android${androidPush ? '; push' : ''})`,
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    appendUserAgent: `AmrMahrousApp/${version} (ios; push)`,
    contentInset: 'never',
    scrollEnabled: true,
    allowsLinkPreview: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Logo and "Powered by Aurexis" for about a second. The site hides it as
    // soon as it has drawn (at least one second in); the 6s cap is a safety
    // net so a slow network never leaves the student on the splash.
    SplashScreen: {
      launchShowDuration: 6000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0a1120',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
  },
};

export default config;
