import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Records delivery in a sandbox subprocess; verification uses the real API. */
export function registrationChallenge(student: object): {
  challengeId: string; code: string; expiresIn: number; resendAfterSeconds: number;
} {
  const root = resolve(__dirname, '../../..');
  const script = readFileSync(resolve(root, 'backend/test/otp-fixture.cjs'), 'utf8');
  const result = execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'node', '-e', script], {
    cwd: root, input: JSON.stringify(student), encoding: 'utf8', timeout: 30000,
  });
  return JSON.parse(result);
}
