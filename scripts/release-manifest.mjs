import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';

const sha =
  process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const repository = process.env.GITHUB_REPOSITORY || 'aboelhassan22omar/Platform';
const prefix = `ghcr.io/${repository.toLowerCase()}`;
const base = process.env.BASE_SHA;
const files =
  base && /^[0-9a-f]{40}$/.test(base) && !/^0+$/.test(base)
    ? execFileSync('git', ['diff', '--name-only', base, sha], { encoding: 'utf8' })
        .trim()
        .split('\n')
    : execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
const shared = files.some((file) =>
  /^(package.*json|docker-compose.*yml|\.github\/|docker\/|scripts\/)/.test(file),
);
const services = ['backend', 'frontend', 'worker'].map((service) => ({
  service,
  changed:
    shared ||
    files.some((file) =>
      service === 'worker'
        ? file.startsWith('workers/') || file.startsWith('backend/prisma')
        : file.startsWith(`${service}/`),
    ),
  image: `${prefix}/${service}:${sha}`,
}));
writeFileSync(
  'release-manifest.json',
  JSON.stringify({ commit: sha, base: base || null, services }, null, 2),
);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `prefix=${prefix}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `| Service | Changed | Release image |\n| --- | --- | --- |\n${services.map((s) => `| ${s.service} | ${s.changed ? 'Yes' : 'No'} | \`${s.image}\` |`).join('\n')}\n\nEvery release publishes all three images under the same commit; unchanged layers use the build cache.\n`,
  );
}
console.log(JSON.stringify(services));
