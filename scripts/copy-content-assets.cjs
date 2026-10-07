// Source storage is reached through a temporary, loopback-only SSH reverse tunnel.
const { Client } = require('/app/node_modules/minio');
const fs = require('node:fs');
const { source: sourceConfig, tables } = JSON.parse(fs.readFileSync(0, 'utf8'));
const source = new Client({ ...sourceConfig, endPoint: '127.0.0.1', port: 27900, useSSL: false });
const target = new Client({ endPoint: '127.0.0.1', port: 17900, useSSL: false, accessKey: process.env.S3_ACCESS_KEY, secretKey: process.env.S3_SECRET_KEY, region: process.env.S3_REGION || 'us-east-1' });
const videoBucket = process.env.S3_BUCKET_VIDEOS;
const publicBucket = process.env.S3_BUCKET_PUBLIC;
const objects = new Map();
function add(bucket, key) {
  if (key && !/^https?:\/\//.test(key)) objects.set(bucket + ':' + key, { bucket, key });
}
async function main() {
  for (const v of tables.videoAsset) {
    add(videoBucket, v.sourceKey);
    add(publicBucket, v.posterKey);
    if (v.hlsPrefix) {
      let found = false;
      for await (const object of source.listObjectsV2(videoBucket, v.hlsPrefix, true)) { add(videoBucket, object.name); found = true; }
      if (v.status === 'READY' && !found) throw Error('Missing ready video renditions');
    }
  }
  for (const a of tables.attachment) add(videoBucket, a.storageKey);
  for (const t of ['course', 'lesson']) for (const d of tables[t]) {
    add(publicBucket, d.thumbnailKey); add(publicBucket, d.coverKey);
  }
  const pending = [...objects.values()];
  let completed = 0, copiedBytes = 0, skipped = 0;
  console.log(JSON.stringify({ objects: pending.length, status: 'copying' }));
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (pending.length) {
      const item = pending.shift();
      const info = await source.statObject(item.bucket, item.key);
      const current = await target.statObject(item.bucket, item.key).catch(e => {
        if (['NoSuchKey', 'NotFound', 'NoSuchObject'].includes(e.code)) return null;
        throw e;
      });
      if (current) {
        const sourceTag = Object.entries(current.metaData || {}).find(([key]) => key.toLowerCase().replace(/^x-amz-meta-/, '') === 'source-etag')?.[1];
        if (current.size !== info.size || (current.etag !== info.etag && sourceTag !== info.etag)) throw Error('Conflicting production object: ' + item.key);
        skipped++;
      } else {
        await target.putObject(item.bucket, item.key, await source.getObject(item.bucket, item.key), info.size, { ...info.metaData, 'X-Amz-Meta-Source-Etag': info.etag });
        const uploaded = await target.statObject(item.bucket, item.key);
        // Original uploads may use multipart ETags; verify length in that case.
        if (uploaded.size !== info.size || (!info.etag.includes('-') && !uploaded.etag.includes('-') && uploaded.etag !== info.etag)) throw Error('Copied object verification failed');
        copiedBytes += info.size;
      }
      completed++;
      if (completed % 100 === 0 || info.size > 100000000) console.log(JSON.stringify({ completed, copiedBytes, skipped }));
    }
  }));
  console.log(JSON.stringify({ completed, copiedBytes, skipped, status: 'verified' }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
