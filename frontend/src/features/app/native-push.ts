'use client';

import { api } from '@/lib/api';
import { nativeCanPush, nativePlatform, nativePlugins } from '@/lib/native-app';

/**
 * Push notifications inside the store apps. The native plugin hands out an
 * FCM token (Android) or an APNs device token (iPhone); the server keeps it
 * against the signed-in student and pushes every new notification to it.
 */
const TOKEN_KEY = 'native-push-token';

let listening = false;
let pendingRegistration: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
} | null = null;

const storedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const storeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private storage unavailable: the token is simply sent again next launch.
  }
};

async function sendToken(token: string) {
  const platform = nativePlatform() === 'ios' ? 'IOS' : 'ANDROID';
  await api.post('/push/native', { platform, token });
  storeToken(token);
}

/** Wires the plugin's events once per page load. */
export async function listenForNativePush(onOpen: (url: string) => void) {
  const push = nativePlugins()?.PushNotifications;
  if (!push || listening || !nativeCanPush()) return;
  listening = true;
  await push.addListener('registration', ({ value }) => {
    if (pendingRegistration) {
      pendingRegistration.resolve(value);
      pendingRegistration = null;
    } else {
      void sendToken(value).catch(() => undefined);
    }
  });
  await push.addListener('registrationError', ({ error }) => {
    pendingRegistration?.reject(new Error(error));
    pendingRegistration = null;
  });
  await push.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const url = notification.data?.url;
    // Only paths on this site: a notification never opens anything else.
    onOpen(
      typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')
        ? url
        : '/dashboard/notifications',
    );
  });
  if (nativePlatform() === 'android') {
    // Matches default_notification_channel_id in the Android manifest.
    await push
      .createChannel({
        id: 'platform',
        name: 'إشعارات المنصة',
        description: 'الحصص الجديدة، والردود على أسئلتك، واللايف، والامتحانات',
        importance: 4,
        visibility: 1,
        vibration: true,
      })
      .catch(() => undefined);
  }
}

export type NativePushState = 'unsupported' | 'denied' | 'off' | 'on';

export async function nativePushState(): Promise<NativePushState> {
  const push = nativePlugins()?.PushNotifications;
  if (!push || !nativeCanPush()) return 'unsupported';
  const { receive } = await push.checkPermissions();
  if (receive === 'denied') return 'denied';
  return receive === 'granted' && storedToken() ? 'on' : 'off';
}

/** Asks for permission (if needed), registers, and sends the token to the server. */
export async function enableNativePush(): Promise<NativePushState> {
  const push = nativePlugins()?.PushNotifications;
  if (!push || !nativeCanPush()) return 'unsupported';
  let { receive } = await push.checkPermissions();
  if (receive !== 'granted') ({ receive } = await push.requestPermissions());
  if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'off';
  const token = await new Promise<string>((resolve, reject) => {
    pendingRegistration = { resolve, reject };
    void push.register().catch(reject);
    window.setTimeout(() => reject(new Error('timeout')), 20_000);
  });
  await sendToken(token);
  return 'on';
}

/** Refreshes the token on launch when the student already allowed notifications. */
export async function refreshNativePush() {
  const push = nativePlugins()?.PushNotifications;
  if (!push || !nativeCanPush()) return;
  const { receive } = await push.checkPermissions();
  if (receive === 'granted') await push.register();
}

/** Stops pushes to this phone for the signed-in account (turn off, or sign out). */
export async function disableNativePush() {
  const token = storedToken();
  storeToken(null);
  if (token) await api.delete('/push/native', { body: { token } }).catch(() => undefined);
}
