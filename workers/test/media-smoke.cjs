const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { probe, transcodeToHls, extractPoster } = require('/app/dist/media/ffmpeg');
const run = require('node:util').promisify(require('node:child_process').execFile);
async function main() {
  const directory = await fs.mkdtemp('/tmp/platform-media-smoke-');
  try {
    const source = path.join(directory, 'source.mp4');
    const output = path.join(directory, 'hls');
    await fs.mkdir(output);
    await run('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=854x480:rate=24',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t',
      '2',
      '-c:v',
      'libx264',
      '-threads',
      '1',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      source,
    ]);
    const metadata = await probe(source);
    assert.equal(metadata.height, 480);
    assert.equal(metadata.durationSeconds, 2);
    const progress = [];
    const renditions = await transcodeToHls(
      source,
      output,
      metadata,
      (value) => progress.push(value),
      {
        renditions: [
          { name: '360p', height: 360, videoKbps: 800, audioKbps: 96 },
          { name: '480p', height: 480, videoKbps: 1400, audioKbps: 128 },
          { name: '720p', height: 720, videoKbps: 2800, audioKbps: 128 },
        ],
        segmentSeconds: 1,
      },
    );
    assert.deepEqual(
      renditions.map((item) => item.name),
      ['360p', '480p'],
    );
    for (let index = 0; index < renditions.length; index++) {
      const files = await fs.readdir(path.join(output, `v${index}`));
      assert(files.some((file) => file.endsWith('.m3u8')));
      assert(files.some((file) => file.endsWith('.ts')));
    }
    const poster = path.join(directory, 'poster.jpg');
    await extractPoster(source, poster, metadata.durationSeconds);
    assert((await fs.stat(poster)).size > 0);
    console.log(
      JSON.stringify({
        result: 'passed',
        durationSeconds: metadata.durationSeconds,
        renditions: renditions.map((item) => item.name),
        poster: true,
        progressEvents: progress.length,
      }),
    );
  } finally {
    if (!directory.startsWith('/tmp/platform-media-smoke-'))
      throw new Error('Unexpected cleanup directory');
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
