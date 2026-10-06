import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { resolvePlatformIdentity } from '../../../backend/src/config/platform-identity';
import { createPlatformIdentity } from '../../../frontend/src/config/platform-identity';

test('server and browser resolve the same defaults for each supported subject', () => {
  for (const subject of [
    'history',
    'chemistry',
    'biology',
    'physics',
    'custom',
    'unknown',
    ' CHEMISTRY ',
    '',
  ]) {
    const server = resolvePlatformIdentity({ SUBJECT_KEY: subject });
    const client = createPlatformIdentity({ subjectKey: subject });
    expect(server.subjectName).toBe(client.subject.name);
    expect(server.subjectKey).toBe(client.subject.key);
    expect(server.teacherName).toBe(client.teacher.displayName);
    expect(server.name).toBe(client.brand.platformName);
  }
});

test('configuration preview leaves credentials intact and write synchronizes public identity', () => {
  const directory = mkdtempSync(join(tmpdir(), 'platform-identity-'));
  const target = join(directory, '.env');
  const original =
    '# Existing configuration\nDATABASE_URL=postgres://fixture\nWHATSAPP_AUTH_TOKEN=fixture-token\nSUBJECT_KEY=history\n';
  writeFileSync(target, original);
  const args = [
    resolve('scripts/configure-platform.cjs'),
    '--subject',
    'chemistry',
    '--teacher',
    'مستر أحمد',
    '--env-file',
    target,
  ];
  try {
    execFileSync(process.execPath, args);
    expect(readFileSync(target, 'utf8')).toBe(original);
    execFileSync(process.execPath, [...args, '--write']);
    const configured = readFileSync(target, 'utf8');
    expect(configured).toContain('DATABASE_URL=postgres://fixture');
    expect(configured).toContain('WHATSAPP_AUTH_TOKEN=fixture-token');
    expect(configured).toContain('SUBJECT_KEY=chemistry');
    expect(configured).toContain('NEXT_PUBLIC_TEACHER_NAME=مستر أحمد');
    expect(configured).toContain('NEXT_PUBLIC_LOGO_DARK=/brand/education-logo.svg');
    expect(configured).not.toContain('SUBJECT_KEY=history');
  } finally {
    // This directory is created by this test under the OS temporary directory.
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep))
      throw new Error('Unexpected temporary directory');
    rmSync(directory, { recursive: true, force: true });
  }
});
