const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// Use the running worker's ffmpeg and compiled media module without creating jobs or database rows.
const root = resolve(__dirname, '..');
const script = readFileSync(resolve(root, 'workers/test/media-smoke.cjs'), 'utf8');
try {
  const result = execFileSync('docker', ['compose', 'exec', '-T', 'worker', 'node'], {
    cwd: root,
    input: script,
    encoding: 'utf8',
    timeout: 60_000,
  });
  process.stdout.write(result);
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  process.exitCode = 1;
}
