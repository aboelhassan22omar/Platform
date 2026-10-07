// Export only referenced teaching objects as a streaming tar, without credentials.
const { Client } = require('/app/node_modules/minio');
const { once } = require('node:events');
const fs = require('node:fs');
const { tables } = JSON.parse(fs.readFileSync(0, 'utf8'));
const storage = new Client({ endPoint: process.env.S3_ENDPOINT, port: Number(process.env.S3_PORT), useSSL: process.env.S3_USE_SSL === 'true', accessKey: process.env.S3_ACCESS_KEY, secretKey: process.env.S3_SECRET_KEY });
const videoBucket = process.env.S3_BUCKET_VIDEOS, publicBucket = process.env.S3_BUCKET_PUBLIC;
const objects = new Map();
function add(bucket, key) {
  if (!key || /^https?:\/\//.test(key)) return;
  const name = bucket + '/' + key;
  if (!/^[a-zA-Z0-9/._-]+$/.test(name) || name.split('/').includes('..') || Buffer.byteLength(name) > 100) throw Error('Unsafe object path');
  objects.set(name, { bucket, key, name });
}
async function write(buffer) { if (!process.stdout.write(buffer)) await once(process.stdout, 'drain'); }
function header(name, size) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100); h.write('0000600\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
  h.write(size.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136);
  h.fill(32, 148, 156); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
  const sum = h.reduce((n, byte) => n + byte, 0); h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}
async function main() {
  for (const v of tables.videoAsset) {
    add(videoBucket, v.sourceKey); add(publicBucket, v.posterKey);
    if (v.hlsPrefix) for await (const o of storage.listObjectsV2(videoBucket, v.hlsPrefix, true)) add(videoBucket, o.name);
  }
  for (const a of tables.attachment) add(videoBucket, a.storageKey);
  for (const table of ['course', 'lesson']) for (const row of tables[table]) { add(publicBucket, row.thumbnailKey); add(publicBucket, row.coverKey); }
  const manifest = [];
  for (const object of objects.values()) {
    const info = await storage.statObject(object.bucket, object.key);
    manifest.push({ ...object, size: info.size, etag: info.etag, metaData: info.metaData });
    await write(header(object.name, info.size));
    let written = 0;
    for await (const chunk of await storage.getObject(object.bucket, object.key)) { await write(chunk); written += chunk.length; }
    if (written !== info.size) throw Error('Source object size changed');
    await write(Buffer.alloc((512 - info.size % 512) % 512));
  }
  const json = Buffer.from(JSON.stringify(manifest));
  await write(header('manifest.json', json.length)); await write(json);
  await write(Buffer.alloc((512 - json.length % 512) % 512 + 1024));
  console.error(JSON.stringify({ objects: manifest.length, bytes: manifest.reduce((n, o) => n + o.size, 0) }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
