// Shared by the root layout (a server component) and lib/native-app.ts, so it
// must stay free of 'use client'. See lib/native-app.ts for the full story.

/** Added to the user agent by the store apps (mobile/capacitor.config.ts). */
export const NATIVE_UA_MARKER = 'AmrMahrousApp/';

/** Pages that are about paying. The app redirects away from them. */
export const WEB_ONLY_PATHS = ['/checkout', '/dashboard/wallet', '/store'] as const;

/** Runs in <head> before paint; keep it tiny and dependency-free. */
export const NATIVE_DETECT_SCRIPT = `try{var u=navigator.userAgent,i=u.indexOf('${NATIVE_UA_MARKER}');if(i>-1){var c=document.documentElement.classList;c.add('native-app');c.add(u.indexOf('(ios',i)>-1?'native-ios':'native-android');}}catch(e){}`;
