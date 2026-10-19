import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, type KeyObject, createPrivateKey } from 'node:crypto';
import { connect, constants, type ClientHttp2Session } from 'node:http2';
import type { AppConfig } from '../config/configuration';

export interface NativeMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** What happened to one send: delivered, the token is dead, or try later. */
export type NativeResult = 'sent' | 'gone' | 'failed';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

/**
 * Sends notifications to the store apps: Android through Firebase Cloud
 * Messaging (HTTP v1), iPhone straight to Apple Push (HTTP/2, token auth).
 * Both are signed with node's crypto, so there is no SDK to keep up to date.
 * A side that is not configured reports every send as failed and logs once.
 */
@Injectable()
export class NativePushService {
  private readonly logger = new Logger(NativePushService.name);
  private readonly settings: AppConfig['push'];
  private fcmAccount: ServiceAccount | null = null;
  private fcmToken: { value: string; expiresAt: number } | null = null;
  private apnsKey: KeyObject | null = null;
  private apnsJwt: { value: string; issuedAt: number } | null = null;
  private apnsSession: ClientHttp2Session | null = null;
  private warned = new Set<string>();

  constructor(config: ConfigService) {
    this.settings = config.get<AppConfig['push']>('push')!;
    if (this.settings.fcmServiceAccount) {
      try {
        const parsed = JSON.parse(this.settings.fcmServiceAccount) as ServiceAccount;
        if (parsed.project_id && parsed.client_email && parsed.private_key)
          this.fcmAccount = parsed;
      } catch {
        this.logger.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON; Android push is off.');
      }
    }
    const apns = this.settings.apns;
    if (apns.key && apns.keyId && apns.teamId) {
      try {
        this.apnsKey = createPrivateKey(apns.key);
      } catch {
        this.logger.error('APNS_KEY is not a valid .p8 key; iPhone push is off.');
      }
    }
  }

  get androidEnabled() {
    return Boolean(this.fcmAccount);
  }

  get iosEnabled() {
    return Boolean(this.apnsKey);
  }

  private warnOnce(key: string, message: string) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.logger.warn(message);
  }

  // ------------------------------------------------------------------ FCM

  private async fcmAccessToken(): Promise<string> {
    if (this.fcmToken && this.fcmToken.expiresAt > Date.now() + 60_000) return this.fcmToken.value;
    const account = this.fcmAccount!;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
      JSON.stringify({
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    )}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${base64url(signature)}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!response.ok || !body.access_token) {
      throw new Error(`Google token request failed (${response.status})`);
    }
    this.fcmToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  }

  async sendAndroid(token: string, message: NativeMessage): Promise<NativeResult> {
    if (!this.fcmAccount) {
      this.warnOnce('fcm', 'Android push skipped: FIREBASE_SERVICE_ACCOUNT is not set.');
      return 'failed';
    }
    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.fcmAccount.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${await this.fcmAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: { url: message.url, tag: message.tag },
              android: {
                priority: 'HIGH',
                ttl: '21600s',
                notification: { tag: message.tag, default_sound: true },
              },
            },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (response.ok) return 'sent';
      const error = (await response.json().catch(() => ({}))) as {
        error?: { status?: string; details?: Array<{ errorCode?: string }> };
      };
      const code = error.error?.details?.find((d) => d.errorCode)?.errorCode ?? error.error?.status;
      // The app was uninstalled, or the token belongs to another Firebase project.
      if (response.status === 404 || code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH') {
        return 'gone';
      }
      if (response.status === 400 && code === 'INVALID_ARGUMENT') return 'gone';
      this.logger.warn(`FCM send failed: ${response.status} ${code ?? ''}`);
      return 'failed';
    } catch (error) {
      this.logger.warn(`FCM send failed: ${(error as Error).message}`);
      return 'failed';
    }
  }

  // ----------------------------------------------------------------- APNs

  /** Apple accepts a token for an hour and rejects refreshing more than every 20 minutes. */
  private apnsBearer(): string {
    const now = Math.floor(Date.now() / 1000);
    if (this.apnsJwt && now - this.apnsJwt.issuedAt < 40 * 60) return this.apnsJwt.value;
    const { keyId, teamId } = this.settings.apns;
    const unsigned = `${base64url(JSON.stringify({ alg: 'ES256', kid: keyId }))}.${base64url(
      JSON.stringify({ iss: teamId, iat: now }),
    )}`;
    const signature = createSign('SHA256')
      .update(unsigned)
      .sign({ key: this.apnsKey!, dsaEncoding: 'ieee-p1363' });
    this.apnsJwt = { value: `${unsigned}.${base64url(signature)}`, issuedAt: now };
    return this.apnsJwt.value;
  }

  private apnsConnection(): ClientHttp2Session {
    if (this.apnsSession && !this.apnsSession.closed && !this.apnsSession.destroyed) {
      return this.apnsSession;
    }
    const host = this.settings.apns.sandbox
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
    const session = connect(host);
    session.on('error', () => undefined);
    session.on('close', () => {
      if (this.apnsSession === session) this.apnsSession = null;
    });
    // Do not keep the process alive just for an idle connection.
    session.unref();
    this.apnsSession = session;
    return session;
  }

  async sendIos(token: string, message: NativeMessage): Promise<NativeResult> {
    if (!this.apnsKey) {
      this.warnOnce('apns', 'iPhone push skipped: APNS_KEY / APNS_KEY_ID / APNS_TEAM_ID not set.');
      return 'failed';
    }
    if (!/^[0-9a-fA-F]{64,200}$/.test(token)) return 'gone';
    const payload = JSON.stringify({
      aps: {
        alert: { title: message.title, body: message.body },
        sound: 'default',
        'thread-id': 'notifications',
      },
      url: message.url,
      tag: message.tag,
    });
    try {
      const { status, reason } = await new Promise<{ status: number; reason?: string }>(
        (resolve, reject) => {
          const request = this.apnsConnection().request({
            [constants.HTTP2_HEADER_METHOD]: 'POST',
            [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
            authorization: `bearer ${this.apnsBearer()}`,
            'apns-topic': this.settings.apns.bundleId,
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'apns-expiration': String(Math.floor(Date.now() / 1000) + 6 * 3600),
            'apns-collapse-id': message.tag.slice(0, 64),
            'content-type': 'application/json',
          });
          let code = 0;
          let data = '';
          request.setTimeout(15_000, () => request.close(constants.NGHTTP2_CANCEL));
          request.on('response', (headers) => {
            code = Number(headers[constants.HTTP2_HEADER_STATUS]);
          });
          request.setEncoding('utf8');
          request.on('data', (chunk: string) => (data += chunk));
          request.on('end', () => {
            let reason: string | undefined;
            try {
              reason = data ? (JSON.parse(data) as { reason?: string }).reason : undefined;
            } catch {
              reason = undefined;
            }
            resolve({ status: code, reason });
          });
          request.on('error', reject);
          request.end(payload);
        },
      );
      if (status === 200) return 'sent';
      if (
        status === 410 ||
        reason === 'BadDeviceToken' ||
        reason === 'Unregistered' ||
        reason === 'DeviceTokenNotForTopic'
      ) {
        return 'gone';
      }
      this.logger.warn(`APNs send failed: ${status} ${reason ?? ''}`);
      return 'failed';
    } catch (error) {
      this.apnsSession?.destroy();
      this.apnsSession = null;
      this.logger.warn(`APNs send failed: ${(error as Error).message}`);
      return 'failed';
    }
  }
}
