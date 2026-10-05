import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL } from '../playwright.config';
import { registrationChallenge } from '../helpers/otp-fixture';

/**
 * API-level contract and security tests.
 *
 * These assert the rules that protect the business: nothing paid is reachable
 * without a server-verified entitlement, money cannot be tampered with, and a
 * replayed webhook cannot grant a second entitlement or take a second payment.
 *
 * Deliberately API-only — these rules must hold regardless of what the UI does,
 * so testing them through the UI would be testing the wrong layer.
 */

const API = '/api';

interface Student {
  fullName: string;
  username: string;
  password: string;
  phone: string;
  parentPhone: string;
  educationSystem: 'GENERAL' | 'BACC';
  gradeLevel: string;
}

function newStudent(overrides: Partial<Student> = {}): Student {
  const n = Math.floor(Math.random() * 90000) + 10000;
  return {
    fullName: 'طالب عقد',
    username: `api${n}`,
    password: 'Test12345',
    phone: `0101${Math.floor(Math.random() * 9000000) + 1000000}`,
    parentPhone: '01112345678',
    educationSystem: 'GENERAL',
    gradeLevel: 'SEC_1',
    ...overrides,
  };
}

/**
 * A request context with its own cookie jar, i.e. its own session.
 *
 * Points at the backend directly (API_BASE_URL), not the proxy — see the note
 * in playwright.config.ts.
 */
async function newSession(_baseURL?: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: API_BASE_URL });
}

async function registerStudent(ctx: APIRequestContext, student = newStudent()) {
  const challenge = registrationChallenge(student);
  const response = await ctx.post(`${API}/auth/register/verify`, { data: { challengeId: challenge.challengeId, code: challenge.code } });
  expect(response.status(), await response.text()).toBe(200);
  return student;
}

async function findPaidLesson(ctx: APIRequestContext) {
  const systems = await (await ctx.get(`${API}/academic/systems`)).json();
  const grade = systems.find((s: { key: string }) => s.key === 'GENERAL').grades[0];
  const detail = await (await ctx.get(`${API}/academic/grades/${grade.slug}`)).json();
  const course = await (
    await ctx.get(
      `${API}/grades/${grade.slug}/courses/${encodeURIComponent(detail.courses[0].slug)}`,
    )
  ).json();

  const lessons = course.units.flatMap((u: { chapters: { lessons: unknown[] }[] }) =>
    u.chapters.flatMap((c) => c.lessons),
  ) as Array<{
    id: string;
    isFreePreview: boolean;
    productId: string | null;
    priceMinor: number | null;
  }>;

  return {
    paid: lessons.find((l) => !l.isFreePreview && l.productId)!,
    free: lessons.find((l) => l.isFreePreview)!,
    other: lessons.filter((l) => !l.isFreePreview).at(-1)!,
  };
}

/** Buys a product and settles it through the signed sandbox webhook path. */
async function purchase(ctx: APIRequestContext, productId: string) {
  const order = await (
    await ctx.post(`${API}/checkout`, {
      data: { productIds: [productId] },
      headers: { 'Idempotency-Key': `e2e-${Date.now()}-${Math.random()}` },
    })
  ).json();

  const providerRef = new URL(order.redirectUrl).searchParams.get('providerRef')!;
  await ctx.post(`${API}/payments/sandbox/confirm`, {
    data: { reference: order.reference, providerRef, success: true },
  });

  return { order, providerRef };
}

// ---------------------------------------------------------------------------
test.describe('authentication', () => {
  test('rejects a grade that does not belong to the chosen pathway', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    const response = await ctx.post(`${API}/auth/register`, {
      data: newStudent({ educationSystem: 'GENERAL', gradeLevel: 'BACC_2' }),
    });
    expect(response.status()).toBe(400);
    await ctx.dispose();
  });

  test.describe('Egyptian phone validation', () => {
    const invalid = ['01712345678', '0101234567', '010123456789', '0201234567', 'abcdefghijk'];
    for (const phone of invalid) {
      test(`rejects ${phone}`, async ({ baseURL }) => {
        const ctx = await newSession(baseURL!);
        const response = await ctx.post(`${API}/auth/register`, {
          data: newStudent({ phone }),
        });
        expect(response.status()).toBe(400);
        await ctx.dispose();
      });
    }

    test('normalises +20 and Eastern-Arabic digits to the national form', async ({ baseURL }) => {
      const ctx = await newSession(baseURL!);
      const national = `0101${Math.floor(Math.random() * 9000000) + 1000000}`;
      await registerStudent(ctx, newStudent({ phone: `+20${national.slice(1)}` }));
      expect((await (await ctx.get(`${API}/auth/me`)).json()).phone).toBe(national);
      await ctx.dispose();
    });
  });

  test('never returns the password hash', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    const student = await registerStudent(ctx);
    const me = await (await ctx.get(`${API}/auth/me`)).text();
    expect(me).not.toContain('passwordHash');
    expect(me).not.toContain(student.password);
    await ctx.dispose();
  });

  test('rejects a duplicate username case-insensitively', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    const student = await registerStudent(ctx);

    const other = await newSession(baseURL!);
    const response = await other.post(`${API}/auth/register`, {
      data: newStudent({ username: student.username.toUpperCase() }),
    });
    expect(response.status()).toBe(409);
    await ctx.dispose();
    await other.dispose();
  });

  test('gives the same error for a wrong password and an unknown user', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    const student = await registerStudent(ctx);

    const wrongPassword = await ctx.post(`${API}/auth/login`, {
      data: { identifier: student.username, password: 'WrongPassword1' },
    });
    const unknownUser = await ctx.post(`${API}/auth/login`, {
      data: { identifier: 'definitely-not-a-user', password: 'WrongPassword1' },
    });

    expect(wrongPassword.status()).toBe(401);
    expect(unknownUser.status()).toBe(401);
    // Identical wording, so the endpoint cannot be used to enumerate accounts.
    expect((await wrongPassword.json()).message).toBe((await unknownUser.json()).message);
    await ctx.dispose();
  });

  test('logout invalidates the session', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(200);

    await ctx.post(`${API}/auth/logout`);
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(401);
    await ctx.dispose();
  });
});

// ---------------------------------------------------------------------------
test.describe('entitlement enforcement', () => {
  test('a paid lesson is locked, and playback is refused outright', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { paid } = await findPaidLesson(ctx);

    const lesson = await (await ctx.get(`${API}/lessons/${paid.id}`)).json();
    expect(lesson.access.allowed).toBe(false);
    expect(lesson.access.reason).toBe('NO_ENTITLEMENT');

    // No media URL is produced for an unentitled student.
    const playback = await ctx.post(`${API}/videos/${paid.id}/playback`);
    expect(playback.status()).toBe(403);

    await ctx.dispose();
  });

  test('a free preview is playable without any purchase', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { free } = await findPaidLesson(ctx);

    const lesson = await (await ctx.get(`${API}/lessons/${free.id}`)).json();
    expect(lesson.access.allowed).toBe(true);
    expect(lesson.access.reason).toBe('FREE_PREVIEW');

    await ctx.dispose();
  });

  test('buying one lesson does not unlock any other', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { paid, other } = await findPaidLesson(ctx);

    await purchase(ctx, paid.productId!);

    const bought = await (await ctx.get(`${API}/lessons/${paid.id}`)).json();
    const notBought = await (await ctx.get(`${API}/lessons/${other.id}`)).json();

    expect(bought.access.allowed).toBe(true);
    expect(notBought.access.allowed).toBe(false);

    await ctx.dispose();
  });

  test('one student cannot reach another student\'s purchase', async ({ baseURL }) => {
    const buyer = await newSession(baseURL!);
    await registerStudent(buyer);
    const { paid } = await findPaidLesson(buyer);
    const { order } = await purchase(buyer, paid.productId!);

    const stranger = await newSession(baseURL!);
    await registerStudent(stranger);

    // Not entitled to the content...
    const lesson = await (await stranger.get(`${API}/lessons/${paid.id}`)).json();
    expect(lesson.access.allowed).toBe(false);

    // ...and cannot read the order either.
    const foreignOrder = await stranger.get(`${API}/orders/${order.reference}`);
    expect(foreignOrder.status()).toBe(404);

    await buyer.dispose();
    await stranger.dispose();
  });

  test('progress cannot be written for a lesson the student does not own', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { other } = await findPaidLesson(ctx);

    const response = await ctx.put(`${API}/lessons/${other.id}/progress`, {
      data: { positionSeconds: 100, durationSeconds: 600 },
    });
    expect(response.status()).toBe(403);

    await ctx.dispose();
  });
});

// ---------------------------------------------------------------------------
test.describe('money and idempotency', () => {
  test('the order total comes from the database, not the request', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { paid } = await findPaidLesson(ctx);

    // A client that posts its own price is simply ignored — unknown fields are
    // rejected by the validation pipe.
    const response = await ctx.post(`${API}/checkout`, {
      data: { productIds: [paid.productId], totalMinor: 1, priceMinor: 1 },
    });
    expect(response.status()).toBe(400);

    const honest = await (
      await ctx.post(`${API}/checkout`, { data: { productIds: [paid.productId] } })
    ).json();
    expect(honest.totalMinor).toBe(paid.priceMinor);

    await ctx.dispose();
  });

  test('the same idempotency key returns the same order', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { paid } = await findPaidLesson(ctx);

    const key = `idem-${Date.now()}`;
    const first = await (
      await ctx.post(`${API}/checkout`, {
        data: { productIds: [paid.productId] },
        headers: { 'Idempotency-Key': key },
      })
    ).json();
    const second = await (
      await ctx.post(`${API}/checkout`, {
        data: { productIds: [paid.productId] },
        headers: { 'Idempotency-Key': key },
      })
    ).json();

    expect(second.reference).toBe(first.reference);
    expect(second.id).toBe(first.id);

    await ctx.dispose();
  });

  test('a replayed webhook does not grant a second entitlement', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { paid } = await findPaidLesson(ctx);

    const { order, providerRef } = await purchase(ctx, paid.productId!);
    const afterFirst = await (await ctx.get(`${API}/me/lessons`)).json();

    const replay = await (
      await ctx.post(`${API}/payments/sandbox/confirm`, {
        data: { reference: order.reference, providerRef, success: true },
      })
    ).json();
    expect(replay.duplicate).toBe(true);

    const afterReplay = await (await ctx.get(`${API}/me/lessons`)).json();
    expect(afterReplay.length).toBe(afterFirst.length);

    await ctx.dispose();
  });

  test('an unsigned webhook is rejected', async ({ baseURL }) => {
    const anon = await newSession(baseURL!);
    const response = await anon.post(`${API}/webhooks/payments`, {
      data: { eventId: 'forged', providerRef: 'x', reference: 'AM-FAKE', success: true },
    });
    expect(response.status()).toBe(400);
    await anon.dispose();
  });

  test('owned content cannot be bought twice', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { paid } = await findPaidLesson(ctx);

    await purchase(ctx, paid.productId!);

    const again = await ctx.post(`${API}/checkout`, {
      data: { productIds: [paid.productId] },
    });
    expect(again.status()).toBe(400);

    await ctx.dispose();
  });

  test('the sandbox provider is labelled as such on every order', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { paid } = await findPaidLesson(ctx);

    const order = await (
      await ctx.post(`${API}/checkout`, { data: { productIds: [paid.productId] } })
    ).json();

    // When running the dev adapter the UI must be told, so it can say so.
    if (order.payment.isSandbox) {
      expect(order.payment.notice).toBeTruthy();
    }

    await ctx.dispose();
  });
});

// ---------------------------------------------------------------------------
test.describe('progress integrity', () => {
  test('seeking cannot manufacture watched progress', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { paid } = await findPaidLesson(ctx);
    await purchase(ctx, paid.productId!);

    const half = await (
      await ctx.put(`${API}/lessons/${paid.id}/progress`, {
        data: { positionSeconds: 300, durationSeconds: 600 },
      })
    ).json();
    expect(half.percent).toBe(0);
    expect(half.completed).toBe(false);

    // A position past the real duration is neither trusted nor awarded.
    const forged = await (
      await ctx.put(`${API}/lessons/${paid.id}/progress`, {
        data: { positionSeconds: 5000, durationSeconds: 600 },
      })
    ).json();
    expect(forged.positionSeconds).toBe(0);
    expect(forged.percent).toBe(0);

    await ctx.dispose();
  });

  test('an absurd position is rejected by validation', async ({ baseURL }) => {
    const ctx = await newSession(baseURL!);
    await registerStudent(ctx);
    const { free } = await findPaidLesson(ctx);

    const response = await ctx.put(`${API}/lessons/${free.id}/progress`, {
      data: { positionSeconds: 10_000_000, durationSeconds: 600 },
    });
    expect(response.status()).toBe(400);

    await ctx.dispose();
  });
});

// ---------------------------------------------------------------------------
test.describe('role-based access control', () => {
  const adminRoutes = [
    '/admin/dashboard/overview',
    '/admin/dashboard/online',
    '/admin/dashboard/sales',
    '/admin/students',
    '/admin/content/courses',
    '/admin/pricing/plans',
  ];

  for (const route of adminRoutes) {
    test(`a student is refused ${route}`, async ({ baseURL }) => {
      const ctx = await newSession(baseURL!);
      await registerStudent(ctx);
      expect((await ctx.get(`${API}${route}`)).status()).toBe(403);
      await ctx.dispose();
    });

    test(`an anonymous caller is refused ${route}`, async ({ baseURL }) => {
      const anon = await newSession(baseURL!);
      expect((await anon.get(`${API}${route}`)).status()).toBe(401);
      await anon.dispose();
    });
  }

  test('protected student routes reject anonymous callers', async ({ baseURL }) => {
    const anon = await newSession(baseURL!);
    for (const route of ['/me/lessons', '/me/continue-watching', '/orders', '/subscriptions/mine']) {
      expect((await anon.get(`${API}${route}`)).status(), route).toBe(401);
    }
    await anon.dispose();
  });
});

// ---------------------------------------------------------------------------
test.describe('public catalogue', () => {
  test('exposes exactly the five academic levels, split by pathway', async ({ baseURL }) => {
    const anon = await newSession(baseURL!);
    const systems = await (await anon.get(`${API}/academic/systems`)).json();

    expect(systems).toHaveLength(2);
    const general = systems.find((s: { key: string }) => s.key === 'GENERAL');
    const bacc = systems.find((s: { key: string }) => s.key === 'BACC');

    expect(general.grades.map((g: { level: string }) => g.level)).toEqual([
      'SEC_1',
      'SEC_2',
      'SEC_3',
    ]);
    expect(bacc.grades.map((g: { level: string }) => g.level)).toEqual(['BACC_1', 'BACC_2']);

    await anon.dispose();
  });

  test('never leaks an unpublished lesson to the public', async ({ baseURL }) => {
    const anon = await newSession(baseURL!);
    const systems = await (await anon.get(`${API}/academic/systems`)).json();
    const grade = systems[0].grades[0];
    const detail = await (await anon.get(`${API}/academic/grades/${grade.slug}`)).json();

    const course = await (
      await anon.get(
        `${API}/grades/${grade.slug}/courses/${encodeURIComponent(detail.courses[0].slug)}`,
      )
    ).json();

    const statuses = course.units
      .flatMap((u: { chapters: { lessons: { status: string }[] }[] }) =>
        u.chapters.flatMap((c) => c.lessons.map((l) => l.status)),
      );
    expect(new Set(statuses)).toEqual(new Set(['PUBLISHED']));

    await anon.dispose();
  });

  test('health endpoints report dependency state', async ({ baseURL }) => {
    const anon = await newSession(baseURL!);

    const live = await (await anon.get(`${API}/health`)).json();
    expect(live.status).toBe('ok');

    const ready = await (await anon.get(`${API}/health/ready`)).json();
    expect(ready.checks.database).toBe(true);
    expect(ready.checks.redis).toBe(true);
    expect(ready.checks.storage).toBe(true);

    await anon.dispose();
  });
});
