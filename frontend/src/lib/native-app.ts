'use client';

import { useSyncExternalStore } from 'react';
import { NATIVE_UA_MARKER, WEB_ONLY_PATHS } from './native-detect';

/**
 * The Google Play / App Store apps load this site inside a native shell
 * (mobile/). The shell adds "AmrMahrousApp/<version> (<platform>[; push])" to
 * the user agent; an inline script in the root layout turns that into classes
 * on <html> before the first paint:
 *
 *   native-app        always, inside either app
 *   native-ios / native-android
 *
 * The apps sell nothing (purchases are made on the website only, which keeps
 * them inside Apple's and Google's payment rules). Anything about buying is
 * marked `web-only` and disappears in the app through CSS, so there is no
 * flash of a price before hydration; copy that only makes sense in the app
 * is marked `app-only`.
 */
export { NATIVE_UA_MARKER, WEB_ONLY_PATHS };

export type NativePlatform = 'ios' | 'android';

export function nativePlatform(): NativePlatform | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const at = ua.indexOf(NATIVE_UA_MARKER);
  if (at === -1) return null;
  return ua.indexOf('(ios', at) > -1 ? 'ios' : 'android';
}

export const isNativeApp = () => nativePlatform() !== null;

/** Android builds without Firebase cannot receive pushes; the shell says which. */
export function nativeCanPush(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const at = ua.indexOf(NATIVE_UA_MARKER);
  return at > -1 && ua.indexOf('push)', at) > -1 && Boolean(nativePlugins()?.PushNotifications);
}

const noopSubscribe = () => () => undefined;

/** True inside the store apps. False during server rendering and on the web. */
export function useNativeApp(): boolean {
  return useSyncExternalStore(noopSubscribe, isNativeApp, () => false);
}

export const isWebOnlyPath = (pathname: string) =>
  WEB_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

// ---------------------------------------------------------------------------
// The Capacitor bridge, injected by the shell. Typed only as far as we use it.
// ---------------------------------------------------------------------------

interface ListenerHandle {
  remove: () => Promise<void>;
}

type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

export interface PushNotificationsPlugin {
  checkPermissions(): Promise<{ receive: PermissionState }>;
  requestPermissions(): Promise<{ receive: PermissionState }>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  removeAllDeliveredNotifications(): Promise<void>;
  createChannel(channel: {
    id: string;
    name: string;
    description?: string;
    importance?: 1 | 2 | 3 | 4 | 5;
    visibility?: -1 | 0 | 1;
    vibration?: boolean;
  }): Promise<void>;
  addListener(
    event: 'registration',
    handler: (token: { value: string }) => void,
  ): Promise<ListenerHandle>;
  addListener(
    event: 'registrationError',
    handler: (error: { error: string }) => void,
  ): Promise<ListenerHandle>;
  addListener(
    event: 'pushNotificationActionPerformed',
    handler: (action: { notification: { data?: Record<string, unknown> } }) => void,
  ): Promise<ListenerHandle>;
}

export interface AppPlugin {
  addListener(
    event: 'backButton',
    handler: (state: { canGoBack: boolean }) => void,
  ): Promise<ListenerHandle>;
  addListener(
    event: 'appStateChange',
    handler: (state: { isActive: boolean }) => void,
  ): Promise<ListenerHandle>;
  minimizeApp(): Promise<void>;
}

export interface SystemBarsPlugin {
  setStyle(options: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }): Promise<void>;
}

export interface SplashScreenPlugin {
  hide(options?: { fadeOutDuration?: number }): Promise<void>;
}

/** Private app storage, excluded from iCloud backup on iPhone. */
export type FsDirectory = 'LIBRARY_NO_CLOUD';

export interface FilesystemPlugin {
  readFile(options: {
    path: string;
    directory: FsDirectory;
    encoding: 'utf8';
  }): Promise<{ data: string }>;
  writeFile(options: {
    path: string;
    directory: FsDirectory;
    data: string;
    encoding?: 'utf8';
    recursive?: boolean;
  }): Promise<{ uri: string }>;
  deleteFile(options: { path: string; directory: FsDirectory }): Promise<void>;
  mkdir(options: { path: string; directory: FsDirectory; recursive?: boolean }): Promise<void>;
  rename(options: { from: string; to: string; directory: FsDirectory }): Promise<void>;
  getUri(options: { path: string; directory: FsDirectory }): Promise<{ uri: string }>;
  stat(options: { path: string; directory: FsDirectory }): Promise<{ size: number }>;
}

export interface FileTransferPlugin {
  downloadFile(options: {
    url: string;
    path: string;
    progress?: boolean;
  }): Promise<{ path?: string }>;
  addListener(
    event: 'progress',
    handler: (status: { url: string; bytes: number; contentLength: number }) => void,
  ): Promise<ListenerHandle>;
}

interface NativePlugins {
  PushNotifications?: PushNotificationsPlugin;
  App?: AppPlugin;
  SystemBars?: SystemBarsPlugin;
  SplashScreen?: SplashScreenPlugin;
  Filesystem?: FilesystemPlugin;
  FileTransfer?: FileTransferPlugin;
}

export function nativePlugins(): NativePlugins | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as { Capacitor?: { Plugins?: NativePlugins } }).Capacitor;
  return bridge?.Plugins ?? null;
}
