// Staged files are mounted read-only at /import; writes go through the storage API.
const { Client } = require('/app/node_modules/minio');
const fs = require('node:fs');
const path = require('node:path');
const storage = new Client({ endPoint: '127.0.0.1', port: 17900, useSSL: false, accessKey: process.env.S3_ACCESS_KEY, secretKey: process.env.S3_SECRET_KEY, region: process.env.S3_REGION || 'us-east-1' });
const manifest = JSON.parse(fs.readFileSync('/import/manifest.json', 'utf8'));
async function main() {
  let copied = 0, skipped = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (manifest.length) {
      const object = manifest.shift();
      const file = path.resolve('/import', object.name);
      if (!file.startsWith('/import/') || ![process.env.S3_BUCKET_VIDEOS, process.env.S3_BUCKET_PUBLIC].includes(object.bucket)) throw Error('Unexpected object path');
      if (fs.statSync(file).size !== object.size) throw Error('Incomplete staged object');
      const existing = await storage.statObject(object.bucket, object.key).catch(e => { if (['NoSuchKey', 'NotFound', 'NoSuchObject'].includes(e.code)) return null; throw e; });
      const sourceTag = existing && Object.entries(existing.metaData || {}).find(([key]) => key.toLowerCase().replace(/^x-amz-meta-/, '') === 'source-etag')?.[1];
      if (existing) {
        if (existing.size !== object.size || (existing.etag !== object.etag && sourceTag !== object.etag)) throw Error('Conflicting production object');
        skipped++;
      } else {
        await storage.fPutObject(object.bucket, object.key, file, { ...object.metaData, 'X-Amz-Meta-Source-Etag': object.etag });
        const saved = await storage.statObject(object.bucket, object.key);
        if (saved.size !== object.size || (!saved.etag.includes('-') && !object.etag.includes('-') && saved.etag !== object.etag)) throw Error('Stored bytes failed verification');
        copied++;
      }
      if ((copied + skipped) % 500 === 0) console.log(JSON.stringify({ copied, skipped }));
    }
  }));
  console.log(JSON.stringify({ copied, skipped, status: 'verified' }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
