import { ConfigService } from '@nestjs/config';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { NativePushService } from './native-push.service';

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

const service = (push: Record<string, unknown>) =>
  new NativePushService(
    new ConfigService({
      push: {
        fcmServiceAccount: '',
        apns: { key: '', keyId: '', teamId: '', bundleId: 'cc.aurexis.mrx', sandbox: false },
        ...push,
      },
    }),
  );

const message = { title: 'حصة جديدة', body: 'اتنزلت حصة', url: '/lessons/x', tag: 'n1' };

describe('Store app notifications', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('stays off, without throwing, until it is configured', async () => {
    const off = service({});
    expect(off.androidEnabled).toBe(false);
    expect(off.iosEnabled).toBe(false);
    expect(await off.sendAndroid('t', message)).toBe('failed');
    expect(await off.sendIos('a'.repeat(64), message)).toBe('failed');
  });

  it('signs in to Google with the service account and sends through FCM v1', async () => {
    const account = {
      project_id: 'amr-app',
      client_email: 'push@amr-app.iam.gserviceaccount.com',
      private_key: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    };
    const calls: Array<{ url: string; init: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('oauth2')) {
        return new Response(JSON.stringify({ access_token: 'ya29.x', expires_in: 3600 }));
      }
      return new Response('{}', { status: 200 });
    }) as never;

    const fcm = service({ fcmServiceAccount: JSON.stringify(account) });
    expect(fcm.androidEnabled).toBe(true);
    expect(await fcm.sendAndroid('device-token', message)).toBe('sent');

    const assertion = new URLSearchParams(calls[0].init.body as string).get('assertion')!;
    const [header, claims, signature] = assertion.split('.');
    expect(
      createVerify('RSA-SHA256')
        .update(`${header}.${claims}`)
        .verify(rsa.publicKey, Buffer.from(signature, 'base64url')),
    ).toBe(true);
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    });
    expect(calls[1].url).toBe('https://fcm.googleapis.com/v1/projects/amr-app/messages:send');
    expect(JSON.parse(calls[1].init.body as string).message).toMatchObject({
      token: 'device-token',
      notification: { title: 'حصة جديدة' },
      data: { url: '/lessons/x' },
    });

    // The access token is reused, and an uninstalled app is reported gone.
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] },
          }),
          { status: 404 },
        ),
    ) as never;
    expect(await fcm.sendAndroid('old-token', message)).toBe('gone');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('accepts the Apple key raw and rejects malformed device tokens', async () => {
    const apns = service({
      apns: {
        key: ec.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        keyId: 'ABC123DEFG',
        teamId: 'TEAM123456',
        bundleId: 'cc.aurexis.mrx',
        sandbox: false,
      },
    });
    expect(apns.iosEnabled).toBe(true);
    expect(await apns.sendIos('not-a-token', message)).toBe('gone');

    // The provider token Apple checks: ES256 over header.claims, raw r||s signature.
    const bearer = (apns as unknown as { apnsBearer: () => string }).apnsBearer();
    const [header, claims, signature] = bearer.split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'ES256',
      kid: 'ABC123DEFG',
    });
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString()).iss).toBe('TEAM123456');
    expect(
      createVerify('SHA256')
        .update(`${header}.${claims}`)
        .verify(
          { key: ec.publicKey, dsaEncoding: 'ieee-p1363' },
          Buffer.from(signature, 'base64url'),
        ),
    ).toBe(true);
  });
});
