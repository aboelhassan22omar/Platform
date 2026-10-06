import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicRoot = path.join(root, 'frontend/public');
const imageExtension = /\.(?:png|jpe?g|webp|avif|svg|gif|ico)$/i;

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'generated') return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(absolute) : [absolute];
  });
}

// Include local environment overrides without printing their contents or secrets.
const referenceFiles = [
  ...filesIn(path.join(root, 'frontend/src')).filter((file) => /\.(?:tsx?|css)$/.test(file)),
  ...['.env', '.env.example', 'frontend/.env.local'].map((file) => path.join(root, file)),
].filter((file) => fs.existsSync(file));
const references = referenceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const usedPaths = new Set(
  references.match(/\/(?:images|brand)\/[\w./-]+\.(?:png|jpe?g|webp|avif|svg|gif|ico)\b/gi) ?? [],
);
const images = filesIn(publicRoot).filter((file) => imageExtension.test(file));
const unused = images.filter(
  (file) => !usedPaths.has(`/${path.relative(publicRoot, file).replaceAll('\\', '/')}`),
);
const rootImages = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile() && imageExtension.test(entry.name))
  .map((entry) => entry.name);
const unusedRootImages = rootImages.filter((file) => !references.includes(file));
const missing = [...usedPaths].filter((asset) => !fs.existsSync(path.join(publicRoot, asset)));

console.log('Unreferenced public images (review dynamic paths before deleting):');
for (const file of unused) console.log(path.relative(root, file));
for (const file of unusedRootImages) console.log(file);
console.log('Broken local image references:');
for (const asset of missing) console.log(asset);
console.log(
  `Reviewed ${images.length} public images and ${rootImages.length} root images; ${unused.length + unusedRootImages.length} unreferenced, ${missing.length} missing.`,
);
if (missing.length) process.exitCode = 1;
