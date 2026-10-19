/**
 * Store screenshots, taken from the live site exactly as the apps show it.
 *
 *   APP_REVIEW_USER=appreview APP_REVIEW_PASSWORD='...' node mobile/scripts/store-screenshots.mjs
 *
 * Signs in with the reviewers' demo account (docs/store-apps/README.md, step 7)
 * and writes:
 *   mobile/store/app-store/*.png                 iPhone 6.9" (1320x2868)
 *   mobile/store/google-play/screenshots/*.png   phone (1080x1920)
 *   mobile/store/google-play/feature-graphic.png 1024x500
 * Needs the repo's Playwright (npm install at the root, then
 * `npx playwright install chromium` once).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MOBILE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
// The same address the apps open (mobile/www/site.js), unless overridden.
const SITE = (
  process.env.SITE_URL ||
  /APP_SITE_URL = '([^']+)'/.exec(readFileSync(join(MOBILE_DIR, 'www', 'site.js'), 'utf8'))[1]
).replace(/\/$/, '');
const USER = process.env.APP_REVIEW_USER;
const PASSWORD = process.env.APP_REVIEW_PASSWORD;
if (!USER || !PASSWORD) {
  console.error('Set APP_REVIEW_USER and APP_REVIEW_PASSWORD (the demo account).');
  process.exit(1);
}

const MOBILE = MOBILE_DIR;
const WWW = join(MOBILE, 'www');
const STORE = join(MOBILE, 'store');
const APP_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AmrMahrousApp/1.0.0 (ios; push)';

/** Enough of the native bridge for the site to show the app's features. */
const bridge = (files) => `(() => {
  const files = new Map(Object.entries(${JSON.stringify(files)}));
  const ok = (value) => Promise.resolve(value);
  const listener = () => ok({ remove: () => ok() });
  window.Capacitor = {
    convertFileSrc: (uri) => uri,
    Plugins: {
      SplashScreen: { hide: () => ok() },
      SystemBars: { setStyle: () => ok() },
      App: { addListener: listener, minimizeApp: () => ok() },
      PushNotifications: {
        checkPermissions: () => ok({ receive: 'prompt' }), requestPermissions: () => ok({ receive: 'granted' }),
        register: () => ok(), unregister: () => ok(), removeAllDeliveredNotifications: () => ok(),
        createChannel: () => ok(), addListener: listener,
      },
      Filesystem: {
        readFile: ({ path }) => (files.has(path) ? ok({ data: files.get(path) }) : Promise.reject(new Error('missing'))),
        writeFile: ({ path, data }) => { files.set(path, data); return ok({ uri: 'file:///' + path }); },
        deleteFile: () => ok(), mkdir: () => ok(), rename: () => ok(),
        getUri: ({ path }) => ok({ uri: 'file:///' + path }), stat: () => ok({ size: 1 }),
      },
      FileTransfer: { downloadFile: () => ok({}), addListener: listener },
    },
  };
})();`;

const browser = await chromium.launch({ channel: 'chromium' });
try {
  // Sign in once and reuse the session for both phone sizes: the account
  // counts as one device, so the device limit is not hit.
  const signIn = await browser.newContext({ userAgent: APP_UA });
  const login = await signIn.request.post(`${SITE}/api/auth/login`, {
    data: { identifier: USER, password: PASSWORD },
  });
  if (!login.ok()) {
    throw new Error(
      `Sign-in failed (${login.status()}): check the demo account, and lift its device limit (README step 7).`,
    );
  }
  const session = await signIn.storageState();
  await signIn.close();

  for (const target of [
    { dir: join(STORE, 'app-store'), viewport: { width: 440, height: 956 } },
    { dir: join(STORE, 'google-play', 'screenshots'), viewport: { width: 360, height: 640 } },
  ]) {
    mkdirSync(target.dir, { recursive: true });
    const context = await browser.newContext({
      viewport: target.viewport,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: APP_UA,
      locale: 'ar-EG',
      colorScheme: 'dark',
      storageState: session,
    });
    const lessons = await (await context.request.get(`${SITE}/api/me/lessons`)).json();
    const playable = lessons.filter((lesson) => lesson.isPlayable);
    if (!playable.length) throw new Error('The demo account has no playable lessons yet.');

    await context.addInitScript(bridge({}));
    const page = await context.newPage();
    const shot = async (name) => {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(target.dir, `${name}.png`) });
    };

    await page.goto(`${SITE}/`, { waitUntil: 'networkidle' });
    await shot('1-home');
    await page.goto(`${SITE}/dashboard/lessons`, { waitUntil: 'networkidle' });
    await shot('2-my-lessons');
    await page.goto(`${SITE}/lessons/${playable[0].id}`, { waitUntil: 'networkidle' });
    await shot('3-lesson');
    await page.goto(`${SITE}/dashboard/assessments`, { waitUntil: 'networkidle' });
    await shot('4-exams');

    // The offline library, filled with the account's own lessons.
    const library = {
      version: 1,
      userId: null,
      items: playable.slice(0, 4).map((lesson, index) => ({
        lessonId: lesson.id,
        title: lesson.title,
        courseTitle: lesson.course.title,
        gradeName: '',
        durationSeconds: lesson.durationSeconds,
        sizeBytes: Math.round(lesson.durationSeconds * 175_000),
        quality: '480p',
        file: `offline/${lesson.id}.mp4`,
        poster: null,
        downloadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (7 - index) * 86_400_000).toISOString(),
        watermark: null,
        pendingSeconds: 0,
        positionSeconds: 0,
      })),
    };
    const offline = await context.newPage();
    await offline.addInitScript(bridge({ 'offline/index.json': JSON.stringify(library) }));
    await offline.goto(pathToFileURL(join(WWW, 'library.html')).href);
    await offline.waitForTimeout(800);
    await offline.screenshot({ path: join(target.dir, '5-offline-library.png') });

    await page.goto(`${SITE}/dashboard/attendance`, { waitUntil: 'networkidle' });
    await shot('6-attendance');
    await context.close();
  }

  // Google Play feature graphic (1024x500).
  const icon = readFileSync(join(STORE, 'google-play', 'icon-512.png')).toString('base64');
  const banner = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await banner.setContent(`<!doctype html><html dir="rtl"><head>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;800&display=swap" rel="stylesheet">
    <style>
      body{margin:0;width:1024px;height:500px;display:flex;align-items:center;gap:56px;padding:0 84px;box-sizing:border-box;
        background:radial-gradient(ellipse 70% 90% at 80% 50%,#1b2a44 0%,#0a1120 70%);font-family:Tajawal,sans-serif;color:#f5efe3}
      img{width:220px;height:220px;border-radius:48px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
      h1{margin:0;font-size:58px;font-weight:800;line-height:1.2}
      p{margin:14px 0 0;font-size:28px;color:#dca62d;font-weight:500}
    </style></head><body>
    <img src="data:image/png;base64,${icon}" alt="">
    <div><h1>منصة مستر<br>عمرو محروس</h1><p>حصص وامتحانات ومتابعة، حتى من غير نت</p></div>
  </body></html>`);
  await banner.waitForTimeout(1500);
  await banner.screenshot({ path: join(STORE, 'google-play', 'feature-graphic.png') });
  console.log(`Screenshots written to ${STORE}`);
} finally {
  await browser.close();
}
